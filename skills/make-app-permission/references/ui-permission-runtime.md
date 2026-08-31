# UI permission runtime

Use this reference for frontend permission providers, matching, route/action gates, field sets, payloads, and refresh.

## Contents

- Provider and data sources
- Permission model
- Route and operation gates
- Create flow
- Read/edit flow
- Special fields and Lookup
- Refresh generation
- Readiness blockers

## Provider and data sources

Mount identity, permission, permission-aware Schema, then router/pages:

```jsx
<AuthGate>
  <PermissionProvider>
    <SchemaProvider>
      <AppRouter />
    </SchemaProvider>
  </PermissionProvider>
</AuthGate>
```

Use the host API adapter for `/app/principal/permission`; never raw-fetch IAM from UI.

Normalize each entity's permission-trimmed Schema collections independently:

- `fields`: list, detail, filter, edit upper bound;
- `createFields`: create upper bound; missing means `[]`, with no fallback to `fields`;
- `editableFields`: ignored by current runtime edit logic.

## Permission model

Normalize to `{ principal, scope, appResource, permissions }`, deriving `appResource` only from the validated response `scope` rather than trusting an independently supplied value. Before normalizing `permissionKey`, `resource`, `effect`, and `fieldAccess`, apply the deterministic selection table in `permission-boundaries.md`. Ignore only clearly unrelated rows; selected and unclassifiable rows are strict-validation inputs and therefore fail closed when malformed. Ignored rows must never grant or deny App access or block the permission-to-Schema loading flow.

Provide pure helpers:

- `canUseEntityOperation(access, entityKey, permissionKey)`
- `canCreateEntityField(access, entityKey, fieldKey)`
- `canReadEntityField(access, entityKey, fieldKey)`
- `canUpdateEntityField(access, entityKey, fieldKey)`
- `creatableFieldKeysForEntity(access, entityKey, createFields)`
- `visibleFieldsForEntity(access, entityKey, fields)`
- `editableFieldKeysForEntity(access, entityKey, visibleFields)`

Support exact and wildcard permission keys/resources, IAM namespace-wildcard App resources, most-specific allow ranges, same-specificity allow unions, named-over-wildcard field entries, and deny-wins behavior.

Allowed access states:

```text
create:  *, creatable, editable, readonly, partialMask, fullMask
read:    *, editable, readonly, partialMask, fullMask
update:  *, editable
```

An empty most-specific allow `fieldAccess` means no field restriction in that permission dimension. Never include `creatable` in readable or editable states.

An omitted `fieldAccess` property or an empty object is the intentional unrestricted representation. For selected rows, explicit `null`, a non-object, an array, a blank field key, an empty state list, an unknown state, or a state list containing non-strings is malformed IAM data and must fail the whole access snapshot closed. Reject invalid effects, non-three-part permission keys, missing/non-App scopes, arbitrary namespaces, and wildcard tenant/App resources as well; never discard a malformed selected row while keeping sibling allows or normalize malformed selected input into an effective allow. Classify and ignore clearly unrelated rows before this validation; null/primitive envelopes or rows and non-array `permissions` must deny without throwing.

## Route and operation gates

- Validate App entry and dynamic entity membership against permission-aware Schema, and require `meta.entity.read` before exposing an entity in left navigation or entering its dynamic object route. The route itself must return the host forbidden result before it mounts the object page; hiding the sidebar is not a route guard. When a host `ProtectedRoute`/`RouteGuard` is used instead of an explicit forbidden branch, return that guard from the dynamic route and bind it to the resolved current `entityKey`; merely declaring an unrelated guard does not protect the object page.
- Bind fixed routes to an entity and permissionKey.
- Require `data.record.read` before list/detail loading. It only gates record requests and values; it must not gate an entity-authorized navigation entry, table shell, or column headers.
- Require `data.record.create` for create routes, create entry, open handler, and submit.
- Resolve create fields with `meta.field.read`; never read create-field access from `data.record.create` or `meta.field.create`. The operation authorization and field intersection remain separate.
- Require `data.record.update` for edit routes/entry/submit/cell commit.
- Keep delete and bulkUpdate independent.
- Do not use field-count conditions to hide create or normal edit entries.
- Recheck each handler before its protected read or mutation.

If create is allowed but no creatable fields remain, keep the create entry and render a “暂无可新建字段” empty state. Disable save unless the documented business API explicitly supports empty-record creation.

## Entity navigation and table surface

Derive the object surface in three independent steps:

```text
canViewEntity = canUseEntityOperation(access, entityKey, 'meta.entity.read')
visibleFields = visibleFieldsForEntity(access, entityKey, entity.properties.fields ?? [])
canReadRecords = canUseEntityOperation(access, entityKey, 'data.record.read')
sourceRows = recordState.items
tableRows = canReadRecords ? sourceRows : []
```

Render the navigation item and object route only when `canViewEntity` is true and the entity exists in permission-aware Schema. In the dynamic route, evaluate `canViewEntity` after resolving the Schema entity and return the host forbidden result when it is false. Render the table shell and its headers from `visibleFields`, not from `canReadRecords`. Gate the records query, row values, detail open action, pagination, and record-backed table controls with `canReadRecords`.

When `canViewEntity` and `visibleFields` are authorized but `canReadRecords` is false, keep the table mounted with `columns={visibleFields}` and `rows={tableRows}` (or the equivalent CanvasTable API, where `tableRows` is explicitly `[]`). Do not execute `onDataLoad`, do not render cached/stale rows, and show a no-record-access/empty state without removing the headers. On a permission refresh that revokes record read, clear/invalidate the record store that supplies `sourceRows` before the next render or continue deriving `tableRows` from current access; changing only a request's `enabled` flag is insufficient. A record read grant never expands field visibility; a field read grant never authorizes a record request.

## Create flow

Compute create fields only from the create collection and create permission:

```text
createSchemaFields = entity.properties.createFields ?? []
creatableKeys = creatableFieldKeysForEntity(access, entityKey, createSchemaFields)
createFormFields = createSchemaFields
  .filter(field => creatableKeys.has(field.key))
  .filter(supportsCreateInput)
```

Do not require the field to be in visible `fields`, readable, or editable. A create-only invisible field must render and accept a value in create mode, then disappear from list/detail/edit.

Before submit:

1. Use the latest access generation and recheck `data.record.create` for the operation.
2. Re-read latest `createFields` and recompute creatable keys from `meta.field.read`.
3. Validate only authorized, rendered fields, including `validations.isRequired` and type-specific validation.
4. Build an allowlist payload from those fields; never spread all form values.
5. Build relation/Lookup payloads from the same allowlist.
6. Reject DevTools-injected, stale, hidden, or unauthorized values before the request.

Created-record response mapping may use visible `fields`; it must not use visible `fields` to filter the create request data.

## Read/edit flow

Use:

```text
visible = visibleFieldsForEntity(access, entityKey, entity.properties.fields ?? [])
editable = editableFieldKeysForEntity(access, entityKey, visible)
  .filter(isEditCapableField)
```

- Render list, detail, filter, and edit fields only from `visible`.
- Mark visible non-editable form fields readonly/disabled.
- Do not attach cell editors or required validation to non-editable fields.
- Build update payloads from latest visible/editable allowlists.
- Ignore backend `editableFields`; editing remains “visible first, then `meta.field.update`”.
- A create revoke closes create only. An update revoke closes edit only. A `data.record.read` revoke closes detail/edit and stops reads while retaining entity-authorized navigation and headers; it must not close a still-create-authorized create surface. A `meta.entity.read` revoke closes the object route and removes the navigation entry.

## Special fields and Lookup

- Exclude ID and system-managed create/update audit fields from create capability even if malformed input Schema/permission includes them.
- Preserve audit field edit capability when the field is visible, update-authorized, and host-editable.
- Treat the exact type `Make.Field.File` as a host-contract capability, not an implicit permission result. The host adapter must declare which upload contract it implements: (a) persisted-record FileField routes such as `POST .../records/:recordID/files/:fieldKey`, which require an existing record identity and therefore make File create-incapable; or (b) an explicit pre-upload/direct-create contract that returns the backend-approved attachment array without requiring `recordID`, in which case the field may remain create-capable and only that attachment array enters `data[fieldKey]`. Never infer mode (b) merely from `required`, `createFields`, or a File permission. Apply this capability guard after `createFields ∩ meta.field.read` for the documented create-state set. In mode (a), do not render, required-validate, or submit the File field during create. Its read/edit path remains independent and uses visible fields, update permission, an existing record identity, and the host edit-capability guard.
- Treat the exact type `Make.Field.Lookup` as a relation-backed control only when Schema relation metadata and the host relation-write contract both support it; otherwise it is read-only/unsupported for write even if field permission allows it. Load candidates through the host Lookup option route (normally `GET .../lookup-options?sourceEntityKey=&lookupFieldKey=&keyword=&page=&size=`), never through an unrestricted target list.
- Resolve a Lookup source definition from visible `fields` first, then `createFields` only for a create-only source field. Resolve the target entity and display field from visible target `fields` only; never use target `createFields` to bypass read visibility. Candidate values are target `recordID` strings; labels and option objects are presentation only.
- Split ordinary and Lookup values before persistence, then filter both by the latest mode-specific field allowlist. For create, exclude Lookup field keys from ordinary `data`; UI sends `{ data: ordinaryAllowlistedData, relations: { [lookupFieldKey]: recordID | recordID[] | null | [] } }` to `POST .../records`. Service must reject any client-provided raw `data.qfei_relation` or Lookup key hidden in `data`, re-authorize each `relations` key against permission-trimmed `createFields`, validate relation metadata, cardinality, target visibility/existence and exact target `recordID`, then synthesize the Make payload `data.qfei_relation: [{ entityKey, id }]`. For edit, never let UI submit a partial raw `qfei_relation`; send authorized changes as `{ values: { [lookupFieldKey]: recordID | recordID[] | null | [] }, data?: ordinaryAllowlistedData }` to `PATCH .../records/:recordID/lookup-relations`. Service must re-authorize each source field, validate ordinary `data` against the current permission-trimmed visible/update contract, read the exact current source record, fail closed on malformed unrelated relation entries, preserve unrelated relations, and synthesize the complete `qfei_relation`. Reject client-provided raw `qfei_relation`, non-allowlisted fields, invalid cardinality, invisible targets, and missing/mismatched source or target identities. Because the backend `qfei_relation` item contains only `{ entityKey, id }`, relationKey is not encoded; if more than one independently writable relation from the source can point to the same target entity, this generic field-key route is ambiguous and must fail closed unless the host documents and tests a backend contract that disambiguates it.

## Refresh generation

Permission changes are refresh-based, but permission and permission-trimmed Schema must refresh together:

```text
nextAccess = await refreshPermissions()
invalidateSchemaCache()
nextSchema = await refreshSchema()
advanceAccessGeneration(nextAccess, nextSchema)
closeOrRecomputeOpenSurfaces()
refreshDataOnlyIfReadAllowed()
```

An equivalent query-cache/provider design is valid when it guarantees:

- Schema cache identity includes principal/tenant/App or an access generation;
- old permission, Schema, record, candidate, and form async results cannot overwrite the new generation;
- newly granted create/read fields appear on page refresh;
- revoked fields/actions disappear before mutation;
- submission is disabled during access refresh.

Treat `nextAccess` as a candidate until `nextSchema` succeeds. At refresh start, the previous authorization must no longer be usable for protected reads or writes. Publish the new permission and Schema atomically; never expose “new permission + old Schema”. If either refresh fails, remain fail-closed rather than restoring a possibly revoked old generation.

Fail closed when either permission or Schema refresh fails.

## Readiness blockers

- Create form reads `fields` or `editableFields` instead of `createFields`.
- Missing `createFields` falls back to visible fields.
- Create fields depend on `data.record.create` or `meta.field.update`, use `meta.field.create`, omit `createFields`, or treat `creatable` as readable instead of using `meta.field.read` with the documented create-state set.
- Edit consumes `editableFields` or skips visibility.
- Entries are hidden by writable-field count.
- Submit expands raw form values or relation values without a latest allowlist.
- ID/audit fields can be created; ID fields can be edited or enter update payloads; audit edit is accidentally removed.
- Create-only Lookup reads an invisible target field.
- Permission refresh does not invalidate/reload Schema or accepts stale results.
- Direct URL/handler access bypasses operation checks.
