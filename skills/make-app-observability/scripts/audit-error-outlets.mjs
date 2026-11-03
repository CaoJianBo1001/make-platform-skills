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
  const unwrapExpression = expression => {
    while (expression && (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
      || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)
      || (typeof ts.isSatisfiesExpression === 'function' && ts.isSatisfiesExpression(expression)))) expression = expression.expression;
    return expression;
  };
  const importedRequest = expression => {
    expression = unwrapExpression(expression);
    if (ts.isPropertyAccessExpression(expression)) return importedRequest(expression.expression);
    if (!ts.isIdentifier(expression)) return false;
    return (checker.getSymbolAtLocation(expression)?.declarations ?? []).some(declaration => {
      for (let parent = declaration; parent; parent = parent.parent) {
        if (ts.isImportDeclaration(parent)) return /(?:service-api|make-entity-records|axios|undici|node-fetch|superagent)/.test(parent.moduleSpecifier.text);
      }
      return false;
    });
  };
  // 缓存只在本文件、本次 Program 内使用；仅复用已完成的摘要/可达性结果。
  const requestSummaries = new Map();
  const requestResults = new Map();
  const resolveRequestTarget = expression => {
    expression = unwrapExpression(expression);
    if (importedRequest(expression)) return { direct: true };
    const target = ts.isPropertyAccessExpression(expression) ? expression.name : expression;
    const propertySymbol = checker.getSymbolAtLocation(target);
    const shorthand = propertySymbol?.declarations?.find(ts.isShorthandPropertyAssignment);
    const symbol = shorthand ? checker.getShorthandAssignmentValueSymbol(shorthand) : propertySymbol;
    if (symbol?.declarations?.length) return { symbol };
    const name = ts.isIdentifier(target) ? target.text : '';
    return { direct: /^(?:fetch|request|requestJson|requestMake[A-Z]\w*)$/.test(name) };
  };
  const summarizeRequestSymbol = symbol => {
    if (requestSummaries.has(symbol)) return requestSummaries.get(symbol);
    const summary = { direct: false, dependencies: new Set() };
    const addTarget = expression => {
      const target = resolveRequestTarget(expression);
      summary.direct ||= target.direct === true;
      if (target.symbol) summary.dependencies.add(target.symbol);
    };
    for (const declaration of symbol.declarations) {
      const value = unwrapExpression(ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)
        ? declaration.initializer : declaration);
      if (!value) continue;
      if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) {
        addTarget(value);
      } else if (ts.isFunctionLike(value) && value.body) {
        visitEscapingSource(value.body, node => {
          if (ts.isCallExpression(node)) addTarget(node.expression);
        });
      }
    }
    requestSummaries.set(symbol, summary);
    return summary;
  };
  const isRequestCall = expression => {
    const target = resolveRequestTarget(expression);
    if (!target.symbol) return target.direct === true;
    if (requestResults.has(target.symbol)) return requestResults.get(target.symbol);
    const pending = [target.symbol];
    const visited = new Set();
    let found = false;
    while (pending.length) {
      const symbol = pending.pop();
      if (visited.has(symbol)) continue;
      visited.add(symbol);
      if (requestResults.has(symbol)) {
        if (requestResults.get(symbol)) { found = true; break; }
        continue;
      }
      const summary = summarizeRequestSymbol(symbol);
      if (summary.direct) { found = true; break; }
      for (const dependency of summary.dependencies) pending.push(dependency);
    }
    if (found) {
      // 不能把已访问的无关分支一起记为请求来源。
      requestResults.set(target.symbol, true);
    } else {
      // 完整遍历可达子图后才能缓存 false；循环回边本身不是负结论。
      for (const symbol of visited) requestResults.set(symbol, false);
    }
    return found;
  };
  // 外层 catch 与局部包装函数共用同一异常来源遍历，避免两套规则漂移。
  const visitEscapingSource = (node, callback) => {
    if (ts.isFunctionLike(node)) return;
    callback(node);
    if (ts.isTryStatement(node)) {
      if (!node.catchClause || hasEscapingThrow(node.catchClause.block)) {
        visitEscapingSource(node.tryBlock, callback);
      } else {
        // return fetch() 返回的 Promise 拒绝不受本层同步 catch 保护；return await 才受保护。
        const visitReturns = child => {
          if (ts.isFunctionLike(child)) return;
          if (ts.isReturnStatement(child) && child.expression) {
            const expression = unwrapExpression(child.expression);
            if (!ts.isAwaitExpression(expression)) visitEscapingSource(expression, callback);
            return;
          }
          ts.forEachChild(child, visitReturns);
        };
        visitReturns(node.tryBlock);
      }
      if (node.catchClause) visitEscapingSource(node.catchClause.block, callback);
      if (node.finallyBlock) visitEscapingSource(node.finallyBlock, callback);
      return;
    }
    ts.forEachChild(node, child => visitEscapingSource(child, callback));
  };
  const escapingThrows = new WeakMap();
  const hasEscapingThrow = block => {
    if (escapingThrows.has(block)) return escapingThrows.get(block);
    let found = false;
    visitEscapingSource(block, node => { if (ts.isThrowStatement(node)) found = true; });
    escapingThrows.set(block, found);
    return found;
  };
  const classifyCatchSource = node => {
    let localOperation = false, onlyLocal = true, hasRequest = false;
    visitEscapingSource(node.parent.tryBlock, child => {
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
    });
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
