#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadAgentCompiler } from './load-agent-compiler.mjs';
const workspace =
  process.argv[2] ?? process.env.MAKE_SKILL_TEST_DEPENDENCIES ?? '.';
const loaded = loadAgentCompiler(workspace);
const { compiler } = loaded;
assert.throws(
  () =>
    loadAgentCompiler(workspace, {
      compilerWorkspace: path.join(
        workspace,
        '__missing_agent_tooling_directory__',
      ),
    }),
  /compiler_api_unavailable/,
);
let cases = 1;
function resolve(modules) {
  return (name) => {
    if (name in modules) return modules[name];
    const error = new Error('missing');
    error.code = 'MODULE_NOT_FOUND';
    throw error;
  };
}
const native = { version: '7.0.2' };
const versioned = loadAgentCompiler('.', {
  requireImpl: resolve({
    typescript: native,
    '@typescript/typescript6': { ...compiler, version: '6.0.3' },
    '@typescript/typescript6/package.json': { version: '6.0.2' },
  }),
});
assert.equal(
  versioned.version,
  '6.0.2',
  'report the installed package version',
);
assert.equal(
  versioned.apiVersion,
  '6.0.3',
  'retain the independent API version',
);
const unknownManifest = loadAgentCompiler('.', {
  requireImpl: resolve({ typescript: compiler }),
});
assert.equal(
  unknownManifest.version,
  'unknown',
  'do not invent a package version',
);
assert.equal(unknownManifest.apiVersion, compiler.version);
cases += 2;
for (const purpose of ['audit', 'example']) {
  for (const modules of [
    { typescript: compiler },
    { typescript: native, '@typescript/typescript6': compiler },
    { typescript: native, 'typescript-compiler-api': compiler },
    { '@typescript/typescript6': compiler },
    {
      typescript: { ...compiler, ScriptTarget: undefined },
      'typescript-compiler-api': compiler,
    },
  ]) {
    assert.equal(
      loadAgentCompiler('.', { purpose, requireImpl: resolve(modules) })
        .compiler,
      compiler,
    );
    cases++;
  }
  assert.throws(
    () =>
      loadAgentCompiler('.', {
        purpose,
        requireImpl: resolve({ typescript: native }),
      }),
    (error) =>
      error.code === 'compiler_api_unavailable' &&
      error.message.includes('missing'),
  );
  cases++;
}
assert.throws(
  () =>
    loadAgentCompiler('.', {
      requireImpl: resolve({
        typescript: { ...compiler, isIdentifier: undefined },
      }),
    }),
  /compiler_api_unavailable/,
);
cases++;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-compiler-兼容 '));
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-no-compiler-'));
const scripts = path.dirname(fileURLToPath(import.meta.url));
try {
  const pkg = path.join(temp, 'node_modules/typescript');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify({ name: 'typescript', main: 'index.cjs' }),
  );
  fs.writeFileSync(
    path.join(pkg, 'index.cjs'),
    'module.exports={version:"7.0.2"};',
  );
  const result = spawnSync(
    process.execPath,
    [path.join(scripts, 'verify-host-example.mjs'), temp],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compiler_api_unavailable/);
  assert.doesNotMatch(result.stderr, /TypeError/);
  cases++;
  const require = createRequire(
    path.resolve(workspace, '__compiler_test__.cjs'),
  );
  const compatible = path.dirname(
    require.resolve(loaded.name + '/package.json'),
  );
  const target = path.join(temp, 'node_modules/@typescript/typescript6');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(compatible, target, 'junction');
  assert.equal(
    loadAgentCompiler(temp, { purpose: 'example' }).compiler,
    compiler,
  );
  cases++;
  assert.throws(
    () => loadAgentCompiler(workspace, { compilerWorkspace: empty }),
    /compiler_api_unavailable/,
  );
  cases++;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
  fs.rmSync(empty, { recursive: true, force: true });
}
console.log(`Agent compiler capability tests: PASS (${cases} cases)`);
