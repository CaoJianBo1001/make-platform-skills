#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const compatibilityMode = process.argv.length === 4 && process.argv[3] === '--compat';
if (process.argv.length !== 3 && !compatibilityMode) {
  console.error('Usage: node verify-record-write-policy.mjs <host-package-directory> [--compat]');
  process.exit(2);
}

console.log(`Checking installed approval package ordinary-record policy (ESM/CJS, ${compatibilityMode ? 'compat reference' : 'native'})`);
try {
  const packageName = '@qfei-design/make-app-approval';
  const require = createRequire(resolve(process.argv[2], 'package.json'));
  const entry = require.resolve(packageName);
  let packageDir = dirname(entry);
  let manifest;
  while (true) {
    const file = join(packageDir, 'package.json');
    if (existsSync(file)) {
      const candidate = JSON.parse(readFileSync(file, 'utf8'));
      if (candidate.name === packageName) {
        manifest = candidate;
        break;
      }
    }
    assert.notEqual(dirname(packageDir), packageDir, 'Cannot locate approval package manifest');
    packageDir = dirname(packageDir);
  }
  const esmEntry = manifest.exports?.['.']?.import;
  assert.equal(typeof esmEntry, 'string', 'Missing public ESM root export');
  const modules = [
    ['ESM', await import(pathToFileURL(resolve(packageDir, esmEntry)).href)],
    ['CJS', require(packageName)],
  ];
  const states = [
    ['APPROVED', 'approved'], ['IN_APPROVAL', 'in-progress'], ['RETURNING', 'in-progress'],
    ['REJECTED', 'ended'], ['CANCELLED', 'ended'], ['UNSUBMITTED', null],
    [undefined, null], [null, null], ['', null], ['unknown', null],
  ];
  const compatibilityPolicy = compatibilityMode
    ? (await import(new URL('../assets/record-write-policy.mjs', import.meta.url))).getOrdinaryRecordWriteRestriction
    : null;
  let cases = 0;
  for (const [format, sdk] of modules) {
    const packageRestriction = sdk.getRecordApprovalWriteRestriction;
    assert.equal(typeof packageRestriction, 'function', `${format}: missing public restriction function`);
    const restrict = compatibilityMode
      ? (record, options) => compatibilityPolicy(record, packageRestriction, options)
      : packageRestriction;
    for (const approvalEnabled of [true, false, undefined]) {
      for (const locked of [true, false, null, undefined]) {
        for (const [status, reason] of states) {
          const context = `${format}/${String(status)}/${String(locked)}/${String(approvalEnabled)}`;
          const record = Object.freeze({ qfei_process_instance_status: status, qfei_is_locked: locked });
          const result = restrict(record, Object.freeze({ approvalEnabled }));
          const expected = locked === true ? 'locked' : reason;
          if (expected === null) assert.equal(result, null, context);
          else assert.equal(result?.reason, expected, context);
          if (expected === 'approved') assert.equal(result.message, '该数据审批已通过，不可编辑', context);
          cases += 1;
        }
      }
    }
    assert.equal(restrict(Object.freeze({ status: 'APPROVED', actionResult: '已同意', taskStatus: 'COMPLETED' })), null, `${format}: business/task values must not substitute record workflow status`);
  }
  console.log(`PASS: ${cases} state/lock/binding cases and system-field checks; installed version ${manifest.version}`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
