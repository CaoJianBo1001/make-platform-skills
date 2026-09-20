# makecli CLI Reference

> Verify locally with `makecli version` before relying on command output.

## Global Flags (all commands)

| Flag | Description | Default |
|------|-------------|---------|
| `--context` | Backend context `dev\|test\|production` — resolved as `--context` > `$MAKE_CLI_CONTEXT` > `[settings] context` | `production` |
| `--profile` | Credentials profile | `default` |
| `--access-token` / `-t` | Access token (overrides `$MAKE_ACCESS_TOKEN` and the profile credentials) | profile |
| `--meta-server-url` | Meta Server **host** override (overrides `$MAKE_META_SERVER_URL` and the profile config; gateway prefix `/api/make` auto-added) | context preset |

Code Repository Server host has no flag: `$MAKE_REPO_SERVER_URL` > profile `repo-server-url` > context preset.
Context presets: `production` → `qfei.cn` hosts, `dev`/`test` → `qtech.cn` hosts (`makecli context list` prints them).

**context ≠ environment.** `--context` (global) picks the Make backend; `--env` (local to `app delete`) picks the app's deployment environment `beta|production`. `app deploy` has no `--env` (beta-only); `app promote` moves beta → production.

---

## login

```
makecli login [--no-open-browser] [--timeout 3m]
```

Browser OAuth (PKCE): opens browser, waits for callback, saves token to `~/.make/credentials`.
**INTERACTIVE** — blocks until user finishes in browser. User must run it themselves via the `!` shell prefix (supported by Claude Code and Codex).
`--no-open-browser` prints the authorization URL instead of opening a browser.

---

## configure

Manages `~/.make/credentials` (tokens) and `~/.make/config` (INI, `[settings]` + per-profile sections). Override config dir with `$MAKE_CLI_CONFIG_DIR`.

| Subcommand | Behavior |
|------------|----------|
| `configure` / `configure token` | Prompt for access token (masked). **INTERACTIVE** — user runs via `!` |
| `configure config` | Prompt for `meta-server-url`, `repo-server-url`, `auth-server-url`, `X-Tenant-ID`, `X-Operator-ID`. **INTERACTIVE** — user runs via `!` |
| `configure set <key> <value>` | Non-interactive single-value write |
| `configure get <key>` | Read a single value |
| `configure verify [--output table\|json]` | Check the current profile has a valid token |
| `configure resolve [--target local-preview]` | Token-free, offline; prints JSON (`make_api_origin`, `tenant_id`, `operator_id`) for wiring a local preview backend |
| `configure --sample` | Print a commented INI reference template |

**Keys for set/get** — profile keys only: `meta-server-url`, `repo-server-url`, `auth-server-url`, `X-Tenant-ID`, `X-Operator-ID`. Global keys (`context`, `channel`, `role`, `check-for-updates`) are refused with a pointer to `makecli settings`.

`X-Tenant-ID` / `X-Operator-ID` are injected as HTTP headers on every request. Server URLs are host-only (no path).

```bash
makecli configure set meta-server-url <host>
makecli --profile staging configure set X-Tenant-ID 1024
makecli configure get meta-server-url
```

---

## context

```
makecli context list [--output table|json]   # built-in contexts (dev, test, production) + which is current
makecli context use <name>                   # = makecli settings set context <name>
makecli context show                         # the context this invocation resolves to
```

Contexts are built-in presets (docker-context style, no create/rm). `list --output json` includes each preset's `meta_server_url`, `repo_server_url`, `auth_server_url`, `agent_gateway_url`, `trace_server_url`. One-off override without switching: `makecli app list --context dev`.

---

## settings

```
makecli settings set <key> <value>
makecli settings get <key>
makecli settings list [--output table|json]   # KEY / VALUE / SOURCE (config|default)
```

Manages the global `[settings]` section of `~/.make/config` (shared by every profile):

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `context` | `dev\|test\|production` | `production` | Backend context (see `context` command) |
| `channel` | `stable\|beta` | `stable` | Release channel `makecli update` tracks |
| `role` | `user` | unset | Skill set `makecli update` syncs (`user` = only the makecli skill); set by `skills install --role`, cleared by `skills install --all` |
| `check-for-updates` | `true\|false` | `true` | Update-notifier switch (`$MAKE_CLI_UPDATE_NOTIFIER` overrides) |

Profile keys are refused with a pointer to `makecli configure`.

---

## app

### app init

```
makecli app init [appKey]
```

Scaffold a local Make app project — `CLAUDE.md` / `AGENTS.md` / `apps/dsl/app.yaml` + `git init` + `.gitignore`. Idempotent, no remote calls. Defaults to current directory name as appKey.

### app create

```
makecli app create <appKey> [--name <display>] [--description <desc>] [--dry-run] [-f app.yaml]
```

= `init` scaffold + register the App on Make + initial commit. Composes with a pre-existing `init` scaffold without clobbering edits.

- `--name`: display name (defaults to appKey)
- `--dry-run`: validate remote creation only (`X-Dry-Run` header) — no scaffold, no git, no repo prep
- `-f`: create from a Make.App YAML, **remote only, no scaffold**

### app list

```
makecli app list [--filter "name=待办,key=todo"] [--page <n>] [--size <n>] [--output table|json]
```

Filter: comma = OR; `key` exact match, `name`/`description` fuzzy. Table columns include DESCRIPTION.

### app delete

```
makecli app delete [key] --env production|beta|ALL [-f app.yaml] [--yes| -y]
```

Every app is a **prod/beta pair** on the server; `--env` (required, case-insensitive) picks which half:

| `--env` | Deletes |
|---------|---------|
| `production` | `<key>` itself (server refuses with 409 while its beta pair still exists) |
| `beta` | the paired beta app (looked up from `<key>`; pass the prod key, not the beta key) |
| `ALL` | beta first, then production (ordered steps, each confirmed) |

Confirms by typing the app key (gh-style). Non-interactive shells are refused unless `--yes`.

### app deploy

```
makecli app deploy [--force] [--wait] [--timeout 5m] [--status] [--output table|json]
```

- Runs from the project directory; app key comes from `apps/dsl/app.yaml` (no `--app` flag)
- Pushes the **committed HEAD as-is** — errors if worktree dirty, no commits, or no git repo (commit first)
- Refuses apps never registered via `app create` (guides to `makecli app create -f apps/dsl/app.yaml`)
- Target is always **beta** — there is no `--env` and no confirmation prompt. Production is reached only through `app promote` (below)

**Progress & waiting** (build task located by local HEAD commit sha — no task ID needed, re-runs re-attach idempotently):

| Invocation | Behavior |
|------------|----------|
| `deploy --wait` | Push, then block until build terminal state (SUCCESS/FAILED/CANCELED) |
| `deploy --status` | One-shot progress snapshot (no push) |
| `deploy --status --wait` | Block until terminal state, no push |

- **Exit codes: 0 = SUCCESS / 2 = FAILED or CANCELED / 124 = timeout** — script/agent-friendly, no text parsing
- `--timeout` (default `5m`, requires `--wait`) bounds the wait; right after push the task may briefly not exist yet ("task not created yet") — the wait tolerates this window
- On SUCCESS the environment URL is shown (`URL:` row; same source as `app info`)
- `--output json` (requires `--status`): stdout is a single BuildTask object (`status`, `phase`, `errorCode`, `errorMessage`, `url` on success, …); with `--wait`, progress goes to stderr so stdout stays parseable

### app promote
Release beta environment deployment to production.

```
makecli app promote [--yes|-y] [--wait] [--timeout 10m] [--status] [--output table|json]
```

- Runs from the project directory; app key comes from `apps/dsl/app.yaml`; refuses unregistered apps


| Invocation | Behavior |
|------------|----------|
| `promote --wait` | Start, then block until terminal state |
| `promote --status` | One-shot progress of the last promote (no new publish) |
| `promote --status --wait` | Block until the last promote reaches terminal state |

- **Exit codes: 0 = succeeded / 2 = failed / 124 = timeout** (`--timeout` default `10m`, requires `--wait`)
- Progress prints one line per state/step transition; on success the production URL is shown
- `--output json`: stdout is a single receipt/status object; with `--wait`, progress goes to stderr

### app info

```
makecli app info <appKey> [--output table|json]
```

App metadata (key/name/description/version) + per-environment deployment table: ENVIRONMENT / STATUS (`Ready`, `Pending`, `Failed`, `Not deployed`) / COMMIT / URL for `beta` and `production`. JSON output: `{app, deployment}` (deployment `null` if never deployed).

---

## entity

All subcommands require `--app <appKey>`.

### entity create

```
makecli entity create <key> --app <app> [--name <display>] [--json props.json] [--dry-run]
```

`--json` carries the **whole entity properties** (`fields` + `uniqueConstraints`) — same shape as DSL YAML `properties` and `entity list -o json` `data.properties`:

```json
{
  "fields": [
    {"key": "email", "name": "邮箱", "type": "Make.Field.Text", "meta": {"version": "1.0.0"}, "properties": null}
  ],
  "uniqueConstraints": [
    {"name": "uniq_email", "fields": ["email"]}
  ]
}
```

Constraint field refs are validated locally; type whitelist and quotas are enforced server-side.

### entity list

```
makecli entity list [key] --app <app> [--filter "name=任务"] [--page <n>] [--size <n>] [--output table|json]
```

Without key: list view. With key: detail view (fields table + unique-constraints table).

### entity delete

```
makecli entity delete <key> --app <app>
```

---

## relation

All subcommands require `--app <appKey>`.

```
makecli relation create <key> --app <app> --json rel.json [--name <display>] [--dry-run]
makecli relation update <key> --app <app> --json rel.json [--name <display>]
makecli relation list  [key] --app <app> [--filter] [--page] [--size] [--output table|json]
makecli relation delete <key> --app <app>
```

JSON format (note `entityKey`, cardinality `one|many`):

```json
{
  "from": {"entityKey": "project", "cardinality": "many"},
  "to":   {"entityKey": "task",    "cardinality": "one"}
}
```

---

## record

All subcommands require `--app <appKey> --entity <entityKey>`.

```
makecli record create --app <app> --entity <entity> --json data.json [--dry-run]
makecli record get    <record-id> [--output table|json]
makecli record list   [--filter <CEL>] [--fields a,b] [--sort-json <JSON>] [--page] [--size] [--output table|json]
makecli record update <record-id> [record-id...] --json data.json
makecli record delete <record-id> [record-id...]
makecli record aggregate --aggregates-json <JSON> [--group-json <JSON>] [--filter <CEL>] [--aggregate-filter <CEL>] [--sort-json <JSON>] [--page] [--size 10] [--output table|json]
```

JSON flags (`--*-json`) take inline JSON, `@file`, or `-` for stdin (stdin at most once per call). Keys are checked locally (unknown key = error); values are validated server-side.

- Record JSON is a flat field map: `{"title": "Test Record", "status": "active"}`
- `update` with one ID → record API; multiple IDs → batch field API (same field values applied to all)
- Writes violating a unique constraint return a `UniqueConstraintError` naming the constraint and fields
- `--filter` is a server-side CEL expression (subset of https://cel.dev):

```bash
makecli record list --app crm --entity order --filter "amount >= 100 && status in ['todo','doing']"
makecli record list --app crm --entity order --filter "title.contains('升级') && owner != null"
makecli record list --app crm --entity order --filter "owner == _currentUser"   # Make system variable
makecli record list --app crm --entity order --sort-json '[{"fieldKey":"createdAt","order":"desc"}]'
```

- `aggregate` is a server-side GROUP BY over one entity; `--group-json` (dimensions) + `--aggregates-json` (metrics, required) decide the columns. Omit `--group-json` for a single global row.
  - group element: `{"fieldKey","granularity"?,"alias"?}` — `granularity` only on Date fields: `day|week|month|quarter|year`; same field twice needs distinct `alias`; at most 3 dimensions
  - aggregates element: `{"fieldKey"?,"aggregate","alias"}` — `count` (no fieldKey) | `countDistinct` | `sum`/`avg` (Number/Currency/Percent) | `min`/`max` (numeric or Date/DateTime); `alias` required, unique across all columns; at most 10 metrics
  - `--filter` runs before aggregation (WHERE, same CEL as `list`); `--aggregate-filter` runs after (HAVING) and may only reference metric aliases
  - sort element: `{"alias":..}` or `{"fieldKey":..}` + `"order":"asc|desc"`; default is all dimensions ascending
  - rows: dimension columns are `{value,label}` (null group → `label: "未填写"`), metric columns are raw JSON numbers; `pagination.total` counts groups, not records

```bash
makecli record aggregate --app crm --entity order \
  --group-json '[{"fieldKey":"status"},{"fieldKey":"orderDate","granularity":"month","alias":"month"}]' \
  --aggregates-json '[{"aggregate":"count","alias":"orderCount"},{"fieldKey":"amount","aggregate":"sum","alias":"totalAmount"}]' \
  --filter "status != 'draft'" --aggregate-filter "totalAmount > 10000" \
  --sort-json '[{"alias":"totalAmount","order":"desc"}]'
```

---

## schema

```
makecli schema --app <appKey>
```

Aggregated schema for an app (app + entities + relations in one view).

---

## apply

```
makecli apply -f <path> [--max-depth <n>]
```

Batch apply YAML resources (create-or-update).

- `-f`: YAML file (multi-doc `---` supported) or directory
- `--max-depth`: directory recursion — `1` top level only, `2` +immediate subdirs (default), `0` unlimited. Hidden files/dirs (`.git` etc.) never descended
- Processing order: App → Entity → Relation (auto-sorted)
- Semantics: App **create-if-missing (never updated)**; Entity/Relation upsert
- Stops on first error

---

## diff

```
makecli diff -f <path> [--max-depth <n>] [--output table|json]
```

Compare local DSL YAML with remote definitions. App inferred from the Make.App manifest or entity `app` field. Shares `--max-depth` with `apply` so both agree on which files constitute an app.

- Statuses: `added` (local only), `removed` (remote only), `changed`, `unchanged`; detects unique-constraint drift
- **Exit codes: 0 = no differences, 1 = differences found** (also in JSON mode)

---

## preflight

```
makecli preflight [dir] [--app-type fullstack|service|ui]
```

Validates the Make app project layout (default: cwd, type `fullstack`):

| Type | Required |
|------|----------|
| `fullstack` | `apps/dsl/` + `apps/service/package.json` + `apps/ui/package.json` |
| `service` | `apps/dsl/` + `apps/service/package.json` |
| `ui` | `apps/dsl/` + `apps/ui/package.json` |

Exit 1 on any missing entry — usable as CI/deploy gate.

---

## integration

```
makecli integration ocr -f <file> [--pages "1,3" | "2-4"] [--merge-elec] [--verify-vat] [--output table|json]
```

Recognize bills from a PDF/OFD/PNG/JPG file. See `--help` for crop/coordinate flags.

---

## whoami

```
makecli whoami [--output table|json]
```

Shows the current token's identity (user/tenant + profile/context). Triggers browser login automatically when the token is missing or expired — at most one login per call.

---

## skills

```
makecli skills list [--all] [--output table|json]
makecli skills install <name>... | --all | --role user [--yes|-y]
makecli skills update
makecli skills uninstall <name>... | --all [--yes|-y]
makecli skills read <skill>[/<path>]
```

Manages Make platform skills (installed via npx under the hood). `list` shows installed skills by default (`--all` includes the remote catalog); `install`/`uninstall` prompt for confirmation (`--yes` skips; non-interactive shells refused without it).

- `install --role user`: installs only the makecli skill (manage resources, no app development) and records `[settings] role = user`, so `makecli update` keeps syncing just that set. `--all` installs everything and clears the role; explicit names leave the role untouched. `--role` is mutually exclusive with `--all` / names
- `read`: prints the SKILL.md (or a file under `references/`) embedded in the binary — always matches the CLI version, works offline; a directory target lists its entries

---

## update / version

```
makecli update [version] [--check] [--force] [--skip-skills]
makecli version
makecli version list [--limit <n>] [--output table|json]
```

- `update` self-updates the binary, then syncs Make platform skills (`npx -y skills add qfeius/make-platform-skills --all -y`, or `-s makecli` when `[settings] role = user`); `--skip-skills` for binary only
- `--check`: report availability without installing; `--force`: allow downgrade
- Channel: `makecli settings set channel beta` makes bare `update` track pre-releases (default `stable`)
- `version list`: historical GitHub releases
