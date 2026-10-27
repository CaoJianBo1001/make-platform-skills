import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';

const guide = await readFile(new URL('../skills/makeui/references/permission-feedback.md', import.meta.url), 'utf8');
const example = guide.match(/```tsx\nimport \{ useEffect, useState \}[\s\S]*?\n```/u)?.[0];
assert.ok(example, 'the documented host adapter must remain executable');
const effect = example.match(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[auth, contextKey, payload, embedded\]\);/u)?.[1];
assert.ok(effect, 'exercise the actual documented contact effect, not a second implementation');
const startEffect = new Function('auth', 'contextKey', 'payload', 'embedded', 'setHelp', effect);

function mount(auth, payload, contextKey = 'resource:orders') {
  const states = [];
  const cleanup = startEffect(auth, contextKey, payload, payload?.data?.appAdministrators, state => states.push(state));
  return { states, cleanup, settle: () => setImmediate() };
}

const deniedPayload = () => ({ code: 403, reason: 'permission_denied', data: {} });
const noAuthSideEffects = () => ({
  api() { assert.fail('contact help must not issue business requests'); },
  login() { assert.fail('contact help must not enter login'); },
  logout() { assert.fail('contact help must not clear the session'); },
});

for (const scope of ['app', 'resource', 'operation']) {
  test(`${scope}: an absent endpoint quietly retains generic help without changing the denial`, async () => {
    const payload = deniedPayload();
    const original = structuredClone(payload);
    let calls = 0;
    const auth = { ...noAuthSideEffects(), getAppAdministrators: async () => {
      calls++;
      throw Object.assign(new Error('endpoint unavailable'), { status: 404 });
    } };
    const mounted = mount(auth, payload, `${scope}:target`);
    assert.equal(mounted.states[0].status, 'loading');
    await mounted.settle();
    assert.deepEqual(mounted.states.at(-1).contacts, []);
    assert.equal(mounted.states.at(-1).status, 'ready', '404 is an expected compatibility fallback, not an App failure');
    assert.equal(mounted.states.at(-1).contextKey, `${scope}:target`);
    assert.deepEqual(payload, original, 'help must not rewrite authorization or denial scope');
    assert.equal(calls, 1, 'no automatic retries or polling');
    mounted.cleanup?.();
  });
}

test('an SDK without contact capability issues no requests', async () => {
  const mounted = mount(noAuthSideEffects(), deniedPayload());
  await mounted.settle();
  assert.deepEqual(mounted.states, []);
});

test('the documented host suppresses duplicate denied copy without changing access or other retry states', () => {
  const expression = example.match(/retryStatus=\{([^}\n]+)\}/u)?.[1];
  assert.ok(expression, 'the adapter must pass an explicit presentation-only retry status');
  const presentation = new Function('view', `return ${expression};`);
  for (const retryStatus of [undefined, 'idle', 'checking', 'denied', 'error', 'restored']) {
    const view = Object.freeze({ retryStatus });
    assert.equal(presentation(view), retryStatus === 'denied' ? 'idle' : retryStatus);
    assert.equal(view.retryStatus, retryStatus, 'never rewrite the actual host retry/access state');
  }
});

for (const contacts of [[], [{ userId: 'admin-1', name: '管理员一' }]]) {
  test(`embedded ${contacts.length ? 'contacts' : 'empty contacts'} never trigger independent lookup`, async () => {
    const mounted = mount({ ...noAuthSideEffects(), getAppAdministrators() { assert.fail('embedded contacts are authoritative'); } }, {
      code: 403, data: { appAdministrators: contacts },
    });
    await mounted.settle();
    assert.deepEqual(mounted.states, []);
  });
}

for (const failure of [
  Object.assign(new Error('missing identity'), { status: 401 }),
  Object.assign(new Error('tenant mismatch'), { status: 403 }),
  Object.assign(new Error('service unavailable'), { status: 503 }),
  new DOMException('deadline exceeded', 'AbortError'),
  new TypeError('invalid response'),
]) {
  test(`contact ${failure.status ?? failure.name} stays local and keeps the original denial`, async () => {
    const payload = deniedPayload();
    const original = structuredClone(payload);
    let calls = 0;
    const mounted = mount({ ...noAuthSideEffects(), getAppAdministrators: async () => { calls++; throw failure; } }, payload);
    await mounted.settle();
    assert.deepEqual(mounted.states.at(-1).contacts, []);
    assert.equal(mounted.states.at(-1).status, 'error');
    assert.deepEqual(payload, original);
    assert.equal(calls, 1);
    mounted.cleanup?.();
  });
}

test('a later entry can discover the endpoint after backend rollout', async () => {
  let calls = 0;
  const auth = { ...noAuthSideEffects(), getAppAdministrators: async () => {
    if (++calls === 1) throw Object.assign(new Error('not deployed'), { status: 404 });
    return [{ userId: 'admin-1', name: '管理员一', avatarUrl: null }];
  } };
  const first = mount(auth, deniedPayload());
  await first.settle();
  first.cleanup?.();
  const next = mount(auth, deniedPayload());
  await next.settle();
  assert.equal(calls, 2, 'unsupported capability must not be cached permanently');
  assert.equal(next.states.at(-1).status, 'ready');
  assert.deepEqual(next.states.at(-1).contacts, [{ userId: 'admin-1', name: '管理员一', avatarUrl: undefined }]);
  next.cleanup?.();
});

test('unmounted help discards a late contact response', async () => {
  let complete;
  const mounted = mount({ getAppAdministrators: () => new Promise(resolve => { complete = resolve; }) }, deniedPayload());
  await mounted.settle();
  mounted.cleanup();
  const count = mounted.states.length;
  complete([{ userId: 'old-admin', name: '旧身份管理员' }]);
  await mounted.settle();
  assert.equal(mounted.states.length, count);
});

test('generic CI scans the executable staggered-release regression', async () => {
  const workflow = await readFile(new URL('../.github/workflows/skill-metadata-lint.yml', import.meta.url), 'utf8');
  assert.match(workflow, /for file in scripts\/test-\*\.mjs/u);
});
