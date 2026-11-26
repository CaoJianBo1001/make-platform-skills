import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const base = new URL('../skills/makeui/', import.meta.url);
const read = (path) => existsSync(new URL(path, base)) ? readFileSync(new URL(path, base), 'utf8') : '';
const quality = read('references/page-design-quality.md');
const entry = read('SKILL.md');
const usage = read('references/component-usage.md');

// Published guidance contracts only. Generated projects and browser evidence are verified separately.
test('new-project workflow discovers a portable design baseline before representative pages', () => {
  assert.ok(quality, 'the new-project design and visual acceptance reference must ship with makeui');
  assert.match(entry, /page-design-quality\.md/);
  assert.match(usage, /page-design-quality\.md/);
  assert.match(quality, /POC[^\n]*模板/);
  assert.match(quality, /设计基线[^\n]*生成[^\n]*代表页面/);
  assert.match(quality, /docs\/ui-design\.md/);
  for (const topic of ['使用场景', '组件库', '视觉来源', '区域', '移动', '差异', '验收记录']) assert.ok(quality.includes(topic), topic);
});

test('design precedence keeps explicit appearance separate from Make behavior and surface defaults', () => {
  assert.match(quality, /已选方案[^\n]*优先[^\n]*默认/);
  assert.match(quality, /字段语义[^\n]*权限[^\n]*受控值[^\n]*提交/);
  assert.match(quality, /60%[^\n]*Drawer/);
  assert.match(quality, /所属容器[^\n]*实际[^\n]*宽度/);
  assert.match(quality, /不[^\n]*新增[^\n]*page[^\n]*modal[^\n]*drawer/);
});

test('phone protection routes to existing standards rather than redefining field layout', () => {
  for (const ref of ['mobile-product-baseline.md', 'mobile-defaults.md', 'mobile-form-controls.md', 'mobile-visual-standard.md', 'mobile-detail-components.md', 'mobile-form-acceptance.md']) assert.ok(quality.includes(ref), ref);
  assert.match(quality, /共享[^\n]*Controller/);
  assert.match(quality, /桌面[^\n]*不得[^\n]*覆盖[^\n]*手机/);
  assert.match(quality, /0\.1\.15/);
  assert.match(quality, /不[^\n]*默认[^\n]*公共包[^\n]*主题/);
});

test('library-neutral readiness includes actual visual review and separates device evidence', () => {
  assert.match(quality, /320[^\n]*390[^\n]*767/);
  assert.match(quality, /截图[^\n]*计算样式[^\n]*边界/);
  assert.match(quality, /软键盘[^\n]*真机[^\n]*待验/);
  assert.match(quality, /自动[^\n]*通过[^\n]*不[^\n]*视觉验收/);
  assert.match(read('references/antd-foundation.md'), /page-design-quality\.md/);
});

test('related desktop layout references all discover the same scoped precedence', () => {
  for (const file of ['drawer-layout', 'app-shell-layout', 'styling-and-responsive', 'page-route-layout', 'list-page-layout']) {
    assert.match(read(`references/${file}.md`), /page-design-quality\.md/, file);
  }
});
