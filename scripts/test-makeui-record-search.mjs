import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

function option(name) {
  const argument = process.argv.find(value => value.startsWith(`--${name}=`));
  if (argument === undefined) return undefined;
  const value = argument.slice(name.length + 3);
  if (!value.trim()) throw new Error(`--${name} requires a nonblank path`);
  return path.resolve(value);
}
const skillRoot = option('skill') ?? fileURLToPath(new URL('../skills/makeui/', import.meta.url));
const source = path.join(skillRoot, 'assets/record-page-patterns');
const dependencyArgument = option('dependencies');
const dependencies = dependencyArgument && (path.basename(dependencyArgument) === 'node_modules' ? path.dirname(dependencyArgument) : dependencyArgument);

for (const file of ['types.ts', 'mobile-record-search.tsx', 'desktop-record-search.tsx', 'mobile-record-list.tsx', 'mobile-lookup-picker.tsx']) {
  test(`copyable search resource exists: ${file}`, () => assert.ok(fs.existsSync(path.join(source, file))));
}

test('search Views expose host-owned apply and composition lifecycle', () => {
  const types = fs.readFileSync(path.join(source, 'types.ts'), 'utf8');
  for (const callback of ['onApply', 'onCompositionStart', 'onCompositionEnd', 'onCompositionCancel']) assert.match(types, new RegExp(`${callback}:`));
  for (const file of ['mobile-record-search.tsx', 'desktop-record-search.tsx']) {
    const content = fs.readFileSync(path.join(source, file), 'utf8');
    assert.doesNotMatch(content, /setTimeout|setInterval|fetch\(|axios|localStorage|sessionStorage/,
      'the View must not own a debounce, request or persistent query');
  }
});

test('explicit blank paths cannot skip runtime validation', () => {
  for (const argument of ['--skill=', '--dependencies=', '--skill=   ', '--dependencies=   ']) {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), argument], {encoding:'utf8', timeout:30000});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires a nonblank path/);
  }
});

const runtime = String.raw`
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'https://example.test/', pretendToBeVisual:true});
for (const key of ['window','document','HTMLElement','Element','Node','HTMLInputElement','HTMLTextAreaElement','MutationObserver','Event','MouseEvent','KeyboardEvent']) global[key] = dom.window[key];
Object.defineProperty(global, 'navigator', {value:dom.window.navigator, configurable:true});
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = () => ({matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}});
const ts = require('typescript');
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, filename);
const React = require('react');
const {render, fireEvent, screen, cleanup, act} = require('@testing-library/react');
const {MobileRecordSearch} = require('./patterns/mobile-record-search.tsx');
const {DesktopRecordSearch} = require('./patterns/desktop-record-search.tsx');
const {MobileRecordList} = require('./patterns/mobile-record-list.tsx');
const {MobileLookupPicker} = require('./patterns/mobile-lookup-picker.tsx');
const h = React.createElement;

// Only the host Controller uses this deterministic timer boundary. The real Views
// receive the same callbacks as an App; no DOM events or public components are mocked.
function clock() {
 let now = 0; let id = 0; const pending = new Map();
 return {
  schedule(callback, delay){const next = ++id; pending.set(next, {at:now+delay, callback}); return next},
  cancel(key){pending.delete(key)},
  advance(milliseconds){now += milliseconds; for (const [key, entry] of [...pending]) if (entry.at <= now) {pending.delete(key); entry.callback()}},
  get pending(){return pending.size},
 };
}
function harness(initialView, strict = false) {
 const timer = clock(); const applied = []; const lifecycle = []; const state = {draft:'', composing:false, timer:undefined};
 function Host({view}) {
  const [query, setQuery] = React.useState('');
  const cancel = () => {timer.cancel(state.timer); state.timer = undefined};
  const apply = value => {cancel(); applied.push(value)};
  const edit = value => {
   state.draft = value; setQuery(value); cancel();
   if (state.composing) return;
   if (!value) apply(value); else state.timer = timer.schedule(() => apply(value), 1000);
  };
  const start = () => {lifecycle.push('start'); state.composing = true; cancel()};
  const end = value => {lifecycle.push(['end', value]); state.composing = false; edit(value)};
  const cancelComposition = () => {lifecycle.push('cancel'); state.composing = false; cancel()};
  React.useEffect(() => cancel, []);
  const search = {value:query, onChange:edit, onApply:apply, onCompositionStart:start, onCompositionEnd:end, onCompositionCancel:cancelComposition, label:'搜索记录'};
  if (view === 'desktop') return h(DesktopRecordSearch, search);
  if (view === 'mobile') return h(MobileRecordSearch, search);
  if (view === 'list') return h(MobileRecordList, {
   query, onQueryChange:edit, onQueryApply:apply, onQueryCompositionStart:start, onQueryCompositionEnd:end, onQueryCompositionCancel:cancelComposition,
   searchLabel:'搜索记录', items:[], emptyContent:'没有记录', navigation:{ariaLabel:'导航', items:[{key:'records', label:'记录', icon:'R'}], onSelect(){}},
  });
  return h(MobileLookupPicker, {open:true, onClose(){}, onChange(){throw new Error('search must not commit a Lookup field')}, title:'关联候选', items:[], emptyContent:'没有候选', search});
 }
 const viewElement = view => strict ? h(React.StrictMode,null,h(Host,{view})) : h(Host,{view});
 const mounted = render(viewElement(initialView));
 return {timer, applied, lifecycle, state, mounted, changeView(view){mounted.rerender(viewElement(view))}, input(){return screen.getByRole('searchbox',{name:'搜索记录'})}};
}
function advance(host, milliseconds){act(() => host.timer.advance(milliseconds))}

for (const view of ['desktop','mobile','list','lookup']) {
 const host = harness(view); let input = host.input();
 fireEvent.change(input, {target:{value:'first'}});
 assert.deepEqual(host.applied, [], view+': editing only schedules the shared Controller debounce');
 advance(host,999); assert.deepEqual(host.applied, []);
 advance(host,1); assert.deepEqual(host.applied, ['first'], view+': one second applies the query');
 fireEvent.change(input, {target:{value:'enter'}});
 fireEvent.keyDown(input, {key:'Enter', code:'Enter', keyCode:13, charCode:13});
 assert.deepEqual(host.applied, ['first','enter'], view+': Enter must immediately apply the shared Controller query');
 assert.equal(host.timer.pending, 0, view+': immediate apply cancels the old timer');
 advance(host,1000); assert.deepEqual(host.applied, ['first','enter'], view+': Enter must not leave a second delayed request');

 fireEvent.change(input, {target:{value:'pending-before-ime'}});
 fireEvent.compositionStart(input);
 fireEvent.change(input, {target:{value:'zhong'}});
 fireEvent.keyDown(input, {key:'Enter', code:'Enter', keyCode:13, charCode:13});
 if (view === 'desktop') fireEvent.click(document.querySelector('.ant-input-search-btn'));
 advance(host,2000);
 assert.deepEqual(host.applied, ['first','enter'], view+': composition cancels the previous timer and blocks incomplete input, Enter and search-button apply');
 assert.deepEqual(host.lifecycle, ['start'], view+': real composition start reaches the Controller');
 fireEvent.compositionEnd(input, {data:'中'});
 assert.deepEqual(host.lifecycle, ['start',['end','zhong']], view+': composition end supplies the actual final input value');
 advance(host,999); assert.deepEqual(host.applied, ['first','enter']);
 advance(host,1); assert.deepEqual(host.applied, ['first','enter','zhong'], view+': composition end restarts exactly one second');

 fireEvent.change(input, {target:{value:'guard'}});
 fireEvent.keyDown(input, {key:'Enter', code:'Enter', keyCode:13, charCode:13, isComposing:true});
 fireEvent.keyDown(input, {key:'Enter', code:'Enter', keyCode:229, charCode:229});
 assert.deepEqual(host.applied, ['first','enter','zhong'], view+': native composing and legacy 229 Enter must not apply');
 fireEvent.change(input, {target:{value:''}});
 assert.deepEqual(host.applied, ['first','enter','zhong',''], view+': clearing applies exactly once via the existing Controller');
 assert.equal(host.timer.pending,0);
 advance(host,2000); assert.deepEqual(host.applied, ['first','enter','zhong','']);

 if (view === 'desktop') {
  fireEvent.change(input,{target:{value:'button'}});
  fireEvent.click(document.querySelector('.ant-input-search-btn'));
  assert.deepEqual(host.applied, ['first','enter','zhong','','button'], 'the real AntD search button immediately applies');
  assert.equal(host.timer.pending,0);
  fireEvent.change(input,{target:{value:'clear-icon'}});
  const clear = document.querySelector('.ant-input-clear-icon');
  assert.ok(clear,'the actual AntD clear affordance is available');
  fireEvent.click(clear);
  assert.deepEqual(host.applied,['first','enter','zhong','','button',''],'AntD clear onSearch and onChange must not double apply');
  advance(host,2000); assert.deepEqual(host.applied,['first','enter','zhong','','button','']);
 }
 cleanup(); assert.equal(host.timer.pending,0,'unmount clears the host timer');
 console.log(view+': host debounce / immediate Enter / IME lifecycle / native guards / clear: PASS');
}
const shared=harness('desktop');
fireEvent.change(shared.input(), {target:{value:'shared draft'}});
shared.changeView('mobile'); assert.equal(shared.input().value,'shared draft');
fireEvent.keyDown(shared.input(),{key:'Enter',code:'Enter',keyCode:13});
assert.deepEqual(shared.applied,['shared draft']);
shared.changeView('list'); assert.equal(shared.input().value,'shared draft');
shared.changeView('desktop'); assert.equal(shared.input().value,'shared draft');
advance(shared,2000); assert.deepEqual(shared.applied,['shared draft'],'View changes share one Controller and no duplicated timer');
cleanup(); console.log('Cross-View query and one shared Controller: PASS');
for (const view of ['desktop','mobile','list','lookup']) {
 const interrupted=harness(view);
 fireEvent.compositionStart(interrupted.input());
 fireEvent.change(interrupted.input(),{target:{value:'unfinished'}});
 interrupted.changeView(view==='desktop'?'mobile':'desktop');
 assert.deepEqual(interrupted.lifecycle,['start','cancel'],view+': removing a composing View notifies cancellation without committing unfinished text');
 assert.deepEqual(interrupted.applied,[]);
 advance(interrupted,2000);assert.deepEqual(interrupted.applied,[],view+': cancellation must not schedule unfinished input');
 assert.equal(interrupted.input().value,'unfinished','the shared draft survives View cancellation');
 fireEvent.change(interrupted.input(),{target:{value:'continued'}});
 advance(interrupted,1000);assert.deepEqual(interrupted.applied,['continued'],view+': the next View is not stuck in composition mode');
 cleanup();
}
for (const view of ['desktop','mobile']) {
 const strict=harness(view,true);
 assert.deepEqual(strict.lifecycle,[],view+': StrictMode effect replay does not fake composition cancellation');
 fireEvent.compositionStart(strict.input());fireEvent.change(strict.input(),{target:{value:'complete'}});fireEvent.compositionEnd(strict.input(),{data:'complete'});
 cleanup();assert.deepEqual(strict.lifecycle,['start',['end','complete']],view+': a normally ended composition is not cancelled again on unmount');
 const untouched=harness(view,true);cleanup();assert.deepEqual(untouched.lifecycle,[],view+': a non-composing View does not emit cancellation');
}
dom.window.close();console.log('Composing View unmount cancels host composition and retains the shared draft: PASS');
`;

const typeFixture = `import {MobileRecordSearch} from './patterns/mobile-record-search';\nimport {DesktopRecordSearch} from './patterns/desktop-record-search';\nimport type {RecordSearchProps} from './patterns/types';\nconst props:RecordSearchProps={value:'',label:'搜索',onChange:query=>void query,onApply:query=>void query,onCompositionStart(){},onCompositionEnd:query=>void query,onCompositionCancel(){}};\nconst mobile=<MobileRecordSearch {...props}/>;const desktop=<DesktopRecordSearch {...props}/>;\n// @ts-expect-error immediate search application must not be silently omitted\nconst incomplete:RecordSearchProps={value:'',label:'搜索',onChange(){},onCompositionStart(){},onCompositionEnd(){},onCompositionCancel(){}};\n// @ts-expect-error unmount cancellation must not be silently omitted\nconst missingCancel:RecordSearchProps={value:'',label:'搜索',onChange(){},onApply(){},onCompositionStart(){},onCompositionEnd(){}};\nvoid [mobile,desktop,incomplete,missingCancel];`;

test('real React and AntD search events preserve shared Controller semantics', {skip:dependencies?false:'pass --dependencies=<UI directory or node_modules> for real component validation'}, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'makeui-record-search-'));
  try {
    fs.symlinkSync(path.join(dependencies,'node_modules'),path.join(directory,'node_modules'),'dir');
    fs.cpSync(source,path.join(directory,'patterns'),{recursive:true});
    fs.writeFileSync(path.join(directory,'runtime.cjs'),runtime);
    const result=spawnSync(process.execPath,[path.join(directory,'runtime.cjs')],{encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,`real controlled search events:\n${result.stdout}\n${result.stderr}`);
    fs.writeFileSync(path.join(directory,'formal-types.tsx'),typeFixture);
    fs.writeFileSync(path.join(directory,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022','DOM'],module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,esModuleInterop:true,skipLibCheck:true,noEmit:true},include:['formal-types.tsx','patterns/**/*']}));
    const types=spawnSync(process.execPath,[path.join(directory,'node_modules/typescript/bin/tsc'),'-p',path.join(directory,'tsconfig.json')],{encoding:'utf8',timeout:30000});
    assert.equal(types.status,0,`required controlled search callback types:\n${types.stdout}\n${types.stderr}`);
    console.log(result.stdout.trim());
  } finally {fs.rmSync(directory,{recursive:true,force:true})}
});
