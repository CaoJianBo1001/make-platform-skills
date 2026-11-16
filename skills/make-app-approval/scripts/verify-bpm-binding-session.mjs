#!/usr/bin/env node
// 宿主控制器的离线行为合同；本文件不实现保存状态机、不访问 Make 或飞书。
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const recordId = '9000000000000000001';
const bindingKey = 'same-flow';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
const bounded = async (work, timeoutMs, onTimeout) => {
  let timer;
  try {
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('宿主未到达预期边界或操作未结束'));
        onTimeout?.();
      }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
};
const controlledIO = held => {
  const calls = [];
  const entered = deferred(), response = deferred();
  let paused = false, closed = false;
  const result = resource => resource === 'upload' ? {fileId: 'fixture-file'} : {recordId};
  const invoke = async (resource, request = {}) => {
    if (closed) throw new Error('验证会话已结束，拒绝新的测试 I/O');
    calls.push({resource, kind: request.kind, signal: request.signal});
    if (resource === held && !paused) {
      paused = true;
      entered.resolve();
      return response.promise;
    }
    return result(resource);
  };
  return {
    calls, entered: entered.promise,
    release: () => response.resolve(result(held)),
    close: () => { closed = true; response.resolve(result(held)); },
    unknown: () => response.reject(new TypeError('fixture write response disconnected')),
    count: resource => calls.filter(call => call.resource === resource).length,
    io: Object.fromEntries(['upload', 'write', 'start', 'withdraw'].map(resource => [resource, request => invoke(resource, request)])),
  };
};
const action = callback => Promise.resolve().then(callback).catch(() => undefined);
const noStart = control => assert.equal(control.count('start'), 0, '旧流程不能继续自动发起');
const snapshot = async host => {
  await host.flush();
  const value = host.snapshot();
  assert.equal(typeof value.writeUnknown, 'boolean', 'snapshot 必须映射原未知结果状态');
  assert.ok(value.savedRecordId === null || typeof value.savedRecordId === 'string', '记录 ID 必须为字符串或 null');
  return value;
};
const refreshSameKey = async host => {
  assert.equal((await snapshot(host)).bindingKey, bindingKey, '必须读取宿主实际绑定值');
  await host.refreshBinding();
  assert.equal((await snapshot(host)).bindingKey, bindingKey, '本场景必须完成同 key 刷新，不能用换 key 代替');
};

export async function verifyBpmBindingSession(createHarness, {timeoutMs = 5000} = {}) {
  assert.equal(typeof createHarness, 'function', '适配器必须导出 createBpmBindingSessionHarness');
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, 'timeoutMs 必须为正数');
  const cases = [
    ['same-key-refresh', {held: 'upload', withAttachments: true}, async (host, control) => {
      const pending = action(host.actions().saveAndSubmit);
      await control.entered;
      await refreshSameKey(host);
      control.release();
      await pending;
      await host.flush();
      assert.equal(control.count('upload'), 1, '同 key 刷新后不能继续第二个上传');
      assert.equal(control.count('write'), 0, '同 key 刷新不能放行旧写入');
      const state = await snapshot(host);
      assert.equal(state.writeUnknown, false, '写请求尚未发出，上传取消不能标成写入结果未知');
      assert.equal(state.savedRecordId, null, '写请求尚未发出，不能伪造已保存结果');
      noStart(control);
    }],
    ...['create', 'submit'].map(kind => [`late-${kind}-success`, {held: 'write'}, async (host, control) => {
      const captured = host.actions()[kind === 'create' ? 'save' : 'saveAndSubmit'];
      const pending = action(captured);
      await control.entered;
      await refreshSameKey(host);
      control.release();
      await pending;
      const state = await snapshot(host);
      assert.equal(state.savedRecordId, recordId, '刷新后迟到的可靠 ID 不能丢失');
      assert.equal(state.writeUnknown, false, '本次可靠成功应确认原写请求的结果');
      assert.equal(control.count('write'), 1, '迟到成功后旧操作不能继续创建、提交或更新');
      assert.equal(control.calls.find(call => call.resource === 'write').kind, kind, '新建合并提交不能退化为创建再发起');
      const callsBeforeStale = control.calls.length;
      await action(captured);
      const afterStale = await snapshot(host);
      assert.equal(control.calls.length, callsBeforeStale, '旧保存回调重入不能发出上传、写入、发起或撤回请求');
      assert.equal(afterStale.savedRecordId, recordId, '旧回调不能清除已确认的原记录 ID');
      assert.equal(afterStale.writeUnknown, false, '旧回调不能改变已确认的写入结果');
      await action(host.actions()[kind === 'create' ? 'save' : 'saveAndSubmit']);
      assert.equal(control.calls.filter(call => call.resource === 'write' && ['create', 'submit'].includes(call.kind)).length, 1, '旧或新保存回调不能再次创建');
      noStart(control);
    }]),
    ...['create', 'submit'].map(kind => [`unknown-${kind}`, {held: 'write'}, async (host, control) => {
      const captured = host.actions()[kind === 'create' ? 'save' : 'saveAndSubmit'];
      const pending = action(captured);
      await control.entered;
      control.unknown();
      await pending;
      assert.equal((await snapshot(host)).writeUnknown, true, '写请求断流不能宣布未创建');
      await refreshSameKey(host);
      assert.equal((await snapshot(host)).writeUnknown, true, '刷新不能清除未知结果保护');
      await action(captured);
      const current = host.actions();
      await action(current.save);
      await action(current.saveAndSubmit);
      assert.equal((await snapshot(host)).writeUnknown, true, '旧回调重入不能清除未知结果保护');
      assert.equal(control.count('write'), 1, '未知结果时切换保存意图也不能再次写入');
      noStart(control);
    }]),
    ['withdraw-refresh', {held: 'withdraw', initialRecordId: recordId}, async (host, control) => {
      const pending = action(host.actions().withdraw);
      await control.entered;
      const signal = control.calls.find(call => call.resource === 'withdraw').signal;
      assert.ok(signal && typeof signal.aborted === 'boolean' && typeof signal.addEventListener === 'function', '撤回应暴露其自身请求的取消信号');
      await refreshSameKey(host);
      assert.equal(signal.aborted, false, '绑定刷新不能取消合法撤回');
      control.release();
      await pending;
      assert.equal(control.count('withdraw'), 1);
      assert.equal(control.count('write'), 0);
      noStart(control);
    }],
  ];
  let passed = 0;
  for (const [name, options, run] of cases) {
    const control = controlledIO(options.held);
    let host, disposal, closed = false;
    const close = () => { closed = true; control.close(); };
    const dispose = () => {
      if (typeof host?.dispose !== 'function') return Promise.resolve();
      return disposal ??= Promise.resolve().then(() => host.dispose());
    };
    try {
      await bounded((async () => {
        host = await createHarness({io: control.io, bindingKey,
          withAttachments: options.withAttachments ?? false, initialRecordId: options.initialRecordId ?? null});
        if (closed) {
          await bounded(dispose(), timeoutMs);
          return;
        }
        for (const method of ['actions', 'refreshBinding', 'snapshot', 'flush', 'dispose']) {
          assert.equal(typeof host?.[method], 'function', `宿主桥接缺少 ${method}`);
        }
        for (const intent of ['save', 'saveAndSubmit', 'withdraw']) assert.equal(typeof host.actions()[intent], 'function', `缺少原始回调 ${intent}`);
        await run(host, control);
      })(), timeoutMs, close);
      passed++;
    } catch (cause) {
      throw new Error(`BPM 绑定时序未通过：${name}；${cause.message}`, {cause});
    } finally {
      close();
      await bounded(dispose(), timeoutMs);
    }
  }
  return {passed};
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (process.argv.length !== 3) {
    console.error('Usage: node verify-bpm-binding-session.mjs <host-adapter-module>');
    process.exitCode = 2;
  } else {
    console.log('开始核验宿主 BPM 绑定刷新与保存结果（仅使用适配器的测试 I/O）');
    try {
      const module = await import(pathToFileURL(realpathSync(process.argv[2])).href);
      const result = await verifyBpmBindingSession(module.createBpmBindingSessionHarness);
      console.log(`PASS：${result.passed} 项宿主绑定时序验证`);
    } catch (error) {
      console.error(`FAIL：${error.message}`);
      process.exitCode = 1;
    }
  }
}
