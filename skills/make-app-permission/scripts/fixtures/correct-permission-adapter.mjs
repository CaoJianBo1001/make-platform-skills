// Test fixture only; host adapters must import production permission code.
export const correctAdapterSource = `
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
          'data.field.update',
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
          || (/^(?:data\\.(?:record|field)|meta\\.(?:entity|field))(?:\\.|$)/.test(value) && !validPermissionKey(value));
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
    export const canUpdateEntityField = (access, entityKey, fieldKey) => fieldAllowed(access, entityKey, fieldKey, 'data.field.update', new Set(['*', 'editable']));
    export const isCreateCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type) && !new Set([
      'create_user', 'create_time', 'update_user', 'update_time',
      'qfei_create_user', 'qfei_create_time', 'qfei_update_user', 'qfei_update_time',
    ]).has(field.key);
    export const isEditCapableField = (field) => !new Set(['Make.Field.ID', 'IDField']).has(field.type);
  `;
