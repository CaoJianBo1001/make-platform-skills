import { once } from 'node:events';
import { Readable } from 'node:stream';

/**
 * Minimal Node reference implementation for a Service route that transparently forwards one
 * completed Make response. Host frameworks may adapt the response writer, but
 * must preserve the upstream status, download-safe response headers, and body
 * stream unchanged. requestUpstream receives a request-scoped AbortSignal and
 * must pass it to the actual network client.
 */
export function createDirectMakeProxyHandler({ requestUpstream, logger = {} }) {
  if (typeof requestUpstream !== 'function') {
    throw new TypeError('requestUpstream must be a function');
  }

  return async function directMakeProxyHandler(request, response) {
    const abortScope = createClientAbortScope(request, response);
    let upstream;
    let phase = 'request';

    log(logger, 'info', 'direct_make_proxy_started', {
      method: request.method,
    });

    try {
      upstream = await requestUpstream(request, {
        signal: abortScope.signal,
      });

      if (abortScope.signal.aborted) {
        await cancelUpstreamBody(upstream?.body);
        terminateResponse(response);
        log(logger, 'info', 'direct_make_proxy_cancelled', {
          reason: abortScope.reason,
        });
        return;
      }

      phase = 'response_stream';
      await sendCompletedMakeResponse(response, upstream, {
        signal: abortScope.signal,
      });

      log(logger, 'info', 'direct_make_proxy_completed', {
        status: upstream.status,
      });
    } catch (error) {
      if (abortScope.signal.aborted) {
        terminateResponse(response);
        log(logger, 'info', 'direct_make_proxy_cancelled', {
          reason: abortScope.reason,
        });
        return;
      }

      log(logger, 'error', 'direct_make_proxy_failed', {
        errorName: errorName(error),
        phase,
        upstreamStatus: upstream?.status,
      });
      handleIncompleteResponse(response);
    } finally {
      abortScope.cleanup();
    }
  };
}

export async function sendCompletedMakeResponse(response, upstream, options = {}) {
  response.statusCode = upstream.status;
  copyCompletedResponseHeaders(response, upstream.headers);

  if (!upstream.body) {
    response.end();
    return;
  }

  const body = Readable.fromWeb(upstream.body, {
    signal: options.signal,
  });

  try {
    for await (const chunk of body) {
      if (!response.write(chunk)) {
        await waitForDrain(response, options.signal);
      }
    }
    response.end();
  } finally {
    body.destroy();
  }
}

function copyCompletedResponseHeaders(response, headers) {
  for (const header of [
    'accept-ranges',
    'cache-control',
    'content-disposition',
    'content-range',
    'content-type',
    'etag',
    'last-modified',
  ]) {
    const value = headers.get(header);
    if (value) {
      response.setHeader(header, value);
    }
  }

  // Native fetch may decompress a response body. Forward Content-Length only
  // when there is no content encoding, so its value always matches the bytes
  // written to the browser.
  if (!headers.get('content-encoding')) {
    const contentLength = headers.get('content-length');
    if (contentLength) {
      response.setHeader('content-length', contentLength);
    }
  }
}

function handleIncompleteResponse(response) {
  if (canWriteServiceFailure(response)) {
    clearResponseHeaders(response);
    sendTransportFailure(response);
    return;
  }

  terminateResponse(response);
}

function canWriteServiceFailure(response) {
  return !response.headersSent && !response.writableEnded && !response.destroyed;
}

function clearResponseHeaders(response) {
  if (typeof response.getHeaderNames !== 'function' || typeof response.removeHeader !== 'function') {
    return;
  }

  for (const header of response.getHeaderNames()) {
    response.removeHeader(header);
  }
}

function sendTransportFailure(response) {
  response.statusCode = 502;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({
    code: 'MAKE_TRANSPORT_FAILURE',
    message: 'Make upstream did not return a complete response',
  }));
}

function createClientAbortScope(request, response) {
  const controller = new AbortController();
  let reason;
  const abort = (nextReason) => {
    if (controller.signal.aborted) {
      return;
    }
    reason = nextReason;
    controller.abort();
  };
  const onRequestAborted = () => abort('request_aborted');
  const onResponseClosed = () => {
    if (!response.writableEnded) {
      abort('response_closed');
    }
  };

  request.once?.('aborted', onRequestAborted);
  response.once?.('close', onResponseClosed);

  return {
    signal: controller.signal,
    get reason() {
      return reason;
    },
    cleanup() {
      request.removeListener?.('aborted', onRequestAborted);
      response.removeListener?.('close', onResponseClosed);
    },
  };
}

async function waitForDrain(response, signal) {
  if (signal) {
    await once(response, 'drain', { signal });
    return;
  }
  await once(response, 'drain');
}

async function cancelUpstreamBody(body) {
  if (typeof body?.cancel !== 'function') {
    return;
  }
  try {
    await body.cancel();
  } catch {
    // Cancellation is best-effort cleanup after the downstream client is gone.
  }
}

function terminateResponse(response) {
  if (!response.destroyed && typeof response.destroy === 'function') {
    response.destroy();
  }
}

function errorName(error) {
  return error instanceof Error ? error.name : 'UnknownError';
}

function log(logger, level, event, context) {
  if (typeof logger?.[level] === 'function') {
    logger[level](event, context);
  }
}
