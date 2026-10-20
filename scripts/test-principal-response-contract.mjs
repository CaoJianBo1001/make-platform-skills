#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reference = fs.readFileSync(path.join(root, 'skills/make-app-permission/references/service-principal-permission.md'), 'utf8');
const example = JSON.parse(reference.split('## Response and field access')[1].match(/```json\s*([\s\S]*?)```/)[1]);
assert.equal(example.code, 200, 'the IAM wire example must retain its code/data envelope, unlike bare current-context');
assert.ok(Array.isArray(example.data?.permissions), 'IAM rows belong to the data DTO, not the response root');
const suite = path.join(root, 'skills/make-app-permission/scripts/principal-response-conformance-suite.mjs');
assert.ok(fs.existsSync(suite), 'Permission must distribute a production UI-loader response regression');
assert.ok(fs.readFileSync(path.join(root, 'skills/make-app-permission/references/testing-and-audit.md'), 'utf8').includes('principal-response-conformance-suite.mjs'), 'the UI loader regression must be discoverable');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'make-principal-response-'));
try {
  for (const variant of ['correct', 'shared-adapter', 'bare-only', 'double-unwrap', 'ignore-code', 'empty-fallback', 'identity-claims', 'swallow-http', 'drop-denial']) {
    const adapter = path.join(temporary, `${variant}.mjs`);
    fs.writeFileSync(adapter, `
      const variant = ${JSON.stringify(variant)};
      const validate = value => !!value && typeof value === 'object' &&
        typeof value.scope === 'string' && value.scope.startsWith('make://') && Array.isArray(value.permissions);
      export function createPermissionLoader(request) {
        const shared = async () => {
          const payload = await request('/app/principal/permission');
          if (payload?.code !== 200) throw new Error('business failure');
          return payload.data;
        };
        return async () => {
          let payload;
          try { payload = variant === 'shared-adapter' ? await shared() : await request('/app/principal/permission'); }
          catch (error) {
            if (variant === 'swallow-http') return { scope: 'make://tenant-1/meta/app/ContractApp', permissions: [] };
            if (variant === 'drop-denial') throw new Error('request failed');
            throw error;
          }
          if (variant === 'identity-claims' && payload?.roles) return { scope: 'make://tenant-1/meta/app/ContractApp', permissions: [] };
          if (!['shared-adapter', 'ignore-code', 'bare-only'].includes(variant) && payload?.code !== 200) throw new Error('business failure');
          let data = ['shared-adapter', 'bare-only'].includes(variant) ? payload
            : variant === 'double-unwrap' ? payload?.data?.data : payload?.data;
          if (variant === 'empty-fallback' && !validate(data)) data = { scope: 'make://tenant-1/meta/app/ContractApp', permissions: [] };
          if (!validate(data)) throw new Error('invalid IAM DTO');
          return data;
        };
      }
    `);
    const result = spawnSync(process.execPath, [suite, adapter], { encoding: 'utf8', timeout: 15000 });
    assert.ifError(result.error);
    const output = result.stdout + result.stderr;
    assert.equal(result.status === 0, ['correct', 'shared-adapter'].includes(variant), `${variant}: ${output}`);
    if (variant === 'bare-only' || variant === 'double-unwrap') assert.match(output, /FAIL iam_success_envelope/);
    if (variant === 'ignore-code') assert.match(output, /FAIL non_success_business_code/);
    if (variant === 'drop-denial') assert.match(output, /FAIL http_403_stays_failure/);
  }
  console.log('principal response contract: PASS (2 valid UI adapters, 7 regression adapters)');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
