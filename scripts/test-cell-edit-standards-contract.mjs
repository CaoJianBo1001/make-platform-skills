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
const defaults = read(
  'skills/canvas-table-integration/references/make-cell-edit-defaults.md',
);
const editorPatterns = read(
  'skills/canvas-table-integration/references/field-editor-patterns.md',
);
const componentSelection = read(
  'skills/canvas-table-integration/references/editor-component-selection.md',
);
const pitfalls = read(
  'skills/canvas-table-integration/references/edit-common-pitfalls.md',
);
const makeui = read('skills/makeui/SKILL.md');

assert.match(
  skill,
  /非弹窗|non-popup/i,
  'Track B summary must explicitly call out non-popup inline editor chrome',
);
assert.match(
  skill,
  /(任何|all|every)[\s\S]*(CanvasTable|canvas-table)[\s\S]*(单元格编辑|cell edit)[\s\S]*(必须|must)[\s\S]*(Track B|make-cell-edit-defaults|规范)/i,
  'Track B must state that every CanvasTable cell-edit implementation is required to follow the standard',
);

assert.match(
  defaults,
  /CanvasTable[\s\S]*(自带|active|editing)[\s\S]*(border|边框)/i,
  'Make cell edit defaults must preserve CanvasTable-owned editing border',
);
assert.match(
  defaults,
  /(强制|mandatory|必须)[\s\S]*(准入|baseline|规范|standard)/i,
  'Make cell edit defaults must describe the standard as mandatory, not optional',
);
assert.match(
  defaults,
  /(阻断|blocker|不得.*(完成|交付|done)|must not.*(done|complete|delivered))/i,
  'Make cell edit defaults must make non-compliance a delivery/readiness blocker',
);
assert.doesNotMatch(
  defaults,
  /Apply them unless the user explicitly asks for another interaction|unless the user explicitly asks for another interaction model/i,
  'Make cell edit defaults must not weaken the standard as an optional interaction model',
);
assert.doesNotMatch(
  defaults,
  /For Make App editable tables,\s*prefer:/i,
  'Make App editable table baseline must use mandatory wording, not "prefer"',
);
assert.match(
  defaults,
  /非弹窗|non-popup/i,
  'Make cell edit defaults must distinguish non-popup inline editors',
);
assert.match(
  defaults,
  /(InputNumber|NumberInput|数字输入框)[\s\S]*(controls=\{false\}|controls=false|隐藏.*(stepper|步进)|hide.*stepper)/i,
  'Number editors must use host numeric controls and hide nested steppers by default',
);
assert.match(
  defaults,
  /(DatePicker|日期选择器)[\s\S]*(open|立即打开)/i,
  'Date editors must use host date picker controls and open immediately',
);
assert.match(
  defaults,
  /(Select|选择器|下拉)[\s\S]*(open|立即打开)/i,
  'Select-like popup editors must use host selector controls and open immediately',
);
assert.match(
  defaults,
  /(borderless|无边框)[\s\S]*(box-shadow|shadow|阴影)/i,
  'In-cell editor controls must remove their own border and focus shadow',
);
assert.match(
  defaults,
  /(helper|hint|help|提示|辅助文案|校验说明)[\s\S]*(must not|do not|禁止|不得)[\s\S]*(cell|单元格|editor|编辑器)/i,
  'In-cell editors must forbid visible helper/hint/validation text inside the active cell',
);
assert.match(
  defaults,
  /(clamp|固定窄宽|固定宽度|宽度限制|min-width|max-width)[\s\S]*(must not|do not|禁止|不得)[\s\S]*(cell|单元格|full-cell|100%)/i,
  'In-cell editor roots must not clamp to a fixed narrow width instead of filling the active cell',
);

assert.match(
  editorPatterns,
  /Text[\s\S]*(Input|输入框)|Input[\s\S]*Text|文本[\s\S]*输入框/i,
  'Field editor mapping must route text fields to a text input control',
);
assert.match(
  editorPatterns,
  /Number[\s\S]*(InputNumber|NumberInput|数字输入框)|数字[\s\S]*数字输入框/i,
  'Field editor mapping must route numeric fields to a number input control',
);
assert.match(
  editorPatterns,
  /Date[\s\S]*(DatePicker|日期选择器)|日期[\s\S]*日期选择器/i,
  'Field editor mapping must route date fields to a date picker control',
);

assert.match(
  componentSelection,
  /(项目|host)[\s\S]*(组件库|component library)[\s\S]*(InputNumber|NumberInput|DatePicker|Select|数字输入框|日期选择器|选择器)/i,
  'Component selection must prefer the project component library for concrete editor controls',
);

assert.match(
  pitfalls,
  /(二次边框|double border|nested border|非弹窗)[\s\S]*(CanvasTable|canvas-table)[\s\S]*(border|边框)/i,
  'Edit pitfalls must flag nested in-cell borders as a defect',
);
assert.match(
  pitfalls,
  /(helper|hint|提示|辅助文案|0-5)[\s\S]*(cell|单元格|editor|编辑器)/i,
  'Edit pitfalls must flag visible helper or range hint text inside the active cell as a defect',
);

assert.match(
  makeui,
  /(单元格编辑|cell editor|table cell editors)[\s\S]*(canvas-table-integration|CanvasTable)/i,
  'MakeUI must route cell editor implementation details through canvas-table-integration',
);
assert.match(
  makeui,
  /(单元格编辑|cell editor|table cell editors)[\s\S]*(readiness blocker|交付阻断|未完成|must not.*(ready|complete|delivered))/i,
  'MakeUI must treat non-standard CanvasTable cell editors as not ready for delivery',
);

console.log('canvas table cell-edit standards contract passed');
