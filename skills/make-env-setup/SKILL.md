---
name: make-env-setup
description: Use when preparing or updating the local Make development environment before development. Triggered by Make 环境安装, Make 环境初始化, 更新 Make 环境. Distinguishes new Apps from existing Apps whose runtime must be preserved; does not manage Make resources, deploy Apps, or write PRD, DSL, Service, or UI code; use makecli for resource/deploy operations and the owning skills for implementation.
metadata:
  version: 0.4.2
  homepage: https://github.com/qfeius/make-platform-skills
---

# make-env-setup

Get this machine ready to build a Make App: select the appropriate toolchain, verify Make login, and initialize a project folder only for a new App. Run it on a new machine, and again whenever the tools need updating. Use `makecli` for resource/deploy operations and the owning skills for implementation.

## Safety Rules

- Do not print or store tokens, cookies, Authorization headers, passwords, or secrets.
- Do not manually create PRD, DSL, Service, or UI files; only run `makecli app init` in the selected directory.
- Interactive secret entry must be completed by the user. Do not ask the user to paste secrets into chat.
- Do not install pnpm through npm. For a new or explicitly migrated App, use the fixed Corepack/pnpm baseline below. An existing compatible npm or Yarn App keeps its declared installer and lockfile; this environment skill must not switch it to pnpm.

## Select Project Mode

- For a new App or a user-requested explicit runtime migration, follow the fixed Node.js/Corepack/pnpm baseline below. Runtime migration itself belongs to `make-app-runtime`; do not change an existing repository's manifests or lockfile in this setup flow.
- For an existing Make App without an explicit migration, inspect its workspace `packageManager`, Node `engines`, Node-selection file, lockfile and CI/install workflow before choosing tools. Keep the compatible declared Node and package manager, including npm or Yarn. Do not add Corepack or pnpm merely to update the local environment. If these declarations disagree, the needed runtime is unclear, or the target platform build image is incompatible, stop and report the blocker to `make-app-runtime` rather than guessing or creating another lockfile.
- If the target folder or new-versus-existing mode is unclear, ask the user before choosing a project runtime or initializing a folder.

## Install Or Update Toolchain

This skill supports macOS, Linux, and Windows. For a new App or an explicitly migrated App, the runtime is fixed: Node.js `22.20.0`, its bundled Corepack `0.34.0`, and `pnpm@10.20.0`. Steps 1–3 below apply only to that mode. Do not substitute a moving LTS release, a Homebrew or global pnpm binary, or a newer Corepack release.

For an existing Make App without migration, verify its declared Node version with the active Node binary and use its established npm, Yarn or Corepack-managed pnpm workflow. If its declared Node is not installed, ask before installing that version; do not install `22.20.0` as an automatic replacement. Continue with the shared git, makecli and Skill checks, without rewriting App files.

1. Ensure exact Node.js `22.20.0` and `git` are available. If either is missing, install it with the platform's own method only after the user confirms.

   | Platform | Node.js `22.20.0` | git |
   |---|---|---|
   | macOS | Install and select with `nvm install 22.20.0` then `nvm use 22.20.0`; if nvm is unavailable, use an exact-version manager selected by the user | `xcode-select --install`, or Homebrew if already present |
   | Linux | Install and select with `nvm install 22.20.0` then `nvm use 22.20.0`; if nvm is unavailable, use an exact-version manager selected by the user | distro package, for example `apt install git` |
   | Windows | Use an exact-version manager such as nvm-windows to install and select `22.20.0`, or the official Node.js `22.20.0` installer | `winget install Git.Git` |

   Do not use a moving package-manager formula such as `brew install node`, `apt install nodejs`, or `winget install OpenJS.NodeJS.LTS` for the Make App runtime. If no exact-version Node manager is available, stop and ask the user to select one.

2. Verify the fixed Node.js and Corepack baseline before installing pnpm. The checks below are cross-platform and must both pass:

   ```bash
   node -e 'if (process.versions.node !== "22.20.0") { throw new Error(`Make Apps require Node.js 22.20.0; got ${process.versions.node}`) }'
   node -e 'const { execFileSync } = require("node:child_process"); const actual = execFileSync("corepack", ["--version"], { encoding: "utf8" }).trim(); if (actual !== "0.34.0") { throw new Error(`Corepack must report 0.34.0; got ${actual}`) }'
   ```

3. Enable Corepack and cache the fixed new/migrated App pnpm baseline. Do not install pnpm through npm, Homebrew, or another global package manager. Use `corepack install -g`, not the deprecated `corepack prepare`.

   ```bash
   corepack enable
   corepack install -g pnpm@10.20.0
   node -e 'const { execFileSync } = require("node:child_process"); const actual = execFileSync("corepack", ["pnpm", "--version"], { encoding: "utf8" }).trim(); if (actual !== "10.20.0") { throw new Error(`pnpm must report 10.20.0; got ${actual}`) }'
   ```

4. Install or update `makecli`. If `makecli` exists, run `makecli update --skip-skills`; otherwise run `npm install -g @qfeius/makecli`. `makecli update` knows how it was installed: an npm or pnpm install is upgraded through that package manager, and any other installation replaces the binary in place.

   If the npm global install fails with `EACCES` on macOS or Linux, do not use `sudo`. Point npm's global prefix at a user-owned directory, add it to `PATH`, then retry:

   ```bash
   npm config set prefix "$HOME/.npm-global"
   export PATH="$HOME/.npm-global/bin:$PATH"   # also add this line to the shell profile
   ```

5. Install or update Make platform skills every run.

   ```bash
   npx skills add qfeius/make-platform-skills --all -y
   ```

   Show a compact Make skills result based on the command output, such as installed, updated, or already current.

## Verify Versions

For a new or explicitly migrated App, run all checks and show a compact summary:

```bash
node --version
npm --version
corepack --version
corepack pnpm --version
git --version
makecli version
```

In that mode, Node must report exactly `v22.20.0`, Corepack exactly `0.34.0`, and pnpm exactly `10.20.0`. If any check fails, stop and repair the active runtime; do not continue with a different version.

For an existing Make App without migration, check `node --version`, `git --version`, `makecli version`, and only the package-manager command declared by the project (`npm --version`, `yarn --version`, or `corepack pnpm --version` for a compatible pnpm App). Compare them with the inspected manifest, Node-selection file and CI/install workflow. Do not require the fixed new-App triple or run Corepack checks for an npm/Yarn App. If they do not agree, stop and hand the compatibility blocker to `make-app-runtime`.

## Verify Token With Guided Login

After the environment is configured successfully, check the current token:

```bash
makecli configure verify --output=json
```

If verification succeeds, continue to project folder selection or initialization as appropriate.

If verification fails because the token is missing, expired, invalid, or belongs to the wrong environment:

1. Run:
   ```bash
   makecli login --timeout=60s
   ```
   The command opens the browser, waits up to 60 seconds for the login callback, then exits on its own. If it prints an authorization URL instead of opening a browser, relay that URL to the user.
2. If the command exits successfully, login is done; continue to project folder selection or initialization as appropriate.
3. If the command exits with a timeout or callback error, tell the user:
   ```text
   请在浏览器中完成 makecli 登录。完成后回复“已经完成登录”。
   ```
   Then stop and wait for the user to reply `已经完成登录`.
4. After the user replies, run `makecli configure verify --output=json`. If `valid` is `true`, login succeeded; continue. If `valid` is `false`, go back to step 1.

If browser login is not convenient, offer the token fallback:

```bash
makecli configure token
```

The user must complete interactive secret entry in their own terminal. After the user finishes, run `makecli configure verify --output=json` to confirm the token. If `valid` is `false`, ask the user to re-enter the token, or fall back to the guided `makecli login` flow above.

## Initialize App Project Folder

For an existing Make App without a requested reinitialization, do not run `makecli app init`. Keep its current project folder and report that location. The steps below apply only to a new App or a user-requested initialization.

`makecli app init` derives the app key from the target directory's basename and validates the name itself; do not pre-validate names in this skill.

1. Pick a candidate:
   - If the user has already described the app they want to build, recommend a folder name derived from that description.
   - Otherwise, if the current directory is not an existing project, recommend initializing in place.
   - Otherwise recommend a generic name such as `make_app`.
2. Confirm with the user:
   ```text
   是否使用 <app-folder> 作为 App 目录？请回复 “是” 或 “否”。
   ```
   If the user replies anything other than `是` or `否`, ask again with the same prompt.
3. If the user replies `否`, ask:
   ```text
   请输入 App 目录地址：
   ```
   Accept an absolute or relative path as provided.
4. Run `makecli app init <app-folder>`, or `makecli app init` with no argument when initializing the current directory. The command creates the directory if needed and is idempotent.
5. If init fails with an invalid key error, the error message states the naming rule: derive a compliant folder name from the chosen one (for example `contract-ledger` → `contract_ledger`), tell the user the adjusted name, and retry. For other errors, report the error and ask the user whether to retry or choose another directory. Continue only after init succeeds.

## Setup Completion Output

End only after the selected toolchain is verified and the token is valid (initial verification passed or the login flow succeeded). A new App also requires successful `makecli app init`; an existing App requires its declared runtime and folder to be verified without reinitialization. Use a concise readiness report:

- Tool versions: Node, git, makecli and the selected project's package manager; include Corepack only when that project's workflow requires it.
- Make skills result.
- Login status: already valid or refreshed with `makecli login`.
- App folder: the initialized or verified existing directory.

Keep the completion output concise and next-step focused. Omit negative summaries about actions not performed.

If everything passes, say:

```text
Make 开发环境已经准备好，可以进行下一步开发 App。
```

For a newly initialized App, provide this small example:

```text
App 参考示例：

我要做一个 Make App，用来演示合同台账管理。
角色包括管理员和业务人员。
核心流程是新建合同、维护付款计划、查看合同列表和详情。
请先和我确认需求细节，生成 apps/docs/PRD.md，再进行 DSL 建模；DSL 必须先 diff，等我确认后才 apply。
```
