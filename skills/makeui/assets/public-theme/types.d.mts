import type {MobileBrandTheme} from '../mobile-brand-theme.mjs';
export type PublicThemeColorKey='primary'|'onPrimary'|'primarySoft'|'link'|'focusRing'|'text'|'headingText'|'secondaryText'|'tertiaryText'|'placeholderText'|'page'|'surface'|'elevatedSurface'|'subtleSurface'|'hoverSurface'|'selectedSurface'|'activeSurface'|'mask'|'success'|'warning'|'danger';
export type PublicThemeRole='pageTitle'|'recordTitle'|'sectionTitle'|'body'|'fieldLabel'|'controlText'|'meta';
export interface PublicThemeTokens {
 colors:Record<PublicThemeColorKey,string>;
 typography:{fontFamily:string;headingFontFamily:string;monoFontFamily:string;roles:Record<PublicThemeRole,number>;lineHeight:number;weights:{body:number;heading:number};tracking:{body:number;heading:number}};
 density:{controlHeight:number;rowHeight:number;headerHeight:number};
 spacing:{controlInline:number;controlBlock:number;field:number;section:number;tableCell:number;tableHeader:number};
 radius:{control:number;panel:number;popup:number};border:{width:number;color:string;subtleColor:string};shadow:{panel:string;popup:string};
}
export type PublicThemePatch={ [Group in keyof PublicThemeTokens]?: { [Key in keyof PublicThemeTokens[Group]]?: PublicThemeTokens[Group][Key] extends object ? Partial<PublicThemeTokens[Group][Key]> : PublicThemeTokens[Group][Key] } };
export interface PublicThemeSnapshot {readonly contract:'makeui-public-theme/v1';readonly tokens:Readonly<PublicThemeTokens>;readonly source:{readonly library:string;readonly fallbacks:readonly string[]}}
export type PublicThemeFoundation={library:'antd'}|{library:string;baseline:PublicThemeTokens;resolveDesign?:(design:object,baseline:Readonly<PublicThemeTokens>)=>PublicThemePatch};
export interface NormalizePublicThemeInput {design?:object;foundation:PublicThemeFoundation;overrides?:PublicThemePatch}
/** Synchronous, host-owned resolution only. Returning a Promise or unresolved CSS fails the Canvas mapper. */
export type CanvasColorResolver=(value:string,path:string)=>string;
export interface CanvasPublicThemeStyle {
 primaryColor:string;onPrimaryColor:string;canvasBgColor:string;textColor:string;headerBgColor:string;headerTextColor:string;rowBgColor:string;evenRowBgColor:string;borderColor:string;hoverColor:string;stripeColor:string;summaryBgColor:string;summaryTextColor:string;summaryHoverColor:string;secondaryTextColor:string;placeholderTextColor:string;selectedBgColor:string;activeBgColor:string;activeBorderColor:string;skeletonColor:string;groupBgColor:string;groupTextColor:string;groupCountColor:string;scrollbarColor:string;scrollbarHoverColor:string;scrollbarTrackColor:string;tooltipBgColor:string;tooltipTextColor:string;
 fontFamily:string;fontSize:number;fontWeight:number;headerFontSize:number;headerFontWeight:number;summaryFontSize:number;secondaryFontSize:number;rowHeight:number;headerHeight:number;cellPadding:number;headerCellPadding:number;tooltipFontSize:number;tooltipPadding:string;tooltipBorderRadius:number;
}
export type LegacyCanvasThemeStyle=Pick<CanvasPublicThemeStyle,'primaryColor'|'rowHeight'|'headerHeight'|'fontSize'|'fontFamily'|'cellPadding'|'textColor'|'headerBgColor'|'rowBgColor'|'evenRowBgColor'|'borderColor'|'hoverColor'|'scrollbarColor'|'scrollbarHoverColor'|'stripeColor'>;
export type ApprovalRole=Exclude<PublicThemeRole,'pageTitle'>;
export interface ApprovalPublicTheme {colors:PublicThemeTokens['colors'];typography:{fontFamily:string;headingFontFamily:string;roles:Record<ApprovalRole,number>;lineHeight:number;weights:{body:number;heading:number};tracking:{body:number;heading:number}};density:PublicThemeTokens['density'];spacing:PublicThemeTokens['spacing'];radius:PublicThemeTokens['radius'];border:PublicThemeTokens['border'];shadow:PublicThemeTokens['shadow']}
export interface ApprovalMobileBrandTheme {colors:Pick<PublicThemeTokens['colors'],'primary'|'onPrimary'|'primarySoft'|'link'|'focusRing'>}
export type ThemeLogger=(phase:'entry'|'success'|'failure',context:Readonly<Record<string,unknown>>)=>void;
export interface ControlledPublicThemePorts {
 canvas?:{contract?:string;instance:{updateProps:(patch:{style:CanvasPublicThemeStyle|LegacyCanvasThemeStyle})=>void}};
 approval?:{contract?:string;setTheme:(theme:ApprovalPublicTheme|ApprovalMobileBrandTheme)=>void};
 mobile?:{setTheme:(theme:MobileBrandTheme)=>void};host?:{setTheme:(tokens:Readonly<PublicThemeTokens>)=>void};
 resolveColor?:CanvasColorResolver;compatibility?:{canvas?:'legacy-style';approval?:'host-slots'};logger?:ThemeLogger;
}
export interface PublicThemeApplyResult {applied:string[];compatibility:string[];skipped:string[]}
