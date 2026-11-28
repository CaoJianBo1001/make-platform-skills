import {PublicThemeError} from './schema.mjs';
/** Strict portable drawing form. Other valid CSS colors can be resolved explicitly by the host. */
export function isConcreteCanvasColor(value){
 if(typeof value!=='string')return false;const text=value.trim();
 if(/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(text))return true;
 const match=/^(rgb|rgba)\(([^()]+)\)$/i.exec(text);if(!match)return false;
 const body=match[2],legacy=body.includes(',');let channels,alpha;
 if(legacy){const parts=body.split(',').map(part=>part.trim());if(parts.length!==3&&parts.length!==4)return false;channels=parts.slice(0,3);alpha=parts[3];}
 else {const parts=body.split('/');if(parts.length>2)return false;channels=parts[0].trim().split(/\s+/);alpha=parts[1]?.trim();}
 if(channels.length!==3)return false;
 if(legacy&&channels.some(part=>part.endsWith('%')!==channels[0].endsWith('%')))return false;
 const within=(part,maximum)=>/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(part)&&Number.parseFloat(part)>=0&&Number.parseFloat(part)<=(part.endsWith('%')?100:maximum);
 return channels.every(part=>within(part,255))&&(alpha===undefined||within(alpha,1));
}
export function canvasColor(value,path,resolver){
 if(isConcreteCanvasColor(value))return value.trim();
 if(typeof resolver!=='function')throw new PublicThemeError('COLOR_RESOLVER_REQUIRED',`${path} needs a synchronous Canvas color resolver`,{path});
 let resolved;try{resolved=resolver(value,path);}catch(cause){if(cause instanceof PublicThemeError)throw cause;throw new PublicThemeError('COLOR_RESOLVER_FAILED',`${path} could not be resolved`,{path,cause:cause instanceof Error?cause.message:'resolver failure'});}
 if(!isConcreteCanvasColor(resolved))throw new PublicThemeError('COLOR_RESOLVER_REQUIRED',`${path} resolver returned an unresolved or unsupported drawing color`,{path});
 return resolved.trim();
}
