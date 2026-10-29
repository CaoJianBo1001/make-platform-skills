#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [adapterPath, ...extra] = process.argv.slice(2);
if (!adapterPath || extra.length) {
  console.error('Usage: node principal-response-conformance-suite.mjs <host-loader-adapter-module>');
  process.exit(2);
}
const { createPermissionLoader } = await import(pathToFileURL(path.resolve(adapterPath)).href);
assert.equal(typeof createPermissionLoader, 'function', 'adapter must delegate to the production UI permission loader');
const scope = 'make://tenant-1/meta/app/ContractApp';
const row = { resource: scope, permissionKey: 'meta.entity.read', effect: 'allow', fieldAccess: {} };
const dto = { principal: 'user:user-1', scope, permissions: [row] };
// Sanitized wire shape observed through a real App IAM adapter (2026-10-29).
const arrayDto = { ...dto, permissions: [{...row, fieldAccess: {'*': ['*'], title: ['readonly', 'creatable', 'editable'], secret: ['hidden']}}] };
const unrelatedDto = { ...dto, permissions: [row,
  {...row, resource: 'make://tenant-1/meta/app/OtherApp', fieldAccess: {title: []}},
  {...row, permissionKey: 'data.record.export', fieldAccess: {title: ['unknown']}},
] };
const denial = { reason: 'permission_denied', permissionKey: 'meta.entity.read', data: {
  appAdministrators: [{ userId: 'admin-1', name: 'Administrator', avatarUrl: null }],
} };

const cases = [
  ['iam_success_envelope', { code: 200, msg: 'ok', data: dto }, dto],
  ['iam_array_field_access_is_preserved', {code: 200, msg: 'ok', data: arrayDto}, arrayDto],
  ['empty_iam_is_authoritative', { code: 200, data: { ...dto, permissions: [] } }, { ...dto, permissions: [] }],
  ['unrelated_rows_do_not_poison_selected_grants', {code: 200, data: unrelatedDto}, dto],
  ...[undefined, null, [], {title: []}, {title: ['unknown']}, {title: ['readonly', 7]}].map((fieldAccess, index) => {
    const invalidRow = {...row, fieldAccess};
    if (fieldAccess === undefined) delete invalidRow.fieldAccess;
    // Keep a valid row too: dropping only the invalid selected row is also an error.
    return [`invalid_selected_field_access_${index}`, {code: 200, data: {...dto, permissions: [row, invalidRow]}}];
  }),
  ['non_success_business_code', { code: 500, data: dto }],
  ...[undefined, null, {}, 7, { scope, permissions: 'invalid' }].map((data, index) => [
    `invalid_success_data_${index}`, { code: 200, data },
  ]),
  ['identity_is_not_iam', { userId: 'user-1', tenantId: 'tenant-1', appId: 'ContractApp', roles: ['app_admin'], permissions: ['ContractApp.access'] }],
  ...[401, 403, 503].map(status => [`http_${status}_stays_failure`, null, undefined, status]),
];

let failed = 0;
for (const [name, body, expected, httpStatus] of cases) {
  try {
    let requests = 0;
    const load = await createPermissionLoader(async requestPath => {
      requests++;
      assert.ok(['/app/principal/permission', '/api/make/app/principal/permission'].includes(requestPath), 'loader must call the host principal permission route');
      if (httpStatus) throw Object.assign(new Error('contract HTTP failure'), { status: httpStatus, payload: httpStatus === 403 ? denial : { code: httpStatus } });
      return structuredClone(body);
    });
    assert.equal(typeof load, 'function', 'adapter must return the actual production load function');
    if (expected) {
      const actual = await load();
      assert.equal(actual?.scope, expected.scope);
      assert.ok(Array.isArray(actual.permissions));
      // A host may retain or discard these clearly unrelated rows. The valid
      // selected grant must survive either path without relaxing row validation.
      const actualRows = name === 'unrelated_rows_do_not_poison_selected_grants'
        ? actual.permissions.filter(item=>item.resource === scope && item.permissionKey === row.permissionKey)
        : actual.permissions;
      assert.equal(actualRows.length, expected.permissions.length);
      for (let index = 0; index < expected.permissions.length; index++) {
        for (const key of ['resource', 'permissionKey', 'effect', 'fieldAccess']) assert.deepEqual(actualRows[index][key], expected.permissions[index][key]);
      }
    } else {
      await assert.rejects(load, error => {
        if (httpStatus === 403) {
          const payload = error?.payload ?? error?.body ?? error;
          assert.equal(payload.reason, denial.reason, 'known permission reason must survive UI request classification');
          assert.equal(payload.permissionKey, denial.permissionKey);
          assert.deepEqual(payload.data?.appAdministrators, denial.data.appAdministrators, 'administrator contacts must not be lost');
        }
        return true;
      });
    }
    assert.equal(requests, 1, 'permission loading must not retry a completed denial or issue a business read');
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error?.message ?? 'permission loader contract failed'}`);
  }
}
console.log(`principal response conformance: ${cases.length - failed}/${cases.length} passed`);
process.exitCode = failed ? 1 : 0;
