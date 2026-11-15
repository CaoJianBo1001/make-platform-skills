#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadAgentCompiler } from './load-agent-compiler.mjs';
const testRequire = createRequire(
  path.resolve(
    process.argv[2] ?? process.env.MAKE_SKILL_TEST_DEPENDENCIES ?? '.',
    '__skill_tests__.cjs',
  ),
);
const loadedParser = loadAgentCompiler(
  process.argv[2] ?? process.env.MAKE_SKILL_TEST_DEPENDENCIES ?? '.',
);
const parserRoot = path.dirname(
  testRequire.resolve(loadedParser.name + '/package.json'),
);
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
  const ui = path.join(project, options.workspace ?? 'apps/ui');
  write(
    path.join(ui, 'package.json'),
    JSON.stringify({
      dependencies: { '@qfei-design/make-ai-assistant': '0.4.5' },
    }),
  );
  write(path.join(ui, 'src/entry.tsx'), code);
  fs.mkdirSync(path.join(ui, 'node_modules'), { recursive: true });
  if (options.nativeParser) {
    write(
      path.join(ui, 'node_modules/typescript/package.json'),
      JSON.stringify({
        name: 'typescript',
        main: 'index.cjs',
        version: '7.0.2',
      }),
    );
    write(
      path.join(ui, 'node_modules/typescript/index.cjs'),
      'module.exports={version:"7.0.2"};',
    );
  } else if (!options.noParser)
    fs.symlinkSync(
      parserRoot,
      path.join(ui, 'node_modules/typescript'),
      'junction',
    );
  if (options.compatParser) {
    const target = path.join(ui, 'node_modules', options.compatParser);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(parserRoot, target, 'junction');
  }
  const pkg = path.join(ui, 'node_modules/@qfei-design/make-ai-assistant');
  const exports = Object.fromEntries(
    ['agent', 'make-app', 'react'].map((n) => [
      './' + n,
      { types: './' + n + '.d.ts', default: './' + n + '.mjs' },
    ]),
  );
  exports['./styles.css'] = { default: './styles.css' };
  write(
    path.join(pkg, 'package.json'),
    JSON.stringify({
      name: '@qfei-design/make-ai-assistant',
      type: 'module',
      version: options.version ?? '0.4.5',
      exports,
    }),
  );
  write(
    path.join(pkg, 'agent.mjs'),
    'export const createAgentClient = ' +
      (options.client ?? '()=>({})') +
      '; export const assertAgentRequest=()=>{};',
  );
  write(
    path.join(pkg, 'make-app.mjs'),
    'export const createMakeAppAssistantTransport=()=>({});',
  );
  write(
    path.join(pkg, 'react.mjs'),
    'export const MakeAppAssistantEntry = ' +
      (options.component ?? '()=>null') +
      ';',
  );
  write(
    path.join(pkg, 'agent.d.ts'),
    options.noTypes
      ? ''
      : 'export declare function createAgentClient(): AgentClient; export declare function assertAgentRequest(): void; export interface AgentAuthenticatedTransport {} export interface AgentHttpRequest {} export type AgentClient=unknown;',
  );
  write(
    path.join(pkg, 'make-app.d.ts'),
    'export declare function createMakeAppAssistantTransport():unknown;',
  );
  write(
    path.join(pkg, 'react.d.ts'),
    'export declare function MakeAppAssistantEntry():unknown; export interface MakeAppAssistantEntryProps {}',
  );
  if (!options.noStyles) write(path.join(pkg, 'styles.css'), '');
}
function check(project, error, script = audit, args = []) {
  const result = spawnSync(
    process.execPath,
    [script, project, '--expected-package-version=0.4.5', ...args],
    { encoding: 'utf8' },
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
  return output;
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
  run('native-parser-with-alias', source, {
    nativeParser: true,
    compatParser: 'typescript-compiler-api',
  });
  run('native-parser-with-official-compat', source, {
    nativeParser: true,
    compatParser: '@typescript/typescript6',
  });
  run(
    'native-parser-without-api',
    source,
    { nativeParser: true },
    'compiler_api_unavailable',
  );
  const explicitParser = path.join(temp, 'explicit-parser');
  fixture(explicitParser, source, { nativeParser: true });
  check(explicitParser, undefined, audit, [
    '--compiler-workspace=' + path.dirname(path.dirname(parserRoot)),
  ]);
  run(
    'named-import-aliases',
    source
      .replace(
        'import {createAgentClient}',
        'import {createAgentClient as buildClient}',
      )
      .replace(
        'import {MakeAppAssistantEntry}',
        'import {MakeAppAssistantEntry as Assistant}',
      )
      .replace('=createAgentClient(', '=buildClient(')
      .replace('<MakeAppAssistantEntry ', '<Assistant '),
  );
  run(
    'namespace-imports',
    source
      .replace('import {createAgentClient}', 'import * as Agent')
      .replace('import {MakeAppAssistantEntry}', 'import * as UI')
      .replace('=createAgentClient(', '=Agent.createAgentClient(')
      .replace('<MakeAppAssistantEntry ', '<UI.MakeAppAssistantEntry '),
  );
  const injectedFactory = source
    .replace(
      'const client=createAgentClient(',
      'function build(factory=createAgentClient){return factory(',
    )
    .replace(
      'transport:bridge});',
      'transport:bridge});}\nconst client=build();',
    );
  run('default-parameter-factory', injectedFactory);
  for (const [name, statement] of [
    ['computed-property-key', 'const metrics={}; metrics[factory.name]=1;'],
    ['property-receiver', 'factory.prototype.metric=1;'],
    [
      'destructuring-computed-key',
      'const metrics={}; ({[factory.name]:metrics.count}=local);',
    ],
    [
      'destructuring-member-target',
      'const metrics={}; [metrics[factory.name]]=local;',
    ],
    ['destructuring-default-read', 'let other; ({other=factory}=local);'],
    ['member-update', 'const metrics={}; metrics[factory.name]++;'],
    [
      'member-loop-target',
      'const metrics={}; for(metrics[factory.name] of local){}',
    ],
    ['var-without-initializer', 'var factory:typeof createAgentClient;'],
    ['var-initializer-read', 'var other=factory;'],
    ['var-renamed-source-property', 'var {factory:other}=local;'],
    ['var-computed-binding-key', 'var {[factory.name]:other}=local;'],
    ['var-default-value-read', 'var {other=factory}=local;'],
    ['block-scoped-variable', '{let factory=localFactory;}'],
    ['nested-function-variable', 'function other(){var factory=localFactory;}'],
    ['let-loop-variable', 'for(let factory of local){}'],
    ['const-loop-variable', 'for(const factory of local){}'],
  ])
    run(
      `default-factory-read-in-${name}`,
      injectedFactory.replace(
        'return factory(',
        `${statement} return factory(`,
      ),
    );
  for (const [name, statement] of [
    ['renamed-property', '({replacement:factory}=local);'],
    ['nested-pattern', '({replacement:[factory]}=local);'],
    ['default-pattern', '({replacement:factory=localFactory}=local);'],
    ['array-rest', '[...factory]=local;'],
    ['object-rest', '({...factory}=local);'],
    ['compound-assignment', 'factory||=localFactory;'],
    ['update', 'factory++;'],
    ['parenthesized-target', '(factory)=localFactory;'],
    ['for-of-target', 'for(factory of local){}'],
    ['for-in-target', 'for(factory in local){}'],
    [
      'computed-key-side-effect',
      'const metrics={}; metrics[(factory=localFactory).name]=1;',
    ],
    [
      'default-value-side-effect',
      'let other; ({other=(factory=localFactory)}=local);',
    ],
    ['var-initializer', 'var factory=localFactory;'],
    ['var-object-binding', 'var {factory}=local;'],
    ['var-renamed-binding', 'var {replacement:factory}=local;'],
    ['var-nested-binding', 'var {replacement:[factory]}=local;'],
    ['var-array-rest', 'var [...factory]=local;'],
    ['var-object-rest', 'var {...factory}=local;'],
    ['var-default-binding', 'var {factory=localFactory}=local;'],
    ['var-for-of', 'for(var factory of local){}'],
    ['var-for-in', 'for(var factory in local){}'],
    ['var-for-of-binding', 'for(var {factory} of local){}'],
    ['var-for-initializer', 'for(var factory=localFactory;false;){}'],
  ])
    run(
      `reassigned-default-factory-in-${name}`,
      injectedFactory.replace(
        'return factory(',
        `${statement} return factory(`,
      ),
      {},
      'agent_client_missing',
    );
  run(
    'default-parameter-import-alias',
    injectedFactory
      .replace(
        'import {createAgentClient}',
        'import {createAgentClient as sdkFactory}',
      )
      .replace('factory=createAgentClient', 'factory=sdkFactory'),
  );
  run(
    'default-parameter-namespace',
    injectedFactory
      .replace('import {createAgentClient}', 'import * as Agent')
      .replace('factory=createAgentClient', 'factory=Agent.createAgentClient'),
  );
  run(
    'unrelated-default-factory',
    injectedFactory.replace(
      'factory=createAgentClient',
      'factory=localFactory',
    ),
    {},
    'agent_client_missing',
  );
  run(
    'unused-default-factory',
    injectedFactory.replace('return factory(', 'return localFactory('),
    {},
    'agent_client_missing',
  );
  run(
    'reassigned-default-factory',
    injectedFactory.replace(
      'return factory(',
      'factory=localFactory; return factory(',
    ),
    {},
    'agent_client_missing',
  );
  run(
    'destructuring-reassigned-default-factory',
    injectedFactory.replace(
      'return factory(',
      '({factory}=local); return factory(',
    ),
    {},
    'agent_client_missing',
  );
  run(
    'shadowed-default-initializer',
    injectedFactory.replace(
      'build(factory=createAgentClient)',
      'build(createAgentClient,factory=createAgentClient)',
    ),
    {},
    'agent_client_missing',
  );
  run(
    'unrelated-client',
    source
      .replace(
        'import {createAgentClient}',
        'import {createAgentClient as unused}',
      )
      .replace(
        'const client=',
        'const createAgentClient=()=>({}); const client=',
      ),
    {},
    'agent_client_missing',
  );
  run(
    'shadowed-client',
    source
      .replace(
        'const client=createAgentClient(',
        'function build(createAgentClient){return createAgentClient(',
      )
      .replace(
        'transport:bridge});',
        'transport:bridge});}\nconst client=build(localFactory);',
      ),
    {},
    'agent_client_missing',
  );
  run(
    'unrelated-entry',
    source
      .replace(
        'import {MakeAppAssistantEntry}',
        'import {MakeAppAssistantEntry as unused}',
      )
      .replace(
        'export const Entry=',
        'const MakeAppAssistantEntry=()=>null; export const Entry=',
      ),
    {},
    'app_entry_missing',
  );
  run(
    'shadowed-namespace',
    source
      .replace('import {MakeAppAssistantEntry}', 'import * as UI')
      .replace(
        'export const Entry=()=> <MakeAppAssistantEntry ',
        'export const Entry=({UI})=> <UI.MakeAppAssistantEntry ',
      ),
    {},
    'app_entry_missing',
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
    'app_entry_missing',
  );
  run(
    'legacy-only',
    source
      .replaceAll('createAgentClient', 'createMakeAgentClient')
      .replaceAll("/agent'", "/client'"),
    {},
    'agent_client_missing',
  );
  run(
    'dispose',
    source.replace('client.dispose()', 'void client'),
    {},
    'client_dispose_missing',
  );
  run(
    'cookie',
    source.replace('credentials:"include"', 'credentials:"omit"'),
    {},
    'session_credentials_missing',
  );
  run(
    'signal',
    source.replace('signal:options.signal', 'ignored:null'),
    {},
    'signal_forwarding_missing',
  );
  run(
    'missing-service-prefix',
    source.replace('/api/make/app/agent/v1', '/api/make/agent/v1'),
    {},
    'service_base_path_missing',
  );
  run(
    'version-path',
    source.replace('/agent/v1', '/agent/v1/v1'),
    {},
    'invalid_agent_base_path',
  );
  run(
    'id',
    source + 'const agentId=import.meta.env.VITE_AGENT_ID;',
    {},
    'agent_id_external_source',
  );
  run(
    'internal',
    source + "import '@qfei-design/make-ai-assistant/dist/private';",
    {},
    'internal_import',
  );
  run(
    'origin',
    source + 'const endpoint="https://foreign.invalid/api/make/app/agent/v1";',
    {},
    'hardcoded_assistant_origin',
  );
  const installed = run('installed-技能 path');
  for (const agentDir of ['.agents', '.codex']) {
    const copy = path.join(
      installed,
      agentDir,
      'skills/make-ai-assistant/scripts',
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
    source.replace('<MakeAppAssistantEntry ', '<OtherEntry '),
  );
  check(one, 'app_entry_missing');
  const service = run('service-consumer'),
    dir = path.join(service, 'apps/service');
  fs.cpSync(path.join(service, 'apps/ui'), dir, { recursive: true });
  write(
    path.join(dir, 'src/entry.tsx'),
    "import {assertAgentRequest} from '@qfei-design/make-ai-assistant/agent';assertAgentRequest(operation,body);",
  );
  check(service);
  const runtimeImport =
    "import {assertAgentRequest} from '@qfei-design/make-ai-assistant/agent';export const validate=(operation,body)=>assertAgentRequest(operation,body);";
  const typeImport =
    "import type {AgentClient} from '@qfei-design/make-ai-assistant/agent';export type Client=AgentClient;";
  const sdkDependency = { '@qfei-design/make-ai-assistant': '0.4.5' };
  function serviceDependency(name, code, groups, error, options = {}) {
    const project = path.join(temp, name);
    fixture(project, code, options);
    const from = path.join(project, 'apps/ui');
    const target = path.join(project, 'apps/service');
    fs.renameSync(from, target);
    write(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'service', ...groups }),
    );
    check(project, error);
  }
  serviceDependency(
    'runtime-dev-only',
    runtimeImport,
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'runtime-peer-only',
    runtimeImport,
    { peerDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'runtime-production',
    runtimeImport,
    { dependencies: sdkDependency },
    undefined,
    { noParser: true },
  );
  serviceDependency('type-dev-only', typeImport, {
    devDependencies: sdkDependency,
  });
  serviceDependency('type-peer-only', typeImport, {
    peerDependencies: sdkDependency,
  });
  serviceDependency(
    'inline-type-only',
    "import {type AgentClient} from '@qfei-design/make-ai-assistant/agent';export type Client=AgentClient;",
    { devDependencies: sdkDependency },
  );
  serviceDependency(
    'type-reexport-only',
    "export type {AgentClient} from '@qfei-design/make-ai-assistant/agent';",
    { devDependencies: sdkDependency },
  );
  serviceDependency(
    'mixed-type-runtime',
    "import {type AgentClient,assertAgentRequest} from '@qfei-design/make-ai-assistant/agent';export const validate=assertAgentRequest;",
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'runtime-reexport',
    "export {assertAgentRequest} from '@qfei-design/make-ai-assistant/agent';",
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'dynamic-runtime-import',
    typeImport +
      "export const load=()=>import('@qfei-design/make-ai-assistant/agent');",
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'commonjs-runtime-import',
    typeImport +
      "const sdk=require('@qfei-design/make-ai-assistant/agent');export const validate=sdk.assertAgentRequest;",
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'commonjs-runtime-resolve',
    typeImport +
      "export const entry=require.resolve('@qfei-design/make-ai-assistant/agent');",
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'unproven-type-without-parser',
    typeImport,
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
    { noParser: true },
  );
  serviceDependency(
    'namespace-type-only',
    "import type * as Agent from '@qfei-design/make-ai-assistant/agent';export type Client=Agent.AgentClient;",
    { devDependencies: sdkDependency },
  );
  serviceDependency(
    'inline-type-reexport-only',
    "export {type AgentClient} from '@qfei-design/make-ai-assistant/agent';",
    { devDependencies: sdkDependency },
  );
  serviceDependency(
    'import-type-query-only',
    "export type Client=import('@qfei-design/make-ai-assistant/agent').AgentClient;",
    { devDependencies: sdkDependency },
  );
  serviceDependency(
    'side-effect-runtime-import',
    "import '@qfei-design/make-ai-assistant/agent';",
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'variable-dynamic-runtime-import',
    typeImport +
      "const moduleName='@qfei-design/make-ai-assistant/agent';export const load=()=>import(moduleName);",
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  const reactTypeImport =
    "import type {MakeAppAssistantEntryProps} from '@qfei-design/make-ai-assistant/react';export type Props=MakeAppAssistantEntryProps;";
  for (const [name, code] of [
    ['import', reactTypeImport],
    [
      'inline-import',
      "import {type MakeAppAssistantEntryProps} from '@qfei-design/make-ai-assistant/react';export type Props=MakeAppAssistantEntryProps;",
    ],
    [
      'namespace',
      "import type * as UI from '@qfei-design/make-ai-assistant/react';export type Props=UI.MakeAppAssistantEntryProps;",
    ],
    [
      'export',
      "export type {MakeAppAssistantEntryProps} from '@qfei-design/make-ai-assistant/react';",
    ],
    [
      'inline-export',
      "export {type MakeAppAssistantEntryProps} from '@qfei-design/make-ai-assistant/react';",
    ],
    [
      'query',
      "export type Props=import('@qfei-design/make-ai-assistant/react').MakeAppAssistantEntryProps;",
    ],
  ]) {
    serviceDependency('react-type-only-' + name, code, {
      devDependencies: sdkDependency,
    });
  }
  serviceDependency('react-type-peer-only', reactTypeImport, {
    peerDependencies: sdkDependency,
  });
  serviceDependency(
    'service-runtime-with-react-types',
    runtimeImport + reactTypeImport,
    { dependencies: sdkDependency },
  );
  serviceDependency(
    'react-type-without-parser',
    reactTypeImport,
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
    { noParser: true },
  );
  serviceDependency(
    'react-types-do-not-exempt-runtime-dependency',
    runtimeImport + reactTypeImport,
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing',
  );
  serviceDependency(
    'react-mixed-runtime-still-needs-ui',
    "import {type MakeAppAssistantEntryProps,MakeAppAssistantEntry} from '@qfei-design/make-ai-assistant/react';export const Entry=MakeAppAssistantEntry;",
    { dependencies: sdkDependency },
    'agent_client_missing',
  );
  serviceDependency(
    'react-dynamic-runtime-still-needs-ui',
    reactTypeImport +
      "export const load=()=>import('@qfei-design/make-ai-assistant/react');",
    { dependencies: sdkDependency },
    'agent_client_missing',
  );
  run(
    'react-comment-does-not-prove-type-only',
    "// import type {MakeAppAssistantEntryProps} from '@qfei-design/make-ai-assistant/react';\nexport const ready=true;",
    {},
    'package_missing',
  );
  // 每个文件只归属最近的 manifest，父子 workspace 各自满足门禁。
  const nested = path.join(temp, 'nested-type-runtime-workspaces');
  fixture(nested, typeImport, { workspace: 'packages/contracts' });
  write(
    path.join(nested, 'packages/contracts/package.json'),
    JSON.stringify({ devDependencies: sdkDependency }),
  );
  fixture(nested, runtimeImport, {
    workspace: 'packages/contracts/packages/worker',
    noParser: true,
  });
  check(nested);
  write(
    path.join(nested, 'packages/contracts/packages/worker/package.json'),
    JSON.stringify({ devDependencies: sdkDependency }),
  );
  check(
    nested,
    'consumer_runtime_dependency_missing: packages/contracts/packages/worker/package.json',
  );
  const nestedUi = path.join(temp, 'nested-service-ui-workspaces');
  fixture(nestedUi, runtimeImport, {
    workspace: 'packages/service',
    noParser: true,
  });
  fixture(nestedUi, source, { workspace: 'packages/service/ui' });
  check(nestedUi);
  const nestedBindings = path.join(temp, 'nested-ui-binding-isolation');
  fixture(
    nestedBindings,
    source.replace('<MakeAppAssistantEntry ', '<OtherEntry '),
    { workspace: 'packages/shell' },
  );
  fixture(nestedBindings, source, { workspace: 'packages/shell/child-ui' });
  check(nestedBindings, 'app_entry_missing: packages/shell/package.json');
  function pairedDependency(name, code, groups, error, options = {}) {
    const project = path.join(temp, name);
    fixture(project);
    fixture(project, code, { ...options, workspace: 'apps/service' });
    write(
      path.join(project, 'apps/service/package.json'),
      JSON.stringify({ name: 'service', ...groups }),
    );
    check(project, error);
  }
  for (const [name, code] of [
    [
      'backtick-agent',
      'export const load=()=>import(`@qfei-design/make-ai-assistant/agent`);',
    ],
    [
      'make-app-entry',
      "import {createMakeAppAssistantTransport} from '@qfei-design/make-ai-assistant/make-app';export const factory=createMakeAppAssistantTransport;",
    ],
    [
      'root-entry',
      "import * as SDK from '@qfei-design/make-ai-assistant';export const sdk=SDK;",
    ],
  ]) {
    pairedDependency(
      name + '-dev-only',
      code,
      { devDependencies: sdkDependency },
      'consumer_runtime_dependency_missing: apps/service/package.json',
    );
    pairedDependency(
      name + '-peer-only',
      code,
      { peerDependencies: sdkDependency },
      'consumer_runtime_dependency_missing: apps/service/package.json',
    );
    pairedDependency(
      name + '-production-without-parser',
      code,
      { dependencies: sdkDependency },
      undefined,
      { noParser: true },
    );
    pairedDependency(
      name + '-undeclared',
      code,
      {},
      'consumer_dependency_missing: apps/service/src/entry.tsx',
    );
  }
  pairedDependency(
    'root-type-reference-with-ui',
    "import type {MakeAssistantHostContext} from '@qfei-design/make-ai-assistant';export type Context=MakeAssistantHostContext;",
    { devDependencies: sdkDependency },
  );
  pairedDependency(
    'make-app-type-reference-with-ui',
    "export type Factory=typeof import('@qfei-design/make-ai-assistant/make-app').createMakeAppAssistantTransport;",
    { devDependencies: sdkDependency },
  );
  pairedDependency(
    'computed-subpath-does-not-prove-type-only',
    typeImport +
      'export const load=(subpath)=>import(`@qfei-design/make-ai-assistant/${subpath}`);',
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing: apps/service/package.json',
  );
  pairedDependency(
    'computed-root-consumer-is-not-skipped',
    'export const load=(suffix)=>import(`@qfei-design/make-ai-assistant${suffix}`);',
    { devDependencies: sdkDependency },
    'consumer_runtime_dependency_missing: apps/service/package.json',
  );
  pairedDependency(
    'comment-only-workspace-is-not-a-consumer',
    "// import type {AgentClient} from '@qfei-design/make-ai-assistant/agent';\nexport const ready=true;",
    { devDependencies: sdkDependency },
  );
  pairedDependency(
    'different-package-prefix-is-not-a-consumer',
    "import * as other from '@qfei-design/make-ai-assistant-extra/agent';export const sdk=other;",
    {},
  );
  pairedDependency(
    'backtick-react-runtime',
    'export const load=()=>import(`@qfei-design/make-ai-assistant/react`);',
    { dependencies: sdkDependency },
    'agent_client_missing: apps/service/package.json',
  );
  serviceDependency(
    'make-app-standalone-consumer',
    "import {createMakeAppAssistantTransport} from '@qfei-design/make-ai-assistant/make-app';export const factory=createMakeAppAssistantTransport;",
    { dependencies: sdkDependency },
    undefined,
    { noParser: true },
  );
  serviceDependency(
    'legacy-only-does-not-prove-agent-integration',
    "import * as Legacy from '@qfei-design/make-ai-assistant/client';export const sdk=Legacy;",
    { dependencies: sdkDependency },
    'package_missing',
  );
  serviceDependency(
    'root-types-only-do-not-prove-agent-integration',
    "import type {MakeAssistantHostContext} from '@qfei-design/make-ai-assistant';export type Context=MakeAssistantHostContext;",
    { devDependencies: sdkDependency },
    'package_missing',
  );
  run(
    'backtick-private-entry',
    source +
      '\nexport const load=()=>import(`@qfei-design/make-ai-assistant/internal`);',
    {},
    'internal_import',
  );
  const legacyBacktick = path.join(temp, 'retained-backtick-legacy');
  fixture(
    legacyBacktick,
    source +
      '\nexport const load=()=>import(`@qfei-design/make-ai-assistant/client`);',
  );
  assert.match(check(legacyBacktick), /REVIEW: .*legacy API present/);
  run(
    'retained-legacy',
    source +
      "import type {Client} from '@qfei-design/make-ai-assistant/client';",
  );
  console.log(
    'make-ai-assistant project audit tests: PASS (' + cases + ' cases)',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
