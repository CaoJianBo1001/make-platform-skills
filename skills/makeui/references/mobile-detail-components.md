# 移动详情与表单公共组件

移动端可复用的展示和样式统一沉淀到 `@qfei-design/make-app-mobile`。宿主只组合数据、控件适配及回调，不按 skill 的尺寸描述再写一套 CSS。审批、普通业务详情及表单均按此责任边界复用；权限、Schema、认证、路由和请求不进入移动包。

## 安装产物门禁

以下公开组件及表单底栏单行溢出能力已核验正式 npm `0.1.14` 产物。接入前仍须核对目标 App 实际安装的版本、exports、声明与运行行为，依赖清单、锁文件和实际解析结果一致；不以组件源码工作树或另一 App 的安装结果代替。依赖不可用时报告 package release blocker，不改用本地路径、复制组件或向旧包虚构 props。保留旧的 `MobileFormActionBar label/onSubmit` 兼容路径，不要求其他既有页面同时迁移。

```tsx
import {
  MobileTimeline, MobileDetailSection, MobileFieldRow, MobileTextArea,
  MobileDetailPage, MobileFormActionBar, MobileFormSheet,
} from '@qfei-design/make-app-mobile/primitives';
import '@qfei-design/make-app-mobile/styles.css';
```

| 使用处 | 使用公共组件 | 宿主仍负责 |
| --- | --- | --- |
| 历史/流程时间线 | `MobileTimeline`，items 提供 key/title/result/meta/description | 与 PC 共用[完整快照与滚动展示合同](../../make-app-approval/references/history.md#共享数据源与滚动展示)、顺序及[历史结果适配](../../make-app-approval/references/history.md#共享历史结果)，一次读取完整快照，滚动不追加请求；手机只适配布局与空意见展示 |
| 宿主自建标题和区块 | `MobileDetailSection title/children`；独立全宽区块传 `inset`，已有正文左右留白时不传 | 区块内容、可见性；审批包自带标题的 section 不重复包同名标题 |
| 宿主自建混合编辑/只读字段行 | `MobileFieldRow label/htmlFor/required/readOnly`，附件可传 stacked | 字段权限、值格式化、候选、校验；审批任务 renderField 已有包外框，只返回值控件，不嵌套完整字段行 |
| 多行意见、原因、文本字段 | `MobileTextArea value/onChange`；默认两行到五行，字段行内用 appearance="inline" | 草稿、字数限制、必填、错误和提交；禁用时传 disabled |
| 连续详情与区块定位 | `MobileDetailPage header/summary/sections/trailingContent/footer` | 路由、数据加载和页头业务标题；切页签不重建草稿 |
| 保存/继续提交/办理底栏 | `MobileFormActionBar actions`，紧凑样式传 size="small" | 授权动作、顺序、variant、loading、disabled 和原提交回调 |
| 撤回原因等表单底部弹层 | `MobileFormSheet open/title/description/actions/onClose/busy` | 原资格判断、字段值、取消、校验、提交前复核和成功回读 |

`MobileFormActionBar` 多动作接口与旧单动作接口互斥；variant 为 primary/default/danger，空数组不留底栏。记录详情的编辑/删除图标操作继续使用 `MobileBottomActionBar`，不强制替换成表单底栏。

接入本节组件时，按 [安装产物定位](mobile-defaults.md#包接入与边界) 取得目标应用实际安装包的绝对路径，再在本 Skill 的实际安装目录运行 `node scripts/verify-mobile-package-surface.mjs "<已安装包根目录>" --detail`，不依赖技能源码仓库的目录结构。该模式额外检查七个详情组件的公开 ESM 导出是否可加载，不能仅通过旧附件基线就判断新组件可用。该检查不证明多动作 props 的类型或组件交互；宿主仍须以实际安装产物编译新/旧单动作和多动作示例，执行组件测试与真实页面验收。审批包的 presentation/sections/actionItems 另按其实际公开类型核验，移动包校验不能替代审批包兼容性验证。

附件与详情的 React 导出使用同一识别规则，支持函数、forwardRef、memo 和嵌套包装；无效导出仍拒绝。此规则仅用于组件，不放宽任何普通工具函数、工厂或请求方法的可调用性检查。

## 单行与更多操作

新增或改造手机多动作表单底栏，使用正式 `@qfei-design/make-app-mobile@0.1.14`，或经过同等验证的后续正式版本。按包内 `package.ai.json` 的阅读顺序核对 `capabilities.json` 中的 `capabilities.mobileFormActionOverflow`、公开类型及 ESM/CJS/样式入口；版本或能力标记单独存在不能证明交互正确。上面的 `--detail` 脚本只检查既有表面合同，不验证此能力标记、溢出行为或类型，不能把通过该命令当作“更多”验收完成。

- 使用原 `actions` 数组，每项仍为 `{ key, label, onClick, disabled?, loading?, variant? }`，主操作由宿主显式传 `variant="primary"`，紧凑栏传 `size="small"`。没有新增的 overflow、maxVisible 或 moreActions props，也无需宿主拆分数组。
- 包按容器、按钮实际宽度及间距自动分配：能放下时全部在一行；放不下时最右侧显示“更多”。优先保留第一个显式 primary，再按传入顺序选择其他动作；最终可见动作与菜单动作各自保持原顺序。极窄或单动作文案过长时允许只显示“更多”，全部授权动作仍可访问。不得固定“最多两个按钮”、强制折成两行、压窄按钮截字，或覆盖包私有 CSS。
- “更多”使用包的公共底部弹层。保留动作的 loading、disabled、variant 和原始回调；禁用／加载中的动作不可触发。打开、关闭、取消菜单和尺寸变化均不执行动作；选择只调用一次原回调。宿主仍负责请求互斥、防重复、校验、权限复核和失败恢复，不能用包内菜单防连击代替这些保护。
- 容器、字体或标签变化会重新测量；变宽恢复按钮，溢出菜单项发生增删／顺序变化时关闭旧菜单，之后变窄不自动重开。重新分配不重建 Controller，不清空表单值、意见或选择草稿，不自动提交。包负责丢失焦点后的回退；输入框或其他控件已有焦点时不得抢占。
- 只传当前宿主已存在且已授权的动作；“更多”不默认增加保存草稿、取消、撤回等业务能力。旧单动作 API 保持可用；普通详情编辑／删除的 `MobileBottomActionBar` 不因本合同被整体替换。

宿主验收先挂载实际页面／共享布局及已安装公共包，沿用真实控制器，模拟外部请求覆盖展开菜单、执行、禁用／loading、连击、取消及宽度往返：断言原业务请求种类、次数、载荷和错误恢复，而不只检查传入 props。尺寸替身可用于可重复的分配和交互测试，不能证明实际布局。真实浏览器另验 320／390／767px、长标签、字体缩放、横竖屏、正文滚动及软键盘：底栏单行、更多位于最右、标签完整、弹层可滚动且不被安全区遮挡、关闭／重排焦点合理，桌面布局保持原设计。已安装产物、宿主组件、真实浏览器与飞书真机结果分别记录，未执行的项目标记待验。

## 间距归属与常见误用

- 业务详情的字段网格有左右留白，不代表网格外的流程区也有；独立流程区须传 `MobileDetailSection inset`，由包提供 16px 留白。不要在预览外层手工补 padding 来掩盖真实容器缺失，也不要给时间线和外层各加一次边距。
- 连续详情页的正文已有包内留白，内层普通区块不传 inset。标题、字段行、表单弹层内容、说明到标签/输入/按钮的间距都归包，不覆盖 `.make-app-mobile-*` 私有后代结构。
- 用现有 `--make-mobile-*` / `--make-app-*` 做主题映射；不要复制品牌色、字号、边框和安全区样式。公共组件缺少可复用的展示能力时先完善组件包及测试，再接入宿主和更新文档。
- 文本框增高由实际测量实现，不能仅用 field-sizing 冒充所有浏览器兼容；测试清空收缩、五行上限、内滚动、宽度变化和卸载清理。真机键盘与 WebView 验证仍单独报告。
- 复用文本框的原生 ref 与清理语义，受控值更新不得反复解绑。多动作底栏按 [单行与更多操作](#单行与更多操作) 由包测量分配，不再用换行或宿主自写阈值处理溢出。
- 保留一个业务 Controller。底栏只调用现有回调，不能自行补发请求、推断权限或在展示切换时丢弃草稿。

## 验证

组件包运行测试、类型、构建与 ESM/CJS/类型入口冒烟；覆盖旧单按钮 API、新多动作禁用和 loading、空动作、受控文本框、弹层关闭与焦点、连续区块及 inset。宿主覆盖 PC 原分支和新手机分支，真实组件预览需按真实父容器结构验证字段区与流程区对齐；不能只模拟类名或尺寸公式。正式安装测试、本地产物测试、模拟接口与真实办理/真机结果分开记录。
