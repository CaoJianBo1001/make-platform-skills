#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const skill = read('skills/make-ai-assistant/SKILL.md');
const packageGuide = read('skills/make-ai-assistant/references/package-integration.md');
const host = read('skills/make-ai-assistant/references/make-app-host-integration.md');
const protocol = read('skills/make-ai-assistant/references/make-app-protocol.md');
const stream = read('skills/make-ai-assistant/references/make-app-stream-and-attachments.md');
const testing = read('skills/make-ai-assistant/references/testing-and-pitfalls.md');
const auth = read('skills/make-app-auth/SKILL.md');
const authAdapter = read('skills/make-app-auth/references/request-adapter.md');
const service = read('skills/make-app-service/SKILL.md');
const serviceContracts = read('skills/make-app-service/references/service-api-contracts.md');
const readme = read('README.md');

for (const [name, content] of Object.entries({skill, packageGuide, host, protocol, stream, testing, auth, authAdapter, service, readme})) {
  assert.doesNotMatch(content, /A01[–-]A17|17 (?:operations|项操作)|resolveScope|native EventSource exception/i, `${name} retains a retired Make App contract`);
}
for (const [name, content] of Object.entries({host, protocol, stream, testing, auth, authAdapter, service, readme})) {
  assert.doesNotMatch(content, /eventSourceFactory/i, `${name} still requires the Console EventSource callback for Make App`);
}

assert.match(skill, /metadata:\s*\n\s*version:\s*0\.3\.0/);
assert.match(skill, /targeted.*(?:references|tasks)|(?:references|tasks).*targeted/is);
assert.match(skill, /Make App host.*raw-byte/is);
assert.match(skill, /`AuthenticatedTransport\.request`/);
assert.match(skill, /Capabilities are fetched by the package/);
assert.match(packageGuide, /@qfei-design\/make-ai-assistant\/client/);
assert.match(packageGuide, /createMakeAgentClient/);
assert.match(packageGuide, /AuthenticatedTransport/);
assert.match(packageGuide, /retryOwner/);
assert.match(packageGuide, /ResponseSnapshot\.code\/message/);
assert.match(packageGuide, /AssistantTransportFeatures\.limits/);
assert.match(host, /client\.agents\.list/);
assert.match(host, /agentType\s*===?\s*["'`]app_internal["'`]/);
assert.match(host, /分页|pagination|pages/i);
assert.doesNotMatch(host, /bound the page count|fixed page count/i);
assert.match(host, /hasMore.*false[\s\S]*partial|partial[\s\S]*hasMore.*false/i);
assert.match(host, /createMakeAppAssistantTransport\s*\(\s*\{\s*client\s*,\s*agentId/);
assert.match(host, /dispose/);
assert.match(protocol, /\/api\/make\/app\/ai\/v1\/capabilities/);
assert.match(protocol, /\/api\/make\/app\/ai\/v1\/agents/);
assert.match(protocol, /18-operation|18 项|18 operations/i);
// Agent Public API v1 API.md at 60bbbcfe90c6defce46a0ed715e008fa4db20deb.
const operations = [
  ['A01', 'GET', 'agents'],
  ['A02', 'POST', 'chats'],
  ['A03', 'GET', 'chats'],
  ['A04', 'GET', 'chats/:chatId'],
  ['A05', 'PATCH', 'chats/:chatId'],
  ['A06', 'DELETE', 'chats/:chatId'],
  ['A07', 'PUT', 'chats/:chatId/messages/:messageId/feedback'],
  ['A08', 'POST', 'chats/:chatId/messages'],
  ['A09', 'GET', 'chats/:chatId/messages'],
  ['A10', 'GET', 'chats/:chatId/events'],
  ['A11', 'GET', 'chats/:chatId/responses/:responseId'],
  ['A12', 'POST', 'chats/:chatId/responses/:responseId/cancel'],
  ['A13', 'POST', 'chats/:chatId/uploads'],
  ['A14', 'GET', 'chats/:chatId/uploads/:uploadId'],
  ['A15', 'PUT', 'chats/:chatId/uploads/:uploadId/parts/:part'],
  ['A16', 'POST', 'chats/:chatId/uploads/:uploadId/complete'],
  ['A17', 'GET', 'chats/:chatId/content/:contentRef'],
  ['A18', 'GET', 'capabilities'],
];
for (const [id, method, suffix] of operations) {
  assert.ok(protocol.includes(`| ${id} | \`${method} /api/make/app/ai/v1/${suffix}`), `${id} does not match backend operation numbering`);
}
assert.match(protocol, /A02 JSON `\{ appKey, agentId, requestId, title\? \}`/);
assert.match(protocol, /A08 JSON `\{ messageId, text \}`[\s\S]*`\{ messageId, parts \}`/);
assert.match(protocol, /A10 query `responseId`, optional persistent `cursor`/);
assert.match(protocol, /A15 raw bytes with zero-based part index/);
assert.match(protocol, /Make-AI-Api-Version/);
assert.match(protocol, /不透明字符串|opaque string/i);
assert.doesNotMatch(protocol, /history cursor is numeric|历史游标.*数字|cursor=-1/i);
assert.match(stream, /Fetch|fetch/);
assert.match(stream, /client\.responses\.subscribe|SDK.*SSE/);
assert.doesNotMatch(stream, /host only supplies.*EventSource/i);
assert.match(auth, /AuthenticatedTransport/);
assert.match(authAdapter, /AsyncIterable<Uint8Array>/);
assert.match(service, /\/api\/make\/app\/ai\/v1\/\*\*/);
assert.match(protocol, /\{code,message,requestId\?,details\?\}/);
assert.match(protocol, /extensible|可扩展/i);
assert.match(protocol, /unknown.*code.*HTTP|未知.*code.*HTTP/is);
assert.match(protocol, /all non-GET\/HEAD|所有非 GET\/HEAD/i);
assert.match(protocol, /local preview[\s\S]*browser[\s\S]*Origin[\s\S]*Gateway origin/i);
assert.doesNotMatch(skill + packageGuide + host + protocol + stream + testing, /make-console|Make Console|\bvoice\b|\baudio\b/i);
assert.match(serviceContracts, /extensible|可扩展/i);
assert.doesNotMatch(protocol + service + serviceContracts + testing, /allowlisted code|explicit public v1 code allowlist|unknown uppercase error code/i);
assert.match(stream, /AI_UNSUPPORTED_MEDIA/);
assert.match(stream, /uploading[\s\S]*expiresAt[\s\S]*ready[\s\S]*content/i);
assert.doesNotMatch(stream, /UI's file\/image subset includes/);
assert.match(stream, /generic file\/image picker[\s\S]*415/i);
assert.match(stream, /客户端.*(?:ready|格式)|Client.*(?:ready|shape)/i);
assert.match(stream, /服务端.*(?:过期|归属|ready)|server.*(?:expired|ownership|ready)/i);
assert.match(testing, /18 operations in executable\s+Service route tests/i);
assert.match(testing, /Gateway fixture[\s\S]*request\/response schemas[\s\S]*SSE event schemas/i);
assert.match(testing, /route\/status-only fixture[\s\S]*unverified/i);
assert.match(testing, /product\/security policy may narrow/i);
assert.match(testing, /capabilities/);
assert.match(testing, /app_internal/);
assert.match(readme, /Make App v1|\/api\/make\/app\/ai\/v1/);

console.log('make-ai-assistant v1 contract passed');
