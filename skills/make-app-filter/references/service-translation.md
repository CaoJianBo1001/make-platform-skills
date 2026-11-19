# Service Translation

Use this reference when sending package filter output to Service.

## Contract

New Make App code sends record filters as:

```json
{
  "filter": {
    "expression": "<filterExpression>"
  }
}
```

Use package `compileListFilter`. For search-only lists, call
`compileListFilter({ fields, searchText })` without an `advancedFilter` or filter
Preset read:

```ts
const filter = compileListFilter({ fields, searchText }); // search-only

const query = filter ? { filter } : {};
```

Only when advanced filtering is enabled, combine its applied value with the
session keyword; the filter Preset lifecycle is defined in
`preset-integration.md`:

```ts
const filter = compileListFilter({ fields, searchText, advancedFilter: appliedGroup });

const query = filter ? { filter } : {};
```

When using a GET route, JSON-encode the `filter` query value if the host API expects query strings.

Only when compilation succeeds with a genuinely empty filter, omit `filter`; compilation errors must stop the request.

Invalid empty values:

- `filter: []`
- `filter: {}`
- `filter: { "expression": "" }`
- blank raw string
- old object/array DSL such as `filter: [{...}]`

## CEL subset

The package owns CEL output. Do not hand-concatenate expression strings in the host.
For records queries, treat `compileListFilter` as the compiler and send its returned filter object
unchanged to Service/backend. Do not parse, distribute, normalize, or otherwise
rewrite boolean expressions in the host. If the backend rejects current package
output, report a package/backend contract mismatch and fix that shared boundary.

Host integration checks should verify that the same normalized fields and, when
advanced filtering is enabled, its applied state are passed to `compileListFilter`, and that its result reaches Service
unchanged. Exact comparison, collection, range, empty-check, and boolean-grouping
syntax belongs to package tests and published package documentation.

Editable system variables use only the package-supported structured `_currentUser` value on supported single-user operators; backend-only variables are not fake editable values.
DateRange, File, and resolved Lookup fields are supported by the `1.0.0` package
baseline through the same compiler path.

Use `parseCelToAdvancedFilter` only for supported expression echo or deep-link compatibility. Unsupported CEL should remain backend-only fallback, not fake UI conditions.

## Safety rules

- Field keys must match the package field-key pattern.
- Unsupported field/operator combinations fail the entire compilation; stop requests and preserve applied state.
- Conditions with missing field, operator, or required value fail the entire compilation.
- DateRange, File, and Lookup may be exposed only when the installed package publicly supports their field/operator semantics. Unknown field types are not compiled.
- Empty/not-empty expressions must follow backend field-type semantics. Do not invent `size(field)` forms for scalar fields or target-field paths for Lookup.
- Lookup filters reference the Lookup field key on the current Entity, not `lookupField.targetField`, `targetEntity.field`, or other cross-object paths.

## Service validation

Service should:

- parse JSON query params safely
- accept `{ expression }` when non-empty
- treat missing, `null`, or blank `filter.expression` as no filter when matching the backend contract
- optionally normalize a raw non-blank CEL string only when the host project already needs legacy compatibility
- reject malformed filter query values with 400; reject blank raw string query values when the route documents raw strings as invalid client input
- validate sort separately; do not confuse filter `fieldKey` rules with sort rules
- log only safe context, never tokens or raw signed URLs

Use `make-app-service` for route implementation, adapter logging, and Service tests.


## 修复版筛选合同（必读）

详见 [条件组回显与编译异常](roundtrip-and-errors.md)：实际修复产物门槛、保存/查询分离、括号原文保留、后端结构和值范围、编译失败停止请求及真实宿主验收。此合同优先于历史版本基线；包内负责逻辑，不在宿主复制实现。

## 已启用草稿的后端业务范围

当项目明确启用业务草稿且当前入口用于正式业务，按 [Service 资格合同](../../make-app-service/references/business-record-drafts.md#查询批量与直接动作) 在可信 Service 组合强制资格；浏览器仍将包编译结果原样提交，不在 UI 重写 CEL，也不把强制条件写入用户 Preset。Service 通过已验证的组合边界，在原用户表达式外增加括号并与可信资格条件按 AND 组合；原文作为不透明子表达式逐字保留，不要求先解析，也不解析后重写。新增资格条件的字段和值遵循已确认的字段类型及表达式合同，不能插值拼接未经校验的字段和值。清空、OR、深链接或伪造 includeDrafts 不得撤掉资格。

这是正式业务接口的后端资格附加，不改变上文浏览器的原文传递：保留原用户表达式为逐字不透明子表达式，仅在外层组合可信条件，不重新序列化或扁平化原条件；Preset 与 groupFilter 保持原文和独立合同。普通管理接口继续完整透传。

列表、聚合、分组/叶子、total、导出及全选使用各自已确定用途的同一有效范围。草稿管理入口可以按权限保留草稿；未启用对象不添加条件。本地筛选编辑草稿不是持久化业务草稿。
