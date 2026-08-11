#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const lintScript = path.join(scriptDir, 'lint-skill-metadata.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-metadata-lint-'));

try {
  writeSkill('valid-description', 'a'.repeat(1024));
  assert.match(runLint(), /skill metadata lint passed/);

  writeSkill('invalid-description', 'a'.repeat(1025));
  assert.match(
    runLint({ expectFailure: true }),
    /description exceeds 1024 characters/,
  );

  console.log('skill metadata lint tests: PASS');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

function writeSkill(name, description) {
  const skillDir = path.join(tempRoot, 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: "${description}"\nmetadata:\n  version: 0.1.0\n---\n\n# ${name}\n`,
    'utf8',
  );
}

function runLint({ expectFailure = false } = {}) {
  try {
    const output = execFileSync(process.execPath, [lintScript, tempRoot], {
      encoding: 'utf8',
    });
    if (expectFailure) {
      assert.fail(`Expected metadata lint failure, got:\n${output}`);
    }
    return output;
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (!expectFailure) {
      assert.fail(`Expected metadata lint success, got:\n${output}`);
    }
    return output;
  }
}
