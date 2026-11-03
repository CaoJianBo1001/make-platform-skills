import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../skills/make-app-filter/references/package-integration.md', import.meta.url), 'utf8');
const handler = source.match(/async function handleConfirm\(\) \{[\s\S]*?\n  \}\n\n  return \(/)?.[0].replace(/\n\n  return \($/, '');
assert.ok(handler, 'missing executable confirmation example');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
function setup({ advancedError = false, queryError = false, saveError = false, valid = true } = {}) {
  const events = [];
  const activeRef = { current: true }, saveRequestRef = { current: null };
  const draft = { id: 'draft', logic: 'and', children: [] };
  const env = {
    activeRef, saveRequestRef,
    controller: { validate: () => ({ valid }), draftValue: draft },
    cloneFilterGroup: (value) => structuredClone(value),
    filterableFields: [], searchText: 'keyword',
    setSaving: (value) => events.push(['saving', value]),
    compileAdvancedFilterToCel: () => { events.push(['advanced']); if (advancedError) throw new Error('invalid'); return '((amount > 1))'; },
    compileListFilter: (options) => { events.push(['query-preflight', options.searchText]); if (queryError) throw new Error('256 branches exceeded'); return { expression: 'query' }; },
    persistFilter: async (payload) => { events.push(['patch', payload]); if (saveError) throw new Error('save failed'); },
    onCompileError: () => events.push(['compile-error']),
    onPersistError: () => events.push(['persist-error']),
    onApplyError: () => events.push(['apply-error']),
    onApplyGroup: () => { events.push(['apply']); events.push(['records']); },
    setOpen: (value) => events.push(['open', value]),
    finishSaveRequest: () => { saveRequestRef.current = null; events.push(['finished']); },
  };
  return { confirm: runInNewContext(`(${handler})`, env, { timeout: 1000 }), events };
}
for (const failure of ['advancedError', 'queryError']) test(`${failure} prevents PATCH, apply, close and records`, async () => {
  const { confirm, events } = setup({ [failure]: true });
  await confirm();
  assert.ok(events.some(([name]) => name === 'compile-error'));
  assert.ok(events.every(([name]) => !['patch', 'apply', 'records', 'open', 'saving'].includes(name)));
});
test('preflight precedes sparse PATCH and successful apply', async () => {
  const { confirm, events } = setup(); await confirm();
  const index = (name) => events.findIndex(([item]) => item === name);
  assert.ok(index('advanced') < index('patch'));
  assert.ok(index('query-preflight') < index('patch'));
  assert.ok(index('patch') < index('apply'));
  assert.deepEqual(JSON.parse(JSON.stringify(events[index('patch')][1])), { filter: { expression: '((amount > 1))' } });
});
test('invalid draft performs no compilation or I/O', async () => {
  const { confirm, events } = setup({ valid: false }); await confirm(); assert.deepEqual(events, []);
});
test('PATCH failure preserves applied state and the open draft', async () => {
  const { confirm, events } = setup({ saveError: true }); await confirm();
  assert.ok(events.some(([name]) => name === 'persist-error'));
  assert.ok(events.every(([name]) => !['apply', 'records', 'open'].includes(name)));
});
let failed = 0;
for (const [name, fn] of tests) { try { await fn(); } catch (error) { failed++; console.error(name, error.message); } }
assert.equal(failed, 0, `${failed} confirmation behavior regressions`);
console.log(`${tests.length} filter confirmation behavior cases passed (documented handler; compiler and I/O boundaries stubbed).`);
