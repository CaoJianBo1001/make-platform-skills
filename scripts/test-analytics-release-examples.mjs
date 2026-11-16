import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { resolveAnalyticsInstall } from './lib/analytics-install-location.mjs';
import { verifyDateTimeExample } from './lib/analytics-datetime-example.mjs';

const dateTimeDocument = await readFile(new URL('../skills/make-app-analytics/references/datetime.md', import.meta.url), 'utf8');
const dateTimeCode = dateTimeDocument.match(/<!-- analytics-datetime-example -->\s*```js\n([\s\S]*?)```/)?.[1];
assert.ok(dateTimeCode, 'DateTime 接入须提供可执行的公开配置');
const dateTimeExample = await import(`data:text/javascript,${encodeURIComponent(dateTimeCode)}`);
assert.equal(dateTimeExample.dateTimeFields[0].type, 'Make.Field.DateTime');
assert.equal(dateTimeExample.dateTimeFields[0].capabilities.aggregable, false);
if (process.env.MAKE_ANALYTICS_DATETIME_PACKAGE_ROOT) {
  await verifyDateTimeExample(dateTimeExample, process.env.MAKE_ANALYTICS_DATETIME_PACKAGE_ROOT, true);
  console.info('DateTime candidate: public definition, request and chart passed');
}

// 直接执行Skill提供的配置，不以关键词匹配代替公开包行为验证。
const document = await readFile(
  new URL(
    '../skills/make-app-analytics/references/release-017.md',
    import.meta.url,
  ),
  'utf8',
);
const advancedMetrics = await readFile(
  new URL(
    '../skills/make-app-analytics/references/advanced-metrics.md',
    import.meta.url,
  ),
  'utf8',
);
// 只防已复现的旧能力说明回归；公开包行为仍由下面的执行结果验证。
assert.doesNotMatch(
  advancedMetrics,
  /累计、滚动均值[^。\n]*尚不是上述模板能力/,
  '高级指标指南不能继续否定 0.1.7 已发布的累计、滚动和目标能力',
);
assert.doesNotMatch(
  advancedMetrics,
  /不将未返回日期桶补零/,
  '高级指标指南须区分默认留空和符合资格的显式补零',
);
assert.match(
  advancedMetrics,
  /\[[^\]]+\]\(release-017\.md(?:#[^)]*)?\)/,
  '高级指标指南须交接到随 Skill 分发的 0.1.7 合同',
);
const code = [
  ...document.matchAll(
    /<!-- analytics-017-example -->\s*```js\n([\s\S]*?)```/g,
  ),
]
  .map((m) => m[1])
  .join('\n');
assert.ok(code, '缺少可执行接入示例');
const examples = await import(
  `data:text/javascript,${encodeURIComponent(code)}`
);
assert.deepEqual(examples.targetViewOptions, { numberNotation: 'compact' });
const root =
  process.env.MAKE_ANALYTICS_PACKAGE_ROOT ??
  (process.argv.includes('--installed')
    ? await resolveAnalyticsInstall(process.env.PATH)
    : undefined);
if (!root) {
  console.info(
    'analytics examples: SKIP runtime (set MAKE_ANALYTICS_PACKAGE_ROOT to an installed 0.1.9 package); example modules parsed',
  );
} else {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.name, '@qfei-design/make-app-analytics');
  assert.equal(manifest.version, '0.1.9');
  await verifyDateTimeExample(dateTimeExample, root, true);
  const load = (entry) =>
    import(pathToFileURL(resolve(root, manifest.exports[entry].import)).href);
  const sdk = await load('.'),
    react = await load('./react'),
    charts = await load('./echarts');
  const months = Array.from({ length: 14 }, (_, i) =>
    new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 7),
  );
  const source = (id, values, category = false) => ({
    definition: {
      schemaVersion: 1,
      id,
      definitionVersion: '1',
      semantic: {
        goal: 'comparison',
        description: '仅用于Skill示例回归的合成来源',
        timeZone: 'Asia/Shanghai',
      },
      query: {
        entityKey: 'sample',
        dimensions: [
          {
            fieldKey: category ? 'category' : 'date',
            alias: 'bucket',
            ...(category ? {} : { granularity: 'month' }),
          },
        ],
        metrics: [
          {
            alias: 'amount',
            aggregate: 'sum',
            fieldKey: 'amount',
            unit: { kind: 'currency', code: 'CNY' },
          },
        ],
        coverage: { mode: 'complete' },
        sort: [],
      },
      views: [{ id: 'table', kind: 'table' }],
    },
    result: {
      schemaVersion: 1,
      analysisId: id,
      definitionVersion: '1',
      queryFingerprint: id,
      executedAt: '2026-03-02T00:00:00Z',
      columns: [
        {
          kind: 'dimension',
          fieldKey: category ? 'category' : 'date',
          alias: 'bucket',
        },
        {
          kind: 'number',
          aggregate: 'sum',
          fieldKey: 'amount',
          alias: 'amount',
          unit: { kind: 'currency', code: 'CNY' },
        },
      ],
      rows: values.map((amount, i) => ({
        bucket: {
          value: category ? ['a', 'b'][i] : months[i],
          label: category ? ['甲', '乙'][i] : months[i],
        },
        amount,
      })),
      coverage: {
        kind: 'complete',
        returnedGroups: values.length,
        totalGroups: values.length,
      },
      warnings: [],
    },
    context: {
      entityKey: 'sample',
      scopeKey: 'synthetic',
      scope: '合成范围',
      timeRange: category
        ? { kind: 'all', timeZone: 'Asia/Shanghai' }
        : {
            kind: 'range',
            start: '2025-01-01',
            end: '2026-03-01',
            timeZone: 'Asia/Shanghai',
          },
    },
    ...(category ? {} : { timeFieldKey: 'date' }),
  });
  const a = source('alpha', [...Array(12).fill(100), 150, 160]);
  const b = source('beta', Array(14).fill(200));
  const result = sdk.evaluateGroupedSeries(examples.monthlyDefinition, {
    alpha: a,
    beta: b,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  const data = result.value;
  const point = (key, bucket) =>
    data.series.find((s) => s.key === key).points[
      data.buckets.findIndex((c) => c.value === bucket)
    ];
  assert.equal(point('year_total', '2026-02').value, 310);
  assert.ok(Math.abs(point('average_3', '2026-02').value - 410 / 3) < 1e-8);
  assert.equal(point('yoy', '2026-01').value, 50);
  const missingMonth = structuredClone(a);
  missingMonth.result.rows = missingMonth.result.rows.filter(
    (row) => row.bucket.value !== '2026-01',
  );
  missingMonth.result.coverage.returnedGroups -= 1;
  missingMonth.result.coverage.totalGroups -= 1;
  const filled = sdk.evaluateGroupedSeries(examples.monthlyDefinition, {
    alpha: missingMonth,
    beta: b,
  });
  assert.equal(filled.ok, true, JSON.stringify(filled));
  const januaryActual = (value) =>
    value.series.find((series) => series.key === 'a').points[
      value.buckets.findIndex((bucket) => bucket.value === '2026-01')
    ];
  assert.equal(januaryActual(filled.value).value, 0);
  const defaultMissing = structuredClone(examples.monthlyDefinition);
  delete defaultMissing.inputs[0].missing;
  const unfilled = sdk.evaluateGroupedSeries(defaultMissing, {
    alpha: missingMonth,
    beta: b,
  });
  assert.equal(unfilled.ok, true, JSON.stringify(unfilled));
  assert.equal(januaryActual(unfilled.value).value, null);
  const nullMonth = structuredClone(a);
  nullMonth.result.rows.find(
    (row) => row.bucket.value === '2026-01',
  ).amount = null;
  const preservedNull = sdk.evaluateGroupedSeries(examples.monthlyDefinition, {
    alpha: nullMonth,
    beta: b,
  });
  assert.equal(preservedNull.ok, true, JSON.stringify(preservedNull));
  assert.equal(januaryActual(preservedNull.value).value, null);
  assert.equal(
    sdk.buildTargetModel(examples.monthlyDefinition, data, examples.targetSpec)
      .value.achievement,
    75,
  );
  const large = sdk.evaluateGroupedSeries(examples.monthlyDefinition, {
    alpha: source('alpha', months.map(() => 3130112.11)),
    beta: source('beta', months.map(() => 15078400.22)),
  });
  assert.equal(large.ok, true, JSON.stringify(large));
  const require = createRequire(resolve(await realpath(root), 'package.json'));
  const { createElement } = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(
    createElement(react.AnalysisUIProvider, {
      value: {
        Help: ({ children }) => createElement('aside', null, children),
        DetailsTrigger: () => null,
        DetailsSurface: () => null,
      },
    }, createElement(react.AnalysisTargetView, {
      title: '示例目标',
      definition: examples.monthlyDefinition,
      state: { status: 'success', result: large.value },
      spec: examples.targetSpec,
      ...examples.targetViewOptions,
    })),
  );
  for (const value of ['¥313.01万', '¥1507.84万', '-¥1194.83万'])
    assert.ok(html.includes(value), `紧凑金额未显示：${value}`);
  for (const value of ['¥3,130,112.11', '¥15,078,400.22', '-¥11,948,288.11']) {
    assert.ok(html.includes(`aria-label="${value}"`));
    assert.ok(html.includes(`完整数值：${value}`));
  }
  assert.equal(
    sdk.buildSeriesChartModel(
      examples.monthlyDefinition,
      data,
      examples.comboSpec,
    ).ok,
    true,
  );
  const composition = sdk.evaluateGroupedSeries(
    examples.compositionDefinition,
    {
      alpha: source('alpha', [30, 70], true),
      beta: source('beta', [70, 30], true),
    },
  );
  assert.equal(composition.ok, true, JSON.stringify(composition));
  const shares = sdk.buildSeriesChartModel(
    examples.compositionDefinition,
    composition.value,
    examples.compositionSpec,
  );
  assert.equal(shares.ok, true, JSON.stringify(shares));
  assert.equal(shares.value.series[0].values[0], 30);
  const ranked = sdk.evaluateGroupedSeries(examples.rankingDefinition, {
    alpha: source('alpha', [150, 120], true),
    beta: source('beta', [100, 100], true),
  });
  assert.equal(ranked.ok, true, JSON.stringify(ranked));
  assert.equal(ranked.value.buckets[0].value, 'a');
  assert.equal(
    ranked.value.series.find((s) => s.key === 'growth').points[0].value,
    50,
  );
  const raw = structuredClone(a);
  raw.definition.query.metrics.push({
    alias: 'other',
    aggregate: 'sum',
    fieldKey: 'other',
  });
  raw.result.columns.push({
    kind: 'number',
    alias: 'other',
    aggregate: 'sum',
    fieldKey: 'other',
    unit: { kind: 'number' },
  });
  raw.result.rows.forEach((row, i) => {
    row.other = i;
  });
  assert.equal(
    sdk.buildExplorationChartModel(
      raw.definition,
      raw.result,
      examples.scatterSpec,
    ).ok,
    true,
  );
  raw.definition.query.dimensions.push({
    fieldKey: 'category',
    alias: 'category',
  });
  raw.result.columns.push({
    kind: 'dimension',
    fieldKey: 'category',
    alias: 'category',
  });
  raw.result.rows.forEach((row) => {
    row.category = { value: 'a', label: '甲' };
  });
  assert.equal(
    sdk.buildExplorationChartModel(
      raw.definition,
      raw.result,
      examples.heatmapSpec,
    ).ok,
    true,
  );
  for (const name of ['AnalysisTargetView', 'AnalysisExplorationView'])
    assert.equal(typeof react[name], 'function');
  assert.equal(typeof charts.createExplorationChartOption, 'function');
  console.info(
    'analytics 0.1.9 examples: PASS (DateTime, cumulative, rolling, period comparison, ranking, target, combo, composition, scatter, heatmap; explicit zero/default missing/NULL; public exports)',
  );
}
