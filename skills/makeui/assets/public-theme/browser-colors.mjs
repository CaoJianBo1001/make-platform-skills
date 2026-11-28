import {PublicThemeError} from './schema.mjs';
import {isConcreteCanvasColor} from './colors.mjs';
/** Explicit synchronous I/O boundary. Owns temporary nodes/canvas only; no globals, network or SSR work. */
export function createCanvasColorResolver({owner,createCanvas,logger}={}){
 const log=logger??((phase,context)=>console.info('[makeui-canvas-color]',phase,context));
 return function resolveCanvasColor(value,path){
  log('entry',{path});let probe;
  try{
   const doc=owner?.ownerDocument,view=doc?.defaultView;
   if(!owner?.isConnected||!view||typeof view.getComputedStyle!=='function')throw new PublicThemeError('DOM_COLOR_RESOLVER_REQUIRED',`${path} needs a connected host-owned color scope`,{path});
   if(typeof value!=='string'||!value.trim())throw new PublicThemeError('INVALID_THEME_COLOR',`${path} is not a CSS color`,{path});
   if(typeof view.CSS?.supports!=='function')throw new PublicThemeError('DOM_COLOR_RESOLVER_REQUIRED',`${path} needs CSS.supports to validate the resolved host expression`,{path});
   // A missing var() makes color invalid at computed-value time and inherits the
   // owner's color. Resolve it as a private custom property first so that inherited
   // black can never be mistaken for the selected theme value.
   const property='--makeui-public-theme-color-probe';
   probe=doc.createElement('span');probe.setAttribute('aria-hidden','true');
   probe.style.setProperty('display','none','important');
   probe.style.setProperty(property,value,'important');
   owner.appendChild(probe);
   const expression=view.getComputedStyle(probe).getPropertyValue(property).trim();
   if(!expression||/var\(/i.test(expression))throw new PublicThemeError('COLOR_RESOLVER_REQUIRED',`${path} has an unresolved host variable`,{path});
   if(!view.CSS.supports('color',expression))throw new PublicThemeError('INVALID_THEME_COLOR',`${path} does not resolve to a CSS color`,{path});
   probe.style.setProperty('color',expression,'important');
   const computed=view.getComputedStyle(probe).color;
   if(/var\(|color-mix\(|currentcolor|inherit|initial|unset/i.test(computed)||!computed)throw new PublicThemeError('COLOR_RESOLVER_REQUIRED',`${path} remains unresolved in the host scope`,{path});
   const canvas=createCanvas?createCanvas(doc):doc.createElement('canvas');canvas.width=1;canvas.height=1;const context=canvas.getContext('2d');
   if(!context)throw new PublicThemeError('CANVAS_COLOR_RESOLVER_REQUIRED',`${path} needs a working 2D color validation context`,{path});
   context.fillStyle='#010203';context.fillStyle=computed;const first=context.fillStyle;
   context.fillStyle='#040506';context.fillStyle=computed;const second=context.fillStyle;
   if(first!==second)throw new PublicThemeError('INVALID_CANVAS_COLOR',`${path} was rejected by the native drawing context`,{path});
   let output=second;
   if(!isConcreteCanvasColor(output)){context.clearRect(0,0,1,1);context.fillRect(0,0,1,1);const pixel=context.getImageData(0,0,1,1).data;output=`rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3]/255})`;}
   if(!isConcreteCanvasColor(output))throw new PublicThemeError('INVALID_CANVAS_COLOR',`${path} has no supported concrete drawing result`,{path});
   log('success',{path});return output;
  }catch(error){log('failure',{path,code:error?.code??'COLOR_RESOLUTION_FAILED'});throw error;}
  finally{probe?.remove();}
 };
}
