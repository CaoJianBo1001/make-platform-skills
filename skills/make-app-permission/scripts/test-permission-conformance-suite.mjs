#!/usr/bin/env node
import assert from 'node:assert/strict';
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

  const correctAdapterSource = `
    const APP = 'make://tenant-1/meta/app/TestApp';
    const knownFieldAccess = new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask', 'hidden']);
    const wildcardKeyMatches = (actual, expected) => {
      if (actual === expected || actual === '*.*.*') return true;
      if (actual === 'data.record.*' && expected.startsWith('data.record.')) return true;
      const left = actual.split('.');
      const right = expected.split('.');
      return left.length === 3 && right.length === 3 && left.every((part, index) => part === '*' || part === right[index]);
    };
    const resourceMatches = (actual, expected) => {
      if (actual === '*' || actual === expected || expected.startsWith(actual + '/')) return true;
      if (!/^make:\\/\\/[^/*]+\\/(?:meta|\\*)\\/app\\/[^/*]+(?:\\/entity\\/(?:[^/*]+|\\*))?$/.test(actual)) return false;
      const left = actual.split('/');
      const right = expected.split('/');
      return left.length <= right.length && left.every((part, index) => part === '*' || part === right[index]);
    };
    const score = (resource) => {
      if (resource === '*') return 0;
      const segments = resource.split('/');
      const entityIndex = segments.indexOf('entity');
      if (entityIndex >= 0) return segments[entityIndex + 1] === '*' ? 3 : 4;
      return segments.includes('app') ? 2 : 1;
    };
    const entityResource = (access, entityKey) => access.appResource + '/entity/' + entityKey;
    const requestedIdentifier = (value) => String(value ?? '').trim();
    const isValidRequestedIdentifier = (value) => {
      if (typeof value !== 'string') return false;
      const normalized = requestedIdentifier(value);
      return Boolean(normalized) && normalized !== '*';
    };
    const matches = (access, entityKey, permissionKey) => {
      if (!isValidRequestedIdentifier(entityKey)) return [];
      return access.permissions
        .filter((item) => wildcardKeyMatches(item.permissionKey, permissionKey))
        .filter((item) => resourceMatches(item.resource, entityResource(access, requestedIdentifier(entityKey))));
    };
    const fieldAllowed = (access, entityKey, fieldKey, permissionKey, allowedStates) => {
      if (!isValidRequestedIdentifier(fieldKey)) return false;
      fieldKey = requestedIdentifier(fieldKey);
      const matched = matches(access, entityKey, permissionKey);
      if (matched.some((item) => item.effect === 'deny')) return false;
      const allows = matched.filter((item) => item.effect === 'allow');
      const maxScore = Math.max(...allows.map((item) => score(item.resource)), -1);
      const ranges = allows.filter((item) => score(item.resource) === maxScore);
      const namedStates = ranges
        .filter((item) => Object.hasOwn(item.fieldAccess, fieldKey))
        .map((item) => item.fieldAccess[fieldKey]);
      const states = namedStates.length > 0
        ? namedStates
        : ranges.some((item) => Object.keys(item.fieldAccess).length === 0)
          ? ['*']
          : ranges.filter((item) => Object.hasOwn(item.fieldAccess, '*')).map((item) => item.fieldAccess['*']);
      const flattenedStates = states.flatMap((state) => Array.isArray(state) ? state : [state]);
      if (flattenedStates.includes('hidden')) return false;
      return flattenedStates.some((state) => allowedStates.has(state ?? ''));
    };
    export const normalizeAccess = (payload) => {
      const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
      const scope = String(source?.scope ?? '');
      const inputPermissions = source?.permissions;
      const appResourceMatches = !Object.hasOwn(source ?? {}, 'appResource') || String(source.appResource ?? '') === scope;
      const validScope = /^make:\\/\\/[^/*]+\\/meta\\/app\\/[^/*]+$/.test(scope);
      const supportedBusinessPermissionKeys = [
          'data.record.read',
          'data.record.create',
          'data.record.update',
          'data.record.bulkUpdate',
          'data.record.delete',
          'meta.entity.read',
          'meta.field.read',
          'meta.field.update',
      ];
      const classifyResource = (value) => {
        if (value === '*') return 'current-app';
        if (typeof value !== 'string') return 'unclassifiable';
        if (/^make:\\/\\/[^/*]+$/.test(value)) return 'unrelated';
        const scopeParts = /^make:\\/\\/([^/*]+)\\/meta\\/app\\/([^/*]+)$/.exec(scope);
        const resourceParts = /^make:\\/\\/([^/*]+)\\/(?:meta|\\*)\\/app\\/([^/*]+)(?:\\/entity\\/(?:[^/*]+|\\*))?$/.exec(value);
        if (!scopeParts || !resourceParts) return 'unclassifiable';
        return scopeParts[1] === resourceParts[1] && scopeParts[2] === resourceParts[2]
          ? 'current-app'
          : 'unrelated';
      };
      const validPermissionKey = (value) => /^(?:[A-Za-z][\\w-]*|\\*)(?:\\.(?:[A-Za-z][\\w-]*|\\*)){2}$/.test(String(value ?? ''));
      const isPotentialBusinessPermissionKey = (value) => {
        if (typeof value !== 'string') return true;
        return supportedBusinessPermissionKeys.some((expected) => wildcardKeyMatches(value, expected))
          || (/^(?:data\\.record|meta\\.(?:entity|field))(?:\\.|$)/.test(value) && !validPermissionKey(value));
      };
      const shouldSelectRow = (item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
        const resourceClassification = classifyResource(item.resource);
        if (resourceClassification === 'unrelated') return false;
        if (resourceClassification === 'unclassifiable') return true;
        return isPotentialBusinessPermissionKey(item.permissionKey);
      };
      const validResource = (value) => value === '*' || /^make:\\/\\/[^/*]+\\/(?:meta|\\*)\\/app\\/[^/*]+(?:\\/entity\\/(?:[^/*]+|\\*))?$/.test(String(value ?? ''));
      const normalizeItem = (item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        if (!['allow', 'deny'].includes(item.effect) || !validPermissionKey(item.permissionKey) || !validResource(item.resource)) return null;
        const hasFieldAccess = Object.hasOwn(item, 'fieldAccess');
        if (hasFieldAccess && (item.fieldAccess === null || typeof item.fieldAccess !== 'object' || Array.isArray(item.fieldAccess))) return null;
        const entries = Object.entries(item.fieldAccess ?? {});
        if (entries.some(([key, value]) => {
          const states = Array.isArray(value) ? value : [value];
          return !key.trim() || states.length === 0 || states.some((state) => typeof state !== 'string' || !knownFieldAccess.has(state.trim()));
        })) return null;
        return {
          effect: item.effect,
          fieldAccess: Object.fromEntries(entries.map(([key, value]) => [key.trim(), (Array.isArray(value) ? value : [value]).map((state) => state.trim())])),
          permissionKey: String(item.permissionKey),
          resource: String(item.resource),
        };
      };
      const selectedPermissions = Array.isArray(inputPermissions)
        ? inputPermissions.filter(shouldSelectRow)
        : [];
      const normalized = selectedPermissions.map(normalizeItem);
      const permissions = validScope && appResourceMatches && Array.isArray(inputPermissions) && normalized.every(Boolean)
        ? normalized
        : [];
      return {
        appResource: String(payload?.scope ?? ''),
        permissions,
        principal: String(source?.principal ?? ''),
        scope,
      };
    };
    export const canUseEntityOperation = (access, entityKey, permissionKey) => {
      const matched = matches(access, entityKey, permissionKey);
      return !matched.some((item) => item.effect === 'deny') && matched.some((item) => item.effect === 'allow');
    };
    export const canCreateEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'creatable', 'editable', 'readonly', 'partialMask', 'fullMask']));
    export const canReadEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'meta.field.read', new Set(['*', 'editable', 'readonly', 'partialMask', 'fullMask']));
    export const canUpdateEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'meta.field.update', new Set(['*', 'editable']));
    export const isCreateCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type) && !new Set([
      'create_user', 'create_time', 'update_user', 'update_time',
      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',
    ]).has(field.key);
    export const isEditCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type);
  `;
  const correctAdapter = writeAdapter('correct.mjs', correctAdapterSource);
  const correctResult = runSuite(correctAdapter);
  assert.equal(correctResult.status, 0, correctResult.output);
  assert.match(correctResult.output, /permission conformance: PASS/);

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
      "export const canUpdateEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'meta.field.update', new Set(['*', 'editable']));",
      "export const canUpdateEntityField = (access, entityKey, fieldKey) => fieldKey !== 'create_time' && fieldAllowed(access, entityKey, fieldKey, 'meta.field.update', new Set(['*', 'editable']));",
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
