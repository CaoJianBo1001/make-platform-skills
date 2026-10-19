#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 验证分发后的可发现性、引用闭包与关键合同；业务行为由宿主按场景矩阵验证。
const repoRoot = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const entry = 'skills/make-app-approval/SKILL.md';
const read = (file) => {
  assert.ok(fs.existsSync(path.join(repoRoot, file)), `缺少文件：${file}`);
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
};
const localLinks = (file) => [...read(file).matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)]
  .map((match) => match[1].split('#')[0])
  .filter((target) => target && !/^[a-z]+:/i.test(target))
  .map((target) => path.relative(repoRoot, path.resolve(repoRoot, path.dirname(file), target)));

const entryLinks = localLinks(entry);
const resources = fs.readdirSync(path.join(repoRoot, 'skills/make-app-approval/references'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => `skills/make-app-approval/references/${name}`);
assert.ok(resources.length > 0, '审批 skill 必须提供可读取的专项合同');
for (const file of resources) {
  assert.ok(entryLinks.includes(file), `入口无法发现参考文件：${file}`);
}
for (const file of [entry, ...resources]) {
  for (const target of localLinks(file)) read(target);
}

for (const file of [
  'README.md',
  'skills/makeui/SKILL.md',
  'skills/make-app-permission/SKILL.md',
  'skills/make-app-service/SKILL.md',
  'skills/make-app-actions/SKILL.md',
  'skills/makedsl/SKILL.md',
  'skills/makeui/references/mobile-form-controls.md',
  'skills/makeui/references/mobile-defaults.md',
  'skills/makeui/references/mobile-visual-standard.md',
  'skills/make-app-permission/references/testing-and-audit.md',
]) {
  assert.ok(localLinks(file).includes(entry), `${file} 未路由到审批 skill`);
}

const initiation = read('skills/make-app-approval/references/initiation-contract.md');
const verification = read('skills/make-app-approval/references/verification.md');
const serviceContracts = read('skills/make-app-service/references/service-api-contracts.md');
const serviceTesting = read('skills/make-app-service/references/testing-and-safety.md');
const makeuiSkill = read('skills/makeui/SKILL.md');
const permissionSkill = read('skills/make-app-permission/SKILL.md');
const permissionRuntime = read('skills/make-app-permission/references/ui-permission-runtime.md');
const serviceAdapter = read('skills/make-app-service/references/make-data-adapter.md');
const mobileCardActions = read('skills/make-app-actions/references/mobile-card-actions.md');
const componentUsage = read('skills/makeui/references/component-usage.md');

assert.match(mobileCardActions, /`data\.record\.create`[^\n]*不能因普通 `createFields` 为空隐藏入口/,
  '手机新建入口不能因普通字段集为空而隐藏审批新建');
assert.match(componentUsage, /普通新建[^\n]*`createFields`[^\n]*审批新建[^\n]*启动配置/,
  '组件字段交接须区分普通与审批新建');
assert.match(componentUsage, /审批新建不得因普通 `createFields` 为空[^\n]*禁用提交/,
  '审批表单不能使用普通新建的空字段规则禁用提交');

assert.match(makeuiSkill, /13\.[^\n]*普通新建[^\n]*审批新建[^\n]*启动配置/,
  'MakeUI 表单字段交接须在主工作顺序中区分普通和审批新建');
assert.match(makeuiSkill, /Create and edit forms[^\n]*普通新建[^\n]*审批新建[^\n]*启动配置/,
  'MakeUI 强规则不得将普通 createFields 套入审批表单');
assert.match(permissionSkill, /Gate the create entry[^\n]*普通新建[^\n]*审批新建[^\n]*启动配置/,
  '权限操作门禁须与审批字段授权例外在同一规则中说明');
assert.match(permissionRuntime, /Service must reject any client-provided raw[^\n]*普通新建[^\n]*`createFields`[^\n]*审批新建[^\n]*启动配置/,
  'Lookup 关系写入应按普通或审批模式选择源字段白名单');
assert.match(permissionRuntime, /Resolve a Lookup source definition[^\n]*普通新建[^\n]*visible `fields`[^\n]*`createFields`[^\n]*审批新建[^\n]*启动配置/,
  'Lookup 元数据来源也须先按普通或审批模式区分');
assert.match(serviceContracts, /For relation-backed `Make\.Field\.Lookup` during create[^\n]*普通新建[^\n]*`createFields`[^\n]*审批新建[^\n]*启动配置/,
  'Service 关系路由不得统一以普通 createFields 裁掉审批字段');
assert.match(serviceAdapter, /In create mode[^\n]*普通新建[^\n]*`createFields`[^\n]*审批新建[^\n]*启动配置/,
  'Lookup 候选源字段必须按新建模式解析');

assert.match(initiation, /"type": "Make\.Field\.Number"/,
  '实际启动字段样例应保留 Make.Field.Number 类型');
assert.match(initiation, /"makeFieldType": "NUMBER"/,
  '实际启动字段样例应保留并列的 Workflow 类型枚举');
assert.match(initiation, /已识别的 `Make\.Field\.\*`[^\n]*宿主标准类型[^\n]*`makeFieldType`[^\n]*一致性/,
  '当前端点两个类型标识并存时须写明归一化顺序');
assert.match(initiation, /"precision": 1/,
  '实际启动字段样例应保留数字精度元数据');
assert.match(initiation, /`data\.fields`[^\n]*`fields`[^\n]*Service[^\n]*响应合同/,
  '启动配置示例的包装层不得被误当作固定协议');
assert.match(initiation, /`selection\.fieldSelections`[^\n]*`properties\.options`/,
  '选项字段应保留原始与规范化的选项信息');
assert.match(initiation, /其他版本出现数字 `type`[^\n]*接口合同/,
  '数字 type 只能作为其他版本的条件性兼容分支');
assert.match(initiation, /发起前检查[^\n]*尚未发送[^\n]*重试[^\n]*recordID/,
  '发起请求前失败应保留已保存 ID 并允许重新检查');
assert.match(initiation, /HTTP[^\n]*业务错误码[^\n]*明确拒绝[^\n]*结果未知/,
  '审批结果分类必须同时依据 HTTP 与业务错误码及已确认协议');
assert.match(initiation, /明确拒绝[^\n]*副作用[^\n]*重试资格/,
  '明确失败不得被误认为无副作用或可直接重试');
assert.match(serviceContracts, /显式刷新成功[^\n]*普通读取[^\n]*新 Schema/,
  '显式刷新成功后普通读取应取得新 Schema');
assert.match(serviceContracts, /旧请求[^\n]*失败[^\n]*不能[^\n]*删除[^\n]*新缓存/,
  '旧请求失败不得删除新一代 Schema 缓存');
assert.match(serviceContracts, /共享[^\n]*进行中[^\n]*取消[^\n]*其他[^\n]*有效请求/,
  '共享进行中请求不能让单个调用方取消影响其他调用方');
assert.match(verification, /预检查失败[^\n]*发起请求数[^\n]*0/,
  '验证矩阵须覆盖预检查失败时未发起');
assert.match(verification, /请求解析[^\n]*缓存[^\n]*Service 边界/,
  '审批错误分类测试须覆盖实际请求解析、缓存与 Service 边界');
assert.match(serviceTesting, /刷新成功[^\n]*普通读取[^\n]*新 Schema/,
  'Service 测试须覆盖刷新后的普通读取');
assert.match(serviceTesting, /取消一个调用方[^\n]*其他[^\n]*正常完成/,
  'Service 测试须覆盖共享请求的独立取消');
console.log('审批 skill 可发现性与引用闭包检查通过');
