#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const skill = new URL('../skills/make-app-approval/', import.meta.url);
const read = file => fs.readFileSync(new URL(file, skill), 'utf8');
const reference = 'assets/standalone-page-boundaries.mjs';
const boundaries = () => import(new URL(reference, skill));
const entities = [
  { key: 'other_request', name: 'generic_request' },
  { key: 'generic_request', name: '通用申请' },
];
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const verifyRoutes = page => {
  const routes = page.split('\n').filter(line => line.startsWith('|'))
    .flatMap(line => line.split('|').map(cell => cell.trim()))
    .filter(cell => /^`\/bpm\/[^`]+`$/.test(cell)).map(cell => cell.slice(1, -1));
  assert.deepEqual(routes, ['/bpm/objects/:entityKey/new', '/bpm/tasks/:processInstanceId/:taskId'],
    '地址表必须保留两个标准 BPM 入口，不得改名或自动增加实例详情');
};

// 只验证已知的文档冲突及交接边界，不作为宿主成功回调已实现的证据。
const completionDocuments = () => ({
  task: read('references/task-detail.md'),
  page: read('references/standalone-pages.md'),
  verification: read('references/verification.md'),
});
const verifyCompletionContract = ({ task, page, verification }) => {
  assert.ok(!task.includes('成功后包锁定当前动作界面，宿主关闭详情并刷新列表/相关业务记录'),
    '共享任务合同不能要求所有容器成功后都关闭详情');
  const completion = task.split('### 办理成功后的容器行为\n')[1]?.split(/\n##? /)[0];
  assert.ok(completion, '共享任务合同必须明确成功回调的容器边界');
  const rows = completion.split('\n').filter(line => line.startsWith('|'));
  const ordinary = rows.find(line => line.startsWith('| 原列表的抽屉／普通任务路由 |'));
  const standalone = rows.find(line => line.startsWith('| BPM 独立任务页 |'));
  assert.match(ordinary ?? '', /关闭.*返回.*刷新列表.*相关业务记录/);
  assert.match(standalone ?? '', /保留当前任务地址.*重读最新详情与历史.*不挂载.*不跳回列表/);
  assert.match(completion, /onActionSuccess/);
  assert.match(completion, /办理成功，刷新未完成/);
  assert.match(completion, /不能重办同一动作/);
  const handoff = '(task-detail.md#办理成功后的容器行为)';
  assert.ok(page.includes(handoff), '独立页成功行为必须交接共享任务合同');
  assert.ok(verification.includes(handoff), '验收必须覆盖同一份成功回调合同');
  assert.match(verification, /\| 列表抽屉／普通任务路由与 BPM 独立任务页的成功回调 \|[^\n]*关闭／返回[^\n]*保持任务地址[^\n]*重读详情／历史/);
  assert.match(verification, /\| 独立任务办理成功后重读失败 \|[^\n]*办理成功，刷新未完成[^\n]*不能重办同一动作/);
};

test('标准地址及独立页参考边界可从两个 Skill 发现', () => {
  const entry = read('SKILL.md');
  const page = read('references/standalone-pages.md');
  const ui = fs.readFileSync(new URL('../skills/makeui/SKILL.md', import.meta.url), 'utf8');
  assert.ok(entry.includes('(references/standalone-pages.md)'));
  assert.ok(ui.includes('../make-app-approval/references/standalone-pages.md'));
  assert.ok(entry.includes(`(${reference})`), '审批入口必须直接发现可验证的安全边界参考');
  assert.ok(page.includes(`../${reference}`), '独立页合同必须连接安全边界参考');
  verifyRoutes(page);
});

test('文档一致性：成功回调按普通容器与 BPM 独立页分别交接并保留成功结果', () => {
  verifyCompletionContract(completionDocuments());
});

test('故障注入：恢复统一关闭、丢失交接或将独立页改成关闭时门禁失败', () => {
  const documents = completionDocuments();
  verifyCompletionContract(documents);
  assert.throws(() => verifyCompletionContract({
    ...documents,
    task: `${documents.task}\n成功后包锁定当前动作界面，宿主关闭详情并刷新列表/相关业务记录`,
  }));
  assert.throws(() => verifyCompletionContract({
    ...documents,
    page: documents.page.replace('(task-detail.md#办理成功后的容器行为)', '(task-detail.md)'),
  }));
  assert.throws(() => verifyCompletionContract({
    ...documents,
    task: documents.task.replace('保留当前任务地址', '关闭任务详情'),
  }));
});

const verifyEntityPriority = resolveBpmStandaloneEntity => {
  for (const items of [entities, [...entities].reverse()]) {
    assert.equal(resolveBpmStandaloneEntity(items, 'generic_request'), entities[1]);
  }
  assert.equal(resolveBpmStandaloneEntity(entities, '通用申请'), entities[1]);
  assert.equal(resolveBpmStandaloneEntity(entities, 'unknown'), undefined);
  assert.equal(resolveBpmStandaloneEntity([], 'generic_request'), undefined);
};
test('对象 key 优先级不受数组顺序或同名对象影响', async () => {
  verifyEntityPriority((await boundaries()).resolveBpmStandaloneEntity);
});

const verifySignal = async runBpmAttachmentStep => {
  const controller = new AbortController();
  const files = [];
  const session = { signal: controller.signal, isCurrent: () => true };
  for (const field of ['first', 'second']) {
    files.push(await runBpmAttachmentStep(session, async signal => {
      assert.equal(signal, controller.signal);
      return field;
    }));
  }
  assert.deepEqual(files, ['first', 'second']);
};
test('逐次上传复核会话，并把同一取消信号交给请求适配器', async () => {
  await verifySignal((await boundaries()).runBpmAttachmentStep);
});

const verifyPrecheck = async runBpmAttachmentStep => {
  for (const aborted of [false, true]) {
    const controller = new AbortController();
    if (aborted) controller.abort();
    let requests = 0;
    await assert.rejects(runBpmAttachmentStep({
      signal: controller.signal, isCurrent: () => aborted,
    }, async () => { requests++; }), { name: 'AbortError' });
    assert.equal(requests, 0);
  }
};
test('上传前会话失效或已取消时，不能发起请求', async () => {
  await verifyPrecheck((await boundaries()).runBpmAttachmentStep);
});

const verifyLateResult = async runBpmAttachmentStep => {
  for (const abortTransport of [false, true]) {
    const controller = new AbortController();
    const pending = deferred();
    const started = deferred();
    let current = true;
    const counts = { uploads: 0, backfills: 0, submits: 0 };
    const save = (async () => {
      for (const field of ['first', 'second']) {
        const result = await runBpmAttachmentStep({
          signal: controller.signal, isCurrent: () => current,
        }, async () => {
          counts.uploads++;
          started.resolve();
          // 模拟传输层忽略取消并最终返回成功。
          return field === 'first' ? pending.promise : field;
        });
        counts.backfills++;
        assert.equal(result, field);
      }
      counts.submits++;
    })();
    await started.promise;
    current = false;
    if (abortTransport) controller.abort();
    const stopped = assert.rejects(save, { name: 'AbortError' });
    pending.resolve('first');
    await stopped;
    assert.deepEqual(counts, { uploads: 1, backfills: 0, submits: 0 });
  }
};
test('首个上传期间撤权或卸载，迟到结果不回填、不继续上传或提交', async () => {
  await verifyLateResult((await boundaries()).runBpmAttachmentStep);
});

test('会话仍有效时保留真实上传错误，允许宿主沿用既有重试流程', async () => {
  const { runBpmAttachmentStep } = await boundaries();
  const error = new Error('upload failed');
  await assert.rejects(runBpmAttachmentStep({
    signal: new AbortController().signal, isCurrent: () => true,
  }, async () => { throw error; }), actual => actual === error);
});

test('故障注入：定位、上传前后复核、信号或标准地址退化时门禁失败', async () => {
  const { runBpmAttachmentStep } = await boundaries();
  assert.throws(() => verifyEntityPriority((items, requested) =>
    items.find(entity => entity.key === requested || entity.name === requested)));
  await assert.rejects(verifyPrecheck(async (session, upload) => {
    const result = await upload(session.signal);
    session.signal.throwIfAborted();
    if (!session.isCurrent()) throw new DOMException('stale', 'AbortError');
    return result;
  }));
  await assert.rejects(verifyLateResult(async (session, upload) => {
    session.signal.throwIfAborted();
    if (!session.isCurrent()) throw new DOMException('stale', 'AbortError');
    return upload(session.signal);
  }));
  await assert.rejects(verifySignal((session, upload) => runBpmAttachmentStep(session, () => upload())));
  assert.throws(() => verifyRoutes(read('references/standalone-pages.md')
    .replaceAll('/bpm/objects/:entityKey/new', '/bpm_new/:entityKey')));
});
