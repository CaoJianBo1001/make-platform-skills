import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

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
  assert.match(scoped, /business title, toolbar, search, statistics, table headers, rows, forms and dialogs/u);
  assert.match(scoped, /outside the replaced business subtree/u);
  assert.match(scoped, /unknown 403, 401 and service failures are not permission denial/u);
});

const feedbackDependencies = process.env.MAKE_FEEDBACK_TEST_DEPENDENCIES;
test('the App shell mounts the assistant outside the object guard', {
  skip: feedbackDependencies ? false : 'runs in the CI feedback step with TypeScript',
}, async () => {
  const require = createRequire(path.resolve(feedbackDependencies, 'resource-feedback-test.cjs'));
  const ts = require('typescript');
  const guide = await read('make-app-permission/references/scoped-route-feedback.md');
  const jsx = guide.match(/```jsx\n([\s\S]*?)\n```/u)?.[1];
  assert.ok(jsx, 'expected the documented router example');
  const source = ts.createSourceFile('router.jsx', jsx, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  assert.equal(source.parseDiagnostics.length, 0, 'expected valid JSX');
  const router = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AppRouter');
  assert.ok(router?.body, 'expected AppRouter');

  const shells = [];
  const guards = [];
  const assistants = [];
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = (node.openingElement ?? node).tagName.getText(source);
      if (name === 'AppShell') shells.push(node);
      if (name === 'ObjectRouteGuard') guards.push(node);
    }
    if (ts.isJsxExpression(node) && node.expression?.getText(source) === 'assistantEntry'
        && !ts.isJsxAttribute(node.parent)) assistants.push(node);
    ts.forEachChild(node, visit);
  }
  visit(router.body);
  assert.equal(shells.length, 1);
  assert.equal(guards.length, 1);
  assert.equal(assistants.length, 1);
  assert.ok(ts.findAncestor(guards[0], node => node === shells[0]), 'the guard is inside the shell');
  assert.ok(ts.findAncestor(assistants[0], node => node === shells[0]), 'the assistant is inside the shell');
  assert.ok(!ts.findAncestor(assistants[0], node => node === guards[0]), 'the assistant is outside the guard');
});

test('the documented Agent context follows the current authorized page', async () => {
  const guide = await read('make-ai-assistant/references/make-app-host-integration.md');
  const expression = guide.match(/context=\{(\{[\s\S]*?\n  \})\}/u)?.[1];
  assert.ok(expression, 'expected the context passed to MakeAppAssistantEntry');
  const appRootPath = '/apps/sample';
  const resource = { entityKey: 'Orders', recordId: 'row-7' };
  const pathname = appRootPath + '/Orders/row-7';
  const render = (currentPage, route) => JSON.parse(runInNewContext(`JSON.stringify(${expression})`, {
    currentPage, appRootPath, appId: 'app-1', appName: 'Sample', navigator: { language: 'en' },
    ...route,
  }));
  const allowed = { kind: 'allowed', pathname, resource };
  const context = render(allowed, { pathname, ...resource });
  assert.deepEqual(context.resource, resource);
  assert.equal(context.location.pathname, pathname);
  for (const kind of ['forbidden', 'pending', 'unavailable']) {
    // The old page data and the new raw URL can both still be in memory.
    const context = render({ ...allowed, kind }, {
      pathname: '/apps/sample/Invoices/row-9', entityKey: 'Invoices', recordId: 'row-9',
    });
    assert.equal(context.resource, undefined, kind + ' page exposed its resource');
    assert.equal(context.location.pathname, appRootPath, kind + ' page exposed its URL');
    assert.doesNotMatch(JSON.stringify(context), /Orders|Invoices|row-[79]/u);
  }
  assert.equal(render({ kind: 'allowed', pathname: '/help' }, { pathname: '/help' }).resource, undefined);
});

test('UI composition replaces the entire business slot without changing operation feedback', async () => {
  const guide = await read('makeui/references/permission-feedback.md');
  assert.match(guide, /entire business content slot/u);
  assert.match(guide, /not a table-body or form-field slot/u);
  assert.match(guide, /variant="inline" scope="operation"/u);
  assert.match(guide, /preserves permitted draft values/u);
  assert.match(guide, /never performs this work or replays a mutation/u);
});

test('new feedback installations resolve a compatible release without silently updating locked Apps', async () => {
  const guide = await read('makeui/references/permission-feedback.md');
  const integration = await read('make-app-observability/references/package-integration.md');
  const install = guide.match(/corepack pnpm add (@qfei-design\/make-app-observability@[^`\s]+)/u)?.[1];
  assert.equal(install, '@qfei-design/make-app-observability@^0.1.11');
  assert.match(integration, /@qfei-design\/make-app-observability@\^0\.1\.11/u);
  assert.match(guide, /lockfile[\s\S]*explicit[\s\S]*upgrade/iu);
  assert.match(guide, /untouched legacy Apps/iu);
});

test('the queue example forwards one event identity to the component and close callback', async () => {
  const guide = await read('makeui/references/permission-feedback.md');
  const example = [...guide.matchAll(/```tsx\n([\s\S]*?)\n```/gu)].map(match => match[1]).find(code => code.includes('variant="toast"'));
  assert.ok(example, 'the actual host queue example must remain discoverable');
  assert.match(example, /key=\{notice\.id\}/u);
  assert.match(example, /noticeKey=\{notice\.id\}/u);
  assert.match(example, /onClose=\{\(\) => dismissNotice\(notice\.id\)\}/u);
  assert.doesNotMatch(example, /setTimeout|setInterval/u);
  assert.doesNotMatch(guide, /Toast component does not start a timer|host owns duration/iu);
});

test('lifecycle guidance keeps persistent feedback distinct from timed notifications', async () => {
  const guide = await read('makeui/references/permission-feedback.md');
  const evidence = await read('make-app-observability/references/testing-and-audit.md');
  assert.match(guide, /duration[\s\S]*3[\s\S]*0[\s\S]*inline\/page/u);
  assert.match(guide, /noticeKey[\s\S]*rerender/iu);
  for (const requirement of ['noticeKey', 'duration', 'onClose', 'inline/page', '管理员', '卸载']) {
    assert.ok(evidence.includes(requirement), `mounted lifecycle evidence must cover ${requirement}`);
  }
});
