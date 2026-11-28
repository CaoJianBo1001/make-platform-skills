// Existing pure parser only: no AntD/React runtime or second MakeDesign decoding implementation.
import {toAntdTokens,toMakeDesignVariables,toMakeMobileTheme,resolveTypography} from '../antd-foundation/theme.mjs';
import {pcRoleKeys} from './schema.mjs';
export function resolveAntdSource(design={}){
 const base=toAntdTokens(design),variables=toMakeDesignVariables(design),mobile=toMakeMobileTheme(design),typography=resolveTypography(design);
 const gap=Number.parseFloat(variables['--makeui-gap']),section=Number.parseFloat(variables['--makeui-content-padding']),rowHeight=Number.parseFloat(variables['--makeui-detail-row-height']);
 const shadow=variables['--makeui-shadow'].replaceAll('var(--makeui-ink)',base.colorText);
 return {tokens:{
  colors:{primary:base.colorPrimary,onPrimary:base.colorTextLightSolid,primarySoft:mobile.primarySoft,link:mobile.link,focusRing:mobile.focusRing,text:base.colorText,headingText:base.colorTextHeading,secondaryText:base.colorTextSecondary,tertiaryText:base.colorTextTertiary,placeholderText:base.colorTextPlaceholder,page:base.colorBgLayout,surface:base.colorBgContainer,elevatedSurface:base.colorBgElevated,subtleSurface:design.colors?.['surface-warm']??base.colorBgLayout,hoverSurface:mobile.primarySoft,selectedSurface:mobile.primarySoft,activeSurface:mobile.primarySoft,mask:mobile.mask,success:base.colorSuccess,warning:base.colorWarning,danger:base.colorError},
  typography:{fontFamily:base.fontFamily,headingFontFamily:variables['--makeui-heading-font'],monoFontFamily:variables['--makeui-mono-font'],roles:Object.fromEntries(pcRoleKeys.map(role=>[role,typography.roles[role]])),lineHeight:base.lineHeight,weights:{body:400,heading:600},tracking:{body:typography.tracking.body,heading:typography.tracking.heading}},
  density:{controlHeight:base.controlHeight,rowHeight,headerHeight:rowHeight},
  spacing:{controlInline:gap/2,controlBlock:gap/4,field:gap,section,tableCell:gap/2,tableHeader:gap/2},
  radius:{control:base.borderRadius,panel:base.borderRadiusLG,popup:base.borderRadiusLG},
  border:{width:1,color:base.colorBorder,subtleColor:base.colorBorderSecondary},shadow:{panel:shadow,popup:base.boxShadowSecondary??shadow},
 },fallbacks:[...typography.fallbacks,'typography.weights:official-antd-v6:400/600','border.width:official-antd-v6:lineWidth=1','spacing:existing-makeui-gap projection, controlInline/table=gap/2,controlBlock=gap/4','density.headerHeight:existing-makeui-row-height']};
}
