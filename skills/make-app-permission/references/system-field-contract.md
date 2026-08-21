# System field contract

Use this reference whenever create-capable or edit-capable fields are derived. Keep the rule exact and testable; do not guess system fields from display names or loose substrings.

## Create exclusions

The UI create-capability guard must reject these ID field types:

```text
Make.Field.ID
IDField
```

It must also reject these current platform-managed audit keys:

```text
create_user
create_time
update_user
update_time
qfei_create_user
qfei_create_time
qfei_update_user
qfei_update_time
```

Apply this guard after the `createFields ∩ meta.field.create.fieldAccess` intersection. The backend remains the final authority and should normally omit these fields from `createFields`; the UI guard is defense in depth for malformed or stale Schema responses.

Do not exclude a business field merely because its key contains `create`, `update`, `user`, or `time`. When the platform adds a real system type or audit key, update this reference, the host guard, and the conformance suite together.

## Edit compatibility

Normal edit keeps the existing rule:

- exclude ID fields from edit capability;
- do not automatically exclude the audit keys above;
- an audit field is editable only when it is present in visible `fields`, allowed by `meta.field.update`, and supported by the host editor.

This preserves “审计字段不可新建但仍保留既有可编辑能力”. Do not reuse the create-capability guard as the edit-capability guard.

The host must expose an `isEditCapableField` production guard to the executable conformance adapter. Apply it consistently before rendering an editable form control, attaching a cell editor, validating an editable field, or including a field in an update payload. The guard rejects `Make.Field.ID` and `IDField`, but it must not reject the audit keys merely because they are audit keys.

## Required checks

- Every ID type and audit key above is absent from create.
- An ordinary field remains create-capable when Schema and permission allow it.
- A similarly named business field is not rejected by substring matching.
- Both ID types are absent from edit forms, cell editors, validation, and update payloads even if read/update permission allows them.
- A visible/update-authorized audit field retains its existing edit capability.
