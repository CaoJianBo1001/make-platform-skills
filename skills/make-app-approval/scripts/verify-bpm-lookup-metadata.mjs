#!/usr/bin/env node
// 无 I/O 的依赖合同验证；真实脱敏关系与合成异常用例分开。
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizeBpmNodeFormMetadata } from '../assets/bpm-node-form-metadata.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/node-form-metadata.json', import.meta.url), 'utf8'));
const base = () => normalizeBpmNodeFormMetadata(structuredClone(fixture.response.data), fixture.expected);
export async function verifyBpmLookupMetadata(resolve) {
  let passed = 0;
  const check = async (name, run) => { try { await run(); passed++; } catch (cause) { throw new Error(`Lookup 依赖契约未通过：${name}`, { cause }); } };
  const reject = async (input, keys = ['relatedName']) => assert.rejects(async () => resolve(input, keys), error => {
    assert.equal(error.code, 'BPM_NODE_FORM_METADATA_INVALID'); assert.equal(error.status, 502); return true;
  });
  await check('真实结构、无副作用及最小目标描述', async () => {
    const data = base(), before = structuredClone(data);
    assert.deepEqual(await resolve(data, ['relatedName']), [{ fieldKey: 'relatedName', relationKey: 'sample_relation',
      targetEntityKey: 'sample_target', targetFieldKey: 'title', targetFieldType: 'Make.Field.Text', multiple: false }]);
    assert.deepEqual(data, before);
  });
  for (const reversed of [false, true]) for (const cardinality of ['one', 'many']) {
    await check(`关系方向 ${reversed} 及基数 ${cardinality}`, async () => {
      const data = base(), relation = data.relations[0];
      relation.properties.from.cardinality = cardinality;
      if (reversed) [relation.properties.from, relation.properties.to] = [relation.properties.to, relation.properties.from];
      assert.equal((await resolve(data, ['relatedName']))[0].multiple, cardinality === 'many');
      assert.equal((await resolve(data, ['relatedName']))[0].targetEntityKey, 'sample_target');
    });
  }
  await check('自关联目标未在源字段中，不能添加源授权或伪造选项', async () => {
    const data = base(); data.relations[0].properties.from.entityKey = data.entityKey;
    data.fields[4].properties.targetFieldType = 'Make.Field.SingleSelect'; data.fields[4].properties.targetFieldKey = 'choice';
    const result = await resolve(data, ['relatedName']);
    assert.equal(result[0].targetEntityKey, data.entityKey); assert.equal(result[0].targetFieldType, 'Make.Field.SingleSelect');
    assert.equal(data.fields.length, 5); assert.equal(result[0].options, undefined); assert.equal(result[0].validations, undefined);
  });
  await check('当前字段搜索不被无关缺失依赖阻塞', async () => {
    const data = base(); data.fields.push({ ...data.fields[4], key: 'other', properties: { relationKey: 'missing' } });
    assert.equal((await resolve(data, ['relatedName'])).length, 1);
  });
  await check('重复选中字段去重且不附加普通字段', async () => {
    assert.equal((await resolve(base(), ['relatedName', 'relatedName', 'title'])).length, 1);
    assert.deepEqual(await resolve(base(), []), []);
  });
  const mutations = [
    data => { delete data.relations; }, data => { data.relations = []; }, data => { data.relations.push(structuredClone(data.relations[0])); },
    data => { data.relations[0].appKey = 'other'; }, data => { data.relations[0].type = 'Make.Entity'; },
    data => { delete data.relations[0].properties.to; }, data => { data.relations[0].properties.to.entityKey = 'other'; },
    data => { data.relations[0].properties.from.cardinality = 'unknown'; }, data => { data.relations[0].properties.to.cardinality = 'unknown'; },
    data => { delete data.fields[4].properties.targetFieldKey; }, data => { delete data.fields[4].properties.relationKey; },
    data => { delete data.fields[4].properties.targetFieldType; }, data => { data.fields[4].properties.targetFieldType = 'Make.Field.Future'; },
    data => { data.fields[4].properties.targetFieldType = 'TEXT'; },
  ];
  for (const [index, mutate] of mutations.entries()) await check(`非法依赖 ${index}`, async () => { const data = base(); mutate(data); await reject(data); });
  await check('不存在的授权字段拒绝', () => reject(base(), ['missing']));
  await check('同一目标类型冲突拒绝', async () => {
    const data = base(); data.fields.push({ ...data.fields[4], key: 'second', properties: { ...data.fields[4].properties, targetFieldType: 'Make.Field.Number' } });
    await reject(data, ['relatedName', 'second']);
  });
  await check('自关联目标与已返回字段类型冲突拒绝', async () => {
    const data = base(); data.relations[0].properties.from.entityKey = data.entityKey;
    data.fields[4].properties.targetFieldType = 'Make.Field.Number'; await reject(data);
  });
  return { passed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const url = process.argv[2] ? pathToFileURL(realpathSync(process.argv[2])) : new URL('../assets/bpm-lookup-metadata.mjs', import.meta.url);
    const { resolveBpmLookupDependencies } = await import(url.href);
    const result = await verifyBpmLookupMetadata(resolveBpmLookupDependencies);
    console.log(`PASS：${result.passed} 项 Lookup 依赖行为验证`);
  } catch (error) { console.error(`FAIL：${error.message}`); process.exitCode = 1; }
}
