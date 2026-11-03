#!/usr/bin/env node
// make-app-permission contract version: 0.4.4
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const adapterPath = process.argv[2];
if (!adapterPath || process.argv.length !== 3) {
  console.error('Usage: node write-permission-conformance-suite.mjs <host-adapter-module>');
  process.exit(2);
}

const APP = 'make://tenant-1/meta/app/TestApp';
const ENTITY = APP + '/entity/order';
const permission = (permissionKey, options = {}) => ({permissionKey, resource: ENTITY, effect: 'allow', fieldAccess: {}, ...options});
const fields = [
  {key: 'title', type: 'Make.Field.Text'},
  {key: 'amount', type: 'Make.Field.Number'},
  {key: 'secret', type: 'Make.Field.Text'},
  {key: 'id', type: 'Make.Field.ID'},
];
const entryPermissions = [permission('meta.entity.read'), permission('data.record.read')];
const read = permission('meta.field.read', {fieldAccess: {title: 'readonly', amount: 'readonly', id: 'readonly', secret: 'hidden'}});
const snapshot = (operation, update = [permission(operation, {fieldAccess: {title: 'editable', amount: 'readonly'}})], extra = {}) => structuredClone({
  fields,
  editableFields: fields,
  access: {scope: APP, principal: 'user-1', permissions: [...entryPermissions, read, ...update]},
  ...extra,
});

let adapter;
try {
  const imported = await import(pathToFileURL(path.resolve(adapterPath)).href);
  adapter = imported.default ?? imported;
  assert.equal(typeof adapter.createWriteHarness, 'function', 'adapter must export createWriteHarness');
} catch (error) {
  console.error('write_adapter_import_failed:', error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
}
console.log('write permission conformance: starting');

async function withHarness(operation, initial, run) {
  const requests = [];
  const writes = [];
  const harness = await adapter.createWriteHarness({
    snapshot: structuredClone(initial), entityKey: 'order', operation,
    onRequest: values => { requests.push(structuredClone(values)); },
    onWrite: values => { writes.push(structuredClone(values)); },
  });
  try {
    for (const name of ['editableFieldKeys', 'submit', 'requestUpdate', 'refreshUi', 'refreshService', 'dispose']) {
      assert.equal(typeof harness?.[name], 'function', 'write harness missing ' + name);
    }
    await run(harness, requests, writes);
  } finally {
    await harness?.dispose?.();
  }
}

const denialSnapshots = operation => [
  ['unlisted-field-without-wildcard', snapshot(operation, [permission(operation, {fieldAccess: {amount: ['readonly']}})])],
  ...['readonly', 'hidden', 'partialMask', 'fullMask'].map(state => [
    'singleton-' + state, snapshot(operation, [permission(operation, {fieldAccess: {'*': ['*'], title: [state]}})]),
  ]),
  ['readonly', snapshot(operation, [permission(operation, {fieldAccess: {title: 'readonly'}})])],
  ['partial-mask', snapshot(operation, [permission(operation, {fieldAccess: {title: 'partialMask'}})])],
  ['full-mask', snapshot(operation, [permission(operation, {fieldAccess: {title: 'fullMask'}})])],
  ['read-only-operation', snapshot(operation, [permission('data.record.read')])],
  ['hidden', snapshot(operation, [permission(operation, {fieldAccess: {'*': 'editable', title: 'hidden'}})])],
  ['explicit-deny', snapshot(operation, [permission('data.*.*'), permission(operation, {effect: 'deny'})])],
  ['revoked', snapshot(operation, [])],
  ['metadata-only', snapshot(operation, [permission('meta.field.update')])],
  ['metadata-wildcard', snapshot(operation, [permission('meta.field.*', {fieldAccess: {title: 'editable'}})])],
  ['incomplete-field-state', snapshot(operation, [permission(operation, {fieldAccess: {title: 'editable', amount: 'readonly'}}), {permissionKey: operation, resource: ENTITY, effect: 'allow'}])],
  ...['readonly', 'hidden', 'partialMask', 'fullMask'].flatMap(state => {
    const results = [permission('data.*.*', {fieldAccess: {'*': ['*']}}), permission(operation, {fieldAccess: {title: [state]}})];
    return [
      ['coexisting-' + state, snapshot(operation, results)],
      ['coexisting-reversed-' + state, snapshot(operation, [...results].reverse())],
    ];
  }),
  ...(operation === 'data.record.update' ? [['no-editable-schema', snapshot(operation, undefined, {editableFields: []})]] : []),
  ['no-visible-schema', snapshot(operation, undefined, {fields: fields.filter(field => field.key !== 'title')})],
  ['no-readable-field', snapshot(operation, undefined, {access: {scope: APP, permissions: [...entryPermissions, permission(operation)]}})],
];

const cases = [
  ['multi_value_access_reaches_ui_and_service_without_priority_reduction', async operation => {
    for (const states of [['readonly', 'editable'], ['hidden', 'partialMask', 'editable'], ['editable', 'readonly']]) {
      await withHarness(operation, snapshot(operation, [permission(operation, {fieldAccess: {title: states, amount: ['readonly']}})]), async (host, requests, writes) => {
        assert.deepEqual(await host.editableFieldKeys(), ['title']);
        await host.submit({title: 'changed'});
        assert.deepEqual(requests, [{title: 'changed'}]);
        assert.deepEqual(writes, [{title: 'changed'}]);
      });
    }
  }],
  ['array_wildcard_reaches_writes_without_expanding_schema', async operation => {
    const current = snapshot(operation, [permission(operation, {fieldAccess: {'*': ['*']}})], {fields: [fields[0]], editableFields: [fields[0]]});
    current.access.permissions = current.access.permissions.map(row => ({...row, fieldAccess: {'*': ['*']}}));
    await withHarness(operation, current, async (host, requests, writes) => {
      assert.deepEqual(await host.editableFieldKeys(), ['title']);
      await host.submit({title: 'array-grant', amount: 9, unknown: 'injected'});
      assert.deepEqual(requests, [{title: 'array-grant'}]);
      assert.deepEqual(writes, [{title: 'array-grant'}]);
      await assert.rejects(async () => host.requestUpdate({title: 'allowed', amount: 9}));
      assert.deepEqual(writes, [{title: 'array-grant'}]);
    });
  }],
  ['compatible_grants_reach_ui_submit_and_service_write', async operation => {
    for (const results of [
      [permission(operation, {fieldAccess: {title: 'editable', amount: 'readonly'}}), permission('data.*.*', {fieldAccess: {title: 'editable', amount: 'readonly'}})],
      [permission(operation, {resource: APP}), permission(operation, {fieldAccess: {title: 'editable', amount: 'readonly'}})],
      [permission('data.*.*', {fieldAccess: {amount: 'readonly'}}), permission(operation, {fieldAccess: {title: 'editable'}})],
    ]) {
      for (const permissions of [results, [...results].reverse()]) {
        await withHarness(operation, snapshot(operation, permissions), async (host, requests, writes) => {
          assert.deepEqual(await host.editableFieldKeys(), ['title']);
          await host.submit({title: 'compatible'});
          assert.deepEqual(requests, [{title: 'compatible'}]);
          assert.deepEqual(writes, [{title: 'compatible'}]);
          await host.requestUpdate({title: 'direct'});
          assert.deepEqual(writes, [{title: 'compatible'}, {title: 'direct'}]);
        });
      }
    }
  }],
  ['empty_and_sparse_field_maps_stay_within_schema', async operation => {
    for (const fieldAccess of [{}, {title: ['editable'], amount: ['readonly']}]) {
      const current = snapshot(operation, [permission(operation, {fieldAccess})], {fields: [fields[0]], editableFields: [fields[0]]});
      await withHarness(operation, current, async (host, requests, writes) => {
        assert.deepEqual(await host.editableFieldKeys(), ['title']);
        await host.submit({title: 'schema-bound', amount: 9, unknown: 'injected'});
        assert.deepEqual(requests, [{title: 'schema-bound'}]);
        assert.deepEqual(writes, [{title: 'schema-bound'}]);
        await assert.rejects(async () => host.requestUpdate({title: 'allowed', amount: 9}));
        assert.deepEqual(writes, [{title: 'schema-bound'}]);
      });
    }
  }],
  ['batch_fields_do_not_require_single_update_schema', async operation => {
    if (operation !== 'data.record.bulkUpdate') return;
    await withHarness(operation, snapshot(operation, undefined, {editableFields: []}), async (host, requests, writes) => {
      assert.deepEqual(await host.editableFieldKeys(), ['title']);
      await host.submit({title: 'bulk-only'});
      assert.deepEqual(requests, [{title: 'bulk-only'}]);
      assert.deepEqual(writes, [{title: 'bulk-only'}]);
    });
  }],
  ['ui_filters_injected_and_invisible_fields', async operation => {
    for (const key of [operation, 'data.record.*', 'data.*.*']) {
      await withHarness(operation, snapshot(operation, [permission(key, {fieldAccess: {title: 'editable', amount: 'readonly', secret: 'editable', id: 'editable'}})]), async (host, requests, writes) => {
        assert.deepEqual(await host.editableFieldKeys(), ['title']);
        await host.submit({title: 'changed', amount: 99, secret: 'injected', id: 'injected', unknown: 'injected'});
        assert.deepEqual(requests, [{title: 'changed'}]);
        assert.deepEqual(writes, [{title: 'changed'}]);
      });
    }
  }],
  ['ui_refresh_removes_revoked_fields', async operation => {
    for (const [reason, next] of denialSnapshots(operation)) {
      await withHarness(operation, snapshot(operation), async (host, requests, writes) => {
        assert.deepEqual(await host.editableFieldKeys(), ['title']);
        await host.refreshUi(next);
        assert.ok(!(await host.editableFieldKeys()).includes('title'), reason);
        await assert.rejects(async () => host.submit({title: 'old-draft'}), reason);
        assert.deepEqual(requests, [], reason + ': forbidden draft must never leave UI');
        assert.deepEqual(writes, [], reason);
      });
    }
    await withHarness(operation, snapshot(operation), async (host, requests, writes) => {
      const next = snapshot(operation, [permission(operation, {fieldAccess: {title: 'readonly', amount: 'editable'}})]);
      await host.refreshUi(next);
      await host.refreshService(next);
      await host.submit({title: 'stale', amount: 7});
      assert.deepEqual(requests, [{amount: 7}]);
      assert.deepEqual(writes, [{amount: 7}]);
    });
  }],
  ['service_rejects_injected_fields_atomically', async operation => {
    await withHarness(operation, snapshot(operation), async (host, requests, writes) => {
      for (const key of ['amount', 'secret', 'id', 'unknown']) {
        await assert.rejects(async () => host.requestUpdate({title: 'allowed', [key]: 'injected'}));
        assert.deepEqual(writes, [], key + ': reject the whole mutation before persistence');
      }
      await host.requestUpdate({title: 'allowed'});
      assert.deepEqual(writes, [{title: 'allowed'}]);
      assert.deepEqual(requests, []);
    });
  }],
  ['service_rejects_stale_ui_after_revoke', async operation => {
    for (const [reason, next] of denialSnapshots(operation)) {
      await withHarness(operation, snapshot(operation), async (host, requests, writes) => {
        await host.refreshService(next);
        assert.deepEqual(await host.editableFieldKeys(), ['title']);
        await assert.rejects(async () => host.submit({title: 'stale-ui'}), reason);
        assert.deepEqual(requests, [{title: 'stale-ui'}]);
        assert.deepEqual(writes, [], reason + ': Service must independently reject stale authorization');
        await assert.rejects(async () => host.requestUpdate({title: 'forged'}), reason);
        assert.deepEqual(writes, [], reason);
      });
    }
  }],
  ['ui_requires_independent_record_operation', async operation => {
    const next = snapshot(operation, undefined, {access: {scope: APP, permissions: [...entryPermissions, read, permission('meta.field.update')]}});
    await withHarness(operation, next, async (host, requests, writes) => {
      assert.deepEqual(await host.editableFieldKeys(), []);
      await assert.rejects(async () => host.submit({title: 'forged'}));
      assert.deepEqual(requests, []);
      assert.deepEqual(writes, []);
    });
  }],
  ['service_requires_independent_record_operation', async operation => {
    await withHarness(operation, snapshot(operation), async (host, requests, writes) => {
      const otherOperation = operation === 'data.record.update' ? 'data.record.bulkUpdate' : 'data.record.update';
      const next = snapshot(operation, undefined, {access: {scope: APP, permissions: [...entryPermissions, read, permission('meta.field.update'), permission(otherOperation)]}});
      await host.refreshService(next);
      await assert.rejects(async () => host.requestUpdate({title: 'forged'}));
      assert.deepEqual(writes, []);
      assert.deepEqual(requests, []);
    });
  }],
];

for (const operation of ['data.record.update', 'data.record.bulkUpdate']) {
  for (const [name, run] of cases) {
    try {
      await run(operation);
    } catch (error) {
      console.error(name + ' [' + operation + ']: FAIL');
      console.error(error instanceof Error ? error.message : 'unknown error');
      process.exit(1);
    }
  }
}
console.log('write permission conformance: PASS (' + cases.length * 2 + ' boundary groups)');
