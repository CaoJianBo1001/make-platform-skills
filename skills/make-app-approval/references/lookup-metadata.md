# BPM Lookup 节点依赖

## 已确认的最小响应

先按 [节点转换合同](node-form-metadata.md) 核验定位并规范化 `fields`。START 和 TASK 使用相同依赖结构：

```json
{
  "fields": [{ "fieldKey": "relatedName", "fieldName": "关联名称", "type": 1, "makeFieldType": "LOOKUP", "lookup": {
    "relationKey": "sample_relation", "targetFieldKey": "title", "targetFieldType": "Make.Field.Text"
  } }],
  "relations": [{ "key": "sample_relation", "name": "示例关联", "type": "Make.Relation", "appKey": "sample_app", "properties": {
    "from": { "entityKey": "sample_target", "cardinality": "one" },
    "to": { "entityKey": "sample_entity", "cardinality": "many" }
  } }]
}
```

上面是 `data` 中依赖部分的裁剪，完整定位和来源见[脱敏成功夹具](../scripts/fixtures/node-form-metadata.json)。关系端点确定目标对象及单/多选，目标 key 确定查询列，目标 type 只用于已有候选搜索/类型分支。源 Lookup 的名称、必填、编辑能力仍来自该字段自身完整定义与节点授权。

## 装配与权限

1. START 按启动配置的 readable/editable 投影源字段；TASK 按当前任务 fieldPermission/actions 投影。选中字段缺失定义必须失败，不用辅助目标字段补源字段授权。
2. 调用[纯依赖解析器](../assets/bpm-lookup-metadata.mjs) `resolveBpmLookupDependencies(normalizedMetadata, fieldKeys)`，取得每个选中 Lookup 的 `{ fieldKey, relationKey, targetEntityKey, targetFieldKey, targetFieldType, multiple }`。当前实体在 from 时取 to，否则在 to 时取 from；自关联遵循已有同一方向，不猜测第二种方向。
3. 宿主可将结果转换为现有局部 metadata 结构并按关系、目标对象/字段去重。旧结构若强制字段 name，可用 targetFieldKey 作为技术占位；不能将它称为真实名称，也不能编造 options、format、validations、capabilities。自关联辅助字段可以补给选择器定位，但不加入实际表单的 view/edit/create 字段集合。
4. UI 显示值来自任务 formData 的名称包装或候选记录的实际标签；纯 ID 无名称则显示 ID，不额外越权查名。目标类型为人员、部门或选项时复用宿主已有值展示规则，不凭类型制造名称。
5. 表单及保存只用节点关系，不补查普通 entity/relation/Schema，不覆盖全局 Schema。普通对象新建/编辑仍遵循原 IAM。START 的新建关系按宿主 relations 合同保存，TASK 的修改仍是 Workflow recordPatch，不互相改写。
6. 候选搜索每次重验最新启动字段或任务授权，只解析当前字段。目标对象、字段、记录读取权限仍由既有 IAM/Data 链路检查；元数据可见不等于目标记录可读。保存也保留目标身份和基数检查；没有后端明确支持的创建关系组合不能猜测合并。

节点接口响应中引用的 relationKey 缺失/重复、跨应用、错误资源类型、端点不匹配、基数未知、目标字段 key/type 缺失或未知，以及相同目标字段类型冲突，返回宿主本地 502 元数据合同错误；保留实际后端失败原文及 Trace。不能静默丢 Lookup 或降级旧接口。未引用的无关依赖缺失不阻塞当前字段搜索。

## START 何时可以省略额外请求

每次打开、保存或候选搜索仍重新核验启动配置和授权。仅在**同一次编排**内，已有成功的 BPM 资料同时满足以下条件时，才可省略额外的 START 元数据读取：定位与部署应用及当前启动节点一致；本次所需的已授权字段定义有效；这些字段所需的 Lookup 关系、目标 key/type 和基数校验通过。表单加载及保存核验可见字段集合，候选搜索仅核验当前可编辑 Lookup 的依赖。已有资料可以来自已确认的完整对象版启动响应或本次已读取的 START 响应，不能来自普通 entity/Schema、浏览器声明或上次请求的缓存。

- 完整字段对象只含 Lookup 的 relationKey/targetFieldKey/targetFieldType，但缺少 relations：仍读取 START 一次，不回退普通 Meta 接口。
- 本次可见字段不含 Lookup：不要求 relations；无可见字段时不为隐藏字段额外请求元数据。
- 补查后的 START 响应必须执行定位、字段和依赖校验；仍不完整则报告合同错误，不重复补查。上游 HTTP/业务失败按原合同透传，不能进入此完整性补查分支。

[参考纯函数](../assets/bpm-lookup-metadata.mjs) 导出 `canReuseBpmStartMetadata(data, expected, fieldKeys)`：data 为本次已有 BPM 资料按已确认合同整理的节点形状，expected 为可信 START 定位，fieldKeys 为上述本次所需的已授权字段。函数复用字段转换器和 Lookup 解析器；完整返回 true，不完整返回 false；调用方据此决定是否读取 START。它不推断授权、拼造缺失定位或合并旧节点快照，不适用于 TASK。完整性判断不替代读取后执行的严格校验，可信参数错误或非合同异常仍抛出。

## 验证

先补失败测试，再实现。随包验证（Node 22+、无外部依赖、无网络）：

```bash
node skills/make-app-approval/scripts/verify-bpm-lookup-metadata.mjs
node skills/make-app-approval/scripts/verify-bpm-start-metadata.mjs
```

安装后按 Skill 实际绝对路径运行。宿主可导出同签名 `resolveBpmLookupDependencies` 的桥接模块，第二个参数传其绝对路径；桥接必须执行宿主真实解析，不能复制期望结果。仓库 CI 运行 `node scripts/test-bpm-lookup-metadata-behavior.mjs`，覆盖真实结构、双向关系、基数、自关联、去重、依赖缺失/冲突、无副作用、3 种故障注入、独立目录运行和宿主桥接失败退出码。

START 验证器同样接受导出 `canReuseBpmStartMetadata` 的宿主桥接；覆盖完整对象但关系缺失、全部齐全、非 Lookup、空字段、定位不匹配与异常传播。仓库 CI 的 `test-bpm-start-metadata-behavior.mjs` 额外注入错误跳过/重复读取判断并验证独立安装。文档来源交接检查与这些行为测试分开，不能用关键词测试证明真实调用链已验收。

宿主仍需验证 START/TASK 的身份、取消、权限撤销、目标候选分页/搜索、保存/办理回读与不调用旧元数据接口。纯依赖测试不能证明后端字段持久化、受限账号权限或真实办理已通过。
