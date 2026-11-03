#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const skill = read('skills/make-app-permission/SKILL.md');
const testing = read('skills/make-app-permission/references/testing-and-audit.md');
const workflow = read('.github/workflows/skill-metadata-lint.yml');
assert.match(skill, /write-permission-conformance-suite\.mjs/);
assert.match(testing, /createWriteHarness/);
for (const method of ['editableFieldKeys', 'refreshUi', 'refreshService', 'submit', 'requestUpdate', 'onRequest', 'onWrite', 'dispose']) {
  assert.ok(testing.includes(method), 'host write adapter contract must document ' + method);
}
assert.match(testing, /production|生产/);
assert.match(workflow, /node skills\/make-app-permission\/scripts\/test-write-permission-conformance-suite\.mjs/);
for (const name of ['metadata_wildcards_never_grant_business_edit', 'business_field_exact_deny_overrides_data_wildcards']) {
  assert.ok(read('skills/make-app-permission/scripts/permission-conformance-suite.mjs').includes(name));
}
assert.match(workflow, /test-platform-permission-contract\.mjs/);
assert.match(workflow, /test-permission-registry\.mjs/);
console.log('business field update contract: PASS');
