# 条件组回显与编译异常合同

本合同适用于公共筛选包接入；宿主不得复制包内解析、校验或 DNF 转换逻辑。

## 适用模式

先按 SKILL.md 选择模式，再读取对应合同，不能把高级筛选要求强加给仅搜索页面：

- search-only：仅使用 compileListFilter({ fields, searchText }) 和公共的编译错误处理；不需要 Preset、面板、条件组、草稿、回显或结构错误 UI。只验收空搜索省略筛选、非空搜索走编译器、编译失败不查询及旧查询响应隔离。
- advanced-filter：在通用编译合同上增加本文保存/查询分离、分组和值范围、Preset、结构错误及高级筛选验收。已有 unsupported 保存值仅在该模式处理。

## 修复产物门槛

按所选模式验证实际安装包的公开能力，结合已发布包文档、发布来源和锁文件确认；不能只凭历史最低版本范围或同名 API 声明证明行为符合合同。search-only 只检查关键词编译及错误处理；advanced-filter 另检查本文的分组往返和非法输入行为。发布来源无法确认时，用已安装公开 API 的行为验证补足证据；若缺少所需能力，报告包能力缺口，不以宿主私有解析器补偿。具体修复提交属于变更记录，不作为长期规范的唯一门槛。

## 保存与查询分离（仅 advanced-filter）

- 使用同一份运行时、权限允许的 fields。确认草稿时调用 validateAdvancedFilter，检查 valid 及 structureError；结构错误也阻止确认。
- 保存仅用 compileAdvancedFilterToCel(draft, fields)；真正空树返回 null，对 Preset 写 filter: null。不要将搜索参与编译的结果持久化。
- Preset 稀疏保存成功且请求上下文仍有效后才更新 applied；查询用 compileListFilter({ advancedFilter: applied, fields, searchText })。保留原有 A -> B -> A 单调代次和权限隔离，不只比较 entityKey。
- 保存、Service 透传、Preset 返回、URL 编解码全链路保留表达式原文及括号。不删除括号、重新格式化或扁平化；读回用 parseCelToAdvancedFilter(expression, fields)。单层完整外括号标识编译器复合谓词，双层括号标识显式条件组，独立逻辑链不应合并。
- 解析结果 unsupported 时原样保留 expression，查询用 compileListFilter({ unsupportedExpression: expression, fields, searchText })；保持筛选已应用提示，只在明确替换或清空成功后移除。不能虚构 UI 行、删除部分数组元素或把无法无损表示的大整数转换为字符串。

## 后端逻辑和值范围（仅 advanced-filter）

只提供后端支持的结构：外层 OR、内层 AND，以及同关系嵌套。多子项 AND 中不能嵌套多项 OR；单子项/空组不构成额外逻辑运算。例如 A OR (B OR C) 和 A OR (B AND C) 支持，A AND (B OR C) 不支持。编辑入口、openWithField 与确认均交由包约束；不在宿主写死所有子组为 AND。

复用包内严格校验：number 必须有限，不接受数字字符串或 NaN/Infinity；日期为有效 YYYY-MM-DD，日期时间为 YYYY-MM-DD HH:mm:ss；区间恰有两个有效有序端点；多值操作符使用非空且元素类型正确的数组。附件计数为非负安全整数。“为空/不为空”忽略无用旧 value。独立日期开始/结束条件不是区间值，不由宿主合并。当前用户变量仅用包提供的结构化值及支持的单用户操作符，不推断其他系统变量可编辑。

集合字段不支持 neq；not_in / has_none 使用后端标准否定，不能隐式追加 OR NULL。需要包含空值时显式添加外层“或为空”。未知字段/操作符和值形状由包拒绝，不在宿主维护第二套矩阵。

## 通用编译错误处理

advanced-filter 非空树中的未知字段、缺失元数据、不支持的操作符、非法值或逻辑结构使整个编译失败，不会跳过坏行生成剩余查询。高级筛选与搜索合并由 compileListFilter 等价生成 DNF，最多 256 分支，超限直接报错，不能截断。

所有编译入口使用现有用户错误状态处理异常，禁止 catch 后返回 undefined 并继续请求。undefined 仅表示真正没有筛选；编译错误是独立失败状态：search-only 停止当前记录请求，保留当前记录与错误提示；advanced-filter 还须停止 Preset PATCH，保留 applied 与 draft。不能在 React render/useMemo 中裸编译并让异常击穿页面。

仅 advanced-filter：确认前预检“高级筛选单独保存”和“当前搜索组合查询”都可编译；任一失败不保存、不应用。未变更草稿时搜索词改变也可能超限，查询构建失败仍停止该次请求。若服务器已保存成功但后续查询失败，明确显示已保存/查询失败，保留当前已应用条件，不静默降级或伪装回滚持久化状态。

## 高级筛选行为验收（仅 advanced-filter）

以下全部为 advanced-filter 验收；search-only 只执行“适用模式”中的搜索专项，不引入 Preset、草稿或面板。在实际安装产物及宿主上验证，文档检查不能代替行为测试：

1. A OR (B OR C)、A OR (B AND C)、单条件组、嵌套同关系组：确认后重开、刷新、A -> B -> A 返回仍保留组结构；Preset 中无搜索词，表达式原文含括号保持一致。
2. 非法 A AND (B OR C) 无法确认；逐行与 structureError 均有提示。只有一个关系选项显示静态文字属于包内尚未实现的交互优化，不作为现有能力或宿主覆盖要求。
3. 数值上下界、日期区间的独立虚拟开始/结束字段、显式“为空或 not_in”回显后不合并/丢行；原生区间操作正常。
4. 非法日期、值类型、非有限数、缺失字段及混合好坏条件整体失败；验证 Preset PATCH 和记录请求次数均为零，原结果与草稿保持。
5. 搜索组合 256 分支边界和超限；超限不查询、不截断，移除错误后可重试。
6. 不支持的数组和无法精确表示的大整数保留原文；有限大数、负数保存/回显保持 number，不丢值。
7. 覆盖慢 Preset GET 与新保存交错、旧保存 A -> B -> A 返回、权限撤销后的过期响应，旧请求均不能覆盖新状态。

Service 与宿主分别验收：记录查询表达式及 Preset 保存/读回的括号一致，Service 不解析或重写 CEL。filter 与分组路径 groupFilter 继续分开传输，本合同不增加固定列/看板或分组编译 API。
