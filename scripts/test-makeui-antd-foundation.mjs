import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const themeUrl = new URL('../skills/makeui/assets/antd-foundation/theme.mjs', import.meta.url);
const theme = () => import(themeUrl.href);

test('MakeDesign colors, control overrides and semantic colors become official Ant Design tokens without changing the plan', async () => {
  const { toAntdTokens, isDarkDesign } = await theme();
  const design = {
    choices: { theme: 'dark' },
    colors: { accent: '#f54e00', bg: '#141414', surface: '#1f1f1f', fg: '#efefef', muted: '#aaaaaa', border: '#444444', success: '#34b663', warn: '#ffc53d', danger: '#ff4d4f' },
    controls: { style: { '--mk-accent': '#ff5600', '--mk-ink': '#ffffff', '--mk-height': '42px', '--mk-radius': '7px', '--mk-font': 'Example Sans', '--mk-hover': '#3f302a' } },
    metrics: { bodySize: 15, headingSize: 26, lineHeight: 1.6, controlHeight: 36, radius: 4 },
  };
  const before = structuredClone(design);
  const tokens = toAntdTokens(design);
  assert.equal(isDarkDesign(design), true);
  assert.equal(tokens.colorPrimary, '#ff5600');
  assert.equal(tokens.colorText, '#ffffff');
  assert.equal(tokens.colorBgLayout, '#141414');
  assert.equal(tokens.colorBgContainer, '#1f1f1f');
  assert.equal(tokens.colorSuccess, '#34b663');
  assert.equal(tokens.colorWarning, '#ffc53d');
  assert.equal(tokens.colorError, '#ff4d4f');
  assert.equal(tokens.colorBorder, '#444444');
  assert.equal(tokens.controlHeight, 42);
  assert.equal(tokens.borderRadius, 7);
  assert.equal(tokens.fontFamily, 'Example Sans');
  assert.equal(tokens.fontSize, 15);
  assert.equal(tokens.lineHeight, 1.6);
  assert.equal(tokens.controlItemBgHover, '#3f302a');
  assert.equal(tokens.colorBgTextHover, '#3f302a');
  assert.deepEqual(design, before);
});

test('v1 metrics remain usable when a plan has no control override, and malformed dimensions cannot poison CSS', async () => {
  const { toAntdTokens, toMakeDesignVariables } = await theme();
  const design = { metrics: { bodySize: 16, headingSize: 28, padding: 24, controlHeight: 38, radius: 6 }, controls: { style: { '--mk-size': 'invalid', '--mk-height': 'NaNpx', '--mk-radius': '-4px' } } };
  assert.equal(toAntdTokens(design).controlHeight, 38);
  assert.equal(toAntdTokens(design).borderRadius, 6);
  assert.equal(toAntdTokens(design).fontSize, 16);
  const variables = toMakeDesignVariables(design);
  assert.equal(variables['--makeui-content-padding'], '24px');
  assert.equal(variables['--makeui-heading-size'], '28px');
  assert.equal(variables['--makeui-radius'], '6px');
});

test('detail density follows selected typography and row metrics while leaving multiline items free to grow', async () => {
  const { toMakeDesignVariables } = await theme();
  const compact = toMakeDesignVariables({ metrics: { bodySize: 14, lineHeight: 1.5, rowHeight: 40 } });
  assert.equal(compact['--makeui-font-size'], '14px');
  assert.equal(compact['--makeui-line-height'], '1.5');
  assert.equal(compact['--makeui-detail-row-height'], '40px');
  assert.equal(compact['--makeui-detail-row-padding'], '9px');
  const comfortable = toMakeDesignVariables({ metrics: { bodySize: 20, lineHeight: 1.6, rowHeight: 64 } });
  assert.equal(comfortable['--makeui-font-size'], '20px');
  assert.equal(comfortable['--makeui-detail-row-height'], '64px');
  assert.equal(comfortable['--makeui-detail-row-padding'], '15.5px');
  const largeText = toMakeDesignVariables({ metrics: { bodySize: 28, rowHeight: 40 } });
  assert.equal(largeText['--makeui-detail-row-padding'], '4px');
  const invalid = toMakeDesignVariables({ metrics: { rowHeight: -20 } });
  assert.equal(invalid['--makeui-detail-row-height'], '44px');
  const css = fs.readFileSync(new URL('../skills/makeui/assets/antd-foundation/styles.css', import.meta.url), 'utf8');
  for (const tag of ['dt', 'dd']) {
    const rule = css.match(new RegExp(`\\.makeui-antd-detail-item > ${tag}\\s*\\{([^}]+)\\}`))?.[1];
    assert.match(rule ?? '', new RegExp(`font-size:\\s*var\\(--makeui-role-${tag === 'dt' ? 'meta' : 'body'}-size`));
    assert.match(rule ?? '', /line-height:\s*var\(--makeui-line-height/);
  }
  const item = css.match(/\.makeui-antd-detail-item\s*\{([^}]+)\}/)?.[1];
  assert.match(item ?? '', /min-height:\s*var\(--makeui-detail-row-height/);
  assert.match(item ?? '', /padding:\s*var\(--makeui-detail-row-padding/);
  assert.doesNotMatch(item ?? '', /(?:^|;)\s*(?:height|max-height|overflow):/);
});

test('dark theme selection is explicit and can also be read from the v1 control style', async () => {
  const { isDarkDesign } = await theme();
  assert.equal(isDarkDesign({ choices: { theme: 'dark' } }), true);
  assert.equal(isDarkDesign({ controls: { style: { '--mk-mode': 'dark' } } }), true);
  assert.equal(isDarkDesign({ choices: { theme: 'light' }, controls: { style: { '--mk-mode': 'dark' } } }), false);
  assert.equal(isDarkDesign({}), false);
});

test('selected detail surfaces do not overwrite the platform create and edit defaults', async () => {
  const { resolveRecordSurface } = await theme();
  for (const mode of ['create', 'edit']) {
    for (const detailOpening of ['page', 'drawer', 'wide-drawer', 'system']) {
      assert.deepEqual(resolveRecordSurface({ choices: { detailOpening } }, mode), { kind: 'drawer', size: '60%' });
    }
  }
  assert.deepEqual(resolveRecordSurface({ choices: { detailOpening: 'page' } }, 'detail'), { kind: 'page' });
  assert.deepEqual(resolveRecordSurface({ choices: { detailOpening: 'drawer' } }, 'detail'), { kind: 'drawer', size: 'min(560px, 88vw)' });
  assert.deepEqual(resolveRecordSurface({ choices: { detailOpening: 'wide-drawer' } }, 'detail'), { kind: 'drawer', size: 'min(960px, 88vw)' });
  assert.deepEqual(resolveRecordSurface({}, 'detail'), { kind: 'drawer', size: '60%' });
  assert.deepEqual(resolveRecordSurface({ choices: { detailOpening: 'drawer' }, layout: { structure: { widths: { drawer: 640 } } } }, 'detail'), { kind: 'drawer', size: 'min(640px, 88vw)' });
});

test('app presentation follows explicit navigation, resolved widths, recipe surfaces and applicable slots without mutating the handoff', async () => {
  const { resolveAppPresentation, toMakeDesignVariables } = await theme();
  const design = { choices: { navigation: 'double', icon: 'thin', motion: 'reduced', tuning: { fine: { shadow: 'raised' } } }, colors: { 'sidebar-bg': '#123456', 'sidebar-fg': '#abcdef', 'sidebar-active': '#234567' }, metrics: { padding: 36, tracking: -.04 }, controls: { style: { '--mk-mono-font': 'Example Mono' } }, layout: { recipe: { nav: 'top', surface: 'inset' }, presentation: { id: 'aurora' }, componentSuite: { id: 'line', rules: { action: 'outline', field: 'inset', panels: 'flat', tabs: 'underline', status: 'outline' } }, structure: { resolvedNavigation: { mode: 'top', singleSidebar: 216, primaryRail: 70, secondarySidebar: 196, rail: 72, workspaceSidebar: 256 } }, secondaryCards: { enabled: false, resolvedStyle: 'soft', applicability: 'Existing cards only' } }, illustration: { id: 'orbit', path: 'assets/orbit.png' } };
  const before = structuredClone(design);
  const result = resolveAppPresentation(design);
  assert.equal(result.navigation.mode, 'double');
  assert.equal(result.navigation.widths.primaryRail, 70);
  assert.equal(result.navigation.widths.secondarySidebar, 196);
  assert.equal(result.surface, 'inset');
  assert.equal(result.presentationId, 'aurora');
  assert.equal(result.componentSuite.rules.action, 'outline');
  assert.equal(result.applicability.secondaryCards, 'disabled');
  assert.equal(result.applicability.illustration, 'host-slot-only');
  const variables = toMakeDesignVariables(design);
  assert.equal(variables['--makeui-sidebar-bg'], '#123456');
  assert.equal(variables['--makeui-sidebar-active'], '#234567');
  assert.equal(variables['--makeui-tracking'], '-0.04em');
  assert.equal(variables['--makeui-mono-font'], 'Example Mono');
  assert.equal(variables['--makeui-gap'], '24px');
  assert.equal(variables['--makeui-icon-stroke'], '1.25');
  assert.equal(variables['--makeui-motion-duration'], '0ms');
  assert.match(variables['--makeui-shadow'], /24px/);
  assert.deepEqual(design, before);
  assert.equal(resolveAppPresentation({ layout: { recipe: { nav: 'rail' } } }).navigation.mode, 'rail');
  assert.equal(resolveAppPresentation({ layout: { recipe: { nav: 'workspace' } } }).navigation.widths.workspaceSidebar, 240);
  assert.ok(resolveAppPresentation({ layout: { recipe: { nav: 'workspace' } } }).fallbacks.includes('workspaceSidebar:contract-default:240'));
  assert.equal(resolveAppPresentation({ choices: { navigation: 'single' }, layout: { recipe: { nav: 'workspace' } } }).navigation.mode, 'single');
  assert.equal(resolveAppPresentation().navigation.mode, 'single');
});

test('business typography consumes independent owner roles once, records old-payload fallbacks and separates body tracking', async () => {
  const { resolveTypography, toMakeDesignVariables, toAntdTokens, toAntdComponentTokens, toMakeMobileTheme } = await theme();
  const roles = { pageTitle: 28, recordTitle: 19, sectionTitle: 16, body: 15, fieldLabel: 13, controlText: 14, meta: 11, phoneHeader: 17, sheetTitle: 18, sheetHeading: 16, sheetBody: 14, sheetMeta: 12 };
  const design = { metrics: { bodySize: 18, headingSize: 32, tracking: -.03 }, controls: { style: { '--mk-size': '18px', '--mk-heading-size': '32px' } }, typography: { contract: 'makeui-business-typography/v1', roles, tracking: { body: 0, heading: -.03 }, sources: Object.fromEntries(Object.keys(roles).map(key => [key, 'owner:' + key])) } };
  const before = structuredClone(design);
  const resolved = resolveTypography(design);
  assert.deepEqual(resolved.roles, roles);
  assert.equal(resolved.sources.recordTitle, 'owner:recordTitle');
  assert.equal(resolved.tracking.body, 0);
  assert.equal(resolved.tracking.heading, -.03);
  const variables = toMakeDesignVariables(design);
  assert.equal(variables['--makeui-font-size'], '15px');
  assert.equal(variables['--makeui-role-page-title-size'], '28px');
  assert.equal(variables['--makeui-role-record-title-size'], '19px');
  assert.equal(variables['--makeui-role-meta-size'], '11px');
  assert.equal(variables['--makeui-heading-size'], '32px', 'legacy display value remains available without becoming a business title');
  assert.equal(variables['--makeui-tracking'], '0em');
  assert.equal(variables['--makeui-heading-tracking'], '-0.03em');
  assert.equal(toAntdTokens(design).fontSize, 15);
  const components = toAntdComponentTokens(design);
  assert.equal(components.Form.labelFontSize, 13);
  for (const key of ['Input', 'InputNumber', 'Select', 'DatePicker', 'TimePicker', 'Cascader', 'TreeSelect', 'AutoComplete']) assert.equal(components[key].fontSize, 14, key + ' uses the control text role');
  assert.equal(components.Input.inputFontSize, 14);
  assert.equal(components.Select.optionFontSize, 14);
  assert.equal(components.Tag.fontSizeSM, 11);
  const mobile = toMakeMobileTheme(design);
  assert.deepEqual(Object.fromEntries(['contentSize','fieldLabelSize','controlTextSize','pageHeaderSize','sheetTitleSize','sheetHeadingSize','sheetBodySize','sheetMetaSize'].map(key=>[key,mobile[key]])), {contentSize:'15px',fieldLabelSize:'13px',controlTextSize:'14px',pageHeaderSize:'17px',sheetTitleSize:'18px',sheetHeadingSize:'16px',sheetBodySize:'14px',sheetMetaSize:'12px'});
  assert.equal(mobile.letterSpacing, '0em');
  const old = resolveTypography({ metrics: { bodySize: 18, headingSize: 32, tracking: .06 } });
  assert.equal(old.roles.body, 18);
  assert.equal(old.roles.pageTitle, 32);
  assert.match(old.sources.pageTitle, /legacy/);
  assert.equal(old.roles.recordTitle, 16);
  assert.equal(old.roles.phoneHeader, 16);
  assert.equal(old.roles.sheetMeta, 13);
  assert.equal(old.tracking.body, .06);
  assert.match(old.sources.body, /legacy/);
  assert.match(old.sources.recordTitle, /official/);
  assert.match(old.sources['tracking.body'], /legacy/);
  const invalid = resolveTypography({ typography: { roles: { body: 0, recordTitle: -1, controlText: NaN, meta: Infinity } } });
  assert.equal(invalid.roles.body, 14);assert.equal(invalid.roles.recordTitle, 16);assert.equal(invalid.roles.controlText, 14);assert.equal(invalid.roles.meta, 12);
  const fontOnly = { typography: { body: 'Owner Body', heading: 'Owner Heading', mono: 'Owner Mono' } };
  assert.equal(toAntdTokens(fontOnly).fontFamily, 'Owner Body');
  assert.equal(toMakeDesignVariables(fontOnly)['--makeui-heading-font'], 'Owner Heading');
  assert.equal(toMakeDesignVariables(fontOnly)['--makeui-mono-font'], 'Owner Mono');
  assert.deepEqual(design, before);
});

test('field spans follow field type rather than the label or candidate values', async () => {
  const { isWideField } = await theme();
  for (const fieldType of ['Make.Field.TextArea', 'Make.Field.URL', 'Make.Field.File', 'Make.Field.Lookup']) assert.equal(isWideField(fieldType), true);
  for (const fieldType of ['Make.Field.Text', 'Make.Field.SingleSelect', 'Make.Field.MultiSelect', 'Make.Field.Date', 'Make.Field.DateRange', 'constructor', '__proto__', undefined]) assert.equal(isWideField(fieldType), false);
});

test('the surface heading consumes the selected typography variable and preserves a shrinkable title slot', () => {
  const css = fs.readFileSync(new URL('../skills/makeui/assets/antd-foundation/styles.css', import.meta.url), 'utf8');
  const heading = css.match(/\.makeui-antd-surface-heading\s*\{([^}]+)\}/)?.[1];
  assert.ok(heading);
  assert.match(heading, /font-size:\s*var\(--makeui-role-record-title-size/);
  assert.match(heading, /min-width:\s*0/);
  assert.match(heading, /text-overflow:\s*ellipsis/);
});

test('owned title and brand rules use semantic sizes and keep narrow navigation text on one line', () => {
  const css = fs.readFileSync(new URL('../skills/makeui/assets/antd-foundation/styles.css', import.meta.url), 'utf8');
  const shellTitle = css.match(/\.makeui-antd-shell-title\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(shellTitle, /font-size:\s*var\(--makeui-role-record-title-size/);
  assert.match(shellTitle, /letter-spacing:\s*var\(--makeui-heading-tracking/);
  const label = css.match(/\.makeui-antd-shell-brand-label\s*\{([^}]+)\}/)?.[1] ?? '';
  for (const rule of [/min-width:\s*0/, /overflow:\s*hidden/, /white-space:\s*nowrap/, /text-overflow:\s*ellipsis/]) assert.match(label, rule);
  assert.match(css, /data-navigation='double'[^}]+makeui-antd-shell-brand[^}]+padding-inline:\s*min\(/);
  assert.match(css, /data-navigation='rail'[^}]+makeui-antd-shell-brand[^}]+padding-inline:\s*min\(/);
});

test('mobile themes preserve the current plan through public semantic tokens without changing Make phone geometry', async () => {
  const { toMakeMobileTheme } = await theme();
  const design = {
    choices: { theme: 'dark', icon: 'thin', motion: 'reduced', tuning: { fine: { shadow: 'raised' } } },
    colors: { accent: '#edb944', 'accent-on': '#271c04', surface: '#252116', bg: '#16130e', fg: '#f2e7cf', muted: '#b6a98a', meta: '#a59472', border: '#625435', 'border-soft': '#413822' },
    metrics: { bodySize: 18, headingSize: 30, lineHeight: 1.7, tracking: .06, radius: 14, controlHeight: 46 },
    controls: { style: { '--mk-font': 'Example Serif', '--mk-mono-font': 'Example Mono', '--mk-hover': '#3b321a', '--mk-action-radius': '18px' } },
    layout: { componentSuite: { rules: { action: 'outline', field: 'inset' } } },
  };
  const before = structuredClone(design);
  const mobile = toMakeMobileTheme(design);
  assert.equal(mobile.primary, '#edb944');
  assert.equal(mobile.onPrimary, '#271c04');
  assert.equal(mobile.actionBackground, 'transparent');
  assert.equal(mobile.actionText, '#edb944');
  assert.equal(mobile.actionBorder, '#edb944');
  assert.equal(mobile.primarySoft, '#3b321a');
  assert.equal(mobile.surface, '#252116');
  assert.equal(mobile.page, '#16130e');
  assert.equal(mobile.controlSurface, '#16130e');
  assert.equal(mobile.text, '#f2e7cf');
  assert.equal(mobile.line, '#413822');
  assert.equal(mobile.controlBorder, '#625435');
  assert.equal(mobile.fontFamily, 'Example Serif');
  assert.equal(mobile.monoFontFamily, 'Example Mono');
  assert.equal(mobile.contentSize, '18px');
  assert.equal(mobile.sheetBodySize, '14px');
  assert.equal(mobile.sheetTitleSize, '16px');
  assert.equal(mobile.lineHeight, '1.7');
  assert.equal(mobile.letterSpacing, '0.06em');
  assert.equal(mobile.controlRadius, '14px');
  assert.equal(mobile.actionRadius, '18px');
  assert.equal(mobile.iconStroke, '1.25');
  assert.equal(mobile.motionDuration, '0ms');
  assert.match(mobile.shadow, /24px/);
  assert.doesNotMatch(mobile.shadow, /var\(--makeui-/);
  for (const fixed of ['touchHeight', 'wheelHeight', 'sheetRadius', 'navigationMode']) assert.equal(fixed in mobile, false);
  const compact = toMakeMobileTheme({ metrics: { bodySize: 12, headingSize: 20, radius: 0 } });
  assert.equal(compact.contentSize, '12px');
  assert.equal(compact.controlRadius, '0px');
  assert.deepEqual(design, before);
});

const dependencyRoot = process.argv.find((arg) => arg.startsWith('--dependencies='))?.slice('--dependencies='.length);
const domDependencyRoot = process.argv.find((arg) => arg.startsWith('--dom-dependencies='))?.slice('--dom-dependencies='.length);

const domFixture = String.raw`
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const external = createRequire(path.join(process.argv[2], '__makeui_dom__.cjs'));
const {JSDOM} = external('jsdom');
const dom = new JSDOM('<!doctype html><html><body style="letter-spacing:normal"><button id="outside">外部按钮</button><div id="app"></div><div id="custom-popup-host"></div></body></html>', {pretendToBeVisual:true,url:'https://example.test/'});
for (const key of ['window','document','HTMLElement','HTMLBodyElement','HTMLHtmlElement','Element','Node','SVGElement','ShadowRoot','Document','MutationObserver']) globalThis[key] = key === 'window' ? dom.window : dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = query => ({matches:false,media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
globalThis.ResizeObserver = class {observe(){}unobserve(){}disconnect(){}};
const React = require('react');
const act = React.act ?? require('react-dom/test-utils').act;
const {createRoot} = require('react-dom/client');
const {Form,Input,Button,Select,DatePicker,TimePicker,Cascader,InputNumber,ConfigProvider,Drawer,Modal,Dropdown,theme:antdTheme} = require('antd');
const dayjs = require('dayjs');
const {MakeDesignProvider,MakeFormLayout,MakeFormItem,MakeAppShell,MakeRecordSurface,MakeTabs,useMakeDesign} = require('./foundation.cjs');
const filledPlan={colors:{accent:'#c43816','accent-on':'#ffffff'},layout:{componentSuite:{rules:{tabs:'filled'}}}};
const underlinePlan={...filledPlan,layout:{componentSuite:{rules:{tabs:'underline'}}}};
function tabItems(){return [{key:'first',label:'First',children:React.createElement(TabDraft)},{key:'second',label:'Second',children:'Second content'},{key:'disabled',label:'Disabled',disabled:true,children:'Disabled content'}];}
function TabDraft(){const [count,setCount]=React.useState(0);return React.createElement('button',{id:'tab-draft',onClick:()=>setCount(value=>value+1)},'Draft '+count);}
function TabsHarness({design=filledPlan,...props}){return React.createElement(MakeDesignProvider,{design},React.createElement(MakeTabs,{items:tabItems(),...props}));}
async function formLabelRegression(root){
 const cases=[
  {key:'false',label:false},
  {key:'empty',label:''},
  {key:'null',label:null},
  {key:'undefined',label:undefined},
  {key:'zero',label:0,visible:true},
  {key:'true',label:true,visible:true},
  {key:'string',label:'设备名称',visible:true},
  {key:'node',label:React.createElement('span',null,'设备名称'),visible:true},
 ];
 const initialValues=Object.fromEntries(cases.map(({key})=>[key,'saved '+key]));
 const submissions={native:[],foundation:[]};
 const forms={};
 function LabelForms(){
  [forms.native]=Form.useForm();[forms.foundation]=Form.useForm();
  const fields=Item=>cases.map(({key,label})=>React.createElement(Item,{key,name:key,label,...(Item===MakeFormItem?{fieldType:'Make.Field.Text'}:{}),className:'label-case-'+key,rules:[{required:true,message:'Required '+key}]},React.createElement(Input)));
  return React.createElement(MakeDesignProvider,null,
   React.createElement(Form,{name:'native-labels',form:forms.native,layout:'vertical',colon:false,className:'label-native',initialValues,onFinish:values=>submissions.native.push(values)},fields(Form.Item)),
   React.createElement(MakeFormLayout,{name:'foundation-labels',form:forms.foundation,className:'label-foundation',initialValues,onFinish:values=>submissions.foundation.push(values)},fields(MakeFormItem)));
 }
 await act(async()=>root.render(React.createElement(LabelForms)));
 const item=(kind,key)=>document.querySelector('.label-'+kind+' .label-case-'+key);
 for(const {key,visible} of cases){
  const native=item('native',key),wrapped=item('foundation',key);
  const nativeLabels=native.querySelectorAll('label');
  assert.equal(nativeLabels.length,visible?1:0,'the official Form.Item establishes the '+key+' label contract');
  assert.equal(wrapped.querySelectorAll('label').length,nativeLabels.length,'MakeFormItem must preserve the official '+key+' label visibility');
  assert.equal(wrapped.querySelectorAll('.makeui-antd-field-label').length,visible?1:0,'only a visible '+key+' label gets one foundation wrapper');
  assert.equal(wrapped.querySelectorAll('label svg').length,visible?1:0,'only a visible '+key+' label gets one field icon');
  for(const kind of ['native','foundation'])assert.equal(item(kind,key).querySelector('input').value,initialValues[key],kind+' retains the initial '+key+' field binding');
  if(visible){
   assert.equal(wrapped.querySelector('label').textContent,nativeLabels[0].textContent,'a '+key+' label keeps one copy of its original content');
   assert.equal(wrapped.querySelector('label').htmlFor,wrapped.querySelector('input').id,'the visible '+key+' label remains associated with its official input');
  }
 }
 const updated=Object.fromEntries(cases.map(({key})=>[key,'updated '+key]));
 await act(async()=>{forms.native.setFieldsValue(updated);forms.foundation.setFieldsValue(updated);});
 for(const {key} of cases)for(const kind of ['native','foundation'])assert.equal(item(kind,key).querySelector('input').value,updated[key],kind+' retains controlled '+key+' updates');
 await act(async()=>{forms.native.submit();forms.foundation.submit();});
 await waitFor(()=>submissions.native.length===1&&submissions.foundation.length===1);
 assert.deepEqual(submissions.native,[updated]);assert.deepEqual(submissions.foundation,submissions.native,'label adaptation cannot change submitted field values');
 const emptyValues=Object.fromEntries(cases.map(({key})=>[key,'']));
 await act(async()=>{
  forms.native.setFieldsValue(emptyValues);forms.foundation.setFieldsValue(emptyValues);
  await Promise.allSettled([forms.native.validateFields(),forms.foundation.validateFields()]);
 });
 await waitFor(()=>document.querySelectorAll('.label-foundation .ant-form-item-explain-error').length===cases.length);
 for(const {key} of cases){
  assert.deepEqual(forms.native.getFieldError(key),['Required '+key]);
  assert.deepEqual(forms.foundation.getFieldError(key),forms.native.getFieldError(key),'the '+key+' label retains the official validation result');
  for(const kind of ['native','foundation'])assert.equal(item(kind,key).querySelectorAll('.ant-form-item-explain-error').length,1,kind+' owns one '+key+' error slot');
 }
 await act(async()=>{forms.native.submit();forms.foundation.submit();});
 assert.equal(submissions.native.length,1);assert.equal(submissions.foundation.length,1,'invalid fields cannot submit after label adaptation');
 console.log('official Form.Item label visibility, single icons and field contracts: PASS');
}
function tabNode(scope,key){return scope.querySelector('[data-node-key="'+key+'"] > [role="tab"]');}
// jsdom cannot resolve custom-property colors through :has; exercise the real CSSOM
// against the actual selected DOM nodes, while browser verification owns final color/cascade.
function foundationStyles(node){const result={};for(const rule of style.sheet.cssRules){if(!rule.selectorText)continue;if(node.matches(rule.selectorText)){for(const name of ['background','background-color','color']){const value=rule.style.getPropertyValue(name);if(value)result[name]=value;}}}return result;}
function assertFilled(scope,key,selected){const tab=tabNode(scope,key);const item=tab.parentElement;assert.equal(tab.getAttribute('aria-selected'),String(selected));assert.equal(item.style.background,'','filled backgrounds must not paint the shared item slot');assert.ok(item.classList.contains('makeui-antd-tabs-filled-item'),'the public semantic item slot marks only this Tabs instance');const itemCss=foundationStyles(item);const tabCss=foundationStyles(tab);if(selected){assert.equal(itemCss.background??itemCss['background-color'],'var(--makeui-primary)','only the selected tab gets the accent background');assert.equal(tabCss.color,'var(--makeui-on-accent)','selected text overrides official primary text on the primary background');}else{assert.equal(itemCss.background??itemCss['background-color'],undefined,'inactive and disabled tabs keep the official background');assert.equal(tabCss.color,undefined,'inactive and disabled tabs keep the official text color');}}
async function tabsRegression(root){
 const host=document.querySelector('#app');let changes=[];
 await act(async()=>{root.render(React.createElement(TabsHarness,{onChange:key=>changes.push(key)}));});
 assertFilled(host,'first',true);assertFilled(host,'second',false);assertFilled(host,'disabled',false);
 await act(async()=>{tabNode(host,'first').focus();});assert.equal(document.activeElement,tabNode(host,'first'));assertFilled(host,'first',true);
 await act(async()=>{tabNode(host,'second').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));});
 assertFilled(host,'first',false);assertFilled(host,'second',true);assert.deepEqual(changes,['second']);
 await act(async()=>{tabNode(host,'disabled').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));});
 assertFilled(host,'second',true);assertFilled(host,'disabled',false);assert.deepEqual(changes,['second']);
 await act(async()=>{root.render(React.createElement(TabsHarness,{key:'default-second',defaultActiveKey:'second'}));});
 assertFilled(host,'second',true);assertFilled(host,'first',false);
 changes=[];
 await act(async()=>{root.render(React.createElement(TabsHarness,{key:'controlled',activeKey:'first',onChange:key=>changes.push(key)}));});
 await act(async()=>{tabNode(host,'second').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));});
 assertFilled(host,'first',true);assertFilled(host,'second',false);assert.deepEqual(changes,['second'],'controlled state changes only when the host updates activeKey');
 await act(async()=>{root.render(React.createElement(TabsHarness,{key:'controlled',activeKey:'second',onChange:key=>changes.push(key)}));});
 assertFilled(host,'second',true);
 for(const classNames of [{root:'host-tabs-root',item:'host-tabs-item'},({props})=>({root:'host-tabs-root',item:props.prefixCls==='custom-tabs'?'host-tabs-item':'wrong-prefix'})]){
  await act(async()=>{root.render(React.createElement(TabsHarness,{key:'custom-prefix',prefixCls:'custom-tabs',className:'host-class',classNames}));});
  assert.ok(host.querySelector('.custom-tabs.host-tabs-root.host-class'));assert.ok(tabNode(host,'first').parentElement.classList.contains('host-tabs-item'));assertFilled(host,'first',true);assertFilled(host,'second',false);
 }
 for(const type of ['line','editable-card']){
  await act(async()=>{root.render(React.createElement(TabsHarness,{key:type,type}));});
  assert.equal(Boolean(host.querySelector('.ant-tabs-card')),type==='editable-card','an explicit official type wins over the default filled card type');assertFilled(host,'first',true);
 }
 for(const styles of [{item:{background:'rgb(1, 2, 3)',color:'rgb(4, 5, 6)'}},({props})=>({item:{background:props.type==='card'?'rgb(1, 2, 3)':'rgb(9, 9, 9)',color:'rgb(4, 5, 6)'}})]){
  await act(async()=>{root.render(React.createElement(TabsHarness,{key:'custom-styles',styles,classNames:{item:'caller-item'}}));});
  for(const key of ['first','second']){const item=tabNode(host,key).parentElement;assert.equal(item.style.background,'rgb(1, 2, 3)');assert.equal(item.style.color,'rgb(4, 5, 6)');assert.ok(item.classList.contains('caller-item'));assert.equal(item.classList.contains('makeui-antd-tabs-filled-item'),false,'explicit styles replace the default filled skin');}
 }
 await act(async()=>{root.render(React.createElement(TabsHarness,{key:'scheme-switch'}));});
 const draft=document.querySelector('#tab-draft');await act(async()=>{draft.click();});assert.equal(draft.textContent,'Draft 1');
 await act(async()=>{root.render(React.createElement(TabsHarness,{key:'scheme-switch',design:underlinePlan}));});
 assert.equal(document.querySelector('#tab-draft'),draft);assert.equal(draft.textContent,'Draft 1');assert.equal(host.querySelectorAll('.makeui-antd-tabs-filled-item').length,0);assert.equal(host.querySelector('.ant-tabs-card'),null);
 const nested=React.createElement(MakeDesignProvider,{design:underlinePlan},React.createElement(MakeTabs,{className:'nested-underline',items:[{key:'nested-a',label:'Nested A',children:'Nested A content'},{key:'nested-b',label:'Nested B',children:'Nested B content'}]}));
 await act(async()=>{root.render(React.createElement(TabsHarness,{key:'nested',items:[{key:'outer',label:'Outer',children:nested}]}));});
 assertFilled(host,'outer',true);const nestedRoot=host.querySelector('.nested-underline');for(const key of ['nested-a','nested-b']){const tab=tabNode(nestedRoot,key);assert.equal(tab.parentElement.classList.contains('makeui-antd-tabs-filled-item'),false);assert.equal(foundationStyles(tab).color,undefined);assert.equal(foundationStyles(tab.parentElement).background,undefined);}
 console.log('official MakeTabs selection, host overrides and isolated skin: PASS');
}
async function shellSlotRegression(root){
 const slots=['brand','navigation','primaryNavigation','title','headerEnd','children'];
 const modes=['single','double','top','rail','workspace','single','top','single'];
 const mounts={};const unmounts={};const pulses={};const actions=[];
 const reset=()=>{for(const slot of slots){mounts[slot]=0;unmounts[slot]=0;pulses[slot]=0;}};
 reset();
 function HostSlot({slot,label,onAction}){
  const [count,setCount]=React.useState(0);
  const element=React.useRef(null);
  React.useLayoutEffect(()=>{assert.ok(element.current?.isConnected,'the '+slot+' slot must be connected before its layout effects run');},[slot]);
  React.useEffect(()=>{
   mounts[slot]++;
   const pulse=()=>{pulses[slot]++;};
   window.addEventListener('makeui-shell-slot-pulse',pulse);
   return()=>{unmounts[slot]++;window.removeEventListener('makeui-shell-slot-pulse',pulse);};
  },[slot]);
  return React.createElement(Button,{ref:element,autoFocus:slot==='brand','data-shell-slot':slot,onClick:()=>{setCount(value=>value+1);onAction?.();}},slot+' '+label+' '+count);
 }
 function Harness({mode,label='Initial',onBrandAction}){
  const widget=slot=>React.createElement(HostSlot,{slot,label,onAction:slot==='brand'?onBrandAction:undefined});
  return React.createElement(MakeDesignProvider,{design:{choices:{navigation:mode,motion:'reduced'}}},
   React.createElement(MakeAppShell,{brand:widget('brand'),title:widget('title'),navigation:widget('navigation'),primaryNavigation:widget('primaryNavigation'),headerEnd:widget('headerEnd')},widget('children')));
 }
 const node=slot=>document.querySelector('[data-shell-slot="'+slot+'"]');
 const assertSubscriptions=()=>{
  const before={...pulses};window.dispatchEvent(new window.Event('makeui-shell-slot-pulse'));
  for(const slot of slots)assert.equal(pulses[slot]-before[slot],1,'one live '+slot+' instance owns one subscription');
 };
 const assertClean=async()=>{
  const owned=slots.map(node);await act(async()=>root.render(null));
  for(const slot of slots)assert.equal(unmounts[slot],mounts[slot],'unmount disposes every '+slot+' effect');
  assert.ok(owned.every(item=>!item.isConnected),'unmount detaches the sole host slot nodes');
  assert.equal(document.querySelectorAll('[data-shell-slot], .makeui-antd-shell').length,0);
  const before={...pulses};window.dispatchEvent(new window.Event('makeui-shell-slot-pulse'));
  assert.deepEqual(pulses,before,'unmount removes every host slot subscription');
 };
 await act(async()=>root.render(React.createElement(Harness,{mode:'single',onBrandAction:()=>actions.push('initial')})));
 const original={};
 for(const slot of slots){
  assert.equal(mounts[slot],1,'a shell must mount the '+slot+' business slot once');
  assert.equal(unmounts[slot],0);
  assert.equal(document.querySelectorAll('[data-shell-slot="'+slot+'"]').length,1,'inactive navigation layouts cannot own a second '+slot+' business instance');
  original[slot]=node(slot);await act(async()=>original[slot].click());
 }
 assertSubscriptions();
 assert.equal(document.activeElement,original.brand,'the initial brand preserves the official control autoFocus behavior');
 for(const mode of modes){
  await act(async()=>root.render(React.createElement(Harness,{mode,onBrandAction:()=>actions.push('initial')})));
  assert.equal(document.querySelector('.makeui-antd-shell').dataset.navigation,mode);
  for(const slot of slots){
   assert.equal(node(slot),original[slot],mode+' keeps the actual '+slot+' DOM node');
   assert.equal(node(slot).textContent,slot+' Initial 1',mode+' keeps the '+slot+' interaction state');
   assert.equal(document.querySelectorAll('[data-shell-slot="'+slot+'"]').length,1);
   assert.equal(mounts[slot],1,mode+' cannot recreate the '+slot+' business slot');assert.equal(unmounts[slot],0);
  }
  assertSubscriptions();
 }
 await act(async()=>root.render(React.createElement(Harness,{mode:'top',label:'Updated',onBrandAction:()=>actions.push('updated')})));
 for(const slot of slots){assert.equal(node(slot),original[slot]);assert.equal(node(slot).textContent,slot+' Updated 1');}
 await act(async()=>original.brand.click());assert.equal(original.brand.textContent,'brand Updated 2');
 assert.deepEqual(actions,['initial','updated'],'the existing brand receives the current host callback');
 await assertClean();
 reset();
 const strictRender=(mode,label='Strict')=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness,{mode,label})));
 await act(async()=>strictRender('single'));
 const strictNodes={};const strictEffects={};
 for(const slot of slots){
  assert.equal(mounts[slot]-unmounts[slot],1,'StrictMode leaves one live '+slot+' instance after initial effect replay');
  assert.equal(document.querySelectorAll('[data-shell-slot="'+slot+'"]').length,1);
  strictNodes[slot]=node(slot);strictEffects[slot]={mounts:mounts[slot],unmounts:unmounts[slot]};
  await act(async()=>strictNodes[slot].click());
 }
 assertSubscriptions();
 for(const mode of modes){
  await act(async()=>strictRender(mode));
  for(const slot of slots){
   assert.equal(node(slot),strictNodes[slot]);assert.equal(node(slot).textContent,slot+' Strict 1');
   assert.equal(mounts[slot],strictEffects[slot].mounts,mode+' cannot replay '+slot+' effects after StrictMode initialization');
   assert.equal(unmounts[slot],strictEffects[slot].unmounts);
   assert.equal(document.querySelectorAll('[data-shell-slot="'+slot+'"]').length,1);
  }
  assertSubscriptions();
 }
 await act(async()=>strictRender('top','Strict updated'));
 for(const slot of slots){assert.equal(node(slot),strictNodes[slot]);assert.equal(node(slot).textContent,slot+' Strict updated 1');}
 await assertClean();
 console.log('official app shell preserves one stateful brand and host slots across all navigation modes: PASS');
}
async function surfaceRegression(root){
 let mounts=0;let unmounts=0;let detailForm;
 function ExistingDetail(){[detailForm]=Form.useForm();React.useEffect(()=>{mounts++;return()=>{unmounts++;};},[]);return React.createElement(React.Fragment,null,React.createElement(MakeFormLayout,{form:detailForm,initialValues:{draft:'saved value'}},React.createElement(MakeFormItem,{name:'draft',label:'Current value'},React.createElement(Input,{className:'surface-input'}))),React.createElement(MakeTabs,{className:'surface-tabs',defaultActiveKey:'first',items:tabItems()}));}
 function SurfaceHarness({kind,open=true}){return React.createElement(MakeDesignProvider,{design:{...filledPlan,choices:{detailOpening:kind,motion:'reduced'}}},React.createElement(MakeRecordSurface,{mode:'detail',open,title:'Existing detail',onClose(){}},React.createElement(ExistingDetail)));}
 await act(async()=>{root.render(React.createElement(SurfaceHarness,{kind:'drawer'}));});
 await waitFor(()=>document.querySelector('.surface-tabs'));
 const tabs=document.querySelector('.surface-tabs');
 const input=document.querySelector('.surface-input');
 await act(async()=>{detailForm.setFieldsValue({draft:'user draft'});});
 assertFilled(tabs,'first',true);assertFilled(tabs,'second',false);
 await act(async()=>{tabNode(tabs,'second').click();});
 assertFilled(tabs,'second',true);
 await act(async()=>{root.render(React.createElement(SurfaceHarness,{kind:'page'}));});
 assert.ok(document.querySelector('.makeui-antd-page .surface-tabs')===tabs,'changing the surface must preserve the actual Tabs DOM');
 assertFilled(tabs,'second',true);assert.equal(mounts,1);assert.equal(unmounts,0);
 assert.ok(document.querySelector('.surface-input')===input);assert.equal(input.value,'user draft');
 assert.equal(tabs.closest('[aria-modal="true"]'),null,'the page must not remain in a modal dialog');
 await act(async()=>{root.render(React.createElement(SurfaceHarness,{kind:'wide-drawer'}));});
 assert.ok(document.querySelector('.makeui-antd-surface .surface-tabs')===tabs,'returning to a Drawer must keep the same Tabs DOM');
 assertFilled(tabs,'second',true);assert.equal(mounts,1);assert.equal(unmounts,0);
 assert.ok(document.querySelector('.surface-input')===input);assert.equal(detailForm.getFieldValue('draft'),'user draft');
 assert.ok(tabs.closest('[role="dialog"][aria-modal="true"]'),'the drawer keeps its official modal semantics');
 assert.equal(document.querySelectorAll('.surface-tabs').length,1,'one surface owns one business view');
 console.log('official record surface keeps Tabs state and portal skin across page/drawer switches: PASS');
}
async function surfaceActionPresenceRegression(root){
 const action=React.createElement(Button,{'data-presence-action':true},'Existing action');
 const cases=[
  {name:'undefined',value:undefined,present:false},
  {name:'null',value:null,present:false},
  {name:'false',value:false,present:false},
  {name:'empty',value:'',present:false},
  {name:'zero',value:0,present:true},
  {name:'true',value:true,present:true},
  {name:'button',value:action,present:true},
 ];
 for(const {name,value,present} of cases){
  await act(async()=>root.render(React.createElement(Drawer,{open:true,title:'Native actions',extra:value,classNames:{extra:'native-action-presence-extra'}},'Native content')));
  await waitFor(()=>document.querySelector('.ant-drawer-body'));
  assert.equal(document.querySelectorAll('.native-action-presence-extra').length,present?1:0,'the official Drawer establishes the '+name+' extra presence contract');
 }
 await act(async()=>root.render(null));
 let mounts=0;let unmounts=0;
 function Controller(){const [count,setCount]=React.useState(0);React.useEffect(()=>{mounts++;return()=>{unmounts++;};},[]);return React.createElement('button',{'data-action-presence-controller':true,onClick:()=>setCount(value=>value+1)},'Controller '+count);}
 function Harness({kind,actions}){return React.createElement(MakeDesignProvider,{design:{choices:{detailOpening:kind,motion:'reduced'}}},React.createElement(ConfigProvider,{drawer:{classNames:{extra:'foundation-action-presence-extra'}}},React.createElement(MakeRecordSurface,{mode:'detail',open:true,title:'Optional actions',actions,onClose(){}},React.createElement(Controller))));}
 let controller;
 for(const kind of ['page','drawer','wide-drawer','page']){
  for(const {name,value,present} of [cases.at(-1),...cases,cases.at(-1)]){
   await act(async()=>root.render(React.createElement(Harness,{kind,actions:value})));
   await waitFor(()=>document.querySelector('[data-action-presence-controller]'));
   const current=document.querySelector('[data-action-presence-controller]');
   if(!controller){controller=current;await act(async()=>controller.click());}
   assert.equal(current,controller,kind+' '+name+' preserves the same business DOM');
   assert.equal(controller.textContent,'Controller 1');assert.equal(mounts,1);assert.equal(unmounts,0);
   assert.equal(document.querySelectorAll('.foundation-action-presence-extra').length,present?1:0,kind+' '+name+' preserves the official extra presence');
   assert.equal(document.querySelectorAll('.makeui-antd-surface-actions').length,present?1:0,kind+' '+name+' has exactly the expected action group');
   assert.equal(document.querySelectorAll('[data-presence-action]').length,name==='button'?1:0,'dynamic changes cannot duplicate actions');
   if(name==='zero')assert.equal(document.querySelector('.makeui-antd-surface-actions').textContent,'0');
  }
 }
 await act(async()=>root.render(null));
 assert.equal(unmounts,1);assert.equal(document.querySelectorAll('.makeui-antd-surface-actions').length,0);
 console.log('official Drawer action presence and dynamic page/drawer action groups: PASS');
}
async function surfaceHeaderRegression(root){
 const slots=['title','status','actions'];
 const mounts={title:0,status:0,actions:0};
 const unmounts={title:0,status:0,actions:0};
 function ExistingHeaderSlot({slot}){
  const [count,setCount]=React.useState(0);
  React.useEffect(()=>{mounts[slot]++;return()=>{unmounts[slot]++;};},[slot]);
  return React.createElement(React.Fragment,null,
   React.createElement(Button,{'data-header-slot':slot,onClick:()=>setCount(value=>value+1)},slot+' '+count),
   slot==='actions'&&React.createElement(Select,{open:true,defaultValue:'saved',options:[{value:'saved',label:'Saved action'}],classNames:{popup:{root:'surface-header-popup'}}}));
 }
 function Harness({kind}){
  return React.createElement(MakeDesignProvider,{design:{choices:{detailOpening:kind,motion:'reduced'}}},
   React.createElement(ConfigProvider,{drawer:{classNames:{title:'surface-header-public-title'}}},
    React.createElement(Drawer,{open:true,zIndex:1400,title:'Owning surface',rootClassName:'surface-header-owner',onClose(){}},
     React.createElement(MakeRecordSurface,{mode:'detail',open:true,
      title:React.createElement(ExistingHeaderSlot,{slot:'title'}),
      status:React.createElement(ExistingHeaderSlot,{slot:'status'}),
      actions:React.createElement(ExistingHeaderSlot,{slot:'actions'}),onClose(){}},'Existing record content'))));
 }
 const render=kind=>root.render(React.createElement(Harness,{kind}));
 const slotNode=slot=>document.querySelector('[data-header-slot="'+slot+'"]');
 await act(async()=>{render('page');});
 await waitFor(()=>slots.every(slot=>slotNode(slot)));
 const original={};
 for(const slot of slots){
  assert.equal(mounts[slot],1,'page initialization must mount the '+slot+' business slot once');
  assert.equal(unmounts[slot],0);
  assert.equal(document.querySelectorAll('[data-header-slot="'+slot+'"]').length,1,'the inactive Drawer must not render a second '+slot+' business slot');
  original[slot]=slotNode(slot);
  assert.ok(original[slot].closest('.makeui-antd-page'),'the '+slot+' slot belongs to the active page header');
  await act(async()=>{original[slot].click();});
  assert.equal(original[slot].textContent,slot+' 1');
 }
 assert.equal(document.querySelectorAll('.surface-header-popup').length,1,'one actions slot owns one public Select popup');
 for(const kind of ['drawer','wide-drawer','page']){
  await act(async()=>{render(kind);});
  for(const slot of slots){
   assert.equal(slotNode(slot),original[slot],kind+' must retain the actual '+slot+' slot DOM');
   assert.equal(slotNode(slot).textContent,slot+' 1',kind+' must retain the '+slot+' slot interaction state');
   assert.equal(mounts[slot],1,kind+' cannot restart the '+slot+' slot effects');
   assert.equal(unmounts[slot],0,kind+' cannot dispose the '+slot+' slot effects');
   assert.equal(document.querySelectorAll('[data-header-slot="'+slot+'"]').length,1);
   assert.ok(slotNode(slot).closest(kind==='page'?'.makeui-antd-page':'.makeui-antd-surface'));
  }
  assert.equal(document.querySelectorAll('.surface-header-popup').length,1);
  const boundary=original.title.closest(kind==='page'?'.makeui-antd-page-header':'.surface-header-public-title');
  assert.ok(boundary,'the active header exposes its owned page root or public Drawer title slot');
  let titleNode=original.title.closest('h2');
  while(titleNode&&titleNode!==boundary){
   assert.equal(Number.parseFloat(getComputedStyle(titleNode).minWidth),0,'each owned title wrapper must shrink instead of forcing a long heading outside the header');
   titleNode=titleNode.parentElement;
  }
  assert.equal(titleNode,boundary);
  if(kind!=='page'){
   const surface=original.actions.closest('.makeui-antd-surface');
   const popup=document.querySelector('.surface-header-popup');
   const surfaceZ=Number(surface.style.zIndex);
   const popupZ=Number(popup.style.zIndex||getComputedStyle(popup).zIndex);
   assert.ok(surfaceZ>1400,'the nested record Drawer inherits the owning surface context');
   assert.ok(Number.isFinite(popupZ)&&popupZ>surfaceZ,'the header Select inherits the active record Drawer context, not only its DOM location');
   assert.ok(!surface.contains(popup),'the public Select popup stays outside the owning Drawer clipping region');
  }
 }
 await act(async()=>{root.render(null);});
 for(const slot of slots)assert.equal(unmounts[slot],1,'unmount disposes the sole '+slot+' business slot once');
 assert.equal(document.querySelectorAll('[data-header-slot]').length,0);
 assert.equal(document.querySelectorAll('.surface-header-popup').length,0);
 function OptionalActionsHarness({kind,enabled=false}){
  return React.createElement(MakeDesignProvider,{design:{choices:{detailOpening:kind,motion:'reduced'}}},
   React.createElement(ConfigProvider,{drawer:{classNames:{extra:'surface-without-actions-extra'}}},
    React.createElement(MakeRecordSurface,{mode:'detail',open:true,title:'Optional actions',actions:enabled?React.createElement(Button,{'data-optional-header-action':true},'Optional action'):undefined,onClose(){}},
     React.createElement('span',{id:'surface-without-actions-content'},'Existing content'))));
 }
 for(const kind of ['drawer','page']){
  for(const enabled of [false,true,false,true]){
   await act(async()=>{root.render(React.createElement(OptionalActionsHarness,{kind,enabled}));});
   await waitFor(()=>document.querySelector('#surface-without-actions-content'));
   assert.equal(document.querySelectorAll('.surface-without-actions-extra').length,enabled?1:0,'the public Drawer extra slot follows the current action presence');
   assert.equal(document.querySelectorAll('[data-optional-header-action]').length,enabled?1:0,'adding or removing actions never creates a hidden second business control');
   assert.equal(document.querySelectorAll('.makeui-antd-page .makeui-antd-surface-actions').length,kind==='page'&&enabled?1:0,'a page without actions must not retain an empty action group');
  }
 }
 await act(async()=>{root.render(null);});
 for(const slot of slots){mounts[slot]=0;unmounts[slot]=0;}
 const strictRender=kind=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness,{kind})));
 await act(async()=>{strictRender('page');});
 await waitFor(()=>slots.every(slot=>slotNode(slot)));
 const strictNodes={};
 const strictEffects={};
 for(const slot of slots){
  assert.equal(mounts[slot]-unmounts[slot],1,'StrictMode leaves exactly one live '+slot+' business slot after its initial replay');
  assert.equal(document.querySelectorAll('[data-header-slot="'+slot+'"]').length,1);
  strictEffects[slot]={mounts:mounts[slot],unmounts:unmounts[slot]};
  strictNodes[slot]=slotNode(slot);
  await act(async()=>{strictNodes[slot].click();});
 }
 const ownedHosts=[...document.querySelectorAll('.makeui-antd-surface-content, .makeui-antd-surface-title-content, .makeui-antd-surface-actions-content')];
 assert.equal(ownedHosts.length,3,'the one surface owns one body, title and actions portal host');
 for(const kind of ['drawer','wide-drawer','page']){
  await act(async()=>{strictRender(kind);});
  for(const slot of slots){
   assert.equal(slotNode(slot),strictNodes[slot]);
   assert.equal(slotNode(slot).textContent,slot+' 1');
   assert.equal(mounts[slot],strictEffects[slot].mounts,'switching '+kind+' must not replay '+slot+' effects after StrictMode initialization');
   assert.equal(unmounts[slot],strictEffects[slot].unmounts);
   assert.equal(document.querySelectorAll('[data-header-slot="'+slot+'"]').length,1);
  }
  assert.equal(document.querySelectorAll('.surface-header-popup').length,1);
 }
 await act(async()=>{root.render(null);});
 for(const slot of slots)assert.equal(unmounts[slot],mounts[slot],'StrictMode unmount disposes every '+slot+' effect instance');
 assert.ok(ownedHosts.every(host=>!host.isConnected),'unmount detaches every owned header/body portal host');
 assert.equal(document.querySelectorAll('.makeui-antd-surface-content, .makeui-antd-surface-title-content, .makeui-antd-surface-actions-content').length,0);
 assert.equal(document.querySelectorAll('[data-header-slot], .surface-header-popup').length,0);
 console.log('official record header keeps one stateful title/status/actions tree and Drawer popup context: PASS');
}
async function surfaceLifecycleRegression(root){
 let setOpen;let closes=0;let mounts=0;
 function Content(){React.useEffect(()=>{mounts++;},[]);return React.createElement('button',{id:'surface-content-button'},'Existing action');}
 function Harness({kind='drawer'}){const [open,set]=React.useState(false);setOpen=set;return React.createElement(MakeDesignProvider,{design:{choices:{detailOpening:kind,motion:'reduced'}}},React.createElement('button',{id:'surface-opener',onClick:()=>set(true)},'Open'),React.createElement(MakeRecordSurface,{mode:'detail',open,title:'Current record',onClose(){closes++;set(false);}},React.createElement(Content)));}
 await act(async()=>{root.render(React.createElement(Harness));});
 assert.equal(mounts,0,'an unopened surface must not start the business controller');
 const opener=document.querySelector('#surface-opener');opener.focus();
 await act(async()=>{opener.click();});
 await waitFor(()=>document.querySelector('#surface-content-button'));
 await act(async()=>{document.querySelector('.makeui-antd-surface [aria-label="关闭"]').click();});
 await waitFor(()=>document.activeElement===opener);
 assert.equal(closes,1,'the official close control calls the existing close path once');
 await act(async()=>{setOpen(true);});
 const escape=new window.KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true,cancelable:true});
 await act(async()=>{document.querySelector('#surface-content-button').dispatchEvent(escape);});
 await waitFor(()=>closes===2);
 await act(async()=>{root.render(React.createElement(Harness,{kind:'page'}));setOpen(true);});
 const pageEscape=new window.KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true,cancelable:true});
 await act(async()=>{document.querySelector('#surface-content-button').dispatchEvent(pageEscape);});
 assert.equal(closes,2,'the inactive Drawer cannot close an ordinary page on Escape');
 assert.equal(pageEscape.defaultPrevented,false,'the inactive Drawer cannot swallow page keyboard events');
 assert.equal(mounts,1,'opening, closing and changing the view keep the same controller');
 await act(async()=>{root.render(React.createElement(Harness,{key:'page-first',kind:'page'}));});
 const pageOpener=document.querySelector('#surface-opener');pageOpener.focus();
 const overflowBefore=getComputedStyle(document.body).overflow;
 await act(async()=>{setOpen(true);});
 assert.ok(document.activeElement===pageOpener,'initializing a page must not move focus into its inactive Drawer');
 assert.equal(getComputedStyle(document.body).overflow,overflowBefore,'an ordinary page must not lock body scrolling');
 assert.equal(getComputedStyle(document.querySelector('.makeui-antd-surface')).display,'none','the inactive Drawer must remain visually absent');
 const firstPageEscape=new window.KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true,cancelable:true});
 await act(async()=>{document.querySelector('#surface-content-button').dispatchEvent(firstPageEscape);});
 assert.equal(closes,2);assert.equal(firstPageEscape.defaultPrevented,false);
 await act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(Harness,{kind:'page'})));});
 await act(async()=>{setOpen(true);});
 assert.ok(document.querySelector('.makeui-antd-page #surface-content-button')?.isConnected,'StrictMode effect replay must reconnect the stable content host');
 assert.equal(document.querySelectorAll('.makeui-antd-surface-content').length,1);
 await act(async()=>root.render(null));
 assert.equal(document.querySelectorAll('.makeui-antd-surface-content').length,0,'unmount removes the owned portal host');
 console.log('official record surface preserves close focus, page keyboard behavior and portal cleanup: PASS');
}
async function multipleSurfaceRegression(root){
 let openA;let openB;let closedA=0;let closedB=0;
 function Harness(){const [a,setA]=React.useState(true);const [b,setB]=React.useState(false);openA=setA;openB=setB;return React.createElement(MakeDesignProvider,{design:{choices:{motion:'reduced'}}},
 React.createElement(MakeRecordSurface,{mode:'detail',open:a,title:'A',onClose(){closedA++;setA(false);}},'A content'),
 React.createElement(MakeRecordSurface,{mode:'detail',open:b,title:'B',onClose(){closedB++;setB(false);}},'B content'),
 React.createElement(MakeRecordSurface,{design:{choices:{detailOpening:'page',motion:'reduced'}},mode:'detail',open:true,title:'Existing page',onClose(){}},'Existing page content'));}
 const escape=()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true,cancelable:true}));
 await act(async()=>root.render(React.createElement(Harness)));
 await act(async()=>{escape();});
 assert.equal(closedA,1,'a later page-only surface cannot own the active Drawer Escape stack');
 await act(async()=>{openB(true);});
 await act(async()=>{escape();});
 assert.equal(closedB,1);
 await act(async()=>{openA(true);});
 await act(async()=>{escape();});
 assert.equal(closedA,2,'a previously closed Drawer must regain Escape ownership when reopened');
 console.log('official record surfaces preserve the active Escape owner across pages and repeated Drawer openings: PASS');
}
async function surfacePopupLayerRegression(root){
 const slots=['title','status','actions','body'];
 const PopupContext=React.createContext('initial');
 const rows=[];const failures=[];
 const click=async selector=>{
  const node=document.querySelector(selector);assert.ok(node,'missing interactive node '+selector);
  await act(async()=>{node.click();});
 };
 const dispatch=async(selector,type)=>{
  const node=document.querySelector(selector);assert.ok(node,'missing interactive node '+selector);
  await act(async()=>{node.dispatchEvent(new window.MouseEvent(type,{bubbles:true,cancelable:true}));});
 };
 const layer=element=>{
  let value=getComputedStyle(element).zIndex;
  const variable=value.match(/^var\((--[a-z0-9-]+)\)$/i)?.[1];
  if(variable)for(let node=element;node;node=node.parentElement){
   const resolved=getComputedStyle(node).getPropertyValue(variable).trim();
   if(resolved){value=resolved;break;}
  }
  return Number(value);
 };
 function PopupLabel(){
  const context=React.useContext(PopupContext);const design=useMakeDesign();const {token}=antdTheme.useToken();
  return React.createElement('span',{'data-layer-context':context,'data-layer-theme':design.choices.theme,'data-layer-primary':token.colorPrimary,'data-layer-base':token.zIndexPopupBase},context);
 }
 for(const [host,hostZIndex,zIndexPopupBase] of [
  ['none',0],['modal',1300],['drawer',1300],['modal',1900],['none',0,2200],
 ]){
  let current;let setOpen;
  const metrics=Object.fromEntries(slots.map(slot=>[slot,{mounts:0,cleanups:0}]));
  function StatefulSlot({slot,children}){
   const [count,setCount]=React.useState(0);
   React.useEffect(()=>{metrics[slot].mounts++;return()=>{metrics[slot].cleanups++;};},[slot]);
   return React.createElement(slot==='body'?'section':'span',{'data-layer-slot':slot},
    React.createElement('button',{'data-layer-count':slot,onClick:()=>setCount(value=>value+1)},slot+' '+count),children);
  }
  function Host({children}){
   const props={open:true,zIndex:hostZIndex,title:'Host',closable:false,keyboard:false,mask:{closable:false}};
   return host==='modal'?React.createElement(Modal,{...props,rootClassName:'popup-layer-host-modal',footer:null},children)
    :host==='drawer'?React.createElement(Drawer,{...props,rootClassName:'popup-layer-host-drawer'},children):children;
  }
  function Harness({kind,dark}){
   const [open,set]=React.useState(true);setOpen=set;
   const [dropdownClicks,setDropdownClicks]=React.useState(0);
   const [selectedOption,setSelectedOption]=React.useState();
   const [selectedDate,setSelectedDate]=React.useState(null);
   current={open,dropdownClicks,selectedOption,selectedDate:selectedDate?.format('YYYY-MM-DD')};
   const widget=(slot,children)=>React.createElement(StatefulSlot,{slot},children);
   const controls=React.createElement(React.Fragment,null,
    React.createElement(Dropdown,{trigger:['click'],classNames:{root:'surface-layer-dropdown'},menu:{items:[{key:'context',label:React.createElement(PopupLabel)}],onClick:()=>setDropdownClicks(value=>value+1)}},
     React.createElement(Button,{'data-layer-dropdown-trigger':true},'Open menu')),
    React.createElement(Select,{'aria-label':'Layer selection',value:selectedOption,onChange:setSelectedOption,
     options:[{value:'first',label:'First business option'},{value:'second',label:'Second business option'}],
     classNames:{popup:{root:'surface-layer-select'}},popupRender:menu=>React.createElement(React.Fragment,null,React.createElement(PopupLabel),menu)}),
    React.createElement(DatePicker,{'aria-label':'Layer date',value:selectedDate,onChange:setSelectedDate,defaultPickerValue:dayjs('2026-11-01'),
     classNames:{popup:{root:'surface-layer-date'}},panelRender:panel=>React.createElement(React.Fragment,null,React.createElement(PopupLabel),panel)}));
   return React.createElement(React.StrictMode,null,
    React.createElement(PopupContext.Provider,{value:dark?'updated':'initial'},
     React.createElement(ConfigProvider,{theme:{token:{motion:false,...(zIndexPopupBase===undefined?{}:{zIndexPopupBase})}}},
      React.createElement(MakeDesignProvider,{design:{choices:{detailOpening:kind,theme:dark?'dark':'light',motion:'reduced'},colors:{accent:dark?'#8de6bf':'#c2410c'}}},
       React.createElement(Host,null,
        React.createElement(MakeRecordSurface,{mode:'detail',open,title:widget('title'),status:widget('status'),actions:widget('actions'),onClose:()=>set(false)},widget('body',controls)))))));
  }
  const render=(kind,dark)=>root.render(React.createElement(Harness,{kind,dark}));
  await act(async()=>{render('page',false);});
  await waitFor(()=>slots.every(slot=>document.querySelector('[data-layer-slot="'+slot+'"]')));
  const nodes=Object.fromEntries(slots.map(slot=>[slot,document.querySelector('[data-layer-slot="'+slot+'"]')]));
  for(const slot of slots)await click('[data-layer-count="'+slot+'"]');
  const initialMetrics=structuredClone(metrics);
  const assertSlots=()=>{
   for(const slot of slots){
    assert.equal(document.querySelectorAll('[data-layer-slot="'+slot+'"]').length,1,slot+' has one live DOM instance');
    assert.equal(document.querySelector('[data-layer-slot="'+slot+'"]'),nodes[slot],slot+' keeps its DOM identity');
    assert.equal(nodes[slot].querySelector('[data-layer-count]').textContent,slot+' 1',slot+' keeps its interaction state');
    assert.equal(metrics[slot].mounts-metrics[slot].cleanups,1,slot+' has one live effect instance');
   }
   assert.deepEqual(metrics,initialMetrics,'changing the host presentation cannot replay slot effects');
  };
  for(const [index,kind] of ['page','drawer','wide-drawer','page'].entries()){
   const dark=index%2===1;
   await act(async()=>{render(kind,dark);});
   assertSlots();
   const assertPopup=selector=>{
    const popup=document.querySelector(selector);assert.ok(popup,'missing actual popup '+selector);
    const owner=kind!=='page'?document.querySelector('.makeui-antd-surface.ant-drawer-open')
     :host==='modal'?document.querySelector('.popup-layer-host-modal .ant-modal-wrap')
      :host==='drawer'?document.querySelector('.popup-layer-host-drawer'):null;
    assert.ok(owner||(kind==='page'&&host==='none'),'the selected presentation has its actual layer owner');
    const label=popup.querySelector('[data-layer-context]');assert.ok(label);
    assert.equal(label.dataset.layerContext,dark?'updated':'initial');
    assert.equal(label.dataset.layerTheme,dark?'dark':'light');
    assert.equal(label.dataset.layerPrimary,dark?'#8de6bf':'#c2410c');
    assert.equal(popup.closest('.makeui-antd-surface,.popup-layer-host-modal,.popup-layer-host-drawer'),null,'the popup is outside its clipping host');
    assert.equal(popup.parentElement?.parentElement,document.body,'the default popup container remains a body portal');
    const row={host,hostZIndex,zIndexPopupBase,kind,popup:selector,ownerLayer:owner?layer(owner):0,popupLayer:layer(popup),publicBase:Number(label.dataset.layerBase)};
    assert.ok(Number.isFinite(row.ownerLayer)&&Number.isFinite(row.publicBase),'layer checks require resolved public computed values');
    if(zIndexPopupBase!==undefined)assert.equal(row.publicBase,zIndexPopupBase,'the inherited public popup token is unchanged');
    rows.push(row);
    if(!Number.isFinite(row.popupLayer)||row.popupLayer<=row.ownerLayer||row.popupLayer<=row.publicBase)failures.push(row);
    return popup;
   };
   await click('[data-layer-dropdown-trigger]');
   await waitFor(()=>document.querySelector('.surface-layer-dropdown'));
   assertPopup('.surface-layer-dropdown');
   await click('.surface-layer-dropdown .ant-dropdown-menu-item');
   assert.equal(current.dropdownClicks,index+1,'the actual menu click updates its existing controller');
   await dispatch('[aria-label="Layer selection"]','mousedown');
   await waitFor(()=>document.querySelector('.surface-layer-select'));
   assertPopup('.surface-layer-select');
   const selectedOption=index%2===0?'first':'second';
   await click('.surface-layer-select .ant-select-item-option[title="'+(selectedOption==='first'?'First business option':'Second business option')+'"]');
   assert.equal(current.selectedOption,selectedOption,'the actual option click updates the controlled value');
   await dispatch('[aria-label="Layer date"]','click');
   await waitFor(()=>document.querySelector('.surface-layer-date'));
   assertPopup('.surface-layer-date');
   const selectedDate=index%2===0?'2026-11-18':'2026-11-19';
   await click('.surface-layer-date [title="'+selectedDate+'"] .ant-picker-cell-inner');
   assert.equal(current.selectedDate,selectedDate,'the actual date cell click updates the controlled value');
   assertSlots();
  }
  const beforeClose={...current};
  await click('.makeui-antd-page button[aria-label="返回"]');
  assert.equal(current.open,false);assert.deepEqual(metrics,initialMetrics,'closing preserves the single cached business tree');
  await act(async()=>{setOpen(true);});
  assertSlots();assert.deepEqual(current,beforeClose,'reopening preserves every committed popup value');
  await act(async()=>{root.render(null);});
  for(const slot of slots)assert.equal(metrics[slot].mounts,metrics[slot].cleanups,'unmount cleans every '+slot+' effect');
 }
 assert.equal(rows.length,60,'all five host configurations exercise three popups across four presentations');
 assert.deepEqual(failures,[],'each body popup must inherit the actual public base and stay above its host: '+JSON.stringify(rows));
 console.log('official record surface popup layers, clicks and values across page, Modal, Drawer and public popup base: PASS');
}
async function waitFor(check){const deadline=Date.now()+2000;while(!check()){if(Date.now()>deadline)throw new Error('Expected DOM state was not rendered: '+document.body.innerHTML);await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});}}
const outside = document.querySelector('#outside');
const before = getComputedStyle(outside);
const baseline = [before.backgroundColor,before.fontSize,before.padding,before.boxSizing];
const style = document.createElement('style');style.textContent = fs.readFileSync(process.argv[3], 'utf8');document.head.append(style);
const after = getComputedStyle(outside);
assert.deepEqual([after.backgroundColor,after.fontSize,after.padding,after.boxSizing],baseline,'foundation CSS cannot restyle an unrelated button');
let form;let submitted=[];let controllerMounts=0;
const firstPlan={choices:{navigation:'single',icon:'default',motion:'system',tuning:{fine:{shadow:'none'}}},colors:{accent:'#ff5600','sidebar-bg':'#fffaf5'},metrics:{bodySize:14,padding:24},layout:{recipe:{nav:'side',surface:'flat'}}};
const secondPlan={choices:{navigation:'double',icon:'thin',motion:'reduced',tuning:{fine:{shadow:'raised'}}},colors:{accent:'#4493f8','sidebar-bg':'#161b22','sidebar-active':'#30363d'},metrics:{bodySize:18,padding:36,tracking:.06},typography:{roles:{body:18,pageTitle:21,recordTitle:17,fieldLabel:13,controlText:15,meta:12},tracking:{body:.06,heading:.1}},layout:{recipe:{nav:'top',surface:'inset'},structure:{resolvedNavigation:{mode:'double',primaryRail:70,secondarySidebar:196}}}};
function TrackingControls(){return React.createElement(React.Fragment,null,
React.createElement(Select,{open:true,showSearch:true,options:[{value:'A',label:'Option A'}],classNames:{root:'tracking-select-root',input:'tracking-select-input',popup:{root:'tracking-select-popup'}}}),
React.createElement(DatePicker,{open:true,classNames:{root:'tracking-date-root',input:'tracking-date-input',popup:{root:'tracking-date-popup'}}}),
React.createElement(TimePicker,{open:true,classNames:{root:'tracking-time-root',input:'tracking-time-input',popup:{root:'tracking-time-popup'}}}),
React.createElement(DatePicker.RangePicker,{open:true,classNames:{root:'tracking-range-root',input:'tracking-range-input',popup:{root:'tracking-range-popup'}}}),
React.createElement(Cascader,{open:true,options:[{value:'P',label:'Parent',children:[{value:'C',label:'Child'}]}],classNames:{root:'tracking-cascader-root',input:'tracking-cascader-input',popup:{root:'tracking-cascader-popup'}}}),
React.createElement(InputNumber,{classNames:{root:'tracking-number-root',input:'tracking-number-input'}}),
React.createElement(Select,{open:true,options:[{value:'B',label:'Option B'}],getPopupContainer:()=>document.querySelector('#custom-popup-host'),classNames:{popup:{root:'tracking-custom-popup'}}}));}
function Controller(){[form]=Form.useForm();React.useEffect(()=>{controllerMounts++;},[]);const current=useMakeDesign();return React.createElement(React.Fragment,null,React.createElement('span',{id:'current-motion'},current.choices.motion),React.createElement(MakeFormLayout,{form,initialValues:{device:'',purpose:'既有用途'},onFinish:values=>submitted.push(values)},React.createElement(MakeFormItem,{name:'device',label:'设备名称',fieldType:'Make.Field.Text',rules:[{required:true,message:'请输入设备名称'}]},React.createElement(Input)),React.createElement(MakeFormItem,{name:'purpose',label:'用途',fieldType:'Make.Field.TextArea'},React.createElement(Input.TextArea,{autoSize:{minRows:3,maxRows:8}})),React.createElement(Button,{htmlType:'submit',type:'primary'},'保存')));}
function Harness({design}){return React.createElement(ConfigProvider,{input:{styles:()=>({input:{fontStyle:'italic'}})},select:{styles:()=>({popup:{root:{borderTopWidth:7}}})}},React.createElement(MakeDesignProvider,{design},React.createElement(MakeAppShell,{brand:'设备借用',title:'借用申请',navigation:React.createElement('button',null,'借用'),primaryNavigation:React.createElement('button',null,'应用')},React.createElement(React.Fragment,null,React.createElement(Controller),React.createElement(TrackingControls)))));}
(async()=>{
const root=createRoot(document.querySelector('#app'));
try{
 await surfacePopupLayerRegression(root);
 await formLabelRegression(root);
 await shellSlotRegression(root);
 await tabsRegression(root);
 await surfaceRegression(root);
 await surfaceActionPresenceRegression(root);
 await surfaceHeaderRegression(root);
 await surfaceLifecycleRegression(root);
 await multipleSurfaceRegression(root);
 await act(async()=>{root.render(React.createElement(Harness,{design:firstPlan}));});
 await act(async()=>{try{await form.validateFields();}catch{}});
 assert.deepEqual(form.getFieldError('device'),['请输入设备名称']);
 await waitFor(()=>document.body.textContent.includes('请输入设备名称'));
 assert.equal((document.body.textContent.match(/请输入设备名称/g)||[]).length,1,'one official error slot');
 assert.equal([...document.querySelectorAll('label')].filter(label=>label.textContent==='设备名称').length,1,'one label');
 assert.equal(document.querySelector('input').getAttribute('aria-invalid'),'true');
 assert.equal(document.querySelector('input').style.width,'100%');
 assert.equal(document.querySelector('textarea').style.minHeight,'96px','the actual textarea preserves the public minimum');
 assert.equal(submitted.length,0);
 await act(async()=>{form.setFieldsValue({device:'Camera A'});});
 assert.equal(document.querySelector('input').value,'Camera A');
 const originalInput=document.querySelector('input');
 await act(async()=>{root.render(React.createElement(Harness,{design:secondPlan}));});
 assert.equal(controllerMounts,1,'a plan switch must not remount the business controller');
 assert.equal(document.querySelector('input'),originalInput);
 assert.equal(form.getFieldValue('device'),'Camera A');
 assert.equal(document.querySelector('#current-motion').textContent,'reduced');
 const shell=document.querySelector('.makeui-antd-shell');
 assert.equal(shell.dataset.navigation,'double');
 assert.equal(shell.dataset.surface,'inset');
 assert.equal(shell.style.getPropertyValue('--makeui-primary-rail'),'70px');
 assert.equal(shell.style.getPropertyValue('--makeui-secondary-sidebar'),'196px');
 assert.equal(shell.style.getPropertyValue('--makeui-font-size'),'18px');
 assert.equal(shell.style.getPropertyValue('--makeui-role-page-title-size'),'21px');
 assert.equal(shell.style.getPropertyValue('--makeui-role-field-label-size'),'13px');
 assert.equal(document.querySelector('.makeui-antd-shell-brand-label').textContent,'设备借用');
 assert.equal(shell.style.getPropertyValue('--makeui-sidebar-bg'),'#161b22');
 assert.equal(shell.style.getPropertyValue('--makeui-icon-stroke'),'1.25');
 assert.equal(shell.style.getPropertyValue('--makeui-motion-duration'),'0ms');
 assert.match(shell.style.getPropertyValue('--makeui-shadow'),/24px/);
 assert.equal(getComputedStyle(document.body).letterSpacing,'normal');
 assert.equal(document.querySelector('textarea#purpose').style.letterSpacing,'0.06em','official TextArea must own the selected tracking instead of inheriting the body reset');
 assert.equal(originalInput.style.fontStyle,'italic','an inherited official style callback is preserved');
 assert.equal(originalInput.style.letterSpacing,'0.06em');
 for(const name of ['select','date','time','range','cascader','number']){
  const rootControl=document.querySelector('.tracking-'+name+'-root');
  const inputs=[...document.querySelectorAll('.tracking-'+name+'-input')];
  assert.equal(inputs.length,name==='range'?2:1,name+' native input count');
  assert.equal(rootControl.style.letterSpacing,'0.06em',name+' root typography');
  assert.equal(rootControl.style.fontSize,'15px',name+' control text role');
  for(const input of inputs){assert.equal(input.tagName,'INPUT',name+' slot is the actual native input');
   assert.equal(input.style.letterSpacing,'0.06em',name+' native input typography');
   assert.equal(input.style.fontSize,'15px',name+' native control text role');}
 }
 for(const name of ['select','date','time','range','cascader']){
  const popup=document.querySelector('.tracking-'+name+'-popup');
  assert.ok(popup && !shell.contains(popup),name+' popup remains a portal');
  assert.equal(popup.style.letterSpacing,'0.06em',name+' portal typography');
  assert.equal(popup.style.fontSize,'15px',name+' portal control text role');
 }
 assert.equal(document.querySelector('.tracking-select-popup').style.borderTopWidth,'7px','inherited popup styles are preserved');
 assert.ok(document.querySelector('#custom-popup-host .tracking-custom-popup'),'the instance popup container must stay unchanged');
 for(const nav of ['top','rail','workspace']){
  const next={...secondPlan,choices:{...secondPlan.choices,navigation:'system'},layout:{...secondPlan.layout,recipe:{nav,surface:'boxed'},structure:{resolvedNavigation:{mode:nav,rail:72,workspaceSidebar:256}}}};
  await act(async()=>{root.render(React.createElement(Harness,{design:next}));});
  assert.equal(document.querySelector('.makeui-antd-shell').dataset.makeuiNavigation,nav);
  assert.equal(document.querySelector('input'),originalInput);
  assert.equal(controllerMounts,1);
 }
 await act(async()=>{root.render(React.createElement(Harness,{design:firstPlan}));});
 assert.equal(controllerMounts,1,'restoring system motion must preserve the same controller too');
 assert.equal(form.getFieldValue('device'),'Camera A');
 assert.equal(document.querySelector('textarea#purpose').style.letterSpacing,'0em');
 assert.equal(document.querySelector('.tracking-select-popup').style.letterSpacing,'0em');
 assert.equal(document.querySelector('.tracking-range-popup').style.letterSpacing,'0em');
 assert.equal(originalInput.style.fontStyle,'italic');
 await act(async()=>{form.submit();});
 assert.deepEqual(submitted,[{device:'Camera A',purpose:'既有用途'}]);
 assert.equal(form.getFieldError('device').length,0);
 console.log('official Form.Item DOM and isolated CSS: PASS');
}finally{await act(async()=>root.unmount());dom.window.close();}
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
`;

test('a copied foundation compiles against official Ant Design and keeps Form.Item contracts and Tabs selection', { skip: !dependencyRoot && 'pass --dependencies=/absolute/path/node_modules for the official package check' }, async () => {
  const dependencies = path.resolve(dependencyRoot);
  const require = createRequire(path.join(dependencies, '__makeui_foundation_test__.cjs'));
  const { buildSync } = require('esbuild');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { Form, Input, DatePicker, Select, InputNumber, theme: officialTheme } = require('antd');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'makeui antd foundation '));
  try {
    const copied = path.join(temporary, 'foundation');
    fs.cpSync(fileURLToPath(new URL('../skills/makeui/assets/antd-foundation/', import.meta.url)), copied, { recursive: true });
    fs.symlinkSync(dependencies, path.join(temporary, 'node_modules'), 'dir');
    const typescriptPackage = require.resolve('typescript/package.json');
    const tsc = path.resolve(path.dirname(typescriptPackage), require(typescriptPackage).bin.tsc);
    const configuration = path.join(temporary, 'tsconfig.json');
    fs.writeFileSync(configuration, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, esModuleInterop: true, noEmit: true }, files: [path.join(copied, 'index.tsx')] }));
    const compiled = spawnSync(process.execPath, [tsc, '--project', configuration], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, `the copied asset must typecheck against official dependencies:\n${compiled.stdout}\n${compiled.stderr}`);
    const browserBuild = buildSync({ entryPoints: [path.join(copied, 'index.tsx')], outfile: path.join(temporary, 'browser.js'), bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic', packages: 'external', write: false });
    const stylesheet = browserBuild.outputFiles.find(file => file.path.endsWith('.css'));
    assert.ok(stylesheet, 'importing the public entry must deliver the form and detail layout CSS');
    assert.match(stylesheet.text, /\.makeui-antd-form-grid/);
    assert.match(stylesheet.text, /@container makeui-record/);
    const output = path.join(temporary, 'foundation.cjs');
    buildSync({ entryPoints: [path.join(copied, 'index.tsx')], outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' } });
    const foundation = require(output);
    assert.equal(foundation.MAKEUI_ANTD_FOUNDATION_CONTRACT, 'makeui-antd-foundation/v1');
    const darkPlan = {
      choices: { theme: 'dark' },
      colors: { accent: '#4493f8', 'accent-hover': '#70b0ff', 'accent-active': '#2178d6', success: '#3fb950', warn: '#d29922', danger: '#f85149', muted: '#8b949e', fg: '#f0f6fc', bg: '#0d1117', surface: '#161b22', border: '#30363d' },
    };
    const baselineConfiguration = { algorithm: officialTheme.darkAlgorithm, token: foundation.toAntdTokens(darkPlan), components: foundation.toAntdComponentTokens(darkPlan) };
    const baselineTokens = officialTheme.getDesignToken(baselineConfiguration);
    const configurationFromPlan = foundation.createMakeDesignTheme?.(darkPlan) ?? baselineConfiguration;
    const resolved = officialTheme.getDesignToken(configurationFromPlan);
    assert.equal(resolved.colorPrimary, '#4493f8', 'the public dark algorithm must not recolor the selected accent');
    assert.equal(resolved.colorPrimaryHover, '#70b0ff');
    assert.equal(resolved.colorPrimaryActive, '#2178d6');
    assert.equal(resolved.colorInfo, '#4493f8');
    assert.equal(resolved.colorSuccess, '#3fb950');
    assert.equal(resolved.colorWarning, '#d29922');
    assert.equal(resolved.colorError, '#f85149');
    assert.equal(resolved.colorTextSecondary, '#8b949e');
    assert.equal(resolved.colorText, '#f0f6fc');
    assert.equal(resolved.colorBgLayout, '#0d1117');
    assert.equal(resolved.colorBgContainer, '#161b22');
    assert.equal(resolved.colorBorder, '#30363d');
    for (const token of ['colorPrimaryBg', 'colorPrimaryBorder', 'colorErrorBg', 'colorSuccessBg', 'colorWarningBg', 'colorBgMask', 'fontSize', 'controlHeight']) {
      assert.equal(resolved[token], baselineTokens[token], `keep the official dark derivative for ${token}`);
    }
    assert.equal(typeof foundation.createMakeDesignTheme, 'function');
    function ProviderTokenProbe() { return React.createElement('span', { 'data-primary': officialTheme.useToken().token.colorPrimary }); }
    const providerHtml = renderToStaticMarkup(React.createElement(foundation.MakeDesignProvider, { design: darkPlan }, React.createElement(ProviderTokenProbe)));
    assert.match(providerHtml, /data-primary="#4493f8"/, 'the real provider uses the same public theme configuration');
    const overridePlan = { ...darkPlan, controls: { style: { '--mk-accent': '#ff5600', '--mk-danger': '#e54545' } } };
    const overrideTokens = officialTheme.getDesignToken(foundation.createMakeDesignTheme(overridePlan));
    assert.equal(overrideTokens.colorPrimary, '#ff5600');
    assert.equal(overrideTokens.colorError, '#e54545');
    for (const mode of ['light', 'dark']) {
      const defaultConfiguration = foundation.createMakeDesignTheme({ choices: { theme: mode } });
      const defaultResolved = officialTheme.getDesignToken(defaultConfiguration);
      const officialDefaults = officialTheme.getDesignToken({ algorithm: mode === 'dark' ? officialTheme.darkAlgorithm : officialTheme.defaultAlgorithm });
      for (const token of ['colorPrimary', 'colorSuccess', 'colorWarning', 'colorError', 'colorText', 'colorBgContainer', 'colorBgMask']) {
        assert.equal(defaultResolved[token], officialDefaults[token], `an unspecified ${mode} ${token} keeps the official fallback`);
      }
    }
    const onFinish = () => {};
    const formElement = React.createElement(foundation.MakeFormLayout, { initialValues: { device: 'Saved camera' }, onFinish, children: React.createElement(foundation.MakeFormItem, { name: 'device', label: '设备名称', fieldType: 'Make.Field.Text', rules: [{ required: true }] }, React.createElement(Input)) });
    const html = renderToStaticMarkup(React.createElement(foundation.MakeDesignProvider, { design: { colors: { accent: '#ff5600' } } }, formElement));
    assert.match(html, /value="Saved camera"/);
    assert.equal((html.match(/设备名称/g) ?? []).length, 1, 'the field owns one official label');
    assert.match(html, /aria-required="true"/);
    assert.match(html, /makeui-antd-field-label/);
    const originalChange = () => {};
    const control = React.createElement(Input, { onChange: originalChange });
    const item = foundation.MakeFormItem({ name: 'active', label: '启用', valuePropName: 'checked', children: control });
    assert.equal(item.type, Form.Item);
    assert.equal(item.props.valuePropName, 'checked');
    assert.equal(item.props.children.type, Input, 'the official Form.Item still controls the official child');
    assert.equal(item.props.children.props.onChange, originalChange);
    for (const OfficialControl of [Input, DatePicker, DatePicker.RangePicker, Select, InputNumber]) {
      const child = React.createElement(OfficialControl, { style: { color: 'red' } });
      const field = foundation.MakeFormItem({ name: 'field', label: '字段', children: child });
      assert.equal(field.props.children.type, OfficialControl);
      assert.deepEqual(field.props.children.props.style, { width: '100%', color: 'red' });
    }
    const explicitWidth = foundation.MakeFormItem({ name: 'amount', label: '金额', children: React.createElement(InputNumber, { style: { width: 220 } }) });
    assert.equal(explicitWidth.props.children.props.style.width, 220);
    const textarea = foundation.MakeFormItem({ name: 'purpose', label: '用途', fieldType: 'Make.Field.TextArea', children: React.createElement(Input.TextArea, { autoSize: { minRows: 3, maxRows: 8 }, style: { color: 'blue' } }) });
    assert.deepEqual(textarea.props.children.props.style, { width: '100%', minHeight: 96, color: 'blue' });
    assert.deepEqual(textarea.props.children.props.autoSize, { minRows: 3, maxRows: 8 });
    const overriddenTextarea = foundation.MakeFormItem({ name: 'purpose', label: '用途', children: React.createElement(Input.TextArea, { style: { minHeight: 132 } }) });
    assert.equal(overriddenTextarea.props.children.props.style.minHeight, 132);
    const lucide = require('lucide-react');
    const iconReference = fs.readFileSync(new URL('../skills/makeui/references/field-type-icons.md', import.meta.url), 'utf8');
    const mappings = [...iconReference.matchAll(/^\| `([^`]+)` \| `[^`]+` \| `([^`]+)` \|$/gm)];
    assert.equal(mappings.length, 18);
    for (const [, fieldType, iconName] of mappings) {
      const label = foundation.MakeFieldLabel({ fieldType, children: '字段' });
      assert.equal(label.props.children[0].type, lucide[iconName], `${fieldType} must use the existing shared icon mapping`);
    }
    const detail = renderToStaticMarkup(React.createElement(foundation.MakeDetailGrid, { items: [{ key: 'owner', label: '负责人', fieldType: 'Make.Field.SingleUser', value: '张三' }, { key: 'description', label: '用途', fieldType: 'Make.Field.TextArea', value: '' }] }));
    assert.match(detail, /<dt/);
    assert.match(detail, /<dd[^>]*>张三<\/dd>/);
    assert.match(detail, /makeui-antd-detail-item-wide/);
    assert.doesNotMatch(detail, /<input/);
    const page = renderToStaticMarkup(React.createElement(foundation.MakeRecordSurface, { design: { choices: { detailOpening: 'page' } }, mode: 'detail', open: true, title: '借用单', status: '未提交', actions: React.createElement('button', { type: 'button' }, '宿主动作'), onClose() {}, children: '记录内容' }));
    assert.match(page, /借用单/);
    assert.match(page, /未提交/);
    assert.match(page, /宿主动作/);
    assert.match(page, /记录内容/);
    assert.match(page, /aria-label="返回"/);
    const suitePlan = { layout: { componentSuite: { rules: { action: 'outline', status: 'outline', tabs: 'segmented', field: 'inset', fieldHeight: 44, fieldRadius: 10 } } }, colors: { 'surface-warm': '#eeeeee' } };
    const suiteHtml = renderToStaticMarkup(React.createElement(foundation.MakeDesignProvider, { design: suitePlan }, React.createElement(React.Fragment, null,
      React.createElement(foundation.MakeActionButton, { intent: 'primary' }, '提交'),
      React.createElement(foundation.MakeStatusTag, { color: 'processing' }, '进行中'),
      React.createElement(foundation.MakeTabs, { items: [{ key: 'main', label: '详情', children: '字段' }] }))));
    assert.match(suiteHtml, /ant-btn-variant-outlined/);
    assert.match(suiteHtml, /ant-tag-outlined/);
    assert.match(suiteHtml, /ant-tabs-card/);
    const fieldTokens = foundation.toAntdComponentTokens(suitePlan);
    assert.equal(fieldTokens.Input.colorBgContainer, '#eeeeee');
    assert.equal(fieldTokens.Input.controlHeight, 44);
    assert.equal(fieldTokens.Input.borderRadius, 10);
    const fineTokens = foundation.toAntdComponentTokens({ ...suitePlan, controls: { style: { '--mk-height': '48px', '--mk-radius': '3px' } } });
    assert.equal(fineTokens.Input.controlHeight, 48);
    assert.equal(fineTokens.Input.borderRadius, 3);
    const disabledCards = renderToStaticMarkup(React.createElement(foundation.MakeDesignProvider, { design: { layout: { secondaryCards: { enabled: false } } } }, React.createElement(foundation.MakeAppShell, { brand: '应用', title: '业务', navigation: '导航', secondaryCardsSlot: '已确认业务统计' }, '主内容')));
    assert.match(disabledCards, /已确认业务统计/);
    const secondaryRegion = disabledCards.match(/<section class="makeui-antd-shell-secondary[^>]+>/)?.[0] ?? '';
    assert.doesNotMatch(secondaryRegion, /hidden=/, 'disabling decoration must not hide an existing business region');
    if (domDependencyRoot) {
      const fixture = path.join(temporary, 'dom.cjs');
      fs.writeFileSync(fixture, domFixture);
      const dom = spawnSync(process.execPath, [fixture, path.resolve(domDependencyRoot), path.join(copied, 'styles.css')], { encoding: 'utf8', timeout: 30000 });
      assert.equal(dom.status, 0, `official foundation DOM check:\n${dom.stdout}\n${dom.stderr}`);
      assert.match(dom.stdout, /official Form.Item DOM and isolated CSS: PASS/);
      assert.match(dom.stdout, /official Form.Item label visibility, single icons and field contracts: PASS/);
      assert.match(dom.stdout, /official app shell preserves one stateful brand and host slots across all navigation modes: PASS/);
      assert.match(dom.stdout, /official MakeTabs selection, host overrides and isolated skin: PASS/);
      assert.match(dom.stdout, /official record surface keeps Tabs state and portal skin across page\/drawer switches: PASS/);
      assert.match(dom.stdout, /official Drawer action presence and dynamic page\/drawer action groups: PASS/);
      assert.match(dom.stdout, /official record header keeps one stateful title\/status\/actions tree and Drawer popup context: PASS/);
      assert.match(dom.stdout, /official record surface preserves close focus, page keyboard behavior and portal cleanup: PASS/);
      assert.match(dom.stdout, /official record surfaces preserve the active Escape owner across pages and repeated Drawer openings: PASS/);
      assert.match(dom.stdout, /official record surface popup layers, clicks and values across page, Modal, Drawer and public popup base: PASS/);
    }
    for (const [name, actions, present] of [
      ['undefined', undefined, false], ['null', null, false], ['false', false, false], ['empty', '', false],
      ['zero', 0, true], ['true', true, true], ['button', React.createElement('button', null, 'Existing action'), true],
    ]) {
      const staticPage = renderToStaticMarkup(React.createElement(foundation.MakeRecordSurface, { design: { choices: { detailOpening: 'page' } }, mode: 'detail', open: true, title: 'Record', actions, onClose() {}, children: 'Existing content' }));
      assert.equal((staticPage.match(/class="makeui-antd-surface-actions"/g) ?? []).length, present ? 1 : 0, `static page preserves the ${name} action presence`);
    }
    for (const navigation of ['single', 'double', 'top', 'rail', 'workspace']) {
      const shell = renderToStaticMarkup(React.createElement(foundation.MakeAppShell, { design: { choices: { navigation } }, brand: 'SSR static brand', title: 'SSR static title', navigation: 'SSR static navigation', headerEnd: 'SSR static headerEnd' }, 'SSR static children'));
      for (const slot of ['brand', 'title', 'navigation', 'headerEnd', 'children']) assert.equal((shell.match(new RegExp(`>SSR static ${slot}<`, 'g')) ?? []).length, 1, `the ${navigation} static export contains one ${slot} slot`);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
