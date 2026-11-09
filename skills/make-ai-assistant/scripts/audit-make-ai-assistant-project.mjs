#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isReactComponentExport } from './react-component-contract.mjs';

const root = process.argv[2] && path.resolve(process.argv[2]);
const args = process.argv.slice(3);
const versions = args.filter((a) =>
  a.startsWith('--expected-package-version=')
);
const expected = versions[0]?.slice('--expected-package-version='.length);
if (
  !root ||
  !fs.existsSync(root) ||
  args.some((a) => !a.startsWith('--expected-package-version=')) ||
  versions.length > 1 ||
  (versions.length && !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(expected))
) {
  console.error(
    'usage: node audit-make-ai-assistant-project.mjs <project-root> [--expected-package-version=x.y.z]'
  );
  process.exit(2);
}
const failures = [],
  warnings = [];
const fail = (code, detail) => failures.push(code + ': ' + detail);
const ignored = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
]);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const file = path.join(dir, e.name);
    if (e.isSymbolicLink()) return [];
    if (!e.isDirectory()) return [file];
    if (
      ignored.has(e.name) ||
      (e.name === 'skills' &&
        ['.agents', '.codex'].includes(path.basename(dir)))
    )
      return [];
    try {
      if (
        JSON.parse(fs.readFileSync(path.join(file, 'package.json'), 'utf8'))
          .name === '@qfei-design/make-ai-assistant'
      )
        return [];
    } catch {}
    return walk(file);
  });
}
const files = walk(root);
const production = files
  .filter(
    (f) =>
      /\.(?:[cm]?[jt]sx?|less|css)$/.test(f) &&
      !/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i.test(
        path.relative(root, f)
      )
  )
  .map((file) => ({
    file,
    text: fs.readFileSync(file, 'utf8'),
    relative: path.relative(root, file),
  }));
const manifests = files
  .filter((f) => path.basename(f) === 'package.json')
  .flatMap((file) => {
    try {
      return [{ file, value: JSON.parse(fs.readFileSync(file, 'utf8')) }];
    } catch {
      return [];
    }
  });
const consumers = new Map();
for (const entry of production) {
  if (
    !/["']@qfei-design\/make-ai-assistant\/(?:agent|react)["']/.test(entry.text)
  )
    continue;
  const owner = manifests
    .filter((m) => entry.file.startsWith(path.dirname(m.file) + path.sep))
    .sort((a, b) => b.file.length - a.file.length)[0];
  if (
    !owner ||
    ![
      owner.value.dependencies,
      owner.value.devDependencies,
      owner.value.peerDependencies,
    ].some((g) => g?.['@qfei-design/make-ai-assistant'])
  ) {
    fail('consumer_dependency_missing', entry.relative);
    continue;
  }
  consumers.set(owner.file, owner);
}
if (!consumers.size)
  fail('package_missing', 'no current public /agent or /react consumer');
for (const owner of consumers.values()) {
  const relative = path.relative(root, owner.file);
  const sources = production.filter((e) =>
    e.file.startsWith(path.dirname(owner.file) + path.sep)
  );
  const code = sources.map((e) => e.text).join('\n');
  const ui = /["']@qfei-design\/make-ai-assistant\/react["']/.test(code);
  const require = createRequire(
    path.join(path.dirname(owner.file), '__agent_audit__.cjs')
  );
  if (ui) {
    let parser;
    try {
      parser = require('typescript');
    } catch (error) {
      fail(
        'agent_parser_missing',
        relative + ': install the consumer TypeScript dependency; ' + error.name
      );
    }
    if (parser) {
      const bindings = publicBindings(
        parser,
        sources.map((e) => e.file)
      );
      if (!bindings.client) fail('agent_client_missing', relative);
      if (!bindings.entry) fail('app_entry_missing', relative);
    }
    for (const [pattern, reason] of [
      [/\/api\/make\/app\/agent\/v1\b/, 'service_base_path_missing'],
      [
        /["']@qfei-design\/make-ai-assistant\/styles\.css["']/,
        'styles_import_missing',
      ],
      [/\bretryOwner\s*:\s*["'](?:sdk|transport)["']/, 'retry_owner_missing'],
      [/\bcredentials\s*:\s*["']include["']/, 'session_credentials_missing'],
      [/\bsignal\b/, 'signal_forwarding_missing'],
      [/\bdispose\s*\(/, 'client_dispose_missing'],
    ])
      if (!pattern.test(code)) fail(reason, relative);
  }
  let packageRoot;
  for (const subpath of ['agent', 'make-app', ...(ui ? ['react'] : [])]) {
    let resolved;
    try {
      resolved = require.resolve('@qfei-design/make-ai-assistant/' + subpath);
    } catch {
      fail('package_unresolved', relative + ' /' + subpath);
      continue;
    }
    packageRoot ??= findRoot(resolved);
    try {
      const exports = await import(pathToFileURL(resolved).href);
      const needed =
        subpath === 'agent'
          ? ['createAgentClient', 'assertAgentRequest']
          : subpath === 'make-app'
            ? ['createMakeAppAssistantTransport']
            : ['MakeAppAssistantEntry'];
      for (const name of needed)
        if (
          subpath === 'react'
            ? !isReactComponentExport(exports[name])
            : typeof exports[name] !== 'function'
        )
          fail(
            subpath === 'react'
              ? 'package_react_missing'
              : subpath === 'agent'
                ? 'package_client_missing'
                : 'package_factory_missing',
            relative + ' ' + name
          );
    } catch (error) {
      fail(
        'package_entry_load_failed',
        relative + ' /' + subpath + ' ' + (error?.name ?? 'unknown')
      );
    }
  }
  if (!packageRoot) {
    fail('package_manifest_unresolved', relative);
    continue;
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
  );
  if (expected && manifest.version !== expected)
    fail(
      'package_version_mismatch',
      relative + ' resolves ' + manifest.version + ', expected ' + expected
    );
  if (!expected && !/^0\.4\.[1-9]\d*$/.test(manifest.version))
    warnings.push(
      relative +
        ': unverified package version ' +
        manifest.version +
        '; pass the exact expected version after contract verification'
    );
  for (const [subpath, names] of [
    [
      'agent',
      [
        'createAgentClient',
        'assertAgentRequest',
        'AgentClient',
        'AgentAuthenticatedTransport',
        'AgentHttpRequest',
      ],
    ],
    ['make-app', ['createMakeAppAssistantTransport']],
    ...(ui
      ? [['react', ['MakeAppAssistantEntry', 'MakeAppAssistantEntryProps']]]
      : []),
  ]) {
    const target = typesTarget(manifest.exports?.['./' + subpath]);
    const declaration = target
      ? publicTypes(path.resolve(packageRoot, target), packageRoot + path.sep)
      : '';
    for (const name of names)
      if (!hasExport(declaration, name))
        fail(
          'package_public_types_missing',
          relative + ' /' + subpath + ' ' + name
        );
  }
  const styles = manifest.exports?.['./styles.css'];
  const target = typeof styles === 'string' ? styles : styles?.default;
  if (
    !target ||
    !path.resolve(packageRoot, target).startsWith(packageRoot + path.sep) ||
    !fs.existsSync(path.resolve(packageRoot, target))
  )
    fail('package_styles_export_missing', relative);
}
for (const { relative, text } of production) {
  if (
    /@qfei-design\/make-ai-assistant\/(?:src|dist|examples?|internal)(?:\/|["'])/.test(
      text
    )
  )
    fail('internal_import', relative);
  if (/https?:\/\/[^\s"'`]+\/api\/make\/(?:app\/)?agent\/v1/i.test(text))
    fail('hardcoded_assistant_origin', relative);
  if (/\/agent\/v1\/v1\b/.test(text)) fail('invalid_agent_base_path', relative);
  if (
    /(?:process\.env|import\.meta\.env)[^\n;]{0,120}(?:AGENT|agentId)|\b(?:config|runtimeConfig|publicConfig)\??\.agentId\b|\bagentId\s*[:=]\s*["'`][^"'`]+["'`]/i.test(
      text
    )
  )
    fail('agent_id_external_source', relative);
  if (
    /\.(?:css|less)$/.test(relative) &&
    /\.make-ai-(?:agent|assistant)__[\w-]+/.test(text)
  )
    fail('internal_style_override', relative);
  if (
    /["']@qfei-design\/make-ai-assistant\/client["']|\/app\/ai\/v1/.test(text)
  )
    warnings.push(
      relative +
        ': legacy API present; manually verify it cannot supply the current Agent entry'
    );
}
if (failures.length) {
  console.error('make-ai-assistant project audit: FAIL');
  for (const f of failures) console.error('- ' + f);
  process.exitCode = 1;
} else
  console.log(
    'make-ai-assistant project audit: STATIC PREFLIGHT PASS; 25 Service operations require executable host tests; lifecycle, auth, streaming and deployed model behavior remain unverified'
  );
for (const warning of warnings) console.log('REVIEW: ' + warning);

function publicBindings(ts, files) {
  const program = ts.createProgram(
    files.filter((f) => /\.[cm]?[jt]sx?$/.test(f)),
    {
      allowJs: true,
      noResolve: true,
      noLib: true,
      jsx: ts.JsxEmit.Preserve,
    }
  );
  const checker = program.getTypeChecker();
  const result = { client: false, entry: false };
  for (const source of program.getSourceFiles()) {
    const bindings = new Map();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const module = statement.moduleSpecifier.text;
      if (
        ![
          '@qfei-design/make-ai-assistant/agent',
          '@qfei-design/make-ai-assistant/react',
        ].includes(module)
      )
        continue;
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly || !clause.namedBindings) continue;
      const imports = clause.namedBindings;
      if (ts.isNamespaceImport(imports)) {
        bindings.set(checker.getSymbolAtLocation(imports.name), {
          module,
          name: '*',
        });
      } else
        for (const item of imports.elements) {
          if (!item.isTypeOnly)
            bindings.set(checker.getSymbolAtLocation(item.name), {
              module,
              name: (item.propertyName ?? item.name).text,
            });
        }
    }
    const imported = (expression, module, name) => {
      if (ts.isIdentifier(expression)) {
        const binding = bindings.get(checker.getSymbolAtLocation(expression));
        return binding?.module === module && binding.name === name;
      }
      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression)
      ) {
        const binding = bindings.get(
          checker.getSymbolAtLocation(expression.expression)
        );
        return (
          binding?.module === module &&
          binding.name === '*' &&
          expression.name.text === name
        );
      }
      return false;
    };
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        imported(
          node.expression,
          '@qfei-design/make-ai-assistant/agent',
          'createAgentClient'
        )
      )
        result.client = true;
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        imported(
          node.tagName,
          '@qfei-design/make-ai-assistant/react',
          'MakeAppAssistantEntry'
        )
      )
        result.entry = true;
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return result;
}

function findRoot(entry) {
  let dir = path.dirname(entry);
  while (true) {
    try {
      if (
        JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
          .name === '@qfei-design/make-ai-assistant'
      )
        return dir;
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
function typesTarget(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.types === 'string') return value.types;
  for (const nested of Object.values(value)) {
    const target = typesTarget(nested);
    if (target) return target;
  }
}
function publicTypes(entry, prefix, seen = new Set()) {
  if (seen.has(entry) || !entry.startsWith(prefix) || !fs.existsSync(entry))
    return '';
  seen.add(entry);
  const text = fs.readFileSync(entry, 'utf8');
  return (
    text +
    [
      ...text.matchAll(
        /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g
      ),
    ]
      .map(([, specifier]) =>
        specifier.startsWith('.')
          ? publicTypes(
              path.resolve(
                path.dirname(entry),
                specifier.replace(/\.(?:m?js|cjs)$/, '.d.ts')
              ),
              prefix,
              seen
            )
          : ''
      )
      .join('\n')
  );
}
function hasExport(declaration, name) {
  return (
    new RegExp(
      '\\bexport\\s+(?:(?:declare|default|abstract)\\s+)*(?:type|interface|function|class|const|let|enum)\\s+' +
        name +
        '\\b'
    ).test(declaration) ||
    new RegExp(
      '\\bexport\\s+(?:type\\s+)?\\{[^}]*\\b' + name + '\\b[^}]*\\}'
    ).test(declaration)
  );
}
