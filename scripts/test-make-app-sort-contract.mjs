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

const skill = read('skills/make-app-sort/SKILL.md');
const sortModel = read('skills/make-app-sort/references/sort-model.md');
const uiAndDrag = read('skills/make-app-sort/references/ui-and-drag.md');
const presetFlow = read('skills/make-app-sort/references/preset-and-data-flow.md');
const serviceContract = read('skills/make-app-sort/references/service-contract.md');
const testing = read('skills/make-app-sort/references/testing-and-pitfalls.md');
const filterSkill = read('skills/make-app-filter/SKILL.md');
const filterPreset = read('skills/make-app-filter/references/preset-integration.md');
const serviceSkill = read('skills/make-app-service/SKILL.md');
const serviceApi = read('skills/make-app-service/references/service-api-contracts.md');
const makeui = read('skills/makeui/SKILL.md');
const listLayout = read('skills/makeui/references/list-page-layout.md');
const canvasTable = read('skills/canvas-table-integration/SKILL.md');
const readme = read('README.md');
const sortSkillBundle = [
  skill,
  sortModel,
  uiAndDrag,
  presetFlow,
  serviceContract,
  testing,
].join('\n');

assert.doesNotMatch(
  sortSkillBundle,
  /\b[A-Za-z][A-Za-z0-9]*(?:Poc|Workbench)\b|\/(?:Users|home|var\/folders)(?:\/|$)/i,
  'make-app-sort skill content must not contain project or business-specific names',
);
assert.doesNotMatch(
  sortSkillBundle,
  /"entityKey"\s*:\s*"(?!<[^"\n]+>)[^"\n]+"/,
  'entityKey examples must use semantic placeholders instead of concrete entities',
);
assert.doesNotMatch(
  sortSkillBundle,
  /"fieldKey"\s*:\s*"(?!<[^"\n]+>)[^"\n]+"/,
  'fieldKey examples must use semantic placeholders instead of concrete schema fields',
);
assert.doesNotMatch(
  sortSkillBundle,
  /"expression"\s*:\s*"(?!<filterExpression>")[^"\n]+"/,
  'sorting skill examples must not embed a business-specific filter expression',
);

assert.match(
  skill,
  /(排序|record-list sorting)[\s\S]*CanvasTable[\s\S]*(Preset|预设)[\s\S]*(Service|服务)/i,
  'make-app-sort must own one integrated UI, table, preset, and Service sorting capability',
);
assert.match(
  skill,
  /@qfei-design\/make-app-sort@\^0\.1\.0[\s\S]*(package\.ai\.json|readOrder)[\s\S]*(public|公开)/i,
  'make-app-sort must require the published package and its public documentation contract',
);
assert.doesNotMatch(
  `${skill}\n${uiAndDrag}`,
  /(未发布|not.*published|unavailable)[\s\S]{0,300}(host-owned|宿主.*实现|fallback|兜底)/i,
  'make-app-sort must not retain a host-owned implementation fallback after package publication',
);
assert.match(
  skill,
  /Grouping is owned by `make-app-group`[\s\S]*capabilities\.groupable/i,
  'make-app-sort must hand grouping to the current make-app-group boundary',
);
assert.doesNotMatch(
  sortSkillBundle,
  /(future\s+`?group`?|future\s+capabilities\.groupable|future compatibility|no\s+`group`\s+UI\/request exists yet|后续分组|未来分组|分组.*第二阶段|later grouping contract)/i,
  'make-app-sort active references must not describe grouping as future or unimplemented',
);

assert.match(
  sortModel,
  /MAX_RECORD_SORT_COUNT\s*=\s*5/,
  'sort model must define a five-level limit',
);
assert.match(
  sortModel,
  /capabilities\??\.sortable\s*===\s*true/,
  'sortable candidates must be selected only by capabilities.sortable === true',
);
assert.match(
  sortModel,
  /\{\s*fieldKey\s*,\s*order\s*\}[\s\S]*(asc|升序)[\s\S]*(desc|降序)/i,
  'sort output must use ordered { fieldKey, order } entries',
);
assert.match(
  sortModel,
  /(唯一|unique|duplicate|重复)/i,
  'sort model must require unique fields',
);
assert.match(
  sortModel,
  /(优先级|priority|array order|数组顺序)/i,
  'sort model must preserve array order as priority',
);
assert.match(
  sortModel,
  /(pure|纯函数|immutable|不可变)[\s\S]*(sanitizeRecordSort|validateRecordSortDraft)/i,
  'sort normalization and validation must stay pure and immutable',
);
assert.match(
  sortModel,
  /(UI|React|consumer|消费端)[\s\S]*(package|包)[\s\S]*(Service|transport|传输)[\s\S]*(strict|严格)[\s\S]*(parser|解析器)/i,
  'sort model must distinguish package UI helpers from the Service strict transport parser',
);

assert.match(
  uiAndDrag,
  /dnd-kit[\s\S]*(package|包)[\s\S]*(internal|内部)[\s\S]*(宿主|host)[\s\S]*(不得|不需要|must not|does not)/i,
  'dnd-kit must remain package-internal instead of a host integration dependency',
);
assert.doesNotMatch(
  uiAndDrag,
  /(DndContext|closestCenter|PointerSensor|KeyboardSensor|SortableContext|verticalListSortingStrategy|useSortable|DragOverlay)/,
  'the consumer skill must not duplicate package-internal dnd-kit implementation recipes',
);
assert.match(
  uiAndDrag,
  /useRecordSortController[\s\S]*onConfirm[\s\S]*onApplied[\s\S]*onApplyError[\s\S]*resetKey/,
  'sorting UI must use the package controller persistence and stale-safety contract',
);
assert.match(
  uiAndDrag,
  /openWithField\s*\(\s*fieldKey\s*,\s*order\??\s*\)/,
  'table header sorting must open the shared draft through openWithField',
);
assert.match(
  uiAndDrag,
  /(确认前|before confirm)[\s\S]*(不.*records|must not.*records|不刷新|no reload)/i,
  'draft edits must not reload records',
);
assert.match(
  uiAndDrag,
  /(失败|failure)[\s\S]*(草稿|draft)/i,
  'save failures must retain the draft',
);
assert.match(
  uiAndDrag,
  /(package\.ai\.json|readOrder)[\s\S]*(header|表头)[\s\S]*(public API|公开 API)[\s\S]*(block|阻断|stop|停止)/i,
  'table header integration must verify the installed CanvasTable public API before implementation',
);
assert.match(
  uiAndDrag,
  /(五|5)[\s\S]*(openWithField|表头)[\s\S]*(提示|message|error|错误)/i,
  'openWithField must show feedback when a sixth header sort cannot be added',
);
assert.match(
  uiAndDrag,
  /(没有|no)[\s\S]*(sortable|可排序)[\s\S]*(隐藏|hide)[\s\S]*(trigger|按钮|menu|菜单)/i,
  'sorting controls must be hidden when the entity has no sortable fields',
);

assert.match(
  presetFlow,
  /(schema|字段元数据)[\s\S]*(GET .*preset|读取.*Preset|加载.*预设)[\s\S]*(records|记录列表)/i,
  'initial records must wait for schema and preset hydration',
);
assert.match(
  presetFlow,
  /(PATCH .*preset|保存.*Preset)[\s\S]*(成功|success)[\s\S]*(applied|应用态)[\s\S]*(records|记录)/i,
  'confirm must save preset before replacing applied state and reloading records',
);
assert.match(
  presetFlow,
  /(entityKey|对象)[\s\S]*(request|请求)[\s\S]*(stale|旧响应|过期)[\s\S]*(丢弃|discard|ignore)/i,
  'preset flow must reject stale responses after entity switches',
);
assert.match(
  presetFlow,
  /(A\s*->\s*B\s*->\s*A|A\s*→\s*B\s*→\s*A)[\s\S]*(generation|代次|epoch)[\s\S]*(ignore|丢弃|忽略)/i,
  'preset flow must reject ABA stale results with a monotonic generation',
);
assert.match(
  presetFlow,
  /(局部|partial|sparse)[\s\S]*(sort)[\s\S]*(filter|group)[\s\S]*(覆盖|overwrite|preserve|保留)/i,
  'sort persistence must be sparse and preserve sibling filter/group dimensions',
);
assert.match(
  presetFlow,
  /(PATCH|Preset)[\s\S]*(成功|success)[\s\S]*(records|记录)[\s\S]*(失败|failure)[\s\S]*(不回滚|do not roll back|保留.*applied|keep.*applied)/i,
  'records failure after preset success must not roll back persisted applied state',
);
assert.match(
  presetFlow,
  /(concurrent|并发)[\s\S]*(filter|筛选)[\s\S]*(sort|排序)[\s\S]*(pending|计数|count)[\s\S]*(saving|保存)/i,
  'shared preset state must track concurrent sparse filter and sort saves without unlocking early',
);
assert.match(
  presetFlow,
  /(success|成功)[\s\S]*(must not|不得|不能)[\s\S]*(clear|清除|覆盖)[\s\S]*(other|另一个|其他|sibling)[\s\S]*(error|错误)/i,
  'one successful preset save must not clear an error owned by another concurrent save',
);
assert.match(
  presetFlow,
  /(enabled|permission|权限)[\s\S]*(entityKey)[\s\S]*(generation|代次)[\s\S]*(invalidate|失效|ignore|忽略)/i,
  'preset request generations must include permission-enabled context, not entityKey alone',
);
assert.match(
  presetFlow,
  /(permission|权限)[\s\S]*(disabled|关闭|撤销|denied)[\s\S]*(GET|PATCH|records|请求)[\s\S]*(block|阻止|不得|不能)/i,
  'permission loss must block new preset and records requests',
);
assert.match(
  presetFlow,
  /(分页|pagination|virtual)[\s\S]*(稳定|deterministic|stable)[\s\S]*(backend|后端|Make Data)[\s\S]*(阻断|block|不得.*猜|do not.*invent)/i,
  'paginated sorting must require a documented backend stability contract',
);

assert.match(
  serviceContract,
  /GET\s+\/api\/entities\/:entityKey\/preset[\s\S]*PATCH\s+\/api\/entities\/:entityKey\/preset/,
  'Service must expose entity preset read and partial update routes',
);
assert.match(
  serviceContract,
  /\/preset\/v1\/entity[\s\S]*MakeService\.GetResource[\s\S]*MakeService\.UpdateResource/,
  'Service must document the Make Entity Preset upstream targets',
);
assert.match(
  serviceContract,
  /(Preset|预设)[\s\S]*(records|记录)[\s\S]*capabilities\??\.sortable\s*===\s*true/i,
  'Service must authoritatively validate preset and record sort fields against runtime schema capabilities',
);
assert.match(
  serviceContract,
  /MakeService\.UpdateResource[\s\S]*"appKey"[\s\S]*"entityKey"[\s\S]*"sort"/i,
  'Service must show the complete sparse Make Preset update payload',
);
assert.match(
  serviceContract,
  /(sparse|稀疏|局部)[\s\S]*(integration test|集成测试|verify|验证)[\s\S]*(upstream|上游)[\s\S]*(merge|保留|preserve)/i,
  'Service must verify upstream sparse-merge semantics instead of assuming them',
);
assert.match(
  serviceContract,
  /(Preset GET|预设读取|读取.*Preset)[\s\S]*(discard|丢弃|清洗|sanitize)[\s\S]*(PATCH|records)[\s\S]*(400|strict|严格)/i,
  'Preset GET must safely sanitize stale upstream rules while PATCH and records remain strict',
);
assert.match(
  serviceContract,
  /(transport|传输)[\s\S]*(parser|解析器)[\s\S]*(unknown|额外|未知)[\s\S]*(property|properties|属性)[\s\S]*(不得|must not|do not)[\s\S]*sanitizeRecordSort/i,
  'Service must own a strict transport parser and must not use tolerant sanitization for client writes',
);
assert.match(
  serviceContract,
  /(null|空值)[\s\S]*(case|大小写)[\s\S]*(locale|本地化)[\s\S]*(Make Data|backend|后端)[\s\S]*(不得|do not|禁止)[\s\S]*(client|客户端|Service)/i,
  'sort comparison semantics must stay backend-owned instead of being reimplemented client-side',
);
assert.match(
  serviceContract,
  /(entry|入口|边界)[\s\S]*(success|成功)[\s\S]*(failure|失败)[\s\S]*(日志|log)[\s\S]*(token|cookie|secret|敏感)/i,
  'Service boundary logging must cover entry/success/failure without sensitive data',
);

assert.match(
  testing,
  /(五级|five|5)[\s\S]*(重复|duplicate)[\s\S]*(sortable)[\s\S]*(asc|desc)/i,
  'tests must cover sort count, uniqueness, capabilities, and direction',
);
assert.match(
  testing,
  /(保存失败|save failure)[\s\S]*(旧.*应用|previous applied|applied state)[\s\S]*(草稿|draft)/i,
  'tests must cover the save-failure state barrier',
);
assert.match(
  testing,
  /(对象切换|entity switch)[\s\S]*(旧响应|stale response)[\s\S]*(records|记录)/i,
  'tests must cover entity switching and records reload behavior',
);
assert.match(
  testing,
  /(A\s*->\s*B\s*->\s*A|A\s*→\s*B\s*→\s*A)[\s\S]*(resetKey|generation|代次)/i,
  'tests must cover same-key ABA persistence races',
);
assert.match(
  testing,
  /(concurrent|并发)[\s\S]*(filter|筛选)[\s\S]*(sort|排序)[\s\S]*(saving|pending|保存)/i,
  'tests must cover concurrent sparse filter and sort saves',
);
assert.match(
  testing,
  /(permission|权限)[\s\S]*(disabled|撤销|关闭)[\s\S]*(stale|旧响应|失效|save|保存)/i,
  'tests must cover permission loss and stale sort persistence results',
);

assert.match(
  filterSkill,
  /(Preset|预设)[\s\S]*(保存|save)[\s\S]*(回显|hydrate|load)/i,
  'make-app-filter must own advanced-filter preset save and hydration behavior',
);
assert.match(
  filterPreset,
  /(filter:\s*null|`filter: null`)[\s\S]*(搜索|search)[\s\S]*(不保存|not persisted)/i,
  'filter preset guidance must define clearing and keep search session-only',
);
assert.match(
  filterPreset,
  /(保存成功|save success)[\s\S]*(应用|applied)[\s\S]*(保存失败|save failure)[\s\S]*(草稿|draft)/i,
  'filter preset guidance must use the same save-before-apply barrier',
);
assert.match(
  serviceApi,
  /(Schema|字段)[\s\S]*(capabilities)[\s\S]*(sortable)[\s\S]*(groupable)/i,
  'Service schema normalization must preserve sortable and groupable capabilities',
);

for (const [name, content] of [
  ['make-app-service', serviceSkill],
  ['service-api-contracts', serviceApi],
  ['makeui', makeui],
  ['list-page-layout', listLayout],
  ['canvas-table-integration', canvasTable],
  ['README', readme],
]) {
  assert.match(
    content,
    /make-app-sort/,
    `${name} must route sorting work to make-app-sort`,
  );
}

assert.match(
  skill,
  /make-app-permission/,
  'make-app-sort must hand permission ownership to make-app-permission',
);
assert.match(
  readme,
  /(permission|权限|access context|访问上下文)[\s\S]{0,240}(generation|代次)[\s\S]{0,120}(token)[\s\S]{0,120}(resetKey)/i,
  'README must describe resetKey as a permission-aware context generation token',
);
assert.doesNotMatch(
  readme,
  /以当前对象作为\s*`resetKey`|use the current (object|entity)( identity)? as\s*`?resetKey`?/i,
  'README must not recommend using only the current object as resetKey',
);
assert.match(
  readme,
  /同时做筛选和排序[^\n]*make-app-filter[^\n]*make-app-sort[^\n]*make-app-permission/i,
  'README filter/sort composition must include make-app-permission without forcing grouping',
);

console.log('make app sort contract passed');
