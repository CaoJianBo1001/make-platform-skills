# 业务列表、详情和标题状态

业务记录的系统字段 `qfei_process_instance_status` 是状态来源，`qfei_is_locked` 是锁来源。二者含义独立；既有业务生命周期字段照常保留，不重命名成审批状态。

## 展示合同

| 记录原始值 | 展示文案 | 标题 Tag |
| --- | --- | --- |
| 字段缺失、`null` | 灰色 `-`，没有明确流程状态 | 不显示，不占标题空间 |
| 明确 `UNSUBMITTED` | 未提交 | 显示中性“未提交” Tag |
| `IN_APPROVAL` | 审批中 | 显示进行中语义 |
| `RETURNING` | 退回中 | 保留进行中语义，名称与审批中区分 |
| `APPROVED` | 已通过 | 显示成功语义 |
| `REJECTED` | 已拒绝 | 显示拒绝语义 |
| `CANCELLED` | 已撤回 | 显示结束/撤回语义 |
| 未识别值（含空字符串） | 状态未知 | 中性 Tag，不猜测完成结果 |

以上映射只适用于记录的流程状态（或已确认动作响应的 `processStatus`），不能拿实例 `status`、任务状态、个人“同意”结果套用。`RETURNING` 是流程仍在运行的退回状态，名称为“退回中”，不是未提交；撤回和继续提交的入口见 [记录生命周期](record-lifecycle.md)。

六种流程状态使用上表后端确认名称，随包 [流程状态适配器](../assets/process-status.mjs) 复用 `getApprovalStatusDisplay` 的 tone 与缺失/未知值处理，仅统一已确认状态的 label。已安装包的名称可能仍为 APPROVED“已同意”、RETURNING“审批中”、UNSUBMITTED“-”；宿主通过公开布局和自己的状态标签接入同一薄适配，不修改包源码、不递归改写包内部 React 节点或用 CSS 替换文字。业务列表、详情字段、标题 Tag、已有筛选选项和审批任务详情的头部/摘要都使用相同名称。

```js
const display = formatApprovalProcessStatus(value, getApprovalStatusDisplay);
// 宿主 Tag 使用 display.label 和原主题 tone；加载时仍保留原错误/重试布局。
```

任务详情通过公开 `renderLayout` 接入标题，按以下规则处理：

- 已安装包的标题名称符合本合同，可完整复用 `slots.title`。需要修正文案且存在 detail 时，用 `slots.detail.processStatus` 和共享状态适配器在宿主生成完整的标题与标签组，替换原 title；不同时渲染两组，不拆改包内部 React 节点。
- 加载或失败且无 detail 时保留 `slots.title`，不猜测状态；原 content 的加载、错误与重试仍由同一控制器提供。
- 替换时保留既有标题的语义、字号、字重和间距；窄宽度、全屏及加载前后保持一致。标题后只展示一个状态 Tag，缺失状态不占位。
- 数据、actions、content、footer 和权限继续由原控制器管理，不为了修正文案绕开授权。手机 header/summary 同样从公开 detail 接入共享适配器，不另写一份映射；无 detail 时也保留原 title。

历史事件按 [审批历史](history.md) 直接展示 actionResult（如“已同意”“已退回”），不套流程状态名称。

缺失状态显示 `-`，不能据此显示发起按钮；读取失败应展示错误/重试，不能用 `-` 假装读取成功。仅保存返回 UNSUBMITTED 才显示未提交，不产生“已保存”“待补充”之类的流程状态。旧数据若返回空字符串，不能把它升级为 UNSUBMITTED 或获得发起资格。

## 列表与详情字段

- 为接入审批展示的业务列表和详情添加一个只读“流程状态”展示字段，放在首个业务字段之后；没有业务字段时单独展示系统字段即可。各业务表单仍只显示自身有权读取的记录。
- 只在展示装配层补列/详情项。若 Schema 已含 `qfei_process_instance_status`，按稳定 key 去重，不重复添加；不存在时不伪造可写业务 Schema、不改变全局字段权限集合、不写 DSL。
- 当前对象未绑定但应用已接入审批时仍可显示 `-`；记录已有真实状态时必须展示，即使流程后来停用或解绑，不能用当前 `bpmDefinitionKey` 把历史状态覆盖成 `-`。
- 系统字段不放进新建/编辑控件、批量字段选择和创建/更新载荷，不因为声明为文本展示类型而变成可编辑文本。显示系统状态不授予额外记录读取资格。
- Service/UI 记录映射保留状态和锁，包括显式 fields、分页、已启用的分组叶子查询及详情；使用随记录返回的元数据，不为每一行发起额外审批请求。
- 默认只新增展示，不新增流程状态筛选、排序或分组能力；若宿主已提供则保留其后端合同，不在当前已加载页本地过滤冒充全量结果。此处指业务记录列表；“我的审批”包列表目前没有状态列或筛选。

## 详情标题与手机

标题保留已有对象名/业务名称/编号，Tag 紧跟标题，二者属于同一个左侧标题组。桌面/平板业务详情的顺序为全屏控件 → “详情”模式标记 → 原标题 → 审批状态 Tag；右侧放当前符合条件的“发起审批”或撤回按钮；独立发起不依赖普通编辑权限，有普通编辑资格时另可在编辑页“保存并提交”，关闭 X 位于最右端。Tag 不放入右侧 extra/actions，不置于标题前，也不通过弹性占位推到按钮旁。长标题只对文字溢出处理，保留紧邻的 Tag 和可操作的按钮。

新建/编辑及“我的审批”任务详情的具体顺序统一遵守 [审批头部布局](../../makeui/references/drawer-layout.md#approval-header-placement)。复用宿主现有 Tag、主题语义和布局，不硬编码新品牌色、圆角或状态样式。状态为 `-` 时，详情字段仍展示 `-`，标题不显示空 Tag 或预留间隔。

手机卡片和全屏详情与桌面共用状态映射，按已有布局显示只读状态；不要挂载隐藏 CanvasTable，不因状态 Tag 改成桌面抽屉布局。

保存、首次发起和刷新后更新列表、详情字段、标题 Tag 的同一记录。不要用保存成功回调乐观写死审批中；真实状态以后台返回或重新查询为准。普通详情的业务字段保持原读取权限，不能复用发起节点权限扩大可见范围。

首次发起成功后，使用响应中的 `processStatus` 立即更新同一记录的列表、详情和标题。若本次操作紧接着的列表查询仍返回缺失、空值或 `UNSUBMITTED`，不得用该值覆盖已确认的发起结果；查询返回非空真实状态时，以查询值为准。此规则仅用于本次保存并提交的即时回显，不得给仅保存、发起失败或结果未知的记录推断状态。

## 锁与范围

宿主统一禁编判断：`qfei_is_locked === true` 或 `qfei_process_instance_status` 为 `IN_APPROVAL` / `RETURNING` / `APPROVED` / `REJECTED` / `CANCELLED` 即禁止普通编辑。即使锁字段为 false/缺失，审批运行态及已通过、已拒绝、已撤回记录仍禁编；即使状态为 `-`，明确锁定仍禁编。判断不依赖当前 `bpmDefinitionKey`、审批展示开关、是否生成了状态列或普通 update 权限是否允许。

- 记录行菜单、单条选择操作栏、手机卡片及宿主原有详情编辑入口均**不渲染编辑按钮/菜单项**，不能只置灰或点击后提示。当前选择范围内有已知禁编记录时，隐藏针对该选择的批量编辑入口；不能静默剔除这些记录后改写其他记录。跨页/全选未加载记录仍由原预检与最终写接口校验，不把已加载记录都可编辑当作全范围授权。普通行级 IAM 拒绝的反馈规则仍由 make-app-actions 管理。
- 表格按记录判定，不因同列其他行可编辑而开放禁编行，也不把整张表全部禁用。鼠标双击、键盘和程序化入口在挂载编辑器前均须检查；被拒绝时通过公开取消接口结束，不挂载编辑控件。保存、draft 接收及 `edit:end` 等最终提交回调按稳定记录 ID 读取最新宿主记录，再查同一禁编条件，不能使用激活时的旧行快照。已经打开的普通表单/单元格观察到记录进入审批、变为 APPROVED、REJECTED、CANCELLED 或锁定后，停止编辑并拒绝旧会话继续提交；不得再发起业务更新或附件上传，也不接受旧会话的迟到成功回填。
- 隐藏入口不能替代授权：直接编辑路由、旧按钮回调和并发期间变更的状态也不能绕过限制；Service/平台最终写入口须依据权威状态与锁拒绝普通更新，拒绝响应按现有错误合同反馈。预检或前端缓存不能代替最终写校验。

`APPROVED`、`REJECTED`、`CANCELLED` 三种终态按产品确认全部禁止普通编辑，独立于锁字段和普通 IAM 允许结果。撤回成功不能恢复编辑。删除资格继续按独立删除权限及后端合同判断，不从隐藏编辑按钮推导。

### 公共包与宿主适配

0.2.11 的 `getRecordApprovalWriteRestriction` 只原生覆盖明确锁定、运行态和 APPROVED；未锁定的 REJECTED、CANCELLED 仍返回 null，不满足三终态只读合同。当前宿主将随包 [兼容适配器](../assets/record-write-policy.mjs) 复制到已有共享模块旁，统一委托包函数；UI 和 Service 的普通编辑入口及保存检查均复用此模块，不混用直调旧包的旁路：

```js
import { getRecordApprovalWriteRestriction as packageRestriction } from '@qfei-design/make-app-approval';
import { getOrdinaryRecordWriteRestriction } from './record-write-policy.mjs';
export const getRecordApprovalWriteRestriction = (record, options) =>
  getOrdinaryRecordWriteRestriction(record, packageRestriction, options);
```

适配器保留公共包原有限制及异常，只在包返回 null 时补齐三种终态；APPROVED 返回 approved，REJECTED/CANCELLED 返回既有公开原因 ended，提示分别为“该数据审批已拒绝，不可编辑”和“该数据审批已撤回，不可编辑”。消费方穷举分支须支持 approved/ended；null 仍需原有 IAM 判断。它是参考源码，不是 npm 新导出，不修改 node_modules。

分别以 UI、Service 包目录为参数执行 [公开入口验证器](../scripts/verify-record-write-policy.mjs)：默认模式检查实际 ESM/CJS 原生行为，0.2.11 对新合同失败属于已知缺口；追加 `--compat` 检查实际安装包与随包参考适配器的组合。兼容模式通过不代表真实宿主已接线，必须再按 [禁编矩阵](verification.md#普通编辑禁编矩阵) 验证实际入口、保存和最终写接口。不能把参考测试当成应用验收。

未来升级时同步 UI/Service 依赖与锁文件，只有实际发布产物原生通过完整三终态矩阵后才可移除补充分支，保留宿主统一入口及所有调用点。当前不声明任何新版已发布或已修复。

普通禁编升级不改变 [流程状态名称适配](#展示合同) 和 [已完成任务只读适配](task-detail.md#已完成任务与无动作任务的只读归一化)，不得一并删除。若后端最终写校验尚未发布，明确报告缺口，不把前端已隐藏入口描述为后端已禁止修改。

`getRecordApprovalWriteRestriction` 只约束普通记录写入，返回 null 仍须普通 IAM 授权；不能拿它阻止节点授权的任务办理。撤回、任务办理和历史分别遵守对应参考，不从状态 Tag 猜测动作或发起人。流程图/设计器不属于前台历史表格接入。
