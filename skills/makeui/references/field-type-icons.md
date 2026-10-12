# Make App 字段类型图标

用户明确指定其他图标库时，遵从其要求；否则所有新建 Make App 默认使用 [Lucide 图标库](https://lucide.dev/icons/)。这是图标库规范，不限定 UI 组件库。新项目的组件库选择界面提供 Ant Design、Arco Design、shadcn/ui 三个建议选项，同时允许用户指定其他兼容的 React 组件库；字段图标展示范围对它们相同。默认方案的 React 宿主从 `lucide-react` 公开入口导入图标，并在实际 UI package 声明兼容的直接依赖，沿用项目的包管理器和锁文件。存量 App 修改字段展示时，也按本规范处理本次涉及的字段入口；其他历史图标的全量迁移不属于普通字段改动。

字段类型图标是桌面／平板 View 的默认组成部分，无需用户另行提出。手机 View 的字段名称、字段选择列表和卡片不显示字段类型图标；手机壳层和操作图标仍按所选图标库／移动组件包自身的规范处理。用户明确指定不同的字段图标方案时，以用户要求为准。

## 唯一映射

默认 Lucide 方案下，以下 `Make.Field.*` 类型使用已验证的映射。第二列是 [Lucide 图标页](https://lucide.dev/icons/)上的名称，第三列是已验证 React 宿主使用的组件名；导入时以项目实际安装版本的公开导出为准。`building-complex` 在已验证的 `lucide-react` 版本中使用 `Building2` 组件。用户明确改用其他图标库时，按同样的字段类型语义选取对应图标，保留本规范的展示位置、端侧边界和无障碍要求，不强制导入 Lucide。

| 字段类型 | Lucide 名称 | React 组件 |
| --- | --- | --- |
| `Make.Field.ID` | `fingerprint-pattern` | `FingerprintPattern` |
| `Make.Field.Text` | `type` | `Type` |
| `Make.Field.TextArea` | `text-align-start` | `TextAlignStart` |
| `Make.Field.Number` | `hash` | `Hash` |
| `Make.Field.SingleSelect` | `circle-dot` | `CircleDot` |
| `Make.Field.MultiSelect` | `list-checks` | `ListChecks` |
| `Make.Field.Date` | `calendar-days` | `CalendarDays` |
| `Make.Field.DateTime` | `calendar-clock` | `CalendarClock` |
| `Make.Field.DateRange` | `calendar-range` | `CalendarRange` |
| `Make.Field.Percent` | `percent` | `Percent` |
| `Make.Field.Currency` | `coins` | `Coins` |
| `Make.Field.URL` | `link` | `Link` |
| `Make.Field.File` | `paperclip` | `Paperclip` |
| `Make.Field.SingleUser` | `user-round` | `UserRound` |
| `Make.Field.MultiUser` | `users-round` | `UsersRound` |
| `Make.Field.SingleDepartment` | `building` | `Building` |
| `Make.Field.MultiDepartment` | `building-complex` | `Building2` |
| `Make.Field.Lookup` | `search` | `Search` |

## 默认展示位置

从**规范化后的运行时字段元数据**读取 `field.type`，在字段名称左侧展示对应图标。字段权限、可见性和排序仍沿用宿主既有结果；图标不创建额外字段，也不改变字段值。

- CanvasTable 普通和分组表格的字段表头，包括只读表；选择框、序号列和行操作列不属于字段表头。
- 桌面／平板新建与编辑表单的字段标签、详情只读字段标签、关联／Lookup 字段表单标签；若界面展示独立的记录 ID 标签，也用 `Make.Field.ID`。
- 桌面／平板看板卡片及其他以字段名标记记录属性的视图；仅在该视图存在时添加，不因此新增看板或其他功能。
- 桌面／平板的**字段选项**列表：高级筛选的“选择字段”、分组字段、排序字段、批量编辑字段，以及已有的列设置、字段配置、聚合等字段选择入口。只给真正表示字段 key 的选项添加；即使值恰好等于某字段 key，筛选操作符、字段值候选、人员／部门／关联记录候选、菜单动作都不能误加字段类型图标。

## 视觉标准（已验证试点）

字段类型图标始终位于字段名称左侧，图标与名称垂直居中，间距由同一展示入口统一控制，不逐字段调整。图标与对应字段名称使用相同颜色，不能把图标单独设为更浅的灰色；字段名称截断时保留图标和固定间距。

- DOM 字段标签、详情、卡片和字段选项：图标尺寸 14px、描边宽度 1.75、图标与字段名称间距固定 6px。复用 `inline-flex`、`align-items: center`、`gap: 6px` 的字段标签容器，图标 `flex: none`；图标用 `stroke="currentColor"` 继承字段名称颜色，文本保持可截断、可搜索和可访问。
- CanvasTable 字段表头：按已验证接法生成 16px SVG 源，已安装的 CanvasTable 1.3.1 通过 `prefixRender` 将图标实际绘制为 14px，并使用包内固定 8px 图标与表头文字间距。默认表头文字为 `rgba(29,33,42)`，等价于 `#1d212a`；SVG 显式描边色必须与当前表头文字相同。主题或表头颜色变化时按新颜色重新生成并缓存图标，不额外叠加 CSS 间距或改动表格私有绘制逻辑。若更换 CanvasTable 版本，先核对其公开的前缀图标布局，保持上述可见尺寸、距离与颜色。

## 宿主实现边界

1. 在共享字段类型注册表或其相邻模块维护唯一的类型→图标映射；表格、表单、详情、卡片和字段选择器共用它，不按字段名称或样例数据猜类型。新增字段类型先扩展映射，再覆盖消费入口。对未知类型（包括 `__proto__`、`constructor` 等键）安全回退为纯文本，不出现空白图标占位或运行时异常。
2. DOM 标签与字段选项复用同一字段标签组件，遵循上述颜色、尺寸和 6px 间距。图标仅作装饰，用 `aria-hidden="true"`，保留完整可搜索、可读的字段名称。字段选项应保留原始文本用于搜索、提示和无障碍名称，不能把字段类型图标当作选项值。
3. CanvasTable 使用已安装包公开的 `IColumn.prefixRender`，为表头返回 `{ icon: svgDataUrl }`。由同一字段类型映射的图标组件渲染 SVG 并编码为 data URL，默认使用 Lucide，描边宽度 1.75。data URL 不继承外部 `currentColor`，要在 SVG 上显式设置 `stroke` 为当前表头文字颜色；按类型和颜色缓存，主题颜色变化时重新生成。实际可见尺寸和间距遵循上述 CanvasTable 标准。普通与分组表格共用列适配器；不修改 CanvasTable 私有绘制代码，不用 `suffixRender` 占用筛选／排序菜单位置。
4. 只对桌面／平板 View 注入字段图标。手机独立字段适配器、筛选面板和卡片继续显示纯文本字段名；切换展示模式时不保留桌面图标节点。字段值内部的附件、用户头像、状态、按钮等图标由各自组件负责，不套用字段类型映射。

批量编辑使用 `@qfei-design/make-app-actions@0.3.1` 时，各组件库都可使用包公开的通用 `RecordBatchEditModal`，注入当前组件库的 `Modal`、`FieldSelect`、`ModeControl`，在宿主的 `FieldSelect` 中给字段选项加图标；不要复制或修改包内弹窗。Ant Design 宿主也采用这一接法，因为该版本的 `AntdRecordBatchEditModal` 没有公开的字段选项渲染入口。`FieldSelect` 收到的选项只有字符串 `label` 与 `value`，应以同一份权限过滤后的字段集合建立 `field.key` → `field.type` 查找表，用 `option.value` 查出图标，保留原 `label` 作为搜索和无障碍文本。

同一版本的 `AntdRecordSelectionActionBar` 自带 Ant Design 图标。新应用使用包公开的 `RecordSelectionActionBar`，由宿主注入所选组件库的按钮和默认 Lucide 操作图标；存量接入在未涉及图标调整时可保留原适配器。

## 验收

- 测试 18 种映射、未知类型回退，以及同一字段在表头、表单／详情和字段选择列表的图标一致性。
- 测试字段选择列表与操作符／值候选的隔离，并测试手机字段标签、选项和卡片没有字段类型图标。
- 在真实桌面／平板页面检查普通及分组 CanvasTable 表头、创建／编辑／详情、已启用的字段选择入口；检查图标位于名称左侧、与名称同色且垂直居中，DOM 间距 6px、CanvasTable 间距 8px，字段仍可搜索且截断不遮挡图标，切换对象、权限或主题后不显示旧图标或旧颜色。再在手机页面确认字段类型图标未出现。
