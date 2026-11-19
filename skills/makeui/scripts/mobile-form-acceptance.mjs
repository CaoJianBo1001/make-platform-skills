// 来源：makeui/scripts/mobile-form-acceptance.mjs；更新时同步相邻 .d.mts。
// 无运行时依赖。DOM/样式断言不等于浏览器布局验收；几何断言另行调用。
function ensure(condition, message) {
  if (!condition) throw new Error(`[mobile-form] ${message}`);
}

function computed(element) {
  ensure(element?.isConnected && element.ownerDocument?.defaultView, '需要已挂载的真实 DOM 元素');
  return element.ownerDocument.defaultView.getComputedStyle(element);
}

function visible(element, contents = false) {
  if (!element?.isConnected) return false;
  // visibility 可由后代覆盖；读取目标的计算值已包含继承，不能逐祖先否决。
  if (['hidden', 'collapse'].includes(computed(element).visibility)) return false;
  for (let current = element; current; current = current.parentElement) {
    const style = computed(current);
    // hidden 的默认样式可被 CSS 覆盖，按实际计算样式判断。
    if (style.display === 'none' || style.opacity === '0') return false;
    // content-visibility 隐藏内容及后代，不隐藏元素自身的背景／边框。
    if (style.contentVisibility === 'hidden' && (contents || current !== element)) return false;
  }
  return true;
}

// computedStyle 在浏览器中返回像素轨道；DOM 测试环境可能保留 minmax/repeat。
function tracks(value) {
  value = value.replace(/\[[^\]]*\]/g, ' ');
  let depth = 0, token = '', result = [];
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (/\s/.test(char) && depth === 0) {
      if (token) result.push(token);
      token = '';
    } else token += char;
  }
  if (token) result.push(token);
  ensure(depth === 0 && result.length > 0 && !/none|subgrid|auto-fit|auto-fill|\[|\]|var\(/.test(value), '无法解析网格轨道，请在真实浏览器检查');
  return result.reduce((count, track) => {
    const repeat = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/.exec(track);
    return count + (repeat ? Number(repeat[1]) * tracks(repeat[2]) : 1);
  }, 0);
}

export function assertFormColumns(grid, columns) {
  ensure(Number.isInteger(columns) && columns > 0, '期望列数必须为正整数');
  const style = computed(grid);
  ensure(style.display === 'grid' || style.display === 'inline-grid', '表单容器必须有已生效的 grid 样式');
  const actual = tracks(style.gridTemplateColumns);
  ensure(actual === columns, `表单列数应为 ${columns}，实际 ${actual}`);
}

export function assertRightAlignedValue(value) {
  const style = computed(value);
  ensure(!style.writingMode || style.writingMode === 'horizontal-tb', '不支持竖排值布局的样式判定，请使用宿主真实几何验收');
  const rtl = style.direction === 'rtl';
  let aligned;
  if (style.display.includes('flex')) {
    const flow = style.flexDirection || 'row';
    const column = flow === 'column' || flow === 'column-reverse';
    const startAtRight = rtl !== (column ? style.flexWrap === 'wrap-reverse' : flow === 'row-reverse');
    const alignment = column ? style.alignItems : style.justifyContent;
    aligned = alignment === 'right'
      || (alignment === 'flex-end' && !startAtRight)
      || (alignment === 'flex-start' && startAtRight)
      || (alignment === 'start' && rtl)
      || (alignment === 'end' && !rtl);
  } else {
    ensure(!style.display.includes('grid'), '不支持 Grid 值布局的样式判定，请使用宿主真实几何验收');
    aligned = style.display !== 'inline' && (style.textAlign === 'right'
      || (style.textAlign === 'end' && !rtl) || (style.textAlign === 'start' && rtl));
  }
  ensure(aligned, '只读值未使用行尾布局；flex 容器仅 text-align:right 不足以保证对齐');
}

export function assertDisabledMatches(control, reference) {
  ensure(control?.matches(':disabled') && reference?.matches(':disabled'), '控件与同主题基线都必须为真实禁用态');
  const actual = computed(control), baseline = computed(reference);
  for (const property of ['backgroundColor', 'color']) {
    ensure(actual[property] && baseline[property] && !/var\(/.test(actual[property] + baseline[property]), `禁用 ${property} 未解析，不能作为颜色证据`);
    ensure(actual[property] === baseline[property], `禁用 ${property} 与同主题公共控件基线不一致`);
  }
}

function* visibleTextNodes(message) {
  const doc = message.ownerDocument;
  ensure(typeof doc.createTreeWalker === 'function', '需要 DOM 文字节点读取能力');
  const walker = doc.createTreeWalker(message, 4); // SHOW_TEXT，不依赖全局 NodeFilter。
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim() && visible(node.parentElement, true)) yield node;
  }
}

function requireMessage(status, indicator, message) {
  ensure(visible(message) && status.contains(message) && !message.contains(indicator) && !indicator.contains(message),
    '需要状态区域内独立且可见的加载文案节点');
  ensure(!visibleTextNodes(message).next().done, '加载文案需要可见的非空文字');
}

export function assertLoadingFeedback({ region, status, indicator, message, optionSelector }) {
  ensure(visible(region) && region.contains(status) && visible(status), '候选区域必须显示可见的加载反馈');
  ensure(status.contains(indicator) && visible(indicator), '加载反馈需要可见图形指示');
  requireMessage(status, indicator, message);
  ensure(optionSelector && [...region.querySelectorAll(optionSelector)].every(option =>
    !visible(option) && ![...option.querySelectorAll('*')].some(child => visible(child))), '加载时不能显示旧候选');
}

function hasBox(value) {
  return [value.width, value.height, value.left, value.top, value.right, value.bottom].every(Number.isFinite)
    && value.width > 0 && value.height > 0;
}

function rect(element) {
  computed(element);
  const value = element.getBoundingClientRect();
  ensure(hasBox(value), '需要真实浏览器非零矩形，不能用 jsdom 几何结果验收');
  return value;
}

function intersection(area, clip, clipX = true, clipY = true) {
  return {
    left: clipX ? Math.max(area.left, clip.left) : area.left,
    right: clipX ? Math.min(area.right, clip.right) : area.right,
    top: clipY ? Math.max(area.top, clip.top) : area.top,
    bottom: clipY ? Math.min(area.bottom, clip.bottom) : area.bottom,
  };
}

function containsBox(area, content, tolerance) {
  return content.left >= area.left - tolerance && content.right <= area.right + tolerance
    && content.top >= area.top - tolerance && content.bottom <= area.bottom + tolerance;
}

function viewportBox(element) {
  const doc = element.ownerDocument, view = doc.defaultView;
  const width = doc.documentElement?.clientWidth || view.innerWidth;
  const height = doc.documentElement?.clientHeight || view.innerHeight;
  ensure(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0, '需要真实浏览器视口测量');
  const layout = { left: 0, top: 0, right: width, bottom: height };
  const visual = view.visualViewport;
  if (!visual) return layout;
  ensure([visual.offsetLeft, visual.offsetTop, visual.width, visual.height].every(Number.isFinite)
    && visual.width > 0 && visual.height > 0, '需要真实浏览器可见视口测量');
  return intersection(layout, {
    left: visual.offsetLeft, top: visual.offsetTop,
    right: visual.offsetLeft + visual.width, bottom: visual.offsetTop + visual.height,
  });
}

function scrollportBox(element) {
  const box = rect(element);
  ensure([element.clientLeft, element.clientTop, element.clientWidth, element.clientHeight,
    element.offsetWidth, element.offsetHeight].every(Number.isFinite)
    && element.clientWidth > 0 && element.clientHeight > 0 && element.offsetWidth > 0 && element.offsetHeight > 0,
  '无法量取裁剪容器的真实滚动视口');
  const scaleX = box.width / element.offsetWidth, scaleY = box.height / element.offsetHeight;
  const left = box.left + element.clientLeft * scaleX, top = box.top + element.clientTop * scaleY;
  return { left, top, right: left + element.clientWidth * scaleX, bottom: top + element.clientHeight * scaleY };
}

function establishesContainingBlock(style, position) {
  if (position === 'absolute' && style.position && style.position !== 'static') return true;
  const properties = ['transform', 'translate', 'rotate', 'scale', 'perspective', 'filter', 'backdropFilter'];
  if (properties.some(property => style[property] && style[property] !== 'none')) return true;
  if (style.transformStyle === 'preserve-3d' || /\b(layout|paint|strict|content)\b/.test(style.contain || '')
    || ['auto', 'hidden'].includes(style.contentVisibility)) return true;
  const willChange = (style.willChange || '').split(',').map(value => value.trim().toLowerCase());
  return willChange.some(property => ['transform', 'translate', 'rotate', 'scale', 'perspective', 'filter',
    'backdrop-filter', 'transform-style', 'contain', 'content-visibility'].includes(property)
    || (position === 'absolute' && property === 'position'));
}

function visibleBox(element, box, clipSelf = true) {
  const doc = element.ownerDocument;
  let area = intersection(box, viewportBox(element));
  let positioning = null;
  for (let current = element; current; current = current.parentElement) {
    const style = computed(current);
    if (style.display === 'contents') continue; // 无盒节点不产生包含块或裁剪盒。
    // absolute/fixed 的中间 DOM 祖先未必在其包含块链中，不能直接作为裁剪祖先。
    if (positioning && !establishesContainingBlock(style, positioning)) continue;
    positioning = null;
    // 文档滚动视口已由 viewportBox 处理，根元素的滚动后矩形不能重复裁剪视口。
    if (current !== doc.documentElement && current !== doc.scrollingElement && (clipSelf || current !== element)) {
      const shorthand = (style.overflow || 'visible').split(/\s+/);
      const overflowX = style.overflowX || shorthand[0], overflowY = style.overflowY || shorthand[1] || shorthand[0];
      const clips = value => ['hidden', 'clip', 'auto', 'scroll', 'overlay'].includes(value);
      const paint = /\b(paint|strict|content)\b/.test(style.contain || '') || style.contentVisibility === 'auto';
      const clipX = paint || clips(overflowX), clipY = paint || clips(overflowY);
      if (clipX || clipY) area = intersection(area, scrollportBox(current), clipX, clipY);
    }
    if (['absolute', 'fixed'].includes(style.position)) positioning = style.position;
  }
  ensure(area.right > area.left && area.bottom > area.top, '加载反馈不在视口／裁剪容器的可见区域内');
  return area;
}

function textRectangles(message) {
  const doc = message.ownerDocument;
  ensure(typeof doc.createRange === 'function', '需要真实浏览器 Range 文字几何');
  const range = doc.createRange(), rectangles = [];
  ensure(typeof range.getClientRects === 'function', '需要真实浏览器 Range 文字几何');
  for (const node of visibleTextNodes(message)) {
    range.selectNodeContents(node);
    rectangles.push(...[...range.getClientRects()].filter(hasBox).map(box => ({ box, owner: node.parentElement })));
  }
  ensure(rectangles.length > 0, '加载提示需要可测量的非空文字');
  return rectangles;
}

export function assertLoadingGeometry({ region, status, indicator, message, footer, tolerance = 4 }) {
  ensure(Number.isFinite(tolerance) && tolerance >= 0, '几何容差必须是非负有限数');
  ensure(visible(region) && visible(status) && region.contains(status), '加载状态必须在可见候选区域中');
  ensure(visible(indicator) && status.contains(indicator), '需要状态区域内的可见加载图形');
  requireMessage(status, indicator, message);
  const rawArea = rect(region), frame = rect(status), icon = rect(indicator);
  const area = visibleBox(region, rawArea);
  // 统计图形与实际文字行的并集，不使用可能填满候选区的状态／文案外框。
  // 图形外框无需再按自身 overflow 裁剪，但其自身定位决定后续裁剪链。
  const parts = [{ box: icon, owner: indicator, clipSelf: false }, ...textRectangles(message)];
  for (const part of parts) ensure(containsBox(visibleBox(part.owner, part.box, part.clipSelf !== false), part.box, tolerance), '加载图形或文案被视口／裁剪容器截断');
  const boxes = parts.map(part => part.box);
  const feedback = {
    left: Math.min(...boxes.map(part => part.left)), right: Math.max(...boxes.map(part => part.right)),
    top: Math.min(...boxes.map(part => part.top)), bottom: Math.max(...boxes.map(part => part.bottom)),
  };
  ensure(Math.abs((feedback.left + feedback.right - area.left - area.right) / 2) <= tolerance
    && Math.abs((feedback.top + feedback.bottom - area.top - area.bottom) / 2) <= tolerance, '加载反馈未在候选剩余区域居中');
  ensure(containsBox(area, feedback, tolerance) && containsBox(rawArea, frame, tolerance)
    && containsBox(frame, feedback, tolerance), '加载反馈超出候选区域');
  if (footer) ensure(area.bottom <= rect(footer).top + tolerance, '候选区域覆盖底栏');
}
