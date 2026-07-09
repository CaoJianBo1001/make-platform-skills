# UI Permission Runtime

Use this reference when adding or reviewing frontend permission loading and enforcement.

## Contents

- Provider order
- UI API adapter
- Permission access model
- Route guard
- Object pages
- Dictionaries and custom pages
- Refresh strategy
- Readiness blockers

## Provider order

Mount permission after auth and before schema/router:

```jsx
<AuthGate>
  <PermissionProvider>
    <SchemaProvider>
      <AppRouter />
    </SchemaProvider>
  </PermissionProvider>
</AuthGate>
```

Reason:

- Auth establishes identity and `auth.api`.
- PermissionProvider loads current App permissions.
- SchemaProvider loads authorized objects and visible fields.
- Router and pages consume both permission and schema.

## UI API adapter

Use the host shared API adapter. For Service-fronted Apps:

```text
auth.api.get("/app/principal/permission")
```

Do not use raw `fetch`, do not hand-write Authorization, and do not call `/api/make/iam/**` from UI.

## Permission access model

Normalize IAM response into a small model:

```text
{
  principal,
  scope,
  appResource,
  permissions: [{ permissionKey, resource, effect, fieldAccess }]
}
```

Required helpers:

- `canUseEntityOperation(access, entityKey, permissionKey)`
- `canEditEntityField(access, entityKey, fieldKey, permissionKey)`
- `editableFieldKeysForEntity(access, entityKey, fields, permissionKey)`

Permission matching must support:

- exact permissionKey
- `data.record.*`
- `*.*.*`
- three-part wildcard such as `data.*.*`

Resource matching should prefer the most specific match:

1. Exact entity resource.
2. Entity wildcard such as `/entity/*`.
3. IAM namespace-wildcard App resource such as `make://<tenantId>/*/app/<appKey>`, normalized to the current App resource.
4. App-level resource.
5. Parent resource.
6. `*`.

The UI may derive `appResource` from response scope `make://<tenantId>/meta/app/<appKey>`, but permission rows may return resources such as `make://<tenantId>/*/app/<appKey>`. Normalize or segment-match that `*` namespace before evaluating operation and field access.

Deny must win over allow when both match. Allow without fieldAccess means no field restriction. When fieldAccess exists, only `editable` permits editing.

## Route guard

Do not rely on menu hiding.

Required guards:

- App guard: after permission and schema load, if there is no authorized object and no authorized fixed page, render App forbidden and do not mount business pages.
- Dynamic object guard: for `/objects/:entityKey`, verify the entity exists in schema before rendering the object page.
- Fixed route guard: bind every fixed business route to an entityKey, permissionKey, or route-specific permission checker.
- Default redirect: redirect only to an authorized object/page. If no target exists, render App forbidden.

If the entity exists in schema but lacks `data.record.read`, render object-level forbidden/empty state and do not fetch data.

## Object pages

For each schema-backed object:

- Compute `canReadRecord` with `data.record.read`.
- Disable list hook or list loader when `canReadRecord` is false.
- Block detail open and detail fetch when `canReadRecord` is false.
- Compute create editable fields with `data.record.create`.
- Compute update editable fields with `data.record.update`.
- Show create only when create is allowed and there is at least one editable create field.
- Show edit only when update is allowed and there is at least one editable update field.
- Show delete only when `data.record.delete` is allowed.
- Pass update editable fields to table/cell-edit column builders.
- Pass create/update editable fields to form builders according to mode.
- Submit only filtered fields. Do not send unauthorized field values.
- Recheck permission in action handlers before submit/delete/cell commit.

Use visible schema fields for display. Use permission editable fields for editing.

## Dictionaries and custom pages

For pages not directly generated from one schema object:

- Map each UI section to the real Make `entityKey`.
- Map UI field names to Make `fieldKey`.
- Gate list/detail with `data.record.read`.
- Gate create/update/delete and custom actions with the correct operation key.
- Gate local fields and cell edits with `canEditEntityField`.
- Preserve identifiers such as `recordID` or immutable business keys only as identifiers, not as unauthorized update fields.
- Filter payloads before submit.

Examples:

- Dictionary item page maps to `dict_item`.
- Dictionary type page maps to `dict_type`.
- Disable action usually requires update permission and editable `status`.

## Refresh strategy

Permission changes do not need real-time push. Refresh must take effect.

On browser reload, load auth, permission, schema, then pages again.

On page refresh/retry:

1. `await refreshPermissions()`.
2. Use returned latest access, not stale React state.
3. Close detail/create/edit/delete surfaces if latest permission no longer allows them.
4. Refresh records only if latest access still has `data.record.read`.
5. Show forbidden/empty state when access is removed.

If permission loading fails, fail closed: empty access, no protected data request, no operation buttons.

## Readiness blockers

Do not report permission work complete if:

- A direct URL can mount an unauthorized object or fixed business page.
- Lists/details load without read permission.
- Buttons are hidden but handlers can still submit/delete/edit.
- Schema visible fields are treated as editable without `/principal/permission`.
- Form payloads include fields the user cannot edit.
- Refresh reloads data before refreshing permission.
