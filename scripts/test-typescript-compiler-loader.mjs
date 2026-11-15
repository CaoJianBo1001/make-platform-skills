#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';

const skills = ['make-ai-assistant', 'make-app-auth', 'make-app-observability'];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'compiler-tools-独立 '));
after(() => fs.rmSync(temp, { recursive: true, force: true }));
const urls = skills.map(
  (skill) =>
    new URL(
      `../skills/${skill}/scripts/load-typescript-compiler.mjs`,
      import.meta.url,
    ),
);
const compiler = Object.freeze({
  version: '6.0.3',
  createProgram() {},
  forEachChild() {},
  JsxEmit: Object.freeze({ Preserve: 0 }),
});
const options = {
  requiredFunctions: ['createProgram', 'forEachChild'],
  requiredEnums: ['JsxEmit.Preserve'],
};
const resolve = (modules) => (name) => {
  if (name in modules) return modules[name];
  const error = new Error('private load diagnostic');
  error.code = 'MODULE_NOT_FOUND';
  throw error;
};

test('three independent Skills ship the same standalone compiler loader', () => {
  const copies = urls.map((url) => fs.readFileSync(url, 'utf8'));
  for (const copy of copies) assert.equal(copy, copies[0]);
});

test('runtime auth handoff agrees with the owning Skill dependency bundle', () => {
  const runtimeUrl = new URL(
    '../skills/make-app-runtime/SKILL.md',
    import.meta.url,
  );
  const runtime = fs.readFileSync(runtimeUrl, 'utf8');
  const handoff = runtime
    .split('\n')
    .find((line) => line.startsWith('For the auth gate,'));
  assert.ok(
    handoff,
    'runtime must hand off its auth gate dependency ownership',
  );
  const link = handoff.match(/\[[^\]]+\]\(([^)]+)#project-local-audit\)/)?.[1];
  assert.ok(link, 'handoff must link to the owner copy procedure');
  const owner = fs.readFileSync(new URL(link, runtimeUrl), 'utf8');
  const section = owner.split('## Project-local audit\n')[1]?.split('\n## ')[0];
  assert.ok(section, 'owner must publish its audit copy procedure');
  const files = [
    ...section.matchAll(/^\| `(scripts\/[^`]+)` \| `(scripts\/[^`]+)` \|$/gm),
  ];
  assert.ok(files.length > 0);
  const declaredCount = /\bfile pair\b|\bboth files\b|\btwo files\b/.test(
    handoff,
  )
    ? 2
    : null;
  assert.ok(
    declaredCount === null || declaredCount === files.length,
    `runtime declares ${declaredCount} files but the auth owner requires ${files.length}`,
  );
});

for (const [index, skill] of skills.entries()) {
  const load = async (config) =>
    (await import(urls[index])).loadTypeScriptCompiler('.', {
      ...options,
      ...config,
    });
  test(`${skill}: package version and API version remain independent`, async () => {
    const loaded = await load({
      requireImpl: resolve({
        typescript: compiler,
        'typescript/package.json': { version: '6.0.2' },
      }),
    });
    assert.equal(loaded.compiler, compiler);
    assert.equal(loaded.name, 'typescript');
    assert.equal(loaded.version, '6.0.2');
    assert.equal(loaded.apiVersion, '6.0.3');
  });
  test(`${skill}: native and missing primary entries use either official compatibility name`, async () => {
    for (const name of ['@typescript/typescript6', 'typescript-compiler-api']) {
      for (const primary of [{ typescript: { version: '7.0.2' } }, {}]) {
        const loaded = await load({
          requireImpl: resolve({
            ...primary,
            [name]: compiler,
            [name + '/package.json']: { version: '6.0.2' },
          }),
        });
        assert.equal(loaded.name, name);
        assert.equal(loaded.compiler, compiler);
      }
    }
  });
  test(`${skill}: missing required function or enum cannot pass capability checking`, async () => {
    for (const primary of [
      { ...compiler, forEachChild: undefined },
      { ...compiler, JsxEmit: undefined },
    ]) {
      const loaded = await load({
        requireImpl: resolve({
          typescript: primary,
          'typescript-compiler-api': compiler,
        }),
      });
      assert.equal(loaded.name, 'typescript-compiler-api');
    }
  });
  test(`${skill}: unavailable API fails clearly without disclosing module diagnostics`, async () => {
    await assert.rejects(
      load({ requireImpl: resolve({ typescript: { version: '7.0.2' } }) }),
      (error) => {
        assert.equal(error.code, 'compiler_api_unavailable');
        assert.doesNotMatch(error.message, /private load diagnostic|TypeError/);
        return true;
      },
    );
  });
  test(`${skill}: absent manifest is unknown and never replaced with the API version`, async () => {
    const loaded = await load({
      requireImpl: resolve({ typescript: compiler }),
    });
    assert.equal(loaded.version, 'unknown');
    assert.equal(loaded.apiVersion, '6.0.3');
  });
  test(`${skill}: explicit tooling directory must exist and must not fall back`, async () => {
    const { loadTypeScriptCompiler } = await import(urls[index]);
    assert.throws(
      () =>
        loadTypeScriptCompiler('.', {
          ...options,
          compilerWorkspace: path.join(temp, 'missing'),
          requireImpl: resolve({ typescript: compiler }),
        }),
      /compiler_api_unavailable/,
    );
    assert.throws(
      () =>
        loadTypeScriptCompiler('.', { ...options, compilerWorkspace: temp }),
      /compiler_api_unavailable/,
    );
  });
}

for (const [skill, document, script, args, expectedCode, expectedOutput] of [
  [
    'make-app-auth',
    'SKILL.md',
    'audit-auth-contract.mjs',
    ['--help'],
    0,
    /Usage:/,
  ],
  [
    'make-app-observability',
    'references/error-outlet-migration.md',
    'audit-error-outlets.mjs',
    [temp],
    2,
    /request_error_ui_missing/,
  ],
]) {
  test(`${skill}: the documented copy bundle loads without its source Skill`, () => {
    const skillRoot = new URL(`../skills/${skill}/`, import.meta.url);
    const guide = fs.readFileSync(new URL(document, skillRoot), 'utf8');
    const files = [
      ...guide.matchAll(/^\| `(scripts\/[^`]+)` \| `(scripts\/[^`]+)` \|$/gm),
    ];
    assert.ok(
      files.length > 0,
      'document the complete source/target copy bundle',
    );
    const workspace = path.join(temp, skill, '独立 App 工具');
    for (const [, source, target] of files) {
      const file = path.join(workspace, target);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.copyFileSync(new URL(source, skillRoot), file);
    }
    const result = spawnSync(
      process.execPath,
      [path.join(workspace, 'scripts', script), ...args],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, expectedCode, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, expectedOutput);
    assert.doesNotMatch(result.stdout + result.stderr, /ERR_MODULE_NOT_FOUND/);
  });
}
