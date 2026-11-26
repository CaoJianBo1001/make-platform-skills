# Drawer layout

审批新建的字段来源、保存/首次发起和详情标题 Tag 使用 [make-app-approval](../../make-app-approval/SKILL.md)。本文件的 `createFields` 要求是普通新建规则；有效审批新建消费启动配置授权结果，配置失败不回退普通字段。继续复用下述布局和字段控件，不把审批权限算法复制到 Drawer。

我的审批任务详情使用审批包的 [任务详情合同](../../make-app-approval/references/task-detail.md)：通过 renderLayout 接入宿主容器，节点授权字段可直接编辑，actions 放关闭 X 左侧，意见随正文滚动；不套用下文普通业务详情的纯只读模式，也不另加保存按钮或固定办理底栏。

## Contents

- [Default mode](#default-mode)
- [Header actions](#header-actions)
- [Create / edit Drawer](#create--edit-drawer)
- [Detail Drawer](#detail-drawer)
- [Stacked Drawers](#stacked-drawers)
- [Drawer scrolling](#drawer-scrolling)

## Default mode

本文件统一维护 Make 表单／详情展示标准；MakeDesign 提供风格、布局选择及预览，不另行定义控件行为或表单规范。实现与快照同步遵循 [维护边界](component-usage.md#设计方案与组件实现的维护边界)。

无论视觉来源是 MakeDesign 还是组件库默认主题，都使用同一套表单与详情骨架。骨架保证字段标签／值／错误、授权内容及动作位置的一致语义；颜色、字体、间距、圆角与状态样式仍从当前方案读取，不能用下文的默认数值替代方案明确给出的值。MakeDesign 依完整方案通过公开能力适配，不解除字段类型图标或 Make 字段合同。默认 AntD 接入见 [AntD 基座](antd-foundation.md)；用户指定其他库时保留该库，按同一合同实现，不混入 AntD。

新项目先形成 [页面设计基线与视觉验收](page-design-quality.md) 中的页面区域、字段分组和密度决策，再复用本骨架。下文桌面列数及视觉数值是缺少对应有效方案值时的回退；以所属容器的实际可用宽度、长标签和复杂控件检查适配，不根据浏览器总宽度强行保留双列。手机继续使用独立的移动字段与任务页合同，不应用本节桌面标签方向、面板或列数。

Desktop and tablet create, edit, and detail UIs use a right-side Drawer by default. An explicit surface choice for ordinary record detail in a [MakeDesign plan](component-usage.md#makedesign-branch) takes precedence over the default placement and width. Phone CRUD uses the package-backed full-screen task route from `mobile-defaults.md`; it is not a resized Drawer.

新建／编辑默认 `60%`，全屏可扩至 `100%`，窄容器按原平台适配；详情选择不得把 `560px` 或 `960px` 套到新建/编辑。只有普通记录详情消费方案显式的 page／drawer／wide-drawer；缺省或 system 不构成改用固定宽度的授权。

- placement: right; use `placement="right"` for Drawer components and `side="right"` for shadcn/ui Sheet
- default width: `60%`
- narrow tablet containers: may use `100%`, but the surface still enters from the right
- mask closable: enabled by default; clicking the mask or blank area closes the current Drawer
- header action area contains close and primary/secondary actions
- no fixed footer by default
- body scrolls inside the Drawer shell

Do not use bottom Drawer/Sheet, mobile bottom sheet, or centered Modal/Dialog for object create/edit/detail unless the user explicitly requests that different presentation. The standard phone full-screen task route is the deliberate page-level exception defined in `mobile-defaults.md`.

Mask click uses the same close path as the header close control. If a form has an explicit unsaved-change guard, apply that same guard to mask close instead of silently ignoring the mask click.

On desktop/tablet, Drawer presentation can still be driven by dynamic child routes when URL-addressable create/edit/detail state is required. In that case, keep the Drawer UI and use route params for object and record identity. Phone task routes remain full-screen even when they are URL-addressable.

## Header actions

Use a compact header layout:

- left title area: fullscreen toggle when supported, then the mode badge when present, then title; an approval status Tag follows the title in this same group
- right action area: contextual actions first, then one close control as the final far-right item
- when `make-app-actions` owns record editing/deletion, the detail Drawer does not
  include edit/delete; those commands remain exclusively in the selection bar
- detail actions may include other requested contextual commands before close;
  edit/delete return only when the user explicitly opts out of selection-bar
  ownership and defines another workflow
- create/edit actions usually include save/submit and the final close control; do not add a separate cancel button when it only duplicates close
- keep button spacing compact
- avoid decorative icons on text actions; reserve icons for compact controls such as fullscreen, exit fullscreen, and close
- do not place a close icon/button in the left title area
- do not render duplicate close controls, such as a left `X` plus a right `关闭` button
- close should be icon-only by default, with accessible name/title `关闭`; avoid visible `关闭` text unless an existing project pattern explicitly requires text buttons
- title text must be readable within the available header space. Give the title container `min-width: 0` plus a flexible width, and only apply ellipsis after real overflow; keep the full title available through `title`/tooltip. Do not shrink the title slot so otherwise displayable titles are truncated.

### Approval header placement

Use the following desktop/tablet header grouping for Make approval surfaces. The approval status is a read-only label in the **left title group**, immediately after the title; it is not an action in the right `extra`/actions slot.

| Surface | Left title group, in order | Right action group, in order |
| --- | --- | --- |
| Business record detail | Fullscreen toggle → `详情` mode badge → existing object/record title → approval status Tag | Eligible `发起审批` or authorized `撤回` → icon-only close X; standalone start does not require ordinary edit permission or save the record |
| Business create/edit | Fullscreen toggle → `新建`/`编辑` mode badge → existing object title | `保存草稿` only when explicitly enabled → Save → `保存并提交` when eligible → icon-only close X |
| My approvals task detail | Fullscreen toggle → `审批详情` title followed by one status Tag, following the approval status contract below | Package-provided authorized actions, in their supplied order → icon-only close X |

Do not add unavailable actions merely to fill these slots. Save/recovery labels, eligibility and disabled/loading states remain owned by the approval contracts. Preserve selection-bar ownership of ordinary edit/delete. If fullscreen is absent, omit only that control and keep the other items in order.

Keep title text and its status Tag adjacent, vertically centered and in normal document flow. The title group may take the remaining width (`min-width: 0`); long title text may ellipsize with its full text available via tooltip. Keep the Tag from shrinking and keep the right action group compact. Do not stretch a title/Tag pair with `justify-content: space-between`, `margin-left: auto` or absolute positioning that moves the Tag beside the right-hand buttons. Missing status removes the Tag and its gap.

任务详情的标题和状态名称遵循 [审批状态展示合同](../../make-app-approval/references/status-display.md#展示合同)：包标题文案已符合合同时可复用完整的 `slots.title`；需要修正文案且有 detail 时，用公开 `slots.detail.processStatus` 和共享适配器替换整个标题组，无 detail 的加载/失败态保留原 title。标题组位于宿主全屏控件之后，保持既有标题语义、字号、字重及间距；不拆改包内部节点、不追加重复 Tag，也不将 Tag 放入右侧操作组。此处只规定布局，不维护第二套状态映射。

Place the complete `renderLayout.actions` before the host close control. Keep actions/content/footer and the original controller unchanged when adapting the title. Keep the same header grouping in loading/error states and fullscreen mode. Contextual commands stay in the header; do not add a second bottom action bar on desktop/tablet.

Scope responsive control sizing to its surface: business detail actions stay compact when a desktop/tablet window narrows; they must not inherit enlarged create/edit form buttons. Phone task-page placement continues to follow the mobile contract.

For newly generated fullscreen controls, choose semantically appropriate Lucide icons by default, including in Ant Design hosts; follow an explicit user choice of another icon library. In an existing project, keep an established close control unless changing it is part of the requested work.

If fullscreen is not implemented or not useful for a simple Drawer, keep a normal close control in the header.

## Create / edit Drawer

Recommended structure:

1. Drawer header: left fullscreen toggle plus mode/title; right save/submit and final icon-only close
2. Drawer body: form content

Form layout:

- 标签、必填、字段图标、帮助与错误槽由同一个字段包装层负责；控件适配器只拥有输入与值转换。使用 `Form.Item` 等基座字段包装时，不在子控件里再重复渲染标签；所有控件填满所属值槽，label 与 control 的布局选择器必须匹配实际宿主 DOM。
- group fields into sections
- create/edit forms use a dedicated modifier class or style scope when their visual treatment differs from detail Drawers
- default to vertical labels in a two-column grid for metadata-driven forms, because field labels may be long or unpredictable
- horizontal label/value alignment remains acceptable when labels are short, stable, or already established by the project
- use the active theme’s background for the Drawer body and its surface color for form panels
- keep form panels compact; padding, radius, border, and shadow follow the selected plan, with moderate padding, 6-8px radius, thin neutral border, and low shadow as unconfigured fallbacks
- common fields default to a two-column grid on desktop when the owning container has enough space; narrow containers, long labels, or complex controls may use one column without an additional user instruction
- long text, descriptions, URL/link fields, attachments, lookup/relation controls, and rich content span full width
- collapse the desktop grid to one column when its owning content area is too narrow; phone fields still use the independent mobile contract
- show form-level save errors as a compact `Alert` above the first form panel
- keep control height and radius consistent with the selected plan; 36px controls with 6px radius are an unconfigured Ant Design fallback, not a theme override

Preserve the default create/edit container below unless the user or existing project requests another one. Visual dimensions, panel treatment, and column count are unconfigured fallbacks; consume effective plan values first and record their source in the page design baseline:

- `Drawer` on the right, width `60%`, fullscreen toggle can expand to `100%`
- `layout="vertical"` form, `colon={false}`
- header badge shows mode such as `新建` or `编辑`; right side contains primary save and final close
- group authorized fields by the confirmed business task; normal writable fields may share one panel, with a relation/association section only when it improves the actual content organization
- panel padding around `16px`, thin neutral border, 8px radius, low shadow at most
- grid `repeat(2, minmax(0, 1fr))` with roughly `10px 18px` gaps
- field item margin around `10px`, label padding around `6px`, 36px controls, and textarea min-height around `96px`
- normal metadata-driven fields occupy one grid column by default while the available content width supports two readable columns
- full-span rows only for wide controls: `Make.Field.TextArea`, URL/link fields, `Make.Field.File`, `Make.Field.Lookup`, relation/association selectors, long text, attachment-heavy values, or otherwise wide controls
- body scrolls inside the Drawer; the page behind it does not scroll

Default create/edit field span mapping:

The mapping describes the desktop two-column default. It does not forbid a one-column desktop layout when the owning content area needs it, and does not define phone field rows.

| Field type / group | Desktop span |
| --- | --- |
| `Text`, `Number`, `Currency`, `Percent`, `Date`, `DateTime`, `DateRange`, `SingleSelect`, `MultiSelect`, `SingleUser`, `MultiUser`, `SingleDepartment`, `MultiDepartment` | one column; two fields per row |
| `TextArea`, long text, URL/link, `File`, `Lookup`, relation/association selector, rich custom control | full row |
| `ID`, generated, readonly-only fields | usually omit from create/edit; if shown in edit, one column unless value is long |

## Zero-field state

For create, edit, and detail, derive the mode-specific renderable field collection after permission and host-capability filtering. Create uses authorized and create-capable fields; edit and detail use visible, renderable fields. A zero editable set does not trigger this state while visible read-only fields remain.

When the renderable field collection is empty:

- create: show `暂无可新建字段`, disable save/submit, and keep close available
- edit and detail: show the host equivalent of `暂无可展示字段` and keep their non-mutating header/close actions available
- render only the empty state in the available Drawer body; center it horizontally and vertically
- do not render the field grid, form panel, detail panel, section panel/card, placeholder `Form.Item`, border, shadow, padding-only shell, or fixed minimum-height field wrapper

The form provider may remain mounted when the host needs it for lifecycle consistency, but it must not produce visible empty form chrome.

Field-metadata-driven Make forms:

- consume host-provided field metadata before rendering create/edit Drawer fields
- consume the host permission layer's mode-specific field sets: create uses authorized `createFields`; edit uses visible fields and marks only the editable subset writable. Never use visible fields as a create fallback.
- scope required validation to fields rendered in the active mode. Unauthorized required fields must not remain registered and block save.
- when the create operation is allowed but the authorized create field set is empty, show `暂无可新建字段`, disable submit, and keep close available
- derive field labels, readonly/editable presentation, and control choice from field metadata when available
- use the field component mapping in `component-usage.md`
- use the host-form controlled field contract in `component-usage.md` for every custom form field control; user, department, lookup, select, date, file, and relation selectors must forward `value/onChange/onBlur/id/disabled` so the displayed value and form store stay synchronized
- use date pickers for date fields, searchable selectors for user/department fields when candidate data is available, select controls for select fields, mode-safe attachment controls for file fields, and read-only/association displays for lookup fields
- do not silently fall back to a bare text `Input` for `Date`, `User`, `Department`, `Select`, `File`, or `Lookup` fields
- user and department selectors show search, loading, empty, error, and retry UI states around the host-provided candidate source; use the canonical candidate contract in `component-usage.md`
- user selector options use `userId` as value and `userName` as label; department selector options use `departmentId` as value and `departmentName` as label; merge current record values into options so detail/edit views display labels before async candidates load
- create mode must omit `Make.Field.File` upload controls when upload requires a saved record identity
- edit mode may render `Make.Field.File` controls only when a stable persisted record identity exists
- detail mode may display file fields as attachments, thumbnails, or file links and may offer explicit follow-up actions when supported
- if field metadata or candidate data is missing, state the UI dependency and render an explicit unsupported/degraded UI state only with user confirmation
- when permission/schema refresh removes the current create or edit field set, clear stale form state and re-render the authorized empty/read-only state; permission logic and payload filtering remain owned by `make-app-permission`

Action placement:

- save / submit as the primary action
- add a cancel action only when it performs distinct behavior beyond closing, such as an explicit discard flow required by the product
- destructive actions should not be primary
- fixed footer is optional and should be added only when the user or existing project pattern requires persistent bottom actions

Do not define business validation rules here. Only provide visual error, loading, and saving states.

## Detail Drawer

Recommended structure:

1. Drawer header: left fullscreen toggle plus record title or generic detail title; right contextual actions and final icon-only close
2. detail body: compact read-only information grid
3. related sections: related data and attachments when supported

Read-only information can use:

- description list
- information grid
- sectioned cards or panels

Apply the zero-field state above before selecting a detail grid, list, card, or panel. An empty detail field collection is not a reason to render an empty bordered container.

Use horizontal label/value alignment by default on desktop:

- two-column grid for common fields when the owning content area supports it; narrow areas, long labels, and complex values may use one column without an additional user instruction
- user fields render read-only avatar/name values; department fields render read-only tag/name values
- detail identity fields should use labels from the record or host candidate source and should not degrade to raw ids or disabled text inputs without an explicit dependency/error state
- every value is rendered through a field-type display adapter before JSX. Detail components must not display raw arrays, objects, or JSON wrappers directly.
- date fields display formatted dates; `DateRange` values such as `[begin, end]` or `{ begin, end }` display as `YYYY-MM-DD 至 YYYY-MM-DD`, not as `{"begin":...,"end":...}`.
- select, user, department, file, and lookup fields use their read-only display renderers from `component-usage.md`; unknown fields fall back to safe text, and empty values display `-`.
- each item has a stable label column and a flexible value column
- subtle bottom borders are preferred over boxed cards for dense record detail
- long text, `TextArea`, file, lookup/relation, URL/link-rich, attachment-heavy, or rich values span the full width
- labels use subdued color and consistent width; values use stronger text color and wrap safely

Default detail field span mapping:

| Field type / group | Desktop span |
| --- | --- |
| `ID`, `Text`, `Number`, `Currency`, `Percent`, `Date`, `DateTime`, `DateRange`, `SingleSelect`, `MultiSelect`, `SingleUser`, `MultiUser`, `SingleDepartment`, `MultiDepartment` | one column; two fields per row |
| `TextArea`, long text, URL/link-rich values, `File`, `Lookup`, relation/association values, attachment-heavy values, rich custom values | full row |

Detail Drawers should not have a footer unless the user explicitly asks for persistent bottom actions.

Edit and detail Drawers should look related but not identical: edit uses vertical form labels in panel sections, while detail uses compact label/value rows. Do not render detail fields as a loose unstyled list.

If a related-data section is tabular, route the table implementation to `@qfei-design/canvas-table` through `canvas-table-integration`.

Non-mutating Detail Drawer interactions are UI state only. Opening/closing detail,
fullscreen toggles, tab switches, header buttons, copy/link actions, and other
read-only controls must not refresh or reload the object list, grouped
`record-groups`, records, or table data. Trigger list/group/table refresh only
after a successful data mutation such as save, delete, relation update, or an
explicit user refresh command.

Do not add activity, dynamic records, timeline, comments, or operation logs by default. Add them only when the user explicitly asks.

## Stacked Drawers

When an explicitly configured workflow opens edit from detail, keep the detail
Drawer mounted underneath and open the edit Drawer above it. The default
`make-app-actions` workflow does not expose edit from detail.

- closing the edit Drawer returns to the detail Drawer
- closing the detail Drawer returns to the list page
- clicking the mask or blank area must close only the topmost Drawer
- if the implementation cannot guarantee topmost-only mask close, fix the Drawer stack close handler; do not change the default behavior to mask-close disabled
- use increasing z-index values or a Drawer stack manager so layers do not collapse together
- avoid shared state handlers that close all active Drawers at once

When a user opens a related record from a Lookup value, use the same Drawer stack model:

- only make Lookup values clickable when the display item has a target object key and saved record identity, and is not marked deleted
- append the related detail Drawer above the source detail Drawer
- close only the topmost Drawer
- when an explicitly configured Drawer action exists, bind it to that Drawer
  instance's own entity and record id, not to a shared "current detail" singleton
- guard async loads with the source Drawer identity so a stale response cannot reopen a closed Drawer

## Drawer scrolling

The Drawer shell remains fixed. The body scrolls.

Do not let the underlying page scroll when the Drawer is open.

## 用户请求的业务草稿动作

动作资格、顺序和数量统一使用 [表单保存意图矩阵](mobile-form-controls.md#表单保存意图矩阵)，草稿仍仅按明确需求启用；本文件只规定桌面/平板的头部位置及最右关闭入口。手机按同一矩阵与 Controller 组合保存区，不在这里维护第二套组件兜底。

桌面紧凑按钮不因保存错误、pending 或仅宽度变化而放大；触控尺寸只作用于对应移动/触控场景。确定未写入的普通校验错误结束 pending，允许原字段继续修改；未知写入仍按原恢复合同防重复创建。
