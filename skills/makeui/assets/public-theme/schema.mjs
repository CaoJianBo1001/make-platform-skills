export const MAKEUI_PUBLIC_THEME_CONTRACT = 'makeui-public-theme/v1';
export const PUBLIC_THEME_PACKAGE_CONTRACTS = Object.freeze({canvas:'canvas-table/semantic-theme/v1',approval:'make-app-approval/semantic-theme/v1'});
export const PUBLIC_THEME_COPY_CLOSURE = Object.freeze(['public-theme/','antd-foundation/theme.mjs','mobile-brand-theme.mjs','mobile-brand-theme.d.mts']);
export const PUBLIC_THEME_TARGETS = Object.freeze({
  canvas:Object.freeze({contract:PUBLIC_THEME_PACKAGE_CONTRACTS.canvas,availability:'released',compatibility:'explicit legacy ITableStyle subset',hostOwned:'page/drawer recipes; field shape renderer colors; field/section gaps; panel shadows; typography tracking/lineHeight/headingFontFamily; controlHeight; border width'}),
  approval:Object.freeze({contract:PUBLIC_THEME_PACKAGE_CONTRACTS.approval,availability:'released',compatibility:'explicit host renderField/renderLayout slots only; no new props on an older package',hostOwned:'page/drawer recipe, pageTitle and mono font'}),
  mobile:Object.freeze({availability:'verified existing mobile brand interface',fields:Object.freeze(['primary','onPrimary','primarySoft','link','focusRing','actionBackground','actionBorder','actionText']),hostOwned:'all original mobile typography, spacing, density, surfaces, radius, shadow and behavior'}),
});
export class PublicThemeError extends Error {constructor(code,message,details={}){super(`${code}: ${message}`);this.name='PublicThemeError';this.code=code;this.details=details;}}
export const colorKeys=Object.freeze(['primary','onPrimary','primarySoft','link','focusRing','text','headingText','secondaryText','tertiaryText','placeholderText','page','surface','elevatedSurface','subtleSurface','hoverSurface','selectedSurface','activeSurface','mask','success','warning','danger']);
export const pcRoleKeys=Object.freeze(['pageTitle','recordTitle','sectionTitle','body','fieldLabel','controlText','meta']);
const shape=(keys,kind)=>Object.fromEntries(keys.map(key=>[key,kind]));
export const tokenSchema=Object.freeze({
 colors:shape(colorKeys,'text'),
 typography:{fontFamily:'text',headingFontFamily:'text',monoFontFamily:'text',roles:shape(pcRoleKeys,'positive'),lineHeight:'positive',weights:{body:'positive',heading:'positive'},tracking:{body:'finite',heading:'finite'}},
 density:shape(['controlHeight','rowHeight','headerHeight'],'positive'),
 spacing:shape(['controlInline','controlBlock','field','section','tableCell','tableHeader'],'nonnegative'),
 radius:shape(['control','panel','popup'],'nonnegative'),border:{width:'nonnegative',color:'text',subtleColor:'text'},shadow:{panel:'text',popup:'text'},
});
export function plainObject(value,path){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new PublicThemeError('INVALID_THEME_TOKEN',`${path} must be a plain object`,{path});}
export function cloneTokens(value){return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,item&&typeof item==='object'?cloneTokens(item):item]));}
export function validateTokens(tokens,{partial=false,schema=tokenSchema,path='tokens'}={}){
 plainObject(tokens,path);
 for(const key of Object.keys(tokens))if(!Object.hasOwn(schema,key))throw new PublicThemeError('UNKNOWN_TOKEN',`${path}.${key} is not part of v1`,{path:`${path}.${key}`});
 for(const [key,expected] of Object.entries(schema)){
  const next=`${path}.${key}`;if(!Object.hasOwn(tokens,key)){if(partial)continue;throw new PublicThemeError('INVALID_THEME_TOKEN',`${next} is required`,{path:next});}
  const value=tokens[key];if(typeof expected==='object'){validateTokens(value,{partial,schema:expected,path:next});continue;}
  const valid=expected==='text'?typeof value==='string'&&Boolean(value.trim()):typeof value==='number'&&Number.isFinite(value)&&(expected==='positive'?value>0:expected==='nonnegative'?value>=0:true);
  if(!valid)throw new PublicThemeError('INVALID_THEME_TOKEN',`${next} has an invalid ${expected} value`,{path:next});
 }
 return tokens;
}
export function mergeTokens(base,patch){validateTokens(patch,{partial:true});const merge=(left,right)=>Object.fromEntries(Object.entries(left).map(([key,value])=>[key,!Object.hasOwn(right,key)?value:typeof value==='object'?merge(value,right[key]):right[key]]));return merge(cloneTokens(base),patch);}
export function freezeTree(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;}
export function assertPublicTheme(snapshot){if(snapshot?.contract!==MAKEUI_PUBLIC_THEME_CONTRACT)throw new PublicThemeError('UNSUPPORTED_PUBLIC_THEME_CONTRACT','only makeui-public-theme/v1 is supported',{contract:snapshot?.contract});validateTokens(snapshot.tokens);return snapshot;}
export function requireCapability(value,target){if(value!==PUBLIC_THEME_PACKAGE_CONTRACTS[target])throw new PublicThemeError('PUBLIC_THEME_CAPABILITY_REQUIRED',`${target} needs its verified runtime semantic-theme contract; do not infer it from version`,{target,expected:PUBLIC_THEME_PACKAGE_CONTRACTS[target]});}
