#!/usr/bin/env node
// 编译实际文档示例与正式包类型，避免只检查文案或重写另一份示例。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadAgentCompiler } from './load-agent-compiler.mjs';
const workspace = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(
  workspace,
  'usage: node verify-host-example.mjs <consumer-workspace>',
);
const args = process.argv.slice(3);
assert.ok(
  args.length <= 1 &&
    args.every(
      (arg) =>
        arg.startsWith('--compiler-workspace=') &&
        arg.slice('--compiler-workspace='.length),
    ),
  'usage: node verify-host-example.mjs <consumer-workspace> [--compiler-workspace=<tooling-workspace>]',
);
let ts;
try {
  const loaded = loadAgentCompiler(workspace, {
    purpose: 'example',
    compilerWorkspace: args[0]?.slice('--compiler-workspace='.length),
  });
  ts = loaded.compiler;
  console.log(
    `Agent example compiler API: ${loaded.name}@${loaded.version} (API ${loaded.apiVersion})`,
  );
} catch (error) {
  console.error('Agent documented host example: FAIL', error.message);
  process.exit(1);
}
const guide = fs.readFileSync(
  new URL('../references/make-app-host-integration.md', import.meta.url),
  'utf8',
);
const example = guide.match(/```tsx\n([\s\S]*?)\n```/u)?.[1];
assert.ok(example, 'public host example is missing');
const declarations = `
import type { AgentClient } from "@qfei-design/make-ai-assistant/agent";
declare const client: AgentClient;
declare const appId: string, appName: string, pathname: string, assistantTitle: string;
declare const entityKey: string | undefined, recordId: string | undefined;
declare const assistantOpen: boolean;
declare const setAssistantOpen: (next: boolean) => void;
`;
const file = path.join(workspace, '__agent_skill_example__.tsx');
const content = declarations + example;
const options = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
};
const host = ts.createCompilerHost(options);
const original = host.getSourceFile.bind(host);
host.getSourceFile = (name, languageVersion, ...args) =>
  name === file
    ? ts.createSourceFile(file, content, languageVersion, true)
    : original(name, languageVersion, ...args);
const errors = ts.getPreEmitDiagnostics(
  ts.createProgram([file], options, host),
);
assert.deepEqual(
  errors.map(
    (e) =>
      'TS' +
      e.code +
      ': ' +
      ts.flattenDiagnosticMessageText(e.messageText, '\n'),
  ),
  [],
);
console.log('Agent documented host example: TYPECHECK PASS');
