# 草稿宿主边界验收

业务草稿场景仅在项目明确启用时接入；固定默认值项目可独立验证数值最终 JSON，不为验收添加草稿字段、按钮或 TASK 能力。规则以 [业务草稿合同](business-record-drafts.md) 为准；该工具是宿主测试接口，不是新增 Make API、权限点或运行时依赖。

## 运行与接线

将随包 [验证器](../scripts/verify-draft-host-boundaries.mjs) 接入宿主已有测试。安装后可用实际 Skill 绝对路径运行；项目 CI 应复制工具或使用版本化依赖，不引用开发者私人路径：

```bash
node "<make-app-service-skill-dir>/scripts/verify-draft-host-boundaries.mjs" "<host-adapter.mjs>"
```

宿主适配器导出 `async runDraftHostCase(scenario, captureRequest)`，调用生产 UI 保存控制器、任务权限归一化、Service 路由/处理器及已有序列化。使用现有技术栈和测试运行器；不能复制被测规则、返回预先算好的通过结果，或只测 Skill 示例函数。可 mock Make HTTP、身份和环境边界，不发真实平台写入。

在真实请求层序列化之后、mock Make 传输之前，将实际 `{url, method, target, body}` 交给 `captureRequest`；`target` 取实际 X-Make-Target，`body` 必须是最终 JSON 字符串。不能把 mock API 参数、内存表单或重新构造的对象当作最终请求。每个场景隔离宿主会话和请求记录；预期拒绝应由真实操作产生可观察失败，适配器可把生产 HTTP/业务拒绝映射为异常，不自行添加业务校验。

`scenario` 提供测试用 `policy`、原始 `task`、reference、字段及输入意图。将它们装配到既有授权/配置/HTTP fixture；测试 policy 是服务端可信配置，不能从生产浏览器请求启用。通过下述 mapping 将场景中的业务角色设为宿主真实 entityKey/fieldKey 与枚举值；验证器按配置构造 fixture 并核对原始最终 JSON。不能改写 captureRequest 的 body 来做键映射；未登记同名字段必须仍按原 TASK 权限处理。

可选导出测试配置 `draftHostCapabilities`，只选择宿主实际已有能力；它不是生产请求参数。未提供时验证完整的 27 场景。仅默认值示例：

```js
export const draftHostCapabilities = { draftEnabled: false, intents: ['save'] };
```

此配置只运行 4 个数值场景，不要求草稿状态字段或 TASK；已有保存并提交时可加入 submit，成为 8 个数值场景。启用草稿但没有 TASK 的对象可以设置 `taskEnabled:false` 并按实际动作设置 intents。工具输出实际数量与范围，不能将局部通过声称为完整草稿/TASK 通过；不为了满足工具而新增业务能力。通过导入函数运行已有测试时，第二个参数接受相同配置。

TASK-only 可以设 `intents:[]`，不要求新增保存入口。源对象没有草稿但目标对象有草稿策略时，可设 `{draftEnabled:false,intents:[],taskEnabled:true,taskManagedFields:false,taskReferences:true}`，仅验证候选、正常目标放行、草稿目标拒绝及 RETURN，共 4 场景；夹具不生成源保存状态字段、权限或补丁。完整 TASK-only 是 15 场景。各组按项目真实能力启用，原有审批默认生成规则不能覆盖用户已明确限定的范围。

固定业务键的宿主可选配置 mapping，示例如下；源文本、目标显示字段、关系键以及源/目标状态均可独立映射：

```js
export const draftHostCapabilities = {
  mapping: {
    sourceEntity: 'invoice', targetEntity: 'contract',
    stateField: 'recordStage', normal: 'saved', draft: 'editing',
    numericField: 'amount', textField: 'description', lookupField: 'contractRef',
    targetTextField: 'name', relationKey: 'invoice_contract',
    targetStateField: 'saveStatus', targetNormal: 'formal', targetDraft: 'drafted',
  },
};
```

未配置 targetTextField 时沿用 textField，保留源/目标使用同一文本字段的简写；配置后使用独立目标显示字段。候选检查不固定宿主搜索表达式的引号或重写 CEL。需要检查原表达式原样保留时，可将 `searchExpression` 配置为宿主原编译器对本夹具的实际结果；这是验证期望，不是新增 TASK API 参数。未配置时不强求某个字面表达式，仍检查配置字段、AND、候选结果与分页。表达式语义必须由实际查询 fixture 或后端执行证明，不能用预计算结果冒充。

## 场景接口

| kind | 适配器驱动真实路径 | 返回及通过条件 |
| --- | --- | --- |
| numeric-record | 根据 intent=save/draft/submit，挂载真实新建表单或真实保存控制器；absent 不产生 quantity key；clear/zero/untouched 先按 field.defaultValue 初始化再分别清空/输入 0/保持未触碰；最终经 Service 提交 | 捕获实际 Record 或合并提交 JSON；分别无 quantity、quantity:null、quantity:0、quantity:18；状态同次生成；仅 Record 草稿带 isDraft=true |
| task-detail | 用原始 task、configured 及可信 policy 加载真实任务字段归一化 | 返回 `{fields:[{key,visible,editable}],actions}` 的薄形状映射。原权限先校验；登记字段只读，其他字段/动作不变；未登记同名字段仍可编辑 |
| task-action | 驱动真实任务动作，使用 actionType、recordPatch 和合法意见；RETURN 的唯一目标来自 task.actions | 非 RETURN 的管理字段补丁明确失败，零上游写入；合法 APPROVE/REJECT/SUBMIT 的其他字段可写；最终 JSON 的 processInstanceId、taskId、actionType、comment 与本次输入一致；未登记同名字段不误拒；RETURN 的 targetNodeKey 匹配唯一授权目标，固定空补丁且不读引用 |
| task-lookup | 驱动真实 TASK 候选 provider/Service；使用 scenario.targetRecords 的 21 条匹配关键词的正常记录、1 条不匹配关键词的正常记录、1 条草稿和 2 条 null/未知状态记录，资格在分页前生效 | keyword=x、page=2、size=20；真实查询在分页前带正常资格与宿主搜索的 AND，结果 `{ids:["900000000000000011"],total:21}`；不补查源 Schema |
| task-reference | 在候选加载后分别将目标 fixture 状态设为 targetState 的正常值、草稿值，再通过真实 TASK 动作提交 related | 实际 POST/GetResource 的 appKey、entityKey、recordID 必须匹配本次所选目标；正常目标在动作写入前完成重查并保留原补丁办理，草稿目标重查后真实操作失败且 Workflow 写入为零 |

数值缺 key 场景没有配置默认值；clear/zero/untouched 场景提供默认值 18，用来发现清空后被序列化成 undefined、或 0 被默认值覆盖的错误。真实表单已经存在预填值时，该 key 已存在，不能将“用户未触碰”误解为省略字段。保留元数据的 required；只读管理字段不参与可编辑必填校验，而不是删除字段 validations。

TASK 动作需沿用合法 comment 和 RETURN 唯一 targetNodeKey；验证器逐项核对实际序列化后的动作与定位，不能只以空补丁或请求路径证明 RETURN 正确。引用重查核对所选目标，读取其他 App、对象或记录不能代替；正常目标的正例防止把所有引用一律拒绝后误报通过。验证器输入中的原始权限非法场景须先失败，不能通过只读收紧掩盖；管理字段缺值的正常动作则必须可以提交其他合法字段。没有 TASK 能力的项目可以在既有测试中运行实际适用场景，明确记录未覆盖项，不能把省略场景记为完整通过。

## 证据与限制

完整配置覆盖 27 个场景，局部配置明确报告实际范围；仓库测试会故意注入缺失 null、把 0 改为默认值、TASK 放行/静默删字段、隐藏非法权限、丢失正式过滤，以及错误动作、定位、意见、退回目标、引用重查对象与读写顺序等错误，证明工具会拒绝。隔离安装后的 CLI 对这些错误返回 1，不输出通过结论。该工具的自测或测试替身通过只说明工具有效，不代表业务项目已经完成接入；升级工具后需重跑宿主适配，旧 24 场景的结果不能覆盖新增检查。

宿主测试应记录运行入口、真实控制器/处理器的薄适配及捕获边界。目标资格的表达式语义、分页/total、状态转换和并发保护还要用宿主原查询测试及真实平台验收；不能把简单表达式标记检查当作 CEL 求值证明。手机实际控件、浏览器/飞书交互、外部消费者和后端部署能力继续按各自合同验收。
