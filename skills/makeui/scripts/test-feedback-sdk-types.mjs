import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const compiler = process.argv[2];
assert.ok(compiler, 'Usage: node test-feedback-sdk-types.mjs <typescript/bin/tsc>');
const compilerPath = fs.realpathSync(compiler);
const require = createRequire(compilerPath);
const ts = require('../lib/typescript.js');
const guide = fs.readFileSync(new URL('../references/permission-feedback.md', import.meta.url), 'utf8');
const authGuide = fs.readFileSync(new URL('../../make-app-auth/references/access-help.md', import.meta.url), 'utf8');
const example = guide.match(/```tsx\n(import \{ useEffect, useState \}[\s\S]*?)\n```/u)?.[1];
const capability = authGuide.match(/```js\n([\s\S]*?)\n```/u)?.[1];
assert.ok(example && capability, 'compile the documented adapter and capability check');

// Structural fixtures isolate optional SDK capability from React/npm release verification.
const dependencies = `
declare namespace JSX { interface Element {} }
declare module 'react' {
  export function useState<T>(): [T | undefined, (value: T) => void];
  export function useEffect(effect: () => void | (() => void), deps: readonly unknown[]): void;
}
declare module '@qfei-design/make-app-observability/react' {
  export type MakeAppAdministratorContact = { userId: string; name: string; avatarUrl?: string };
  export type MakeAppAdministratorStatus = 'ready' | 'loading' | 'error';
  export type MakeAppPermissionNoticeProps = {
    variant?: 'page' | 'inline' | 'toast'; scope?: 'app' | 'resource' | 'operation';
    retryStatus?: 'idle' | 'checking' | 'denied' | 'error' | 'restored';
    administrators?: readonly MakeAppAdministratorContact[]; administratorStatus?: MakeAppAdministratorStatus;
  };
  export function MakeAppPermissionNotice(props: MakeAppPermissionNoticeProps): JSX.Element;
}
declare module '@qfeius/make-app-auth' {
  export interface MakeAppAuthClient {
    api: { request(path: string): Promise<unknown> };
    init(): Promise<unknown>;
    OPTIONAL_CONTACT_METHOD
  }
  export function createMakeAppAuth(): MakeAppAuthClient;
}`;
const probe = `
import { createMakeAppAuth } from '@qfeius/make-app-auth';
const auth = createMakeAppAuth();
${capability}
export const feedback = <AppPermissionFeedback auth={auth} contextKey="fixture" scope="resource" />;
`;

function check(hasContactMethod, source = example, guard = capability) {
  const root = path.resolve('feedback-type-fixture');
  const file = path.join(root, 'adapter.tsx');
  const types = path.join(root, 'dependencies.d.ts');
  const contactMethod = hasContactMethod
    ? 'getAppAdministrators(): Promise<Array<{ userId: string; name: string; avatarUrl?: string | null }>>;'
    : '';
  const files = new Map([
    [file, `${source}\n${probe.replace(capability, guard)}`],
    [types, dependencies.replace('OPTIONAL_CONTACT_METHOD', contactMethod)],
  ]);
  const options = { strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(options);
  const fallbackSource = host.getSourceFile.bind(host);
  const fallbackExists = host.fileExists.bind(host);
  host.fileExists = filename => files.has(filename) || fallbackExists(filename);
  host.getSourceFile = (filename, languageVersion, ...args) => files.has(filename)
    ? ts.createSourceFile(filename, files.get(filename), languageVersion, true)
    : fallbackSource(filename, languageVersion, ...args);
  return ts.getPreEmitDiagnostics(ts.createProgram([file, types], options, host));
}

for (const hasContactMethod of [false, true]) {
  test(`documented adapter compiles with ${hasContactMethod ? 'new' : 'old'} SDK capability`, () => {
    const errors = check(hasContactMethod);
    assert.deepEqual(errors.map(error => `TS${error.code}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`), []);
  });
}

test('the compiler catches direct new-method access through an old SDK declaration', () => {
  assert.ok(check(false, example, "const canLoadContacts = typeof auth.getAppAdministrators === 'function';")
    .some(error => error.code === 2339));
});

test('the compiler catches an optional-only weak adapter type', () => {
  const weak = example.replace('type AdministratorApi = { api: unknown;', 'type AdministratorApi = {');
  assert.ok(check(false, weak).some(error => error.code === 2559));
});
