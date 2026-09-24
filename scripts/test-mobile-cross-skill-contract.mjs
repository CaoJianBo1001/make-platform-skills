#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const read = (file) => fs.readFileSync(path.join(repoRoot, 'skills', file), 'utf8');
const section = (content, heading) => {
  const start = content.indexOf(`## ${heading}\n`);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  return content.slice(start).split(/\n## /, 1)[0];
};

test('unmounting desktop selection has one owner; phone cannot retain or replay its target', () => {
  const defaults = read('makeui/references/mobile-defaults.md');
  const cards = read('make-app-actions/references/mobile-card-actions.md');
  const list = read('makeui/references/list-page-layout.md');
  for (const content of [defaults, cards, list]) {
    assert.match(content, /selection-and-operation-snapshot\.md/);
    assert.doesNotMatch(content, /保持休眠|stays dormant|选择快照可以保留|选择快照可以继续/);
  }
  const lifecycle = section(read('make-app-actions/references/selection-and-operation-snapshot.md'), 'Table instance and total-count lifecycle');
  assert.match(lifecycle, /desktop\/tablet[\s\S]*phone/);
  assert.match(lifecycle, /exactly one empty selection snapshot/);
  assert.match(lifecycle, /Do not replay/);
  assert.match(lifecycle, /same[ -]instance[\s\S]*resize/i);
});

test('action permission and test references distinguish desktop detail from phone detail', () => {
  assert.match(read('make-app-actions/agents/openai.yaml'), /default_prompt:[^\n]*(phone|手机)/i);
  for (const file of ['action-permission-model.md', 'testing-and-pitfalls.md']) {
    const content = read(`make-app-actions/references/${file}`);
    assert.match(content, /mobile-card-actions\.md/);
    assert.match(content, /desktop\/tablet[^\n]*(detail|详情)/i);
    assert.match(content, /(phone|手机)[^\n]*(edit\/delete|编辑|independent)/i);
  }
});

test('filter integration, header, overlay and test read paths all contain the phone exception', () => {
  for (const file of ['package-integration.md', 'header-table-linkage.md', 'ui-style.md', 'testing-and-pitfalls.md']) {
    const content = read(`make-app-filter/references/${file}`);
    assert.match(content, /desktop\/tablet/i, file);
    assert.match(content, /(phone|手机)[\s\S]{0,350}(no |without |不需要|不渲染|不得)[^\n]*(CanvasTable|header|表头)/i, file);
  }
});

test('phone list toolbar has medium search and optional filter with pull refresh instead of a refresh action', () => {
  const baseline = section(read('makeui/references/mobile-product-baseline.md'), '页面矩阵');
  const defaults = section(read('makeui/references/mobile-defaults.md'), '移动列表');
  const list = section(read('makeui/references/list-page-layout.md'), 'Phone list override');
  for (const content of [baseline, defaults, list]) {
    assert.match(content, /(中号|size="middle"|medium)/i);
    assert.doesNotMatch(content, /size="small"|小号视觉控件|小号搜索/);
    assert.match(content, /(下拉刷新|pull.to.refresh)/i);
    assert.match(content, /(不显示|不得|不放|no |without |do not show )[^\n]*(刷新按钮|刷新图标|refresh button|refresh icon)/i);
  }
  assert.match(defaults, /(搜索|search)[\s\S]{0,150}(筛选|filter)/i);
  assert.match(defaults, /(列表|list)[^\n]*(滚动|scroll)[^\n]*(顶部|top)/i);
  assert.match(defaults, /44px/);
  assert.match(list, /44px/);
  const makeui = read('makeui/SKILL.md');
  assert.match(makeui, /Search is the default phone toolbar entry/i);
  assert.match(makeui, /If advanced filtering[^\n]*phone medium filter entry/i);
  assert.doesNotMatch(makeui, /phone small search\/filter entry|Phone places small search and filter controls/i);
  const filterStyle = read('make-app-filter/references/ui-style.md');
  const phoneToolbar = filterStyle.split(/\r?\n/).find((line) => line.startsWith('The phone toolbar instead'));
  assert.ok(phoneToolbar);
  assert.match(phoneToolbar, /medium/i);
  assert.doesNotMatch(phoneToolbar, /small/i);
});

test('phone filter entry follows the optional filter capability without changing desktop linkage', () => {
  const baseline = section(read('makeui/references/mobile-product-baseline.md'), '页面矩阵');
  const defaults = section(read('makeui/references/mobile-defaults.md'), '移动列表');
  const list = section(read('makeui/references/list-page-layout.md'), 'Phone list override');
  const filter = section(read('make-app-filter/SKILL.md'), 'Default behavior');
  const filterStyle = section(read('make-app-filter/references/ui-style.md'), 'Phone sheet');
  for (const [label, content] of [
    ['product baseline', baseline],
    ['mobile defaults', defaults],
    ['phone list', list],
    ['filter skill', filter],
    ['filter sheet', filterStyle],
  ]) {
    assert.match(content, /(筛选|filter)[^\n]{0,100}(启用|已有|请求|in scope|enabled|present|requested)/i, label);
  }
  assert.match(filter, /Advanced filtering UI is an optional product capability/);
  assert.match(filter, /Desktop\/tablet[\s\S]{0,180}CanvasTable header/i);
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.match(readme, /手机工具栏默认提供中号搜索；筛选能力已启用/);
});

test('search-only phone lists keep the shared filter-expression compiler without a filter panel', () => {
  const defaults = read('makeui/references/mobile-defaults.md');
  const makeui = read('makeui/SKILL.md');
  const filter = section(read('make-app-filter/SKILL.md'), 'Default behavior');
  assert.match(defaults, /filter\.expression[^\n]*compileListFilter\(\{ fields, searchText \}\)|compileListFilter\(\{ fields, searchText \}\)[^\n]*filter\.expression/);
  assert.match(defaults, /(未启用|没有)[^\n]*(筛选|filter)[^\n]*(入口|面板|panel)/i);
  assert.match(filter, /compileListFilter\(\{ fields, searchText \}\)/);
  assert.doesNotMatch(filter, /advancedFilter: undefined/);
  assert.doesNotMatch(defaults, /未启用筛选时不安装筛选包/);
  assert.doesNotMatch(makeui, /install its package solely for mobile adaptation/);
});

test('search-only filter compilation does not enter the advanced-filter Preset lifecycle', () => {
  const skill = read('make-app-filter/SKILL.md');
  const modes = section(skill, 'Capability modes');
  const scenario = modes.split('\n').find((line) => line.startsWith('| `search-only` |'));
  assert.ok(scenario, 'the skill must define the search-only mode independently');
  assert.match(scenario, /compileListFilter\(\{ fields, searchText \}\)/);
  assert.match(scenario, /no (?:filter )?Preset GET\/PATCH/i);
  assert.match(scenario, /no (?:controller|panel|mobile layout gate)/i);

  const quickStart = section(skill, 'Quick start');
  assert.match(quickStart, /Only when advanced filtering is enabled[^\n]*load the current Entity Preset/i);
  const hardRules = section(skill, 'Hard rules');
  assert.match(hardRules, /Only when advanced filtering is enabled[^\n]*Preset filter before the first records query/i);

  const service = read('make-app-filter/references/service-translation.md');
  assert.match(service, /search-only[\s\S]{0,120}compileListFilter\(\{ fields, searchText \}\)/i);
  const tests = read('make-app-filter/references/testing-and-pitfalls.md');
  assert.match(tests, /search-only[^\n]*no filter Preset GET\/PATCH/i);
});

test('filter discovery and default invocation preserve both capability modes', () => {
  const skill = read('make-app-filter/SKILL.md');
  const description = skill.split(/\r?\n/).find((line) => line.startsWith('description:'));
  assert.ok(description, 'filter skill description must be discoverable');
  assert.match(description, /关键词搜索|keyword search/i);
  assert.match(description, /search-only/);
  assert.match(description, /advanced-filter/);

  const agent = read('make-app-filter/agents/openai.yaml');
  const prompt = agent.split(/\r?\n/).find((line) => line.trim().startsWith('default_prompt:'));
  assert.ok(prompt, 'filter skill default prompt must exist');
  assert.match(prompt, /\$make-app-filter/);
  assert.match(prompt, /search-only[^\n]*(?:no|without)[^\n]*(?:Preset|panel)/i);
  assert.match(prompt, /advanced-filter[^\n]*(?:Preset|panel)/i);
});

test('routing entry separates search-only compilation from advanced-filter lifecycle', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const routing = readme.split(/\r?\n/).find((line) => line.startsWith('| 筛选'));
  assert.ok(routing, 'README filter routing entry must exist');
  assert.match(routing, /search-only/);
  assert.match(routing, /advanced-filter/);
  assert.doesNotMatch(routing, /所有端共用 package 控制器、Preset/);

  const filterGuide = readme.split('### make-app-filter\n')[1]?.split('\n### ')[0];
  assert.ok(filterGuide, 'README filter guide must exist');
  assert.match(filterGuide, /search-only[\s\S]*不(?:读取|挂载)[^\n]*(?:Preset|Controller|面板)/);
  assert.match(filterGuide, /advanced-filter[\s\S]*Preset/);
  assert.doesNotMatch(filterGuide, /启用后所有展示模式共享[^\n]*Controller[^\n]*Preset/);

  const uiDefault = read('makeui/SKILL.md').split(/\r?\n/).find((line) => line.startsWith('- If filtering is in scope'));
  assert.ok(uiDefault, 'makeui filter placement rule must exist');
  assert.match(uiDefault, /advanced-filter/);
  assert.match(uiDefault, /search-only/);
  const quickStart = read('makeui/SKILL.md').split(/\r?\n/).find((line) => line.startsWith('15. Search is the default phone toolbar entry.'));
  assert.ok(quickStart, 'makeui quick start must route keyword search and advanced filtering');
  assert.match(quickStart, /search-only/);
  assert.match(quickStart, /advanced-filter/);

  const phoneList = section(read('makeui/references/list-page-layout.md'), 'Phone list override');
  const structure = read('makeui/references/component-structure.md');
  for (const [label, content] of [['phone list', phoneList], ['component structure', structure]]) {
    assert.match(content, /advanced filtering|advanced-filter/i, `${label} must gate the phone filter trigger on advanced filtering`);
    assert.doesNotMatch(content, /(?:only when|when) filtering is in scope[^\n]*filter trigger/i, `${label} must not treat search-only as a panel trigger`);
  }
});

test('phone form fields retain a visible keyboard focus indicator without boxed default chrome', () => {
  for (const file of ['mobile-visual-standard.md', 'mobile-form-controls.md']) {
    const content = read(`makeui/references/${file}`);
    assert.match(content, /:focus-visible/, file);
    assert.match(content, /键盘[^\n]{0,100}(可见|清晰)[^\n]{0,50}焦点|焦点[^\n]{0,100}(可见|清晰)/, file);
    assert.match(content, /(常态|默认)[^\n]{0,100}(无完整边框|不加完整边框|无盒状边框)/, file);
    assert.doesNotMatch(content, /无焦点环|不得增加[^\n]*focus ring/, file);
  }
});

test('desktop toolbar refresh rule is explicitly desktop-scoped while phone keeps pull refresh', () => {
  const makeui = read('makeui/SKILL.md');
  const toolbarRule = makeui.split(/\r?\n/).find((line) => line.includes('local toolbar sits above the table.'));
  assert.ok(toolbarRule, 'the desktop toolbar contract must remain discoverable');
  assert.match(toolbarRule, /^- (On )?desktop\/tablet/i);
  assert.match(toolbarRule, /search\/filter\/refresh/);
  assert.match(makeui, /Phone[^\n]*pull-to-refresh[^\n]*(without|no)[^\n]*refresh (icon|button)/i);
});

test('responsive and module guidance does not turn phone tasks into collapsed desktop forms or toolbars', () => {
  const styling = read('makeui/references/styling-and-responsive.md');
  for (const phrase of [
    'form grids may collapse from two columns to one',
    'toolbar actions may wrap',
    'table horizontal overflow belongs inside the table container',
  ]) {
    const rule = styling.split(/\r?\n/).find((line) => line.includes(phrase));
    assert.ok(rule, `missing desktop responsive rule: ${phrase}`);
    assert.match(rule, /^- (On )?desktop\/tablet/i);
  }
  const structure = read('makeui/references/component-structure.md');
  const toolbar = structure.split(/\r?\n/).find((line) => line.includes('owns search, refresh, filter trigger placement'));
  assert.ok(toolbar);
  assert.match(toolbar, /^- (On )?desktop\/tablet/i);
  const principle = read('makeui/references/principles.md');
  assert.match(principle, /phone task pages use one content column[^\n]*(right|右)[^\n]*(same-row|同一行)/i);
});

test('phone-only record actions do not require CanvasTable while desktop selection remains gated', () => {
  const actions = read('make-app-actions/SKILL.md');
  const gate = actions.split(/\r?\n/).find((line) => line.includes('resolve `@qfei-design/canvas-table@^1.3.1`'));
  assert.ok(gate);
  assert.match(gate, /^- (On )?desktop\/tablet/i);
  assert.match(actions, /phone-only headless action task does not add a table dependency/i);
  assert.match(actions, /On desktop\/tablet, validate the resolved selection/i);
  for (const phrase of ['Exactly one selected record shows', 'When no selected action is available']) {
    const rule = actions.split(/\r?\n/).find((line) => line.toLowerCase().includes(phrase.toLowerCase()));
    assert.ok(rule, `missing desktop action-bar rule: ${phrase}`);
    assert.match(rule, /^- (On )?desktop\/tablet/i);
  }
});

test('filter header-menu and table-reset rules cannot be mistaken for phone requirements', () => {
  const filter = read('make-app-filter/SKILL.md');
  for (const phrase of ['Header menu filtering is a host integration', 'Table scrolling, object switching']) {
    const rule = filter.split(/\r?\n/).find((line) => line.includes(phrase));
    assert.ok(rule, `missing desktop filter rule: ${phrase}`);
    assert.match(rule, /^- (On )?desktop\/tablet/i);
  }
  assert.match(filter, /reset desktop\/tablet table object-level transient state/i);
});

test('filter panel examples cannot bypass the shared Preset persistence barrier', () => {
  const panel = section(read('make-app-filter/references/ui-style.md'), 'Package panel');
  assert.doesNotMatch(panel, /controller\.confirm\(\)/);
  assert.match(panel, /package-integration\.md/);
  assert.match(panel, /persist[\s\S]*success[\s\S]*close/i);
});

test('phone filter sheet reuses the defined open and persistence handlers', () => {
  const phone = section(read('make-app-filter/references/ui-style.md'), 'Phone sheet');
  const integration = read('make-app-filter/references/package-integration.md');
  assert.match(integration, /function handleOpenChange\(nextOpen\)/);
  assert.match(integration, /async function handleConfirm\(\)/);
  assert.match(phone, /handleOpenChange\(true\)/);
  assert.match(phone, /onClose=\{\(\) => handleOpenChange\(false\)\}/);
  assert.match(phone, /onConfirm=\{\(\) => void handleConfirm\(\)\}/);
  assert.doesNotMatch(phone, /closeAndDiscardDraft|handlePersistThenApply/);
});

test('controlled form writes happen at commit, not when a confirm-only picker changes draft', () => {
  const controlled = section(read('makeui/references/component-usage.md'), 'Host form controlled field contract');
  assert.doesNotMatch(controlled, /every selection\/clear must update/);
  assert.match(controlled, /Lookup[\s\S]{0,400}(confirm|确认)[\s\S]{0,400}(cancel|取消)/i);
  assert.match(controlled, /(draft|草稿)[^\n]*(onChange|onBlur)/i);
});

test('phone field draft ownership follows the public picker boundary', () => {
  const controlled = section(read('makeui/references/component-usage.md'), 'Host form controlled field contract');
  const fields = read('makeui/references/mobile-form-controls.md');
  const ownership = controlled.split(/\n\n/).find((paragraph) => paragraph.startsWith('Immediate controls write'));
  assert.ok(ownership);
  assert.match(ownership, /MobileIdentityField[\s\S]*MobileDateField[\s\S]*MobileDateRangeField[\s\S]*package/i);
  assert.match(ownership, /MobileOptionPickerSheet[\s\S]*MobileSearchPickerSheet[\s\S]*host/i);
  assert.match(ownership, /cancel\/close[^\n]*onChange[^\n]*onBlur/i);
  assert.match(ownership, /host-composed controls[^.]*onBlur[^.]*once/i);
  assert.doesNotMatch(ownership, /multi-select and date sheets, initialize a host-owned draft/i);
  assert.match(fields, /MobileOptionPickerSheet[^\n]*宿主[^\n]*草稿/);
  assert.match(fields, /MobileOptionPickerSheet[^\n]*宿主[^\n]*`onBlur`/);
});

test('phone identity field handoff uses its onChange API, reserving onConfirm for low-level sheets', () => {
  const defaults = read('makeui/references/mobile-defaults.md');
  const identity = section(defaults, '搜索选择抽屉');
  assert.match(identity, /MobileIdentityField/);
  const single = identity.split(/\r?\n/).find((line) => line.includes('单选人员/部门'));
  assert.ok(single);
  assert.match(single, /onChange/);
  assert.doesNotMatch(single, /只通过 `onConfirm`/);
  assert.match(defaults, /只有直接使用底层 `MobileSearchPickerSheet`[^\n]*`onConfirm\(payload\)`/);
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const overview = readme.split(/\r?\n/).find((line) => line.includes('手机人员/部门单选默认使用'));
  assert.ok(overview);
  assert.match(overview, /MobileIdentityField[\s\S]*onChange/);
  assert.doesNotMatch(overview, /通过 `onConfirm` 快照/);
});

test('DateTime wheel precision follows schema, including seconds and lossless cancel/echo', () => {
  const fields = read('makeui/references/mobile-form-controls.md');
  const dates = fields.slice(fields.indexOf('### 日期与时间'), fields.indexOf('### 候选选择字段'));
  // A real platform schema, rather than a made-up time precision.
  assert.match(read('makedsl/references/FieldDesign.md'), /yyyy-MM-dd HH:mm:ss/);
  assert.match(dates, /format[\s\S]{0,350}(秒|second)[\s\S]{0,150}(六列|six)/i);
  assert.match(dates, /(非零秒|non-zero seconds)[\s\S]{0,200}(保留|preserv)/i);
  assert.match(dates, /(取消|cancel)[^\n]*(不写回|不提交|unchanged)/i);
  assert.match(dates, /(不支持|unsupported)[^\n]*(blocker|阻断)/i);
});

test('mobile defaults delegate precedence to the normative baseline without a competing list', () => {
  const defaults = section(read('makeui/references/mobile-defaults.md'), '适用范围与优先级');
  assert.match(defaults, /mobile-product-baseline\.md#优先级/);
  assert.doesNotMatch(defaults, /^\d+\. /m);
  const precedence = section(read('makeui/references/mobile-product-baseline.md'), '优先级');
  assert.match(precedence, /存量[\s\S]*(明确|explicit)[\s\S]*(移动|mobile)/i);
});

test('phone detail values stay right-aligned and tabs use the detail content gutter', () => {
  const detail = section(read('makeui/references/mobile-form-controls.md'), '详情展示');
  const visual = read('makeui/references/mobile-visual-standard.md');
  assert.match(detail, /左侧标签槽位[^\n]*右侧槽位[^\n]*尾端对齐/);
  assert.match(detail, /(Tab|标签页)[\s\S]{0,220}(左右页面留白|页面 gutter|content gutter)/i);
  assert.match(visual, /(Tab|标签页)[\s\S]{0,220}(左右页面留白|页面 gutter|content gutter)/i);
});

test('phone field presentation cannot inherit the desktop vertical-label grid by collapsing columns', () => {
  const skill = read('makeui/SKILL.md');
  const rules = skill.split(/\r?\n/);
  const createEditRule = rules.find((line) => /create\/edit fields default/i.test(line));
  const detailRule = rules.find((line) => /detail views default/i.test(line));
  assert.ok(createEditRule, 'makeui entry must retain a create/edit layout rule');
  assert.ok(detailRule, 'makeui entry must retain a detail layout rule');
  assert.match(createEditRule, /desktop\/tablet/i);
  assert.match(detailRule, /desktop\/tablet/i);
  assert.doesNotMatch(createEditRule, /small screens/i);
  assert.doesNotMatch(detailRule, /small screens/i);
  assert.match(skill, /phone[^\n]*mobile-form-controls\.md/i);
});

test('editing from phone detail enters the record edit route without a list round-trip', () => {
  const detailActions = section(read('make-app-actions/references/mobile-card-actions.md'), '详情任务页操作');
  assert.match(detailActions, /(详情|detail)[^\n]*(编辑|edit)[\s\S]{0,300}(直接|direct)[\s\S]{0,180}(编辑路由|edit route)/i);
  assert.match(detailActions, /(不得|不要|without|never)[^\n]*(先|through|via)?[^\n]*(列表|list)/i);
  assert.match(detailActions, /(拒绝|denied)[^\n]*(留在|保持|stay)[^\n]*(详情|detail)/i);
});
