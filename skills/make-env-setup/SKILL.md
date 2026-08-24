---
name: make-env-setup
description: Use when preparing or updating the local Make development environment before development. Triggered by Make 环境安装, Make 环境初始化, 更新 Make 环境. Does not manage Make resources, deploy Apps, or write PRD, DSL, Service, or UI code; use makecli for resource/deploy operations and the owning skills for implementation.
metadata:
  version: 0.3.0
  homepage: https://github.com/qfeius/make-platform-skills
---

# make-env-setup
Prepare the local environment and initialize the project folder for a Make App before any PRD, DSL, Service, UI, apply, deploy, or git work.


## Safety Rules
- Do not print or store tokens, cookies, Authorization headers, passwords, or secrets.
- Do not manually create PRD, DSL, Service, or UI files; only run `makecli app init` in the selected directory.
- Interactive secret entry must be completed by the user. Do not ask the user to paste secrets into chat.

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

3. Install missing tools and upgrade brew-managed tools. `brew upgrade` is a no-op when the package is already current. A tool that exists but is not brew-managed (for example node via nvm, pnpm via corepack) must be left untouched; note it in the summary.

   ```bash
   for pkg in node pnpm git; do
     if ! command -v "$pkg" >/dev/null 2>&1; then
       brew install "$pkg"
     elif brew list "$pkg" >/dev/null 2>&1; then
       brew upgrade "$pkg"
     fi
   done
   ```

4. Install or update `makecli`. The two env vars keep this step scoped to makecli only: no implicit metadata refresh (step 2 already ran `brew update`) and no cascading upgrade of other installed packages.

   ```bash
   brew tap qfeius/makecli
   brew trust qfeius/makecli
   export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1
   if ! command -v makecli >/dev/null 2>&1; then
     brew install qfeius/makecli/makecli
   elif brew list makecli >/dev/null 2>&1; then
     brew upgrade makecli
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

## Verify Token With Guided Login

After the environment is configured successfully, check the current token:

```bash
makecli configure verify --output=json
```

If verification succeeds, continue to project folder initialization.

If verification fails because the token is missing, expired, invalid, or belongs to the wrong environment:

1. Run:
   ```bash
   makecli login --timeout=60s
   ```
   The command opens the browser, waits up to 60 seconds for the login callback, then exits on its own. If it prints an authorization URL instead of opening a browser, relay that URL to the user.
2. If the command exits successfully, login is done; continue to project folder initialization.
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

End only after the toolchain is installed and verified, the token is valid (initial verification passed or the login flow succeeded), and `makecli app init` succeeded. Use a concise readiness report:

- OS path used: macOS or WSL.
- Tool versions: Node, pnpm, git, makecli.
- Make skills result.
- Login status: already valid or refreshed with `makecli login`.
- App folder: the initialized directory.

Keep the completion output concise and next-step focused. Omit negative summaries about actions not performed.

If everything passes, say:

```text
Make 开发环境已经准备好，可以进行下一步开发 App。
```

Then provide this small example:

```text
App 参考示例：

我要做一个 Make App，用来演示合同台账管理。
角色包括管理员和业务人员。
核心流程是新建合同、维护付款计划、查看合同列表和详情。
请先和我确认需求细节，生成 apps/docs/PRD.md，再进行 DSL 建模；DSL 必须先 diff，等我确认后才 apply。
```
