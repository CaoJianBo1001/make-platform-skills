# Group Filter Expression

Use this reference when converting a selected group path into `groupFilter`.
The package does not generate CEL. CanvasTable does not generate CEL. The host
must compose `groupFilter` using the backend expression contract.

## Request fields

`filter` and `groupFilter` are separate `Expression` objects. Backend applies them
as an AND relationship, but callers must not merge them into one expression.

- `filter` is the user's global list filter.
- `groupFilter` is the transient path filter for grouping and grouped leaf records.
- Root group requests may omit `groupFilter`.
- Child group and leaf records requests use `groupFilter` with selected path
  conditions.

## Path condition

For each selected group path value, append one condition for the matching group
level:

```text
<groupFieldKey> == <celLiteral>
```

Use the same field key that appears in the applied `group` item. Do not use labels,
field names, target display names, or table column titles.

Group path values must be stable primitives:

- string
- number
- boolean
- null

Reject object, array, Date object, function, symbol, `NaN`, `Infinity`, and
unparseable custom values before building CEL.

## CEL literal formatting

Format literals safely:

- `null` -> `null`
- string -> JSON string literal, with quotes and escapes
- finite number -> decimal string
- boolean -> `true` or `false`

Do not interpolate a raw string into CEL. A value containing quotes, backslashes, or
newlines must still produce a valid string literal.

## Empty group values

When a user selects the `value: null` group:

- ordinary fields append `<groupFieldKey> == null`
- Lookup fields append the current Entity's Lookup field key, not the target field
  path

Lookup null grouping matches no valid related target record or a target field value
that is null. The host does not need to encode relation details in CEL.
Lookup null group values use the current Entity Lookup field key in CEL, never a
target field key or target display path.

## DNF append

The backend expression contract uses DNF: top-level `||` branches and `&&` inside
each branch. A group path condition must be appended to every top-level OR branch.

If existing `groupFilter.expression` is:

```text
A || B
```

and the path condition is:

```text
C
```

the result must be:

```text
A && C || B && C
```

Do not generate:

```text
A || B && C
```

Do not rely on:

```text
(A || B) && C
```

because nested expressions requiring automatic distributive expansion are not part
of the backend contract.

For multiple selected path values, append the conditions in group hierarchy order.
When the existing expression is empty, join path conditions with `&&`.

## Implementation guidance

Prefer a shared expression helper that accepts:

```ts
{
  baseGroupFilterExpression?: string | null;
  groups: { fieldKey: string }[];
  groupPath: unknown[];
}
```

The helper should return `null` for no conditions and an `Expression` string for
child/leaf requests. Keep it pure and test it separately.

If the host already uses `@qfei-design/make-app-filter` or another public parser
that can preserve DNF, use that instead of ad hoc string manipulation. If no parser
exists and the initial expression contains unsupported nesting, treat it as a
blocker or keep the raw filter only at the Service/backend layer; do not guess.

## Request placement

Examples use placeholders to show shape only:

Root grouping:

```json
{
  "filter": { "expression": "<filterExpression>" },
  "group": [{ "fieldKey": "<rootGroupFieldKey>", "order": "asc" }],
  "pagination": { "page": 1, "size": 50 }
}
```

Child grouping:

```json
{
  "filter": { "expression": "<filterExpression>" },
  "groupFilter": { "expression": "<groupPathExpression>" },
  "group": [{ "fieldKey": "<remainingGroupFieldKey>", "order": "asc" }],
  "pagination": { "page": 1, "size": 50 }
}
```

Leaf records:

```json
{
  "filter": { "expression": "<filterExpression>" },
  "groupFilter": { "expression": "<fullGroupPathExpression>" },
  "pagination": { "page": 1, "size": 50 }
}
```

Leaf records must omit `group` or set it to `null`.
