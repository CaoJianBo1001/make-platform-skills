import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasDirectCiNodeCommand } from './lib/ci-node-test-command.mjs';

const read = file => readFile(new URL(`../skills/${file}`, import.meta.url), 'utf8');

test('new App dependency guidance uses feedback ^0.1.10 and auth SDK 0.1.5', async () => {
  const sdk = await read('make-app-auth/references/sdk-integration.md');
  const feedback = await read('make-app-observability/references/package-integration.md');
  const permission = await read('makeui/references/permission-feedback.md');
  const dependency = JSON.parse(sdk.match(/```json\n([\s\S]*?)\n```/u)?.[1] ?? '{}');
  assert.equal(dependency.dependencies?.['@qfeius/make-app-auth'], '^0.1.5');
  assert.match(sdk, /pnpm add @qfeius\/make-app-auth@\^0\.1\.5\b/u);
  assert.match(feedback, /@qfei-design\/make-app-observability@\^0\.1\.10\b/u);
  assert.match(permission, /pnpm add @qfei-design\/make-app-observability@\^0\.1\.10\b/u);
});

test('permission package and route regression tests are continuous CI gates', async () => {
  const workflow = await readFile(new URL('../.github/workflows/skill-metadata-lint.yml', import.meta.url), 'utf8');
  for (const script of [
    'skills/makeui/scripts/test-verify-feedback-package-surface.mjs',
    'skills/make-app-permission/scripts/test-scoped-route-feedback.mjs',
    'skills/makeui/scripts/test-feedback-sdk-types.mjs',
  ]) assert.ok(hasDirectCiNodeCommand(workflow, script), `${script} must remain a CI gate`);
  assert.match(workflow, /--package=typescript@5\.9\.3/u);
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

test('SDK nullable avatars are normalized without narrowing the SDK method to UI DTOs', async () => {
  const guide = await read('makeui/references/permission-feedback.md');
  const auth = await read('make-app-auth/references/access-help.md');
  assert.match(guide, /avatarUrl\?: string \| null/u);
  assert.match(guide, /avatarUrl: contact\.avatarUrl \?\? undefined/u);
  assert.match(auth, /avatarUrl\?: string \| null/u);
});
