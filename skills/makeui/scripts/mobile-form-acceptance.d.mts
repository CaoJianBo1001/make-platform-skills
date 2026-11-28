/** 已挂载的 DOM 与已生效的宿主样式。不会代替真实浏览器布局验证。 */
export function assertFormColumns(grid: Element, columns: number): void;
/** 跨端真实标签与控件的 DOM 关联；native 检查 control/labels，ARIA 控件检查 label.id 引用。不读取几何。
 * 非native仅接受明确的单一字段／分组role：combobox/textbox/searchbox/button/group/listbox/radiogroup/
 * checkbox/radio/spinbutton/slider/switch/tree/grid；拒绝generic、none、presentation及未知角色，不作全页a11y审计。
 */
export function assertFieldLabelAssociation(input: { label: HTMLLabelElement; control: Element; }): void;
export function assertRightAlignedValue(value: Element): void;
export function assertDisabledMatches(control: Element, reference: Element): void;
/** 按实际计算样式检查文案／图形及旧候选子树，不以 hidden 属性直接判定；另做真实几何验收。 */
export function assertLoadingFeedback(input: {
  region: Element; status: Element; indicator: Element; message: Element; optionSelector: string;
}): void;
/** 测量图形及 Range 文字行，按视口与定位包含块链中的矩形裁剪检查可见性／中心。拒绝零矩形。 */
export function assertLoadingGeometry(input: {
  region: Element; status: Element; indicator: Element; message: Element; footer?: Element; tolerance?: number;
}): void;

export type ThemeColorProperty = 'color' | 'backgroundColor' | 'borderTopColor' | 'borderRightColor'
  | 'borderBottomColor' | 'borderLeftColor' | 'outlineColor' | 'textDecorationColor';
/** 比较实际 DOM 的已解析颜色；reference 必须由宿主公开主题／主库控件渲染，不能传被测节点或同一子树。 */
export function assertThemeColorsMatch(input: {
  element: Element; reference: Element; properties?: readonly ThemeColorProperty[];
}): void;
/** 三个列表状态分别调用；creatable 复用真实共享权限结果，不推断权限。拒绝零矩形、缺命中能力与遮挡；距底部导航至少8px。
 * 无资格时检查整个入口子树的visibility及实际交互阻断，拒绝恢复可见的后代；透明度为零不构成交互阻断。
 * 保留入口自身原生禁用路径，子控件disabled不能代替父入口的整树阻断。
 */
export function assertMobileCreateEntry(input: {
  state: 'normal' | 'empty' | 'search-empty'; creatable: boolean; entry: Element | null; navigation?: Element;
}): void;
/** 搜索输入需可编辑、可命中；手机 hitTarget 是至少44px的实际输入或原生关联label，保留中号control与至少16px输入。自定义外围回调另做真实焦点测试，不以本门禁认证。PC／平板比较宿主主库同主题同规格参考。 */
export function assertListSearch(input: {
  region: Element; input: HTMLInputElement; presentation: 'phone' | 'desktop' | 'tablet';
  control?: Element; hitTarget?: HTMLInputElement | HTMLLabelElement; reference?: Element;
}): void;
/** 仅宿主自有、标注data-makeui-native-value的普通可编辑字段；readonly输入被拒，不适用于公共包内部控件、Sheet搜索或意见区。
 * owner为该控件所属手机内容区，phase须对应实际焦点。input可用原生关联label扩大44px触控；禁用时必须传独立同主题禁用参考。
 * DOM检查样式和焦点；44px矩形／裁剪／命中须在真实浏览器执行，工具替身不构成宿主验收。
 */
export function assertMobileNativeValueSurface(input: {
  owner: Element; control: HTMLInputElement | HTMLButtonElement; kind: 'input' | 'trigger';
  phase: 'rest' | 'pointer-focus' | 'keyboard-focus';
  hitTarget?: HTMLInputElement | HTMLButtonElement | HTMLLabelElement;
  disabledReference?: HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement;
}): void;
/** 冻结卡片表面背景及非颜色样式（含自身opacity/filter）；parts传标题／字段等部位。调用方独立列出全部授权actions，包括当前native disabled动作：均至少44px且可见，仅启用动作要求命中；不从正文URL猜业务动作。 */
export function assertMobileCardBaseline(input: {
  card: Element; reference: Element; actions: readonly Element[];
  parts?: readonly { element: Element; reference: Element }[];
}): void;
/** 比较列表背景及非颜色样式、所属页面背景和自身opacity/filter；效果均对照同状态独立参考，不检查任意祖先或页面完整布局。
 * 以至少两张卡片的真实相邻矩形核验间距；card门禁自身不证明列表间距。
 */
export function assertMobileListBaseline(input: {
  list: Element; reference: Element; cards: readonly Element[]; referenceCards: readonly Element[];
  page: Element; pageReference: Element;
}): void;
