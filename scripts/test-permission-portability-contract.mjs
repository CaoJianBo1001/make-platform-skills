#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(root, 'skills/make-app-permission');
const violations = [];
for (const name of fs.readdirSync(skillRoot, {recursive: true}).filter(name => /\.(?:md|mjs|yaml)$/.test(name))) {
  const text = fs.readFileSync(path.join(skillRoot, name), 'utf8');
  for (const match of text.matchAll(/https?:\/\/[^\s)\]>"'`]+/g)) {
    const url = new URL(match[0]);
    if (url.hostname === 'git.qtech.cn'
      || (/(?:^|\.)feishu\.cn$/.test(url.hostname) && /^\/(?:wiki|docx|docs|sheets)(?:\/|$)/.test(url.pathname))) {
      violations.push({file: name, url: match[0]});
    }
  }
  if (/PermissionDesign\.md|MetaAPIDesign\.md|(?:第\s*|§\s*)7\.10/.test(text)) {
    violations.push({file: name, reason: 'permission guidance must use bundled references instead of inaccessible design-document names or sections'});
  }
}
assert.deepEqual(violations, [], 'the distributed permission Skill must be usable without access to private design documents');
for (const name of ['permission-boundaries.md', 'service-principal-permission.md', 'ui-permission-runtime.md', 'testing-and-audit.md']) {
  assert.ok(fs.existsSync(path.join(skillRoot, 'references', name)), 'ship the local contract: ' + name);
}
assert.ok(fs.existsSync(path.join(skillRoot, 'scripts/permission-registry.mjs')), 'ship the documented permission dictionary');
console.log('permission Skill portability contract: PASS');
