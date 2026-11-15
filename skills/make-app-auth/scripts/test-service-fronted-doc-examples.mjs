#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, '..');
const testRequire = createRequire(path.resolve(process.argv[2] ?? process.env.MAKE_SKILL_TEST_DEPENDENCIES ?? '.', '__skill_tests__.cjs'));
const ts = testRequire('typescript');
const serviceSkill = fs.readFileSync(path.resolve(skillDir, '../make-app-service/SKILL.md'), 'utf8');
const baseline = serviceSkill.split('## Default route baseline\n')[1]?.split('\n## ')[0];
assert.ok(baseline, 'Service default routes are required for this cross-Skill example check');
const routes = [...baseline.matchAll(/^\s*(GET|POST|PATCH|DELETE)\s+(\/\S+)\s*$/gm)]
  .map(([, method, route]) => ({ method, route }));
const matches = (route, pathname) => new RegExp('^' + route.split('/').map(segment =>
  segment.startsWith(':') ? '[^/]+' : segment === '*' ? '.*' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('/') + '$').test(pathname);
const traceHeaders = { traceparent: 'sample-trace', 'X-Log-Id': 'sample-trace' };
let examples = 0;
let callsChecked = 0;

for (const filename of ['request-adapter.md', 'service-fronted-mode.md', 'service-fronted-node-example.md']) {
  const document = fs.readFileSync(path.join(skillDir, 'references', filename), 'utf8');
  const blocks = [...document.matchAll(/```(?:ts|tsx|js)\n([\s\S]*?)```/g)]
    .map(([, code]) => code).filter(code => /auth\.api\.(?:get|post)\([\s\S]*?['"`]\/app\//.test(code));
  assert.ok(blocks.length, 'missing Service-fronted request example: ' + filename);
  for (const code of blocks) {
    const calls = [];
    const auth = { api: Object.fromEntries(['get', 'post'].map(method => [method, async requestPath => {
      calls.push({ method: method.toUpperCase(), pathname: new URL('/api/make' + requestPath, 'https://sample.invalid').pathname });
      return {};
    }])) };
    const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exported = await vm.runInNewContext('(async () => {' + compiled + '\nreturn exports;})()', {
      exports: {}, auth, createMakeAppAuth: () => auth,
      requestWithTrace: callback => callback(traceHeaders),
      makeRequestInit: (headers, extraHeaders = {}) => ({ credentials: 'include', headers: { ...extraHeaders, ...headers } }),
    }, { timeout: 1000 });
    if (exported.loadSchema) await exported.loadSchema();
    if (exported.listRecords) await exported.listRecords('sample_entity', {});
    assert.ok(calls.length >= 2, 'must execute schema and record-list requests: ' + filename);
    for (const call of calls) {
      assert.ok(routes.some(route => route.method === call.method && matches(route.route, call.pathname)), filename + ' example does not reach a documented Service route: ' + call.method + ' ' + call.pathname);
      callsChecked++;
    }
    examples++;
  }
}
console.log('Service-fronted documentation examples: PASS (' + examples + ' examples, ' + callsChecked + ' requests match default Service routes)');
