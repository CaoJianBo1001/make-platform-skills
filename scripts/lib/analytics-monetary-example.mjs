import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadMonetaryExample() {
  const document = await readFile(new URL('../../skills/make-app-analytics/references/selection-and-scope.md', import.meta.url), 'utf8');
  const code = document.match(/<!-- analytics-monetary-example -->\s*```js\n([\s\S]*?)```/)?.[1];
  assert.ok(code, '缺少可执行的区间与单币种接入示例');
  const example = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  assert.deepEqual(example.amountBands.map(b => b.label), ['[0,1000)', '[1000,5000)', '[5000,+∞)']);
  const samples = [0, 999.99, 1000, 5000, null, -1];
  assert.deepEqual(example.amountBands.map(b => samples.filter(n => n !== null && n >= b.lower && (b.upper === null || n < b.upper)).length), [2, 1, 1]);
  const boundary = [0, 1000, 5000, 4999.9999, null, -1];
  assert.deepEqual(boundary.map(n => example.amountBands.filter(b => n !== null && n >= b.lower && (b.upper === null || n < b.upper)).map(b => b.key)), [['low'], ['middle'], ['high'], ['middle'], [], []]);
  return example;
}

export async function verifyMonetaryExample(root) {
  const example = await loadMonetaryExample();
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const load = entry => import(pathToFileURL(resolve(root, manifest.exports[entry].import)).href);
  const sdk = await load('.'), server = await load('./server');
  const fields = [{ key: 'amount', type: 'Make.Field.Currency', readable: true }, { key: 'currency', type: 'Make.Field.SingleSelect', readable: true, capabilities: { aggregable: true } }];
  const values = { CNY: 100.1234, USD: 200.5678 };
  const calls = [];
  const registrations = Object.keys(values).map(example.monetaryRegistration);
  for (const registration of registrations) assert.equal(sdk.validateDefinition(registration.definition, fields).ok, true);
  const service = server.createAnalysisService({
    registrations, limits: { pageSize: 10, maxGroups: 20, timeoutMs: 5000 }, logger: { info() {}, error() {} },
    host: { openSession: async () => ({
      identity: { tenantId: 'fixture', appKey: 'fixture', principal: 'fixture', permissionVersion: '1' },
      timeZone: 'Asia/Shanghai', assertActive: async () => true,
      getEntity: async () => ({ canRead: true, fields, filterFields: fields }),
      aggregate: async body => {
        calls.push(body);
        const code = body.filter?.expression.match(/currency\s*==\s*['"](CNY|USD)['"]/u)?.[1];
        assert.ok(code, '同表金额汇总必须带明确币种条件');
        return { code: 200, data: [{ amount: values[code] }], pagination: { page: 1, size: 10, total: 1 } };
      },
    }) },
  });
  for (const code of Object.keys(values)) {
    const definition = example.monetaryRegistration(code).definition;
    const result = await service.execute(definition.id, { definitionVersion: '1' });
    assert.equal(result.rows[0].amount, values[code]);
    assert.equal(result.columns[0].unit.code, code);
    const before = structuredClone(result);
    assert.equal(sdk.formatResultValue(result.rows[0].amount, result.columns[0]), new Intl.NumberFormat('zh-CN', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(values[code]));
    assert.deepEqual(result, before, '展示格式不能改写后续计算值');
  }
  assert.equal(calls.length, 2);
  console.info('monetary examples: 单币种真实编译条件、单位、四位精度及区间边界通过（合成接口）');
}
