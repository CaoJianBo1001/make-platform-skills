import {normalizePublicTheme} from './normalize.mjs';
import {createCanvasColorResolver} from './browser-colors.mjs';
import {createControlledPublicThemeBinding} from './controlled-host.mjs';

/**
 * Executable host example. Supply existing mounted Canvas instance and controlled
 * approval/mobile state setters. Read each semantic theme contract from its real public
 * runtime export; an old package must use the explicit compatibility option.
 *
 * Keep the selected design JSON in the project. Call updateProjectTheme only when
 * that project deliberately updates its fixed snapshot. This code does no fetching,
 * subscription, package construction, key changes or business Controller work.
 * owner is the connected project region whose CSS variables/currentColor Canvas uses.
 */
export function createFixedProjectThemeHost({owner,createCanvas,...ports}) {
  const binding=createControlledPublicThemeBinding({
    ...ports,
    resolveColor:ports.resolveColor??(owner||ports.canvas?createCanvasColorResolver({owner,createCanvas,logger:ports.logger}):undefined),
  });
  return {
    updateProjectTheme(input,options) {
      const snapshot=normalizePublicTheme(input);
      const result=binding.apply(snapshot,options);
      return {snapshot,result};
    },
  };
}
