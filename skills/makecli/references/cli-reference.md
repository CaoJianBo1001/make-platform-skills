# makecli CLI Reference

> Verify locally with `makecli version` before relying on command output.

## Global Flags (all commands)

| Flag | Description | Default |
|------|-------------|---------|
| `--env` | Backend environment `dev\|test\|production` (overrides `[settings] environment`) | `production` |
| `--profile` | Credentials profile | `default` |
| `--meta-server-url` | Meta Server **host** override for the current profile (gateway prefix `/api/make` auto-added) | environment preset |
| `--repo-server-url` | Code Repository Server host override for the current profile | environment preset |

Environment presets: `production` → `qfei.cn` hosts, `dev`/`test` → `qtech.cn` hosts.

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

**Keys for set/get** — profile keys: `meta-server-url`, `repo-server-url`, `auth-server-url`, `X-Tenant-ID`, `X-Operator-ID`. Special key `environment` (values `dev|test|production`) writes the global `[settings]` section shared by every profile.

`X-Tenant-ID` / `X-Operator-ID` are injected as HTTP headers on every request. Server URLs are host-only (no path).

```bash
makecli configure set environment test        # global [settings], affects every profile
makecli configure set meta-server-url <host>
makecli configure get environment
```

### configure resolve

```
makecli configure resolve --target local-preview --output=json [--profile <name>] [--env dev|test|production]
```

Resolve the current MakeCLI configuration for local-preview tooling without online token validation.

Minimal JSON contract:

```json
{
  "profile": "default",
  "environment": "production",
  "make_api_origin": "https://make.qfei.cn",
  "tenant_id": "",
  "operator_id": ""
}
```

Use `make_api_origin` as a bare public gateway origin. Local-preview Services add `/api/make` when constructing upstream Make Meta/Data/Auth URLs. The command resolves `--env` first, then `[settings].environment`, then the default environment; profile `meta-server-url` and global `--meta-server-url` overrides are normalized to a bare origin.

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
makecli app delete [key] [-f app.yaml] [--yes|-y]
```

Confirms by typing the app key (gh-style). Non-interactive shells are refused unless `--yes`.

### app deploy

```
makecli app deploy [--env preview|production] [--force] [--yes|-y]
```

- Runs from the project directory; app key comes from `apps/dsl/app.yaml` (no `--app` flag)
- Pushes the **committed HEAD as-is** — errors if worktree dirty, no commits, or no git repo (commit first)
- Refuses apps never registered via `app create` (guides to `makecli app create -f apps/dsl/app.yaml`)
- `--env` defaults to `preview`; `production` prompts continue/abort confirmation (`--yes` skips; non-interactive shells refused without it)

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
makecli record list   [--filter <CEL>] [--fields a,b] [--sort createdAt:desc] [--page] [--size] [--output table|json]
makecli record update <record-id> [record-id...] --json data.json
makecli record delete <record-id> [record-id...]
```

- Record JSON is a flat field map: `{"title": "Test Record", "status": "active"}`
- `update` with one ID → record API; multiple IDs → batch field API (same field values applied to all)
- Writes violating a unique constraint return a `UniqueConstraintError` naming the constraint and fields
- `--filter` is a server-side CEL expression (subset of https://cel.dev):

```bash
makecli record list --app crm --entity order --filter "amount >= 100 && status in ['todo','doing']"
makecli record list --app crm --entity order --filter "title.contains('升级') && owner != null"
makecli record list --app crm --entity order --filter "owner == _currentUser"   # Make system variable
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

## update / version

```
makecli update [version] [--check] [--force] [--skip-skills]
makecli version
makecli version list [--limit <n>] [--output table|json]
```

- `update` self-updates the binary, then syncs Make platform skills (`npx -y skills add qfeius/make-platform-skills --all -y`); `--skip-skills` for binary only
- `--check`: report availability without installing; `--force`: allow downgrade
- `version list`: historical GitHub releases
