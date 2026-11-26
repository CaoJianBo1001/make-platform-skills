import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolveAppPresentation } from '../skills/makeui/assets/antd-foundation/theme.mjs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const references = '../skills/makeui/references/';
const usage = read(references + 'component-usage.md');
const selection = usage.split('## Selection strategy\n')[1].split('## Presentation priority\n')[0];
const [design, library] = selection.split('### Component library branch\n');
const documents = {
  entry: read('../skills/makeui/SKILL.md'),
  readme: read('../README.md'),
  usage,
  drawer: read(references + 'drawer-layout.md'),
  foundation: read(references + 'antd-foundation.md'),
  shell: read(references + 'app-shell-layout.md'),
  mobileTheme: read(references + 'mobile-theme.md'),
  mobileControls: read(references + 'mobile-form-controls.md'),
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
  assert.match(strategy, /视觉来源与唯一组件基座是两项配置/);
  assert.match(strategy, /设计路线未确认前不安装依赖或生成 UI/);
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
  ['guide installs a foundation before the mandatory design answer', assertDecisionContract, 'usage', '设计路线未确认前不安装依赖或生成 UI', '可以先安装基座并生成 UI，再询问设计路线'],
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

test('the documented browser handoff uses the chosen entry, view, output and compatible control contract', () => {
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
  assert.match(mapping('Date'), /`DatePicker`[^\n]*`properties\.format`/);
  assert.match(mapping('DateTime'), /date-time[^\n]*precision/i);
  assert.match(mapping('DateRange'), /`RangePicker`[^\n]*begin, end[^\n]*inclusive[^\n]*bounds/);
  assert.match(mapping('SingleSelect'), /`Select`[^\n]*option value/i);
  assert.match(mapping('MultiSelect'), /multi-select[^\n]*array of option values/i);
});

const assertFoundationContract = ({ entry, readme, usage, drawer, foundation }) => {
  assert.match(usage, /视觉来源与唯一组件基座是两项配置/);
  assert.match(usage, /MakeDesign 分支默认使用 Ant Design[^\n]*告知用户[^\n]*不增加新的必答问题/);
  assert.match(usage, /已明确指定 Arco Design、shadcn\/ui 或其他兼容 React 库时保留该选择/);
  assert.match(usage, /不再默认复制 React Aria 的 `fields\.tsx`\/`fields\.css`/);
  assert.match(usage, /`foundation\.contract`[^\n]*`makeui-antd-foundation\/v1`[^\n]*`foundation\.library`[^\n]*`antd`/);
  assert.match(usage, /缺少 `foundation`[^\n]*已安装 Skill 的同版资产[^\n]*不能声称远端已提供新基座资产/);
  assert.match(usage, /不因为缺少 AntD 基座而安装 AntD、复制 AntD 组件或混入 React Aria/);
  assert.match(entry, /MakeDesign 不是绕过 Form、Detail 和字段图标合同的另一条生成路径/);
  assert.match(entry, /\]\(references\/antd-foundation\.md\)/);
  assert.match(drawer, /无论视觉来源是 MakeDesign 还是组件库默认主题，都使用同一套表单与详情骨架/);
  assert.match(drawer, /详情选择不得把 `560px` 或 `960px` 套到新建\/编辑/);
  assert.match(drawer, /标签、必填、字段图标、帮助与错误槽由同一个字段包装层负责/);
  assert.match(readme, /视觉来源与唯一组件基座分开[^\n]*MakeDesign 默认使用 Ant Design/);
  assert.match(foundation, /`makeui-antd-foundation\/v1`/);
  assert.match(foundation, /`colors`、`metrics` 和旧 `controls\.style`/);
  assert.match(foundation, /`Form\.Item`[^\n]*标签[^\n]*必填[^\n]*错误[^\n]*控件/);
  assert.match(foundation, /`value\/onChange\/onBlur\/id\/disabled`/);
  assert.match(foundation, /`CanvasTable`[^\n]*`make-app-permission`[^\n]*`make-app-approval`[^\n]*`make-app-mobile`/);
  assert.match(foundation, /真实生成[^\n]*真实浏览器[^\n]*不能[^\n]*文档[^\n]*代替/);
};

test('MakeDesign uses one mature foundation without bypassing Make form and detail standards', () => {
  assertFoundationContract(documents);
});

for (const [name, key, before, after] of [
  ['选 MakeDesign 后不告知基座默认值', 'usage', '告知用户', '静默处理'],
  ['MakeDesign 分支自动复制原型控件', 'usage', '不再默认复制 React Aria 的 `fields.tsx`/`fields.css`', '默认复制 React Aria 的 `fields.tsx`/`fields.css`'],
  ['指定非 AntD 基座时混入 AntD', 'usage', '不因为缺少 AntD 基座而安装 AntD、复制 AntD 组件或混入 React Aria', '缺少 AntD 基座时安装 AntD'],
  ['旧部署伪称提供新基座', 'usage', '不能声称远端已提供新基座资产', '把安装副本描述为远端新基座'],
  ['MakeDesign 绕过表单详情标准', 'entry', 'MakeDesign 不是绕过 Form、Detail 和字段图标合同的另一条生成路径', 'MakeDesign 可以绕过平台表单布局'],
  ['详情抽屉宽度覆盖新建编辑', 'drawer', '详情选择不得把 `560px` 或 `960px` 套到新建/编辑', '详情宽度同时用于新建/编辑'],
  ['基座文档取消受控值合同', 'foundation', '`value/onChange/onBlur/id/disabled`', '`defaultValue`'],
  ['用文档测试冒充实际生成验收', 'foundation', '不能用文档正则、静态类型或截图文件存在代替', '文档正则通过即可代替'],
]) {
  test(`基座指导回归：${name}`, () => {
    const changed = documents[key].replace(before, after);
    assert.notEqual(changed, documents[key], '故障注入必须改变文档');
    assert.throws(() => assertFoundationContract({ ...documents, [key]: changed }), { code: 'ERR_ASSERTION' });
  });
}

const assertCompleteDesignContract = ({ entry, usage, foundation, drawer, shell, readme }) => {
  assert.match(entry, /MakeDesign 方案是 PC／平板所有页面的完整设计输入，不是只换主色/);
  assert.match(usage, /同一份已解析方案[^\n]*Shell、导航、页面布局、表面、字体、间距、控件、细节与弹层/);
  assert.match(usage, /方案未给出对应值时[^\n]*官方 fallback[^\n]*记录来源/);
  assert.match(usage, /Intercom、GitHub[^\n]*验收样例[^\n]*不是新项目默认/);
  assert.match(usage, /逐项记录[^\n]*已实现[^\n]*不适用[^\n]*未支持[^\n]*差异/);
  assert.match(usage, /不支持的选择不得静默忽略[^\n]*不能捏造公开 API/);
  assert.match(foundation, /完整方案[^\n]*所有页面[^\n]*固定配色/);
  assert.match(foundation, /品牌、语义、表面、文字、边框[^\n]*当前方案[^\n]*来源/);
  assert.match(foundation, /验收样例[^\n]*不能作为[^\n]*产品默认/);
  assert.match(drawer, /颜色、字体、间距、圆角与状态样式仍从当前方案读取/);
  assert.match(shell, /方案显式导航选择优先于下述默认侧栏/);
  assert.match(shell, /权限、审批入口和路由语义[^\n]*保持原合同/);
  assert.match(readme, /完整方案[^\n]*所有页面[^\n]*验收样例[^\n]*默认/);
};

test('完整方案指导覆盖所有页面而不把验收样例固化成默认', () => {
  assertCompleteDesignContract(documents);
});

for (const [name, key, before, after] of [
  ['PC 仅应用主色', 'entry', 'MakeDesign 方案是 PC／平板所有页面的完整设计输入，不是只换主色', 'MakeDesign 只覆盖首页主色'],
  ['硬编码验收样例', 'usage', 'Intercom、GitHub 等验收样例用于检验映射，不是新项目默认', '新项目默认复制 Intercom、GitHub 验收样例'],
  ['省略不支持项', 'usage', '不支持的选择不得静默忽略', '不支持的选择可以静默忽略'],
  ['用固定侧栏覆盖导航选择', 'shell', '方案显式导航选择优先于下述默认侧栏', '下述默认侧栏优先于方案显式导航选择'],
  ['控件回退不记录来源', 'usage', '官方 fallback，并记录来源', '任意默认值'],
]) {
  test(`完整方案故障注入：${name}`, () => {
    const changed = documents[key].replace(before, after);
    assert.notEqual(changed, documents[key], '故障注入必须改变文档');
    assert.throws(() => assertCompleteDesignContract({ ...documents, [key]: changed }), { code: 'ERR_ASSERTION' });
  });
}

const assertPublicPackageThemeScope = ({ entry, usage, foundation, mobileTheme, mobileControls }) => {
  const scope = usage.split('## 完整方案应用与差异记录\n')[1]?.trimStart().split('\n\n')[0] ?? '';
  const mobileScope = mobileTheme.split('\n').find((line) => line.startsWith('MakeDesign 默认负责')) ?? '';
  const mobileMapping = foundation.split('\n').find((line) => line.startsWith('- 手机只同步')) ?? '';
  assert.match(entry, /手机默认仅同步主题主色及对应选中／强调色/,
    'MakeDesign may change phone brand colors without importing the PC design system');
  assert.match(scope, /Canvas、审批等其他引用包[^。\n]*自有 UI[^。\n]*正式版本现有外观/);
  assert.match(scope, /完整主题同步[^。\n]*另行明确纳入范围/);
  assert.match(scope, /不主动[^。\n]*完整主题 Provider／mapper/);
  assert.match(scope, /宿主传给公共包的[^。\n]*展示插槽[^。\n]*按宿主方案渲染/);
  assert.match(scope, /差异[^。\n]*“公共包主题后续同步”/);
  assert.match(scope, /不记作已实现/);
  assert.match(scope, /不作为宿主交付阻断/);
  assert.match(scope, /业务[^。\n]*权限[^。\n]*字段[^。\n]*手机合同继续生效/);
  assert.match(foundation, /引用包自有 UI[^。\n]*正式版现有外观/);
  assert.match(foundation, /宿主提供的[^。\n]*展示插槽[^。\n]*AntD 上下文/);
  assert.match(mobileMapping, /只同步主题主色及对应选中／强调色/);
  assert.match(mobileMapping, /核对实际正式包/);
  assert.match(mobileMapping, /不能直接[^。\n]*toMakeMobileTheme[^。\n]*整份传入手机 Provider/);
  assert.match(mobileScope, /手机只跟随[^。\n]*主题主色与选中强调色/);
  assert.match(mobileScope, /字体、字号、字距、密度、圆角、阴影、表面、布局、控件种类和交互[^。\n]*冻结/);
  assert.match(mobileTheme, /toMobileBrandTheme/);
  assert.match(mobileControls, /所有可编辑的原生[^。\n]*iOS[^。\n]*不得小于 16px/,
    'deferring visual package theming must not waive the iOS input-size floor');
};

test('手机仅跟主题色，其他公共包完整主题仍按范围启用且安全合同保留', () => {
  assertPublicPackageThemeScope(documents);
});

for (const [name, key, mutate] of [
  ['手机继承完整 PC 视觉', 'mobileTheme',
    (text) => text.replace('手机只跟随当前方案的主题主色与选中强调色', '手机继承完整 PC 视觉')],
  ['入口让 PC 样式覆盖手机控件规则', 'entry',
    (text) => text.replace('手机默认仅同步主题主色及对应选中／强调色', '手机默认同步完整 PC 样式')],
  ['手机颜色接入跳过真实公开能力核验', 'foundation',
    (text) => text.replace('核对实际正式包', '假定目标包支持')],
  ['推迟的包主题冒充已实现', 'usage',
    (text) => text.replace('不记作已实现', '记作已实现')],
  ['默认用公共包主题阻断宿主交付', 'usage',
    (text) => text.replace('不作为宿主交付阻断', '必须先完成公共包主题才可交付宿主')],
  ['宿主注入插槽也改回包默认外观', 'usage',
    (text) => text.replace('仍按宿主方案渲染', '必须改回包默认外观')],
  ['推迟主题同时豁免字段权限', 'usage',
    (text) => text.replace('业务、权限、字段和手机合同继续生效', '业务和手机布局继续生效')],
  ['推迟主题同时降低 iOS 输入字号', 'mobileControls',
    (text) => text.replace('不得小于 16px', '可以小于 16px')],
]) {
  test(`主题范围故障注入：${name}`, () => {
    const changed = mutate(documents[key]);
    assert.notEqual(changed, documents[key], '故障注入必须改变主题范围或安全合同');
    assert.throws(() => assertPublicPackageThemeScope({ ...documents, [key]: changed }), { code: 'ERR_ASSERTION' });
  });
}

const assertActivePlanContract = (contract) => {
  const { usage, foundation } = contract;
  assert.match(foundation, /`MakeAppShell`[^\n]*`brand`[^\n]*`title`[^\n]*`headerEnd`[^\n]*`navigation`[^\n]*`primaryNavigation`[^\n]*`children`/);
  assert.match(foundation, /`resolveAppPresentation`[^\n]*`applicability`[^\n]*`fallbacks`/);
  assert.match(foundation, /`useMakeDesign\(\)`[^\n]*当前方案[^\n]*旧常量/);
  assert.match(foundation, /`MakeActionButton`[^\n]*`intent`[^\n]*`primary`[^\n]*`default`[^\n]*`danger`/);
  assert.match(foundation, /`MakeStatusTag`[^\n]*`MakeTabs`/);
  assert.match(foundation, /`illustrationSlot`[^\n]*`secondaryCardsSlot`[^\n]*已有内容/);
  assert.match(foundation, /`data-makeui-navigation`[^\n]*`data-makeui-surface`[^\n]*`data-makeui-presentation`/);
  assert.match(foundation, /`--mk-mono-font`[^\n]*当前方案/);
  assert.match(foundation, /单个 Provider 持有当前完整方案[^\n]*不能[^\n]*设计 ID[^\n]*`key`/);
  assert.match(foundation, /切换 `motion`[^\n]*mount 次数不得增加[^\n]*草稿[^\n]*数据/);
  assertPublicPackageThemeScope(contract);
  assert.match(usage, /同一 App 切换完整方案[^\n]*不能按设计 ID 重建业务 Controller/);
};

const assertNavigationGuidance = ({ foundation, usage }) => {
  const priority = foundation.split('### 导航解析优先级\n')[1]?.split('\n### ')[0] ?? '';
  const sources = [...priority.matchAll(/^\|\s*\d+\s*\|\s*`([^`]+)`/gm)].map((match) => match[1]);
  assert.deepEqual(sources, [
    'choices.navigation', 'layout.structure.resolvedNavigation.mode', 'layout.recipe.nav', 'single',
  ], 'navigation guidance must preserve explicit, resolved, recipe and contract-default priority');
  const explicit = priority.split('\n').find((line) => /^\|\s*1\s*\|/.test(line)) ?? '';
  assert.match(explicit, /`layout\.structure\.navigation\.id`/);
  assert.match(explicit, /非\s*`system`/);
  assert.match(priority, /`resolveAppPresentation`/);
  assert.match(priority, /宽度[^\n]*`layout\.structure\.resolvedNavigation`[^\n]*`layout\.structure\.widths`/);
  assert.match(usage, /方案明确的导航优先于默认左侧栏/);
};

const assertSecondaryCardsGuidance = ({ foundation }) => {
  const cards = foundation.split('\n').find((line) => line.startsWith('- `secondaryCardsSlot`')) ?? '';
  assert.match(cards, /`enabled=false`/);
  assert.match(cards, /`applicability=disabled`/);
  assert.match(cards, /装饰/);
  assert.match(cards, /已有[^。\n]*(概览|统计)[^。\n]*(继续展示|保持可见)/);
  assert.match(cards, /不[^。\n]*(隐藏|删除)[^。\n]*业务/);
  assert.doesNotMatch(foundation, /按[^。\n]*启用状态[^。\n]*决定是否显示/,
    'card decoration settings must not become business visibility conditions');
};

test('导航指导与公开解析器在显式选择、system 和旧交接回退上保持一致', () => {
  assertNavigationGuidance(documents);
  for (const [input, expected] of [
    [{ choices: { navigation: 'double' }, layout: { structure: { resolvedNavigation: { mode: 'top' } }, recipe: { nav: 'rail' } } }, 'double'],
    [{ choices: { navigation: 'system' }, layout: { structure: { resolvedNavigation: { mode: 'top' } }, recipe: { nav: 'rail' } } }, 'top'],
    [{ layout: { structure: { navigation: { id: 'double' }, resolvedNavigation: { mode: 'top' } } } }, 'double'],
    [{ layout: { recipe: { nav: 'rail' } } }, 'rail'],
    [{}, 'single'],
  ]) {
    assert.equal(resolveAppPresentation(input).navigation.mode, expected);
  }
  const navigation = resolveAppPresentation({ choices: { navigation: 'double' }, layout: { structure: {
    resolvedNavigation: { mode: 'top', primaryRail: 70 }, widths: { primaryRail: 64, secondarySidebar: 196 },
  } } }).navigation;
  assert.equal(navigation.mode, 'double');
  assert.equal(navigation.widths.primaryRail, 70);
  assert.equal(navigation.widths.secondarySidebar, 196);
});

test('次级卡片指导关闭所选装饰时保留已有业务内容', () => {
  assertSecondaryCardsGuidance(documents);
  assert.equal(resolveAppPresentation({ layout: { secondaryCards: { enabled: false } } }).applicability.secondaryCards, 'disabled');
});

for (const [name, check, mutate] of [
  ['resolved 模式覆盖显式导航', assertNavigationGuidance,
    (text) => text.replace('| 1 | `choices.navigation`', '| 1 | `layout.structure.resolvedNavigation.mode`')],
  ['关闭次级卡片隐藏已有业务', assertSecondaryCardsGuidance,
    (text) => text.replace(/已有概览／统计内容继续展示/, '已有概览／统计内容隐藏')],
  ['合并装饰与业务的可见性开关', assertSecondaryCardsGuidance,
    (text) => text.replace(/(- `secondaryCardsSlot`[^\n]+)/, '$1 按解析结果的启用状态决定是否显示已有业务内容。')],
]) {
  test(`展示边界故障注入：${name}`, () => {
    const changed = mutate(documents.foundation);
    assert.notEqual(changed, documents.foundation, '故障注入必须改变文档');
    assert.throws(() => check({ ...documents, foundation: changed }), { code: 'ERR_ASSERTION' });
  });
}

test('当前方案上下文与公开入口指导覆盖方案切换和状态保留', () => {
  assertActivePlanContract(documents);
});

for (const [name, before, after] of [
  ['保留初始方案常量', '不得继续导入初始方案旧常量', '继续导入初始方案常量'],
  ['按方案 ID 重建 Provider', '不能按设计 ID 或主题给 Provider、Shell、业务 Controller 设置新的 `key`', '按设计 ID 给 Provider 和 Controller 设置新的 `key`'],
  ['把插画槽扩展为演示业务', '`illustrationSlot`／`secondaryCardsSlot` 仅填充宿主已有内容', '插画与次级卡片槽自动新增演示业务'],
  ['motion 切换丢失状态', '切换 `motion` 也必须验证 mount 次数不得增加，已有草稿、数据', '切换 motion 后允许重新挂载并丢弃状态'],
]) {
  test(`当前方案故障注入：${name}`, () => {
    const changed = documents.foundation.replace(before, after);
    assert.notEqual(changed, documents.foundation, '故障注入必须改变文档');
    assert.throws(() => assertActivePlanContract({ ...documents, foundation: changed }), { code: 'ERR_ASSERTION' });
  });
}

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

test('mobile theme integration uses verified npm 0.1.16 while explaining stale candidate metadata and old-package limits', () => {
  const mobileTheme = read(references + 'mobile-theme.md');
  assert.match(documents.foundation, /\]\(mobile-theme\.md\)/);
  assert.match(mobileTheme, /MakeMobileThemeProvider/);
  assert.match(mobileTheme, /toMakeMobileTheme\(currentDesign\)/);
  assert.match(mobileTheme, /正式[^\n]*`0\.1\.16`/);
  assert.match(mobileTheme, /registry\.npmjs\.org/);
  assert.match(mobileTheme, /SHA512/);
  assert.match(mobileTheme, /useMakeMobileTheme/);
  assert.match(mobileTheme, /0\.1\.14[^\n]*不提供/);
  assert.match(mobileTheme, /availability[^\n]*local-candidate[^\n]*published[^\n]*false/);
  assert.match(mobileTheme, /旧文案[^\n]*真实[^\n]*(导出|产物)/);
  assert.doesNotMatch(mobileTheme, /当前[^\n]*主题扩展[^\n]*本地候选[^\n]*不是已发布能力/);
  const tokenTable = mobileTheme.split('## 公开主题字段\n')[1]?.split('\n## ')[0];
  assert.ok(tokenTable, 'published mobile theme fields must be discoverable without guessing from desktop variables');
  const actualTokens = [...tokenTable.matchAll(/`([A-Za-z][A-Za-z0-9]*)`/g)].map((match) => match[1]).sort();
  assert.deepEqual(actualTokens, [
    'primary', 'onPrimary', 'primarySoft', 'danger', 'success', 'warning',
    'surface', 'controlSurface', 'page', 'text', 'muted', 'placeholder', 'line', 'controlBorder',
    'link', 'focusRing', 'mask', 'fontFamily', 'headingFontFamily', 'monoFontFamily',
    'contentSize', 'pageHeaderSize', 'fieldLabelSize', 'controlTextSize',
    'sheetTitleSize', 'sheetBodySize', 'sheetMetaSize', 'sheetHeadingSize', 'lineHeight', 'letterSpacing',
    'controlRadius', 'actionRadius', 'shadow', 'iconStroke', 'motionDuration',
    'actionBackground', 'actionText', 'actionBorder',
  ].sort(), 'document the 38 CSS-string fields present in the verified 0.1.16 declaration, including role separation');
  assert.match(mobileTheme, /不能[^\n]*私有[^\n]*选择器/);
  assert.match(mobileTheme, /document[^\n]*全局/);
  assert.match(mobileTheme, /Sheet[^\n]*16px[^\n]*48px/);
  assert.match(mobileTheme, /同一 App[^\n]*草稿[^\n]*重新挂载/);
  const visual = read(references + 'mobile-visual-standard.md');
  assert.match(visual, /MakeDesign 默认只给手机提供主题主色与选中强调色/);
  assert.match(visual, /字体、字号、字距、密度[^\n]*布局、控件种类及交互继续遵循本冻结规范/);
  assert.match(mobileTheme, /toMobileBrandTheme\(toMakeMobileTheme\(currentDesign\)\)/);
});

test('business typography keeps semantic roles and explicit fine edits instead of inflating every title', () => {
  const typography = read(references + 'business-typography.md');
  assert.match(documents.foundation, /\]\(business-typography\.md\)/);
  assert.match(typography, /makedesign\/business-typography\/v1/);
  for (const role of ['pageTitle', 'recordTitle', 'sectionTitle', 'fieldLabel', 'controlText', 'meta', 'phoneHeader', 'sheetTitle']) assert.ok(typography.includes('`' + role + '`'), role);
  assert.match(typography, /不能[^\n]*展示标题[^\n]*抽屉[^\n]*手机/);
  assert.match(typography, /用户明确[^\n]*正文[^\n]*页面标题[^\n]*精确保留/);
  assert.match(typography, /只缩放一次/);
  assert.match(typography, /tracking-display[^\n]*正文/);
  assert.match(typography, /旧[^\n]*回退[^\n]*来源/);
});
