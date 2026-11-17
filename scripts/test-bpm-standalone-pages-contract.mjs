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
  assert.deepEqual(routes, ['/bpm/objects/:entityKey/new', '/bpm/tasks/:processInstanceId/:taskId', '/bpm/instances/:processInstanceId'],
    '地址表必须保留新建、任务和已确认的实例详情入口');
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

// 仅检查跨 Skill 的指导完整性；宿主仍须挂载真实页面及样式验证布局。
const mobileDocuments = () => ({
  form: fs.readFileSync(new URL('../skills/makeui/references/mobile-form-controls.md', import.meta.url), 'utf8'),
  page: read('references/standalone-pages.md'),
  verification: read('references/verification.md'),
});
const verifyStandaloneMobileGuidance = ({ form, page, verification }) => {
  const section = form.split('### 独立页面的样式作用域\n')[1]?.split(/\n##? /)[0];
  assert.ok(section, '共享手机字段规范必须覆盖独立页面作用域');
  assert.match(section, /不依赖.*Shell.*祖先/);
  assert.match(section, /普通字段.*Lookup.*单列/);
  assert.match(section, /附件.*完整.*宽度/);
  assert.match(section, /桌面.*平板.*原有/);
  assert.ok(page.includes('../../makeui/references/mobile-form-controls.md#独立页面的样式作用域'),
    '审批页应引用共享作用域规则，避免重复维护布局合同');
  const rows = verification.split('\n').filter(line => line.startsWith('|'));
  const layout = rows.find(line => line.startsWith('| 手机直接访问 BPM 独立新建页，无工作台 Shell |'));
  assert.match(layout ?? '', /真实页面.*编译.*样式/);
  assert.match(layout ?? '', /普通字段.*Lookup.*单列/);
  assert.match(layout ?? '', /320.*390.*767/);
  assert.match(layout ?? '', /桌面.*平板/);
  const interaction = rows.find(line => line.startsWith('| 独立页手机字段交互及底栏 |'));
  assert.match(interaction ?? '', /长文本.*选择器.*附件.*软键盘.*底栏/);
  assert.match(interaction ?? '', /真机.*待验/);
};

test('手机独立页样式与真实布局验收交接共享规则', () => {
  verifyStandaloneMobileGuidance(mobileDocuments());
});

// 验证审批验收能沿完整链接到达共享规则；不将链接通过当成宿主视觉或语义验证。
const fieldFeedbackTargets = [
  '../../makeui/references/mobile-form-controls.md#详情展示',
  '../../makeui/references/styling-and-responsive.md#控件禁用态与容器衔接',
  '../../makeui/references/component-usage.md#远程候选加载反馈',
];
const fieldFeedbackDocuments = () => Object.fromEntries(fieldFeedbackTargets.map(target => [
  target, fs.readFileSync(new URL(target.split('#')[0], new URL('references/', skill)), 'utf8'),
]));
const verifyFieldFeedbackHandoffs = (verification, documents) => {
  const links = [...verification.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)].map(match => match[1]);
  for (const target of fieldFeedbackTargets) {
    assert.ok(links.includes(target), `审批验收必须交接共享规则：${target}`);
    const headings = [...documents[target].matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => match[1]
      .replace(/`/g, '').toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-'));
    assert.ok(headings.includes(target.split('#')[1]), `共享规则章节必须真实存在：${target}`);
  }
};

test('字段对齐、禁用外观与候选状态验收能到达共享规则章节', () => {
  verifyFieldFeedbackHandoffs(read('references/verification.md'), fieldFeedbackDocuments());
});

test('故障注入：验收链接改址或目标章节被删除时不能误报通过', () => {
  const verification = read('references/verification.md');
  const documents = fieldFeedbackDocuments();
  verifyFieldFeedbackHandoffs(verification, documents);
  for (const target of fieldFeedbackTargets) {
    assert.throws(() => verifyFieldFeedbackHandoffs(verification.replaceAll(target, 'missing.md'), documents));
    assert.throws(() => verifyFieldFeedbackHandoffs(verification, { ...documents, [target]: '' }));
  }
});

test('故障注入：缺少独立作用域、关联字段覆盖或真实样式验收时拒绝通过', () => {
  const documents = mobileDocuments();
  verifyStandaloneMobileGuidance(documents);
  for (const [key, token] of [
    ['form', '### 独立页面的样式作用域'],
    ['page', '../../makeui/references/mobile-form-controls.md#独立页面的样式作用域'],
    ['verification', '真实页面及编译后的样式'],
    ['verification', '普通字段及 Lookup／关联字段区域均为单列'],
  ]) {
    assert.ok(documents[key].includes(token), `故障注入目标必须存在：${token}`);
    assert.throws(() => verifyStandaloneMobileGuidance({
      ...documents, [key]: documents[key].replaceAll(token, '缺失规则'),
    }));
  }
});

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

test('已发起合同可发现，区分任务和实例定位并保留后端授权及字段来源', () => {
  const entry = read('SKILL.md');
  assert.ok(entry.includes('(references/initiated-instances.md)'));
  const page = read('references/initiated-instances.md');
  for (const token of ['viewType: "MY"', 'MakeService.ListResources', 'processInstanceId', 'ApprovalInstanceDetail', '实例绑定版本', '后端', 'taskId']) assert.ok(page.includes(token), token);
  assert.match(page, /不.*伪造.*taskId/);
  assert.match(page, /不.*普通.*Schema/);
  assert.match(page, /recordId.*未.*支持|未.*recordId/);
  assert.match(page, /0\.2\.13[^\n]*正式产物/);
  assert.doesNotMatch(page, /新能力为源码候选|源码候选的/);
  assert.ok(!read('references/standalone-pages.md').includes('此能力不实现飞书配置、通知中心、Bot、流程引擎或实例级详情'));
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
