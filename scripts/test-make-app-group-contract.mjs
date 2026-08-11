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

const readMarkdownSection = (content, heading) => {
  const marker = `## ${heading}`;
  const start = content.indexOf(marker);
  assert.notEqual(start, -1, `Expected Markdown section: ${marker}`);
  const next = content.indexOf('\n## ', start + marker.length);
  return content.slice(start, next === -1 ? content.length : next);
};

const skill = read('skills/make-app-group/SKILL.md');
const groupModel = read('skills/make-app-group/references/group-model.md');
const uiAndDrag = read('skills/make-app-group/references/ui-and-drag.md');
const presetFlow = read('skills/make-app-group/references/preset-and-data-flow.md');
const groupFilter = read('skills/make-app-group/references/group-filter-expression.md');
const serviceContract = read('skills/make-app-group/references/service-contract.md');
const canvasFlow = read('skills/make-app-group/references/canvas-table-flow.md');
const testing = read('skills/make-app-group/references/testing-and-pitfalls.md');
const readme = read('README.md');
const canvasSkill = read('skills/canvas-table-integration/SKILL.md');
const serviceSkill = read('skills/make-app-service/SKILL.md');
const serviceApi = read('skills/make-app-service/references/service-api-contracts.md');
const makeui = read('skills/makeui/SKILL.md');
const listLayout = read('skills/makeui/references/list-page-layout.md');
const drawerLayout = read('skills/makeui/references/drawer-layout.md');
const sortSkill = read('skills/make-app-sort/SKILL.md');
const sortModel = read('skills/make-app-sort/references/sort-model.md');
const sortPresetFlow = read('skills/make-app-sort/references/preset-and-data-flow.md');
const sortServiceContract = read('skills/make-app-sort/references/service-contract.md');
const sortTesting = read('skills/make-app-sort/references/testing-and-pitfalls.md');
const filterSkill = read('skills/make-app-filter/SKILL.md');
const filterPreset = read('skills/make-app-filter/references/preset-integration.md');
const outerOverlayInteraction = readMarkdownSection(
  uiAndDrag,
  'Outer overlay interaction boundary',
);
const uiComponentTests = readMarkdownSection(testing, 'UI component tests');

const groupSkillBundle = [
  skill,
  groupModel,
  uiAndDrag,
  presetFlow,
  groupFilter,
  serviceContract,
  canvasFlow,
  testing,
].join('\n');
const skillFrontmatter = skill.split('---')[1] ?? '';
const activeGroupingDocs = [
  readme,
  canvasSkill,
  serviceSkill,
  serviceApi,
  makeui,
  listLayout,
  sortSkill,
  sortModel,
  sortPresetFlow,
  sortServiceContract,
  sortTesting,
  filterSkill,
  filterPreset,
].join('\n');

assert.doesNotMatch(
  groupSkillBundle,
  /(uju[-_]?mdm|expensePoc|ClaimTable|DemoWorkbench|\bClaim\b|\/Users\/|ZSQF|make-group)/i,
  'make-app-group skill content must not contain project or local-machine names',
);
assert.doesNotMatch(
  groupSkillBundle,
  /"entityKey"\s*:\s*"(?!<[^"\n]+>)[^"\n]+"/,
  'entityKey examples must use semantic placeholders instead of concrete entities',
);
assert.doesNotMatch(
  groupSkillBundle,
  /"fieldKey"\s*:\s*"(?!<[^"\n]+>)[^"\n]+"/,
  'fieldKey examples must use semantic placeholders instead of concrete schema fields',
);
assert.doesNotMatch(
  groupSkillBundle,
  /"expression"\s*:\s*"(?!<[^"\n]+>)[^"\n]+"/,
  'expression examples must use placeholders instead of concrete business values',
);

assert.match(
  skill,
  /@qfei-design\/make-app-group@\^0\.1\.0[\s\S]*(package\.ai\.json|readOrder)[\s\S]*(public|公开)/i,
  'make-app-group must require the published package and its public documentation contract',
);
assert.match(
  skillFrontmatter,
  /(表头分组|header grouping)[^"\n]*openWithField/i,
  'make-app-group frontmatter must qualify openWithField as a grouping trigger',
);
assert.doesNotMatch(
  skillFrontmatter,
  /Triggered by[^"\n]*,\s*openWithField\s*,/i,
  'make-app-group frontmatter must not use bare openWithField as a broad trigger',
);
assert.match(
  skill,
  /(分组|group)[\s\S]*CanvasTable[\s\S]*(Preset|预设)[\s\S]*(Service|服务)/i,
  'make-app-group must own one integrated UI, table, preset, and Service grouping capability',
);
assert.match(
  skill,
  /Use `make-app-filter`[\s\S]*(DNF|expression|表达式)/,
  'make-app-group must hand expression syntax to filter/makedsl guidance instead of inventing a parser',
);
assert.match(
  skill,
  /Use `make-app-sort`[\s\S]*(leaf|叶子|ordinary records|普通记录)/i,
  'make-app-group must define how sorting relates to grouped leaf records',
);

assert.match(
  groupModel,
  /MAX_RECORD_GROUP_COUNT\s*=\s*3/,
  'group model must define a three-level limit',
);
assert.match(
  groupModel,
  /\{\s*fieldKey\s*,\s*order\s*\}[\s\S]*(asc|升序)[\s\S]*(desc|降序)/i,
  'group output must use ordered { fieldKey, order } entries',
);
assert.match(
  groupModel,
  /(层级|hierarchy|root group|third-level|第三级)/i,
  'group model must preserve array order as hierarchy',
);
assert.match(
  groupModel,
  /(唯一|unique|duplicate|重复)/i,
  'group model must require unique fields',
);
assert.match(
  groupModel,
  /capabilities\??\.groupable\s*===\s*true/,
  'groupable candidates must be selected only by capabilities.groupable === true',
);
assert.match(
  groupModel,
  /Data API[\s\S]*group:\s*\[\][\s\S]*(invalid|非法|错误)/i,
  'group model must distinguish Data API group: [] as invalid',
);
assert.match(
  groupModel,
  /Preset[\s\S]*group:\s*\[\][\s\S]*(clear|清空)/i,
  'group model must distinguish Preset group: [] as clear',
);
assert.match(
  groupModel,
  /Lookup[\s\S]*(runtime schema|capabilities\.groupable|运行时)[\s\S]*(not.*blanket|不能.*一律|must not.*platform)/i,
  'Lookup grouping must be controlled by runtime capability, not blanket-disabled',
);
assert.doesNotMatch(
  groupModel,
  /(Lookup|Make\.Field\.Lookup)[\s\S]{0,80}(always|一律|全部)[\s\S]{0,80}(unsupported|不可|不支持|exclude|排除)/i,
  'make-app-group must not encode a blanket Lookup exclusion',
);
assert.match(
  groupModel,
  /(properties)[\s\S]*(invalid|非法|不允许)/i,
  'group model must reject properties in group items',
);
assert.match(
  groupModel,
  /capabilities\??\.sortable[\s\S]*(direction|方向|asc)/i,
  'group model must distinguish sortable as direction-control capability',
);

assert.match(
  uiAndDrag,
  /useRecordGroupController[\s\S]*onConfirm[\s\S]*onApplied[\s\S]*onApplyError[\s\S]*resetKey/,
  'grouping UI must use the package controller persistence and stale-safety contract',
);
assert.match(
  uiAndDrag,
  /openWithField\s*\(\s*fieldKey\s*,\s*order\??\s*\)/,
  'table header grouping must open the shared draft through openWithField',
);
assert.match(
  uiAndDrag,
  /dnd-kit[\s\S]*(package|包)[\s\S]*(host|宿主)[\s\S]*(must not|不得|不直接)/i,
  'dnd-kit must remain package-internal instead of a host integration dependency',
);
assert.doesNotMatch(
  uiAndDrag,
  /(DndContext|closestCenter|PointerSensor|KeyboardSensor|SortableContext|verticalListSortingStrategy|useSortable|DragOverlay)/,
  'the consumer skill must not duplicate package-internal dnd-kit recipes',
);
assert.match(
  uiAndDrag,
  /(no groupable|没有.*groupable|没有.*可分组)[\s\S]*(hide|hidden|隐藏)/i,
  'grouping controls must be hidden when the entity has no groupable fields',
);
assert.match(
  uiAndDrag,
  /(group-data|records|record-groups|group request)[\s\S]*(must not|不得|不)[\s\S]*(onApplied|confirm)/i,
  'group data requests must not run inside onConfirm/onApplied',
);
const assertOuterOverlayInteractionContract = (section) => {
  assert.match(
    section,
    /(controlled|受控)[\s\S]{0,240}(click|press)[\s\S]{0,240}(never|must not|不得)[\s\S]{0,160}(hover|mouseenter|mouseleave|blur|focusout)/i,
    'the outer grouping overlay must be controlled and must not use hover, pointer-leave, or focus-loss dismissal',
  );
  assert.match(
    section,
    /(?:Opening or closing a child[\s\S]{0,220}|choosing a value[\s\S]{0,180})(?:must not close the outer panel|keeps? the outer (?:grouping )?panel open)/i,
    'child-overlay value selection must keep the outer grouping panel open',
  );
  assert.doesNotMatch(
    section,
    /(?:child-overlay (?:interaction|close)|value selection|choosing a value)[\s\S]{0,220}(?:must close|closes) the outer/i,
    'child-overlay interactions must never be documented as an outer close reason',
  );
  const closeReasonDeclaration = section.match(
    /type GroupOverlayCloseReason\s*=([\s\S]*?);/,
  );
  assert.ok(
    closeReasonDeclaration,
    'the ordinary close path must declare GroupOverlayCloseReason',
  );
  const closeReasons = [...closeReasonDeclaration[1].matchAll(/["']([^"']+)["']/g)]
    .map((match) => match[1]);
  assert.deepEqual(
    closeReasons,
    ['confirm-success', 'true-outside-pointer'],
    'the ordinary close reason allowlist must contain exactly confirm-success and true-outside-pointer',
  );
  assert.match(
    section,
    /event\.composedPath\(\)[\s\S]{0,320}(registered panel and child roots|panel nor any registered child-overlay root)/i,
    'true outside classification must use the original event path and registered owned roots',
  );
  assert.match(
    section,
    /(Ant Design|AntD)[\s\S]*trigger=["']click["'][\s\S]{0,360}(adapter example|适配示例)[\s\S]{0,120}(not[\s\S]{0,40}(generic contract|platform rule)|不是通用|非通用)/i,
    'Ant Design trigger="click" must be documented as one adapter example, not the generic platform contract',
  );
  assert.doesNotMatch(
    section,
    /(?:onMouseLeave|onBlur|onFocusOut)\s*=|trigger=["'](?:hover|focus)["']/i,
    'grouping guidance must not show hover, focus, mouse-leave, or blur close recipes',
  );
};

assertOuterOverlayInteractionContract(outerOverlayInteraction);

const contradictoryOverlayInteraction = outerOverlayInteraction.replace(
  'must not close the outer panel',
  'must close the outer panel',
);
assert.notEqual(
  contradictoryOverlayInteraction,
  outerOverlayInteraction,
  'the contradiction mutation must replace the child-overlay close invariant',
);
assert.throws(
  () => assertOuterOverlayInteractionContract(contradictoryOverlayInteraction),
  /child-overlay value selection must keep the outer grouping panel open/,
  'the contract validator must reject guidance that closes after child-overlay interaction',
);

assert.match(
  uiComponentTests,
  /selecting[\s\S]{0,120}closing a child overlay[\s\S]{0,120}keeps the grouping[\s\S]{0,40}panel open/i,
  'the UI test matrix must keep child-overlay selection and close interactions open',
);
assert.match(
  uiComponentTests,
  /true outside pointer interaction closes and discards the draft/i,
  'the UI test matrix must cover verified outside dismissal',
);

assert.match(
  presetFlow,
  /(schema|字段元数据)[\s\S]*(GET .*preset|Preset)[\s\S]*(records|record-groups|root group)/i,
  'initial data must wait for schema and preset hydration',
);
assert.match(
  presetFlow,
  /(PATCH|Preset)[\s\S]*\{\s*"group"[\s\S]*(applied|应用态)[\s\S]*(root|record-groups|records)/i,
  'confirm must save group preset before replacing applied state and loading data',
);
assert.match(
  presetFlow,
  /(filter|sort|group)[\s\S]*(sparse|稀疏|independent|独立)/i,
  'filter, sort, and group saves must be sparse and independent',
);
assert.match(
  presetFlow,
  /(A\s*->\s*B\s*->\s*A|A\s*→\s*B\s*→\s*A)[\s\S]*(generation|代次)[\s\S]*(ignore|丢弃|忽略)/i,
  'preset flow must reject ABA stale results with a monotonic generation',
);
assert.match(
  presetFlow,
  /(permission|权限)[\s\S]*(disabled|关闭|撤销|denied)[\s\S]*(Preset|record-groups|records)[\s\S]*(block|阻止|不得|不能)/i,
  'permission loss must block new preset, record-groups, and records requests',
);

assert.match(
  groupFilter,
  /(filter)[\s\S]*(groupFilter)[\s\S]*(separate|独立|不.*merge|不.*合并)/i,
  'filter and groupFilter must remain separate request fields',
);
assert.match(
  groupFilter,
  /(string|字符串)[\s\S]*(JSON string literal|JSON 字符串|escape|转义)/i,
  'group path string values must be safely literal-escaped',
);
assert.match(
  groupFilter,
  /DNF[\s\S]*(A && C \|\| B && C|A\s*&&\s*C\s*\|\|\s*B\s*&&\s*C)/,
  'groupFilter path append must distribute over DNF OR branches',
);
assert.match(
  groupFilter,
  /(object|array|Date|NaN|Infinity)[\s\S]*(reject|拒绝)/i,
  'groupFilter builder must reject unstable group path values',
);
assert.match(
  groupFilter,
  /(Lookup)[\s\S]*(null)[\s\S]*(field key|字段 key)/i,
  'Lookup null group values must use the current entity Lookup field key',
);
assert.match(
  groupFilter,
  /Leaf records[\s\S]*(omit|省略)[\s\S]*group/,
  'leaf records must omit Data API group',
);

assert.match(
  serviceContract,
  /GET\s+\/api\/entities\/:entityKey\/record-groups/,
  'Service must expose record-groups route',
);
assert.match(
  serviceContract,
  /GET\s+\/api\/entities\/:entityKey\/records[\s\S]*groupFilter/,
  'records route must accept groupFilter',
);
assert.match(
  serviceContract,
  /MakeService\.ListResources/,
  'record-groups must use MakeService.ListResources',
);
assert.match(
  serviceContract,
  /group:\s*\[\][\s\S]*(invalid|must not|不得|非法)/i,
  'Service contract must prevent Data API group: [] for records mode',
);
assert.match(
  serviceContract,
  /properties[\s\S]*(invalid|reject|非法)/i,
  'Service contract must reject properties in group items',
);
assert.match(
  serviceContract,
  /(fields)[\s\S]*(sort)[\s\S]*(not be forwarded|should not be forwarded|不.*转发|忽略)/i,
  'record-groups should not forward fields or ordinary sort',
);
assert.match(
  serviceContract,
  /pagination\.total[\s\S]*(current layer|当前层|group-item)/i,
  'record-groups total must be current-layer group-item total',
);
assert.match(
  serviceContract,
  /Make Data upstream response[\s\S]*"data"[\s\S]*"pagination"[\s\S]*"total"/,
  'group Service contract must document the upstream Make Data data/pagination response shape',
);
assert.match(
  serviceContract,
  /Default UI-Service response[\s\S]*"groups"[\s\S]*"pagination"[\s\S]*"total"/,
  'group Service contract must document the default UI-Service groups/pagination response shape',
);
assert.match(
  serviceContract,
  /Map Make Data `data` to Service `groups`[\s\S]*`pagination\.total`/,
  'group Service contract must explicitly map upstream data/pagination to Service groups/pagination',
);
assert.match(
  serviceApi,
  /record-groups[\s\S]*response:\s*`\{ groups, pagination: \{ page, size, total \} \}`/,
  'make-app-service record-groups response must preserve pagination instead of only saying groups/total',
);
assert.match(
  serviceApi,
  /Make Data upstream returns `\{ data, pagination: \{ page, size, total \} \}`[\s\S]*maps `data` to `groups`[\s\S]*`pagination\.total`/,
  'make-app-service must distinguish upstream data/pagination from Service groups pagination mapping',
);

assert.match(
  canvasFlow,
  /GroupTableComponent[\s\S]*group:load[\s\S]*group:data:load[\s\S]*setGroup[\s\S]*setData[\s\S]*markGroupPageLoadFailed/,
  'Canvas flow must wire all grouped public APIs',
);
assert.match(
  canvasFlow,
  /grouped mode only[\s\S]*no visible data column[\s\S]{0,80}already left fixed[\s\S]*first visible data column[\s\S]*fixed[\s\S]*"left"[\s\S]*GroupTableComponent/i,
  'grouped mode must default the first visible data column to fixed left only when no left-fixed data column exists',
);
assert.match(
  canvasFlow,
  /already has a left-fixed data column[\s\S]*(do not|must not|不要|不得)[\s\S]*(add|添加|modify|覆盖|duplicate|重复)/i,
  'grouped mode must not add or modify a default fixed column when a left-fixed data column already exists',
);
assert.match(
  canvasFlow,
  /Do not apply this default to ordinary non-grouped `CanvasTableComponent` mode/,
  'first-column fixed-left default must not be applied to ordinary non-grouped tables',
);
assert.match(
  canvasFlow,
  /setGroup\(rootGroups,\s*undefined,\s*0\)/,
  'root groups must be fed with setGroup(rootGroups, undefined, 0)',
);
assert.match(
  canvasFlow,
  /(unrelated UI state|无关 UI 状态)[\s\S]*(Detail Drawer|详情抽屉|Drawer)[\s\S]*(must\s+not|不得|不应)[\s\S]*(record-groups|leaf records|group:data:load|setGroup|GroupTableComponent)/i,
  'grouped table lifecycle must not reload or resync for unrelated detail UI state',
);
assert.match(
  canvasFlow,
  /(grouping|group config|分组配置)[\s\S]*(stable|memoize|稳定|useMemo)[\s\S]*(must\s+not|不得|不应)[\s\S]*(depend|dependency|依赖)[\s\S]*(entire|whole|整个)[\s\S]*(object|对象)/i,
  'grouped table config must be stable and effects must not depend on the whole grouping object',
);
assert.match(
  canvasFlow,
  /setGroup\(rootGroups,\s*undefined,\s*0\)[\s\S]*(only|仅|guard|保护|防护)[\s\S]*(dataVersion|rootGroups)/i,
  'root group synchronization must be guarded by dataVersion/rootGroups',
);
assert.match(
  canvasFlow,
  /page \+ 1[\s\S]*(Service|Data API|one-based)/,
  'Canvas zero-based pages must translate to one-based Service/Data pages',
);
assert.match(
  canvasFlow,
  /markGroupPageLoadFailed[\s\S]*(fails|cancel|失败|取消)/i,
  'leaf failures or cancellations must mark the grouped page failed',
);
assert.match(
  canvasFlow,
  /(label)[\s\S]*(stable|path)[\s\S]*(value)|value[\s\S]*(stable|path)[\s\S]*(label)/i,
  'Canvas flow must use value as stable path and label only as display',
);
assert.match(
  canvasFlow,
  /(Grouped V1|V1)[\s\S]*(disable|禁用|disabled)[\s\S]*(cell editing|单元格)/i,
  'grouped V1 must not silently enable ordinary cell editing',
);

assert.match(
  testing,
  /Lookup field with `groupable === true` allowed/,
  'testing guidance must cover supported Lookup grouping',
);
assert.match(
  testing,
  /record-groups rejects `group: \[\]`/,
  'testing guidance must cover Data API group: [] rejection',
);
assert.match(
  testing,
  /DNF distribution/,
  'testing guidance must cover DNF groupFilter composition',
);
assert.match(
  testing,
  /grouped mode adds `fixed: "left"` only when no left-fixed data column exists[\s\S]*existing left-fixed data column is not duplicated[\s\S]*ordinary non-grouped `CanvasTableComponent` mode does not get/,
  'testing guidance must cover grouped-only conditional fixed-left behavior',
);
assert.match(
  testing,
  /(Detail Drawer|详情抽屉|Drawer)[\s\S]*(does not|do not|不|不得)[\s\S]*(recreate|重建)[\s\S]*GroupTableComponent[\s\S]*(repeat|重复)[\s\S]*setGroup[\s\S]*(fetchLeafPage|leaf|叶子|group:data:load)/i,
  'testing guidance must cover unrelated detail UI state not refreshing grouped tables',
);

assert.match(
  readme,
  /分组[\s\S]*`make-app-group`[\s\S]*record-groups[\s\S]*groupFilter/,
  'README must route grouping requests to make-app-group',
);
assert.match(
  makeui,
  /record grouping[\s\S]*`make-app-group`/,
  'makeui must route grouping behavior to make-app-group',
);
assert.match(
  listLayout,
  /group: after filter and before sort[\s\S]*make-app-group/,
  'list-page layout must place group after filter and before sort',
);
assert.match(
  drawerLayout,
  /(non-mutating|非数据变更|无数据变更)[\s\S]*(Detail Drawer|详情抽屉|Drawer)[\s\S]*(must\s+not|不得|不应)[\s\S]*(refresh|reload|刷新|重新拉取)[\s\S]*(record-groups|records|table|表格)/i,
  'makeui drawer guidance must forbid non-mutating detail UI actions from refreshing grouped tables',
);
assert.match(
  canvasSkill,
  /Route Make record-list grouping behavior[\s\S]*make-app-group/,
  'canvas-table-integration must hand Make record grouping behavior to make-app-group',
);
assert.match(
  serviceSkill,
  /record-groups[\s\S]*groupFilter[\s\S]*make-app-group/i,
  'make-app-service must hand grouping behavior to make-app-group',
);
assert.match(
  sortSkill,
  /Grouping is owned by `make-app-group`/,
  'make-app-sort must not own grouping',
);
assert.match(
  filterSkill,
  /With `make-app-group`[\s\S]*groupFilter/,
  'make-app-filter must collaborate with make-app-group for groupFilter expression flow',
);
assert.match(
  readme,
  /同时做筛选和排序[^\n]*make-app-filter[^\n]*make-app-sort[^\n]*make-app-permission/i,
  'README must keep the filter+sort composition without forcing grouping',
);
assert.match(
  readme,
  /同时做筛选、分组和排序[^\n]*make-app-filter[^\n]*make-app-group[^\n]*make-app-sort[^\n]*make-app-permission/i,
  'README must document the filter+group+sort composition',
);
assert.doesNotMatch(
  activeGroupingDocs,
  /(future\s+`?group`?|future\s+capabilities\.groupable|future compatibility|no\s+`group`\s+UI\/request exists yet|后续分组|未来分组|分组.*第二阶段|later grouping contract)/i,
  'active platform skills must not describe grouping as a future or unimplemented capability',
);

console.log('make-app-group skill contract passed');
