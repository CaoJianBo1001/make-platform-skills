import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const startup = await readFile(new URL('../skills/make-app-auth/references/sdk-integration.md', import.meta.url), 'utf8');
const requests = await readFile(new URL('../skills/make-app-auth/references/request-adapter.md', import.meta.url), 'utf8');
const startupBody = startup.match(/const boot = await auth\.init\(\{ redirect: true \}\);([\s\S]*?)\n```/u)?.[0].replace(/\n```$/u, '');
assert.ok(startupBody, 'execute the actual documented SDK startup consumer');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const renderStartup = new AsyncFunction('auth', 'renderApp', 'renderLoginExpired', 'renderForbidden', 'renderLoading', startupBody);
const contacts = [{ userId: 'admin-1', name: '管理员一', avatarUrl: null }];

test('auth prose does not require login for every business 403', () => {
  for (const source of [startup, requests]) {
    assert.doesNotMatch(source, /401\/403[^\n]*redirects?[^\n]*(?:login|once)|unified-login 401\/403 redirect/iu);
    assert.match(source, /(?:confirmed|classified) business permission denial[^\n]*must not[^\n]*(?:login|redirect)/iu);
  }
});

for (const payload of [
  '无权限，请联系应用管理员授权',
  { code: 403, msg: '无权限，请联系应用管理员授权', data: { appAdministrators: contacts } },
  { code: 403, data: { appAdministrators: [] } },
  { code: 403 },
  { reason: 'permission_denied', data: { appAdministrators: contacts } },
]) {
  test(`startup forbidden keeps its payload without requiring a business reason: ${JSON.stringify(payload)}`, async () => {
    let denied = 0;
    await renderStartup({
      init: async options => { assert.deepEqual(options, { redirect: true }); return { status: 'forbidden', httpStatus: 403, payload }; },
      login() { assert.fail('startup denial must not retry login'); },
      getAppAdministrators() { assert.fail('startup must render before any optional help lookup'); },
    }, () => assert.fail('startup denial must not mount authorized content'),
    () => assert.fail('forbidden is not an expired session'),
    actual => { denied++; assert.equal(actual, payload); },
    () => assert.fail('known SDK forbidden must not remain loading'));
    assert.equal(denied, 1);
  });
}

for (const status of ['unauthenticated', 'redirecting', 'failed']) {
  test(`startup ${status} must not be guessed as denied permission`, async () => {
    let loading = 0;
    await renderStartup({ init: async () => ({ status, payload: { reason: 'permission_denied' } }) },
      () => assert.fail('unsuccessful startup must not mount authorized content'),
      () => assert.fail('no expiry reason was returned'),
      () => assert.fail('a payload field cannot replace the SDK startup status'),
      () => { loading++; });
    assert.equal(loading, 1);
  });
}

const handlerSource = requests.match(/async function handleMakeRequestError\([\s\S]*?\n\}/u)?.[0];
assert.ok(handlerSource, 'execute the actual documented business-error consumer');
class Unauthorized extends Error {}
class Forbidden extends Error { constructor(payload) { super('fixture'); this.payload = payload; } }
const handleRequest = new Function('MakeAppUnauthorizedError', 'MakeAppForbiddenError', 'showNeutralLoading', 'makeAuthConfig', 'auth',
  `${handlerSource}; return handleMakeRequestError;`)(Unauthorized, Forbidden,
  () => assert.fail('a business 403 is not login expiry'), { apiAuthRedirect: true },
  { login() { assert.fail('a business 403 must not restart login'); } });

for (const payload of ['legacy text', { code: 403 }, { code: 403, data: { appAdministrators: contacts } }]) {
  test(`unknown business 403 remains an error: ${JSON.stringify(payload)}`, async () => {
    const error = new Forbidden(payload);
    await assert.rejects(handleRequest(error, { scope: 'resource', onPermissionDenied() { assert.fail('unknown business 403 must not enter denied feedback'); } }), actual => actual === error);
  });
}
for (const scope of ['resource', 'operation']) {
  test(`known business denial preserves ${scope}, never startup App scope`, async () => {
    const payload = { reason: 'permission_denied', data: { appAdministrators: contacts } };
    const events = [];
    await handleRequest(new Forbidden(payload), { scope, onPermissionDenied: event => events.push(event) });
    assert.deepEqual(events, [{ scope, payload }]);
  });
}
