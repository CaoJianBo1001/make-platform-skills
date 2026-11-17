import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const document = await readFile(new URL('../skills/make-app-analytics/references/datetime.md', import.meta.url), 'utf8');
const weekCode = document.match(/<!-- analytics-week-example -->\s*```js\n([\s\S]*?)```/)?.[1];
assert.ok(weekCode, '周展示候选需要可执行的公开接入配置');
const dateCode = document.match(/<!-- analytics-datetime-example -->\s*```js\n([\s\S]*?)```/)?.[1];
assert.ok(dateCode, '复用已有DateTime定义');
const example = await import(`data:text/javascript,${encodeURIComponent(`${dateCode}\n${weekCode}`)}`);
const root = process.env.MAKE_ANALYTICS_WEEK_PACKAGE_ROOT;
if (!root) {
  console.info('weekly example: 配置模块已执行；未提供制品目录，跳过周展示运行时验收');
} else {
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.equal(manifest.name, '@qfei-design/make-app-analytics');
  const load = entry => import(pathToFileURL(resolve(root, manifest.exports[entry].import)).href);
  const core = await load('.');
  const definition = structuredClone(example.dateTimeDefinition);
  definition.query.dimensions[0].granularity = 'week';
  definition.views = [{ id: 'weekly', kind: 'bar', x: 'period', y: 'events' }];
  assert.equal(core.validateDefinition(definition, example.dateTimeFields).ok, true);
  const normalized = core.normalizeAggregateResult(definition, example.dateTimeFields, {
    code: 200, data: [{ period: { value: '2026-10-05', label: '2026-10-05' }, events: 2 }],
    pagination: { page: 1, size: 100, total: 1 },
  }, { queryFingerprint: 'weekly_skill_fixture', executedAt: '2026-10-12T00:00:00Z' });
  assert.equal(normalized.ok, true, JSON.stringify(normalized));
  const result = normalized.value, original = structuredClone(result);
  assert.equal(core.buildChartModel(definition, result, 'bar').ok, true);
  const model = core.buildChartModel(definition, result, 'bar', example.weekPresentationProps);
  if (process.argv.includes('--expect-unsupported')) {
    assert.equal(model.ok, false, '周分桶支持不能冒充支持新展示上下文');
    console.info(`weekly example: ${manifest.version}支持分桶但拒绝候选展示参数，未声明页面已修复`);
  } else {
    assert.equal(model.ok, true, JSON.stringify(model));
    const charts = await load('./echarts');
    const option = charts.createChartOption(model.value, { colors: ['#1765c5'], text: '#222', muted: '#555', grid: '#ddd', fontFamily: 'sans-serif' });
    assert.equal(option.xAxis.axisLabel.formatter('2026-10-05', 0), '10/05–10/11');
    assert.match(option.tooltip.formatter([{ dataIndex: 0 }]), /实际纳入：2026-10-07 至 2026-10-09/);
    const ui = await load('./react'), require = createRequire(resolve(root, 'package.json'));
    const { createElement } = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const html = renderToStaticMarkup(createElement(ui.AnalysisResultTable, { definition, result, ...example.weekPresentationProps }));
    assert.match(html, /2026-10-05 至 2026-10-11/);
    assert.match(html, /实际纳入：2026-10-07 至 2026-10-09/);
    assert.deepEqual(result, original);
    console.info('weekly example: 候选公开轴、半周提示与同份明细通过（合成数据）');
  }
}
