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
  if (['REJECTED', 'CANCELLED'].includes(record.qfei_process_instance_status)) return { reason: 'ended', message: '审批已结束，不可编辑' };
  if (['IN_APPROVAL', 'RETURNING'].includes(record.qfei_process_instance_status)) return { reason: 'in-progress', message: '审批中' };
  return null;
}`;

function check({ esm = policy, cjs = policy, copy = false, compat = false } = {}) {
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
    const script = copy ? join(host, 'skill/scripts/verify-record-write-policy.mjs') : verifier;
    if (copy) {
      mkdirSync(join(host, 'skill/scripts'), { recursive: true }); copyFileSync(verifier, script);
      if (compat) {
        mkdirSync(join(host, 'skill/assets'), { recursive: true });
        copyFileSync(new URL('../skills/make-app-approval/assets/record-write-policy.mjs', import.meta.url), join(host, 'skill/assets/record-write-policy.mjs'));
      }
    }
    return spawnSync(process.execPath, [script, host, ...(compat ? ['--compat'] : [])], { encoding: 'utf8', timeout: 10000 });
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
  ['误禁未提交及未知状态', policy.replace('return null;', "return { reason: 'approved', message: '只读' };")],
  ['丢失退回中保护', policy.replace("['IN_APPROVAL', 'RETURNING']", "['IN_APPROVAL']")],
  ['修改传入记录', policy.replace('function restriction(record) {', "function restriction(record) { record.changed = true;")],
]) {
  test(`${name}不能通过验证`, () => {
    const result = check({ esm: faulty, cjs: faulty });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FAIL/);
  });
}

for (const format of ['esm', 'cjs']) for (const status of ['REJECTED', 'CANCELLED']) {
  test(`${format} 原生放行 ${status} 的包不能通过新产品合同`, () => {
    const old = policy.replace("['REJECTED', 'CANCELLED']", status === 'REJECTED' ? "['CANCELLED']" : "['REJECTED']");
    const result = check({ [format]: old });
    assert.notEqual(result.status, 0); assert.match(result.stderr, new RegExp(status));
  });
}
test('0.2.11 形态的旧包经兼容模式可覆盖全部三终态，随包复制可执行', () => {
  const old = policy.replace("['REJECTED', 'CANCELLED']", '[]');
  const native = check({ esm: old, cjs: old });
  assert.notEqual(native.status, 0);
  const result = check({ esm: old, cjs: old, compat: true, copy: true });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /compat/);
});
