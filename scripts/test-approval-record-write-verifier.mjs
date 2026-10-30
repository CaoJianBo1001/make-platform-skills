import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifier = fileURLToPath(new URL('../skills/make-app-approval/scripts/verify-record-write-policy.mjs', import.meta.url));
const policy = `function restriction(record) {
  if (record.qfei_is_locked === true) return { reason: 'locked', message: '锁定' };
  if (record.qfei_process_instance_status === 'APPROVED') return { reason: 'approved', message: '该数据审批已通过，不可编辑' };
  if (['IN_APPROVAL', 'RETURNING'].includes(record.qfei_process_instance_status)) return { reason: 'in-progress', message: '审批中' };
  return null;
}`;

function check({ esm = policy, cjs = policy, copy = false } = {}) {
  const host = mkdtempSync(join(tmpdir(), 'approval-write-verifier-'));
  try {
    const packageDir = join(host, 'node_modules/@qfei-design/make-app-approval');
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(host, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({
      name: '@qfei-design/make-app-approval', version: '0.2.11', type: 'module',
      exports: { '.': { import: './public.mjs', require: './public.cjs' } },
    }));
    writeFileSync(join(packageDir, 'public.mjs'), `${esm}\nexport { restriction as getRecordApprovalWriteRestriction };`);
    writeFileSync(join(packageDir, 'public.cjs'), `${cjs}\nexports.getRecordApprovalWriteRestriction = restriction;`);
    const script = copy ? join(host, 'verify-record-write-policy.mjs') : verifier;
    if (copy) copyFileSync(verifier, script);
    return spawnSync(process.execPath, [script, host], { encoding: 'utf8', timeout: 10000 });
  } finally {
    rmSync(host, { recursive: true, force: true });
  }
}

test('验证器可独立复制，按公开导出检查 ESM/CJS 的实际禁编行为', () => {
  const result = check({ copy: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS/);
});

for (const format of ['esm', 'cjs']) {
  test(`${format} 即使声明 0.2.11，仍放行 APPROVED 时必须失败`, () => {
    const oldPolicy = policy.replace("if (record.qfei_process_instance_status === 'APPROVED')", 'if (false)');
    const result = check({ [format]: oldPolicy });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APPROVED/);
  });
}

for (const [name, faulty] of [
  ['锁定优先级失效', policy.replace('if (record.qfei_is_locked === true)', 'if (false)')],
  ['误禁其他终态', policy.replace('return null;', "return { reason: 'approved', message: '只读' };")],
  ['丢失退回中保护', policy.replace("['IN_APPROVAL', 'RETURNING']", "['IN_APPROVAL']")],
  ['修改传入记录', policy.replace('function restriction(record) {', "function restriction(record) { record.changed = true;")],
]) {
  test(`${name}不能通过验证`, () => {
    const result = check({ esm: faulty, cjs: faulty });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FAIL/);
  });
}
