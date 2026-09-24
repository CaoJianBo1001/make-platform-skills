#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));
const skill = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/SKILL.md'),
  'utf8',
);
const mobileDefaults = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/mobile-defaults.md'),
  'utf8',
);
const mobileFormControls = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/mobile-form-controls.md'),
  'utf8',
);
const mobileVisualStandard = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/mobile-visual-standard.md'),
  'utf8',
);
const mobileProductBaseline = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/mobile-product-baseline.md'),
  'utf8',
);
const componentUsage = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/component-usage.md'),
  'utf8',
);
const principles = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/principles.md'),
  'utf8',
);
const drawerLayout = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/drawer-layout.md'),
  'utf8',
);
const pageRouteLayout = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/page-route-layout.md'),
  'utf8',
);
const appShellLayout = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/app-shell-layout.md'),
  'utf8',
);
const listPageLayout = fs.readFileSync(
  path.join(repoRoot, 'skills/makeui/references/list-page-layout.md'),
  'utf8',
);
const runtimeSkill = fs.readFileSync(
  path.join(repoRoot, 'skills/make-app-runtime/SKILL.md'),
  'utf8',
);
const authSkill = fs.readFileSync(
  path.join(repoRoot, 'skills/make-app-auth/SKILL.md'),
  'utf8',
);
const authLogout = fs.readFileSync(
  path.join(repoRoot, 'skills/make-app-auth/references/logout-and-401.md'),
  'utf8',
);
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

const readScenarioTable = (markdown, heading) => {
  const headingIndex = markdown.indexOf(`## ${heading}`);
  assert.notEqual(headingIndex, -1, `missing scenario table: ${heading}`);
  const section = markdown.slice(headingIndex).split(/\n## /, 1)[0];
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\|.*\|$/.test(line) && !/^\|\s*:?-/.test(line))
    .slice(1)
    .map((line) => line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().replaceAll('`', '')));
};

assert.deepEqual(
  readScenarioTable(mobileProductBaseline, '字段交互场景矩阵'),
  [
    ['select-single', '否', '否', '选择或清除后立即提交并关闭', '可编辑'],
    ['select-multiple', '否', '是', '仅确认提交完整快照', '可编辑'],
    ['identity-single', '远程', '否', '选择或清除后立即提交并关闭', '可编辑'],
    ['identity-multiple', '远程', '是', '仅确认提交完整快照', '可编辑'],
    ['lookup-single-create', '按目标能力', '是', '仅确认提交完整快照', '合同完整时可编辑'],
    ['lookup-existing-edit', '不适用', '不适用', '不提交', '只读'],
  ],
  'the field interaction matrix must preserve distinct search, draft, and commit semantics',
);

assert.deepEqual(
  readScenarioTable(mobileProductBaseline, '容器与账户场景矩阵'),
  [
    ['width-767', 'mobile', '卡片列表与全屏任务页'],
    ['width-768', 'tablet', '桌面信息架构'],
    ['width-1199', 'tablet', '桌面信息架构'],
    ['width-1200', 'desktop', 'CanvasTable 与 Drawer'],
    ['normal-browser', '宿主判定为非飞书', '显示退出登录'],
    ['detected-feishu-container', '宿主判定为飞书', '隐藏退出登录'],
  ],
  'the responsive and account scenarios must preserve boundary and logout behavior',
);

assert.match(skill, /references\/mobile-defaults\.md/);
assert.match(skill, /references\/mobile-form-controls\.md/);
assert.match(skill, /references\/mobile-product-baseline\.md/);
assert.match(skill, /references\/mobile-visual-standard\.md/);
assert.match(skill, /@qfei-design\/make-app-mobile/);
assert.match(
  skill,
  /new Make App[\s\S]{0,280}(default|required)[\s\S]{0,280}mobile/i,
  'new Make Apps must receive mobile adaptation by default',
);
assert.match(
  skill,
  /(explicitly opts out|explicitly requests)[\s\S]{0,220}(mobile|custom)/i,
  'only an explicit user override may replace the mobile default',
);
assert.match(
  mobileDefaults,
  /corepack pnpm add @qfei-design\/make-app-mobile@\^0\.1\.7/,
  'mobile defaults must install the required 0.1.7 baseline',
);
assert.match(mobileDefaults, /package\.ai\.json/);
assert.match(mobileDefaults, /PUBLIC_API\.md/);
assert.match(
  mobileDefaults,
  /手机端[^\n]*(业务记录列表|对象列表)[^\n]*(默认|统一)[^\n]*卡片/,
  'phone record lists must use the standard card presentation by default',
);
assert.match(
  mobileDefaults,
  /(手机端|Phone)[\s\S]{0,180}(不得|不使用|must not)[^\n]*(CanvasTable|canvas-table)/i,
  'phone record lists must not render CanvasTable',
);
assert.match(
  mobileDefaults,
  /(手机端|Phone)[\s\S]{0,220}(不支持|不提供|不得展示)[^\n]*(多选|全选)[^\n]*(批量|batch)/i,
  'the standard phone list must not expose record selection or batch operations',
);
assert.match(
  mobileDefaults,
  /(单条编辑|single edit)[\s\S]{0,320}(make-app-actions)[\s\S]{0,320}(预检|precheck)/i,
  'phone card edit must reuse make-app-actions permission and precheck contracts',
);
assert.match(
  mobileDefaults,
  /(单条删除|single delete)[\s\S]{0,360}(MobileConfirmDialog)[\s\S]{0,360}(最终|final)[^\n]*(鉴权|authorization)/i,
  'phone card delete must use confirmation and the authoritative delete endpoint',
);
assert.match(
  mobileDefaults,
  /(手机端|Phone)[^\n]*(不展示|隐藏)[^\n]*(分组|group)[^\n]*(排序|sort)/i,
  'phone list toolbars must hide group and sort by default',
);
assert.match(
  mobileDefaults,
  /(手机|phone)[\s\S]{0,260}(独立|separate)[^\n]*(toolbar|工具栏)[\s\S]{0,260}(不得|不要|must not)[^\n]*(复用|reuse)[^\n]*(desktop|桌面)/i,
  'phone list composition must not reuse the desktop toolbar fragment',
);
assert.match(
  mobileFormControls,
  /(手机|phone)[\s\S]{0,260}(不得|must not)[^\n]*(直接复用|reuse)[^\n]*(desktop|桌面)[^\n]*(DatePicker|RangePicker|Select)/i,
  'phone task forms must not reuse desktop popup controls unchanged',
);
assert.match(
  mobileFormControls,
  /`Date`[^\n]*(年[^\n]*月[^\n]*日|year[^\n]*month[^\n]*day)[^\n]*(三列|3-column)[^\n]*(滚轮|wheel)/i,
  'phone Date fields must use the standard year/month/day wheel sheet',
);
assert.match(
  mobileFormControls,
  /`DateTime`[^\n]*(年[^\n]*月[^\n]*日[^\n]*时[^\n]*分|year[^\n]*month[^\n]*day[^\n]*hour[^\n]*minute)[^\n]*(五列|5-column)[^\n]*(滚轮|wheel)/i,
  'minute-precision phone DateTime fields must use the five-column wheel sheet',
);
assert.match(
  mobileFormControls,
  /`DateRange`[\s\S]{0,420}(单月|single-month)[^\n]*(日历|calendar)[\s\S]{0,220}(上一个月|previous month)[^\n]*(下一个月|next month)/i,
  'phone DateRange fields must use the standard single-month calendar sheet',
);
assert.match(mobileFormControls, /MobileDateField[\s\S]{0,180}MobileDateRangeField/);
assert.match(mobileFormControls, /MobileSearchPickerSheet[\s\S]{0,260}MobileOptionPickerSheet/);
assert.match(
  mobileFormControls,
  /MobileIdentityField[\s\S]{0,360}(人员|User)[^\n]*(部门|Department)[\s\S]{0,300}(标签|tag)[\s\S]{0,260}(头像|简称|identity mark)/i,
  'phone identity fields must use the package trigger, tags, and standard identity marks',
);
assert.match(
  mobileFormControls,
  /MobileAttachmentField[\s\S]{0,520}(缩略图|thumbnail)[\s\S]{0,260}(状态|status)[\s\S]{0,260}(删除确认|removal confirmation)[\s\S]{0,260}(上传|upload)[^\n]*(宿主|host)/i,
  'phone attachment fields must use the package presentation while the host owns requests',
);
assert.match(mobileVisualStandard, /冻结 Make App 手机端的通用视觉与交互基线/);
assert.match(mobileVisualStandard, /表单容器为白色平面[\s\S]{0,100}不加外层边框/);
assert.match(mobileVisualStandard, /所有字段值内容靠右对齐/);
assert.match(mobileVisualStandard, /calc\(100%\s*-\s*8px\)[\s\S]{0,100}(4px|4 px)/i);
assert.match(mobileVisualStandard, /(清除|clear)[^\n]*(左侧|left)[^\n]*(确定|confirm)[^\n]*(右侧|right)/i);
assert.match(mobileVisualStandard, /MobileFormActionBar[^\n]*(无图标)[^\n]*(靠右)/);
assert.match(mobileVisualStandard, /滚轮[^\n]*五行、每行 48px[^\n]*中线/);
assert.match(mobileVisualStandard, /不使用浏览器原生 `select`/);
assert.match(mobileVisualStandard, /MobileOptionPickerSheet[\s\S]{0,80}MobileDateField[\s\S]{0,40}MobileDateRangeField/);
assert.match(readme, /@qfei-design\/make-app-mobile@\^0\.1\.7/);
assert.doesNotMatch(readme, /@qfei-design\/make-app-mobile@\^0\.1\.[56]/);
const filterRoutingRow = readme.split(/\r?\n/).find((line) => line.startsWith('| 筛选'));
assert.ok(filterRoutingRow, 'README must keep a filter routing row');
assert.match(filterRoutingRow, /desktop\/tablet/);
assert.match(filterRoutingRow, /手机/);
assert.match(filterRoutingRow, /不挂载 CanvasTable/);
assert.match(
  mobileFormControls,
  /`DateRange`[\s\S]{0,760}(反向|早于)[^\n]*(重置|reset)[^\n]*(开始|start)[\s\S]{0,300}(完整|complete)[^\n]*(确认|confirm)[\s\S]{0,220}\{\s*begin\s*,\s*end\s*\}/i,
  'phone DateRange must reset reverse selection and commit only a complete structured range',
);
assert.doesNotMatch(
  mobileFormControls,
  /`Date`、`DateTime`、`Time` 使用受控原生输入|`DateRange` 使用开始 `begin` 和结束 `end` 两个上下／纵向堆叠/,
  'the obsolete native-input and stacked-range defaults must be removed',
);
assert.match(
  mobileFormControls,
  /`SingleSelect`[^\n]*(不显示|不提供)[^\n]*(搜索|search)[^\n]*(立即提交|immediate)[^\n]*(关闭|close)/i,
  'ordinary phone single select must be non-searchable and commit immediately',
);
assert.match(
  mobileFormControls,
  /`MultiSelect`[^\n]*(不显示|不提供)[^\n]*(搜索|search)[^\n]*(草稿|draft)[^\n]*(确定|confirm)/i,
  'ordinary phone multi select must be non-searchable and confirm its draft',
);
assert.match(
  mobileFormControls,
  /(人员|User)[^\n]*(部门|Department)[^\n]*(远程搜索|remote search)[\s\S]{0,240}(单选|single)[^\n]*(立即提交|immediate)[\s\S]{0,220}(多选|multiple)[^\n]*(确定|confirm)/i,
  'identity pickers must retain remote search with single-immediate and multi-confirm semantics',
);
assert.match(
  mobileFormControls,
  /`Lookup`[\s\S]{0,420}(新建|create)[^\n]*(关系元数据|relation metadata)[^\n]*(权限|permission)[^\n]*(候选|candidate)[\s\S]{0,260}(单选|single)[^\n]*(确认|confirm)[\s\S]{0,260}(编辑|edit)[^\n]*(只读|read-only)/i,
  'Lookup must be gated on create, confirm even in single mode, and remain read-only on edit',
);
assert.match(
  mobileFormControls,
  /`Lookup`[\s\S]{0,520}(不得|不提供|must not)[^\n]*(伪造|fake)[^\n]*(新建目标|create target)/i,
  'Lookup must not invent a create-target shortcut',
);
assert.match(
  mobileFormControls,
  /MobileFormActionBar[\s\S]{0,260}(保存|submit|提交)[\s\S]{0,260}(safe-area|安全区)/i,
  'phone create/edit tasks must use the dedicated safe-area form action bar',
);
assert.match(
  mobileFormControls,
  /(详情|detail)[\s\S]{0,320}(label|标签)[^\n]*(value|值)[\s\S]{0,260}(不得|不要|must not)[^\n]*(disabled|禁用)[^\n]*(表单|input|control)/i,
  'phone details must render read-only label/value rows rather than disabled form controls',
);
assert.match(
  mobileFormControls,
  /(普通字段|ordinary fields)[^\n]*(左侧标签|label on the left)[^\n]*(右侧值|value on the right)[\s\S]{0,220}(1px|一条)[^\n]*(分隔线|divider)[\s\S]{0,260}(不得|不使用|must not)[^\n]*(完整边框|full border)[^\n]*(阴影|shadow)/i,
  'phone form fields must use the compact row skeleton without boxed focus chrome',
);
assert.match(
  mobileFormControls,
  /所有表单字段值内容必须靠右对齐/,
  'all phone form values must be right-aligned',
);
assert.match(
  mobileFormControls,
  /自定义 flex 触发器须把值及其箭头作为整体推到行尾，并让值文本本身右对齐/,
  'custom flex triggers must right-align both the value group and value text',
);
assert.match(
  mobileFormControls,
  /(长文本|TextArea)[^\n]*(附件|File)[^\n]*(复杂多值|complex multi-value)[^\n]*(上方标签|top label)[^\n]*(下方内容|content below)/i,
  'wide and complex phone fields must use a top-label/content-below skeleton',
);
assert.match(
  mobileFormControls,
  /(详情|detail)[\s\S]{0,260}(左侧标签|label on the left)[^\n]*(右侧|right)[^\n]*(尾端对齐|end-aligned)[\s\S]{0,220}`Lookup`[^\n]*(flex)[^\n]*(end|尾端)/i,
  'phone detail values, including Lookup, must align to the row end',
);
assert.match(
  listPageLayout,
  /(手机卡片|phone card)[\s\S]{0,260}(扁平白底|flat white)[^\n]*(无边框|no border)[^\n]*(无阴影|no shadow)[\s\S]{0,220}(8[^\n]*12px|8–12px)[^\n]*(间隔|gap)/i,
  'phone record cards must use the flat separated standard',
);
assert.match(
  listPageLayout,
  /(标题|title)[^\n]*(状态|status)[^\n]*(2[^\n]*3|二至三个|两到三个)[^\n]*(摘要字段|summary fields)[\s\S]{0,260}(44px)[^\n]*(触控|touch)[\s\S]{0,180}(空的操作区|empty action)/i,
  'phone cards must constrain content and preserve compact 44px action targets without empty action chrome',
);
assert.match(
  mobileFormControls,
  /真实业务页面[\s\S]{0,220}(新建|create)[^\n]*(编辑|edit)[^\n]*(详情|detail)[\s\S]{0,220}(390px|390)[\s\S]{0,160}(767px|767)[\s\S]{0,260}(溢出|overflow|裁切)/i,
  'phone task delivery must visually verify create, edit, and detail without clipped overlays',
);
assert.match(
  mobileDefaults,
  /存量 App[\s\S]{0,360}(Node|engines)[\s\S]{0,360}(React|react)[\s\S]{0,360}(lockfile|锁文件)/,
  'existing Apps must validate runtime, React peers, and lockfile before adding the mobile package',
);
assert.match(
  mobileDefaults,
  /(不满足|失败|冲突)[\s\S]{0,260}make-app-runtime/,
  'incompatible existing Apps must hand off runtime migration instead of mutating runtime declarations',
);
assert.match(
  mobileDefaults,
  /onSelectedKeysChange[^\n]*(草稿|draft)/i,
  'low-level picker selection changes must update only its explicit draft state',
);
assert.match(
  mobileDefaults,
  /onClose[^\n]*(放弃|discard)[^\n]*(草稿|draft)/i,
  'closing a picker must discard unconfirmed draft changes',
);
assert.doesNotMatch(
  mobileDefaults,
  /删除已选标签后外部表单立即同步/,
  'mobile defaults must not require immediate form commits from draft actions',
);
assert.match(
  componentUsage,
  /MultiUser[^\n]*MultiDepartment[^\n]*selectionMode="multiple"[\s\S]{0,420}(包|package)[^\n]*(草稿|draft)[\s\S]{0,260}(确定|confirm)[^\n]*(onChange)/i,
  'component usage must route identity multi-select draft and confirm semantics through MobileIdentityField',
);
for (const [name, content] of [
  ['principles', principles],
  ['drawer layout', drawerLayout],
  ['page route layout', pageRouteLayout],
]) {
  assert.match(
    content,
    /(phone|手机)[\s\S]{0,280}(full-screen|全屏)[\s\S]{0,180}(task|任务|mobile-defaults\.md)/i,
    `${name} must route phone CRUD to the full-screen mobile task-page default`,
  );
}
assert.match(
  drawerLayout,
  /On desktop\/tablet,[^\n]*Drawer presentation[\s\S]{0,260}Phone task routes remain full-screen/i,
  'dynamic route-driven Drawers must remain scoped to desktop/tablet',
);
assert.match(
  appShellLayout,
  /(phone|手机)[\s\S]{0,220}(mobile-defaults\.md|package-backed)[\s\S]{0,220}(sidebar|header|shell)/i,
  'app-shell guidance must make the package-backed phone shell override desktop defaults',
);
assert.match(
  listPageLayout,
  /(Phone|手机)[\s\S]{0,220}(card|卡片)[\s\S]{0,220}(不得|must not)[^\n]*(CanvasTable|canvas-table)/i,
  'list-page guidance must make cards, not CanvasTable, the phone default',
);
assert.match(
  componentUsage,
  /(desktop|桌面)[\s\S]{0,100}(tablet|平板)[\s\S]{0,180}(Drawer|Sheet)/i,
  'component-library defaults must scope Drawer and Sheet guidance to desktop/tablet',
);
assert.match(
  pageRouteLayout,
  /(phone|手机)[\s\S]{0,220}(mobile-defaults\.md|全屏任务路由)/i,
  'route-page guidance must state the phone task-route exception',
);
assert.match(
  authSkill,
  /current-context[\s\S]{0,320}tenantName/i,
  'make-app-auth must preserve tenantName for the package-backed mobile account drawer',
);
assert.match(
  authLogout,
  /(Feishu|飞书)[\s\S]{0,180}(hide|隐藏)[\s\S]{0,120}(logout|退出)/i,
  'make-app-auth must define testable Feishu-container logout visibility',
);
for (const signal of ['window.lark', 'window.feishu', 'window.LarkJSBridge']) {
  assert.ok(
    authLogout.includes(signal),
    `make-app-auth must document the ${signal} Feishu runtime signal`,
  );
}
assert.match(
  authLogout,
  /检测到的飞书容器/,
  'Feishu visibility wording must describe detected, not authoritatively confirmed, embedding',
);
assert.doesNotMatch(
  authLogout,
  /确认的飞书嵌入运行环境/,
  'Feishu detection heuristics must not be described as an authoritative confirmation',
);
assert.match(
  mobileDefaults,
  /单选[^\n]*selectionMode="single"[^\n]*不展示“确定”/,
  'single-value identity pickers must select single mode without a confirm button',
);
assert.match(
  mobileDefaults,
  /单选[^\n]*选择、移除或清除[^\n]*立即提交[^\n]*关闭/,
  'all three single-select actions must commit immediately and close',
);
assert.match(
  mobileDefaults,
  /多选[^\n]*selectionMode="multiple"[^\n]*(草稿|draft)[^\n]*只有“确定”[^\n]*onChange/,
  'MobileIdentityField multi-select must retain explicit confirmation as its only host-form commit',
);
for (const [name, content] of [['mobile defaults', mobileDefaults], ['component usage', componentUsage]]) {
  assert.match(
    content,
    /MobileIdentityField[\s\S]{0,900}(onChange)[\s\S]{0,260}(onBlur)/i,
    `${name} must route committed identity values through the controlled field callbacks`,
  );
  assert.match(
    content,
    /(onChange)[^\n]*(onBlur)[^\n]*(一次|once)|(一次|once)[^\n]*(onChange)[^\n]*(onBlur)/i,
    `${name} must prevent duplicate form callbacks`,
  );
  assert.doesNotMatch(
    content,
    /旧版无参数回调|如果产品保留“确定”|if it remains open with a confirm action/,
    `${name} must not retain the obsolete picker fallback`,
  );
}
assert.match(
  mobileDefaults,
  /组件内部[^\n]*草稿[\s\S]{0,420}宿主不得[^\n]*重复/i,
  'mobile defaults must keep transient identity draft behavior package-owned',
);
assert.match(
  componentUsage,
  /package owns[^\n]*draft[\s\S]{0,900}do not add a second/i,
  'component usage must keep transient identity draft behavior package-owned',
);
assert.match(
  componentUsage,
  /SingleUser[^\n]*SingleDepartment[^\n]*selectionMode="single"/,
  'component mapping must explicitly set single mode for people and department pickers',
);
assert.match(
  mobileDefaults,
  /重启[^\n]*Vite[^\n]*--force/,
  'package upgrades must restart Vite and force dependency pre-bundling',
);
assert.match(
  mobileDefaults,
  /真实页面[^\n]*单选[^\n]*多选/,
  'upgrade verification must exercise both picker modes on a real host page',
);
assert.match(
  mobileDefaults,
  /真实业务页面[\s\S]{0,260}(390px|390)[\s\S]{0,180}(767px|767)[\s\S]{0,260}(CanvasTable|分组|排序)/i,
  'delivery verification must inspect a real phone business list at the required breakpoints',
);
assert.match(
  mobileDefaults,
  /(停止输入|stop typing)[^\n]*(1s|1 秒|1000ms)[^\n]*(自动|apply)[\s\S]{0,220}(Enter|回车)[^\n]*(立即)[\s\S]{0,180}(清空|clear)[^\n]*(立即)/i,
  'phone list search must define debounce, Enter, and clear semantics',
);
assert.match(
  mobileDefaults,
  /(IME|输入法)[^\n]*(组合输入|composition)[^\n]*(不发起|不得发起|no request)[\s\S]{0,220}(compositionend|组合结束)[^\n]*(计时|timer)/i,
  'phone list search must be composition-safe',
);
assert.match(
  mobileDefaults,
  /(搜索|keyword)[\s\S]{0,280}(重置分页|reset pagination)[\s\S]{0,220}(取消|cancel)[^\n]*(旧请求|stale request)[\s\S]{0,220}(迟到响应|late response)[^\n]*(覆盖|overwrite)/i,
  'phone list search must reset pagination and reject stale responses',
);
assert.match(
  mobileDefaults,
  /(关键词|keyword)[^\n]*(会话|session)[^\n]*(不写入|不得写入)[^\n]*(Preset)/i,
  'phone list search must stay session-local and out of Preset',
);
assert.match(
  mobileDefaults,
  /高级筛选已启用时[^\n]*(未确认草稿)[^\n]*(不得合并|不合并)[^\n]*搜索请求/,
  'phone search must not merge unconfirmed advanced-filter drafts',
);
assert.match(
  pageRouteLayout,
  /(新建|create)[^\n]*(编辑|edit)[^\n]*(成功|success)[^\n]*`replace`[^\n]*(对象列表|object list)/i,
  'phone create and edit success must replace back to the object list',
);
assert.match(
  pageRouteLayout,
  /(初始化|initialization)[^\n]*(API|hydrate|回填)[^\n]*(不标记|不得标记|must not mark)[^\n]*(dirty|脏)[\s\S]{0,220}(用户|user)[^\n]*(修改|change)[^\n]*(dirty|脏)/i,
  'task dirty state must be driven only by user changes',
);
assert.match(
  pageRouteLayout,
  /(保存中|saving)[^\n]*(字段|fields)[^\n]*(附件|attachments)[^\n]*(返回|back)[^\n]*(重复提交|repeat submit)/i,
  'saving must freeze all task mutation and navigation controls',
);
assert.match(
  pageRouteLayout,
  /(任务路由|task route)[^\n]*(隐藏|hide)[^\n]*(底部 Tab|bottom tabs)[^\n]*(FAB|悬浮新建)[^\n]*(AI)/i,
  'root navigation and floating entries must be hidden on phone task routes',
);
assert.match(
  pageRouteLayout,
  /(URL|路由)[^\n]*(唯一事实来源|source of truth)[\s\S]{0,260}(停止渲染|stop rendering)[^\n]*(旧任务|old task)[^\n]*(同一渲染周期|same render cycle)[\s\S]{0,240}(搜索|search)[^\n]*(筛选|filter)[^\n]*(已加载页|loaded pages)[^\n]*(滚动|scroll)/i,
  'task-route exit must be URL-driven and restore the list context',
);
assert.match(
  pageRouteLayout,
  /(返回|back)[^\n]*(宿主关闭|host close)[^\n]*(dirty|未保存)[^\n]*(确认|confirm)[\s\S]{0,220}(取消|cancel)[^\n]*(字段|route|路由)[^\n]*(保留|keep)/i,
  'dirty task exit must be confirmed without discarding state on cancel',
);
assert.match(
  mobileDefaults,
  /(详情|detail)[^\n]*(MobileBottomActionBar)[^\n]*(编辑|edit)[^\n]*(删除|delete)[\s\S]{0,220}(独立权限|independent permissions)[\s\S]{0,180}(都不可用|neither)[^\n]*(移除|不渲染)/i,
  'phone detail must expose the permission-gated action bar independently of card actions',
);
assert.match(
  mobileDefaults,
  /手机新建／编辑[^\n]*`MobileFormActionBar`[\s\S]{0,220}手机详情[^\n]*`MobileBottomActionBar`/,
  'form submission and detail actions must use separate package primitives',
);
assert.match(
  skill,
  /\.\.\/make-app-actions\/[\s\S]{0,180}mobile-card-actions\.md/,
  'the makeui entry skill must use a valid cross-skill mobile action reference',
);
for (const [name, content] of [
  ['mobile defaults', mobileDefaults],
  ['list page layout', listPageLayout],
]) {
  assert.match(
    content,
    /\.\.\/\.\.\/make-app-actions\/[\s\S]{0,180}mobile-card-actions\.md/,
    `${name} must use a valid cross-skill mobile action reference`,
  );
}
assert.match(
  mobileProductBaseline,
  /(规范性|normative)[^\n]*(冻结|frozen)[^\n]*(移动端|mobile)[^\n]*(基线|baseline)/i,
  'makeui must publish a frozen normative mobile product baseline',
);
assert.match(
  mobileProductBaseline,
  /(历史方案|earlier proposal)[^\n]*(不得|不作为|must not)[^\n]*(覆盖|override)[^\n]*(最终|final)[^\n]*(基线|baseline)/i,
  'the final baseline must take precedence over superseded proposals',
);
assert.match(
  mobileDefaults,
  /(无法|未能|阻断)[^\n]*(真实业务页面|视觉走查)[\s\S]{0,220}(不得|不能|must not)[^\n]*(完成|验收|ready)/i,
  'blocked real-page verification must block a completed mobile-delivery claim',
);
assert.match(
  mobileDefaults,
  /浏览器[^\n]*(禁用缓存|停用缓存)[^\n]*重新加载/,
  'real-page verification must avoid stale browser dependencies',
);
assert.match(
  runtimeSkill,
  /Existing Make Apps retain their declared Node and package-manager versions[\s\S]*compatible npm and Yarn projects/,
  'the mobile contract must remain aligned with the runtime ownership boundary',
);
assert.match(
  readme,
  /@qfei-design\/make-app-mobile@\^0\.1\.7/,
  'repository routing docs must expose the same mobile package baseline',
);
assert.doesNotMatch(
  `${mobileDefaults}\n${readme}`,
  /@qfei-design\/make-app-mobile@\^0\.1\.[256]/,
  'active installation guidance must not retain the old mobile baseline',
);

console.log('makeui mobile package contract passed');
