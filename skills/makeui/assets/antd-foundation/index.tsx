import './styles.css';

export { MakeDesignProvider, MakeRecordSurface, MakeFormLayout, MakeFormItem, MakeDetailGrid, MakeFieldLabel, MakeActionButton, MakeStatusTag, MakeTabs } from './components';
export { MakeAppShell } from './app-shell';
export { useMakeDesign } from './design-context';
export { MAKEUI_ANTD_FOUNDATION_CONTRACT, isDarkDesign, toAntdTokens, toAntdComponentTokens, toMakeDesignVariables, toMakeMobileTheme, resolveRecordSurface, resolveAppPresentation, resolveTypography, isWideField } from './theme.mjs';
export { createMakeDesignTheme } from './theme-config';
export type { MakeDesignPresentation, MakeRecordMode, MakeRecordSurfaceProps, MakeFormLayoutProps, MakeFormItemProps, MakeDetailItem, MakeDetailGridProps, MakeAppShellProps, MakeNavigationMode, ResolvedAppPresentation, MakeTypographyRole, ResolvedTypography } from './types';
