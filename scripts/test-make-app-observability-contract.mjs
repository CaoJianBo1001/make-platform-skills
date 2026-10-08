#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const skill = read('skills/make-app-observability/SKILL.md');
const readme = read('README.md');
const runtime = read('skills/make-app-runtime/SKILL.md');
const service = read('skills/make-app-service/SKILL.md');
const auth = read('skills/make-app-auth/SKILL.md');
const authAdapter = read('skills/make-app-auth/references/request-adapter.md');
const authServiceExample = read('skills/make-app-auth/references/service-fronted-node-example.md');
const authServiceMode = read('skills/make-app-auth/references/service-fronted-mode.md');
const traceChain = read('skills/make-app-observability/references/trace-chain.md');
const testingAndAudit = read('skills/make-app-observability/references/testing-and-audit.md');
const workflow = read('.github/workflows/skill-metadata-lint.yml');

assert.match(skill, /所有新建.*Make App.*默认|all new Make Apps.*default/i);
assert.match(skill, /traceparent/);
assert.match(skill, /X-Log-Id/);
assert.match(skill, /@qfei-design\/make-app-observability/);
assert.match(skill, /references\/package-integration\.md/);
assert.match(skill, /references\/trace-chain\.md/);
assert.match(readme, /新建完整 Make App[^\n]*make-app-observability/);
const observabilityReadme = readme.match(/### make-app-observability[\s\S]*?(?=\n### |$)/)?.[0] ?? '';
assert.match(observabilityReadme, /npx skills add qfeius\/make-platform-skills --skill make-app-observability -g/);
assert.match(observabilityReadme, /npx skills update make-app-observability -g/);
assert.match(runtime, /trace:audit[\s\S]*verify:publish/);
assert.match(service, /make-app-observability/);
assert.match(auth, /make-app-observability/);
assert.doesNotMatch(authAdapter, /X-Trace-Id/i);
assert.match(authAdapter, /traceparent/);
assert.match(authAdapter, /X-Log-Id/);
assert.match(authAdapter, /headers:\s*\{\s*\.\.\.extraHeaders,\s*\.\.\.traceHeaders\s*\}/);
assert.match(authServiceExample, /requestWithTrace/);
assert.match(authServiceMode, /requestWithTrace/);
assert.match(skill, /存量 App[^\n]*不擅自扩大/);
assert.match(traceChain, /(?:冲突|不一致)[^\n]*重新生成[^\n]*traceparent/);
assert.match(traceChain, /实际 HTTP 状态码/);
assert.match(traceChain, /非 2xx[^\n]*Span[^\n]*错误/);
assert.match(testingAndAudit, /业务码失败[^\n]*实际 HTTP 状态码/);
assert.match(testingAndAudit, /AI[^\n]*非 2xx[^\n]*Span[^\n]*错误/);
assert.match(workflow, /node skills\/make-app-observability\/scripts\/test-audit-trace-contract\.mjs/);

console.log('Make App observability default contract passed');
