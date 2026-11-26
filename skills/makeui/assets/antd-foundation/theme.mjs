export const MAKEUI_ANTD_FOUNDATION_CONTRACT = 'makeui-antd-foundation/v1';

const dimension = (value, fallback, allowZero = false) => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+(?:\.\d+)?(?:px)?$/.test(value.trim())
      ? Number.parseFloat(value)
      : NaN;
  return Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0) ? parsed : fallback;
};

export const isDarkDesign = (design = {}) =>
  design.choices?.theme ? design.choices.theme === 'dark' : design.controls?.style?.['--mk-mode'] === 'dark';

const positiveRole = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Resolve semantic business sizes once; old display metrics never become record/phone titles. */
export function resolveTypography(design = {}) {
  const supplied = design.typography ?? {};
  const style = design.controls?.style ?? {};
  const metrics = design.metrics ?? {};
  const body = dimension(style['--mk-size'], dimension(metrics.bodySize, 14));
  const legacyBodySource = dimension(style['--mk-size'], NaN) > 0 ? 'legacy:controls.style.--mk-size' : positiveRole(metrics.bodySize) ? 'legacy:metrics.bodySize' : 'official-antd-v6:fontSize';
  const pageTitle = dimension(style['--mk-heading-size'], dimension(metrics.headingSize, 20));
  const legacyPageSource = dimension(style['--mk-heading-size'], NaN) > 0 ? 'legacy:controls.style.--mk-heading-size' : positiveRole(metrics.headingSize) ? 'legacy:metrics.headingSize' : 'official-antd-v6:fontSizeHeading4';
  const defaults = {
    pageTitle: [pageTitle, legacyPageSource], recordTitle: [16, 'official-antd-v6:fontSizeHeading5'],
    sectionTitle: [14, 'official-antd-v6:fontSize'], body: [body, legacyBodySource],
    fieldLabel: [14, 'official-antd-v6:Form.labelFontSize'], controlText: [14, 'official-antd-v6:Input.inputFontSize'],
    meta: [12, 'official-antd-v6:fontSizeSM'], phoneHeader: [16, 'make-mobile:page-header-default'],
    sheetTitle: [16, 'make-mobile:sheet-title-default'], sheetHeading: [16, 'make-mobile:sheet-heading-default'],
    sheetBody: [14, 'make-mobile:sheet-body-default'], sheetMeta: [13, 'make-mobile:sheet-meta-default'],
  };
  const roles = {}, sources = {}, fallbacks = [];
  for (const [role, [fallback, source]] of Object.entries(defaults)) {
    const given = supplied.roles?.[role];
    const valid = positiveRole(given);
    roles[role] = valid ? given : fallback;
    sources[role] = valid ? supplied.sources?.[role] ?? `handoff:typography.roles.${role}` : source;
    if (!valid) fallbacks.push(`${role}:${source}`);
  }
  const tracking = {};
  for (const role of ['body', 'heading']) {
    const given = supplied.tracking?.[role];
    const valid = typeof given === 'number' && Number.isFinite(given);
    const legacy = typeof metrics.tracking === 'number' && Number.isFinite(metrics.tracking);
    tracking[role] = valid ? given : legacy ? metrics.tracking : 0;
    sources[`tracking.${role}`] = valid ? `handoff:typography.tracking.${role}` : legacy ? 'legacy:metrics.tracking-unclassified' : 'official-normal:letter-spacing';
    if (!valid) fallbacks.push(`tracking.${role}:${sources[`tracking.${role}`]}`);
  }
  return { contract: supplied.contract ?? 'makeui-business-typography/v1', roles, tracking, sources, fallbacks };
}

export function toAntdTokens(design = {}) {
  const dark = isDarkDesign(design);
  const colors = design.colors ?? {};
  const metrics = design.metrics ?? {};
  const style = design.controls?.style ?? {};
  const radius = dimension(style['--mk-radius'], dimension(metrics.radius, 6, true), true);
  const explicitShadow = design.choices?.tuning?.fine?.shadow;
  const shadowInk = style['--mk-ink'] ?? colors.fg ?? (dark ? '#f5f5f5' : '#1f2329');
  const selectedShadow = explicitShadow === 'none' ? 'none' : explicitShadow === 'raised' ? `0 8px 24px color-mix(in srgb, ${shadowInk} 14%, transparent)` : `0 1px 6px color-mix(in srgb, ${shadowInk} 8%, transparent)`;
  return {
    ...(explicitShadow ? { boxShadow: selectedShadow, boxShadowSecondary: selectedShadow } : {}),
    ...(design.choices?.motion === 'reduced' ? { motion: false, motionDurationFast: '0s', motionDurationMid: '0s', motionDurationSlow: '0s' } : {}),
    colorPrimary: style['--mk-accent'] ?? colors.accent ?? '#1677ff',
    ...(colors['accent-hover'] ? { colorPrimaryHover: colors['accent-hover'] } : {}),
    ...(colors['accent-active'] ? { colorPrimaryActive: colors['accent-active'] } : {}),
    ...(style['--mk-hover'] ? { controlItemBgHover: style['--mk-hover'], colorBgTextHover: style['--mk-hover'] } : {}),
    colorTextLightSolid: style['--mk-on-accent'] ?? colors['accent-on'] ?? '#ffffff',
    colorText: style['--mk-ink'] ?? colors.fg ?? (dark ? '#f5f5f5' : '#1f2329'),
    colorTextHeading: colors['fg-2'] ?? style['--mk-ink'] ?? colors.fg ?? (dark ? '#ffffff' : '#1f2329'),
    colorTextSecondary: colors.muted ?? (dark ? '#bfbfbf' : '#667085'),
    colorTextTertiary: colors.meta ?? colors.muted ?? (dark ? '#999999' : '#8c8c8c'),
    colorTextPlaceholder: colors.meta ?? (dark ? '#8c8c8c' : '#98a2b3'),
    colorBgBase: colors.bg ?? (dark ? '#141414' : '#ffffff'),
    colorBgLayout: colors.bg ?? (dark ? '#141414' : '#f7f8fa'),
    colorBgContainer: style['--mk-surface'] ?? colors.surface ?? (dark ? '#1f1f1f' : '#ffffff'),
    colorBgElevated: style['--mk-surface'] ?? colors.surface ?? (dark ? '#1f1f1f' : '#ffffff'),
    colorBorder: style['--mk-border'] ?? colors.border ?? (dark ? '#434343' : '#d9d9d9'),
    colorBorderSecondary: colors['border-soft'] ?? colors.border ?? (dark ? '#303030' : '#edf0f3'),
    colorSuccess: colors.success ?? '#52c41a',
    colorWarning: colors.warn ?? '#faad14',
    colorError: style['--mk-danger'] ?? colors.danger ?? '#ff4d4f',
    colorInfo: style['--mk-accent'] ?? colors.accent ?? '#1677ff',
    fontFamily: style['--mk-font'] ?? design.typography?.body ?? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: resolveTypography(design).roles.body,
    lineHeight: dimension(metrics.lineHeight, 1.5),
    controlHeight: dimension(style['--mk-height'], dimension(metrics.controlHeight, 36)),
    borderRadius: radius,
    borderRadiusLG: dimension(style['--mk-popup-radius'], radius, true),
  };
}

export function toAntdComponentTokens(design = {}) {
  const tokens = toAntdTokens(design);
  const style = design.controls?.style ?? {};
  const rules = design.layout?.componentSuite?.rules ?? {};
  const roles = resolveTypography(design).roles;
  const text = { fontSize: roles.controlText, fontSizeSM: roles.controlText, fontSizeLG: roles.controlText };
  const inputText = { ...text, inputFontSize: roles.controlText, inputFontSizeSM: roles.controlText, inputFontSizeLG: roles.controlText };
  const fieldBackground = rules.field === 'inset' ? design.colors?.['surface-warm'] ?? design.colors?.bg : style['--mk-surface'] ?? design.colors?.surface;
  const field = { controlHeight: dimension(style['--mk-height'], dimension(design.metrics?.controlHeight, dimension(rules.fieldHeight, tokens.controlHeight))), borderRadius: dimension(style['--mk-radius'], dimension(design.metrics?.radius, dimension(rules.fieldRadius, tokens.borderRadius, true), true), true), ...(fieldBackground ? { colorBgContainer: fieldBackground } : {}) };
  return {
    Form: { labelFontSize: roles.fieldLabel },
    Tag: { fontSize: roles.meta, fontSizeSM: roles.meta },
    Button: {
      ...text,
      controlHeight: dimension(style['--mk-action-height'], dimension(rules.actionHeight, tokens.controlHeight)),
      borderRadius: dimension(style['--mk-action-radius'], dimension(rules.actionRadius, tokens.borderRadius, true), true),
    },
    Input: { ...field, ...inputText },
    InputNumber: { ...field, ...inputText },
    Select: { ...field, ...text, optionFontSize: roles.controlText },
    DatePicker: { ...field, ...inputText },
    TimePicker: { ...field, ...inputText },
    Cascader: { ...field, ...text },
    TreeSelect: { ...field, ...text },
    AutoComplete: { ...field, ...text, optionFontSize: roles.controlText },
    Tabs: { ...(design.colors?.['surface-warm'] ? { cardBg: design.colors['surface-warm'] } : {}) },
  };
}

export function resolveAppPresentation(design = {}) {
  const structure = design.layout?.structure ?? {};
  const resolved = structure.resolvedNavigation ?? {};
  const explicit = design.choices?.navigation ?? structure.navigation?.id;
  const recipeMode = design.layout?.recipe?.nav;
  const rawMode = explicit && explicit !== 'system' ? explicit : resolved.mode ?? recipeMode ?? 'single';
  const mode = rawMode === 'side' ? 'single' : ['single', 'double', 'top', 'rail', 'workspace'].includes(rawMode) ? rawMode : 'single';
  const defaults = { singleSidebar: 208, primaryRail: 64, secondarySidebar: 184, rail: 68, workspaceSidebar: 240 };
  const fallbacks = [];
  const widths = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const given = resolved[key] ?? structure.widths?.[key];
    if (!(typeof given === 'number' && Number.isFinite(given) && given > 0)) fallbacks.push(`${key}:contract-default:${fallback}`);
    return [key, dimension(given, fallback)];
  }));
  if (!recipeMode && !resolved.mode && (!explicit || explicit === 'system')) fallbacks.push('navigation:contract-default:single');
  const surface = ['flat', 'boxed', 'inset'].includes(design.layout?.recipe?.surface) ? design.layout.recipe.surface : 'flat';
  const secondaryCards = design.layout?.secondaryCards ?? { enabled: design.choices?.secondaryCardsEnabled ?? false, style: design.choices?.secondaryCardStyle ?? 'system' };
  const secondaryStyle = secondaryCards.resolvedStyle ?? secondaryCards.style ?? 'system';
  const knownSecondaryStyle = ['soft', 'outline', 'accent', 'system'].includes(secondaryStyle);
  if (!knownSecondaryStyle && secondaryCards.enabled !== false) fallbacks.push(`secondaryCards.style:contract-default:system:${secondaryStyle}`);
  return {
    navigation: { mode, widths }, surface,
    presentationId: design.layout?.presentation?.id ?? design.choices?.presentation ?? 'native',
    componentSuite: { ...design.layout?.componentSuite, rules: { ...design.layout?.componentSuite?.rules } },
    secondaryCards: { ...secondaryCards, resolvedStyle: knownSecondaryStyle ? secondaryStyle : 'system' },
    illustration: design.illustration ? { ...design.illustration } : null,
    applicability: { secondaryCards: secondaryCards.enabled === false ? 'disabled' : 'existing-host-slot-only', illustration: design.illustration ? 'host-slot-only' : 'none' },
    fallbacks,
  };
}

export function toMakeDesignVariables(design = {}) {
  const tokens = toAntdTokens(design);
  const style = design.controls?.style ?? {};
  const rowHeight = dimension(design.metrics?.rowHeight, 44);
  // Include one bottom border and keep a small gutter when large text outgrows a compact row.
  const rowPadding = Math.max(4, (rowHeight - tokens.fontSize * tokens.lineHeight - 1) / 2);
  const presentation = resolveAppPresentation(design);
  const padding = dimension(design.metrics?.padding, dimension(design.layout?.recipe?.padding, 24));
  const shadow = design.choices?.tuning?.fine?.shadow ?? (presentation.componentSuite.rules.panels === 'elevated' ? 'soft' : 'none');
  const shadowValue = shadow === 'none' ? 'none' : shadow === 'raised' ? '0 8px 24px color-mix(in srgb, var(--makeui-ink) 14%, transparent)' : '0 1px 6px color-mix(in srgb, var(--makeui-ink) 8%, transparent)';
  const typography = resolveTypography(design);
  const tracking = typography.tracking.body;
  return {
    '--makeui-bg': tokens.colorBgLayout,
    '--makeui-surface': tokens.colorBgContainer,
    '--makeui-ink': tokens.colorText,
    '--makeui-muted': tokens.colorTextSecondary,
    '--makeui-border': tokens.colorBorderSecondary,
    '--makeui-primary': tokens.colorPrimary,
    '--makeui-accent': tokens.colorPrimary,
    '--makeui-on-accent': tokens.colorTextLightSolid,
    '--makeui-accent-hover': tokens.colorPrimaryHover ?? `color-mix(in srgb, ${tokens.colorPrimary} 88%, ${tokens.colorText})`,
    '--makeui-accent-active': tokens.colorPrimaryActive ?? `color-mix(in srgb, ${tokens.colorPrimary} 80%, ${tokens.colorText})`,
    '--makeui-danger': tokens.colorError,
    '--makeui-success': tokens.colorSuccess,
    '--makeui-warning': tokens.colorWarning,
    '--makeui-hover': style['--mk-hover'] ?? `color-mix(in srgb, ${tokens.colorPrimary} 12%, ${tokens.colorBgContainer})`,
    '--makeui-control-height': `${tokens.controlHeight}px`,
    '--makeui-mode': isDarkDesign(design) ? 'dark' : 'light',
    '--makeui-meta': tokens.colorTextTertiary,
    '--makeui-border-strong': tokens.colorBorder,
    '--makeui-sidebar-bg': design.colors?.['sidebar-bg'] ?? tokens.colorBgContainer,
    '--makeui-sidebar-fg': design.colors?.['sidebar-fg'] ?? tokens.colorText,
    '--makeui-sidebar-active': design.colors?.['sidebar-active'] ?? design.colors?.['surface-warm'] ?? tokens.colorBgLayout,
    '--makeui-surface-warm': design.colors?.['surface-warm'] ?? tokens.colorBgLayout,
    '--makeui-font': tokens.fontFamily,
    '--makeui-font-size': `${tokens.fontSize}px`,
    '--makeui-line-height': String(tokens.lineHeight),
    '--makeui-tracking': `${tracking}em`,
    '--makeui-heading-tracking': `${typography.tracking.heading}em`,
    ...Object.fromEntries(Object.entries(typography.roles).map(([role, value]) => [`--makeui-role-${role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-size`, `${value}px`])),
    '--makeui-mono-font': style['--mk-mono-font'] ?? design.typography?.mono ?? 'ui-monospace, SFMono-Regular, Menlo, monospace',
    '--makeui-shadow': shadowValue,
    '--makeui-gap': `${Math.round(padding * 2 / 3)}px`,
    '--makeui-column-gap': `${Math.round(padding * 5 / 6)}px`,
    '--makeui-detail-column-gap': `${Math.round(padding * 7 / 6)}px`,
    '--makeui-header-padding-block': `${Math.round(padding * 7 / 12)}px`,
    '--makeui-header-padding-inline': `${Math.round(padding * 5 / 6)}px`,
    '--makeui-icon-stroke': design.choices?.icon === 'thin' ? '1.25' : '1.75',
    '--makeui-motion-duration': design.choices?.motion === 'reduced' ? '0ms' : '160ms',
    ...Object.fromEntries(Object.entries(presentation.navigation.widths).map(([key, value]) => [`--makeui-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, `${value}px`])),
    '--makeui-detail-row-height': `${rowHeight}px`,
    '--makeui-detail-row-padding': `${rowPadding}px`,
    '--makeui-heading-font': style['--mk-heading-font'] ?? design.typography?.heading ?? tokens.fontFamily,
    '--makeui-heading-size': `${dimension(style['--mk-heading-size'], dimension(design.metrics?.headingSize, 20))}px`,
    '--makeui-radius': `${tokens.borderRadius}px`,
    '--makeui-content-padding': `${padding}px`,
  };
}

/** Structural match for the public mobile theme API; no mobile runtime dependency. */
export function toMakeMobileTheme(design = {}) {
  const tokens = toAntdTokens(design);
  const variables = toMakeDesignVariables(design);
  const rules = design.layout?.componentSuite?.rules ?? {};
  const primary = tokens.colorPrimary;
  const primarySoft = variables['--makeui-hover'];
  const outlined = rules.action === 'outline';
  const soft = rules.action === 'soft';
  return {
    primary,
    onPrimary: tokens.colorTextLightSolid,
    primarySoft,
    actionBackground: outlined ? 'transparent' : soft ? primarySoft : primary,
    actionText: outlined || soft ? primary : tokens.colorTextLightSolid,
    actionBorder: soft ? 'transparent' : primary,
    actionRadius: `${toAntdComponentTokens(design).Button.borderRadius}px`,
    danger: tokens.colorError,
    success: tokens.colorSuccess,
    warning: tokens.colorWarning,
    surface: tokens.colorBgContainer,
    controlSurface: rules.field === 'inset' ? design.colors?.['surface-warm'] ?? tokens.colorBgLayout : tokens.colorBgContainer,
    page: tokens.colorBgLayout,
    text: tokens.colorText,
    muted: tokens.colorTextSecondary,
    placeholder: tokens.colorTextPlaceholder,
    line: tokens.colorBorderSecondary,
    controlBorder: tokens.colorBorder,
    link: primary,
    focusRing: `color-mix(in srgb, ${primary} 24%, transparent)`,
    mask: `color-mix(in srgb, ${tokens.colorText} 40%, transparent)`,
    fontFamily: tokens.fontFamily,
    headingFontFamily: variables['--makeui-heading-font'],
    monoFontFamily: variables['--makeui-mono-font'],
    contentSize: variables['--makeui-font-size'],
    pageHeaderSize: variables['--makeui-role-phone-header-size'],
    fieldLabelSize: variables['--makeui-role-field-label-size'],
    controlTextSize: variables['--makeui-role-control-text-size'],
    sheetTitleSize: variables['--makeui-role-sheet-title-size'],
    sheetBodySize: variables['--makeui-role-sheet-body-size'],
    sheetMetaSize: variables['--makeui-role-sheet-meta-size'],
    sheetHeadingSize: variables['--makeui-role-sheet-heading-size'],
    lineHeight: variables['--makeui-line-height'],
    letterSpacing: variables['--makeui-tracking'],
    controlRadius: variables['--makeui-radius'],
    shadow: variables['--makeui-shadow'].replaceAll('var(--makeui-ink)', tokens.colorText),
    iconStroke: variables['--makeui-icon-stroke'],
    motionDuration: variables['--makeui-motion-duration'],
  };
}

export function resolveRecordSurface(design = {}, mode) {
  if (mode === 'detail') {
    const choice = design.choices?.detailOpening;
    if (choice === 'page') return { kind: 'page' };
    if (choice === 'drawer' || choice === 'wide-drawer') {
      const widths = design.layout?.structure?.widths;
      const width = choice === 'drawer' ? dimension(widths?.drawer, 560) : dimension(widths?.wideDrawer, 960);
      return { kind: 'drawer', size: `min(${width}px, 88vw)` };
    }
  }
  return { kind: 'drawer', size: '60%' };
}

export const isWideField = (fieldType) =>
  ['Make.Field.TextArea', 'Make.Field.URL', 'Make.Field.File', 'Make.Field.Lookup'].includes(fieldType);
