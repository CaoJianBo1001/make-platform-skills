import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

function option(name) {
  const argument = process.argv.find(arg => arg.startsWith(`--${name}=`));
  if (argument === undefined) return undefined;
  const value = argument.slice(name.length + 3);
  if (!value.trim()) throw new Error(`--${name} requires a nonblank path`);
  return value;
}
const skillRoot=option('skill')?path.resolve(option('skill')):fileURLToPath(new URL('../skills/makeui/',import.meta.url));
const source=path.join(skillRoot,'assets/record-page-patterns');
const supplied=option('dependencies');
const dependencies=supplied&&(path.basename(path.resolve(supplied))==='node_modules'?path.dirname(path.resolve(supplied)):path.resolve(supplied));
const component='mobile-record-value.tsx',stylesheet='mobile-record-value.css';

function assertHostContract(directory){
  const ts=fs.readFileSync(path.join(directory,component),'utf8');
  const css=fs.readFileSync(path.join(directory,stylesheet),'utf8');
  assert.doesNotMatch(ts,/from\s*['"]antd|fetch\(|axios|localStorage|react-router|\/api\//,'native phone values must remain controlled presentation');
  assert.doesNotMatch(css,/\.make-app-mobile-|\[role\s*=\s*['"]?dialog/,'reset belongs only to the host namespace');
  assert.match(ts,/data-makeui-native-value="input"/);
  assert.match(ts,/data-makeui-native-value="trigger"/);
}

test('explicit blank skill or dependency paths cannot fall back or skip',()=>{
  for(const argument of ['--skill=','--dependencies=','--skill=   ','--dependencies=   ']){const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),argument],{encoding:'utf8',timeout:30000});assert.notEqual(result.status,0,'explicit blank input must fail');assert.match(result.stderr,/requires a nonblank path/);}
});

test('native mobile value examples are copyable, phone-only and host-owned',()=>{
  for(const file of [component,stylesheet])assert.ok(fs.existsSync(path.join(source,file)),`missing host native value asset: ${file}`);
  assertHostContract(source);
  const entry=fs.readFileSync(path.join(source,'index.ts'),'utf8');
  assert.match(entry,/MobileRecordValueInput/);assert.match(entry,/MobileRecordValueTrigger/);
  assert.doesNotMatch(entry,/from\s*['"]antd/);
});

const runtime=String.raw`
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {createRequire}=require('node:module');
const directory=process.argv[2],section=process.argv[3];const external=createRequire(path.join(directory,'__deps__.cjs'));
const {JSDOM}=external('jsdom');const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://example.test/',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Element','Node','HTMLInputElement','HTMLButtonElement','HTMLTextAreaElement','MutationObserver','Event','MouseEvent','KeyboardEvent'])global[key]=dom.window[key];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);global.IS_REACT_ACT_ENVIRONMENT=true;
const ts=external('typescript');require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
require.extensions['.css']=()=>{};
const React=external('react');const {render,fireEvent,screen,cleanup}=external('@testing-library/react');const h=React.createElement;
const {MobileRecordValueInput,MobileRecordValueTrigger}=require(path.join(directory,'patterns/mobile-record-value.tsx'));
const css=fs.readFileSync(path.join(directory,'patterns/mobile-record-value.css'),'utf8');const compiled=external('esbuild').transformSync(css,{loader:'css'}).code;
const style=document.createElement('style');style.textContent=compiled;document.head.append(style);
function declarations(selector){return [...document.styleSheets].flatMap(s=>[...s.cssRules]).filter(r=>r.selectorText?.split(',').map(s=>s.trim().replace(/["']/g,'')).includes(selector.replace(/["']/g,''))).map(r=>r.style).at(-1)}
function compilerContract(){
 const ordinary=declarations('.makeui-mobile-record-value-input');
 assert.ok(ordinary,'compiled stylesheet must retain native input rules');
 assert.equal(ordinary.getPropertyValue('min-height'),'44px','native value touch height declaration');
 assert.match(ordinary.getPropertyValue('border'),/^0(?:px)?$/,'UA inset/outset border must be reset');
 assert.equal(ordinary.getPropertyValue('box-shadow'),'none');
 assert.equal(ordinary.getPropertyValue('background'),'transparent');
 assert.equal(ordinary.getPropertyValue('text-align'),'right');
 assert.match(ordinary.getPropertyValue('font-size'),/max\(16px,\s*var\(--make-mobile-theme-control-text-size/,'native editable values keep iOS minimum via the verified public variable');
 const trigger=declarations('.makeui-mobile-record-value-trigger');
 assert.equal(trigger.getPropertyValue('display'),'flex');assert.equal(trigger.getPropertyValue('justify-content'),'flex-end');assert.equal(trigger.getPropertyValue('flex-wrap'),'wrap','multiple values may wrap without ellipsis');
 const content=declarations('.makeui-mobile-record-value-trigger__content');assert.match(content.getPropertyValue('min-width'),/^0(?:px)?$/);assert.equal(content.getPropertyValue('flex-wrap'),'wrap');assert.equal(content.getPropertyValue('justify-content'),'flex-end');
 const disabled=declarations('.makeui-mobile-record-value-input:disabled');assert.equal(disabled.getPropertyValue('opacity'),'0.55','keep the published inline phone disabled baseline');
 const pointer=declarations('.makeui-mobile-record-value-input[data-input-modality="pointer"]:focus');assert.match(pointer.getPropertyValue('outline'),/^0(?:px)?$/,'known pointer focus must not retain UA/focus-visible outline');
 const keyboard=declarations('.makeui-mobile-record-value-input[data-input-modality="keyboard"]:focus');assert.match(keyboard.getPropertyValue('outline'),/2px solid var\(--make-mobile-focus-ring/,'keyboard focus remains visible through the public theme');
}
async function controlled(){
 const inputRef=React.createRef(),buttonRef=React.createRef();const commits=[],blurs=[],clicks=[];
 function Host(){const [value,setValue]=React.useState('12.34');return h('form',{onSubmit:e=>{e.preventDefault();commits.push(value)}},
 h('label',{htmlFor:'budget'},'预算'),h(MobileRecordValueInput,{ref:inputRef,id:'budget',name:'budget',value,onChange:e=>setValue(e.currentTarget.value),onBlur:e=>blurs.push(e.currentTarget.id),inputMode:'decimal','aria-invalid':true,'aria-describedby':'error','data-host-extra':'kept'}),
 h(MobileRecordValueTrigger,{type:'submit',ref:buttonRef,id:'relation',name:'relation',value:'record-a',onChange:()=>{},onClick:()=>clicks.push('open'),'aria-expanded':false,'aria-label':'选择关联'},h('span',null,'长关系甲'),h('span',null,'长关系乙')),
 h('button',{type:'submit'},'保存'))}
 const view=render(h(Host));const input=screen.getByLabelText('预算'),trigger=screen.getByRole('button',{name:'选择关联'});
 assert.equal(inputRef.current,input,'forwarded input ref must point at the actual native node');assert.equal(buttonRef.current,trigger,'forwarded trigger ref must point at native button');
 assert.equal(input.getAttribute('name'),'budget');assert.equal(input.getAttribute('inputmode'),'decimal');assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(input.getAttribute('aria-describedby'),'error');assert.equal(input.dataset.hostExtra,'kept');
 assert.equal(trigger.getAttribute('type'),'button','opening a picker must not submit its form');assert.equal(trigger.getAttribute('name'),'relation');assert.equal(trigger.value,'record-a');assert.equal(trigger.getAttribute('aria-expanded'),'false');
 fireEvent.change(input,{target:{value:'0'}});assert.equal(input.value,'0');fireEvent.blur(input);assert.deepEqual(blurs,['budget']);fireEvent.click(trigger);assert.deepEqual(clicks,['open']);assert.equal(commits.length,0);fireEvent.click(screen.getByText('保存'));assert.deepEqual(commits,['0'],'the visual value and actual submit store agree');
 assert.equal(trigger.querySelector('.makeui-mobile-record-value-trigger__content').textContent,'长关系甲长关系乙');
 view.rerender(h(React.Fragment,null,h(MobileRecordValueInput,{type:'date',value:'12.34',onChange(){},disabled:true,'aria-label':'禁用预算'}),h(MobileRecordValueTrigger,{disabled:true,'aria-label':'禁用关联',onClick:()=>clicks.push('bad')},'关系甲')));
 assert.equal(screen.getByLabelText('禁用预算').type,'text','runtime input types must not replace the mobile date/number picker adapters');assert.equal(screen.getByLabelText('禁用预算').disabled,true);assert.equal(screen.getByRole('button',{name:'禁用关联'}).disabled,true);fireEvent.click(screen.getByRole('button',{name:'禁用关联'}));assert.deepEqual(clicks,['open']);
 cleanup();console.log('Real React controlled native values, submit, refs, aria and disabled: PASS');
}
async function disabledBaseline(){
 const {MobileTextArea}=external('@qfei-design/make-app-mobile/primitives');const {MobileIdentityField}=external('@qfei-design/make-app-mobile/fields');const officialStyle=document.createElement('style');officialStyle.textContent=fs.readFileSync(path.join(path.dirname(external.resolve('@qfei-design/make-app-mobile')),'styles.css'),'utf8');document.head.append(officialStyle);
 render(h('section',{style:{color:'#171a1d',backgroundColor:'#ffffff'}},
  h(MobileRecordValueInput,{value:'12.34',onChange(){},disabled:true,'aria-label':'宿主禁用值'}),
  h(MobileTextArea,{appearance:'inline',value:'12.34',onChange(){},disabled:true,'aria-label':'正式禁用输入'}),
  h(MobileRecordValueTrigger,{disabled:true,'aria-label':'宿主禁用触发'},'关系甲'),
  h(MobileIdentityField,{fieldName:'正式禁用触发',identityKind:'user',disabled:true,items:[],value:undefined,onChange(){}})));
 const pairs=[[screen.getByLabelText('宿主禁用值'),screen.getByLabelText('正式禁用输入')],[screen.getByRole('button',{name:'宿主禁用触发'}),screen.getByRole('button',{name:'请选择正式禁用触发'})]];
 for(const [control,reference] of pairs){for(const property of ['backgroundColor','opacity'])assert.equal(getComputedStyle(control)[property],getComputedStyle(reference)[property],'disabled native values retain the independent published inline phone '+property);}
 cleanup();officialStyle.remove();console.log('Disabled background/opacity match published inline TextArea and IdentityField references: PASS; resolved colors require Chrome (JSDOM does not resolve the published var() color)');
}
async function brands(){
 const {MakeMobileThemeProvider}=external('@qfei-design/make-app-mobile/presentation');
 const packageRoot=path.dirname(external.resolve('@qfei-design/make-app-mobile'));const official=fs.readFileSync(path.join(packageRoot,'styles.css'),'utf8');
 const themes=[{primary:'#a132c8',onPrimary:'#fff',focusRing:'#a132c8'},{primary:'#c41c1c',onPrimary:'#fff',focusRing:'#c41c1c'}];
 for(const order of ['official-first','host-first']){
  style.remove();const extra=(order==='official-first'?[official,compiled]:[compiled,official]).map(text=>{const el=document.createElement('style');el.textContent=text;document.head.append(el);return el});
  function Host(){const [value,setValue]=React.useState('12.34');return h(React.Fragment,null,h(MobileRecordValueInput,{value,onChange:e=>setValue(e.currentTarget.value),'aria-label':'品牌预算',style:{color:'rgb(9, 8, 7)'}}),h(MobileRecordValueTrigger,{'aria-label':'品牌关联'},'关系甲'));}
  const wrap=theme=>h(MakeMobileThemeProvider,{theme},h(Host));const view=render(wrap(themes[0]));const input=screen.getByLabelText('品牌预算'),trigger=screen.getByRole('button',{name:'品牌关联'});fireEvent.change(input,{target:{value:'0'}});
  for(const theme of themes){view.rerender(wrap(theme));assert.equal(screen.getByLabelText('品牌预算'),input,'brand changes preserve the actual native input node');assert.equal(screen.getByRole('button',{name:'品牌关联'}),trigger,'brand changes preserve the trigger node');assert.equal(input.value,'0','brand changes retain the controlled form store');for(const el of [input,trigger]){assert.equal(getComputedStyle(el).getPropertyValue('--make-mobile-primary').trim(),theme.primary,'native values consume current public phone theme, not default-only fallback');assert.equal(getComputedStyle(el).getPropertyValue('--make-mobile-focus-ring').trim(),theme.focusRing)}assert.equal(input.style.color,'rgb(9, 8, 7)','caller style overrides remain public native props');}
  cleanup();extra.forEach(el=>el.remove());
 }
 document.head.append(style);console.log('Two published Provider brands, CSS orders and live native-node/value retention: PASS');
}
async function modality(){
 const added=[],removed=[];const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
 document.addEventListener=(type,listener,options)=>{if(['pointerdown','keydown'].includes(type))added.push([type,listener,options]);return add(type,listener,options)};
 document.removeEventListener=(type,listener,options)=>{if(['pointerdown','keydown'].includes(type))removed.push([type,listener,options]);return remove(type,listener,options)};
 const view=render(h(React.Fragment,null,h(MobileRecordValueInput,{value:'0',onChange(){},'aria-label':'模态预算'}),h(MobileRecordValueTrigger,{'aria-label':'模态关联'},'关系')));
 const input=screen.getByLabelText('模态预算'),trigger=screen.getByRole('button',{name:'模态关联'});
 assert.equal(added.filter(x=>x[0]==='pointerdown').length,1,'one shared ownerDocument pointer subscription');assert.equal(added.filter(x=>x[0]==='keydown').length,1,'one shared ownerDocument keyboard subscription');
 assert.equal(input.dataset.inputModality,'keyboard','unknown/programmatic focus retains keyboard indication');
 fireEvent.pointerDown(input);input.focus();assert.equal(document.activeElement,input);assert.equal(input.dataset.inputModality,'pointer');assert.equal(trigger.dataset.inputModality,'pointer','controls share the document input source');
 for(const key of ['1','ArrowLeft','Enter'])fireEvent.keyDown(input,{key});assert.equal(input.dataset.inputModality,'pointer','typing and caret movements are not navigation');
 fireEvent.keyDown(input,{key:'Tab',ctrlKey:true});assert.equal(input.dataset.inputModality,'pointer');fireEvent.keyDown(input,{key:'Tab',isComposing:true});assert.equal(input.dataset.inputModality,'pointer');
 fireEvent.keyDown(input,{key:'Tab',shiftKey:true});assert.equal(input.dataset.inputModality,'keyboard');assert.equal(trigger.dataset.inputModality,'keyboard');
 fireEvent.pointerDown(trigger);trigger.focus();assert.equal(document.activeElement,trigger);assert.equal(trigger.dataset.inputModality,'pointer');fireEvent.keyDown(trigger,{key:'Tab'});assert.equal(trigger.dataset.inputModality,'keyboard');
 view.unmount();assert.equal(removed.filter(x=>x[0]==='pointerdown').length,1);assert.equal(removed.filter(x=>x[0]==='keydown').length,1);document.addEventListener=add;document.removeEventListener=remove;
 console.log('Real DOM modality, pointer typing, Tab and shared document cleanup: PASS');
}
(async()=>{compilerContract();if(section!=='css-only'){await controlled();await disabledBaseline();await brands();await modality()}dom.window.close();console.log('esbuild CSS declaration contract: PASS; no browser geometry claimed')})().catch(e=>{console.error(e);process.exitCode=1});
`;

const typeFixture=`import {createRef} from 'react';import {MobileRecordValueInput,MobileRecordValueTrigger,type MobileRecordValueInputProps,type MobileRecordValueTriggerProps} from './patterns/mobile-record-value';\nconst input:MobileRecordValueInputProps={value:'0',onChange:event=>event.currentTarget.select(),id:'budget',name:'budget',disabled:false,inputMode:'decimal','aria-invalid':true,'aria-describedby':'error',onBlur:event=>event.currentTarget.blur()};\nconst trigger:MobileRecordValueTriggerProps={children:'关联',value:'id',onClick:event=>event.currentTarget.focus(),'aria-expanded':false};\nconst a=<MobileRecordValueInput {...input} ref={createRef<HTMLInputElement>()}/>;const b=<MobileRecordValueTrigger {...trigger} ref={createRef<HTMLButtonElement>()}/>;\n// @ts-expect-error controlled value is required\nconst missing=<MobileRecordValueInput onChange={()=>{}}/>;\n// @ts-expect-error trigger must retain the native button ref type\nconst wrongRef=<MobileRecordValueTrigger ref={createRef<HTMLInputElement>()}/>;\n// @ts-expect-error picker trigger is always a non-submitting button\nconst submitTrigger=<MobileRecordValueTrigger type="submit"/>;\n// @ts-expect-error native text adapter cannot replace mobile date or numeric pickers\nconst wrongType=<MobileRecordValueInput type="date" value="2026-11-27" onChange={()=>{}}/>;\nvoid [a,b,missing,wrongRef,submitTrigger,wrongType];`;

function run(directory,section){return spawnSync(process.execPath,[path.join(directory,'runtime.cjs'),directory,...(section?[section]:[])],{encoding:'utf8',timeout:30000})}

test('copied native values pass formal React types, real DOM and CSS compilation with fault injection',{skip:dependencies?false:'pass --dependencies=<UI directory with React, jsdom, typescript, esbuild>'},()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'makeui-host-values-'));
 try{
  fs.symlinkSync(path.join(dependencies,'node_modules'),path.join(directory,'node_modules'),'dir');fs.mkdirSync(path.join(directory,'patterns'));
  for(const file of [component,stylesheet])fs.copyFileSync(path.join(source,file),path.join(directory,'patterns',file));
  fs.writeFileSync(path.join(directory,'runtime.cjs'),runtime);fs.writeFileSync(path.join(directory,'formal-types.tsx'),typeFixture);
  fs.writeFileSync(path.join(directory,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022','DOM'],module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,esModuleInterop:true,skipLibCheck:true,noEmit:true},include:['formal-types.tsx','patterns/**/*']}));
  const types=spawnSync(process.execPath,[path.join(directory,'node_modules/typescript/bin/tsc'),'-p',path.join(directory,'tsconfig.json')],{encoding:'utf8',timeout:30000});assert.equal(types.status,0,`formal public React typecheck:\n${types.stdout}\n${types.stderr}`);
  const actual=run(directory);assert.equal(actual.status,0,`real native-value suite:\n${actual.stdout}\n${actual.stderr}`);
  const cssFile=path.join(directory,'patterns',stylesheet),originalCSS=fs.readFileSync(cssFile,'utf8');
  for(const [name,mutate,expected] of [
   ['missing native reset',s=>s.replace('border: 0;','border: 2px inset;'),/UA inset\/outset border must be reset/],
   ['undersized native touch target',s=>s.replace('min-height: 44px;','min-height: 25px;'),/native value touch height declaration/],
   ['unwrapped multiple values',s=>s.replaceAll('flex-wrap: wrap;','flex-wrap: nowrap;'),/multiple values may wrap/],
   ['missing keyboard indication',s=>s.replace('outline: 2px solid','outline: 0 solid'),/keyboard focus remains visible/],
  ]){const broken=mutate(originalCSS);assert.notEqual(broken,originalCSS,`${name} must mutate actual copied CSS`);fs.writeFileSync(cssFile,broken);const result=run(directory,'css-only');assert.notEqual(result.status,0,`${name} must fail`);assert.match(result.stderr,expected);fs.writeFileSync(cssFile,originalCSS)}
  const tsFile=path.join(directory,'patterns',component),originalTS=fs.readFileSync(tsFile,'utf8');
  const bad=originalTS.replace("event.key === 'Tab'", "event.key !== 'Tab'");assert.notEqual(bad,originalTS,'modality fault must alter actual input-source logic');fs.writeFileSync(tsFile,bad);const wrong=run(directory);assert.notEqual(wrong.status,0,'typing must not replace keyboard navigation detection');assert.match(wrong.stderr,/typing and caret movements are not navigation|unknown\/programmatic/);fs.writeFileSync(tsFile,originalTS);
  console.log(actual.stdout.trim());console.log('Fault injection rejected native border / 25px target / nowrap / hidden keyboard focus / typing modality');
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
});
