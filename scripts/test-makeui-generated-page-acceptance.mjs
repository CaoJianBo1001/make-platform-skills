import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const skillArgument = process.argv.find(argument => argument.startsWith('--skill='));
const skillDirectory = skillArgument?.slice('--skill='.length);
if (skillArgument && !skillDirectory) throw new Error('--skill 必须指定完整 makeui 目录');
const skill = skillDirectory ? pathToFileURL(resolve(skillDirectory) + '/') : new URL('../skills/makeui/', import.meta.url);
const acceptanceModule = new URL('scripts/mobile-form-acceptance.mjs', skill);
const acceptanceDeclaration = new URL('scripts/mobile-form-acceptance.d.mts', skill);
const checks = await import(acceptanceModule.href);

function nativeValueFixture(kind = 'input') {
  const input = fixture();
  const control = input.element(kind === 'input' ? 'INPUT' : 'BUTTON', {
    fontSize: kind === 'input' ? '16px' : '14px', textAlign: 'right',
    borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px',
    backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', boxShadow: 'none',
    outlineStyle: 'none', outlineWidth: '0px', outlineColor: 'rgb(40, 120, 240)',
  }, rectangle(16, 120, 240, 44));
  control.type = kind === 'input' ? 'text' : 'button';
  control.setAttribute('data-makeui-native-value', kind);
  input.region.append(control); input.document.hit = control; input.document.activeElement = null;
  return { ...input, owner: input.region, control, kind, phase: 'rest' };
}

test('宿主原生值区：只有明确归属的文本输入／按钮触发器可验，UA盒框与矮触控必须失败', () => {
  for (const kind of ['input', 'trigger']) {
    const input = nativeValueFixture(kind);
    checks.assertMobileNativeValueSurface(input);
    input.control.style.appearance = 'auto';
    checks.assertMobileNativeValueSurface(input); // appearance 名称自身不证明出现原生盒框。
    input.control.style.borderTopWidth = '2px';
    assert.throws(() => checks.assertMobileNativeValueSurface(input), /盒框|边框/);
    input.control.style.borderTopWidth = '0px'; input.control.box = rectangle(16, 120, 240, 25);
    assert.throws(() => checks.assertMobileNativeValueSurface(input), /44/);
    input.control.box = rectangle(16, 120, 240, 44);
    input.control.setAttribute('data-makeui-native-value', '');
    assert.throws(() => checks.assertMobileNativeValueSurface(input), /宿主|归属/);
  }
  const input = nativeValueFixture();
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, owner: input.control }), /宿主|归属/);
  input.control.readOnly = true;
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /只读/);
  input.control.readOnly = false;
  input.control.type = 'number';
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /原生|文本/);
  const trigger = nativeValueFixture('trigger'); trigger.control.type = 'submit';
  assert.throws(() => checks.assertMobileNativeValueSurface(trigger), /button/);
});

test('宿主原生值区：输入16px、背景及对齐有效；仅真实关联label可以扩展44px触控', () => {
  const input = nativeValueFixture();
  input.control.style.fontSize = '14px';
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /16px/);
  input.control.style.fontSize = '16px'; input.control.style.backgroundColor = 'rgb(0, 0, 255)';
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /背景/);
  input.control.style.backgroundColor = 'rgba(0, 0, 0, 0)'; input.control.style.textAlign = 'left';
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /右|对齐/);
  input.control.style.textAlign = 'right'; input.control.box = rectangle(16, 130, 240, 24);
  const label = input.element('LABEL', {}, rectangle(16, 120, 240, 44));
  label.control = input.control; label.append(input.control); input.owner.append(label);
  checks.assertMobileNativeValueSurface({ ...input, hitTarget: label });
  label.control = null;
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, hitTarget: label }), /label|关联/);
  const div = input.element('DIV', {}, rectangle(16, 120, 240, 44)); div.append(input.control); input.owner.append(div);
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, hitTarget: div }), /label|输入|触控/);
});

test('宿主原生值区：常态／指针无框，键盘必须真实聚焦且保留可见提示', () => {
  const input = nativeValueFixture();
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, phase: 'keyboard-focus' }), /焦点|聚焦/);
  input.document.activeElement = input.control;
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, phase: 'keyboard-focus' }), /焦点|提示/);
  input.control.style.outlineStyle = 'solid'; input.control.style.outlineWidth = '2px';
  checks.assertMobileNativeValueSurface({ ...input, phase: 'keyboard-focus' });
  input.control.style.outlineColor = 'var(--unknown-focus)';
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, phase: 'pointer-focus' }), /未解析/);
  input.control.style.outlineColor = 'rgb(40, 120, 240)';
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, phase: 'pointer-focus' }), /焦点|描边/);
  input.control.style.outlineStyle = 'none'; input.control.style.outlineWidth = '0px';
  checks.assertMobileNativeValueSurface({ ...input, phase: 'pointer-focus' });
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /焦点|聚焦/);
});

test('宿主原生值区：native disabled保留同主题禁用基线与尺寸，无须命中但不能假disabled', () => {
  const input = nativeValueFixture(), reference = input.element('INPUT', {
    backgroundColor: 'rgb(240, 240, 240)', color: 'rgb(100, 100, 100)', opacity: '0.55',
  });
  reference.disabled = true; input.control.disabled = true;
  Object.assign(input.control.style, { backgroundColor: reference.style.backgroundColor, color: reference.style.color, opacity: '0.55' });
  delete input.document.elementFromPoint;
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /禁用.*参考|基线/);
  checks.assertMobileNativeValueSurface({ ...input, disabledReference: reference });
  input.control.style.opacity = '1';
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, disabledReference: reference }), /禁用/);
  input.control.style.opacity = '0.55'; input.control.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, disabledReference: reference }), /禁用/);
});

test('宿主原生值区：Chrome序列化flow-end的真实触发器样式不被误拒，左侧仍失败', () => {
  const input = nativeValueFixture('trigger');
  Object.assign(input.control.style, {
    display: 'flex', direction: 'ltr', flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'flow-end', alignItems: 'center', textAlign: 'right',
  });
  checks.assertMobileNativeValueSurface(input);
  input.control.style.justifyContent = 'flow-start';
  assert.throws(() => checks.assertMobileNativeValueSurface(input), /行尾/);
});

// 以下注入矩形与命中结果仅验证工具逻辑，不是浏览器布局／可点击证明。
const rectangle = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
function fixture() {
  const document = {
    defaultView: { innerWidth: 390, innerHeight: 844, getComputedStyle: node => node.style },
    documentElement: { clientWidth: 390, clientHeight: 844 },
    elementFromPoint: () => document.hit,
  };
  const element = (tagName = 'DIV', style = {}, box = rectangle(16, 120, 358, 100)) => {
    const attributes = new Map();
    const node = {
      tagName, isConnected: true, ownerDocument: document, parentElement: null, children: [],
      style: { display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto',
        color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)', borderTopColor: 'rgb(0, 0, 0)',
        borderRightColor: 'rgb(0, 0, 0)', borderBottomColor: 'rgb(0, 0, 0)', borderLeftColor: 'rgb(0, 0, 0)',
        fontFamily: 'Arial', fontSize: '14px', fontWeight: '400', lineHeight: '20px',
        borderTopWidth: '0px', borderTopStyle: 'none', borderRadius: '0px', paddingTop: '12px',
        boxShadow: 'none', ...style },
      box, disabled: false, readOnly: false, type: 'text',
      getBoundingClientRect() { return this.box; },
      getAttribute: name => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, String(value)),
      hasAttribute: name => attributes.has(name),
      contains(child) { for (let current = child; current; current = current.parentElement) if (current === this) return true; return false; },
      matches(selector) {
        if (selector === ':disabled') return this.disabled;
        return selector.split(',').some(part => part.trim() === tagName.toLowerCase()
          || (part.trim() === 'a[href]' && tagName === 'A' && this.hasAttribute('href'))
          || (part.trim() === '[role="button"]' && this.getAttribute('role') === 'button'));
      },
      querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
      append(child) { this.children.push(child); child.parentElement = this; },
    };
    return node;
  };
  const region = element(), entry = element('BUTTON', {}, rectangle(322, 720, 48, 48));
  const navigation = element('NAV', {}, rectangle(0, 784, 390, 60));
  document.hit = entry;
  return { document, element, region, entry, navigation };
}

for (const state of ['normal', 'empty', 'search-empty']) {
  test(`工具逻辑：${state} 列表均需保留已授权的新建入口`, () => {
    const input = fixture();
    checks.assertMobileCreateEntry({ ...input, state, creatable: true });
    assert.throws(() => checks.assertMobileCreateEntry({ ...input, state, creatable: true, entry: null }), /新建入口/);
    input.entry.style.display = 'none';
    assert.throws(() => checks.assertMobileCreateEntry({ ...input, state, creatable: true }), /新建入口/);
  });
}

test('工具逻辑：FAB (322,788,48,48) 与导航重叠，即使高 z-index 仍拒绝', () => {
  const input = fixture();
  input.entry.box = rectangle(322, 788, 48, 48);
  input.entry.style.zIndex = '9999';
  input.document.hit = input.navigation;
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: true }), /导航|命中/);
  input.document.hit = input.entry;
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: true }), /导航/);
});

test('工具逻辑：新建入口距底部导航至少8px，精确核验上下边界', () => {
  const input = fixture();
  for (const gap of [0, 7, 7.999]) {
    input.entry.box = rectangle(322, 784 - 48 - gap, 48, 48);
    assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: true }), /8px/);
  }
  for (const gap of [8, 8.001, 12]) {
    input.entry.box = rectangle(322, 784 - 48 - gap, 48, 48);
    checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: true });
  }
});

test('工具逻辑：非重叠入口也必须真实命中；子节点命中允许，局部遮挡拒绝', () => {
  const input = fixture(), overlay = input.element(), icon = input.element('SPAN');
  input.entry.append(icon); input.document.hit = icon;
  checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: true });
  input.document.hit = overlay;
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: true }), /命中/);
  input.document.elementFromPoint = (x, y) => x === 346 && y === 744 ? input.entry : overlay;
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: true }), /命中/);
});

test('工具逻辑：缺少真实命中能力、零矩形、视口外和不可交互入口不能通过', () => {
  for (const mutate of [
    input => { delete input.document.elementFromPoint; },
    input => { input.entry.box = rectangle(0, 0, 0, 0); },
    input => { input.entry.box = rectangle(370, 720, 48, 48); },
    input => { input.entry.box = rectangle(322, 720, 43, 48); },
    input => { input.entry.disabled = true; },
    input => { input.entry.style.pointerEvents = 'none'; },
    input => { input.entry.setAttribute('aria-disabled', 'true'); },
    input => { const ancestor = input.element(); ancestor.setAttribute('inert', ''); ancestor.append(input.entry); },
  ]) {
    const input = fixture(); mutate(input);
    assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'empty', creatable: true }), /命中|真实浏览器|视口|44|交互/);
  }
});

test('新建资格与状态必须明确；无资格时不允许显示新建入口', () => {
  const input = fixture();
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal' }), /资格/);
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'unknown', creatable: true }), /状态/);
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: false }), /资格/);
  checks.assertMobileCreateEntry({ state: 'normal', creatable: false, entry: null });
});

test('无新建资格时透明但仍可聚焦／命中的旧入口必须拒绝', () => {
  const input = fixture(); input.entry.style.opacity = '0';
  assert.throws(() => checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: false }), /资格|交互/);
  input.entry.disabled = true;
  checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: false });
  input.entry.disabled = false;
  const wrapper = input.element(); wrapper.setAttribute('inert', ''); wrapper.append(input.entry);
  checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: false });
  wrapper.setAttribute('inert', ''); input.entry.isConnected = false;
  checks.assertMobileCreateEntry({ ...input, state: 'normal', creatable: false });
});

function searchFixture(presentation = 'desktop') {
  const input = fixture(), search = input.element('INPUT', {}, rectangle(16, 64, 240, 32));
  const reference = input.element('INPUT', {}, rectangle(16, 10, 240, 32));
  const hitTarget = presentation === 'phone' ? input.element('LABEL', {}, rectangle(16, 58, 240, 44)) : search;
  if (presentation === 'phone') { search.style.fontSize = '16px'; hitTarget.append(search); hitTarget.control = search; }
  input.region.append(hitTarget); input.document.hit = search;
  return { ...input, input: search, reference, presentation, hitTarget };
}

test('工具逻辑：手机、PC／平板列表都必须具有区域内可编辑且可命中的搜索', () => {
  for (const presentation of ['phone', 'desktop', 'tablet']) {
    const input = searchFixture(presentation);
    checks.assertListSearch(input);
    for (const key of ['disabled', 'readOnly']) {
      input.input[key] = true;
      assert.throws(() => checks.assertListSearch(input), /搜索/);
      input.input[key] = false;
    }
    assert.throws(() => checks.assertListSearch({ ...input, input: null }), /搜索/);
    input.input.type = 'hidden';
    assert.throws(() => checks.assertListSearch(input), /搜索/);
    input.input.type = 'text'; input.input.parentElement = null;
    assert.throws(() => checks.assertListSearch(input), /搜索/);
  }
});

test('PC 搜索按独立宿主主库参考节点核验等效样式，不依赖 AntD 私有类名', () => {
  const input = searchFixture();
  assert.throws(() => checks.assertListSearch({ ...input, reference: null }), /参考/);
  assert.throws(() => checks.assertListSearch({ ...input, reference: input.input }), /独立/);
  input.input.className = 'project-search'; input.reference.className = 'unrelated-public-input';
  checks.assertListSearch(input);
  for (const [property, value] of [['fontSize', '18px'], ['borderTopWidth', '2px'], ['borderTopStyle', 'solid'],
    ['backgroundColor', 'rgb(20, 20, 20)'], ['borderRadius', '18px'], ['boxShadow', '0 2px 8px black']]) {
    const previous = input.input.style[property]; input.input.style[property] = value;
    assert.throws(() => checks.assertListSearch(input), /搜索.*样式|颜色/);
    input.input.style[property] = previous;
  }
});

test('工具逻辑：PC 搜索不能保留不同实际高度或额外背景图', () => {
  const input = searchFixture();
  input.input.box = rectangle(16, 64, 240, 60);
  assert.throws(() => checks.assertListSearch(input), /搜索.*高度/);
  input.input.box = rectangle(16, 64, 240, 32);
  input.input.style.backgroundImage = 'linear-gradient(red, blue)';
  assert.throws(() => checks.assertListSearch(input), /搜索.*样式/);
});

test('工具逻辑：手机搜索保留中号视觉与独立 44px 触控外围，实际输入字号至少16px', () => {
  const input = searchFixture('phone');
  checks.assertListSearch(input);
  input.hitTarget.box = rectangle(16, 58, 240, 43);
  assert.throws(() => checks.assertListSearch(input), /44/);
  input.hitTarget.box = rectangle(16, 58, 240, 44);
  input.input.style.fontSize = '14px';
  assert.throws(() => checks.assertListSearch(input), /16px/);
});

test('工具逻辑：44px搜索外围只能是实际输入或原生关联label，不能接受无效div外围', () => {
  const input = searchFixture('phone');
  input.hitTarget.tagName = 'DIV';
  assert.throws(() => checks.assertListSearch(input), /label|关联/);
  input.hitTarget.tagName = 'LABEL'; input.hitTarget.control = null;
  assert.throws(() => checks.assertListSearch(input), /label|关联/);
  input.hitTarget.control = input.reference;
  assert.throws(() => checks.assertListSearch(input), /label|关联/);
  input.hitTarget.control = input.input;
  checks.assertListSearch(input);
  input.input.box = rectangle(16, 58, 240, 44);
  checks.assertListSearch({ ...input, hitTarget: input.input });
});

function cardFixture() {
  const input = fixture(), card = input.region, reference = input.element();
  const action = input.element('BUTTON', {}, rectangle(270, 170, 44, 44));
  card.append(action); input.document.hit = action;
  return { ...input, card, reference, actions: [action] };
}

test('工具逻辑：卡片显式动作集合具备44px触控区，不把正文链接猜成业务动作', () => {
  const input = cardFixture();
  checks.assertMobileCardBaseline(input);
  const link = input.element('A', {}, rectangle(16, 140, 100, 20)); link.setAttribute('href', 'https://example.com');
  input.card.append(link);
  checks.assertMobileCardBaseline(input);
  input.actions[0].box = rectangle(270, 170, 32, 44);
  assert.throws(() => checks.assertMobileCardBaseline(input), /44/);
  input.actions[0].box = rectangle(270, 170, 44, 44); input.document.hit = input.card;
  assert.throws(() => checks.assertMobileCardBaseline(input), /命中/);
});

test('工具逻辑：保留可见native disabled动作并验44px尺寸，启用后恢复严格命中', () => {
  const input = cardFixture(), action = input.actions[0];
  action.disabled = true; input.document.hit = input.card;
  checks.assertMobileCardBaseline(input);
  action.box = rectangle(270, 170, 43, 44);
  assert.throws(() => checks.assertMobileCardBaseline(input), /44/);
  action.box = rectangle(270, 170, 44, 44); action.style.display = 'none';
  assert.throws(() => checks.assertMobileCardBaseline(input), /可见/);
  action.style.display = 'block'; action.disabled = false;
  assert.throws(() => checks.assertMobileCardBaseline(input), /命中/);
});

test('手机卡片颜色可投影，字体、密度、圆角与阴影漂移必须单独拒绝', () => {
  const input = cardFixture();
  input.card.style.color = 'rgb(120, 0, 220)';
  checks.assertMobileCardBaseline(input);
  for (const [property, value] of [['fontSize', '20px'], ['fontFamily', 'Desktop Font'], ['paddingTop', '24px'],
    ['borderRadius', '24px'], ['boxShadow', '0 4px 20px black']]) {
    const previous = input.card.style[property]; input.card.style[property] = value;
    assert.throws(() => checks.assertMobileCardBaseline(input), /冻结.*样式/);
    input.card.style[property] = previous;
  }
  const title = input.element(), referenceTitle = input.element();
  input.card.append(title); input.reference.append(referenceTitle);
  title.style.fontWeight = '700';
  assert.throws(() => checks.assertMobileCardBaseline({ ...input, parts: [{ element: title, reference: referenceTitle }] }), /冻结.*样式/);
});

test('手机卡片表面属于冻结基线，不能被透明色或PC普通底色覆盖', () => {
  const input = cardFixture();
  input.card.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  assert.throws(() => checks.assertMobileCardBaseline(input), /颜色/);
});

test('工具逻辑：列表真实相邻卡片间距与灰页面分别对照独立冻结基线', () => {
  const input = fixture(), reference = input.element(), page = input.element(), pageReference = input.element();
  const cards = [input.element(), input.element()], referenceCards = [input.element(), input.element()];
  for (let index = 0; index < 2; index++) {
    cards[index].box = rectangle(16, 120 + index * 112, 358, 100);
    referenceCards[index].box = rectangle(16, 120 + index * 112, 358, 100);
    input.region.append(cards[index]); reference.append(referenceCards[index]);
  }
  page.style.backgroundColor = pageReference.style.backgroundColor = 'rgb(245, 246, 248)';
  page.append(input.region); pageReference.append(reference);
  const options = { list: input.region, reference, cards, referenceCards, page, pageReference };
  checks.assertMobileListBaseline(options);
  cards[1].box = rectangle(16, 240, 358, 100);
  assert.throws(() => checks.assertMobileListBaseline(options), /间距/);
  cards[1].box = referenceCards[1].box; page.style.backgroundColor = 'rgb(255, 255, 255)';
  assert.throws(() => checks.assertMobileListBaseline(options), /颜色/);
});

test('主题颜色必须来自独立公开主题参考节点的已解析计算值', () => {
  const input = fixture(), reference = input.element('BUTTON');
  checks.assertThemeColorsMatch({ element: input.entry, reference, properties: ['color', 'backgroundColor'] });
  input.entry.style.backgroundColor = 'rgb(230, 0, 20)';
  assert.throws(() => checks.assertThemeColorsMatch({ element: input.entry, reference, properties: ['backgroundColor'] }), /颜色/);
  assert.throws(() => checks.assertThemeColorsMatch({ element: input.entry, reference: input.entry }), /独立/);
  for (const value of ['', 'var(--brand)', 'currentColor', 'inherit']) {
    input.entry.style.color = value; reference.style.color = value;
    assert.throws(() => checks.assertThemeColorsMatch({ element: input.entry, reference, properties: ['color'] }), /解析/);
  }
  assert.throws(() => checks.assertThemeColorsMatch({ element: input.entry, reference, properties: ['fontSize'] }), /颜色属性/);
  assert.throws(() => checks.assertThemeColorsMatch({ element: input.entry, reference, properties: [] }), /颜色属性/);
});

test('验收工具及声明可以独立复制到含空格目录', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'makeui generated page acceptance '));
  try {
    const target = join(directory, 'mobile-form-acceptance.mjs');
    await cp(acceptanceModule, target);
    await cp(acceptanceDeclaration, join(directory, 'mobile-form-acceptance.d.mts'));
    const isolated = await import(pathToFileURL(target).href);
    const input = fixture();
    isolated.assertMobileCreateEntry({ ...input, state: 'search-empty', creatable: true });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

// CI 反馈依赖阶段显式提供 jsdom；默认根脚本不下载／安装依赖。
const dependencyArgument = process.argv.find(argument => argument.startsWith('--dependencies='));
const dependencies = dependencyArgument?.slice('--dependencies='.length) ?? process.env.MAKE_FEEDBACK_TEST_DEPENDENCIES;
if (dependencyArgument && !dependencies) throw new Error('--dependencies 必须指定测试 node_modules 目录');

function noCreateEntryDom(visibility = 'hidden', opacity = '1') {
  const require = createRequire(resolve(dependencies, '__create_entry_test__.cjs'));
  const { JSDOM } = require(resolve(dependencies, 'jsdom'));
  const dom = new JSDOM(`<section id="owner"><button id="entry" style="visibility:${visibility};opacity:${opacity}"><span id="wrapper"><span id="label">新建记录</span></span></button></section>`);
  const document = dom.window.document;
  const entry = document.getElementById('entry'), wrapper = document.getElementById('wrapper'), label = document.getElementById('label');
  entry.getBoundingClientRect = () => { throw new Error('无创建资格的DOM检查不应要求几何替身'); };
  return { dom, entry, wrapper, label, owner: document.getElementById('owner'),
    check: state => checks.assertMobileCreateEntry({ state, creatable: false, entry }),
  };
}
const createDomOptions = { skip: dependencies ? false : '显式提供依赖后执行无资格入口的真实DOM回归' };

test('无创建资格真实DOM：hidden/collapse后代恢复可见必须拒绝，透明度不构成交互阻断', createDomOptions, () => {
  for (const visibility of ['hidden', 'collapse']) for (const opacity of ['1', '0']) {
    const view = noCreateEntryDom(visibility, opacity);
    try {
      view.label.style.visibility = 'visible';
      assert.equal(view.dom.window.getComputedStyle(view.entry).visibility, visibility);
      assert.equal(view.dom.window.getComputedStyle(view.label).visibility, 'visible');
      for (const state of ['normal', 'empty', 'search-empty']) {
        assert.throws(() => view.check(state), /资格|交互/, `${state}: ${visibility}, opacity=${opacity}不能掩盖恢复可见的孙代`);
      }
    } finally { view.dom.window.close(); }
  }
});

test('无创建资格真实DOM：正常隐藏继承、卸载和真正祖先阻断继续通过', createDomOptions, () => {
  for (const visibility of ['hidden', 'collapse']) {
    const view = noCreateEntryDom(visibility);
    try {
      assert.equal(view.dom.window.getComputedStyle(view.label).visibility, visibility);
      view.check('normal');
      view.label.style.visibility = 'visible';
      view.owner.style.display = 'none'; view.check('empty');
      view.owner.style.display = ''; view.owner.setAttribute('inert', ''); view.check('search-empty');
      view.owner.removeAttribute('inert'); view.entry.disabled = true; view.check('normal');
      view.entry.disabled = false; view.entry.remove(); view.check('empty');
    } finally { view.dom.window.close(); }
  }
});

test('无创建资格真实DOM：display:none/inert分支可跳过，禁用子控件不代表父入口已阻断', createDomOptions, () => {
  const view = noCreateEntryDom('hidden', '0');
  try {
    view.label.style.visibility = 'visible';
    for (const block of ['display', 'inert']) {
      if (block === 'display') view.wrapper.style.display = 'none'; else view.wrapper.setAttribute('inert', '');
      view.check('normal');
      view.wrapper.style.display = ''; view.wrapper.removeAttribute('inert');
      assert.throws(() => view.check('normal'), /资格|交互/);
    }
    const child = view.dom.window.document.createElement('button');
    child.disabled = true; child.style.visibility = 'visible';
    const text = view.dom.window.document.createElement('span'); text.textContent = '禁用子入口'; child.append(text);
    const container = view.dom.window.document.createElement('div');
    container.style.cssText = 'visibility:hidden;opacity:0'; container.append(child); view.owner.append(container);
    let propagated = 0; container.addEventListener('click', () => propagated++);
    text.click(); assert.equal(propagated, 1, 'DOM事件可从子控件内容传播到父入口；不是浏览器命中证明');
    assert.throws(() => checks.assertMobileCreateEntry({state:'normal',creatable:false,entry:container}), /资格|交互/);
    child.style.visibility = 'hidden';
    checks.assertMobileCreateEntry({state:'normal',creatable:false,entry:container});
    child.disabled = false;
    checks.assertMobileCreateEntry({state:'normal',creatable:false,entry:container});
    child.style.visibility = 'visible';
    assert.throws(() => checks.assertMobileCreateEntry({state:'normal',creatable:false,entry:container}), /资格|交互/);
  } finally { view.dom.window.close(); }
});

test('无创建资格真实DOM：样式动态恢复与再次隐藏按当前子树判定', createDomOptions, () => {
  const view = noCreateEntryDom();
  try {
    view.check('normal');
    view.label.style.visibility = 'visible'; assert.throws(() => view.check('normal'), /资格|交互/);
    view.wrapper.style.display = 'none'; view.check('normal');
    view.wrapper.style.display = ''; assert.throws(() => view.check('normal'), /资格|交互/);
    view.label.style.visibility = ''; view.check('normal');
    view.entry.style.cssText = 'visibility:visible;opacity:0';
    assert.throws(() => view.check('normal'), /资格|交互/, '仅透明的入口仍可能聚焦或命中');
  } finally { view.dom.window.close(); }
});

function frozenSurfaceDom() {
  const require = createRequire(resolve(dependencies, '__frozen_surface_test__.cjs'));
  const { JSDOM } = require(resolve(dependencies, 'jsdom'));
  const dom = new JSDOM(`<style>
    .page, .list { background-color: rgb(245, 246, 248) }
    .card { background-color: rgb(255, 255, 255); font: 14px/20px Arial; padding: 12px; border-radius: 0; box-shadow: none }
  </style><section class="page" id="page"><div class="list" id="list">
    <article class="card" id="card">业务记录</article><article class="card" id="card-next">第二条记录</article>
  </div></section><section class="page" id="page-reference"><div class="list" id="list-reference">
    <article class="card" id="card-reference">业务记录</article><article class="card" id="card-next-reference">第二条记录</article>
  </div></section>`);
  const document = dom.window.document, node = id => document.getElementById(id);
  const cards = [node('card'), node('card-next')], referenceCards = [node('card-reference'), node('card-next-reference')];
  // 这里只验证工具的 CSSOM 比较分支；矩形替身不构成宿主浏览器几何证据。
  for (const elements of [cards, referenceCards]) elements.forEach((element, index) => {
    element.getBoundingClientRect = () => rectangle(16, 120 + index * 112, 358, 100);
  });
  for (const id of ['page', 'page-reference', 'list', 'list-reference']) {
    node(id).getBoundingClientRect = () => rectangle(0, 0, 390, 500);
  }
  const options = {
    card: cards[0], reference: referenceCards[0], actions: [],
    list: node('list'), cards, referenceCards, page: node('page'), pageReference: node('page-reference'),
  };
  return { dom, node, options,
    checkCard: () => checks.assertMobileCardBaseline(options),
    checkList: () => checks.assertMobileListBaseline({ ...options, reference: node('list-reference') }),
  };
}

for (const target of ['card', 'list', 'page']) {
  for (const [property, value] of [['opacity', '0.2'], ['filter', 'blur(3px)']]) {
    test(`真实 CSSOM：手机${target}的${property}偏离同状态冻结参考必须拒绝`, {
      skip: dependencies ? false : '显式提供依赖后执行冻结整体绘制效果回归',
    }, () => {
      const view = frozenSurfaceDom();
      try {
        const check = target === 'card' ? view.checkCard : view.checkList;
        check();
        view.node(target).style[property] = value;
        assert.throws(check, new RegExp(property));
      } finally { view.dom.window.close(); }
    });
  }
}

test('真实 CSSOM：同状态批准的透明度／滤镜可以保留，品牌文字颜色变化不误拒', {
  skip: dependencies ? false : '显式提供依赖后执行冻结整体绘制效果回归',
}, () => {
  const view = frozenSurfaceDom();
  try {
    for (const target of ['card', 'list', 'page']) {
      for (const id of [target, `${target}-reference`]) {
        Object.assign(view.node(id).style, { opacity: '0.55', filter: 'contrast(0.9)' });
      }
      view.node(target).style.color = 'rebeccapurple';
    }
    view.checkCard(); view.checkList();
  } finally { view.dom.window.close(); }
});

test('真实 DOM／CSS 计算值：主题参照与继承漂移；JSDOM 不构成几何证据', { skip: dependencies ? false : '在反馈依赖阶段设置 MAKE_FEEDBACK_TEST_DEPENDENCIES 执行真实 DOM 测试' }, () => {
  const require = createRequire(resolve(dependencies, '__generated_page_test__.cjs'));
  // 只从显式目录加载，不向父目录回退并误用其他项目的安装。
  const { JSDOM } = require(resolve(dependencies, 'jsdom'));
  const dom = new JSDOM(`<style>
    .theme { color: rgb(12, 34, 56); background-color: rgb(240, 245, 250) }
    .frozen { font: 14px/20px Arial; padding:12px; border-radius:0; box-shadow:none }
  </style><div class="theme"><button id="actual">新建</button><button id="reference">主题参考</button></div>
  <div id="card" class="frozen"></div><div id="frozen" class="frozen"></div>`);
  try {
    const document = dom.window.document, element = document.querySelector('#actual'), reference = document.querySelector('#reference');
    checks.assertThemeColorsMatch({ element, reference, properties: ['color', 'backgroundColor'] });
    element.style.color = 'red';
    assert.throws(() => checks.assertThemeColorsMatch({ element, reference, properties: ['color'] }), /颜色/);
    assert.throws(() => checks.assertMobileCreateEntry({ state: 'normal', creatable: true, entry: element }), /真实浏览器/);
    const input = document.createElement('input'), region = document.createElement('div');
    region.append(input); document.body.append(region);
    assert.throws(() => checks.assertListSearch({ region, input, presentation: 'phone' }), /真实浏览器/);
    // 此处仅注入卡片矩形以进入 CSS 比较分支，仍然只是工具逻辑测试。
    const card = document.querySelector('#card'), frozen = document.querySelector('#frozen');
    for (const node of [card, frozen]) node.getBoundingClientRect = () => rectangle(16, 120, 358, 100);
    checks.assertMobileCardBaseline({ card, reference: frozen, actions: [] });
    card.style.color = 'rebeccapurple';
    checks.assertMobileCardBaseline({ card, reference: frozen, actions: [] });
    card.style.paddingTop = '24px';
    assert.throws(() => checks.assertMobileCardBaseline({ card, reference: frozen, actions: [] }), /冻结.*样式/);
    card.style.paddingTop = '12px';
    const action = document.createElement('button'); action.disabled = true; card.append(action);
    action.getBoundingClientRect = () => rectangle(270, 170, 44, 44);
    assert.equal(action.matches(':disabled'), true);
    checks.assertMobileCardBaseline({ card, reference: frozen, actions: [action] });
    action.disabled = false;
    assert.throws(() => checks.assertMobileCardBaseline({ card, reference: frozen, actions: [action] }), /命中能力/);
    // 同样只注入搜索矩形／命中以进入关联检查；原生 label.control 由真实 DOM 决定。
    const label = document.createElement('label'); region.replaceChildren(label); label.append(input);
    input.style.fontSize = '16px';
    input.getBoundingClientRect = () => rectangle(16, 64, 240, 32);
    label.getBoundingClientRect = () => rectangle(16, 58, 240, 44);
    document.elementFromPoint = () => input;
    assert.equal(label.control, input);
    checks.assertListSearch({ region, input, presentation: 'phone', hitTarget: label });
    label.htmlFor = 'missing-input';
    assert.equal(label.control, null);
    assert.throws(() => checks.assertListSearch({ region, input, presentation: 'phone', hitTarget: label }), /关联/);
  } finally { dom.window.close(); }
});

test('选定 Skill 的实际声明在隔离目录通过 TypeScript 消费合同', { skip: dependencies ? false : '显式提供测试依赖后执行声明编译' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'makeui acceptance declaration '));
  try {
    await cp(acceptanceModule, join(directory, 'mobile-form-acceptance.mjs'));
    await cp(acceptanceDeclaration, join(directory, 'mobile-form-acceptance.d.mts'));
    await writeFile(join(directory, 'consumer.mts'), `
      import { assertMobileCreateEntry, assertListSearch, assertMobileCardBaseline, assertMobileListBaseline, assertThemeColorsMatch, assertMobileNativeValueSurface } from './mobile-form-acceptance.mjs';
      declare const element: HTMLElement;
      declare const input: HTMLInputElement;
      declare const label: HTMLLabelElement;
      assertMobileCreateEntry({state:'search-empty',creatable:true,entry:element,navigation:element});
      assertMobileCreateEntry({state:'normal',creatable:false,entry:null});
      assertListSearch({region:element,input,presentation:'phone',control:input,hitTarget:label});
      assertMobileCardBaseline({card:element,reference:element,actions:[element] as const,parts:[{element,reference:element}] as const});
      assertMobileListBaseline({list:element,reference:element,cards:[element] as const,referenceCards:[element] as const,page:element,pageReference:element});
      assertThemeColorsMatch({element,reference:element,properties:['color','backgroundColor'] as const});
      assertMobileNativeValueSurface({owner:element,control:input,kind:'input',phase:'rest',hitTarget:input});
      assertMobileNativeValueSurface({owner:element,control:input,kind:'input',phase:'pointer-focus'});
      // @ts-expect-error 宿主值区不能传任意 Element 冒充原生控件
      assertMobileNativeValueSurface({owner:element,control:element,kind:'input',phase:'rest'});
      // @ts-expect-error 焦点阶段不可省略
      assertMobileNativeValueSurface({owner:element,control:input,kind:'input'});
      // @ts-expect-error 不支持将普通字段门禁用于包控件或未知类型
      assertMobileNativeValueSurface({owner:element,control:input,kind:'package-field',phase:'rest'});
      // @ts-expect-error 列表状态不能省略
      assertMobileCreateEntry({creatable:true,entry:element});
      // @ts-expect-error 颜色门禁不接受几何属性
      assertThemeColorsMatch({element,reference:element,properties:['fontSize']});
      // @ts-expect-error 不能以任意 Element 冒充搜索输入
      assertListSearch({region:element,input:element,presentation:'desktop'});
      // @ts-expect-error 任意div不能充当可核验的手机搜索触控外围
      assertListSearch({region:element,input,presentation:'phone',hitTarget:element});
    `);
    const result = spawnSync(process.execPath, [resolve(dependencies, 'typescript/bin/tsc'), '--strict', '--noEmit',
      '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--lib', 'DOM,ES2022', 'consumer.mts'],
    { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('工具真实DOM：原生UA边框、宿主归属、实际焦点与禁用状态；矩形替身不构成App验收', { skip: dependencies ? false : '显式提供测试依赖后执行真实DOM状态检查' }, () => {
  const require = createRequire(resolve(dependencies, '__native_value_test__.cjs'));
  const { JSDOM } = require(resolve(dependencies, 'jsdom'));
  const dom = new JSDOM(`<style>
    .owner { background-color:rgb(255,255,255) }
    .owned { display:block; font-size:16px; text-align:right; border:0; background:transparent; box-shadow:none; outline:none }
  </style><div class="owner"><input id="actual" data-makeui-native-value="input"></div><input id="reference" class="owned" disabled>`);
  try {
    const document = dom.window.document, owner = document.querySelector('.owner');
    const control = document.querySelector('#actual'), reference = document.querySelector('#reference');
    // 只为到达CSS／焦点分支注入矩形与命中；真实宿主必须由浏览器提供。
    control.getBoundingClientRect = () => rectangle(16, 120, 240, 44);
    document.elementFromPoint = () => control;
    control.style.fontSize = '16px'; control.style.textAlign = 'right';
    const input = { owner, control, kind: 'input', phase: 'rest' };
    assert.throws(() => checks.assertMobileNativeValueSurface(input), /UA盒框|边框/);
    control.className = 'owned';
    checks.assertMobileNativeValueSurface(input);
    control.removeAttribute('data-makeui-native-value');
    assert.throws(() => checks.assertMobileNativeValueSurface(input), /归属/);
    control.setAttribute('data-makeui-native-value', 'input');
    control.focus();
    assert.throws(() => checks.assertMobileNativeValueSurface(input), /真实.*焦点|真实 activeElement/);
    assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, phase: 'keyboard-focus' }), /焦点.*提示/);
    Object.assign(control.style, { outlineWidth: '2px', outlineStyle: 'solid', outlineColor: 'rgb(40, 120, 240)' });
    checks.assertMobileNativeValueSurface({ ...input, phase: 'keyboard-focus' });
    assert.throws(() => checks.assertMobileNativeValueSurface({ ...input, phase: 'pointer-focus' }), /描边/);
    Object.assign(control.style, { outlineWidth: '0px', outlineStyle: 'none' });
    checks.assertMobileNativeValueSurface({ ...input, phase: 'pointer-focus' });
    control.blur(); control.disabled = true;
    control.style.opacity = reference.style.opacity = '0.55';
    delete document.elementFromPoint;
    checks.assertMobileNativeValueSurface({ ...input, disabledReference: reference });
  } finally { dom.window.close(); }
});
