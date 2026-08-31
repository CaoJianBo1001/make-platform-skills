#!/usr/bin/env node
// make-app-permission contract version: 0.2.9
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
      permission('*.*.*', { fieldAccess: { '*': '*' }, resource: '*' }),
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
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'meta.record.create'), true);
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.update'), false);
  }],
  ['operation_deny_wins', () => {
    const current = access(
      permission('data.record.*', { resource: APP_RESOURCE }),
      permission('data.record.create', { effect: 'deny' }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
  }],
  ['operation_deny_does_not_deny_read_derived_create_field', () => {
    const current = access(
      permission('data.record.create'),
      permission('data.record.create', { effect: 'deny' }),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
  }],
  ['read_field_deny_does_not_deny_record_create_operation', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      permission('meta.field.read', { effect: 'deny' }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['namespace_resource_wildcard_matches', () => {
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
  ['create_field_uses_meta_field_read_dimension', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: { createOnly: 'creatable' } }),
      permission('meta.field.read', { fieldAccess: { visibleOnly: 'readonly' } }),
      permission('meta.field.update', { fieldAccess: { editableOnly: 'editable' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'createOnly'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'createOnly'), false);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'createOnly'), false);
    assert.equal(adapter.canReadEntityField(current, 'order', 'visibleOnly'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'visibleOnly'), true);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'editableOnly'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'editableOnly'), false);
  }],
  ['record_create_field_access_does_not_grant_meta_read', () => {
    const current = access(permission('data.record.create', {
      fieldAccess: { createOnly: 'creatable' },
    }));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'createOnly'), false);
  }],
  ['legacy_meta_field_create_does_not_grant_create_field', () => {
    const current = access(permission('meta.field.create', {
      fieldAccess: { title: 'creatable' },
    }));
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['read_dimension_access_states', () => {
    const current = access(permission('meta.field.read', {
      fieldAccess: {
        creatable: 'creatable',
        editable: 'editable',
        masked: 'partialMask',
      },
    }));
    assert.equal(adapter.canReadEntityField(current, 'order', 'creatable'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'creatable'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'editable'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'masked'), true);
  }],
  ['record_update_field_access_does_not_grant_meta_update', () => {
    const current = access(permission('data.record.update', {
      fieldAccess: { title: 'editable' },
    }));
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), false);
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
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'secret'), false);
  }],
  ['empty_field_access_is_unrestricted_in_dimension', () => {
    const current = access(permission('meta.field.read'));
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
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
  ['valid_field_access_state_lists_are_preserved', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: { title: ['creatable', 'readonly'] } }),
      permission('meta.field.read', { fieldAccess: { title: ['readonly', 'editable'] } }),
      permission('meta.field.update', { fieldAccess: { title: ['readonly', 'editable'] } }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canReadEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canUpdateEntityField(current, 'order', 'title'), true);
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
  ['most_specific_read_allow_restricts_parent_create_field_range', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: {}, resource: APP_RESOURCE }),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), false);
  }],
  ['entity_wildcard_allow_restricts_app_allow', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: {}, resource: APP_RESOURCE }),
      permission('meta.field.read', {
        fieldAccess: { title: 'readonly' },
        resource: `${APP_RESOURCE}/entity/*`,
      }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), false);
  }],
  ['same_specificity_allow_fields_union', () => {
    const current = access(
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      permission('meta.field.read', { fieldAccess: { amount: 'readonly' } }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'secret'), false);
  }],
  ['namespace_alias_same_specificity_allow_union', () => {
    const current = access(
      permission('meta.field.read', {
        fieldAccess: { title: 'readonly' },
        resource: ENTITY_RESOURCE,
      }),
      permission('meta.field.read', {
        fieldAccess: { amount: 'readonly' },
        resource: 'make://tenant-1/*/app/TestApp/entity/order',
      }),
    );
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), true);
  }],
  ['same_specificity_named_hidden_overrides_wildcard', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { '*': 'readonly' } }),
      permission('meta.field.read', { fieldAccess: { secret: 'hidden' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'secret'), false);
  }],
  ['same_specificity_named_hidden_overrides_named_allow', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: { title: 'readonly' } }),
      permission('meta.field.read', { fieldAccess: { title: 'hidden' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
  }],
  ['same_specificity_named_hidden_overrides_unrestricted_allow', () => {
    const current = access(
      permission('data.record.create'),
      permission('meta.field.read', { fieldAccess: {} }),
      permission('meta.field.read', { fieldAccess: { title: 'hidden' } }),
    );
    assert.equal(adapter.canUseEntityOperation(current, 'order', 'data.record.create'), true);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'title'), false);
    assert.equal(adapter.canCreateEntityField(current, 'order', 'amount'), true);
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
    const current = access(permission('meta.field.update', {
      fieldAccess: Object.fromEntries(auditKeys.map((key) => [key, 'editable'])),
    }));
    for (const key of auditKeys) {
      assert.equal(adapter.canUpdateEntityField(current, 'order', key), true);
      assert.equal(adapter.isEditCapableField({ key, type: 'Make.Field.Text' }), true);
    }
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
