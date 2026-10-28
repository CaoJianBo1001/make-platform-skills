#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const loadLayout = () => import('../skills/make-app-approval/assets/mobile-detail-layout.mjs');
const loadStartIntents = async () => {
  const markdown = read('skills/make-app-approval/references/record-lifecycle.md');
  const source = [...markdown.matchAll(/```js\n([\s\S]*?)\n```/g)]
    .map((match) => match[1]).find((code) => code.includes('export function getSavedRecordApprovalIntents('));
  assert.ok(source, '已保存记录须提供独立发起与编辑保存的候选入口示例');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};

test('PC/手机：无普通编辑权限仍有详情发起候选，不获得编辑保存入口', async () => {
  const { getSavedRecordApprovalIntents } = await loadStartIntents();
  for (const canEdit of [false, true]) {
    assert.deepEqual(getSavedRecordApprovalIntents({
      hasDefinition: true, status: 'UNSUBMITTED', locked: false, canEdit,
    }), { start: true, saveAndStart: canEdit });
  }
});

test('发起候选只接受明确未提交、有效绑定且未锁定，不能用状态缺失推断', async () => {
  const { getSavedRecordApprovalIntents } = await loadStartIntents();
  for (const status of [undefined, null, '', 'UNKNOWN', 'IN_APPROVAL', 'RETURNING', 'APPROVED', 'REJECTED', 'CANCELLED']) {
    assert.deepEqual(getSavedRecordApprovalIntents({hasDefinition: true, status, canEdit: true}), {start: false, saveAndStart: false});
  }
  for (const input of [{hasDefinition: false}, {hasDefinition: true, locked: true}]) {
    assert.deepEqual(getSavedRecordApprovalIntents({...input, status: 'UNSUBMITTED', canEdit: true}), {start: false, saveAndStart: false});
  }
});

test('主文档和各展示入口不得再次移除详情发起或将其绑定到普通编辑权限', () => {
  for (const file of [
    'skills/make-app-approval/SKILL.md',
    'skills/make-app-actions/SKILL.md',
    ...['initiation-contract','record-lifecycle','status-display','mobile','verification'].map(name => `skills/make-app-approval/references/${name}.md`),
  ]) {
    assert.doesNotMatch(read(file), /详情(?:页)?(?:不显示|不提供|无|不增加)[^\n。；]*发起(?:审批|入口)|首次发起统一(?:放在|由)/, file);
  }
  const headers = read('skills/makeui/references/drawer-layout.md').split('\n').find(line => line.startsWith('| Business record detail |'));
  assert.match(headers, /发起审批/, 'PC 详情头部须保留合法发起入口');
  for (const file of ['skills/makeui/references/mobile-defaults.md', 'skills/make-app-actions/references/mobile-card-actions.md']) {
    assert.match(read(file), /编辑.{0,10}删除.{0,20}都不可用[^\n。]*发起[^\n。]*撤回[^\n。]*(保留|不移除)/,
      `${file} 不能因普通编辑/删除被拒绝而移除合法审批动作`);
  }
});

test('手机加载与失败态保留原 content 和重试，不能等待不存在的 sections', async () => {
  const { composeApprovalTaskLayout } = await loadLayout();
  for (const content of [Object.freeze({type:'loading'}), Object.freeze({type:'retry', onClick(){}})]) {
    const slots = Object.freeze({title:'审批详情', content, actions:null, footer:null});
    const result = composeApprovalTaskLayout(slots, {presentation:'mobile'});
    assert.equal(result.content, content);
    assert.deepEqual(result.sections, []);
    assert.deepEqual(result.actions, []);
  }
});

test('手机组合直接保留包拥有的区块，申请信息、意见、错误各一份', async () => {
  const { composeApprovalTaskLayout } = await loadLayout();
  const nodes = Object.freeze(Object.fromEntries(['application','history','opinion','feedback'].map(key => [key,Object.freeze({key})])));
  const slots = Object.freeze({sections:nodes, actionItems:[], content:Object.freeze({duplicated:true})});
  const result = composeApprovalTaskLayout(slots, {presentation:'mobile'});
  assert.deepEqual(result.sections.map(({key}) => key), ['application','history']);
  assert.equal(result.sections[0].content, nodes.application);
  assert.equal(result.sections[1].content, nodes.history);
  assert.equal(result.opinion, nodes.opinion);
  assert.equal(result.feedback, nodes.feedback);
  assert.equal(result.content, null);
  assert.deepEqual(result.actions, []);
  assert.equal(composeApprovalTaskLayout({sections:{...nodes,history:null}}, {presentation:'mobile'}).sections.length, 1);
});

test('没有历史节点时不生成空页签，保留合法的非空历史节点', async () => {
  const { composeApprovalTaskLayout } = await loadLayout();
  const application = Object.freeze({key:'application'});
  // 审批包使用 props.history != null && <section>，未提供历史时返回 false。
  for (const history of [undefined, null, false, true]) {
    const slots = {sections:{application, history, opinion:null, feedback:null}, actionItems:[]};
    const mobile = composeApprovalTaskLayout(slots, {presentation:'mobile'});
    assert.deepEqual(mobile.sections.map(section => section.key), ['application']);
    assert.equal(mobile.sections[0].content, application);
    assert.equal(composeApprovalTaskLayout(slots, {presentation:'desktop'}), slots);
  }
  for (const history of [0, '历史内容', Object.freeze({key:'history'})]) {
    const result = composeApprovalTaskLayout({sections:{application, history}}, {presentation:'mobile'});
    assert.equal(result.sections[1].content, history, '不能用真假值过滤误删合法 React 内容');
  }
});

test('手机动作映射保持原回调和互斥，数值错误阻止保存字段的动作但不阻止 RETURN', async () => {
  const { composeApprovalTaskLayout } = await loadLayout();
  const calls=[];
  const actionItems=Object.freeze(['APPROVE','REJECT','RETURN','SUBMIT'].map(actionType => Object.freeze({
    actionType, label:actionType, disabled:false, loading:false, onClick:()=>calls.push(actionType),
  })));
  const slots=Object.freeze({sections:Object.freeze({application:'字段',history:null,opinion:'意见',feedback:null}),actionItems});
  const result=composeApprovalTaskLayout(slots,{presentation:'mobile',hasFieldErrors:true});
  assert.deepEqual(result.actions.map(({key,disabled,variant})=>({key,disabled,variant})), [
    {key:'APPROVE',disabled:true,variant:'primary'}, {key:'REJECT',disabled:true,variant:'default'},
    {key:'RETURN',disabled:false,variant:'default'}, {key:'SUBMIT',disabled:true,variant:'primary'},
  ]);
  result.actions.forEach((action,index)=>assert.equal(action.onClick,actionItems[index].onClick));
  result.actions.find(action=>action.key==='RETURN').onClick();
  assert.deepEqual(calls,['RETURN']);
  for (const state of [{disabled:true,loading:false}, {disabled:false,loading:true}]) {
    const action={...actionItems[2],...state};
    const [mapped]=composeApprovalTaskLayout({...slots,actionItems:[action]},{presentation:'mobile'}).actions;
    assert.equal(mapped.disabled,true);
    assert.equal(mapped.loading,state.loading);
  }
});

test('桌面和平板原插槽原样保留，不改变动作位置、正文或 footer', async () => {
  const { composeApprovalTaskLayout } = await loadLayout();
  const slots=Object.freeze({title:{},actions:{},content:{},footer:null,sections:{},actionItems:[]});
  for (const options of [undefined,{presentation:'desktop'},{presentation:'tablet'}]) {
    assert.equal(composeApprovalTaskLayout(slots,options),slots);
  }
});
