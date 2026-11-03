#!/usr/bin/env node
// make-app-permission contract version: 0.4.4
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const adapterPath = process.argv[2];

if (!adapterPath) {
  console.error('Usage: node permission-conformance-suite.mjs <adapter-module>');
  process.exit(2);
}

let adapter;
try {
  const imported = await import(pathToFileURL(path.resolve(adapterPath)).href);
  adapter = imported.default ?? imported;
} catch (error) {
  console.error('adapter_import_failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}

const requiredFunctions = [
  'normalizeAccess',
  'canUseEntityOperation',
  'canCreateEntityField',
  'canReadEntityField',
  'canUpdateEntityField',
  'isCreateCapableField',
  'isEditCapableField',
];

for (const functionName of requiredFunctions) {
  if (typeof adapter[functionName] !== 'function') {
    console.error(`adapter_function_missing: ${functionName}`);
    process.exit(1);
  }
}

const APP_RESOURCE = 'make://tenant-1/meta/app/TestApp';
const ENTITY_RESOURCE = `${APP_RESOURCE}/entity/order`;
const basePayload = (permissions) => ({
  permissions,
  principal: 'user-1',
  scope: APP_RESOURCE,
});
const permission = (permissionKey, options = {}) => ({
  effect: options.effect ?? 'allow',
  fieldAccess: options.fieldAccess ?? {},
  permissionKey,
  resource: options.resource ?? ENTITY_RESOURCE,
});
const access = (...permissions) => adapter.normalizeAccess(basePayload(permissions));

const cases = [
  ['operation_read_exact_allows', () => {
    const current = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
  }],
  ['named_entity_permission_does_not_leak', () => {
    const current = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'invoice', 'data.record.read'), false);
  }],
  ['entity_metadata_read_is_independent_from_record_read', () => {
    const metadataOnly = access(permission('meta.entity.read'));
    assert.equal(adapter.canUseEntityOperation(metadataOnly, 'order', 'meta.entity.read'), true);
    assert.equal(adapter.canUseEntityOperation(metadataOnly, 'order', 'data.record.read'), false);

    const recordsOnly = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(recordsOnly, 'order', 'meta.entity.read'), false);
    assert.equal(adapter.canUseEntityOperation(recordsOnly, 'order', 'data.record.read'), true);
  }],
  ['invalid_requested_identifiers_fail_closed', () => {
    const current = access(
      permission('*.*.*', { fieldAccess: { '*': 'editable' }, resource: '*' }),
    );
    for (const entityKey of [undefined, null, 7, {}, [], '', '   ', '*']) {
      assert.equal(adapter.canUseEntityOperation(current, entityKey, 'data.record.read'), false);
      assert.equal(adapter.canCreateEntityField(current, entityKey, 'title'), false);
      assert.equal(adapter.canReadEntityField(current, entityKey, 'title'), false);
      assert.equal(adapter.canUpdateEntityField(current, entityKey, 'title'), false);
    }
    for (const fieldKey of [undefined, null, 7, {}, [], '', '   ', '*']) {
      assert.equal(adapter.canCreateEntityField(current, 'order', fieldKey), false);
      assert.equal(adapter.canReadEntityField(current, 'order', fieldKey), false);
      assert.equal(adapter.canUpdateEntityField(current, 'order', fieldKey), false);
    }
  }],
  ['operation_create_absent_must_deny', () => {
    const current = access(permission('data.record.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
  }],
  ['operation_record_wildcard_allows', () => {
    const current = access(permission('data.record.*', { resource: APP_RESOURCE }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.delete'), true);
  }],
  ['operation_global_permission_wildcard_allows', () => {
    const current = access(permission('*.*.*', { resource: '*' }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'meta.field.read'), true);
  }],
  ['operation_segment_permission_wildcard_allows', () => {
    const current = access(permission('*.record.create', { resource: APP_RESOURCE }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'meta.record.create'), false);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.update'), false);
  }],
  ['operation_deny_wins', () => {
    const current = access(
      permission('data.record.*', { resource: APP_RESOURCE }),
      permission('data.record.create', { effect: 'deny' }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
  }],
  ['record_create_deny_blocks_create_fields', () => {
    const current = access(permission('data.record.create'), permission('data.record.create', {effect: 'deny'}), permission('meta.field.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],  ['metadata_read_does_not_grant_or_revoke_data_creation', () => {
    const current = access(permission('data.record.create', {fieldAccess: {title: ['creatable']}}), permission('meta.field.read', {effect: 'deny'}));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],  ['namespace_resource_wildcard_matches', () => {
    const current = access(permission('data.record.read', {
      resource: 'make://tenant-1/*/app/TestApp',
    }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
  }],
  ['entity_resource_wildcard_matches', () => {
    const current = access(permission('data.record.read', {
      resource: `${APP_RESOURCE}/entity/*`,
    }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.read'), true);
  }],
  ['parent_and_global_resources_match', () => {
    const parentAccess = access(permission('data.record.read', { resource: APP_RESOURCE }));
    const globalAccess = access(permission('data.record.update', { resource: '*' }));
    assert.equal(adapter.canUseEntityOperation(parentAccess, 'order', 'data.record.read'), true);
    assert.equal(adapter.canUseEntityOperation(globalAccess, 'order', 'data.record.update'), true);
  }],
  ['surplus_permission_rows_do_not_block_app_access', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'make.platform.admin',
        resource: 'make://tenant-1',
      },
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'data.record.delete',
        resource: 'make://tenant-2/meta/app/OtherApp',
      },
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'iam.permission.read',
        resource: ENTITY_RESOURCE,
      },
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'unrelated.permission.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],
  ['unknown_current_app_permission_key_is_ignored_before_validation', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'data.record.export',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],
  ['unclassifiable_resource_fails_closed_before_key_is_ignored', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'unexpected',
        fieldAccess: null,
        permissionKey: 'iam.permission.read',
        resource: 'make://tenant-1/meta/app/TestApp/not-a-supported-resource',
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['create_field_uses_record_create_state', () => {
    const current = access(
      permission('data.record.create', {fieldAccess: {createOnly: ['creatable'], editable: ['editable'], readonly: ['readonly'], masked: ['partialMask'], hidden: ['hidden']}}),
      permission('meta.field.read', {fieldAccess: {visibleOnly: 'readonly'}}),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'createOnly'), true);
    for (const field of ['editable', 'readonly', 'masked', 'hidden']) assert.equal(adapter.canCreateEntityField(current, 'order', field), false);
  }],  ['record_create_field_access_does_not_grant_meta_read', () => {
    const current = access(permission('data.record.create', {fieldAccess: {createOnly: ['creatable']}}));
    assert.equal(adapter.canCreateEntityField(current, 'order', 'createOnly'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'createOnly'), false);
  }],  ['legacy_meta_field_create_does_not_grant_create_field', () => {
    const current = access(permission('meta.field.create', {
      fieldAccess: { title: 'editable' },
    }));
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['read_dimension_access_states', () => {
    const current = access(permission('meta.field.read', {
      fieldAccess: {
        hidden: 'hidden',
        editable: 'editable',
        masked: 'partialMask',
      },
    }));
    assert.equal(adapter.canReadEntityField(current, 'order', 'hidden'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'hidden'), false);
    assert.equal(adapter.canReadEntityField(current, 'order', 'editable'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'masked'), true);
  }],
  ['record_update_state_grants_edit_without_metadata_update', () => {
    const current = access(permission('data.record.update', {
      fieldAccess: { title: 'editable' },
    }));
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), false);
  }],
  ['read_derived_create_with_named_hidden_exception', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', {
        fieldAccess: { '*': 'readonly', secret: 'hidden' },
      }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'secret'), false);
  }],
  ['empty_and_sparse_maps_have_distinct_bounds', () => {
    for (const [permissionKey, check] of [
      ['data.record.create', current => adapter.canCreateEntityField(current, 'order', 'title')],
      ['meta.field.read', current => adapter.canReadEntityField(current, 'order', 'title')],
      ['data.record.update', current => adapter.canUpdateEntityField(current, 'order', 'title')],
      ['data.record.bulkUpdate', current => adapter.canUpdateEntityField(current, 'order', 'title', 'data.record.bulkUpdate')],
    ]) {
      for (const fieldAccess of [{}, {amount: 'readonly'}]) {
        const current = access(permission(permissionKey, {fieldAccess}));
        assert.equal(adapter.canUseEntityOperation(current, 'order', permissionKey), true);
        assert.equal(check(current), Object.keys(fieldAccess).length === 0, permissionKey + ': sparse maps require a named or wildcard field entry');
      }
    }
    const restricted = access(permission('data.record.update', {fieldAccess: {'*': 'readonly', title: 'editable'}}));
    assert.equal(adapter.canUpdateEntityField(restricted, 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(restricted, 'order', 'amount'), false);
    assert.equal(adapter.canUpdateEntityField(access(), 'order', 'title'), false);
  }],
  ['missing_field_access_is_not_normalized_to_an_empty_map', () => {
    const valid = permission('data.record.update', {fieldAccess: {title: 'editable'}});
    for (const extra of [{}, {fieldAccess: undefined}]) {
      const incomplete = {permissionKey: 'data.record.update', resource: ENTITY_RESOURCE, effect: 'allow', ...extra};
      const current = access(valid, incomplete);
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.update'), false, 'incomplete selected result must invalidate the snapshot');
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
    }
    const otherApp = {permissionKey: 'data.record.update', resource: 'make://tenant-1/meta/app/OtherApp/entity/order', effect: 'allow'};
    assert.equal(adapter.canUpdateEntityField(access(valid, otherApp), 'order', 'title'), true, 'classify unrelated results before validating their field map');
  }],
  ['invalid_field_access_fails_closed', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'allow',
        fieldAccess: ['readonly'],
        permissionKey: 'meta.field.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);

    const invalidDeny = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'deny',
        fieldAccess: ['hidden'],
        permissionKey: 'meta.field.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(invalidDeny, 'order', 'data.record.create'), false);
  }],
  ['explicit_null_field_access_fails_closed', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      {
        effect: 'allow',
        fieldAccess: null,
        permissionKey: 'meta.field.read',
        resource: ENTITY_RESOURCE,
      },
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['invalid_field_access_state_fails_closed', () => {
    for (const fieldAccess of [
      { title: 'unexpected' },
      { title: [] },
      { title: [7] },
      { title: [['*']] },
      { title: null },
      { title: ['unexpected'] },
      { title: ['creatable', 7] },
    ]) {
      const current = adapter.normalizeAccess(basePayload([
        permission('data.record.create'),
        {
          effect: 'allow',
          fieldAccess,
          permissionKey: 'meta.field.read',
          resource: ENTITY_RESOURCE,
        },
      ]));
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['principal_multi_value_access_is_operation_specific', () => {
    for (const values of [['readonly', 'editable'], ['readonly', 'creatable'], ['hidden', 'readonly', 'creatable', 'editable', 'partialMask', 'fullMask'], ['*', 'hidden']]) {
      for (const states of [values, [...values].reverse()]) {
        const current = access(...['meta.field.read', 'data.record.create', 'data.record.update']
          .map(key => permission(key, {fieldAccess: {title: states}})));
        assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.update'), true);
        assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), states.includes('*') || states.includes('creatable'));
        assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), states.includes('*') || states.includes('editable'));
        assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
        assert.deepEqual(current.permissions[0].fieldAccess.title, states, 'preserve all members; no priority reduction');
      }
    }
  }],
  ['principal_singleton_arrays_preserve_field_permissions', () => {
    for (const state of ['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask', 'hidden']) {
      const fieldAccess = {'*': [state]};
      const current = access(...['meta.field.read', 'data.record.create', 'data.record.update', 'data.record.bulkUpdate']
        .map(key => permission(key, {fieldAccess})));
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.update'), true, state + ': valid singleton must not erase the operation');
      assert.equal(adapter.canReadEntityField(current, 'order', 'title'), !['hidden', 'creatable'].includes(state), state);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), ['*', 'creatable'].includes(state), state);
      for (const key of ['data.record.update', 'data.record.bulkUpdate']) {
        assert.equal(adapter.canUpdateEntityField(current, 'order', 'title', key), ['*', 'editable'].includes(state), state);
      }
    }
  }],
  ['principal_array_wildcard_keeps_named_restrictions_and_operation_bounds', () => {
    const fieldAccess = {'*': ['*'], title: ['readonly'], secret: ['hidden']};
    const current = access(permission('meta.field.read', {fieldAccess}), permission('data.record.update', {fieldAccess}));
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'secret'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'secret'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'amount'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'amount', 'data.record.bulkUpdate'), false);
    const denied = access(permission('data.record.update', {fieldAccess: {'*': ['*']}}), permission('data.record.update', {effect: 'deny'}));
    assert.equal(adapter.canUpdateEntityField(denied, 'order', 'amount'), false);
  }],
  ['principal_scalar_field_states_are_preserved', () => {
    const current = access(permission('data.record.update', {fieldAccess: {title: 'editable'}}));
    assert.deepEqual(current.permissions[0].fieldAccess.title, ['editable']);
  }],
  ['blank_field_key_poison_entire_access', () => {
    const current = adapter.normalizeAccess(basePayload([
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { '   ': 'readonly' } }),
    ]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['invalid_effect_fails_closed', () => {
    const current = adapter.normalizeAccess(basePayload([{
      effect: 'unexpected',
      fieldAccess: {},
      permissionKey: 'data.record.create',
      resource: ENTITY_RESOURCE,
    }]));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['malformed_row_poison_entire_access', () => {
    for (const malformedRow of [
      null,
      7,
      'invalid',
      { effect: 'unexpected', fieldAccess: {}, permissionKey: 'data.record.create', resource: ENTITY_RESOURCE },
      { effect: 'allow', fieldAccess: {}, permissionKey: 'data.record', resource: ENTITY_RESOURCE },
      { effect: 'allow', fieldAccess: {}, permissionKey: 'data.record.create', resource: 'invalid' },
    ]) {
      const current = adapter.normalizeAccess(basePayload([
        permission('data.record.create'),
        malformedRow,
      ]));
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
    for (const payload of [null, 7, 'invalid', [], { permissions: {}, scope: APP_RESOURCE }]) {
      let current;
      assert.doesNotThrow(() => {
        current = adapter.normalizeAccess(payload);
      });
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    }
  }],
  ['invalid_permission_key_does_not_match', () => {
    for (const permissionKey of ['*', 'data.record', 'data.record.create.extra']) {
      const current = access(permission(permissionKey));
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['invalid_resource_namespace_does_not_match', () => {
    for (const resource of [
      'make://tenant-1/other/app/TestApp/entity/order',
      'make://tenant-1/meta',
      'make://*/meta/app/TestApp/entity/order',
      'make://tenant-1/meta/app/*/entity/order',
      'make://tenant-2/meta/app/TestApp/entity/order',
    ]) {
      const current = access(
        permission('data.record.create', { resource }),
        permission('meta.field.read', {
          fieldAccess: { title: 'readonly' },
          resource,
        }),
      );
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['missing_app_scope_fails_closed', () => {
    for (const scope of [undefined, '', `${APP_RESOURCE}/entity/order`, 'make://*/meta/app/TestApp']) {
      const current = adapter.normalizeAccess({
        permissions: [
          permission('data.record.create', { resource: '*' }),
          permission('meta.field.read', {
            fieldAccess: { title: 'readonly' },
            resource: '*',
          }),
        ],
        principal: 'user-1',
        ...(scope === undefined ? {} : { scope }),
      });
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['app_resource_cannot_override_scope', () => {
    const current = adapter.normalizeAccess({
      appResource: 'make://tenant-2/meta/app/OtherApp',
      permissions: [
        permission('data.record.create', {
          resource: 'make://tenant-2/meta/app/OtherApp/entity/order',
        }),
        permission('meta.field.read', {
          fieldAccess: { title: 'readonly' },
          resource: 'make://tenant-2/meta/app/OtherApp/entity/order',
        }),
      ],
      principal: 'user-1',
      scope: APP_RESOURCE,
    });
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['invalid_explicit_app_resource_fails_closed', () => {
    for (const appResource of [null, '', 7]) {
      const current = adapter.normalizeAccess({
        appResource,
        permissions: [
          permission('data.record.create', { resource: '*' }),
          permission('meta.field.read', {
            fieldAccess: { '*': 'readonly' },
            resource: '*',
          }),
        ],
        principal: 'user-1',
        scope: APP_RESOURCE,
      });
      assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
      assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['compatible_permission_results_do_not_cancel_each_other', () => {
    for (const [permissionKey, wildcard, state, check] of [
      ['data.record.create', 'data.*.*', 'creatable', current => adapter.canCreateEntityField(current, 'order', 'title')],
      ['meta.field.read', 'meta.*.*', 'readonly', current => adapter.canReadEntityField(current, 'order', 'title')],
      ['data.record.update', 'data.*.*', 'editable', current => adapter.canUpdateEntityField(current, 'order', 'title')],
      ['data.record.bulkUpdate', 'data.*.*', 'editable', current => adapter.canUpdateEntityField(current, 'order', 'title', 'data.record.bulkUpdate')],
    ]) {
      for (const results of [
        [permission(permissionKey, {fieldAccess: {title: state}}), permission(wildcard, {fieldAccess: {title: state}})],
        [permission(permissionKey, {resource: APP_RESOURCE}), permission(permissionKey, {fieldAccess: {title: state}})],
        [permission(wildcard, {fieldAccess: {amount: 'readonly'}}), permission(permissionKey, {fieldAccess: {title: state}})],
      ]) {
        for (const permissions of [results, [...results].reverse()]) {
          const current = access(...permissions);
          assert.equal(adapter.canUseEntityOperation(current, 'order', permissionKey), true);
          assert.equal(check(current), true, permissionKey + ': adding a compatible backend result cannot revoke access');
        }
      }
    }
  }],
  ['returned_access_values_are_consumed_without_priority_ranking', () => {
    for (const operation of ['data.record.update', 'data.record.bulkUpdate']) {
      for (const state of ['readonly', 'hidden', 'partialMask', 'fullMask']) {
        const results = [permission('data.*.*', {fieldAccess: {title: 'editable'}}), permission(operation, {fieldAccess: {title: state}})];
        for (const permissions of [results, [...results].reverse()]) {
          const current = access(...permissions);
          assert.equal(adapter.canUseEntityOperation(current, 'order', operation), true);
          assert.equal(adapter.canUpdateEntityField(current, 'order', 'title', operation), true, state + ': returned editable membership remains available');
        }
      }
    }
    const visibleAndHidden = [permission('meta.field.read', {fieldAccess: {title: 'readonly'}}), permission('meta.*.*', {fieldAccess: {title: 'hidden'}})];
    for (const permissions of [visibleAndHidden, [...visibleAndHidden].reverse()]) assert.equal(adapter.canReadEntityField(access(...permissions), 'order', 'title'), true);
    const namedOverWildcard = [permission('data.record.update', {fieldAccess: {'*': ['*']}}), permission('data.record.update', {fieldAccess: {title: ['readonly']}})];
    for (const permissions of [namedOverWildcard, [...namedOverWildcard].reverse()]) assert.equal(adapter.canUpdateEntityField(access(...permissions), 'order', 'title'), false);
  }],
  ['backend_aggregated_field_results_are_consumed', () => {
    const current = access(
      permission('meta.field.read', {fieldAccess: {title: 'readonly', amount: 'readonly', secret: 'hidden'}}),
      permission('data.record.update', {fieldAccess: {title: 'editable', amount: 'readonly', secret: 'hidden'}}),
    );
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'amount'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'secret'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'amount'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'secret'), false);
  }],
  ['system_id_and_audit_fields_are_not_create_capable', () => {
    for (const type of ['Make.Field.ID', 'IDField']) {
      assert.equal(adapter.isCreateCapableField({ key: 'record_id', type }), false);
    }
    for (const key of [
      'create_user', 'create_time', 'update_user', 'update_time',
      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',
    ]) {
      assert.equal(adapter.isCreateCapableField({ key, type: 'Make.Field.Text' }), false);
    }
    assert.equal(adapter.isCreateCapableField({ key: 'title', type: 'Make.Field.Text' }), true);
  }],
  ['system_id_fields_are_not_edit_capable', () => {
    for (const type of ['Make.Field.ID', 'IDField']) {
      assert.equal(adapter.isEditCapableField({ key: 'record_id', type }), false);
    }
    assert.equal(adapter.isEditCapableField({ key: 'title', type: 'Make.Field.Text' }), true);
  }],
  ['similarly_named_business_fields_remain_create_capable', () => {
    for (const key of [
      'create_user_note',
      'create_time_zone',
      'update_user_label',
      'qfei_update_time_backup',
    ]) {
      assert.equal(adapter.isCreateCapableField({ key, type: 'Make.Field.Text' }), true);
    }
  }],
  ['audit_fields_can_remain_update_capable', () => {
    const auditKeys = [
      'create_user', 'create_time', 'update_user', 'update_time',
      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',
    ];
    const current = access(permission('data.record.update', {
      fieldAccess: Object.fromEntries(auditKeys.map((key) => [key, 'editable'])),
    }));
    for (const key of auditKeys) {
      assert.equal(adapter.canUpdateEntityField(current, 'order', key), true);
      assert.equal(adapter.isEditCapableField({ key, type: 'Make.Field.Text' }), true);
    }
  }],
  ['business_field_update_exact_and_data_wildcards', () => {
    for (const key of ['data.record.update', 'data.record.*', 'data.*.*']) {
      const current = access(permission(key, { fieldAccess: { title: 'editable', secret: 'hidden' } }));
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'secret'), false);
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'other'), false, 'a sparse map without a matching wildcard does not grant an unlisted field');
    }
  }],
  ['other_record_operations_never_grant_business_edit', () => {
    for (const key of ['data.record.read', 'data.record.create', 'data.record.delete', 'data.record.export']) {
      assert.equal(adapter.canUpdateEntityField(access(permission(key)), 'order', 'title'), false);
    }
  }],
  ['bulk_update_is_independent', () => {
    const bulk = access(permission('data.record.bulkUpdate', {fieldAccess: {title: 'editable'}}));
    assert.equal(adapter.canUpdateEntityField(bulk, 'order', 'title', 'data.record.bulkUpdate'), true);
    assert.equal(adapter.canUpdateEntityField(bulk, 'order', 'title'), false);
    const single = access(permission('data.record.update'));
    assert.equal(adapter.canUpdateEntityField(single, 'order', 'title', 'data.record.bulkUpdate'), false);
  }],
  ['metadata_update_never_grants_business_edit', () => {
    const current = access(permission('meta.field.update'));
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
  }],
  ['metadata_wildcards_never_grant_business_edit', () => {
    for (const key of ['meta.field.*', 'meta.*.*']) {
      const current = access(permission(key, { fieldAccess: { title: 'editable' } }));
      assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
      assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
    }
  }],
  ['business_field_exact_deny_overrides_data_wildcards', () => {
    for (const grant of ['data.record.*', 'data.*.*']) {
      for (const resource of [APP_RESOURCE, ENTITY_RESOURCE]) {
        const current = access(permission(grant), permission('data.record.update', { effect: 'deny', resource }));
        assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
      }
    }
  }],
  ['business_field_update_readonly_deny_and_revoke', () => {
    const grant = permission('data.record.update');
    assert.equal(adapter.canUpdateEntityField(access(grant), 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(access(permission('data.record.update', { fieldAccess: { title: 'readonly' } })), 'order', 'title'), false);
    assert.equal(adapter.canUpdateEntityField(access(grant, permission('data.*.*', { effect: 'deny' })), 'order', 'title'), false);
    assert.equal(adapter.canUpdateEntityField(access(), 'order', 'title'), false);
  }],
];

for (const [name, run] of cases) {
  try {
    run();
  } catch (error) {
    console.error(`${name}: FAIL`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

console.log(`permission conformance: PASS (${cases.length} cases)`);
