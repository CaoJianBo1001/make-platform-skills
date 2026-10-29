# 移动详情与表单公共组件

移动端可复用的展示和样式统一沉淀到 `@qfei-design/make-app-mobile`。宿主只组合数据、控件适配及回调，不按 skill 的尺寸描述再写一套 CSS。审批、普通业务详情及表单均按此责任边界复用；权限、Schema、认证、路由和请求不进入移动包。

## 安装产物门禁

以下为新增源码 API，接入前必须核验实际安装产物的 exports、声明与运行行为，不以仓库版本号证明已发布。未发布时不能向旧包虚构组件或改生产依赖为本地路径；已获本地验证授权时可通过临时构建配置加载完整构建产物，单独报告结果。待发布后再升级清单与锁文件并运行正式构建。保留旧的 `MobileFormActionBar label/onSubmit` 兼容路径，不要求其他既有页面同时迁移。

```tsx
import {
  MobileTimeline, MobileDetailSection, MobileFieldRow, MobileTextArea,
  MobileDetailPage, MobileFormActionBar, MobileFormSheet,
} from '@qfei-design/make-app-mobile/primitives';
import '@qfei-design/make-app-mobile/styles.css';
```

| 使用处 | 使用公共组件 | 宿主仍负责 |
| --- | --- | --- |
| 历史/流程时间线 | `MobileTimeline`，items 提供 key/title/result/meta/description | 与 PC 共用[数据源与滚动加载合同](../../make-app-approval/references/history.md#共享数据源与滚动加载)、顺序及[历史结果适配](../../make-app-approval/references/history.md#共享历史结果)，手机只适配续载触发、布局与空意见展示 |
| 宿主自建标题和区块 | `MobileDetailSection title/children`；独立全宽区块传 `inset`，已有正文左右留白时不传 | 区块内容、可见性；审批包自带标题的 section 不重复包同名标题 |
| 宿主自建混合编辑/只读字段行 | `MobileFieldRow label/htmlFor/required/readOnly`，附件可传 stacked | 字段权限、值格式化、候选、校验；审批任务 renderField 已有包外框，只返回值控件，不嵌套完整字段行 |
| 多行意见、原因、文本字段 | `MobileTextArea value/onChange`；默认两行到五行，字段行内用 appearance="inline" | 草稿、字数限制、必填、错误和提交；禁用时传 disabled |
| 连续详情与区块定位 | `MobileDetailPage header/summary/sections/trailingContent/footer` | 路由、数据加载和页头业务标题；切页签不重建草稿 |
| 保存/继续提交/办理底栏 | `MobileFormActionBar actions`，紧凑样式传 size="small" | 授权动作、顺序、variant、loading、disabled 和原提交回调 |
| 撤回原因等表单底部弹层 | `MobileFormSheet open/title/description/actions/onClose/busy` | 原资格判断、字段值、取消、校验、提交前复核和成功回读 |

`MobileFormActionBar` 多动作接口与旧单动作接口互斥；variant 为 primary/default/danger，空数组不留底栏。记录详情的编辑/删除图标操作继续使用 `MobileBottomActionBar`，不强制替换成表单底栏。

接入本节组件时，按 [安装产物定位](mobile-defaults.md#包接入与边界) 取得目标应用实际安装包的绝对路径，再在本 Skill 的实际安装目录运行 `node scripts/verify-mobile-package-surface.mjs "<已安装包根目录>" --detail`，不依赖技能源码仓库的目录结构。该模式额外检查七个详情组件的公开 ESM 导出是否可加载，不能仅通过旧附件基线就判断新组件可用。该检查不证明多动作 props 的类型或组件交互；宿主仍须以实际安装产物编译新/旧单动作和多动作示例，执行组件测试与真实页面验收。审批包的 presentation/sections/actionItems 另按其实际公开类型核验，移动包校验不能替代审批包兼容性验证。

附件与详情的 React 导出使用同一识别规则，支持函数、forwardRef、memo 和嵌套包装；无效导出仍拒绝。此规则仅用于组件，不放宽任何普通工具函数、工厂或请求方法的可调用性检查。

## 间距归属与常见误用

- 业务详情的字段网格有左右留白，不代表网格外的流程区也有；独立流程区须传 `MobileDetailSection inset`，由包提供 16px 留白。不要在预览外层手工补 padding 来掩盖真实容器缺失，也不要给时间线和外层各加一次边距。
- 连续详情页的正文已有包内留白，内层普通区块不传 inset。标题、字段行、表单弹层内容、说明到标签/输入/按钮的间距都归包，不覆盖 `.make-app-mobile-*` 私有后代结构。
- 用现有 `--make-mobile-*` / `--make-app-*` 做主题映射；不要复制品牌色、字号、边框和安全区样式。公共组件缺少可复用的展示能力时先完善组件包及测试，再接入宿主和更新文档。
- 文本框增高由实际测量实现，不能仅用 field-sizing 冒充所有浏览器兼容；测试清空收缩、五行上限、内滚动、宽度变化和卸载清理。真机键盘与 WebView 验证仍单独报告。
- 复用文本框的原生 ref 与清理语义，受控值更新不得反复解绑。多动作底栏由包处理窄屏换行和长文案折行，宿主不要固定按钮总宽；验证 320px 下多动作和长文案无横向溢出。
- 保留一个业务 Controller。底栏只调用现有回调，不能自行补发请求、推断权限或在展示切换时丢弃草稿。

## 验证

组件包运行测试、类型、构建与 ESM/CJS/类型入口冒烟；覆盖旧单按钮 API、新多动作禁用和 loading、空动作、受控文本框、弹层关闭与焦点、连续区块及 inset。宿主覆盖 PC 原分支和新手机分支，真实组件预览需按真实父容器结构验证字段区与流程区对齐；不能只模拟类名或尺寸公式。正式安装测试、本地产物测试、模拟接口与真实办理/真机结果分开记录。
