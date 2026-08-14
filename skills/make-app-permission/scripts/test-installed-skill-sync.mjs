#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(scriptDir, 'check-installed-skill-sync.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-app-permission-sync-'));
const source = path.join(tempRoot, 'source');
const installed = path.join(tempRoot, 'installed');

try {
  write(path.join(source, 'SKILL.md'), '# source\n');
  write(path.join(source, 'references', 'contract.md'), '# contract\n');
  write(path.join(installed, 'SKILL.md'), '# source\n');
  write(path.join(installed, 'references', 'contract.md'), '# contract\n');

  const matching = run(source, installed);
  assert.equal(matching.status, 0, matching.output);
  assert.match(matching.output, /installed skill sync: PASS/);

  write(path.join(installed, 'references', 'contract.md'), '# stale\n');
  const stale = run(source, installed);
  assert.notEqual(stale.status, 0);
  assert.match(stale.output, /content_mismatch: references\/contract\.md/);

  write(path.join(installed, 'references', 'contract.md'), '# contract\n');
  write(path.join(installed, 'references', 'extra.md'), '# extra\n');
  const extra = run(source, installed);
  assert.notEqual(extra.status, 0);
  assert.match(extra.output, /installed_only: references\/extra\.md/);

  fs.rmSync(path.join(installed, 'references', 'extra.md'));
  fs.rmSync(path.join(installed, 'SKILL.md'));
  const missing = run(source, installed);
  assert.notEqual(missing.status, 0);
  assert.match(missing.output, /source_only: SKILL\.md/);

  console.log('installed-skill-sync tests: PASS');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function run(sourceRoot, installedRoot) {
  const result = spawnSync(process.execPath, [checker, sourceRoot, installedRoot], {
    encoding: 'utf8',
  });
  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status,
  };
}
