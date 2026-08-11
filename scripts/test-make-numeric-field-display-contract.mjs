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

const canvasSkill = read('skills/canvas-table-integration/SKILL.md');
const makeDisplay = read(
  'skills/canvas-table-integration/references/make-field-display-patterns.md',
);
const columnPatterns = read(
  'skills/canvas-table-integration/references/column-patterns.md',
);
const makeuiComponentUsage = read('skills/makeui/references/component-usage.md');
const dataApiDesign = read('skills/makedsl/references/DataAPIDesign.md');
const entityDataFilterUsage = read(
  'skills/makedsl/references/EntityDataFilterUsage.md',
);

for (const [index, block] of [
  ...dataApiDesign.matchAll(/```json\n([\s\S]*?)\n```/g),
].entries()) {
  assert.doesNotThrow(
    () => JSON.parse(block[1]),
    `Data API json block ${index + 1} must be valid copyable JSON`,
  );
}

const combined = [
  canvasSkill,
  makeDisplay,
  columnPatterns,
  makeuiComponentUsage,
  dataApiDesign,
  entityDataFilterUsage,
].join('\n');

assert.match(
  combined,
  /(backend|后端|Data API|前后端)[\s\S]*(number|numeric string|纯数字字符串|数字字符串)[\s\S]*(Currency|Percent|金额|百分比)/i,
  'Docs must state that currency and percent backend values are numbers or pure numeric strings',
);

assert.match(
  combined,
  /(Currency|金额)[\s\S]*(field type|字段类型|renderer|render|前端)[\s\S]*(￥|¥|symbol|货币符号)/i,
  'Docs must require frontend field-type rendering to add the currency symbol',
);

assert.match(
  combined,
  /(Percent|百分比)[\s\S]*(field type|字段类型|renderer|render|前端)[\s\S]*(%|percent sign|百分号)/i,
  'Docs must require frontend field-type rendering to add the percent sign',
);

assert.match(
  combined,
  /(submit|提交|save|保存|API)[\s\S]*(must not|do not|不得|不能|禁止)[\s\S]*(¥|￥|%|formatted|格式化)/i,
  'Docs must forbid submitting formatted currency or percent strings',
);

assert.doesNotMatch(
  combined,
  /(后端|backend|Data API)[^。\n]*(返回|returns?)[^。\n]*(¥|￥|\$[0-9]|%)/i,
  'Docs must not describe backend/Data API currency or percent values as preformatted strings',
);

assert.doesNotMatch(
  combined,
  /(strip|remove|去掉|移除|清洗)[^。\n]*(currency symbols|币种符号|货币符号|¥|￥|\$)[^。\n]*(thousands separators|千分位|千分|逗号|,)/i,
  'Docs must not keep the old formatted-currency cleanup contract',
);

assert.doesNotMatch(
  combined,
  /(Number\('¥1,000\.00'\)|Number\("¥1,000\.00"\)|¥1,000\.00|￥1,000\.00|\$1,000\.00)/,
  'Docs must not keep old preformatted currency examples',
);

assert.match(
  dataApiDesign,
  /"budget":\s*"1999\.00"/,
  'Data API examples should return currency as a pure numeric string',
);

assert.match(
  dataApiDesign,
  /"completionRate":\s*"85\.00"/,
  'Data API examples should return percent as a pure numeric string',
);

assert.match(
  entityDataFilterUsage,
  /Make\.Field\.Percent[^\n]*completionRate\s*<\s*80/,
  'Percent filter examples must use the same direct percentage-number scale as Data API values',
);

assert.doesNotMatch(
  entityDataFilterUsage,
  /Make\.Field\.Percent[^\n]*completionRate\s*<\s*0\.8/,
  'Percent filter examples must not switch Data API percentage values to an implicit fraction scale',
);

console.log('make numeric field display contract passed');
