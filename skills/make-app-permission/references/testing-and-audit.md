# Testing and audit

Use this reference before implementation and before reporting permission work complete.

## Service and Schema tests

- Principal permission route, App scope, IAM `/api/make/iam/**`, target header, login forwarding, tenant resolution, errors, and runtime-mode scopes.
- Preserve and normalize `fields` and `createFields` independently across Service, shared types, and UI adapters.
- Missing/null/invalid `createFields` becomes empty and never falls back to `fields`.
- Presence of `editableFields` does not change edit behavior.
- Permission-trimmed Schema cache/in-flight work is isolated by principal, tenant, App, and access generation.
- Permission refresh invalidates or reloads Schema before protected page data.
- Lookup source resolution uses visible `fields`, then `createFields`; target display fields remain visible-only.

## Permission model tests

Cover exact/wildcard/parent/App/entity resources, IAM namespace wildcard, canonical/namespace-alias equal specificity, most-specific allow, same-specificity allow union, cross-row named-over-wildcard fields, and deny wins. Prove that a named entity grant does not leak to another entity. Add adversarial rows for invalid effects, non-three-part permission keys, missing/non-App scope, an independently supplied App resource that conflicts with scope, arbitrary namespace, wildcard tenant/App resources, explicit `null` fieldAccess, invalid containers, blank field keys, empty state lists, unknown states, and mixed non-string state lists. A malformed row poisons the whole access snapshot; do not discard it while preserving sibling allows. Null/primitive payloads or rows and non-array `permissions` must return a denied snapshot without throwing.

Required field cases:

| Case | Expected |
| --- | --- |
| creatable only | create yes; read/update no |
| readonly only | read yes; create/update no |
| editable with read | read/update yes; create no |
| `data.record.create` with no `meta.field.create` | operation yes; field no |
| `meta.field.create` with no `data.record.create` | field yes; operation no |
| `data.record.create` deny + `meta.field.create` allow | operation no; field yes |
| `data.record.create` allow + `meta.field.create` deny | operation yes; field no |
| `* = creatable` on create | all `createFields` allowed |
| expanded IAM runtime `meta.field.create` wildcard creatable + named hidden | exception field denied |
| same-specificity named allow + named hidden | operation yes; named field denied |
| same-specificity unrestricted allow + named hidden | operation yes; named field denied; unnamed field allowed |
| empty most-specific allow fieldAccess | unrestricted in that permission dimension |
| malformed fieldAccess container/value | explicit null, non-object/array, empty/unknown/mixed states all fail closed |
| valid string state list | preserve every state for create/read/update evaluation |
| `meta.field.read` access=creatable | not readable |
| `data.record.update.fieldAccess` | no read/edit field grant |
| mask states | read only |

## Page and payload tests

- A create-only invisible field renders and submits in create mode only.
- A visible/editable but non-creatable field is absent from create.
- Create operation with zero fields keeps the entry, shows “暂无可新建字段”, and prevents unsupported empty submission.
- Create entry/handler depends only on current `data.record.create`; create field sets depend only on current `meta.field.create`.
- Edit remains visible-first then `meta.field.update`; `editableFields` is ignored.
- ID/audit fields are absent from create; ID fields are also absent from edit forms, cell editors, and update payloads; audit fields remain editable when visible/update-authorized.
- Persisted-record-only `Make.Field.File` is absent from create render/required/payload; an explicitly implemented pre-upload/direct-create contract may include only its backend-approved attachment array without a `recordID`. Read/edit behavior stays independent and follows visible fields, update permission, and the host edit capability.
- `Make.Field.Lookup` candidate requests use the dedicated option route without exposing invisible target fields. Create sends `{ data, relations }` and Service validates `relations` before synthesizing `qfei_relation`; edit sends authorized `values` to the snapshot-preserving `lookup-relations` route. Neither path accepts a client-supplied partial raw `qfei_relation` or a Lookup key hidden in ordinary `data`.
- `field.validations.isRequired` and type validation apply only to rendered authorized fields; `required` is a derived UI-control prop, not an alternate Schema metadata key.
- Submit recomputes the current allowlist and removes DevTools-injected/stale/unauthorized values.
- Permission or Schema failure fails closed.

## Refresh tests

- Refresh order is permission, Schema invalidation/reload, surface recomputation, then data if read remains allowed.
- New permission is not published before its Schema succeeds; refresh failure does not restore the old authorization generation.
- New create/read fields appear after page refresh without browser reload.
- Revoked create/update/read closes only affected surfaces; read revoke does not close a still-create-authorized create surface.
- Old permission/Schema/record/candidate/form responses cannot overwrite the current generation.
- Submits are blocked while the access generation changes.

## Audit

Run:

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
```

The audit should fail on missing create permission helpers, create-field helpers tied to `data.record.create` instead of `meta.field.create`, missing/overwritten `createFields`, `createFields ?? fields`, runtime `editableFields` use, create fields built from visible/editable sets, unfiltered create payloads, operation entries tied to field count, permission-only refresh without Schema refresh/invalidation, and obvious field-access state-array coercion through `String(...)`, text helpers, template interpolation, `.toString()`, or `.join()`.

The audit is heuristic. Its stringification rule is a targeted defense against known bad shapes, not complete data-flow proof. It must reject coercion that affects a normalization result or permission branch, including direct `if`/`switch`/loop conditions. It must lexically ignore comments and string literals and must not fail on diagnostic-only logging inside a named normalization helper, including structured log arguments, `fieldAccess`-specific parameter names, and semicolonless code where an earlier return ends through automatic semicolon insertion. Parenthesized, bracketed, or operator-continued returns remain result-affecting and must still fail. Host tests must prove permission matching, actual form field sets, payloads, Lookup target visibility, generation safety, and server-side enforcement.

## Executable behavior conformance

Static source signals cannot prove that permission helpers deny missing access. A helper set that always returns `true` is invalid even if every required function name exists. Create a thin adapter that imports the production helpers and exports:

```text
normalizeAccess
canUseEntityOperation
canCreateEntityField
canReadEntityField
canUpdateEntityField
isCreateCapableField
isEditCapableField
```

`isEditCapableField` is the production host-capability guard used before edit rendering, cell-editor attachment, and update payload construction. It must reject both ID types without excluding audit keys by name.

Run:

```bash
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <adapter-module>
```

For TypeScript adapters, invoke the command with the project's existing TypeScript runner. The adapter must delegate to production code rather than duplicate permission logic. The suite proves missing operation denial, named-entity isolation, rejection of non-string/blank/wildcard requested identifiers, the fixed `* < App < entity/* < entity/exact` resource order, malformed permission-envelope and explicit App-resource rejection, valid state-list preservation, deny-wins, independent create/read/update fields, permissionKey-specific access values, wildcard exceptions, and the canonical create/edit system-field exclusions.

## Host gate integration

- Keep the audit and conformance runner project-local, or consume them from a versioned build dependency. Do not make CI depend on a sibling checkout or `~/.agents/skills`.
- Make the host's default test, CI workflow, or publish verification invoke both checks. A change record stating that two projects passed once is acceptance evidence, not a continuing gate.
- Add a host contract test that asserts the gate commands still exist and that the vendored/current runners contain the multi-state-array audit and behavior cases.
- Treat source-to-installed-Skill comparison as a local install/release verification. Generic CI must not require a developer home-directory copy.

For that local install/release verification, run the directory-level checker with explicit paths:

```bash
node skills/make-app-permission/scripts/check-installed-skill-sync.mjs \
  skills/make-app-permission <installed-skill-dir>
```

It must fail on source-only, installed-only, or content-mismatch files. Do not replace this complete comparison with a hand-maintained file list.

## Completion rule

Do not report complete until:

- new/changed tests pass;
- the permission audit passes or every warning is explicitly resolved;
- the executable permission conformance suite passes against production helpers;
- the host's default test, CI, or publish gate invokes both permission checks;
- Skill metadata/quick validation and cross-Skill contract tests pass;
- a real reference project passes the audit without changing that project;
- source and installed Skill copies are synchronized;
- complex revisions have fresh-agent forward-test evidence when available.
