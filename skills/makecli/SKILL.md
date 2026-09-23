---
name: makecli
description: "Use when the user asks to manage Make platform resources with makecli — create/deploy apps, promote beta to production, check build/deploy progress or app URLs, entities, relations, records, inspect resources, log in to Make, or run makecli CLI commands. Also triggered by requests like \"部署\", \"部署进度\", \"构建状态\", \"apply\", \"查看应用\", \"创建记录\", \"登录 Make\", or \"/makecli\". Does not own DSL schema design (use makedsl), frontend UI (makeui), auth (make-app-auth), Service/API code (make-app-service), runtime packaging (make-app-runtime), OCR integration (make-integration), or canvas-table behavior."
metadata:
  version: 0.5.9
---

# makecli — Make Platform CLI

makecli is the CLI for the Make agentic development platform.
It manages Apps, Entities, Relations, Records, and code deployment.

## Installation

```bash
brew tap qfeius/makecli
brew install makecli
makecli update          # self-update + sync Make platform skills
```

## Pre-flight Check

Before executing ANY makecli command, verify the environment:

0. Check `makecli` is installed — missing: run the installation above
1. Run `makecli configure verify --output=json` to check token status
   - Not configured / expired: user must run `makecli login` (browser OAuth)
   - **INTERACTIVE** (opens browser, blocks) — instruct user to run it themselves via the `!` shell prefix (supported by Claude Code and Codex)
   - Fallback for manual tokens: `makecli configure token` (also interactive, via `!`)

Backend context selects the Make platform (`dev`, `test`, or `production`); the App has separate Beta and Prod environments within that context. Preserve the current profile and backend context through deploy, promote, and verification. Use per-call `--context <context>`; check local command help before relying on flags from an older CLI.

## Decision Tree

```
User request arrives
    |
    +- makecli not installed / not logged in? --> Pre-flight Check above
    |
    +- New app project? --> app init (local scaffold) / app create (scaffold + register)
    |
    +- Create/update schema (entity, relation)?
    |   --> Declarative Workflow (preferred)
    |
    +- Deploy code to Beta (including recreate and deploy)? --> Deploy Code
    |
    +- Publish Beta to Prod / 发布到 prod 环境上? --> Promote Beta to Prod
    |
    +- Build/deploy progress? --> app deploy --status / --wait
    |
    +- App overview + environment URLs? --> app info <appKey>
    |
    +- Data CRUD? --> record commands
    |
    +- Delete resource / one-off operation? --> Imperative Workflow
    |
    +- Query / inspect? --> list/get/schema commands
```

## Workflow: Declarative Schema (Primary)

**When:** Creating or updating schema resources (App, Entity, Relation).
**Why preferred:** Reproducible, diffable, safe (preview before apply).

1. **Write** DSL YAML under `apps/dsl/` — invoke the `makedsl` skill for schema reference
2. **Diff:** `makecli diff -f apps/dsl` — preview changes against remote
3. **Confirm** diff output with user
4. **Apply:** `makecli apply -f apps/dsl`
5. **Verify:** `makecli diff -f apps/dsl` (exit 0) or `makecli schema --app <appKey>`

Key rules:
- Entity/Relation: create if new, update if exists. **App is create-only — apply never updates an existing App**
- diff exit code: 0 = no differences, 1 = differences found
- Directory scan recurses into immediate subdirs by default (`--max-depth 2`, shared by diff/apply)

## Workflow: Deploy Code

```bash
makecli preflight                      # validate layout (--app-type fullstack|service|ui)
git add -A && git commit -m "..."      # deploy pushes committed HEAD; dirty worktree is refused
makecli app deploy --context <context> --profile <profile> --wait  # push committed HEAD to Beta
```

Deploy reads the app key from `apps/dsl/app.yaml` and refuses apps never registered via `app create`.

**`--wait` is the agent-friendly path** — one call, one verdict:
- Exit code **0** = build SUCCESS (environment URL printed as `URL:` row) / **2** = build FAILED or CANCELED (error detail printed) / **124** = timeout (`--timeout`, default 5m; build may still be running)
- Re-running after a timeout re-attaches to the same build (keyed by HEAD commit sha) — it's idempotent

**Check progress without pushing:**
```bash
makecli app deploy --status                # one-shot snapshot of the current HEAD's deploy status
makecli app deploy --status --output json  # machine-readable (BuildTask fields + url on success)
makecli app deploy --status --wait         # block until terminal state, no push
```

### Beta deployment result and next step

Apply this completion flow to every successful Beta deployment, including a user-authorized recreate-and-deploy flow:

- Verify `app info <appKey>` in the same context/profile reports Beta `Ready` for the deployed commit. Report the Beta URL, build/commit, and checks actually completed; keep authenticated browser acceptance separate.
- Offer **发布到 prod 环境上** as the next step. In Codex clients that support follow-up actions, emit the following as a Markdown list item outside a code fence. Replace every placeholder with the verified non-secret value before emitting it:

```markdown
- :codex-followup[发布到 prod 环境上]{prompt="将应用 <appKey> 在 backend context <context>、profile <profile> 下刚完成的 Beta 构建 <buildId>（commit <commitSha>）发布到同一 context 的 Prod 环境。先核对 Beta 仍是该构建，若已变化则说明差异并等待确认；发布后验证 Prod Ready、健康接口和统一登录响应。"}
```

- In clients without follow-up actions, say: `如需发布当前 Beta 版本到正式环境，请输入“发布到 prod 环境上”。`
- Showing the guide does not authorize promotion. A submitted follow-up or an explicit equivalent request does; proceed without asking for the same permission again.
- Do not show the guide for pending/failed deployments, after successful promotion of this release, or when the same Beta code **and Console configuration** are already confirmed published. Matching commit SHAs alone cannot rule out unpublished Console changes. If Prod publication is already authorized, continue to promotion instead of offering the guide.

## Workflow: Promote Beta to Prod

`app promote` publishes Beta's Console configuration and last successful deployment commit to the paired Prod App. It pushes no local code. A request such as **发布到 prod 环境上** after Beta deployment selects this workflow and keeps the same backend context/profile; changing the backend context is a separate user request.

1. Read `makecli app promote --help` and refresh `app info <appKey>` in the established context/profile. Confirm the Beta source is Ready; if a follow-up names a build that has changed, report the difference and obtain confirmation for the new source. If the installed CLI lacks `promote`, report the limitation rather than guessing a legacy command.
2. With the user's explicit production authorization, run from the App project directory:

```bash
makecli app promote --context <context> --profile <profile> --yes --wait
```

3. If the wait times out, retain the promote ID and resume the same run with `app promote --status --id <promoteId> --wait` in the same context/profile. Do not start a duplicate promotion to check progress.
4. Verify `app info <appKey>` reports Prod `Ready` and the expected commit, then check the Prod URL and applicable health/auth endpoints. Report the Prod URL, build/commit, backend context, and any unverified browser acceptance. On failure, report the failed step and error without claiming publication succeeded.

See [CLI reference](references/cli-reference.md#app-promote) for promote status flags and exit codes.

## Workflow: Imperative Operations

**When:** Single deletions, data CRUD, or operations not covered by apply.

Read `@references/cli-reference.md` for exact flag syntax and JSON file formats.

```bash
# App
makecli app create <appKey> [--name <display>] [--description <desc>] [--dry-run]
makecli app delete <key> --yes            # confirmation prompt without --yes
makecli app list [--filter "name=待办,key=todo"] [--output json]

# Entity / Relation (require --app)
makecli entity create <key> --app <app> [--name <display>] [--json props.json] [--dry-run]
makecli entity list [<key>] --app <app>
makecli relation create <key> --app <app> --json rel.json [--dry-run]

# Record (require --app + --entity; JSON = flat field map)
makecli record create --app <app> --entity <entity> --json data.json [--dry-run]
makecli record list --app <app> --entity <entity> --filter "status in ['todo'] && owner == _currentUser" [--sort-json '[{"fieldKey":"createdAt","order":"desc"}]']
makecli record aggregate --app <app> --entity <entity> --group-json '[{"fieldKey":"status"}]' --aggregates-json '[{"aggregate":"count","alias":"n"}]'   # server-side GROUP BY
makecli record update <id> [id...] --app <app> --entity <entity> --json data.json
makecli record delete <id> [id...] --app <app> --entity <entity>
```

All create commands accept `--dry-run` — server validates without persisting.

## Environment Configuration

```bash
# Step 1: Authenticate (INTERACTIVE -- user must run via !)
! makecli login                                  # browser OAuth; manual fallback: configure token

# Step 2: Set backend environment and profile headers (if non-default)
makecli configure set context test               # backend default for the current profile
makecli configure set meta-server-url <host>     # host only, /api/make auto-added
makecli configure set X-Tenant-ID <tenant>
makecli configure set X-Operator-ID <operator>
makecli configure --sample                       # print full config reference

# Verify
makecli configure verify --output=json
makecli configure resolve --target local-preview --output=json
```

`context` accepts `dev`, `test`, or `production`. The `--context` flag overrides the configured backend for one command; it does not select the App's Beta/Prod environment. For local preview, use `configure resolve --target local-preview --output=json` as the primary source of the effective public Make origin. Consume `make_api_origin` as a bare origin and let the local-preview Service add the browser-facing `/api/make` scope. Profile-specific host overrides such as `meta-server-url` and `repo-server-url` should be origins; path-scoped legacy values must be normalized before adapter URL construction.

`--context` belongs on the specific `makecli` command being executed; do not route it through project-local package scripts such as `corepack pnpm run verify:publish -- --context dev`. New Make Apps and explicit runtime migrations use the `make-app-runtime` runtime baseline (Node.js `22.20.0`, Corepack `0.34.0`, and `pnpm@10.20.0` through Corepack); ordinary deployment work must not rewrite an existing App's runtime declaration. Run the project gate before `makecli app deploy --wait` to Beta. After explicit production authorization, use `makecli app promote --yes --wait` in the same context/profile.

**Profiles:** All commands accept `--profile <name>` (default: "default").
**Config files:** `~/.make/credentials` and `~/.make/config` (INI format).

## Account Self Inspect

```
makecli whoami
```

## Common Patterns

**From zero to deployed app:**
```bash
! makecli login                                   # 1. Authenticate (user runs via !)
makecli app create shop --name "我的商城"          # 2. Scaffold + register + initial commit
cd shop                                           # 3. Write DSL (makedsl skill) under apps/dsl/
makecli diff -f apps/dsl && makecli apply -f apps/dsl
git add -A && git commit -m "feat: initial app"   # 4. Develop, then commit
makecli app deploy --wait                         # 5. Deploy to Beta, wait for build, get URL
```

**Inspect remote state:**
```bash
makecli app list --filter "key=shop"
makecli app info <appKey>                 # app meta + preview/production deploy status & URLs
makecli entity list --app <app>
makecli entity list <key> --app <app>     # detail view: fields + unique constraints
makecli schema --app <app>                # aggregated app + entities + relations
```

## Anti-Patterns

- **Don't skip diff before apply.** Always preview changes first.
- **Don't use imperative commands for bulk schema setup.** Use YAML + apply instead.
- **Don't guess CLI flags.** Read `@references/cli-reference.md` if unsure.
- **Don't run interactive commands via Bash tool.** `login`, `configure token`, `configure config` block on user input — tell user to run via `!`.
- **Don't pass `--yes` to `app delete` or `app promote` without explicit user consent.** These flags skip safety confirmations.
- **Don't deploy with a dirty worktree.** `app deploy` pushes committed HEAD only — commit first, it never auto-commits.
- **Don't hand-roll polling loops over `--status`.** Use `deploy --status --wait`.
- **Don't write DSL YAML from memory.** Invoke the `makedsl` skill for schema reference.
