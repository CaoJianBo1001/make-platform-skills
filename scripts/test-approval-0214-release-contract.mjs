import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../skills/make-app-approval/${path}`, import.meta.url), 'utf8');

test('0.2.17 is the verified package baseline while 0.2.13/0.2.14 remain documented history', () => {
  const skill = read('SKILL.md');
  const version = skill.match(/version: (\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number);
  assert.ok(version && (version[0] > 0 || version[1] > 2 || (version[1] === 2 && version[2] >= 46)));
  const list = read('references/package-and-list.md');
  assert.match(list, /本文基于已核对的 `@qfei-design\/make-app-approval@0\.2\.17`/);
  assert.match(list, /0\.2\.13[^\n]*0\.2\.14[^\n]*(?:运行代码|dist)[^\n]*一致/);
  assert.match(list, /URL[^\n]*(?:指导|文档)/);
  assert.match(read('references/initiated-instances.md'), /正式 npm `@qfei-design\/make-app-approval@0\.2\.16`/);
});

test('publishing 0.2.17 does not remove the ordinary-record terminal fallback or task readonly policy', () => {
  const status = read('references/status-display.md');
  assert.match(status, /0\.2\.17[^\n]*REJECTED[^\n]*CANCELLED[^\n]*null/);
  assert.match(status, /--compat/);
  assert.doesNotMatch(status, /不声明任何新版已发布/);
  assert.match(status, /入口.*保存|入口\/保存/);
  assert.match(read('references/task-detail.md'), /0\.2\.17[^\n]*readApprovalTaskDetail[^\n]*不保留[^\n]*taskStatus/);
  assert.match(read('references/verification.md'), /0\.2\.17[^\n]*原生[^\n]*缺口/);
  assert.match(read('assets/record-write-policy.mjs'), /getPackageRestriction\(record, options\)/);
});

test('released theme guidance distinguishes the public provider from old-package compatibility', () => {
  const list = read('references/package-and-list.md');
  assert.match(list, /0\.2\.17[^\n]*正式提供[^\n]*MAKE_APPROVAL_THEME_CONTRACT[^\n]*MakeApprovalThemeProvider/);
  assert.match(list, /useMakeApprovalThemeStyle\(presentation\?\)/);
  assert.match(list, /无主题或空主题保留旧默认/);
  assert.match(list, /0\.2\.16 没有新 Provider/);
  assert.match(list, /themeKey[^\n]*(?:仅|只)[^\n]*Canvas/);
  assert.match(list, /手机只允许[^\n]*五项品牌色[^\n]*原移动控件[^\n]*字号/);
  assert.match(read('references/mobile.md'), /主题能力与边界/);
});

test('the current baseline retains peer, presentation, explicit host adapters and independent package verification', () => {
  const list = read('references/package-and-list.md');
  assert.match(list, /CanvasTable.*1\.3\.2/);
  assert.match(list, /Input[\s\S]*Select[\s\S]*DateRangePicker[\s\S]*Button[\s\S]*Tabs/);
  assert.match(list, /ApprovalTaskDetail presentation="mobile"/);
  assert.match(read('references/verification.md'), /UI\/Service.*实际安装|UI.*Service.*实际安装/);
  assert.match(read('references/mobile.md'), /审批包和 make-app-mobile 的能力分别核验/);
});


test('published mobile 0.1.16 preserves installed single-row overflow guidance and the 0.1.14 capability floor', () => {
  const initiation = read('references/initiation-contract.md');
  const mobile = read('references/mobile.md');
  const verification = read('references/verification.md');
  assert.match(initiation, /正式移动包 0\.1\.16[^\n]*MobileFormActionBar actions[^\n]*单行与更多操作/);
  assert.match(mobile, /0\.1\.16[^\n]*不需要升级审批 npm 包/);
  assert.match(mobile, /0\.1\.14[^\n]*(?:能力下限|起提供)/);
  assert.match(verification, /0\.1\.16[^\n]*全部授权意图均可达/);
  assert.match(verification, /用实际页面、控制器及已安装移动包验证“更多”/);
  assert.match(verification, /任务菜单的 RETURN[^\n]*空 recordPatch/);
  assert.doesNotMatch(verification, /四种保存意图组合与仅支持单动作的移动组件/);
});
