#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isReactComponentExport } from './react-component-contract.mjs';
import { loadAgentCompiler } from './load-agent-compiler.mjs';

const root = process.argv[2] && path.resolve(process.argv[2]);
const args = process.argv.slice(3);
const versions = args.filter((a) =>
  a.startsWith('--expected-package-version='),
);
const expected = versions[0]?.slice('--expected-package-version='.length);
const compilerArgs = args.filter((arg) =>
  arg.startsWith('--compiler-workspace='),
);
const compilerWorkspace = compilerArgs[0]?.slice(
  '--compiler-workspace='.length,
);
if (
  !root ||
  !fs.existsSync(root) ||
  args.some(
    (a) =>
      !a.startsWith('--expected-package-version=') &&
      !a.startsWith('--compiler-workspace='),
  ) ||
  versions.length > 1 ||
  compilerArgs.length > 1 ||
  (compilerArgs.length && !compilerWorkspace) ||
  (versions.length && !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(expected))
) {
  console.error(
    'usage: node audit-make-ai-assistant-project.mjs <project-root> [--expected-package-version=x.y.z] [--compiler-workspace=<tooling-workspace>]',
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
        path.relative(root, f),
      ),
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
const nearestManifests = [...manifests].sort(
  (a, b) => b.file.length - a.file.length,
);
const sourceOwners = new Map(
  production.map((entry) => [
    entry.file,
    nearestManifests.find((manifest) =>
      entry.file.startsWith(path.dirname(manifest.file) + path.sep),
    ),
  ]),
);
const consumers = new Map();
const packageReference = /["'`]@qfei-design\/make-ai-assistant(?=[\/"'`$])/;
const currentPublicReference =
  /["'`]@qfei-design\/make-ai-assistant\/(?:agent|react|make-app)["'`]/;
for (const entry of production) {
  if (!packageReference.test(entry.text)) continue;
  const owner = sourceOwners.get(entry.file);
  if (!owner) {
    fail('consumer_dependency_missing', entry.relative);
    continue;
  }
  consumers.set(owner.file, owner);
}
let currentConsumer = false;
for (const owner of consumers.values()) {
  const relative = path.relative(root, owner.file);
  const sources = production.filter((e) => sourceOwners.get(e.file) === owner);
  const code = sources.map((e) => e.text).join('\n');
  const require = createRequire(
    path.join(path.dirname(owner.file), '__agent_audit__.cjs'),
  );
  // 可用时按语法识别所有入口；纯 Service 不因解析器缺失而新增依赖。
  let parser, parserError;
  try {
    const loaded = loadAgentCompiler(path.dirname(owner.file), {
      compilerWorkspace,
    });
    parser = loaded.compiler;
    if (loaded.name !== 'typescript' || compilerWorkspace)
      warnings.push(
        relative +
          ': compiler API ' +
          loaded.name +
          '@' +
          loaded.version +
          ' (API ' +
          loaded.apiVersion +
          ')',
      );
  } catch (error) {
    parserError = error;
  }
  const usage = parser && packageUsage(parser, sources);
  if (usage?.referenceCount === 0) continue;
  currentConsumer ||= usage
    ? usage.currentPublic
    : currentPublicReference.test(code);
  const hasReactReference = usage
    ? usage.reactReference
    : /["'`]@qfei-design\/make-ai-assistant\/react["'`]/.test(code);
  if (
    ![
      owner.value.dependencies,
      owner.value.devDependencies,
      owner.value.peerDependencies,
    ].some((g) => g?.['@qfei-design/make-ai-assistant'])
  ) {
    for (const entry of sources.filter((e) => packageReference.test(e.text)))
      fail('consumer_dependency_missing', entry.relative);
    continue;
  }
  const runtimeDependency =
    owner.value.dependencies?.['@qfei-design/make-ai-assistant'];
  if (hasReactReference && !parser)
    fail(
      'agent_parser_missing',
      relative +
        ': install the consumer TypeScript dependency; ' +
        (parserError?.message ?? 'unknown'),
    );
  const ui = hasReactReference && !usage?.onlyReactTypes;
  if (!runtimeDependency && !usage?.onlyTypes) {
    fail(
      'consumer_runtime_dependency_missing',
      relative +
        ': runtime imports require dependencies; dev/peer-only declarations need proven explicit type-only usage',
    );
  }
  if (ui) {
    if (parser) {
      const bindings = publicBindings(
        parser,
        sources.map((e) => e.file),
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
            relative + ' ' + name,
          );
    } catch (error) {
      fail(
        'package_entry_load_failed',
        relative + ' /' + subpath + ' ' + (error?.name ?? 'unknown'),
      );
    }
  }
  if (!packageRoot) {
    fail('package_manifest_unresolved', relative);
    continue;
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  );
  if (expected && manifest.version !== expected)
    fail(
      'package_version_mismatch',
      relative + ' resolves ' + manifest.version + ', expected ' + expected,
    );
  if (!expected && !/^0\.4\.[1-9]\d*$/.test(manifest.version))
    warnings.push(
      relative +
        ': unverified package version ' +
        manifest.version +
        '; pass the exact expected version after contract verification',
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
          relative + ' /' + subpath + ' ' + name,
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
if (!currentConsumer)
  fail(
    'package_missing',
    'no current public /agent, /react or /make-app consumer',
  );
for (const { relative, text } of production) {
  if (
    /@qfei-design\/make-ai-assistant\/(?:src|dist|examples?|internal)(?:\/|["'`])/.test(
      text,
    )
  )
    fail('internal_import', relative);
  if (/https?:\/\/[^\s"'`]+\/api\/make\/(?:app\/)?agent\/v1/i.test(text))
    fail('hardcoded_assistant_origin', relative);
  if (/\/agent\/v1\/v1\b/.test(text)) fail('invalid_agent_base_path', relative);
  if (
    /(?:process\.env|import\.meta\.env)[^\n;]{0,120}(?:AGENT|agentId)|\b(?:config|runtimeConfig|publicConfig)\??\.agentId\b|\bagentId\s*[:=]\s*["'`][^"'`]+["'`]/i.test(
      text,
    )
  )
    fail('agent_id_external_source', relative);
  if (
    /\.(?:css|less)$/.test(relative) &&
    /\.make-ai-(?:agent|assistant)__[\w-]+/.test(text)
  )
    fail('internal_style_override', relative);
  if (
    /["'`]@qfei-design\/make-ai-assistant\/client["'`]|\/app\/ai\/v1/.test(text)
  )
    warnings.push(
      relative +
        ': legacy API present; manually verify it cannot supply the current Agent entry',
    );
}
if (failures.length) {
  console.error('make-ai-assistant project audit: FAIL');
  for (const f of failures) console.error('- ' + f);
  process.exitCode = 1;
} else
  console.log(
    'make-ai-assistant project audit: STATIC PREFLIGHT PASS; 25 Service operations require executable host tests; lifecycle, auth, streaming and deployed model behavior remain unverified',
  );
for (const warning of warnings) console.log('REVIEW: ' + warning);

// 只认证显式类型引用；解析不完整时不猜测编译器是否会消除普通导入。
function packageUsage(ts, sources) {
  const references = new Set();
  const typeReferences = new Set();
  const isPackage = (node) => {
    const text =
      node && ts.isStringLiteralLike(node)
        ? node.text
        : node && ts.isTemplateExpression(node)
          ? node.head.text
          : '';
    return (
      text === '@qfei-design/make-ai-assistant' ||
      text.startsWith('@qfei-design/make-ai-assistant/')
    );
  };
  const typeBindings = (clause) =>
    clause &&
    !clause.name &&
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((item) => item.isTypeOnly);
  const record = (specifier, typeOnly) => {
    if (typeOnly) typeReferences.add(specifier);
  };
  const visit = (node) => {
    // 包路径作为运行时值出现（包括变量动态导入）时，不能认证为纯类型依赖。
    if (isPackage(node)) references.add(node);
    if (ts.isImportDeclaration(node) && isPackage(node.moduleSpecifier))
      record(
        node.moduleSpecifier,
        node.importClause?.isTypeOnly || typeBindings(node.importClause),
      );
    if (ts.isExportDeclaration(node) && isPackage(node.moduleSpecifier))
      record(
        node.moduleSpecifier,
        node.isTypeOnly ||
          (node.exportClause &&
            ts.isNamedExports(node.exportClause) &&
            node.exportClause.elements.length > 0 &&
            node.exportClause.elements.every((item) => item.isTypeOnly)),
      );
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      isPackage(node.moduleReference.expression)
    )
      record(node.moduleReference.expression, node.isTypeOnly);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      isPackage(node.argument.literal)
    )
      record(node.argument.literal, true);
    ts.forEachChild(node, visit);
  };
  for (const { file, text } of sources) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    if (source.parseDiagnostics.length) return null;
    visit(source);
  }
  const reactReferences = [...references].filter(
    (node) => node.text === '@qfei-design/make-ai-assistant/react',
  );
  return {
    referenceCount: references.size,
    currentPublic: [...references].some((node) =>
      [
        '@qfei-design/make-ai-assistant/agent',
        '@qfei-design/make-ai-assistant/react',
        '@qfei-design/make-ai-assistant/make-app',
      ].includes(node.text),
    ),
    reactReference: reactReferences.length > 0,
    onlyTypes: references.size > 0 && references.size === typeReferences.size,
    onlyReactTypes:
      reactReferences.length > 0 &&
      reactReferences.every((node) => typeReferences.has(node)),
  };
}

function publicBindings(ts, files) {
  const program = ts.createProgram(
    files.filter((f) => /\.[cm]?[jt]sx?$/.test(f)),
    {
      allowJs: true,
      noResolve: true,
      noLib: true,
      jsx: ts.JsxEmit.Preserve,
    },
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
    // 默认参数可注入公开工厂；赋值过的参数不能再作为该导入的证据。
    const reassigned = new Set();
    const assignmentTargets = (node) => {
      if (ts.isIdentifier(node))
        reassigned.add(checker.getSymbolAtLocation(node));
      else if (ts.isShorthandPropertyAssignment(node))
        reassigned.add(checker.getShorthandAssignmentValueSymbol(node));
      else if (ts.isObjectLiteralExpression(node))
        node.properties.forEach(assignmentTargets);
      else if (ts.isArrayLiteralExpression(node))
        node.elements.forEach(assignmentTargets);
      else if (
        ts.isObjectBindingPattern(node) ||
        ts.isArrayBindingPattern(node)
      )
        node.elements.forEach(assignmentTargets);
      else if (ts.isBindingElement(node)) assignmentTargets(node.name);
      else if (ts.isPropertyAssignment(node))
        assignmentTargets(node.initializer);
      else if (
        ts.isSpreadAssignment(node) ||
        ts.isSpreadElement(node) ||
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression?.(node)
      )
        assignmentTargets(node.expression);
      else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      )
        assignmentTargets(node.left);
      // 属性接收者、计算键和默认值只是读取；内嵌赋值由外层遍历单独收集。
    };
    const collectAssignments = (node) => {
      // var 初始化和循环声明可能写回参数；符号身份区分真正的局部遮蔽。
      if (ts.isVariableDeclaration(node) && node.initializer)
        assignmentTargets(node.name);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      )
        assignmentTargets(node.left);
      if (
        (ts.isPrefixUnaryExpression(node) ||
          ts.isPostfixUnaryExpression(node)) &&
        [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(
          node.operator,
        )
      )
        assignmentTargets(node.operand);
      if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
        if (ts.isVariableDeclarationList(node.initializer))
          node.initializer.declarations.forEach((declaration) =>
            assignmentTargets(declaration.name),
          );
        else assignmentTargets(node.initializer);
      }
      ts.forEachChild(node, collectAssignments);
    };
    collectAssignments(source);
    const imported = (expression, module, name, seen = new Set()) => {
      if (ts.isIdentifier(expression)) {
        const symbol = checker.getSymbolAtLocation(expression);
        const binding = bindings.get(symbol);
        if (binding) return binding.module === module && binding.name === name;
        const declaration = symbol?.valueDeclaration;
        if (
          !symbol ||
          seen.has(symbol) ||
          reassigned.has(symbol) ||
          !declaration ||
          !ts.isParameter(declaration) ||
          !declaration.initializer
        )
          return false;
        return imported(
          declaration.initializer,
          module,
          name,
          new Set([...seen, symbol]),
        );
      }
      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression)
      ) {
        const binding = bindings.get(
          checker.getSymbolAtLocation(expression.expression),
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
          'createAgentClient',
        )
      )
        result.client = true;
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        imported(
          node.tagName,
          '@qfei-design/make-ai-assistant/react',
          'MakeAppAssistantEntry',
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
        /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
      ),
    ]
      .map(([, specifier]) =>
        specifier.startsWith('.')
          ? publicTypes(
              path.resolve(
                path.dirname(entry),
                specifier.replace(/\.(?:m?js|cjs)$/, '.d.ts'),
              ),
              prefix,
              seen,
            )
          : '',
      )
      .join('\n')
  );
}
function hasExport(declaration, name) {
  return (
    new RegExp(
      '\\bexport\\s+(?:(?:declare|default|abstract)\\s+)*(?:type|interface|function|class|const|let|enum)\\s+' +
        name +
        '\\b',
    ).test(declaration) ||
    new RegExp(
      '\\bexport\\s+(?:type\\s+)?\\{[^}]*\\b' + name + '\\b[^}]*\\}',
    ).test(declaration)
  );
}
