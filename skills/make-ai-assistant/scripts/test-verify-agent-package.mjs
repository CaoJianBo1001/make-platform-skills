#!/usr/bin/env node
// 用正式公开包派发请求，仅在隔离测试适配层注入错误；不修改已安装包。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(
  workspace,
  'usage: node test-verify-agent-package.mjs <consumer-workspace>',
);
const require = createRequire(
  path.join(workspace, '__agent_verifier_test__.cjs'),
);
const publicEntry = pathToFileURL(
  require.resolve('@qfei-design/make-ai-assistant/agent'),
).href;
const verifier = fileURLToPath(
  new URL('./verify-agent-package.mjs', import.meta.url),
);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-verifier-技能 '));
let cases = 0;
function verify(target, shouldPass, label) {
  const result = spawnSync(process.execPath, [verifier, target], {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1_000_000,
  });
  assert.ifError(result.error);
  const output = result.stdout + result.stderr;
  if (shouldPass) {
    assert.equal(result.status, 0, `${label}: ${output}`);
    assert.match(result.stdout, /Agent public package verification: PASS/);
  } else {
    assert.notEqual(result.status, 0, `${label} must be rejected: ${output}`);
    assert.doesNotMatch(
      result.stdout,
      /Agent public package verification: PASS/,
    );
  }
  cases++;
}
try {
  verify(workspace, true, 'official package');
  for (const [label, filter] of [
    ['not-equal', { expression: 'appKey != "SampleApp" || true' }],
    ['extra-or', { expression: 'appKey == "SampleApp" || true' }],
    [
      'other-app',
      { expression: 'appKey == "OtherApp" || appKey == "SampleApp"' },
    ],
    ['extra-field', { expression: 'appKey == "SampleApp"', extra: true }],
  ]) {
    const target = path.join(temp, label);
    const pkg = path.join(
      target,
      'node_modules/@qfei-design/make-ai-assistant',
    );
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(
      path.join(pkg, 'package.json'),
      JSON.stringify({
        name: '@qfei-design/make-ai-assistant',
        type: 'module',
        exports: { './agent': './agent.mjs' },
      }),
    );
    fs.writeFileSync(
      path.join(pkg, 'agent.mjs'),
      `
export * from ${JSON.stringify(publicEntry)};
import {createAgentClient as realClient} from ${JSON.stringify(publicEntry)};
export function createAgentClient(options) {
  const request = options.transport.request.bind(options.transport);
  return realClient({...options, transport: {...options.transport, async request(input, config) {
    if (input.path.endsWith('/agent')) {
      const body = JSON.parse(new TextDecoder().decode(input.body));
      body.filter = ${JSON.stringify(filter)};
      input = {...input, body: new TextEncoder().encode(JSON.stringify(body))};
    }
    return request(input, config);
  }}});
}
`,
    );
    verify(target, false, label);
  }
  console.log(`Agent package verifier tests: PASS (${cases} cases)`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
