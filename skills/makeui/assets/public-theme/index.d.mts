import type {MobileBrandTheme} from '../mobile-brand-theme.mjs';
import type {PublicThemeSnapshot,PublicThemeTokens,NormalizePublicThemeInput,CanvasColorResolver,CanvasPublicThemeStyle,LegacyCanvasThemeStyle,ApprovalPublicTheme,ApprovalMobileBrandTheme,ControlledPublicThemePorts,PublicThemeApplyResult,ThemeLogger} from './types.mjs';
export type * from './types.mjs';
export const MAKEUI_PUBLIC_THEME_CONTRACT:'makeui-public-theme/v1';
export const PUBLIC_THEME_PACKAGE_CONTRACTS:Readonly<{canvas:'canvas-table/semantic-theme/v1';approval:'make-app-approval/semantic-theme/v1'}>;
export const PUBLIC_THEME_COPY_CLOSURE:readonly string[];
export const PUBLIC_THEME_TARGETS:Readonly<Record<'canvas'|'approval'|'mobile',Readonly<{contract?:string;availability:string;compatibility?:string;hostOwned:string;fields?:readonly string[]}>>>;
export class PublicThemeError extends Error {constructor(code:string,message:string,details?:Readonly<Record<string,unknown>>);readonly code:string;readonly details:Readonly<Record<string,unknown>>}
export function assertPublicTheme(snapshot:unknown):PublicThemeSnapshot;
export function normalizePublicTheme(input:NormalizePublicThemeInput):PublicThemeSnapshot;
/** Released semantic theme surface: verify the runtime contract in the actually installed package. */
export function toCanvasTableStyle(snapshot:PublicThemeSnapshot,options:{capability:'canvas-table/semantic-theme/v1';resolveColor?:CanvasColorResolver}):CanvasPublicThemeStyle;
/** Older public ITableStyle subset only. Does not claim the full semantic theme surface. */
export function toLegacyCanvasTableStyle(snapshot:PublicThemeSnapshot,options?:{resolveColor?:CanvasColorResolver}):LegacyCanvasThemeStyle;
export function toApprovalTheme(snapshot:PublicThemeSnapshot,options:{capability:'make-app-approval/semantic-theme/v1';presentation?:'desktop';resolveColor?:CanvasColorResolver}):ApprovalPublicTheme;
export function toApprovalTheme(snapshot:PublicThemeSnapshot,options:{capability:'make-app-approval/semantic-theme/v1';presentation:'mobile';resolveColor?:CanvasColorResolver}):ApprovalMobileBrandTheme;
export function toMobileBrandTheme(snapshot:PublicThemeSnapshot):MobileBrandTheme;
export function isConcreteCanvasColor(value:unknown):boolean;
/** Explicit DOM+Canvas I/O boundary, never called by normalization or SSR import. Temporary nodes are removed. */
export function createCanvasColorResolver(input:{owner:Element;createCanvas?:(document:Document)=>HTMLCanvasElement;logger?:ThemeLogger}):CanvasColorResolver;
/** Parent retains business Controller, Form and mounted package instances. Only supplied visual setters run. */
export function createControlledPublicThemeBinding(ports:ControlledPublicThemePorts):{apply:(snapshot:PublicThemeSnapshot,options?:{presentation?:'desktop'|'mobile'})=>PublicThemeApplyResult};

/** Executable host example: no automatic website subscription; owner scopes Canvas CSS resolution. */
export function createFixedProjectThemeHost(ports:ControlledPublicThemePorts&{owner?:Element;createCanvas?:(document:Document)=>HTMLCanvasElement}):{updateProjectTheme:(input:NormalizePublicThemeInput,options?:{presentation?:'desktop'|'mobile'})=>{snapshot:PublicThemeSnapshot;result:PublicThemeApplyResult}};
