#!/usr/bin/env node
// 执行文档声明的文件复制流程，防止发布门禁依赖未分发的本地模块。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const skill = fileURLToPath(new URL('../', import.meta.url));
const guide = fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
const section = guide.split('## Project-local audit\n')[1]?.split('\n## ')[0];
assert.ok(section, 'auth Skill must document the project-local audit bundle');
const files = [
  ...section.matchAll(/^\| `(scripts\/[^`]+)` \| `(scripts\/[^`]+)` \|$/gm),
].map((match) => ({ source: match[1], target: match[2] }));
assert.ok(
  files.length > 0,
  'copy instructions must declare source and destination files'
);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-audit-copy-'));
try {
  const workspace = path.join(root, '独立 App workspace');
  for (const file of files) {
    const target = path.resolve(workspace, file.target);
    assert.ok(
      target.startsWith(workspace + path.sep),
      'copy target must stay inside the workspace'
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(skill, file.source), target);
  }
  const result = spawnSync(
    process.execPath,
    [path.join(workspace, 'scripts/audit-auth-contract.mjs'), '--help'],
    { cwd: workspace, encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Usage:/);
  console.log(
    'documented auth audit bundle: isolated project copy and module loading passed'
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
