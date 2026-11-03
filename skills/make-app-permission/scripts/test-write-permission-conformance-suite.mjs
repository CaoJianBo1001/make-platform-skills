#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { correctAdapterSource } from './fixtures/correct-permission-adapter.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suite = path.join(scriptDir, 'write-permission-conformance-suite.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-write-permission-'));

// This fixture executes submit -> observed request -> Service validation -> persistence
// boundaries. It is not acceptance evidence for an external business project.
const adapterSource = `
import * as model from './model.mjs';
const forbidden = () => { throw new Error('FORBIDDEN'); };
const operationAllowed = (snapshot, entityKey, operation) => model.canUseEntityOperation(model.normalizeAccess(snapshot.access), entityKey, operation);
const fieldKeys = (snapshot, entityKey, operation) => {
  const access = model.normalizeAccess(snapshot.access);
  const editable = new Set((snapshot.editableFields ?? []).map(field => field.key));
  return snapshot.fields.filter(field => (operation !== 'data.record.update' || editable.has(field.key)) && model.canReadEntityField(access, entityKey, field.key) && model.canUpdateEntityField(access, entityKey, field.key, operation) && model.isEditCapableField(field)).map(field => field.key);
};
export function createWriteHarness({snapshot, entityKey, operation, onRequest, onWrite}) {
  for (const prerequisite of ['meta.entity.read', 'data.record.read']) {
    if (!operationAllowed(snapshot, entityKey, prerequisite)) throw new Error('write test must preserve edit-route prerequisites');
  }
  let ui = snapshot;
  let service = snapshot;
  const editableFieldKeys = () => operationAllowed(ui, entityKey, operation) ? fieldKeys(ui, entityKey, operation) : [];
  const requestUpdate = async (values) => {
    if (!operationAllowed(service, entityKey, operation)) forbidden();
    const allowed = new Set(fieldKeys(service, entityKey, operation));
    if (Object.keys(values).some(key => !allowed.has(key))) forbidden();
    return onWrite(values);
  };
  const submit = async (values) => {
    if (!operationAllowed(ui, entityKey, operation)) forbidden();
    const allowed = new Set(fieldKeys(ui, entityKey, operation));
    const payload = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
    if (!Object.keys(payload).length) forbidden();
    await onRequest(payload);
    return requestUpdate(payload);
  };
  return {editableFieldKeys, submit, requestUpdate,
    refreshUi: next => { ui = next; },
    refreshService: next => { service = next; },
    dispose: () => {},
  };
}
`;

try {
  const run = (name, source, modelSource = correctAdapterSource) => {
    fs.writeFileSync(path.join(tempRoot, 'model.mjs'), modelSource);
    const adapter = path.join(tempRoot, name + '.mjs');
    fs.writeFileSync(adapter, source);
    const result = spawnSync(process.execPath, [suite, adapter], {encoding: 'utf8', timeout: 30000});
    assert.equal(result.error, undefined, result.error?.message);
    return {status: result.status, output: result.stdout + result.stderr};
  };
  const correct = run('correct', adapterSource);
  assert.equal(correct.status, 0, correct.output);
  assert.match(correct.output, /write permission conformance: PASS/);

  const mutations = [
    ['ignores-editable-schema', "(operation !== 'data.record.update' || editable.has(field.key))", 'true', /ui_refresh_removes_revoked_fields/],
    ['raw-ui-payload', 'const payload = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));', 'const payload = values;', /ui_filters_injected_and_invisible_fields|empty_and_sparse_field_maps_stay_within_schema|array_wildcard_reaches_writes_without_expanding_schema/],
    ['stale-ui-allowlist', 'const editableFieldKeys = () => operationAllowed(ui, entityKey, operation) ? fieldKeys(ui, entityKey, operation) : [];', 'const cached = fieldKeys(ui, entityKey, operation); const editableFieldKeys = () => cached;', /ui_refresh_removes_revoked_fields/],
    ['stale-ui-submit-allowlist', 'const allowed = new Set(fieldKeys(ui, entityKey, operation));', 'const allowed = new Set(fieldKeys(snapshot, entityKey, operation));', /ui_refresh_removes_revoked_fields/],
    ['missing-service-field-check', 'if (Object.keys(values).some(key => !allowed.has(key))) forbidden();', '', /service_rejects_injected_fields_atomically|empty_and_sparse_field_maps_stay_within_schema|array_wildcard_reaches_writes_without_expanding_schema/],
    ['service-trusts-ui', 'const allowed = new Set(fieldKeys(service, entityKey, operation));', 'const allowed = new Set(fieldKeys(ui, entityKey, operation));', /service_rejects_stale_ui_after_revoke/],
    ['ui-ignores-refresh', 'refreshUi: next => { ui = next; }', 'refreshUi: next => {}', /ui_refresh_removes_revoked_fields/],
    ['service-ignores-refresh', 'refreshService: next => { service = next; }', 'refreshService: next => {}', /service_rejects_stale_ui_after_revoke|ui_refresh_removes_revoked_fields/],
  ];
  for (const [name, before, after, failure] of mutations) {
    assert.ok(adapterSource.includes(before), name + ' mutation target exists');
    const broken = run(name, adapterSource.replace(before, after));
    assert.notEqual(broken.status, 0, name + ' must be rejected');
    assert.match(broken.output, failure, name);
  }
  const modelMutations = [
    ['reject-compatible-results', correctAdapterSource.replace('if (allows.length === 0) return false;', 'if (allows.length !== 1) return false;'), /compatible_grants_reach_ui_submit_and_service_write/],
    ['sparse-map-as-full-access', correctAdapterSource.replace('if (maps.every(fields => Object.keys(fields).length === 0)) return true;', 'if (states.length === 0) return true;'), /ui_refresh_removes_revoked_fields|service_rejects_stale_ui_after_revoke/],
    ['require-all-array-members', correctAdapterSource.replace('return states.some(state =>', 'return states.every(state =>'), /multi_value_access_reaches_ui_and_service_without_priority_reduction/],
    ['missing-map-as-empty', correctAdapterSource.replace("if (!hasFieldAccess || item.fieldAccess === null || typeof item.fieldAccess !== 'object' || Array.isArray(item.fieldAccess)) return null;", "if (hasFieldAccess && (item.fieldAccess === null || typeof item.fieldAccess !== 'object' || Array.isArray(item.fieldAccess))) return null;").replace('Object.entries(item.fieldAccess);', 'Object.entries(item.fieldAccess ?? {});'), /ui_refresh_removes_revoked_fields/],
  ];
  for (const [name, source, failure] of modelMutations) {
    assert.notEqual(source, correctAdapterSource, name + ' mutation must change the model');
    const broken = run(name, adapterSource, source);
    assert.notEqual(broken.status, 0, name + ' must fail at the write boundary');
    assert.match(broken.output, failure, name);
  }
  console.log('write-permission-conformance-suite tests: PASS (' + (mutations.length + modelMutations.length) + ' unsafe adapters rejected)');
} finally {
  fs.rmSync(tempRoot, {recursive: true, force: true});
}
