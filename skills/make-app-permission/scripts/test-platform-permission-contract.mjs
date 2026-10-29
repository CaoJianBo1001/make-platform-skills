#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {correctAdapterSource} from './fixtures/correct-permission-adapter.mjs';

// Expected outcomes follow the bundled Make App permission and Schema contract,
// not from the candidate fixture's list of supported permissions.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'make-platform-permission-'));
try {
  const file = path.join(temp, 'model.mjs');
  fs.writeFileSync(file, correctAdapterSource);
  const model = await import(pathToFileURL(file).href);
  const scope = 'make://tenant-1/meta/app/TestApp';
  const row = (permissionKey, fieldAccess = {}, extra = {}) => ({permissionKey, fieldAccess, effect: 'allow', resource: scope + '/entity/order', ...extra});
  const access = (...permissions) => model.normalizeAccess({scope, permissions});
  const visible = row('meta.field.read', {title: 'readonly'});
  const update = access(visible, row('data.record.update', {title: 'editable'}));
  assert.deepEqual(update.permissions.find(permission => permission.permissionKey === 'data.record.update').fieldAccess.title, ['editable'], 'scalar compatibility normalizes to an array without changing meaning');
  assert.equal(model.canUpdateEntityField(access(row('data.record.update', {title: ['readonly', 'editable']})), 'order', 'title'), true);
  assert.equal(model.canUpdateEntityField(access(row('data.record.update', {title: ['creatable']})), 'order', 'title'), false);
  assert.equal(model.canCreateEntityField(access(row('data.record.create', {title: ['creatable']})), 'order', 'title'), true);
  assert.equal(model.canCreateEntityField(access(row('data.record.create', {title: ['editable']})), 'order', 'title'), false);
  assert.equal(model.canUpdateEntityField(access(row('data.record.update', {title: ['*']})), 'order', 'title'), true);
  const configuration = model.normalizeAccess({scope, statements: [{effect: 'allow', permissionKeys: ['data.record.update'], resources: [scope]}]});
  assert.equal(model.canUseEntityOperation(configuration, 'order', 'data.record.update'), false, 'the App consumes permission results, not configuration statements');
  assert.equal(model.canUpdateEntityField(update, 'order', 'title'), true, 'real data.record.update and editable field state must allow edit');
  const bulk = access(visible, row('data.record.bulkUpdate', {title: 'editable'}));
  assert.equal(model.canUpdateEntityField(bulk, 'order', 'title', 'data.record.bulkUpdate'), true, 'bulk must use its own operation');
  assert.equal(model.canUpdateEntityField(bulk, 'order', 'title'), false, 'bulk must not imply single update');
  assert.equal(model.canUpdateEntityField(update, 'order', 'title', 'data.record.bulkUpdate'), false, 'single update must not imply bulk');
  for (const key of ['data.record.*', 'data.*.*']) {
    assert.equal(model.canUpdateEntityField(access(row(key)), 'order', 'title'), true, 'registered data wildcard allows business edit');
  }
  for (const state of ['readonly', 'hidden', 'partialMask', 'fullMask']) {
    assert.equal(model.canUpdateEntityField(access(row('data.record.update', {title: state})), 'order', 'title'), false, state);
  }
  for (const key of ['meta.field.update', 'meta.field.*', 'meta.*.*']) {
    assert.equal(model.canUpdateEntityField(access(row(key, {title: 'editable'})), 'order', 'title'), false, key + ' must never grant business writes');
  }
  assert.equal(model.canUseEntityOperation(access(row('*.*.*')), 'order', 'meta.record.create'), false, 'wildcard cannot invent an unregistered permission');
  for (const key of ['iam.rolebinding.update', 'repo.code.update', 'agent.management.read']) {
    assert.equal(model.canUseEntityOperation(access(row('*.*.*')), 'order', key), false, 'App helper cannot authorize another project');
    const mixed = access(visible, row('data.record.update', {title: 'editable'}), row(key, null, {effect: 'deny'}));
    assert.equal(model.canUpdateEntityField(mixed, 'order', 'title'), true, 'unrelated results must not change App capabilities');
  }
  assert.equal(model.canUpdateEntityField(access(row('data.*.*'), row('data.record.update', {}, {effect: 'deny'})), 'order', 'title'), false);
  assert.equal(model.canUpdateEntityField(access(), 'order', 'title'), false);
  console.log('platform permission contract: PASS');
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
