import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** 执行文档原配置，独立区分正式旧制品拒绝和候选支持，不按版本名猜能力。 */
export async function verifyDateTimeExample(example, root, expectSupport) {
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.equal(manifest.name, '@qfei-design/make-app-analytics');
  const load = entry => import(pathToFileURL(resolve(root, manifest.exports[entry].import)).href);
  const core = await load('.'), server = await load('./server');
  const { dateTimeFields: fields, dateTimeDefinition: definition, dateTimeScope: scope, dateTimeRequest: request } = example;
  const calls = [];
  const host = { openSession: async () => ({
    identity: { tenantId: 'example', appKey: 'example', principal: 'reader', permissionVersion: '1' },
    timeZone: scope.timeZone, assertActive: async () => true,
    getEntity: async () => ({ canRead: true, fields, filterFields: fields.map(f => ({ key: f.key, type: f.type })) }),
    aggregate: async body => {
      calls.push(body);
      return { code: 200, data: [
        { period: { value: '2026-01', label: '2026-01' }, events: 2 },
        { period: { value: '2026-02', label: '2026-02' }, events: 3 },
      ], pagination: { ...body.pagination, total: 2 } };
    },
  }) };
  const valid = core.validateDefinition(definition, fields);
  assert.equal(valid.ok, expectSupport, JSON.stringify(valid));
  const service = server.createAnalysisService({ host, scopes: [scope],
    registrations: [{ definition, scopeKey: scope.key }],
    logger: { info() {}, error() {} }, limits: { pageSize: 100, maxGroups: 100, timeoutMs: 1000 } });
  if (!expectSupport) {
    await assert.rejects(service.execute(definition.id, request), error => error.code === 'DEFINITION_INVALID');
    assert.equal(calls.length, 0);
    return;
  }
  const output = await service.execute(definition.id, request);
  assert.equal(calls.length, 1);
  assert.match(calls[0].filter.expression, /eventAt >= "2026-01-01 00:00:00"/);
  assert.match(calls[0].filter.expression, /eventAt < "2026-03-01 00:00:00"/);
  assert.equal(output.rows.reduce((n, row) => n + row.events, 0), 5);
  assert.equal(core.buildChartModel(definition, output, 'line').ok, true);
  assert.equal(fields[0].capabilities.aggregable, false);
}
