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
const fieldKeys = (snapshot, entityKey) => {
  const access = model.normalizeAccess(snapshot.access);
  return snapshot.fields.filter(field => model.canReadEntityField(access, entityKey, field.key) && model.canUpdateEntityField(access, entityKey, field.key) && model.isEditCapableField(field)).map(field => field.key);
};
export function createWriteHarness({snapshot, entityKey, operation, onRequest, onWrite}) {
  for (const prerequisite of ['meta.entity.read', 'data.record.read']) {
    if (!operationAllowed(snapshot, entityKey, prerequisite)) throw new Error('write test must preserve edit-route prerequisites');
  }
  let ui = snapshot;
  let service = snapshot;
  const editableFieldKeys = () => operationAllowed(ui, entityKey, operation) ? fieldKeys(ui, entityKey) : [];
  const requestUpdate = async (values) => {
    if (!operationAllowed(service, entityKey, operation)) forbidden();
    const allowed = new Set(fieldKeys(service, entityKey));
    if (Object.keys(values).some(key => !allowed.has(key))) forbidden();
    return onWrite(values);
  };
  const submit = async (values) => {
    if (!operationAllowed(ui, entityKey, operation)) forbidden();
    const allowed = new Set(fieldKeys(ui, entityKey));
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
  fs.writeFileSync(path.join(tempRoot, 'model.mjs'), correctAdapterSource);
  const run = (name, source) => {
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
    ['raw-ui-payload', 'const payload = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));', 'const payload = values;', /ui_filters_injected_and_invisible_fields/],
    ['stale-ui-allowlist', 'const editableFieldKeys = () => operationAllowed(ui, entityKey, operation) ? fieldKeys(ui, entityKey) : [];', 'const cached = fieldKeys(ui, entityKey); const editableFieldKeys = () => cached;', /ui_refresh_removes_revoked_fields/],
    ['stale-ui-submit-allowlist', 'const allowed = new Set(fieldKeys(ui, entityKey));', 'const allowed = new Set(fieldKeys(snapshot, entityKey));', /ui_refresh_removes_revoked_fields/],
    ['missing-service-field-check', 'if (Object.keys(values).some(key => !allowed.has(key))) forbidden();', '', /service_rejects_injected_fields_atomically/],
    ['service-trusts-ui', 'const allowed = new Set(fieldKeys(service, entityKey));', 'const allowed = new Set(fieldKeys(ui, entityKey));', /service_rejects_stale_ui_after_revoke/],
    ['service-skips-operation', 'if (!operationAllowed(service, entityKey, operation)) forbidden();', '', /service_requires_independent_record_operation/],
    ['ui-skips-operation', 'if (!operationAllowed(ui, entityKey, operation)) forbidden();', '', /ui_requires_independent_record_operation/],
    ['ui-ignores-refresh', 'refreshUi: next => { ui = next; }', 'refreshUi: next => {}', /ui_refresh_removes_revoked_fields/],
    ['service-ignores-refresh', 'refreshService: next => { service = next; }', 'refreshService: next => {}', /service_rejects_stale_ui_after_revoke|ui_refresh_removes_revoked_fields/],
  ];
  for (const [name, before, after, failure] of mutations) {
    assert.ok(adapterSource.includes(before), name + ' mutation target exists');
    const broken = run(name, adapterSource.replace(before, after));
    assert.notEqual(broken.status, 0, name + ' must be rejected');
    assert.match(broken.output, failure, name);
  }
  console.log('write-permission-conformance-suite tests: PASS (' + mutations.length + ' unsafe adapters rejected)');
} finally {
  fs.rmSync(tempRoot, {recursive: true, force: true});
}
