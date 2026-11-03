#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
const load=()=>import('../skills/make-app-approval/assets/process-status.mjs');
test('六种流程状态保留公共主题，名称采用后端确认合同，原结果对象不修改',async()=>{
 const {formatApprovalProcessStatus}=await load();
 for(const [code,label] of [['UNSUBMITTED','未提交'],['IN_APPROVAL','审批中'],['APPROVED','已通过'],['REJECTED','已拒绝'],['RETURNING','退回中'],['CANCELLED','已撤回']]){
  const original=Object.freeze({label:'旧名称',tone:'processing'});let seen;
  assert.deepEqual(formatApprovalProcessStatus(code,value=>{seen=value;return original;}),{label,tone:'processing'});
  assert.equal(seen,code);assert.equal(original.label,'旧名称');
 }
});
test('缺失和未知值沿用公共显示结果，不当作未提交',async()=>{
 const {formatApprovalProcessStatus}=await load();
 for(const code of [null,undefined,'','FUTURE','__proto__',{}]){
  const original=Object.freeze({label:code==null?'-':'状态未知',tone:'neutral'});
  assert.equal(formatApprovalProcessStatus(code,()=>original),original);
 }
});
