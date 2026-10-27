#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isRegisteredPermission} from '../skills/make-app-permission/scripts/permission-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = ['make-app-permission', 'make-app-actions', 'make-app-service'];
const violations = [];
for (const directory of directories) {
  const folder = path.join(root, 'skills', directory);
  const isInstructionSource = name => name.endsWith('.md') || /^audit-.*\.mjs$/.test(path.basename(name));
  for (const name of fs.readdirSync(folder, {recursive: true}).filter(isInstructionSource)) {
    const file = path.join(folder, name);
    for (const [index, line] of fs.readFileSync(file, 'utf8').split('\n').entries()) {
      const keys = line.replace(/\\+/g, '').match(/\b(?:(?:meta|data|iam|repo|agent)\.[A-Za-z]+\.[A-Za-z]+|make\.platform\.[A-Za-z]+)/g) ?? [];
      for (const key of new Set(keys)) {
        if (!isRegisteredPermission(key)) violations.push(`${path.relative(root, file)}:${index + 1}: ${key}`);
        if (!/^(?:data|meta)\./.test(key)) violations.push(`${path.relative(root, file)}:${index + 1}: ${key} belongs outside the Make App business-permission scope`);
      }
    }
  }
}
assert.deepEqual(violations, [], 'Make App instructions and examples must use documented data/meta permission keys; platform administration and invalid literals are outside this Skill scope');
console.log('permission instruction source authority: PASS');

// The official principal response contains final scalar field states. Schema
// multi-access values are a separate contract and must not appear in this DTO.
const principalReference = fs.readFileSync(path.join(root, 'skills/make-app-permission/references/service-principal-permission.md'), 'utf8');
const finalFieldStates = new Set(['hidden', 'fullMask', 'partialMask', 'readonly', 'editable']);
let responseExamples = 0;
for (const match of principalReference.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
  const payload = JSON.parse(match[1]);
  if (!Array.isArray(payload.data?.permissions)) continue;
  responseExamples++;
  for (const permission of payload.data.permissions) {
    for (const state of Object.values(permission.fieldAccess ?? {})) {
      assert.ok(typeof state === 'string' && finalFieldStates.has(state), 'principal response fieldAccess must use the documented five scalar states');
    }
  }
}
assert.ok(responseExamples > 0, 'document a source-backed principal response example');
console.log('principal response example source contract: PASS');
