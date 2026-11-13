# BPM Lookup 节点依赖

## 已确认的最小响应

先按 [节点转换合同](form-metadata.md) 核验定位并规范化 `fields`。新建、任务与实例使用相同的 formMetadata 依赖结构：

```json
{
  "code": 200,
  "data": {
    "formMetadata": {
      "appKey": "sample_app", "entityKey": "sample_entity",
      "processKey": "sample_flow", "nodeKey": "start", "nodeName": "提交申请",
      "fields": [{ "fieldKey": "relatedName", "fieldName": "关联名称", "type": 1, "makeFieldType": "LOOKUP", "lookup": {
        "relationKey": "sample_relation", "targetFieldKey": "title", "targetFieldType": "Make.Field.Text"
      } }],
      "relations": [{ "key": "sample_relation", "name": "示例关联", "type": "Make.Relation", "appKey": "sample_app", "properties": {
        "from": { "entityKey": "sample_target", "cardinality": "one" },
        "to": { "entityKey": "sample_entity", "cardinality": "many" }
      } }]
    }
  }
}
```

上面是三个读取响应中 `data.formMetadata` 依赖部分的裁剪；外层任务、实例或启动配置的其他字段未列出，完整定位和来源见[脱敏成功夹具](../scripts/fixtures/form-metadata.json)。关系端点确定目标对象及单/多选，目标 key 确定查询列，目标 type 只用于已有候选搜索/类型分支。源 Lookup 的名称、必填、编辑能力仍来自该字段自身完整定义与节点授权。

## 装配与权限

1. START 按启动配置的 readable/editable 投影源字段；TASK 按当前任务 fieldPermission/actions 投影；实例只按 viewPermission 投影只读字段，不请求编辑候选。选中字段缺失定义必须失败，不用辅助目标字段补源字段授权。
2. 调用[纯依赖解析器](../assets/bpm-lookup-metadata.mjs) `resolveBpmLookupDependencies(normalizedMetadata, fieldKeys)`，取得每个选中 Lookup 的 `{ fieldKey, relationKey, targetEntityKey, targetFieldKey, targetFieldType, multiple }`。当前实体在 from 时取 to，否则在 to 时取 from；自关联遵循已有同一方向，不猜测第二种方向。
3. 宿主可将结果转换为现有局部 metadata 结构并按关系、目标对象/字段去重。旧结构若强制字段 name，可用 targetFieldKey 作为技术占位；不能将它称为真实名称，也不能编造 options、format、validations、capabilities。自关联辅助字段可以补给选择器定位，但不加入实际表单的 view/edit/create 字段集合。
4. UI 显示值来自任务 formData 的名称包装或候选记录的实际标签；纯 ID 无名称则显示 ID，不额外越权查名。目标类型为人员、部门或选项时复用宿主已有值展示规则，不凭类型制造名称。
5. 表单及保存只用节点关系，不补查普通 entity/relation/Schema，不覆盖全局 Schema。普通对象新建/编辑仍遵循原 IAM。START 的新建关系按宿主 relations 合同保存，TASK 的修改仍是 Workflow recordPatch，不互相改写。
6. 候选搜索每次重验最新启动字段或任务授权，只解析当前字段。目标对象、字段、记录读取权限仍由既有 IAM/Data 链路检查；元数据可见不等于目标记录可读。保存也保留目标身份和基数检查；没有后端明确支持的创建关系组合不能猜测合并。

节点接口响应中引用的 relationKey 缺失/重复、跨应用、错误资源类型、端点不匹配、基数未知、目标字段 key/type 缺失或未知，以及相同目标字段类型冲突，返回宿主本地 502 元数据合同错误；保留实际后端失败原文及 Trace。不能静默丢 Lookup 或降级旧接口。未引用的无关依赖缺失不阻塞当前字段搜索。

## 每次只读取对应资源

新建、任务、实例分别从 bpm-start-config、bpm-task、bpm-process 的 data.formMetadata 取得 fields/relations。每次打开、保存、办理或候选搜索保留已有重验授权，不跨请求缓存；定义或当前 Lookup 所需依赖缺失直接报错，不做完整性补查、不重试其他元数据接口。实例只读，不开放候选和上传。

## 验证

随包执行 `node skills/make-app-approval/scripts/verify-bpm-lookup-metadata.mjs`；安装后按 Skill 实际绝对路径运行。可传入导出 resolveBpmLookupDependencies 的宿主桥接模块，以真实解析代码验证，不能复制期望结果。

仓库 CI 的 test-bpm-lookup-metadata-behavior.mjs 覆盖双向关系、基数、自关联、去重、依赖缺失/冲突、无副作用、故障注入和独立安装。宿主另验证三个读取接口只调用一次、登录/Trace/取消、撤权、目标候选及写入回读；纯依赖测试不代表真实办理通过。
