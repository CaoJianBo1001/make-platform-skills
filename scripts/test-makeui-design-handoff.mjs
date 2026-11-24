import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const references = '../skills/makeui/references/';
const usage = read(references + 'component-usage.md');
const selection = usage.split('## Selection strategy\n')[1].split('## Presentation priority\n')[0];
const [design, library] = selection.split('### Component library branch\n');

test('the documented browser handoff uses the chosen entry, view, output and control contract', () => {
  assert.equal(design.match(/\[MakeDesign\]\(([^)]+)\)/)?.[1], 'https://test-make.qtech.cn/design/');
  assert.match(design, /PRD\/DSL[\s\S]*复制方案链接/);
  assert.match(design, /query intact[^\n]*fragment with `#makeui`/);
  assert.match(design, /rendered JSON in `#makeui-handoff`/);
  assert.match(design, /`controls\.asset`[^\n]*`controls\.contract`[^\n]*`asset\.contract`[^\n]*`makeui-controls\/v1`/);
  assert.match(design, /gallery link[^\n]*newly copied plan link[^\n]*branch pending/i);
});

test('desktop field mappings distinguish dates, times, ranges, scalar and multiple choices', () => {
  const rows = design.split('\n').filter((line) => line.startsWith('| `Make.Field.'));
  const mapping = (type) => rows.find((line) => line.startsWith('| `Make.Field.' + type + '` |')) ?? '';
  assert.match(mapping('Date'), /`DateField`[^\n]*`properties\.format`[^\n]*host/i);
  assert.match(mapping('DateTime'), /date-time[^\n]*precision/i);
  assert.match(mapping('DateRange'), /`MakeDateRangeField`[^\n]*begin, end[^\n]*minDate[^\n]*maxDate/);
  assert.match(mapping('SingleSelect'), /`ChoiceField`[^\n]*option value/i);
  assert.match(mapping('MultiSelect'), /multi-select[^\n]*array of option values/i);
});

test('library selection has one owner and preserves ordered choices, custom input and default', () => {
  assert.deepEqual([...library.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1]), [
    'Ant Design (recommended default)', 'Arco Design', 'shadcn/ui',
  ]);
  assert.match(library, /structured choice UI/i);
  assert.match(library, /free-text\/custom[^\n]*other compatible React component library/i);
  assert.match(library, /no selection[^\n]*use Ant Design/i);
  for (const file of ['principles.md', 'field-type-icons.md']) {
    const guide = read(references + file);
    assert.match(guide, /\]\(component-usage\.md#selection-strategy\)/, file);
    assert.doesNotMatch(guide, /Ant Design[^\n]*Arco Design[^\n]*shadcn\/ui/, file);
  }
  assert.match(read('../README.md'), /\]\(skills\/makeui\/references\/component-usage\.md#selection-strategy\)/);
});

test('desktop surface references honor the detail choice and use theme backgrounds', () => {
  for (const file of ['drawer-layout.md', 'page-route-layout.md', 'styling-and-responsive.md']) {
    const guide = read(references + file);
    assert.match(guide, /\]\(component-usage\.md#makedesign-branch\)/, file);
    assert.doesNotMatch(guide, /desktop\/tablet CRUD remains a right-side Drawer|lightweight white form panels?|one white form panel/i, file);
  }
  assert.doesNotMatch(read(references + 'app-shell-layout.md'), /workspace on a light neutral background/i);
  assert.match(design, /`page`[^\n]*`drawer`[^\n]*`wide-drawer`[^\n]*`system`/);
});
