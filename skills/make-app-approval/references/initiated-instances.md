# 我的审批已发起与实例详情

适用于已确认新增“已发起”页签或实例详情直达的 Make App。它属于现有“我的审批”，不生成第二个“我的申请”菜单，不扩展抄送、消息通知、Bot、撤回或新的任务动作。

## 包能力

正式 npm `@qfei-design/make-app-approval@0.2.13` 的 `/list` 提供 `tabs={["pending", "approved", "initiated"]}`，默认仍为原两个任务页签，旧 provider 不会被动收到实例查询。`/detail` 提供 `ApprovalInstanceDetail`、`ApprovalInstanceProvider`；实例 reference 只有 processInstanceId，provider 只有 loadDetail，固定只读且没有 submitAction。

已核验 0.2.13 正式产物的公开类型和 ESM/CJS 导出。使用精确版本，UI 与 Service 同版，移除本地候选 tgz、file/link/workspace 包替代和 node_modules 补丁；干净安装、宿主回归及构建仍需通过，不以发布记录替代 App 验收。

## 列表

- UI 经现有 Service 调用 Workflow `/workflow/v1/bpm-process`，POST、`X-Make-Target: MakeService.ListResources`；Service 注入部署 appKey，固定 `viewType: "MY"`。当前发起人由后端决定，不让浏览器替换 App、发起人或 ALL。
- 支持 entityKey、processStatus、startDate/endDate、pagination。页面先只提供发起日期；未支持 recordId 搜索，不把任务 keyword、starterId、assigneeId 或通用 filter/sort 送入此查询，不在当前页本地过滤冒充全量查询。进入已发起清除任务专属筛选。
- data 直接为数组，pagination 位于最外层，成功必须 code=200。分页页码从 1 开始，默认批量 20，后续加载及取消继续交由公共列表 Controller；宿主只分流 provider。
- 行以 processInstanceId 为稳定 id，标记 referenceType: "instance"，不伪造 taskId 或用 recordId 替代实例 ID。startedAt 为发起时间，endedAt 为流程结束时间，不当作任务完成时间或任务审批结果。
- 已发起包含 IN_APPROVAL、RETURNING、APPROVED、REJECTED、CANCELLED，不包含 UNSUBMITTED、启动中或失败。顺序、范围及 total 来自后端，不由前端按终态分类。缺少人员姓名时保留 ID 或沿用占位规则。

## 详情及字段

- 同一 bpm-process 资源的 `MakeService.GetResource` 接受 `{ processInstanceId }`，不混入 taskId、viewType 或业务定位三元组。访问授权由后端判断；前端保留正常登录、请求错误处理与响应定位校验，不另做“本人或参与人”的权限算法。
- formData 与 fieldPermission.viewPermission 来自实例详情，按实例绑定版本的发起节点查看规则展示。字段定义返回结构与任务一致，复用现有字段转换及 renderField，涵盖金额、枚举、人员、部门、附件及关联；实例固定只读，不消费 editPermission/actions，不请求编辑候选、上传或写入。
- 字段定义直接取同次 bpm-process 的 data.formMetadata，processKey 与实例外层 bpmKey 对齐。节点和字段范围来自绑定 BPM 版本，名称、选项、校验、关系来自当前 Meta。复用字段转换，不请求独立元数据接口、不伪造 taskId、不使用最新 START 或普通 entity/Schema 补字段。
- 无可见字段时显示合法空表单；可见字段缺定义明确报错，不猜类型或扩大授权。currentTasks 不是完整历史，也不授予当前用户办理权限。完整历史复用 [历史合同](history.md)，已结束且无当前任务仍可查看。

## 页面与验收

列表详情容器与 `/bpm/instances/:processInstanceId` 共用实例 provider、公共只读控制器、字段适配和历史。独立页不挂载业务菜单或列表，沿用 [独立页合同](standalone-pages.md) 的登录回跳及完整 path/query/hash。PC/手机共用数据合同，手机按 [实例布局接线](mobile.md#手机实例详情) 使用独立的只读插槽，通过公开插槽和现有移动详情控件组合，不包装成伪任务套办理状态机。

scopeKey 隔离应用、环境、租户／权限范围和身份代次；切换实例、身份、权限或卸载取消旧请求，迟到响应不得展示旧字段。失败保留宿主错误出口与重试，不返回空数据伪装成功。

验收覆盖三个页签分流、未支持条件不外发、实例长 ID、终态无 taskId、空字段／缺定义、多类型只读、已有任务办理、独立页登录回跳、刷新和来源参数、失败重试及迟到结果隔离。Skill 合同验证不替代真实 App 和后端联调。
