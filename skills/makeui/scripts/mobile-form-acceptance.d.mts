/** 已挂载的 DOM 与已生效的宿主样式。不会代替真实浏览器布局验证。 */
export function assertFormColumns(grid: Element, columns: number): void;
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
