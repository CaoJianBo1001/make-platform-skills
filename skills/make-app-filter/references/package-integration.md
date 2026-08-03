# Package Integration

Use this reference when wiring `@qfei-design/make-app-filter` into a Make App host.

## Package version baseline

Use `@qfei-design/make-app-filter@^1.0.0` for new Make advanced-filter integrations. This is the validated baseline for Lookup filtering with source-field CEL expressions and the package `AdvancedFilterPanel` fixed header/body/footer structure. If the host has an older package version, upgrade before implementing the advanced filter instead of relying on older package behavior.

## Public package surface

Use only public package entrypoints:

- `@qfei-design/make-app-filter`
- `@qfei-design/make-app-filter/react`
- `@qfei-design/make-app-filter/styles.css`

Never import from `src`, `dist`, or package-internal files.

## Package provides

- Filter IR helpers
- Make field operator matrix
- value defaults
- validation and active-condition summary
- CEL compile and parse
- `AdvancedFilterPanel`
- `useAdvancedFilterController`
- candidate source props
- `AdvancedFilterComponents` component contract for host controls
- internal panel stylesheet

## Host provides

- normalized Make field metadata
- resolved Lookup relation and target-field metadata from the complete runtime schema
- applied advanced-filter state
- toolbar trigger placement
- shadcn `Popover`, `Sheet`, `Dialog`, or other mounting container
- container width, max height, and scrolling
- host CSS for the fixed panel container and `.advanced-filter__body { overflow-y: auto; }`
- shadcn/ui `AdvancedFilterComponents` adapter using host-controlled controls
- candidate APIs for users and departments
- Service request adapter and record reload timing
- permission-aware `{ enabled, entityKey, generation }` Preset context
- shared request-ID-based pending state for concurrent filter/sort saves
- CanvasTable header filter UI/menu and `openWithField` linkage
- optional URL/deep-link encoding and parsing policy

## Integrated Make App baseline

In Make record-list pages, any filtering request is one integrated feature:

- toolbar advanced filter uses this package
- header `按该字段筛选` UI/menu is implemented by the host through CanvasTable
- header action calls the same package controller, usually `openWithField(fieldKey)`
- both paths commit through the same advanced-filter draft and Service `filter.expression`

Do not ship only the toolbar package panel or only the table header filter menu.

## Lookup schema handoff

For every `Make.Field.Lookup`, the host must resolve the source field's
`relationKey`, select the opposite Entity from the Relation `from` / `to` ends,
and find `targetFieldKey` in that Entity. Pass the source Lookup field key plus
the resolved target field metadata to the package. If any part cannot be
resolved, leave the field unsupported instead of guessing from record values.

Pass the same normalized fields to `AdvancedFilterPanel`, `compileListFilter`,
validation, search, and `parseCelToAdvancedFilter`. Filter IR and CEL expressions
must use the source Lookup field key. The target field type controls only the
operator set, value editor, value normalization, and validation.

Normalize a resolved Lookup into the public package shape:

```ts
import type { AdvancedFilterField } from "@qfei-design/make-app-filter";

const normalizedLookupField = {
  key: sourceLookupField.key,
  name: sourceLookupField.name,
  type: "Make.Field.Lookup",
  properties: sourceLookupField.properties,
  meta: sourceLookupField.meta,
  lookup: {
    relationKey: resolvedRelation.key,
    targetField: {
      key: resolvedTargetField.key,
      name: resolvedTargetField.name,
      type: resolvedTargetField.type,
      properties: resolvedTargetField.properties,
      meta: resolvedTargetField.meta,
    },
  },
} satisfies AdvancedFilterField;
```

Do not replace the top-level `key` with the target field key. Do not pass another
Lookup as `targetField`; unresolved and nested Lookup fields remain unsupported.

## Default imports

```tsx
import {
  cloneFilterGroup,
  compileListFilter,
} from "@qfei-design/make-app-filter";
import {
  AdvancedFilterPanel,
  type AdvancedFilterComponents,
  useAdvancedFilterController,
} from "@qfei-design/make-app-filter/react";
import "@qfei-design/make-app-filter/styles.css";
```

Build the `AdvancedFilterComponents` value from shadcn/ui controls or project-local shadcn-compatible adapters. If the installed package exposes only a legacy visual adapter and no neutral component adapter, treat the integration as blocked until the shared package is upgraded or fixed; do not add the legacy UI library just to render this panel.

## Minimal host wrapper

The package does not render the trigger or overlay:

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function PermissionAwareFilterHost({ presetContext, ...props }) {
  if (!presetContext.enabled) return null;

  const resetKey = presetContext.generation;
  return <AdvancedFilterPopover key={resetKey} {...props} />;
}

function AdvancedFilterPopover({
  appliedGroup,
  candidateSources,
  components,
  filterableFields,
  onApplyError,
  onApplyGroup,
  onPersistError,
  persistFilter,
  renderTrigger,
}) {
  const filterComponents = components satisfies AdvancedFilterComponents;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeRef = useRef(true);
  const saveRequestRef = useRef<symbol | null>(null);

  useLayoutEffect(
    () => () => {
      activeRef.current = false;
      saveRequestRef.current = null;
    },
    [],
  );

  const controller = useAdvancedFilterController({
    fields: filterableFields,
    value: appliedGroup,
  });

  function handleOpenChange(nextOpen) {
    if (saveRequestRef.current) return;
    if (nextOpen) {
      controller.beginDraft();
      setOpen(true);
      return;
    }
    controller.resetDraft();
    setOpen(false);
  }

  function finishSaveRequest(requestId) {
    if (!activeRef.current || saveRequestRef.current !== requestId) return;
    saveRequestRef.current = null;
    setSaving(false);
  }

  async function handleConfirm() {
    if (saveRequestRef.current) return;
    const validation = controller.validate();
    if (!validation.valid) return;

    const nextValue = cloneFilterGroup(controller.draftValue);
    const requestId = Symbol("filter-preset-save");
    saveRequestRef.current = requestId;
    setSaving(true);

    try {
      await persistFilter(nextValue, requestId);
    } catch (error) {
      if (activeRef.current && saveRequestRef.current === requestId) {
        try {
          onPersistError(error);
        } finally {
          finishSaveRequest(requestId);
        }
      }
      return;
    }

    if (!activeRef.current || saveRequestRef.current !== requestId) return;
    try {
      onApplyGroup(nextValue);
      setOpen(false);
    } catch (error) {
      onApplyError(error);
    } finally {
      finishSaveRequest(requestId);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{renderTrigger({ disabled: saving })}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="advanced-filter-popover p-0"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <AdvancedFilterPanel
          candidateSources={candidateSources}
          components={filterComponents}
          fields={filterableFields}
          value={controller.draftValue}
          validationErrors={controller.validationErrors}
          onChange={controller.setDraftValue}
          onClear={controller.clearDraft}
          onConfirm={() => void handleConfirm()}
        />
      </PopoverContent>
    </Popover>
  );
}
```

Host CSS should size only the outer container, for example width, max-height, and overflow. Do not duplicate package panel internals in host CSS.

`persistFilter(nextValue, requestId)` only PATCHes the Preset through the shared
host Preset coordinator. That coordinator registers every filter/sort request ID,
removes only the request that settled, and owns shared pending/error state. The
panel-local `saveRequestRef` only prevents duplicate filter confirmation.

`onApplyGroup` synchronously replaces applied state after success; records reload
from an effect/query key derived from permission-aware object context plus
`appliedGroup`. Do not request records inside `persistFilter`.
`onPersistError` handles only PATCH failures; `onApplyError` separately owns
synchronous applied-state callback failures after persistence has succeeded.

The parent increments `presetContext.generation` whenever entity or
permission-enabled state changes and uses that stable primitive as `resetKey`.
The keyed remount resets package draft state after the context transition has
committed. The layout-effect cleanup marks old async handlers inactive; no
request-generation ref is mutated during render. Old success and failure results
must not mutate the new context.

If `parseCelToAdvancedFilter` returns `unsupported`, keep the raw CEL expression
in backend requests, render the trigger as active, and show a visible compatibility
warning. Replace or clear it only after explicit confirmation saves successfully.

For fixed three-region panels, host CSS must clip the outer wrapper and make the package body the only scroll region:

```css
.advanced-filter-popover {
  max-height: min(560px, calc(100vh - 160px));
  overflow: hidden;
}

.advanced-filter-popover .advanced-filter__body {
  overflow-y: auto;
}
```

## Compatibility shims

When migrating an older project, a small local shim may preserve old function names while delegating to package exports. The shim must not contain copied operator, validation, compiler, parser, or panel logic. Add a test or source check that imports from `@qfei-design/make-app-filter`.

## Out of scope for the package

- shadcn `Popover`, `Sheet`, `Dialog`, or scroll container rendering
- toolbar layout
- Service route implementation
- CanvasTable header filter UI or menu behavior
- CanvasTable `suffixRender` implementation
- authentication/session handling
- package-manager or deployment policy in host apps
- saved views or saved filter persistence
- local filtering of already loaded Make record rows
