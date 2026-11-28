import {assertPublicTheme,PublicThemeError} from './schema.mjs';
import {toCanvasTableStyle,toLegacyCanvasTableStyle,toApprovalTheme,toMobileBrandTheme} from './mappers.mjs';
/** Example binding only: parent owns fixed snapshot, mounted package instances and React state setters. */
export function createControlledPublicThemeBinding(ports){
 const log=ports.logger??((phase,context)=>console.info('[makeui-public-theme]',phase,context));
 return {apply(snapshot,{presentation='desktop'}={}){
  const result={applied:[],compatibility:[],skipped:[]};log('entry',{presentation});
  try{
   assertPublicTheme(snapshot);if(!['desktop','mobile'].includes(presentation))throw new PublicThemeError('INVALID_PRESENTATION','only desktop/mobile projections are supported');
   let canvasStyle,approvalTheme,mobileTheme;
   if(ports.canvas&&presentation==='desktop'){
    canvasStyle=ports.compatibility?.canvas==='legacy-style'?toLegacyCanvasTableStyle(snapshot,{resolveColor:ports.resolveColor}):toCanvasTableStyle(snapshot,{capability:ports.canvas.contract,resolveColor:ports.resolveColor});
    if(ports.compatibility?.canvas==='legacy-style')result.compatibility.push('canvas:legacy-style-only');
   }else if(ports.canvas)result.skipped.push('canvas:mobile-not-applicable');
   if(ports.approval){
    if(ports.compatibility?.approval==='host-slots')result.compatibility.push('approval:host-slots-only');
    else approvalTheme=toApprovalTheme(snapshot,{capability:ports.approval.contract,presentation,resolveColor:ports.resolveColor});
   }
   if(ports.mobile)mobileTheme=toMobileBrandTheme(snapshot);
   // All mapping/capability/color preparation precedes the first visual setter.
   if(canvasStyle){ports.canvas.instance.updateProps({style:canvasStyle});result.applied.push('canvas');}
   if(approvalTheme){ports.approval.setTheme(approvalTheme);result.applied.push('approval');}
   if(mobileTheme){ports.mobile.setTheme(mobileTheme);result.applied.push('mobile');}
   if(ports.host&&presentation==='desktop'){ports.host.setTheme(snapshot.tokens);result.applied.push('host');}
   log('success',{presentation,targets:result.applied.length,compatibility:result.compatibility.length});return result;
  }catch(error){log('failure',{presentation,code:error?.code??'HOST_THEME_APPLY_FAILED'});throw error;}
 }};
}
