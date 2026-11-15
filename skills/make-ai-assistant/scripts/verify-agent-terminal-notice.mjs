#!/usr/bin/env node
// 只使用消费 workspace 的公开 SDK；请求级标识用于核对通知归属，不替代宿主 Trace 验收。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(
  workspace,
  'usage: node verify-agent-terminal-notice.mjs <consumer-workspace>',
);
const args = process.argv.slice(3);
assert.ok(
  args.length <= 1 &&
    args.every((arg) => arg.startsWith('--report=') && arg.slice(9)),
  'optional --report=<json-file>',
);
const require = createRequire(path.join(workspace, '__agent_notices__.cjs'));
const { createAgentClient, AgentSessionController } = await import(
  pathToFileURL(require.resolve('@qfei-design/make-ai-assistant/agent')).href
);
const id = (kind) => kind + '_01a161562d0078558a5e0982108b1aa4';
const results = [];
const encoder = new TextEncoder();
const http = (status, data, type = 'application/json') => ({
  status,
  headers: { 'content-type': type },
  body: (async function* () {
    yield encoder.encode(
      typeof data === 'string' ? data : JSON.stringify(data),
    );
  })(),
});
const failure = (status) =>
  http(status, {
    code: status,
    msg: 'fixture unavailable',
    data: { reason: status === 404 ? 'not_found' : 'dependency_unavailable' },
  });
const success = () =>
  http(200, {
    code: 200,
    msg: 'ok',
    data: [],
    pagination: { page: 1, size: 20, total: 0 },
  });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function check(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: String(error.message).slice(0, 500),
    });
  }
}
function fixture(respond, retry = { maxAttempts: 2, maxDelayMs: 0 }) {
  const attempts = [],
    notices = [];
  const client = createAgentClient({
    scope: { appKey: 'SampleApp', identityKey: 'sample-identity' },
    basePath: '/api/make/app/agent/v1',
    retry,
    transport: {
      retryOwner: 'sdk',
      async request(request, options) {
        const attempt = {
          index: attempts.length,
          traceId: (attempts.length + 1).toString(16).padStart(32, '0'),
          request,
        };
        attempts.push(attempt);
        options.onAttemptFailure?.(() => notices.push(attempt.traceId));
        return respond(attempt, options);
      },
    },
  });
  return { client, attempts, notices };
}
function expectNotices(value, attempts) {
  assert.deepEqual(
    value.notices,
    attempts.map((attempt) => attempt.traceId),
    'terminal notices must match exactly the failing network attempts',
  );
}
const deadline = setTimeout(() => {
  console.error(
    JSON.stringify({
      check: 'agent-terminal-notice',
      complete: false,
      results,
      error: 'verification timeout',
    }),
  );
  process.exit(1);
}, 20_000);

try {
  for (const ending of [
    'http',
    'network',
    'business',
    'recovered',
    'protocol',
  ]) {
    await check('json ' + ending, async () => {
      const value = fixture(
        ({ index }) => {
          if (ending === 'network') throw new Error('fixture disconnected');
          if (ending === 'recovered' && index === 1) return success();
          if (ending === 'protocol') return http(200, '{invalid json');
          if (ending === 'business')
            return http(200, {
              code: 503,
              msg: 'fixture unavailable',
              data: { reason: 'dependency_unavailable' },
            });
          return failure(503);
        },
        { maxAttempts: ending === 'protocol' ? 1 : 2, maxDelayMs: 0 },
      );
      try {
        if (ending === 'recovered')
          await value.client.agents.list({ view: 'webchat' });
        else
          await assert.rejects(value.client.agents.list({ view: 'webchat' }));
        assert.equal(
          value.attempts.length,
          ['business', 'protocol'].includes(ending) ? 1 : 2,
        );
        expectNotices(
          value,
          ending === 'recovered' ? [] : value.attempts.slice(-1),
        );
      } finally {
        value.client.dispose();
      }
    });
  }
  await check('concurrent identical operations', async () => {
    const deferred = [];
    const value = fixture(
      () => new Promise((resolve) => deferred.push(resolve)),
    );
    try {
      const one = assert.rejects(value.client.agents.list({ view: 'webchat' }));
      const two = assert.rejects(value.client.agents.list({ view: 'webchat' }));
      for (let i = 0; i < 20 && deferred.length < 2; i++) await delay(1);
      assert.equal(deferred.length, 2);
      deferred[1](failure(403));
      await two;
      deferred[0](failure(403));
      await one;
      expectNotices(value, [value.attempts[1], value.attempts[0]]);
    } finally {
      value.client.dispose();
    }
  });
  for (const ending of [
    'stream http',
    'stream protocol',
    'download http',
    'download body',
  ]) {
    await check(ending, async () => {
      const value = fixture(() => {
        if (ending.endsWith('http')) return failure(403);
        if (ending === 'stream protocol') return success();
        return {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
          body: (async function* () {
            throw new Error('fixture body lost');
          })(),
        };
      });
      try {
        if (ending.startsWith('stream'))
          await assert.rejects(
            value.client.stream.subscribe({ sessionId: id('session') }).next(),
          );
        else if (ending === 'download http')
          await assert.rejects(
            value.client.content.download({ contentId: id('content') }),
          );
        else {
          const file = await value.client.content.download({
            contentId: id('content'),
          });
          await assert.rejects(file.body[Symbol.asyncIterator]().next());
        }
        assert.equal(value.attempts.length, 1);
        expectNotices(value, value.attempts);
      } finally {
        value.client.dispose();
      }
    });
  }
  for (const ending of ['success', 'snapshot denied', 'stream denied']) {
    await check('cursor recovery ' + ending, async () => {
      let streams = 0,
        snapshots = 0;
      const value = fixture(({ request }, options) => {
        if (request.path.includes('/session/stream')) {
          if (++streams === 1)
            return http(410, {
              code: 410,
              msg: 'expired',
              data: { reason: 'cursor_expired' },
            });
          if (ending === 'stream denied') return failure(403);
          return {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
            body: (async function* () {
              if (!options.signal?.aborted)
                await new Promise((resolve) =>
                  options.signal?.addEventListener('abort', resolve, {
                    once: true,
                  }),
                );
            })(),
          };
        }
        if (request.path.endsWith('/session')) {
          snapshots++;
          if (ending === 'snapshot denied' && snapshots === 2)
            return failure(403);
          return http(200, {
            code: 200,
            msg: 'ok',
            data: {
              session: {
                id: id('session'),
                title: 'Sample',
                type: 'personal',
                source: {
                  type: 'channel',
                  channelType: 'webchat',
                  externalId: null,
                },
                createdBy: { type: 'user', id: '101' },
                meta: {
                  createdAt: '2026-11-13T00:00:00Z',
                  updatedAt: '2026-11-13T00:00:00Z',
                },
              },
              asOf: String(snapshots * 7),
            },
          });
        }
        return http(200, {
          code: 200,
          msg: 'ok',
          data: { items: [], asOf: String(snapshots * 7) },
          pagination: { size: 50, nextCursor: null },
        });
      });
      const controller = new AgentSessionController({
        client: value.client,
        agentId: id('agent'),
        sessionId: id('session'),
        title: 'Sample',
        source: 'webchat',
      });
      try {
        await controller.connect();
        const expected = ending === 'success' ? 'live' : 'error';
        for (
          let i = 0;
          i < 100 &&
          (snapshots < 2 || controller.getSnapshot().connection !== expected);
          i++
        )
          await delay(5);
        assert.equal(snapshots, 2);
        assert.equal(controller.getSnapshot().connection, expected);
        if (ending === 'success') {
          assert.equal(streams, 2);
          expectNotices(value, []);
        } else
          expectNotices(
            value,
            value.attempts
              .filter((attempt) =>
                ending === 'snapshot denied'
                  ? attempt.request.path.endsWith('/session')
                  : attempt.request.path.includes('/session/stream'),
              )
              .slice(-1),
          );
      } finally {
        controller.dispose();
        value.client.dispose();
      }
    });
  }
  for (const status of [404, 403]) {
    await check('receipt lookup ' + status, async () => {
      const value = fixture(({ request }) =>
        failure(request.path.endsWith('/session/request') ? status : 503),
      );
      try {
        await assert.rejects(
          value.client.tasks.stop(
            { taskId: id('task'), requestId: 'original-stop' },
            { timeoutMs: 100 },
          ),
          status === 404
            ? { status: 503, outcome: 'unknown', requestId: 'original-stop' }
            : {
                status: 403,
                outcome: 'known',
                unconfirmedWrite: true,
                requestId: 'original-stop',
              },
        );
        assert.equal(value.attempts.length, 2);
        expectNotices(value, [value.attempts[status === 404 ? 0 : 1]]);
      } finally {
        value.client.dispose();
      }
    });
  }
} finally {
  clearTimeout(deadline);
}
const failed = results.filter((result) => !result.passed).length;
const report = JSON.stringify(
  {
    check: 'agent-terminal-notice',
    complete: true,
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
