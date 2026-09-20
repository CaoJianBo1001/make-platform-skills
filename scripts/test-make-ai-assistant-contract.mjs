#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const files = {
  skill: 'skills/make-ai-assistant/SKILL.md',
  package: 'skills/make-ai-assistant/references/package-integration.md',
  host: 'skills/make-ai-assistant/references/make-app-host-integration.md',
  protocol: 'skills/make-ai-assistant/references/make-app-protocol.md',
  stream: 'skills/make-ai-assistant/references/make-app-stream-and-attachments.md',
  ui: 'skills/make-ai-assistant/references/ui-and-templates.md',
  testing: 'skills/make-ai-assistant/references/testing-and-pitfalls.md',
  agent: 'skills/make-ai-assistant/agents/openai.yaml',
};
const docs = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const bundle = Object.values(docs).join('\n');
const frontmatter = docs.skill.split('---')[1] ?? '';
const readme = read('README.md');
const makeui = read('skills/makeui/SKILL.md');
const service = read('skills/make-app-service/SKILL.md');
const auth = read('skills/make-app-auth/SKILL.md');
const ci = read('.github/workflows/skill-metadata-lint.yml');

const skillRoot = path.join(root, 'skills/make-ai-assistant');
const skillFiles = [
  path.join(skillRoot, 'SKILL.md'),
  ...['agents', 'references', 'scripts'].flatMap((directory) => {
    const absolute = path.join(skillRoot, directory);
    return fs.existsSync(absolute)
      ? fs.readdirSync(absolute).map((name) => path.join(absolute, name)).filter((file) => fs.statSync(file).isFile())
      : [];
  }),
];
for (const file of skillFiles) {
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /Make Console|make-console|console\/v1|eventSourceFactory|withCredentials/i, `${file} should only guide Make App integration`);
}
assert.doesNotMatch(service, /Make Console|make-console|console\/v1/i);
assert.doesNotMatch(readme.match(/### make-ai-assistant[\s\S]*?(?=\n### |$)/)?.[0] ?? '', /Make Console|make-console|console\/v1/i);
assert.doesNotMatch(readme, /按协议族选 adapter|协议族选择/);

assert.match(frontmatter, /version:\s*0\.3\.0/);
assert.match(frontmatter, /Make App[\s\S]*Agent discovery/i);
assert.doesNotMatch(bundle, /\b[A-Za-z][A-Za-z0-9]*(?:Poc|Workbench)\b|\/(?:Users|home|var\/folders)(?:\/|$)/i);
assert.doesNotMatch(bundle, /Expense|报销|销售订单|项目进度|PRJ\d+|session_01/i);
assert.doesNotMatch(bundle, /语音|音频|录音|转写|\baudio\b/i);
assert.doesNotMatch(bundle, /A01[–-]A17|17 (?:operations|项操作)|resolveScope|createMakeAppTransport\b/i);
assert.doesNotMatch(bundle, /chats\/locate|history cursor is numeric|cursor=-1/i);
assert.match(docs.skill, /TDD[\s\S]*failing[\s\S]*implementation/i);
assert.match(docs.skill, /audit-make-ai-assistant-project\.mjs/);
assert.match(docs.skill, /makeui[\s\S]*make-app-service[\s\S]*make-app-auth[\s\S]*make-app-permission[\s\S]*make-app-runtime/);

assert.match(docs.skill, /versioned Make App AI Chat contract/i);
assert.match(docs.skill, /current backend[\s\S]*production readiness/i);
assert.match(docs.package, /legacy route/i);
assert.match(docs.package, /@qfei-design\/make-ai-assistant\/client/);
assert.match(docs.package, /public types or exports|export map and the declarations/i);
assert.match(docs.package, /transitively referenced declarations/i);
assert.match(docs.package, /unexported declaration files/i);
assert.match(docs.package, /retryOwner/);
assert.match(docs.package, /ignored compatibility props `subtitle` or `privacyNotice`/i);
assert.match(docs.host, /agentType\s*===\s*["'`]app_internal["'`]/);
assert.match(docs.host, /nextCursor[\s\S]*zero[\s\S]*two or more/i);
assert.match(docs.host, /createMakeAppAssistantTransport\(\{ client, agentId, signal \}\)/);
assert.match(docs.host, /AbortSignal[\s\S]*dispose/);
assert.match(docs.protocol, /Exact 18-operation allowlist/);
for (let index = 1; index <= 18; index += 1) {
  assert.match(docs.protocol, new RegExp(`\\| A${String(index).padStart(2, '0')} \\|`));
}
assert.match(docs.protocol, /Make-AI-Api-Version[\s\S]*opaque strings/i);
assert.match(docs.protocol, /MAKE_APP_KEY[\s\S]*non-GET\/HEAD[\s\S]*`Origin`/i);
assert.match(docs.protocol, /internal HTTP Gateway origin/i);
assert.match(docs.protocol, /64 MiB[\s\S]*32[\s\S]*8 KiB[\s\S]*64 KiB/);
assert.match(docs.protocol, /\{code,message,requestId\?,details\?\}/);
assert.match(docs.protocol, /all non-GET\/HEAD|所有非 GET\/HEAD/i);
assert.match(docs.stream, /Fetch[\s\S]*client\.responses\.subscribe/);
assert.match(docs.stream, /upload[\s\S]*partSize[\s\S]*contentRef/);
assert.match(docs.stream, /modelInputKinds[\s\S]*AI_UNSUPPORTED_MEDIA/);
assert.match(docs.testing, /published Dev[\s\S]*real SSE[\s\S]*file\/image transfer/);
assert.match(docs.testing, /unknown code.*HTTP|未知.*code.*HTTP/i);
assert.match(docs.testing, /skipped[\s\S]*upload[\s\S]*release gate/i);

assert.doesNotMatch(docs.skill, /references\/artifact-contract\.md/);
assert.match(docs.skill, /current Make App adapter does not carry Artifact/i);
assert.match(docs.ui, /task list[\s\S]*上传文件或图片/i);
assert.doesNotMatch(docs.ui, /当前对象|只读标签|只读状态/);
assert.match(docs.agent, /multi-session[\s\S]*SSE/i);
assert.match(readme, /make-ai-assistant[\s\S]*Make App v1/i);
assert.match(service, /18[ -]operation|18 项操作/i);
assert.match(auth, /AuthenticatedTransport/);
assert.match(makeui, /make-ai-assistant[\s\S]*make-env-setup/);
assert.match(ci, /for\s+\w+\s+in\s+scripts\/test-\*\.mjs/);
assert.match(ci, /name: Skill Metadata Lint[\s\S]*skill-metadata:[\s\S]*name: Validate skill metadata/);
assert.match(ci, /node skills\/make-ai-assistant\/scripts\/test-audit-make-ai-assistant-project\.mjs/);
assert.match(docs.testing, /independent fresh-agent forward test/i);
assert.match(docs.skill, /independent forward test[\s\S]*references\/testing-and-pitfalls\.md/i);
assert.match(docs.testing, /isolated\s+temporary Make App workspace/i);
assert.match(docs.testing, /release[^\n]*blocked/i);
assert.doesNotMatch(service, /current selected adapters/i);

console.log('make-ai-assistant contract passed');
