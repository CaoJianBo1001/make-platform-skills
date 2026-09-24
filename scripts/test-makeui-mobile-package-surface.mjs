#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertAttachmentHtml,
  assertIosPackageCss,
  verifyMobilePackageSurface,
} from '../skills/makeui/scripts/verify-mobile-package-surface.mjs';

const iosCss = `
.make-app-mobile-picker__search input {
  font-size: max(16px, var(--make-mobile-sheet-body-size));
}
.make-app-mobile-picker__selected {
  touch-action: pan-x pinch-zoom;
}
`;

test('iOS package gate accepts an editable search input of at least 16px and pinch zoom', () => {
  assert.doesNotThrow(() => assertIosPackageCss(iosCss));
  assert.doesNotThrow(() => assertIosPackageCss(iosCss.replace('max(16px, var(--make-mobile-sheet-body-size))', '18px')));
});

test('iOS package gate rejects the installed 0.1.7 search and touch declarations', () => {
  const oldCss = iosCss
    .replace('max(16px, var(--make-mobile-sheet-body-size))', 'var(--make-mobile-sheet-body-size)')
    .replace('pan-x pinch-zoom', 'pan-x');
  assert.throws(() => assertIosPackageCss(oldCss), /16px/);
  assert.throws(() => assertIosPackageCss(iosCss.replace('pan-x pinch-zoom', 'pan-x')), /pinch-zoom/);
});

test('iOS package gate rejects a focused input override after a compliant base rule', () => {
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n.make-app-mobile-picker__search input:focus { font-size: 14px; }`),
    /16px/,
  );
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n@media (max-width: 767px) { input:focus { font-size: 14px !important; } }`),
    /16px/,
  );
});

test('iOS package gate rejects unsafe focus declarations targeting the picker search descendant', () => {
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n.make-app-mobile-picker__search :focus { font-size: 14px !important; }`),
    /16px/,
  );
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n.make-app-mobile-picker__search > :focus-visible { font-size: 14px; }`),
    /16px/,
  );
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n.make-app-mobile-picker__search *:focus { font: inherit; }`),
    /font/i,
  );
});

test('iOS package gate rejects focus overrides scoped through picker ancestors', () => {
  for (const selector of [
    '.make-app-mobile-picker :focus',
    '.make-app-mobile-picker-sheet :focus-visible',
    '.make-app-mobile-picker__sticky :focus',
    '.make-app-mobile-picker__sticky:focus-within :focus',
    '.make-app-mobile-picker__search:focus-within > :focus-visible',
    ':focus',
  ]) {
    assert.throws(
      () => assertIosPackageCss(`${iosCss}\n${selector} { font-size: 14px !important; }`),
      /16px/,
      selector,
    );
  }
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n.make-app-mobile-picker :focus { font: inherit; }`),
    /font/i,
  );
});

test('iOS package gate does not treat an option button focus as a search input override', () => {
  assert.doesNotThrow(() => assertIosPackageCss(
    `${iosCss}\n.make-app-mobile-picker__option:focus-visible { font-size: 14px; }`,
  ));
  assert.doesNotThrow(() => assertIosPackageCss(
    `${iosCss}\n.make-app-mobile-picker .make-app-mobile-picker__option:focus-visible { font-size: 14px; }`,
  ));
  assert.doesNotThrow(() => assertIosPackageCss(
    `${iosCss}\n.make-app-mobile-picker button:focus { font-size: 14px; }`,
  ));
});

test('iOS package gate does not treat the search wrapper focus state as an input override', () => {
  assert.doesNotThrow(() => assertIosPackageCss(
    `${iosCss}\n.make-app-mobile-picker__search:focus-within { font-size: 14px; }`,
  ));
});

test('iOS package gate rejects a later font shorthand that resets the search input size', () => {
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n.make-app-mobile-picker__search input:focus { font: inherit; }`),
    /font/i,
  );
  assert.throws(
    () => assertIosPackageCss(iosCss.replace(
      'font-size: max(16px, var(--make-mobile-sheet-body-size));',
      'font: inherit !important; font-size: 16px;',
    )),
    /font/i,
  );
});

test('iOS package gate rejects a selected-scroller touch-action override', () => {
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n.make-app-mobile-picker__selected:focus-within { touch-action: pan-x; }`),
    /pinch-zoom/,
  );
});

test('iOS package gate rejects broad selectors that override the input or selected scroller', () => {
  for (const selector of ['.make-app-mobile-picker__search *', '[type=search]']) {
    assert.throws(
      () => assertIosPackageCss(`${iosCss}\n${selector} { font-size: 14px !important; }`),
      /16px/,
      selector,
    );
  }
  assert.throws(
    () => assertIosPackageCss(`${iosCss}\n* { touch-action: pan-x !important; }`),
    /pinch-zoom/,
  );
});

test('iOS package gate keeps lower-specificity broad defaults when the package targets stay safe', () => {
  assert.doesNotThrow(() => assertIosPackageCss(`${iosCss}
.make-app-mobile-picker__search * { font-size: 14px; }
[type=search] { font-size: 14px; }
* { touch-action: pan-x; }
`));
});

const compliantAttachmentHtml = {
  saved: '<article class="make-app-mobile-attachment-field__card">saved.txt</article>',
  pending: '<article class="make-app-mobile-attachment-field__card"><span class="make-app-mobile-attachment-field__status-icon" role="img" aria-label="待上传"></span></article>',
  retry: '<article class="make-app-mobile-attachment-field__card"><button class="make-app-mobile-attachment-field__retry" aria-label="重新上传failed.txt"></button></article>',
  failed: '<article class="make-app-mobile-attachment-field__card"><span class="make-app-mobile-attachment-field__status">上传失败</span></article>',
};

test('attachment package gate accepts the declared saved, pending, and failed states', () => {
  assert.doesNotThrow(() => assertAttachmentHtml(compliantAttachmentHtml));
});

test('attachment package gate rejects a saved file shown as pending', () => {
  assert.throws(
    () => assertAttachmentHtml({
      ...compliantAttachmentHtml,
      saved: '<span class="make-app-mobile-attachment-field__status">待</span>',
    }),
    /saved attachment/i,
  );
});

test('attachment package gate rejects a retry action without the standard accessible icon', () => {
  assert.throws(
    () => assertAttachmentHtml({
      ...compliantAttachmentHtml,
      retry: '<button class="make-app-mobile-attachment-field__retry" aria-label="重试failed.txt"></button>',
    }),
    /retry/i,
  );
});

test('surface verifier follows public exports when package build paths move', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'makeui-mobile-surface-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relativePath of ['assets', 'esm', 'node_modules/react', 'node_modules/react-dom']) {
    fs.mkdirSync(path.join(root, relativePath), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: '@qfei-design/make-app-mobile',
    version: '0.1.8',
    exports: {
      './styles.css': { default: './assets/mobile.css' },
      './fields': { import: './esm/fields.mjs' },
    },
  }));
  fs.writeFileSync(path.join(root, 'assets/mobile.css'), iosCss);
  fs.writeFileSync(path.join(root, 'node_modules/react/index.js'), 'exports.createElement = (type, props) => ({ type, props });');
  fs.writeFileSync(path.join(root, 'node_modules/react-dom/server.js'), 'exports.renderToStaticMarkup = (element) => element.type(element.props);');
  fs.writeFileSync(path.join(root, 'esm/fields.mjs'), `
export const MobileAttachmentField = ({ items, onRetry }) => {
  const item = items[0];
  if (item.status === 'pending') return '<span class="make-app-mobile-attachment-field__status-icon" aria-label="待上传"></span>';
  if (item.status === 'error' && onRetry) return '<button class="make-app-mobile-attachment-field__retry" aria-label="重新上传failed.txt"></button>';
  if (item.status === 'error') return '<span class="make-app-mobile-attachment-field__status">上传失败</span>';
  return '<article class="make-app-mobile-attachment-field__card">saved.txt</article>';
};
`);

  assert.equal(await verifyMobilePackageSurface(root), '0.1.8');
});
