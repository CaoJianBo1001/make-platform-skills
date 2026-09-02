#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(scriptDir, 'check-installed-make-platform-skills-sync.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-platform-skills-sync-'));
const sourceRoot = path.join(tempRoot, 'source');
const installedRoot = path.join(tempRoot, 'installed');
const skillNames = [
  'make-app-permission',
  'make-app-service',
  'make-app-auth',
  'make-app-actions',
  'make-app-sort',
  'make-app-group',
];

try {
  for (const skillName of skillNames) {
    writeSkill(sourceRoot, skillName, 'source');
    writeSkill(installedRoot, skillName, 'source');
  }

  assert.match(runChecker(), /installed Make platform skills sync: PASS/);

  writeSkill(installedRoot, 'make-app-auth', 'stale');
  const mismatchOutput = runChecker({ expectFailure: true });
  assert.match(mismatchOutput, /make-app-auth/);
  assert.match(mismatchOutput, /content_mismatch/);

  console.log('installed Make platform skills sync tests: PASS');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function writeSkill(root, skillName, version) {
  const skillRoot = path.join(root, skillName);
  fs.mkdirSync(path.join(skillRoot, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), `---\nname: ${skillName}\n---\n${version}\n`);
  fs.writeFileSync(path.join(skillRoot, 'references', 'contract.md'), `${version}\n`);
}

function runChecker(options = {}) {
  const result = spawnSync(process.execPath, [checker, sourceRoot, installedRoot], {
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status === 0) {
    return output;
  }
  if (options.expectFailure) {
    return output;
  }
  throw new Error(output);
}
