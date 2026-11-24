import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const references = '../skills/makeui/references/';
const usage = read(references + 'component-usage.md');
const selection = usage.split('## Selection strategy\n')[1].split('## Presentation priority\n')[0];
const [design, library] = selection.split('### Component library branch\n');
const documents = {
  entry: read('../skills/makeui/SKILL.md'),
  readme: read('../README.md'),
  usage,
};

// These checks protect the published guidance, not an agent's browser execution.
const assertDecisionContract = ({ entry, readme, usage }) => {
  const quickStart = entry.split('\n').find((line) => line.startsWith('1. For every new Make App,')) ?? '';
  assert.match(quickStart, /including[^,]*template/);
  assert.match(quickStart, /after PRD\/DSL confirmation and before installing UI dependencies or generating components/);
  assert.match(quickStart, /Skip the initial question only when the PRD or the user's description explicitly specifies the project's UI component library or supplies a valid selected MakeDesign plan URL\./);
  assert.match(quickStart, /Otherwise ask[^.]*wait for the user's answer/);
  assert.match(quickStart, /For changes to an existing App, inspect and preserve its UI conventions unless the user requests a change/);
  const strategy = usage.split('## Selection strategy\n')[1].split('### MakeDesign branch\n')[0];
  assert.match(strategy, /If either explicitly selects the project's UI component library, use that library directly/);
  assert.match(strategy, /If either supplies a selected MakeDesign plan URL, verify it[^.]*use the resolved plan directly/);
  assert.match(strategy, /starter template[^.]*library mentioned only as an example[^.]*style name[^.]*gallery URL alone still require the question/);
  assert.match(strategy, /ask \*\*要使用 MakeDesign 选择项目风格吗？\*\*[^\n]*`request_user_input_async` or `request_user_input`[^\n]*If unavailable, ask the same question in chat/);
  assert.match(strategy, /Wait for an explicit answer before starting UI work\. Silence or dismissal leaves the choice pending/);
  assert.match(strategy, /Ant Design default applies only after the user chooses the component-library branch/);
  assert.match(strategy, /Reuse an answer already given for this project when resuming the same task/);
  assert.match(readme, /每个新项目[^\n]*搭建 UI 前[^\n]*必须询问用户是否使用 MakeDesign 并等待答复/);
  assert.match(readme, /只有 PRD 或用户描述已明确指定 UI 组件库，或已提供有效的 MakeDesign 方案链接时，才直接采用该选择/);
};

const assertOpeningContract = ({ entry, readme, usage }) => {
  assert.match(entry, /When MakeDesign is chosen, immediately open its selection page visibly and send the clickable link[^.]*same handoff[^.]*wait for the plan URL/);
  const handoff = usage.split('\n').find((line) => line.startsWith('- 使用 MakeDesign →')) ?? '';
  assert.match(handoff, /immediately perform both actions in the same handoff/);
  assert.match(handoff, /visible, focused tab[^.]*send a clickable link[^.]*including when opening succeeds/);
  assert.match(handoff, /choose a style[^.]*复制方案链接[^.]*paste the URL back into this conversation/);
  assert.match(handoff, /Verify the target URL and visible style-gallery content before reporting that the page is open/);
  assert.match(handoff, /If the tab is blank or hidden, recover the navigation or bring it into view/);
  assert.match(handoff, /If browser control is unavailable or opening fails, explain the opening problem in the same message with the clickable link and instructions/);
  assert.match(handoff, /Wait for a valid plan and read its handoff before generating UI/);
  assert.match(readme, /选择 MakeDesign 后，主动打开选择页面，同时在会话中提供可点击链接及复制回传步骤/);
};

test('new project design selection is mandatory with explicit exceptions and resumable answers', () => {
  assertDecisionContract(documents);
});

test('MakeDesign opening requires a visible page, a chat link and a verified plan', () => {
  assertOpeningContract(documents);
});

for (const [name, check, key, before, after] of [
  ['entry omits the mandatory question', assertDecisionContract, 'entry', "Otherwise ask whether to use MakeDesign via the selection dialog (chat if unavailable) and wait for the user's answer.", 'Use the template defaults.'],
  ['entry adds a template exception', assertDecisionContract, 'entry', "explicitly specifies the project's UI component library or supplies a valid selected MakeDesign plan URL.", "explicitly specifies the project's UI component library, uses a template, or supplies a valid selected MakeDesign plan URL."],
  ['guide accepts an unverified plan', assertDecisionContract, 'usage', 'verify it through the MakeDesign branch below and use the resolved plan directly', 'use the link without reading it'],
  ['guide lets scaffold defaults bypass selection', assertDecisionContract, 'usage', 'gallery URL alone still require the question', 'gallery URL alone skip the question'],
  ['guide treats silence as consent', assertDecisionContract, 'usage', 'Silence or dismissal leaves the choice pending.', 'Silence selects Ant Design.'],
  ['guide applies Ant Design before branch selection', assertDecisionContract, 'usage', 'Ant Design default applies only after the user chooses the component-library branch', 'Ant Design default applies before asking the user'],
  ['README omits the mandatory question', assertDecisionContract, 'readme', '必须询问用户是否使用 MakeDesign 并等待答复', '可以直接沿用模板'],
  ['README adds a style-name exception', assertDecisionContract, 'readme', '只有 PRD 或用户描述已明确指定 UI 组件库，或已提供有效的 MakeDesign 方案链接时，才直接采用该选择', '提供风格名称即可跳过选择'],
  ['entry makes opening optional', assertOpeningContract, 'entry', 'immediately open its selection page visibly and send the clickable link', 'optionally open its selection page'],
  ['guide opens a hidden tab', assertOpeningContract, 'usage', 'visible, focused tab', 'hidden tab'],
  ['guide omits the chat link on successful opening', assertOpeningContract, 'usage', 'including when opening succeeds', 'only when opening fails'],
  ['guide claims opening without checking content', assertOpeningContract, 'usage', 'Verify the target URL and visible style-gallery content before reporting that the page is open.', 'Report that the page is open immediately.'],
  ['guide drops the failed-opening fallback', assertOpeningContract, 'usage', 'If browser control is unavailable or opening fails, explain the opening problem in the same message with the clickable link and instructions.', 'Continue silently when opening fails.'],
  ['guide generates UI before reading the plan', assertOpeningContract, 'usage', 'Wait for a valid plan and read its handoff before generating UI.', 'Generate UI from the gallery defaults.'],
]) {
  test(`guidance regression: ${name}`, () => {
    const changed = documents[key].replace(before, after);
    assert.notEqual(changed, documents[key], 'the injected regression must change the document');
    assert.throws(() => check({ ...documents, [key]: changed }), { code: 'ERR_ASSERTION' });
  });
}

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
