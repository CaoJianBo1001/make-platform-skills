import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyDraftHostBoundaries } from '../skills/make-app-service/scripts/verify-draft-host-boundaries.mjs';

const root = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)));
const read = name => readFileSync(path.join(root, name), 'utf8');
const task = read('skills/make-app-approval/references/task-detail.md');
const core = read('skills/make-app-service/references/business-record-drafts.md');
const ui = read('skills/makeui/references/record-drafts-and-defaults.md');
assert.match(task, /项目管理字段约束/, 'TASK must explicitly hand off managed-field protection');
assert.match(task, /分页和 total 前过滤[\s\S]*提交前重查/, 'TASK Lookup must hand off formal eligibility');
assert.match(core, /先用原始任务响应[\s\S]*再从当前可编辑集合移除/, 'validate raw authorization before tightening');
assert.match(core, /包含管理字段即明确拒绝整次动作/, 'do not silently strip a submitted managed field');
assert.match(core, /RETURN 先按原动作[\s\S]*不能因输入夹带管理字段而新增校验阻塞退回/, 'RETURN retains its empty-patch exception');
assert.match(ui, /JSON\.stringify\(\{quantity: undefined\}\)/, 'final JSON must distinguish clear from omission');

// Deliberate test double: tests the distributed verifier, not a host application.
// Real projects must supply a thin bridge to production UI/Service boundaries.
function makeDouble(fault = '') {
  return async function runDraftHostCase(scenario, capture) {
    const roles = scenario.roles;
    const emit = (resource, target, body, query = '') => capture({
      url: `https://make.example/api/make/${resource}${query}`, method: 'POST', target,
      body: fault === 'invalid-wire-body' ? body : JSON.stringify(body),
    });
    const writeTask = patch => {
      const body = {
        ...scenario.reference, actionType: scenario.actionType, comment: scenario.comment, recordPatch: patch,
        ...(scenario.actionType === 'RETURN'
          ? { targetNodeKey: scenario.task.actions.find(action => action.actionType === 'RETURN').returnTargets[0].nodeKey } : {}),
      };
      if (fault === 'wrong-action') body.actionType = 'REJECT';
      if (fault === 'return-becomes-approve' && scenario.actionType === 'RETURN') body.actionType = 'APPROVE';
      if (fault === 'missing-process-id') delete body.processInstanceId;
      if (fault === 'wrong-process-id') body.processInstanceId = '900000000000000099';
      if (fault === 'missing-task-id') delete body.taskId;
      if (fault === 'wrong-task-id') body.taskId = '900000000000000099';
      if (fault === 'missing-comment') delete body.comment;
      if (fault === 'wrong-comment') body.comment = 'different comment';
      if (fault === 'missing-return-target') delete body.targetNodeKey;
      if (fault === 'wrong-return-target' && scenario.actionType === 'RETURN') body.targetNodeKey = 'other';
      emit('workflow/v1/bpm-task', 'MakeService.CreateResource', body);
    };
    if (scenario.kind === 'numeric-record') {
      const data = scenario.policy ? { [roles.stateField]: scenario.intent === 'draft' ? roles.draft : roles.normal } : {};
      if (scenario.input === 'clear') data[roles.numericField] = fault === 'dropped-clear' ? undefined : null;
      if (scenario.input === 'untouched' && fault !== 'dropped-untouched-default') data[roles.numericField] = scenario.field.defaultValue;
      if (scenario.input === 'zero') data[roles.numericField] = fault === 'replaced-zero' ? 18 : 0;
      if (scenario.input === 'absent' && fault === 'filled-missing') data[roles.numericField] = null;
      if (fault === 'missing-state') delete data[roles.stateField];
      const combined = scenario.intent === 'submit';
      emit(combined ? 'workflow/v1/bpm-process-submit' : 'data/v1/record', 'MakeService.CreateResource', { appKey: 'test_app', entityKey: roles.sourceEntity, data },
        scenario.intent === 'draft' || (combined && fault === 'workflow-draft-flag') ? '?isDraft=true' : '');
      return;
    }
    if (scenario.kind === 'task-detail') {
      const view = scenario.task.fieldPermission.viewPermission.fields;
      const edit = scenario.task.fieldPermission.editPermission.fields;
      if (edit.some(key => !view.includes(key)) && fault !== 'masked-invalid-permission') throw new Error('invalid raw permission');
      return {
        fields: view.map(key => ({ key, visible: true, editable: edit.includes(key)
          && !(scenario.configured && key === scenario.policy.fieldKey && fault !== 'editable-managed') })),
        actions: scenario.task.actions,
      };
    }
    if (scenario.kind === 'task-action') {
      if (scenario.actionType === 'RETURN') {
        if (fault === 'return-business-validation') throw new Error('unexpected business validation');
        writeTask({}); return;
      }
      if (scenario.configured && Object.hasOwn(scenario.recordPatch, scenario.policy.fieldKey)) {
        if (fault === 'silent-managed-strip') {
          const { [scenario.policy.fieldKey]: ignored, ...rest } = scenario.recordPatch;
          writeTask(rest); return;
        }
        throw new Error('managed field rejected');
      }
      if (!scenario.configured && fault === 'name-based-rejection') throw new Error('wrong name heuristic');
      writeTask(scenario.recordPatch); return;
    }
    if (scenario.kind === 'task-lookup') {
      const search = fault === 'single-quoted-search' ? `${roles.targetTextField}.contains('x')` : `${roles.targetTextField}.contains("x")`;
      const eligible = `${roles.targetStateField} == ${JSON.stringify(scenario.targetPolicy.normal)}`;
      emit('data/v1/record', 'MakeService.ListResources', {
        appKey: 'test_app', entityKey: roles.targetEntity, pagination: { page: scenario.page, size: scenario.size },
        filter: { expression: fault === 'missing-formal-query' ? search
          : fault === 'or-formal-query' ? `${search} || ${eligible}` : `(${search}) && (${eligible})` },
      });
      return { ids: ['900000000000000011'], total: fault === 'wrong-page-total' ? 1 : 21 };
    }
    if (scenario.kind === 'task-reference') {
      const body = { appKey: scenario.task.appKey, entityKey: roles.targetEntity, recordID: scenario.recordPatch[roles.lookupField] };
      if (fault === 'wrong-reference-app') body.appKey = 'other_app';
      if (fault === 'wrong-reference-entity') body.entityKey = 'other_entity';
      if (fault === 'wrong-reference-id') body.recordID = '999999999999999999';
      if (fault === 'stale-reference-wrong-id' && scenario.targetState === scenario.targetPolicy.draft) body.recordID = '999999999999999999';
      if (fault === 'missing-reference-id') delete body.recordID;
      if (fault === 'reference-write-before-read' && scenario.targetState === scenario.targetPolicy.normal) writeTask(scenario.recordPatch);
      if (fault !== 'stale-target-not-reread') capture({
        url: 'https://make.example/api/make/data/v1/record',
        method: fault === 'wrong-reference-method' ? 'GET' : 'POST',
        target: fault === 'wrong-reference-operation' ? 'MakeService.ListResources' : 'MakeService.GetResource',
        body: JSON.stringify(body),
      });
      if (scenario.targetState !== scenario.targetPolicy.normal || fault === 'normal-reference-rejected') {
        if (fault === 'draft-reference-written') { writeTask(scenario.recordPatch); return; }
        throw new Error('target is not formal');
      }
      if (fault !== 'reference-write-before-read') writeTask(scenario.recordPatch);
      return;
    }
    throw new Error('unknown test scenario');
  };
}

// Keep these before scenario-count assertions so the old verifier fails for the
// demonstrated false successes, rather than only for a changed fixture count.
const taskMutations = [
  ['wrong-action', /actionType/],
  ['return-becomes-approve', /actionType/],
  ['missing-process-id', /processInstanceId/],
  ['wrong-process-id', /processInstanceId/],
  ['missing-task-id', /taskId/],
  ['wrong-task-id', /taskId/],
  ['missing-comment', /comment/],
  ['wrong-comment', /comment/],
  ['missing-return-target', /targetNodeKey/],
  ['wrong-return-target', /targetNodeKey/],
  ['wrong-reference-app', /recheck the selected target/],
  ['wrong-reference-entity', /recheck the selected target/],
  ['wrong-reference-id', /recheck the selected target/],
  ['stale-reference-wrong-id', /recheck the selected target/],
  ['missing-reference-id', /recheck the selected target/],
  ['wrong-reference-method', /recheck the selected target/],
  ['wrong-reference-operation', /recheck the selected target/],
  ['reference-write-before-read', /before the task action/],
  ['normal-reference-rejected', /target is not formal/],
  ['draft-reference-written', /real host operation must reject/],
];
for (const [fault, pattern] of taskMutations) {
  await assert.rejects(() => verifyDraftHostBoundaries(makeDouble(fault)), pattern, `accepted TASK mutation: ${fault}`);
}

const referenceStates = [];
const validTaskActions = [];
const result = await verifyDraftHostBoundaries(async (scenario, capture) => {
  if (scenario.kind === 'task-reference') referenceStates.push(scenario.targetState);
  if (scenario.kind === 'task-action' && scenario.configured && scenario.actionType !== 'RETURN'
      && !Object.hasOwn(scenario.recordPatch, scenario.roles.stateField)) validTaskActions.push(scenario.actionType);
  return makeDouble()(scenario, capture);
});
assert.deepEqual(referenceStates, ['normal', 'draft'], 'verify both allowed and stale reference targets through real action requests');
assert.deepEqual(validTaskActions, ['APPROVE', 'REJECT', 'SUBMIT'], 'valid actions retain their original intent and task reference');
assert.equal(result.passed, 27);
assert.equal((await verifyDraftHostBoundaries(async (scenario, capture) => {
  assert.equal(scenario.roles.targetTextField, 'description');
  return makeDouble()(scenario, capture);
}, { mapping: { textField: 'description' } })).passed, 27);
const customMapping = { sourceEntity: 'invoice', targetEntity: 'contract', stateField: 'recordStage', numericField: 'amount', textField: 'description', targetTextField: 'name', relationKey: 'invoice_contract', lookupField: 'contractRef', normal: 'saved', draft: 'editing', targetStateField: 'saveStatus', targetNormal: 'formal', targetDraft: 'drafted' };
assert.equal((await verifyDraftHostBoundaries(async (scenario, capture) => {
  const lookup = scenario.task.formMetadata.fields.find(field => field.key === 'contractRef');
  assert.equal(lookup.properties.targetFieldKey, 'name');
  assert.equal(lookup.properties.relationKey, 'invoice_contract');
  assert.equal(scenario.task.formMetadata.relations[0].key, 'invoice_contract');
  if (scenario.kind === 'task-lookup') {
    assert.ok(scenario.targetRecords.every(record => Object.hasOwn(record, 'name') && !Object.hasOwn(record, 'description')));
    assert.ok(scenario.targetRecords.some(record => record.saveStatus === null));
    assert.ok(scenario.targetRecords.some(record => !['formal', 'drafted', null].includes(record.saveStatus)));
  }
  return makeDouble()(scenario, capture);
}, { mapping: customMapping })).passed, 27);
assert.equal((await verifyDraftHostBoundaries(makeDouble('single-quoted-search'), { searchExpression: "title.contains('x')" })).passed, 27);
await assert.rejects(() => verifyDraftHostBoundaries(makeDouble(), { searchExpression: "title.contains('x')" }), /opaque and unchanged/);
assert.equal((await verifyDraftHostBoundaries(makeDouble(), { intents: [] })).passed, 15);
assert.equal((await verifyDraftHostBoundaries(async (scenario, capture) => {
  const key = scenario.roles.stateField;
  assert.equal(scenario.policy, null);
  assert.equal(Object.hasOwn(scenario.task.formData, key), false);
  assert.equal(scenario.task.formMetadata.fields.some(field => field.key === key), false);
  assert.equal(scenario.task.fieldPermission.viewPermission.fields.includes(key), false);
  assert.equal(scenario.task.fieldPermission.editPermission.fields.includes(key), false);
  assert.equal(Object.hasOwn(scenario.recordPatch ?? {}, key), false);
  return makeDouble()(scenario, capture);
}, { draftEnabled: false, intents: [], taskEnabled: true, taskManagedFields: false, taskReferences: true })).passed, 4);

const defaultsOnly = await verifyDraftHostBoundaries(makeDouble(), { draftEnabled: false });
assert.equal(defaultsOnly.passed, 4); assert.equal(defaultsOnly.taskChecks, false);
assert.deepEqual(defaultsOnly.intents, ['save']);
const defaultsWithApproval = await verifyDraftHostBoundaries(makeDouble(), { draftEnabled: false, intents: ['save', 'submit'] });
assert.equal(defaultsWithApproval.passed, 8);
const draftWithoutTask = await verifyDraftHostBoundaries(makeDouble(), { intents: ['save', 'draft'], taskEnabled: false });
assert.equal(draftWithoutTask.passed, 8);
await assert.rejects(() => verifyDraftHostBoundaries(makeDouble(), { draftEnabled: false, intents: ['draft'] }), /defaults-only/);

const mutations = [
  ['dropped-clear', /missing and explicit clear/],
  ['dropped-untouched-default', /missing and explicit clear|untouched prefill/],
  ['replaced-zero', /zero must remain/],
  ['filled-missing', /missing and explicit clear/],
  ['missing-state', /normal|draft/],
  ['workflow-draft-flag', /true|isDraft/],
  ['editable-managed', /only registered managed fields/],
  ['masked-invalid-permission', /real host operation must reject/],
  ['silent-managed-strip', /real host operation must reject/],
  ['return-business-validation', /unexpected business validation/],
  ['name-based-rejection', /wrong name heuristic/],
  ['missing-formal-query', /formal query/],
  ['or-formal-query', /&&|and/],
  ['wrong-page-total', /total/],
  ['stale-target-not-reread', /recheck the selected target/],
  ['invalid-wire-body', /final JSON string/],
];
for (const [fault, pattern] of mutations) {
  await assert.rejects(() => verifyDraftHostBoundaries(makeDouble(fault)), pattern, `accepted mutation: ${fault}`);
}

const temporary = mkdtempSync(path.join(tmpdir(), 'draft-host-portable-'));
try {
  const script = path.join(temporary, 'verify-draft-host-boundaries.mjs');
  cpSync(new URL('../skills/make-app-service/scripts/verify-draft-host-boundaries.mjs', import.meta.url), script);
  const adapter = path.join(temporary, 'host adapter.mjs');
  writeFileSync(adapter, `const makeDouble = ${makeDouble.toString()};\nexport const runDraftHostCase = makeDouble();\n`);
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: temporary, encoding: 'utf8' });
  assert.equal(run([adapter]).status, 0);
  assert.equal(run([]).status, 2);
  writeFileSync(adapter, `const makeDouble = ${makeDouble.toString()};\nexport const runDraftHostCase = makeDouble();\nexport const draftHostCapabilities = {draftEnabled:false};\n`);
  const defaultsCli = run([adapter]);
  assert.equal(defaultsCli.status, 0); assert.match(defaultsCli.stdout, /4 scenarios passed.*draft=false.*TASK=false/);

  writeFileSync(adapter, `const makeDouble = ${makeDouble.toString()};\nexport const runDraftHostCase = makeDouble('dropped-clear');\n`);
  assert.equal(run([adapter]).status, 1);
  for (const [fault, pattern] of [...mutations, ...taskMutations]) {
    writeFileSync(adapter, `const makeDouble = ${makeDouble.toString()};\nexport const runDraftHostCase = makeDouble(${JSON.stringify(fault)});\n`);
    const rejected = run([adapter]);
    assert.equal(rejected.status, 1, `portable CLI accepted mutation: ${fault}`);
    assert.match(rejected.stderr, pattern);
    assert.doesNotMatch(rejected.stdout, /scenarios passed/);
  }
} finally { rmSync(temporary, { recursive: true, force: true }); }
console.log(`draft host verifier: ${result.passed} scenarios, ${mutations.length + taskMutations.length} negative mutations and portable CLI passed; real host integration is separate`);
