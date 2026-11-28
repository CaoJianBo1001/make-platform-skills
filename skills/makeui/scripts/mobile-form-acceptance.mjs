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

const fieldLabelRoles = new Set(['combobox', 'textbox', 'searchbox', 'button', 'group', 'listbox',
  'radiogroup', 'checkbox', 'radio', 'spinbutton', 'slider', 'switch', 'tree', 'grid']);

/** 字段标签关联只检查真实 DOM 语义，不读取几何或以替代名称掩盖错误 for。 */
export function assertFieldLabelAssociation({ label, control }) {
  ensure(label?.isConnected && control?.isConnected, '字段标签与控件需要已连接的真实 DOM');
  ensure(label.ownerDocument === control.ownerDocument, '字段标签与控件必须位于同一文档');
  const doc = label.ownerDocument, view = doc?.defaultView;
  ensure(view && label instanceof view.HTMLLabelElement && control instanceof view.Element,
    '字段标签必须为真实原生 label，控件必须为同文档 DOM 元素');
  ensure(visible(label) && !visibleTextNodes(label).next().done, '字段标签需要可见的非空文本');
  const htmlFor = label.getAttribute('for');
  if (htmlFor !== null) ensure(htmlFor && htmlFor === control.id, '字段标签 for 与实际控件 id 不一致');
  const nativeControl = control instanceof view.HTMLInputElement || control instanceof view.HTMLTextAreaElement
    || control instanceof view.HTMLSelectElement || control instanceof view.HTMLButtonElement;
  if (nativeControl) {
    ensure(label.control === control && [...(control.labels ?? [])].includes(label),
      '字段标签没有关联实际原生控件；placeholder 或 ARIA 名称不能替代 for/id 接线');
    return;
  }
  ensure(fieldLabelRoles.has(control.getAttribute('role')?.trim()),
    '非原生字段仅支持明确的字段／分组 ARIA role；generic、none、presentation 及未知角色不可作为字段命名目标');
  const references = (control.getAttribute('aria-labelledby') ?? '').trim().split(/\s+/);
  ensure(label.id && references.includes(label.id) && doc.getElementById(label.id) === label,
    'ARIA 字段的 aria-labelledby 必须真实引用当前可见 label.id');
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
    // CSS Align的flow-*与flex-*等价；不将独立的start/end混入别名。
    const alignment = (column ? style.alignItems : style.justifyContent)?.replace(/^flow-(start|end)$/, 'flex-$1');
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

function visibleBox(element, box, clipSelf = true, label = '加载反馈') {
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
  ensure(area.right > area.left && area.bottom > area.top, `${label}不在视口／裁剪容器的可见区域内`);
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

function independentReference(element, reference) {
  computed(element); computed(reference);
  ensure(element !== reference && !element.contains(reference) && !reference.contains(element), '需要独立的公开控件／冻结基线参考节点，不能与被测节点共用子树');
}

const colorProperties = new Set(['color', 'backgroundColor', 'borderTopColor', 'borderRightColor',
  'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor']);
const defaultColors = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
// 只比较浏览器 CSSOM 已解析的颜色，不解析变量、任意表达式或模拟 CSS 引擎。
const resolvedColor = value => typeof value === 'string' && /^(?:transparent|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]+\))$/i.test(value.trim());

export function assertThemeColorsMatch({ element, reference, properties = defaultColors }) {
  independentReference(element, reference);
  ensure(visible(element) && visible(reference), '主题颜色需要已挂载且可见的元素与公开主题参考');
  ensure(Array.isArray(properties) && properties.length > 0 && properties.every(property => colorProperties.has(property)), '必须指定受支持的颜色属性，不能以颜色门禁比较字体或几何');
  const actual = computed(element), baseline = computed(reference);
  for (const property of properties) {
    ensure(resolvedColor(actual[property]) && resolvedColor(baseline[property]), `${property} 颜色未解析，不能作为主题证据`);
    ensure(actual[property] === baseline[property], `${property} 颜色与公开主题参考不一致`);
  }
}

// 手机只投影品牌色；字体、密度、边框、圆角、阴影、排版继续按冻结参考核验。
// 宿主通过公开 ref 传入同类元素；不依赖组件库私有 class，也不推断组件来源。
const paintEffectProperties = ['opacity', 'filter'];
const nonColorProperties = [
  ...paintEffectProperties,
  'display', 'boxSizing', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'minHeight',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderRadius',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  'boxShadow', 'backgroundImage', 'appearance', 'flexDirection', 'alignItems', 'justifyContent', 'rowGap', 'columnGap',
];
function sameNonColorStyles(element, reference, label, properties = nonColorProperties) {
  independentReference(element, reference);
  ensure(visible(element) && visible(reference), `${label}需要可见元素与独立参考`);
  const actual = computed(element), baseline = computed(reference);
  for (const property of properties) ensure(actual[property] === baseline[property], `${label} ${property} 与参考不一致`);
}

function enabled(element) {
  if (!visible(element, true) || element.matches(':disabled') || computed(element).pointerEvents === 'none') return false;
  for (let current = element; current; current = current.parentElement) {
    if (current.hasAttribute('inert') || current.getAttribute('aria-disabled') === 'true') return false;
  }
  return true;
}

function visibleGeometry(element, minimum, label) {
  ensure(visible(element, true), `${label}必须可见并保留非零几何`);
  const box = rect(element);
  ensure(box.width >= minimum && box.height >= minimum, `${label}触控范围至少 ${minimum}px`);
  ensure(containsBox(visibleBox(element, box, false, label), box, 0), `${label}被视口／裁剪容器截断`);
  return box;
}

function hitGeometry(element, minimum, label) {
  ensure(element?.isConnected && enabled(element), `${label}必须可见且可交互`);
  const box = visibleGeometry(element, minimum, label);
  const doc = element.ownerDocument;
  ensure(typeof doc.elementFromPoint === 'function', `${label}需要真实浏览器 elementFromPoint 命中能力`);
  // 中心及四个内侧采样点，不以 z-index、视觉外框或中心单点冒充无遮挡证明。
  for (const [x, y] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    const hit = doc.elementFromPoint(box.left + box.width * x, box.top + box.height * y);
    ensure(hit && element.contains(hit), `${label}命中其他元素或被遮挡`);
  }
  return box;
}

function subtreeInteractionBlocked(element) {
  const style = computed(element);
  if (element.hasAttribute('inert') || style.display === 'none') return true;
  // visibility 由每个后代的计算值决定；opacity 不会阻断聚焦或点击。
  return ['hidden', 'collapse'].includes(style.visibility)
    && [...element.children].every(subtreeInteractionBlocked);
}

export function assertMobileCreateEntry({ state, creatable, entry, navigation }) {
  ensure(['normal', 'empty', 'search-empty'].includes(state), '列表状态必须明确为 normal、empty 或 search-empty，并分别验收');
  ensure(typeof creatable === 'boolean', '必须传入共享权限结果中的真实新建资格');
  if (!creatable) {
    ensure(!visible(entry), '无新建资格时不得显示新建入口');
    if (entry?.isConnected) {
      let blocked = entry.matches(':disabled') || subtreeInteractionBlocked(entry);
      for (let current = entry.parentElement; current && !blocked; current = current.parentElement) {
        blocked ||= current.hasAttribute('inert') || computed(current).display === 'none';
      }
      ensure(blocked, '无新建资格的隐藏入口仍可聚焦或交互，需卸载、禁用或实际阻断');
    }
    return;
  }
  ensure(visible(entry, true) && entry.matches('button, a[href], [role="button"]'), `${state} 列表必须保留可操作的新建入口`);
  const box = hitGeometry(entry, 44, '新建入口');
  if (navigation && visible(navigation)) {
    ensure(navigation.ownerDocument === entry.ownerDocument, '新建入口与导航必须来自同一真实页面');
    const navigationBox = rect(navigation), overlap = intersection(box, navigationBox);
    ensure(overlap.right <= overlap.left || overlap.bottom <= overlap.top, '新建入口必须避让导航，不能依赖 z-index 覆盖');
    ensure(navigationBox.top - box.bottom >= 8, '新建入口必须位于底部导航上方并至少保留8px间距');
  }
}

export function assertListSearch({ region, input, presentation, control = input, hitTarget = control, reference }) {
  ensure(['phone', 'desktop', 'tablet'].includes(presentation), '搜索 presentation 必须明确为 phone、desktop 或 tablet');
  ensure(visible(region) && visible(input, true) && region.contains(input)
    && input.matches('input') && ['text', 'search'].includes(input.type)
    && !input.readOnly && enabled(input), '列表区域必须保留可编辑且可交互的搜索输入');
  ensure(visible(control) && region.contains(control) && control.contains(input), '搜索输入必须位于实际搜索控件中');
  hitGeometry(input, 0, '搜索输入');
  if (presentation === 'phone') {
    ensure(region.contains(hitTarget) && hitTarget.contains(control), '手机搜索触控外围必须位于列表并包含中号视觉控件');
    ensure(hitTarget === input || (hitTarget.tagName === 'LABEL' && hitTarget.control === input),
      '手机搜索44px外围必须是实际输入或与其原生关联的label；自定义外围回调需另做实际焦点测试');
    hitGeometry(hitTarget, 44, '手机搜索触控外围');
    const size = computed(input).fontSize;
    ensure(/^\d*\.?\d+px$/.test(size) && Number.parseFloat(size) >= 16, '手机实际搜索输入字号至少16px，避免 iOS 聚焦缩放');
  } else {
    ensure(reference?.isConnected, 'PC／平板搜索需要宿主主库中同主题同规格的公开控件参考');
    ensure(Math.abs(rect(control).height - rect(reference).height) <= 1, '搜索控件实际高度与宿主主库参考不一致');
    sameNonColorStyles(control, reference, '搜索控件样式');
    assertThemeColorsMatch({ element: control, reference });
  }
}

function transparentColor(value) {
  return value === 'transparent'
    || /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0(?:\.0+)?\s*\)$/i.test(value)
    || /\/\s*0(?:\.0+)?%?\s*\)$/.test(value);
}

/** 仅检查宿主显式标注的普通原生值区，不扫描或修补公共包内部控件。 */
export function assertMobileNativeValueSurface({ owner, control, kind, phase, hitTarget = control, disabledReference }) {
  ensure(['input', 'trigger'].includes(kind) && ['rest', 'pointer-focus', 'keyboard-focus'].includes(phase),
    '宿主原生值区必须明确 kind 与常态／指针／键盘焦点阶段');
  computed(owner); computed(control);
  ensure(owner !== control && owner.contains(control)
    && owner !== control.ownerDocument.body && owner !== control.ownerDocument.documentElement
    && control.getAttribute('data-makeui-native-value') === kind,
  '原生值区需要明确的宿主归属标记及所属手机区域，不得选择公共包内部控件');
  ensure(kind === 'input'
    ? control.tagName === 'INPUT' && ['text', 'url', 'email', 'tel', 'password', 'search'].includes(control.type)
    : control.tagName === 'BUTTON' && control.type === 'button',
  '宿主原生值区必须为文本类 input 或 type=button 的选择触发器');
  if (kind === 'input') ensure(!control.readOnly, '只读字段应使用文本展示，不能以readonly输入通过可编辑值区门禁');
  ensure(owner.contains(hitTarget) && (hitTarget === control
    || (kind === 'input' && hitTarget.tagName === 'LABEL' && hitTarget.control === control)),
  '原生值区44px触控目标必须是控件本身或与输入真实关联的label');
  visibleGeometry(control, 0, '宿主原生值区');
  const style = computed(control);
  if (kind === 'input') ensure(/^\d*\.?\d+px$/.test(style.fontSize) && Number.parseFloat(style.fontSize) >= 16,
    '宿主原生输入的实际字号至少16px');
  assertRightAlignedValue(control);
  const focused = control.ownerDocument.activeElement === control;
  ensure(phase === 'rest' ? !focused : focused, '原生值区焦点阶段必须对应真实 activeElement，不能伪造聚焦状态');
  if (control.matches(':disabled')) {
    ensure(disabledReference?.isConnected, '禁用原生值区需要独立同主题的真实禁用参考基线');
    independentReference(control, disabledReference);
    ensure(visible(disabledReference), '禁用参考基线必须可见');
    assertDisabledMatches(control, disabledReference);
    ensure(style.opacity === computed(disabledReference).opacity, '禁用原生值区透明度与参考基线不一致');
    visibleGeometry(hitTarget, 44, '禁用原生值区触控范围');
    return;
  }
  for (const property of ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']) {
    ensure(Number.parseFloat(style[property]) === 0, '宿主普通原生值区不得保留UA盒框／额外边框');
  }
  ensure(!style.backgroundImage || style.backgroundImage === 'none', '宿主普通原生值区不得添加背景图');
  ensure(resolvedColor(style.backgroundColor) && (transparentColor(style.backgroundColor)
    || style.backgroundColor === computed(owner).backgroundColor), '宿主原生值区背景必须透明或沿用所属内容区背景');
  ensure(!style.boxShadow || style.boxShadow === 'none', '宿主普通原生值区不得保留盒状阴影');
  const outlinePresent = Number.parseFloat(style.outlineWidth) > 0
    && !['none', 'hidden', ''].includes(style.outlineStyle);
  if (outlinePresent) ensure(resolvedColor(style.outlineColor), '原生值区焦点描边颜色未解析，不能作为焦点证据');
  const outline = outlinePresent && !transparentColor(style.outlineColor);
  ensure(phase === 'keyboard-focus' ? outline : !outline,
    phase === 'keyboard-focus' ? '原生值区键盘焦点必须保留可见描边提示' : '原生值区常态／指针焦点不得出现持久盒状描边');
  hitGeometry(hitTarget, 44, '宿主原生值区触控范围');
}

export function assertMobileCardBaseline({ card, reference, actions, parts = [] }) {
  rect(card); rect(reference);
  sameNonColorStyles(card, reference, '手机卡片冻结样式');
  assertThemeColorsMatch({ element: card, reference, properties: ['backgroundColor'] });
  ensure(Array.isArray(parts), '卡片冻结部位必须为元素与参考的配对数组');
  for (const part of parts) {
    ensure(card.contains(part.element) && reference.contains(part.reference), '卡片冻结部位必须分别属于被测卡片与参考');
    sameNonColorStyles(part.element, part.reference, '手机卡片冻结部位样式');
  }
  ensure(Array.isArray(actions) && new Set(actions).size === actions.length, '必须显式传入不重复的卡片动作入口');
  // actions 由共享 Controller 的完整授权动作集合提供，不从正文 URL 等交互标签猜业务动作。
  for (const action of actions) {
    ensure(card.contains(action) && action.matches('button, a[href], [role="button"]'), '卡片动作必须属于当前卡片并具有交互语义');
    // 资格与当前忙碌／禁用态分离。原生 disabled 仍保留尺寸与可见性，不要求其可点击。
    if (action.matches(':disabled')) visibleGeometry(action, 44, '禁用卡片动作');
    else hitGeometry(action, 44, '卡片动作');
  }
}

export function assertMobileListBaseline({ list, reference, cards, referenceCards, page, pageReference }) {
  ensure(page?.contains(list) && pageReference?.contains(reference), '列表必须位于各自真实页面背景参照中');
  rect(list); rect(reference); rect(page); rect(pageReference);
  sameNonColorStyles(list, reference, '手机列表冻结样式');
  assertThemeColorsMatch({ element: list, reference, properties: ['backgroundColor'] });
  assertThemeColorsMatch({ element: page, reference: pageReference, properties: ['backgroundColor'] });
  // 页面只补整体绘制效果，不将其不同布局结构或任意祖先纳入卡片样式比较。
  sameNonColorStyles(page, pageReference, '手机页面冻结绘制效果', paintEffectProperties);
  ensure(Array.isArray(cards) && Array.isArray(referenceCards) && cards.length >= 2 && cards.length === referenceCards.length,
    '卡片间距需要至少两个实际卡片及等量冻结参考，不以单张卡片推断');
  const boxes = cards.map((card, index) => {
    ensure(list.contains(card) && reference.contains(referenceCards[index]), '间距测量卡片必须位于各自列表内');
    return { actual: rect(card), baseline: rect(referenceCards[index]) };
  });
  for (let index = 1; index < boxes.length; index++) {
    const gap = boxes[index].actual.top - boxes[index - 1].actual.bottom;
    const baseline = boxes[index].baseline.top - boxes[index - 1].baseline.bottom;
    ensure(gap >= 0 && baseline >= 0 && Math.abs(gap - baseline) <= 1, '手机相邻卡片实际间距与冻结参考不一致');
  }
}
