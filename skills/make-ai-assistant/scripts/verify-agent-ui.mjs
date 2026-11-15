#!/usr/bin/env node
// DOM 语义夹具：只加载正式公开组件，控制器仅提供公开快照；不复制包内状态机或 CSS。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const workspace = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(
  workspace,
  'usage: node verify-agent-ui.mjs <consumer-workspace-with-jsdom>',
);
const args = process.argv.slice(3);
assert.ok(
  args.length <= 1 &&
    args.every((arg) => arg.startsWith('--report=') && arg.slice(9)),
  'optional --report=<json-file>',
);
const require = createRequire(path.join(workspace, '__agent_ui__.cjs'));
const { JSDOM, VirtualConsole } = require('jsdom');
const runtimeErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) =>
  runtimeErrors.push(String(error.cause?.message ?? error.message)),
);
const dom = new JSDOM(
  '<!doctype html><html lang="zh-CN"><body></body></html>',
  { url: 'https://fixture.invalid', pretendToBeVisual: true, virtualConsole },
);
const globals = new Map();
function global(name, value) {
  globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'NodeFilter',
  'Document',
  'DocumentFragment',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
  'HTMLIFrameElement',
  'MutationObserver',
  'Event',
  'EventTarget',
  'CustomEvent',
  'PointerEvent',
  'KeyboardEvent',
  'MouseEvent',
  'FocusEvent',
  'DOMParser',
  'SVGElement',
  'getComputedStyle',
  'sessionStorage',
  'localStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]) {
  const value = dom.window[name];
  if (value !== undefined)
    global(
      name,
      [
        'getComputedStyle',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ].includes(name)
        ? value.bind(dom.window)
        : value,
    );
}
global('IS_REACT_ACT_ENVIRONMENT', true);
global('CSS', {
  escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c),
});
dom.window.HTMLElement.prototype.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { act: reactAct, createElement } = require('react');
const act = reactAct ?? require('react-dom/test-utils').act;
const { createRoot } = require('react-dom/client');
const {
  createAgentSessionState,
} = require('@qfei-design/make-ai-assistant/agent');
const { AgentChatPanel } = require('@qfei-design/make-ai-assistant/react');
const schema = JSON.parse(
  fs.readFileSync(
    new URL('./fixtures/agent-ui/question.json', import.meta.url),
    'utf8',
  ),
);
const id = (kind) => kind + '_01a161562d0078558a5e0982108b1aa4';
const at = '2026-11-13T00:00:00Z';
const active = new Set();
const results = [];
async function mount({
  identityKey = 'sample-tenant:user',
  appKey = 'SampleApp',
  agentId = id('agent'),
  sessionId = id('session'),
  runId = id('run'),
  closed = false,
} = {}) {
  const task = {
    id: id('task'),
    sessionId,
    triggerMessageId: id('message'),
    agent: { type: 'agent', id: agentId },
    configVersion: { id: id('agent_config_version'), version: 1 },
    state: 'running',
    endReason: null,
    meta: { createdAt: at, updatedAt: at, startedAt: at, finishedAt: null },
  };
  const question = {
    ...structuredClone(schema),
    runId,
    sessionId,
    taskId: task.id,
    agent: task.agent,
    state: closed ? 'closed' : 'open',
    canAnswer: !closed,
    expiresAt: null,
    attachments: [],
  };
  const snapshot = {
    state: {
      ...createAgentSessionState('fixture', sessionId),
      tasks: { [task.id]: task },
      questions: { [runId]: question },
    },
    connection: 'live',
    sending: false,
    error: '',
    pending: [],
    olderCursor: null,
    queuedMessages: [],
  };
  const answers = [];
  const controller = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    connect: async () => {},
    disconnect: () => {},
    answer: async (run, answer) => {
      answers.push({ run, answer: structuredClone(answer) });
    },
  };
  const client = {
    scope: { appKey, identityKey },
    agents: {
      getInputCapabilities: async () => ({
        agent: task.agent,
        inputCapabilities: {
          isMultiModal: false,
          inputKinds: ['text'],
          supportedContentTypes: [],
          maxFileBytes: 0,
          maxTotalBytes: 0,
        },
      }),
    },
  };
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  const view = {
    host,
    answers,
    async unmount() {
      if (!active.delete(view)) return;
      await act(async () => root.unmount());
      host.remove();
    },
  };
  active.add(view);
  await act(async () =>
    root.render(
      createElement(AgentChatPanel, {
        client,
        controller,
        agentId,
        agentName: '助手',
      }),
    ),
  );
  return view;
}
function field(view, title) {
  const label = [...view.host.querySelectorAll('label')].find(
    (element) => element.textContent === title,
  );
  const input = label?.control;
  assert.ok(
    input instanceof HTMLInputElement,
    'missing accessible input: ' + title,
  );
  return input;
}
async function fill(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const button = (title) =>
  [...document.querySelectorAll('button')].find(
    (element) => element.textContent === title,
  );
async function click(element) {
  assert.ok(element, 'missing accessible control');
  await act(async () => element.click());
}
const group = (title) =>
  [...document.querySelectorAll('[role="group"]')].find(
    (element) => element.getAttribute('aria-label') === title,
  );
const day = (date) =>
  [...document.querySelectorAll('[role="button"][aria-label]')].find(
    (element) => element.getAttribute('aria-label').includes(date),
  );
async function submit(view) {
  await click(button('提交回答'));
  assert.equal(
    view.answers.length,
    1,
    'calendar actions must not submit the question',
  );
  return view.answers[0].answer;
}
const stored = () =>
  Array.from({ length: sessionStorage.length }, (_, index) =>
    sessionStorage.getItem(sessionStorage.key(index)),
  ).join('\n');
async function check(name, run) {
  sessionStorage.clear();
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: String(error.message).slice(0, 500),
    });
  } finally {
    for (const view of [...active]) await view.unmount();
  }
}
try {
  await check('date selection stays a local calendar date', async () => {
    const view = await mount();
    await click(group('日期'));
    await click(day('2026年11月16日'));
    assert.equal(view.answers.length, 0);
    assert.equal((await submit(view)).date, '2026-11-16');
  });
  await check('datetime cancel preserves the original value', async () => {
    const view = await mount();
    await click(group('日期时间'));
    await click(day('2026年11月16日'));
    await click(button('取消'));
    assert.equal(view.answers.length, 0);
    assert.equal((await submit(view)).datetime, '2026-11-15 08:30:45');
  });
  await check(
    'datetime confirmation preserves local time and seconds',
    async () => {
      const view = await mount();
      await click(group('日期时间'));
      await click(day('2026年11月16日'));
      assert.equal(view.answers.length, 0);
      await click(button('确定'));
      assert.equal((await submit(view)).datetime, '2026-11-16 08:30:45');
    },
  );
  await check('time seconds can be edited before confirmation', async () => {
    const view = await mount();
    await click(group('日期时间'));
    const second = [
      ...document.querySelectorAll('[role="dialog"] [role="spinbutton"]'),
    ].find((element) => element.getAttribute('aria-label')?.startsWith('秒'));
    assert.ok(second, 'missing accessible seconds segment');
    await act(async () => {
      second.focus();
      second.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      );
    });
    assert.equal(view.answers.length, 0);
    await click(button('确定'));
    assert.equal((await submit(view)).datetime, '2026-11-15 08:30:46');
  });
  await check('date range enforces the selected begin boundary', async () => {
    const view = await mount();
    await click(group('日期范围开始日期'));
    await click(day('2026年11月16日'));
    await click(group('日期范围结束日期'));
    assert.equal(day('2026年11月15日')?.getAttribute('aria-disabled'), 'true');
    await click(day('2026年11月18日'));
    assert.deepEqual((await submit(view)).range, {
      begin: '2026-11-16',
      end: '2026-11-18',
    });
  });
  await check(
    'non-sensitive drafts restore for the same identity',
    async () => {
      const first = await mount();
      await fill(field(first, '备注'), 'fixture draft');
      await first.unmount();
      const restored = await mount();
      assert.equal(field(restored, '备注').value, 'fixture draft');
    },
  );
  await check('sensitive field values never enter draft storage', async () => {
    const first = await mount();
    await fill(field(first, '备注'), 'fixture draft');
    await fill(field(first, '密码'), 'fixture-password-marker');
    await fill(field(first, '敏感信息'), 'fixture-sensitive-marker');
    assert.ok(
      !stored().includes('fixture-password-marker') &&
        !stored().includes('fixture-sensitive-marker'),
    );
    await first.unmount();
    const restored = await mount();
    assert.equal(field(restored, '备注').value, 'fixture draft');
    assert.equal(field(restored, '密码').value, '');
    assert.equal(field(restored, '敏感信息').value, '');
  });
  for (const [name, scope] of [
    ['user', { identityKey: 'sample-tenant:other-user' }],
    ['tenant', { identityKey: 'other-tenant:user' }],
    ['app', { appKey: 'OtherApp' }],
    ['agent', { agentId: id('agent').replace(/a4$/, 'a5') }],
    ['session', { sessionId: id('session').replace(/a4$/, 'a5') }],
    ['question', { runId: id('run').replace(/a4$/, 'a5') }],
  ])
    await check('draft isolation: ' + name, async () => {
      const first = await mount();
      await fill(field(first, '备注'), 'isolated draft');
      await first.unmount();
      const other = await mount(scope);
      assert.equal(field(other, '备注').value, '');
      await other.unmount();
      const original = await mount();
      assert.equal(field(original, '备注').value, 'isolated draft');
    });
  await check('closed questions clear their drafts', async () => {
    const first = await mount();
    await fill(field(first, '备注'), 'closed-question-draft');
    await first.unmount();
    await mount({ closed: true });
    assert.ok(!stored().includes('closed-question-draft'));
  });
  await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
  results.push({
    name: 'DOM runtime has no unhandled errors',
    passed: runtimeErrors.length === 0,
    ...(runtimeErrors.length
      ? { error: runtimeErrors.join('; ').slice(0, 500) }
      : {}),
  });
} finally {
  for (const view of [...active]) await view.unmount();
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
const failed = results.filter((result) => !result.passed).length;
const report = JSON.stringify(
  {
    check: 'agent-public-ui',
    total: results.length,
    passed: results.length - failed,
    failed,
    results,
  },
  null,
  2,
);
if (args[0]) fs.writeFileSync(path.resolve(args[0].slice(9)), report + '\n');
console.log(report);
if (failed) process.exitCode = 1;
