import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeBpmFormMetadata } from '../skills/make-app-approval/assets/bpm-form-metadata.mjs';
import { verifyFormMetadata } from '../skills/make-app-approval/scripts/verify-form-metadata.mjs';

const result = await verifyFormMetadata(normalizeBpmFormMetadata);
assert.ok(result.passed >= 62);

// 文档中的原始/规范化 JSON 也穿过真实转换器，避免样例与代码漂移。
const reference = readFileSync(new URL('../skills/make-app-approval/references/form-metadata.md', import.meta.url), 'utf8');
const [rawExample, normalizedExample] = [...reference.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
const fixture = JSON.parse(readFileSync(new URL('../skills/make-app-approval/scripts/fixtures/form-metadata.json', import.meta.url), 'utf8'));
assert.deepEqual(normalizeBpmFormMetadata({ ...fixture.response.data.formMetadata, fields: [rawExample] }, fixture.expected).fields[0], normalizedExample);

// 故障注入：证明验证器能发现错误转换、静默丢配置、定位未检查等真实回归。
for (const mutate of [
  result => ({ ...result, fields: result.fields.map(field => ({ ...field, type: 'Make.Field.Text' })) }),
  result => ({ ...result, fields: result.fields.map(({ validations, ...field }) => field) }),
  result => ({ ...result, fields: result.fields.map(({ capabilities, ...field }) => field) }),
  result => ({ ...result, fields: result.fields.map(field => ({ ...field, properties: {} })) }),
]) {
  await assert.rejects(verifyFormMetadata((data, expected) => mutate(normalizeBpmFormMetadata(data, expected))));
}
await assert.rejects(verifyFormMetadata((data, expected) => normalizeBpmFormMetadata(data, {
  ...expected, appKey: data.appKey, entityKey: data.entityKey, processKey: data.processKey, nodeKey: data.nodeKey,
})));
// 单独复制 Skill 后仍可运行，并验证宿主桥接入口及失败退出码。
const temp = mkdtempSync(path.join(tmpdir(), 'bpm-node-metadata-skill-'));
try {
  cpSync(new URL('../skills/make-app-approval', import.meta.url), path.join(temp, 'skill'), { recursive: true });
  const script = path.join(temp, 'skill/scripts/verify-form-metadata.mjs');
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: temp, encoding: 'utf8' });
  assert.equal(run([]).status, 0);
  const bridge = path.join(temp, 'host-adapter.mjs');
  writeFileSync(bridge, "export { normalizeBpmFormMetadata } from './skill/assets/bpm-form-metadata.mjs';\n");
  assert.equal(run([bridge]).status, 0);
  writeFileSync(bridge, 'export const normalizeBpmFormMetadata = data => data;\n');
  const failed = run([bridge]);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /节点元数据契约未通过/);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log(`PASS：${result.passed} 项节点元数据行为、5 项故障注入、文档样例及独立随包/宿主桥接验证`);
