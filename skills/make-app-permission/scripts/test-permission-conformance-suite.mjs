#!/usr/bin/env node
import assert from 'node:assert/strict';
import { correctAdapterSource } from './fixtures/correct-permission-adapter.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suiteScript = path.join(scriptDir, 'permission-conformance-suite.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-app-permission-conformance-'));

try {
  const permissiveAdapter = writeAdapter('permissive.mjs', `
    export const normalizeAccess = (payload) => payload;
    export const canUseEntityOperation = () => true;
    export const canCreateEntityField = () => true;
    export const canReadEntityField = () => true;
    export const canUpdateEntityField = () => true;
    export const isCreateCapableField = () => true;
    export const isEditCapableField = () => true;
  `);
  const permissiveResult = runSuite(permissiveAdapter);
  assert.notEqual(permissiveResult.status, 0);
  assert.match(permissiveResult.output, /named_entity_permission_does_not_leak/);


  const correctAdapter = writeAdapter('correct.mjs', correctAdapterSource);
  const correctResult = runSuite(correctAdapter);
  assert.equal(correctResult.status, 0, correctResult.output);
  assert.match(correctResult.output, /permission conformance: PASS/);

  const updateExpression = "fieldAllowed(access, entityKey, fieldKey, 'data.field.update', new Set(['*', 'editable']))";
  for (const [name, source, failure] of [
    ['metadata-fallback', correctAdapterSource.replace(updateExpression, updateExpression + " || fieldAllowed(access, entityKey, fieldKey, 'meta.field.update', new Set(['*', 'editable']))"), /metadata_wildcards_never_grant_business_edit/],
    ['exact-field-deny-ignored', correctAdapterSource.replace('.filter((item) => wildcardKeyMatches(item.permissionKey, permissionKey))', ".filter((item) => !(item.effect === 'deny' && item.permissionKey === 'data.field.update')).filter((item) => wildcardKeyMatches(item.permissionKey, permissionKey))"), /business_field_exact_deny_overrides_data_wildcards/],
  ]) {
    assert.notEqual(source, correctAdapterSource, name + ' mutation must change the fixture');
    const result = runSuite(writeAdapter(name + '.mjs', source));
    assert.notEqual(result.status, 0, name + ' must be rejected');
    assert.match(result.output, failure);
  }

  const unknownKeySelectedAdapter = writeAdapter(
    'unknown-key-selected.mjs',
    correctAdapterSource.replace(
      "return supportedBusinessPermissionKeys.some((expected) => wildcardKeyMatches(value, expected))",
      "return value.startsWith('data.record.') || supportedBusinessPermissionKeys.some((expected) => wildcardKeyMatches(value, expected))",
    ),
  );
  const unknownKeySelectedResult = runSuite(unknownKeySelectedAdapter);
  assert.notEqual(unknownKeySelectedResult.status, 0);
  assert.match(
    unknownKeySelectedResult.output,
    /unknown_current_app_permission_key_is_ignored_before_validation/,
  );

  const unclassifiableResourceIgnoredAdapter = writeAdapter(
    'unclassifiable-resource-ignored.mjs',
    correctAdapterSource.replace(
      "if (resourceClassification === 'unclassifiable') return true;",
      "if (resourceClassification === 'unclassifiable') return false;",
    ),
  );
  const unclassifiableResourceIgnoredResult = runSuite(unclassifiableResourceIgnoredAdapter);
  assert.notEqual(unclassifiableResourceIgnoredResult.status, 0);
  assert.match(
    unclassifiableResourceIgnoredResult.output,
    /unclassifiable_resource_fails_closed_before_key_is_ignored/,
  );

  const entityMetadataUsesRecordReadAdapter = writeAdapter(
    'entity-metadata-uses-record-read.mjs',
    correctAdapterSource.replace(
      "export const canUseEntityOperation = (access, entityKey, permissionKey) => {\n      const matched = matches(access, entityKey, permissionKey);",
      "export const canUseEntityOperation = (access, entityKey, permissionKey) => {\n      const matched = matches(access, entityKey, permissionKey === 'meta.entity.read' ? 'data.record.read' : permissionKey);",
    ),
  );
  const entityMetadataUsesRecordReadResult = runSuite(entityMetadataUsesRecordReadAdapter);
  assert.notEqual(entityMetadataUsesRecordReadResult.status, 0);
  assert.match(
    entityMetadataUsesRecordReadResult.output,
    /entity_metadata_read_is_independent_from_record_read/,
  );

  const noGlobalWildcardAdapter = writeAdapter(
    'no-global-wildcard.mjs',
    correctAdapterSource.replace(
      "if (actual === expected || actual === '*.*.*') return true;",
      "if (actual === '*.*.*') return false;\n      if (actual === expected) return true;",
    ),
  );
  const noGlobalWildcardResult = runSuite(noGlobalWildcardAdapter);
  assert.notEqual(noGlobalWildcardResult.status, 0);
  assert.match(noGlobalWildcardResult.output, /operation_global_permission_wildcard_allows/);

  const noStateListAdapter = writeAdapter(
    'no-state-list.mjs',
    correctAdapterSource.replace(
      "const flattenedStates = states.flatMap((state) => Array.isArray(state) ? state : [state]);",
      "const flattenedStates = states;",
    ),
  );
  const noStateListResult = runSuite(noStateListAdapter);
  assert.notEqual(noStateListResult.status, 0);
  assert.match(noStateListResult.output, /operation_deny_does_not_deny_read_derived_create_field|create_field_uses_meta_field_read_dimension|valid_field_access_state_lists_are_preserved/);

  const createFieldUsesRecordOperationAdapter = writeAdapter(
    'create-field-uses-record-operation.mjs',
    correctAdapterSource.replace(
      "fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']))",
      "fieldAllowed(access, entityKey, fieldKey, 'data.record.create', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']))",
    ),
  );
  const createFieldUsesRecordOperationResult = runSuite(createFieldUsesRecordOperationAdapter);
  assert.notEqual(createFieldUsesRecordOperationResult.status, 0);
  assert.match(createFieldUsesRecordOperationResult.output, /operation_deny_does_not_deny_read_derived_create_field|create_field_uses_meta_field_read_dimension/);

  const createFieldDependsOnRecordOperationAdapter = writeAdapter(
    'create-field-depends-on-record-operation.mjs',
    correctAdapterSource.replace(
      "export const canCreateEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']));",
      "export const canCreateEntityField = (access, entityKey, fieldKey) => canUseEntityOperation(access, entityKey, 'data.record.create') && fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']));",
    ),
  );
  const createFieldDependsOnRecordOperationResult = runSuite(createFieldDependsOnRecordOperationAdapter);
  assert.notEqual(createFieldDependsOnRecordOperationResult.status, 0);
  assert.match(
    createFieldDependsOnRecordOperationResult.output,
    /operation_deny_does_not_deny_read_derived_create_field/,
  );

  const noParentResourceAdapter = writeAdapter(
    'no-parent-resource.mjs',
    correctAdapterSource.replace(
      "if (actual === '*' || actual === expected || expected.startsWith(actual + '/')) return true;",
      "if (actual !== expected && expected.startsWith(actual + '/')) return false;\n      if (actual === '*' || actual === expected || expected.startsWith(actual + '/')) return true;",
    ),
  );
  const noParentResourceResult = runSuite(noParentResourceAdapter);
  assert.notEqual(noParentResourceResult.status, 0);
  assert.match(noParentResourceResult.output, /operation_record_wildcard_allows|parent_and_global_resources_match/);

  const droppedMalformedRowsAdapter = writeAdapter(
    'dropped-malformed-rows.mjs',
    correctAdapterSource.replace(
      'validScope && appResourceMatches && Array.isArray(inputPermissions) && normalized.every(Boolean)',
      'validScope && appResourceMatches && Array.isArray(inputPermissions)',
    ).replace(
      '? normalized\n        : [];',
      '? normalized.filter(Boolean)\n        : [];',
    ),
  );
  const droppedMalformedRowsResult = runSuite(droppedMalformedRowsAdapter);
  assert.notEqual(droppedMalformedRowsResult.status, 0);
  assert.match(
    droppedMalformedRowsResult.output,
    /invalid_field_access_fails_closed|blank_field_key_poison_entire_access|malformed_row_poison_entire_access|unclassifiable_resource_fails_closed_before_key_is_ignored/,
  );

  const appResourceOverrideAdapter = writeAdapter(
    'app-resource-override.mjs',
    correctAdapterSource
      .replace(
        "const appResourceMatches = !Object.hasOwn(source ?? {}, 'appResource') || String(source.appResource ?? '') === scope;",
        'const appResourceMatches = true;',
      )
      .replace(
        "appResource: String(payload?.scope ?? ''),",
        "appResource: String(payload?.appResource ?? payload?.scope ?? ''),",
      ),
  );
  const appResourceOverrideResult = runSuite(appResourceOverrideAdapter);
  assert.notEqual(appResourceOverrideResult.status, 0);
  assert.match(appResourceOverrideResult.output, /app_resource_cannot_override_scope|invalid_explicit_app_resource_fails_closed/);

  const firstAllowOnlyAdapter = writeAdapter(
    'first-allow-only.mjs',
    correctAdapterSource.replace(
      'const ranges = allows.filter((item) => score(item.resource) === maxScore);',
      'const ranges = allows.filter((item) => score(item.resource) === maxScore).slice(0, 1);',
    ),
  );
  const firstAllowOnlyResult = runSuite(firstAllowOnlyAdapter);
  assert.notEqual(firstAllowOnlyResult.status, 0);
  assert.match(firstAllowOnlyResult.output, /create_field_uses_meta_field_read_dimension|same_specificity_allow_fields_union/);

  const fuzzySystemFieldAdapter = writeAdapter(
    'fuzzy-system-field.mjs',
    correctAdapterSource.replace(
      "]).has(field.key);",
      "]).has(field.key) && ![\n      'create_user', 'create_time', 'update_user', 'update_time',\n      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',\n    ].some((key) => field.key.includes(key));",
    ),
  );
  const fuzzySystemFieldResult = runSuite(fuzzySystemFieldAdapter);
  assert.notEqual(fuzzySystemFieldResult.status, 0);
  assert.match(fuzzySystemFieldResult.output, /similarly_named_business_fields_remain_create_capable/);

  const missingIdEditGuardAdapter = writeAdapter(
    'missing-id-edit-guard.mjs',
    correctAdapterSource.replace(
      "export const isEditCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type);",
      'export const isEditCapableField = () => true;',
    ),
  );
  const missingIdEditGuardResult = runSuite(missingIdEditGuardAdapter);
  assert.notEqual(missingIdEditGuardResult.status, 0);
  assert.match(missingIdEditGuardResult.output, /system_id_fields_are_not_edit_capable/);

  const auditEditGuardAdapter = writeAdapter(
    'audit-edit-guard.mjs',
    correctAdapterSource.replace(
      "export const canUpdateEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'data.field.update', new Set(['*', 'editable']));",
      "export const canUpdateEntityField = (access, entityKey, fieldKey) => fieldKey !== 'create_time' && fieldAllowed(access, entityKey, fieldKey, 'data.field.update', new Set(['*', 'editable']));",
    ),
  );
  const auditEditGuardResult = runSuite(auditEditGuardAdapter);
  assert.notEqual(auditEditGuardResult.status, 0);
  assert.match(auditEditGuardResult.output, /audit_fields_can_remain_update_capable/);

  const incompleteAdapter = writeAdapter('incomplete.mjs', 'export const normalizeAccess = (payload) => payload;');
  const incompleteResult = runSuite(incompleteAdapter);
  assert.notEqual(incompleteResult.status, 0);
  assert.match(incompleteResult.output, /adapter_function_missing/);

  console.log('permission-conformance-suite tests: PASS');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

function writeAdapter(name, source) {
  const file = path.join(tempRoot, name);
  fs.writeFileSync(file, source, 'utf8');
  return file;
}

function runSuite(adapterPath) {
  const result = spawnSync(process.execPath, [suiteScript, adapterPath], {
    encoding: 'utf8',
  });
  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status,
  };
}
