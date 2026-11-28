import {resolveAntdSource} from './antd-source.mjs';
import {MAKEUI_PUBLIC_THEME_CONTRACT,PublicThemeError,plainObject,validateTokens,cloneTokens,mergeTokens,freezeTree} from './schema.mjs';
/** Fixed project data in; explicit project update out. No URL, network, timers or global theme state. */
export function normalizePublicTheme(input){
 const foundation=input?.foundation;
 if(!foundation||typeof foundation.library!=='string'||!foundation.library.trim())throw new PublicThemeError('FOUNDATION_REQUIRED','the already selected component foundation is required');
 if(input.design!==undefined)plainObject(input.design,'design');
 let tokens,fallbacks=[];
 if(foundation.library==='antd')({tokens,fallbacks}=resolveAntdSource(input.design));
 else {
  if(!foundation.baseline)throw new PublicThemeError('FOUNDATION_BASELINE_REQUIRED',`${foundation.library} must provide its own complete semantic baseline`);
  validateTokens(foundation.baseline);tokens=cloneTokens(foundation.baseline);
  if(input.design!==undefined){
   if(typeof foundation.resolveDesign!=='function')throw new PublicThemeError('FOUNDATION_RESOLVER_REQUIRED',`${foundation.library} needs its explicit pure design resolver; AntD defaults are not substituted`);
   tokens=mergeTokens(tokens,foundation.resolveDesign(input.design,freezeTree(cloneTokens(tokens))));
  }
 }
 validateTokens(tokens);if(input.overrides!==undefined)tokens=mergeTokens(tokens,input.overrides);validateTokens(tokens);
 return freezeTree({contract:MAKEUI_PUBLIC_THEME_CONTRACT,tokens:cloneTokens(tokens),source:{library:foundation.library,fallbacks:[...fallbacks]}});
}
