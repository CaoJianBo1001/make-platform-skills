#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// 执行分发给宿主的真实示例，避免在测试中复制导航算法。
const defaults = readFileSync(new URL('../skills/makeui/references/mobile-defaults.md', import.meta.url), 'utf8');
const example = [...defaults.matchAll(/```js\n([\s\S]*?)\n```/g)]
  .map((match) => match[1])
  .find((source) => source.includes('export function composeApprovalNavigation('));
assert.ok(example, '移动导航规范须提供可执行的审批保留位组合示例');
const { composeApprovalNavigation } = await import(`data:text/javascript;base64,${Buffer.from(example).toString('base64')}`);

const item = (key) => Object.freeze({ key, label: key, icon: null });
const approvalItem = item('approval');
const assistantItem = item('assistant');
const workbenchItem = item('workbench');
const businessItems = (count) => Object.freeze(Array.from({ length: count }, (_, index) => item(`object-${index + 1}`)));
const compose = (count, hasAssistant) => composeApprovalNavigation({
  businessItems: businessItems(count),
  approvalItem,
  assistantItem: hasAssistant ? assistantItem : undefined,
  workbenchItem,
});

for (const [count, hasAssistant, keys] of [
  [0, true, ['approval', 'assistant']],
  [0, false, ['approval']],
  [3, true, ['object-1', 'object-2', 'object-3', 'approval', 'assistant']],
  [4, true, ['object-1', 'object-2', 'approval', 'assistant', 'workbench']],
  [5, true, ['object-1', 'object-2', 'approval', 'assistant', 'workbench']],
  [8, true, ['object-1', 'object-2', 'approval', 'assistant', 'workbench']],
  [3, false, ['object-1', 'object-2', 'object-3', 'approval']],
  [4, false, ['object-1', 'object-2', 'object-3', 'object-4', 'approval']],
  [5, false, ['object-1', 'object-2', 'object-3', 'approval', 'workbench']],
  [8, false, ['object-1', 'object-2', 'object-3', 'approval', 'workbench']],
]) {
  test(`${count} 个业务对象，AI ${hasAssistant ? '可用' : '不可用'}：审批占独立保留位`, () => {
    assert.deepEqual(compose(count, hasAssistant).map(({ key }) => key), keys);
  });
}

test('导航最多五项，保留原始顺序、对象引用和输入列表', () => {
  for (const hasAssistant of [false, true]) {
    for (let count = 0; count <= 12; count += 1) {
      // 非字典序输入，防止示例悄悄按 key 排序。
      const objects = Object.freeze([...businessItems(count)].reverse());
      const before = [...objects];
      const result = composeApprovalNavigation({
        businessItems: objects, approvalItem, workbenchItem,
        assistantItem: hasAssistant ? assistantItem : undefined,
      });
      assert.ok(result.length <= 5);
      assert.equal(result.filter((entry) => entry === approvalItem).length, 1);
      assert.equal(result.includes(assistantItem), hasAssistant);
      const shownObjects = result.filter((entry) => objects.includes(entry));
      assert.deepEqual(shownObjects, objects.slice(0, shownObjects.length));
      if (shownObjects.length < objects.length) {
        assert.equal(result.at(-1), workbenchItem);
      } else {
        assert.equal(result.includes(workbenchItem), false);
      }
      shownObjects.forEach((entry, index) => assert.equal(entry, objects[index]));
      assert.deepEqual(objects, before);
    }
  }
});

test('对象或 AI 可用性变化后重新组合，审批标识与路由对象保持稳定', () => {
  const withWorkbench = compose(4, true);
  const fewerObjects = compose(2, true);
  const withoutAssistant = compose(4, false);
  assert.equal(withWorkbench.at(-1), workbenchItem);
  assert.equal(fewerObjects.includes(workbenchItem), false);
  assert.equal(withoutAssistant.includes(workbenchItem), false);
  for (const result of [withWorkbench, fewerObjects, withoutAssistant]) {
    assert.equal(result.find(({ key }) => key === 'approval'), approvalItem);
  }
});

test('重复导航标识不能吞掉审批、AI、工作台或业务入口', () => {
  for (const duplicates of [
    [item('approval')], [item('assistant')], [item('workbench')],
    [item('duplicate'), item('duplicate')],
    [...businessItems(8), item('object-8')],
  ]) {
    assert.throws(() => composeApprovalNavigation({
      businessItems: duplicates, approvalItem, assistantItem, workbenchItem,
    }), RangeError);
  }
  assert.throws(() => composeApprovalNavigation({
    businessItems: [], approvalItem, assistantItem: approvalItem, workbenchItem,
  }), RangeError);
});
