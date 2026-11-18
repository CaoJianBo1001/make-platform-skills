import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// 验证分发指导及其章节交接，不作为宿主时间线请求行为的证明。
const historyUrl = new URL('../skills/make-app-approval/references/history.md', import.meta.url);
const mobileUrl = new URL('../skills/makeui/references/mobile-detail-components.md', import.meta.url);
const history = readFileSync(historyUrl, 'utf8');
const mobile = readFileSync(mobileUrl, 'utf8');
const timelineRow = document => document.split('\n').find(line => line.startsWith('| 历史/流程时间线 |'));

const verifySnapshotGuidance = document => {
  const row = timelineRow(document);
  assert.ok(row, '手机组件指南应交接时间线数据合同');
  assert.doesNotMatch(row, /续载触发|滚动加载|分页加载/, '不能恢复手机时间线的远端续载指导');
  assert.match(row, /完整快照/, '时间线读取完整快照');
  assert.match(row, /滚动不[^，。|]*请求/, '手机滚动不追加请求');
};

const verifyHistoryAnchors = document => {
  const headings = new Set([...history.matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => match[1]));
  const links = [...document.matchAll(/\]\(([^)]+history\.md)#([^)]+)\)/g)];
  assert.ok(links.length > 0, '应保留历史合同章节交接');
  for (const [, file, fragment] of links) {
    assert.equal(new URL(file, mobileUrl).href, historyUrl.href);
    // 这里的目标标题均为无标点中文，GitHub 锚点与标题原文相同。
    assert.ok(headings.has(decodeURIComponent(fragment)), `历史章节不存在：${fragment}`);
  }
};

test('手机时间线只消费完整快照，滚动不能触发续载', () => {
  verifySnapshotGuidance(mobile);
});

test('手机指南指向真实历史章节，不能仅验证目标文件存在', () => {
  verifyHistoryAnchors(mobile);
});

test('历史支持任务和实例插槽，实例定位示例无需 taskId 或任务读取', () => {
  assert.ok(history.includes('ApprovalTaskDetail.history'));
  assert.ok(history.includes('ApprovalInstanceDetail.history'));
  assert.doesNotMatch(history, /只提供\s*`ApprovalTaskDetail\.history`/);
  const instance = history.split('\n').find(line => line.startsWith('- 已发起实例详情'));
  assert.ok(instance, '实例应独立描述 processInstanceId 定位');
  assert.match(instance, /processInstanceId/);
  assert.match(instance, /不要求 taskId/);
  assert.match(instance, /不调用 bpm-task/);
  assert.match(instance, /currentTasks/);
  const requests = [...history.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
  assert.ok(requests.length > 0, '应提供实例历史请求体示例');
  for (const request of requests) {
    assert.deepEqual(Object.keys(request), ['processInstanceId']);
    assert.equal(typeof request.processInstanceId, 'string');
    assert.ok(request.processInstanceId.length > 0);
  }
  assert.match(history, /实例正文[^\n]*无审批意见[^\n]*办理动作/);
});

test('故障注入：能发现重引续载和仅文件有效但章节失效的链接', () => {
  verifySnapshotGuidance(mobile);
  verifyHistoryAnchors(mobile);
  assert.throws(() => verifySnapshotGuidance(mobile.replace('完整快照', '续载触发')), /续载/);
  assert.throws(() => verifyHistoryAnchors(mobile.replace('history.md#共享数据源与滚动展示', 'history.md#已删除的章节')), /历史章节不存在/);
});
