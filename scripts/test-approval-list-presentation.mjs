import assert from 'node:assert/strict';
import test from 'node:test';
import { assertApprovalListPresentation } from '../skills/make-app-approval/scripts/verify-list-presentation.mjs';

// 几何故障注入只验证工具的判定；真实布局由宿主浏览器传入实际 DOM。
const expandFour = values => [values[0], values[1] ?? values[0], values[2] ?? values[0], values[3] ?? values[1] ?? values[0]];
// 夹具提供 computed longhands；shorthand 仅用于描述已有回归中的输入，
// 不让测试把真实 CSSStyleDeclaration 简化为只有一个数的假样式。
const computedStyle = declarations => {
  const explicit = { ...declarations };
  const value = { display: 'block', visibility: 'visible', paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px', borderRadius: '0px', borderWidth: '0px', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', ...declarations };
  for (const [index, side] of ['Top', 'Right', 'Bottom', 'Left'].entries()) {
    const property = `border${side}Width`;
    Object.defineProperty(value, property, { enumerable: true, get: () => explicit[property] ?? expandFour(value.borderWidth.trim().split(/\s+/))[index], set: next => { explicit[property] = next; } });
  }
  for (const [index, corner] of ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].entries()) {
    const property = `border${corner}Radius`;
    Object.defineProperty(value, property, { enumerable: true, get: () => {
      if (explicit[property] !== undefined) return explicit[property];
      const [horizontal, vertical = horizontal] = value.borderRadius.split('/').map(part => part.trim().split(/\s+/));
      return `${expandFour(horizontal)[index]} ${expandFour(vertical)[index]}`;
    }, set: next => { explicit[property] = next; } });
  }
  return value;
};
const element = (x, y, width, height, style = {}) => {
  const value = {
    getBoundingClientRect: () => ({ left: x, top: y, right: x + width, bottom: y + height, width, height }),
    ownerDocument: { defaultView: { getComputedStyle: target => target.style } },
    style: computedStyle(style),
    contains: target => value === target || value.children?.some(child => child.contains(target)),
    clientHeight: height,
    scrollHeight: height,
  };
  return value;
};
const desktop = () => ({
  presentation: 'desktop',
  tab: 'pending',
  listRoot: element(0, 0, 1000, 700),
  tabs: element(0, 0, 1000, 40, { paddingLeft: '12px', paddingRight: '12px' }),
  panel: element(0, 40, 1000, 660, { paddingLeft: '12px', paddingRight: '12px', paddingTop: '12px', paddingBottom: '12px' }),
  filters: element(12, 52, 976, 44, { paddingBottom: '12px' }),
  table: element(12, 96, 976, 592),
  canvas: element(12, 96, 976, 592),
  emptyState: element(400, 350, 200, 30),
});
const mobile = () => {
  const icon = element(24, 68, 16, 16);
  const iconButton = element(18, 62, 28, 28);
  iconButton.children = [icon];
  const input = element(44, 62, 290, 28, { fontSize: '16px' });
  const searchSurface = element(16, 62, 358, 28, { borderRadius: '6px' });
  searchSurface.children = [iconButton, input];
  return {
    presentation: 'mobile',
    tab: 'pending',
    listRoot: element(0, 0, 390, 800),
    tabs: element(0, 0, 390, 44, { paddingLeft: '16px', paddingRight: '16px' }),
    panel: element(0, 44, 390, 756),
    filters: element(0, 44, 390, 112, { paddingLeft: '16px', paddingRight: '16px' }),
    cards: element(0, 156, 390, 644, { paddingLeft: '16px', paddingRight: '16px' }),
    searchSurface, searchIcon: icon, searchButton: iconButton, searchInput: input,
    dateTrigger: element(16, 106, 173, 28, { borderRadius: '999px' }),
    applicantTrigger: element(201, 106, 173, 28, { borderRadius: '999px' }),
    dateHitTarget: element(16, 98, 173, 44),
    applicantHitTarget: element(201, 98, 173, 44),
  };
};

test('PC 实际布局包含 12px 留白、对齐高度链及表格内空态', () => {
  assert.doesNotThrow(() => assertApprovalListPresentation(desktop()));
});
test('PC 已发起保留含流程状态的五列表头人工待验项', () => {
  const value = desktop(); value.tab = 'initiated';
  assert.equal(assertApprovalListPresentation(value).remaining[0], '五列表头绘制（含流程状态）');
});
test('标准模式由包根容器独占左右留白，Tabs 不再重复叠加', () => {
  const value = desktop();
  value.listRoot.style.paddingLeft = '12px'; value.listRoot.style.paddingRight = '12px';
  value.tabs = element(12, 0, 976, 40);
  value.panel = element(12, 40, 976, 660, { paddingTop: '12px', paddingBottom: '12px' });
  assert.doesNotThrow(() => assertApprovalListPresentation(value));
});
test('手机入口同排胶囊、16px 留白与一体搜索', () => {
  assert.doesNotThrow(() => assertApprovalListPresentation(mobile()));
});
test('手机长日期换行后可比短申请人高，两列视觉中心及点击区域仍对齐', () => {
  const value = mobile();
  value.wrappedTriggers = true;
  value.dateTrigger = element(16, 96, 173, 48, { borderRadius: '999px' });
  value.dateHitTarget = element(16, 92, 173, 56);
  assert.doesNotThrow(() => assertApprovalListPresentation(value));
});
for (const [label, mutate, error] of [
  ['PC 页签贴边', value => { value.tabs.style.paddingLeft = '0px'; }, /页签.*12/],
  ['PC 面板缺少内边距', value => { value.panel.style.paddingTop = '0px'; }, /面板.*12/],
  ['PC 筛选表格不对齐', value => { value.table = element(0, 96, 1000, 592); }, /对齐/],
  ['PC 筛选下间距错误', value => { value.table = element(12, 84, 976, 604); }, /12px/],
  ['PC form 已含间距后又叠加外部 12px', value => { value.table = element(12, 108, 976, 580); }, /重复|紧接/],
  ['PC form 缺少底部间距', value => { value.filters.style.paddingBottom = '0px'; }, /12px/],
  ['表格没有实际画布', value => { value.canvas = undefined; }, /画布/],
  ['空态落在表格之外', value => { value.emptyState = element(400, 80, 200, 10); }, /表格/],
  ['表格没有占满剩余高度', value => { value.table = element(12, 96, 976, 100); }, /剩余高度/],
  ['页面本身滚动', value => { value.listRoot.scrollHeight = 900; }, /页面.*滚动/],
]) test(label, () => { const value = desktop(); mutate(value); assert.throws(() => assertApprovalListPresentation(value), error); });

for (const [label, mutate, error] of [
  ['手机叠加面板 padding', value => { value.panel.style.paddingLeft = '16px'; }, /面板.*0/],
  ['手机搜索图标脱离输入表面', value => { value.searchSurface.children = [value.searchInput]; }, /一体/],
  ['手机输入自己画边框', value => { value.searchInput.style.borderWidth = '1px'; }, /一体/],
  ['手机输入正确但搜索按钮仍有独立边框', value => { value.searchButton.style.borderWidth = '1px'; }, /搜索按钮.*边框/],
  ['手机搜索按钮有独立底色', value => { value.searchButton.style.backgroundColor = 'rgb(255, 255, 255)'; }, /搜索按钮.*底色/],
  ['手机输入字号过小', value => { value.searchInput.style.fontSize = '13px'; }, /16px/],
  ['手机筛选沿用大号字段入口', value => { value.dateTrigger = element(16, 106, 173, 44, { borderRadius: '999px' }); value.applicantTrigger = element(201, 106, 173, 44, { borderRadius: '999px' }); }, /28px/],
  ['手机入口不是胶囊', value => { value.applicantTrigger.style.borderRadius = '4px'; }, /胶囊/],
  ['手机入口上下错位', value => { value.applicantTrigger = element(201, 113, 173, 28, { borderRadius: '999px' }); }, /同排/],
  ['手机入口点击范围不足', value => { value.dateHitTarget = element(16, 106, 173, 28); }, /44px/],
  ['手机入口点击范围重叠', value => { value.dateHitTarget = element(16, 98, 300, 44); }, /重叠/],
]) test(label, () => { const value = mobile(); mutate(value); assert.throws(() => assertApprovalListPresentation(value), error); });

test('拒绝 jsdom 零矩形冒充真实浏览器布局', () => {
  const value = desktop(); value.listRoot = element(0, 0, 0, 0);
  assert.throws(() => assertApprovalListPresentation(value), /真实浏览器/);
});

const initiated = () => {
  const value = mobile();
  value.tab = 'initiated';
  for (const name of ['searchSurface', 'searchIcon', 'searchButton', 'searchInput', 'applicantTrigger', 'applicantHitTarget']) delete value[name];
  value.filters = element(0, 44, 390, 68, { paddingLeft: '16px', paddingRight: '16px' });
  value.cards = element(0, 112, 390, 688, { paddingLeft: '16px', paddingRight: '16px' });
  value.dateTrigger = element(16, 64, 173, 28, { borderRadius: '999px' });
  value.dateHitTarget = element(16, 56, 173, 44);
  return value;
};

test('已发起手机页只显示日期和卡片，不要求任务搜索与申请人', () => {
  assert.doesNotThrow(() => assertApprovalListPresentation(initiated()));
});
test('已发起仍必须提供日期实际入口', () => {
  const value = initiated(); delete value.dateHitTarget;
  assert.throws(() => assertApprovalListPresentation(value), /日期.*缺失/);
});
test('已发起不得借任务搜索引用凑齐验收', () => {
  const value = initiated(); value.searchInput = mobile().searchInput;
  assert.throws(() => assertApprovalListPresentation(value), /已发起.*搜索/);
});
test('已发起不得保留申请人入口', () => {
  const value = initiated(); value.applicantTrigger = mobile().applicantTrigger;
  assert.throws(() => assertApprovalListPresentation(value), /已发起.*申请人/);
});
test('待处理和已完成仍必须有搜索与申请人入口', () => {
  for (const tab of ['pending', 'approved']) {
    const value = mobile(); value.tab = tab; delete value.applicantTrigger;
    assert.throws(() => assertApprovalListPresentation(value), /申请人.*缺失/);
  }
});
test('没有明确合法页签时不能默认成另一种验收模式', () => {
  for (const tab of [undefined, '', 'all', 'constructor']) {
    const value = mobile(); value.tab = tab;
    assert.throws(() => assertApprovalListPresentation(value), /tab.*pending.*approved.*initiated/);
  }
});

for (const target of ['searchInput', 'searchButton']) {
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) test(`${target} 的 ${side} 单侧边框不能漏检`, () => {
    const value = mobile(); value[target].style[`border${side}Width`] = '2px';
    assert.throws(() => assertApprovalListPresentation(value), /一体|搜索按钮.*边框/);
  });
}
for (const target of ['dateTrigger', 'applicantTrigger']) {
  for (const corner of ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']) test(`${target} 的 ${corner} 方角不能漏检`, () => {
    const value = mobile(); value[target].style[`border${corner}Radius`] = '0px';
    assert.throws(() => assertApprovalListPresentation(value), /胶囊/);
  });
}
test('真实 longhands 为零时不依赖边框简写是否可序列化', () => {
  const value = mobile(); value.searchButton.style.borderWidth = '';
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) value.searchButton.style[`border${side}Width`] = '0px';
  assert.doesNotThrow(() => assertApprovalListPresentation(value));
});
test('真实四角 longhands 有值时不依赖圆角简写是否可序列化', () => {
  const value = mobile(); value.dateTrigger.style.borderRadius = '';
  for (const corner of ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']) value.dateTrigger.style[`border${corner}Radius`] = '999px';
  assert.doesNotThrow(() => assertApprovalListPresentation(value));
});
test('百分比与超大圆角经物理收敛后仍可形成合法胶囊', () => {
  for (const radius of ['50%', '999px', '999px / 999px']) {
    const value = mobile(); value.dateTrigger.style.borderRadius = radius;
    assert.doesNotThrow(() => assertApprovalListPresentation(value));
  }
});
test('椭圆半径被整体收敛后不足半高时拒绝', () => {
  for (const radius of ['999px / 14px', '14px / 28px']) {
    const value = mobile(); value.dateTrigger.style.borderRadius = radius;
    assert.throws(() => assertApprovalListPresentation(value), /胶囊/);
  }
});

for (const target of ['tabs', 'filters', 'cards']) test(`手机 ${target} 外层额外缩进不能被局部16px padding掩盖`, () => {
  const value = mobile(), old = value[target].getBoundingClientRect();
  value[target] = element(24, old.top, 342, old.height, { paddingLeft: '16px', paddingRight: '16px' });
  assert.throws(() => assertApprovalListPresentation(value), /16px|对齐/);
});
test('手机合法包装层持有16px留白时允许子元素padding为0', () => {
  const value = mobile();
  for (const target of ['tabs', 'filters', 'cards']) {
    const old = value[target].getBoundingClientRect();
    value[target] = element(16, old.top, 358, old.height);
  }
  assert.doesNotThrow(() => assertApprovalListPresentation(value));
});
test('已发起也按实际内容边缘检查卡片对齐', () => {
  const value = initiated(); value.cards = element(24, 112, 342, 688, { paddingLeft: '16px', paddingRight: '16px' });
  assert.throws(() => assertApprovalListPresentation(value), /16px|对齐/);
});

for (const [target, sides] of [['tabs', ['Left', 'Right']], ['panel', ['Top', 'Right', 'Bottom', 'Left']]]) {
  for (const side of sides) {
    test(`PC ${target} ${side} 边框与 padding 共同形成12px时通过`, () => {
      const value = desktop();
      value[target].style[`border${side}Width`] = '2px';
      value[target].style[`padding${side}`] = '10px';
      assert.doesNotThrow(() => assertApprovalListPresentation(value));
    });
    test(`PC ${target} ${side} 边框额外造成14px有效留白时拒绝`, () => {
      const value = desktop(); value[target].style[`border${side}Width`] = '2px';
      assert.throws(() => assertApprovalListPresentation(value), /12px/);
    });
  }
}

for (const side of ['Left', 'Right', 'Top', 'Bottom']) test(`PC ${side} 内容边缘的1px容差不能逐层累积为2px`, () => {
  const value = desktop(); value.panel.style[`padding${side}`] = '13px';
  const left = side === 'Left' ? 14 : 12, top = side === 'Top' ? 54 : 52;
  const width = ['Left', 'Right'].includes(side) ? 974 : 976;
  value.filters = element(left, top, width, 44, { paddingBottom: '12px' });
  const bottom = side === 'Bottom' ? 686 : 688;
  value.table = element(left, top + 44, width, bottom - top - 44);
  value.canvas = element(left, top + 44, width, bottom - top - 44);
  assert.throws(() => assertApprovalListPresentation(value), /对齐|12px/);
});
test('PC 表格不能通过筛选栏的1px误差继续偏移到14px', () => {
  const value = desktop();
  value.filters = element(13, 52, 975, 44, { paddingBottom: '12px' });
  value.table = element(14, 96, 974, 592);
  value.canvas = element(14, 96, 974, 592);
  assert.throws(() => assertApprovalListPresentation(value), /对齐/);
});

for (const target of ['searchInput', 'searchButton']) {
  test(`${target} 允许不同RGB值和已计算现代颜色的零透明度背景`, () => {
    for (const color of ['transparent', 'rgba(255, 255, 255, 0)', 'rgba(12, 34, 56, 0.0)', 'rgb(255 0 0 / 0%)',
      'hsl(120deg 100% 50% / 0)', 'hwb(120 0% 0% / 0)', 'lab(50% 20 10 / 0)', 'lch(50% 20 60deg / 0)',
      'oklab(0.5 0.1 0.2 / 0)', 'oklch(0.5 0.1 60 / 0)', 'color(display-p3 1 0 0 / 0)', 'color(srgb 1 0 0 / 0%)']) {
      const value = mobile(); value[target].style.backgroundColor = color;
      assert.doesNotThrow(() => assertApprovalListPresentation(value), color);
    }
  });
  test(`${target} 拒绝非零透明度、未知或未完成计算的背景色`, () => {
    for (const color of ['rgba(255, 255, 255, 0.01)', 'rgb(255 0 0 / 1%)', 'color(display-p3 1 0 0 / 0.1)',
      'lab(50% 20 10 / 0.5)', 'rgb(0 0 0)', '', 'inherit', 'var(--background)', 'mystery(1 2 3 / 0)',
      'rgba(bogus, 0, 0, 0)', 'rgba(none, 0, 0, 0)', 'rgba(0, 0, 0, none)',
      'rgb(1 2 3 / calc(0))', 'color(unknown 1 0 0 / 0)', 'rgb(1 2 / 0)']) {
      const value = mobile(); value[target].style.backgroundColor = color;
      assert.throws(() => assertApprovalListPresentation(value), /底色/, color);
    }
  });
  test(`${target} 允许多个none背景层`, () => {
    const value = mobile(); value[target].style.backgroundImage = 'none, none';
    assert.doesNotThrow(() => assertApprovalListPresentation(value));
  });
  test(`${target} 允许现代计算色中直接绘制按零处理的显式alpha none`, () => {
    for (const color of ['lab(50% 0 0 / none)', 'oklab(0.5 0 0 / none)', 'color(display-p3 1 0 0 / none)']) {
      const value = mobile(); value[target].style.backgroundColor = color;
      assert.doesNotThrow(() => assertApprovalListPresentation(value), color);
    }
  });
  test(`${target} 拒绝透明背景色下的独立图片或渐变`, () => {
    for (const image of ['linear-gradient(red, red)', 'url("icon.png")', 'none, linear-gradient(red, blue)',
      'linear-gradient(transparent, transparent)', '', 'var(--image)']) {
      const value = mobile(); value[target].style.backgroundImage = image;
      assert.throws(() => assertApprovalListPresentation(value), /底色/, image);
    }
  });
}
