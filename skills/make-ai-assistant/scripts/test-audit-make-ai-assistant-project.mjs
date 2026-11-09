#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const testRequire = createRequire(
  path.resolve(
    process.argv[2] ?? process.env.MAKE_SKILL_TEST_DEPENDENCIES ?? '.',
    '__skill_tests__.cjs'
  )
);
const parserRoot = path.dirname(testRequire.resolve('typescript/package.json'));
const scripts = path.dirname(fileURLToPath(import.meta.url));
const audit = path.join(scripts, 'audit-make-ai-assistant-project.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-041-audit-'));
let cases = 0;
const source = `
import {createAgentClient} from '@qfei-design/make-ai-assistant/agent';
import {MakeAppAssistantEntry} from '@qfei-design/make-ai-assistant/react';
import '@qfei-design/make-ai-assistant/styles.css';
const bridge={retryOwner:"sdk",async request(request,options){
  const response=await fetch(request.path,{credentials:"include",signal:options.signal});
  return {status:response.status,headers:response.headers,body:readBytes(response.body)};
}};
const client=createAgentClient({scope:{appKey,identityKey},basePath:"/api/make/app/agent/v1",transport:bridge});
function cleanup(){client.dispose();}
export const Entry=()=> <MakeAppAssistantEntry client={client} context={context}/>;
`;
const write = (name, value) => {
  fs.mkdirSync(path.dirname(name), { recursive: true });
  fs.writeFileSync(name, value);
};
function fixture(project, code = source, options = {}) {
  const ui = path.join(project, 'apps/ui');
  write(
    path.join(ui, 'package.json'),
    JSON.stringify({
      dependencies: { '@qfei-design/make-ai-assistant': '0.4.1' },
    })
  );
  write(path.join(ui, 'src/entry.tsx'), code);
  fs.mkdirSync(path.join(ui, 'node_modules'), { recursive: true });
  if (!options.noParser)
    fs.symlinkSync(
      parserRoot,
      path.join(ui, 'node_modules/typescript'),
      'junction'
    );
  const pkg = path.join(ui, 'node_modules/@qfei-design/make-ai-assistant');
  const exports = Object.fromEntries(
    ['agent', 'make-app', 'react'].map((n) => [
      './' + n,
      { types: './' + n + '.d.ts', default: './' + n + '.mjs' },
    ])
  );
  exports['./styles.css'] = { default: './styles.css' };
  write(
    path.join(pkg, 'package.json'),
    JSON.stringify({
      name: '@qfei-design/make-ai-assistant',
      type: 'module',
      version: options.version ?? '0.4.1',
      exports,
    })
  );
  write(
    path.join(pkg, 'agent.mjs'),
    'export const createAgentClient = ' +
      (options.client ?? '()=>({})') +
      '; export const assertAgentRequest=()=>{};'
  );
  write(
    path.join(pkg, 'make-app.mjs'),
    'export const createMakeAppAssistantTransport=()=>({});'
  );
  write(
    path.join(pkg, 'react.mjs'),
    'export const MakeAppAssistantEntry = ' +
      (options.component ?? '()=>null') +
      ';'
  );
  write(
    path.join(pkg, 'agent.d.ts'),
    options.noTypes
      ? ''
      : 'export declare function createAgentClient(): AgentClient; export declare function assertAgentRequest(): void; export interface AgentAuthenticatedTransport {} export interface AgentHttpRequest {} export type AgentClient=unknown;'
  );
  write(
    path.join(pkg, 'make-app.d.ts'),
    'export declare function createMakeAppAssistantTransport():unknown;'
  );
  write(
    path.join(pkg, 'react.d.ts'),
    'export declare function MakeAppAssistantEntry():unknown; export interface MakeAppAssistantEntryProps {}'
  );
  if (!options.noStyles) write(path.join(pkg, 'styles.css'), '');
}
function check(project, error, script = audit) {
  const result = spawnSync(
    process.execPath,
    [script, project, '--expected-package-version=0.4.1'],
    { encoding: 'utf8' }
  );
  const output = result.stdout + result.stderr;
  if (error) {
    assert.notEqual(result.status, 0, output);
    assert.ok(output.includes(error), output);
  } else {
    assert.equal(result.status, 0, output);
    assert.match(output, /STATIC PREFLIGHT PASS/);
    assert.match(output, /25.*executable/);
  }
  cases++;
}
function run(name, code = source, options = {}, error) {
  const p = path.join(temp, name);
  fixture(p, code, options);
  check(p, error);
  return p;
}
try {
  run('no-host-discovery-or-factory');
  run('missing-parser', source, { noParser: true }, 'agent_parser_missing');
  run(
    'named-import-aliases',
    source
      .replace(
        'import {createAgentClient}',
        'import {createAgentClient as buildClient}'
      )
      .replace(
        'import {MakeAppAssistantEntry}',
        'import {MakeAppAssistantEntry as Assistant}'
      )
      .replace('=createAgentClient(', '=buildClient(')
      .replace('<MakeAppAssistantEntry ', '<Assistant ')
  );
  run(
    'namespace-imports',
    source
      .replace('import {createAgentClient}', 'import * as Agent')
      .replace('import {MakeAppAssistantEntry}', 'import * as UI')
      .replace('=createAgentClient(', '=Agent.createAgentClient(')
      .replace('<MakeAppAssistantEntry ', '<UI.MakeAppAssistantEntry ')
  );
  run(
    'unrelated-client',
    source
      .replace(
        'import {createAgentClient}',
        'import {createAgentClient as unused}'
      )
      .replace(
        'const client=',
        'const createAgentClient=()=>({}); const client='
      ),
    {},
    'agent_client_missing'
  );
  run(
    'shadowed-client',
    source
      .replace(
        'const client=createAgentClient(',
        'function build(createAgentClient){return createAgentClient('
      )
      .replace(
        'transport:bridge});',
        'transport:bridge});}\nconst client=build(localFactory);'
      ),
    {},
    'agent_client_missing'
  );
  run(
    'unrelated-entry',
    source
      .replace(
        'import {MakeAppAssistantEntry}',
        'import {MakeAppAssistantEntry as unused}'
      )
      .replace(
        'export const Entry=',
        'const MakeAppAssistantEntry=()=>null; export const Entry='
      ),
    {},
    'app_entry_missing'
  );
  run(
    'shadowed-namespace',
    source
      .replace('import {MakeAppAssistantEntry}', 'import * as UI')
      .replace(
        'export const Entry=()=> <MakeAppAssistantEntry ',
        'export const Entry=({UI})=> <UI.MakeAppAssistantEntry '
      ),
    {},
    'app_entry_missing'
  );
  for (const component of [
    '{$$typeof:Symbol.for("react.memo"),type:()=>null}',
    '{$$typeof:Symbol.for("react.forward_ref"),render:()=>null}',
    '{$$typeof:Symbol.for("react.memo"),type:{$$typeof:Symbol.for("react.forward_ref"),render:()=>null}}',
  ])
    run('wrapped-' + cases, source, { component });
  for (const component of [
    '{}',
    'undefined',
    '{$$typeof:Symbol.for("react.memo"),type:{}}',
    '(()=>{const c={$$typeof:Symbol.for("react.memo")};c.type=c;return c})()',
  ])
    run('invalid-' + cases, source, { component }, 'package_react_missing');
  run('version', source, { version: '0.4.0' }, 'package_version_mismatch');
  run('types', source, { noTypes: true }, 'package_public_types_missing');
  run('styles', source, { noStyles: true }, 'package_styles_export_missing');
  run('factory', source, { client: '{}' }, 'package_client_missing');
  run(
    'entry',
    source.replace('<MakeAppAssistantEntry ', '<CustomEntry '),
    {},
    'app_entry_missing'
  );
  run(
    'legacy-only',
    source
      .replaceAll('createAgentClient', 'createMakeAgentClient')
      .replaceAll("/agent'", "/client'"),
    {},
    'agent_client_missing'
  );
  run(
    'dispose',
    source.replace('client.dispose()', 'void client'),
    {},
    'client_dispose_missing'
  );
  run(
    'cookie',
    source.replace('credentials:"include"', 'credentials:"omit"'),
    {},
    'session_credentials_missing'
  );
  run(
    'signal',
    source.replace('signal:options.signal', 'ignored:null'),
    {},
    'signal_forwarding_missing'
  );
  run(
    'missing-service-prefix',
    source.replace('/api/make/app/agent/v1', '/api/make/agent/v1'),
    {},
    'service_base_path_missing'
  );
  run(
    'version-path',
    source.replace('/agent/v1', '/agent/v1/v1'),
    {},
    'invalid_agent_base_path'
  );
  run(
    'id',
    source + 'const agentId=import.meta.env.VITE_AGENT_ID;',
    {},
    'agent_id_external_source'
  );
  run(
    'internal',
    source + "import '@qfei-design/make-ai-assistant/dist/private';",
    {},
    'internal_import'
  );
  run(
    'origin',
    source + 'const endpoint="https://foreign.invalid/api/make/app/agent/v1";',
    {},
    'hardcoded_assistant_origin'
  );
  const installed = run('installed-技能 path');
  for (const agentDir of ['.agents', '.codex']) {
    const copy = path.join(
      installed,
      agentDir,
      'skills/make-ai-assistant/scripts'
    );
    fs.cpSync(scripts, copy, { recursive: true });
    check(installed, undefined, path.join(copy, path.basename(audit)));
    const business = path.join(installed, agentDir, 'business.ts');
    write(business, "import '@qfei-design/make-ai-assistant/src/private';");
    check(installed, 'internal_import', path.join(copy, path.basename(audit)));
    fs.rmSync(business);
  }
  const one = run('workspace-isolation'),
    other = path.join(one, 'apps/second');
  fs.cpSync(path.join(one, 'apps/ui'), other, { recursive: true });
  write(
    path.join(other, 'src/entry.tsx'),
    source.replace('<MakeAppAssistantEntry ', '<OtherEntry ')
  );
  check(one, 'app_entry_missing');
  const service = run('service-consumer'),
    dir = path.join(service, 'apps/service');
  fs.cpSync(path.join(service, 'apps/ui'), dir, { recursive: true });
  write(
    path.join(dir, 'src/entry.tsx'),
    "import {assertAgentRequest} from '@qfei-design/make-ai-assistant/agent';assertAgentRequest(operation,body);"
  );
  check(service);
  run(
    'retained-legacy',
    source +
      "import type {Client} from '@qfei-design/make-ai-assistant/client';"
  );
  console.log(
    'make-ai-assistant project audit tests: PASS (' + cases + ' cases)'
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
