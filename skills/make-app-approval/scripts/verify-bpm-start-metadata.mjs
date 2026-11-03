#!/usr/bin/env node
// 验证 START 当前编排内已有元数据的完整性；不发请求、不缓存授权。
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizeBpmNodeFormMetadata } from '../assets/bpm-node-form-metadata.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/node-form-metadata.json', import.meta.url), 'utf8'));
const base = () => structuredClone(fixture.response.data);

export async function verifyBpmStartMetadata(canReuse) {
  assert.equal(typeof canReuse, 'function', '缺少 START 元数据完整性判定');
  let passed = 0;
  const check = async (name, run) => {
    try { await run(); passed++; }
    catch (cause) { throw new Error(`START 元数据契约未通过：${name}`, { cause }); }
  };
  const decide = (data, keys = ['relatedName'], expected = fixture.expected) => canReuse(data, expected, keys);
  await check('完整字段对象但关系缺失时必须读取 START', async () => {
    const data = normalizeBpmNodeFormMetadata(base(), fixture.expected);
    delete data.relations;
    assert.equal(await decide(data), false);
  });
  await check('字段、关系和定位都完整时可省略重复读取且不修改输入', async () => {
    const data = base(), before = structuredClone(data);
    assert.equal(await decide(data), true);
    assert.deepEqual(data, before);
  });
  await check('未提供节点元数据时需要读取', async () => assert.equal(await decide(undefined), false));
  const mutations = [
    data => { data.fields = ['relatedName']; },
    data => { data.fields = data.fields.filter(field => field.fieldKey !== 'relatedName'); },
    data => { delete data.fields[4].lookup.targetFieldType; },
    data => { data.relations = []; },
    data => { delete data.relations[0].properties.from; },
    data => { data.relations[0].appKey = 'other'; },
    data => { data.appKey = 'other'; },
    data => { data.processKey = 'other'; },
    data => { data.nodeKey = 'other'; },
  ];
  for (const [index, mutate] of mutations.entries()) await check(`不完整或定位不一致 ${index}`, async () => {
    const data = base(); mutate(data); assert.equal(await decide(data), false);
  });
  await check('非 Lookup 完整字段不要求关系集合', async () => {
    const data = base(); data.fields = data.fields.slice(0, 1); delete data.relations;
    assert.equal(await decide(data, ['title']), true);
  });
  await check('未选中 Lookup 的依赖缺失不影响当前字段', async () => {
    const data = base(); delete data.relations;
    assert.equal(await decide(data, ['title']), true);
  });
  await check('合法空授权字段集合', async () => {
    const data = base(); data.fields = []; delete data.relations;
    assert.equal(await decide(data, []), true);
  });
  await check('不能将 TASK 用于 START 判定', async () => {
    await assert.rejects(async () => decide(base(), ['relatedName'], { ...fixture.expected, scene: 'TASK' }),
      error => error.code === 'BPM_NODE_FORM_METADATA_INVALID');
  });
  await check('可信定位参数缺失不能伪装成需要补查', async () => {
    await assert.rejects(async () => decide(base(), ['relatedName'], { ...fixture.expected, appKey: undefined }),
      error => error.code === 'BPM_NODE_FORM_METADATA_INVALID');
  });
  await check('非法授权字段参数不能伪装成需要补查', async () => {
    for (const keys of [undefined, [''], [null]]) {
      await assert.rejects(async () => canReuse(base(), fixture.expected, keys),
        error => error.code === 'BPM_NODE_FORM_METADATA_INVALID');
    }
  });
  await check('非合同异常保持抛出', async () => {
    const error = new Error('unexpected failure');
    const data = base(); Object.defineProperty(data, 'fields', { get() { throw error; } });
    await assert.rejects(async () => decide(data), value => value === error);
  });
  return { passed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const url = process.argv[2] ? pathToFileURL(realpathSync(process.argv[2])) : new URL('../assets/bpm-lookup-metadata.mjs', import.meta.url);
    const { canReuseBpmStartMetadata } = await import(url.href);
    const result = await verifyBpmStartMetadata(canReuseBpmStartMetadata);
    console.log(`PASS：${result.passed} 项 START 元数据完整性验证`);
  } catch (error) { console.error(`FAIL：${error.message}`); process.exitCode = 1; }
}
