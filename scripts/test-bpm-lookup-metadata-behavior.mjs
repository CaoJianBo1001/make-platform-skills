import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveBpmLookupDependencies } from '../skills/make-app-approval/assets/bpm-lookup-metadata.mjs';
import { verifyBpmLookupMetadata } from '../skills/make-app-approval/scripts/verify-bpm-lookup-metadata.mjs';
const result = await verifyBpmLookupMetadata(resolveBpmLookupDependencies);
assert.ok(result.passed >= 25);
for (const mutate of [
  rows => rows.map(row => ({ ...row, multiple: false })),
  rows => rows.map(row => ({ ...row, targetEntityKey: 'guessed' })),
  rows => rows.map(row => ({ ...row, targetFieldType: 'Make.Field.Text' })),
]) await assert.rejects(verifyBpmLookupMetadata((data, keys) => mutate(resolveBpmLookupDependencies(data, keys))));
const temp = mkdtempSync(path.join(tmpdir(), 'bpm-lookup-skill-'));
try {
  cpSync(new URL('../skills/make-app-approval', import.meta.url), path.join(temp, 'skill'), { recursive: true });
  const script = path.join(temp, 'skill/scripts/verify-bpm-lookup-metadata.mjs');
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: temp, encoding: 'utf8' });
  assert.equal(run([]).status, 0);
  const adapter = path.join(temp, 'adapter.mjs');
  writeFileSync(adapter, "export { resolveBpmLookupDependencies } from './skill/assets/bpm-lookup-metadata.mjs';");
  assert.equal(run([adapter]).status, 0);
  writeFileSync(adapter, 'export const resolveBpmLookupDependencies = () => [];');
  assert.equal(run([adapter]).status, 1);
} finally { rmSync(temp, { recursive: true, force: true }); }
console.log(`PASS：${result.passed} 项 Lookup 依赖、3 项故障注入及独立随包/宿主适配验证`);
