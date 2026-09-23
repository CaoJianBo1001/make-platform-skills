#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(process.argv[2] ?? '');
const options = process.argv.slice(3);
const unsupportedOption = options.find((arg) => !arg.startsWith('--expected-package-version='));
const expectedPackageVersionArgs = options.filter((arg) =>
  arg.startsWith('--expected-package-version='));
const expectedPackageVersionArg = expectedPackageVersionArgs[0];
const expectedPackageVersion = expectedPackageVersionArg
  ?.slice('--expected-package-version='.length)
  .trim();
if (!process.argv[2] || !fs.existsSync(projectRoot)) {
  console.error('usage: node audit-make-ai-assistant-project.mjs <project-root> [--expected-package-version=x.y.z]');
  process.exit(2);
}
if (unsupportedOption || expectedPackageVersionArgs.length > 1) {
  console.error(`unsupported option: ${unsupportedOption ?? 'duplicate --expected-package-version'}`);
  process.exit(2);
}
if (expectedPackageVersionArg && !expectedPackageVersion) {
  console.error('expected package version must be a non-empty exact version');
  process.exit(2);
}

const ignoredDirectories = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.turbo',
]);
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

const isVendoredAssistantPackage = (directory) => {
  const manifest = path.join(directory, 'package.json');
  if (!fs.existsSync(manifest)) return false;
  try {
    return JSON.parse(fs.readFileSync(manifest, 'utf8')).name === '@qfei-design/make-ai-assistant';
  } catch {
    return false;
  }
};

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) || isVendoredAssistantPackage(absolutePath)
        ? [] : walk(absolutePath);
    }
    return [absolutePath];
  });

const files = walk(projectRoot);
const sourceFiles = files.filter((file) => sourceExtensions.has(path.extname(file)));
const sourceEntries = sourceFiles.map((file) => ({
  file,
  relative: path.relative(projectRoot, file),
  text: fs.readFileSync(file, 'utf8'),
}));
const productionEntries = sourceEntries.filter(({ relative }) =>
  !/(^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i.test(relative));
const source = productionEntries.map(({ relative, text }) => `\n/* ${relative} */\n${text}`).join('\n');
const failures = [];

const fail = (code, detail) => failures.push(`${code}: ${detail}`);
const has = (pattern) => pattern.test(source);

const packageFiles = files.filter((file) => path.basename(file) === 'package.json');
const packageDefinitions = packageFiles.flatMap((file) => {
  try {
    return [{ file, value: JSON.parse(fs.readFileSync(file, 'utf8')) }];
  } catch {
    return [];
  }
});
const consumerEntries = productionEntries.filter(({ text }) =>
  /["']@qfei-design\/make-ai-assistant\/(?:client|make-app)["']/.test(text));
const consumerPackages = new Map();
for (const entry of consumerEntries) {
  const owner = packageDefinitions
    .filter(({ file }) => entry.file.startsWith(`${path.dirname(file)}${path.sep}`))
    .sort((left, right) => right.file.length - left.file.length)[0];
  if (!owner || ![owner.value.dependencies, owner.value.devDependencies, owner.value.peerDependencies]
    .some((group) => group?.['@qfei-design/make-ai-assistant'])) {
    fail('consumer_dependency_missing', `${entry.relative} does not belong to a package declaring @qfei-design/make-ai-assistant`);
    continue;
  }
  consumerPackages.set(owner.file, owner);
}
if (consumerEntries.length === 0) {
  fail('package_missing', 'no production source imports a public Make App client or adapter entry');
}

for (const dependency of consumerPackages.values()) {
  const relativePackage = path.relative(projectRoot, dependency.file);
  const packageDirectory = `${path.dirname(dependency.file)}${path.sep}`;
  const packageSource = productionEntries
    .filter(({ file }) => file.startsWith(packageDirectory))
    .map(({ text }) => text)
    .join('\n');
  validateAppWiring(relativePackage, packageSource);
  const resolveFrom = createRequire(path.join(path.dirname(dependency.file), '__make_ai_assistant_audit__.cjs'));
  let resolvedAdapterPath;
  let resolvedClientPath;
  let resolvedReactPath;
  try {
    resolvedAdapterPath = resolveFrom.resolve('@qfei-design/make-ai-assistant/make-app');
    resolvedReactPath = resolveFrom.resolve('@qfei-design/make-ai-assistant/react');
    resolvedClientPath = resolveFrom.resolve('@qfei-design/make-ai-assistant/client');
  } catch {
    fail('package_unresolved', `${relativePackage} cannot resolve all required public package entries`);
    continue;
  }
  validateResolvedPackagePublicTypes(resolvedAdapterPath, relativePackage);
  try {
    const adapterExports = await import(pathToFileURL(resolvedAdapterPath).href);
    const factoryName = 'createMakeAppAssistantTransport';
    if (typeof adapterExports[factoryName] !== 'function') {
      fail('package_factory_missing', `${factoryName} is absent from the resolved package entry`);
    }
  } catch (error) {
    fail(
      'package_entry_load_failed',
      `resolved adapter entry could not be loaded (${error instanceof Error ? error.name : typeof error})`,
    );
  }
  try {
    const clientExports = await import(pathToFileURL(resolvedClientPath).href);
    if (typeof clientExports.createMakeAgentClient !== 'function') {
      fail('package_client_missing', 'createMakeAgentClient is absent from /client');
    }
  } catch (error) {
    fail('package_client_load_failed', `public /client could not be loaded (${error instanceof Error ? error.name : typeof error})`);
  }
  try {
    const reactExports = await import(pathToFileURL(resolvedReactPath).href);
    const missing = ['MakeAiAssistant', 'AssistantPanel']
      .filter((name) => typeof reactExports[name] !== 'function');
    if (missing.length > 0) {
      fail('package_react_missing', `${relativePackage} public /react lacks ${missing.join(', ')}`);
    }
  } catch (error) {
    fail('package_react_load_failed', `${relativePackage} public /react could not be loaded (${error instanceof Error ? error.name : typeof error})`);
  }
}

for (const { relative, text } of productionEntries) {
  if (/@qfei-design\/make-ai-assistant\/(?:src|dist|examples?|gallery|internal)(?:\/|["'])/.test(text)) {
    fail('internal_import', `${relative} imports a package-internal path`);
  }
  if (/https?:\/\/[^\s"']+\/api\/make\/app\/ai(?:\/|[?"'])/i.test(text)) {
    fail('hardcoded_assistant_origin', `${relative} hard-codes an assistant API origin`);
  }
  if (/chats\/locate/.test(text)) {
    fail('removed_locate_route', `${relative} retains chats/locate`);
  }
  if (/<(?:MakeAiAssistant|AssistantPanel)\b[^>]*(?:subtitle|privacyNotice)\s*=/s.test(text)) {
    fail('legacy_header_prop', `${relative} passes an ignored legacy header prop`);
  }
}

// The fixed AI v1 AuthenticatedTransport is allowed to use a shared, same-origin
// raw-response bridge. A source regex cannot prove auth or origin safety; cover
// that boundary with executable host tests instead of rejecting valid bridges.

if (!has(/\/v1(?:\/|["'`])/)) {
  fail('v1_route_missing', 'the Service must expose the versioned Make App AI family');
}
if (!has(/\/capabilities\b/)) {
  fail('capabilities_route_missing', 'the Service must expose the v1 capabilities operation');
}
for (const { relative, text } of productionEntries) {
  if (
    /(?:process\.env|import\.meta\.env)[\s\S]{0,100}(?:AGENT|agentId)/i.test(text)
    || /\b(?:config|runtimeConfig|publicConfig)\??\.agentId\b/i.test(text)
    || /\bagentId\s*[:=]\s*["'`][^"'`]+["'`]/i.test(text)
  ) {
    fail('agent_id_external_source', `${relative} sources agentId outside the current paginated Agent discovery`);
  }
}

if (failures.length > 0) {
  console.error('make-ai-assistant project audit: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('make-ai-assistant project audit: STATIC PREFLIGHT PASS (make-app); 18 Service operations require executable host tests, and deployed runtime behavior remains unverified');
}

function validateAppWiring(consumerPackage, packageSource) {
  const hasInPackage = (pattern) => pattern.test(packageSource);
  const failInPackage = (code, detail) => fail(code, `${consumerPackage}: ${detail}`);
  if (!hasInPackage(/(?:from\s*|import\s*)["']@qfei-design\/make-ai-assistant\/react["']/)) {
    failInPackage('public_react_import_missing', 'no public package React import found');
  }
  if (!hasInPackage(/["']@qfei-design\/make-ai-assistant\/styles\.css["']/)) {
    failInPackage('styles_import_missing', 'package styles.css is not imported');
  }
  if (!hasInPackage(/import\s*\{[^}]*\bcreateMakeAppAssistantTransport\b[^}]*\}\s*from\s*["']@qfei-design\/make-ai-assistant\/make-app["']/s)) {
    failInPackage('make_app_factory_missing', 'the published createMakeAppAssistantTransport factory is not imported');
  }
  if (!hasInPackage(/from\s*["']@qfei-design\/make-ai-assistant\/client["']/)) {
    failInPackage('make_app_client_import_missing', 'the public /client entry is not imported');
  }
  if (!hasInPackage(/\bcreateMakeAgentClient\s*\(/)) {
    failInPackage('make_app_client_missing', 'createMakeAgentClient is not used');
  }
  if (hasInPackage(/\bcreateMakeAppTransport\b/)) {
    failInPackage('nonexistent_make_app_factory', 'createMakeAppTransport is not a published Make App export');
  }
  if (!hasInPackage(/\.agents\.list\s*\(/)) {
    failInPackage('agent_discovery_missing', 'Agent discovery must use the public Client');
  }
  if (!hasInPackage(/agentType\s*===?\s*["'`]app_internal["'`]/)) {
    failInPackage('app_internal_agent_gate_missing', 'discovery must select the App-internal Agent, not a channel Agent');
  }
  if (!hasInPackage(/\bhasMore\b/) || !hasInPackage(/\bnextCursor\b/)) {
    failInPackage('agent_pagination_missing', 'Agent discovery must account for every cursor page');
  }
  if (!hasInPackage(/\bretryOwner\s*:\s*["'`](?:sdk|transport)["'`]/)) {
    failInPackage('retry_owner_missing', 'AuthenticatedTransport must declare one retry owner');
  }
  if (!hasInPackage(/credentials\s*:\s*["'`]include["'`]/)) {
    failInPackage('session_credentials_missing', 'the AI byte bridge must preserve browser session credentials');
  }
  if (!hasInPackage(/\bdispose\s*\(/)) {
    failInPackage('client_dispose_missing', 'the host must release the Client on identity/App changes');
  }
  if (!hasInPackage(/\bsignal\b/)) {
    failInPackage('signal_forwarding_missing', 'Agent discovery and byte bridge must propagate AbortSignal');
  }
}

function validateResolvedPackagePublicTypes(resolvedAdapterPath, consumerPackage) {
  const packageRoot = findPackageRoot(resolvedAdapterPath);
  if (!packageRoot) {
    fail('package_manifest_unresolved', 'resolved adapter is not inside the declared package');
    return;
  }

  const packageJsonPath = path.join(packageRoot, 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    fail('package_manifest_invalid', 'resolved package.json cannot be read');
    return;
  }
  if (expectedPackageVersion && packageJson.version !== expectedPackageVersion) {
    fail(
      'package_version_mismatch',
      `${consumerPackage} resolves ${packageJson.version ?? 'unknown'}, not expected ${expectedPackageVersion}`,
    );
  }

  const packageRootPrefix = `${packageRoot}${path.sep}`;
  const requiredTypes = [
    {
      subpath: './make-app',
      tokens: ['createMakeAppAssistantTransport', 'MakeAppAssistantTransportOptions'],
    },
    { subpath: './react', tokens: ['MakeAiAssistant', 'AssistantPanel', 'MakeAiTheme', 'AssistantPanelProps', 'MakeAiAssistantProps'] },
    { subpath: './client', tokens: ['createMakeAgentClient'] },
  ];

  let clientTypesEntry;
  let reactDeclaration = '';
  for (const requirement of requiredTypes) {
    const relativePath = findTypesTarget(packageJson.exports?.[requirement.subpath]);
    if (!relativePath) {
      fail(
        'package_public_types_missing',
        `${requirement.subpath} has no public types for resolved version ${packageJson.version ?? 'unknown'}`,
      );
      continue;
    }
    const absolutePath = path.resolve(packageRoot, relativePath);
    if (
      (absolutePath !== packageRoot && !absolutePath.startsWith(packageRootPrefix))
      || !fs.existsSync(absolutePath)
    ) {
      fail('package_public_types_missing', `${requirement.subpath} public types cannot be read`);
      continue;
    }
    if (requirement.subpath === './client') clientTypesEntry = absolutePath;
    const declaration = readPublicTypeClosure(absolutePath, packageRootPrefix);
    if (requirement.subpath === './react') reactDeclaration = declaration;
    const missingTokens = requirement.tokens.filter((token) => !hasExportedDeclaration(declaration, token));
    if (missingTokens.length > 0) {
      fail(
        'package_public_types_missing',
        `${requirement.subpath} lacks ${missingTokens.join(', ')} in resolved version ${packageJson.version ?? 'unknown'}`,
      );
    }
  }
  const declaration = clientTypesEntry
    ? readPublicTypeClosure(clientTypesEntry, packageRootPrefix)
    : '';
  const missing = ['ClientOptions', 'AuthenticatedTransport', 'Client', 'Scope', 'Agent', 'Capabilities']
    .filter((token) => !new RegExp(`\\b${token}\\b`).test(declaration));
  if (missing.length > 0) {
    fail('package_public_types_missing', `/client lacks ${missing.join(', ')}`);
  }
  const snapshotBody = exportedInterfaceBody(declaration, 'ResponseSnapshot');
  if (!snapshotBody || !hasStringField(snapshotBody, 'code') || !hasStringField(snapshotBody, 'message')) {
    fail('package_public_types_missing', `/client ResponseSnapshot lacks public code/message in resolved version ${packageJson.version ?? 'unknown'}`);
  }
  const failedEventVariants = discriminatedUnionVariants(
    declaration,
    'ResponseEvent',
    'kind',
    'failed',
  );
  if (failedEventVariants.length === 0 || failedEventVariants.some((variant) =>
    !['code', 'message', 'requestId'].every((field) => hasStringField(variant, field)))) {
    fail('package_public_types_missing', `/client response.failed lacks public safe message/requestId in resolved version ${packageJson.version ?? 'unknown'}`);
  }
  const featureBody = exportedInterfaceBody(reactDeclaration, 'AssistantTransportFeatures');
  if (!featureBody || !/\blimits\??\s*:\s*\{/u.test(featureBody)
    || !/\bmaxUploadBytes\s*:\s*number\b/u.test(featureBody)
    || !/\bmaxInputParts\s*:\s*number\b/u.test(featureBody)) {
    fail('package_public_types_missing', `/react AssistantTransportFeatures lacks negotiated limits in resolved version ${packageJson.version ?? 'unknown'}`);
  }
  const stylesExport = packageJson.exports?.['./styles.css'];
  const stylesPath = typeof stylesExport === 'string' ? stylesExport : stylesExport?.default;
  const resolvedStylesPath = typeof stylesPath === 'string'
    ? path.resolve(packageRoot, stylesPath)
    : '';
  if (!resolvedStylesPath.startsWith(packageRootPrefix) || !fs.existsSync(resolvedStylesPath)) {
    fail('package_styles_export_missing', './styles.css is not publicly exported');
  }
}

function exportedInterfaceBody(declaration, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return declaration.match(new RegExp(`\\bexport\\s+interface\\s+${escaped}(?:\\s+extends\\s+[^\\{]+)?\\s*\\{([^}]*)\\}`, 'u'))?.[1];
}

function hasStringField(body, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\??\\s*:\\s*string\\b`, 'u').test(body);
}

function discriminatedUnionVariants(declaration, typeName, discriminant, literal) {
  const expression = exportedTypeAliasExpression(declaration, typeName);
  if (!expression) return [];
  return splitTopLevelUnion(expression).filter((variant) => {
    const escaped = discriminant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const annotation = variant.match(new RegExp(`\\b${escaped}\\??\\s*:\\s*([^;}]+)`, 'u'))?.[1] ?? '';
    return [...annotation.matchAll(/["']([^"']+)["']/gu)]
      .some(([, value]) => value === literal);
  });
}

function exportedTypeAliasExpression(declaration, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\bexport\\s+type\\s+${escaped}(?:\\s*<[^;=]+>)?\\s*=`, 'u').exec(declaration);
  if (!match) return '';
  const start = match.index + match[0].length;
  const end = scanTypeExpression(declaration, start, (character, depth) =>
    character === ';' && depth === 0);
  return declaration.slice(start, end).trim();
}

function splitTopLevelUnion(expression) {
  const parts = [];
  let start = 0;
  scanTypeExpression(expression, 0, (character, depth, index) => {
    if (character !== '|' || depth !== 0) return false;
    parts.push(expression.slice(start, index).trim());
    start = index + 1;
    return false;
  });
  parts.push(expression.slice(start).trim());
  return parts.filter(Boolean);
}

function scanTypeExpression(source, start, visit) {
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    const depth = braces + brackets + parentheses;
    if (visit(character, depth, index)) return index;
    if (character === '{') braces += 1;
    else if (character === '}') braces -= 1;
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets -= 1;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses -= 1;
  }
  return source.length;
}

function hasExportedDeclaration(declaration, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bexport\\s+(?:(?:declare|default|abstract)\\s+)*(?:type|interface|function|class|const|let|enum)\\s+${escaped}\\b`).test(declaration)
    || new RegExp(`\\bexport\\s+(?:type\\s+)?\\{[^}]*\\b${escaped}\\b[^}]*\\}`).test(declaration);
}

function readPublicTypeClosure(entry, packageRootPrefix, seen = new Set()) {
  if (seen.has(entry) || !entry.startsWith(packageRootPrefix) || !fs.existsSync(entry)) return '';
  seen.add(entry);
  const declaration = fs.readFileSync(entry, 'utf8');
  const exportedTargets = [...declaration.matchAll(
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
  )];
  return declaration + exportedTargets.map(([, specifier]) => {
    if (!specifier.startsWith('.')) return '';
    const target = path.resolve(path.dirname(entry), specifier.replace(/\.(?:m?js|cjs)$/, '.d.ts'));
    return readPublicTypeClosure(target, packageRootPrefix, seen);
  }).join('');
}

function findTypesTarget(exportValue) {
  if (!exportValue || typeof exportValue !== 'object') return undefined;
  if (typeof exportValue.types === 'string') return exportValue.types;
  for (const nested of Object.values(exportValue)) {
    const target = findTypesTarget(nested);
    if (target) return target;
  }
  return undefined;
}

function findPackageRoot(resolvedEntryPath) {
  let current = path.dirname(resolvedEntryPath);
  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.name === '@qfei-design/make-ai-assistant') return current;
      } catch {
        // Keep walking so a malformed nested manifest cannot hide the real package root.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
