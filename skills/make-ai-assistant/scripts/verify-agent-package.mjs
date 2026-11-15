#!/usr/bin/env node
// 使用消费 workspace 实际解析到的公开入口；不联网、不加载另一个项目的源码。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
async function main() {
  const workspace = process.argv[2];
  if (!workspace) {
    console.error('usage: node verify-agent-package.mjs <consumer-workspace>');
    process.exit(2);
  }
  const require = createRequire(
    path.resolve(workspace, '__agent_verify__.cjs'),
  );
  const {
    createAgentClient,
    AgentSessionController,
    AgentAttachmentController,
    assertAgentRequest,
    assertAgentResponse,
  } = await import(
    pathToFileURL(require.resolve('@qfei-design/make-ai-assistant/agent')).href
  );
  assert.doesNotThrow(() =>
    assertAgentRequest('agent.ListResources', { view: 'webchat' }),
  );
  const sort = [{ fieldKey: 'name', order: 'asc' }];
  assert.doesNotThrow(() =>
    assertAgentRequest('agent.ListResources', { sort }),
  );
  assert.throws(() =>
    assertAgentRequest('agent.ListResources', { view: 'webchat', sort }),
  );
  // multipart 的公开校验入口校验元数据；file 由宿主上传边界单独校验。
  assert.doesNotThrow(() =>
    assertAgentRequest('content.CreateResource', {
      requestId: 'sample-upload',
      fileName: 'sample.png',
      mediaType: 'image/png',
    }),
  );
  assert.throws(() =>
    assertAgentRequest('content.CreateResource', {
      requestId: 'sample-upload',
      file: 'fake-bytes',
    }),
  );
  const resourceId = (kind) => kind + '_01a161562d0078558a5e0982108b1aa4';
  const at = '2026-11-13T00:00:00Z';
  const task = {
    id: resourceId('task'),
    sessionId: resourceId('session'),
    triggerMessageId: resourceId('message'),
    agent: { type: 'agent', id: resourceId('agent') },
    state: 'running',
    endReason: null,
    meta: { createdAt: at, updatedAt: at, startedAt: at, finishedAt: null },
    configVersion: { id: resourceId('agent_config_version'), version: 1 },
  };
  const assertTask = (value) =>
    assertAgentResponse('session.task.GetResource', {
      code: 200,
      msg: 'ok',
      data: { task: value },
    });
  for (const waitReason of [
    'user_input',
    'outcome_confirmation',
    'authentication',
  ])
    assert.doesNotThrow(() => assertTask({ ...task, waitReason }));
  assert.throws(() => assertTask({ ...task, waitReason: 'invalid' }));
  assert.throws(() =>
    assertTask({
      ...task,
      state: 'queued',
      meta: { ...task.meta, startedAt: null },
      waitReason: 'authentication',
    }),
  );

  const http = (status, data) => ({
    status,
    headers: { 'content-type': 'application/json' },
    body: (async function* () {
      yield new TextEncoder().encode(JSON.stringify(data));
    })(),
  });
  for (const failure of ['network', 500, 503]) {
    const attempts = [];
    const recovering = createAgentClient({
      scope: { appKey: 'SampleApp', identityKey: 'sample-tenant:sample-user' },
      retry: { maxAttempts: 2, maxDelayMs: 0 },
      transport: {
        retryOwner: 'sdk',
        async request(request) {
          attempts.push(request);
          if (request.path.endsWith('/session/request'))
            return http(404, {
              code: 404,
              msg: 'not found',
              data: { reason: 'not_found' },
            });
          if (failure === 'network') throw new Error('response lost');
          return http(failure, {
            code: failure,
            msg: 'unavailable',
            data: { reason: 'service_unavailable' },
          });
        },
      },
    });
    try {
      await assert.rejects(
        recovering.messages.create({
          requestId: 'original-message-intent',
          sessionId: resourceId('session'),
          parts: [
            {
              type: 'text',
              text: 'sample',
              contentId: null,
              fileName: null,
              mediaType: null,
            },
          ],
          recipients: [{ type: 'agent', id: resourceId('agent') }],
        }),
        (error) =>
          error.outcome === 'unknown' &&
          error.requestId === 'original-message-intent',
      );
      assert.equal(
        attempts.filter((request) => request.path.endsWith('/session/message'))
          .length,
        1,
        'an unknown write must not be sent a second time',
      );
      const receipts = attempts.filter((request) =>
        request.path.endsWith('/session/request'),
      );
      assert.equal(receipts.length, 1);
      assert.equal(
        JSON.parse(new TextDecoder().decode(receipts[0].body)).requestId,
        'original-message-intent',
      );
    } finally {
      recovering.dispose();
    }
  }
  // 高层控制器也必须保持未知写入的身份；低层 SDK 通过不能代替此验证。
  const failure = (status) =>
    http(status, {
      code: status,
      msg: 'test failure',
      data: { reason: status === 404 ? 'not_found' : 'service_unavailable' },
    });
  const commands = [
    [
      '/session/run/answer',
      resourceId('run'),
      (c) => c.answer(resourceId('run'), { note: 'sample' }),
    ],
    [
      '/session/task/stop',
      resourceId('task'),
      (c) => c.stop(resourceId('task')),
    ],
    [
      '/session/message/cancel',
      resourceId('message'),
      (c) => c.cancelQueued(resourceId('message')),
    ],
    [
      '/session/message/resume',
      resourceId('message'),
      (c) => c.resume(resourceId('message')),
    ],
  ];
  for (const [resource, targetId, invoke] of commands) {
    for (const reload of [false, true]) {
      let saved = null;
      const writes = [],
        lookups = [];
      const recovering = createAgentClient({
        scope: { appKey: 'SampleApp', identityKey: 'recovery-test' },
        retry: { maxAttempts: 2, maxDelayMs: 0 },
        transport: {
          retryOwner: 'sdk',
          async request(request) {
            const body = JSON.parse(new TextDecoder().decode(request.body));
            if (request.path.endsWith(resource)) {
              writes.push(body.requestId);
              return failure(503);
            }
            if (request.path.endsWith('/session/request')) {
              lookups.push(body.requestId);
              return failure(404);
            }
            if (request.path.endsWith('/session'))
              return http(200, {
                code: 200,
                msg: 'ok',
                data: {
                  session: {
                    id: resourceId('session'),
                    title: 'Sample',
                    type: 'personal',
                    source: {
                      type: 'channel',
                      channelType: 'webchat',
                      externalId: null,
                    },
                    createdBy: { type: 'user', id: '101' },
                    meta: { createdAt: at, updatedAt: at },
                  },
                  asOf: '7',
                },
              });
            return http(200, {
              code: 200,
              msg: 'ok',
              data: { items: [], asOf: '7' },
              pagination: {
                size: body.pagination?.size ?? 50,
                nextCursor: null,
              },
            });
          },
        },
      });
      const options = {
        client: recovering,
        agentId: resourceId('agent'),
        sessionId: resourceId('session'),
        title: 'Sample',
        source: 'webchat',
        storage: {
          load: async () => structuredClone(saved),
          save: async (_scope, value) => {
            saved = structuredClone(value);
          },
        },
      };
      let controller = new AgentSessionController(options);
      try {
        await assert.rejects(
          invoke(controller),
          (error) => error.outcome === 'unknown',
        );
        const original = writes[0];
        if (reload) {
          controller.dispose();
          controller = new AgentSessionController(options);
          await controller.restore();
        }
        await assert.rejects(
          invoke(controller),
          (error) => error.outcome === 'unknown',
        );
        assert.deepEqual(
          writes,
          [original],
          `${resource} must not replay an unknown write (reload=${reload})`,
        );
        assert.ok(lookups.length > 0);
        assert.ok(lookups.every((requestId) => requestId === original));
        assert.equal(controller.getSnapshot().pending[0]?.targetId, targetId);
      } finally {
        controller.dispose();
        recovering.dispose();
      }
    }
  }
  let uploads = 0,
    uploadLookups = 0;
  let markSent;
  const sent = new Promise((resolve) => {
    markSent = resolve;
  });
  const uploading = createAgentClient({
    scope: { appKey: 'SampleApp', identityKey: 'upload-recovery-test' },
    retry: { maxAttempts: 2, maxDelayMs: 0 },
    transport: {
      retryOwner: 'sdk',
      async request(request) {
        if (request.path.endsWith('/session/request')) {
          uploadLookups++;
          return failure(404);
        }
        uploads++;
        for await (const _chunk of request.body) {
          /* Upload dispatched; only its response is lost. */
        }
        if (uploads === 1) {
          markSent();
          return new Promise(() => {});
        }
        return failure(503);
      },
    },
  });
  const attachments = new AgentAttachmentController({
    client: uploading,
    scope: 'upload-recovery-test',
  });
  try {
    const adding = attachments.add([
      {
        name: 'sample.txt',
        contentType: 'text/plain',
        size: 5,
        open: async function* () {
          yield new TextEncoder().encode('hello');
        },
      },
    ]);
    await sent;
    attachments.disconnect();
    await adding;
    await attachments.retry(attachments.getSnapshot()[0].id);
    assert.equal(
      uploads,
      1,
      'a dispatched upload must only recover its receipt after pause',
    );
    assert.ok(uploadLookups > 0);
    assert.equal(attachments.getSnapshot()[0].state, 'failed');
  } finally {
    attachments.dispose();
    uploading.dispose();
  }
  const calls = [];
  const appKey = 'SampleApp';
  const client = createAgentClient({
    scope: { appKey, identityKey: 'sample-tenant:sample-user' },
    basePath: '/api/make/app/agent/v1',
    transport: {
      retryOwner: 'sdk',
      async request(request) {
        calls.push(request);
        const body = new TextEncoder().encode(
          JSON.stringify({
            code: 200,
            msg: 'ok',
            data: [
              {
                agentId: 'agent_01a161562d0075acb5711eb302238265',
                name: 'Sample Agent',
              },
            ],
            pagination: { page: 1, size: 20, total: 1 },
          }),
        );
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: (async function* () {
            yield body;
          })(),
        };
      },
    },
  });
  try {
    const result = await client.agents.list({ view: 'webchat' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/api/make/app/agent/v1/agent');
    assert.equal(calls[0].method, 'POST');
    assert.equal(
      Object.entries(calls[0].headers).find(
        ([key]) => key.toLowerCase() === 'x-make-target',
      )?.[1],
      'MakeService.ListResources',
    );
    const body = JSON.parse(new TextDecoder().decode(calls[0].body));
    assert.equal(body.view, 'webchat');
    assert.equal(body.sort, undefined);
    assert.deepEqual(body.filter, {
      expression: `appKey == ${JSON.stringify(appKey)}`,
    });
    assert.equal(
      result.data[0].agentId,
      'agent_01a161562d0075acb5711eb302238265',
    );
    console.log(
      'Agent public package verification: PASS (restricted discovery, upload metadata, Task waitReason, low/high-level receipt-only recovery, interrupted-upload recovery; terminal-notice and UI suites are separate required checks)',
    );
  } finally {
    client.dispose();
  }
}
const deadline = setTimeout(() => {
  console.error(
    'Agent public package verification: FAIL verification timed out',
  );
  process.exit(1);
}, 20_000);
main()
  .catch((error) => {
    console.error(
      'Agent public package verification: FAIL',
      error?.code ?? error?.name ?? 'unknown',
      String(error?.message ?? '').slice(0, 500),
    );
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(deadline));
