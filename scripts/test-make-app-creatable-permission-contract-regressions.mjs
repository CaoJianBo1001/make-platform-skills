#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, '..');
const contractScript = path.join(scriptDir, 'test-make-app-creatable-permission-contract.mjs');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creatable-permission-contract-'));
let caseCount = 0;

try {
  for (const entry of ['skills', 'scripts', 'README.md']) {
    fs.cpSync(path.join(repoRoot, entry), path.join(fixtureRoot, entry), { recursive: true });
  }
  checkContract('current Skill versions', true);

  for (const skillName of ['make-app-service', 'make-app-auth']) {
    const skillPath = path.join(fixtureRoot, 'skills', skillName, 'SKILL.md');
    const original = fs.readFileSync(skillPath, 'utf8');
    const versionLine = /^  version: (\d+)\.(\d+)\.(\d+)$/m;
    const version = original.match(versionLine);
    assert.ok(version, `${skillName} fixture must declare its current version`);
    const [major, minor, patch] = version.slice(1).map(Number);
    const traceLine = original.match(/^- [^\n]*make-app-observability[^\n]*Trace ID[^\n]*$/m)?.[0];
    assert.ok(traceLine, `${skillName} fixture must contain the Trace ID handoff`);

    const mutations = [
      ['patch upgrade', original.replace(versionLine, `  version: ${major}.${minor}.${patch + 1}`), true],
      ['minor upgrade', original.replace(versionLine, `  version: ${major}.${minor + 1}.0`), true],
      ['missing version', original.replace(versionLine, ''), false, `${skillName} must declare a three-part metadata.version`],
      ['invalid version', original.replace(versionLine, '  version: invalid'), false, `${skillName} must declare a three-part metadata.version`],
      ['invalid version suffix', original.replace(versionLine, '  version: 0.1.2.3'), false, `${skillName} must declare a three-part metadata.version`],
      ['missing Trace handoff', original.replace(traceLine, ''), false, `${skillName} must include the default Trace ID handoff`],
      ['missing Trace header', original.replace(traceLine, traceLine.replace('X-Log-Id', 'unrelated-header')), false, `${skillName} must include the default Trace ID handoff`],
    ];
    if (skillName === 'make-app-service') {
      mutations.push(['below release baseline', original.replace(versionLine, '  version: 0.2.3'), false, 'make-app-service 必须保留 0.2.4+ 的发布基线']);
    }

    for (const [name, mutated, expectedSuccess, failureMessage] of mutations) {
      assert.notEqual(mutated, original, `${skillName}: ${name} must change the fixture`);
      fs.writeFileSync(skillPath, mutated);
      try {
        checkContract(`${skillName}: ${name}`, expectedSuccess, failureMessage);
      } finally {
        fs.writeFileSync(skillPath, original);
      }
    }
  }

  console.log(`creatable permission contract regressions: PASS (${caseCount} cases)`);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function checkContract(name, expectedSuccess, failureMessage) {
  const result = spawnSync(process.execPath, [contractScript, fixtureRoot], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${name}: contract process must finish`);
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(
    result.status === 0,
    expectedSuccess,
    `${name}: unexpected contract result (exit ${result.status}):\n${output.slice(0, 1600)}`,
  );
  if (failureMessage) assert.ok(output.includes(failureMessage), `${name}: expected ${failureMessage}`);
  caseCount += 1;
}
