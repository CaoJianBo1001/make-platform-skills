#!/usr/bin/env node
// 可对随包参考转换器或宿主导出的同签名适配器执行同一组行为验证；不访问后端。
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/node-form-metadata.json', import.meta.url), 'utf8'));
const clone = value => structuredClone(value);

export async function verifyNodeFormMetadata(normalize) {
  let passed = 0;
  const check = async (name, run) => {
    try { await run(); passed += 1; }
    catch (cause) { throw new Error(`节点元数据契约未通过：${name}`, { cause }); }
  };
  const base = () => clone(fixture.response.data);
  const field = patch => ({ fieldKey: 'value', fieldName: '字段', type: 1, makeFieldType: 'TEXT', ...patch });
  const readFields = async fields => (await normalize({ ...base(), fields }, clone(fixture.expected))).fields;
  const reject = async (data, expected = fixture.expected) => {
    await assert.rejects(async () => normalize(clone(data), clone(expected)), error => {
      assert.equal(error.code, 'BPM_NODE_FORM_METADATA_INVALID');
      assert.equal(error.status, 502);
      assert.equal(typeof error.path, 'string');
      assert.ok(error.path.length > 0);
      return true;
    });
  };

  await check('脱敏成功响应的完整字段与原始输入保持', async () => {
    const input = base();
    const before = clone(input);
    const result = await normalize(input, clone(fixture.expected));
    assert.deepEqual(input, before);
    assert.equal(result.fields.length, 5);
    assert.deepEqual(result.fields.map(item => item.key), ['title', 'amount', 'category', 'requestNo', 'relatedName']);
    assert.equal(result.fields[0].type, 'Make.Field.Text');
    assert.equal(result.fields[1].type, 'Make.Field.Currency');
    assert.deepEqual(result.fields[1].properties, { decimalPlaces: 2, symbol: '¥', useGrouping: true });
    assert.deepEqual(result.fields[1].validations, { isRequired: true, maximum: 999999999999.99 });
    assert.deepEqual(result.fields[2].properties.options, before.fields[2].selection.fieldSelections);
    assert.deepEqual(result.fields[3].properties, before.fields[3].encoding);
    assert.deepEqual(result.fields[4].properties, before.fields[4].lookup);
    for (const [index, raw] of before.fields.entries()) {
      for (const [key, value] of Object.entries(raw)) if (key !== 'type') assert.deepEqual(result.fields[index][key], value);
    }
  });

  // 独立声明期望，不从被测转换器的映射表计算预期值。
  const types = [
    ['ID', 'Make.Field.ID', 'encoding', { type: 1, encodings: [{ prefix: 'REQ', digit: 6 }] }],
    ['TEXT', 'Make.Field.Text'], ['TEXT_AREA', 'Make.Field.TextArea'], ['URL', 'Make.Field.URL'],
    ['NUMBER', 'Make.Field.Number', 'number', { precision: 1 }],
    ['CURRENCY', 'Make.Field.Currency', 'currency', { decimalPlaces: 2, symbol: '¥', useGrouping: true }],
    ['PERCENT', 'Make.Field.Percent', 'percent', { decimalPlaces: 2 }],
    ['DATE', 'Make.Field.Date', 'date', { format: 'yyyy-MM-dd' }],
    ['DATE_TIME', 'Make.Field.DateTime', 'date', { format: 'yyyy-MM-dd HH:mm:ss' }],
    ['DATE_RANGE', 'Make.Field.DateRange', 'date', { begin: '2026-01-01', end: '2026-12-31' }],
    ['SINGLE_USER', 'Make.Field.SingleUser', 'person', { maxCount: 1 }],
    ['MULTI_USER', 'Make.Field.MultiUser', 'person', { maxCount: 10 }],
    ['SINGLE_DEPT', 'Make.Field.SingleDepartment', 'dept', { maxCount: 1 }],
    ['MULTI_DEPT', 'Make.Field.MultiDepartment', 'dept', { maxCount: 8 }],
    ['FILE', 'Make.Field.File', 'file', { maxCount: 10 }],
    ['LOOKUP', 'Make.Field.Lookup', 'lookup', { relationKey: 'sample_relation', targetFieldKey: 'title', targetFieldType: 'Make.Field.Text' }],
    ['SINGLE_SELECT', 'Make.Field.SingleSelect'], ['MULTI_SELECT', 'Make.Field.MultiSelect'],
  ];
  for (const [enumType, type, bucket, config] of types) {
    await check(`${enumType} 的数字 type、配置与校验保留`, async () => {
      const options = [{ id: 'one', label: '一', value: 'one', isEnabled: true, sort: 1 }, { id: 'two', label: '二', value: 'two', isEnabled: false, sort: 2 }];
      const isSelect = enumType.endsWith('_SELECT');
      const raw = field({ makeFieldType: enumType, properties: { extension: { keep: true } },
        validations: { isRequired: true, nestedRule: { keep: true } }, capabilities: { sortable: false, extension: true },
        ...(bucket ? { [bucket]: config } : {}), ...(isSelect ? { selection: { fieldSelections: options } } : {}) });
      const [actual] = await readFields([raw]);
      assert.equal(actual.type, type);
      assert.deepEqual(actual.properties, { extension: { keep: true }, ...config, ...(isSelect ? { options } : {}) });
      assert.deepEqual(actual.validations, raw.validations);
      assert.deepEqual(actual.capabilities, raw.capabilities);
      if (bucket) assert.deepEqual(actual[bucket], config);
    });
  }
  await check('无 type 的文档 DTO 可按枚举转换', async () => {
    const raw = field({ makeFieldType: 'NUMBER', number: { precision: 1 } }); delete raw.type;
    assert.equal((await readFields([raw]))[0].type, 'Make.Field.Number');
  });
  await check('标准字段仅保留 properties 也可使用', async () => {
    const raw = { key: 'value', name: '字段', type: 'Make.Field.SingleSelect', properties: { options: [] } };
    assert.deepEqual((await readFields([raw]))[0], raw);
  });
  await check('标准类型与相同专用配置共同存在', async () => {
    const raw = field({ type: 'Make.Field.Number', makeFieldType: 'NUMBER', number: { precision: 1 }, properties: { precision: 1 } });
    assert.deepEqual((await readFields([raw]))[0].properties, { precision: 1 });
  });
  await check('TASK 对照已授权任务而非当前部署流程', async () => {
    const data = { ...base(), processKey: 'bound_old_flow', nodeKey: 'approval_1' };
    const expected = { scene: 'TASK', appKey: data.appKey, entityKey: data.entityKey };
    assert.equal((await normalize(data, expected)).processKey, 'bound_old_flow');
  });
  await check('空字段有效', async () => assert.deepEqual(await readFields([]), []));
  await check('重复规范化不丢字段配置', async () => {
    const first = await normalize(base(), clone(fixture.expected));
    assert.deepEqual(await normalize(clone(first), clone(fixture.expected)), first);
  });
  await check('空选项有效且保持为空', async () => {
    const [actual] = await readFields([field({ makeFieldType: 'MULTI_SELECT', selection: { fieldSelections: [] } })]);
    assert.deepEqual(actual.properties.options, []);
  });

  const invalidFields = [
    ['枚举必须为字符串', field({ makeFieldType: { toString: null } })],
    ['未知枚举', field({ makeFieldType: 'FUTURE' })],
    ['原型属性不是枚举', field({ makeFieldType: 'toString' })],
    ['未知标准类型', field({ type: 'Make.Field.Future', makeFieldType: undefined })],
    ['类型冲突', field({ type: 'Make.Field.Number', makeFieldType: 'CURRENCY' })],
    ['标准类型不能掩盖未知枚举', field({ type: 'Make.Field.Text', makeFieldType: 'FUTURE' })],
    ['只给数字类型', field({ makeFieldType: undefined })],
    ['key 冲突', field({ key: 'another' })], ['name 冲突', field({ name: '另一名称' })],
    ['缺少 key', field({ fieldKey: '' })], ['缺少 name', field({ fieldName: '' })],
    ['非法 properties', field({ properties: [] })], ['非法 validations', field({ validations: [] })],
    ['非法 capabilities', field({ capabilities: [] })],
    ['非法类型配置', field({ makeFieldType: 'CURRENCY', currency: 'invalid' })],
    ['配置冲突', field({ makeFieldType: 'NUMBER', number: { precision: 1 }, properties: { precision: 2 } })],
    ['缺失选项', field({ makeFieldType: 'SINGLE_SELECT' })],
    ['非法 selection', field({ makeFieldType: 'MULTI_SELECT', selection: [] })],
    ['非法选项 value', field({ makeFieldType: 'SINGLE_SELECT', selection: { fieldSelections: [{ label: '一', value: 1 }] } })],
    ['选项冲突', field({ makeFieldType: 'SINGLE_SELECT', selection: { fieldSelections: [] }, properties: { options: [{ label: '一', value: 'one' }] } })],
    ['字段必须为对象', null],
  ];
  for (const [name, raw] of invalidFields) await check(name, () => reject({ ...base(), fields: [raw] }));
  for (const key of ['appKey', 'entityKey', 'processKey', 'nodeKey']) {
    await check(`${key} 定位不一致`, () => reject({ ...base(), [key]: 'another' }));
  }
  for (const key of ['appKey', 'entityKey', 'processKey', 'nodeKey', 'nodeName']) {
    await check(`${key} 缺失`, () => reject({ ...base(), [key]: '' }));
  }
  await check('重复字段', () => reject({ ...base(), fields: [field(), field()] }));
  await check('fields 不是数组', () => reject({ ...base(), fields: null }));
  await check('信封不由纯转换器猜测解包', () => reject(fixture.response));
  await check('缺少可信定位', () => reject(base(), {}));
  await check('START 必须核验启动节点', () => reject(base(), { ...fixture.expected, nodeKey: undefined }));
  await check('TASK 可用的节点定位必须核验', () => reject(base(), { scene: 'TASK', appKey: base().appKey, entityKey: base().entityKey, nodeKey: 'different_node' }));
  return { passed };
}

// realpath 兼容 Skill 安装目录的符号链接。
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  console.log('开始核验 BPM 节点元数据转换（本地夹具，不发送请求）');
  try {
    if (process.argv.length > 3) throw new Error('用法：node verify-node-form-metadata.mjs [adapter-module.mjs]');
    const url = process.argv[2] ? pathToFileURL(realpathSync(process.argv[2])) : new URL('../assets/bpm-node-form-metadata.mjs', import.meta.url);
    const { normalizeBpmNodeFormMetadata } = await import(url.href);
    assert.equal(typeof normalizeBpmNodeFormMetadata, 'function');
    const result = await verifyNodeFormMetadata(normalizeBpmNodeFormMetadata);
    console.log(`PASS：${result.passed} 项节点元数据行为验证`);
  } catch (error) {
    console.error(`FAIL：${error.message}`);
    process.exitCode = 1;
  }
}
