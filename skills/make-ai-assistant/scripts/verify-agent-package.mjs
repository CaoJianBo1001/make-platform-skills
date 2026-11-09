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
    path.resolve(workspace, '__agent_verify__.cjs')
  );
  const { createAgentClient, assertAgentRequest } = await import(
    pathToFileURL(require.resolve('@qfei-design/make-ai-assistant/agent')).href
  );
  assert.doesNotThrow(() =>
    assertAgentRequest('agent.ListResources', { view: 'webchat' })
  );
  const sort = [{ fieldKey: 'name', order: 'asc' }];
  assert.doesNotThrow(() =>
    assertAgentRequest('agent.ListResources', { sort })
  );
  assert.throws(() =>
    assertAgentRequest('agent.ListResources', { view: 'webchat', sort })
  );
  // multipart 的公开校验入口校验元数据；file 由宿主上传边界单独校验。
  assert.doesNotThrow(() =>
    assertAgentRequest('content.CreateResource', {
      requestId: 'sample-upload',
      fileName: 'sample.png',
      mediaType: 'image/png',
    })
  );
  assert.throws(() =>
    assertAgentRequest('content.CreateResource', {
      requestId: 'sample-upload',
      file: 'fake-bytes',
    })
  );
  const calls = [];
  const client = createAgentClient({
    scope: { appKey: 'SampleApp', identityKey: 'sample-tenant:sample-user' },
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
          })
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
        ([key]) => key.toLowerCase() === 'x-make-target'
      )?.[1],
      'MakeService.ListResources'
    );
    const body = JSON.parse(new TextDecoder().decode(calls[0].body));
    assert.equal(body.view, 'webchat');
    assert.equal(body.sort, undefined);
    assert.match(body.filter.expression, /appKey.*SampleApp/);
    assert.equal(
      result.data[0].agentId,
      'agent_01a161562d0075acb5711eb302238265'
    );
    console.log(
      'Agent public package verification: PASS (restricted discovery, envelope, view/sort validation)'
    );
  } finally {
    client.dispose();
  }
}
main().catch((error) => {
  console.error(
    'Agent public package verification: FAIL',
    error?.code ?? error?.name ?? 'unknown',
    String(error?.message ?? '').slice(0, 500)
  );
  process.exitCode = 1;
});
