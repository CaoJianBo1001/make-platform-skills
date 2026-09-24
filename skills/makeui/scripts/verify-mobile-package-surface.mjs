#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const parseCssRules = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({
    selector: selector.trim(),
    declarations: [...body.matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]+)/g)]
      .map(([, property, value]) => ({ property, value: value.trim() })),
  }));

const declarationFor = (rules, selector, property) => {
  const exactRules = rules.filter((rule) => rule.selector.split(',').some((part) => part.trim() === selector));
  assert.ok(exactRules.length > 0, `missing package CSS rule ${selector}`);
  const declarations = exactRules.flatMap((rule) => rule.declarations.filter((item) => item.property === property));
  assert.ok(declarations.length > 0, `missing ${property} in ${selector}`);
  return declarations.at(-1).value;
};

const isSafeInputFontSize = (value) => {
  const normalized = value.replace(/\s*!important\s*$/i, '').trim();
  const directPixels = /^(\d+(?:\.\d+)?)px$/.exec(normalized);
  if (directPixels) return Number(directPixels[1]) >= 16;
  const minimumPixels = /^max\(\s*(\d+(?:\.\d+)?)px\s*,\s*var\(--make-mobile-sheet-body-size\)\s*\)$/.exec(normalized);
  return Boolean(minimumPixels && Number(minimumPixels[1]) >= 16);
};

const targetsUniversalElement = (selector) => selector.split(',').some((part) =>
  /(?:^|[\s>+~])\*[^\s>+~]*$/.test(part.trim()));

const targetsSearchInputByType = (selector) => selector.split(',').some((part) =>
  /(?:^|[\s>+~])\[type\s*=\s*["']?search["']?\][^\s>+~]*$/i.test(part.trim()));

const targetsEditableInput = (selector) => selector.split(',').some((part) => {
  if (/::(?:-webkit-input-)?placeholder/i.test(part)) return false;
  if (/(?:^|[\s>+~(])(?:input|textarea)(?=$|[\s:[.#>+~)])/i.test(part)) return true;
  // A focused, untyped target may be the search input, regardless of ancestor pseudos or combinators.
  const focusedTarget = /(?:^|[\s>+~])([^\s>+~,{]*):focus(?:-visible)?(?![-\w])(?:[^\s>+~,{]*)?$/.exec(part.trim());
  if (!focusedTarget) return false;
  const compound = focusedTarget[1];
  if (/^(?:button|select|option|label|div|span|a|svg)(?=$|[.#[:])/i.test(compound)) return false;
  return !/\.make-app-mobile-picker__(?:option|clear|confirm)(?=$|[.#[:])/i.test(compound);
});

const targetsSelectedScroller = (selector) =>
  /\.make-app-mobile-picker__selected(?=$|[:\s>+~.,#\[])/.test(selector);

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
  const searchFontSize = declarationFor(rules, '.make-app-mobile-picker__search input', 'font-size');
  assert.ok(isSafeInputFontSize(searchFontSize), 'package-owned editable picker search must be at least 16px on iOS');
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
          assert.ok(isSafeInputFontSize(value), `editable input rule ${rule.selector} must be at least 16px on iOS`);
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

export const verifyMobilePackageSurface = async (packageRootArgument) => {
  const packageRoot = path.resolve(packageRootArgument);
  let version = 'unknown';
  console.info('[makeui] checking installed mobile package surface');

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
    assert.equal(typeof MobileAttachmentField, 'function', 'missing MobileAttachmentField public export');

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
  assert.ok(process.argv[2], 'usage: node verify-mobile-package-surface.mjs <installed-package-root>');
  try {
    const version = await verifyMobilePackageSurface(process.argv[2]);
    console.log(`makeui mobile package surface verified: ${version}`);
  } catch {
    process.exitCode = 1;
  }
}
