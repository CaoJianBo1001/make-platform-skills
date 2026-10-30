import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const audit = fileURLToPath(new URL('./audit-error-outlets.mjs', import.meta.url));
const host = path.resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
const dependencyEntry = process.env.MAKE_FEEDBACK_TEST_DEPENDENCIES
  ? path.join(process.env.MAKE_FEEDBACK_TEST_DEPENDENCIES, '__error_outlet_test__.cjs')
  : path.join(host, 'ui/package.json');
const tsDirectory = path.dirname(createRequire(dependencyEntry).resolve('typescript'));
const temp = mkdtempSync(path.join(tmpdir(), 'make-error-outlet-audit-'));
after(() => rmSync(temp, { recursive: true, force: true }));
const write = (root, file, text) => {
  const target = path.join(root, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, text);
};
let id = 0;
const run = (files) => {
  const root = path.join(temp, String(++id));
  write(root, 'apps/ui/package.json', '{}');
  mkdirSync(path.join(root, 'apps/ui/node_modules'), { recursive: true });
  symlinkSync(path.dirname(tsDirectory), path.join(root, 'apps/ui/node_modules/typescript'));
  write(root, 'apps/ui/src/outlet.tsx', `import {MakeAppErrorNotice,MakeAppErrorNoticeViewport} from '@qfei-design/make-app-observability/react';
    export const Outlet=()=> <MakeAppErrorNoticeViewport><MakeAppErrorNotice title="失败" /></MakeAppErrorNoticeViewport>;`);
  for (const [file, text] of Object.entries(files)) write(root, `apps/ui/src/${file}`, text);
  const result = spawnSync(process.execPath, [audit, root], { encoding: 'utf8' });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
};
const imports = `import {MakeAppErrorNotice as Card} from '@qfei-design/make-app-observability/react';`;
test('保留唯一全局出口、明确常驻内嵌卡和本地字符串提示', () => {
  const result = run({ 'form.tsx': `${imports} export const Form=()=> <Card duration={0} title="失败"/>;`,
    'local.ts': `const [hint] = useMessage(); hint.error('请先选择记录'); hint.success('已保存');` });
  assert.equal(result.code, 0, result.output); assert.match(result.output, /status: PASS/);
});
test('已有全局出口仍阻断旧容器内的独立计时错误卡', () => {
  const result = run({ 'legacy.tsx': `${imports} export const legacy=()=>message.error(close=><Card duration={3} onClose={close}/>);` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_legacy_card/);
});
test('独立错误卡默认常驻也不能作为另一个 Toast 出口', () => {
  const result = run({ 'legacy.tsx': `${imports} export const legacy=()=> <Card title="失败"/>;` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_legacy_card/);
});
test('同文件放入 viewport 不能掩盖另一个旧 Toast 工厂', () => {
  const result = run({ 'outlet.tsx': `import {MakeAppErrorNotice as Card,MakeAppErrorNoticeViewport as Viewport} from '@qfei-design/make-app-observability/react';
    const Outlet=()=> <Viewport><Card title="失败"/></Viewport>;
    const legacy=()=>message.error(close=><Card duration={3} onClose={close}/>);` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_legacy_card/);
});
test('识别命名空间导入和 createElement，阻断另一个 viewport', () => {
  const result = run({ 'second.tsx': `import * as Notices from '@qfei-design/make-app-observability/react';
    const second=React.createElement(Notices.MakeAppErrorNoticeViewport,null);` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_multiple_viewports/);
});
test('catch 中将请求异常降级到字符串 Toast 会阻断', () => {
  const result = run({ 'delete.ts': `const [hint]=useMessage(); async function remove(){try{await request()}catch(failure){hint.error(readErrorMessage(failure,'删除失败'));}}` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_string_toast/);
});
test('catch 中间变量不能绕过请求错误降级检查', () => {
  const result = run({ 'save.ts': `async function save(){try{await request()}catch(error){const text=error.message; messageApi.error(text);}}` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_string_toast/);
});
test('JSON 本地解析失败保留原校验提示，不判为请求异常', () => {
  const result = run({ 'local.ts': `const [hint]=useMessage(); function validate(input){try{JSON.parse(input)}catch(error){hint.error(error.message)}}` });
  assert.equal(result.code, 0, result.output);
});
test('自定义本地校验可以通过有理由的限定声明保持原提示', () => {
  const result = run({ 'local.ts': `const [hint]=useMessage(); async function validate(){try{await form.validateFields()}catch(error){
    // make-error-outlet-local-validation: 仅校验当前表单字段，不执行网络请求
    hint.error(error.message);
  }}` });
  assert.equal(result.code, 0, result.output);
});
test('未知异常来源要求人工确认，不直接宣称是请求错误', () => {
  const result = run({ 'unknown.ts': `function validate(){try{validateInput()}catch(error){messageApi.error(error.message)}}` });
  assert.equal(result.code, 1); assert.match(result.output, /exception_toast_origin_unverified/);
});
test('本地校验声明必须带理由，空声明不放行未知来源', () => {
  const result = run({ 'local.ts': `function validate(){try{validateInput()}catch(error){
    // make-error-outlet-local-validation:
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 1); assert.match(result.output, /exception_toast_origin_unverified/);
});
test('被局部变量覆盖的 JSON 不是可直接确认的纯本地解析', () => {
  const result = run({ 'local.ts': `const JSON={parse:serverValidate};function validate(){try{JSON.parse(input)}catch(error){messageApi.error(error.message)}}` });
  assert.equal(result.code, 1); assert.match(result.output, /exception_toast_origin_unverified/);
});
test('带自定义回调的 JSON 解析不自动视为纯本地校验', () => {
  const result = run({ 'local.ts': `function validate(){try{JSON.parse(input,reviver)}catch(error){messageApi.error(error.message)}}` });
  assert.equal(result.code, 1); assert.match(result.output, /exception_toast_origin_unverified/);
});
test('网络导入别名不能通过本地校验声明豁免', () => {
  const result = run({ 'remote.ts': `import {request as send} from './service-api/request';async function save(){try{await send()}catch(error){
    // make-error-outlet-local-validation: 表单字段校验
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_string_toast/);
});
test('本地校验声明不能豁免已识别的网络请求失败', () => {
  const result = run({ 'remote.ts': `async function save(){try{await request()}catch(error){
    // make-error-outlet-local-validation: 表单字段校验
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_string_toast/);
});
test('混合本地解析和网络请求时仍拦截异常降级', () => {
  const result = run({ 'remote.ts': `async function save(){try{JSON.parse(input);await fetch('/api/save')}catch(error){messageApi.error(error.message)}}` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_string_toast/);
});
test('对象属性名 error 不等于捕获的异常变量', () => {
  const result = run({ 'local.ts': `const [hint]=useMessage();async function save(){const result={error:'请输入整数'};try{await request()}catch(error){hint.error(result.error)}}` });
  assert.equal(result.code, 0, result.output);
});
test('嵌套函数中同名参数不应污染外层异常绑定', () => {
  const result = run({ 'local.ts': `async function save(){try{await request()}catch(error){const notify=(error)=>messageApi.error(error.message);notify({message:'请输入整数'})}}` });
  assert.equal(result.code, 0, result.output);
});
test('不把日志、本地提示、注释、字符串和测试文件当成请求错误出口', () => {
  const result = run({ 'safe.ts': `try{request()}catch(error){console.error('request failed',error);messageApi.error('请重新选择记录');}
    const example='<MakeAppErrorNoticeViewport/><MakeAppErrorNotice/>'; // messageApi.error(error)
    /* <MakeAppErrorNotice/> */`, 'legacy.test.tsx': `${imports} const Test=()=> <Card/>;` });
  assert.equal(result.code, 0, result.output);
});
test('全局 Toast 与局部权限提示只允许各自合法的呈现方式', () => {
  const result = run({ 'denied.tsx': `import {MakeAppPermissionNotice} from '@qfei-design/make-app-observability/react';
    const Denied=()=> <MakeAppPermissionNotice variant="toast"/>;` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_legacy_permission_toast/);
});
test('宿主权限适配器的旧 Toast 同样不能绕过统一出口', () => {
  const result = run({ 'denied.tsx': `import {AppPermissionFeedback} from './permission-feedback';
    const Denied=()=> <AppPermissionFeedback variant="toast"/>;` });
  assert.equal(result.code, 1); assert.match(result.output, /request_error_legacy_permission_toast/);
});
test('页面权限提示常驻合法，不应被错误迁移为 Toast', () => {
  const result = run({ 'denied.tsx': `import {MakeAppPermissionNotice} from '@qfei-design/make-app-observability/react';
    const Denied=()=> <MakeAppPermissionNotice variant="inline"/>;` });
  assert.equal(result.code, 0, result.output);
});
test('含中文和空格的安装路径可以运行自测（默认解析及 CI 依赖入口）', () => {
  const root = path.join(temp, '中文 checkout');
  const scripts = path.join(root, 'scripts'); mkdirSync(scripts, { recursive: true });
  // 使用正确的文件系统路径复制；待测脚本自身仍须正确转换其 import.meta.url。
  copyFileSync(new URL(import.meta.url), path.join(scripts, 'test-audit-error-outlets.mjs'));
  copyFileSync(new URL('./audit-error-outlets.mjs', import.meta.url), path.join(scripts, 'audit-error-outlets.mjs'));
  write(root, 'ui/package.json', '{}'); mkdirSync(path.join(root, 'ui/node_modules'), { recursive: true });
  symlinkSync(path.dirname(tsDirectory), path.join(root, 'ui/node_modules/typescript'));
  for (const ci of [false, true]) {
    const env = { ...process.env }; delete env.MAKE_FEEDBACK_TEST_DEPENDENCIES;
    delete env.NODE_TEST_CONTEXT;
    if (ci) env.MAKE_FEEDBACK_TEST_DEPENDENCIES = path.join(root, 'ui/node_modules');
    const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=保留唯一全局出口', path.join(scripts, 'test-audit-error-outlets.mjs')], { encoding: 'utf8', env });
    assert.equal(result.status, 0, `${ci ? 'CI' : '默认'} 路径解析失败\n${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /# pass 1\b/, '子进程必须实际执行路径回归，不能全部跳过');
  }
});
