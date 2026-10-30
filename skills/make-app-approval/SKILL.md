---
name: make-app-approval
description: "当新建、迭代或检查 Make App 前台审批接入时使用：需求确认后的默认审批导航、BPM/bpmDefinitionKey、审批新建字段、保存并提交、未提交记录发起、撤回、退回后继续提交、流程状态与标题 Tag，以及 @qfei-design/make-app-approval 我的审批包、待处理/已完成、任务详情办理和审批历史。不负责流程设计器、Console 审批管理、后端审批引擎或未经确认的终态重新发起。"
metadata:
  version: 0.2.25
---

# Make App 前台审批完整接入

把已确认的功能方案转为应用级审批入口，完成业务记录发起/撤回、我的审批列表与办理、历史和状态同步。每个应用只保留一个“我的审批”；业务对象仍使用自己的记录列表。本文及参考文件为可移植合同，不依赖某个示例项目、私人路径或业务字段。

## 工作顺序

1. 从已确认的方案提取业务对象、用户实际写入动作及审批处理能力，读取 [默认生成规则](references/generation-rules.md)。先给出生成或不生成的业务依据，不能只搜“表单”“提交”等词。方案未说明是否存在写入/审批能力时，只确认这一缺失事实，不擅自补功能。
2. 调研宿主导航、Schema、普通 CRUD、字段渲染器、附件/Lookup、请求与权限层及测试；核对实际安装的审批包版本、公开入口和类型。说明拟改文件、复用点和验证方案，不将示例项目的业务限制推广到平台。
3. 完整接入时按下表覆盖所有适用落点。含业务新建能力的方案即使当前没有流程绑定，也生成运行时双分支；仅审批处理的方案不新增业务新建页。完整交付不能只放导航占位页。
4. 使用现有 UI → Service → Make 链路，先同步宿主 API 文档。包拥有的列表/详情状态机直接复用；宿主适配器、字段序列化和请求分层，不复制包实现。桌面/手机共享数据和业务合同，分别按实际组件能力完成 View。
5. 按 [验证场景](references/verification.md) 为宿主行为先补失败测试，再实现。实际包能力、宿主回归、浏览器验收和真实审批写入联调分别报告；只运行技能检查不能宣称应用已接通。

## 按落点读取

| 落点 | 参考 |
| --- | --- |
| 是否生成、导航位置、多端复用 | [默认生成规则](references/generation-rules.md) |
| 审批新建字段、保存与保存并提交 | [发起侧合同](references/initiation-contract.md) |
| 未提交发起、失败恢复、发起人撤回、重新发起边界 | [记录生命周期](references/record-lifecycle.md) |
| 包版本、公开入口、控件适配、我的审批列表与筛选 | [包与列表](references/package-and-list.md) |
| 节点字段、同意/拒绝/退回/继续提交、任务附件及失败恢复 | [任务详情与办理](references/task-detail.md) |
| Service 路由、Workflow Target、DTO、Long ID 与信封 | [接口合同](references/workflow-api.md) |
| 节点字段完整枚举、配置保留、成功响应与异常边界 | [节点字段转换合同](references/node-form-metadata.md) |
| Service 可复用纯转换、宿主转换验证及响应样例 | [参考转换器](assets/bpm-node-form-metadata.mjs)、[行为验证器](scripts/verify-node-form-metadata.mjs)、[脱敏夹具](scripts/fixtures/node-form-metadata.json) |
| Lookup 节点内关系、目标最小描述与单/多选 | [依赖合同](references/lookup-metadata.md)、[纯解析器](assets/bpm-lookup-metadata.mjs)、[行为验证](scripts/verify-bpm-lookup-metadata.mjs) |
| START 已有完整字段对象是否还需读取节点依赖 | [完整性判定](references/lookup-metadata.md#start-何时可以省略额外请求)、[行为验证](scripts/verify-bpm-start-metadata.mjs) |
| 业务详情流程区、任务详情历史插槽、完整时间线与共用结果 | [审批历史](references/history.md)、[历史结果适配器](assets/history-result.mjs) |
| 业务列表/详情流程状态、标题 Tag 和普通编辑限制 | [状态展示与禁编合同](references/status-display.md)、[旧包兼容适配器](assets/record-write-policy.mjs) |
| 升级后核验 UI/Service 实际安装包的普通记录禁编行为 | [公开入口验证器](scripts/verify-record-write-policy.mjs)（参数为宿主包目录，检查 ESM/CJS，不替代入口及保存回归） |
| 核验宿主已安装包的只读策略兼容性 | [包校验脚本](scripts/verify-task-detail-policy.mjs) |
| 已完成/无动作任务的宿主只读策略参考代码 | [参考适配器](assets/task-detail-policy.mjs)（先读任务详情合同） |
| 手机列表、混合编辑详情、时间线、底栏和导航 | [移动端适配](references/mobile.md)、[纯布局适配器](assets/mobile-detail-layout.mjs)（同时读取 makeui 手机规范） |
| 接入验收与回归场景 | [验证场景](references/verification.md) |

## 必须保持的边界

- **导航是方案决策。** 业务新增、录入、编辑保存，或明确审批处理需求即可触发；不要求先绑定流程。无任务、全部流程停用或解绑后仍保留已生成入口及历史访问路径。
- **入口独立位于最外层。** “我的审批”是一级菜单，桌面/平板中紧接所有业务对象/模块分组之后，与其他菜单在同一导航列表中按正常间距排列、共同滚动；不固定到侧栏底部，不单独增加分隔区。它不属于任何对象、模块或可折叠分组，折叠分组不会隐藏它；手机为它保留一个底部 Tab，并按剩余容量展示业务对象和工作台，总数不超过五项。具体布局与复用规则见 [默认生成规则](references/generation-rules.md)。
- **新建是运行时决策。** 成功取得的 Schema 对象含有效 `bpmDefinitionKey` 才进入审批新建分支。配置读取失败是错误态，不能等同未绑定。
- **审批新建字段独立授权。** 使用 `bpm-start-config.fields` 的 `readable/editable`；字段只返回 key 时由 Service 用 `/workflow/v1/bpm-node-form-metadata` 的 START 场景补齐定义，再交给 UI。不与普通 IAM 字段集合或 `createFields` 求交。应用、对象、新建操作、关联目标和后台最终授权仍保留。
- **任务办理另用当前节点授权。** 任务详情的 fieldPermission/actions 决定字段和动作；字段基础定义通过 `bpm-node-form-metadata` 的 TASK 场景读取，不从普通 entity 或 Schema 获取。节点字段定义不代表全部可见或可写；不能套普通编辑字段或启动节点字段，也不经普通记录 PATCH 保存任务修改。
- **区分新建提交和已有记录发起。** 仅保存不发起；新建“保存并提交”使用一次 `bpm-process-submit`，不先普通创建再发起。已有记录仍用原 `bpm-process`。发起前查询当前登录人的所属部门，多部门时选择 `starterDepartmentId`；普通保存和任务 SUBMIT 不触发部门选择。错误沿用 code=200 成功、其他 code 显示对应信息的统一处理，不增加“核查流程”按钮；合并提交失败码不等于记录未创建，落库结果未确认时阻止重复创建，详见 [保存会话](references/initiation-contract.md)。
- **已有记录的发起与保存独立。** 对象有有效 BPM 绑定、记录明确 UNSUBMITTED 且未锁定时，业务详情保留独立“发起审批”，不要求普通编辑权限且不执行普通保存；具备普通编辑资格时，编辑页另提供“保存”和“保存并提交”，沿用原 IAM、记录权限及原 ID。保存会话内的失败恢复仍只执行尚未完成的发起阶段。
- **恢复与继续提交分开。** 已有记录仅明确 UNSUBMITTED 且未锁定时首次发起；RETURNING 通过当前任务 SUBMIT“继续提交”继续原实例。已撤回/拒绝/通过的记录不生成终态重新发起。
- **撤回由真实发起人资格决定。** 读取最新流程及 starter，确认时重查；使用 appKey/entityKey/recordId 定位，不需要 bpmKey，不以业务申请人或普通编辑权限推断资格。
- **状态来自记录。** `qfei_process_instance_status` 是只读系统字段；不新建同名 DSL 业务字段，不用业务状态、任务结果、锁字段或当前绑定推导流程状态。
- **审批运行态及三种终态禁止普通编辑。** `IN_APPROVAL`、`RETURNING`、`APPROVED`、`REJECTED`、`CANCELLED` 或明确锁定的记录隐藏普通编辑按钮/菜单，单元格不得进入编辑或接受迟到提交；已通过、已拒绝、已撤回即使解锁也保持只读。入口、保存及后台写入共同执行 [禁编合同](references/status-display.md#锁与范围)。公共包 0.2.11 尚未原生覆盖已拒绝、已撤回，须统一宿主适配；不把普通禁编套到当前节点授权的任务办理，删除资格仍独立判断。

## 与现有 Skill 配合

| 落点 | 责任 |
| --- | --- |
| [makeui](../makeui/SKILL.md) | Shell、导航、Drawer/手机任务页、宿主字段控件与外观；本 skill 定义审批分支、包接线、字段与动作合同 |
| [make-app-permission](../make-app-permission/SKILL.md) | 普通 IAM、应用/对象/操作权限；审批新建与任务办理分别消费 Workflow 授权，普通 CRUD 不受放宽 |
| [make-app-service](../make-app-service/SKILL.md) | 请求、登录、配置、缓存、Trace 与透传；本 skill 提供 Workflow 接口映射及节点/附件授权边界 |
| [make-app-actions](../make-app-actions/SKILL.md) | 普通记录操作入口、预检及批量能力；消费同一锁判断，不复制审批任务动作 |
| [canvas-table-integration](../canvas-table-integration/SKILL.md) | 桌面列表的只读系统列；手机沿用卡片，不为状态展示新增表格 |
| [makedsl](../makedsl/SKILL.md) | 业务对象建模；不为流程状态或锁补业务字段，不生成流程定义 |

## 交付范围

完整接入包含导航、审批新建与首次发起、未提交记录恢复、撤回、列表/详情状态、任务中心 npm 接入、节点字段编辑与办理、退回继续提交、审批历史、成功后刷新及错误恢复。特定改动只读取相应参考，保留已有完整能力。

不生成流程定义/设计器、Console 管理、跨应用任务中心或后台引擎。手机列表先核对 [包与列表](references/package-and-list.md#多端边界) 的产物门禁，使用公共包手机模式；手机详情复用公开布局插槽，历史 View 按参考接入并验证，不能复制列表/办理 Controller 或虚构包 API。发现实际安装包能力缺失或后端写入/状态回读不一致时说明具体缺口，不以假数据、静默补写或移除授权检查冒充完整接入。
