import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';

async function example() {
  const guide = await readFile(new URL('../skills/make-app-auth/references/auth-app-context.md', import.meta.url), 'utf8')
    .catch(error => { assert.fail(`the shared App-context authority is required: ${error.code}`); });
  const code = guide.match(/<!-- executable-app-key-context -->\s*```js\n([\s\S]*?)\n```/u)?.[1];
  assert.ok(code, 'the authority must expose its executable URL decorator');
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const config = Object.freeze({ appKey: 'configured-app' });
for (const scope of ['/make', '/api/make']) {
  for (const path of ['/auth/current-context', '/oauth/callback', '/meta/v1/schema',
    '/data/v1/record', '/iam/v1/principal/permission', '/app/ai/v1/chats', '/future/service']) {
    test(`one configured outer appKey for ${scope}${path}`, async () => {
      const { withMakeAppContext } = await example();
      const query = new URLSearchParams([
        ['appKey', 'forged'], ['appKey', 'second'], ['state', 'opaque+state/='],
        ['code', 'opaque+code/='], ['login_ticket', 'opaque+ticket/='],
        ['return_url', 'https://customer.test/home?appKey=nested&value=a+b#fragment'],
        ['redirect_uri', 'https://gateway.test/callback?fixed=a+b'],
      ]);
      const original = new URL(`https://gateway.test${scope}${path}?${query}`);
      const result = withMakeAppContext(original, config);
      assert.deepEqual(result.searchParams.getAll('appKey'), [config.appKey]);
      for (const name of ['state', 'code', 'login_ticket', 'return_url', 'redirect_uri']) {
        assert.equal(result.searchParams.get(name), query.get(name));
      }
      assert.equal(result.pathname, original.pathname);
      assert.deepEqual(original.searchParams.getAll('appKey'), ['forged', 'second']);
      assert.equal(withMakeAppContext(new URL(`https://gateway.test${scope}${path}`), config)
        .searchParams.get('appKey'), config.appKey);
    });
  }
}

test('non-Make and prefix-lookalike URLs remain unchanged', async () => {
  const { withMakeAppContext } = await example();
  for (const path of ['/health', '/api/config', '/maker/data', '/api/maker/auth', '/other/auth']) {
    const original = new URL(`https://gateway.test${path}?appKey=other&state=opaque%2Bvalue`);
    assert.equal(withMakeAppContext(original, config).href, original.href);
  }
});

test('HTTP POST keeps the existing transport body, headers, redirect and cookies', async () => {
  const { withMakeAppContext } = await example();
  const body = JSON.stringify({ code: 'opaque+code', appKey: 'body-is-not-context' });
  const cookies = ['make_app_session=fixture; HttpOnly; Path=/', 'make_csrf=second; Path=/'];
  let received;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = { body: Buffer.concat(chunks).toString(), headers: request.headers,
      url: new URL(request.url, 'http://gateway.test') };
    response.writeHead(302, { location: '/home?keep=a%2Bb', 'set-cookie': cookies });
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const request = new Request('https://customer.test/api/make/oauth/exchange', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'fixture=1' }, body,
    });
    const response = await fetch(withMakeAppContext(
      `http://127.0.0.1:${server.address().port}/make/oauth/exchange?appKey=forged`, config), {
      method: request.method, headers: request.headers, body: request.body,
      signal: request.signal, duplex: 'half', redirect: 'manual',
    });
    await response.text();
    assert.deepEqual(received.url.searchParams.getAll('appKey'), [config.appKey]);
    assert.equal(received.body, body);
    assert.equal(received.headers['content-type'], 'application/json');
    assert.equal(received.headers.cookie, 'fixture=1');
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/home?keep=a%2Bb');
    assert.deepEqual(response.headers.getSetCookie(), cookies);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

for (const mode of ['published', 'local-preview']) {
  test(`${mode} documentation preserves App context and Make method contracts`, async () => {
    const { withMakeAppContext } = await example();
    const guide = await readFile(new URL('../skills/make-app-auth/references/service-fronted-mode.md', import.meta.url), 'utf8');
    const source = [...guide.matchAll(/<!-- make-upstream-example: ([\w-]+) -->\s*```ts\n([\s\S]*?)\n```/gu)]
      .find(match => match[1] === mode)?.[2];
    assert.ok(source, `the ${mode} example must remain executable`);
    const calls = [];
    const fetch = async (url, init) => { calls.push({ url: new URL(url), init }); return new Response('{}'); };
    const makeFetch = (url, init) => fetch(withMakeAppContext(url, config), init);
    const recordPayload = { appKey: config.appKey, entityKey: 'Record', fields: [], pagination: {} };
    const dependencies = mode === 'published'
      ? { config, makeFetch, fetch, entityKey: 'Record', fields: [], pagination: {},
        authHeaders: new Headers(), businessHeaders: new Headers() }
      : { config, makeFetch, fetch, recordPayload, makecliTokenHeaders: {},
        readMakecliResolveJson: () => ({ make_api_origin: 'https://gateway.test' }) };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(...Object.keys(dependencies), source)(...Object.values(dependencies));
    assert.equal(calls.length, 2);
    for (const { url, init } of calls) {
      assert.deepEqual(url.searchParams.getAll('appKey'), [config.appKey]);
      if (url.pathname.endsWith('/auth/current-context')) {
        assert.equal(init.method ?? 'GET', 'GET');
        assert.equal(init.redirect, 'manual');
      } else {
        assert.equal(init.method, 'POST');
        assert.equal(new Headers(init.headers).get('x-make-target'), url.pathname.endsWith('/schema')
          ? 'MakeService.GetResource' : 'MakeService.ListResources');
        assert.equal(init.body, JSON.stringify(url.pathname.endsWith('/schema')
          ? { appKey: config.appKey } : recordPayload));
      }
    }
  });
}

test('the authority exposes only a single shared decorator', async () => {
  assert.deepEqual(Object.keys(await example()), ['withMakeAppContext']);
});

test('secondary chapters link to the app context authority', async () => {
  for (const file of ['skills/make-app-auth/SKILL.md', 'skills/make-app-service/SKILL.md',
    'skills/make-app-auth/references/access-help.md',
    'skills/make-app-auth/references/service-fronted-mode.md',
    'skills/make-app-auth/references/service-fronted-node-example.md']) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(text, /\]\([^\n)]*auth-app-context\.md(?:#[^\n)]*)?\)/u, file);
  }
});
