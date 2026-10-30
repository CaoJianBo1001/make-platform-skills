import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const asset = new URL('../skills/make-app-approval/assets/record-write-policy.mjs', import.meta.url);
const load = () => import(asset.href);

test('旧包放行 APPROVED 时，宿主仍拒绝普通编辑，锁和审批展示开关不影响结果', async () => {
  const { getOrdinaryRecordWriteRestriction } = await load();
  for (const locked of [false, undefined]) {
    for (const approvalEnabled of [false, true, undefined]) {
      const record = Object.freeze({ qfei_process_instance_status: 'APPROVED', qfei_is_locked: locked });
      const options = Object.freeze({ approvalEnabled });
      let calls = 0;
      const result = getOrdinaryRecordWriteRestriction(record, (seenRecord, seenOptions) => {
        assert.equal(seenRecord, record);
        assert.equal(seenOptions, options);
        calls += 1;
        return null;
      }, options);
      assert.deepEqual(result, { reason: 'approved', message: '该数据审批已通过，不可编辑' });
      assert.equal(calls, 1);
    }
  }
});

test('保留包的锁、运行态及未来新增限制，不覆盖原原因或报错', async () => {
  const { getOrdinaryRecordWriteRestriction } = await load();
  for (const status of ['IN_APPROVAL', 'RETURNING', 'APPROVED', 'REJECTED', undefined]) {
    const record = Object.freeze({ qfei_process_instance_status: status, qfei_is_locked: true });
    const restriction = Object.freeze({ reason: 'locked', message: '原始锁定提示' });
    assert.equal(getOrdinaryRecordWriteRestriction(record, () => restriction), restriction);
  }
  const future = Object.freeze({ reason: 'future-policy', message: '未来限制' });
  assert.equal(getOrdinaryRecordWriteRestriction({}, () => future), future);
  const failure = new Error('包校验失败');
  assert.throws(() => getOrdinaryRecordWriteRestriction({}, () => { throw failure; }), error => error === failure);
});

test('不扩大其他终态政策，也不用业务状态、动作结果或任务状态猜测流程状态', async () => {
  const { getOrdinaryRecordWriteRestriction } = await load();
  const records = [
    ...['REJECTED', 'CANCELLED', 'UNSUBMITTED', null, undefined, '', 'FUTURE'].map(status => ({ qfei_process_instance_status: status })),
    { status: 'APPROVED', actionResult: '已同意', taskStatus: 'COMPLETED' },
  ];
  for (const record of records) {
    const original = structuredClone(record);
    assert.equal(getOrdinaryRecordWriteRestriction(Object.freeze(record), () => null), null);
    assert.deepEqual(record, original);
  }
});

test('读取最新记录后拦截旧编辑提交，其他可编辑行仍可写入', async () => {
  const { getOrdinaryRecordWriteRestriction } = await load();
  const original = { recordID: 'record-a', qfei_process_instance_status: 'UNSUBMITTED' };
  const records = new Map([
    ['record-a', { ...original, qfei_process_instance_status: 'APPROVED', qfei_is_locked: false }],
    ['record-b', { recordID: 'record-b', qfei_process_instance_status: 'UNSUBMITTED' }],
  ]);
  const writes = [];
  const commit = staleRecord => {
    const latest = records.get(staleRecord.recordID);
    if (getOrdinaryRecordWriteRestriction(latest, () => null)) return;
    writes.push(latest.recordID);
  };
  commit(original);
  assert.deepEqual(writes, []);
  commit(records.get('record-b'));
  assert.deepEqual(writes, ['record-b']);
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
