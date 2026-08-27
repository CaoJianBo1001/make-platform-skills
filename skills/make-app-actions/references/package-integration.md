# Package integration

## Pre-flight

Locate the host UI package and lockfile. Identify its component library before
choosing a UI adapter, and inspect package `engines` plus peer dependencies. For
a Make CanvasTable record list, ensure both packages are installed:

```text
@qfei-design/make-app-actions@^0.3.1
@qfei-design/canvas-table@^1.3.1
```

Use the host package manager. Do not change package managers or create a second
lockfile.

The published package exposes headless core, generic React action-bar and
batch-modal primitives, a CanvasTable adapter, and Ant Design action-bar/modal
adapters:

- Ant Design host: verify compatible React, AntD, and icon peer versions, then
  use the AntD adapter.
- Non-AntD host such as Arco or shadcn/ui: use the generic React action bar and
  `RecordBatchEditModal`. Inject the host design system through
  `MakeAppActionComponents` and `MakeAppBatchEditComponents`. Do not mix AntD
  into the host and do not copy either package modal implementation.

Read the resolved package and its documentation dynamically:

1. Read each `package.json` from the installed packages and verify
   `@qfei-design/make-app-actions` satisfies `^0.3.1` before interpreting its
   `package.ai.json` as potentially stale guidance.
2. Verify `@qfei-design/canvas-table` satisfies `^1.3.1`. CanvasTable 1.3.1 is
   the first published contract where business row colors remain above
   selection/hover and `clearRowColors` restores the underlying row background.
3. Read `package.ai.json`, parse `package.ai.json.readOrder`, and verify every
   declared file exists relative to the installed package.
4. Read the remaining entries in order and use public exports only.

The currently published `0.3.1` package contains a stale `package.ai.json`
minimum or install example for `^0.2.0`, `^0.2.1`, or `^0.3.0`. When the actual
installed `package.json` resolves within `^0.3.1`, ignore only those stale version
and install fields, do not downgrade, report the package-documentation
follow-up, and continue using the manifest's read order and the installed public
API. If the resolved package version falls outside `^0.3.1`, install a compatible
release and reread its public contract before integration.

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

Non-AntD React hosts use the public generic entries:

```ts
import {
  RecordBatchEditModal,
  RecordSelectionActionBar,
  type MakeAppActionComponents,
  type MakeAppBatchEditComponents,
} from "@qfei-design/make-app-actions/react";
```

In `0.3.1`, `AntdRecordBatchEditModal` calls
`renderValueControl(field, control)` where `control.disabled` represents the
current submit lock. Forward it to the actual field control. The adapter keeps
one-argument callbacks compatible, but new integrations must consume the second
argument rather than relying on element cloning.

Provide `MakeAppBatchEditComponents` with the host's `Modal`, `FieldSelect`, and
`ModeControl`. The package owns modal state, validation, safe errors, and submit
locking. The host owns design-system components and provides actual Make field
controls through `renderValueControl(field, control)`. Forward `control.value`,
`control.onChange`, `control.disabled`, `control.invalid`, and
`control.ariaDescribedBy` to the real host input. Adapt props at this boundary
instead of changing package state behavior or importing AntD.

The generic component contracts do not define an AntD-style popup-container
prop. Host wrappers must use the installed design system's own public overlay or
portal API and may close over a host-owned overlay target. Do not add
`getPopupContainer` or another library-specific prop to the package-neutral
interfaces.

Import `styles.css` once in the host UI entry. Do not import it per page or add
global AntD overrides for package internals.

## Ownership boundary

The package owns:

- single-versus-multiple action mode and scheme-two empty state
- local action permission matching and selected-row validation
- batch-edit field capability filtering and clear-value normalization
- generic React and AntD action bars, plus generic and AntD batch-edit modal shells
- Canvas public selection snapshot normalization
- explicit-versus-select-all intent and explicit batch-limit helpers

The host owns:

- principal permission loading/cache and field-access projection
- immutable operation snapshot and query context
- Service precheck, mutation, error mapping, and request logging
- field-specific editors and candidate loading
- confirmation, toast, row highlighting, stale guards, and list refresh

Do not copy or hand-write package action-state reducers, permission matchers,
batch-field filters, Canvas selection adapters, action bars, or generic/AntD
batch modals in the host. Do not add network calls to the package. A host-specific
wrapper may translate its component props into the public generic component
contracts, but must leave modal state and validation in the package.

`runRecordBatchMutation` remains a public optional helper for non-Make hosts that
have no bulk endpoint. It is not the Make batch-edit execution path.
