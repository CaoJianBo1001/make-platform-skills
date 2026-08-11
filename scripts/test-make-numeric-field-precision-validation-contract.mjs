#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertForwardTestScope,
  assertScenarioPassed,
  assertUniqueScenarioExecutionIds,
  computeForwardTestScopeHash,
  readForwardTestScopeEntriesFromRoots,
} from './lib/forward-test-record.mjs';

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

const fieldDesign = read('skills/makedsl/references/FieldDesign.md');
const metaApiDesign = read('skills/makedsl/references/MetaAPIDesign.md');
const makeuiSkill = read('skills/makeui/SKILL.md');
const makeuiComponentUsage = read('skills/makeui/references/component-usage.md');
const cellDefaults = read(
  'skills/canvas-table-integration/references/make-cell-edit-defaults.md',
);
const fieldEditorPatterns = read(
  'skills/canvas-table-integration/references/field-editor-patterns.md',
);
const editPitfalls = read(
  'skills/canvas-table-integration/references/edit-common-pitfalls.md',
);
const forwardTestRecord = read(
  'docs/make-numeric-field-precision-forward-test.md',
);

for (const [fieldType, property] of [
  ['Make.Field.Number', 'precision'],
  ['Make.Field.Currency', 'decimalPlaces'],
  ['Make.Field.Percent', 'decimalPlaces'],
]) {
  assert.match(
    fieldDesign,
    new RegExp(
      `${fieldType.replaceAll('.', '\\.')}(?:.|\\n){0,520}${property}(?:.|\\n){0,520}(最大|最多|maximum)[^\\n]*(小数|decimal)`,
      'i',
    ),
    `${fieldType} must define ${property} as the maximum allowed decimal places`,
  );
}

assert.doesNotMatch(
  metaApiDesign,
  /Make\.Field\.Amount/,
  'Meta API examples must use the canonical Make.Field.Currency type instead of the obsolete Make.Field.Amount alias',
);

assert.match(
  metaApiDesign,
  /Make\.Field\.Currency[\s\S]{0,320}"symbol"[\s\S]{0,180}"decimalPlaces"[\s\S]{0,180}"useGrouping"/,
  'Meta API currency examples must expose the canonical Currency symbol/decimalPlaces/useGrouping properties',
);

for (const [fieldType, property] of [
  ['Make.Field.Number', 'precision'],
  ['Make.Field.Currency', 'decimalPlaces'],
  ['Make.Field.Percent', 'decimalPlaces'],
]) {
  assert.match(
    makeuiComponentUsage,
    new RegExp(
      `${fieldType.replaceAll('.', '\\.')}(?:.|\\n){0,360}${property}(?:.|\\n){0,520}(InputNumber|NumberInput|数字输入)(?:.|\\n){0,520}(最多保留|maximum)[^\\n]*(小数|decimal)`,
      'i',
    ),
    `MakeUI forms must map ${fieldType}.${property} to the numeric input decimal limit and user guidance`,
  );
}

assert.match(
  makeuiComponentUsage,
  /(表单|form)[\s\S]{0,1400}(小数位|decimal places?)[\s\S]{0,1400}(阻止|block|不得)[^\n]*(提交|submit)[^\n]*(保存|持久化|persistence|mutation|API request)/i,
  'MakeUI forms must block the invalid submit and its persistence request',
);

assert.doesNotMatch(
  makeuiComponentUsage,
  /preserve the trimmed raw numeric input string/i,
  'MakeUI must not describe already-trimmed text as the untouched raw input buffer',
);

assert.doesNotMatch(
  [makeuiSkill, makeuiComponentUsage].join('\n'),
  /(every API request|any Service\/API request|所有 API 请求|任何 API 请求)/i,
  'MakeUI must not block unrelated read-only requests while a numeric field is invalid',
);

assert.match(
  makeuiComponentUsage,
  /(候选|metadata|元数据|read-only|只读)[^\n]*(请求|request)[^\n]*(继续|允许|不受影响|remain allowed|must not be blocked)/i,
  'MakeUI must keep unrelated read-only metadata and candidate requests available',
);

assert.match(
  makeuiComponentUsage,
  /(原始|raw)[^\n]*(数字|numeric)[^\n]*(文本|string)[\s\S]{0,500}(校验|validate)[^\n]*(raw|原始)[^\n]*(before|之前|先于)[^\n]*(解析|parsing?)/i,
  'MakeUI must validate raw decimal text before finite-number parsing',
);

assert.match(
  makeuiComponentUsage,
  /rawText[^\n]*(诊断|diagnostic)[\s\S]{0,420}normalizedText[^\n]*(解析|parse|提交|submit)[\s\S]{0,240}(only|仅|只)/i,
  'MakeUI must distinguish diagnostic rawText from submit-safe normalizedText',
);

assert.match(
  makeuiComponentUsage,
  /(count|计入)[^\n]*(尾随零|trailing zero)|(尾随零|trailing zero)[^\n]*(count|计入|limit|限制)/i,
  'MakeUI must count trailing zeroes toward the decimal limit',
);

assert.match(
  makeuiComponentUsage,
  /(reject|拒绝)[^\n]*(科学计数法|scientific notation)/i,
  'MakeUI must reject scientific notation at the submit boundary',
);

assert.match(
  makeuiComponentUsage,
  /(字段类型 registry|field(?: type)? registry)[^\n]*(只|only)[^\n]*(元数据|metadata)[\s\S]{0,500}(独立|separate|nearby)[^\n]*(纯|pure)[^\n]*(helper|函数)/i,
  'MakeUI must keep field metadata in the registry and decimal validation in a separate pure helper',
);

assert.match(
  makeuiSkill,
  /(registry|注册表)[^\n]*(only|只)[^\n]*(metadata|元数据)[^\n]*(validation|校验)[^\n]*(separate|独立)[^\n]*(pure|纯)/i,
  'MakeUI hard rules must keep host validation outside the metadata-only field registry',
);

assert.match(
  makeuiSkill,
  /Make\.Field\.Number[^\n]*Make\.Field\.Currency[^\n]*Make\.Field\.Percent[^\n]*(?:finite number|有限数字)[^\n]*(?:pure numeric string|纯数字字符串)/i,
  'MakeUI hard rules must preserve both backend-approved numeric submit shapes',
);

assert.match(
  makeuiComponentUsage,
  /(最多保留|maximum)[^\n]*(N|n|\$\{[^}]+\}|对应)[^\n]*(位小数|decimal places?)/i,
  'MakeUI forms must require a field-level maximum-decimal-places validation message',
);

assert.match(
  makeuiComponentUsage,
  /(静默|silent)[^\n]*(四舍五入|舍入|round)[\s\S]{0,420}(显式|explicit)[^\n]*(项目|product|contract|约定)/i,
  'MakeUI must forbid silent rounding unless the project contract explicitly requires it',
);

for (const [fieldType, property] of [
  ['Make.Field.Number', 'precision'],
  ['Make.Field.Currency', 'decimalPlaces'],
  ['Make.Field.Percent', 'decimalPlaces'],
]) {
  assert.match(
    fieldEditorPatterns,
    new RegExp(
      `${fieldType.replaceAll('.', '\\.')}(?:.|\\n){0,520}${property}(?:.|\\n){0,900}(最多保留|maximum)[^\\n]*(小数|decimal)`,
      'i',
    ),
    `Cell editors must map ${fieldType}.${property} to decimal-limit guidance`,
  );
}

const combinedCellRules = [cellDefaults, fieldEditorPatterns, editPitfalls].join('\n');

assert.match(
  cellDefaults,
  /\| Number \/ Currency \/ Percent \|[^\n]*\| (?:finite number|有限数字) or (?:pure numeric string|纯数字字符串) \|/i,
  'The cell-editor mapping must allow the same finite-number or pure-numeric-string submit shapes as the backend contract',
);

assert.match(
  combinedCellRules,
  /(小数位|decimal places?)[\s\S]{0,900}(阻止|reject|block)[^\n]*(commit|提交)[\s\S]{0,500}(不得|不能|must not|do not)[^\n]*(save API|保存接口|API|接口)/i,
  'Cell editors must reject decimal overflow before commit and must not call the save API',
);

assert.match(
  combinedCellRules,
  /(保持|keep)[^\n]*(编辑|editor)[^\n]*(打开|open|active)[\s\S]{0,500}(tooltip|外部校验|external validation|错误提示)/i,
  'Cell editors must remain active and surface decimal validation outside the cell',
);

assert.match(
  combinedCellRules,
  /(静默|silent)[^\n]*(四舍五入|舍入|round)[\s\S]{0,420}(显式|explicit)[^\n]*(项目|product|contract|约定)/i,
  'Cell editors must forbid silent rounding unless the project contract explicitly requires it',
);

assert.match(
  combinedCellRules,
  /(表单|form)[^\n]*(单元格|cell)[\s\S]{0,650}(同一|same|shared)[^\n]*(纯函数|pure)[^\n]*(校验|validation)/i,
  'Form and cell editors must share one pure decimal-place validation contract',
);

assert.match(
  combinedCellRules,
  /(normalizedText|原始|raw)[\s\S]{0,1400}(校验|validate)[^\n]*(before|之前|先于)[^\n]*(解析|parsing?)/i,
  'Cell editors must validate raw decimal text before finite-number parsing',
);

assert.match(
  combinedCellRules,
  /(count|计入)[^\n]*(尾随零|trailing zero)|(尾随零|trailing zero)[^\n]*(count|计入|limit|限制)/i,
  'Cell editors must count trailing zeroes toward the decimal limit',
);

assert.match(
  combinedCellRules,
  /(reject|拒绝)[^\n]*(科学计数法|scientific notation)/i,
  'Cell editors must reject scientific notation before commit',
);

const forwardTestSkillNames = [
  'makedsl',
  'makeui',
  'canvas-table-integration',
];
const forwardTestHash = computeForwardTestScopeHash(
  readForwardTestScopeEntriesFromRoots(
    forwardTestSkillNames.map((skillName) => ({
      directory: path.join(repoRoot, 'skills', skillName),
      prefix: `skills/${skillName}`,
    })),
  ),
);
assertForwardTestScope(forwardTestRecord, forwardTestHash);
assert.match(
  forwardTestRecord,
  /fork_turns\s*[:=：]\s*`?["']?none["']?`?/i,
  'numeric forward-test record must attest that agents received no parent conversation history',
);

const forwardTestBatch = '2026-08-11-make-numeric-field-precision-r3';
const executionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const scenarios = [
  {
    heading: '场景一：数字类表单字段',
    evidencePatterns: [
      /(原始|raw)[^\n]*(文本|string)/i,
      /normalizedText/i,
      /Number[^\n]*precision/i,
      /(Currency|金额)[^\n]*decimalPlaces/i,
      /(Percent|百分比)[^\n]*decimalPlaces/i,
      /(尾随零|trailing zero)/i,
      /(科学计数法|scientific notation)/i,
      /(持久化|persistence|save)[^\n]*(请求|request|API)/i,
      /(候选|metadata|元数据|read-only|只读)[^\n]*(请求|request)/i,
    ],
  },
  {
    heading: '场景二：数字类单元格编辑',
    evidencePatterns: [
      /(原始|raw)[^\n]*(文本|string)/i,
      /normalizedText/i,
      /(保持|keep)[^\n]*(编辑器|editor)[^\n]*(活动|active|打开)/i,
      /(最多保留|提示|tooltip|外部校验|external validation)/i,
      /(零次|zero)[^\n]*(保存|save)[^\n]*(调用|call|request)/i,
      /(解析|parse)[^\n]*(之前|before)|(?:之前|before)[^\n]*(解析|parse)|校验成功后才[^\n]*(转换|parse)/i,
      /(共享|共用|shared)[^\n]*(纯|pure)[^\n]*(helper|函数)/i,
    ],
  },
];

for (const scenario of scenarios) {
  assertScenarioPassed(forwardTestRecord, {
    ...scenario,
    requiredExecutionBatch: forwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  });
}
assertUniqueScenarioExecutionIds(
  forwardTestRecord,
  scenarios.map(({ heading }) => heading),
);

console.log('make numeric field precision validation contract passed');
