#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const referencePath = 'skills/makeui/references/field-type-icons.md';
const reference = read(referencePath);
const makeuiSkill = read('skills/makeui/SKILL.md');
const componentUsage = read('skills/makeui/references/component-usage.md');
const makeuiPrinciples = read('skills/makeui/references/principles.md');
const readme = read('README.md');
const makeuiDescription = makeuiSkill.match(/^description:\s*"([^"]+)"/m)?.[1] ?? '';

const expectedIcons = {
  'Make.Field.ID': 'fingerprint-pattern',
  'Make.Field.Text': 'type',
  'Make.Field.TextArea': 'text-align-start',
  'Make.Field.Number': 'hash',
  'Make.Field.SingleSelect': 'circle-dot',
  'Make.Field.MultiSelect': 'list-checks',
  'Make.Field.Date': 'calendar-days',
  'Make.Field.DateTime': 'calendar-clock',
  'Make.Field.DateRange': 'calendar-range',
  'Make.Field.Percent': 'percent',
  'Make.Field.Currency': 'coins',
  'Make.Field.URL': 'link',
  'Make.Field.File': 'paperclip',
  'Make.Field.SingleUser': 'user-round',
  'Make.Field.MultiUser': 'users-round',
  'Make.Field.SingleDepartment': 'building',
  'Make.Field.MultiDepartment': 'building-complex',
  'Make.Field.Lookup': 'search',
};

const tableRows = [...reference.matchAll(/^\|\s*`(Make\.Field\.[A-Za-z]+)`\s*\|\s*`([a-z][a-z0-9-]*)`\s*\|/gm)];
const actualIcons = Object.fromEntries(tableRows.map(([, fieldType, icon]) => [fieldType, icon]));
assert.equal(tableRows.length, 18, 'the icon reference must contain exactly 18 field rows');
assert.deepEqual(actualIcons, expectedIcons, 'field icons must match the validated Make App mapping');
assert.match(
  reference,
  /Lucide[^\n]*图标库[^\n]*组件库|组件库[^\n]*不限定[^\n]*Lucide/,
  'field-icon guidance must distinguish the icon library from the UI component library',
);
for (const library of ['Ant Design', 'Arco Design', 'shadcn/ui']) {
  assert.ok(reference.includes(library), `field-icon guidance must support ${library}`);
}
assert.match(
  reference,
  /用户明确指定其他图标库[\s\S]*?Lucide/,
  'Lucide must be the default icon library with an explicit user override',
);
assert.match(
  componentUsage,
  /other compatible React component librar(?:y|ies)/i,
  'an explicit user choice of another compatible React UI library must remain valid',
);
const componentChoice = componentUsage.match(/For new projects without[\s\S]*?Do not mix multiple component libraries/)?.[0] ?? '';
assert.match(componentChoice, /structured (?:input|choice) (?:UI|prompt)/i);
assert.match(componentChoice, /Ant Design[\s\S]*?Arco Design[\s\S]*?shadcn\/ui/);
assert.doesNotMatch(componentChoice, /TDesign/, 'the presented options must contain only the agreed three examples');
assert.match(componentChoice, /free-text|custom/i, 'the user must be able to name another React library');
assert.match(componentChoice, /no selection[\s\S]*?Ant Design/i, 'no selection must resolve to Ant Design');
assert.match(
  makeuiPrinciples,
  /other compatible React component librar(?:y|ies)/i,
  'makeui principles must allow a user-specified React component library',
);
assert.match(makeuiPrinciples, /no selection[\s\S]*?Ant Design/i);
assert.match(makeuiPrinciples, /(?:three|3) (?:suggested )?options/i);
assert.doesNotMatch(
  makeuiPrinciples,
  /Component-library selection is blocking/i,
  'the principles must not contradict the no-selection Ant Design default',
);
assert.match(readme, /组件库选择[\s\S]*?Ant Design[\s\S]*?Arco Design[\s\S]*?shadcn\/ui/);
const selectionStrategy = componentUsage.split('## Selection strategy')[1]?.split('## Presentation priority')[0] ?? '';
assert.match(selectionStrategy, /structured choice UI/i, 'component choice belongs in the selection section');
const defaultMapping = componentUsage.split('## Default candidate mapping')[1]?.split('## Field-type icons')[0] ?? '';
assert.match(defaultMapping, /When shadcn\/ui is the selected component system/i);
assert.doesNotMatch(
  read('skills/makeui/references/drawer-layout.md'),
  /prefer `FullscreenOutlined`/i,
  'newly generated Ant Design UI must not recommend an Ant Design icon over the default Lucide library',
);

assert.match(
  makeuiDescription,
  /Use when[\s\S]*?(字段类型图标|field-type icons)/,
  'makeui must remain discoverable for standalone field-icon requests',
);
assert.match(
  makeuiDescription,
  /MakeAiTheme[\s\S]*?maxDrawerWidth/,
  'makeui must preserve existing AI assistant shell discovery while adding field icons',
);
assert.match(
  makeuiDescription,
  /component-library choice|组件库选择/,
  'makeui must remain discoverable for React UI component-library selection',
);
assert.match(
  makeuiSkill,
  /Lucide unless the user explicitly requests another icon library/,
  'makeui must state the default icon library and the user override',
);
assert.match(
  readme,
  /用户明确指定其他图标库[\s\S]*?Lucide/,
  'README must not present Lucide as mandatory after an explicit user override',
);
const batchReadmeLine = readme.split('\n').find((line) => line.includes('新应用的桌面操作栏')) ?? '';
assert.match(batchReadmeLine, /通用 `RecordBatchEditModal`[\s\S]*?所选组件库/);
assert.match(readme, /新应用[^\n]*?通用 `RecordSelectionActionBar`[^\n]*?Lucide/);

const requiredPolicy = [
  /lucide-react/,
  /默认/,
  /桌面|PC/,
  /平板/,
  /手机/,
  /prefixRender/,
  /新建/,
  /编辑/,
  /详情/,
  /看板/,
  /筛选/,
  /分组/,
  /排序/,
  /批量编辑/,
  /字段选项/,
  /未知/,
  /aria-hidden/,
];
for (const pattern of requiredPolicy) {
  assert.match(reference, pattern, `missing field-icon policy: ${pattern}`);
}
const visualStandard = reference.split('## 视觉标准')[1]?.split('## 宿主实现边界')[0] ?? '';
assert.match(visualStandard, /已验证试点/);
assert.match(visualStandard, /DOM[^\n]*14px[^\n]*1\.75[^\n]*6px/);
assert.match(visualStandard, /inline-flex[^\n]*align-items[^\n]*center/);
assert.match(visualStandard, /currentColor[^\n]*字段名称/);
assert.match(visualStandard, /CanvasTable[^\n]*16px[^\n]*14px[^\n]*8px/);
assert.match(visualStandard, /#1d212a[^\n]*表头文字/);
assert.match(visualStandard, /字段名称左侧/);
assert.match(visualStandard, /不额外叠加/);
assert.match(
  reference,
  /data URL[^\n]*?不继承[^\n]*?currentColor[^\n]*?stroke/,
  'CanvasTable data-URL icons need an explicit SVG stroke color',
);

const requiredRoutes = [
  'README.md',
  'skills/makeui/SKILL.md',
  'skills/makeui/references/component-usage.md',
  'skills/makeui/references/mobile-defaults.md',
  'skills/canvas-table-integration/SKILL.md',
  'skills/canvas-table-integration/references/column-patterns.md',
  'skills/canvas-table-integration/references/make-field-display-patterns.md',
  'skills/make-app-filter/SKILL.md',
  'skills/make-app-group/SKILL.md',
  'skills/make-app-sort/SKILL.md',
  'skills/make-app-actions/SKILL.md',
  'skills/make-app-actions/references/batch-edit-flow.md',
];
for (const route of requiredRoutes) {
  const content = read(route);
  assert.match(content, /field-type-icons\.md/, `${route} must route field icons to the canonical contract`);
  const link = content.match(/\]\(([^)]*field-type-icons\.md)\)/);
  assert.ok(link, `${route} must contain a navigable field-icon reference`);
  assert.ok(
    fs.existsSync(path.resolve(repoRoot, path.dirname(route), link[1])),
    `${route} must link to the existing canonical reference`,
  );
}

const batchEditStep = read('skills/make-app-actions/SKILL.md').match(/8\.[\s\S]*?\n9\./)?.[0];
assert.ok(batchEditStep, 'batch edit workflow step must exist');
assert.match(batchEditStep, /0\.3\.1/, 'batch edit guidance must identify the checked adapter version');
assert.match(
  batchEditStep,
  /AntdRecordBatchEditModal[\s\S]*?does\s+not provide[\s\S]*?FieldSelect/,
  'batch edit guidance must explain the Ant Design field-option customization gap',
);
assert.match(
  batchEditStep,
  /generic[\s\S]*?`RecordBatchEditModal`[\s\S]*?selected design system[\s\S]*?`FieldSelect`/,
  'batch edit guidance must give a component-library-neutral public adapter path',
);
assert.match(batchEditStep, /Ant Design hosts[\s\S]*?AntdRecordBatchEditModal/);
const actionSkill = read('skills/make-app-actions/SKILL.md');
assert.match(actionSkill, /generic `RecordSelectionActionBar`[\s\S]*?Lucide/);
const batchEditReference = read('skills/make-app-actions/references/batch-edit-flow.md');
assert.match(
  batchEditReference,
  /option\.value[\s\S]*?field\.type|field\.type[\s\S]*?option\.value/,
  'batch edit guidance must explain how the string-only package options resolve field types',
);
const forwardTests = read('skills/make-app-actions/references/testing-and-pitfalls.md');
assert.match(
  forwardTests,
  /generic action bar[\s\S]*?Lucide[\s\S]*?generic batch modal/,
  'AntD forward-test acceptance must use Lucide for the package action bar and field icons',
);
const packageIntegration = read('skills/make-app-actions/references/package-integration.md');
assert.match(packageIntegration, /generic `RecordSelectionActionBar`[\s\S]*?Lucide/);
assert.match(packageIntegration, /existing[\s\S]*?AntdRecordSelectionActionBar/);
const canvasColumns = read('skills/canvas-table-integration/references/column-patterns.md');
assert.match(canvasColumns, /14px[^\n]*8px/);
assert.match(canvasColumns, /type and color|类型和颜色/i);

console.log('Make field icon contract passed');
