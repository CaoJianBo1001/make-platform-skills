#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const adapterPath = args.find((arg) => !arg.startsWith('--'));
if (!adapterPath || args.some((arg) => arg.startsWith('--') && arg !== '--legacy-envelope')) {
  console.error('Usage: node current-context-conformance-suite.mjs <host-adapter-module> [--legacy-envelope]');
  process.exit(2);
}

const { createPermissionContractHandler } = await import(pathToFileURL(path.resolve(adapterPath)).href);
assert.equal(typeof createPermissionContractHandler, 'function', 'adapter must delegate to the production Service handler');

const appKey = 'ContractApp';
const gatewayOrigin = 'http://make-gateway.invalid';
const cookie = 'make_app_session=contract-fixture';
const host = 'contract-app.example.test';
const identity = { userId: 'user-1', tenantId: 'tenant-1', appId: appKey,
  roles: ['app_admin'], permissions: [`${appKey}.access`] };
const iamBody = '{\n "principal":"user:user-1","scope":"make://tenant-1/meta/app/ContractApp","permissions":[]\n}';
const response = (status, body, contentType = 'application/json; charset=utf-8') => ({ status, body, contentType });
const success = response(200, JSON.stringify(identity));
const cases = [
  ['bare_current_context_reaches_iam', success, response(200, iamBody)],
  ['iam_denial_is_not_auth_context', success, response(403, '{"reason":"permission_denied","permissionKey":"meta.entity.read"}')],
  ['iam_failure_is_preserved', success, response(500, 'IAM unavailable', 'text/plain')],
  ...[401, 403, 503].map((status) => [`auth_${status}_stops_before_iam`,
    response(status, JSON.stringify({ code: status, message: 'auth fixture' })), null]),
  ...[
    ['invalid_json', '{'], ['null', 'null'], ['array', '[]'], ['primitive', '7'],
    ['missing_user', JSON.stringify({ tenantId: 'tenant-1', appId: appKey })],
    ['missing_tenant', JSON.stringify({ userId: 'user-1', appId: appKey })],
    ['missing_app', JSON.stringify({ userId: 'user-1', tenantId: 'tenant-1' })],
    ['blank_user', JSON.stringify({ ...identity, userId: ' ' })],
    ['numeric_tenant', JSON.stringify({ ...identity, tenantId: 1 })],
    ['other_app', JSON.stringify({ ...identity, appId: 'OtherApp' })],
  ].map(([label, body]) => [`invalid_auth_${label}_is_502`, response(200, body), null, true]),
];
if (args.includes('--legacy-envelope')) {
  cases.push(['explicit_legacy_envelope_reaches_iam',
    response(200, JSON.stringify({ code: 200, data: identity })), response(200, iamBody)]);
}

let failures = 0;
for (const [name, authResponse, iamResponse, malformed] of cases) {
  try {
    await runCase(authResponse, iamResponse, malformed);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`current-context conformance: ${cases.length - failures}/${cases.length} passed`);
process.exitCode = failures ? 1 : 0;

async function runCase(authResponse, iamResponse, malformed) {
  const calls = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const selected = url.pathname === '/make/auth/current-context' ? authResponse : iamResponse;
    return new Response(selected?.body ?? 'unexpected gateway call', {
      status: selected?.status ?? 599,
      headers: { 'content-type': selected?.contentType ?? 'text/plain' },
    });
  };
  const handler = await createPermissionContractHandler({ appKey, gatewayOrigin, fetchImpl });
  assert.equal(typeof handler, 'function', 'adapter must return the production Node RequestListener');
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const result = await new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port: server.address().port,
        path: '/api/make/app/principal/permission',
        headers: { cookie, host, 'x-forwarded-host': 'untrusted.example.test' },
        signal: AbortSignal.timeout(3000) }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(calls.length, iamResponse ? 2 : 1, 'IAM must run only after a valid authenticated context');
    assert.equal(calls[0].url.origin, gatewayOrigin);
    assert.equal(calls[0].url.pathname, '/make/auth/current-context');
    assert.equal(calls[0].init.method ?? 'GET', 'GET');
    for (const call of calls) {
      const headers = new Headers(call.init.headers);
      assert.equal(headers.get('cookie'), cookie, 'auth and IAM must share the browser session');
      assert.equal(headers.get('x-forwarded-host'), host);
      assert.equal(headers.get('x-forwarded-proto'), 'https');
    }
    if (malformed) {
      assert.equal(result.status, 502, 'invalid successful identity must not escape as business HTTP 200');
    } else {
      const expected = iamResponse ?? authResponse;
      assert.equal(result.status, expected.status);
      assert.equal(result.headers['content-type'], expected.contentType);
      assert.equal(result.body, expected.body, 'only the completed failure or actual IAM response may be returned');
    }
    if (iamResponse) {
      const iam = calls[1];
      assert.equal(iam.url.origin, gatewayOrigin);
      assert.equal(iam.url.pathname, '/api/make/iam/v1/principal/permission', 'published IAM retains /api/make');
      assert.equal(iam.init.method, 'POST');
      assert.equal(new Headers(iam.init.headers).get('x-make-target'), 'MakeService.GetResource');
      assert.deepEqual(JSON.parse(iam.init.body), { scope: `make://${identity.tenantId}/meta/app/${appKey}` });
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
