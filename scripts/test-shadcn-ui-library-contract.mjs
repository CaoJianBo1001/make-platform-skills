#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `Expected ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
};

const activeDocs = {
  readme: read('README.md'),
  canvasSkill: read('skills/canvas-table-integration/SKILL.md'),
  editorSelection: read('skills/canvas-table-integration/references/editor-component-selection.md'),
  cellEditDefaults: read('skills/canvas-table-integration/references/make-cell-edit-defaults.md'),
  fieldEditorPatterns: read('skills/canvas-table-integration/references/field-editor-patterns.md'),
  trackWorkflows: read('skills/canvas-table-integration/references/track-workflows.md'),
  editCommonPitfalls: read('skills/canvas-table-integration/references/edit-common-pitfalls.md'),
  editHostArchitecture: read('skills/canvas-table-integration/references/edit-host-architecture.md'),
  attachmentEditorPatterns: read('skills/canvas-table-integration/references/attachment-editor-patterns.md'),
  rowHeadActions: read('skills/canvas-table-integration/references/row-head-action-patterns.md'),
  filterSkill: read('skills/make-app-filter/SKILL.md'),
  filterPackage: read('skills/make-app-filter/references/package-integration.md'),
  groupUi: read('skills/make-app-group/references/ui-and-drag.md'),
  sortUi: read('skills/make-app-sort/references/ui-and-drag.md'),
};

const combined = Object.values(activeDocs).join('\n');
const legacyAdapterPattern = new RegExp(
  [
    ['@qfei-design/make-app-filter/adapters/', 'an', 'td'].join(''),
    ['@qfei-design/make-app-group/adapters/', 'an', 'td'].join(''),
    ['create', 'Antd'].join(''),
    ['create', 'AntdRecordGroup'].join(''),
    ['Ant', ' Design hosts'].join(''),
    ['Ant', ' Design style components'].join(''),
    ['@ant', '-design'].join(''),
    'host Input',
    'host TextArea',
    'host InputNumber',
    'host DatePicker',
    'host RangePicker',
    'host Select',
    'host component library',
    'project component library',
    'existing component library',
    'selected project component library',
    'Form.Item',
    'InputNumber',
    'DatePicker',
    'RangePicker',
    'forcing a new UI component library into a project that already has an editor/component system',
    "current project's existing upload/file component system",
    'existing upload/file component system',
    'current component system',
    'existing editor/component system',
  ]
    .map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'i',
);

assert.doesNotMatch(
  combined,
  legacyAdapterPattern,
  'active UI guidance must not require or advertise legacy adapters/components',
);

assert.match(
  `${activeDocs.filterSkill}\n${activeDocs.filterPackage}`,
  /shadcn\/ui[\s\S]*AdvancedFilterComponents/i,
  'make-app-filter must route visible filter controls through shadcn/ui AdvancedFilterComponents',
);

assert.match(
  activeDocs.filterPackage,
  /(only.*legacy.*adapter|legacy.*adapter.*only|no.*neutral.*adapter)[\s\S]*(upgrade|fix|blocker|阻断)[\s\S]*(do not|must not|不得|不能)[\s\S]*(legacy UI library|another UI library|组件库)/i,
  'filter integration must explain the fallback when the package lacks a shadcn/ui-compatible component adapter',
);

assert.match(
  activeDocs.groupUi,
  /shadcn\/ui[\s\S]*(component adapter|components prop|组件适配)/i,
  'make-app-group must route grouping panel controls through a shadcn/ui component adapter',
);

assert.match(
  activeDocs.sortUi,
  /shadcn\/ui[\s\S]*(component adapter|components prop|组件适配)/i,
  'make-app-sort must route sorting panel controls through a shadcn/ui component adapter',
);

assert.match(
  `${activeDocs.editorSelection}\n${activeDocs.cellEditDefaults}\n${activeDocs.fieldEditorPatterns}`,
  /shadcn\/ui[\s\S]*(Date Picker|date picker)[\s\S]*Popover[\s\S]*Calendar[\s\S]*(Combobox|Command)[\s\S]*(Attachment|native input|dropzone|上传)/i,
  'CanvasTable editor guidance must document shadcn/ui replacements for date, selector, and upload gaps',
);

assert.match(
  activeDocs.canvasSkill,
  /never UI-library tables/i,
  'CanvasTable skill must reject UI-library tables generically instead of naming removed component libraries',
);

assert.match(
  activeDocs.canvasSkill,
  /shadcn[\s\S]*(primitives|project-local|adapter|业务控件|business controls)[\s\S]*(cell edit|editor|编辑器)/i,
  'CanvasTable top-level guidance must route editor UI to shadcn primitives, project-local adapters, or qualified business controls',
);

assert.match(
  activeDocs.attachmentEditorPatterns,
  /Attachment[\s\S]*(shadcn-compatible|project-local|本地)[\s\S]*(CanvasTable|editor contract|编辑器合同|contract)/i,
  'Attachment editor guidance must prefer shadcn-compatible local adapters and only reuse controls that satisfy the CanvasTable editor contract',
);

console.log('shadcn/ui library contract passed');
