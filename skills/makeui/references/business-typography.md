# 业务界面的文字层级

PC 所选风格的字体与字号需要按业务语义使用，不能把展示标题同时用于抽屉标题和分区标题。PC 保留字体、颜色、字重与所选微调，不给整个 App 设置一个大字号，也不统一缩成另一套固定品牌字号。手机默认只跟随主题主色与选中强调，字体、字号、字距、密度及行高继续使用冻结移动规范；PC 文字微调不传入手机页头、字段和 Sheet。

## 读取角色与来源

新交接的 `typography.contract` 为 `makedesign/business-typography/v1`，保留 body／heading／mono 字体声明，并提供 `typography.roles`、`sources` 与 `tracking`。角色值为 px 数字，来源说明所选规范组件 Token、既有业务 profile、平台合同或微调比例；不能只保存最后的数字。

| 角色 | 使用位置 |
| --- | --- |
| `pageTitle` | 宿主已有内容区的页面主标题；不自动新增标题区，不用于固定工作区顶栏 |
| `recordTitle` | 固定工作区顶栏，以及新建、编辑和普通详情的容器标题；HTML h1／h2 标签不决定视觉字号 |
| `sectionTitle` | 业务内容的小节标题 |
| `body` | 业务正文和详情内容 |
| `fieldLabel` | 表单字段标签 |
| `controlText` | 输入、选择和日期等控件文字 |
| `meta` | 辅助说明和次要文字 |
| `phoneHeader` | 手机任务页与应用页头的公开角色；仅作数据／能力参考，默认不应用 PC 方案值 |
| `sheetTitle` | 手机 Sheet 外壳标题的公开角色；默认保留手机规范 |
| `sheetHeading` | Sheet 小节标题的公开角色；默认保留手机规范 |
| `sheetBody`、`sheetMeta` | Sheet 正文与辅助文字的公开角色；默认保留手机规范 |

所选规范的标签和输入字号可以不同，例如 Intercom 原组件分别引用 14px 与 16px，GitHub 则均为 14px；这些是核验源 Token 绑定的例子，不是所有项目的默认。已有业务 profile 使用 14px UI 时也要保留，不能重新取营销或阅读正文的 16px 覆盖它。

用户明确微调的 PC 正文和页面标题应精确保留。其他 PC 正文角色按最终正文与原业务正文基线的比例缩放，其他 PC 标题角色按最终页面标题与原页面标题基线的比例缩放；预设与微调只缩放一次。不要因为验收样例使用正文 18／标题 32，就把抽屉和说明文字全部变成相同值；也不能静默更改用户确实选定的 PC 18／32。手机不参加此 PC 比例缩放，已有 payload 中的手机角色也不构成手机文字定制要求。

默认 `tracking-display` 属于对应 PC 标题角色，不能直接传播给正文和所有控件。存在用户明确的 PC 全局字距微调时，PC 各角色保留该选择；新交接用 `typography.tracking.body`／`heading` 区分。旧 payload 缺少角色或字距分类时，采用已核验的官方／Make 兼容回退并记录来源，保留无法区分来源的既有明确值，不声称还原了完整原规范。旧 URL 经新版 MakeDesign 读取后可补出角色，原 query 与 metrics 保持兼容；手机仍保留原字距。

## 实际组件消费

桌面通过官方组件的 Form 标签字号、Input／Select／DatePicker 等公开字号入口及骨架语义变量分别消费角色；只给根 `fontSize` 赋值不算完成。手机不消费 PC 的 `pageHeaderSize`、`fieldLabelSize`、`controlTextSize` 或 Sheet 角色，使用实际正式包和 [冻结移动视觉](mobile-visual-standard.md) 的原有字号、字体、行高及字距；可编辑输入继续执行 iOS 的 16px 安全下限。默认颜色接入通过 [手机主题](mobile-theme.md) 的 `toMobileBrandTheme` 投影，完整 PC Provider 不包裹手机 View。

在同一个 App 切换正常方案与微调方案，PC 比较页面、容器、字段及辅助文字的实际计算字号、字体、字距及行高；手机检查这些文字属性保持原规范，只有允许的品牌强调色变化。两端都检查标签换行、标题省略、文本域高度、按钮文字可见性，并保留草稿、当前记录与 Controller。用户明确手机定制时才单独记录并核对手机角色与公开能力，不能把 PC 的字号滑杆作为该要求。压力样例不成为新项目默认排版；验收控制区不得遮挡真实操作。
