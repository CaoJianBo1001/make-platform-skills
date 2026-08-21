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

const skill = read('skills/make-app-filter/SKILL.md');
const uiStyle = read('skills/make-app-filter/references/ui-style.md');
const testing = read('skills/make-app-filter/references/testing-and-pitfalls.md');
const packageIntegration = read('skills/make-app-filter/references/package-integration.md');
const filterModel = read('skills/make-app-filter/references/filter-model.md');
const operatorMatrix = read('skills/make-app-filter/references/operator-matrix.md');
const serviceTranslation = read('skills/make-app-filter/references/service-translation.md');
const headerTableLinkage = read('skills/make-app-filter/references/header-table-linkage.md');
const filterPreset = read('skills/make-app-filter/references/preset-integration.md');
const makeui = read('skills/makeui/SKILL.md');
const readme = read('README.md');

assert.doesNotMatch(
  skill,
  /\b[A-Za-z][A-Za-z0-9]*(?:Poc|Workbench)\b/i,
  'make-app-filter must describe the fixed advanced-filter layout without project names',
);
assert.match(
  skill,
  /(高级筛选|advanced filter)[\s\S]*(头部|header)[\s\S]*(body|中间|条件区)[\s\S]*(底部|footer)[\s\S]*(必须|must|交付阻断|readiness blocker)/i,
  'make-app-filter must make the three-region advanced-filter panel layout mandatory',
);

assert.match(
  uiStyle,
  /(顶部固定|fixed header|header)[\s\S]*(左侧|left)[\s\S]*`?筛选`?[\s\S]*(右侧|right)[\s\S]*`?清空所有`?/i,
  'UI style must require a fixed header with 筛选 on the left and 清空所有 on the right',
);
assert.match(
  uiStyle,
  /(中间|body|condition)[\s\S]*(条件|condition)[\s\S]*(滚动|scroll|overflow)/i,
  'UI style must require the condition body to be the scrollable region',
);
assert.match(
  uiStyle,
  /(host|宿主)[\s\S]*(CSS|样式)[\s\S]*(advanced-filter__body)[\s\S]*(overflow-y|overflow)[\s\S]*(auto)/i,
  'UI style must make host CSS responsible for .advanced-filter__body overflow-y auto',
);
assert.match(
  uiStyle,
  /(底部固定|fixed footer|footer)[\s\S]*(左侧|left)[\s\S]*`?\+ 添加条件`?[\s\S]*`?\+ 添加条件组`?[\s\S]*(右侧|right)[\s\S]*`?确认`?/i,
  'UI style must require a fixed footer with add actions on the left and confirm on the right',
);
assert.match(
  uiStyle,
  /(单一滚动|全弹层滚动|full-panel scroll|controls scroll away|按钮.*滚走)[\s\S]*(交付阻断|readiness blocker|not ready|不得.*交付)/i,
  'UI style must reject single-scroll panels where controls scroll away',
);

assert.match(
  testing,
  /(header|头部)[\s\S]*(footer|底部)[\s\S]*(remain visible|始终可见|不随.*滚动)/i,
  'Testing checks must verify header and footer stay visible while conditions scroll',
);
assert.match(
  testing,
  /(缺少|missing|没有)[\s\S]*(顶部|header)[\s\S]*(底部|footer)[\s\S]*(阻断|blocker|回归|regression)/i,
  'Testing pitfalls must flag missing fixed header/footer as a blocker or regression',
);

assert.match(
  makeui,
  /(高级筛选|advanced filter)[\s\S]*(三段|固定|header|footer|body)[\s\S]*(make-app-filter)/i,
  'MakeUI must route advanced-filter fixed panel layout details to make-app-filter',
);

for (const [name, content] of [
  ['make-app-filter/SKILL.md', skill],
  ['testing-and-pitfalls.md', testing],
  ['package-integration.md', packageIntegration],
  ['README.md', readme],
]) {
  assert.match(
    content,
    /@qfei-design\/make-app-filter@\^1\.0\.0/,
    `${name} must require @qfei-design/make-app-filter@^1.0.0 as the supported baseline`,
  );
  assert.doesNotMatch(
    content,
    /@qfei-design\/make-filter|@qfei-design\/make-app-filter@\^0\./i,
    `${name} must not keep the retired package name or pre-1.0 baseline`,
  );
}

assert.match(
  skill,
  /package\.ai\.json\.readOrder[\s\S]*(source of truth|唯一|准则|为准)/i,
  'make-app-filter must use package.ai.json.readOrder as the package documentation source of truth',
);
assert.doesNotMatch(
  `${skill}\n${readme}`,
  /node_modules\/@qfei-design\/make-app-filter\/docs\/|`docs\/(?:agent-usage|api)\.md`/i,
  'make-app-filter docs must not hardcode unpublished package docs paths',
);
assert.match(
  packageIntegration,
  /(Lookup)[\s\S]*(complete runtime schema|完整.*schema)[\s\S]*(relation|target)/i,
  'package integration must assign Lookup relation and target-field resolution to the host runtime schema adapter',
);
assert.match(
  packageIntegration,
  /key:\s*sourceLookupField\.key[\s\S]*lookup:[\s\S]*relationKey[\s\S]*targetField:[\s\S]*satisfies AdvancedFilterField/,
  'package integration must show the normalized Lookup field shape with the source field key and resolved target metadata',
);
assert.match(
  testing,
  /(Lookup)[\s\S]*(source field|源字段)[\s\S]*(CEL|expression|表达式)/i,
  'testing guidance must verify Lookup expressions use the source field key',
);

assert.match(
  filterModel,
  /import type[\s\S]*AdvancedFilterGroup[\s\S]*from ["']@qfei-design\/make-app-filter["']/,
  'filter model must import Filter IR types from the package public entrypoint',
);
assert.doesNotMatch(
  filterModel,
  /type\s+AdvancedFilter(?:Operator|Value|Condition|Group)\s*=|type\s+DateRangeValue\s*=/,
  'filter model must not copy package-owned Filter IR type definitions',
);

const filterReferences = [
  filterModel,
  operatorMatrix,
  serviceTranslation,
  testing,
  headerTableLinkage,
].join('\n');

assert.doesNotMatch(
  filterReferences,
  /\b(?:is_any_of|is_none_of|not_contains_date)\b/,
  'filter references must not retain removed package operator names',
);
assert.doesNotMatch(
  operatorMatrix,
  /## Current package baseline|\| `Make\.Field\.[^`]+` \|/,
  'operator guidance must not copy a static package operator matrix',
);
assert.match(
  operatorMatrix,
  /getOperatorsForField[\s\S]*(source of truth|唯一|为准)/i,
  'operator guidance must make package APIs the source of truth for the effective operator set',
);
assert.doesNotMatch(
  filterReferences,
  /(cartesian product|笛卡尔积|host implementation)[\s\S]{0,240}(DNF|distribut)|Do not emit `?\(A \|\| B\) && C`?[\s\S]{0,240}distribut/i,
  'filter references must not require hosts to implement DNF distribution',
);
assert.match(
  serviceTranslation,
  /compileListFilter[\s\S]*(unchanged|原样|sole|唯一)[\s\S]*(Service|backend|后端)/i,
  'service guidance must submit compileListFilter output without host-side boolean rewrites',
);
assert.match(
  filterPreset,
  /(A\s*->\s*B\s*->\s*A|A\s*→\s*B\s*→\s*A)[\s\S]*(generation|代次|epoch)[\s\S]*(忽略|ignore|丢弃)/i,
  'filter preset guidance must reject ABA stale saves with a monotonic generation',
);
assert.match(
  skill,
  /make-app-permission/,
  'make-app-filter must hand list-access policy to make-app-permission',
);
assert.match(
  filterPreset,
  /(enabled|permission|权限)[\s\S]*(entityKey)[\s\S]*(generation|代次|epoch)/i,
  'filter preset context must include permission-enabled state, entityKey, and generation',
);
assert.match(
  filterPreset,
  /(permission|权限)[\s\S]*(disabled|关闭|撤销|denied)[\s\S]*(GET|PATCH|records|请求)[\s\S]*(block|阻止|不得|不能)/i,
  'permission loss must block new filter preset and records requests',
);
assert.match(
  packageIntegration,
  /key=\{resetKey\}[\s\S]*(useLayoutEffect|layout effect)[\s\S]*(requestId|request id|请求 ID)/i,
  'filter host example must reset by committed context and identify each local save request',
);
assert.doesNotMatch(
  packageIntegration,
  /if\s*\(\s*!Object\.is\(observedResetKeyRef\.current,\s*resetKey\)\s*\)/,
  'filter host example must not mutate request lifecycle refs during render',
);
assert.match(
  packageIntegration,
  /onPersistError[\s\S]*onApplyError[\s\S]*(separate|区分|only|仅)/i,
  'filter host example must keep persistence and applied-state callback errors separate',
);
assert.match(
  filterPreset,
  /(filter|筛选)[\s\S]*(sort|排序)[\s\S]*(shared|共享|共同)[\s\S]*(request ID|请求 ID|pending-request|pending request)/i,
  'filter and sort must share request-identity-based preset pending state',
);
assert.match(
  filterPreset,
  /(unsupported|不支持|无法.*编辑)[\s\S]*(backend|后端)[\s\S]*(active|生效)[\s\S]*(warning|提示|可见)/i,
  'unsupported saved CEL must stay visibly active while backend filtering remains active',
);

console.log('make filter panel layout contract passed');
