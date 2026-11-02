# makecli CLI Reference

> Verify locally with `makecli version` and command `--help` before relying on flags. Current publishing uses `app deploy` for Beta, `app promote` for Prod, and `--context` for the backend platform.

## Global Flags (all commands)

| Flag | Description | Default |
|------|-------------|---------|
| `--context` | Backend context `dev\|test\|production` — resolved as `--context` > `$MAKE_CLI_CONTEXT` > profile `context` > `[settings] context` | `production` |
| `--profile` | Credentials profile | `default` |
| `--access-token` / `-t` | Access token (overrides `$MAKE_ACCESS_TOKEN` and the profile credentials) | profile |
| `--meta-server-url` | Meta Server **host** override (overrides `$MAKE_META_SERVER_URL` and the profile config; gateway prefix `/api/make` auto-added) | context preset |

Code Repository Server host has no flag: `$MAKE_REPO_SERVER_URL` > profile `repo-server-url` > context preset.
Context presets: `production` → `qfei.cn` hosts, `dev`/`test` → `qtech.cn` hosts (`makecli context list` prints them).

**context ≠ appRole.** `--context` (global) picks the Make backend; `app delete --appRole beta|prod|all` picks the app role to delete. `app deploy` is beta-only; `app promote` moves beta → production.

`logs deploy --appRole beta|prod` selects which app role to read logs from within that backend context. It defaults to `beta`; the JSON snapshot reports the selection in `appRole`.

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
| `configure resolve [--target local-preview]` | Token-free, offline; prints JSON (`profile`, `context`, `make_api_origin`, `tenant_id`, `operator_id`) for wiring a local preview backend |
| `configure --sample` | Print a commented INI reference template |

**Keys for set/get** — profile keys: `context`, `meta-server-url`, `repo-server-url`, `auth-server-url`, `X-Tenant-ID`, `X-Operator-ID`. Profile `context` (`dev|test|production`) is this profile's backend default and beats the global `[settings] context`. Other global keys (`channel`, `role`, `check-for-updates`) are refused with a pointer to `makecli settings`.

`X-Tenant-ID` / `X-Operator-ID` are injected as HTTP headers on every request. Server URLs are host-only (no path).

```bash
makecli configure set context test            # current profile backend default
makecli configure set meta-server-url <host>
makecli --profile staging configure set X-Tenant-ID 1024
makecli configure get context
```

### configure resolve

```
makecli configure resolve --target local-preview --output=json [--profile <name>] [--context dev|test|production]
```

Resolve the current MakeCLI configuration for local-preview tooling without online token validation.

Minimal JSON contract:

```json
{
  "profile": "default",
  "context": "production",
  "make_api_origin": "https://make.qfei.cn",
  "tenant_id": "",
  "operator_id": ""
}
```

Use `make_api_origin` as a bare public gateway origin. Local-preview Services add `/api/make` when constructing upstream Make Meta/Data/Auth URLs. Backend selection follows the same context chain as every command (`--context` > `$MAKE_CLI_CONTEXT` > profile `context` > `[settings] context` > `production`); profile `meta-server-url` and global `--meta-server-url` overrides are normalized to a bare origin.

---

## context

```
makecli context list [--output table|json]   # built-in contexts (dev, test, production) + which is current
makecli context use <name>                   # = makecli settings set context <name> (global default)
makecli context show                         # the context this invocation resolves to
```

Contexts are built-in presets (docker-context style, no create/rm). `list --output json` includes each preset's `meta_server_url`, `repo_server_url`, `auth_server_url`, `agent_gateway_url`, `trace_server_url`. `context use` changes only the global default — a profile `context` still wins for that profile (`context show` prints the effective one). One-off override without switching: `makecli app list --context dev`.

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
| `context` | `dev\|test\|production` | `production` | Global default backend context (see `context` command); a profile `context` overrides it |
| `channel` | `stable\|beta` | `stable` | Release channel `makecli update` tracks |
| `role` | `user` | unset | Skill set `makecli update` syncs (`user` = only the makecli skill); set by `skills install --role`, cleared by `skills install --all` |
| `check-for-updates` | `true\|false` | `true` | Update-notifier switch (`$MAKE_CLI_UPDATE_NOTIFIER` overrides) |

Profile-only keys (`meta-server-url`, `repo-server-url`, `auth-server-url`, `X-Tenant-ID`, `X-Operator-ID`) are refused with a pointer to `makecli configure`.

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
makecli app delete [key] --appRole beta|prod|all [-f app.yaml] [--timeout 30m] [--yes|-y]
```

Every app is a **prod/beta pair** on the server. Pass the Prod app key (or read it from `-f`); `--appRole` is required and case-insensitive:

| `--appRole` | Deletes |
|---------|---------|
| `prod` | `<key>` itself (server refuses while its Beta pair still exists) |
| `beta` | the paired beta app (looked up from `<key>`; pass the prod key, not the beta key) |
| `all` | Beta first; only after it succeeds, delete Prod |

The command confirms once by asking for the app key (gh-style); non-interactive shells require `--yes`. It then polls the deletion task until success or failure. Exit code **0** means all selected roles were deleted, **2** means a deletion task failed (the message includes the failed step and server reason when available), and **124** means waiting timed out; the server task may still be running. `--timeout` defaults to 30 minutes and is shared by both roles when deleting `all`.

After a timeout, rerun in the same context/profile. The CLI continues waiting if the delete request reports a conflict and the status confirms `RUNNING`; other conflicts remain errors. For `all`, it skips Beta only when the status confirms that its deletion already `SUCCEEDED`, then starts or continues Prod. Temporary status-query failures are retried within the wait limit; authentication and permission failures stop immediately. There is no separate public `app delete-status` CLI command.

### app deploy

```
makecli app deploy [--force] [--wait] [--timeout 5m] [--status] [--output table|json]
```

- Runs from the project directory; app key comes from `apps/dsl/app.yaml` (no `--app` flag)
- Pushes the **committed HEAD as-is** — errors if worktree dirty, no commits, or no git repo (commit first)
- Refuses apps never registered via `app create` (guides to `makecli app create -f apps/dsl/app.yaml`)
- Target is always the App's **beta** environment — there is no `--env` and no confirmation prompt. Production is reached only through `app promote` (below); `--context` chooses the backend only

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

```bash
makecli app promote [--context dev|test|production] [--profile <name>]
                    [--yes|-y] [--wait] [--timeout 10m] [--output table|json]
makecli app promote --status --id <promoteId> [--wait] [--timeout 10m]
                    [--context dev|test|production] [--profile <name>] [--output table|json]
```

- Run in the App project directory; app key comes from `apps/dsl/app.yaml`; refuses unregistered apps and apps without a beta pair. The source is Beta's Console configuration and last successful deployment commit, not local HEAD. Nothing is pushed from the local repository.
- Publishes to the paired Prod App in the **same backend context and profile**. Preserve both explicitly when continuing a Beta deployment task.
- Starting a promotion prompts for confirmation. `--yes` is allowed after an explicit user request to publish to Prod, including a submitted deployment follow-up action. Rendering the action alone is not consent.
- `--wait` waits for a terminal result: **0 = succeeded / 2 = failed / 124 = timeout**. The default wait timeout is `10m`.
- Save the returned promote ID. `--status` requires `--id`; after a timeout, use `--status --id <promoteId> --wait` to resume waiting on that run without starting another promotion.
- Progress prints one line per state/step transition. `--output json`: stdout is a single receipt/status object; with `--wait`, progress goes to stderr
- Results include the promotion state/step, source and product build IDs, and URL on success. Confirm Prod `Ready` and the expected commit with `app info`, then verify the returned URL.

### app info

```
makecli app info <appKey> [--output table|json]
```

App metadata (key/name/description/version) + per-environment deployment table: ENVIRONMENT / STATUS (`Ready`, `Pending`, `Failed`, `Not deployed`) / COMMIT / URL for `beta` and `production`. JSON output: `{app, deployment}` (deployment `null` if never deployed).

---

## logs

### logs deploy

```text
makecli logs deploy [--app <appKey>] [--commit-sha <fullSHA>]
                   [--appRole beta|prod] [--stage build|deploy|all]
                   [--tail <N> | --cursor <nextCursor>]
                   [-f|--follow] [--timeout <duration>] [--output auto|table|json]
```

Reads build output and deployment lifecycle events for a commit. Check `makecli logs deploy --help` on the installed CLI before using it.

| Flag | Behavior | Default |
|------|----------|---------|
| `--app` | App key; paired app keys are resolved for the selected role | `apps/dsl/app.yaml` |
| `--commit-sha` | Full 40-character hexadecimal commit SHA | Git HEAD |
| `--appRole` | App role `beta\|prod`; selects the environment used for task lookup | `beta` |
| `--stage` | `build`: dependencies, compilation, image build/push; `deploy`: instance creation/update, startup and health checks; `all`: build followed by deploy | `build` |
| `--tail` | Initial lines per selected stage; `0` skips existing content, `-1` reads all | `200` |
| `--cursor` | Resume from the same stage's previous `nextCursor`; mutually exclusive with explicit `--tail` | unset |
| `--follow` / `-f` | Wait for task creation, then follow new content until the selected stage completes | `false` |
| `--timeout` | Total follow limit, such as `3m` or `120s`; positive duration with units, requires `--follow` | `3m` |
| `--output` | `auto`, `table` (plain log text), or `json`; follow does not support explicit JSON output | `auto` |

**Task and cursor selection:**
- Task lookup uses the SHA and the environment selected by `--appRole`; the returned task must belong to the app or its matching pair. Once selected, the task ID stays fixed during that read/follow.
- Build cursors are byte offsets; deploy cursors are event sequence numbers. `all` returns a combined cursor bound to the selected task. Use a cursor with the same SHA, role, and stage that produced it.
- Explicit cursors bypass the default tail limit. Tail applies only to the first read of each stage; subsequent reads use its cursor. `all` keeps the last N lines of each stage separately.
- Build tail is truncated by the build service; deployment events are paged and truncated by the CLI. If the build service reports that tail is unsupported, use `--tail=-1`.

**Output and completion:**
- Snapshot `auto` prints log text on a terminal and JSON in a pipe/agent. JSON contains `appKey`, `appRole`, `commitSha`, `stage`, `content`, `nextCursor`, and `completed`; `appRole` is the selected `beta` or `prod` value.
- Follow prints log text to stdout; diagnostics go to stderr. Its total timeout covers task lookup, requests, polling, and process output, without restarting between stages. Timeout stops local reading; the remote task continues.
- `completed` concerns the selected log stages, not deployment success. A build failure before deployment gives an empty, completed deploy stage. For status, use `app deploy --status` for Beta or `app promote --status --id <promoteId>` for a production publication.

| Exit code | Meaning |
|-----------|---------|
| `0` | Logs read successfully, including logs from a failed/canceled task |
| `1` | Invalid flags or an API/read error |
| `124` | Total follow timeout |
| `130` | Interrupted with Ctrl+C |

```bash
# Both stages, last 100 lines per stage, bounded follow
makecli logs deploy --stage all --tail 100 -f --timeout 3m

# Production deployment events for a specific commit
makecli logs deploy --appRole prod --commit-sha <fullSHA> --stage deploy

# JSON snapshot outside an App project
makecli logs deploy --app <appKey> --commit-sha <fullSHA> --output json

# Only new content, or resume a previous snapshot
makecli logs deploy --tail 0 -f --timeout 120s
makecli logs deploy --appRole prod --commit-sha <fullSHA> --stage all --cursor <nextCursor>
```

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

### Server-side aggregate

Use aggregation for the calculations it can express. When one request is insufficient, consider an equivalent query on the appropriate entity, combining aggregate results, or computing from a filtered `record list` with only the needed fields and complete required pages. Use existing pagination totals, expected transfer size and query frequency to judge cost; a small exact detail calculation is valid. For large, frequent calculations beyond these options, recommend a dedicated backend query or maintained summary. Explain any approximation or changed business scope before adopting it.

See [query-planning examples](../../makedsl/references/DataAPIDesign.md#不能直接表达时的方案选择) for period comparisons, median calculations and composition limits. An argument, authentication or permission error is handled as that error, rather than treated as evidence that the calculation is unsupported.

- `aggregate` is a server-side GROUP BY over one entity; `--group-json` (dimensions) + `--aggregates-json` (metrics, required) decide the columns. Omit `--group-json` for a global aggregate.
  - choose dimensions from Schema `capabilities.aggregable`, independently of list `groupable`; a missing capability means unknown on older servers. Metric eligibility follows the aggregate function's field types, not this dimension flag
  - group element: `{"fieldKey","granularity"?,"alias"?}` — `granularity` only on Date fields: `day|week|month|quarter|year`; same field twice needs distinct `alias`; at most 3 dimensions
  - aggregates element: `{"fieldKey"?,"aggregate","alias"}` — `count` (no fieldKey) | `countDistinct` | `sum`/`avg` (Number/Currency/Percent) | `min`/`max` (numeric or Date/DateTime); `alias` required, unique across all columns; at most 10 metrics
  - `--filter` runs before aggregation (WHERE, same CEL as `list`); `--aggregate-filter` runs after (HAVING) and may only reference metric aliases
  - sort element: `{"alias":..}` or `{"fieldKey":..}` + `"order":"asc|desc"`; default is all dimensions ascending
  - rows: dimension columns are `{value,label}` (null group → `label: "未填写"`); numeric metrics are raw JSON numbers, Date/DateTime `min`/`max` are formatted strings, and empty-value metrics can be `null`. Lookup group `value` is the related record ID; keep it distinct from its display `label`
  - `pagination.total` counts groups, not records; the default page contains 10 groups, with at most 1000 per page. Fetch remaining pages for complete results. Prefer querying global `avg` or `countDistinct` directly; combining group results requires matching sums and non-null counts for averages, or disjoint key sets for distinct counts

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
makecli preflight [dir]
```

Validates the project against the Make build service spec before pushing (default: cwd). There is no `--app-type` flag; the build mode is auto-detected:

| Mode | Detected when | Dockerfiles |
|------|---------------|-------------|
| A — apps components | `apps/ui/package.json` or `apps/service/package.json` exists | Provided by the platform |
| B — root Dockerfile | Anything else | The repo brings its own |

The package manager follows the lockfile (`pnpm-lock.yaml` > `yarn.lock` > `package-lock.json`). Findings are ERROR / WARN / INFO, each with a "How to fix" hint. Any ERROR exits 1 — usable as CI/deploy gate; WARN/INFO alone pass.

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
