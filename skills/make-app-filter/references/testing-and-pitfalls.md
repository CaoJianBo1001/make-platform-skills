# Testing and Pitfalls

Use this reference before finishing package-backed advanced filter work.

For search-only `filter.expression` use, verify that the host calls
`compileListFilter({ fields, searchText })` and performs no filter Preset GET/PATCH,
hydration, controller/panel mount or mobile panel-layout gate. The first records
query must not wait for a filter Preset; a sibling sort/group Preset load, when
independently required, must not apply a hidden saved filter expression.

The panel, operator, UI, Preset and header checks below apply only to advanced-filter mode. Search-only needs the compiler, Service payload and list-access checks, but must not be forced through panel or Preset checks. Desktop/tablet advanced filtering must test both toolbar and header linkage. Phone advanced filtering must test the
toolbar panel in a mobile-safe sheet without CanvasTable or header linkage,
including hidden instances. Compiler, permission-aware Preset and draft/confirm
tests apply to both desktop/tablet and phone presentations of advanced filtering; phone does not inherit desktop Popover placement or
refresh-button expectations.

At 390px and 767px on a real phone View, open the filter trigger and verify the package panel uses `layout="mobile"` inside a host Sheet, not a Popover. Confirm the sheet fits the viewport and safe area, field/operator/value controls do not overflow horizontally, the condition body scrolls without hiding header/footer actions, keyboard and nested groups remain usable, cancel discards draft, and confirm persists before applying. Also verify the phone toolbar has no separate refresh button/icon; pull-to-refresh preserves the applied filter and current search. Desktop/tablet Popover and toolbar refresh remain available.

## Required tests or deterministic checks

Package source:

- `apps/ui/package.json` depends on `@qfei-design/make-app-filter@^1.0.0` or newer
- advanced-filter UI entry imports `@qfei-design/make-app-filter/styles.css`; search-only compiler use does not require panel styles
- local advanced-filter shim, if any, imports from `@qfei-design/make-app-filter`
- host code does not contain copied Filter IR types, operator matrix, CEL compiler/parser, validator, or `AdvancedFilterPanel` clone

Filter model and operators:

- default field chooses the package first supported operator
- field change resets operator and value through package helpers
- unsupported fields are excluded
- single select supports package operators including `in`
- multi select/user/department expose collection and empty operators
- DateRange, File, and Lookup follow package public support; if backend docs support them but the installed package does not, the UI hides them and reports the mismatch instead of compiling host-only CEL
- invalid field keys and unknown types are skipped

Compiler integration:

- host code calls package `compileListFilter` for search-only, advanced-only, and combined search/advanced-filter cases
- search-only uses `compileListFilter({ fields, searchText })` with no filter Preset GET/PATCH, saved-filter hydration, panel/controller or mobile layout gate
- the returned filter object reaches Service unchanged, without host-side DNF conversion, expression rewriting, or a local serializer
- representative scalar, collection, DateRange, File, and resolved Lookup conditions pass through the package compiler path; exact CEL syntax stays covered by package tests
- The Lookup source field key is used in Filter IR and CEL expressions; resolved target-field metadata only selects operators, values, and validation
- Lookup expression echo passes the same resolved field metadata to `parseCelToAdvancedFilter`
- system variables are emitted only as right-hand values
- empty condition rows do not compile
- invalid field identifiers do not compile
- search group merges with advanced filter through `AND`
- `compileListFilter` returns `undefined` for no valid expression

UI behavior:

- desktop/tablet toolbar buttons remain in order: search, `筛选`, `刷新`
- phone `layout="mobile"` shows package defaults `设置筛选条件` and `完成` inside the host Sheet; its condition cards must not inherit the desktop connected-row CSS or Popover dimensions
- opening with no conditions inserts one default draft condition through `beginDraft`
- package panel renders inside a host-owned container
- desktop/tablet host Popover uses max height rather than fixed initial height; phone Sheet uses viewport/safe-area bounds
- panel follows the fixed three-region layout: header top, scrollable condition body middle, footer bottom
- header and footer remain visible while conditions scroll; they must not scroll with the condition body
- on desktop/tablet, header remains visible while the body scrolls, with `筛选` on the left and `清空所有` on the right
- on desktop/tablet, footer remains visible while the body scrolls, with `+ 添加条件` and `+ 添加条件组` on the left and `确认` on the right
- only the condition body scrolls; neither the whole Popover nor the whole phone Sheet becomes one full-panel scroll surface
- edits do not reload records before the active mode's confirm action
- desktop/tablet `确认` or phone `完成` commits and closes only when validation and Preset persistence pass
- validation failure marks invalid controls and keeps the desktop Popover or phone Sheet open
- required value editors are marked invalid for text, number, select, multi-select, date/date-time, user, and department
- after failed confirmation, typing or selecting a valid value clears that control's error state immediately while other invalid rows stay marked
- closing the desktop Popover or phone Sheet without confirmation discards unconfirmed draft changes
- clearing the draft clears applied filters only after successful confirmation
- active trigger shows `已筛选 N 个条件`
- unsupported saved CEL keeps a visibly active trigger and warning while the raw expression remains active on the backend

Preset lifecycle (advanced-filter mode only):

- the first records request waits for runtime fields and Preset hydration
- save success updates applied state before the records query reacts
- save failure preserves the previous applied value and current draft
- concurrent sparse filter and sort saves keep their shared saving state until all requests settle
- an old `A -> B -> A` load/save result is ignored by a monotonic request generation even though the final entity key matches

Header linkage (desktop/tablet only):

- header suffix menu opens from the more icon
- unsupported fields hide `按该字段筛选`
- clicking `按该字段筛选` calls package controller `openWithField(fieldKey)` or a wrapper
- clicking header filter does not reload records before advanced filter confirmation
- outside click, table scroll, object switch, and unmount close the menu
- active header suffix icon is `always` while its menu is open

Service and integration:

- UI sends `filter: { expression }`
- empty expression omits `filter`
- Service omits or normalizes missing/null/blank `filter.expression` according to the documented route contract, and rejects malformed filter query input with 400
- Service passes `filter.expression` to Make Data API
- Service still handles legacy payloads only when the host project already needs compatibility
- URL/deep-link `advancedFilter` echoes into package panel when valid
- unsupported deep-link CEL remains backend-only fallback instead of fake UI rows

## Common regressions

- copying the old local advanced-filter implementation instead of using `@qfei-design/make-app-filter`
- forgetting package `styles.css` in advanced-filter mode
- submitting on every keystroke instead of waiting for desktop/tablet `确认` or phone `完成`
- closing the desktop Popover or phone Sheet but keeping unconfirmed draft changes
- sending `filter: []`, `{}`, `{ expression: "" }`, blank raw strings, or old object-array DSL when no valid condition exists
- hiding DateRange, File, or Lookup because old docs said backend did not support them, without checking current package and backend capabilities
- showing File, DateRange, Lookup, invalid keys, or unknown fields in advanced filter without package public support
- using display labels instead of ids for user/department filters
- locally filtering already loaded rows instead of requesting backend-filtered records
- creating a second header-only filter state that drifts from the package controller
- opening the header menu resets table scroll position
- table scroll leaves a floating header menu in the wrong place
- unsupported fields still show `按该字段筛选`
- host CSS forks package internals and breaks future package fixes
- fixed value controls remain red after the user enters or selects a valid value
- changing an operator to empty/not-empty leaves an old value error on the row
- missing fixed top header and bottom footer, or placing header/footer actions inside the scrollable condition body, is a blocker/regression for advanced filter delivery
- full-panel scroll makes `清空所有`, `+ 添加条件`, `+ 添加条件组`, or `确认` scroll away from the user
