#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(
  process.argv[2] ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
);
const skill = path.join(root, 'skills/make-ai-assistant');
const read = (name) => fs.readFileSync(path.join(skill, name), 'utf8');
const guide = read('SKILL.md');
assert.match(guide, /version:\s*0\.4\.5/); // Skill 与 npm 版本独立，本次更新恰为同号。
for (const file of fs.readdirSync(path.join(skill, 'references'))) {
  assert.ok(
    guide.includes('references/' + file),
    file + ' must be discoverable'
  );
  if (!file.endsWith('.md')) continue;
  const text = read('references/' + file);
  assert.doesNotMatch(
    text,
    /\/(?:Users|home|var\/folders)\/|ExpensePoc|expensePoc|报销|tenant-87/,
    file + ' must be portable'
  );
  assert.doesNotMatch(
    text,
    /createMakeAgentClient|ResponseSnapshot|Make-AI-Api-Version|client\.responses\.subscribe|AI_UNSUPPORTED_MEDIA/,
    file + ' retains a retired protocol'
  );
}
assert.match(guide, /MakeAppAssistantEntry/);
assert.match(read('references/package-integration.md'), /createAgentClient/);
assert.match(
  read('references/make-app-host-integration.md'),
  /app\.id|app: \{ id/
);
assert.match(read('references/testing-and-pitfalls.md'), /独立|independent/);
assert.match(read('agents/openai.yaml'), /MakeAppAssistantEntry/);
console.log('make-ai-assistant skill portability and resources passed');
