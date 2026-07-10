#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, '..');

const skillPath = path.join(skillDir, 'SKILL.md');
const shellReferencePath = path.join(skillDir, 'references', 'app-shell-layout.md');
const skill = fs.readFileSync(skillPath, 'utf8');
const shellReference = fs.readFileSync(shellReferencePath, 'utf8');

assert.match(
  skill,
  /current-user[\s\S]*references\/app-shell-layout\.md/i,
  'makeui SKILL.md must route current-user details to app-shell-layout.md',
);
assert.match(
  skill,
  /current-context[\s\S]*userId[\s\S]*avatar[\s\S]*name/,
  'makeui SKILL.md must preserve the current-context normalization summary',
);

const referenceRelative = path.relative(process.cwd(), shellReferencePath);
assert.match(
  shellReference,
  /current-context[\s\S]*userId[\s\S]*avatar[\s\S]*name/,
  `${referenceRelative} must document current-context userId/avatar/name normalization`,
);
assert.match(
  shellReference,
  /name[\s\S]*userName[\s\S]*displayName[\s\S]*userId[\s\S]*(identity|身份)/,
  `${referenceRelative} must make userId an identity fallback, not the preferred display name`,
);
assert.match(
  shellReference,
  /avatar[\s\S]*avatarUrl[\s\S]*avatarURL[\s\S]*photoURL/,
  `${referenceRelative} must document common avatar field aliases`,
);

console.log('makeui current user contract passed');
