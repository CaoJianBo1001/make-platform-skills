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

test('审批结果逐行取 actionResult，任何动作或流程状态都不能覆盖', async () => {
  const { formatApprovalHistoryResult } = await loadHistoryResult();
  for (const actionResult of ['-', '已提交', '已同意', '已退回', '已拒绝', '已撤回', '后端新增结果']) {
    const event = Object.freeze({ actionResult,
      get processStatusAfter() { throw new Error('旧字段已移除'); },
      get processStatus() { throw new Error('不能读取当前流程状态'); },
      get actionType() { throw new Error('不能从动作推断结果'); },
    });
    assert.equal(formatApprovalHistoryResult(event), actionResult);
  }
});

test('空结果只显示占位符，不从事件类型合成结果', async () => {
  const { formatApprovalHistoryResult } = await loadHistoryResult();
  for (const actionResult of [undefined, null, '', '  ', 0, {}]) {
    assert.equal(formatApprovalHistoryResult(Object.freeze({eventType:'PROCESS_STARTED', actionResult})), '-');
  }
});

test('审批历史统一使用无分页快照与 CanvasTable 本地数据模式', () => {
  const history = read('skills/make-app-approval/references/history.md');
  assert.match(history, /TASK_PENDING/);
  assert.match(history, /actionResult/);
  assert.match(history, /不分页/);
  assert.match(history, /setData/);
  assert.match(history, /不配置.*virtualOptions/);
  assert.match(history, /保留后端顺序/);
  assert.match(history, /超过 20/);
  assert.match(history, /CanvasTable 集成 Skill/);
  assert.doesNotMatch(history, /pageIndex \+ 1|分页从 1 开始|pagination.total.*初始化/);
});

test('手机历史和验收引用同一完整数据合同', () => {
  for (const file of ['mobile', 'verification']) {
    const doc = read(`skills/make-app-approval/references/${file}.md`);
    assert.match(doc, /\]\(history\.md#共享数据源与滚动展示\)/);
    assert.doesNotMatch(doc, /只读取事件 processStatusAfter|给定相同定位与页请求序列/);
  }
});
