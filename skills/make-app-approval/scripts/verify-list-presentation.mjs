// 通过宿主公开插槽或测试 ref 取得实际 DOM；本工具不查询公共包私有 class。
// 在真实浏览器中调用；仓库的几何替身测试不构成宿主视觉验收。
const tolerance = 1;
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const close = (actual, expected) => Math.abs(actual - expected) <= tolerance;
const rect = (element, label) => {
  requireValue(element?.getBoundingClientRect, `${label}缺失`);
  const value = element.getBoundingClientRect();
  requireValue(value.width > 0 && value.height > 0, `${label}必须在真实浏览器中有可见几何尺寸，不能以 jsdom 零矩形验收`);
  const style = styles(element);
  requireValue(style.display !== 'none' && style.visibility !== 'hidden', `${label}不可隐藏`);
  return value;
};
const styles = element => element.ownerDocument.defaultView.getComputedStyle(element);
const pixels = value => /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:px)?$/.test(String(value).trim()) ? Number.parseFloat(value) : Number.NaN;
const padding = (element, sides, expected, label) => {
  const style = styles(element);
  for (const side of sides) requireValue(close(pixels(style[`padding${side}`]), expected), `${label} ${side} 内边距必须为 ${expected}px`);
};
const inside = (outer, inner) => inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance && inner.top >= outer.top - tolerance && inner.bottom <= outer.bottom + tolerance;
const contentBox = (element, box) => {
  const style = styles(element);
  return {
    left: box.left + pixels(style.borderLeftWidth) + pixels(style.paddingLeft),
    right: box.right - pixels(style.borderRightWidth) - pixels(style.paddingRight),
    top: box.top + pixels(style.borderTopWidth) + pixels(style.paddingTop),
    bottom: box.bottom - pixels(style.borderBottomWidth) - pixels(style.paddingBottom),
  };
};
const effectiveGutter = (element, box, rootBox, expected, label) => {
  const content = contentBox(element, box);
  requireValue(close(content.left, rootBox.left + expected) && close(content.right, rootBox.right - expected), `${label}相对列表根容器的有效左右留白必须为 ${expected}px，不能重复叠加或错位`);
  return content;
};
const cssNumber = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const numericChannel = new RegExp('^(?:' + cssNumber + '%?|none)$', 'i');
const hueChannel = new RegExp('^(?:' + cssNumber + '(?:deg|grad|rad|turn)?|none)$', 'i');
const alphaNumber = new RegExp('^' + cssNumber + '%?$', 'i');
const colorSpaces = new Set(['srgb', 'srgb-linear', 'display-p3', 'display-p3-linear', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz', 'xyz-d50', 'xyz-d65']);
// 只读 CSSOM 已计算的有限颜色形式，不求值任意 CSS 表达式。
// 直接绘制的现代 alpha none 按零处理，不能扩展到 legacy 逗号语法。
// https://www.w3.org/TR/css-color-4/#missing-color-components
const transparentColor = value => {
  const color = String(value).trim().toLowerCase();
  if (color === 'transparent') return true;
  const match = color.match(/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(([^()]*)\)$/);
  if (!match) return false;
  const [, name, body] = match;
  const legacy = body.includes(',');
  let channels, alpha;
  if (legacy) {
    if (!['rgb', 'rgba'].includes(name)) return false;
    const parts = body.split(',').map(part => part.trim());
    if (parts.length !== 4) return false;
    channels = parts.slice(0, 3); alpha = parts[3];
  } else {
    const parts = body.split('/').map(part => part.trim());
    if (parts.length !== 2) return false;
    channels = parts[0].split(/\s+/); alpha = parts[1];
    if (name === 'color' && !colorSpaces.has(channels.shift())) return false;
  }
  const hueIndex = ['hsl', 'hsla', 'hwb'].includes(name) ? 0 : ['lch', 'oklch'].includes(name) ? 2 : -1;
  return channels.length === 3 && channels.every((channel, index) => (legacy ? alphaNumber : index === hueIndex ? hueChannel : numericChannel).test(channel))
    && ((!legacy && alpha === 'none') || (alphaNumber.test(alpha) && Number.parseFloat(alpha) === 0));
};
const noSeparateSurface = (element, label) => {
  const style = styles(element);
  requireValue(['Top', 'Right', 'Bottom', 'Left'].every(side => pixels(style[`border${side}Width`]) === 0)
    && transparentColor(style.backgroundColor)
    && String(style.backgroundImage).split(',').every(layer => layer.trim().toLowerCase() === 'none'), `${label}不另画独立边框和底色`);
};
const radiusLength = (value, size) => {
  const match = String(value).match(/^(\d+(?:\.\d*)?|\.\d+)(px|%)?$/);
  if (!match || (!match[2] && Number(match[1]) !== 0)) return Number.NaN;
  return Number(match[1]) * (match[2] === '%' ? size / 100 : 1);
};
const capsule = (element, box) => {
  const style = styles(element);
  const radii = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(corner => {
    const parts = String(style[`border${corner}Radius`] ?? '').trim().split(/\s+/);
    if (parts.length < 1 || parts.length > 2) return [Number.NaN, Number.NaN];
    const x = radiusLength(parts[0], box.width), y = radiusLength(parts[1] ?? parts[0], box.height);
    return x === 0 || y === 0 ? [0, 0] : [x, y];
  });
  requireValue(radii.flat().every(Number.isFinite), '手机胶囊四角必须提供可核验的计算后 px 或百分比半径');
  // CSS Backgrounds 3 corner-overlap：任一相邻圆角重叠时，所有轴半径统一收敛。
  // https://www.w3.org/TR/css-backgrounds-3/#corner-overlap
  const ratio = (size, sum) => sum > 0 ? size / sum : 1;
  const scale = Math.min(1, ratio(box.width, radii[0][0] + radii[1][0]), ratio(box.height, radii[1][1] + radii[2][1]),
    ratio(box.width, radii[3][0] + radii[2][0]), ratio(box.height, radii[0][1] + radii[3][1]));
  const minimum = Math.min(box.width, box.height) / 2;
  requireValue(radii.every(pair => pair.every(radius => radius * scale >= minimum - 1e-6)), '手机日期与申请人必须使用四角完整的胶囊视觉入口');
};
const centerY = box => (box.top + box.bottom) / 2;
const filterControl = (trigger, hitTarget, wrapped, label) => {
  const visual = rect(trigger, `手机${label}视觉入口`), hit = rect(hitTarget, `手机${label}点击入口`);
  requireValue(wrapped ? visual.height >= 28 : close(visual.height, 28), '手机单行筛选视觉入口应为 28px；长内容换行单独验收');
  capsule(trigger, visual);
  requireValue(hit.height >= 44 && inside(hit, visual), '手机筛选点击范围至少 44px，并覆盖完整视觉入口');
  requireValue(close(centerY(hit), centerY(visual)), '手机筛选点击区域和各自视觉入口必须在同排居中');
  return { visual, hit };
};

/**
 * 宿主真实浏览器接线接口（不是审批 npm API）。
 * PC: listRoot/tabs/panel/filters/table/canvas，有公开空态元素时可传 emptyState。
 * Canvas 的表头绘制和体内空文案需另做真实画布测试与截图，本函数不以 boolean 代验。
 * tab 必须为 pending/approved/initiated；手机已发起只传日期与卡片，不传任务搜索／申请人引用。
 * 手机任务: listRoot/tabs/panel/filters/cards、searchSurface/searchIcon/searchButton/searchInput，
 * dateTrigger/applicantTrigger 传视觉入口，dateHitTarget/applicantHitTarget 传实际按钮。
 * wrappedTriggers 仅在真实长内容换行时设 true；不通过它接受默认大号字段入口。
 */
export const assertApprovalListPresentation = input => {
  const { presentation, tab, listRoot, tabs, panel, filters } = input;
  requireValue(presentation === 'desktop' || presentation === 'mobile', 'presentation 必须是 desktop 或 mobile；tablet 映射为 desktop');
  requireValue(['pending', 'approved', 'initiated'].includes(tab), 'tab 必须明确为 pending、approved 或 initiated');
  const rootBox = rect(listRoot, '列表根容器');
  const tabsBox = rect(tabs, '页签');
  const panelBox = rect(panel, '面板');
  const filtersBox = rect(filters, '筛选栏');
  requireValue(inside(rootBox, tabsBox) && inside(rootBox, panelBox), '页签和面板必须处于列表根容器内，外 Shell 留白不重复计入');
  requireValue(listRoot.scrollHeight <= listRoot.clientHeight + tolerance, '列表页面本身不得滚动；滚动应归表格或卡片列表');

  if (presentation === 'desktop') {
    effectiveGutter(tabs, tabsBox, rootBox, 12, 'PC 页签');
    const panelContent = effectiveGutter(panel, panelBox, rootBox, 12, 'PC 面板');
    requireValue(close(panelContent.top, panelBox.top + 12) && close(panelContent.bottom, panelBox.bottom - 12), 'PC 面板有效上下内边距必须为 12px，包含对应边框和 padding');
    const tableBox = rect(input.table, 'PC 表格');
    const canvasBox = rect(input.canvas, 'PC 表格画布');
    requireValue(close(filtersBox.left, rootBox.left + 12) && close(filtersBox.right, rootBox.right - 12) && close(filtersBox.top, panelBox.top + 12), 'PC 搜索、面板内边距与表格必须左右对齐');
    requireValue(close(tableBox.left, rootBox.left + 12) && close(tableBox.right, rootBox.right - 12)
      && close(tableBox.left, filtersBox.left) && close(tableBox.right, filtersBox.right), 'PC 页签、搜索与表格必须左右对齐');
    padding(filters, ['Bottom'], 12, 'PC 筛选栏');
    requireValue(close(tableBox.top, filtersBox.bottom), 'PC 表格应紧接已含 12px 底部内边距的筛选栏，不重复叠加外部间距');
    requireValue(close(tableBox.bottom, panelBox.bottom - 12), 'PC 表格必须填满剩余高度，并保留面板底部 12px');
    requireValue(inside(tableBox, canvasBox), 'PC 表格画布必须处于实际表格容器内');
    if (input.emptyState) requireValue(inside(tableBox, rect(input.emptyState, 'PC 空态元素')), 'PC 空态必须位于表格内，不能用整页空态替换表格');
    return { presentation, tab, checks: ['12px 有效内边距与对齐', '高度链与滚动归属', '表格画布非零几何'], remaining: [tab === 'initiated' ? '五列表头绘制（含流程状态）' : '四列表头绘制', '表体空数据提示文案与位置'] };
  }

  padding(panel, ['Left', 'Right', 'Top', 'Bottom'], 0, '手机面板');
  effectiveGutter(tabs, tabsBox, rootBox, 16, '手机页签');
  effectiveGutter(filters, filtersBox, rootBox, 16, '手机筛选栏');
  effectiveGutter(input.cards, rect(input.cards, '手机卡片列表'), rootBox, 16, '手机卡片列表');
  if (tab === 'initiated') {
    requireValue(['searchSurface', 'searchIcon', 'searchButton', 'searchInput'].every(name => input[name] == null), '已发起手机页不得传入任务搜索引用');
    requireValue(['applicantTrigger', 'applicantHitTarget'].every(name => input[name] == null), '已发起手机页不得传入申请人入口');
    const date = filterControl(input.dateTrigger, input.dateHitTarget, input.wrappedTriggers, '日期');
    requireValue(close(date.visual.left, rootBox.left + 16) && date.visual.right <= rootBox.right - 16 + tolerance, '手机日期与卡片必须共用 16px 左右留白');
    return { presentation, tab, checks: ['16px 有效左右留白', '仅日期筛选', '28px 胶囊与 44px 点击范围'] };
  }
  const searchBox = rect(input.searchSurface, '手机搜索表面');
  const iconBox = rect(input.searchIcon, '手机搜索图标');
  const searchButtonBox = rect(input.searchButton, '手机搜索按钮');
  const inputBox = rect(input.searchInput, '手机搜索输入');
  requireValue(input.searchSurface.contains(input.searchIcon) && input.searchSurface.contains(input.searchInput) && inside(searchBox, iconBox) && inside(searchBox, inputBox), '手机搜索图标与输入必须属于同一个一体搜索表面');
  requireValue(input.searchSurface.contains(input.searchButton) && input.searchButton.contains(input.searchIcon) && inside(searchBox, searchButtonBox), '手机搜索按钮与图标必须位于一体搜索表面内');
  requireValue(close(searchBox.left, rootBox.left + 16) && close(searchBox.right, rootBox.right - 16), '手机搜索与卡片必须共用 16px 左右留白');
  noSeparateSurface(input.searchInput, '一体搜索中的输入');
  noSeparateSurface(input.searchButton, '一体搜索按钮');
  requireValue(pixels(styles(input.searchInput).fontSize) >= 16, '手机实际输入字号至少 16px');
  const { visual: dateBox, hit: dateHit } = filterControl(input.dateTrigger, input.dateHitTarget, input.wrappedTriggers, '日期');
  const { visual: applicantBox, hit: applicantHit } = filterControl(input.applicantTrigger, input.applicantHitTarget, input.wrappedTriggers, '申请人');
  requireValue(close(centerY(dateBox), centerY(applicantBox)), '手机日期与申请人必须同排并垂直居中，换行时可保持不同高度');
  requireValue(close(dateBox.left, searchBox.left) && close(applicantBox.right, searchBox.right) && dateBox.right < applicantBox.left, '手机申请时间在左、申请人在右，并与搜索对齐');
  requireValue(close(centerY(dateHit), centerY(applicantHit)) && close(centerY(dateHit), centerY(dateBox)) && close(centerY(applicantHit), centerY(applicantBox)), '手机筛选点击区域和各自视觉入口必须在同排居中');
  requireValue(dateHit.right <= applicantHit.left + tolerance, '手机两个筛选点击范围不可相互重叠');
  return { presentation, tab, checks: ['16px 有效左右留白', '一体搜索与输入字号', '28px 胶囊与 44px 点击范围'] };
};
