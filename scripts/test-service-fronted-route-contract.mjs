#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'skills/make-app-service/SKILL.md',
  'skills/make-app-service/references/service-api-contracts.md',
];
const publicPaths = new Set(['/api/health', '/health', '/api/config']);

for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const section = file.endsWith('SKILL.md')
    ? text.split('## Default route baseline\n')[1]?.split('\n## ')[0]
    : text.split('## Default route response modes\n')[1]?.split('\n## ')[0];
  assert.ok(section, 'missing default routes: ' + file);
  const declarations = [...section.matchAll(/\b(?:GET|POST|PATCH|PUT|DELETE)(?:\/(?:GET|POST|PATCH|PUT|DELETE))*\s+(\/[^\s`|,]+)/g)];
  assert.ok(declarations.length > 5, 'default route list must be exercised: ' + file);
  for (const [, route] of declarations) {
    assert.ok(publicPaths.has(route) || route.startsWith('/api/make/app/'), 'new Service business route must share the authenticated /api/make/app namespace: ' + file + ' ' + route);
  }
}
for (const file of [
  ...files,
  'skills/makeui/references/component-usage.md',
  'skills/make-app-sort/references/service-contract.md',
  'skills/make-app-sort/references/preset-and-data-flow.md',
  'skills/make-app-group/references/service-contract.md',
  'skills/make-app-group/references/preset-and-data-flow.md',
  'skills/make-app-filter/references/preset-integration.md',
  'skills/canvas-table-integration/references/make-cell-edit-defaults.md',
  'skills/canvas-table-integration/references/field-editor-patterns.md',
]) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  assert.doesNotMatch(text, /\/api\/(?:schema|entities|users|departments|lookup-options|files)\b/, 'shared new-App examples must not reintroduce a different default namespace: ' + file);
}
console.log('Service-fronted default route namespace contract passed');
