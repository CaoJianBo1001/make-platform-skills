#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertForwardTestScope,
  assertScenarioPassed,
  assertUniqueScenarioExecutionIds,
  computeForwardTestScopeHash,
  readForwardTestScopeEntriesFromRoots,
} from './lib/forward-test-record.mjs';

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

const skill = read('skills/make-app-actions/SKILL.md');
const packageIntegration = read(
  'skills/make-app-actions/references/package-integration.md',
);
const permissionModel = read(
  'skills/make-app-actions/references/action-permission-model.md',
);
const selectionFlow = read(
  'skills/make-app-actions/references/selection-and-operation-snapshot.md',
);
const serviceContract = read(
  'skills/make-app-actions/references/service-contract.md',
);
const batchEdit = read(
  'skills/make-app-actions/references/batch-edit-flow.md',
);
const testing = read(
  'skills/make-app-actions/references/testing-and-pitfalls.md',
);
const forwardTestRecord = read(
  'docs/make-app-actions-forward-test.md',
);
const openai = read('skills/make-app-actions/agents/openai.yaml');
const readme = read('README.md');
const canvasSkill = read('skills/canvas-table-integration/SKILL.md');
const permissionSkill = read('skills/make-app-permission/SKILL.md');
const serviceSkill = read('skills/make-app-service/SKILL.md');
const makeuiSkill = read('skills/makeui/SKILL.md');
const makeuiListLayout = read('skills/makeui/references/list-page-layout.md');
const makeuiDrawerLayout = read('skills/makeui/references/drawer-layout.md');
const makeuiComponentUsage = read('skills/makeui/references/component-usage.md');
const makeuiStyling = read(
  'skills/makeui/references/styling-and-responsive.md',
);
const canvasCoreContract = read(
  'skills/canvas-table-integration/references/core-props-methods-events.md',
);
const canvasRowHeadContract = read(
  'skills/canvas-table-integration/references/row-head-action-patterns.md',
);
const canvasEditLifecycle = read(
  'skills/canvas-table-integration/references/edit-interaction-lifecycle.md',
);
const filterSkill = read('skills/make-app-filter/SKILL.md');
const sortSkill = read('skills/make-app-sort/SKILL.md');
const groupSkill = read('skills/make-app-group/SKILL.md');
const forwardTestScopeSkillNames = [
  'make-app-actions',
  'makeui',
  'canvas-table-integration',
  'make-app-permission',
  'make-app-service',
  'make-app-filter',
  'make-app-sort',
  'make-app-group',
];
const forwardTestScopeHash = computeForwardTestScopeHash(
  readForwardTestScopeEntriesFromRoots(
    forwardTestScopeSkillNames.map((skillName) => ({
      directory: path.join(repoRoot, 'skills', skillName),
      prefix: `skills/${skillName}`,
    })),
  ),
);
const currentForwardTestBatch = '2026-08-11-make-app-actions-0.3.1-r8';

const skillBundle = [
  skill,
  packageIntegration,
  permissionModel,
  selectionFlow,
  serviceContract,
  batchEdit,
  testing,
].join('\n');
const frontmatter = skill.split('---')[1] ?? '';

assert.doesNotMatch(
  skillBundle,
  /(inspectionPoc|expensePoc|uju[-_]?mdm|workorders|设备巡检|\/Users\/|ZSQF|make-group)/i,
  'make-app-actions skill must not contain project, business, or local-machine names',
);

assert.match(
  frontmatter,
  /(CanvasTable|canvas-table)[^"\n]*(操作|actions?)[^"\n]*(默认|default)|(?:默认|default)[^"\n]*(CanvasTable|canvas-table)[^"\n]*(操作|actions?)/i,
  'frontmatter must make record actions a default for Make CanvasTable record lists',
);
assert.match(
  frontmatter,
  /(编辑|edit)[^"\n]*(删除|delete)[^"\n]*(批量|bulk)|(?:批量|bulk)[^"\n]*(编辑|edit)/i,
  'frontmatter must trigger for edit, delete, and batch-edit actions',
);

assert.match(
  skill,
  /@qfei-design\/make-app-actions@\^0\.3\.1[\s\S]*package\.ai\.json[\s\S]*readOrder[\s\S]*(public|公开)/i,
  'skill must require package 0.3.1+ and read its declared public docs',
);
assert.match(
  skill,
  /package\.json[\s\S]{0,280}(resolved|installed|实际|已安装|version|版本)[\s\S]{0,280}package\.ai\.json[\s\S]{0,180}readOrder/i,
  'top-level workflow must verify the resolved package version before reading the AI manifest',
);
assert.match(
  skill,
  /package\.json[^\n]*(authoritative|source of truth|唯一版本依据|权威版本)[\s\S]{0,260}package\.ai\.json[\s\S]{0,100}(stale|过期)[\s\S]{0,180}(must not downgrade|do not downgrade|不得降级|不能降级)/i,
  'top-level invariants must reject stale AI-manifest versions instead of merely documenting read order',
);
assert.match(
  packageIntegration,
  /@qfei-design\/make-app-actions@\^0\.3\.1/,
  'package integration must require the generic batch-modal release',
);
assert.match(
  packageIntegration,
  /(resolved|installed|实际|已安装)[\s\S]{0,180}(satisfy|satisfies|符合|满足)[^\n]*\^0\.3\.1/i,
  'package integration must validate the resolved version against the compatible semver range',
);
assert.match(
  packageIntegration,
  /(manifest|package\.ai\.json)[\s\S]{0,220}(lower|低于|0\.3\.0)[\s\S]{0,220}(do not downgrade|不得降级|ignore|忽略)/i,
  'skill minimum must override stale lower-version install examples in a published manifest',
);
assert.match(
  packageIntegration,
  /(package\.json)[\s\S]{0,220}(resolved|installed|实际|已安装)[\s\S]{0,160}(0\.3\.1|minimum|最低)[\s\S]{0,220}(package\.ai\.json)[\s\S]{0,180}(stale|过期|不得降级|do not downgrade)/i,
  'integration must verify the resolved package version before interpreting a stale AI manifest',
);
assert.match(
  readme,
  /@qfei-design\/make-app-actions@\^0\.3\.1/,
  'README must recommend the generic batch-modal release',
);
assert.match(
  packageIntegration,
  /(styles\.css)[\s\S]*(once|一次)[\s\S]*(do not|不得|禁止)[\s\S]*(copy|复制|hand-write|手写)/i,
  'package integration must import styles once and forbid host reimplementation',
);
assert.match(
  packageIntegration,
  /(Ant Design|AntD)[\s\S]*(non-AntD|Arco|shadcn)[\s\S]*(RecordBatchEditModal)[\s\S]*(do not mix|不得混用|禁止混入)/i,
  'package integration must branch by host UI library and use the generic modal without mixing AntD',
);
assert.match(
  packageIntegration,
  /MakeAppBatchEditComponents[\s\S]*(Modal)[\s\S]*(FieldSelect)[\s\S]*(ModeControl)/i,
  'generic batch modal must inject the required host design-system components',
);
assert.match(
  packageIntegration,
  /renderValueControl\s*\(\s*field\s*,\s*control\s*\)[\s\S]*(value)[\s\S]*(onChange)[\s\S]*(disabled)[\s\S]*(invalid)[\s\S]*(ariaDescribedBy)/i,
  'generic batch modal must document the controlled field-editor contract',
);
assert.doesNotMatch(
  `${skill}\n${packageIntegration}\n${batchEdit}\n${testing}`,
  /(missing|缺少)[^\n]*(batch[- ]modal|批量编辑弹窗)[^\n]*(blocker|阻断)|(?:non-AntD|Arco|shadcn)[\s\S]{0,300}(do not\s+expose|不得展示|不展示)[^\n]*(batch[- ]edit|批量编辑)/i,
  '0.3.1 generic modal must replace the obsolete non-AntD delivery blocker',
);

assert.match(
  permissionModel,
  /data\.record\.update[\s\S]*data\.record\.delete[\s\S]*data\.record\.bulkUpdate[\s\S]*(independent|独立|不可耦合)/i,
  'single edit, delete, and bulk edit permission keys must stay independent',
);
assert.match(
  permissionModel,
  /(principal)[\s\S]*(cache|缓存)[\s\S]*(初始化|initialization)[\s\S]*(身份|identity|租户|tenant|显式刷新|explicit refresh)/i,
  'principal permissions must use the bounded cache lifecycle',
);
assert.doesNotMatch(
  permissionModel,
  /(每次|every)[^\n]*(点击|click|提交|submit)[^\n]*(刷新|refetch|reload)[^\n]*principal/i,
  'permission guidance must not refetch principal for each action',
);
assert.match(
  permissionModel,
  /(暂无可用的操作|no available actions?)[\s\S]*(方案二|scheme two|selected|已选)/i,
  'no-action state must use scheme two',
);
assert.match(
  permissionModel,
  /(batchEditableFields\.length|可批量编辑字段)[\s\S]*(visible|可见|隐藏|hide)/i,
  'batch-edit action visibility must require at least one editable field',
);

assert.match(
  selectionFlow,
  /selectionIntent[\s\S]*include[\s\S]*exclude/i,
  'selection flow must preserve include/exclude intent',
);
assert.match(
  selectionFlow,
  /(Shift|手动|manual)[\s\S]*(include)[\s\S]*(表头|header)[\s\S]*(exclude)/i,
  'manual and Shift selection must differ from header select-all',
);
assert.match(
  selectionFlow,
  /selectedCount\s*===\s*totalCount[\s\S]*(不得|禁止|do not|must not)/i,
  'selection flow must forbid inferring select-all from counts',
);
assert.match(
  selectionFlow,
  /include[\s\S]*(200)[\s\S]*(excludedRecordIDList|排除)[\s\S]*(200)/i,
  'selection flow must document explicit and exclusion-list limits',
);
assert.match(
  selectionFlow,
  /(不可变|immutable)[^\n]*(快照|snapshot)[\s\S]*(预检|precheck)[\s\S]*(filter)[\s\S]*(groupFilter)[\s\S]*(同一|same|reuse|复用)/i,
  'selection flow must freeze and reuse one operation snapshot',
);
assert.match(
  selectionFlow,
  /(filter|筛选)[\s\S]*(sort|排序)[\s\S]*(group|分组)[\s\S]*(object|entity|对象)[\s\S]*(清空|clear)[^\n]*(选择|selection)/i,
  'query-context changes must clear selection',
);
assert.match(
  selectionFlow,
  /(group|分组)[\s\S]*(selection:change)[\s\S]*(once|一次|single|唯一)[\s\S]*(重复|duplicate|both|同时订阅)/i,
  'grouped tables must report each selection once without duplicate subscriptions',
);
assert.match(
  selectionFlow,
  /(?:(GroupTableComponent|分组表格)[\s\S]{0,120}(不支持|unsupported|does not support)[\s\S]{0,80}Shift|(GroupTableComponent|分组表格)[\s\S]{0,120}Shift[\s\S]{0,80}(不支持|unsupported|不得|do not))/i,
  'grouped tables must explicitly record that CanvasTable 1.3.0 does not support Shift ranges',
);
assert.match(
  selectionFlow,
  /(effectiveFilter|最终.*filter|有效.*filter)[\s\S]*(keyword|search|搜索)[\s\S]*(status|快捷筛选|quick filter|列表范围)[\s\S]*(precheck|预检)[\s\S]*(mutation|更新|写入)/i,
  'select-all must freeze one effective filter containing every membership condition',
);
assert.match(
  selectionFlow,
  /(CanvasTable|表格)[^\n]*(重建|recreat|replace)[\s\S]{0,700}(空选择快照|empty selection snapshot)/i,
  'CanvasTable recreation must publish an empty selection snapshot',
);
assert.match(
  selectionFlow,
  /(重建|recreat|replace)[\s\S]{0,520}(代次|generation|失效|invalidate)[\s\S]{0,520}(exactly one|一次)[^\n]*(空选择快照|empty selection snapshot)|(?:exactly one|一次)[^\n]*(空选择快照|empty selection snapshot)[\s\S]{0,520}(代次|generation|失效|invalidate)/i,
  'CanvasTable recreation must invalidate action work and emit the empty snapshot exactly once',
);
assert.match(
  selectionFlow,
  /(totalCount|总数)[^\n]*(增加|增长|grow|increase)[\s\S]{0,420}(public|公开)[^\n]*(selection|选择)[^\n]*(snapshot|快照)[\s\S]{0,300}(resolveCanvasSelectedRecordSnapshot|normalize|归一化)/i,
  'same-query total growth must re-normalize the current public selection snapshot',
);
assert.match(
  selectionFlow,
  /(totalCount|总数)[^\n]*(减少|收缩|shrink|decrease)[\s\S]{0,420}clearSelection\(\)[\s\S]{0,320}(一次|exactly one|sole|唯一)[^\n]*(selection:change|空选择快照|empty selection snapshot)/i,
  'same-query total shrink must clear through the public API with one canonical notification',
);
assert.match(
  canvasEditLifecycle,
  /(make-app-actions|操作选择|action-owned)[\s\S]{0,320}(重建|recreat|replace)[\s\S]{0,320}(不得|do not|must not)[^\n]*(恢复|reapply|restore|replay)[\s\S]{0,120}(选择|selection)/i,
  'Canvas recreation guidance must not restore action-owned selection',
);

assert.match(
  serviceContract,
  /POST\s+\/api\/make\/app\/entities\/:objectKey\/record-write-permission[\s\S]*\/data\/v1\/permission/i,
  'service contract must define the row-write precheck route and upstream',
);
assert.match(
  serviceContract,
  /(一次|one|single)[^\n]*(Make|upstream|上游)[^\n]*(预检|permission)[\s\S]*(不得|禁止|do not|must not)[^\n]*(逐条|per-record|per-ID|分片|split)/i,
  'precheck must use one complete upstream request without diagnostics',
);
assert.match(
  serviceContract,
  /403[\s\S]*(拒绝|denied)[\s\S]*(其他|other)[^\n]*(错误|error)[^\n]*(不得|不|must not)[^\n]*(权限拒绝|denial)/i,
  'service must distinguish permission denial from upstream failure',
);
assert.match(
  serviceContract,
  /(多记录|multiple|全选|select-all)[\s\S]*(unauthorizedRecordIDList)[\s\S]*(空|empty)[\s\S]*(不|no|without)[^\n]*(诊断|diagnostic)/i,
  'multi-record denial must not invent unauthorized IDs',
);
assert.match(
  serviceContract,
  /POST\s+\/api\/make\/app\/entities\/:objectKey\/records\/bulk[\s\S]*\/data\/v1\/field[\s\S]*(一次|one|single)[\s\S]*(不得|禁止|do not|must not)[^\n]*(单条|single-record|\/data\/v1\/record)/i,
  'Make batch edit must use one Service and one field API request',
);
assert.doesNotMatch(
  `${permissionModel}\n${serviceContract}`,
  /(highlight|标红)[^\n]*(complete|full|全部|完整)[^\n]*(explicit|selection|显式|选择)/i,
  'opaque backend denial must not mark the complete explicit selection as unauthorized',
);
assert.match(
  `${permissionModel}\n${serviceContract}`,
  /(without exact|没有准确|无法确定|不返回|opaque)[\s\S]{0,100}(unauthorized|无权限)[\s\S]{0,80}(ID|行)[\s\S]{0,200}(toast|提示)[\s\S]{0,160}(不标红|do not highlight|without row highlight)/i,
  'opaque backend denial must use toast-only feedback when exact row IDs are unavailable',
);

assert.match(
  batchEdit,
  /meta\.field\.update[\s\S]*resolveBatchEditableFields[\s\S]*(AntdRecordBatchEditModal)[\s\S]*(RecordBatchEditModal)/i,
  'batch modal fields must pass permission and package capability filtering',
);
assert.match(
  batchEdit,
  /AntdRecordBatchEditModal[\s\S]*renderValueControl\s*\(\s*field\s*,\s*(?:control|\{\s*disabled\s*\})\s*\)[\s\S]*(disabled)[\s\S]*RecordBatchEditModal[\s\S]*renderValueControl\s*\(\s*field\s*,\s*control\s*\)/i,
  'batch flow must document the 0.3.1 AntD disabled control and generic controlled-value signatures',
);
assert.match(
  batchEdit,
  /(Select|下拉)[\s\S]*(Input|输入)[\s\S]*(DatePicker|日期)[\s\S]*(User|人员)[\s\S]*(Department|部门)/i,
  'batch edit must use field-type controls',
);
assert.match(
  batchEdit,
  /resolveBatchEditClearValue[\s\S]*(自动化|automation)[\s\S]*(不得|不包含|must not|do not)/i,
  'batch modal must normalize clear values and omit automation controls',
);
assert.match(
  batchEdit,
  /(默认标题|default title)[^\n]*(批量编辑)[\s\S]{0,160}(不得|不要|must not|do not)[^\n]*(批量修改)/i,
  'batch modal must standardize the default title as 批量编辑',
);
assert.match(
  batchEdit,
  /(FieldSelect|Select|DatePicker|DateRangePicker)[\s\S]{0,420}(portal|getPopupContainer|挂载容器)[\s\S]{0,320}(overflow|裁剪|clipping)/i,
  'host batch field controls must portal overlays outside clipping containers',
);
assert.match(
  batchEdit,
  /(design system|组件库|framework)[\s\S]{0,240}(public|公开)[^\n]*(portal|overlay|popup|浮层|挂载)[\s\S]{0,320}(不得|do not|must not)[^\n]*(AntD|getPopupContainer)[^\n]*(通用|generic|统一)/i,
  'generic popup guidance must use each design system public API instead of imposing an AntD-shaped contract',
);

assert.match(
  testing,
  /(TDD|先.*失败|test first)[\s\S]*(include|显式)[\s\S]*(exclude|全选)[\s\S]*(stale|过期|旧响应)[\s\S]*(Service|服务)/i,
  'testing reference must cover TDD, selection modes, stale work, and Service calls',
);
assert.match(
  testing,
  /(fresh agent|新代理|新 Agent|前向测试)[\s\S]*(prompt|提示词|场景)[\s\S]*(全选|select-all)[\s\S]*(搜索|search)/i,
  'complex action skill must define reusable fresh-agent forward tests including select-all search',
);
assert.match(
  testing,
  /(下拉|dropdown|popup)[^\n]*(DOM|挂载)[\s\S]{0,220}(outside|外部|不在)[^\n]*(panel|面板|overflow|裁剪)[\s\S]{0,220}(视觉|browser|浏览器)/i,
  'batch modal tests must verify overlay DOM containment and browser visibility',
);
assert.match(
  testing,
  /(Arco)[\s\S]{0,220}(shadcn|Radix)[\s\S]{0,500}(focus|焦点)[\s\S]{0,220}(Escape)[\s\S]{0,220}(outside[- ]click|外部点击|点击外部)/i,
  'non-AntD popup tests must cover interaction semantics across Arco and shadcn/Radix',
);
assert.match(
  testing,
  /(重建|recreat)[\s\S]{0,280}(空选择快照|empty selection snapshot)[\s\S]{0,420}(totalCount|总数)[^\n]*(增加|增长|grow)[\s\S]{0,420}(totalCount|总数)[^\n]*(减少|收缩|shrink)[\s\S]{0,320}(一次|one|single|exactly one)[\s\S]{0,100}(通知|notification|selection:change)/i,
  'test matrix must cover recreation and both total-count transitions without duplicate notification',
);
for (const [dimension, relatedSkill] of [
  ['filter', filterSkill],
  ['sort', sortSkill],
]) {
  const relatedFrontmatter = relatedSkill.split('---')[1] ?? '';
  assert.match(
    relatedFrontmatter,
    /make-app-actions[^"\n]*(成功|success|applied)[^"\n]*(清空|clear|invalidate)[^"\n]*(选择|selection)/i,
    `${dimension} frontmatter must trigger the make-app-actions selection handoff`,
  );
  assert.match(
    relatedSkill,
    /make-app-actions[\s\S]{0,360}(成功应用|successfully applied|onApplied)[\s\S]{0,260}(清空|clear|invalidate)[^\n]*(选择|selection)[\s\S]{0,320}(草稿|draft)[\s\S]{0,160}(失败|failure|error)[^\n]*(?:(不得|不|do not|must not)[^\n]*(清空|clear|invalidate)|(preserve|保留)[^\n]*(选择|selection))/i,
    `${dimension} must clear action selection only after a successful apply`,
  );
}
assert.match(
  groupSkill,
  /make-app-actions[\s\S]{0,320}(applied|成功应用|确认应用)[\s\S]{0,220}(clear|清空|invalidate)[^\n]*(selection|选择)/i,
  'group skill must retain the same successful-apply action handoff',
);
assert.match(
  forwardTestRecord,
  /执行日期\s*[:：]\s*\d{4}-\d{2}-\d{2}[\s\S]*(独立|fresh)[^\n]*(Agent|代理)/i,
  'forward-test record must include the execution date and independent-agent method',
);
assert.match(
  forwardTestRecord,
  /fork_turns\s*[:=：]\s*`?["']?none["']?`?/i,
  'forward-test record must attest that agents received no parent conversation history',
);
assert.doesNotMatch(
  forwardTestRecord,
  /(你是|you are)[^\n]*(fresh-agent|测试代理|test agent)/i,
  'forward-test prompts must not tell agents that they are being evaluated',
);
for (const skillName of forwardTestScopeSkillNames) {
  assert.match(
    forwardTestRecord,
    new RegExp(`(?:^|\\n)[^\\n]*${skillName.replaceAll('-', '\\-')}[^\\n]*(?:$|\\n)`, 'i'),
    `forward-test record must declare related scope ${skillName}`,
  );
}
assert.doesNotMatch(
  forwardTestRecord,
  /(沿用|baseline|基线结果)/i,
  'current-scope forward tests must not reuse historical agent results',
);
assertForwardTestScope(forwardTestRecord, forwardTestScopeHash);
const executionIdPattern = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\/root\/forward_actions_[a-z0-9_]+)$/i;
const forwardScenarios = [
  {
    heading: '场景一：Ant Design 默认操作',
    evidencePatterns: [
      /AntdRecordSelectionActionBar/,
      /AntdRecordBatchEditModal/,
      /renderValueControl\s*\(\s*field\s*,[\s\S]{0,80}disabled/,
      /批量编辑/,
    ],
    requiredExecutionBatch: currentForwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  },
  {
    heading: '场景二：搜索条件下表头全选',
    evidencePatterns: [/(搜索|search)/i, /(表头全选|select-all)/i],
    requiredExecutionBatch: currentForwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  },
  {
    heading: '场景三：Arco 批量编辑',
    evidencePatterns: [
      /Arco/i,
      /RecordBatchEditModal/,
      /MakeAppBatchEditComponents/,
      /renderValueControl\(field, control\)/,
      /value[\s\S]*onChange[\s\S]*disabled[\s\S]*invalid[\s\S]*ariaDescribedBy/,
      /(portal|getPopupContainer|挂载)/i,
      /批量编辑/,
      /(focus|焦点)[\s\S]*(Escape)[\s\S]*(outside[- ]click|外部点击|点击外部)/i,
    ],
    requiredExecutionBatch: currentForwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  },
  {
    heading: '场景四：分组表选择和 Shift',
    evidencePatterns: [/(分组|grouped)/i, /Shift/i],
    requiredExecutionBatch: currentForwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  },
  {
    heading: '场景五：403 且没有无权限 ID',
    evidencePatterns: [/unauthorizedRecordIDList/, /(toast|提示)/i, /(不调用行标红|without row highlight)/i],
    requiredExecutionBatch: currentForwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  },
  {
    heading: '场景六：shadcn/Radix 批量编辑',
    evidencePatterns: [
      /(shadcn|Radix)/i,
      /@qfei-design\/make-app-actions@\^0\.3\.1/,
      /package\.json[\s\S]*package\.ai\.json/i,
      /RecordBatchEditModal/,
      /MakeAppBatchEditComponents/,
      /(Portal|container)/,
      /(focus|焦点)[\s\S]*(Escape)[\s\S]*(outside[- ]click|外部点击|点击外部)/i,
      /(不引入|不得|without)[^\n]*(AntD|Ant Design)/i,
    ],
    requiredExecutionBatch: currentForwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  },
  {
    heading: '场景七：查询交接与表格生命周期',
    evidencePatterns: [
      /(成功应用|successfully applied)/i,
      /(清空|clear|invalidate)[^\n]*(选择|selection)/i,
      /(草稿|draft)[^\n]*(失败|failure|error)[^\n]*(保留|preserve|不清空|do not clear)/i,
      /(重建|recreat|replace)/i,
      /(空选择快照|empty selection snapshot)/i,
      /(增加|增长|grow|increase)[\s\S]*(resolveCanvasSelectedRecordSnapshot|归一化|normalize)/i,
      /(减少|收缩|shrink|decrease)[\s\S]*clearSelection\(\)/i,
      /(一次|single|exactly one|唯一)[^\n]*(通知|notification|selection:change|空选择快照)/i,
    ],
    requiredExecutionBatch: currentForwardTestBatch,
    requiredExecutionIdPattern: executionIdPattern,
    requiredExecutionMethod: 'fresh-agent',
  },
];
for (const scenario of forwardScenarios) {
  assertScenarioPassed(forwardTestRecord, scenario);
}
assertUniqueScenarioExecutionIds(
  forwardTestRecord,
  forwardScenarios.map(({ heading }) => heading),
);

assert.match(
  readme,
  /\|[^\n]*(操作按钮|行操作|批量编辑|record actions?)[^\n]*\|\s*`make-app-actions`/i,
  'README route table must include make-app-actions',
);
assert.match(
  readme,
  /(对象列表页|record list)[^\n]*make-app-actions/i,
  'README common combinations must include make-app-actions for record lists',
);
assert.match(
  canvasSkill,
  /(Make)[^\n]*(record|记录)[^\n]*(默认|default)[^\n]*(make-app-actions)/i,
  'CanvasTable skill must hand default Make record actions to make-app-actions',
);
assert.match(
  permissionSkill,
  /data\.record\.update[\s\S]*data\.record\.delete[\s\S]*data\.record\.bulkUpdate[\s\S]*(独立|independent)[\s\S]*make-app-actions/i,
  'permission skill must preserve independent action permissions and hand off behavior',
);
assert.match(
  permissionSkill,
  /(单条|single)[^\n]*(编辑|edit)[^\n]*(可编辑字段|editable field|字段数量)[\s\S]{0,300}(批量|batch)[^\n]*(make-app-actions)/i,
  'permission skill must distinguish single-edit visibility from batch-edit field availability',
);
assert.match(
  serviceSkill,
  /record-write-permission[\s\S]*records\/bulk[\s\S]*make-app-actions/i,
  'service skill must expose action routes and hand behavior to make-app-actions',
);
assert.match(
  makeuiSkill,
  /(Make)[^\n]*(record|记录)[^\n]*(action|操作)[^\n]*(make-app-actions)/i,
  'makeui must hand Make record actions to make-app-actions',
);
assert.match(
  `${canvasCoreContract}\n${canvasRowHeadContract}`,
  /(writable|可写)[\s\S]{0,80}(Make)[\s\S]{0,80}(record|记录)[\s\S]{0,140}(selection|选择|selectable)[\s\S]{0,80}(default|默认)|(?:writable|可写)[\s\S]{0,80}(Make)[\s\S]{0,80}(record|记录)[\s\S]{0,140}(default|默认)[\s\S]{0,80}(selection|选择|selectable)/i,
  'CanvasTable references must enable selection by default for writable Make record lists',
);
assert.doesNotMatch(
  `${canvasCoreContract}\n${canvasRowHeadContract}`,
  /(Do not enable row selection by default for Make record lists|Row selection is not enabled by default)/i,
  'CanvasTable references must not retain the old opt-in selection rule for Make record lists',
);
assert.match(
  makeuiListLayout,
  /(make-app-actions)[\s\S]{0,180}(bottom|底部)[\s\S]{0,80}(center|居中)|(?:make-app-actions)[\s\S]{0,180}(center|居中)[\s\S]{0,80}(bottom|底部)/i,
  'makeui must place the standard selection action bar at the bottom center',
);
assert.doesNotMatch(
  `${makeuiListLayout}\n${makeuiComponentUsage}`,
  /(batch actions:[^\n]*above the table|row selection, only when requested)/i,
  'makeui must not retain old opt-in selection or above-table action placement',
);
assert.match(
  `${makeuiComponentUsage}\n${makeuiStyling}`,
  /(Select|DatePicker|Popover)[\s\S]{0,360}(portal|getPopupContainer|挂载)[\s\S]{0,360}(overflow:\s*(hidden|auto)|裁剪祖先|clipping ancestor)[\s\S]{0,360}(z-index|stacking context|层叠上下文)/i,
  'makeui must define the overlay portal and stacking contract for clipped containers',
);
assert.match(
  makeuiDrawerLayout,
  /(?:(make-app-actions|selection bar|选择操作栏)[\s\S]{0,160}(detail|详情)[\s\S]{0,120}(remove|移除|不展示|does not|do not)[\s\S]{0,80}(edit|编辑)[\s\S]{0,80}(delete|删除)|(make-app-actions|selection bar|选择操作栏)[\s\S]{0,160}(detail|详情)[\s\S]{0,120}(edit|编辑)[\s\S]{0,80}(delete|删除)[\s\S]{0,100}(remove|移除|不展示|does not|do not))/i,
  'makeui must remove detail edit/delete when the selection bar owns record actions',
);
assert.match(
  openai,
  /default_prompt:[^\n]*\$make-app-actions/i,
  'openai metadata must provide a skill invocation prompt',
);

console.log('make-app-actions skill contract passed');
