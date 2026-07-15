# Package Integration

Use this reference when wiring `@qfei-design/make-filter` into a Make App host.

## Package version baseline

Use `@qfei-design/make-filter@^0.2.5` for new Make advanced-filter integrations. This is the validated baseline for Lookup filtering with source-field CEL expressions and the package `AdvancedFilterPanel` header/body/footer structure used by BizFinancePoc-style fixed panels. If the host has an older package version, upgrade before implementing the advanced filter instead of relying on older package behavior.

## Public package surface

Use only public package entrypoints:

- `@qfei-design/make-filter`
- `@qfei-design/make-filter/react`
- `@qfei-design/make-filter/adapters/antd`
- `@qfei-design/make-filter/styles.css`

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
- optional Ant Design adapter
- internal panel stylesheet

## Host provides

- normalized Make field metadata
- resolved Lookup relation and target-field metadata from the complete runtime schema
- applied advanced-filter state
- toolbar trigger placement
- Popover, Modal, Drawer, or other mounting container
- container width, max height, and scrolling
- host CSS for the fixed panel container and `.advanced-filter__body { overflow-y: auto; }`
- candidate APIs for users and departments
- Service request adapter and record reload timing
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
import type { AdvancedFilterField } from "@qfei-design/make-filter";

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
import { compileListFilter } from "@qfei-design/make-filter";
import {
  AdvancedFilterPanel,
  useAdvancedFilterController,
} from "@qfei-design/make-filter/react";
import { createAntdFilterComponents } from "@qfei-design/make-filter/adapters/antd";
import "@qfei-design/make-filter/styles.css";
```

Use `createAntdFilterComponents` only when the host uses Ant Design. For other component libraries, implement `AdvancedFilterComponents` with host controls instead of adding Ant Design.

## Minimal host wrapper

The package does not render the trigger or overlay:

```tsx
const components = createAntdFilterComponents();
const [open, setOpen] = useState(false);
const controller = useAdvancedFilterController({
  fields: filterableFields,
  value: appliedGroup,
  onChange: onApplyGroup,
});

function handleOpenChange(nextOpen) {
  if (nextOpen) {
    controller.beginDraft();
    setOpen(true);
    return;
  }
  controller.resetDraft();
  setOpen(false);
}

function handleConfirm() {
  const validation = controller.confirm();
  if (validation.valid) setOpen(false);
}

<Popover
  open={open}
  trigger="click"
  placement="bottomLeft"
  content={
    <div className="advanced-filter-popover">
      <AdvancedFilterPanel
        candidateSources={candidateSources}
        components={components}
        fields={filterableFields}
        value={controller.draftValue}
        validationErrors={controller.validationErrors}
        onChange={controller.setDraftValue}
        onClear={controller.clearDraft}
        onConfirm={handleConfirm}
      />
    </div>
  }
  onOpenChange={handleOpenChange}
/>
```

Host CSS should size only the outer container, for example width, max-height, and overflow. Do not duplicate package panel internals in host CSS.

For BizFinancePoc-style fixed panels, host CSS must clip the outer wrapper and make the package body the only scroll region:

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

When migrating an older project, a small local shim may preserve old function names while delegating to package exports. The shim must not contain copied operator, validation, compiler, parser, or panel logic. Add a test or source check that imports from `@qfei-design/make-filter`.

## Out of scope for the package

- Popover, Modal, Drawer, or scroll container rendering
- toolbar layout
- Service route implementation
- CanvasTable header filter UI or menu behavior
- CanvasTable `suffixRender` implementation
- authentication/session handling
- package-manager or deployment policy in host apps
- saved views or saved filter persistence
- local filtering of already loaded Make record rows
