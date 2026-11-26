#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isReactComponentExport } from './react-component-contract.mjs';

const isCssWhitespace = (character) => character !== undefined && /[\t\n\f\r ]/.test(character);
const isCssNewline = (character) => character !== undefined && /[\n\f\r]/.test(character);
const isCssNamePoint = (character) => character !== undefined && /[-_a-zA-Z0-9\u0080-\uffff]/.test(character);
const isCssEscape = (css, cursor) => css[cursor] === '\\' && !isCssNewline(css[cursor + 1]);

// CSS Syntax 3 §4.3.7: an escape consumes up to six hex digits and one whitespace.
const cssEscape = (css, start) => {
  let end = start + 1;
  const hexadecimal = /^[\da-fA-F]{1,6}/.exec(css.slice(end));
  if (hexadecimal) {
    end += hexadecimal[0].length;
    if (isCssWhitespace(css[end])) end += css[end] === '\r' && css[end + 1] === '\n' ? 2 : 1;
    const point = Number.parseInt(hexadecimal[0], 16);
    return { end, value: point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff) ? '\ufffd' : String.fromCodePoint(point) };
  }
  const point = css.codePointAt(end);
  return { end: point === undefined ? end : end + (point > 0xffff ? 2 : 1), value: point === undefined ? '\ufffd' : String.fromCodePoint(point) };
};

const cssName = (css, start) => {
  let end = start;
  let value = '';
  while (end < css.length) {
    if (isCssNamePoint(css[end])) value += css[end++];
    else if (isCssEscape(css, end)) {
      const escaped = cssEscape(css, end);
      value += escaped.value;
      end = escaped.end;
    } else break;
  }
  return { end, value };
};

// A URL token (including bad-URL remnants) ends at the first unescaped ')' or EOF.
// Its /*, braces and semicolons are data, not comments or rule delimiters.
// https://www.w3.org/TR/css-syntax-3/#consume-url-token
const cssUrlEnd = (css, start) => {
  for (let end = start; end < css.length;) {
    if (css[end] === ')') return end + 1;
    end = isCssEscape(css, end) ? cssEscape(css, end).end : end + 1;
  }
  return css.length;
};

// Keep source offsets while excluding literal punctuation from every boundary scan.
const cssLexicalViews = (css) => {
  const source = css.split('');
  const structural = css.split('');
  for (let cursor = 0; cursor < css.length; cursor++) {
    const start = cursor;
    if (css[cursor] === '/' && css[cursor + 1] === '*') {
      const closing = css.indexOf('*/', cursor + 2);
      cursor = closing < 0 ? css.length - 1 : closing + 1;
      source.fill(' ', start, cursor + 1);
    } else if (css[cursor] === '"' || css[cursor] === "'") {
      const quote = css[cursor++];
      while (cursor < css.length && css[cursor] !== quote) {
        // A bad string ends before a physical CSS newline; the outer scan reconsumes it.
        // https://www.w3.org/TR/css-syntax-3/#consume-string-token
        if (isCssNewline(css[cursor])) {
          cursor--;
          break;
        }
        if (css[cursor] === '\\') {
          if (isCssNewline(css[cursor + 1])) {
            cursor += css[cursor + 1] === '\r' && css[cursor + 2] === '\n' ? 3 : 2;
          } else cursor = cssEscape(css, cursor).end;
        } else cursor++;
      }
    } else if (isCssNamePoint(css[cursor]) || isCssEscape(css, cursor)) {
      const name = cssName(css, cursor);
      let end = name.end;
      if (name.value.toLowerCase() === 'url' && css[end] === '(' && !['@', '#'].includes(css[start - 1])) {
        let content = end + 1;
        while (isCssWhitespace(css[content])) content++;
        // Quoted url() is an ordinary function/string token pair (§4.3.4).
        if (css[content] !== '"' && css[content] !== "'") end = cssUrlEnd(css, content);
      }
      cursor = end - 1;
    } else if (css[cursor] === '\\') {
      cursor++;
    } else {
      continue;
    }
    structural.fill(' ', start, Math.min(cursor + 1, css.length));
  }
  return { source: source.join(''), structural: structural.join('') };
};

const cssDelimiter = (structural, start, end, delimiters) => {
  const closing = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let cursor = start; cursor < end; cursor++) {
    const character = structural[cursor];
    if (stack.length === 0 && delimiters.includes(character)) return cursor;
    if (Object.hasOwn(closing, character)) stack.push(closing[character]);
    else if (character === stack.at(-1)) stack.pop();
  }
  return end;
};

const cssBlockEnd = (structural, start, end) => {
  let depth = 1;
  for (let cursor = start + 1; cursor < end; cursor++) {
    if (structural[cursor] === '{') depth++;
    if (structural[cursor] === '}' && --depth === 0) return cursor;
  }
  return end;
};

const cssSelectorList = (selector) => {
  const { source, structural } = cssLexicalViews(selector);
  const selectors = [];
  for (let cursor = 0; cursor < source.length;) {
    const boundary = cssDelimiter(structural, cursor, source.length, ',');
    selectors.push(source.slice(cursor, boundary).trim());
    cursor = boundary + 1;
  }
  return selectors;
};

const parseCssRules = (css) => {
  const { source, structural } = cssLexicalViews(css);
  const rules = [];
  const declaration = (start, end) => {
    const colon = cssDelimiter(structural, start, end, ':');
    const property = source.slice(start, colon).trim();
    return colon < end && /^[\w-]+$/.test(property)
      ? { property, value: source.slice(colon + 1, end).trim() } : null;
  };
  const qualifiedRule = (selector, start, end, topLevel) => {
    const rule = { selector, topLevel, declarations: [] };
    rules.push(rule);
    for (let cursor = start; cursor < end;) {
      let boundary = cssDelimiter(structural, cursor, end, ';{');
      const prelude = source.slice(cursor, boundary).trim();
      if (structural[boundary] === '{' && !/^--[\w-]+\s*:/.test(prelude)) {
        const close = cssBlockEnd(structural, boundary, end);
        if (prelude.startsWith('@')) ruleList(boundary + 1, close, false);
        else qualifiedRule(prelude, boundary + 1, close, false);
        cursor = close + 1;
        continue;
      }
      // A custom-property value can contain balanced blocks, including semicolons.
      if (structural[boundary] === '{') boundary = cssDelimiter(structural, cursor, end, ';');
      const parsed = declaration(cursor, boundary);
      if (parsed) rule.declarations.push(parsed);
      cursor = boundary + 1;
    }
  };
  const ruleList = (start, end, topLevel) => {
    for (let cursor = start; cursor < end;) {
      const boundary = cssDelimiter(structural, cursor, end, ';{');
      if (boundary === end) break;
      const prelude = source.slice(cursor, boundary).trim();
      if (structural[boundary] === ';') {
        cursor = boundary + 1;
        continue;
      }
      const close = cssBlockEnd(structural, boundary, end);
      if (prelude.startsWith('@')) ruleList(boundary + 1, close, false);
      else qualifiedRule(prelude, boundary + 1, close, topLevel);
      cursor = close + 1;
    }
  };
  ruleList(0, source.length, true);
  return rules;
};

const declarationFor = (rules, selector, property) => {
  const exactRules = rules.filter((rule) => cssSelectorList(rule.selector).includes(selector));
  assert.ok(exactRules.length > 0, `missing package CSS rule ${selector}`);
  const declarations = exactRules.flatMap((rule) => rule.declarations.filter((item) => item.property === property));
  assert.ok(declarations.length > 0, `missing ${property} in ${selector}`);
  return declarations.at(-1).value;
};

const themeFontVariables = new Set([
  '--make-mobile-theme-control-text-size',
  '--make-mobile-theme-content-size',
]);
const sheetBodySizeVariable = '--make-mobile-sheet-body-size';

const hasVerifiedSheetSizeDefault = (rules) => {
  const defaults = rules
    .filter(rule => rule.topLevel && cssSelectorList(rule.selector).includes('.make-app-mobile-sheet'))
    .flatMap(rule => rule.declarations.filter(({ property }) => property === sheetBodySizeVariable));
  return defaults.length > 0 && defaults.every(({ value }) =>
    /^(\d+(?:\.\d+)?)px$/.test(value) && Number.isFinite(Number.parseFloat(value)) && Number.parseFloat(value) > 0);
};

// Recognize the published font-role chain, not arbitrary CSS custom-property resolution.
const isCssSizeReference = (value, hasSheetDefault) => {
  if (/^-?\d+(?:\.\d+)?px$/.test(value)) return true;
  const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (!variable) return false;
  const [, name, fallback] = variable;
  if (!fallback) return name === sheetBodySizeVariable && hasSheetDefault;
  return themeFontVariables.has(name) && isCssSizeReference(fallback.trim(), hasSheetDefault);
};

const isSafeInputFontSize = (value, hasSheetDefault) => {
  const normalized = value.replace(/\s*!important\s*$/i, '').trim();
  const directPixels = /^(\d+(?:\.\d+)?)px$/.exec(normalized);
  if (directPixels) return Number(directPixels[1]) >= 16;
  const minimumPixels = /^max\(\s*(\d+(?:\.\d+)?)px\s*,\s*(var\(.+\))\s*\)$/.exec(normalized);
  return Boolean(minimumPixels && Number(minimumPixels[1]) >= 16 && isCssSizeReference(minimumPixels[2], hasSheetDefault));
};

const targetsUniversalElement = (selector) => cssSelectorList(selector).some((part) =>
  /(?:^|[\s>+~])\*[^\s>+~]*$/.test(part.trim()));

const targetsSearchInputByType = (selector) => cssSelectorList(selector).some((part) =>
  /(?:^|[\s>+~])\[type\s*=\s*["']?search["']?\][^\s>+~]*$/i.test(part.trim()));

const targetsEditableInput = (selector) => cssSelectorList(selector).some((part) => {
  if (/::(?:-webkit-input-)?placeholder/i.test(part)) return false;
  if (/(?:^|[\s>+~(])(?:input|textarea)(?=$|[\s:[.#>+~)])/i.test(part)) return true;
  // A focused, untyped target may be the search input, regardless of ancestor pseudos or combinators.
  const focusedTarget = /(?:^|[\s>+~])([^\s>+~,{]*):focus(?:-visible)?(?![-\w])(?:[^\s>+~,{]*)?$/.exec(part.trim());
  if (!focusedTarget) return false;
  const compound = focusedTarget[1];
  if (/^(?:button|select|option|label|div|span|a|svg)(?=$|[.#[:])/i.test(compound)) return false;
  return !/\.make-app-mobile-picker__(?:option|clear|confirm)(?=$|[.#[:])/i.test(compound);
});

const targetsSelectedScroller = (selector) => cssSelectorList(selector).some((part) =>
  /\.make-app-mobile-picker__selected(?=$|[:\s>+~.,#\[])/.test(part));

const packageExportPath = (packageRoot, packageJson, subpath) => {
  const entry = packageJson.exports?.[subpath];
  const target = typeof entry === 'string' ? entry : entry?.import ?? entry?.default;
  assert.ok(typeof target === 'string' && target.startsWith('./'), `missing public export ${subpath}`);
  const resolved = path.resolve(packageRoot, target);
  assert.ok(resolved.startsWith(`${packageRoot}${path.sep}`), `public export ${subpath} must stay inside the package`);
  return resolved;
};

export const assertIosPackageCss = (css) => {
  const rules = parseCssRules(css);
  const hasSheetDefault = hasVerifiedSheetSizeDefault(rules);
  const searchFontSize = declarationFor(rules, '.make-app-mobile-picker__search input', 'font-size');
  assert.ok(isSafeInputFontSize(searchFontSize, hasSheetDefault), 'package-owned editable picker search must be at least 16px on iOS');
  const selectedTouchAction = declarationFor(rules, '.make-app-mobile-picker__selected', 'touch-action');
  assert.match(
    selectedTouchAction,
    /(?:^|\s)pinch-zoom(?:\s|$)/,
    'package-owned selected-item scroller must preserve pinch-zoom',
  );
  for (const rule of rules) {
    const broadInputOverride = (targetsUniversalElement(rule.selector) || targetsSearchInputByType(rule.selector))
      && rule.declarations.some(({ property, value }) =>
        (property === 'font-size' || property === 'font') && /!important\s*$/i.test(value));
    if (targetsEditableInput(rule.selector) || broadInputOverride) {
      for (const { property, value } of rule.declarations) {
        if (property === 'font-size') {
          assert.ok(isSafeInputFontSize(value, hasSheetDefault), `editable input rule ${rule.selector} must be at least 16px on iOS`);
        }
      }
      const lastFont = rule.declarations.findLastIndex(({ property }) => property === 'font');
      const lastFontSize = rule.declarations.findLastIndex(({ property }) => property === 'font-size');
      assert.ok(
        !rule.declarations.some(({ property, value }) => property === 'font' && /!important\s*$/i.test(value))
        && (lastFont < 0 || lastFontSize > lastFont),
        `editable input rule ${rule.selector} resets font without a safe font-size`,
      );
    }
    const broadTouchOverride = targetsUniversalElement(rule.selector)
      && rule.declarations.some(({ property, value }) =>
        property === 'touch-action' && /!important\s*$/i.test(value));
    if (targetsSelectedScroller(rule.selector) || broadTouchOverride) {
      for (const { property, value } of rule.declarations) {
        if (property === 'touch-action') {
          assert.match(value, /(?:^|\s)pinch-zoom(?:\s|$)/, `selected-item scroller rule ${rule.selector} must preserve pinch-zoom`);
        }
      }
    }
  }
};

export const assertAttachmentUploadCss = (css) => {
  const rules = parseCssRules(css);
  const selector = '.make-app-mobile-attachment-field__upload';
  assert.equal(declarationFor(rules, selector, 'box-sizing'), 'border-box', 'attachment upload height must include its padding and border');
  assert.equal(declarationFor(rules, selector, 'height'), '48px', 'attachment upload entry must have a fixed 48px height');
};

export const assertAttachmentHtml = ({ saved, pending, retry, failed }) => {
  assert.doesNotMatch(
    saved,
    /make-app-mobile-attachment-field__status/,
    'saved attachment without a status must not appear pending',
  );
  assert.match(pending, /make-app-mobile-attachment-field__status-icon/, 'pending attachment must use the status icon');
  assert.match(pending, /aria-label="待上传"/, 'pending attachment icon must have an accessible label');
  assert.doesNotMatch(
    pending,
    /class="make-app-mobile-attachment-field__status(?:\s|")/,
    'pending attachment must not render the old text status',
  );
  assert.match(retry, /make-app-mobile-attachment-field__retry/, 'failed attachment must offer an icon retry action');
  assert.match(retry, /aria-label="重新上传failed\.txt"/, 'retry icon must have an accessible name');
  assert.doesNotMatch(
    retry,
    /class="make-app-mobile-attachment-field__status(?:\s|")/,
    'retry icon must not duplicate the default failed status text',
  );
  assert.match(failed, /make-app-mobile-attachment-field__status/, 'failure without retry must show a status');
  assert.match(failed, /上传失败/, 'failure without retry must show a readable message');
};

export const verifyMobilePackageSurface = async (packageRootArgument, { detail = false } = {}) => {
  const packageRoot = path.resolve(packageRootArgument);
  let version = 'unknown';
  console.info('[makeui] checking installed mobile package surface', { detail });

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    assert.equal(packageJson.name, '@qfei-design/make-app-mobile');
    version = packageJson.version;
    const versionMatch = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(version);
    assert.ok(versionMatch, `expected a stable mobile package version, received ${version}`);
    const major = Number(versionMatch[1]);
    const minor = Number(versionMatch[2]);
    const patch = Number(versionMatch[3]);
    assert.ok(major > 0 || minor > 1 || (minor === 1 && patch >= 9), `expected mobile package >= 0.1.9 for the current visual baseline, received ${version}`);

    const css = fs.readFileSync(packageExportPath(packageRoot, packageJson, './styles.css'), 'utf8');
    assertIosPackageCss(css);
    assertAttachmentUploadCss(css);

    const requireFromPackage = createRequire(path.join(packageRoot, 'package.json'));
    const React = requireFromPackage('react');
    const { renderToStaticMarkup } = requireFromPackage('react-dom/server');
    const { MobileAttachmentField } = await import(pathToFileURL(packageExportPath(packageRoot, packageJson, './fields')).href);
    assert.ok(isReactComponentExport(MobileAttachmentField), 'missing or invalid MobileAttachmentField public export');

    const renderAttachment = (item, onRetry) => renderToStaticMarkup(React.createElement(MobileAttachmentField, {
      fieldName: '附件',
      items: [item],
      onChooseFiles: () => {},
      onRemove: () => {},
      ...(onRetry ? { onRetry: () => {} } : {}),
    }));
    assertAttachmentHtml({
      saved: renderAttachment({ key: 'saved', name: 'saved.txt' }),
      pending: renderAttachment({ key: 'pending', name: 'pending.txt', status: 'pending' }),
      retry: renderAttachment({ key: 'retry', name: 'failed.txt', status: 'error' }, true),
      failed: renderAttachment({ key: 'failed', name: 'failed.txt', status: 'error' }),
    });
    if (detail) {
      const primitives = await import(pathToFileURL(packageExportPath(packageRoot, packageJson, './primitives')).href);
      for (const name of ['MobileTimeline', 'MobileDetailSection', 'MobileFieldRow', 'MobileTextArea', 'MobileDetailPage', 'MobileFormActionBar', 'MobileFormSheet']) {
        assert.ok(isReactComponentExport(primitives[name]), `missing or invalid public detail component ${name}`);
      }
    }
    return version;
  } catch (error) {
    console.error('[makeui] installed mobile package surface failed', {
      version,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  assert.ok(process.argv[2], 'usage: node verify-mobile-package-surface.mjs <installed-package-root> [--detail]');
  assert.ok(process.argv.slice(3).every((arg) => arg === '--detail'), 'unknown option; supported option: --detail');
  try {
    const version = await verifyMobilePackageSurface(process.argv[2], { detail: process.argv.includes('--detail') });
    console.log(`makeui mobile package surface verified: ${version}`);
  } catch {
    process.exitCode = 1;
  }
}
