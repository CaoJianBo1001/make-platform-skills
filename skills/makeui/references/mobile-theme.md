# MakeDesign 手机主题接入

MakeDesign 默认负责 PC 的完整视觉。手机只跟随当前方案的主题主色与选中强调色，字体、字号、字距、密度、圆角、阴影、表面、布局、控件种类和交互继续使用已冻结的移动规范。这里通过正式包已有公开 Provider 传递有限颜色，不修改或发布移动包，也不把公共包的完整主题能力视为默认改造范围。

选择 MakeDesign 的手机页面继续使用 [手机默认组合](mobile-defaults.md)、[字段适配](mobile-form-controls.md) 和 [冻结视觉](mobile-visual-standard.md)。PC 的浅深模式、导航、页面配色及组件语言不整份传播到手机；桌面 single／double／top 不改变手机导航、字段左右布局或任务容器。用户明确手机定制时，先记录手机专属范围及来源，再在公开能力和 Make 稳定合同内实施；单纯选择 PC MakeDesign 方案不构成该授权。

## 先核对真实包能力

已核验正式 npm `0.1.16`：从 registry.npmjs.org 取得版本元数据及 tarball，校验 SHA512 integrity 后检查实际解包产物，`/presentation` 提供 `MakeMobileThemeProvider`、`useMakeMobileTheme` 及下述38个可选主题字段，配套构建与 CSS 已包含跨 portal 主题和字段值链接样式。主题 Provider 与 URL 样式在历史正式 `0.1.15` 已提供，38 个主题字段声明及 `/presentation` ESM/CJS 产物在 `0.1.16` 中保持一致；本轮新接入固定使用 `0.1.16`，安装与运行时兼容门禁见 [包接入与边界](mobile-defaults.md#包接入与边界)。历史 `0.1.14` 不提供此主题 Provider，不能向旧版虚构入口；只给祖先写 CSS 别名也不能保证 body 弹层继承。

`0.1.15` 与 `0.1.16` 随包 capabilities.json 的能力项为 true，但 availability 仍标记 local-candidate、published: false；package.ai.json 和 PUBLIC_API.md 也残留“本地候选／未发布”的旧文案，`0.1.16` 新增筛选入口的 availability 也有同类残留。这些旧文案与已核验的真实导出、声明、样式产物不一致，不能据此将该正式版本误判为未发布，也不假设后续版本已经修正文案。发布事实以 registry 版本、通过 integrity 校验的同版 tarball 和实际公开产物共同判定，能力标记或较高版本号单独存在都不充分。

接入前仍核对目标 App 实际安装包的 `/presentation` 类型声明、ESM/CJS 导出、配套 CSS 和公开文档，确保清单、锁文件与解析产物一致；不能以另一 App 或某台电脑的源码绝对路径代替。测试用本地候选不是已发布能力的证据；确需验证候选时单独记录来源提交、未提交差异和临时解析配置，不改锁文件把候选冒充正式版本。

若目标包仍缺能力，列出受影响的字段／弹层及原方案选择，说明所需包版本尚未交付，并等待用户明确处理；不能以包私有 CSS 选择器覆盖、固定白字或静默忽略方案作为完成结果。

## 默认品牌色接入

将本 Skill 的 `assets/mobile-brand-theme.mjs` 与配套 `.d.mts` 一起复制到宿主共享工具目录，以下示例假定路径为 `./lib/mobile-brand-theme.mjs`。`toMobileBrandTheme(theme)` 接受已解析的主题语义对象，只投影 `primary`、`onPrimary`、`primarySoft`、`link`、`focusRing`，并保持手机实心主按钮：`actionBackground = primary`、`actionBorder = primary`、`actionText = onPrimary`。输入缺少值时不硬编颜色，其余键不输出；不要用对象展开把完整 PC 主题重新传回 Provider。

```tsx
import { MakeMobileThemeProvider, useMakeMobileTheme } from '@qfei-design/make-app-mobile/presentation';
import { MakeDesignProvider, toMakeMobileTheme } from './components/make-foundation';
import { toMobileBrandTheme } from './lib/mobile-brand-theme.mjs';

const mobileBrand = toMobileBrandTheme(toMakeMobileTheme(currentDesign));

// 宿主原有业务 Controller 在两个 View 的共同父级，切换不重建业务状态。
<ExistingBusinessControllerProvider>
  {presentation === 'mobile' ? (
    <MakeMobileThemeProvider theme={mobileBrand}>
      <PhoneView />
    </MakeMobileThemeProvider>
  ) : (
    <MakeDesignProvider design={currentDesign}>
      <DesktopView />
    </MakeDesignProvider>
  )}
</ExistingBusinessControllerProvider>

function PhoneView() {
  const style = useMakeMobileTheme();
  return <div className="mobile-task-page" style={style}>{phoneContent}</div>;
}
```

`ExistingBusinessControllerProvider` 代表宿主已有的共享 Controller，不是组件包导出。完整 `MakeDesignProvider` 限于桌面／平板 View；手机不是它的后代，不继承 PC 的字体、密度、圆角或 `--makeui-*` 变量。宿主手机元素从同一 `/presentation` 入口调用 `useMakeMobileTheme()`，将返回样式赋给自己拥有的手机根节点；不要为复用手机颜色再把整个 App 包进 PC Provider。该 hook 在 Provider 外返回空样式，不读取 DOM 或发请求。

宿主自绘头像、卡片操作、链接和焦点也消费同一已解析颜色，不能只让公共保存按钮变色。正式 0.1.16 的常用公开 CSS 名称如下；不要凭字段名猜造 `--make-mobile-primary-color`／`--make-mobile-on-primary-color`，也不要用固定蓝色回退掩盖接线错误。可复制组合及真实参照检查见 [宿主示例与门禁](record-page-patterns.md)。

| Provider 语义字段 | 实际公开 CSS 变量 |
| --- | --- |
| primary / onPrimary / primarySoft | `--make-mobile-primary` / `--make-mobile-on-primary` / `--make-mobile-primary-soft` |
| link / focusRing | `--make-mobile-link-color` / `--make-mobile-focus-ring` |
| actionBackground / actionText / actionBorder | `--make-mobile-action-background` / `--make-mobile-action-text` / `--make-mobile-action-border` |

颜色取值来自既有主题投影；用户未提供颜色时沿正式移动默认，不反向用 PC 表面色填充手机。对比自绘元素与同主题公开组件／参照的实际计算颜色，并对默认及两方案的同状态非颜色属性做独立检查，不能拿两个都回退蓝色的宿主元素互相比对。

## 公开主题字段

下表为已核验0.1.16声明中的38个可选主题字段，值均为CSS语义字符串；传入已解析值，不传MakeDesign对象、权限或业务状态。这是公共 API 能力参考，不是 MakeDesign 手机默认映射清单。颜色投影以外的字段只供用户明确手机定制等独立需求使用，不能因 PC 方案含有这些值而自动传入。

| 语义 | 字段 |
| --- | --- |
| 强调与状态 | `primary`、`onPrimary`、`primarySoft`、`danger`、`success`、`warning` |
| 页面与控件表面 | `surface`、`controlSurface`、`page`、`text`、`muted`、`placeholder`、`line`、`controlBorder` |
| 链接、焦点与遮罩 | `link`、`focusRing`、`mask` |
| 字体角色 | `fontFamily`、`headingFontFamily`、`monoFontFamily` |
| 正文与字段字号 | `contentSize`、`pageHeaderSize`、`fieldLabelSize`、`controlTextSize` |
| Sheet字号与排版 | `sheetTitleSize`、`sheetBodySize`、`sheetMetaSize`、`sheetHeadingSize`、`lineHeight`、`letterSpacing` |
| 控件及视觉细节 | `controlRadius`、`shadow`、`iconStroke`、`motionDuration` |
| 已有主操作 | `actionBackground`、`actionText`、`actionBorder`、`actionRadius` |

## 当前方案与作用域

`toMakeMobileTheme` 保留为已有的完整纯映射能力，可以作为当前方案的颜色解析输入；默认必须再经过 `toMobileBrandTheme`，不得把它的完整结果直接交给手机 Provider。PC 的字体角色、组件语言、描边按钮、阴影、图标和 motion 不进入手机默认主题。传给 `body` 弹层的是已解析颜色，不是局部 `var(--makeui-*)` 引用。主操作保持原手机实心样式，PC 描边语言不会令手机保存按钮变为描边。

手机默认不传 `fontFamily`、`headingFontFamily`、`monoFontFamily`、任何字号／行高／字距、`controlRadius`、`actionRadius`、`shadow`、`iconStroke`、`motionDuration`，也不传 PC 的背景、表面、边框、遮罩和成功／警告／危险色。它们保留原手机值及已有主题来源。字号按 [业务文字角色的手机范围](business-typography.md#实际组件消费) 保留移动规范，可编辑输入仍执行 iOS 16px 安全下限；不能给不支持字段的旧包编造能力。

移动包 Provider 只传 React 上下文，不新增业务 DOM 或写 document 全局主题。包自身将公开变量应用到普通组件及 BottomSheet、ConfirmDialog、AccountDrawer 三类 portal 根；嵌套 Provider 按字段合并，子级显式值覆盖父级，未提供的值或空主题继承父级，独立作用域不互相写入。第三方 portal 仍由宿主按其公开接口适配。用户／部门候选、日期草稿、Lookup 确认、附件请求、权限和保存值仍按原 Controller 与受控字段合同处理。

根层未传 Provider／空主题时保留包既有默认及公开 `--make-app-*` 兼容，嵌套空主题仍继承父级。在同一 App 切换方案时，默认颜色更新只改变品牌强调，字段 DOM、草稿、弹层选择与业务状态保持，不得重新挂载 Controller。若用户明确手机定制涉及字号、字距或动效，单独核对文本域高度、操作栏溢出及减少动效，不将其带入普通 MakeDesign 生成流程。

## Make 标准与验收

保留 Make 的 Sheet 顶部 16px 圆角、无外阴影、日期滚轮 48px、触达下限、安全区、附件入口、手机字段布局及原控件种类。搜索等输入字号保持 iOS 所需下限；PC 的紧凑／宽松、字体和圆角微调不改变手机尺寸或文本。

至少用两个明显不同的 PC 方案及一个微调方案验证手机：主题主色、选中强调、链接、焦点和实心主操作颜色按投影更新；字体、字号、字距、密度、普通表面、圆角、阴影、行高、图标、动效、布局及控件种类保持原移动规范。颜色未提供时保留手机原值；不能为匹配 PC 外观而添加包装卡片或描边控件。

普通字段、选择 Sheet、日期 Sheet／区间日历、确认弹层及账户抽屉均按上述范围检查，包括 portaled 根节点的实际计算样式。长标签和多选不挤压操作；保存载荷、确认／取消草稿、焦点返回、跨端切换及同一 Controller 状态均保持。原移动页和两份 PC 方案的手机截图同时对照，不能只检查变色，也不能把 PC 的视觉变化误记为手机保真要求。

分别验证构建后的 ESM、CJS 多子入口共享主题上下文，并运行宿主组件测试与真实浏览器检查。源码 DOM 通过不等于正式 npm 包或手机真机已经验收。
