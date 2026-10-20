import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const guide = await readFile(new URL('../skills/make-app-actions/references/service-contract.md', import.meta.url), 'utf8');

test('Service handoff cannot override the action HTTP failure preservation contract', async () => {
  const serviceGuide = await readFile(new URL('../skills/make-app-service/references/service-api-contracts.md', import.meta.url), 'utf8');
  const handoff = serviceGuide.match(/`record-write-permission` and `records\/bulk`[\s\S]*?(?=\n\n)/u)?.[0];
  assert.ok(handoff, 'the Service reference must retain its explicit Actions handoff');
  assert.doesNotMatch(handoff, /action-specific error envelope/u, 'do not direct generated Apps to discard completed permission payloads');
  assert.match(handoff, /completed HTTP failures preserve[\s\S]*?status[\s\S]*?Content-Type[\s\S]*?body/u);
  assert.match(handoff, /reason[\s\S]*?permissionKey[\s\S]*?administrator/u);
  assert.match(handoff, /20000032[\s\S]*?select-all 403/u, 'keep the existing projected denial contracts');
});

test('documented action failure forwarding preserves HTTP status, type and body without classifying permission', () => {
  const example = guide.match(/```js\n(function preserveActionHttpFailure\(response\) \{[\s\S]*?\n\})\n```/u)?.[1];
  assert.ok(example, 'exercise the documented forwarding example rather than a second implementation');
  class CompletedMakeResponse extends Error {
    constructor(response) { super('completed upstream response'); this.response = response; }
  }
  const preserve = new Function('CompletedMakeResponse', `${example}; return preserveActionHttpFailure;`)(CompletedMakeResponse);
  for (const [status, payload] of [
    [403, { reason: 'permission_denied', data: { permissionKey: 'data.record.delete', appAdministrators: [{ userId: '1', name: '管理员' }] } }],
    [403, { reason: 'unclassified_failure' }],
    [401, { authorizationUrl: '/login' }],
    [503, { reason: 'permission_service_unavailable' }],
  ]) {
    const response = Object.freeze({ status, contentType: 'application/json;charset=UTF-8', body: Buffer.from(JSON.stringify(payload)) });
    const before = Buffer.from(response.body);
    assert.throws(() => preserve(response), error => {
      assert.ok(error instanceof CompletedMakeResponse);
      assert.equal(error.response, response, 'the existing host boundary receives the same completed response');
      assert.deepEqual(error.response.body, before);
      return true;
    });
  }
  assert.equal(preserve({ status: 200 }), undefined, 'success and business-code interpretation stay with the action contract');
});
