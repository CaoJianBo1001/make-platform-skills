#!/usr/bin/env node
// make-app-permission contract version: 0.3.20
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
const snapshot = (operation, update = [permission('data.field.update', {fieldAccess: {title: 'editable'}})], extra = {}) => structuredClone({
  fields,
  access: {scope: APP, principal: 'user-1', permissions: [...entryPermissions, read, permission(operation), ...update]},
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
  ['readonly', snapshot(operation, [permission('data.field.update', {fieldAccess: {title: 'readonly'}})])],
  ['hidden', snapshot(operation, [permission('data.field.update', {fieldAccess: {'*': 'editable', title: 'hidden'}})])],
  ['explicit-deny', snapshot(operation, [permission('data.*.*'), permission('data.field.update', {effect: 'deny'})])],
  ['revoked', snapshot(operation, [])],
  ['metadata-only', snapshot(operation, [permission('meta.field.update')])],
  ['metadata-wildcard', snapshot(operation, [permission('meta.field.*', {fieldAccess: {title: 'editable'}})])],
  ['no-visible-schema', snapshot(operation, undefined, {fields: fields.filter(field => field.key !== 'title')})],
  ['no-readable-field', snapshot(operation, undefined, {access: {scope: APP, permissions: [...entryPermissions, permission(operation), permission('data.field.update')]}})],
];

const cases = [
  ['ui_filters_injected_and_invisible_fields', async operation => {
    for (const key of ['data.field.update', 'data.field.*', 'data.*.*']) {
      await withHarness(operation, snapshot(operation, [permission(key, {fieldAccess: {title: 'editable', secret: 'editable', id: 'editable'}})]), async (host, requests, writes) => {
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
      const next = snapshot(operation, [permission('data.field.update', {fieldAccess: {title: 'readonly', amount: 'editable'}})]);
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
    const next = snapshot(operation, undefined, {access: {scope: APP, permissions: [...entryPermissions, read, permission('data.field.update')]}});
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
      const next = snapshot(operation, undefined, {access: {scope: APP, permissions: [...entryPermissions, read, permission('data.field.update'), permission(otherOperation)]}});
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
