import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { MessageChannel as NodeMessageChannel } from 'node:worker_threads';
import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

function directoryArgument(name) {
  if (process.argv.includes(`--${name}`)) throw new Error(`--${name} 必须使用 --${name}=<目录>`);
  const matches = process.argv.filter(value => value.startsWith(`--${name}=`));
  if (matches.length > 1) throw new Error(`--${name} 不能重复指定`);
  const argument = matches[0];
  if (!argument) return undefined;
  const value = argument.slice(name.length + 3);
  if (!value || !existsSync(resolve(value)) || !statSync(resolve(value)).isDirectory()) {
    throw new Error(`--${name} 必须指定存在的非空目录`);
  }
  return resolve(value);
}
const selectedSkill = directoryArgument('skill');
const dependencies = directoryArgument('dependencies');
const skill = selectedSkill ? pathToFileURL(selectedSkill + '/') : new URL('../skills/makeui/', import.meta.url);
const moduleUrl = new URL('scripts/mobile-form-acceptance.mjs', skill);
const declarationUrl = new URL('scripts/mobile-form-acceptance.d.mts', skill);
const checks = await import(moduleUrl.href);
const declaration = await readFile(declarationUrl, 'utf8');

test('字段标签关联：公开导出及相邻声明存在，默认无依赖也执行', () => {
  assert.equal(typeof checks.assertFieldLabelAssociation, 'function');
  assert.match(declaration, /export function assertFieldLabelAssociation\(input:\s*\{\s*label:\s*HTMLLabelElement;\s*control:\s*Element;?\s*\}\):\s*void;/);
});
test('字段标签关联：不能用形似已连接DOM的普通对象代替真实label与控件', () => {
  assert.throws(() => checks.assertFieldLabelAssociation({label: {isConnected: true}, control: {isConnected: true}}), /真实 DOM|原生 label|标签/);
});

const domOptions = { skip: dependencies ? false : '显式 --dependencies=<node_modules> 后执行真实 DOM / AntD；基础导出与合同未跳过' };
function environment() {
  const require = createRequire(resolve(dependencies, '__field_label_test__.cjs'));
  const { JSDOM } = require(resolve(dependencies, 'jsdom'));
  return { require, dom: new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' }) };
}
function nativePair(document, tag = 'input') {
  const label = document.createElement('label'); label.textContent = '业务字段';
  const control = document.createElement(tag); control.id = 'input-field'; label.htmlFor = control.id;
  document.body.append(label, control);
  return {label, control};
}

test('字段标签关联：input/textarea/select/button的原生control及labels必须同时一致', domOptions, () => {
  const { dom } = environment();
  try {
    for (const tag of ['input','textarea','select','button']) {
      const input = nativePair(dom.window.document, tag);
      checks.assertFieldLabelAssociation(input);
      assert.equal(input.label.control, input.control);
      assert.ok([...input.control.labels].includes(input.label));
      input.label.htmlFor = 'input-field-nearby';
      assert.throws(() => checks.assertFieldLabelAssociation(input), /关联|for|id/);
      dom.window.document.body.replaceChildren();
    }
  } finally { dom.window.close(); }
});

test('字段标签关联：错误for不能由placeholder、aria-label或native aria-labelledby掩盖', domOptions, () => {
  const { dom } = environment();
  try {
    const input = nativePair(dom.window.document); input.label.id = 'actual-label'; input.label.htmlFor = 'field';
    input.control.placeholder = input.label.textContent; input.control.setAttribute('aria-label', input.label.textContent);
    input.control.setAttribute('aria-labelledby', input.label.id);
    assert.throws(() => checks.assertFieldLabelAssociation(input), /关联|for|id/);
  } finally { dom.window.close(); }
});

test('字段标签关联：隐式包裹的原生label也可用，不要求几何或模拟矩形', domOptions, () => {
  const { dom } = environment();
  try {
    const input = nativePair(dom.window.document); input.label.removeAttribute('for'); input.label.append(input.control);
    for (const element of [input.label,input.control]) element.getBoundingClientRect = () => { throw new Error('标签关联门禁不应调用几何'); };
    checks.assertFieldLabelAssociation(input);
  } finally { dom.window.close(); }
});

test('字段标签关联：非labelable ARIA控件必须真实引用可见label.id', domOptions, () => {
  const { dom } = environment();
  try {
    const { document } = dom.window; const label=document.createElement('label');label.textContent='关联项目';label.id='lookup-label';
    const control=document.createElement('div');control.id='lookup-control';control.setAttribute('role','combobox');control.setAttribute('aria-labelledby',label.id);document.body.append(label,control);
    checks.assertFieldLabelAssociation({label,control});
    label.htmlFor=control.id;checks.assertFieldLabelAssociation({label,control});
    control.setAttribute('aria-labelledby','lookup-label-nearby');control.setAttribute('aria-label','关联项目');assert.throws(()=>checks.assertFieldLabelAssociation({label,control}),/引用|关联|labelledby/);
    control.setAttribute('aria-labelledby',label.id);label.htmlFor='different-control';assert.throws(()=>checks.assertFieldLabelAssociation({label,control}),/for|id|关联/);
    label.removeAttribute('for');control.removeAttribute('role');control.className='combobox';assert.throws(()=>checks.assertFieldLabelAssociation({label,control}),/ARIA|role|控件/);
  } finally { dom.window.close(); }
});

test('字段标签关联：ARIA仅允许明确的字段／分组role，generic及无效角色不能假放行', domOptions, () => {
  const { dom } = environment();
  try {
    const {document}=dom.window;const label=document.createElement('label');label.id='field-role-label';label.textContent='字段组';
    const control=document.createElement('div');control.setAttribute('aria-labelledby',label.id);document.body.append(label,control);
    for(const role of ['generic','not-a-role','none','presentation']){
      control.setAttribute('role',role);
      assert.throws(()=>checks.assertFieldLabelAssociation({label,control}),/支持.*role|ARIA.*role/);
    }
    for(const role of ['combobox','textbox','searchbox','button','group','listbox','radiogroup','checkbox','radio','spinbutton','slider','switch','tree','grid']){
      control.setAttribute('role',role);checks.assertFieldLabelAssociation({label,control});
    }
  } finally {dom.window.close();}
});

test('字段标签关联：拒绝空/隐藏标签、离线DOM、跨文档及重复id造成的假引用', domOptions, () => {
  const { dom } = environment(); const other=environment().dom;
  try {
    const input=nativePair(dom.window.document);
    input.label.textContent='   ';assert.throws(()=>checks.assertFieldLabelAssociation(input),/文本|可见/);
    input.label.innerHTML='<span style="display:none">隐藏名称</span>';assert.throws(()=>checks.assertFieldLabelAssociation(input),/文本|可见/);
    input.label.textContent='恢复名称';input.label.style.visibility='hidden';assert.throws(()=>checks.assertFieldLabelAssociation(input),/文本|可见/);input.label.style.visibility='';
    input.control.remove();assert.throws(()=>checks.assertFieldLabelAssociation(input),/连接|挂载|DOM/);dom.window.document.body.append(input.control);
    const foreign=nativePair(other.window.document).control;assert.throws(()=>checks.assertFieldLabelAssociation({label:input.label,control:foreign}),/同一文档|同文档/);
    dom.window.document.body.replaceChildren();const duplicate=dom.window.document.createElement('label');duplicate.id='shared-label';duplicate.textContent='另一个标签';const label=duplicate.cloneNode(true);const control=dom.window.document.createElement('div');control.setAttribute('role','combobox');control.setAttribute('aria-labelledby','shared-label');dom.window.document.body.append(duplicate,label,control);assert.throws(()=>checks.assertFieldLabelAssociation({label,control}),/引用|labelledby|id/);
  } finally { dom.window.close(); other.window.close(); }
});

async function reactFixture(dom, require) {
  const channels=[];
  class OwnedMessageChannel extends NodeMessageChannel { constructor(){ super(); channels.push(this); } }
  const old={};
  for(const key of ['window','document','navigator','HTMLElement','Element','Node','ShadowRoot','SVGElement','getComputedStyle','MessageChannel']){
    old[key]=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='MessageChannel'?OwnedMessageChannel:key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key]});
  }
  const previousObserver=globalThis.ResizeObserver;
  globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
  Object.defineProperty(dom.window,'matchMedia',{value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}),configurable:true});
  const directory=await mkdtemp(join(tmpdir(),'makeui field labels '));
  const { transformSync }=require(resolve(dependencies,'esbuild'));
  const fixture=String.raw`
    const React=require('react'); const {Form,Input}=require('antd');
    const FieldAdapter=React.forwardRef(function FieldAdapter({value,onChange,onBlur,id,name,disabled},ref){
      return <Input ref={ref} id={id} name={name} disabled={disabled} value={value} onChange={onChange} onBlur={onBlur}/>;
    });
    function Field({fixed,onBlur,inputRef}){ const generated=React.useId(); const id=fixed?'input-'+generated:'input-name'; const labelBinding=fixed?{htmlFor:id}:{};
      return <Form.Item name="name" label="项目名称" {...labelBinding}><FieldAdapter ref={inputRef} id={id} name="name" onBlur={onBlur}/></Form.Item>;
    }
    module.exports=function Fixture({fixed,formRef,onBlur,inputRef}){return <Form ref={formRef}><Field fixed={fixed} onBlur={onBlur} inputRef={inputRef}/></Form>};
  `;
  const compiled=transformSync(fixture,{loader:'jsx',format:'cjs',jsx:'transform'}).code;
  const file=join(directory,'fixture.cjs');
  // 只注入运行依赖解析位置；测试仍挂载真实AntD Form.Item与实际受控adapter。
  await writeFile(file,"const realRequire=require;require=realRequire('node:module').createRequire("+JSON.stringify(resolve(dependencies,'__fixture__.cjs'))+");\n"+compiled);
  const React=require(resolve(dependencies,'react'));const testing=require(resolve(dependencies,'@testing-library/react'));const Fixture=require(file);
  return {React,testing,Fixture,restore:async()=>{testing.cleanup();for(const channel of channels){channel.port1.close();channel.port2.close();}for(const [key,descriptor]of Object.entries(old)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}if(previousObserver===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=previousObserver;await rm(directory,{recursive:true,force:true});}};
}

test('真实AntD复现：Form.Item默认htmlFor=name而adapter显式id=input-name时必须拒绝',domOptions,async()=>{
  const {dom,require}=environment();const runtime=await reactFixture(dom,require);
  try {const view=runtime.testing.render(runtime.React.createElement(runtime.Fixture,{fixed:false}));const label=view.container.querySelector('label');const control=view.container.querySelector('input');assert.equal(label.htmlFor,'name');assert.equal(control.id,'input-name');assert.equal(label.control,null);assert.equal(control.labels.length,0);assert.throws(()=>checks.assertFieldLabelAssociation({label,control}),/关联|for|id/);}catch(error){console.error('AntD mismatch fixture:',error);throw error;}finally{await runtime.restore();dom.window.close();}
});

test('真实AntD修正示例：同一useId同时透传htmlFor/id，值/blur/ref继续到真实控件',domOptions,async()=>{
  const {dom,require}=environment();const runtime=await reactFixture(dom,require);let blurred=0;
  try {const formRef=runtime.React.createRef(),inputRef=runtime.React.createRef();const view=runtime.testing.render(runtime.React.createElement(runtime.Fixture,{fixed:true,formRef,inputRef,onBlur:()=>blurred++}));const label=view.container.querySelector('label');const control=view.container.querySelector('input');checks.assertFieldLabelAssociation({label,control});assert.equal(label.htmlFor,control.id);assert.equal(inputRef.current.input,control);runtime.testing.fireEvent.change(control,{target:{value:'真实受控值'}});assert.equal(formRef.current.getFieldsValue().name,'真实受控值');runtime.testing.fireEvent.blur(control);assert.equal(blurred,1);assert.equal(view.getByLabelText('项目名称'),control);}finally{await runtime.restore();dom.window.close();}
});


test('字段标签关联：选定Skill的实际公开类型在独立目录编译',domOptions,async()=>{
  const directory=await mkdtemp(join(tmpdir(),'makeui label types '));
  try {
    await writeFile(join(directory,'mobile-form-acceptance.mjs'),await readFile(moduleUrl));
    await writeFile(join(directory,'mobile-form-acceptance.d.mts'),declaration);
    await writeFile(join(directory,'consumer.mts'),`import {assertFieldLabelAssociation} from './mobile-form-acceptance.mjs';
const label=document.createElement('label'),control=document.createElement('input');
assertFieldLabelAssociation({label,control});
// @ts-expect-error label must be a real HTMLLabelElement, not a generic div
assertFieldLabelAssociation({label:document.createElement('div'),control});
`);
    const result=spawnSync(process.execPath,[resolve(dependencies,'typescript/bin/tsc'),'--strict','--noEmit','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--lib','ES2022,DOM',join(directory,'consumer.mts')],{encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
  } finally {await rm(directory,{recursive:true,force:true});}
});

after(() => { if (dependencies) { const require=createRequire(resolve(dependencies,'__field_label_cleanup__.cjs')); require(resolve(dependencies,'esbuild')).stop(); } });
