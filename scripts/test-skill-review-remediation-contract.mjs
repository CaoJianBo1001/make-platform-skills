#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const frontmatter = (content) => content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';

const environmentFrontmatter = frontmatter(read('skills/make-env-setup/SKILL.md'));
const environmentDescription = environmentFrontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? '';
assert.match(
  environmentDescription,
  /Does not (?:manage Make resources|deploy Apps|write PRD, DSL, Service, or UI code)/i,
  'make-env-setup must state that environment setup does not own downstream implementation or deployment work',
);
assert.match(
  environmentDescription,
  /use makecli/i,
  'make-env-setup must hand Make resource management and deployment to makecli',
);

const authSkillPath = 'skills/make-app-auth/SKILL.md';
const authSkill = read(authSkillPath);
assert.match(
  authSkill,
  /references\/service-fronted-node-example\.md/,
  'make-app-auth must point to the portable Service-fronted example reference',
);
assert.ok(
  fs.existsSync(path.join(repoRoot, 'skills/make-app-auth/references/service-fronted-node-example.md')),
  'make-app-auth must retain its Service-fronted example as a directly discoverable reference',
);
assert.ok(
  !fs.existsSync(path.join(repoRoot, 'skills/make-app-auth/examples')),
  'make-app-auth must not keep a non-standard top-level examples directory',
);

console.log('skill review remediation contract passed');
