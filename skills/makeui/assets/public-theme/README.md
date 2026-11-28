# 公共组件主题参考资产

合同：`makeui-public-theme/v1`。职责和发布门槛见 [接入指导](../../references/public-component-theme.md)。这是可复制的宿主适配资产，不是新的 npm 包；已核验正式 Canvas `1.3.5`／审批 `0.2.17` 的公开语义主题接口。

## 复制闭包

复制到宿主的同一主题目录，保留相对位置：

```text
public-theme/                  本目录完整内容
antd-foundation/theme.mjs       既有纯解析器，无 AntD runtime import
mobile-brand-theme.mjs
mobile-brand-theme.d.mts
```

宿主从 `public-theme/index.mjs` 导入；同名 `.d.mts` 提供 TypeScript 声明。归一和映射不依赖 React、DOM、路由或网络，只有显式调用的 `createCanvasColorResolver` 访问宿主 DOM 和原生 Canvas。非 AntD 主库须提供自己的完整语义基线，应用 MakeDesign 时还须显式提供纯 `resolveDesign`，不能用此资产强制引入 AntD。

## 受控接入

`createFixedProjectThemeHost` 是可执行组合示例。传入已经挂载的表格、受控主题 setter 及宿主自有颜色作用域，不传业务 Controller。下例用于上述正式版本，仍须核验宿主实际安装的公开 API；旧版保留显式兼容路径：

```js
import * as canvasRuntime from '@qfei-design/canvas-table';
import * as approvalRuntime from '@qfei-design/make-app-approval';
import {createFixedProjectThemeHost} from './public-theme/index.mjs';

const visualHost = createFixedProjectThemeHost({
  owner: projectRegion,
  canvas: {
    contract: canvasRuntime.CANVAS_TABLE_THEME_CONTRACT,
    instance: existingTable,
  },
  approval: {
    contract: approvalRuntime.MAKE_APPROVAL_THEME_CONTRACT,
    setTheme: setApprovalTheme,
  },
  mobile: {setTheme: setPhoneBrandTheme},
  logger: themeLogger,
});

// projectDesign 是项目中已固定、已校验的方案 JSON。
// 初始化及项目主动更新方案时调用；不要在每次 render 中重复调用。
visualHost.updateProjectTheme({
  design: projectDesign,
  foundation: {library: 'antd'},
});
```

示意中的宿主变量须接到现有项目：`setApprovalTheme` 更新包公开 `/react` 的 `MakeApprovalThemeProvider` 的 `theme`；手机 setter 更新独立的移动颜色 Provider。Provider、Form、Controller 和路由不按主题设置 `key`。普通表单／详情继续使用 makeui 原骨架与所选主组件库，布局 recipe 仍由宿主解析，不交给公共包。

PC 直接使用 `normalizePublicTheme` 和 `toApprovalTheme(..., {capability, presentation: 'desktop', resolveColor})`；手机分支调用 `toApprovalTheme(..., {capability, presentation: 'mobile'})` 与 `toMobileBrandTheme`。手机绝不复用完整 PC 主题或 PC 的组件库 Provider 配置；只跟品牌色，原字体、布局、控件及交互保持。受控绑定的 `apply(snapshot, {presentation: 'mobile'})` 也只做手机投影并跳过 Canvas。

不要把合同字符串写死来绕过缺失导出。旧正式包只能显式选择 `compatibility.canvas: 'legacy-style'` 或 `compatibility.approval: 'host-slots'`，保留原公开接入并记录内部未同步区域；兼容结果不代表完整主题已覆盖。

## 方案与能力边界

- 项目保存原交接数据、URL、来源 revision／hash、组件库和适配版本；默认不在运行时订阅官网。替换固定方案数据不要求修改各包源码。
- `PUBLIC_THEME_TARGETS` 列出本批目标及差异；Canvas／审批的 `availability: 'released'` 表示本指导已核验的正式接口，实际安装包仍须通过公开能力常量门禁。Canvas 的布局 recipe、任意自定义 renderer、字距、面板阴影等不因传入 style 自动支持；宿主 renderer 读取同一当前主题，不能缓存初始颜色。空态插画仍是原资源。
- 颜色 resolver 的 owner 必须是已连接的宿主自有主题作用域。未定义 CSS 变量无回退时明确失败；有合法回退、`currentColor` 和 `color-mix()` 则在真实浏览器求值，再验证可绘制。不要用固定黑色或 mock 颜色冒充解析结果。
- 审批列表内部也使用 Canvas。PC 组合应给 `toApprovalTheme` 传同一个 `resolveColor`，统一将颜色与边框转换为可绘制值；受控 Host 已自动转发这一边界。仅 DOM 展示可不传，保留合法 CSS 值；手机不执行 Canvas 颜色解析，仍只投影品牌色。
- 映射／门禁先全部准备，再调用可视 setter。setter 的业务状态、生命周期与持久化仍由宿主负责；该例不提供跨多个 UI 库的事务回滚。

## 验证

源仓库维护者运行 `node scripts/test-makeui-public-theme.mjs`；脚本默认执行纯合同与完整复制测试，类型检查因未提供依赖而明确跳过。用 `--skill=<实际 makeui 目录>` 可完整核对安装副本，追加 `--dependencies=<node_modules>` 检查分发声明；实际包声明分别通过 `--canvas-types=<index.d.ts>` 和 `--approval-types=<index.d.ts>` 显式提供，正式接入使用上述 registry 版本的声明，不自动寻找本机兄弟仓库。

真实浏览器可由本地验收页按钮调用 `browser-check.mjs` 的 `runPublicThemeColorBrowserCheck({document})`。它只创建并清理自有测试节点，使用真实 CSSOM／Canvas；仍须验证真实公共组件、表格交互、意见草稿、Portal、手机布局及请求次数，不能把纯对象或类型检查当作视觉通过。
