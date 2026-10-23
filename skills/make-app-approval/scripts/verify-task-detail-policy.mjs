#!/usr/bin/env node
// Check the reference adapter against the host's installed public SDK.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readTaskDetailWithPolicy} from '../assets/task-detail-policy.mjs';
if (process.argv.length !== 3) {
  console.error('Usage: node verify-task-detail-policy.mjs <host-ui-directory>');
  process.exit(2);
}
console.log('Checking installed approval detail SDK and host readonly policy');
try {
  const require = createRequire(path.resolve(process.argv[2], 'package.json'));
  const {readApprovalTaskDetail, getApprovalTaskFields, buildApprovalTaskAction} = require('@qfei-design/make-app-approval/detail');
  const base = {
    taskId:'task-1',taskName:'审批',processInstanceId:'instance-1',processStatus:'IN_APPROVAL',
    fields:[{key:'status',label:'状态'}],formData:{status:[{label:'未开始',value:'not_started'}]},
    fieldPermission:{viewPermission:{scope:'FIELDS',fields:['status']},editPermission:{scope:'FIELDS',fields:['status']}},
  };
  for (const [taskStatus,actions,editable] of [
    ['COMPLETED',[],false], ['COMPLETED',[{actionType:'APPROVE',commentPolicy:'OPTIONAL'}],false],
    ['PENDING',[],false], ['PENDING',[{actionType:'SUBMIT',commentPolicy:'OPTIONAL'}],true],
  ]) {
    const detail = readTaskDetailWithPolicy({...base,taskStatus,actions},readApprovalTaskDetail);
    assert.equal(getApprovalTaskFields(detail)[0].editable,editable);
    assert.deepEqual(detail.formData,base.formData);
    if (!editable) assert.throws(()=>buildApprovalTaskAction(detail,'APPROVE',{status:'started'},''));
    else assert.equal(buildApprovalTaskAction(detail,'SUBMIT',{status:'started'},'').recordPatch.status,'started');
  }
  assert.throws(()=>readTaskDetailWithPolicy({...base,taskStatus:'COMPLETED',actions:[],fieldPermission:{...base.fieldPermission,editPermission:{scope:'FIELDS',fields:['hidden']}}},readApprovalTaskDetail));
  console.log('PASS: installed SDK readonly, editable SUBMIT, invalid original permission (5 cases)');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
