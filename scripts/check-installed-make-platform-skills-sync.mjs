#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillNames = [
  'make-app-permission',
  'make-app-service',
  'make-app-auth',
  'make-app-actions',
  'make-app-sort',
  'make-app-group',
];

const [sourceSkillsRootArg, installedSkillsRootArg] = process.argv.slice(2);

if (!sourceSkillsRootArg || !installedSkillsRootArg) {
  console.error(
    'usage: node check-installed-make-platform-skills-sync.mjs <source-skills-dir> <installed-skills-dir>',
  );
  process.exitCode = 2;
} else {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const skillChecker = path.join(
    scriptDir,
    '..',
    'skills',
    'make-app-permission',
    'scripts',
    'check-installed-skill-sync.mjs',
  );
  const sourceSkillsRoot = path.resolve(sourceSkillsRootArg);
  const installedSkillsRoot = path.resolve(installedSkillsRootArg);
  let hasFailure = false;

  for (const skillName of skillNames) {
    const result = spawnSync(
      process.execPath,
      [
        skillChecker,
        path.join(sourceSkillsRoot, skillName),
        path.join(installedSkillsRoot, skillName),
      ],
      { encoding: 'utf8' },
    );
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    hasFailure ||= result.status !== 0;
  }

  if (hasFailure) {
    console.error('installed Make platform skills sync: FAIL');
    process.exitCode = 1;
  } else {
    console.log('installed Make platform skills sync: PASS');
  }
}
