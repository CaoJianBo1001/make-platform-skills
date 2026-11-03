# 业务记录发起、恢复与撤回

先区分业务记录 `recordId`、流程实例 `processInstanceId`、个人任务 `taskId`。流程状态与任务动作不同；“重新发起”不能当作任意终态都可再次创建实例的许可。

## 发起与恢复决策

| 当前记录/场景 | 入口与行为 |
| --- | --- |
| 新建且取得有效启动配置 | “保存”或“保存并提交”，按 [发起合同](initiation-contract.md) 分别调用原创建接口或一次新建合并提交接口 |
| 已保存、明确 `UNSUBMITTED`、`qfei_is_locked !== true`、对象仍有有效 key | 详情显示独立“发起审批”，仅对原 ID 发起，不要求普通编辑权限；有普通编辑资格时，编辑页同时显示“保存”和“保存并提交”，后者先更新原记录再首次发起 |
| 已有记录编辑保存成功、发起失败/未确认 | “继续发起审批”是恢复未完成阶段；先核查，确认仍可发起才请求，复用原 ID/附件 |
| `IN_APPROVAL` / `RETURNING` | 不在业务对象再次发起；符合条件的发起人可撤回。退回任务按实际 `actions.SUBMIT` 在我的审批中“继续提交” |
| `APPROVED` / `REJECTED` / `CANCELLED` | 当前已验证实现不提供再次创建实例的“重新发起”；恢复检查遇到这些状态仅同步结果，不调用 start |
| 状态缺失、null、空、未知值或已锁定 | 不把它当成未提交，不自动发起；按真实状态/读取结果处理 |

当前状态矩阵刻意区分“首次发起恢复”“退回继续原实例”“终态新开实例”。如需求另行要求终态重新发起，必须先取得对应后端接口、允许状态、原记录复用与实例幂等合同，再扩展；不能仅改按钮条件调用旧 start，也不能复制新记录冒充重新发起。

已有记录普通编辑继续走原 IAM 和更新 API，并叠加 [普通编辑禁编条件](status-display.md#锁与范围)：APPROVED、REJECTED、CANCELLED 即使未锁定也不可普通编辑，不能为发起切换成启动字段授权。Service 发起接口检查当前对象及有效绑定，将最终发起资格交 Workflow；不额外要求普通记录 create/update/read 权限。刚保存但无普通读权限的会话保留已返回 ID，不能用强制 Data 读回作为唯一恢复路径；结果未知且无法核实时停在待核查状态。

新建仅保存后再次打开，详情保留独立“发起审批”，包括有合法发起资格但没有普通编辑权限的用户。详情发起按 [发起部门](initiation-contract.md#发起部门) 确认部门，再提交原 ID 与 starterDepartmentId，不调用普通创建、更新、关系写入或附件上传；Service 的发起路由也不套普通 CRUD 写入权限中间件，最终由 Workflow 校验资格。编辑入口仍要求普通编辑资格；编辑页的保存并提交先完成原记录更新、关系和附件，更新失败不发起。发起失败而表单仍打开时保留原 ID 与已完成写入，不重复保存/上传；关闭后仍可从详情独立发起。PC 和手机共享此业务规则。

下面仅组合 UI 候选入口，不授予 Workflow 权限，不替代提交时的最新状态检查或后端授权。canEdit 来自宿主现有普通编辑资格；无普通读权限的刚保存会话沿用前文恢复合同，不强制普通 Data 回读。

```js
export function getSavedRecordApprovalIntents({ hasDefinition, status, locked, canEdit }) {
  const start = hasDefinition === true && status === 'UNSUBMITTED' && locked !== true;
  return { start, saveAndStart: start && canEdit === true };
}
```

点击独立发起前重新核对最新状态、有效绑定与锁，不能仅用按钮出现时的旧快照；若因现有读取权限无法可靠核实，按已确认的 Workflow/会话恢复合同处理，不放宽普通记录读取。发起结果未知时先核查，不自动重发。

## 撤回资格

业务详情按 `entityKey + recordId` 查询 `bpm-process / GetResource`，校验返回定位与当前记录一致，从 `starter.userId` 取得真实发起人：

- 当前登录用户与真实 starter 相同；字符串 ID 无损比较，数值只允许安全整数转换。
- 最新 `processStatus` 为 IN_APPROVAL 或 RETURNING，且没有 endedAt；无可靠发起人、读取失败或流程已结束，不显示/不执行撤回。
- 不以业务 applicant 字段、创建人猜测 starter，不以普通编辑/删除权限授予撤回。
- 用历史实例/记录定位，不能依赖当前 bpmDefinitionKey；停用、解绑不能删除仍可访问的历史和合法撤回接点。

只在满足资格的业务详情提供“撤回”，列表没有本期新增的批量撤回。发起人撤回和审批人的 RETURN/REJECT 是不同操作，不能互相替代。

桌面/平板详情头部的撤回按钮沿用同组操作的紧凑尺寸；表单窄屏放大规则应限定在新建/编辑容器，不能因窗口缩窄把详情按钮单独拉高。手机独立任务页仍按 makeui 的触控尺寸适配，不复制示例宿主的抽屉宽度或 CSS 数值。

## 撤回交互与请求

点击后复用宿主确认容器，说明撤回会结束流程并关闭未处理任务，要求填写撤回原因。复用包的 `getApprovalWithdrawalCommentError` 和 `APPROVAL_WITHDRAW_COMMENT_MAX_LENGTH`：trim 后非空、最多 1024；字段旁提示错误、聚焦，输入后清除。提交期间互斥、禁用重复确认。

确认时重新查询最新流程并复核资格，然后通过宿主 Service 发送 `{ comment: trimmedComment }`。Service 使用部署 appKey 与路径的 entityKey/recordId，向 `bpm-process / UpdateResource` 发送 `{ appKey, entityKey, recordId, comment }`。**不要求也不发送 bpmKey**；后端校验真实发起人、实例定位、状态及并发。

成功返回校验：recordId 匹配，processInstanceId 非空，status 和 processStatus 均为 CANCELLED，processEnded 为 true。不匹配或响应不完整属于结果待核查，不能按成功关闭或直接重发。

确认成功后关闭弹层、使当前撤回按钮失效，刷新业务详情/列表、系统状态与历史；普通刷新失败不得恢复成可撤回并再次提交。业务记录解锁可能异步，前端不能把 qfei_is_locked 强改 false；重新读取后按真实锁与普通 IAM 决定编辑资格。网络失败保留原因，再操作前重查流程，不能自动重发。

## 状态读取不一致

操作响应、Workflow 实例与 Data 记录可能出现不一致，须记录安全诊断和 Trace 并提示核查。消费本次已确认动作结果刷新同一记录，保留 [状态展示](status-display.md) 的首次发起即时回显边界；不无限保留旧状态、伪造系统锁、强插业务列表，或额外普通 PATCH 补写后端应处理的关系/状态。后端成功写入与可读性是联调验收项，前端回归通过不能替代。
