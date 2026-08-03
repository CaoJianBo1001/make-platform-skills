#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(
    fs.existsSync(filePath),
    `Expected ${relativePath} under repo root ${repoRoot}`,
  );
  return fs.readFileSync(filePath, 'utf8');
};

const skill = read('skills/canvas-table-integration/SKILL.md');
const core = read(
  'skills/canvas-table-integration/references/core-props-methods-events.md',
);
const pitfalls = read(
  'skills/canvas-table-integration/references/common-pitfalls.md',
);
const makeDisplay = read(
  'skills/canvas-table-integration/references/make-field-display-patterns.md',
);
const workflows = read(
  'skills/canvas-table-integration/references/track-workflows.md',
);

const combined = [skill, core, pitfalls, makeDisplay, workflows].join('\n');

assert.match(
  combined,
  /(latest rows|latestRows|最新 rows|最新数据)[\s\S]*(setData|回灌|同步)/i,
  'docs must require syncing the latest rows after the table instance becomes ready',
);
assert.match(
  core,
  /(setData\(\[\]\)|empty array|空数组|rows 为空|empty rows)[\s\S]*(表头|header|emptyState|暂无数据|空状态)/i,
  'core setData docs must say empty rows still render headers and the empty state',
);
assert.match(
  pitfalls,
  /(records|rows|数据)[\s\S]*(先到|arrive before|before)[\s\S]*(实例|instance|CanvasTable)[\s\S]*(后创建|created later|ready later)/i,
  'pitfalls must describe rows arriving before the CanvasTable instance race',
);
assert.match(
  pitfalls,
  /(parent state|父组件状态|unrelated UI state|无关 UI 状态)[\s\S]*(Detail Drawer|详情抽屉|Drawer|popover|弹层|header menu|表头菜单)[\s\S]*(must not|不得|不应)[\s\S]*(recreate|重建|destroy|销毁|setData|setGroup|reload|刷新)/i,
  'pitfalls must forbid unrelated parent UI state from recreating or refreshing the canvas table',
);
assert.match(
  pitfalls,
  /(callback|回调)[\s\S]*(ref|引用)[\s\S]*(must not|不得|不应)[\s\S]*(table instance|CanvasTable instance|表格实例|GroupTableComponent)/i,
  'pitfalls must require callback ref patterns when callbacks should not recreate the table instance',
);
assert.match(
  makeDisplay,
  /(schema|columns|字段|列)[\s\S]*(ready|准备好|available)[\s\S]*(not|不要|不能|不得)[\s\S]*(records\.length|rows\.length|数据条数)/i,
  'Make display initialization must gate on schema/columns readiness, not row count',
);
assert.match(
  workflows,
  /(空 rows|empty rows|rows 为空|setData\(\[\]\))[\s\S]*(表头|header|emptyState|暂无数据|空状态)/i,
  'Track workflow testing must verify empty rows render headers and empty state',
);
assert.match(
  workflows,
  /(rows|records)[\s\S]*(先到|arrive before|before)[\s\S]*(实例|instance|ready)[\s\S]*(latest rows|latestRows|最新 rows|最新数据|setData)/i,
  'Track workflow testing must verify rows arriving before instance creation are applied after ready',
);
assert.doesNotMatch(
  combined,
  /(records|rows)\s*>\s*0[\s\S]{0,80}(visible rows|可见行)[\s\S]{0,80}>\s*0/i,
  'docs must not require visible rows > 0 merely because records > 0',
);

assert.match(
  skill,
  /package\.ai\.json\.readOrder[\s\S]*(source of truth|唯一|为准)/i,
  'canvas-table-integration must use package.ai.json.readOrder as the package documentation source of truth',
);
assert.doesNotMatch(
  skill,
  /node_modules\/<pkg>\/docs\/agent-usage\.md|packages\/table\/(?:docs\/agent-usage\.md|recipes\.json|capabilities\.json|PUBLIC_API\.md)/,
  'canvas-table-integration must not hardcode package documentation paths',
);
assert.match(
  skill,
  /Track C[\s\S]*(base|基础)[\s\S]*Track B[\s\S]*(enhancement|增强|叠加|layer)/i,
  'Make schema editable tables must use Track C as the display base and layer Track B editing on top',
);
assert.doesNotMatch(
  skill,
  /Choose exactly one primary track/i,
  'Track B must be composable with the selected base track instead of being mutually exclusive',
);
assert.match(
  workflows,
  /(Make schema|Make 字段)[\s\S]*Track C[\s\S]*Track B/i,
  'Track B workflow must explicitly preserve the Track C display baseline for Make schema tables',
);

console.log('canvas table data sync contract passed');
