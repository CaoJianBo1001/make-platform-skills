import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const asset = new URL('../skills/make-app-approval/assets/record-write-policy.mjs', import.meta.url);
const load = () => import(asset.href);

for (const [status, reason, message] of [
  ['APPROVED', 'approved', '该数据审批已通过，不可编辑'],
  ['REJECTED', 'ended', '该数据审批已拒绝，不可编辑'],
  ['CANCELLED', 'ended', '该数据审批已撤回，不可编辑'],
]) {
  test(`旧包放行 ${status} 时仍禁编，且不依赖锁、开关和对象绑定`, async () => {
    const { getOrdinaryRecordWriteRestriction } = await load();
    for (const locked of [false, null, undefined]) for (const approvalEnabled of [false, true, undefined]) {
      const record = Object.freeze({ qfei_process_instance_status: status, qfei_is_locked: locked });
      const options = Object.freeze({ approvalEnabled });
      let calls = 0;
      const result = getOrdinaryRecordWriteRestriction(record, (seenRecord, seenOptions) => {
        assert.equal(seenRecord, record); assert.equal(seenOptions, options); calls++; return null;
      }, options);
      assert.deepEqual(result, { reason, message }); assert.equal(calls, 1);
    }
  });
}

test('保留包的锁、运行态及未来新增限制，不覆盖原原因或报错', async () => {
  const { getOrdinaryRecordWriteRestriction } = await load();
  for (const status of ['IN_APPROVAL', 'RETURNING', 'APPROVED', 'REJECTED', 'CANCELLED', undefined]) {
    const record = Object.freeze({ qfei_process_instance_status: status, qfei_is_locked: true });
    const restriction = Object.freeze({ reason: 'locked', message: '原始锁定提示' });
    assert.equal(getOrdinaryRecordWriteRestriction(record, () => restriction), restriction);
  }
  const future = Object.freeze({ reason: 'future-policy', message: '未来限制' });
  assert.equal(getOrdinaryRecordWriteRestriction({}, () => future), future);
  const failure = new Error('包校验失败');
  assert.throws(() => getOrdinaryRecordWriteRestriction({}, () => { throw failure; }), error => error === failure);
});

test('未提交及未知状态仍走原授权，不用业务或任务状态猜测流程状态', async () => {
  const { getOrdinaryRecordWriteRestriction } = await load();
  const records = [
    ...['UNSUBMITTED', null, undefined, '', 'FUTURE', 'toString'].map(status => ({ qfei_process_instance_status: status })),
    { status: 'APPROVED', actionResult: '已同意', taskStatus: 'COMPLETED' },
  ];
  for (const record of records) {
    const original = structuredClone(record);
    assert.equal(getOrdinaryRecordWriteRestriction(Object.freeze(record), () => null), null);
    assert.deepEqual(record, original);
  }
});

test('终态变更后拒绝旧会话提交，UI 与 Service 使用同一限制', async () => {
  const { getOrdinaryRecordWriteRestriction } = await load();
  for (const status of ['APPROVED', 'REJECTED', 'CANCELLED']) {
    const stale = { recordID: 'record-a', qfei_process_instance_status: 'UNSUBMITTED' };
    const latest = Object.freeze({ ...stale, qfei_process_instance_status: status, qfei_is_locked: false });
    let writes = 0, uploads = 0;
    // 两个真实边界应使用同一 helper；此处仅验证其参考合同，不冒充宿主集成验收。
    for (const boundary of ['ui', 'service']) {
      const restriction = getOrdinaryRecordWriteRestriction(latest, () => null);
      assert.ok(restriction, `${boundary}/${status}`);
      if (!restriction) { uploads++; writes++; }
    }
    assert.equal(writes, 0); assert.equal(uploads, 0);
  }
  assert.equal(getOrdinaryRecordWriteRestriction({ qfei_process_instance_status: 'UNSUBMITTED' }, () => null), null);
});

test('随包适配器独立复制后可执行，不依赖原仓库或特定宿主', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'approval-record-policy-'));
  try {
    const destination = join(directory, 'record-write-policy.mjs');
    copyFileSync(asset, destination);
    const { getOrdinaryRecordWriteRestriction } = await import(pathToFileURL(destination));
    assert.equal(getOrdinaryRecordWriteRestriction({ qfei_process_instance_status: 'APPROVED' }, () => null)?.reason, 'approved');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
