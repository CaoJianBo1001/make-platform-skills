import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../skills/${file}`, import.meta.url), 'utf8');

test('resource denial guidance no longer requires keeping the denied business table mounted', async () => {
  const files = [
    'make-app-permission/SKILL.md',
    'make-app-permission/references/permission-boundaries.md',
    'make-app-permission/references/ui-permission-runtime.md',
    'make-app-permission/references/service-principal-permission.md',
    'make-app-permission/references/scoped-route-feedback.md',
    'make-app-permission/references/testing-and-audit.md',
    'makeui/references/permission-feedback.md',
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /(?:keep|retain|preserve)[^\n.]{0,100}(?:navigation\/headers|navigation\/table headers|table shell with authorized headers|table mounted with|navigation and headers)/iu, file);
    assert.doesNotMatch(source, /Do not replace the table with a forbidden page|without (?:removing|hiding)[^\n.]{0,100}headers/iu, file);
  }
});

test('resource composition checks runtime read denial above arbitrary business content', async () => {
  const scoped = await read('make-app-permission/references/scoped-route-feedback.md');
  const example = scoped.match(/```jsx\n([\s\S]*?)\n```/u)?.[1];
  assert.ok(example, 'a host composition example is discoverable');
  assert.match(example, /recordAccess\.kind === "forbidden"/u);
  assert.ok(example.indexOf('recordAccess.kind === "forbidden"') < example.indexOf('return <ObjectPage'), 'runtime read rejection returns before the business page mounts');
  assert.match(example, /<AppShell>[\s\S]*<ObjectRouteGuard/u);
  assert.match(scoped, /business title, toolbar, search, statistics, table headers, rows, forms and dialogs/u);
  assert.match(scoped, /outside the replaced business subtree/u);
  assert.match(scoped, /unknown 403, 401 and service failures are not permission denial/u);
});

test('UI composition replaces the entire business slot without changing operation feedback', async () => {
  const guide = await read('makeui/references/permission-feedback.md');
  assert.match(guide, /entire business content slot/u);
  assert.match(guide, /not a table-body or form-field slot/u);
  assert.match(guide, /variant="inline" scope="operation"/u);
  assert.match(guide, /preserves permitted draft values/u);
  assert.match(guide, /never performs this work or replays a mutation/u);
});
