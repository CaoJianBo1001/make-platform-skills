import {toMobileBrandTheme as projectMobileBrandTheme} from '../mobile-brand-theme.mjs';
import {assertPublicTheme,requireCapability} from './schema.mjs';
import {canvasColor} from './colors.mjs';
const approvalRoles=['recordTitle','sectionTitle','body','fieldLabel','controlText','meta'];
const legacyCanvasKeys=['primaryColor','rowHeight','headerHeight','fontSize','fontFamily','cellPadding','textColor','headerBgColor','rowBgColor','evenRowBgColor','borderColor','hoverColor','scrollbarColor','scrollbarHoverColor','stripeColor'];
const canvasColorPaths={
 primaryColor:'colors.primary',onPrimaryColor:'colors.onPrimary',canvasBgColor:'colors.page',textColor:'colors.text',headerBgColor:'colors.subtleSurface',headerTextColor:'colors.headingText',rowBgColor:'colors.surface',evenRowBgColor:'colors.surface',borderColor:'border.subtleColor',hoverColor:'colors.hoverSurface',stripeColor:'colors.subtleSurface',summaryBgColor:'colors.subtleSurface',summaryTextColor:'colors.text',summaryHoverColor:'colors.hoverSurface',secondaryTextColor:'colors.secondaryText',placeholderTextColor:'colors.placeholderText',selectedBgColor:'colors.selectedSurface',activeBgColor:'colors.activeSurface',activeBorderColor:'colors.primary',skeletonColor:'border.subtleColor',groupBgColor:'colors.subtleSurface',groupTextColor:'colors.headingText',groupCountColor:'colors.tertiaryText',scrollbarColor:'border.color',scrollbarHoverColor:'colors.secondaryText',scrollbarTrackColor:'colors.subtleSurface',tooltipBgColor:'colors.elevatedSurface',tooltipTextColor:'colors.text',
};
function projectCanvas(snapshot,resolveColor,selectedKeys){
 const tokens=assertPublicTheme(snapshot).tokens;
 const {typography:t,density:d,spacing:s,radius:r}=tokens;
 const metrics={fontFamily:t.fontFamily,fontSize:t.roles.body,fontWeight:t.weights.body,headerFontSize:t.roles.fieldLabel,headerFontWeight:t.weights.heading,summaryFontSize:t.roles.controlText,secondaryFontSize:t.roles.meta,rowHeight:d.rowHeight,headerHeight:d.headerHeight,cellPadding:s.tableCell,headerCellPadding:s.tableHeader,tooltipFontSize:t.roles.meta,tooltipPadding:`${s.controlBlock}px ${s.controlInline}px`,tooltipBorderRadius:r.popup};
 const cache=new Map();
 return Object.fromEntries((selectedKeys??[...Object.keys(canvasColorPaths),...Object.keys(metrics)]).map(key=>{
  const path=canvasColorPaths[key];if(!path)return [key,metrics[key]];
  if(!cache.has(path)){const [group,name]=path.split('.');cache.set(path,canvasColor(tokens[group][name],path,resolveColor));}
  return [key,cache.get(path)];
 }));
}
export function toCanvasTableStyle(snapshot,options={}){requireCapability(options.capability,'canvas');return projectCanvas(snapshot,options.resolveColor);}
export function toLegacyCanvasTableStyle(snapshot,options={}){return projectCanvas(snapshot,options.resolveColor,legacyCanvasKeys);}
export function toMobileBrandTheme(snapshot){const c=assertPublicTheme(snapshot).tokens.colors;return projectMobileBrandTheme({primary:c.primary,onPrimary:c.onPrimary,primarySoft:c.primarySoft,link:c.link,focusRing:c.focusRing});}
export function toApprovalTheme(snapshot,options={}){
 requireCapability(options.capability,'approval');const {tokens:t}=assertPublicTheme(snapshot);
 if(options.presentation==='mobile'){const brand=toMobileBrandTheme(snapshot);return {colors:Object.fromEntries(['primary','onPrimary','primarySoft','link','focusRing'].map(key=>[key,brand[key]]))};}
 const colors={...t.colors},border={...t.border};
 // The approval list owns an internal Canvas. Reuse the host's single color I/O boundary.
 // Direct DOM-only consumers can omit resolution and keep valid scoped CSS values.
 if(options.resolveColor!==undefined){
  for(const key of Object.keys(colors))colors[key]=canvasColor(colors[key],`colors.${key}`,options.resolveColor);
  for(const key of ['color','subtleColor'])border[key]=canvasColor(border[key],`border.${key}`,options.resolveColor);
 }
 return {colors,typography:{fontFamily:t.typography.fontFamily,headingFontFamily:t.typography.headingFontFamily,roles:Object.fromEntries(approvalRoles.map(role=>[role,t.typography.roles[role]])),lineHeight:t.typography.lineHeight,weights:{...t.typography.weights},tracking:{...t.typography.tracking}},density:{...t.density},spacing:{...t.spacing},radius:{...t.radius},border,shadow:{...t.shadow}};
}
