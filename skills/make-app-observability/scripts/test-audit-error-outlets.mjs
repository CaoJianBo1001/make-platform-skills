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
const run = (files, options = {}) => {
  const { withoutSatisfiesApi = false, ...spawnOptions } = options;
  const root = path.join(temp, String(++id));
  write(root, 'apps/ui/package.json', '{}');
  mkdirSync(path.join(root, 'apps/ui/node_modules'), { recursive: true });
  if (withoutSatisfiesApi) {
    write(root, 'apps/ui/node_modules/typescript/index.js',
      `module.exports = { ...require(${JSON.stringify(path.dirname(tsDirectory))}), isSatisfiesExpression: undefined };`);
  } else {
    symlinkSync(path.dirname(tsDirectory), path.join(root, 'apps/ui/node_modules/typescript'));
  }
  write(root, 'apps/ui/src/outlet.tsx', `import {MakeAppErrorNotice,MakeAppErrorNoticeViewport} from '@qfei-design/make-app-observability/react';
    export const Outlet=()=> <MakeAppErrorNoticeViewport><MakeAppErrorNotice title="失败" /></MakeAppErrorNoticeViewport>;`);
  for (const [file, text] of Object.entries(files)) write(root, `apps/ui/src/${file}`, text);
  const result = spawnSync(process.execPath, [audit, root], { encoding: 'utf8', ...spawnOptions });
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
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=保留唯一全局出口', path.join(scripts, 'test-audit-error-outlets.mjs')], { encoding: 'utf8', env });
    assert.equal(result.status, 0, `${ci ? 'CI' : '默认'} 路径解析失败\n${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /# pass 1\b/, '子进程必须实际执行路径回归，不能全部跳过');
  }
});

for (const rethrow of ['throw inner', 'throw new Error("请求失败", {cause: inner})']) {
  test(`嵌套请求异常重抛不能被外层本地校验声明豁免：${rethrow}`, () => {
    const result = run({ 'nested.ts': `async function save(){try{try{await fetch('/api/save')}catch(inner){${rethrow}}}catch(error){
      // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /request_error_string_toast/);
  });
}
for (const name of ['fetch', 'request', 'requestJson']) {
  test(`同名本地函数 ${name} 不冒充请求来源`, () => {
    const result = run({ 'local.ts': `function ${name}(input){return JSON.parse(input)}function validate(){try{${name}(input)}catch(error){
      // make-error-outlet-local-validation: 仅解析当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 0, result.output);
  });
}
test('同名本地函数来源未获确认时仍需核查', () => {
  const result = run({ 'local.ts': `function fetch(input){return JSON.parse(input)}function validate(){try{fetch(input)}catch(error){messageApi.error(error.message)}}` });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /exception_toast_origin_unverified/);
});
test('本地请求包装函数不能利用声明绕过真实 fetch', () => {
  const result = run({ 'remote.ts': `const request=()=>fetch('/api/save');async function save(){try{await request()}catch(error){
    // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /request_error_string_toast/);
});
test('内部已完整处理的请求异常不污染后续本地校验', () => {
  const result = run({ 'local.ts': `async function validate(){try{try{await fetch('/api/save')}catch(inner){console.error(inner)}JSON.parse(input)}catch(error){
    // make-error-outlet-local-validation: 请求异常已在内部处理，这里仅校验当前字段
    messageApi.error(error.message)}}` });
  assert.equal(result.code, 0, result.output);
});
test('重抛又在内部被捕获时，不将已消化请求传播给外层', () => {
  const result = run({ 'local.ts': `async function validate(){try{try{await fetch('/api/save')}catch(inner){try{throw inner}catch(handled){console.error(handled)}}JSON.parse(input)}catch(error){
    // make-error-outlet-local-validation: 内部已处理请求，这里仅解析当前字段
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 0, result.output);
});
test('本地请求包装函数经别名调用也不能被声明豁免', () => {
  const result = run({ 'remote.ts': `function send(){return fetch('/api/save')}const request=send;async function save(){try{await request()}catch(error){
    // make-error-outlet-local-validation: 仅校验当前表单字段
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /request_error_string_toast/);
});

for (const member of ["request:()=>fetch('/api/save')", "async request(){return await fetch('/api/save')}", 'request:send']) {
  test(`对象成员请求包装保持来源：${member}`, () => {
    const result = run({ 'remote.ts': `const send=()=>fetch('/api/save');const api={${member}};async function save(){try{await api.request()}catch(error){
      // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /request_error_string_toast/);
  });
}
for (const body of [
  "try{await fetch('/api/save')}catch(inner){console.error(inner)}JSON.parse(input)",
  "try{try{await fetch('/api/save')}catch(inner){throw inner}}catch(handled){console.error(handled)}JSON.parse(input)",
]) {
  test(`包装函数内已处理的请求不污染外层校验：${body}`, () => {
    const result = run({ 'local.ts': `async function request(){${body}}async function save(){try{await request()}catch(error){
      // make-error-outlet-local-validation: 请求异常已内部处理，这里仅校验字段
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 0, result.output);
  });
}
test('对象内纯本地校验支持限定声明', () => {
  const result = run({ 'local.ts': `const api={request:(input)=>JSON.parse(input)};function validate(){try{api.request(input)}catch(error){
    // make-error-outlet-local-validation: 仅解析当前字段，不执行网络请求
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 0, result.output);
});
test('包装函数捕获后重抛仍保留请求来源', () => {
  const result = run({ 'remote.ts': `async function request(){try{await fetch('/api/save')}catch(error){throw new Error('请求失败',{cause:error})}}async function save(){try{await request()}catch(error){
    // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /request_error_string_toast/);
});
for (const asyncPrefix of ['', 'async ']) {
  test(`try 内直接返回请求 Promise 不能冒充已捕获异常：${asyncPrefix || '同步包装'}`, () => {
    const result = run({ 'remote.ts': `${asyncPrefix}function request(){try{return fetch('/api/save')}catch(error){console.error(error)}}async function save(){try{await request()}catch(error){
      // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /request_error_string_toast/);
  });
}

for (const binding of [
  "const request=()=>fetch('/api/save');const api={request};",
  "const request=(()=>fetch('/api/save'));const api={request};",
  "const api={request:(()=>fetch('/api/save'))};",
  "const request=(()=>fetch('/api/save'));const api={request:(request)};",
]) {
  test(`简写或括号请求包装不能被本地声明豁免：${binding}`, () => {
    const result = run({ 'remote.ts': `${binding}async function save(){try{await api.request()}catch(error){
      // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /request_error_string_toast/);
  });
}
test('直接调用带括号的请求包装仍保留来源', () => {
  const result = run({ 'remote.ts': `const request=(()=>fetch('/api/save'));async function save(){try{await (request)()}catch(error){
    // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /request_error_string_toast/);
});
for (const declaration of ['const request=((input)=>JSON.parse(input));const api={request};', 'const api={request:((input)=>JSON.parse(input))};']) {
  test(`同类本地解析包装保留限定声明：${declaration}`, () => {
    const result = run({ 'local.ts': `${declaration}function validate(){try{api.request(input)}catch(error){
      // make-error-outlet-local-validation: 仅解析当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 0, result.output);
  });
}

for (const expression of ['fetch as typeof fetch', '<typeof fetch>fetch', 'fetch!', 'fetch satisfies typeof fetch', '((fetch as typeof fetch)!)']) {
  test(`类型包装不改变真实请求来源：${expression}`, () => {
    const result = run({ 'remote.ts': `const request=(${expression});async function save(){try{await request('/api/save')}catch(error){
      // make-error-outlet-local-validation: 仅校验当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /request_error_string_toast/);
  });
}
test('类型包装的纯本地函数仍可用限定声明', () => {
  const result = run({ 'local.ts': `const request=(((input)=>JSON.parse(input)) as (value:string)=>unknown);function validate(){try{request(input)}catch(error){
    // make-error-outlet-local-validation: 仅解析当前字段，不执行网络请求
    messageApi.error(error.message);
  }}` });
  assert.equal(result.code, 0, result.output);
});
test('二十四层共享调用图在有界时间内完成且仍要求核查未知来源', () => {
  let code = 'function base(){JSON.parse(input)}';
  let previous = 'base';
  for (let index = 0; index < 24; index++) {
    code += `function layer${index}(){${previous}();${previous}()}`;
    previous = `layer${index}`;
  }
  code += `function validate(){try{${previous}()}catch(error){messageApi.error(error.message)}}`;
  const result = run({ 'shared.ts': code }, { timeout: 5000 });
  assert.equal(result.code, 1, result.output || '共享调用图超时或异常退出');
  assert.match(result.output, /exception_toast_origin_unverified/);
});
test('循环调用图内真实请求不会被负缓存掩盖，两个入口都须拦截', () => {
  const result = run({ 'remote.ts': `function a(){b();fetch('/api/save')}function b(){a()}
    function saveA(){try{a()}catch(error){
      // make-error-outlet-local-validation: 仅校验当前字段
      messageApi.error(error.message);
    }}
    function saveB(){try{b()}catch(error){
      // make-error-outlet-local-validation: 仅校验当前字段
      messageApi.error(error.message);
    }}` });
  assert.equal(result.code, 1, result.output);
  assert.equal((result.output.match(/FAIL request_error_string_toast/g) ?? []).length, 2, result.output);
});
test('无请求循环图终止分析并保留未知来源门禁', () => {
  const result = run({ 'local.ts': `function a(){b()}function b(){a()}function validate(){try{a()}catch(error){messageApi.error(error.message)}}` }, { timeout: 5000 });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /exception_toast_origin_unverified/);
});
test('请求入口的正缓存不污染先访问的本地分支', () => {
  const result = run({ 'mixed.ts': `function local(){JSON.parse(input)}function remote(){fetch('/api/save')}function mixed(){remote();local()}
    function save(){try{mixed()}catch(error){
      // make-error-outlet-local-validation: 仅校验字段
      messageApi.error(error.message);
    }}
    function validate(){try{local()}catch(error){
      // make-error-outlet-local-validation: 仅解析当前字段，不执行网络请求
      messageApi.error(error.message);
    }}` });
  assert.equal(result.code, 1, result.output);
  assert.equal((result.output.match(/FAIL request_error_string_toast/g) ?? []).length, 1, result.output);
});
test('已缓存的本地分支不掩盖兄弟分支中的请求', () => {
  const result = run({ 'mixed.ts': `function local(){JSON.parse(input)}function remote(){fetch('/api/save')}function mixed(){local();remote()}
    function validate(){try{local()}catch(error){
      // make-error-outlet-local-validation: 仅解析当前字段，不执行网络请求
      messageApi.error(error.message);
    }}
    function save(){try{mixed()}catch(error){
      // make-error-outlet-local-validation: 仅校验字段
      messageApi.error(error.message);
    }}` });
  assert.equal(result.code, 1, result.output);
  assert.equal((result.output.match(/FAIL request_error_string_toast/g) ?? []).length, 1, result.output);
});

test('缺少 satisfies API 时普通请求仍按审计失败处理而非崩溃', () => {
  const result = run({ 'remote.ts': `async function save(){try{await fetch('/api/save')}catch(error){messageApi.error(error.message)}}` }, { withoutSatisfiesApi: true });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /FAIL request_error_string_toast/);
  assert.match(result.output, /status: FAIL/);
  assert.doesNotMatch(result.output, /TypeError|isSatisfiesExpression is not a function/);
});
test('缺少 satisfies API 时合法本地解析保持通过', () => {
  const result = run({ 'local.ts': `function validate(input){try{JSON.parse(input)}catch(error){messageApi.error(error.message)}}` }, { withoutSatisfiesApi: true });
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /status: PASS/);
});
