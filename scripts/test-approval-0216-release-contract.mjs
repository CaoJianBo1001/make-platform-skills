import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const presentation = () => read('skills/make-app-approval/references/list-presentation.md');

test('approval standard list integration pins the current verified formal package versions', () => {
  const guide = presentation();
  assert.match(guide, /@qfei-design\/make-app-approval@0\.2\.17/);
  assert.match(guide, /@qfei-design\/make-app-mobile@0\.1\.16/);
  assert.match(guide, /正式[^\n]*(?:接入|产物|发布)/);
  assert.doesNotMatch(guide, /未发布候选|候选合同|申请人跨端回显（候选）/);
});

test('new standard integration opts into spacing while preserving the existing host default', () => {
  const guide = presentation();
  assert.match(guide, /新接入[^\n]*spacing="standard"/);
  assert.match(guide, /(?:默认[^\n]*host|host[^\n]*默认)/);
  assert.match(guide, /既有 App[^\n]*保留锁定依赖/);
  assert.match(guide, /MyApprovalsPage[^\n]*12px/);
});

test('the two-package gate applies to mobile composition while explicit PC-only delivery stays independent', () => {
  const guide = presentation();
  assert.match(guide, /仅交付 PC[^\n]*用户[^\n]*明确[^\n]*审批包[^\n]*Canvas[^\n]*不要求[^\n]*移动包/);
  assert.match(guide, /使用 `\/mobile` 工厂[^\n]*手机标准组合[^\n]*两份[^\n]*核验/);
  assert.match(guide, /默认[^\n]*双端[^\n]*makeui/);
  assert.doesNotMatch(guide, /显式使用 `spacing="standard"` 并安装上述正式版本/);
});

test('the guide uses released public mobile composition without inventing package APIs', () => {
  const guide = presentation();
  for (const name of ['createMobileApprovalComponents', 'MobileFilterTrigger', 'MobileDateRangeField', 'MobileSearchPickerSheet', 'ApprovalMobileToolkit']) assert.ok(guide.includes(name), name);
  assert.match(guide, /\/mobile/);
  assert.match(guide, /\/primitives/);
  assert.match(guide, /\/pickers/);
  assert.match(guide, /variant="filter"/);
  assert.match(guide, /variant="field"/);
  assert.match(guide, /不能|不靠/);
});

test('released applicant labels remain scope-bound and never become query DTO fields', () => {
  const guide = presentation();
  assert.match(guide, /### 申请人跨端回显\n/);
  assert.match(guide, /selectedOption\?:/);
  assert.match(guide, /onChange\(value: string, selectedOption\?: ApprovalSelectOption\)/);
  assert.match(guide, /scopeKey/);
  assert.match(guide, /不放进列表查询 DTO 或 Service 请求/);
  assert.match(guide, /手机 → 桌面 → 手机/);
});

test('stale candidate metadata cannot override verified registry exports and artifacts', () => {
  const guide = presentation();
  assert.match(guide, /(?:capabilities\.json|package\.ai\.json)/);
  assert.match(guide, /registry/);
  assert.match(guide, /integrity|SHA512/);
  assert.match(guide, /旧文案|遗留/);
  assert.match(guide, /exports/);
  assert.match(guide, /真实后端[^\n]*Android/);
});

test('new desktop and mobile standard modes retain empty-table and geometry boundaries', () => {
  const guide = presentation();
  assert.match(guide, /查询成功为空[^\n]*四列表头/);
  assert.match(guide, /12px/);
  assert.match(guide, /16px/);
  assert.match(guide, /28px/);
  assert.match(guide, /44px/);
  assert.match(guide, /不是审批 npm API/);
  assert.match(guide, /remaining/);
  assert.match(guide, /任务[^\n]*四列[^\n]*已发起[^\n]*五列/);
  assert.match(guide, /不能写成任意新 App 已符合本合同/);
});

test('the entrypoint and copied adapter document the current native terminal gap', () => {
  assert.match(read('skills/make-app-approval/SKILL.md'), /公共包 0\.2\.17[^\n]*尚未原生覆盖[^\n]*已拒绝[^\n]*已撤回/);
  assert.match(read('skills/make-app-approval/assets/record-write-policy.mjs'), /已核验 0\.2\.17[^\n]*0\.2\.13[^\n]*0\.2\.14/);
});
