import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as checks from '../skills/makeui/scripts/mobile-form-acceptance.mjs';

// 工具单测的 DOM 接口替身；真实组件和样式由宿主测试验证。
function element(style = {}, textContent = '内容') {
  const node = {
    isConnected: true, textContent, parentElement: null, hidden: false,
    ownerDocument: {
      defaultView: { innerWidth: 360, innerHeight: 800, getComputedStyle: el => el.style },
      documentElement: { clientWidth: 360, clientHeight: 800 },
      createTreeWalker: root => {
        let index = 0;
        return { nextNode: () => root.textNodes[index++] ?? null };
      },
    },
    style: { display: 'block', visibility: 'visible', opacity: '1', ...style },
    getAttribute: () => null, contains: child => {
      for (let current = child; current; current = current.parentElement) if (current === node) return true;
      return false;
    },
    querySelectorAll: () => [], matches: selector => selector === ':disabled',
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  };
  node.textNodes = [{ textContent, parentElement: node }];
  return node;
}

const rectangle = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
function geometryFixture() {
  const region = element(), status = element(), indicator = element({}, ''), message = element({}, '正在加载候选项'), footer = element();
  for (const node of [status, indicator, message, footer]) node.ownerDocument = region.ownerDocument;
  status.parentElement = region; indicator.parentElement = status; message.parentElement = status;
  region.getBoundingClientRect = () => rectangle(0, 100, 360, 300);
  status.getBoundingClientRect = () => rectangle(0, 100, 360, 300);
  indicator.getBoundingClientRect = () => rectangle(110, 240, 20, 20);
  // 文案元素可以占满整行，实际文字只占其中一部分；不能使用元素外框冒充文字。
  message.getBoundingClientRect = () => rectangle(0, 100, 360, 300);
  footer.getBoundingClientRect = () => rectangle(0, 400, 360, 50);
  message.textRects = [rectangle(140, 240, 110, 20)];
  message.ownerDocument.createRange = () => ({ selectNodeContents() {}, getClientRects: () => message.textRects });
  return { region, status, indicator, message, footer };
}

function clippingAncestor(input, style, box) {
  const ancestor = element(style);
  ancestor.getBoundingClientRect = () => rectangle(...box);
  ancestor.clientLeft = 0; ancestor.clientTop = 0;
  ancestor.clientWidth = box[2]; ancestor.clientHeight = box[3];
  ancestor.offsetWidth = box[2]; ancestor.offsetHeight = box[3];
  input.region.parentElement = ancestor;
  return ancestor;
}

test('同一断言接受编译前后合法网格，并拒绝双列及缺少样式', () => {
  for (const gridTemplateColumns of ['1fr', 'minmax(0, 1fr)', '328px', '[start] minmax(0, 1fr) [end]']) {
    checks.assertFormColumns(element({ display: 'grid', gridTemplateColumns }), 1);
  }
  checks.assertFormColumns(element({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }), 2);
  assert.throws(() => checks.assertFormColumns(element({ display: 'grid', gridTemplateColumns: '1fr 1fr' }), 1), /列数/);
  assert.throws(() => checks.assertFormColumns(element(), 1), /grid/);
  assert.throws(() => checks.assertFormColumns(element(), 0), /正整数/);
  assert.throws(() => checks.assertFormColumns(element({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, 100px)' }), 1), /解析/);
});

test('flex 只读值必须真正使用行尾布局，text-align 不能掩盖错误', () => {
  checks.assertRightAlignedValue(element({ display: 'inline-flex', justifyContent: 'flex-end' }));
  checks.assertRightAlignedValue(element({ textAlign: 'right' }));
  assert.throws(() => checks.assertRightAlignedValue(element({ display: 'flex', textAlign: 'right', justifyContent: 'flex-start' })), /行尾/);
  assert.throws(() => checks.assertRightAlignedValue(element({ display: 'inline', textAlign: 'right' })), /行尾/);
});

test('只读值按水平轴、反向排列和 RTL 判断右端，不能把底部当右侧', () => {
  const flex = (style) => element({ display: 'flex', ...style });
  for (const style of [
    { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end' },
    { flexDirection: 'column-reverse', alignItems: 'flex-start', justifyContent: 'flex-end' },
    { flexDirection: 'row-reverse', justifyContent: 'flex-end' },
    { direction: 'rtl', justifyContent: 'end' },
    { direction: 'rtl', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' },
  ]) assert.throws(() => checks.assertRightAlignedValue(flex(style)), /行尾/);
  for (const style of [
    { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start' },
    { flexDirection: 'column-reverse', alignItems: 'flex-end' },
    { flexDirection: 'row-reverse', justifyContent: 'flex-start' },
    { direction: 'rtl', justifyContent: 'flex-start' },
    { direction: 'rtl', flexDirection: 'row-reverse', justifyContent: 'flex-end' },
    { direction: 'rtl', flexDirection: 'column', alignItems: 'flex-start' },
    { flexDirection: 'column', flexWrap: 'wrap-reverse', alignItems: 'flex-start' },
  ]) checks.assertRightAlignedValue(flex(style));
  assert.throws(() => checks.assertRightAlignedValue(element({ direction: 'rtl', textAlign: 'end' })), /行尾/);
  assert.throws(() => checks.assertRightAlignedValue(flex({ writingMode: 'vertical-rl', justifyContent: 'flex-end' })), /不支持/);
});

test('flow与flex别名按实际水平轴等价，覆盖反向排列、LTR／RTL及反向换行，start／end语义独立', () => {
  // 逐项列出物理右侧，避免以被测实现的布尔公式计算期望。
  const cases = [
    ['row', 'ltr', ['end', 'end', 'end']],
    ['row', 'rtl', ['start', 'start', 'start']],
    ['row-reverse', 'ltr', ['start', 'start', 'start']],
    ['row-reverse', 'rtl', ['end', 'end', 'end']],
    ['column', 'ltr', ['end', 'end', 'start']],
    ['column', 'rtl', ['start', 'start', 'end']],
    ['column-reverse', 'ltr', ['end', 'end', 'start']],
    ['column-reverse', 'rtl', ['start', 'start', 'end']],
  ];
  for (const [flexDirection, direction, rightEdges] of cases) {
    for (const [index, flexWrap] of ['nowrap', 'wrap', 'wrap-reverse'].entries()) {
      const horizontal = flexDirection.startsWith('column') ? 'alignItems' : 'justifyContent';
      const vertical = horizontal === 'alignItems' ? 'justifyContent' : 'alignItems';
      const right = rightEdges[index], left = right === 'end' ? 'start' : 'end';
      for (const verticalAlignment of ['flow-start', 'flow-end']) {
        const style = { display: 'flex', flexDirection, direction, flexWrap, textAlign: 'right', [vertical]: verticalAlignment };
        for (const alias of ['flow', 'flex']) {
          checks.assertRightAlignedValue(element({ ...style, [horizontal]: `${alias}-${right}` }));
          assert.throws(() => checks.assertRightAlignedValue(element({ ...style, [horizontal]: `${alias}-${left}` })), /行尾/);
        }
        const logicalRight = direction === 'ltr' ? 'end' : 'start';
        const logicalLeft = direction === 'ltr' ? 'start' : 'end';
        checks.assertRightAlignedValue(element({ ...style, [horizontal]: logicalRight }));
        assert.throws(() => checks.assertRightAlignedValue(element({ ...style, [horizontal]: logicalLeft })), /行尾/);
      }
    }
  }
  assert.throws(() => checks.assertRightAlignedValue(element({ textAlign: 'flow-end' })), /行尾/);
});

test('禁用颜色来自同主题基线，不固定颜色，也拒绝非禁用和未解析变量', () => {
  const style = { backgroundColor: 'rgb(245, 245, 245)', color: 'rgb(120, 120, 120)' };
  const reference = element(style), control = element(style);
  checks.assertDisabledMatches(control, reference);
  control.style.backgroundColor = 'rgb(0, 100, 120)';
  assert.throws(() => checks.assertDisabledMatches(control, reference), /backgroundColor/);
  control.style.backgroundColor = 'var(--disabled)';
  assert.throws(() => checks.assertDisabledMatches(control, reference), /解析/);
  control.matches = () => false;
  assert.throws(() => checks.assertDisabledMatches(control, reference), /禁用/);
});

test('加载必须有可见图形和提示，旧候选或隐藏反馈会失败', () => {
  const region = element(), status = element({ display: 'flex', alignItems: 'center', justifyContent: 'center' }, '正在加载候选项');
  const indicator = element({}, ''), message = element({}, '正在加载候选项');
  status.parentElement = region; indicator.parentElement = status; message.parentElement = status;
  const input = { region, status, indicator, message, optionSelector: '[role=option]' };
  checks.assertLoadingFeedback(input);
  indicator.hidden = true;
  indicator.style.display = 'none'; // DOM 替身提供 UA 隐藏规则生效后的计算样式。
  assert.throws(() => checks.assertLoadingFeedback(input), /可见/);
  indicator.hidden = false;
  indicator.style.display = 'block';
  region.querySelectorAll = () => [element()];
  assert.throws(() => checks.assertLoadingFeedback(input), /候选/);
});

test('加载文字必须可见且非空，不能借隐藏文案或图标文字通过', () => {
  const input = geometryFixture();
  input.status.style = { ...input.status.style, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  input.optionSelector = '[role=option]';
  checks.assertLoadingFeedback(input);
  input.message.style.display = 'none';
  assert.throws(() => checks.assertLoadingFeedback(input), /文案|文字/);
  input.message.style.display = 'block';
  input.message.textNodes[0].textContent = '   ';
  assert.throws(() => checks.assertLoadingFeedback(input), /文案|文字/);
  const hidden = element({ display: 'none' }); hidden.parentElement = input.message;
  input.message.textNodes = [{ textContent: '隐藏的提示', parentElement: hidden }];
  assert.throws(() => checks.assertLoadingFeedback(input), /文案|文字/);
  assert.throws(() => checks.assertLoadingFeedback({ ...input, message: input.status }), /文案|文字/);
});

test('反馈可见性不限制 Flex、Grid 或定位，中心偏移由几何断言拒绝', () => {
  for (const style of [
    { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    { display: 'grid', alignItems: 'center', justifyItems: 'center' },
    { display: 'block', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
  ]) {
    const input = geometryFixture();
    input.status.style = { ...input.status.style, ...style };
    input.optionSelector = '[role=option]';
    checks.assertLoadingFeedback(input);
    checks.assertLoadingGeometry(input);
    input.indicator.getBoundingClientRect = () => rectangle(0, 100, 20, 20);
    input.message.textRects = [rectangle(30, 100, 110, 20)];
    checks.assertLoadingFeedback(input); // DOM 反馈通过不是布局通过。
    assert.throws(() => checks.assertLoadingGeometry(input), /居中/);
  }
});

test('visibility 恢复为可见的旧候选不能借隐藏祖先通过', () => {
  const input = geometryFixture();
  input.status.style = { ...input.status.style, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const wrapper = element({ visibility: 'hidden' }), option = element({ visibility: 'visible' });
  wrapper.parentElement = input.region; option.parentElement = wrapper;
  input.optionSelector = '[role=option]';
  input.region.querySelectorAll = () => [option];
  assert.throws(() => checks.assertLoadingFeedback(input), /旧候选/);
  option.style.visibility = 'hidden'; // 外部 computedStyle 边界已解析继承后的结果。
  checks.assertLoadingFeedback(input);
});

test('可见文案可覆盖祖先 visibility，display 和 opacity 的祖先阻断仍有效', () => {
  const input = geometryFixture();
  input.status.style = { ...input.status.style, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  input.optionSelector = '[role=option]';
  const wrapper = element({ visibility: 'hidden' });
  wrapper.parentElement = input.status; input.message.parentElement = wrapper;
  checks.assertLoadingFeedback(input);
  checks.assertLoadingGeometry(input);
  for (const style of [{ display: 'none' }, { opacity: '0' }]) {
    wrapper.style = { ...wrapper.style, ...style };
    assert.throws(() => checks.assertLoadingFeedback(input), /文案/);
    assert.throws(() => checks.assertLoadingGeometry(input), /文案/);
    wrapper.style = { display: 'block', visibility: 'hidden', opacity: '1' };
  }
  input.message.style.visibility = 'hidden';
  assert.throws(() => checks.assertLoadingFeedback(input), /文案/);
});

test('hidden 属性不能掩盖计算样式已恢复显示的候选及其祖先', () => {
  for (const target of ['option', 'wrapper']) {
    const input = geometryFixture(), wrapper = element(), option = element();
    input.optionSelector = '[role=option]';
    wrapper.parentElement = input.region; option.parentElement = wrapper;
    input.region.querySelectorAll = () => [option];
    const hidden = target === 'option' ? option : wrapper;
    hidden.hidden = true; hidden.style.display = 'none';
    checks.assertLoadingFeedback(input);
    for (const display of ['block', 'flex']) {
      hidden.style.display = display;
      assert.throws(() => checks.assertLoadingFeedback(input), /旧候选/);
    }
  }
});

test('内容隐藏阻断文案及后代，但不能掩盖候选自身的可见外框', () => {
  for (const target of ['message', 'wrapper']) {
    const input = geometryFixture(), wrapper = element();
    input.optionSelector = '[role=option]';
    wrapper.parentElement = input.status; input.message.parentElement = wrapper;
    const hidden = target === 'message' ? input.message : wrapper;
    hidden.style.contentVisibility = 'hidden';
    assert.throws(() => checks.assertLoadingFeedback(input), /文案|文字/);
    assert.throws(() => checks.assertLoadingGeometry(input), /文案|文字/);
    hidden.style.contentVisibility = 'visible';
    checks.assertLoadingFeedback(input);
    checks.assertLoadingGeometry(input);
  }
  const input = geometryFixture(), option = element({ contentVisibility: 'hidden' });
  option.parentElement = input.region;
  input.optionSelector = '[role=option]';
  input.region.querySelectorAll = () => [option];
  assert.throws(() => checks.assertLoadingFeedback(input), /旧候选/);
});

test('候选隐藏不能掩盖恢复可见的后代，真正隐藏整棵子树仍可通过', () => {
  const input = geometryFixture(), option = element({ visibility: 'hidden' }), label = element();
  input.optionSelector = '[role=option]';
  option.parentElement = input.region; label.parentElement = option;
  input.region.querySelectorAll = () => [option];
  option.querySelectorAll = () => [label];
  assert.throws(() => checks.assertLoadingFeedback(input), /旧候选/);
  for (const style of [{ display: 'none' }, { opacity: '0' }, { contentVisibility: 'hidden' }]) {
    option.style = { display: 'block', visibility: 'hidden', opacity: '1', ...style };
    checks.assertLoadingFeedback(input);
  }
  option.style = { display: 'block', visibility: 'hidden', opacity: '1' };
  label.style.visibility = 'hidden';
  checks.assertLoadingFeedback(input);
});

test('视口 fixed 区域跳过未建立包含块的 overflow 祖先', () => {
  for (const style of [{}, { position: 'relative' }, { position: 'fixed' }, { willChange: 'opacity' }, { contain: 'size style' }]) {
    const input = geometryFixture();
    input.region.style.position = 'fixed';
    clippingAncestor(input, { overflow: 'hidden', ...style }, [0, 0, 360, 50]);
    checks.assertLoadingGeometry(input);
  }
});

test('fixed 遇到真正的包含块仍检查裁剪，不能一律忽略祖先', () => {
  for (const style of [
    { transform: 'matrix(1, 0, 0, 1, 0, 0)' }, { translate: '0px' }, { scale: '1' },
    { perspective: '1000px' }, { filter: 'blur(0px)' }, { backdropFilter: 'blur(0px)' },
    { contain: 'layout' }, { contain: 'paint' }, { contain: 'content' }, { contain: 'strict' },
    { willChange: 'transform' }, { willChange: 'filter' }, { willChange: 'opacity, TRANSFORM' }, { contentVisibility: 'auto' },
  ]) {
    const input = geometryFixture();
    input.region.style.position = 'fixed';
    clippingAncestor(input, { overflow: 'hidden', ...style }, [0, 0, 360, 50]);
    assert.throws(() => checks.assertLoadingGeometry(input), /裁剪|可见/);
  }
});

test('display:contents 不生成包含块或裁剪盒', () => {
  for (const position of ['static', 'fixed']) {
    const input = geometryFixture();
    input.region.style.position = position;
    clippingAncestor(input, { display: 'contents', transform: 'matrix(1, 0, 0, 1, 0, 0)', overflow: 'hidden' }, [0, 0, 360, 50]);
    checks.assertLoadingGeometry(input);
  }
});

test('建立包含块的 paint containment 即使 overflow 可见仍裁剪内容', () => {
  const input = geometryFixture();
  input.region.style.position = 'fixed';
  clippingAncestor(input, { contain: 'paint', overflow: 'visible' }, [0, 0, 360, 50]);
  assert.throws(() => checks.assertLoadingGeometry(input), /裁剪|可见/);
});

test('absolute 跳过中间 overflow，但包含块及其上层裁剪仍生效', () => {
  const input = geometryFixture();
  input.region.style.position = 'absolute';
  const intermediate = clippingAncestor(input, { overflow: 'hidden' }, [0, 0, 360, 50]);
  const containing = clippingAncestor(input, { position: 'relative', overflow: 'hidden' }, [0, 0, 360, 800]);
  input.region.parentElement = intermediate; intermediate.parentElement = containing;
  checks.assertLoadingGeometry(input);
  containing.clientHeight = 50;
  assert.throws(() => checks.assertLoadingGeometry(input), /裁剪|可见/);
});

test('加载图形自身的 fixed 定位也参与裁剪链判断', () => {
  const input = geometryFixture(), wrapper = element({ overflow: 'hidden' });
  wrapper.parentElement = input.status; input.indicator.parentElement = wrapper;
  wrapper.getBoundingClientRect = () => rectangle(0, 100, 50, 300);
  Object.assign(wrapper, { clientLeft: 0, clientTop: 0, clientWidth: 50, clientHeight: 300, offsetWidth: 50, offsetHeight: 300 });
  input.indicator.style.position = 'fixed';
  checks.assertLoadingGeometry(input);
  wrapper.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';
  assert.throws(() => checks.assertLoadingGeometry(input), /裁剪|可见/);
});

test('几何验收拒绝 jsdom 零矩形，真实布局需居中且不能覆盖底栏', () => {
  const input = geometryFixture();
  checks.assertLoadingGeometry(input);
  input.region.getBoundingClientRect = () => rectangle(0, 0, 0, 0);
  assert.throws(() => checks.assertLoadingGeometry(input), /真实浏览器/);
  input.region.getBoundingClientRect = () => rectangle(0, 100, 360, 300);
  input.footer.getBoundingClientRect = () => rectangle(0, 390, 360, 50);
  assert.throws(() => checks.assertLoadingGeometry(input), /底栏/);
});

test('外框居中但图标和文案偏到左上角，几何检查必须拒绝', () => {
  const input = geometryFixture();
  input.indicator.getBoundingClientRect = () => rectangle(0, 100, 20, 20);
  input.message.textRects = [rectangle(30, 100, 110, 20)];
  assert.throws(() => checks.assertLoadingGeometry(input), /居中/);
});

test('文案偏移、多行、空白和无真实 Range 几何分别验证', () => {
  const input = geometryFixture();
  input.message.textRects = [rectangle(140, 100, 110, 20)];
  assert.throws(() => checks.assertLoadingGeometry(input), /居中/);
  // 上下排列也可合法居中，图标自身不必在整区垂直中点。
  input.indicator.getBoundingClientRect = () => rectangle(170, 220, 20, 20);
  input.message.textRects = [rectangle(125, 250, 110, 20), rectangle(140, 270, 80, 10)];
  checks.assertLoadingGeometry(input);
  input.message.textRects = [];
  assert.throws(() => checks.assertLoadingGeometry(input), /文字/);
  delete input.message.ownerDocument.createRange;
  assert.throws(() => checks.assertLoadingGeometry(input), /真实浏览器/);
});

test('几何检查保留状态外框边界，并拒绝缺少或隐藏的文案', () => {
  const input = geometryFixture();
  input.status.getBoundingClientRect = () => rectangle(0, 100, 360, 400);
  assert.throws(() => checks.assertLoadingGeometry(input), /超出/);
  input.status.getBoundingClientRect = () => rectangle(0, 100, 360, 300);
  assert.throws(() => checks.assertLoadingGeometry({ ...input, message: undefined }), /文案/);
  input.message.hidden = true;
  input.message.style.display = 'none';
  assert.throws(() => checks.assertLoadingGeometry(input), /文案/);
});

test('加载几何不能把裁剪区域外的图形和文字判为可见', () => {
  const input = geometryFixture();
  input.footer = undefined;
  clippingAncestor(input, { overflow: 'hidden' }, [0, 100, 360, 200]);
  input.region.getBoundingClientRect = () => rectangle(0, 100, 360, 600);
  input.status.getBoundingClientRect = () => rectangle(0, 100, 360, 600);
  input.indicator.getBoundingClientRect = () => rectangle(110, 390, 20, 20);
  input.message.textRects = [rectangle(140, 390, 110, 20)];
  assert.throws(() => checks.assertLoadingGeometry(input), /裁剪|可见/);
});

test('滚动后按实际可见区域居中可通过，视口和单轴裁剪仍检查', () => {
  const input = geometryFixture();
  const ancestor = clippingAncestor(input, { overflowY: 'auto', overflowX: 'visible' }, [0, 100, 360, 200]);
  input.region.getBoundingClientRect = () => rectangle(0, 0, 360, 600);
  input.status.getBoundingClientRect = () => rectangle(0, 0, 360, 600);
  input.indicator.getBoundingClientRect = () => rectangle(110, 190, 20, 20);
  input.message.textRects = [rectangle(140, 190, 110, 20)];
  // scrollTop 已反映在实时矩形内，不能再减一次，也不能因存在滚动容器一律拒绝。
  ancestor.scrollTop = 100;
  checks.assertLoadingGeometry({ ...input, footer: undefined });
  ancestor.style.overflowY = 'visible';
  ancestor.getBoundingClientRect = () => rectangle(0, 100, 20, 200);
  input.region.getBoundingClientRect = () => rectangle(0, 100, 360, 300);
  input.status.getBoundingClientRect = () => rectangle(0, 100, 360, 300);
  input.indicator.getBoundingClientRect = () => rectangle(110, 240, 20, 20);
  input.message.textRects = [rectangle(140, 240, 110, 20)];
  checks.assertLoadingGeometry(input); // visible 祖先自身的小尺寸不裁剪后代。
  input.region.ownerDocument.defaultView.visualViewport = { offsetLeft: 0, offsetTop: 0, width: 360, height: 200 };
  assert.throws(() => checks.assertLoadingGeometry(input), /裁剪|可见/);
});

test('文案内部被截断也拒绝；无法量取的裁剪不伪装通过', () => {
  const input = geometryFixture();
  input.message.style.overflow = 'hidden';
  input.message.clientLeft = 0; input.message.clientTop = 0;
  input.message.clientWidth = 50; input.message.clientHeight = 10;
  input.message.offsetWidth = 50; input.message.offsetHeight = 10;
  input.message.getBoundingClientRect = () => rectangle(140, 240, 50, 10);
  assert.throws(() => checks.assertLoadingGeometry(input), /裁剪|可见/);
  input.message.style.overflow = 'visible';
  const ancestor = clippingAncestor(input, { overflow: 'hidden' }, [0, 0, 360, 800]);
  ancestor.clientWidth = 0;
  assert.throws(() => checks.assertLoadingGeometry(input), /量取|测量|真实浏览器/);
});

test('文档滚动视口不能按已滚动的根元素矩形再裁剪一次', () => {
  for (const quirks of [false, true]) {
    const input = geometryFixture();
    const scroller = clippingAncestor(input, { overflow: 'auto' }, [0, -400, 360, 800]);
    input.region.ownerDocument.scrollingElement = scroller;
    if (!quirks) input.region.ownerDocument.documentElement = scroller;
    input.region.getBoundingClientRect = () => rectangle(0, 600, 360, 200);
    input.status.getBoundingClientRect = () => rectangle(0, 600, 360, 200);
    input.indicator.getBoundingClientRect = () => rectangle(110, 690, 20, 20);
    input.message.textRects = [rectangle(140, 690, 110, 20)];
    checks.assertLoadingGeometry({ ...input, footer: undefined });
  }
});

test('完整工具可复制到含空格目录，无仓库路径或外部依赖', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mobile form acceptance '));
  try {
    const target = join(dir, 'mobile-form-acceptance.mjs');
    await cp(new URL('../skills/makeui/scripts/mobile-form-acceptance.mjs', import.meta.url), target);
    await cp(new URL('../skills/makeui/scripts/mobile-form-acceptance.d.mts', import.meta.url), join(dir, 'mobile-form-acceptance.d.mts'));
    const isolated = await import(pathToFileURL(target).href);
    isolated.assertFormColumns(element({ display: 'grid', gridTemplateColumns: '1fr' }), 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
