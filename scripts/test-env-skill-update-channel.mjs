#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const guide = fs.readFileSync(
  new URL('../skills/make-env-setup/SKILL.md', import.meta.url),
  'utf8'
);
const update = guide.match(
  /5\. Install or update Make platform skills every run\.([\s\S]*?)## Verify Versions/
)?.[1];
const command = update?.match(/```bash\n([\s\S]*?)\n\s*```/)?.[1];
assert.ok(command, 'environment skill must provide its Skill update command');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-channel-'));
try {
  for (const name of ['makecli', 'npx']) {
    fs.writeFileSync(
      path.join(root, name),
      `#!${process.execPath}\nconst fs=require('node:fs');fs.appendFileSync(process.env.UPDATE_LOG,JSON.stringify([${JSON.stringify(name)},...process.argv.slice(2)])+'\\n');\n`,
      { mode: 0o755 }
    );
  }
  for (const channel of ['stable', 'beta']) {
    const log = path.join(root, channel + '.log');
    const settings = path.join(root, 'settings.json');
    const selected = {
      channel,
      roles: ['app-developer'],
      agents: ['codex'],
      scope: 'project',
    };
    fs.writeFileSync(settings, JSON.stringify(selected));
    const result = spawnSync('sh', ['-ec', command], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: root + path.delimiter + process.env.PATH,
        UPDATE_LOG: log,
        MAKE_TEST_SETTINGS: settings,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse),
      [['makecli', 'skills', 'update']],
      'default update must delegate channel/role/scope selection to configured makecli'
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')), selected);
  }
  console.log('environment Skill update command: channel and scope preserved');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
