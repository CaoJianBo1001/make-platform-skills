import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../skills/${file}`, import.meta.url), 'utf8');

test('permission package and route regression tests are continuous CI gates', async () => {
  const workflow = await readFile(new URL('../.github/workflows/skill-metadata-lint.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node --test skills\/makeui\/scripts\/test-verify-feedback-package-surface\.mjs/u);
  assert.match(workflow, /node --test skills\/make-app-permission\/scripts\/test-scoped-route-feedback\.mjs/u);
});

test('auth startup and adapter preserve denial payload and scope', async () => {
  const startup = await read('make-app-auth/references/sdk-integration.md');
  const adapter = await read('make-app-auth/references/request-adapter.md');
  assert.match(startup, /renderForbidden\(boot\.payload\)/);
  assert.doesNotMatch(adapter, /renderForbidden\(\)/);
  assert.match(adapter, /error\.payload/);
  assert.match(adapter, /scope: 'resource'/);
  assert.match(adapter, /reason === 'permission_denied'/);
  assert.match(adapter, /throw error/);
});

test('permission guards load contact help without sending protected data requests', async () => {
  const permission = await read('make-app-permission/references/ui-permission-runtime.md');
  const scoped = await read('make-app-permission/references/scoped-route-feedback.md');
  assert.match(permission, /getAppAdministrators/);
  assert.match(permission, /without.*business request/i);
  assert.match(permission, /makeui\/references\/permission-feedback\.md/u);
  assert.match(scoped, /AppPermissionFeedback[^>]*scope="resource"/u);
  assert.match(permission, /do not fetch data/);
});

test('React feedback integration has one owner and real package/CSS entries', async () => {
  const ui = await read('makeui/SKILL.md');
  const auth = await read('make-app-auth/references/access-help.md');
  const permission = await read('make-app-permission/references/scoped-route-feedback.md');
  const guide = await read('makeui/references/permission-feedback.md');
  assert.match(ui, /references\/permission-feedback\.md/u);
  for (const source of [auth, permission]) assert.match(source, /makeui\/references\/permission-feedback\.md/u);
  assert.match(guide, /import \{ MakeAppPermissionNotice \} from '@qfei-design\/make-app-observability\/react'/u);
  assert.match(guide, /import '@qfei-design\/make-app-observability\/styles\.css'/u);
  assert.match(guide, /variant="page"[^\n]*scope="app"/u);
  assert.match(guide, /variant="inline"[^\n]*scope="resource"/u);
  assert.match(guide, /variant="toast"[^\n]*scope="operation"/u);
  assert.match(guide, /MakeAppErrorNoticeViewport/u);
  assert.match(guide, /onReturn.*host|host.*onReturn/iu);
  for (const source of [ui, auth, permission, guide]) {
    assert.doesNotMatch(source, /@qfeius\/make-app-feedback/u);
  }
  assert.match(guide, /verify-feedback-package-surface\.mjs/u);
  assert.match(guide, /not proof of registry publication/u);
  assert.doesNotMatch(auth, /await showForbidden\(/u);
});

test('contact lookup and release boundary are discoverable from both skills', async () => {
  const auth = await read('make-app-auth/SKILL.md');
  const permission = await read('make-app-permission/SKILL.md');
  const contract = await read('make-app-auth/references/access-help.md');
  assert.match(auth, /references\/access-help\.md/);
  assert.match(permission, /access-help\.md/);
  assert.match(contract, /\/auth\/app-administrators/);
  assert.match(contract, /typeof auth\.getAppAdministrators/);
  assert.match(contract, /not.*published|unreleased/i);
  assert.match(contract, /tenant/i);
  assert.match(contract, /no-store/);
});
