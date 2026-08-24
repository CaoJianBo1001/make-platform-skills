# Artifact contract

Artifact is a versioned display semantic shared by frontend and backend. It is
not a frontend component invocation protocol.

The backend returns data such as `kind: "ranking"` or `kind: "record-list"`.
The frontend package chooses a whitelisted React template. Backend responses must
not contain React component names, JSX, HTML, CSS, scripts, import paths, or code
to execute.

## Artifact V1 kinds

| kind | Use for | Core data |
| --- | --- | --- |
| `metric` | one key number | `value`, `format`, optional `delta` |
| `comparison` | compact overview metrics | `items` |
| `trend` | time/order series | `series`, `points` |
| `ranking` | Top N, contribution, progress-like ordered values | `items` |
| `record-list` | business record summaries with optional actions | `entity`, `columns`, `records`, `total` |
| `notice` | warning, success, empty result, explanation | `tone`, `body` |

Use `ranking` for ordered progress or Top N displays, `comparison` for summary
overview cards, `record-list` for detail rows, `trend` for temporal movement,
`metric` for one headline number, and `notice` for findings that should read as
advice, warnings, empty states, or data-quality notes.

## Capability negotiation

Before generation, the backend must know the frontend-supported Artifact surface:

```json
{
  "capabilities": {
    "artifactSchemaVersions": ["1.0"],
    "artifactKinds": ["metric", "comparison", "trend", "ranking", "record-list", "notice"],
    "templates": ["<templateId>"]
  }
}
```

The backend should only return the intersection of supported schema versions,
`artifactKinds`, and agreed template semantics. If no structured result is
supported, return plain assistant text.

## Template hints

`presentation.template` is only a hint:

```json
{
  "presentation": {
    "template": "<templateId>",
    "density": "comfortable"
  }
}
```

The frontend registry may ignore the hint when the template is unknown, not
registered for the Artifact kind, lower priority than another match, or fails
`canRender`. Template hints must not load code dynamically.

## Actions

Actions are host-validated intents:

```json
{
  "id": "<actionId>",
  "label": "查看明细",
  "intent": "open-list",
  "target": {
    "entityKey": "<entityKey>",
    "viewKey": "<viewKey>"
  },
  "appearance": "link"
}
```

Allowed intents are `navigate`, `open-record`, `open-list`, and `invoke`. The
host checks permissions, maps the intent to a route or service call, and handles
failures. Artifact data must not embed raw URLs that bypass host routing or
permission checks.

## Do not guess components from text

Markdown tables, headings, bullet lists, and natural-language phrases are not a
reliable component-selection API. The frontend must not guess that a Markdown
table means `record-list`, or that a percentage means `ranking`.

If the backend returns only text, render only text. If a richer display is
required, change the protocol so the backend returns Artifact data.

## History persistence

If a live answer emits Artifacts, the persisted history must include the same
Artifact snapshots:

```json
{
  "role": "assistant",
  "cursor": 12,
  "text": "<assistantText>",
  "artifacts": [
    {
      "schemaVersion": "1.0",
      "id": "<artifactId>",
      "kind": "notice",
      "data": { "tone": "info", "body": "<body>" }
    }
  ]
}
```

Dropping Artifacts during history restore creates a visible regression after
refresh and is not a complete integration.
