#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// This is a host test adapter contract, not a Make endpoint or production policy.
// runCase must drive the real host controller/handler and capture its final
// serialized upstream requests. A passing test double only tests this verifier.
export async function verifyDraftHostBoundaries(runCase, capabilities = {}) {
  assert.equal(typeof runCase, 'function', 'adapter must export runDraftHostCase');
  for (const key of ['draftEnabled', 'taskEnabled', 'taskManagedFields', 'taskReferences']) {
    if (Object.hasOwn(capabilities, key)) assert.equal(typeof capabilities[key], 'boolean', `${key} must be boolean`);
  }
  const draftEnabled = capabilities.draftEnabled !== false;
  const taskEnabled = capabilities.taskEnabled ?? draftEnabled;
  const managedTaskFields = taskEnabled && (capabilities.taskManagedFields ?? draftEnabled);
  const taskReferences = taskEnabled && (capabilities.taskReferences ?? draftEnabled);
  assert.ok(!managedTaskFields || draftEnabled, 'managed-field checks require a registered source draft policy');
  const intents = capabilities.intents ?? (draftEnabled ? ['save', 'draft', 'submit'] : ['save']);
  assert.ok(Array.isArray(intents) && (intents.length > 0 || managedTaskFields || taskReferences) && new Set(intents).size === intents.length);
  assert.ok(intents.every(intent => ['save', 'draft', 'submit'].includes(intent)));
  assert.ok(draftEnabled || !intents.includes('draft'), 'defaults-only must not enable draft actions');
  let passed = 0;
  const roles = { sourceEntity: 'source', targetEntity: 'target', stateField: 'saveState', numericField: 'quantity', textField: 'title', targetTextField: capabilities.mapping?.textField ?? 'title', relationKey: 'source_target', lookupField: 'related', normal: 'normal', draft: 'draft', targetStateField: 'saveState', targetNormal: 'normal', targetDraft: 'draft', ...capabilities.mapping };
  for (const value of Object.values(roles)) assert.ok(typeof value === 'string' && value.length > 0, 'mapping values must be nonempty strings');
  const policy = { entityKey: roles.sourceEntity, fieldKey: roles.stateField, normal: roles.normal, draft: roles.draft };
  const targetPolicy = { entityKey: roles.targetEntity, fieldKey: roles.targetStateField, normal: roles.targetNormal, draft: roles.targetDraft };
  const reference = { processInstanceId: '900000000000000001', taskId: '900000000000000002' };
  const comment = 'test';
  const task = {
    ...reference, appKey: 'test_app', entityKey: roles.sourceEntity, recordId: '900000000000000003',
    taskName: 'Task', bpmKey: 'flow', taskDefinitionKey: 'node', taskStatus: 'PENDING', processStatus: 'IN_APPROVAL',
    formData: { [roles.textField]: 'original', ...(draftEnabled ? { [roles.stateField]: roles.normal } : {}) },
    fieldPermission: {
      viewPermission: { scope: 'field', fields: [roles.textField, ...(draftEnabled ? [roles.stateField] : []), roles.lookupField] },
      editPermission: { scope: 'field', fields: [roles.textField, ...(draftEnabled ? [roles.stateField] : []), roles.lookupField] },
    },
    actions: [
      ...['APPROVE', 'REJECT', 'SUBMIT'].map(actionType => ({ actionType, commentPolicy: actionType === 'REJECT' ? 'required' : 'optional' })),
      { actionType: 'RETURN', commentPolicy: 'required', returnTargets: [{ nodeKey: 'start', nodeName: 'Start' }] },
    ],
    formMetadata: {
      appKey: 'test_app', entityKey: roles.sourceEntity, processKey: 'flow', nodeKey: 'node', nodeName: 'Node',
      fields: [
        { key: roles.textField, name: 'Title', type: 'Make.Field.Text' },
        ...(draftEnabled ? [{ key: roles.stateField, name: 'State', type: 'Make.Field.SingleSelect', validations: { isRequired: true }, properties: { options: [{ label: 'Normal', value: roles.normal }, { label: 'Draft', value: roles.draft }] } }] : []),
        { key: roles.lookupField, name: 'Related', type: 'Make.Field.Lookup', properties: { relationKey: roles.relationKey, targetFieldKey: roles.targetTextField, targetFieldType: 'Make.Field.Text' } },
      ],
      relations: [{ key: roles.relationKey, type: 'Make.Relation', properties: { from: { entityKey: roles.sourceEntity, cardinality: 'many' }, to: { entityKey: roles.targetEntity, cardinality: 'one' } } }],
    },
  };
  const invoke = async input => {
    const requests = [];
    const captureErrors = [];
    let result, error;
    try {
      result = await runCase(structuredClone({ policy: draftEnabled ? policy : null, task, reference, roles, comment, ...input }), request => {
        try {
          assert.equal(typeof request.body, 'string', 'capture the final JSON string, not a reconstructed object');
          requests.push({ ...request, data: JSON.parse(request.body), pathname: new URL(request.url, 'https://example.invalid').pathname });
        } catch (cause) { captureErrors.push(cause); }
      });
    } catch (cause) { error = cause; }
    assert.ifError(captureErrors[0]);
    return { result, error, requests };
  };
  const writes = run => run.requests.filter(request => request.target === 'MakeService.CreateResource' || request.target === 'MakeService.UpdateResource');
  const taskWrite = (run, actionType) => {
    assert.ifError(run.error);
    assert.equal(writes(run).length, 1, 'exactly one task action request');
    const request = writes(run)[0];
    assert.ok(request.pathname.endsWith('/workflow/v1/bpm-task'));
    assert.equal(request.method, 'POST');
    assert.equal(request.target, 'MakeService.CreateResource');
    assert.equal(new URL(request.url, 'https://example.invalid').searchParams.has('isDraft'), false);
    for (const [key, value] of Object.entries({ ...reference, actionType, comment })) {
      assert.equal(request.data[key], value, `task ${key} must preserve the requested action context`);
    }
    if (actionType === 'RETURN') {
      const targets = task.actions.find(action => action.actionType === 'RETURN').returnTargets;
      assert.equal(request.data.targetNodeKey, targets[0].nodeKey, 'RETURN targetNodeKey must match the unique authorized target');
    }
    return request.data;
  };
  const rejected = run => {
    assert.ok(run.error, 'the real host operation must reject');
    assert.equal(writes(run).length, 0, 'rejection must precede upstream writes');
  };

  for (const intent of intents) {
    for (const input of ['absent', 'clear', 'zero', 'untouched']) {
      const field = { key: roles.numericField, name: 'Quantity', type: 'Make.Field.Number' };
      // clear/zero start with an actual default; absence has no supplied key.
      if (input !== 'absent') field.defaultValue = 18;
      const run = await invoke({ kind: 'numeric-record', intent, input, field });
      assert.ifError(run.error);
      assert.equal(writes(run).length, 1, 'numeric scenario needs a captured real write');
      const request = writes(run)[0];
      assert.ok(request.pathname.endsWith(intent === 'submit' ? '/workflow/v1/bpm-process-submit' : '/data/v1/record'));
      assert.equal(request.method, 'POST');
      assert.equal(request.target, 'MakeService.CreateResource');
      const query = new URL(request.url, 'https://example.invalid').searchParams;
      const draftFlags = query.getAll('isDraft');
      if (intent === 'draft') assert.deepEqual(draftFlags, ['true']);
      else if (intent === 'submit') assert.deepEqual(draftFlags, []);
      else assert.ok(draftFlags.length === 0 || (draftFlags.length === 1 && draftFlags[0] === 'false'));
      assert.equal(Object.hasOwn(request.data, 'isDraft'), false, 'draft option belongs in the URL');
      assert.equal(Object.hasOwn(request.data.data, 'isDraft'), false, 'draft option is not a business field');
      if (draftEnabled) assert.equal(request.data.data[roles.stateField], intent === 'draft' ? roles.draft : roles.normal);
      assert.equal(Object.hasOwn(request.data.data, roles.numericField), input !== 'absent', 'missing and explicit clear must differ in final JSON');
      if (input === 'clear') assert.equal(request.data.data[roles.numericField], null, 'clear must survive JSON serialization as null');
      if (input === 'zero') assert.equal(request.data.data[roles.numericField], 0, 'zero must remain a JSON number');
      if (input === 'untouched') assert.equal(request.data.data[roles.numericField], 18, 'untouched prefill must remain present');
      passed++;
    }
  }
  if (!managedTaskFields && !taskReferences) return { passed, intents, taskChecks: false, draftEnabled };
  if (managedTaskFields) {
    for (const configured of [true, false]) {
      const run = await invoke({ kind: 'task-detail', configured });
      assert.ifError(run.error);
      const state = run.result.fields.find(field => field.key === roles.stateField);
      assert.equal(state.visible, true);
      assert.equal(state.editable, !configured, 'only registered managed fields are tightened');
      assert.equal(run.result.fields.find(field => field.key === roles.textField).editable, true);
      assert.deepEqual(run.result.actions.map(action => action.actionType), task.actions.map(action => action.actionType));
      passed++;
    }
    const invalid = structuredClone(task);
    invalid.fieldPermission.viewPermission.fields = [roles.textField, roles.lookupField];
    rejected(await invoke({ kind: 'task-detail', configured: true, task: invalid })); passed++;
    for (const actionType of ['APPROVE', 'REJECT', 'SUBMIT']) {
      rejected(await invoke({ kind: 'task-action', actionType, configured: true, recordPatch: { [roles.textField]: 'changed', [roles.stateField]: roles.draft } }));
      passed++;
    }
    rejected(await invoke({ kind: 'task-action', actionType: 'APPROVE', configured: true, recordPatch: { [roles.stateField]: roles.normal } })); passed++;
    const emptyState = structuredClone(task); delete emptyState.formData[roles.stateField];
    for (const actionType of ['APPROVE', 'REJECT', 'SUBMIT']) {
      const normal = taskWrite(await invoke({ kind: 'task-action', actionType, configured: true, task: emptyState, recordPatch: { [roles.textField]: 'changed' } }), actionType);
      assert.deepEqual(normal.recordPatch, { [roles.textField]: 'changed' }); passed++;
    }
    const unregistered = taskWrite(await invoke({ kind: 'task-action', actionType: 'APPROVE', configured: false, recordPatch: { [roles.stateField]: roles.draft } }), 'APPROVE');
    assert.deepEqual(unregistered.recordPatch, { [roles.stateField]: roles.draft }); passed++;
  }
  const returned = await invoke({ kind: 'task-action', actionType: 'RETURN', configured: managedTaskFields, recordPatch: { ...(draftEnabled ? { [roles.stateField]: roles.draft } : {}), [roles.lookupField]: '900000000000000012' } });
  assert.deepEqual(taskWrite(returned, 'RETURN').recordPatch, {});
  assert.equal(returned.requests.filter(request => request.pathname.endsWith('/data/v1/record')).length, 0, 'RETURN must not read referenced records'); passed++;
  if (taskReferences) {
    const targetRecords = [
      { recordID: '900000000000000012', [roles.targetTextField]: 'x draft', [roles.targetStateField]: roles.targetDraft },
      ...Array.from({ length: 21 }, (_, index) => ({
        recordID: index === 20 ? '900000000000000011' : String(900000000000001000n + BigInt(index)),
        [roles.targetTextField]: 'x normal', [roles.targetStateField]: roles.targetNormal,
      })),
      { recordID: '900000000000000099', [roles.targetTextField]: 'other', [roles.targetStateField]: roles.targetNormal },
      { recordID: '900000000000000098', [roles.targetTextField]: 'x null', [roles.targetStateField]: null },
      { recordID: '900000000000000097', [roles.targetTextField]: 'x unknown', [roles.targetStateField]: '__unrecognized_test_state__' },
    ];
    const candidates = await invoke({ kind: 'task-lookup', keyword: 'x', page: 2, size: 20,
      targetRecords, targetPolicy });
    assert.ifError(candidates.error);
    const query = candidates.requests.filter(request => request.pathname.endsWith('/data/v1/record') && request.target === 'MakeService.ListResources');
    assert.equal(query.length, 1);
    assert.deepEqual(query[0].data.pagination, { page: 2, size: 20 });
    assert.ok(query[0].data.filter.expression.includes(roles.targetStateField), 'formal query must use the configured target state field');
    assert.ok(query[0].data.filter.expression.includes(roles.targetTextField), 'search must use the actual target display field');
    assert.match(query[0].data.filter.expression, /&&|\band\b/);
    if (capabilities.searchExpression !== undefined) {
      assert.ok(query[0].data.filter.expression.includes(capabilities.searchExpression), 'the actual host search expression must remain opaque and unchanged');
    }
    assert.deepEqual(candidates.result, { ids: ['900000000000000011'], total: 21 });
    assert.equal(candidates.requests.some(request => /\/meta\/|\/schema$/.test(request.pathname)), false, 'TASK policy must not add source Schema/CRUD reads'); passed++;
    const recordPatch = { [roles.lookupField]: '900000000000000012' };
    for (const targetState of [targetPolicy.normal, targetPolicy.draft]) {
      const run = await invoke({ kind: 'task-reference', actionType: 'APPROVE', targetPolicy, targetState, recordPatch });
      const readIndex = run.requests.findIndex(request => request.pathname.endsWith('/data/v1/record')
        && request.method === 'POST' && request.target === 'MakeService.GetResource'
        && request.data.appKey === task.appKey && request.data.entityKey === targetPolicy.entityKey
        && request.data.recordID === recordPatch[roles.lookupField]);
      assert.ok(readIndex >= 0, 'recheck the selected target with its actual appKey/entityKey/recordID');
      if (targetState === targetPolicy.normal) {
        const action = taskWrite(run, 'APPROVE');
        assert.deepEqual(action.recordPatch, recordPatch);
        assert.ok(readIndex < run.requests.indexOf(writes(run)[0]), 'recheck the selected target before the task action');
      } else rejected(run);
      passed++;
    }
  }
  return { passed, intents, taskChecks: true, draftEnabled, managedTaskFields, taskReferences };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (!process.argv[2]) {
    console.error('usage: verify-draft-host-boundaries.mjs <host-adapter.mjs>');
    process.exitCode = 2;
  } else {
    try {
      const adapter = await import(pathToFileURL(path.resolve(process.argv[2])).href);
      const result = await verifyDraftHostBoundaries(adapter.runDraftHostCase, adapter.draftHostCapabilities);
      console.log(`draft host boundaries: ${result.passed} scenarios passed; intents=${result.intents.join(",")}; draft=${result.draftEnabled}; TASK=${result.taskChecks}`);
    } catch (error) {
      console.error(`draft host boundaries failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
