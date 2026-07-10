# Operator Matrix

Use this reference when mapping Make field metadata to package operators and value editors.

## Source of truth

Use backend Record filter docs for what Make Data can accept, and package APIs for what the host UI can safely expose. The backend contract is owned by `makedsl`; read its EntityDataFilterUsage reference when you need the full contract. Do not re-create it in host UI code.

Use package APIs:

- `getFilterableFields`
- `getFieldFilterKind`
- `getOperatorsForField`
- `getDefaultOperator`
- `getDefaultFilterValue`
- `isAdvancedFilterFieldSupported`
- `operatorNeedsValue`
- `operatorUsesArrayValue`
- `readFilterOptions`

Do not duplicate the operator matrix in host code. If an old project keeps local helpers, they must delegate to the package and be covered by tests.

## Runtime capability resolution

The installed package owns the exact field/operator labels, order, default value,
and value-editor kind. `getOperatorsForField(field)` is the source of truth for
the effective operator set; do not preserve a copied matrix in this Skill or in
host code.

For each normalized runtime field:

1. Call `isAdvancedFilterFieldSupported(field)` or `getFilterableFields(fields)`
   to decide whether the field may be shown.
2. Call `getOperatorsForField(field)` for the displayed operator list and
   `getDefaultOperator(field)` for a newly created row.
3. Use `getFieldFilterKind(field)`, `getDefaultFilterValue(field, operator)`,
   `operatorNeedsValue(operator)`, and `operatorUsesArrayValue(operator)` to
   select and initialize the value editor.
4. Use package operator labels unchanged. Do not rename conditions in the host.

The `@qfei-design/make-filter@^0.2.5` baseline includes File, DateRange, and
Lookup filtering. Lookup remains supported only when the host passes a valid
source Lookup key together with resolved `relationKey` and non-Lookup target
field metadata. The package derives Lookup operators and value behavior from
that target field while keeping the source Lookup key in Filter IR and CEL.

For an unresolved Lookup, disabled field, unknown type, or invalid field key,
`getOperatorsForField(field)` returns no usable capability and the field stays
hidden. If backend and installed package capabilities differ, upgrade or fix the
package; do not add a host-only operator matrix, value normalizer, or CEL compiler.

Always unsupported:

- unknown field types
- fields with invalid CEL identifiers

Hide package-unsupported fields from field selectors and hide header "按该字段筛选" for them.

## Value identity rules

- Select values use option values, not display labels.
- User values use `userId`; display labels use `userName`.
- Department values use `departmentId`; display labels use `departmentName`.
- Multi-value fields use arrays of identities.
- Do not submit formatted table/detail display strings as filter values.
- Preserve non-string scalar option values such as numbers or booleans.

## Candidate sources

User and department selectors must use remote candidate sources:

- users: `GET /api/users?keyword=&page=&size=` or host equivalent
- departments: `GET /api/departments?keyword=&page=&size=` or host equivalent

Pass normalized options through package `candidateSources`:

```ts
{
  users: { options, loading, onSearch },
  departments: { options, loading, onSearch }
}
```

Use remote search. Do not filter stale local demo arrays, field schema options, current table rows, or hardcoded fixtures for production filters. Current applied values may be merged only to keep selected labels visible while remote candidates load.
