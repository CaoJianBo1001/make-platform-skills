# Route-based form and detail pages

## 展示模式优先级

本文件的 Drawer 默认和“用户明确要求才使用路由页”规则仅适用于 desktop/tablet。手机端无论是否由 URL 驱动，都优先遵循 `mobile-defaults.md`：创建、编辑和详情默认使用可寻址的全屏任务路由；该规则覆盖本文件其余 Drawer 默认。

## When to use

On desktop/tablet, use route-based pages only when the user explicitly asks for:

- independent page
- route page
- page navigation
- page jump
- standalone create/edit/detail screen
- full-page form/detail

Otherwise on desktop/tablet use the default Drawer mode. On phones, use the full-screen task route from `mobile-defaults.md`.

## Object route model

Object navigation should use React Router dynamic params.

Preferred default pattern:

```text
/objects/:objectKey
```

When create/edit/detail must be URL-addressable, use dynamic child routes:

```text
/objects/:objectKey/new
/objects/:objectKey/:recordId
/objects/:objectKey/:recordId/edit
```

On desktop/tablet, presentation is still right-side Drawer by default for create/edit/detail. URL-addressable Drawer state does not change placement; keep `placement="right"` or `side="right"`. Only render these child routes as full pages when the user explicitly asks for page-route mode. On phones, render the same routes with the full-screen task-page presentation from `mobile-defaults.md`.

Do not generate a separate hard-coded route per object such as `/customers`, `/orders`, and `/opportunities` unless the host project already uses that convention or the user explicitly requests it.

## Create / edit page

Recommended structure:

1. page header: back action, title, secondary metadata if needed
2. action area: cancel, save, submit, or other requested actions
3. form body: sectioned form content

On desktop/tablet, the content area may scroll inside the app content region while the global header and sidebar remain fixed. Phone task pages follow the package-backed shell and scrolling rules in `mobile-defaults.md` plus the field-control and footer contract in `mobile-form-controls.md`.

Form layout:

- two-column desktop grid for common fields
- do not render every field as full-width one-column rows on desktop unless the user explicitly asks
- full-width rows for `TextArea`, long text, URL/link fields, `File`, `Lookup`, relation/association selectors, descriptions, and rich controls
- normal fields such as text, number, date, date-time, date range, select, user, and department occupy one column by default
- derive fields and control types from host-provided field metadata
- create routes render the host permission layer's authorized `createFields` / create field set; edit routes render visible fields and apply the editable subset. Do not substitute visible fields when the create set is missing or empty.
- required validation applies only to authorized fields rendered in the current mode
- when creation is allowed but there are no creatable fields, show `暂无可新建字段`, disable submit, and preserve back/navigation actions
- use type-appropriate controls; date, select, user, department, file, and lookup fields must not silently become plain text inputs
- custom form field controls must follow the host-form controlled field contract from `component-usage.md`; forward `value/onChange/onBlur/id/disabled` through user, department, lookup, select, date, file, and relation adapters so the visual selection matches the submitted form value
- user and department selectors use the host-provided candidate source and must include search/loading/empty/error UI states; use the canonical identity/label and generated-app transport contract in `component-usage.md`
- create pages must omit attachment upload fields when upload requires a saved record identity; edit pages may show attachments only when the persisted record identity exists
- On narrow desktop/tablet content areas, the desktop form grid may collapse to one content column as needed. This is not the phone field layout: phone forms use same-row left labels and right-aligned values from `mobile-form-controls.md`.
- on phones, replace viewport-unsafe desktop field popups through `mobile-form-controls.md`; one-column CSS alone is not a mobile field adaptation
- section headings rather than deeply nested cards

### Zero-field page state

Apply the same zero-field empty state as Drawer create/edit/detail surfaces. When the mode-specific renderable field collection is empty, render only the centered empty state in the available route content area; do not render a field grid, form/detail panel, section panel/card, placeholder `Form.Item`, border, shadow, or fixed minimum-height field wrapper. A zero editable set does not trigger this state while visible read-only fields remain. Create uses `暂无可新建字段` and disables submit; edit/detail use the host equivalent of `暂无可展示字段` while preserving navigation and non-mutating actions.

## Detail page

Recommended structure:

1. summary header: record title, status, key metadata, and main actions
2. detail body: sectioned read-only information
3. related sections: related records and attachments when requested

Do not add activity, dynamic records, timeline, comments, or operation logs by default. Add them only when the user explicitly asks.

The detail content can scroll inside the content region. Do not introduce a second global shell.

Detail layout:

- use a two-column label/value grid for common fields on desktop
- make `TextArea`, long text, URL/link-rich values, file/attachment values, lookup/relation values, and rich custom values span the full row
- render values through the same field-type display adapter used by Detail Drawers. Do not display raw objects, arrays, or JSON wrapper strings in route detail pages.
- `Date`, `DateTime`, and `DateRange` values must use formatted display text. `DateRange` values such as `[begin, end]` or `{ begin, end }` display as `YYYY-MM-DD 至 YYYY-MM-DD`.
- select, user, department, file, and lookup values use their type-specific read-only display renderers; empty values display `-`.
- route detail titles use the record/object title with real overflow handling only. Do not allocate a tiny title slot that truncates otherwise displayable titles.
- On narrow desktop/tablet content areas, collapse the desktop detail grid to one content column as needed. Phone detail pages use the mobile label/value row contract in `mobile-form-controls.md`; do not infer their field alignment from a collapsed desktop grid.
- when the visible renderable field collection is empty, apply the zero-field page state above instead of rendering an empty detail grid, panel, or card

## Navigation

Use React Router for route-based create/edit/detail pages and dynamic object navigation.

Keep routes predictable and shallow. Do not invent route semantics beyond what the user requested or what the host project already uses.

## 手机任务路由生命周期

- 手机新建 create 和编辑 edit 保存成功后都使用 `replace` 返回当前对象列表，避免浏览器返回再次进入已经完成的任务页。
- 初始化和 API 回填不得标记 dirty／脏状态；只有用户实际修改受控字段、附件草稿或其他可提交值后才置为 dirty。
- 保存中同时冻结字段、附件、返回、关闭和重复提交；不得允许第二次提交或在写请求未决时切换记录。失败后解除冻结并保留当前草稿与错误反馈。
- 任务路由打开时隐藏根底部 Tab、列表 FAB 悬浮新建和 AI 浮动入口，任务页自己的页头与底部操作栏仍可用。
- URL／路由是任务模式的唯一事实来源。URL 返回列表后，停止渲染旧任务并在同一渲染周期清理任务本地上下文；不得先用旧上下文多渲染一帧再回到列表。
- 从任务页返回列表时恢复此前的搜索、已应用筛选、已加载页和滚动位置；任务请求与列表请求使用独立 generation，迟到任务响应不得覆盖列表。
- 用户点击返回或宿主关闭时，如有 dirty／未保存变更先显示确认；取消后字段和 route／路由保持保留，确认后才继续原导航。没有 dirty 时直接返回。
