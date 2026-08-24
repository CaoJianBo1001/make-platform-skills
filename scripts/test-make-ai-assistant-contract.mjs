#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(
    fs.existsSync(filePath),
    `Expected ${relativePath} under repo root ${repoRoot}`,
  );
  return fs.readFileSync(filePath, 'utf8');
};

const skill = read('skills/make-ai-assistant/SKILL.md');
const packageIntegration = read('skills/make-ai-assistant/references/package-integration.md');
const artifactContract = read('skills/make-ai-assistant/references/artifact-contract.md');
const transportContract = read('skills/make-ai-assistant/references/transport-and-service-contract.md');
const consoleServiceContract = read(
  'skills/make-ai-assistant/references/make-console-service-contract.md',
);
const uiTemplates = read('skills/make-ai-assistant/references/ui-and-templates.md');
const testing = read('skills/make-ai-assistant/references/testing-and-pitfalls.md');
const agentMetadata = read('skills/make-ai-assistant/agents/openai.yaml');
const readme = read('README.md');
const makeui = read('skills/makeui/SKILL.md');
const service = read('skills/make-app-service/SKILL.md');

const skillBundle = [
  skill,
  packageIntegration,
  artifactContract,
  transportContract,
  consoleServiceContract,
  uiTemplates,
  testing,
  agentMetadata,
].join('\n');
const skillFrontmatter = skill.split('---')[1] ?? '';

assert.doesNotMatch(
  skillBundle,
  /\b[A-Za-z][A-Za-z0-9]*(?:Poc|Workbench)\b|\/(?:Users|home|var\/folders)(?:\/|$)/i,
  'make-ai-assistant skill content must not contain project or local-machine names',
);
assert.doesNotMatch(
  skillBundle,
  /Expense|报销|销售订单|项目进度|PRJ\d+|session_01/i,
  'make-ai-assistant examples must not leak project-specific business content',
);
assert.match(
  skillFrontmatter,
  /助手[\s\S]*AI助手[\s\S]*MakeAI AI 助手[\s\S]*AI 对话框[\s\S]*Artifact[\s\S]*SSE[\s\S]*Agent Gateway[\s\S]*make-ai-assistant/i,
  'frontmatter trigger scope must focus on assistant, Artifact, SSE, Agent Gateway, and make-ai-assistant package semantics',
);
assert.doesNotMatch(
  skillFrontmatter,
  /(right drawer|Drawer|右侧抽屉|侧边抽屉|右侧面板)/i,
  'frontmatter trigger scope must not include drawer/panel terms that overlap form/detail surfaces',
);
assert.doesNotMatch(
  skillFrontmatter,
  /(?<!AI\s)对话框/,
  'frontmatter trigger scope must not include bare 对话框 because generic dialogs belong to makeui',
);

assert.match(
  skill,
  /@qfei-design\/make-ai-assistant[\s\S]*(package\.ai\.json|readOrder)[\s\S]*(public|公开)/i,
  'skill must require the public make-ai-assistant package documentation contract',
);
assert.match(
  skill,
  /(MakeAiAssistant|AssistantPanel|ArtifactRenderer)[\s\S]*(styles\.css|样式)/,
  'skill must cover the public React components and package styles',
);
assert.match(
  skill,
  /(Make App adapter|make-app)[\s\S]*(SSE|EventSource)[\s\S]*(Artifact|结构化)/i,
  'skill must cover Make App transport, SSE, and structured Artifact results',
);
assert.match(
  skill,
  /(makeui|make-app-service|make-app-auth|make-app-permission|make-app-runtime)/,
  'skill must define cross-skill handoffs',
);
assert.match(
  skill,
  /(Adapter|适配器).{0,80}(选择|selection)[\s\S]{0,1000}(Make Console|make-console)[\s\S]{0,1000}(Make App|make-app)/i,
  'skill must require an adapter selection gate before implementation',
);
assert.match(
  skill,
  /(已配置|configured)[\s\S]{0,500}(Agent|Agent Gateway)[\s\S]{0,500}(make-console|Make Console)/i,
  'configured Console Agent or Agent Gateway must select the make-console adapter',
);
assert.match(
  skill,
  /(未确认|unconfirmed|cannot confirm|neither)[\s\S]{0,500}(停止|stop|ask|确认)/i,
  'skill must stop for confirmation when neither adapter contract is confirmed',
);
assert.match(
  skill,
  /(页面|page)[\s\S]{0,300}(Make App)[\s\S]{0,300}(不得|must not|不能)[\s\S]{0,300}(默认|default)[\s\S]{0,300}(make-app|Make App)/i,
  'a Make App page alone must not default the integration to the make-app adapter',
);

assert.match(
  packageIntegration,
  /禁止|Do not[\s\S]*(src|dist|internal|内部)/i,
  'package integration must forbid package-internal imports',
);
assert.match(
  packageIntegration,
  /(userName|userAvatarUrl|privacyNotice|suggestions|launcher|registry)/,
  'package integration must document host-provided user, notice, launcher, suggestions, and registry props',
);
assert.match(
  packageIntegration,
  /(demo|mock|testing)[\s\S]*(only|仅)[\s\S]*(开发|测试|演示|非生产)/i,
  'package integration must keep mock/demo transport out of production semantics',
);
assert.match(
  packageIntegration,
  /recipes\.json[\s\S]*(capabilities\.json|capabilities)[\s\S]*(selected|选中|adapter|适配器)/i,
  'package integration must require selected-adapter recipes and capabilities metadata when published',
);

assert.match(
  artifactContract,
  /metric[\s\S]*comparison[\s\S]*trend[\s\S]*ranking[\s\S]*record-list[\s\S]*notice/,
  'artifact contract must list the six Artifact V1 kinds',
);
assert.match(
  artifactContract,
  /(semantic|语义)[\s\S]*(not|不是|不得)[\s\S]*(React|component|组件名)/i,
  'artifact contract must say backend returns semantics, not component names',
);
assert.match(
  artifactContract,
  /(capabilities|能力协商)[\s\S]*(artifactKinds|templates|schemaVersion)/,
  'artifact contract must include frontend/backend capability negotiation',
);
assert.match(
  artifactContract,
  /(Markdown|自然语言)[\s\S]*(不能|不得|must not|not reliable|不可靠)[\s\S]*(guess|猜|组件)/i,
  'artifact contract must forbid guessing components from markdown text',
);
assert.match(
  artifactContract,
  /(action|动作)[\s\S]*(intent|意图)[\s\S]*(open-record|open-list|navigate|invoke)/,
  'artifact contract must define action intents instead of raw URLs',
);

assert.match(
  transportContract,
  /\/api\/make\/app\/ai[\s\S]*(locate|messages|events)/,
  'transport contract must define the Make App AI route family',
);
assert.match(
  transportContract,
  /(MAKE_API_BASE_URL|MAKE_SERVER_URL)[\s\S]*(origin|网关 origin|gateway origin)[\s\S]*(make-gateway|Make Gateway)/i,
  'transport contract must specify unified Make Gateway origin environment configuration',
);
assert.match(
  transportContract,
  /(published|发布)[\s\S]*(\/make\/app\/ai|\/make\/\*\*)[\s\S]*(local preview|本地预览)[\s\S]*(\/api\/make\/app\/ai|\/api\/make\/\*\*)/i,
  'transport contract must distinguish published internal /make scope from local/browser /api/make scope',
);
assert.match(
  transportContract,
  /(base URL|baseUrl|域名|origin)[\s\S]*(不得|不要|must not)[\s\S]*(\/api\/make|\/make|path|路径)/i,
  'transport base URL must be a strict origin and not include service paths',
);
assert.match(
  transportContract,
  /(dev|test|prod|环境|domain|域名)[\s\S]*(不得|不要|must not)[\s\S]*(hard-code|硬编码)/i,
  'transport contract must forbid hard-coded environment domains',
);
assert.match(
  transportContract,
  /(messageId|idempotent|幂等)[\s\S]*(UUID|deterministic|稳定)/i,
  'transport contract must require stable idempotent message ids',
);
assert.match(
  transportContract,
  /(event:\s*artifact|artifact[\s\S]*event)[\s\S]*(messageId|schemaVersion|kind)/i,
  'transport contract must define a streaming Artifact event',
);
assert.match(
  transportContract,
  /(history|历史)[\s\S]*(artifacts|Artifact)[\s\S]*(刷新|restore|恢复)/i,
  'transport contract must preserve artifacts in history for refresh/restore',
);
assert.match(
  transportContract,
  /(Cookie|Authorization|token|令牌)[\s\S]*(不得|不要|must not)[\s\S]*(log|日志|UI|前端)/i,
  'transport contract must protect credentials and avoid UI token handling/logging',
);
assert.match(
  transportContract,
  /make-console-service-contract\.md/,
  'transport contract must route Console integrations to their dedicated service contract',
);

assert.match(
  consoleServiceContract,
  /(Agent 查询|Agent query)[\s\S]*(Session|会话)[\s\S]*(持久事件|durable event)[\s\S]*(发送消息|send message)[\s\S]*(Run SSE|run stream)/i,
  'Console BFF must allow only Agent query, Session, durable-event, send-message, and Run-SSE operations',
);
assert.match(
  consoleServiceContract,
  /(白名单|allowlist)[\s\S]*(跨 App|cross-app)[\s\S]*(未知路径|unknown path)[\s\S]*(查询参数|query)[\s\S]*(请求体|body)/i,
  'Console BFF must reject cross-App, unknown-path, invalid-query, and invalid-body input before proxying',
);
assert.match(
  consoleServiceContract,
  /(稳定|stable)[\s\S]*(错误|error)[\s\S]*(不得|must not|never|not)[\s\S]*(诊断|diagnostic|upstream body)/i,
  'Console BFF must map upstream failures to stable errors without exposing diagnostics',
);
assert.match(
  consoleServiceContract,
  /(Run SSE|run stream)[\s\S]*(text\/event-stream|SSE)[\s\S]*(only|仅|只能)/i,
  'only the Console Run operation may return SSE',
);
assert.match(
  consoleServiceContract,
  /(headers (?:are )?sent|已写入|首帧|first frame)[\s\S]*(关闭|close)[\s\S]*(JSON|error middleware|错误中间件)/i,
  'Console SSE failures after the first frame must close the stream instead of writing JSON',
);
assert.match(
  consoleServiceContract,
  /(client disconnect|客户端断开)[\s\S]*(AbortSignal|abort|中止)[\s\S]*(upstream|上游)/i,
  'Console BFF must abort upstream Run work after client disconnect',
);

assert.match(
  uiTemplates,
  /(ranking|排行)[\s\S]*(progress|进度)/i,
  'UI guidance must map ranking to progress/ranking displays',
);
assert.match(
  uiTemplates,
  /(comparison|对比)[\s\S]*(overview|概况|指标)/i,
  'UI guidance must map comparison to overview metrics',
);
assert.match(
  uiTemplates,
  /(record-list|记录列表)[\s\S]*(open-record|open-list|动作|action)/i,
  'UI guidance must cover record-list and host actions',
);
assert.match(
  uiTemplates,
  /(custom template|自定义模板|registry)[\s\S]*(package|包)[\s\S]*(white|白名单|canRender|priority)/i,
  'UI guidance must explain package-level custom templates and registry selection',
);

assert.match(
  testing,
  /(TDD|Test first|先写测试|测试先行)/i,
  'testing guidance must require TDD',
);
assert.match(
  testing,
  /(artifact|Artifact)[\s\S]*(validation|校验)[\s\S]*(history|SSE|stream|流)/i,
  'testing guidance must cover artifact validation, history, and streaming',
);
assert.match(
  testing,
  /(pitfall|陷阱|常见回归)[\s\S]*(Markdown|capabilities|history|demo|mock)/i,
  'testing guidance must list common pitfalls around markdown, capabilities, history, and demo/mock',
);
assert.match(
  testing,
  /(错误适配器|wrong adapter)[\s\S]*(错误路由|wrong route|route)/i,
  'testing guidance must require a regression test for wrong adapter and route selection',
);
assert.match(
  testing,
  /(首帧|first frame)[\s\S]*(断流|stream failure|upstream)[\s\S]*(关闭|close)/i,
  'testing guidance must cover Console SSE failure after the first frame',
);
assert.match(
  testing,
  /(既有|existing)[\s\S]*(页面|路由|page|route)[\s\S]*(render|渲染|lint|typecheck|build)/i,
  'testing guidance must require a render or equivalent smoke check for the modified host route',
);

assert.match(
  agentMetadata,
  /Make AI Assistant[\s\S]*Artifact[\s\S]*(SSE|transport)/i,
  'agent metadata must summarize Make AI Assistant Artifact and transport work',
);
assert.match(
  readme,
  /Make AI 助手[\s\S]*`make-ai-assistant`[\s\S]*Artifact/i,
  'README must route Make AI assistant work to make-ai-assistant',
);
assert.match(
  readme,
  /做 Make AI 助手|AI 对话框|AI 助手/i,
  'README common combinations must mention Make AI assistant work',
);
assert.match(
  makeui,
  /Make AI 助手|make-ai-assistant/i,
  'makeui must hand assistant presentation behavior to make-ai-assistant',
);
assert.match(
  service,
  /Make AI 助手|make-ai-assistant|Artifact/i,
  'make-app-service must hand assistant protocol details to make-ai-assistant',
);
assert.match(
  service,
  /(make-app|Make App)[\s\S]{0,300}(only|仅|已选择|selected)[\s\S]{0,300}\/api\/make\/app\/ai/i,
  'make-app-service must present /api/make/app/ai routes as Make App adapter-only',
);
assert.match(
  service,
  /(make-console|Make Console)[\s\S]{0,500}(通用代理|generic proxy|不得|must not)/i,
  'make-app-service must prevent Console work from becoming a generic proxy',
);
const consoleContractReferences = [
  ...service.matchAll(/`[^`]*make-console-service-contract\.md`/g),
].map(([reference]) => reference);
assert.ok(
  consoleContractReferences.length >= 2,
  'make-app-service must reference the Console BFF contract wherever it documents Console routes',
);
assert.ok(
  consoleContractReferences.every(
    (reference) =>
      reference === '`make-ai-assistant/references/make-console-service-contract.md`',
  ),
  'make-app-service must use the fully qualified make-ai-assistant Console contract reference',
);

console.log('make-ai-assistant contract passed');
