import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./verify-feedback-package-surface.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const withPackage = (changes, check) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-surface-test-'));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: '@qfei-design/make-app-feedback', version: '0.1.0', ...changes }));
  try { check(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
};

test('help documents the local prerelease boundary', () => {
  const result = run('--help');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--allow-prerelease/u);
});
test('a missing install is a package readiness failure', () => {
  const result = run(path.join(os.tmpdir(), 'feedback-package-does-not-exist'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_package_unavailable/u);
});
test('the package name must match the requested dependency', () => withPackage({ name: '@other/feedback' }, directory => {
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_package_name_mismatch/u);
}));
test('prerelease requires an explicit local-test opt-in', () => withPackage({ version: '0.1.0-alpha.0' }, directory => {
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_prerelease_requires_opt_in/u);
}));
test('an opted-in prerelease still requires actual public exports', () => withPackage({ version: '0.1.0-alpha.0' }, directory => {
  const result = run(directory, '--allow-prerelease');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_public_export_missing/u);
}));
test('a missing CSS export is not hidden by an existing JS export', () => withPackage({ exports: { '.': { import: './index.mjs', require: './index.cjs', types: './index.d.ts' } } }, directory => {
  fs.writeFileSync(path.join(directory, 'index.mjs'), 'export const PermissionFeedback = () => null;');
  fs.writeFileSync(path.join(directory, 'index.cjs'), 'exports.PermissionFeedback = () => null;');
  fs.writeFileSync(path.join(directory, 'index.d.ts'), 'export declare function PermissionFeedback(): null;');
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_css_export_missing/u);
}));
test('a public export cannot escape the installed package', () => withPackage({ exports: { '.': { import: '../outside.mjs', require: './index.cjs', types: './index.d.ts' } } }, directory => {
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_export_outside_package/u);
}));
