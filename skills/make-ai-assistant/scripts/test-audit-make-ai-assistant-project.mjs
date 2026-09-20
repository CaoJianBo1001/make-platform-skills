#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const audit = path.join(path.dirname(fileURLToPath(import.meta.url)), 'audit-make-ai-assistant-project.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-ai-assistant-audit-'));

const run = (name, source, options = {}, expectedCode = '') => {
  const project = path.join(tempRoot, name);
  writeProject(project, source, options);
  const result = spawnSync(process.execPath, [audit, project,
    `--expected-package-version=${options.expectedVersion ?? '0.3.2'}`,
  ], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (expectedCode) {
    assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
    assert.match(output, new RegExp(expectedCode), `${name}: ${output}`);
  } else {
    assert.equal(result.status, 0, `${name}: ${output}`);
    assert.match(output, /STATIC PREFLIGHT PASS/);
    assert.match(output, /18 Service operations.*executable host tests/);
  }
};

try {
  run('current-v1', validAppSource());
  run('legacy-0.3.1', validAppSource(), {
    packageVersion: '0.3.1',
    expectedVersion: '0.3.1',
    snapshotFailureFields: false,
    terminalFailureMessage: false,
    negotiatedUiLimits: false,
  }, 'package_public_types_missing');
  run('inline-public-types', validAppSource(), { inlineClientTypes: true });
  run('conditional-styles-export', validAppSource(), { conditionalStylesExport: true });
  run('newer-published-version', validAppSource(), { expectedVersion: '0.3.3' }, 'package_version_mismatch');
  run('missing-client-export', validAppSource(), { clientExport: false }, 'package_client_missing');
  run('missing-client-types', validAppSource(), { clientTypes: false }, 'package_public_types_missing');
  run('missing-snapshot-failure-fields', validAppSource(), { snapshotFailureFields: false }, 'package_public_types_missing');
  run('missing-terminal-failure-message', validAppSource(), { terminalFailureMessage: false }, 'package_public_types_missing');
  run('reordered-terminal-kinds', validAppSource(), { terminalVariantStyle: 'reordered' });
  run('split-terminal-failed-variant', validAppSource(), { terminalVariantStyle: 'split' });
  run('failed-variant-cannot-borrow-fields', validAppSource(), {
    terminalFailureMessage: false,
    terminalVariantStyle: 'split',
  }, 'package_public_types_missing');
  run('missing-react-types', validAppSource(), { reactTypes: false }, 'package_public_types_missing');
  run('missing-negotiated-ui-limits', validAppSource(), { negotiatedUiLimits: false }, 'package_public_types_missing');
  run('missing-react-runtime', validAppSource(), { reactRuntime: false }, 'package_react_missing');
  run('missing-styles-file', validAppSource(), { stylesFile: false }, 'package_styles_export_missing');
  run('unrelated-workspace-cannot-mask-consumer', validAppSource(), { reactTypes: false, unrelatedGoodWorkspace: true }, 'package_public_types_missing');
  run('unrelated-react-only-workspace', validAppSource(), { unrelatedReactOnlyWorkspace: true });
  run('vendored-package-artifact', validAppSource(), { vendoredPackageArtifact: true });
  run('another-app-workspace-cannot-mask-discovery',
    validAppSource().replace('client.agents.list', 'client.agents.lookup'),
    { secondValidAppWorkspace: true }, 'agent_discovery_missing');
  run('missing-adapter-factory', validAppSource(), { appFactory: false }, 'package_factory_missing');
  run('missing-agent-type-gate', validAppSource().replace('agent.agentType === "app_internal"', 'Boolean(agent)'), {}, 'app_internal_agent_gate_missing');
  run('missing-agent-pagination', validAppSource().replaceAll('nextCursor', 'nextPage'), {}, 'agent_pagination_missing');
  run('missing-capabilities-route', validAppSource().replace('/v1/capabilities', '/v1/unknown'), {}, 'capabilities_route_missing');
  run('missing-versioned-route', validAppSource().replaceAll('/v1/', '/old/'), {}, 'v1_route_missing');
  run('missing-retry-owner', validAppSource().replace('retryOwner: "sdk",', ''), {}, 'retry_owner_missing');
  run('missing-cookie-credentials', validAppSource().replace('credentials: "include",', ''), {}, 'session_credentials_missing');
  run('missing-dispose', validAppSource().replace('client.dispose()', 'void client'), {}, 'client_dispose_missing');
  run('external-agent-id', `${validAppSource()}\nconst configuredAgentId = import.meta.env.VITE_AI_AGENT_ID;`, {}, 'agent_id_external_source');
  run('removed-route', `${validAppSource()}\nconst retired = '/chats/locate';`, {}, 'removed_locate_route');
  run('product-media-policy', `${validAppSource()}\nconst policy = { modelInputKinds: ["text"] };`);
  const unsupportedOption = spawnSync(process.execPath, [audit, path.join(tempRoot, 'current-v1'), '--adapter=unknown'], { encoding: 'utf8' });
  assert.equal(unsupportedOption.status, 2);
  assert.match(`${unsupportedOption.stdout ?? ''}${unsupportedOption.stderr ?? ''}`, /unsupported option/);
  console.log('make-ai-assistant project audit tests: PASS');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function writeProject(root, source, options) {
  if (options.vendoredPackageArtifact) {
    const artifact = path.join(root, 'vendor/make-ai-assistant/examples');
    fs.mkdirSync(artifact, { recursive: true });
    fs.writeFileSync(path.join(root, 'vendor/make-ai-assistant/package.json'),
      JSON.stringify({ name: '@qfei-design/make-ai-assistant', version: '0.3.2' }));
    fs.writeFileSync(path.join(artifact, 'legacy.ts'),
      "import '@qfei-design/make-ai-assistant/src/internal';\n");
  }
  if (options.unrelatedGoodWorkspace) {
    fs.mkdirSync(path.join(root, 'apps/other'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps/other/package.json'), JSON.stringify({
      dependencies: { '@qfei-design/make-ai-assistant': '0.3.2' },
    }));
    writeFakePackage(path.join(root, 'apps/other/node_modules/@qfei-design/make-ai-assistant'), {});
  }
  if (options.unrelatedReactOnlyWorkspace) {
    fs.mkdirSync(path.join(root, 'apps/other/src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps/other/package.json'), JSON.stringify({
      dependencies: { '@qfei-design/make-ai-assistant': '0.3.2' },
    }));
    fs.writeFileSync(path.join(root, 'apps/other/src/preview.tsx'),
      "import { AssistantPanel } from '@qfei-design/make-ai-assistant/react';\nexport const Preview = AssistantPanel;\n");
    writeFakePackage(path.join(root, 'apps/other/node_modules/@qfei-design/make-ai-assistant'), { appFactory: false });
  }
  if (options.secondValidAppWorkspace) {
    fs.mkdirSync(path.join(root, 'apps/second/src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps/second/package.json'), JSON.stringify({
      dependencies: { '@qfei-design/make-ai-assistant': '0.3.2' },
    }));
    fs.writeFileSync(path.join(root, 'apps/second/src/assistant.tsx'), validAppSource());
    writeFakePackage(path.join(root, 'apps/second/node_modules/@qfei-design/make-ai-assistant'), {});
  }
  fs.mkdirSync(path.join(root, 'apps/ui/src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/ui/package.json'), JSON.stringify({
    dependencies: { '@qfei-design/make-ai-assistant': options.packageVersion ?? '0.3.2' },
  }));
  fs.writeFileSync(path.join(root, 'apps/ui/src/assistant.tsx'), source);
  writeFakePackage(path.join(root, 'apps/ui/node_modules/@qfei-design/make-ai-assistant'), options);
}

function writeFakePackage(packageRoot, options) {
  fs.mkdirSync(path.join(packageRoot, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: '@qfei-design/make-ai-assistant',
    version: options.packageVersion ?? '0.3.2',
    type: 'module',
    exports: {
      './client': { types: './dist/client.d.ts', import: './client.mjs', require: './client.mjs' },
      './make-app': { types: './dist/make-app.d.ts', import: './make-app.mjs', require: './make-app.mjs' },
      './react': { types: './dist/react.d.ts', import: './react.mjs', require: './react.mjs' },
      './styles.css': options.conditionalStylesExport
        ? { types: './dist/styles.css.d.ts', default: './styles.css' }
        : './styles.css',
    },
  }));
  fs.writeFileSync(path.join(packageRoot, 'client.mjs'), options.clientExport === false
    ? 'export const placeholder = true;\n'
    : 'export const createMakeAgentClient = () => ({});\n');
  fs.writeFileSync(path.join(packageRoot, 'make-app.mjs'), options.appFactory === false
    ? 'export const placeholder = true;\n'
    : 'export const createMakeAppAssistantTransport = async () => ({});\n');
  fs.writeFileSync(path.join(packageRoot, 'react.mjs'), options.reactRuntime === false
    ? 'export const placeholder = true;\n'
    : 'export const MakeAiAssistant = () => null; export const AssistantPanel = () => null;\n');
  if (options.stylesFile !== false) fs.writeFileSync(path.join(packageRoot, 'styles.css'), '');
  const responseEventDeclaration = terminalEventDeclaration(options);
  fs.writeFileSync(path.join(packageRoot, 'dist/client.d.ts'), options.inlineClientTypes
    ? `export interface AuthenticatedTransport {}\nexport interface Client {}\nexport interface Scope {}\nexport interface Agent {}\nexport interface Capabilities {}\nexport interface ClientOptions {}\nexport interface ResponseSnapshot { readonly code?: string; readonly message?: string; }\n${responseEventDeclaration}\nexport declare function createMakeAgentClient(options: ClientOptions): Client;\n`
    : 'export type * from "./client-types.js"; export declare function createMakeAgentClient(options: ClientOptions): Client;\n');
  fs.writeFileSync(path.join(packageRoot, 'dist/client-types.d.ts'), options.clientTypes === false
    ? 'export interface Scope {}\n'
    : `export interface AuthenticatedTransport {}\nexport interface Client {}\nexport interface Scope {}\nexport interface Agent {}\nexport interface Capabilities {}\nexport interface ResponseSnapshot { ${options.snapshotFailureFields === false ? '' : 'readonly code?: string; readonly message?: string;'} }\n${responseEventDeclaration}\n`);
  fs.writeFileSync(path.join(packageRoot, 'dist/make-app.d.ts'), 'export interface MakeAppAssistantTransportOptions {}\nexport interface AssistantTransport {}\nexport declare function createMakeAppAssistantTransport(options: MakeAppAssistantTransportOptions): Promise<AssistantTransport>;\n');
  fs.writeFileSync(path.join(packageRoot, 'dist/react.d.ts'), options.reactTypes === false
    ? 'export declare const placeholder: unknown;\n'
    : `export interface MakeAiTheme {}\nexport interface AssistantPanelProps {}\nexport interface MakeAiAssistantProps {}\nexport interface AssistantTransportFeatures { ${options.negotiatedUiLimits === false ? '' : 'limits?: { maxUploadBytes: number; maxInputParts: number; };'} }\nexport declare const MakeAiAssistant: unknown;\nexport declare const AssistantPanel: unknown;\n`);
}

function terminalEventDeclaration(options) {
  const failureFields = `readonly code?: string; ${options.terminalFailureMessage === false ? '' : 'readonly message?: string;'} readonly requestId?: string;`;
  if (options.terminalVariantStyle === 'reordered') {
    return `export type ResponseEvent = { readonly kind: "cancelled" | "completed" | "failed"; ${failureFields} };`;
  }
  if (options.terminalVariantStyle === 'split') {
    return `export type ResponseEvent =
      | { readonly kind: "completed"; readonly code?: string; readonly message?: string; readonly requestId?: string; }
      | { readonly kind: "failed"; ${failureFields} }
      | { readonly kind: "cancelled"; readonly code?: string; readonly message?: string; readonly requestId?: string; };`;
  }
  return `export type ResponseEvent = { readonly kind: "completed" | "failed" | "cancelled"; ${failureFields} };`;
}

function validAppSource() {
  return `
    import { MakeAiAssistant } from '@qfei-design/make-ai-assistant/react';
    import { createMakeAgentClient } from '@qfei-design/make-ai-assistant/client';
    import { createMakeAppAssistantTransport } from '@qfei-design/make-ai-assistant/make-app';
    import '@qfei-design/make-ai-assistant/styles.css';
    const authBridge = {
      retryOwner: "sdk",
      async request(request, options) {
        const response = await fetch(request.path, {
          method: request.method, headers: request.headers, body: request.body,
          credentials: "include", signal: options?.signal,
        });
        return { status: response.status, headers: Object.fromEntries(response.headers), body: readBytes(response.body) };
      },
    };
    const client = createMakeAgentClient({ scope: { appKey, identityKey }, transport: authBridge });
    async function discover(signal) {
      const candidates = [];
      let cursor;
      for (let page = 0; page < 10; page++) {
        const result = await client.agents.list({ cursor, limit: 100 }, { signal });
        candidates.push(...result.agents.filter((agent) => agent.agentType === "app_internal"));
        if (!result.hasMore) break;
        cursor = result.nextCursor;
      }
      if (candidates.length !== 1) throw new Error('Agent configuration invalid');
      return createMakeAppAssistantTransport({ client, agentId: candidates[0].agentId, signal });
    }
    function cleanup() { client.dispose(); }
    const serviceRoutes = ['/api/make/app/ai/v1/capabilities', '/api/make/app/ai/v1/agents'];
    export const Assistant = () => <MakeAiAssistant transport={transport} />;
  `;
}
