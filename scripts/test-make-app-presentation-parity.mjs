#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const section = (text, heading) => {
  const marker = `## ${heading}\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `missing shared contract: ${heading}`);
  return text.slice(start + marker.length).split(/\n## /, 1)[0];
};
const loadHistoryResult = () => import('../skills/make-app-approval/assets/history-result.mjs');

test('PC/手机共用删除策略：没有预检的宿主不能因手机展示增加请求', () => {
  const contract = section(read('skills/make-app-actions/references/action-permission-model.md'), 'Shared single delete');
  const rows = contract.split('\n').filter(line => /^\| `/.test(line))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim().replaceAll('`', '')));
  assert.deepEqual(rows, [
    ['final-endpoint-only', '0', '1'],
    ['precheck-and-final', '1', '1'],
  ], '预检调用次数由同一宿主策略决定，不按展示模式决定；最终删除仍执行');
  assert.match(contract, /same host delete controller/);
  assert.match(contract, /data\.record\.delete/);
});

test('手机入口和 PC 操作流程都路由到同一删除合同，不能再强制手机预检', () => {
  const files = [
    'skills/make-app-actions/references/mobile-card-actions.md',
    'skills/make-app-actions/references/batch-edit-flow.md',
    'skills/makeui/references/mobile-defaults.md',
  ];
  for (const file of files) {
    const text = read(file);
    assert.match(text, /action-permission-model\.md#shared-single-delete/, `${file} 须引用共用删除合同`);
    assert.doesNotMatch(text, /确认后执行一次删除权限预检|用户确认后，对冻结目标调用一次 `record-write-permission` 预检/, file);
  }
  assert.doesNotMatch(read('skills/make-app-actions/references/action-permission-model.md'), /mandatory edit\/delete precheck/);
});

test('操作测试指导不能因普通编辑/删除都被拒绝而隐藏合法审批操作', () => {
  const text = read('skills/make-app-actions/references/testing-and-pitfalls.md');
  const entry = text.match(/- phone detail exposes[^\n]*(?:\n  [^\n]*)*/)?.[0];
  assert.ok(entry);
  assert.match(entry, /approval/);
  assert.doesNotMatch(entry, /when neither is allowed,\s+hide the entire bottom action bar/);
});

test('主合同、手机历史和验收不能为同一结果按展示模式选择 actionType', () => {
  for (const file of [
    'skills/make-app-approval/references/history.md',
    'skills/make-app-approval/references/mobile.md',
    'skills/make-app-approval/references/verification.md',
  ]) {
    assert.doesNotMatch(read(file), /手机结果使用事件 actionType|结果按事件 actionType|手机时间线按 actionType/, file);
  }
  assert.match(read('skills/make-app-approval/SKILL.md'), /assets\/history-result\.mjs/);
});

test('审批历史只将事件的 processStatusAfter 交给 PC 公共状态函数，不读取 actionType 或当前状态', async () => {
  const { formatApprovalHistoryResult } = await loadHistoryResult();
  for (const status of ['IN_APPROVAL','APPROVED','REJECTED','CANCELLED','UNSUBMITTED',null,undefined,'','FUTURE_STATUS']) {
    const input = Object.freeze({
      processStatusAfter: status,
      get actionType() { throw new Error('cannot use an action as the process result'); },
      get processStatus() { throw new Error('cannot replace historical state with current state'); },
    });
    const expected = Object.freeze({label: `PC:${String(status)}`, tone:'neutral'});
    const seen = [];
    const actual = formatApprovalHistoryResult(input, value => { seen.push(value); return expected; });
    assert.deepEqual(seen, [status]);
    assert.equal(actual, expected, '普通状态保留 PC 公共函数结果，不新增手机映射或回退');
  }
});

test('RETURNING 仅在共用历史适配中显示退回修改，不修改普通状态函数的返回对象', async () => {
  const { formatApprovalHistoryResult } = await loadHistoryResult();
  const pcDisplay = Object.freeze({label:'审批中', tone:'processing'});
  assert.deepEqual(formatApprovalHistoryResult(Object.freeze({processStatusAfter:'RETURNING'}), status => {
    assert.equal(status, 'RETURNING');
    return pcDisplay;
  }), {label:'退回修改', tone:'processing'});
  assert.deepEqual(pcDisplay, {label:'审批中', tone:'processing'});
});

test('同意后仍在审批中、退回后继续提交都不能被动作名称覆盖历史结果', async () => {
  const { formatApprovalHistoryResult } = await loadHistoryResult();
  const format = status => Object.freeze({label:status === 'IN_APPROVAL' ? '审批中' : '状态未知',tone:'processing'});
  for (const actionType of ['APPROVE','SUBMIT','RETURN','REJECT']) {
    assert.equal(formatApprovalHistoryResult(Object.freeze({actionType,processStatusAfter:'IN_APPROVAL'}),format).label,'审批中');
  }
});

const historyFile = 'skills/make-app-approval/references/history.md';
const virtualFile = 'skills/canvas-table-integration/references/virtual-table-patterns.md';
const requireVirtualHistoryContract = () => {
  const history = read(historyFile);
  assert.match(history, /\]\(\.\.\/\.\.\/canvas-table-integration\/SKILL\.md\)/,
    '历史表格必须交接给 CanvasTable 集成 Skill');
  assert.match(history, /\]\(\.\.\/\.\.\/canvas-table-integration\/references\/virtual-table-patterns\.md#3-bootstrap-and-page-contract\)/,
    '历史数据源必须遵守现有虚拟加载页码和首屏合同');
};
const loadStandardHistoryBridge = async (fetchPage, pageSize) => {
  requireVirtualHistoryContract();
  // 执行历史文档所引用的标准数据源示例，不在本测试另造页码转换或滚动加载器。
  const source = [...read(virtualFile).matchAll(/```ts\n([\s\S]*?)\n```/g)]
    .map(match => match[1]).find(code => code.includes('async function fetchTablePage('));
  assert.ok(source, 'CanvasTable 标准必须提供可执行的数据源页码转换示例');
  const module = await import(`data:text/javascript;base64,${Buffer.from(
    `export const create = (fetchPage, pageSize) => { ${source}; return fetchTablePage; };`,
  ).toString('base64')}`);
  return module.create(fetchPage, pageSize);
};

test('历史表格必须复用 CanvasTable 标准虚拟加载，不再建立独立分页链路', () => {
  requireVirtualHistoryContract();
});

test('历史正文和验收不得要求上一页/下一页控件或按当前虚拟页行数收缩表格', () => {
  for (const file of [historyFile, 'skills/make-app-approval/references/verification.md']) {
    assert.doesNotMatch(read(file), /多页上一页\/下一页|单页隐藏分页栏|单页无分页栏、多页按 total 翻页|历史表格的独立分页|按当前页实际展示的记录确定内容高度/, file);
  }
});

test('手机历史与验收必须指向同一个历史滚动加载合同', () => {
  for (const file of [
    'skills/make-app-approval/references/mobile.md',
    'skills/make-app-approval/references/verification.md',
  ]) {
    assert.match(read(file), /\]\(history\.md#共享数据源与滚动加载\)/, file);
  }
});

test('历史接入所引用的标准数据源将零基页转换一次，并保留页大小、取消信号和原结果', async () => {
  const calls = [];
  const response = Object.freeze({rows: Object.freeze([{eventId:'event'}]), total: 85});
  const fetchTablePage = await loadStandardHistoryBridge(async input => {
    calls.push(input);
    return response;
  }, 20);
  const controller = new AbortController();
  for (const pageIndex of [0, 1, 4]) {
    assert.equal(await fetchTablePage(pageIndex, controller.signal), response);
  }
  assert.deepEqual(calls, [1, 2, 5].map(page => ({page, size:20, signal:controller.signal})));
});

test('历史标准数据源透传失败与取消，不伪造空历史、不自动重发或拉取全部页', async () => {
  for (const error of [new Error('timeline failed'), new DOMException('cancelled', 'AbortError')]) {
    let calls = 0;
    const fetchTablePage = await loadStandardHistoryBridge(async () => {
      calls += 1;
      throw error;
    }, 20);
    await assert.rejects(fetchTablePage(0, new AbortController().signal), actual => actual === error);
    assert.equal(calls, 1);
  }
});
