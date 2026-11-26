import { theme, type ThemeConfig } from 'antd';
import type { MakeDesignPresentation } from './types';
import { isDarkDesign, toAntdComponentTokens, toAntdTokens } from './theme.mjs';

function explicitColors(design?: MakeDesignPresentation) {
  const colors = design?.colors ?? {};
  const style = design?.controls?.style ?? {};
  const accent = style['--mk-accent'] ?? colors.accent;
  const ink = style['--mk-ink'] ?? colors.fg;
  const surface = style['--mk-surface'] ?? colors.surface;
  const hover = style['--mk-hover'];
  return Object.fromEntries(Object.entries({
    colorPrimary: accent,
    colorPrimaryHover: colors['accent-hover'],
    colorPrimaryActive: colors['accent-active'],
    colorInfo: accent,
    colorTextLightSolid: style['--mk-on-accent'] ?? colors['accent-on'],
    colorText: ink,
    colorTextHeading: colors['fg-2'] ?? ink,
    colorTextSecondary: colors.muted,
    colorTextTertiary: colors.meta ?? colors.muted,
    colorTextPlaceholder: colors.meta,
    colorBgBase: colors.bg,
    colorBgLayout: colors.bg,
    colorBgContainer: surface,
    colorBgElevated: surface,
    colorBorder: style['--mk-border'] ?? colors.border,
    colorBorderSecondary: colors['border-soft'] ?? colors.border,
    colorSuccess: colors.success,
    colorWarning: colors.warn,
    colorError: style['--mk-danger'] ?? colors.danger,
    controlItemBgHover: hover,
    colorBgTextHover: hover,
  }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0));
}

/** Keep the official algorithm's other defaults and derivatives; only resolved plan colors win. */
export function createMakeDesignTheme(design?: MakeDesignPresentation): ThemeConfig {
  const baseAlgorithm = isDarkDesign(design) ? theme.darkAlgorithm : theme.defaultAlgorithm;
  const colors = explicitColors(design);
  const dimensions = Object.fromEntries(Object.entries(toAntdTokens(design))
    .filter(([name]) => !name.startsWith('color') && name !== 'controlItemBgHover'));
  const algorithm: typeof baseAlgorithm = (seed, mapToken) => ({
    ...baseAlgorithm(seed, mapToken),
    ...colors,
  });
  return {
    algorithm,
    token: { ...dimensions, ...colors, motion: design?.choices?.motion !== 'reduced' },
    components: toAntdComponentTokens(design),
  };
}
