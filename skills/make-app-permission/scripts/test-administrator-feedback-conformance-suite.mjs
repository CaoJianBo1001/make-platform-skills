import test from 'node:test';
import assert from 'node:assert/strict';
import { runAdministratorFeedbackConformance } from './administrator-feedback-conformance-suite.mjs';

// The fixture tests the gate itself; host acceptance must mount production UI.
function fixture(mode = 'correct', queryArguments = []) {
  return async ({ auth, payload, scope }) => {
    let active = true;
    let contacts = payload?.data?.appAdministrators;
    let pending;
    if (!Array.isArray(contacts) && typeof auth.getAppAdministrators === 'function' && mode !== 'no-query') {
      pending = Promise.resolve().then(() => auth.getAppAdministrators(...queryArguments)).then(
        value => { if (active) contacts = value; },
        error => { if (mode === 'global-error') auth.login(); },
      );
    }
    const mounted = {
      snapshot: () => ({ scope, text: active ? `请联系应用管理员授权 ${(mode === 'drop-contacts' ? [] : contacts ?? []).map(item => item.name).join('、')}` : '' }),
      flush: async () => { await pending; },
      unmount: () => { active = false; },
    };
    if (mode === 'blocking-mount') await pending;
    return mounted;
  };
}

test('the runner accepts optional capabilities and staggered backend rollout', async () => {
  const result = await runAdministratorFeedbackConformance(fixture());
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, result.total);
  assert.ok(result.total >= 12);
});

test('optional SDK query arguments remain opaque to the feedback gate', async () => {
  const result = await runAdministratorFeedbackConformance(fixture('correct', ['optional-url-owned-by-auth']));
  assert.deepEqual(result.failures, [], 'do not require a URL or duplicate the SDK AppKey contract');
});

for (const mode of ['no-query', 'drop-contacts', 'global-error']) {
  test(`the runner rejects the broken host implementation: ${mode}`, async () => {
    const result = await runAdministratorFeedbackConformance(fixture(mode));
    assert.ok(result.failures.length > 0);
    assert.ok(result.passed < result.total);
  });
}

test('a test-only successful response without a rendered snapshot is rejected', async () => {
  const result = await runAdministratorFeedbackConformance(async () => ({ contacts: [] }));
  assert.equal(result.passed, 0);
});

test('waiting for contact I/O before mounting denial feedback is rejected', async () => {
  const result = await runAdministratorFeedbackConformance(fixture('blocking-mount'));
  assert.ok(result.failures.some(failure => failure.startsWith('pending_help_does_not_block_denial')));
});
