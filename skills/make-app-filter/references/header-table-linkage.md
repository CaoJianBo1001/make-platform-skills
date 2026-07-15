# Header Table Linkage

Use this reference when connecting CanvasTable header menus to the package-backed advanced filter.

## Default behavior

When filtering is in scope for a Make record-list page, add both the toolbar advanced filter and the CanvasTable header filter linkage. The menu should include `按该字段筛选` only for package-supported fields. Do not report filtering complete if the toolbar package panel is implemented but the header linkage is missing, or if the header menu exists without the package-backed toolbar panel.

Clicking `按该字段筛选` must:

1. close the header menu
2. call the same toolbar advanced filter controller, usually `controller.openWithField(fieldKey)` or a ref wrapper around it
3. append one draft condition using the clicked field
4. open the same toolbar advanced filter popover
5. wait for the user to fill a value and click `确认`

It must not submit immediately, reload records, or create a separate header-only filter state.

## CanvasTable suffix menu

Use `canvas-table-integration` for exact `suffixRender` API details. The consumer-side pattern is:

- add a header suffix more icon through column `suffixRender`
- default `displayMode` is `hover`
- when this column's menu is open, keep that column suffix icon `always`
- other columns remain `hover`
- after menu closes, restore the icon to `hover`
- refresh header cells after the active menu column changes

The advanced filter package does not implement CanvasTable `suffixRender`.
It also does not render the header filter UI or menu; those are host
responsibilities implemented with `canvas-table-integration`.

## Menu placement and style

Default header menu dimensions and style:

- width: `236px`
- viewport padding: `8px`
- gap below header cell: `2px`
- position: fixed
- padding: `12px`
- border: `1px solid #e5e7eb`
- radius: `6px`
- background: `#fff`
- shadow: `0 8px 24px rgb(15 23 42 / 14%)`

Default content:

```text
field title
按该字段筛选     only when supported
排序
升序  降序       placeholders or real sort if sort is in scope
```

The filter action uses a full-width 30px row with hover background `#f4f7ff` and text `#1677ff`.

## Closing rules

Close the header menu when:

- clicking outside the menu
- selecting `按该字段筛选`
- table scroll changes
- current entity/object changes
- component unmounts

Do not call table-wide refresh or scroll reset just to open the menu. Refresh only header cells if needed to update suffix icon display.

## Field support

Use package `getFilterableFields` or `isAdvancedFilterFieldSupported` after host-specific candidate-source checks.

Default:

- supported fields show the filter action
- unsupported fields still may show sort UI if sorting is in scope
- unsupported fields must not call `openWithField`

The `@qfei-design/make-filter@^0.2.5` baseline supports File, DateRange, and
resolved Lookup fields. Do not special-case these names in the header menu:
always use the same normalized field object and package support API as the
advanced-filter panel. An unresolved Lookup, unknown type, invalid key, or field
with no package operators remains unsupported and must hide `按该字段筛选`.

Always unsupported:

- unknown field types
- invalid field keys

## Tests

Header linkage tests should cover:

- the same filtering feature includes both toolbar `AdvancedFilterPanel` and CanvasTable header `按该字段筛选`
- supported field opens menu and shows `按该字段筛选`
- clicking the action calls `openWithField(fieldKey)` or `onFilterByField(fieldKey)` and closes the menu
- unsupported field hides `按该字段筛选`
- open menu keeps active column suffix icon `always`
- outside click closes menu and restores `hover`
- table scroll closes menu and restores `hover`
- clicking header filter does not reload records before package controller confirmation
- non-target tables do not get header menu triggers when the host only wants this on specific objects
