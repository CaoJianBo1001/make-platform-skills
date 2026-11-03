#!/usr/bin/env node
import assert from 'node:assert/strict';
import {registeredPermissionKeys, isRegisteredPermission, matchesRegisteredPermission} from './permission-registry.mjs';
assert.equal(registeredPermissionKeys.length, 23);
assert.equal(new Set(registeredPermissionKeys).size, 23);
assert.ok(registeredPermissionKeys.every(key => /^(?:data|meta)\./.test(key)), 'the dictionary covers only documented Make App data/meta keys');
for (const key of ['meta.field.create', 'meta.field.update', 'meta.schema.read', 'data.record.create', 'data.record.read', 'data.record.update', 'data.record.bulkUpdate', 'data.record.export', 'data.file.create', 'data.file.get', 'data.file.delete', 'data.file.download']) {
  assert.equal(isRegisteredPermission(key), true, key);
}
for (const key of ['meta.record.create', 'make.platform.admin', 'data.record.unknown', '', null]) {
  assert.equal(isRegisteredPermission(key), false, String(key));
  assert.equal(matchesRegisteredPermission('*.*.*', key), false, String(key));
}
for (const key of ['iam.rolebinding.update', 'repo.code.update', 'agent.management.read']) {
  assert.equal(isRegisteredPermission(key), false, key + ' is outside this App dictionary, regardless of platform registration');
  assert.equal(matchesRegisteredPermission('*.*.*', key), false, 'App wildcard matching must not become a platform authorization helper');
}
for (const pattern of ['data.record.*', 'data.*.*', '*.record.update', '*.*.*']) {
  assert.equal(matchesRegisteredPermission(pattern, 'data.record.update'), true, pattern);
}
for (const pattern of ['data.*', 'data', 'data.record.up*', 'meta.field.*']) {
  assert.equal(matchesRegisteredPermission(pattern, 'data.record.update'), false, pattern);
}
assert.equal(matchesRegisteredPermission('meta.field.*', 'meta.field.update'), true);
console.log('permission registry tests: PASS');
