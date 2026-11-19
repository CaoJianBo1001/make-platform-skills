#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The adapter mounts the real host feedback with its existing component test stack.
// Only SDK/network I/O is injected. snapshot() must read rendered UI, not hook state.
export async function runAdministratorFeedbackConformance(mountAdministratorFeedback) {
  const token = randomUUID();
  const contacts = [{ userId: 'contact-contract-1', name: `联系人甲-${token}` }, { userId: 'contact-contract-2', name: `联系人乙-${token}`, avatarUrl: null }];
  const denied = () => ({ reason: 'permission_denied', data: {} });
  const cases = [
    ...['app', 'resource', 'operation'].map(scope => ({ name: `${scope}_queries_and_renders_contacts`, scope, payload: denied(), contacts, calls: 1 })),
    { name: 'embedded_contacts_skip_query', payload: { data: { appAdministrators: contacts } }, contacts, calls: 0 },
    { name: 'old_sdk_preserves_embedded_contacts', payload: { data: { appAdministrators: contacts } }, contacts, oldSdk: true, calls: 0 },
    { name: 'explicit_empty_is_authoritative', payload: { data: { appAdministrators: [] } }, contacts: [], calls: 0 },
    { name: 'old_sdk_keeps_generic_help', payload: denied(), contacts: [], oldSdk: true, calls: 0 },
    { name: 'empty_directory_keeps_generic_help', payload: denied(), contacts: [], result: [], calls: 1 },
    ...[404, 401, 403, 500, 503].map(status => ({ name: `optional_endpoint_${status}_stays_local`, payload: denied(), contacts: [], failure: Object.assign(new Error('optional query failure'), { status }), calls: 1 })),
    { name: 'timeout_keeps_generic_help', payload: denied(), contacts: [], failure: new DOMException('query deadline', 'AbortError'), calls: 1 },
    { name: 'invalid_response_keeps_generic_help', payload: denied(), contacts: [], failure: new TypeError('invalid contact response'), calls: 1 },
  ];
  const failures = [];
  for (const item of cases) {
    let mounted;
    try {
      let requests = 0;
      let sideEffects = 0;
      const forbiddenSideEffect = () => { sideEffects++; throw new Error('contact help must not invoke login, business requests or retry'); };
      const auth = {
        api: { request: forbiddenSideEffect, get: forbiddenSideEffect, post: forbiddenSideEffect },
        init: forbiddenSideEffect, login: forbiddenSideEffect, logout: forbiddenSideEffect,
      };
      if (!item.oldSdk) auth.getAppAdministrators = async () => {
        requests++;
        if (item.failure) throw item.failure;
        return structuredClone(item.result ?? contacts);
      };
      const payload = structuredClone(item.payload);
      const original = structuredClone(payload);
      mounted = await bounded(() => mountAdministratorFeedback({
        auth, payload, scope: item.scope ?? 'resource', contextKey: 'tenant-a:user-a:app-a:access-1',
        onRetry: forbiddenSideEffect, onClose: forbiddenSideEffect,
      }));
      assert.equal(typeof mounted?.snapshot, 'function', 'host adapter must expose a rendered snapshot');
      assert.equal(typeof mounted?.flush, 'function', 'host adapter must flush its component test stack');
      assert.equal(typeof mounted?.unmount, 'function', 'host adapter must clean up the mounted production component');
      await bounded(() => mounted.flush());
      await bounded(() => mounted.flush());
      const snapshot = mounted.snapshot();
      assert.equal(snapshot?.scope, item.scope ?? 'resource', 'original denial scope must survive');
      assert.equal(typeof snapshot?.text, 'string');
      assert.ok(snapshot.text.trim(), 'denial feedback must remain visible');
      for (const contact of contacts) {
        assert.equal(snapshot.text.includes(contact.name), item.contacts.some(value => value.userId === contact.userId), 'queried/embedded contact names must reach the rendered notice');
      }
      assert.equal(requests, item.calls, 'missing contacts query once; embedded/old-SDK cases never query');
      assert.equal(sideEffects, 0, 'optional help must not cause auth/business/retry side effects');
      assert.deepEqual(payload, original, 'help must not rewrite the original denial');
    } catch (error) {
      failures.push(`${item.name}: ${error.message}`);
    } finally {
      if (typeof mounted?.unmount === 'function') {
        try { await bounded(() => mounted.unmount()); }
        catch (error) { failures.push(`${item.name}_cleanup: ${error.message}`); }
      }
    }
  }
  let pendingMount;
  let pendingMountPromise;
  let complete;
  let requested = 0;
  try {
    const pending = new Promise(resolve => { complete = resolve; });
    pendingMountPromise = Promise.resolve().then(() => mountAdministratorFeedback({
      auth: { api: {}, getAppAdministrators: () => { requested++; return pending; } },
      payload: denied(), scope: 'resource', contextKey: 'tenant-a:user-a:app-a:pending',
    }));
    pendingMount = await bounded(() => pendingMountPromise);
    assert.ok(pendingMount.snapshot().text.trim(), 'render denial before optional contact I/O completes');
    await pendingMount.unmount();
    complete(contacts);
    await bounded(() => pendingMount.flush());
    assert.equal(requested, 1);
    assert.ok(!pendingMount.snapshot().text.includes(contacts[0].name), 'an unmounted target must not publish late contacts');
  } catch (error) {
    failures.push(`pending_help_does_not_block_denial: ${error.message}`);
  } finally {
    complete?.([]);
    if (!pendingMount && pendingMountPromise) {
      try { pendingMount = await bounded(() => pendingMountPromise); } catch { /* The original mount failure is already retained. */ }
    }
    if (typeof pendingMount?.unmount === 'function') {
      try { await bounded(() => pendingMount.unmount()); }
      catch (error) { failures.push(`pending_help_does_not_block_denial_cleanup: ${error.message}`); }
    }
  }
  const total = cases.length + 1;
  return { total, passed: total - new Set(failures.map(failure => failure.split(':')[0].replace(/_cleanup$/u, ''))).size, failures };
}

function bounded(action) {
  let timer;
  return Promise.race([
    Promise.resolve().then(action),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('feedback test did not complete within 1500ms')), 1500); }),
  ]).finally(() => clearTimeout(timer));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    assert.equal(process.argv.length, 3, 'Usage: node administrator-feedback-conformance-suite.mjs <host-adapter-module>');
    const adapter = await import(pathToFileURL(path.resolve(process.argv[2])).href);
    assert.equal(typeof adapter.mountAdministratorFeedback, 'function', 'adapter must export mountAdministratorFeedback');
    const result = await runAdministratorFeedbackConformance(adapter.mountAdministratorFeedback);
    for (const failure of result.failures) console.error(`FAIL ${failure}`);
    console.log(`administrator feedback conformance: ${result.passed}/${result.total} passed`);
    process.exitCode = result.failures.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
