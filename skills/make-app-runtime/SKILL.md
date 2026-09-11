---
name: make-app-runtime
description: Use when generating, refactoring, reviewing, or debugging Make App project runtime structure, workspace manifests, Service runtime, local/dev scripts, build outputs, Docker/K8s image entrypoints, publish readiness, or packaging errors such as missing `apps/service/dist/server.js`. Covers `apps/` workspace contracts, `apps/ui/dist`, `apps/service` port/build/start contracts, runtime config file location, runtime artifact tests, forwarded host/proto header preservation, and publish gates that include auth plus applicable permission audits. Does not cover UI layout, authentication implementation, permission logic, Make adapter env semantics, DSL modeling, Make CLI resource deployment, or canvas-table internals.
metadata:
  version: 0.1.3
---

# make-app-runtime

Use this skill for Make App runtime and packaging contracts. These rules are intentionally strict because platform image entrypoints and publish artifacts should not vary per POC.

This skill owns project runtime structure, workspace manifests, build outputs, Service start entry, Service port baseline, runtime config file location, Docker/K8s runtime entry alignment, publish-readiness script guidance, and publish-readiness checks.

It does not own UI layout (`makeui`), authentication implementation (`make-app-auth`), single-app permission logic (`make-app-permission`), Make adapter environment variable semantics (`make-app-service`), DSL modeling (`makedsl`), Make resource deployment (`makecli`), or canvas-table behavior (`canvas-table-integration`).

## Quick start

1. Identify whether the task touches `apps/`, `apps/service`, `apps/ui/dist`, package scripts, Docker/K8s, image entrypoints, publish readiness, or a runtime error such as `Cannot find module '/app/apps/service/dist/server.js'`.
2. Preserve the platform image contract unless the user explicitly says the platform contract itself is changing.
3. For a new App or an explicit runtime migration, verify the runtime baseline in `apps/package.json`: it must declare `"packageManager": "pnpm@10.20.0"` and `"engines": { "node": "22.20.0", "pnpm": "10.20.0" }`. Existing Make Apps keep their declared runtime during unrelated work; change it only after the user requests an explicit runtime migration.
4. Run all project package commands through Corepack (`corepack pnpm`); do not use an ambient `pnpm` binary whose version is unknown.
5. Verify workspace manifests: `apps/package.json`, `apps/pnpm-workspace.yaml`, `apps/ui/package.json`, and `apps/service/package.json`.
6. Verify build artifacts before declaring ready: frontend `apps/ui/dist`, Service `apps/service/dist/server.js`.
7. Add or preserve a contract test for the Service runtime entry.

## Workspace contract

Generated or reorganized Make App projects use:

- `apps/ui`
- `apps/service`
- `apps/dsl`
- `apps/docs`
- `apps/packages/*` when shared packages are needed

Required workspace files:

- `apps/package.json`
- `apps/pnpm-workspace.yaml`
- `apps/ui/package.json`
- `apps/service/package.json`

`apps/pnpm-workspace.yaml` must include:

```yaml
packages:
  - "ui"
  - "service"
  - "packages/*"
```

## Package manager contract

All newly generated Make App React workspaces, and existing Apps undergoing an explicit runtime migration, use the fixed runtime triple: **Node.js 22.20.0**, its bundled **Corepack 0.34.0**, and **pnpm 10.20.0**. The workspace root (`apps/package.json`) must declare the exact Node and pnpm versions:

```json
{
  "packageManager": "pnpm@10.20.0",
  "engines": {
    "node": "22.20.0",
    "pnpm": "10.20.0"
  }
}
```

Each executable workspace package, including `apps/ui/package.json` and `apps/service/package.json`, must declare `"engines": { "node": "22.20.0" }`. The project `engines.node` field rejects unsupported runtimes. Do not add `engineStrict` solely for this runtime baseline: it also enforces dependency engine declarations and requires a repository-specific compatibility decision.

The repository must also contain a `.nvmrc` with exactly `22.20.0`, and CI or the Make build image must select exactly Node.js `22.20.0`. `engines` is a compatibility guard; it does not select the Node binary used by a build environment.

Existing Make Apps retain their declared Node and pnpm versions during UI, auth, filtering, Service, or DSL work. Do not rewrite `packageManager`, `engines`, lockfiles, or Node-selection files unless the user explicitly requests an explicit runtime migration. Perform that migration in a dedicated change with the project's tests and a Preview deployment.

Enable Corepack before project work and run installation, tests, builds, package additions, and publish gates as `corepack pnpm ...`. Corepack reads the project declaration; a globally installed `pnpm`, including a newer major version, must not be used for a Make App. Child workspace manifests must not declare a different package-manager version.

`apps/package.json` must provide runnable scripts such as `app:ui`, `app:service`, `dev`, `test`, and `build`. `corepack pnpm --filter` targets must match the actual package names, including scoped names.

`make-app-runtime` is the owner of `apps/package.json` generation and repair. `makecli app deploy` must not generate or rewrite workspace manifests.

Treat `makecli app deploy` as a code deployment boundary unless the target makecli version is proven to run a stricter publish gate. Do not report a generated App as publish-ready merely because deploy succeeded.

When preparing a generated App for publish, provide enough project-local scripts and documentation for the agent or CI to run publish-readiness checks before deploy:

- enable Corepack and install dependencies for `apps` with `corepack pnpm install --frozen-lockfile`
- verify Node.js is exactly `22.20.0` and Corepack is exactly `0.34.0`
- run the workspace build
- run the `make-app-auth` published contract audit for Service-fronted Apps
- run the `make-app-permission` contract audit when single-app permission enforcement is enabled or required by a repository-local delivery baseline
- run Service gateway-mode contract tests proving local preview and published upstream scopes are separated
- verify `apps/ui/dist` and `apps/service/dist/server.js`
- run Service contract tests, including auth callback proxy behavior, when tests exist

For publish-ready Service-fronted Apps, prefer a project-local `verify:publish` script that runs the publish gate in one command. Keep `check:publish` for build/artifact checks, but do not make it the only release gate. When single-app permission enforcement is enabled or locally required, add `permission:audit` to that command; do not make unrelated Apps depend on a missing permission runtime.

Recommended workspace scripts. Before adding these to `package.json`, copy or wrap the audit utilities into project-local `scripts/`; do not write user-specific skill install paths into generated projects.

```json
{
  "scripts": {
    "check:runtime": "node -e \"if (process.versions.node !== '22.20.0') throw new Error(`Make Apps require Node.js 22.20.0; got ${process.versions.node}`)\" && test \"$(corepack --version)\" = \"0.34.0\"",
    "auth:audit": "node scripts/audit-auth-contract.mjs . --mode service-fronted --published",
    "schema:diff": "cd .. && makecli diff -f apps/dsl --output=json",
    "check:publish": "corepack pnpm run build && test -f service/dist/server.js && test -d ui/dist",
    "verify:publish": "corepack pnpm run check:runtime && corepack pnpm run test && corepack pnpm run auth:audit && corepack pnpm run check:publish && corepack pnpm run schema:diff"
  }
}
```

For an App with single-app permission enforcement, add `"permission:audit": "node scripts/audit-make-app-permission.mjs ."` and append `&& corepack pnpm run permission:audit` to `verify:publish`.

Do not describe `verify:publish` as a universal makecli hook unless the target makecli version supports it. It is a project-local quality gate to run before `makecli app deploy`.

Do not pass deploy-environment flags through `verify:publish`. Run the gate as `corepack pnpm run verify:publish`; choose the publish target on the follow-up deploy command, for example `makecli app deploy --env preview` or `makecli app deploy --env production`. If a project-local Node wrapper must accept flags through `corepack pnpm run`, normalize argv by dropping a standalone `--` before parsing because `corepack pnpm run <script> -- --flag` can expose that separator to the script.

For Service-fronted Apps, the Service test suite behind `corepack pnpm run test` must include the gateway-mode contract:

- `MAKE_APP_LOCAL_PREVIEW=true`: Service uses `makecli configure resolve --target local-preview --output=json` field `make_api_origin` and `/api/make/**`.
- published mode, where the flag is absent or false: Service uses the deployed k8s-internal gateway origin and `/make/**`.
- The local-preview token branch is unreachable in published mode.

## Frontend build contract

Frontend publish artifacts live in `apps/ui/dist`.

Generated or updated Vite config should set:

- `build.outDir: "dist"`
- `build.emptyOutDir: true`

Do not publish or configure static asset discovery against root `dist` or `apps/dist`.

## Service runtime contract

The platform image default Service entry is:

```text
/app/apps/service/dist/server.js
```

Therefore the default TypeScript Service contract is:

- source entry: `apps/service/src/server.ts`
- compiled entry: `apps/service/dist/server.js`
- production start script: `node dist/server.js`
- dev script may use `tsx watch src/server.ts`, but production start must not use `tsx`
- Service HTTP port: `3000`
- centralized runtime config entry: `apps/service/src/config.ts`

`apps/service/tsconfig.json` must compile the runtime source to that path:

```json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "test", "dist"]
}
```

`apps/service/package.json` must include the Node engine and scripts equivalent to:

```json
{
  "engines": {
    "node": "22.20.0"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  }
}
```

Do not leave Docker, K8s, makecli, package scripts, or docs pointing at `/app/apps/service/dist/server.js` unless `corepack pnpm --filter <service-package> build` creates `apps/service/dist/server.js`.

If a legacy project intentionally uses a different Service entry or build tool, keep it only when all runtime references agree: Docker/K8s entrypoint, package `start`, docs, build output, and readiness tests.

## Service build contract test

Service-backed Apps should include a test that protects the runtime entry contract. The test may live in `apps/service/test/service-build-contract.test.ts` or the project's established test location.

It should assert:

- `apps/package.json` declares `packageManager: "pnpm@10.20.0"`
- `apps/package.json` declares `engines.node: "22.20.0"` and `engines.pnpm: "10.20.0"`
- `.nvmrc` contains `22.20.0`, and the CI or Make build image uses Node.js `22.20.0`
- `apps/ui/package.json` and `apps/service/package.json` each declare `engines.node: "22.20.0"`
- `apps/service/package.json` has a `build` script
- `apps/service/package.json` production start points to `node dist/server.js` when the platform image uses that entry
- `apps/service/tsconfig.json` uses `rootDir: "src"` and `outDir: "dist"`
- after build, `apps/service/dist/server.js` exists

Run the Service build before relying on that artifact:

```bash
corepack pnpm --filter <service-package-name> build
test -f apps/service/dist/server.js
```

## Runtime config location and port

Service runtime environment reads are centralized in `apps/service/src/config.ts` for new projects. This skill only requires the config entry location and fixed port handling needed by runtime/startup. Make adapter variables such as `MAKE_API_BASE_URL`, `MAKE_SERVER_URL`, `MAKE_AUTH_BASE_URL`, and `MAKE_BUSINESS_BASE_URL` belong to `make-app-service`.

Service HTTP port is fixed to `3000`. Generated or refactored Service code, `.env.example`, docs, health checks, tests, CORS, and UI local Service base URL examples must align to `3000`.

If local `3000` is occupied during development, report the conflict. Do not silently change the Service contract port.

`make-app-runtime` does not decide which environment connects to which Make domain, gateway, or API host. Domain mapping, gateway routing, and secret injection belong to backend, operations, Make tooling, or deployed runtime config.

## Forwarded request headers

When Service forwards requests to a Make gateway and that gateway needs request-origin context, preserve or set standard forwarded headers:

- `X-Forwarded-Host`
- `X-Forwarded-Proto`

Do not hard-code environment domains in generated Service code. Use the incoming request context or the host runtime proxy contract.

## Readiness checks

Before reporting a Service-backed App as ready to publish or ready for user-domain access:

1. Verify `node --version` reports `v22.20.0` and `corepack --version` reports `0.34.0`. Then run `cd apps && corepack pnpm install --frozen-lockfile` and verify `corepack pnpm --version` reports `10.20.0`.
2. Run `cd apps && corepack pnpm run verify:publish` when the project provides it.
3. Otherwise, run the workspace build that produces `apps/ui/dist`.
4. Run the Service build.
5. Verify `apps/service/dist/server.js` exists when the runtime entry points there.
6. Run the Service contract test and the make-app-auth published audit for Service-fronted Apps.
7. For Service-fronted Apps, verify the Service contract test covers both local-preview and published gateway modes. Published upstream requests must not use `/api/make/**`; local preview must consume makecli resolve `make_api_origin` and must not use k8s-internal `/make/**`.
8. If a start smoke is available, start the built Service with the production start script and verify it reaches the expected health or root response, then stop it.

Do not mark a Service-backed App ready based only on successful local `tsx src/server.ts` development startup.

## Common failure diagnosis

Error:

```text
Cannot find module '/app/apps/service/dist/server.js'
```

Treat it as a runtime contract failure:

- build did not run, or
- `src/server.ts` was missing, or
- `tsconfig` emitted somewhere else, or
- package `start` / image entry points to a file the build does not create.

Fix the build/start contract. Do not work around it by changing UI code or auth behavior.
