#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// 仅用于新建或明确迁移反馈出口的 App；原 Trace 审计继续兼容未迁移的存量 App。
const root = path.resolve(process.argv[2] ?? '.');
const uiRoot = ['apps/ui', 'ui', '.'].map(dir => path.join(root, dir))
  .find(dir => fs.existsSync(path.join(dir, 'src')) && fs.existsSync(path.join(dir, 'package.json')));
if (!uiRoot) { console.error('FAIL request_error_ui_missing'); process.exit(2); }
let ts;
try { ts = createRequire(path.join(uiRoot, 'package.json'))('typescript'); }
catch { console.error('FAIL request_error_parser_missing: install the host TypeScript dependency before auditing'); process.exit(2); }
const collect = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) return /^(?:node_modules|dist|build|coverage|__fixtures__|\.git)$/.test(entry.name) ? [] : collect(file);
  return /\.[cm]?[jt]sx?$/.test(file) && !/\.(?:test|spec|stories)\.|\.d\.ts$/.test(file) ? [file] : [];
});
const files = collect(path.join(uiRoot, 'src'));
// 只绑定源码符号，不解析外部依赖、不加载标准库、不生成产物。
const program = ts.createProgram(files, { allowJs: true, noResolve: true, noLib: true, jsx: ts.JsxEmit.Preserve });
const checker = program.getTypeChecker();
const failures = [];
const viewports = [];
const inventory = [];
let localSinks = 0;
const visit = (node, callback) => { callback(node); ts.forEachChild(node, child => visit(child, callback)); };
const valueSymbol = node => ts.isShorthandPropertyAssignment(node.parent)
  ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
const references = (node, symbols) => {
  let found = false;
  visit(node, child => { if (ts.isIdentifier(child) && symbols.has(valueSymbol(child))) found = true; });
  return found;
};
for (const file of files) {
  const source = program.getSourceFile(file);
  const aliases = new Map();
  const sinks = new Set(['message', 'messageApi', 'toast', 'notification']);
  const location = node => `${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
  const fail = (code, node) => failures.push(`${code}: ${location(node)}`);
  const bindingSymbols = node => {
    if (ts.isIdentifier(node)) return [checker.getSymbolAtLocation(node)].filter(Boolean);
    return node.elements.flatMap(element => ts.isOmittedExpression(element) ? [] : bindingSymbols(element.name));
  };
  const importedRequest = expression => {
    if (ts.isPropertyAccessExpression(expression)) return importedRequest(expression.expression);
    if (!ts.isIdentifier(expression)) return false;
    return (checker.getSymbolAtLocation(expression)?.declarations ?? []).some(declaration => {
      for (let parent = declaration; parent; parent = parent.parent) {
        if (ts.isImportDeclaration(parent)) return /(?:service-api|make-entity-records|axios|undici|node-fetch|superagent)/.test(parent.moduleSpecifier.text);
      }
      return false;
    });
  };
  const isRequestCall = expression => {
    const name = ts.isIdentifier(expression) ? expression.text : ts.isPropertyAccessExpression(expression) ? expression.name.text : '';
    return /^(?:fetch|request|requestJson|requestMake[A-Z]\w*)$/.test(name) || importedRequest(expression);
  };
  const classifyCatchSource = node => {
    let localOperation = false, onlyLocal = true, hasRequest = false;
    const inspect = child => {
      // 函数体和内部已经处理过的 try 不属于当前 catch 的直接异常来源。
      if (ts.isFunctionLike(child)) return;
      if (ts.isTryStatement(child)) { if (child.finallyBlock) inspect(child.finallyBlock); if (child.catchClause) inspect(child.catchClause.block); else inspect(child.tryBlock); return; }
      if (ts.isCallExpression(child)) {
        hasRequest ||= isRequestCall(child.expression);
        const expression = child.expression;
        const json = ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
          && expression.expression.text === 'JSON' && !checker.getSymbolAtLocation(expression.expression)
          && ['parse', 'stringify'].includes(expression.name.text) && child.arguments.length === 1;
        const codec = ts.isIdentifier(expression) && !checker.getSymbolAtLocation(expression)
          && ['decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent'].includes(expression.text);
        if (json || codec) localOperation = true; else onlyLocal = false;
      }
      if (ts.isAwaitExpression(child) || ts.isYieldExpression(child) || ts.isTaggedTemplateExpression(child)) onlyLocal = false;
      if (ts.isNewExpression(child) || ts.isThrowStatement(child)) onlyLocal = false;
      ts.forEachChild(child, inspect);
    };
    inspect(node.parent.tryBlock);
    const comments = ts.getLeadingCommentRanges(source.text, node.block.getStart(source) + 1) ?? [];
    const reason = comments.map(comment => source.text.slice(comment.pos, comment.end))
      .map(comment => /^\/\/\s*make-error-outlet-local-validation:\s*(.+)$/.exec(comment)?.[1]?.trim())
      .find(text => text && text.length >= 4);
    if (reason && !hasRequest) inventory.push(`local-validation ${location(node)}: ${reason}`);
    return { local: !hasRequest && ((localOperation && onlyLocal) || Boolean(reason)), hasRequest };
  };
  visit(source, node => {
    if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteral(node.moduleSpecifier)) {
      const bindings = node.importClause.namedBindings;
      if (node.moduleSpecifier.text === '@qfei-design/make-app-observability/react') {
        if (bindings && ts.isNamespaceImport(bindings)) {
          for (const name of ['MakeAppErrorNotice', 'MakeAppErrorNoticeViewport', 'MakeAppPermissionNotice']) aliases.set(`${bindings.name.text}.${name}`, name);
        } else if (bindings) {
          for (const element of bindings.elements) aliases.set(element.name.text, (element.propertyName ?? element.name).text);
        }
      } else if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (/Permission(?:Feedback|Notice)$/.test((element.propertyName ?? element.name).text)) aliases.set(element.name.text, 'MakeAppPermissionNotice');
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer)
      && /(?:^|\.)useMessage$/.test(node.initializer.expression.getText(source))) {
      const first = node.name.elements[0]; if (first && ts.isBindingElement(first) && ts.isIdentifier(first.name)) sinks.add(first.name.text);
    }
  });
  const components = [];
  visit(source, node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const kind = aliases.get(node.tagName.getText(source));
      if (kind) components.push({ node, kind, props: node.attributes });
    } else if (ts.isCallExpression(node) && /(?:^|\.)createElement$/.test(node.expression.getText(source)) && node.arguments[0]) {
      const kind = aliases.get(node.arguments[0].getText(source));
      if (kind) components.push({ node, kind, props: node.arguments[1] });
    }
  });
  const prop = (props, name) => {
    if (!props) return undefined;
    if (ts.isJsxAttributes(props)) {
      const attribute = props.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(source) === name);
      return attribute?.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : attribute?.initializer;
    }
    if (ts.isObjectLiteralExpression(props)) return props.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(source).replaceAll(/['"]/g, '') === name)?.initializer;
    return undefined;
  };
  const globals = components.filter(component => component.kind === 'MakeAppErrorNoticeViewport');
  for (const component of globals) viewports.push(location(component.node));
  const insideViewport = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent) && aliases.get(parent.openingElement.tagName.getText(source)) === 'MakeAppErrorNoticeViewport') return true;
      if (ts.isCallExpression(parent) && /(?:^|\.)createElement$/.test(parent.expression.getText(source))
        && parent.arguments[0] && aliases.get(parent.arguments[0].getText(source)) === 'MakeAppErrorNoticeViewport') return true;
    }
    return false;
  };
  for (const { node, kind, props } of components) {
    const global = insideViewport(node);
    if (kind === 'MakeAppErrorNotice') {
      const duration = prop(props, 'duration');
      if (!global && !(duration && ts.isNumericLiteral(duration) && duration.text === '0')) fail('request_error_legacy_card', node);
      inventory.push(`${global ? 'global' : 'inline'} ${location(node)}`);
    }
    if (kind === 'MakeAppPermissionNotice' && prop(props, 'variant')?.text === 'toast' && !global) fail('request_error_legacy_permission_toast', node);
  }
  visit(source, node => {
    if (!ts.isCatchClause(node) || !node.variableDeclaration) return;
    const origin = classifyCatchSource(node);
    if (origin.local) return;
    const tainted = new Set(bindingSymbols(node.variableDeclaration.name));
    let size;
    do {
      size = tainted.size;
      visit(node.block, child => {
        if (ts.isVariableDeclaration(child) && child.initializer && references(child.initializer, tainted)) bindingSymbols(child.name).forEach(symbol => tainted.add(symbol));
      });
    } while (tainted.size !== size);
    visit(node.block, child => {
      if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) && child.expression.name.text === 'error'
        && sinks.has(child.expression.expression.getText(source)) && child.arguments.some(arg => references(arg, tainted))) {
        fail(origin.hasRequest ? 'request_error_string_toast' : 'exception_toast_origin_unverified', child);
      }
    });
  });
  visit(source, node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'error'
      && sinks.has(node.expression.expression.getText(source))) localSinks++;
  });
}
if (viewports.length !== 1) failures.push(`request_error_${viewports.length ? 'multiple_viewports' : 'viewport_missing'}: expected one global viewport, found ${viewports.length}; ${viewports.join(', ')}`);
console.log('scope: source outlet inventory; verify request paths, timers and real AppShell behavior separately');
for (const entry of inventory) console.log(`outlet: ${entry}`);
console.log(`local-message-error-calls: ${localSinks} (review local validation separately)`);
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(`status: ${failures.length ? 'FAIL' : 'PASS'}`);
process.exitCode = failures.length ? 1 : 0;
