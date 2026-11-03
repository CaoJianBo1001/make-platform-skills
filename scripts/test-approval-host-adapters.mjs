import assert from 'node:assert/strict';
import { test } from 'node:test';
import { singleSelectFormValue, singleSelectSubmitValue, singleSelectLabel } from '../skills/makeui/assets/single-select-value.mjs';
import { readTaskDetailWithPolicy } from '../skills/make-app-approval/assets/task-detail-policy.mjs';

const option = {label:'未开始',value:'not_started'};
const options = [{label:'未开始（配置）',value:'not_started'}];
for (const raw of [[option], option, 'not_started']) test(`single select round trip: ${JSON.stringify(raw)}`,()=>{
 assert.equal(singleSelectFormValue(raw),'not_started');
 assert.equal(singleSelectLabel(raw,options),'未开始（配置）');
 assert.equal(singleSelectSubmitValue(singleSelectFormValue(raw)),'not_started');
});
test('saved label survives missing metadata; labels never become submitted values',()=>{
 assert.equal(singleSelectLabel([option],[]),'未开始');
 assert.equal(singleSelectSubmitValue([option]),'not_started');
 assert.throws(()=>singleSelectFormValue({label:'不能作为值'}),/value/);
});
for (const raw of [[],null,undefined,'']) test(`single select empty ${JSON.stringify(raw)}`,()=>{
 assert.equal(singleSelectFormValue(raw),undefined);
 assert.equal(singleSelectSubmitValue(raw),undefined);
 assert.equal(singleSelectSubmitValue(raw,null),null);
 assert.equal(singleSelectLabel(raw,[]),'-');
});
test('falsy option values stay valid',()=>{
 for(const value of [0,false]) {
  assert.equal(singleSelectFormValue([{label:'有效选项',value}]),value);
  assert.equal(singleSelectSubmitValue(value),value);
 }
});
const makeTask = (taskStatus,actions) => ({
 taskId:'task-1',taskName:'审批',processInstanceId:'instance-1',taskStatus,processStatus:'IN_APPROVAL',
 fields:[{key:'status',label:'状态'}],formData:{status:[option]},
 fieldPermission:{viewPermission:{scope:'FIELDS',fields:['status']},editPermission:{scope:'FIELDS',fields:['status']}},actions,
});
// Model only the documented decoder boundary: the SDK drops taskStatus.
// Real SDK integration is checked separately; this stub does not emulate its policy.
const read = ({taskStatus,...detail}) => detail;
for (const [status,actions] of [['COMPLETED',[]],['COMPLETED',[{actionType:'APPROVE',commentPolicy:'OPTIONAL'}]],['PENDING',[]],[undefined,[{actionType:'APPROVE',commentPolicy:'OPTIONAL'}]]]) {
 test(`historical permissions become readonly: ${status}, ${actions.length} actions`,()=>{
  const input = makeTask(status,actions), original = structuredClone(input);
  const output = readTaskDetailWithPolicy(input,read);
  assert.deepEqual(output.fieldPermission.editPermission,{scope:'NONE'});
  assert.deepEqual(output.actions,[]);
  assert.deepEqual(output.fieldPermission.viewPermission,input.fieldPermission.viewPermission);
  assert.deepEqual(output.formData,input.formData);
  assert.deepEqual(input,original);
 });
}
test('PENDING with authorized action remains editable, including SUBMIT',()=>{
 for(const actionType of ['APPROVE','SUBMIT']) {
  const input = makeTask('PENDING',[{actionType,commentPolicy:'OPTIONAL'}]);
  assert.deepEqual(readTaskDetailWithPolicy(input,read),read(input));
 }
});
test('validate original permissions before readonly clamp',()=>{
 const input = makeTask('COMPLETED',[]);
 input.fieldPermission.editPermission.fields=['hidden'];
 assert.throws(()=>readTaskDetailWithPolicy(input,raw=>{
  assert.deepEqual(raw.fieldPermission.editPermission.fields,['hidden']);
  throw new Error('invalid original permission');
 }),/invalid original permission/);
});
test('approval single-select patch contains the selected value, not display objects',()=>{
 const detail = readTaskDetailWithPolicy(makeTask('PENDING',[{actionType:'APPROVE',commentPolicy:'OPTIONAL'}]),read);
 const formValue = singleSelectFormValue(detail.formData.status);
 assert.equal(formValue,'not_started');
 const recordPatch = {status:singleSelectSubmitValue('started')};
 assert.deepEqual(recordPatch,{status:'started'});
 assert.deepEqual(detail.formData.status,[option]);
});
