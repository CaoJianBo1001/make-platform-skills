import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const skillOption = process.argv.find((arg) => arg.startsWith('--skill='));
const skillArgument = skillOption?.slice('--skill='.length);
if (skillOption && !skillArgument.trim()) throw new Error('--skill requires the actual makeui directory');
const skillRoot = skillArgument ? path.resolve(skillArgument) : fileURLToPath(new URL('../skills/makeui/', import.meta.url));
const source = path.join(skillRoot, 'assets/record-page-patterns');
const dependencyOption = process.argv.find((arg) => arg.startsWith('--dependencies='));
const dependencyArgument = dependencyOption?.slice('--dependencies='.length);
if (dependencyOption && !dependencyArgument.trim()) throw new Error('--dependencies requires a UI directory or node_modules path');
const dependencies = dependencyArgument && (path.basename(path.resolve(dependencyArgument)) === 'node_modules' ? path.dirname(path.resolve(dependencyArgument)) : path.resolve(dependencyArgument));
const files = ['types.ts', 'desktop-record-search.tsx', 'mobile-record-search.tsx', 'mobile-record-list.tsx', 'mobile-lookup-picker.tsx', 'index.ts', 'styles.css', 'styles.css.d.ts', 'README.md'];

function assertPublicStyles(directory) {
  const css = fs.readFileSync(path.join(directory, 'styles.css'), 'utf8');
  assert.match(css, /color:\s*var\(--make-mobile-primary\)/, 'host emphasis must use the public primary variable');
  assert.match(css, /color:\s*var\(--make-mobile-on-primary\)/, 'selected content must use the public on-primary variable');
  assert.doesNotMatch(css, /--make-mobile-(?:primary-color|on-primary-color)/);
  assert.doesNotMatch(css, /\.make-app-mobile-/, 'host CSS must not target package-private classes');
  assert.doesNotMatch(css, /\[role\s*=\s*['"]?dialog/, 'ARIA selectors must not bypass the missing package panel-style API');
  assert.match(css, /gap:\s*10px/, 'frozen phone cards keep 8–12px separation');
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /font-size:\s*16px/, 'phone native search retains the iOS input minimum');
  assert.match(css, /var\(--make-mobile-page,\s*#f5f6f7\)/);
  assert.match(css, /var\(--make-mobile-surface,\s*#fff\)/);
}

test('copyable record patterns keep host ownership, separate desktop dependencies and public phone styles', () => {
  for (const file of files) assert.ok(fs.existsSync(path.join(source, file)), `missing copyable pattern: ${file}`);
  const mobileFiles = ['index.ts', 'mobile-record-search.tsx', 'mobile-record-list.tsx', 'mobile-lookup-picker.tsx'];
  for (const file of mobileFiles) {
    const text = fs.readFileSync(path.join(source, file), 'utf8');
    assert.doesNotMatch(text, /(?:from|import)\s*['"]antd/);
    assert.doesNotMatch(text, /fetch\(|axios|localStorage|sessionStorage|react-router|\/api\//);
  }
  assert.match(fs.readFileSync(path.join(source, 'desktop-record-search.tsx'), 'utf8'), /from ['"]antd['"]/);
  assertPublicStyles(source);
});

const runtime = String.raw`
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const directory = process.argv[2];
const external = createRequire(path.join(directory, '__dependencies__.cjs'));
const {JSDOM} = external('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {pretendToBeVisual:true, url:'https://example.test/'});
for (const key of ['window','document','HTMLElement','Element','Node','HTMLInputElement','HTMLTextAreaElement','MutationObserver','Event','MouseEvent','KeyboardEvent']) global[key] = dom.window[key];
Object.defineProperty(global,'navigator',{value:dom.window.navigator, configurable:true});
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = () => ({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
let navigationHeight = 60;
const observers = new Set();
global.ResizeObserver = class {
  constructor(callback){ this.callback=callback; observers.add(this); }
  observe(){}
  disconnect(){ observers.delete(this); }
};
const originalRect = dom.window.HTMLElement.prototype.getBoundingClientRect;
dom.window.HTMLElement.prototype.getBoundingClientRect = function(){
  if(this.classList.contains('makeui-mobile-record-list__navigation')) return {x:0,y:844-navigationHeight,top:844-navigationHeight,bottom:844,left:0,right:390,width:390,height:navigationHeight,toJSON(){}};
  return originalRect.call(this);
};
const ts = external('typescript');
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, filename);
const React = external('react');
const {act} = React;
const {render,fireEvent,screen,cleanup} = external('@testing-library/react');
const {MobileRecordSearch,MobileRecordList,MobileLookupPicker} = require(path.join(directory,'record-page-patterns/index.ts'));
const {DesktopRecordSearch} = require(path.join(directory,'record-page-patterns/desktop-record-search.tsx'));
const {MakeMobileThemeProvider} = external('@qfei-design/make-app-mobile/presentation');
const {MobileOptionPickerSheet} = external('@qfei-design/make-app-mobile/pickers');
const {MobileIdentityField} = external('@qfei-design/make-app-mobile/fields');
const {toMobileBrandTheme} = require(path.join(directory,'mobile-brand-theme.mjs'));
const mobileManifest=JSON.parse(fs.readFileSync(path.join(path.dirname(external.resolve('@qfei-design/make-app-mobile')),'../package.json'),'utf8'));
assert.equal(mobileManifest.version,'0.1.16','this contract suite verifies the published 0.1.16 public surface');
const h=React.createElement;
const candidates=[{key:'a',label:'候选甲'},{key:'b',label:'候选乙'},{key:'disabled',label:'不可选候选',disabled:true}];

function assertStyles(){
 const css=fs.readFileSync(path.join(directory,'record-page-patterns/styles.css'),'utf8');
 assert.match(css,/color:\s*var\(--make-mobile-primary\)/,'host emphasis must use the public primary variable');
 assert.match(css,/color:\s*var\(--make-mobile-on-primary\)/,'selected content must use the public on-primary variable');
 assert.doesNotMatch(css,/--make-mobile-(?:primary-color|on-primary-color)/);
}

async function lookup(){
 const commits=[];let closeCount=0;
 function Host(){
  const [value,setValue]=React.useState(candidates[0]);
  const [open,setOpen]=React.useState(false);
  const [search,setSearch]=React.useState('');
  return h(React.Fragment,null,
   h('output',{'data-testid':'value'},value?.key??'empty'),
   h('button',{onClick:()=>setOpen(true)},'打开关联'),
   h(MobileLookupPicker,{open,onClose(){closeCount++;setOpen(false)},value,onChange(next){commits.push(next);setValue(next)},items:search?candidates.filter(item=>item.label.includes(search)):candidates,search:{value:search,onChange:setSearch,onApply(){},onCompositionStart(){},onCompositionEnd(){},onCompositionCancel(){},label:'搜索关联'},title:'关联候选',emptyContent:'无候选'}));
 }
 render(h(Host));
 fireEvent.click(screen.getByText('打开关联'));
 fireEvent.click(screen.getByText('候选乙'));
 assert.equal(commits.length,0,'Lookup candidate clicks must not commit');
 assert.equal(screen.getByTestId('value').textContent,'a');
 assert.equal(screen.getAllByRole('dialog').length,1,'Lookup stays open until explicit confirmation');
 fireEvent.keyDown(document,{key:'Escape'});
 assert.equal(closeCount,1);
 assert.equal(commits.length,0,'Lookup cancellation must preserve the host form');
 fireEvent.click(screen.getByText('打开关联'));
 assert.equal(screen.getByRole('radio',{name:'候选甲'}).getAttribute('aria-checked'),'true','reopening discards the cancelled draft');
 fireEvent.click(screen.getByText('不可选候选'));
 assert.equal(screen.getByRole('radio',{name:'候选甲'}).getAttribute('aria-checked'),'true');
 fireEvent.click(screen.getByText('候选乙'));
 fireEvent.change(screen.getByRole('searchbox',{name:'搜索关联'}),{target:{value:'不存在'}});
 assert.equal(commits.length,0,'search changes do not write the form');
 assert.equal(screen.getByText('无候选').textContent,'无候选');
 fireEvent.click(screen.getByRole('button',{name:'确定'}));
 assert.equal(commits.length,1);
 assert.equal(commits[0].key,'b','confirmation uses the selected snapshot even outside the current candidate page');
 assert.equal(screen.getByTestId('value').textContent,'b');
 assert.equal(closeCount,2);
 fireEvent.click(screen.getByText('打开关联'));
 fireEvent.click(screen.getByRole('button',{name:'清除'}));
 assert.equal(commits.length,1,'clearing changes only the Lookup draft');
 fireEvent.keyDown(document,{key:'Escape'});
 assert.equal(screen.getByTestId('value').textContent,'b');
 fireEvent.click(screen.getByText('打开关联'));
 fireEvent.click(screen.getByRole('button',{name:'清除'}));
 fireEvent.click(screen.getByRole('button',{name:'确定'}));
 assert.equal(commits.length,2);
 assert.equal(commits[1],undefined);
 assert.equal(screen.getByTestId('value').textContent,'empty');
 cleanup();
 console.log('Lookup explicit draft, cancellation, clear and off-page snapshot: PASS');
}

async function lookupWithoutSearch(){
 let value;let commits=0;
 render(h(MobileLookupPicker,{open:true,onClose(){},onChange(next){value=next;commits++},items:candidates,title:'不可搜索关联',emptyContent:'无候选'}));
 assert.equal(screen.queryAllByRole('searchbox').length,0,'Lookup without search capability must not render a search control');
 fireEvent.click(screen.getByText('候选乙'));
 assert.equal(commits,0);
 fireEvent.click(screen.getByRole('button',{name:'确定'}));
 assert.equal(commits,1);assert.equal(value.key,'b');cleanup();
 console.log('Lookup without search preserves explicit confirmation: PASS');
}

async function lookupKeyboard(){
 const items=[candidates[2],candidates[0],{key:'disabled-middle',label:'中间禁用',disabled:true},candidates[1],{key:'c',label:'候选丙'}];
 const commits=[];let closes=0;
 const props={open:true,onClose(){closes++},value:candidates[0],onChange:value=>commits.push(value),items,title:'键盘关联',emptyContent:'无候选'};
 const view=render(h(MobileLookupPicker,props));
 const radio=name=>screen.getByRole('radio',{name});
 const entry=()=>screen.getAllByRole('radio').filter(node=>!node.disabled&&node.tabIndex===0);
 assert.deepEqual(entry(),[radio('候选甲')],'Lookup radio group has one tab stop at the enabled selected candidate');
 assert.ok(screen.getAllByRole('radio').filter(node=>node!==radio('候选甲')).every(node=>node.tabIndex===-1),'other radios stay outside the Tab sequence');
 radio('候选甲').focus();
 for(const [key,expected] of [['ArrowDown','候选乙'],['ArrowRight','候选丙'],['ArrowDown','候选甲'],['ArrowUp','候选丙'],['ArrowLeft','候选乙']]){
  assert.equal(fireEvent.keyDown(document.activeElement,{key}),false,'handled arrows prevent candidate-region scrolling');
  const next=radio(expected);
  assert.equal(document.activeElement,next,'arrows move focus, skip disabled candidates and wrap');
  assert.equal(next.getAttribute('aria-checked'),'true','arrows change only the candidate draft');
  assert.deepEqual(entry(),[next]);assert.equal(commits.length,0,'keyboard navigation must not write the form');
 }
 for(const modifier of ['ctrlKey','altKey','metaKey','shiftKey']){
  assert.equal(fireEvent.keyDown(document.activeElement,{key:'ArrowDown',[modifier]:true}),true,'modified arrows retain browser/assistive-technology ownership');
  assert.equal(document.activeElement,radio('候选乙'));
 }
 for(const key of ['Tab',' ','Enter']) assert.equal(fireEvent.keyDown(document.activeElement,{key}),true,'Tab and native button activation are not intercepted');
 fireEvent.keyDown(document,{key:'Escape'});assert.equal(closes,1);assert.equal(commits.length,0,'Escape after arrow navigation does not commit');
 view.rerender(h(MobileLookupPicker,{...props,open:false}));
 view.rerender(h(MobileLookupPicker,props));
 assert.equal(radio('候选甲').getAttribute('aria-checked'),'true','reopening discards keyboard-only draft selection');
 radio('候选甲').focus();fireEvent.keyDown(document.activeElement,{key:'ArrowRight'});
 fireEvent.click(screen.getByRole('button',{name:'确定'}));assert.equal(commits.length,1);assert.equal(commits[0].key,'b','only explicit confirmation writes the arrow-selected snapshot once');
 cleanup();

 const search={value:'',onChange(){},onApply(){},onCompositionStart(){},onCompositionEnd(){},onCompositionCancel(){},label:'候选搜索'};
 const dynamic=render(h(MobileLookupPicker,{...props,search}));
 const input=screen.getByRole('searchbox',{name:'候选搜索'});input.focus();
 dynamic.rerender(h(MobileLookupPicker,{...props,search,items:[candidates[1]]}));
 assert.equal(document.activeElement,input,'candidate updates do not steal search focus');
 assert.deepEqual(entry(),[radio('候选乙')],'off-page selected snapshots leave a usable tab entry');
 assert.equal(radio('候选乙').getAttribute('aria-checked'),'false','filtering does not select the fallback candidate');
 radio('候选乙').focus();fireEvent.keyDown(document.activeElement,{key:'ArrowLeft'});
 assert.equal(document.activeElement,radio('候选乙'));assert.equal(commits.length,1,'one available candidate loops without writing');
 fireEvent.click(screen.getByRole('button',{name:'清除'}));
 assert.equal(radio('候选乙').getAttribute('aria-checked'),'false');assert.deepEqual(entry(),[radio('候选乙')]);
 dynamic.rerender(h(MobileLookupPicker,{...props,search,items:items.map(item=>({...item,disabled:true}))}));
 assert.equal(entry().length,0,'all-disabled groups contain no candidate tab stop');
 dynamic.rerender(h(MobileLookupPicker,{...props,search,items:[]}));
 assert.equal(screen.queryAllByRole('radio').length,0);assert.ok(screen.getByRole('button',{name:'确定'}));
 assert.equal(commits.length,1);cleanup();

 const disabledSelected=render(h(MobileLookupPicker,{...props,items:items.map(item=>item.key==='a'?{...item,disabled:true}:item)}));
 assert.deepEqual(entry(),[radio('候选乙')],'a disabled selected snapshot does not block the first enabled tab stop');
 disabledSelected.rerender(h(MobileLookupPicker,props));
 assert.deepEqual(entry(),[radio('候选甲')],'the enabled selected key restores the tab entry when it returns');
 assert.equal(commits.length,1);cleanup();
 console.log('Lookup radio keyboard focus, disabled skipping, wrapping, dynamic candidates and draft-only confirmation: PASS');
}

async function lookupBrandColors(){
 const officialCSS=fs.readFileSync(path.join(path.dirname(external.resolve('@qfei-design/make-app-mobile')),'styles.css'),'utf8');
 const hostCSS=fs.readFileSync(path.join(directory,'record-page-patterns/styles.css'),'utf8');
 for(const order of ['official-first','host-first']){
  const css=order==='official-first'?[officialCSS,hostCSS]:[hostCSS,officialCSS];
  const styles=css.map(text=>{const element=document.createElement('style');element.textContent=text;document.head.append(element);return element});
  const themes=[{primary:'#a132c8',onPrimary:'#fdfcfa'},{primary:'#c41c1c',onPrimary:'#ffffff'}];
  const props={open:true,onClose(){},onChange(){},items:candidates,title:'品牌关联候选',emptyContent:'无候选'};
  const renderTheme=theme=>h(MakeMobileThemeProvider,{theme:toMobileBrandTheme(theme)},h(MobileLookupPicker,props));
  const view=render(renderTheme(themes[0]));
  fireEvent.click(screen.getByRole('radio',{name:'候选乙'}));
  for(const theme of themes){
   view.rerender(renderTheme(theme));
   const footer=document.querySelector('.makeui-mobile-lookup__footer');
   assert.equal(getComputedStyle(footer).getPropertyValue('--make-mobile-primary').trim(),theme.primary,'Lookup footer must consume the current Provider primary, not re-declare defaults');
   assert.equal(getComputedStyle(footer).getPropertyValue('--make-mobile-on-primary').trim(),theme.onPrimary,'Lookup footer must retain the selected on-primary color');
   assert.equal(screen.getByRole('radio',{name:'候选乙'}).getAttribute('aria-checked'),'true','theme updates preserve the opened candidate draft');
  }
  cleanup();styles.forEach(element=>element.remove());
 }
 console.log('Lookup footer current Provider colors, both CSS orders and live updates: PASS');
}

async function lookupCandidateFeedback(){
 const officialCSS=fs.readFileSync(path.join(path.dirname(external.resolve('@qfei-design/make-app-mobile')),'styles.css'),'utf8');
 const hostCSS=fs.readFileSync(path.join(directory,'record-page-patterns/styles.css'),'utf8');
 // JSDOM29 drops valid height:min(viewport-unit,px) declarations, while JSDOM26
 // only echoes the text. Neither result is layout evidence. Keep a compiler-level
 // declaration contract here; actual content height/feedback centering is a required
 // Chrome check in record-page-patterns.md, not an accepted computed-height "auto".
 const compiledCSS=external('esbuild').transformSync(hostCSS,{loader:'css'}).code;
 const lookupRule=compiledCSS.match(/\.makeui-mobile-lookup\s*\{([^}]+)\}/)?.[1]??'';
 assert.match(lookupRule,/height:\s*min\(76vh,\s*640px\)/,'host content retains the generic viewport-height fallback declaration');
 assert.match(lookupRule,/height:\s*min\(76dvh,\s*640px\)/,'host content retains the verified generic dynamic-viewport bound declaration');
 for(const searchable of [true,false]) for(const order of ['official-first','host-first']){
  const styles=[officialCSS,hostCSS];if(order==='host-first')styles.reverse();
  const elements=styles.map(css=>{const element=document.createElement('style');element.textContent=css;document.head.append(element);return element});
  let resolveRequest;let rejectRequest;let reload;
  const commits=[];
  function Host(){
   const [state,setState]=React.useState({status:'loading',items:[]});
   const [query,setQuery]=React.useState('');
   reload=()=>{setState({status:'loading',items:[]});return new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject}).then(items=>setState({status:'success',items}),()=>setState({status:'error',items:[]}))};
   React.useEffect(()=>{reload()},[]);
   const feedback=state.status==='loading'?h('div',{role:'status'},h('span',{'aria-hidden':'true'},'◌'),h('span',null,'候选加载中')):state.status==='error'?h('div',{role:'alert'},'候选加载失败',h('button',{onClick:()=>reload()},'重试候选')):h('span',null,'无候选');
   return h(MobileLookupPicker,{open:true,onClose(){},value:candidates[0],onChange:value=>commits.push(value),items:state.items,search:searchable?{value:query,onChange:setQuery,onApply(){},onCompositionStart(){},onCompositionEnd(){},onCompositionCancel(){},label:'搜索延迟候选'}:undefined,title:'延迟关联候选',emptyContent:feedback});
  }
  render(h(Host));
  const dialog=screen.getByRole('dialog');
  const sheet=document.querySelector('.makeui-mobile-lookup-sheet');
  assert.ok(sheet,'Lookup needs a public host Sheet class to establish its height contract');
  assert.equal(getComputedStyle(dialog).maxHeight,'min(76dvh, 640px)','retain the actual generic Sheet default instead of overriding package layout');
  assert.ok(screen.getByRole('heading',{name:'延迟关联候选'}),'the host content keeps a visible semantic title');
  const content=sheet.querySelector('.makeui-mobile-lookup');
  const candidateRegion=sheet.querySelector('.makeui-mobile-lookup__candidates');
  const feedback=sheet.querySelector('.makeui-mobile-lookup__feedback');
  assert.equal(getComputedStyle(content).display,'flex');
  assert.equal(getComputedStyle(content).flexDirection,'column');
  assert.equal(parseFloat(getComputedStyle(content).minHeight),0);
  assert.equal(getComputedStyle(candidateRegion).overflow,'auto');
  assert.equal(parseFloat(getComputedStyle(candidateRegion).minHeight),0);
  assert.equal(parseFloat(getComputedStyle(candidateRegion).flexGrow),1);
  assert.equal(getComputedStyle(feedback).display,'flex');
  assert.equal(getComputedStyle(feedback).alignItems,'center');
  assert.equal(getComputedStyle(feedback).justifyContent,'center');
  assert.equal(getComputedStyle(feedback).minHeight,'100%','feedback occupies the candidate remainder instead of one natural-flow row');
  assert.equal(screen.queryAllByRole('radio').length,0,'loading removes stale selectable candidates');
  assert.ok(screen.getByRole('status').textContent.includes('候选加载中'));
  assert.equal(screen.queryAllByRole('searchbox').length,searchable?1:0);
  await act(async()=>{resolveRequest(candidates);await Promise.resolve()});
  assert.equal(screen.queryAllByRole('status').length,0);
  fireEvent.click(screen.getByRole('radio',{name:'候选乙'}));
  await act(async()=>{reload()});
  assert.equal(screen.queryAllByRole('radio').length,0);
  assert.ok(screen.getByText('候选乙'),'pending candidates preserve the selected draft');
  assert.equal(commits.length,0);
  await act(async()=>{rejectRequest(new Error('delayed candidate fixture'));await Promise.resolve()});
  assert.ok(screen.getByRole('alert').textContent.includes('候选加载失败'));
  assert.equal(screen.queryAllByRole('status').length,0);
  fireEvent.click(screen.getByRole('button',{name:'重试候选'}));
  assert.ok(screen.getByRole('status'));
  await act(async()=>{resolveRequest([]);await Promise.resolve()});
  assert.ok(screen.getByText('无候选'));
  assert.equal(screen.queryAllByRole('alert').length,0);
  fireEvent.click(screen.getByRole('button',{name:'确定'}));
  assert.equal(commits.length,1);assert.equal(commits[0].key,'b');
  cleanup();for(const element of elements)element.remove();
 }
 console.log('Published Sheet and formal CSS: delayed candidates, failure/retry, both style orders, CSS declarations and DOM height-chain wiring: PASS (not browser geometry)');
}

async function ordinarySingles(){
 let confirmed;let confirms=0;
 function SingleHost(){
  const [open,setOpen]=React.useState(true);
  return h(MobileOptionPickerSheet,{open,title:'普通单选',items:candidates,selectedKeys:['a'],selectionMode:'single',onSelectedKeysChange(){},onConfirm(payload){confirmed=payload;confirms++;setOpen(false)},onClose(){setOpen(false)}});
 }
 render(h(SingleHost));
 fireEvent.click(screen.getByText('候选乙'));
 assert.deepEqual(confirmed.selectedKeys,['b'],'ordinary single selection remains immediate');
 assert.equal(confirms,1);assert.equal(screen.queryAllByRole('dialog').length,0);cleanup();
 for(const identityKind of ['user','department']){
  let value;let calls=0;
  render(h(MobileIdentityField,{fieldName:'身份候选',identityKind,items:candidates,value:'a',selectedItems:[candidates[0]],selectionMode:'single',onChange(next){value=next;calls++}}));
  fireEvent.click(screen.getByRole('button'));
  fireEvent.click(screen.getByText('候选乙'));
  assert.equal(value,'b');assert.equal(calls,1,'identity single selection remains immediate');
  assert.equal(screen.queryAllByRole('dialog').length,0);cleanup();
 }
 console.log('Published option and identity single-selection semantics: PASS');
}

async function search(){
 let renders=0;
 function Host({phone}){
  const [query,setQuery]=React.useState('');
  renders++;
  const Search=phone?MobileRecordSearch:DesktopRecordSearch;
  return h(React.Fragment,null,h(Search,{value:query,onChange:setQuery,onApply(){},onCompositionStart(){},onCompositionEnd(){},onCompositionCancel(){},label:'搜索记录'}),h('output',null,query));
 }
 const view=render(h(Host,{phone:false}));
 assert.ok(document.querySelector('.ant-input-search'),'desktop uses the installed main-library search');
 fireEvent.change(screen.getByRole('searchbox',{name:'搜索记录'}),{target:{value:'shared query'}});
 assert.equal(screen.getByRole('status').textContent,'shared query');
 view.rerender(h(Host,{phone:true}));
 assert.equal(screen.getByRole('searchbox',{name:'搜索记录'}).value,'shared query','switching the View preserves the host query');
 assert.equal(document.querySelector('.ant-input-search'),null,'phone keeps its frozen native search');
 fireEvent.change(screen.getByRole('searchbox',{name:'搜索记录'}),{target:{value:'phone query'}});
 view.rerender(h(Host,{phone:false}));
 assert.equal(screen.getByRole('searchbox',{name:'搜索记录'}).value,'phone query');
 assert.ok(renders>1);cleanup();
 console.log('Official AntD desktop search and controlled cross-View query: PASS');
}

async function list(){
 let creates=0;let edits=0;let opens=0;const navigationSelections=[];
 const navigation={ariaLabel:'列表导航',activeKey:'object',items:[{key:'object',label:'对象',icon:h('span',null,'O')}],onSelect:key=>navigationSelections.push(key)};
 const common={query:'',onQueryChange(){},onQueryApply(){},onQueryCompositionStart(){},onQueryCompositionEnd(){},onQueryCompositionCancel(){},searchLabel:'搜索记录',emptyContent:'没有记录',navigation,create:{label:'新建记录',onClick(){creates++}}};
 const theme=toMobileBrandTheme({primary:'#a132c8',onPrimary:'#fdfcfa',primarySoft:'#faeafa',surface:'#111',page:'#000',fontFamily:'Desktop Font',controlRadius:'99px'});
 const wrap=(props)=>h(MakeMobileThemeProvider,{theme},h(MobileRecordList,props));
 const view=render(wrap({...common,items:[{key:'a',title:h('a',{href:'https://example.test/record-link',onClick:event=>event.preventDefault()},'记录链接'),onOpen(){opens++},openLabel:'查看记录详情',content:h('p',null,'记录正文'),actions:[{key:'edit',label:'编辑记录',onClick(){edits++}}]}]}));
 const root=document.querySelector('.makeui-mobile-record-list');
 assert.equal(root.style.getPropertyValue('--make-mobile-primary'),'#a132c8');
 assert.equal(root.style.getPropertyValue('--make-mobile-on-primary'),'#fdfcfa');
 for(const property of ['--make-mobile-page','--make-mobile-surface','--make-mobile-font-family','--make-mobile-control-radius']) assert.equal(root.style.getPropertyValue(property),'','PC geometry and surfaces must not enter the phone theme');
 const fab=()=>screen.getByRole('button',{name:'新建记录'});
 for(const safeBottom of [0,40]){
  navigationHeight=60+safeBottom;
  await act(async()=>{for(const observer of observers) observer.callback([])});
  const bottom=parseFloat(fab().style.bottom);
  assert.equal(bottom,navigationHeight+8,'FAB public bottom must include the whole measured navigation exactly once');
  const navigationTop=844-navigationHeight;
  const fabBottom=844-bottom;
  assert.equal(navigationTop-fabBottom,8,'FAB synthetic geometry preserves the 8px gap, including the safe area');
 }
 fireEvent.click(fab());assert.equal(creates,1);
 fireEvent.click(screen.getByRole('button',{name:'查看记录详情'}));assert.equal(opens,1,'the host detail callback has an accessible entry');
 fireEvent.click(screen.getByText('记录正文'));assert.equal(opens,2,'card noninteractive content opens detail once');
 fireEvent.click(screen.getByRole('link',{name:'记录链接'}));assert.equal(opens,2,'URL navigation must not also open record detail');
 fireEvent.click(screen.getByRole('button',{name:'编辑记录'}));assert.equal(edits,1);assert.equal(opens,2,'record edit must not also open detail');
 fireEvent.click(screen.getByRole('button',{name:'对象'}));assert.deepEqual(navigationSelections,['object']);
 for(const query of ['', 'no results']){
  view.rerender(wrap({...common,query,items:[]}));
  assert.ok(screen.getByText('没有记录'));
  assert.equal(screen.getAllByRole('button',{name:'新建记录'}).length,1,'empty and searched-empty lists retain one authorized create entry');
  assert.equal(screen.getAllByRole('navigation',{name:'列表导航'}).length,1);
 }
 view.rerender(wrap({...common,items:[],create:undefined}));
 assert.equal(screen.queryByRole('button',{name:'新建记录'}),null,'the host alone supplies creation eligibility');
 cleanup();assert.equal(observers.size,0,'measurement subscriptions clean up');
 console.log('Published navigation/FAB composition, safe area and all list states: PASS');
}
async function cardInteractionBoundaries(){
 let opens=0;
 const navigation={ariaLabel:'交互隔离导航',items:[{key:'object',label:'对象',icon:'O'}],onSelect(){}};
 const content=h(React.Fragment,null,
  h('details',null,h('summary',null,'展开字段说明'),h('p',null,'补充正文')),
  h('video',{controls:true,'aria-label':'视频控件'}),
  h('audio',{controls:true,'aria-label':'音频控件'}),
  h('div',{contentEditable:'',suppressContentEditableWarning:true},h('span',null,'编辑区域')),
  h('div',{'data-makeui-card-interactive':''},h('span',null,'自定义交互区域')),
  h('div',{onClick:event=>event.preventDefault()},h('span',null,'宿主已处理点击')),
  h('p',null,'普通空白内容'));
 render(h(MobileRecordList,{query:'',onQueryChange(){},onQueryApply(){},onQueryCompositionStart(){},onQueryCompositionEnd(){},onQueryCompositionCancel(){},searchLabel:'搜索记录',emptyContent:'没有记录',navigation,items:[{key:'a',title:'记录甲',content,onOpen(){opens++},openLabel:'打开独立详情'}]}));
 for(const label of ['展开字段说明','编辑区域','自定义交互区域','宿主已处理点击']){
  fireEvent.click(screen.getByText(label));assert.equal(opens,0,label+' must keep its own host interaction without opening detail');
 }
 for(const label of ['视频控件','音频控件']){
  fireEvent.click(screen.getByLabelText(label));assert.equal(opens,0,label+' native controls must not also open detail');
 }
 fireEvent.click(screen.getByText('普通空白内容'));assert.equal(opens,1);
 fireEvent.click(screen.getByRole('button',{name:'打开独立详情'}));assert.equal(opens,2,'the native keyboard detail entry remains independent');
 cleanup();
 console.log('Card summary/media/editable and declared custom interaction boundaries: PASS');
}
(async()=>{assertStyles();if(process.argv[3]==='lookup-only'){await lookup();dom.window.close();return;}await lookupKeyboard();await cardInteractionBoundaries();await lookupBrandColors();await lookupCandidateFeedback();await lookupWithoutSearch();await lookup();await ordinarySingles();await search();await list();dom.window.close()})().catch(error=>{console.error(error);process.exitCode=1});
`;

function runFixture(directory, section) {
  return spawnSync(process.execPath, [path.join(directory, 'runtime.cjs'), directory, ...(section ? [section] : [])], { encoding: 'utf8', timeout: 30000 });
}

test('copied patterns typecheck and exercise real React, AntD and published mobile components', { skip: dependencies ? false : 'pass --dependencies=<UI directory with node_modules> for the real-component suite' }, () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'makeui-record-patterns-'));
  try {
    fs.symlinkSync(path.join(path.resolve(dependencies), 'node_modules'), path.join(temporary, 'node_modules'), 'dir');
    fs.cpSync(source, path.join(temporary, 'record-page-patterns'), { recursive: true });
    fs.copyFileSync(path.join(skillRoot, 'assets/mobile-brand-theme.mjs'), path.join(temporary, 'mobile-brand-theme.mjs'));
    fs.writeFileSync(path.join(temporary, 'runtime.cjs'), runtime);
    fs.writeFileSync(path.join(temporary, 'tsconfig.json'), JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,esModuleInterop:true,skipLibCheck:true,noEmit:true,lib:['ES2022','DOM']},include:['record-page-patterns/**/*']}));
    const types = spawnSync(process.execPath, [path.join(temporary, 'node_modules/typescript/bin/tsc'), '-p', path.join(temporary, 'tsconfig.json')], { encoding: 'utf8', timeout: 30000 });
    assert.equal(types.status, 0, `copied public-API typecheck:\n${types.stdout}\n${types.stderr}`);
    const actual = runFixture(temporary);
    assert.equal(actual.status, 0, `real-component suite:\n${actual.stdout}\n${actual.stderr}`);
    for (const message of ['Lookup explicit draft', 'Published option and identity', 'Official AntD desktop search', 'Published navigation/FAB composition']) assert.match(actual.stdout, new RegExp(message));

    const lookupFile = path.join(temporary, 'record-page-patterns/mobile-lookup-picker.tsx');
    const lookupOriginal = fs.readFileSync(lookupFile, 'utf8');
    fs.writeFileSync(lookupFile, `import {MobileSearchPickerSheet} from '@qfei-design/make-app-mobile/pickers';\nexport function MobileLookupPicker(props){if(!props.search)return <Original {...props}/>;return <MobileSearchPickerSheet {...props} title={props.title} searchValue={props.search.value} onSearchValueChange={props.search.onChange} selectedKeys={props.value?[props.value.key]:[]} selectedItems={props.value?[props.value]:[]} selectionMode="single" onSelectedKeysChange={()=>{}} onConfirm={({selectedItems})=>props.onChange(selectedItems[0])}/>;}\n${lookupOriginal.replace('export function MobileLookupPicker(', 'function Original(')}`);
    const immediate = runFixture(temporary, 'lookup-only');
    assert.notEqual(immediate.status, 0, 'misusing the real single picker for Lookup must fail');
    assert.match(immediate.stderr, /Lookup candidate clicks must not commit/);
    fs.writeFileSync(lookupFile, lookupOriginal);

    const listFile = path.join(temporary, 'record-page-patterns/mobile-record-list.tsx');
    const listOriginal = fs.readFileSync(listFile, 'utf8');
    const overlapping = listOriginal.replace('bottom: navigationHeight + 8', 'bottom: 8');
    assert.notEqual(overlapping, listOriginal, 'FAB mutation must alter the public style');
    fs.writeFileSync(listFile, overlapping);
    const covered = runFixture(temporary);
    assert.notEqual(covered.status, 0, 'missing navigation clearance must fail');
    assert.match(covered.stderr, /FAB public bottom must include/);
    fs.writeFileSync(listFile, listOriginal);

    const doubledSafeArea = listOriginal.replace('bottom: navigationHeight + 8', 'bottom: navigationHeight + 8 + (navigationHeight - 60)');
    assert.notEqual(doubledSafeArea, listOriginal, 'safe-area mutation must alter the public style');
    fs.writeFileSync(listFile, doubledSafeArea);
    const doubleSafe = runFixture(temporary);
    assert.notEqual(doubleSafe.status, 0, 'adding the safe area twice must fail at the 40px branch');
    assert.match(doubleSafe.stderr, /FAB public bottom must include/);
    fs.writeFileSync(listFile, listOriginal);

    const cssFile = path.join(temporary, 'record-page-patterns/styles.css');
    const cssOriginal = fs.readFileSync(cssFile, 'utf8');
    fs.writeFileSync(cssFile, cssOriginal.replaceAll('--make-mobile-primary', '--make-mobile-primary-color'));
    const wrongVariable = runFixture(temporary);
    assert.notEqual(wrongVariable.status, 0, 'invented theme variables must fail');
    assert.match(wrongVariable.stderr, /host emphasis must use the public primary variable/);
    fs.writeFileSync(cssFile, cssOriginal);
    console.log(actual.stdout.trim());
    console.log('Fault injection: actual single-picker Lookup misuse / missing FAB clearance / doubled 40px safe area / invented theme variables rejected');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
