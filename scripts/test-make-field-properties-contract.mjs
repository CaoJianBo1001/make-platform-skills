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

const makeui = [
  'skills/makeui/SKILL.md',
  'skills/makeui/references/component-usage.md',
].map(read).join('\n');

const canvas = [
  'skills/canvas-table-integration/SKILL.md',
  'skills/canvas-table-integration/references/make-field-display-patterns.md',
  'skills/canvas-table-integration/references/field-editor-patterns.md',
  'skills/canvas-table-integration/references/make-cell-edit-defaults.md',
  'skills/canvas-table-integration/references/attachment-editor-patterns.md',
].map(read).join('\n');

const makedsl = [
  'skills/makedsl/references/FieldDesign.md',
  'skills/makedsl/references/FileFieldDesign.md',
  'skills/makedsl/references/UserFieldDesign.md',
  'skills/makedsl/references/DepartmentFieldDesign.md',
].map(read).join('\n');
const fieldDesign = read('skills/makedsl/references/FieldDesign.md');
const makedslSpecializedRefs = [
  'skills/makedsl/references/FileFieldDesign.md',
  'skills/makedsl/references/UserFieldDesign.md',
  'skills/makedsl/references/DepartmentFieldDesign.md',
].map(read).join('\n');

assert.match(
  makeui,
  /(field\.properties|properties)[\s\S]*(registry|字段类型 registry|make-field-types)[\s\S]*(format|precision|decimalPlaces|maxCount|begin|end|symbol)/i,
  'makeui must require the shared field registry to preserve and expose schema properties',
);

assert.match(
  makeui,
  /(DateRange|日期范围)[\s\S]*(begin)[\s\S]*(end)[\s\S]*(disabled|禁用|不可选|selectable)/i,
  'makeui must require DateRange begin/end to constrain selectable dates',
);

assert.match(
  makeui,
  /(Currency|金额)[\s\S]*(symbol)[\s\S]*(decimalPlaces)[\s\S]*(detail|详情|table|表格|display|展示)/i,
  'makeui must require Currency symbol/decimalPlaces in detail and table display',
);

assert.match(
  makeui,
  /(File|文件)[\s\S]*(maxCount)[\s\S]*(upload|上传|select|选择|limit|上限)/i,
  'makeui must require File maxCount in upload/selection controls',
);

assert.match(
  makeui,
  /(MultiUser|用户多选|MultiDepartment|部门多选)[\s\S]*(maxCount)[\s\S]*(disabled|禁用|prevent|阻止|上限)/i,
  'makeui must require MultiUser/MultiDepartment maxCount to limit further selection',
);

assert.match(
  canvas,
  /(Number|数字)[\s\S]*(precision)[\s\S]*(renderer|render|display|展示|editor|编辑)/i,
  'canvas docs must require Number precision for display and editor behavior',
);

assert.match(
  canvas,
  /(Currency|金额)[\s\S]*(symbol)[\s\S]*(decimalPlaces)[\s\S]*(table|表格|cell|单元格|renderer|editor)/i,
  'canvas docs must require Currency symbol/decimalPlaces in table cells and editors',
);

assert.match(
  canvas,
  /(DateRange|日期范围)[\s\S]*(begin)[\s\S]*(end)[\s\S]*(RangePicker|日期区间选择器|disabled|禁用)/i,
  'canvas docs must require DateRange begin/end in table cell editors',
);

assert.match(
  canvas,
  /(File|Attachment|附件|文件)[\s\S]*(maxCount)[\s\S]*(drag|drop|paste|upload|上传|选择|limit|上限)/i,
  'canvas docs must require File maxCount in attachment editors',
);

for (const requiredToken of [
  'precision: Integer',
  'format: String',
  'begin: Date',
  'end: Date',
  'decimalPlaces: Integer',
  'symbol: String',
  'maxCount: Integer',
  'capabilities:',
  'supportsUniqueConstraint',
]) {
  assert.match(
    makedsl,
    new RegExp(requiredToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `makedsl references must include ${requiredToken}`,
  );
}

assert.match(
  fieldDesign,
  /字段唯一性[\s\S]*uniqueConstraints[\s\S]*capabilities\.supportsUniqueConstraint/,
  'FieldDesign must document unique constraints through per-field capabilities',
);

for (const fieldType of ['Number', 'DateRange', 'File', 'MultiUser', 'MultiDepartment']) {
  assert.match(
    fieldDesign,
    new RegExp(
      `Make\\.Field\\.${fieldType}[\\s\\S]{0,260}capabilities:[\\s\\S]{0,220}supportsUniqueConstraint:`,
    ),
    `FieldDesign must include per-field capabilities for Make.Field.${fieldType}`,
  );
}

assert.doesNotMatch(
  makedslSpecializedRefs,
  /(UI 上传|拖拽|粘贴|追加文件|用户多选组件|部门多选组件|限制继续选择)/,
  'makedsl specialized references must keep UI interaction details in makeui/canvas-table-integration',
);

console.log('make field properties contract passed');
