import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const documents = {
  usage: read('../skills/makeui/references/component-usage.md'),
  entry: read('../skills/makeui/SKILL.md'),
  foundation: read('../skills/makeui/references/antd-foundation.md'),
  drawer: read('../skills/makeui/references/drawer-layout.md'),
  readme: read('../README.md'),
  shell: read('../skills/makeui/references/app-shell-layout.md'),
};
const urlDisplay = read('../skills/makeui/references/url-field-display.md');
const ownershipAnchor = '#设计方案与组件实现的维护边界';
const ownership = (usage) =>
  usage.split('## 设计方案与组件实现的维护边界\n')[1]?.split('\n## ')[0] ?? '';

// A publication contract for guidance ownership; actual generated UI is tested separately.
function assertOwnership(usage) {
  const section = ownership(usage);
  assert.match(section, /MakeDesign[^\n]*风格[^\n]*布局选择[^\n]*预览[^\n]*方案交接/);
  assert.match(section, /makeui[^\n]*统一维护[^\n]*组件行为[^\n]*Make 表单／详情标准/);
  assert.match(section, /唯一[^\n]*assets\/antd-foundation\//);
  assert.match(section, /生成快照[^\n]*不得[^\n]*手工[^\n]*组件行为/);
  assert.match(section, /修复[^\n]*回归[^\n]*makeui[^\n]*同步/);
  assert.match(section, /foundation[^\n]*分发[^\n]*不[^\n]*另一套/);
  assert.match(section, /components\.html[^\n]*视觉参考/);
}

test('MakeDesign and makeui route design data and component implementations to one maintained owner', () => {
  assertOwnership(documents.usage);
  const sourceLink = ownership(documents.usage).match(/\]\((\.\.\/assets\/antd-foundation\/index\.tsx)\)/)?.[1];
  assert.ok(sourceLink, 'canonical implementation must be reachable from the installed Skill');
  assert.ok(existsSync(new URL('../skills/makeui/references/' + sourceLink, import.meta.url)));
});

test('entry, foundation, form contract and repository guide point to the same ownership contract', () => {
  for (const [name, document] of Object.entries(documents).filter(([name]) => name !== 'usage')) {
    assert.ok(document.includes('component-usage.md' + ownershipAnchor), `${name} must route ownership centrally`);
  }
});

test('legacy resources and prototype examples do not become a second new-project component foundation', () => {
  const section = ownership(documents.usage);
  assert.match(section, /components\.html[^\n]*视觉参考/);
  assert.match(section, /makeui-controls\/v1[^\n]*兼容[^\n]*新项目不默认/);
  assert.match(documents.foundation, /同一部署路径/);
  assert.match(documents.foundation, /源仓库、安装副本和远端部署分别核对/);
  assert.match(documents.usage, /不主动给包自有区域接完整主题 Provider／mapper/);
  assert.match(documents.readme, /手机仅通过[^\n]*公开颜色接入与颜色投影[^\n]*主题主色/);
});

test('Shell guidance keeps package-owned phone themes within the explicitly included scope', () => {
  assert.doesNotMatch(documents.shell, /手机通过包公开变量映射同一方案/);
  assert.match(documents.shell, /手机[^\n]*仅按[^\n]*手机颜色接入[^\n]*PC Provider/);
  assert.match(documents.shell, /引用包[^\n]*正式版本[^\n]*外观/);
});

test('URL display gaps reuse public host slots or compatible releases before expanding package scope', () => {
  assert.match(urlDisplay, /优先[^\n]*公开[^\n]*宿主[^\n]*插槽/);
  assert.match(urlDisplay, /renderField/);
  assert.match(urlDisplay, /手机[^\n]*值槽/);
  assert.match(urlDisplay, /兼容[^\n]*正式版本[^\n]*授权范围/);
  assert.doesNotMatch(urlDisplay, /包能力缺失时先补包/);
});

test('a real URL package capability gap requires separate scope and only holds its dependent work', () => {
  assert.match(urlDisplay, /行为[^\n]*安全[^\n]*缺口/);
  assert.match(urlDisplay, /修改[^\n]*包[^\n]*单独[^\n]*确认[^\n]*范围/);
  assert.match(urlDisplay, /尚未[^\n]*授权范围[^\n]*单独[^\n]*确认/);
  assert.match(urlDisplay, /只暂停[^\n]*依赖[^\n]*部分[^\n]*不阻塞[^\n]*无关/);
  assert.match(urlDisplay, /不虚构[^\n]*API/);
  assert.match(urlDisplay, /私有[^\n]*CSS/);
});

test('URL theme gaps follow the deferred package-theme policy and keep actual verification boundaries', () => {
  assert.match(urlDisplay, /纯主题[^\n]*公共包主题后续同步/);
  assert.match(urlDisplay, /component-usage\.md#完整方案应用与差异记录/);
  assert.match(urlDisplay, /exports[^\n]*声明[^\n]*构建制品/);
  assert.match(urlDisplay, /宿主[^\n]*行为回归[^\n]*包[^\n]*仅在[^\n]*授权范围/);
});

for (const [name, before, after] of [
  ['a second behavior owner', 'makeui 统一维护组件行为和 Make 表单／详情标准', 'MakeDesign 独立维护组件行为和表单标准'],
  ['hand-maintained preview implementation', '生成快照，不得手工修改组件行为', '另一份实现，可手工修改组件行为'],
  ['prototype components used as the new runtime', 'components.html` 仅作视觉参考', 'components.html` 作为新项目运行组件'],
]) {
  test(`ownership guidance rejects regression: ${name}`, () => {
    const changed = documents.usage.replace(before, after);
    assert.notEqual(changed, documents.usage, 'the regression must change the guidance');
    assert.throws(() => assertOwnership(changed), { code: 'ERR_ASSERTION' });
  });
}
