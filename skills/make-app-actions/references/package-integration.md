# Package integration

## Pre-flight

Locate the host UI package and lockfile. Identify its component library before
choosing a UI adapter, and inspect package `engines` plus peer dependencies. For
a Make CanvasTable record list, ensure both packages are installed:

```text
@qfei-design/make-app-actions@^0.2.1
@qfei-design/canvas-table@^1.3.0
```

Use the host package manager. Do not change package managers or create a second
lockfile.

The published package exposes headless core, a generic React action bar, a
CanvasTable adapter, and an Ant Design action bar/modal adapter. It does not
currently publish Arco or shadcn/ui batch-modal adapters:

- Ant Design host: verify compatible React, AntD, and icon peer versions, then
  use the AntD adapter.
- Non-AntD host such as Arco or shadcn/ui: use core and Canvas normalization only
  where useful. Do not mix AntD into the host and do not copy the AntD modal.
  Missing a matching public batch-modal adapter is a readiness blocker; report
  the dependency and do not claim the full action workflow is complete. Do not
  expose a batch-edit action that cannot open a supported modal.

Read package documentation dynamically:

1. Read `node_modules/@qfei-design/make-app-actions/package.ai.json`.
2. Parse `package.ai.json.readOrder`.
3. Resolve each entry relative to the installed package and verify it exists.
4. Read the remaining entries in order.

This Skill's `^0.2.1` minimum is authoritative. If an installed or cached
`package.ai.json` manifest still contains a lower `^0.2.0` install example, treat
that field as stale, do not downgrade, and report the package-documentation
follow-up. Continue using the installed `0.2.1+` public exports and read order.

When working inside the package repository, use the same procedure relative to
the repository root. Do not hardcode unpublished `src`, `dist`, `docs`, or
example paths.

## Public entries

Use the package entries declared by the installed documentation. These imports
are common to every supported host:

```ts
import {
  isRecordSelectionIntentResolved,
  resolveBatchEditClearValue,
  resolveBatchEditableFields,
  resolveRecordSelectionActionState,
  validateRecordBatchEditSelectionLimit,
  validateRecordSelectionAction,
} from "@qfei-design/make-app-actions";
import {
  resolveCanvasSelectedRecordSnapshot,
} from "@qfei-design/make-app-actions/adapters/canvas-table";
import "@qfei-design/make-app-actions/styles.css";
```

Ant Design hosts additionally use:

```ts
import {
  AntdRecordBatchEditModal,
  AntdRecordSelectionActionBar,
} from "@qfei-design/make-app-actions/adapters/antd";
```

The generic action bar is available to non-AntD React hosts through
`@qfei-design/make-app-actions/react`, but the package has no generic batch-modal
export. Do not infer an unpublished adapter from source files.

Import `styles.css` once in the host UI entry. Do not import it per page or add
global AntD overrides for package internals.

## Ownership boundary

The package owns:

- single-versus-multiple action mode and scheme-two empty state
- local action permission matching and selected-row validation
- batch-edit field capability filtering and clear-value normalization
- generic React and AntD action bars, plus the AntD batch-edit modal shell
- Canvas public selection snapshot normalization
- explicit-versus-select-all intent and explicit batch-limit helpers

The host owns:

- principal permission loading/cache and field-access projection
- immutable operation snapshot and query context
- Service precheck, mutation, error mapping, and request logging
- field-specific editors and candidate loading
- confirmation, toast, row highlighting, stale guards, and list refresh

Do not copy or hand-write package action-state reducers, permission matchers,
batch-field filters, Canvas selection adapters, action bars, or the AntD batch
modal in the host. Do not add network calls to the package. When another design
system needs a reusable modal, add and publish the matching package adapter
before marking the standard workflow ready.

`runRecordBatchMutation` remains a public optional helper for non-Make hosts that
have no bulk endpoint. It is not the Make batch-edit execution path.
