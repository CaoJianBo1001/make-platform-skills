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
// Skill 文档可独立更新；正式 SDK 版本继续由下面的包合同和 CI pins 严格验证。
const skillVersion = guide.match(/^  version: (\d+)\.(\d+)\.(\d+)$/m)?.slice(1).map(Number);
assert.ok(skillVersion && (
  skillVersion[0] > 0 || skillVersion[1] > 4 ||
  (skillVersion[1] === 4 && skillVersion[2] >= 6)
), 'Skill metadata must retain the 0.4.6+ contract baseline');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/skill-metadata-lint.yml'),
  'utf8',
);
const packagePins = [...workflow.matchAll(/--package=@qfei-design\/make-ai-assistant@([^\s\\]+)/gu)];
assert.ok(packagePins.length, 'CI must verify the official Agent package');
for (const [, version] of packagePins)
  assert.equal(version, '0.4.6', 'all Agent CI consumers must use the verified release');
assert.match(workflow, /node skills\/make-ai-assistant\/scripts\/verify-agent-terminal-notice\.mjs/);
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
