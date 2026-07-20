#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const USAGE = `Usage:
  node skills/make-app-auth/scripts/audit-auth-contract.mjs <project-root> [--mode direct|service-fronted|auto] [--published]

Checks Make App unified-login contract drift. This is auth-scoped; it does not verify schema rendering or UI layout.`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

let projectRoot = null;
let mode = 'auto';
let published = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--published') {
    published = true;
    continue;
  }
  if (arg === '--mode') {
    mode = args[index + 1] || '';
    index += 1;
    continue;
  }
  if (arg.startsWith('--mode=')) {
    mode = arg.slice('--mode='.length);
    continue;
  }
  if (!projectRoot) {
    projectRoot = arg;
    continue;
  }
  failUsage(`Unexpected argument: ${arg}`);
}

if (!projectRoot) {
  projectRoot = process.cwd();
}

if (!['auto', 'direct', 'service-fronted'].includes(mode)) {
  failUsage(`Invalid --mode: ${mode}`);
}

const root = path.resolve(projectRoot);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  failUsage(`Project root does not exist or is not a directory: ${root}`);
}

const uiFiles = collectSourceFiles(firstExisting([
  'apps/ui/src',
  'apps/ui',
  'ui/src',
  'src'
]));
const serviceFiles = collectSourceFiles(firstExisting([
  'apps/service/src',
  'apps/service',
  'service/src',
  'server/src'
]));
const serviceRuntimeFiles = serviceFiles.filter(isRuntimeSourceFile);
const allProjectFiles = collectSourceFiles(root);
const uiText = readJoined(uiFiles);
const serviceText = readJoined(serviceRuntimeFiles);
const projectText = readJoined(allProjectFiles);
const sdkDependencyDeclarations = findSdkDependencyDeclarations(allProjectFiles);
const inferredMode = mode === 'auto' ? inferMode() : mode;

const failures = [];
const warnings = [];

if (uiFiles.length === 0) {
  failures.push('no_ui_source: cannot find UI source under apps/ui/src, apps/ui, ui/src, or src');
}

if (!/@qfeius\/make-app-auth/.test(projectText) && !/createMakeAppAuth\s*\(/.test(projectText)) {
  failures.push('sdk_missing: project does not appear to use @qfeius/make-app-auth');
}

for (const hit of findRawMakeFetches(uiFiles)) {
  failures.push(`raw_make_fetch: ${relative(hit.file)} uses raw fetch for ${hit.url}; use auth.api through the shared adapter`);
}

if (hasTokenMode(uiText) || hasServiceTokenModeWithoutLocalPreview(serviceText)) {
  failures.push('token_mode_present: make-app-auth skill only supports unified login in UI and published runtime; remove browser token options and unguarded Service token-mode switches');
}

if (published) {
  for (const declaration of sdkDependencyDeclarations.filter(({ version }) => isVersionBelow(version, [0, 1, 3]))) {
    failures.push(`sdk_version_too_old: ${relative(declaration.file)} declares @qfeius/make-app-auth ${declaration.version}; published Apps require >= 0.1.3`);
  }
  if (!/apiAuthRedirect\s*:\s*true/.test(projectText)) {
    warnings.push('published_api_auth_redirect_missing: generated unified-login Apps should set apiAuthRedirect:true with SDK >= 0.1.3');
  }
  if (hasUnsupportedSdkReadyStatus(uiText)) {
    failures.push('unsupported_sdk_ready_status: @qfeius/make-app-auth init returns authenticated/redirecting/unauthenticated/forbidden/failed, not ready');
  }
  if (!hasRecoverableAuthExpiredHandling(uiText)) {
    failures.push('recoverable_auth_expired_missing: generated unified-login Apps must handle state_expired/challenge_expired by showing a relogin prompt');
  }
}

if (inferredMode === 'service-fronted') {
  if (hasUiDirectGatewayCalls(uiText)) {
    failures.push('service_fronted_ui_bypass: UI calls /data/** or /meta/** through auth.api; UI should call Service-owned /app/** paths');
  }
  for (const hit of findRawMakeDownloadResourceUrls(uiFiles)) {
    failures.push(`service_fronted_raw_download_resource: ${relative(hit.file)} uses ${hit.attribute} with raw Make download URL ${hit.url}; use a Service-owned download proxy URL`);
  }
  if (hasRawMakeDownloadLiteral(uiText) && !hasServiceDownloadProxyLiteral(uiText)) {
    warnings.push('service_fronted_download_proxy_not_obvious: UI mentions raw Make download paths but no Service download proxy path was found');
  }
  if (hasServiceFrontedApiOnlyPrefix(projectText)) {
    failures.push('service_fronted_missing_make_prefix: Service-fronted published Apps use /api/make/auth/** and normally /api/make/app/**, not /api/auth/** or /api/app/**');
  }
  if (!hasServiceFrontedGatewayBaseMakePrefix(uiText)) {
    failures.push('service_fronted_gateway_base_wrong: Service-fronted UI must configure gatewayBaseUrl as /api/make so auth.api("/app/**") reaches /api/make/app/**');
  }
  const hasAuthNamespaceProxy = hasServiceFrontedNamespaceProxy(serviceText, 'auth');
  const hasOauthNamespaceProxy = hasServiceFrontedNamespaceProxy(serviceText, 'oauth');
  if (!hasAuthNamespaceProxy || !hasOauthNamespaceProxy) {
    failures.push('auth_proxy_missing: Service-fronted App must proxy /api/make/auth/** and /api/make/oauth/** as namespace-level routes to make-gateway');
  }
  if (hasBroadMakeGatewayPassthrough(serviceText)) {
    failures.push('service_fronted_catch_all_passthrough: Service-fronted App must not proxy broad /api/make/** traffic to make-gateway; keep auth/oauth namespace proxies and explicit /api/make/app/** business routes');
  }
  if (hasBroadServiceAppBusinessPassthrough(serviceText)) {
    failures.push('service_fronted_app_catch_all_passthrough: Service-fronted App must not proxy broad /api/make/app/** traffic to raw Make data/meta paths; keep Service-owned business routes explicit');
  }
  if (published && hasPublishedPreviewAuthShadow(serviceText)) {
    failures.push('local_preview_auth_shadow: published /api/make/auth/current-context or runtime-view must not be served by local preview handlers; gate preview routes with MAKE_APP_LOCAL_PREVIEW=true and let published auth paths proxy to make-gateway');
  }
  if (hasQuerySensitivePreviewAuthRouteMatch(serviceText)) {
    failures.push('local_preview_auth_query_sensitive_match: local preview current-context/runtime-view must match pathname or mounted req.path, not exact req.url/originalUrl; SDK may append return_url query parameters');
  }
  if (!/\/api\/make\/app\b/.test(projectText) && !/auth\.api\.(?:get|post|put|patch|delete|request)\(\s*[`'"]\/app\//.test(uiText)) {
    warnings.push('service_fronted_app_route_missing: could not find Service-owned /api/make/app/** or UI /app/** calls');
  }
  if (hasAuthNamespaceProxy && !hasManualRedirectPreservation(serviceText)) {
    failures.push('session_complete_redirect_not_manual: session/complete proxy must preserve gateway 302/Set-Cookie/Location');
  }
  if (hasAuthNamespaceProxy && !hasSetCookiePassthrough(serviceText)) {
    failures.push('session_complete_set_cookie_not_preserved: auth proxy must preserve gateway Set-Cookie for /api/make/auth/session/complete');
  }
  if (hasAuthNamespaceProxy && !hasLocationPassthrough(serviceText)) {
    failures.push('session_complete_location_not_preserved: auth proxy must preserve gateway Location for /api/make/auth/session/complete');
  }
  if (hasInternalGatewayApiPrefix(serviceText)) {
    failures.push('service_fronted_business_gateway_scope_wrong: published Service running inside k8s must call make-gateway without /api prefix, for example http://make-gateway/make/auth|meta|data/**; reserve public /api/make upstream scope for MAKE_APP_LOCAL_PREVIEW=true only');
  }
  if (hasForwardedHostPassthrough(serviceText)) {
    failures.push('forwarded_host_passthrough_present: Service-fronted proxy must not trust or pass through client supplied X-Forwarded-Host; derive it from inbound Host');
  }
  if (!hasForwardedHostFallback(serviceText)) {
    failures.push('forwarded_host_context_missing: Service-fronted proxy must derive X-Forwarded-Host from inbound Host when the header is absent');
  }
  if (!hasForwardedProtoFallback(serviceText)) {
    failures.push('forwarded_proto_context_missing: Service-fronted proxy must add X-Forwarded-Proto when forwarding to make-gateway');
  }
  if (!/(req\.headers\.cookie|headers\.cookie|(?:request|req)\.headers\.get\(\s*[`'"]cookie[`'"]|(?:request|req)\.header\(\s*[`'"]cookie[`'"]|(?:source|inboundHeaders|headers)\.get\(\s*[`'"]cookie[`'"]|cookie\s*:)/i.test(serviceText)) {
    warnings.push('cookie_forwarding_not_obvious: could not find obvious Cookie forwarding in Service code');
  }
} else {
  if (/auth\.api\.(?:get|post|put|patch|delete|request)\(\s*[`'"]\/app\//.test(uiText)) {
    failures.push('direct_mode_app_route: direct gateway mode should not call Service-owned /app/** routes');
  }
}

printResult();
process.exit(failures.length > 0 ? 1 : 0);

function failUsage(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(2);
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    const absolute = path.join(root, candidate);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
      return absolute;
    }
  }
  return null;
}

function collectSourceFiles(start) {
  if (!start) {
    return [];
  }
  const files = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (shouldSkipDir(path.basename(current))) {
        continue;
      }
      for (const child of fs.readdirSync(current)) {
        stack.push(path.join(current, child));
      }
      continue;
    }
    if (stat.isFile() && isSourceFile(current)) {
      files.push(current);
    }
  }
  return files.sort();
}

function shouldSkipDir(name) {
  return new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.turbo']).has(name);
}

function isSourceFile(file) {
  return /\.(cjs|mjs|js|jsx|ts|tsx|json|html|vue|svelte)$/i.test(file);
}

function isRuntimeSourceFile(file) {
  const basename = path.basename(file);
  return !/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(basename)
    && !/(?:^|[/\\])(?:__tests__|test|tests)(?:[/\\]|$)/i.test(file);
}

function readJoined(files) {
  return files.map((file) => {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  }).join('\n');
}

function findSdkDependencyDeclarations(files) {
  const declarations = [];
  for (const file of files.filter((candidate) => path.basename(candidate) === 'package.json')) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      const version = manifest?.[section]?.['@qfeius/make-app-auth'];
      if (typeof version === 'string' && version.trim()) {
        declarations.push({ file, version: version.trim() });
      }
    }
  }
  return declarations;
}

function isVersionBelow(version, minimum) {
  const match = version.match(/(?:^|[^\d])(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return false;
  }
  const current = match.slice(1, 4).map(Number);
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] !== minimum[index]) {
      return current[index] < minimum[index];
    }
  }
  return false;
}

function inferMode() {
  if (
    serviceFiles.length > 0 &&
    (/auth\.api\.(?:get|post|put|patch|delete|request)\(\s*[`'"]\/app\//.test(uiText) || /\/api\/app\b/.test(projectText) || /\/api\/make\/app\b/.test(projectText))
  ) {
    return 'service-fronted';
  }
  return 'direct';
}

function findRawMakeFetches(files) {
  const hits = [];
  const rawFetch = /(?:window\.)?fetch\s*\(\s*([`'"])([^`'"]*\/api\/make[^`'"]*)\1/g;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = rawFetch.exec(text))) {
      hits.push({ file, url: match[2] });
    }
  }
  return hits;
}

function hasTokenMode(text) {
  return (
    /authMode\s*[:=]\s*[`'"]token[`'"]/.test(text) ||
    /VITE_MAKE_AUTH_MODE[\s\S]{0,120}(?:\?\?|\|\|)\s*[`'"]token[`'"]/.test(text) ||
    /MAKE_AUTH_MODE[\s\S]{0,120}(?:\?\?|\|\|)\s*[`'"]token[`'"]/.test(text) ||
    /unifiedLogin\s*:\s*false/.test(text) ||
    /\b(?:accessToken|tokenProvider)\s*:/.test(text) ||
    /createMakeAppAuth\s*\(\s*\{(?:(?!\}\s*\)).){0,1000}\btoken\s*:\s*[^,}\n]+/s.test(text) ||
    /~\/\.make\/credentials/.test(text)
  );
}

function hasServiceTokenModeWithoutLocalPreview(text) {
  const hasServiceTokenMode = /MAKE_AUTH_MODE[\s\S]{0,120}(?:\?\?|\|\|)\s*[`'"]token[`'"]/.test(text) ||
    /unifiedLogin\s*:\s*false/.test(text) ||
    /\b(?:accessToken|tokenProvider)\s*:/.test(text) ||
    /createMakeAppAuth\s*\(\s*\{(?:(?!\}\s*\)).){0,1000}\btoken\s*:\s*[^,}\n]+/s.test(text) ||
    /~\/\.make\/credentials/.test(text);
  return hasServiceTokenMode && !/MAKE_APP_LOCAL_PREVIEW/.test(text);
}

function hasUiDirectGatewayCalls(text) {
  return /auth\.api\.(?:get|post|put|patch|delete|request)\(\s*[`'"]\/(?:data|meta)\b/.test(text);
}

function findRawMakeDownloadResourceUrls(files) {
  const hits = [];
  const resourceLiteral = /\b(src|href|data)\s*=\s*\{?\s*([`'"])([^`'"]*(?:\/api\/make\/data\/v1\/download|\/api\/data\/v1\/download|\/make\/data\/v1\/download|(?<![\w-])\/data\/v1\/download)[^`'"]*)\2\s*\}?/g;

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = resourceLiteral.exec(text))) {
      hits.push({
        file,
        attribute: match[1],
        url: match[3],
      });
    }
  }

  return hits;
}

function hasRawMakeDownloadLiteral(text) {
  return /(?:\/api\/make\/data\/v1\/download|\/api\/data\/v1\/download|\/make\/data\/v1\/download|(?<![\w-])\/data\/v1\/download)/.test(text);
}

function hasServiceDownloadProxyLiteral(text) {
  return /(?:\/api\/make\/app\/files\/download|\/api\/files\/download|\/app\/files\/download)/.test(text);
}

function hasRecoverableAuthExpiredHandling(text) {
  return /state_expired/.test(text)
    && /challenge_expired/.test(text)
    && /auth\.login\(\s*\{\s*redirect\s*:\s*true\s*\}\s*\)/.test(text);
}

function hasUnsupportedSdkReadyStatus(text) {
  return /\b(?:result|boot|initResult|authResult)\.status\s*={2,3}\s*[`'"]ready[`'"]/.test(text);
}

function hasInternalGatewayApiPrefix(text) {
  const patterns = [
    /make-gateway[^`'"\s)]{0,160}\/api\/make\b/gi,
    /fetch\(\s*[`'"]\/api\/make\/(?:auth|meta|data)\b/gi,
    /\$\{\s*[^}]*makeGateway[^}]*\}\s*\/api\/make\b/gi,
    /\b(?:makeGatewayBaseUrl|makeGatewayOrigin|gatewayOrigin)\b\s*\+\s*[`'"]\/api\/make\b/gi,
  ];

  return patterns.some((pattern) => hasUngatedMatch(text, pattern, isPreviewRouteGated));
}

function hasUngatedMatch(text, pattern, isGated) {
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text))) {
    const contextStart = Math.max(0, match.index - 360);
    const contextEnd = Math.min(text.length, pattern.lastIndex + 360);
    if (!isGated(text.slice(contextStart, contextEnd))) {
      return true;
    }
  }
  return false;
}

function hasManualRedirectPreservation(text) {
  return /redirect\s*:\s*[`'"]manual[`'"]/.test(text) || /maxRedirects\s*:\s*0/.test(text);
}

function hasSetCookiePassthrough(text) {
  return /getSetCookie\s*\(/.test(text)
    || /(?:append|set|header|setHeader)\(\s*[`'"]set-cookie[`'"]/i.test(text)
    || /headers\.raw\(\)\s*\[\s*[`'"]set-cookie[`'"]\s*\]/i.test(text);
}

function hasLocationPassthrough(text) {
  return /(?:append|set|header|setHeader)\(\s*[`'"]location[`'"]/i.test(text)
    || /headers\.get\(\s*[`'"]location[`'"]\s*\)/i.test(text)
    || /\[[^\]]*[`'"]location[`'"][^\]]*\][\s\S]{0,240}(?:setHeader|header|set)\(\s*\w+/i.test(text);
}

function hasServiceFrontedGatewayBaseMakePrefix(text) {
  return /gatewayBaseUrl\s*:\s*[`'"]\/api\/make[`'"]/.test(text);
}

function hasServiceFrontedApiOnlyPrefix(text) {
  return /\/api\/(?:auth|oauth|app)\b/.test(text);
}

function hasServiceFrontedNamespaceProxy(text, namespace) {
  const browserPath = `/api/make/${namespace}`;
  const internalPath = `/make/${namespace}`;
  const escapedBrowserPath = escapeRegExp(browserPath);
  const escapedInternalPath = escapeRegExp(internalPath);
  const browserPathConstants = constantNamesForStringLiteral(text, browserPath);
  const internalPathConstants = constantNamesForStringLiteral(text, internalPath);
  const browserRouteToken = routeTokenPattern(browserPathConstants);

  const hasNamespaceRoute = new RegExp(
    String.raw`(?:app|router|server)\.(?:use|all|any)\s*\(\s*(?:[\`'"]${escapedBrowserPath}(?:\/(?:\*|\*\*))?\/?[\`'"]${browserRouteToken ? `|${browserRouteToken}` : ''})`,
    'i'
  ).test(text) || new RegExp(
    String.raw`\.startsWith\(\s*[\`'"]${escapedBrowserPath}\/?[\`'"]\s*\)`,
    'i'
  ).test(text) || hasRegexRouteForPath(text, browserPath);

  if (!hasNamespaceRoute) {
    return false;
  }

  const hasDirectInternalPath = new RegExp(escapedInternalPath).test(text) || internalPathConstants.length > 0;
  const stripsExternalApiPrefix = /replace\(\s*(?:\/\^\\?\/api|[`'"]\/api[`'"])/i.test(text);
  const hasGatewayMakeBase = /make-gateway[\s\S]{0,160}\/make/i.test(text) || /MAKE_[A-Z_]*BASE_URL[\s\S]{0,160}\/make/.test(text);
  return hasDirectInternalPath || (stripsExternalApiPrefix && hasGatewayMakeBase);
}

function constantNamesForStringLiteral(text, literal) {
  const names = [];
  const escapedLiteral = escapeRegExp(literal);
  const declaration = new RegExp(
    String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[\`'"]${escapedLiteral}[\`'"]`,
    'g'
  );
  let match;
  while ((match = declaration.exec(text))) {
    names.push(match[1]);
  }
  return names;
}

function routeTokenPattern(names) {
  if (names.length === 0) {
    return '';
  }
  return names.map((name) => escapeRegExp(name)).join('|');
}

function hasRegexRouteForPath(text, pathLiteral) {
  const escapedAsRegex = pathLiteral.replace(/\//g, String.raw`\\\/`);
  const routeRegex = new RegExp(
    String.raw`(?:app|router|server)\.(?:use|all|any)\s*\(\s*\/\^${escapedAsRegex}`,
    'i'
  );
  return routeRegex.test(text);
}

function hasBroadMakeGatewayPassthrough(text) {
  return /(?:app|router|server)\.(?:use|all|any|get|post|put|patch|delete)\s*\(\s*[`'"]\/api\/make(?:\/(?:\*|\*\*))?[`'"][\s\S]{0,500}(?:fetch|proxy|httpProxy|createProxyMiddleware)[\s\S]{0,240}(?:make-gateway|\/make)/i.test(text)
    || /if\s*\([^)]*\.startsWith\(\s*[`'"]\/api\/make\/?[`'"]\s*\)[^)]*\)\s*\{[\s\S]{0,500}(?:fetch|proxy|proxyMake\w+)[\s\S]{0,240}(?:make-gateway|\/make)[\s\S]{0,240}replace\(\s*(?:\/\^\\?\/api|[`'"]\/api(?:\/make)?[`'"])/i.test(text);
}

function hasBroadServiceAppBusinessPassthrough(text) {
  const hasBroadAppRoute = /(?:app|router|server)\.(?:use|all|any|get|post|put|patch|delete)\s*\(\s*[`'"]\/api\/make\/app(?:\/(?:\*|\*\*))?[`'"]/i.test(text)
    || /\.startsWith\(\s*[`'"]\/api\/make\/app\/?[`'"]\s*\)/i.test(text);
  const rewritesToRawMakePath = /replace\(\s*[\s\S]{0,160}\/api\/make\/app[\s\S]{0,160}\/(?:data|meta)/i.test(text)
    || /proxyMakeBusiness\([\s\S]{0,160}replace\(\s*[\s\S]{0,160}\/api\/make\/app/i.test(text);
  return hasBroadAppRoute && rewritesToRawMakePath;
}

function hasPublishedPreviewAuthShadow(text) {
  if (!/(localPreview\s*:\s*true|local-preview-user|local-preview|authMode\s*:\s*[`'"]token[`'"])/.test(text)) {
    return false;
  }

  return hasUnguardedPreviewPathHandler(text, '/api/make/auth/current-context')
    || hasUnguardedPreviewPathHandler(text, '/api/make/auth/runtime-view');
}

function hasUnguardedPreviewPathHandler(text, pathLiteral) {
  const escapedPath = escapeRegExp(pathLiteral);
  const ifRoute = new RegExp(
    String.raw`if\s*\((?<condition>[^)]*${escapedPath}[^)]*)\)\s*\{(?<body>[\s\S]{0,360}?(?:localPreview|local-preview|previewCurrentContext|previewRuntimeView)[\s\S]{0,360}?)\}`,
    'gi'
  );
  let match;
  while ((match = ifRoute.exec(text))) {
    const block = `${match.groups?.condition ?? ''}\n${match.groups?.body ?? ''}`;
    if (!isPreviewRouteGated(block)) {
      return true;
    }
  }

  const routeQuote = '[`\'"]';
  const mountedRoute = new RegExp(
    String.raw`(?:app|router|server)\.(?:get|use|all|any)\s*\(\s*${routeQuote}${escapedPath}${routeQuote}[\s\S]{0,360}(?:localPreview|local-preview|previewCurrentContext|previewRuntimeView)`,
    'gi'
  );
  while ((match = mountedRoute.exec(text))) {
    const before = text.slice(Math.max(0, match.index - 260), match.index);
    const block = `${before}\n${match[0]}`;
    if (!isPreviewRouteGated(block)) {
      return true;
    }
  }

  return false;
}

function hasQuerySensitivePreviewAuthRouteMatch(text) {
  const previewPathLiterals = [
    '/api/make/auth/current-context',
    '/api/make/auth/runtime-view',
  ];

  return previewPathLiterals.some((pathLiteral) => hasRawUrlEqualityForPreviewPath(text, pathLiteral));
}

function hasRawUrlEqualityForPreviewPath(text, pathLiteral) {
  const escapedPath = escapeRegExp(pathLiteral);
  const rawUrlEquality = new RegExp(
    String.raw`(?:\b(?:req|request)\.(?:originalUrl|url)\s*={2,3}\s*[\`'"]${escapedPath}[\`'"]|[\`'"]${escapedPath}[\`'"]\s*={2,3}\s*\b(?:req|request)\.(?:originalUrl|url))`,
    'gi'
  );
  let match;
  while ((match = rawUrlEquality.exec(text))) {
    const contextStart = Math.max(0, match.index - 520);
    const contextEnd = Math.min(text.length, rawUrlEquality.lastIndex + 520);
    const context = text.slice(contextStart, contextEnd);
    if (/(MAKE_APP_LOCAL_PREVIEW|isLocalPreviewEnabled|localPreview|local-preview|localPreviewCurrentContext|localPreviewRuntimeView|authMode\s*:\s*[`'"]token[`'"])/.test(context)) {
      return true;
    }
  }
  return false;
}

function isPreviewRouteGated(text) {
  return /MAKE_APP_LOCAL_PREVIEW\s*={2,3}\s*[`'"]true[`'"]/.test(text)
    || /process\.env\.MAKE_APP_LOCAL_PREVIEW\s*={2,3}\s*[`'"]true[`'"]/.test(text)
    || /isLocalPreviewEnabled\s*\(\s*\)/.test(text);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasForwardedHostPassthrough(text) {
  return /(?:pickProxyHeaders|copyProxyHeaders|proxyHeaders)\s*\([^)]*[`'"]x-forwarded-host[`'"]/is.test(text)
    || /[`'"]x-forwarded-host[`'"]\s*:\s*(?:req|request|source|inboundHeaders|headers)\.headers?\.get\(\s*[`'"]x-forwarded-host[`'"]\s*\)/i.test(text)
    || /[`'"]x-forwarded-host[`'"]\s*:\s*(?:req|request|source|inboundHeaders|headers)\.get\(\s*[`'"]x-forwarded-host[`'"]\s*\)/i.test(text);
}

function hasForwardedHostFallback(text) {
  const normalized = text.toLowerCase();
  if (!normalized.includes('x-forwarded-host')) {
    return false;
  }
  return (
    /(?:source|inboundheaders|inbound|request\.headers|req\.headers|options\.headers|headers)\.get\(\s*[`'"]host[`'"]\s*\)/i.test(text) ||
    /(?:request|req)\.headers\.host/i.test(text) ||
    /headers\.set\(\s*[`'"]x-forwarded-host[`'"][\s\S]{0,240}\bhost\b/i.test(text) ||
    /[`'"]x-forwarded-host[`'"]\s*:\s*[^,\n}]*\bhost\b/i.test(text)
  );
}

function hasForwardedProtoFallback(text) {
  const normalized = text.toLowerCase();
  if (!normalized.includes('x-forwarded-proto')) {
    return false;
  }
  return (
    /headers\.set\(\s*[`'"]x-forwarded-proto[`'"]/i.test(text) ||
    /[`'"]x-forwarded-proto[`'"]\s*:/i.test(text) ||
    /x-forwarded-proto[\s\S]{0,240}(?:https|http|\$scheme|proto)/i.test(text)
  );
}

function relative(file) {
  return path.relative(root, file) || '.';
}

function printResult() {
  console.log(`make-app-auth contract audit`);
  console.log(`root: ${root}`);
  console.log(`mode: ${inferredMode}${mode === 'auto' ? ' (auto)' : ''}`);
  console.log(`published: ${published ? 'yes' : 'no'}`);

  if (failures.length === 0 && warnings.length === 0) {
    console.log('status: PASS');
    return;
  }

  if (failures.length > 0) {
    console.log('failures:');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }
  if (warnings.length > 0) {
    console.log('warnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
  console.log(`status: ${failures.length > 0 ? 'FAIL' : 'PASS_WITH_WARNINGS'}`);
}
