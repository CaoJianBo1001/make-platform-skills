#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suite = path.join(scriptDir, 'current-context-conformance-suite.mjs');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-current-context-contract-'));

try {
  const workflow = fs.readFileSync(path.resolve(scriptDir, '../../../.github/workflows/skill-metadata-lint.yml'), 'utf8');
  assert.match(workflow, /node skills\/make-app-auth\/scripts\/test-current-context-conformance-suite\.mjs/u,
    'the executable auth contract regression must remain a continuous CI gate');
  const correct = runHost('correct');
  assert.equal(correct.status, 0, correct.output);
  assert.match(correct.output, /16\/16 passed/);
  const compatible = runHost('legacy', ['--legacy-envelope']);
  assert.equal(compatible.status, 0, compatible.output);
  assert.match(compatible.output, /17\/17 passed/);
  for (const [variant, failingCase] of [
    ['envelope-only', 'bare_current_context_reaches_iam'],
    ['return-auth-instead-of-iam', 'bare_current_context_reaches_iam'],
    ['auth-failure-becomes-502', 'auth_401_stops_before_iam'],
    ['invalid-success-passthrough', 'invalid_auth_invalid_json_is_502'],
    ['iam-path-rewritten', 'bare_current_context_reaches_iam'],
  ]) {
    const result = runHost(variant, ['--legacy-envelope']);
    assert.notEqual(result.status, 0, `${variant} must not pass`);
    assert.match(result.output, new RegExp(`FAIL ${failingCase}:`), result.output);
  }
  console.log('current-context conformance suite tests: PASS (2 valid hosts, 5 regression hosts)');
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function runHost(variant, flags = []) {
  const adapter = path.join(fixtureRoot, `${variant}.mjs`);
  fs.writeFileSync(adapter, `
    const variant = ${JSON.stringify(variant)};
    export const createPermissionContractHandler = ({ appKey, gatewayOrigin, fetchImpl }) => async (req, res) => {
      const headers = { cookie: req.headers.cookie, 'x-forwarded-host': req.headers.host, 'x-forwarded-proto': 'https' };
      const send = async (upstream) => {
        res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') });
        res.end(await upstream.text());
      };
      const invalid = () => { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{}'); };
      const auth = await fetchImpl(gatewayOrigin + '/make/auth/current-context', { method: 'GET', headers });
      if (auth.status !== 200) return variant === 'auth-failure-becomes-502' ? invalid() : send(auth);
      // This test host deliberately names its correct bare parser like a business helper.
      // Names and reusing the same response pointer are not evidence of a contract bug.
      const parseMakeSuccess = (payload) => payload?.code === 200 ? payload.data : payload;
      let payload;
      try { payload = JSON.parse(await auth.clone().text()); }
      catch { return variant === 'invalid-success-passthrough' ? send(auth) : invalid(); }
      if (variant === 'envelope-only' && payload?.code !== 200) return send(auth);
      const identity = parseMakeSuccess(payload);
      if (!identity || typeof identity.userId !== 'string' || !identity.userId.trim() ||
          typeof identity.tenantId !== 'string' || !identity.tenantId.trim() || identity.appId !== appKey) return invalid();
      const iam = await fetchImpl(gatewayOrigin + (variant === 'iam-path-rewritten' ? '/make/iam' : '/api/make/iam') + '/v1/principal/permission', {
        method: 'POST', headers: { ...headers, 'x-make-target': 'MakeService.GetResource' },
        body: JSON.stringify({ scope: 'make://' + identity.tenantId + '/meta/app/' + appKey }),
      });
      return send(variant === 'return-auth-instead-of-iam' ? auth : iam);
    };
  `);
  const result = spawnSync(process.execPath, [suite, adapter, ...flags], { encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
