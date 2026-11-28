import {createCanvasColorResolver} from './browser-colors.mjs';
import {isConcreteCanvasColor} from './colors.mjs';

/** Run only in a real browser. Uses actual connected DOM, computed CSS and a native Canvas. */
export function runPublicThemeColorBrowserCheck({document,logger=()=>{}}={}) {
  if(!document?.body)throw new Error('A browser Document with a body is required');
  const regions=['#123456','#abcdef'].map(color=>{
    const owner=document.createElement('div');
    owner.style.setProperty('--makeui-check-brand',color);
    owner.style.color='rgb(12, 34, 56)';
    document.body.appendChild(owner);
    return owner;
  });
  const checks=[];
  const check=(name,assertion)=>{assertion();checks.push(name);};
  const sameColor=(actual,expected)=>{
    const context=document.createElement('canvas').getContext('2d');
    context.fillStyle=actual;const left=context.fillStyle;
    context.fillStyle=expected;if(left!==context.fillStyle)throw new Error(`Unexpected resolved color: ${actual}`);
  };
  try {
    const resolver=createCanvasColorResolver({owner:regions[0],logger});
    check('invalid-legacy-rgb-rejected',()=>{
      for(const value of ['rgb(10%, 20, 30%)','rgba(10%, 20, 30%, 0.5)','rgb(1., 2, 3)','rgba(1,2,3,1.)']){
        if(isConcreteCanvasColor(value)||document.defaultView.CSS.supports('color',value))throw new Error(`Invalid concrete RGB accepted: ${value}`);
        let failure;try{resolver(value,'colors.primary');}catch(error){failure=error;}
        if(!failure)throw new Error(`Invalid RGB was not rejected: ${value}`);
      }
    });
    check('valid-rgb-forms-preserved',()=>{
      for(const value of ['rgb(10%,20%,30%)','rgb(1.5,2,3)','rgba(1,2,3,.5)','rgb(10% 20 30% / 50%)']){
        if(!isConcreteCanvasColor(value)||!document.defaultView.CSS.supports('color',value))throw new Error(`Valid RGB rejected: ${value}`);
        resolver(value,'colors.primary');
      }
    });
    check('missing-var-rejected',()=>{
      let failure;try{resolver('var(--makeui-check-missing)','colors.primary');}catch(error){failure=error;}
      if(failure?.code!=='COLOR_RESOLVER_REQUIRED')throw new Error(`Missing var must require resolution, got ${failure?.code??'success'}`);
    });
    check('missing-var-fallback-accepted',()=>sameColor(resolver('var(--makeui-check-missing, #123456)','colors.primary'),'#123456'));
    check('explicit-host-currentColor',()=>sameColor(resolver('currentColor','colors.text'),'rgb(12, 34, 56)'));
    check('color-mix-native-drawable',()=>{
      const result=resolver('color-mix(in srgb, var(--makeui-check-brand) 50%, white)','colors.primarySoft');
      if(!isConcreteCanvasColor(result))throw new Error('color-mix did not become a concrete drawing color');
    });
    check('two-host-scopes-independent',()=>{
      sameColor(resolver('var(--makeui-check-brand)','colors.primary'),'#123456');
      sameColor(createCanvasColorResolver({owner:regions[1],logger})('var(--makeui-check-brand)','colors.primary'),'#abcdef');
    });
    check('temporary-probes-removed',()=>{if(regions.some(owner=>owner.childElementCount!==0))throw new Error('A color probe leaked into the host');});
    return {passed:checks.length,checks};
  } finally {for(const owner of regions)owner.remove();}
}
