/** Project only brand colors; phone typography, surfaces, geometry and behavior stay mobile-owned. */
export function toMobileBrandTheme(theme) {
  const source = theme && typeof theme === 'object' ? theme : {};
  const colors = {};
  for (const key of ['primary', 'onPrimary', 'primarySoft', 'link', 'focusRing']) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) colors[key] = value;
  }
  // PC outline/raised button recipes do not change the phone's filled primary action.
  if (colors.primary) {
    colors.actionBackground = colors.primary;
    colors.actionBorder = colors.primary;
  }
  if (colors.onPrimary) colors.actionText = colors.onPrimary;
  return colors;
}
