import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as metadata from '../skills/make-app-approval/assets/bpm-lookup-metadata.mjs';
import { verifyBpmStartMetadata } from '../skills/make-app-approval/scripts/verify-bpm-start-metadata.mjs';

const result = await verifyBpmStartMetadata(metadata.canReuseBpmStartMetadata);
assert.ok(result.passed >= 19);
for (const mutant of [() => true, () => false, data => Array.isArray(data?.fields)]) {
  await assert.rejects(verifyBpmStartMetadata(mutant));
}
const temp = mkdtempSync(path.join(tmpdir(), 'bpm-start-skill-'));
try {
  cpSync(new URL('../skills/make-app-approval', import.meta.url), path.join(temp, 'skill'), { recursive: true });
  const script = path.join(temp, 'skill/scripts/verify-bpm-start-metadata.mjs');
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: temp, encoding: 'utf8' });
  assert.equal(run([]).status, 0);
  const adapter = path.join(temp, 'adapter.mjs');
  writeFileSync(adapter, "export { canReuseBpmStartMetadata } from './skill/assets/bpm-lookup-metadata.mjs';");
  assert.equal(run([adapter]).status, 0);
  writeFileSync(adapter, 'export const canReuseBpmStartMetadata = () => true;');
  assert.equal(run([adapter]).status, 1);
} finally { rmSync(temp, { recursive: true, force: true }); }
console.log(`PASS：${result.passed} 项 START 完整性、3 项故障注入及独立随包/宿主桥接验证`);
