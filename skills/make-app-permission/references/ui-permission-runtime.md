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
- SchemaProvider loads authorized objects and structural fields after backend permission trimming.
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
- `canReadEntityField(access, entityKey, fieldKey)`
- `canUpdateEntityField(access, entityKey, fieldKey)`
- `visibleFieldsForEntity(access, entityKey, schemaFields)`
- `editableFieldKeysForEntity(access, entityKey, fields)`

Permission matching must support:

- exact permissionKey
- `data.record.*`
- `meta.field.*`
- `*.*.*`
- three-part wildcard such as `data.*.*` or `meta.*.*`

Resource matching should prefer the most specific match:

1. Exact entity resource.
2. Entity wildcard such as `/entity/*`.
3. IAM namespace-wildcard App resource such as `make://<tenantId>/*/app/<appKey>`, normalized to the current App resource.
4. App-level resource.
5. Parent resource.
6. `*`.

The UI may derive `appResource` from response scope `make://<tenantId>/meta/app/<appKey>`, but permission rows may return resources such as `make://<tenantId>/*/app/<appKey>`. Normalize or segment-match that `*` namespace before evaluating operation and field access.

Deny must win over allow when both match.

Keep record operations and field permissions separate:

- `data.record.read/create/update/delete` controls record data loading and operation entries.
- `meta.field.read` controls field visibility. Fields without read permission are not rendered.
- `meta.field.update` controls field editability. Visible fields without update permission render readonly/disabled and never submit.
- If the backend schema endpoint already applies `meta.field.read`, use schema fields as the visible upper bound and never render fields outside schema.
- If IAM returns `fieldAccess`, consume it only on `meta.field.read/update` permission rows as the field range for that field permission. Ignore `fieldAccess` on `data.record.*` rows for field visibility/editability decisions.

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
- Compute `canCreateRecord` with `data.record.create`.
- Compute `canUpdateRecord` with `data.record.update`.
- Show create when create is allowed. Do not add an editable-field-count condition.
- Show edit when update is allowed. Do not add an editable-field-count condition.
- Show delete only when `data.record.delete` is allowed.
- Build display fields from schema fields that are visible by `meta.field.read`.
- Pass `meta.field.update` editable fields to table/cell-edit column builders.
- Pass visible fields to create/update form builders.
- Mark visible but non-editable fields readonly/disabled in forms.
- Skip required validation for readonly/disabled fields.
- Submit only filtered fields. Do not send unauthorized field values.
- Recheck permission in action handlers before submit/delete/cell commit.

Use schema fields as the structural upper bound. Use `meta.field.read` for display and `meta.field.update` for editing.

## Dictionaries and custom pages

For pages not directly generated from one schema object:

- Map each UI section to the real Make `entityKey`.
- Map UI field names to Make `fieldKey`.
- Gate list/detail with `data.record.read`.
- Gate create/update/delete and custom actions with the correct operation key.
- Gate local field visibility with `meta.field.read`.
- Gate local field editability and cell edits with `meta.field.update`.
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
- `data.record.update` or `data.record.create` is used as field edit permission.
- Create/edit buttons depend on editable field count instead of only `data.record.create/update`.
- Fields without `meta.field.read` are rendered.
- Fields without `meta.field.update` can be edited, validated as required, or submitted.
- Form payloads include fields the user cannot edit.
- Refresh reloads data before refreshing permission.
