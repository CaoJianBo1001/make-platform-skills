---
name: setup-make-poc
description: Use when preparing or updating a Make POC environment before development, including checking latest versions of Node, pnpm, git, makecli, Make platform skills, makecli login/verify, and Make environment selection. Triggered by Make POC, POC 环境安装, 更新 Make POC 环境, makecli 登录校验, or PoC 前置环境. Trigger matching is case-insensitive.
metadata:
   version: 0.1.1
   homepage: https://github.com/qfeius/make-platform-skills
---

# setup-make-poc

Prepare the local environment and initialize the project folder for a Make POC before any PRD, DSL, Service, UI, apply, deploy, or git work.

Core rule: installed is not ready. Always check whether each required tool is current through its stable install channel. If it is outdated, update it first, then verify versions and login state again.

## Trigger Handling

Treat trigger phrases as case-insensitive. Normalize the user's request to lowercase before matching English keywords.

Trigger examples include:

- `Make POC`, `make poc`, `MAKE POC`
- `PoC 前置环境`, `poc 前置环境`
- `makecli 登录校验`, `MAKECLI 登录校验`
- `更新 Make POC 环境`, `更新 make poc 环境`

Use this skill only for environment readiness and `makecli app init` project initialization. For PRD, DSL, Service, UI, table integration, apply, deploy, or feature coding, stop after project initialization and switch to the appropriate Make skill.

## Safety Rules

- Do not print or store tokens, cookies, Authorization headers, passwords, or secrets.
- Do not manually create PRD, DSL, Service, or UI files; only run `makecli app init` in the selected PoC directory.
- Interactive secret entry must be completed by the user. Do not ask the user to paste secrets into chat.
- "Latest" means the latest stable version available from the current install channel, not nightly, beta, or a hard-coded version.

## System Gate

Run:

```bash
uname -s
```

Continue only on:

- `Darwin` for macOS.
- Linux running inside WSL. Confirm with:
  ```bash
  grep -qi microsoft /proc/version || grep -qi wsl /proc/version
  ```

If the user is on native Windows, stop and say to open WSL, then rerun the request there. Do not attempt native Windows installation.

If the user is on non-WSL Linux or another OS, stop and explain that this skill only automates macOS and Windows-through-WSL setup.

## Install Or Update Toolchain

Use the stable package channel. On macOS use Homebrew. On WSL use Linuxbrew if available; if `brew` is missing in WSL, stop and ask the user to install Homebrew/Linuxbrew in WSL before continuing.

1. Ensure `brew` exists.

   ```bash
   command -v brew
   ```

   If missing on macOS, install Homebrew only after confirming the user accepts a system package-manager install:

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Refresh package metadata.

   ```bash
   brew update
   ```

3. Install missing tools and upgrade outdated tools.

   ```bash
   for pkg in node pnpm git; do
     if ! brew list "$pkg" >/dev/null 2>&1; then
       brew install "$pkg"
     elif [ -n "$(brew outdated --quiet "$pkg")" ]; then
       brew upgrade "$pkg"
     fi
   done
   ```

4. Install or update `makecli`.

   ```bash
   brew tap qfeius/makecli
   if ! command -v makecli >/dev/null 2>&1; then
     brew install makecli
   elif brew list makecli >/dev/null 2>&1 || brew list qfeius/makecli/makecli >/dev/null 2>&1; then
     if [ -n "$(brew outdated --quiet makecli 2>/dev/null || brew outdated --quiet qfeius/makecli/makecli 2>/dev/null)" ]; then
       brew upgrade makecli || brew upgrade qfeius/makecli/makecli
     fi
   else
     makecli update
   fi
   ```

5. Install or update Make platform skills every run.

   ```bash
   npx skills add qfeius/make-platform-skills --all -y
   ```

   Show a compact Make skills result based on the command output, such as installed, updated, or already current.

## Verify Versions

After install or update, run all checks and show a compact summary:

```bash
node --version
pnpm --version
git --version
makecli version
```

If `makecli version` is below `0.4.5`, stop and report that the CLI is too old after update. Do not continue to the final interactive Make gate.

## Final Interactive Make Gate

Run the Make environment selection, token verification, and project folder initialization at the end, after the system gate, toolchain update, version verification, and skills update are complete.

### Select Make Environment

Ask the user exactly:

```text
请选择使用PoC的环境：开发、测试
```

Wait for the user's answer. Do not infer from project names, current config, or previous conversations.

Map the answer as:

| User answer | makecli environment |
|-------------|---------------------|
| 开发 | `dev` |
| 测试 | `test` |

Use this command after selection:

```bash
makecli configure set environment <selected-env>
```

For example, if the user answers `开发`, run:

```bash
makecli configure set environment dev
```

If the user answers anything other than `开发` or `测试`, ask again with the exact prompt above. If the command fails, report the error and ask the user whether to retry or choose another environment. Continue only after the environment command succeeds.

Do not configure old `server-url` values. If a previous config contains old server-url settings, do not reuse them; prefer the current `--env`, `--meta-server-url`, and `--repo-server-url` model when a later Make workflow needs explicit endpoints.

### Verify Token With Guided Login

After the environment is configured successfully, check the current token:

```bash
makecli configure verify --output=json
```

If verification succeeds, continue to project folder initialization.

If verification fails because the token is missing, expired, invalid, or belongs to the wrong environment:

1. Run:
   ```bash
   makecli login
   ```
2. Wait up to 20 seconds for the command to receive the login callback and exit successfully.
3. If `makecli login` exits successfully within 20 seconds, continue to project folder initialization.
4. If 20 seconds pass without a callback and `makecli login` is still waiting, terminate the running `makecli login` process with Ctrl-C or SIGINT to close the callback listener, then tell the user:
   ```text
   请在浏览器或终端中完成 makecli 登录。完成后回复“已经完成登录”。
   ```
5. Stop and wait for the user to reply `已经完成登录`（等用户回复“已经完成登录”）.
6. After the user replies `已经完成登录`, do not run `makecli configure verify --output=json` and do not wait for the previous callback. Immediately run `makecli login` again to start a fresh authorization.
7. Apply the same 20-second callback rule to each fresh `makecli login`: if it exits successfully, continue; if it is still waiting after 20 seconds, terminate it to close the callback listener, tell the user the same message, wait for `已经完成登录`, and repeat step 6.

If browser login is not convenient, offer the token fallback:

```bash
makecli configure token
```

The user must complete interactive secret entry in their own terminal. After the user finishes, return to the guided `makecli login` flow above instead of running token verification after their reply.

### Initialize PoC Project Folder

Run this step only after environment selection succeeds and either the initial token verification passed or a `makecli login` command completed successfully.

Ask the user exactly:

```text
是否使用当前目录作为 PoC 目录？请回复“是”或“否”。
```

If the user replies `是`, run:

```bash
pwd
```

Use that absolute current directory as `<project-folder>`.

If the user replies `否`, ask exactly:

```text
请输入 PoC 目录地址：
```

Wait for the user to provide the directory address. Do not infer a directory from previous messages. Accept either an absolute path or a relative path as provided by the user.

If the user replies anything other than `是` or `否` to the first prompt, ask again with the exact prompt above.

After `<project-folder>` is selected, run:

```bash
makecli app init <project-folder>
```

Quote or escape `<project-folder>` safely when executing the command, especially if the path contains spaces or shell metacharacters.

If `makecli app init <project-folder>` fails, report the error and ask the user whether to retry the same directory or enter another directory. Continue only after `makecli app init <project-folder>` succeeds.

## Completion Output

End only after environment selection succeeds, either the initial token verification passed or a `makecli login` command completed successfully, and `makecli app init <project-folder>` succeeds. Use a concise readiness report:

- OS path used: macOS or WSL.
- Tool versions: Node, pnpm, git, makecli.
- Make skills result.
- Make environment: selected value, `dev` or `test`.
- Login status: already valid or refreshed with `makecli login`.
- PoC project folder: selected `<project-folder>`.
- Project initialization: `makecli app init` completed.

Keep the completion output concise and next-step focused. Omit negative summaries about actions not performed.

Do not show internal status names in user-facing output.

If everything passes, say:

```text
环境已经准备好了，可以进行下一步 PoC 了。
```

Then provide this small example:

```text
PoC示例：
我要做一个 Make PoC，用来演示合同台账管理。
角色包括管理员和业务人员。
核心流程是新建合同、维护付款计划、查看合同列表和详情。
请先和我确认需求细节，生成 apps/docs/PRD.md，再进行 DSL 建模；DSL 必须先 diff，等我确认后才 apply。
```
