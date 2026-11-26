import type { CSSProperties } from 'react';
import type { ThemeConfig } from 'antd';
import type { MakeDesignPresentation, MakeRecordMode, ResolvedAppPresentation, ResolvedTypography } from './types';

export const MAKEUI_ANTD_FOUNDATION_CONTRACT: 'makeui-antd-foundation/v1';
export function resolveTypography(design?: MakeDesignPresentation): ResolvedTypography;
export function isDarkDesign(design?: MakeDesignPresentation): boolean;
export function toAntdTokens(design?: MakeDesignPresentation): NonNullable<ThemeConfig['token']>;
export function toAntdComponentTokens(design?: MakeDesignPresentation): NonNullable<ThemeConfig['components']>;
export function toMakeDesignVariables(design?: MakeDesignPresentation): CSSProperties & Record<`--makeui-${string}`, string>;
/** Assignable to the public mobile ThemeProvider; requires a verified supporting package. */
export function toMakeMobileTheme(design?: MakeDesignPresentation): Record<'primary' | 'onPrimary' | 'primarySoft' | 'actionBackground' | 'actionText' | 'actionBorder' | 'actionRadius' | 'danger' | 'success' | 'warning' | 'surface' | 'controlSurface' | 'page' | 'text' | 'muted' | 'placeholder' | 'line' | 'controlBorder' | 'link' | 'focusRing' | 'mask' | 'fontFamily' | 'headingFontFamily' | 'monoFontFamily' | 'contentSize' | 'pageHeaderSize' | 'fieldLabelSize' | 'controlTextSize' | 'sheetTitleSize' | 'sheetBodySize' | 'sheetMetaSize' | 'sheetHeadingSize' | 'lineHeight' | 'letterSpacing' | 'controlRadius' | 'shadow' | 'iconStroke' | 'motionDuration', string>;
export function resolveRecordSurface(design: MakeDesignPresentation | undefined, mode: MakeRecordMode): { kind: 'page' } | { kind: 'drawer'; size: string };
export function isWideField(fieldType?: string): boolean;
export function resolveAppPresentation(design?: MakeDesignPresentation): ResolvedAppPresentation;
