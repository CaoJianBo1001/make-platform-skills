#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter, once } from 'node:events';
import { Writable } from 'node:stream';
import { createDirectMakeProxyHandler } from '../skills/make-app-service/references/direct-make-proxy-contract.mjs';

class MockResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headersSent = false;
    this.headers = new Map();
    this.chunks = [];
  }

  _write(chunk, _encoding, callback) {
    this.headersSent = true;
    this.chunks.push(Buffer.from(chunk));
    this.onWrite?.();
    callback();
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  }

  getHeaderNames() {
    return [...this.headers.keys()];
  }

  removeHeader(name) {
    this.headers.delete(name.toLowerCase());
  }

  get body() {
    return Buffer.concat(this.chunks);
  }
}

const upstreamCases = new Map([
  ['/success', {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: Buffer.from('{"code":200,"data":{"id":"record-1"}}'),
  }],
  ['/forbidden', {
    status: 403,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: Buffer.from('{"code":"FORBIDDEN","message":"真实权限错误"}'),
  }],
  ['/failure', {
    status: 500,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
    body: Buffer.from('Make backend unavailable'),
  }],
  ['/binary', {
    status: 200,
    headers: {
      'accept-ranges': 'bytes',
      'content-disposition': 'attachment; filename="records.bin"',
      'content-length': '4',
      'content-type': 'application/octet-stream',
    },
    body: Buffer.from([0, 255, 3, 127]),
  }],
]);

let releaseStreamedUpstream;
let cancelledUpstreamResponse;
let resolveUpstreamCancellation;
const upstreamCancellation = new Promise((resolve) => {
  resolveUpstreamCancellation = resolve;
});

const upstream = http.createServer(async (request, response) => {
  if (request.url === '/streamed-download') {
    const waitForProxy = new Promise((resolve) => {
      releaseStreamedUpstream = resolve;
    });
    response.writeHead(200, {
      'content-disposition': 'attachment; filename="large.bin"',
      'content-type': 'application/octet-stream',
    });
    response.write(Buffer.from('first-'));
    await waitForProxy;
    response.end(Buffer.from('second'));
    return;
  }

  if (request.url === '/cancelled-download') {
    cancelledUpstreamResponse = response;
    response.once('close', () => {
      if (!response.writableEnded) {
        resolveUpstreamCancellation();
      }
    });
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
    });
    response.write(Buffer.from('first-cancellable-chunk'));
    return;
  }

  const fixture = upstreamCases.get(request.url);
  assert.ok(fixture, `Unexpected upstream request: ${request.url}`);
  response.writeHead(fixture.status, fixture.headers);
  response.end(fixture.body);
});

await listen(upstream);
const upstreamOrigin = `http://127.0.0.1:${upstream.address().port}`;
const proxy = http.createServer(createDirectMakeProxyHandler({
  requestUpstream: (request, { signal }) => fetch(`${upstreamOrigin}${request.url}`, {
    signal,
  }),
}));

await listen(proxy);
const proxyOrigin = `http://127.0.0.1:${proxy.address().port}`;

try {
  for (const [path, expected] of upstreamCases) {
    const response = await fetch(`${proxyOrigin}${path}`);
    assert.equal(response.status, expected.status, `${path} must preserve status`);
    for (const [header, value] of Object.entries(expected.headers)) {
      assert.equal(response.headers.get(header), value, `${path} must preserve ${header}`);
    }
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      expected.body,
      `${path} must preserve body bytes`,
    );
  }

  const streamed = openStreamingResponse(`${proxyOrigin}/streamed-download`);
  await waitFor(streamed.firstChunk, 1_000, 'proxy must forward a body chunk before upstream ends');
  assert.equal(streamed.response.headers['content-disposition'], 'attachment; filename="large.bin"');
  releaseStreamedUpstream();
  assert.deepEqual(await streamed.completed, Buffer.from('first-second'));

  const cancelled = openStreamingResponse(`${proxyOrigin}/cancelled-download`);
  const cancelledCompletion = cancelled.completed.then(
    () => ({ completed: true }),
    (error) => ({ error }),
  );
  await waitFor(cancelled.firstChunk, 1_000, 'cancellable proxy must forward its first chunk');
  cancelled.abort();
  const cancelledResult = await waitFor(
    cancelledCompletion,
    1_000,
    'cancelled downstream request must settle',
  );
  assert.ok(cancelledResult.error, 'cancelled downstream response must not complete as a successful download');
  await waitFor(
    upstreamCancellation,
    1_000,
    'client cancellation must close the active upstream download',
  );

  await testClientCancellation();
  await testUpstreamFailureBeforeResponseWrite();
  await testUpstreamFailureAfterResponseWrite();

  console.log('make app direct proxy contract passed');
} finally {
  releaseStreamedUpstream?.();
  cancelledUpstreamResponse?.destroy();
  await close(proxy);
  await close(upstream);
}

function openStreamingResponse(url) {
  let response;
  let outgoingRequest;
  let resolveFirstChunk;
  let rejectFirstChunk;
  const firstChunk = new Promise((resolve, reject) => {
    resolveFirstChunk = resolve;
    rejectFirstChunk = reject;
  });
  const completed = new Promise((resolve, reject) => {
    outgoingRequest = http.get(url, (incoming) => {
      response = incoming;
      const chunks = [];
      incoming.on('data', (chunk) => {
        chunks.push(chunk);
        resolveFirstChunk(chunk);
      });
      incoming.once('end', () => resolve(Buffer.concat(chunks)));
      incoming.once('error', reject);
    });
    outgoingRequest.once('error', (error) => {
      rejectFirstChunk(error);
      reject(error);
    });
  });

  return {
    get response() {
      return response;
    },
    firstChunk,
    completed,
    abort() {
      outgoingRequest.destroy(new Error('test client cancelled response'));
    },
  };
}

async function waitFor(promise, timeoutMs, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function listen(server) {
  server.listen(0, '127.0.0.1');
  return once(server, 'listening');
}

function close(server) {
  server.close();
  return once(server, 'close');
}

async function testClientCancellation() {
  const request = new EventEmitter();
  request.method = 'GET';
  const response = new MockResponse();
  const logger = createLoggerSpy();
  let upstreamSignal;

  const handler = createDirectMakeProxyHandler({
    logger,
    requestUpstream: (_request, options = {}) => {
      upstreamSignal = options.signal;
      if (!upstreamSignal) {
        throw new Error('requestUpstream did not receive a cancellation signal');
      }

      return new Promise((_, reject) => {
        upstreamSignal.addEventListener('abort', () => {
          const error = new Error('client cancelled');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    },
  });

  const pending = handler(request, response);
  await Promise.resolve();
  request.emit('aborted');
  await pending;

  assert.equal(upstreamSignal?.aborted, true, 'client cancellation must abort upstream work');
  assert.equal(response.body.length, 0, 'client cancellation must not generate a Service 5xx body');
  assert.equal(response.destroyed, true, 'client cancellation must close the downstream response');
  assert.equal(request.listenerCount('aborted'), 0, 'request cancellation listener must be cleaned up');
  assert.equal(response.listenerCount('close'), 0, 'response close listener must be cleaned up');
  assert.ok(
    logger.infoEntries.some(([event]) => event === 'direct_make_proxy_cancelled'),
    'client cancellation must be logged as expected control flow',
  );
}

async function testUpstreamFailureBeforeResponseWrite() {
  const request = new EventEmitter();
  request.method = 'GET';
  const response = new MockResponse();
  const logger = createLoggerSpy();
  const handler = createDirectMakeProxyHandler({
    logger,
    requestUpstream: async () => ({
      status: 200,
      headers: new Headers({
        'content-disposition': 'attachment; filename="broken.bin"',
        'content-length': '1024',
        'content-type': 'application/octet-stream',
      }),
      body: new ReadableStream({
        start(controller) {
          controller.error(new Error('upstream failed before its first body byte'));
        },
      }),
    }),
  });

  await handler(request, response);

  assert.equal(response.statusCode, 502, 'pre-write stream failure may use the Service transport status');
  assert.equal(response.getHeader('content-disposition'), undefined, '502 must not retain upstream download headers');
  assert.equal(response.getHeader('content-length'), undefined, '502 must not retain the incomplete upstream length');
  assert.equal(response.getHeader('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(response.body.toString()), {
    code: 'MAKE_TRANSPORT_FAILURE',
    message: 'Make upstream did not return a complete response',
  });
  assert.ok(
    logger.errorEntries.some(([, context]) => context.phase === 'response_stream'),
    'pre-write upstream stream failure must be logged at the proxy boundary',
  );
  assert.doesNotMatch(
    JSON.stringify(logger.errorEntries),
    /upstream failed before/i,
    'proxy logs must not expose the upstream error message',
  );
}

async function testUpstreamFailureAfterResponseWrite() {
  const request = new EventEmitter();
  request.method = 'GET';
  const response = new MockResponse();
  const logger = createLoggerSpy();
  let resolveFirstWrite;
  const firstWrite = new Promise((resolve) => {
    resolveFirstWrite = resolve;
  });
  response.onWrite = resolveFirstWrite;
  const handler = createDirectMakeProxyHandler({
    logger,
    requestUpstream: async () => ({
      status: 200,
      headers: new Headers({
        'content-disposition': 'attachment; filename="partial.bin"',
        'content-type': 'application/octet-stream',
      }),
      body: new ReadableStream({
        async pull(controller) {
          controller.enqueue(Buffer.from('first-part'));
          await firstWrite;
          controller.error(new Error('upstream failed after its first body byte'));
        },
      }),
    }),
  });

  await handler(request, response);

  assert.equal(response.statusCode, 200, 'a started Make response status must not be replaced');
  assert.equal(response.body.toString(), 'first-part', 'a started response must not append a Service error body');
  assert.equal(response.destroyed, true, 'an incomplete started response must be terminated');
  assert.equal(response.getHeader('content-disposition'), 'attachment; filename="partial.bin"');
  assert.ok(
    logger.errorEntries.some(([, context]) => context.phase === 'response_stream'),
    'post-write upstream stream failure must be logged at the proxy boundary',
  );
  assert.doesNotMatch(
    JSON.stringify(logger.errorEntries),
    /upstream failed after/i,
    'proxy logs must not expose the upstream error message',
  );
}

function createLoggerSpy() {
  return {
    infoEntries: [],
    errorEntries: [],
    info(...entry) {
      this.infoEntries.push(entry);
    },
    error(...entry) {
      this.errorEntries.push(entry);
    },
  };
}
