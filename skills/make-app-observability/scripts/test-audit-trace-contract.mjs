#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const audit = path.join(directory, 'audit-trace-contract.mjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'make-trace-audit-'));

const write = (root, name, content) => {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};

const uiRequest = `
  export function request(auth, path) {
    const traceId = crypto.randomUUID().replaceAll('-', '');
    const traceparent = '00-' + traceId + '-0123456789abcdef-01';
    const headers = new Headers();
    headers.set('X-Log-Id', traceId);
    headers.set('traceparent', traceparent);
    return auth.api.request(path, { headers: Object.fromEntries(headers) });
  }
`;
const serviceTrace = `
  export function handle(req, res, gatewayHeaders) {
    const trace = resolveRequestTrace(req.headers);
    const traceId = trace.traceId;
    res.setHeader('X-Log-Id', traceId);
    gatewayHeaders.set('X-Log-Id', traceId);
    gatewayHeaders.set('traceparent', trace.traceparent);
    logger.info('request', { traceId });
  }
`;

const fixture = (name, options = {}) => {
  const root = path.join(temporary, name);
  write(root, 'apps/ui/package.json', JSON.stringify({
    dependencies: { '@qfei-design/make-app-observability': options.version ?? '^0.1.5' },
  }));
  write(root, 'apps/ui/src/main.tsx', `import '@qfei-design/make-app-observability/styles.css';`);
  write(root, 'apps/ui/src/error.tsx', `
    import { MakeAppErrorNotice } from '@qfei-design/make-app-observability/react';
    export const ErrorNotice = (props) => <MakeAppErrorNotice {...props} />;
  `);
  write(root, 'apps/ui/src/request.ts', options.uiRequest ?? uiRequest);
  if (options.service !== false) {
    write(root, 'apps/service/src/app.ts', options.serviceTrace ?? serviceTrace);
  }
  if (options.ai) {
    write(root, 'apps/ui/src/assistant.ts', options.ai);
  }
  return root;
};

const run = (root, mode) => {
  const result = spawnSync(process.execPath, [audit, root, '--mode', mode], {
    encoding: 'utf8',
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
};

try {
  const serviceRoot = fixture('service-fronted');
  assert.equal(run(serviceRoot, 'service-fronted').code, 0);
  assert.match(run(serviceRoot, 'service-fronted').output, /status: PASS/);
  assert.match(run(serviceRoot, 'service-fronted').output, /scope: trace wiring only; verify error notice visibility in a real AppShell test/);

  const directRoot = fixture('direct', { service: false });
  assert.equal(run(directRoot, 'direct').code, 0);

  const objectHeaders = fixture('object-headers', {
    service: false,
    uiRequest: `
      export function request(auth, path) {
        const headers = { traceparent: trace.traceparent, 'X-Log-Id': trace.traceId };
        return auth.api.request(path, { headers });
      }
    `,
  });
  assert.equal(run(objectHeaders, 'direct').code, 0);

  const expressHeader = fixture('express-header', {
    serviceTrace: serviceTrace.replace("res.setHeader('X-Log-Id', traceId);", "res.header('X-Log-Id', traceId);"),
  });
  assert.equal(run(expressHeader, 'service-fronted').code, 0);

  const responseAlias = fixture('response-alias', {
    serviceTrace: serviceTrace.replace(
      "res.setHeader('X-Log-Id', traceId);",
      "const outboundResponse = res; outboundResponse.header('X-Log-Id', traceId);",
    ),
  });
  assert.equal(run(responseAlias, 'service-fronted').code, 0);

  const frameworkReply = fixture('framework-reply', {
    serviceTrace: serviceTrace.replace("res.setHeader('X-Log-Id', traceId);", "reply.header('X-Log-Id', traceId);"),
  });
  assert.equal(run(frameworkReply, 'service-fronted').code, 0);

  const missingHeaders = fixture('missing-headers', {
    uiRequest: `export const request = (auth, path) => auth.api.request(path);`,
  });
  assert.match(run(missingHeaders, 'direct').output, /ui_trace_headers_missing/);

  const missingResponse = fixture('missing-response', {
    serviceTrace: serviceTrace.replace("res.setHeader('X-Log-Id', traceId);", ''),
  });
  assert.match(run(missingResponse, 'service-fronted').output, /service_response_trace_missing/);

  const rawInbound = fixture('raw-inbound', {
    serviceTrace: serviceTrace.replace('const trace = resolveRequestTrace(req.headers);', "const trace = { traceId: req.headers['x-log-id'], traceparent: req.headers.traceparent };"),
  });
  assert.match(run(rawInbound, 'service-fronted').output, /service_trace_validation_missing/);

  const rawForward = fixture('raw-forward', {
    serviceTrace: serviceTrace.replace('trace.traceparent);', 'req.headers.traceparent);'),
  });
  assert.match(run(rawForward, 'service-fronted').output, /service_raw_traceparent_forwarding/);

  const missingForwarding = fixture('missing-forwarding', {
    serviceTrace: serviceTrace.replace("gatewayHeaders.set('X-Log-Id', traceId);", '')
      .replace("gatewayHeaders.set('traceparent', trace.traceparent);", ''),
  });
  assert.match(run(missingForwarding, 'service-fronted').output, /service_gateway_trace_missing/);

  for (const version of ['^0.1.3', '^0.1.4', '>0.1.3']) {
    const oldVersion = fixture(`old-version-${version.replaceAll(/[^a-z0-9]/gi, '-')}`, { version });
    assert.match(run(oldVersion, 'direct').output, /observability_version_too_old/);
  }

  for (const version of ['^0.1.5', '>0.1.4', '>=0.1.5 <0.2.0']) {
    const validRange = fixture(`valid-range-${version.replaceAll(/[^a-z0-9]/gi, '-')}`, { version, service: false });
    assert.equal(run(validRange, 'direct').code, 0, `expected ${version} to allow version 0.1.5`);
  }

  const queryTrace = fixture('query-trace', {
    uiRequest: `${uiRequest}\nconst retired = '?__traceparent=' + traceparent;`,
  });
  assert.match(run(queryTrace, 'direct').output, /query_trace_present/);

  const aiMissing = fixture('ai-missing', {
    ai: `export const stream = () => fetch('/api/make/app/ai/v1/chats/1/events');`,
  });
  assert.match(run(aiMissing, 'service-fronted').output, /ai_trace_headers_missing/);

  const aiMissingInit = fixture('ai-missing-init', {
    ai: `export const stream = () => fetch('/api/make/app/ai/v1/chats/1/events', { method: 'GET' });`,
  });
  assert.match(run(aiMissingInit, 'service-fronted').output, /ai_trace_headers_missing/);

  const aiGood = fixture('ai-good', {
    ai: `
      export const stream = (headers) => {
        headers.set('X-Log-Id', trace.traceId);
        headers.set('traceparent', trace.traceparent);
        return fetch('/api/make/app/ai/v1/chats/1/events', { headers });
      };
    `,
  });
  assert.equal(run(aiGood, 'service-fronted').code, 0);

  const aiSharedAdapter = fixture('ai-shared-adapter', {
    uiRequest: `
      export function request(operation) {
        const traceId = crypto.randomUUID().replaceAll('-', '');
        const headers = new Headers(operation.headers);
        headers.set('X-Log-Id', traceId);
        headers.set('traceparent', '00-' + traceId + '-0123456789abcdef-01');
        return fetch(operation.path, { ...operation, credentials: 'include', headers });
      }
    `,
    ai: `
      import type { AuthenticatedTransport } from '@qfei-design/make-ai-assistant/client';
      import { request } from './request';
      export const transport: AuthenticatedTransport = { request };
    `,
  });
  assert.equal(
    run(aiSharedAdapter, 'service-fronted').code,
    0,
    'AI transport may reuse the traced shared request adapter without duplicating headers',
  );

  console.log('Make App Trace audit tests passed');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
