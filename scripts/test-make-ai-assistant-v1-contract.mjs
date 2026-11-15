#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const ops = JSON.parse(
  read('skills/make-ai-assistant/references/service-operations.json')
);
// 预期集合独立于待测路由清单，来自固定的公共数据面资源合同。
const post = {
  '/agent': ['GetResource', 'ListResources'],
  '/agent/input-capabilities': ['GetResource'],
  '/session': ['CreateResource', 'GetResource', 'ListResources'],
  '/session/preference': ['UpdateResource'],
  '/session/message': ['CreateResource', 'GetResource', 'ListResources'],
  '/session/message/queue': ['ListResources'],
  '/session/message/cancel': ['CreateResource'],
  '/session/message/resume': ['CreateResource'],
  '/session/message/feedback': ['UpdateResource'],
  '/session/task': ['GetResource', 'ListResources'],
  '/session/task/stop': ['CreateResource'],
  '/session/task/steer': ['ListResources'],
  '/session/run': ['GetResource', 'ListResources'],
  '/session/run/answer': ['CreateResource'],
  '/session/request': ['GetResource'],
  '/content': ['CreateResource'],
};
assert.equal(ops.sourceCommit, '1238c719e70ed80fd26976aedbc174bdff7998b4');
assert.deepEqual(ops.post, post);
assert.deepEqual(ops.get, ['/session/stream', '/content']);
assert.equal(Object.values(ops.post).flat().length + ops.get.length, 25);
for (const file of [
  'skills/make-ai-assistant/SKILL.md',
  ...[
    'package-integration',
    'make-app-host-integration',
    'make-app-protocol',
    'make-app-stream-and-attachments',
    'testing-and-pitfalls',
  ].map((f) => 'skills/make-ai-assistant/references/' + f + '.md'),
  'skills/make-app-auth/SKILL.md',
  'skills/make-app-auth/references/request-adapter.md',
  'skills/make-app-service/SKILL.md',
  'skills/make-app-service/references/service-api-contracts.md',
  'README.md',
])
  assert.doesNotMatch(
    read(file),
    /\/api\/make\/app\/ai\/v1|\/make\/app\/ai\/v1|18-operation|18 项操作|agentType\s*===?\s*["'`]app_internal/u,
    file
  );
const serviceContract = read('skills/make-app-service/references/service-api-contracts.md');
const aiResponseGuide = serviceContract.split('**AI safe-error exception:**')[1]?.split('\n## ')[0];
assert.ok(aiResponseGuide, 'Service must define the Agent response ownership exception');
assert.doesNotMatch(aiResponseGuide, /bare JSON|empty 204|\{\s*code\s*,\s*message\b/, 'Service must not prescribe the superseded private Agent wire format');
const responseOwner = [...aiResponseGuide.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
  .find(([, target]) => target.includes('make-ai-assistant/references/make-app-protocol.md'));
assert.ok(responseOwner, 'Service must link its AI response exception to the bundled Agent protocol owner');
assert.ok(fs.existsSync(path.resolve(root, 'skills/make-app-service/references', responseOwner[1].split('#')[0])));
console.log('make-ai-assistant Agent Public API v1 contract passed');
