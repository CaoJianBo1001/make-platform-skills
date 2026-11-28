import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cp,mkdtemp,readFile,rm,writeFile,symlink} from 'node:fs/promises';
import {existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const flags=new Map();
for(const arg of process.argv.slice(2)){
 const match=/^--(skill|dependencies|canvas-types|approval-types)=(.*)$/.exec(arg);
 if(!match||flags.has(match[1])||!match[2])throw new Error(`Invalid explicit option: ${arg}`);
 const target=resolve(match[2]);
 if(!existsSync(target)||(['skill','dependencies'].includes(match[1])?!statSync(target).isDirectory():!statSync(target).isFile()))throw new Error(`Missing ${match[1]} path: ${target}`);
 flags.set(match[1],target);
}
if((flags.has('canvas-types')||flags.has('approval-types'))&&!flags.has('dependencies'))throw new Error('Public package type compilation requires explicit --dependencies=<node_modules>');
const skillRoot=flags.get('skill')??fileURLToPath(new URL('../skills/makeui/',import.meta.url));
const assetRoot=join(skillRoot,'assets');
const theme=await import(pathToFileURL(join(assetRoot,'public-theme/index.mjs')).href);
async function copyClosure(directory){
 const assets=join(directory,'assets');
 await cp(join(assetRoot,'public-theme'),join(assets,'public-theme'),{recursive:true});
 await cp(join(assetRoot,'antd-foundation/theme.mjs'),join(assets,'antd-foundation/theme.mjs'),{recursive:true});
 for(const name of ['mobile-brand-theme.mjs','mobile-brand-theme.d.mts'])await cp(join(assetRoot,name),join(assets,name));
 return assets;
}
const A={choices:{ds:'intercom',theme:'light'},colors:{accent:'#c41c1c','accent-on':'#ffffff',fg:'#171a1d',surface:'#ffffff',bg:'#faf9f6',muted:'#7b7b78',meta:'#9c9fa5',border:'#dedbd6','border-soft':'#ebe9e4'},metrics:{bodySize:18,headingSize:34,padding:36,rowHeight:56,controlHeight:40,radius:4},typography:{body:'Inter, sans-serif',roles:{fieldLabel:15,controlText:16,recordTitle:21,meta:13}}};
const B={choices:{ds:'github',theme:'dark'},colors:{accent:'#7c3aed','accent-on':'#fff7ed',fg:'#fafafa','fg-2':'#ffffff',surface:'#18181b',bg:'#09090b',muted:'#a1a1aa',meta:'#d4d4d8',border:'#52525b','border-soft':'#3f3f46'},metrics:{bodySize:16,headingSize:29,padding:24,rowHeight:48,controlHeight:38,radius:10},typography:{body:'Georgia, serif',roles:{fieldLabel:17,controlText:18,recordTitle:24,sectionTitle:20,meta:14}}};
const options={foundation:{library:'antd'}};
const normalized=(design)=>theme.normalizePublicTheme({...options,...(design?{design}:{})});
const capability={canvas:'canvas-table/semantic-theme/v1',approval:'make-app-approval/semantic-theme/v1'};
const resolveColor=(value)=>value.includes('color-mix(')?'rgba(10, 20, 30, 0.2)':value;

for(const target of ['canvas','approval']){
 test(`正式主题目标${target}按released发现，实际安装包仍须通过公开能力门禁`,()=>{
  const descriptor=theme.PUBLIC_THEME_TARGETS[target];
  assert.equal(descriptor.availability,'released',`${target}已采用正式基线，不能继续误导消费者进入候选分支`);
  assert.equal(descriptor.contract,capability[target]);
  const map=target==='canvas'?theme.toCanvasTableStyle:theme.toApprovalTheme;
  assert.throws(()=>map(normalized(A),{resolveColor}),/PUBLIC_THEME_CAPABILITY_REQUIRED/,
   '发布状态不能替代宿主实际安装包的运行合同');
 });
}

test('固定v1合同从默认和两方案生成稳定语义，不携带设计ID/URL/recipe到包',()=>{
 assert.equal(theme.MAKEUI_PUBLIC_THEME_CONTRACT,'makeui-public-theme/v1');
 for(const design of [undefined,A,B]){
  const snapshot=normalized(design);assert.equal(snapshot.contract,theme.MAKEUI_PUBLIC_THEME_CONTRACT);
  const canvas=theme.toCanvasTableStyle(snapshot,{capability:capability.canvas,resolveColor});
  const approval=theme.toApprovalTheme(snapshot,{capability:capability.approval});
  assert.equal(canvas.primaryColor,snapshot.tokens.colors.primary);assert.equal(approval.colors.primary,snapshot.tokens.colors.primary);
  for(const output of [canvas,approval])for(const key of ['choices','design','source','url','layout','recipe','ds','contract'])assert.equal(Object.hasOwn(output,key),false,key);
 }
});
test('同contract下任意已声明颜色/字号/间距值更新自动传播，输入不变异',()=>{
 const input={...options,design:structuredClone(A)};const original=structuredClone(input);const before=theme.normalizePublicTheme(input);
 const after=theme.normalizePublicTheme({...input,overrides:{colors:{primary:'#005a9c',onPrimary:'#fff1da',secondaryText:'#789abc'},typography:{roles:{body:23,fieldLabel:19,controlText:21,meta:16}},density:{rowHeight:63,headerHeight:61},spacing:{tableCell:17,tableHeader:18,controlInline:19,controlBlock:7,field:22,section:37}}});
 assert.deepEqual(input,original);assert.equal(before.tokens.colors.primary,'#c41c1c');
 const canvas=theme.toCanvasTableStyle(after,{capability:capability.canvas,resolveColor});const approval=theme.toApprovalTheme(after,{capability:capability.approval});
 assert.equal(canvas.primaryColor,'#005a9c');assert.equal(canvas.onPrimaryColor,'#fff1da');assert.equal(canvas.secondaryTextColor,'#789abc');assert.equal(canvas.fontSize,23);assert.equal(canvas.headerFontSize,19);assert.equal(canvas.summaryFontSize,21);assert.equal(canvas.secondaryFontSize,16);assert.equal(canvas.cellPadding,17);assert.equal(canvas.headerCellPadding,18);assert.equal(canvas.tooltipPadding,'7px 19px');assert.equal(canvas.rowHeight,63);assert.equal(canvas.headerHeight,61);assert.equal(approval.spacing.field,22);assert.equal(approval.spacing.section,37);assert.equal(approval.typography.roles.body,23);
});
test('既有AntD解析角色和方案间距值持续复用，不建立另一套默认解析',async()=>{
 const old=await import(pathToFileURL(join(assetRoot,'antd-foundation/theme.mjs')).href);
 for(const design of [undefined,A,B]){const snapshot=normalized(design);const tokens=old.toAntdTokens(design);const roles=old.resolveTypography(design).roles;const variables=old.toMakeDesignVariables(design);assert.equal(snapshot.tokens.typography.roles.body,roles.body);assert.equal(snapshot.tokens.typography.roles.recordTitle,roles.recordTitle);assert.equal(snapshot.tokens.density.controlHeight,tokens.controlHeight);assert.equal(snapshot.tokens.spacing.section,Number.parseFloat(variables['--makeui-content-padding']));assert.equal(snapshot.tokens.radius.control,tokens.borderRadius);}
});

test('body/heading字距独立复用既有解析，heading负值不被body零值覆盖',()=>{
 const design={...A,typography:{...A.typography,tracking:{body:0,heading:-0.03}}};
 const snapshot=normalized(design);assert.deepEqual(snapshot.tokens.typography.tracking,{body:0,heading:-0.03});
 assert.deepEqual(theme.toApprovalTheme(snapshot,{capability:capability.approval}).typography.tracking,{body:0,heading:-0.03});
 assert.match(theme.PUBLIC_THEME_TARGETS.canvas.hostOwned,/tracking/);
});
test('移动投影严格为原8品牌字段，PC密度/字号/间距/阴影全部不进入',()=>{
 const snapshot=normalized(A);const mobile=theme.toMobileBrandTheme(snapshot);assert.deepEqual(Object.keys(mobile).sort(),['primary','onPrimary','primarySoft','link','focusRing','actionBackground','actionBorder','actionText'].sort());assert.equal(mobile.actionBackground,mobile.primary);assert.equal(mobile.actionText,mobile.onPrimary);
 const approval=theme.toApprovalTheme(snapshot,{capability:capability.approval,presentation:'mobile'});assert.deepEqual(Object.keys(approval),['colors']);assert.deepEqual(Object.keys(approval.colors).sort(),['primary','onPrimary','primarySoft','link','focusRing'].sort());
});
test('未知版本、未知token、无效数值和缺少组件库选择明确拒绝',()=>{
 assert.throws(()=>theme.normalizePublicTheme({}),/FOUNDATION_REQUIRED/);
 const snapshot=normalized(A);assert.throws(()=>theme.toMobileBrandTheme({...snapshot,contract:'makeui-public-theme/v2'}),/UNSUPPORTED_PUBLIC_THEME_CONTRACT/);
 for(const overrides of [{colors:{typo:'#000'}},{spacing:{typo:4}},{typography:{roles:{typo:13}}},{density:{controlHeight:-1}},{radius:{control:-1}},{typography:{roles:{body:NaN}}}])assert.throws(()=>theme.normalizePublicTheme({...options,overrides}),/UNKNOWN_TOKEN|INVALID_THEME_TOKEN/);
 assert.throws(()=>theme.normalizePublicTheme({...options,overrides:JSON.parse('{"colors":{"__proto__":{"polluted":true}}}')}),/UNKNOWN_TOKEN/);assert.equal({}.polluted,undefined);
});
test('非AntD不借用AntD默认；baseline与设计resolver必须明确',()=>{
 assert.throws(()=>theme.normalizePublicTheme({foundation:{library:'arco'}}),/FOUNDATION_BASELINE_REQUIRED/);
 const baseline=structuredClone(normalized().tokens);baseline.typography.roles.body=27;baseline.typography.roles.fieldLabel=25;baseline.colors.primary='#abc123';
 const direct=theme.normalizePublicTheme({foundation:{library:'arco',baseline}});assert.equal(direct.tokens.typography.roles.body,27);assert.equal(direct.tokens.typography.roles.fieldLabel,25);
 assert.throws(()=>theme.normalizePublicTheme({design:A,foundation:{library:'arco',baseline}}),/FOUNDATION_RESOLVER_REQUIRED/);
 const resolved=theme.normalizePublicTheme({design:A,foundation:{library:'arco',baseline,resolveDesign:design=>({colors:{primary:design.colors.accent}})}});assert.equal(resolved.tokens.colors.primary,'#c41c1c');assert.equal(resolved.tokens.typography.roles.fieldLabel,25);
});
test('公开能力constant精确门禁；旧Canvas只走显式已核验style兼容子集',()=>{
 const snapshot=normalized();assert.throws(()=>theme.toCanvasTableStyle(snapshot),/PUBLIC_THEME_CAPABILITY_REQUIRED/);assert.throws(()=>theme.toCanvasTableStyle(snapshot,{capability:'old'}),/PUBLIC_THEME_CAPABILITY_REQUIRED/);assert.throws(()=>theme.toApprovalTheme(snapshot),/PUBLIC_THEME_CAPABILITY_REQUIRED/);
 const legacy=theme.toLegacyCanvasTableStyle(snapshot,{resolveColor});assert.equal(legacy.primaryColor,snapshot.tokens.colors.primary);for(const key of ['onPrimaryColor','headerTextColor','tooltipBgColor','headerFontSize','selectedBgColor'])assert.equal(Object.hasOwn(legacy,key),false);
});
test('Canvas不把var/color-mix/currentColor默变黑；同步resolver输出仍必须concrete',()=>{
 const snapshot=normalized();assert.throws(()=>theme.toCanvasTableStyle(snapshot,{capability:capability.canvas}),/COLOR_RESOLVER_REQUIRED/);
 for(const value of ['var(--brand)','color-mix(in srgb,red 50%,white)','currentColor']){const custom=theme.normalizePublicTheme({...options,overrides:{colors:{primary:value}}});assert.throws(()=>theme.toCanvasTableStyle(custom,{capability:capability.canvas,resolveColor:v=>v}),/COLOR_RESOLVER_REQUIRED/);const mapped=theme.toCanvasTableStyle(custom,{capability:capability.canvas,resolveColor:()=> '#123456'});assert.equal(mapped.primaryColor,'#123456');}
 assert.throws(()=>theme.toCanvasTableStyle(snapshot,{capability:capability.canvas,resolveColor:()=>Promise.resolve('#000')}),/COLOR_RESOLVER_REQUIRED/);
});
test('RGB具体颜色遵守CSS数字及legacy通道单位，不绕过宿主resolver',()=>{
 const invalid=['rgb(10%, 20, 30%)','rgba(10%, 20, 30%, 0.5)','rgb(1., 2, 3)','rgba(1,2,3,1.)'];
 for(const value of invalid){
  assert.equal(theme.isConcreteCanvasColor(value),false,value);
  const snapshot=theme.normalizePublicTheme({...options,overrides:{colors:{primary:value}}});let resolved=false;
  const output=theme.toCanvasTableStyle(snapshot,{capability:capability.canvas,resolveColor:color=>{if(color===value){resolved=true;return '#123456';}return resolveColor(color);}});
  assert.equal(resolved,true);assert.equal(output.primaryColor,'#123456');
 }
 for(const value of ['rgb(10%,20%,30%)','rgb(1.5,2,3)','rgba(1,2,3,.5)','rgb(10% 20 30% / 50%)'])assert.equal(theme.isConcreteCanvasColor(value),true,value);
});
test('审批内置Canvas同样使用宿主颜色边界，手机仍只保留品牌投影',()=>{
 const snapshot=theme.normalizePublicTheme({...options,overrides:{colors:{primary:'var(--project-primary)',primarySoft:'color-mix(in srgb, red 20%, white)'},border:{color:'var(--project-border)'}}});
 const resolver=value=>value.startsWith('var(')?'#123456':resolveColor(value);let applied;
 const binding=theme.createControlledPublicThemeBinding({approval:{contract:capability.approval,setTheme:value=>{applied=value;}},resolveColor:resolver,logger:()=>{}});
 binding.apply(snapshot);assert.equal(applied.colors.primary,'#123456');assert.equal(applied.border.color,'#123456');assert.equal(applied.colors.primarySoft,'rgba(10, 20, 30, 0.2)');
 const direct=theme.toApprovalTheme(snapshot,{capability:capability.approval,resolveColor:resolver});assert.equal(direct.colors.primary,'#123456');
 const phone=theme.toApprovalTheme(snapshot,{capability:capability.approval,presentation:'mobile',resolveColor:()=>{throw Error('No Canvas on phone');}});assert.equal(phone.colors.primary,'var(--project-primary)');assert.deepEqual(Object.keys(phone),['colors']);
});
test('受控宿主更新原实例，不新建Controller或自动读取官网，先准备全目标再提交',()=>{
 const calls=[];const canvasInstance={updateProps:patch=>calls.push(['canvas',patch])};const approvalSetter=value=>calls.push(['approval',value]);const binding=theme.createControlledPublicThemeBinding({canvas:{contract:capability.canvas,instance:canvasInstance},approval:{contract:capability.approval,setTheme:approvalSetter},mobile:{setTheme:value=>calls.push(['mobile',value])},host:{setTheme:value=>calls.push(['host',value])},resolveColor,logger:()=>{}});
 binding.apply(normalized(A));binding.apply(normalized(B));assert.equal(calls.filter(([name])=>name==='canvas').length,2);assert.equal(calls.filter(([name])=>name==='approval').length,2);assert.equal(canvasInstance.updateProps instanceof Function,true);
 const before=calls.length;assert.throws(()=>binding.apply({...normalized(),contract:'unknown'}),/UNSUPPORTED_PUBLIC_THEME_CONTRACT/);assert.equal(calls.length,before);
});
test('mobile宿主只提交品牌色；旧approval只能明确保留host slots并报告内部差异',()=>{
 const calls=[];const binding=theme.createControlledPublicThemeBinding({canvas:{contract:capability.canvas,instance:{updateProps:()=>calls.push('canvas')}},approval:{contract:capability.approval,setTheme:value=>calls.push(value)},mobile:{setTheme:value=>calls.push(value)},resolveColor,logger:()=>{}});const result=binding.apply(normalized(B),{presentation:'mobile'});assert.equal(calls.includes('canvas'),false);assert.ok(result.skipped.includes('canvas:mobile-not-applicable'));assert.deepEqual(Object.keys(calls[0]),['colors']);assert.equal(Object.hasOwn(calls[1],'typography'),false);
 const legacy=theme.createControlledPublicThemeBinding({approval:{setTheme:()=>{throw new Error('must not call new API')}},compatibility:{approval:'host-slots'},logger:()=>{}});assert.ok(legacy.apply(normalized()).compatibility.includes('approval:host-slots-only'));
});
test('legacy兼容只解析自己真正使用的颜色，不被未支持的扩展语义色阻断',()=>{
 const base=normalized().tokens;const colors=Object.fromEntries(Object.keys(base.colors).map(key=>[key,'#123456']));colors.onPrimary='var(--extended-only-ink)';const snapshot=theme.normalizePublicTheme({...options,overrides:{colors,border:{color:'#345678',subtleColor:'#456789'}}});
 assert.equal(theme.toLegacyCanvasTableStyle(snapshot).primaryColor,'#123456');
 assert.throws(()=>theme.toCanvasTableStyle(snapshot,{capability:capability.canvas}),/COLOR_RESOLVER_REQUIRED/);
});

test('每层语义值同合同传播；保留宿主专属角色与recipe边界',()=>{
 const base=normalized(A).tokens;
 const patch={colors:Object.fromEntries(Object.keys(base.colors).map((key,index)=>[key,`#${(0x101010+index*0x101).toString(16)}`])),typography:{fontFamily:'Example Body',headingFontFamily:'Example Heading',monoFontFamily:'Example Mono',roles:Object.fromEntries(Object.keys(base.typography.roles).map((key,index)=>[key,20+index])),lineHeight:1.7,weights:{body:450,heading:650},tracking:{body:.01,heading:-.04}},density:{controlHeight:47,rowHeight:59,headerHeight:61},spacing:{controlInline:9,controlBlock:5,field:21,section:35,tableCell:11,tableHeader:13},radius:{control:3,panel:7,popup:9},border:{width:2,color:'#234567',subtleColor:'#345678'},shadow:{panel:'0 1px 3px #234567',popup:'0 2px 8px #345678'}};
 const input={...options,design:structuredClone(A),overrides:patch};const original=structuredClone(input);const snapshot=theme.normalizePublicTheme(input);
 assert.deepEqual(input,original);assert.throws(()=>{snapshot.tokens.colors.primary='#000';},TypeError);
 const approval=theme.toApprovalTheme(snapshot,{capability:capability.approval});
 for(const key of ['colors','density','spacing','radius','border','shadow'])assert.deepEqual(approval[key],patch[key]);
 for(const key of ['fontFamily','headingFontFamily','lineHeight','weights','tracking'])assert.deepEqual(approval.typography[key],patch.typography[key]);
 for(const key of Object.keys(approval.typography.roles))assert.equal(approval.typography.roles[key],patch.typography.roles[key]);
 assert.equal(Object.hasOwn(approval.typography.roles,'pageTitle'),false);assert.equal(snapshot.tokens.typography.roles.pageTitle,20);assert.equal(Object.hasOwn(approval.typography,'monoFontFamily'),false);
 const canvas=theme.toCanvasTableStyle(snapshot,{capability:capability.canvas});assert.equal(canvas.fontFamily,'Example Body');assert.equal(canvas.fontWeight,450);assert.equal(canvas.headerFontWeight,650);assert.equal(canvas.tooltipBorderRadius,9);assert.equal(canvas.scrollbarColor,'#234567');assert.equal(canvas.borderColor,'#345678');
 const mobile=theme.toMobileBrandTheme(snapshot);assert.equal(mobile.primary,patch.colors.primary);assert.equal(Object.keys(mobile).length,8);
});
test('宿主任何目标准备失败时不调用其他setter，resolver能力错误保留可诊断code',()=>{
 const calls=[];const ports={canvas:{contract:capability.canvas,instance:{updateProps:()=>calls.push('canvas')}},approval:{contract:'unsupported',setTheme:()=>calls.push('approval')},resolveColor,logger:()=>{}};
 assert.throws(()=>theme.createControlledPublicThemeBinding(ports).apply(normalized()),/PUBLIC_THEME_CAPABILITY_REQUIRED/);assert.deepEqual(calls,[]);
 const missing=()=>{throw new theme.PublicThemeError('COLOR_RESOLVER_REQUIRED','missing host variable',{path:'colors.primary'});};
 const snapshot=theme.normalizePublicTheme({...options,overrides:{colors:{primary:'var(--missing)'}}});
 assert.throws(()=>theme.toCanvasTableStyle(snapshot,{capability:capability.canvas,resolveColor:missing}),error=>error.code==='COLOR_RESOLVER_REQUIRED');
});

test('固定项目受控宿主示例仅在显式updateProjectTheme更新，不读取远端或重建实例',()=>{
 const updates=[];const host=theme.createFixedProjectThemeHost({approval:{contract:capability.approval,setTheme:value=>updates.push(value)},logger:()=>{}});
 assert.equal(updates.length,0);
 const a=host.updateProjectTheme({...options,design:A});const b=host.updateProjectTheme({...options,design:B});
 assert.equal(a.snapshot.contract,b.snapshot.contract);assert.equal(updates.length,2);assert.equal(updates[0].colors.primary,'#c41c1c');assert.equal(updates[1].colors.primary,'#7c3aed');
 assert.deepEqual(a.result.applied,['approval']);assert.equal(Object.hasOwn(updates[0],'design'),false);
});

test('颜色I/O边界不接受invalid-at-computed-value继承黑；此受控stub不算浏览器证据',()=>{
 let count=0,canvasReads=0;
 const style={values:new Map(),setProperty(key,value){this.values.set(key,value);},getPropertyValue(key){return this.values.get(key)??'';}};
 const probe={style,setAttribute(){},remove(){count--;}};
 const doc={defaultView:{CSS:{supports:()=>true},getComputedStyle:()=>({color:'rgb(0, 0, 0)',getPropertyValue:()=>''})},createElement(tag){if(tag==='canvas'){canvasReads++;throw new Error('Invalid host variable must fail before drawing');}return probe;}};
 const owner={isConnected:true,ownerDocument:doc,appendChild(){count++;}};
 const resolver=theme.createCanvasColorResolver({owner,logger:()=>{}});
 assert.throws(()=>resolver('var(--missing)','colors.primary'),error=>error.code==='COLOR_RESOLVER_REQUIRED');
 assert.equal(canvasReads,0);assert.equal(count,0);
});

test('完整复制闭包在含空格独立目录可ESM加载，无React/AntD runtime及DOM依赖',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'makeui public theme '));try{const assets=await copyClosure(directory);const entry=pathToFileURL(join(assets,'public-theme/index.mjs')).href;const result=spawnSync(process.execPath,['--input-type=module','-e',`delete globalThis.window;delete globalThis.document;const m=await import(${JSON.stringify(entry)});const x=m.normalizePublicTheme({foundation:{library:'antd'}});if(x.contract!=='makeui-public-theme/v1')throw Error('contract');for(const target of ['canvas','approval'])if(m.PUBLIC_THEME_TARGETS[target].availability!=='released')throw Error('copied target must retain released status');`],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.ok(theme.PUBLIC_THEME_COPY_CLOSURE.includes('antd-foundation/theme.mjs'));}finally{await rm(directory,{recursive:true,force:true});}
});

async function compilePublicTypes(target){
 const directory=await mkdtemp(join(tmpdir(),'makeui public types '));
 try {
  await copyClosure(directory);
  await symlink(flags.get('dependencies'),join(directory,'node_modules'),'dir');
  let consumer=`import {normalizePublicTheme,toCanvasTableStyle,toApprovalTheme,toMobileBrandTheme,createControlledPublicThemeBinding,PublicThemeError,type CanvasPublicThemeStyle,type ApprovalPublicTheme} from './assets/public-theme/index.mjs';
const resolverFailure=new PublicThemeError('COLOR_RESOLVER_REQUIRED','Missing scoped variable',{path:'colors.primary'});
resolverFailure.code satisfies string;
const snapshot=normalizePublicTheme({foundation:{library:'antd'},overrides:{typography:{tracking:{body:0,heading:-.03}},spacing:{section:33}}});
const canvas=toCanvasTableStyle(snapshot,{capability:'canvas-table/semantic-theme/v1'});
const approval=toApprovalTheme(snapshot,{capability:'make-app-approval/semantic-theme/v1'});
toApprovalTheme(snapshot,{capability:'make-app-approval/semantic-theme/v1',resolveColor:value=>value});
const phone=toMobileBrandTheme(snapshot);phone.actionText satisfies string|undefined;
createControlledPublicThemeBinding({canvas:{contract:'canvas-table/semantic-theme/v1',instance:{updateProps(patch){patch.style.fontSize satisfies number;}}}});
// @ts-expect-error unknown semantic token
normalizePublicTheme({foundation:{library:'antd'},overrides:{colors:{typo:'#fff'}}});
// @ts-expect-error runtime capability required
toCanvasTableStyle(snapshot);
// @ts-expect-error no PC metrics on mobile projection
phone.fontSize;
// @ts-expect-error non-AntD needs its own baseline
normalizePublicTheme({foundation:{library:'arco'}});
// @ts-expect-error distinct heading tracking needs the grouped contract
normalizePublicTheme({foundation:{library:'antd'},overrides:{typography:{tracking:0}}});
`;
  if(target==='canvas-types')consumer+=`import type {ITableStyle,CANVAS_TABLE_THEME_CONTRACT} from ${JSON.stringify(flags.get('canvas-types'))};
declare const canvasContract:typeof CANVAS_TABLE_THEME_CONTRACT;
canvasContract satisfies 'canvas-table/semantic-theme/v1';
canvas satisfies ITableStyle;
const canvasKeys:Exclude<keyof CanvasPublicThemeStyle,keyof ITableStyle> extends never?true:never=true;
`;
  if(target==='approval-types')consumer+=`import type {MAKE_APPROVAL_THEME_CONTRACT,MakeApprovalTheme} from ${JSON.stringify(flags.get('approval-types'))};
declare const approvalContract:typeof MAKE_APPROVAL_THEME_CONTRACT;
approvalContract satisfies 'make-app-approval/semantic-theme/v1';
approval satisfies MakeApprovalTheme;
const approvalKeys:Exclude<keyof ApprovalPublicTheme,keyof MakeApprovalTheme> extends never?true:never=true;
const approvalColors:Exclude<keyof ApprovalPublicTheme['colors'],keyof NonNullable<MakeApprovalTheme['colors']>> extends never?true:never=true;
type ApprovalGroupsFit={ [G in keyof ApprovalPublicTheme]:Exclude<keyof ApprovalPublicTheme[G],keyof NonNullable<MakeApprovalTheme[G]>> extends never?true:never };
const approvalGroups:ApprovalGroupsFit={colors:true,typography:true,density:true,spacing:true,radius:true,border:true,shadow:true};
const approvalRoles:Exclude<keyof ApprovalPublicTheme['typography']['roles'],keyof NonNullable<NonNullable<MakeApprovalTheme['typography']>['roles']>> extends never?true:never=true;
const approvalTracking:Exclude<keyof ApprovalPublicTheme['typography']['tracking'],keyof NonNullable<NonNullable<MakeApprovalTheme['typography']>['tracking']>> extends never?true:never=true;
`;
  await writeFile(join(directory,'consumer.mts'),consumer);
  const require=createRequire(join(flags.get('dependencies'),'makeui-explicit-dependencies.cjs'));
  const tsc=require.resolve('typescript/bin/tsc');
  const result=spawnSync(process.execPath,[tsc,'--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--lib','ES2022,DOM','consumer.mts'],{cwd:directory,encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
 } finally {await rm(directory,{recursive:true,force:true});}
}
test('复制后的自身公开声明可独立编译并拒绝未知token及未门禁API',{skip:!flags.has('dependencies')?'explicit --dependencies not provided; own declarations not compiled, pure contracts still run':false},()=>compilePublicTypes());
test('真实Canvas公开声明能力常量及全字段类型',{skip:!flags.has('canvas-types')?'explicit --canvas-types not provided; the installed package API is not asserted in this run':false},()=>compilePublicTypes('canvas-types'));
test('真实Approval公开声明能力常量及全字段类型',{skip:!flags.has('approval-types')?'explicit --approval-types not provided; the installed package API is not asserted in this run':false},()=>compilePublicTypes('approval-types'));
