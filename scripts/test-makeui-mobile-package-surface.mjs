#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run the same contract against either the source or a complete installed Skill.
// Usage: node scripts/test-makeui-mobile-package-surface.mjs [--skill=<makeui-dir>]
const [skillArgument, ...extraArguments] = process.argv.slice(2);
if (extraArguments.length || (skillArgument !== undefined && (!skillArgument.startsWith('--skill=') || skillArgument === '--skill='))) {
  throw new Error('Usage: node scripts/test-makeui-mobile-package-surface.mjs [--skill=<makeui-dir>]');
}
const makeuiRoot = skillArgument
  ? path.resolve(skillArgument.slice('--skill='.length))
  : fileURLToPath(new URL('../skills/makeui/', import.meta.url));
const {
  assertAttachmentHtml,
  assertIosPackageCss,
  verifyMobilePackageSurface,
} = await import(pathToFileURL(path.join(makeuiRoot, 'scripts/verify-mobile-package-surface.mjs')));

const iosCss = `
.make-app-mobile-sheet {
  --make-mobile-sheet-body-size: 14px;
}
.make-app-mobile-picker__search input {
  font-size: max(16px, var(--make-mobile-sheet-body-size));
}
.make-app-mobile-picker__selected {
  touch-action: pan-x pinch-zoom;
}
`;
const attachmentCss = `
.make-app-mobile-attachment-field__upload {
  box-sizing: border-box;
  width: 100%;
  height: 48px;
  border: 1px dashed;
}
`;

test('iOS package gate accepts an editable search input of at least 16px and pinch zoom', () => {
  assert.doesNotThrow(() => assertIosPackageCss(iosCss));
  assert.doesNotThrow(() => assertIosPackageCss(iosCss.replace('max(16px, var(--make-mobile-sheet-body-size))', '18px')));
});

test('iOS package gate accepts published theme-role fallbacks while retaining the explicit 16px floor', () => {
  for (const reference of [
    'var(--make-mobile-theme-control-text-size, var(--make-mobile-sheet-body-size))',
    'var(--make-mobile-theme-control-text-size, var(--make-mobile-theme-content-size, 16px))',
  ]) {
    const css = iosCss.replace('max(16px, var(--make-mobile-sheet-body-size))', `max(16px, ${reference})`);
    assert.doesNotThrow(() => assertIosPackageCss(css));
    assert.throws(() => assertIosPackageCss(css.replace('max(16px,', 'max(15px,')), /16px/);
    assert.throws(() => assertIosPackageCss(css.replace('max(16px,', 'min(16px,')), /16px/);
    assert.throws(() => assertIosPackageCss(css.replace(`max(16px, ${reference})`, reference)), /16px/);
  }
});

test('iOS package gate rejects unknown font variables even when they resemble the published fallback chain', () => {
  for (const reference of [
    'var(--unknown-control-size)',
    'var(--unknown-control-size, 16px)',
    'var(--unknown-control-size, var(--also-unknown))',
    'var(--make-mobile-theme-control-text-size)',
    'var(--make-mobile-theme-control-text-size, var(--unknown-control-size))',
    'var(--make-mobile-theme-control-text-size, var(--make-mobile-sheet-body-szie))',
  ]) {
    assert.throws(() => assertIosPackageCss(iosCss.replace('var(--make-mobile-sheet-body-size)', reference)), /16px/, reference);
  }
});

test('iOS package gate requires the legacy font leaf to have a usable sheet default', () => {
  const noDefault = iosCss.replace('--make-mobile-sheet-body-size: 14px;', '');
  assert.throws(() => assertIosPackageCss(noDefault), /16px/);
  for (const value of ['red', 'initial', 'inherit', 'var(--missing)', '0px', '-14px']) {
    assert.throws(() => assertIosPackageCss(iosCss.replace('14px;', value + ';')), /16px/, value);
  }
  assert.doesNotThrow(() => assertIosPackageCss(iosCss.replace('14px;', '18px;')));
  assert.doesNotThrow(() => assertIosPackageCss('.unrelated::before { content: "{decorative}"; }' + iosCss));
  const numericFallback = noDefault.replace('var(--make-mobile-sheet-body-size)', 'var(--make-mobile-theme-control-text-size, 16px)');
  assert.doesNotThrow(() => assertIosPackageCss(numericFallback));
});

test('iOS package gate does not trust unrelated or conditional declarations as the sheet default', () => {
  const noDefault = iosCss.replace('--make-mobile-sheet-body-size: 14px;', '');
  for (const extra of [
    '.unrelated { --make-mobile-sheet-body-size: 14px; }',
    '.make-app-mobile-date-sheet { --make-mobile-sheet-body-size: 14px; }',
    '@media (max-width: 300px) { .make-app-mobile-sheet { --make-mobile-sheet-body-size: 14px; } }',
    '@supports (display: grid) { .make-app-mobile-sheet { --make-mobile-sheet-body-size: 14px; } }',
    '@media (max-width: 300px) { .unrelated::before { content: "}"; } .make-app-mobile-sheet { --make-mobile-sheet-body-size: 14px; } }',
  ]) {
    assert.throws(() => assertIosPackageCss(noDefault + extra), /16px/, extra);
  }
});

test('iOS package gate never treats quoted at-rule text as a real sheet default', () => {
  const noDefault = iosCss.replace('--make-mobile-sheet-body-size: 14px;', '');
  for (const prefix of [
    '@namespace dummy "urn:x, .make-app-mobile-sheet { --make-mobile-sheet-body-size: 14px; }"; .unrelated {}',
    '@import "x, .make-app-mobile-sheet { --make-mobile-sheet-body-size: 14px; }.css"; .unrelated {}',
    '@import url("x, .make-app-mobile-sheet { --make-mobile-sheet-body-size: 14px; }.css"); .unrelated {}',
  ]) {
    assert.throws(() => assertIosPackageCss(prefix + noDefault), /16px/, prefix);
    assert.doesNotThrow(() => assertIosPackageCss(prefix + iosCss), prefix);
  }
  assert.doesNotThrow(() => assertIosPackageCss('@namespace dummy "urn:x;{}";' + iosCss));
});

test('iOS package gate separates real selector commas from attribute and function contents', () => {
  const noDefault = iosCss.replace('--make-mobile-sheet-body-size: 14px;', '');
  for (const selector of [
    '[data-note=", .make-app-mobile-sheet, "]',
    "[data-note=', .make-app-mobile-sheet, ' ]",
    ':not(.unrelated, .make-app-mobile-sheet, .other)',
    String.raw`.unrelated\, .make-app-mobile-sheet\, .other`,
  ]) {
    assert.throws(() => assertIosPackageCss(`${selector} { --make-mobile-sheet-body-size: 14px; }` + noDefault), /16px/, selector);
  }
  for (const selector of ['.make-app-mobile-sheet', '.make-app-mobile-picker__search input', '.make-app-mobile-picker__selected']) {
    assert.doesNotThrow(() => assertIosPackageCss(iosCss.replace(`${selector} {`, `.unrelated, ${selector} {`)));
  }
  const withoutSearchRule = iosCss.replace('.make-app-mobile-picker__search input', '[data-note=", .make-app-mobile-picker__search input, "]');
  assert.throws(() => assertIosPackageCss(withoutSearchRule), /missing package CSS rule/);
  const withoutScrollerRule = iosCss.replace('.make-app-mobile-picker__selected', '[data-note=", .make-app-mobile-picker__selected, "]');
  assert.throws(() => assertIosPackageCss(withoutScrollerRule), /missing package CSS rule/);
});

test('iOS package gate ignores declaration-shaped text inside quoted custom properties', () => {
  const noDefault = iosCss.replace('--make-mobile-sheet-body-size: 14px;', '--sample: "x; --make-mobile-sheet-body-size: 14px; x";');
  assert.throws(() => assertIosPackageCss(noDefault), /16px/);
  for (const sample of ['"x; font-size: 14px; x"', "'x; font: inherit !important; x'", '"/* text is not a comment */ { x; y:z }"']) {
    const css = iosCss + `.make-app-mobile-picker__search input { --sample: ${sample}; font-size: 16px; }`;
    assert.doesNotThrow(() => assertIosPackageCss(css), sample);
  }
});

const stringNewlines = [['LF', '\n'], ['CR', '\r'], ['CRLF', '\r\n'], ['FF', '\f']];
for (const [name, newline] of stringNewlines) {
  for (const quote of ['"', "'"]) {
    const unsafe = '.make-app-mobile-picker__search input { font-size: 14px; }';
    test(`iOS package gate resumes after an unescaped ${name} in a ${quote} string`, () => {
      for (const prefix of ['', '\\\\', String.raw`\61` + newline, String.raw`\0000061`]) {
        const broken = `.unrelated { content: ${quote}unfinished${prefix}${newline}; }`;
        assert.throws(() => assertIosPackageCss(iosCss + broken + unsafe), /16px/, JSON.stringify(prefix));
        assert.doesNotThrow(() => assertIosPackageCss(iosCss + broken + unsafe.replace('14px', '16px')));
      }
    });

    test(`iOS package gate preserves escaped ${name} and hexadecimal whitespace in a ${quote} string`, () => {
      for (const escape of ['\\', '\\\\\\', String.raw`\61`, String.raw`\000061`]) {
        const valid = `.unrelated { content: ${quote}valid${escape}${newline}; } font-size: 14px;${quote}; }`;
        assert.doesNotThrow(() => assertIosPackageCss(iosCss + valid), JSON.stringify(escape));
        assert.throws(() => assertIosPackageCss(iosCss + valid + unsafe), /16px/, JSON.stringify(escape));
      }
      for (const escape of [String.raw`\22`, String.raw`\27`, String.raw`\a`, String.raw`\d`, String.raw`\c`]) {
        const valid = `.unrelated { content: ${quote}${escape} ; } font-size: 14px;${quote}; }`;
        assert.doesNotThrow(() => assertIosPackageCss(iosCss + valid), escape);
      }
      for (const character of ['\t', '\v', '\u00a0', '\u2028', '\u2029']) {
        const valid = `.unrelated { content: ${quote}valid${character}; } font-size: 14px;${quote}; }`;
        assert.doesNotThrow(() => assertIosPackageCss(iosCss + valid), JSON.stringify(character));
      }
    });
  }
}

test('iOS package gate still sees unsafe declarations after strings, escaped punctuation and custom blocks', () => {
  for (const value of [
    '"{word}"',
    '"}; font-size: 16px; {"',
    String.raw`"a\"}; font-size: 16px; {"`,
    String.raw`escaped\{part\;with\:punctuation\}`,
    '{ inside: { text: "}; font-size: 16px;"; }; }',
    'sample("{;:}", nested(a;b:c))',
  ]) {
    const css = iosCss + `.make-app-mobile-picker__search input { --sample: ${value}; font-size: 14px; }`;
    assert.throws(() => assertIosPackageCss(css), /16px/, value);
    assert.doesNotThrow(() => assertIosPackageCss(
      iosCss + `.make-app-mobile-picker__search input { --sample: ${value}; font-size: 16px; }`,
    ), value);
  }
  assert.throws(() => assertIosPackageCss(iosCss + '.make-app-mobile-picker__selected { --sample: "{};:"; touch-action: pan-x; }'), /pinch-zoom/);
});

test('iOS package gate respects real comments and escaped delimiters without changing rule boundaries', () => {
  const prefix = String.raw`.unrelated\{name { --sample: escaped\;token\:part\}value; content: "/* } ; : */"; }`;
  assert.doesNotThrow(() => assertIosPackageCss(prefix + iosCss));
  assert.doesNotThrow(() => assertIosPackageCss('/* " { } ; : fake rule */' + iosCss));
  assert.doesNotThrow(() => assertIosPackageCss(iosCss.replace('font-size:', 'font-size /* { comment } */ :')));
  assert.doesNotThrow(() => assertIosPackageCss(iosCss.replace(
    '--make-mobile-sheet-body-size: 14px;',
    '--before: "/*"; --make-mobile-sheet-body-size: 14px; --after: "*/";',
  )));
  const noDefault = iosCss.replace('--make-mobile-sheet-body-size: 14px;', '');
  assert.throws(() => assertIosPackageCss('/* .make-app-mobile-sheet { --make-mobile-sheet-body-size: 14px; } */' + noDefault), /16px/);
});

test('iOS package gate sees real font declarations after comment-shaped unquoted URL data', () => {
  for (const url of ['/assets/*.svg', 'data:text/plain,a/*b']) {
    for (const reference of [`url(${url})`, `url("${url}")`, `url('${url}')`]) {
      assert.throws(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { background-image: ${reference}; font-size: 14px; }`), /16px/, reference);
      assert.doesNotThrow(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { background-image: ${reference}; font-size: 16px; }`), reference);
    }
  }
});

test('iOS package gate recognizes the decoded ASCII case-insensitive URL function name', () => {
  for (const name of ['url', 'URL', 'UrL', String.raw`u\72l`, String.raw`\75rl`, String.raw`\000075rl`, String.raw`\75 rl`]) {
    const reference = `${name}( \t/assets/*.svg\r\n )`;
    assert.throws(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 14px; }`), /16px/, name);
    assert.doesNotThrow(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 16px; }`), name);
  }
});

test('iOS package gate does not mistake a longer name, dimension, hash or at-keyword for URL', () => {
  for (const name of ['myurl', 'prefix-url', String.raw`my\75rl`, 'éurl', '1url', '#url', '@url']) {
    const reference = `${name}(/* literal ); font-size: 14px; */ end)`;
    assert.doesNotThrow(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 16px; }`), name);
    assert.throws(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 14px; }`), /16px/, name);
  }
});

test('iOS package gate treats URL delimiters as data and consumes CSS-escaped closing parentheses', () => {
  for (const reference of [
    'url(data:text/plain,};font-size:14px;{)',
    'url(data:text/plain,{;font-size:14px;)',
    String.raw`url(/assets/a\)/*b.svg)`,
    String.raw`url(/assets/a\(x\)/*b.svg)`,
    String.raw`url(/assets/a\29 /*b.svg)`,
    String.raw`url(/assets/a\000029/*b.svg)`,
  ]) {
    assert.doesNotThrow(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 16px; }`), reference);
    assert.throws(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 14px; }`), /16px/, reference);
  }
});

test('iOS package gate keeps nested function boundaries around independent URL tokens', () => {
  for (const reference of [
    'image-set(url(/assets/*.svg) 1x, url(data:text/plain,a/*b) 2x)',
    'nested(url(data:text/plain,{;), inner(url(/assets/*.svg), "};font-size:14px;"))',
  ]) {
    assert.doesNotThrow(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 16px; }`), reference);
    assert.throws(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 14px; }`), /16px/, reference);
  }
});

test('iOS package gate preserves quoted URL strings and real comments outside URL tokens', () => {
  for (const reference of [
    'url(  "/assets/*.svg"  )',
    "URL(\t'/assets/*.svg'\n)",
    String.raw`url("/assets/escaped\"};font-size:14px;/*x.svg")`,
    'url(/assets/*.svg) /* actual comment ) ; } font-size: 14px; */',
    'url(/assets/*.svg)/* first */ /* second */',
  ]) {
    assert.doesNotThrow(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 16px; }`), reference);
    assert.throws(() => assertIosPackageCss(iosCss + `.make-app-mobile-picker__search input { --sample: ${reference}; font-size: 14px; }`), /16px/, reference);
  }
  assert.doesNotThrow(() => assertIosPackageCss(iosCss + '.make-app-mobile-picker__search input { background: url(/assets/x.svg); /* font-size:14px; }'));
});

test('iOS package gate never promotes URL data into real rules or a sheet default', () => {
  const noDefault = iosCss.replace('--make-mobile-sheet-body-size: 14px;', '');
  for (const prefix of [
    '@import url(/assets/*.css);',
    '@namespace svg url(urn:x,.make-app-mobile-sheet{--make-mobile-sheet-body-size:14px;});',
    '.unrelated { --sample: url(x,.make-app-mobile-sheet{--make-mobile-sheet-body-size:14px;}); }',
  ]) {
    assert.doesNotThrow(() => assertIosPackageCss(prefix + iosCss), prefix);
    assert.throws(() => assertIosPackageCss(prefix + noDefault), /16px/, prefix);
  }
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

test('surface verifier follows public exports and requires the 0.1.9 attachment surface', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'makeui-mobile-surface-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relativePath of ['assets', 'esm', 'node_modules/react', 'node_modules/react-dom']) {
    fs.mkdirSync(path.join(root, relativePath), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: '@qfei-design/make-app-mobile',
    version: '0.1.9',
    exports: {
      './styles.css': { default: './assets/mobile.css' },
      './fields': { import: './esm/fields.mjs' },
    },
  }));
  fs.writeFileSync(path.join(root, 'assets/mobile.css'), iosCss + attachmentCss);
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

  assert.equal(await verifyMobilePackageSurface(root), '0.1.9');

  fs.writeFileSync(path.join(root, 'assets/mobile.css'), iosCss + attachmentCss.replace('height: 48px;', 'min-height: 56px;'));
  await assert.rejects(verifyMobilePackageSurface(root), /missing height/);

  fs.writeFileSync(path.join(root, 'assets/mobile.css'), iosCss + attachmentCss.replace('height: 48px;', 'height: 56px;'));
  await assert.rejects(verifyMobilePackageSurface(root), /48px/);

  fs.writeFileSync(path.join(root, 'assets/mobile.css'), iosCss + attachmentCss);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: '@qfei-design/make-app-mobile',
    version: '0.1.8',
    exports: {
      './styles.css': { default: './assets/mobile.css' },
      './fields': { import: './esm/fields.mjs' },
    },
  }));
  await assert.rejects(verifyMobilePackageSurface(root), /0\.1\.9/);
});

const detailExports = ['MobileTimeline','MobileDetailSection','MobileFieldRow','MobileTextArea','MobileDetailPage','MobileFormActionBar','MobileFormSheet'];
const detailPackage = (t, { missing, invalid, publicEntry = true, componentExpressions = {} } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'makeui-detail-surface-'));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  for (const dir of ['esm','node_modules/react','node_modules/react-dom']) fs.mkdirSync(path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({
    name:'@qfei-design/make-app-mobile',version:'0.1.9',
    exports:{'./styles.css':'./mobile.css','./fields':'./esm/fields.mjs',...(publicEntry?{'./primitives':'./esm/primitives.mjs'}:{})},
  }));
  fs.writeFileSync(path.join(root,'mobile.css'),iosCss+attachmentCss);
  fs.writeFileSync(path.join(root,'node_modules/react/index.js'),'exports.createElement = (type,props) => ({type,props});');
  fs.writeFileSync(path.join(root,'node_modules/react-dom/server.js'),'exports.renderToStaticMarkup = element => element.type(element.props);');
  fs.writeFileSync(path.join(root,'esm/fields.mjs'),`export const MobileAttachmentField = ({items,onRetry}) => {
    const {status}=items[0];
    return status==='pending'?${JSON.stringify(compliantAttachmentHtml.pending)}:status==='error'?(onRetry?${JSON.stringify(compliantAttachmentHtml.retry)}:${JSON.stringify(compliantAttachmentHtml.failed)}):${JSON.stringify(compliantAttachmentHtml.saved)};
  };`);
  fs.writeFileSync(path.join(root,'esm/primitives.mjs'),detailExports.filter(name=>name!==missing).map(name=>
    `export const ${name} = ${name===invalid?'{}':componentExpressions[name]??(name==='MobileTextArea'?'{ $$typeof: Symbol.for("react.forward_ref"), render: () => null }':'() => null')};`).join('\n'));
  return root;
};

test('complete detail CLI rejects real unsafe rules after bad strings and preserves valid continuations', (t) => {
  const root = detailPackage(t);
  const verifier = path.join(makeuiRoot, 'scripts/verify-mobile-package-surface.mjs');
  for (const [name, newline] of stringNewlines) {
    for (const quote of ['"', "'"]) {
      const label = `${name} ${quote}`;
      const broken = `.unrelated { content: ${quote}unfinished${newline}; }`;
      const unsafe = '.make-app-mobile-picker__search input { font-size: 14px; }';
      fs.writeFileSync(path.join(root, 'mobile.css'), iosCss + attachmentCss + broken + unsafe);
      const rejected = spawnSync(process.execPath, [verifier, root, '--detail'], { cwd: root, encoding: 'utf8' });
      assert.equal(rejected.status, 1, label + rejected.stdout + rejected.stderr);
      assert.match(rejected.stderr, /16px/, label);
      assert.doesNotMatch(rejected.stdout, /surface verified/, label);

      const valid = `.unrelated { content: ${quote}valid\\${newline}; } font-size: 14px;${quote}; }`;
      fs.writeFileSync(path.join(root, 'mobile.css'), iosCss + attachmentCss + valid);
      const accepted = spawnSync(process.execPath, [verifier, root, '--detail'], { cwd: root, encoding: 'utf8' });
      assert.equal(accepted.status, 0, label + accepted.stdout + accepted.stderr);
      assert.match(accepted.stdout, /surface verified: 0\.1\.9/, label);
    }
  }
});

test('detail capability rejects an old package that only passes the attachment baseline', async (t) => {
  const root=detailPackage(t,{publicEntry:false});
  assert.equal(await verifyMobilePackageSurface(root),'0.1.9');
  await assert.rejects(verifyMobilePackageSurface(root,{detail:true}),/public export.*primitives/);
});

for (const name of detailExports) {
  test(`detail capability rejects missing ${name} instead of accepting the version`, async (t) => {
    await assert.rejects(verifyMobilePackageSurface(detailPackage(t,{missing:name}),{detail:true}),new RegExp(name));
  });
}

test('detail capability accepts public components including React forwardRef', async (t) => {
  assert.equal(await verifyMobilePackageSurface(detailPackage(t),{detail:true}),'0.1.9');
});

test('detail capability rejects a non-component export with the expected name', async (t) => {
  await assert.rejects(verifyMobilePackageSurface(detailPackage(t,{invalid:'MobileFormActionBar'}),{detail:true}),/MobileFormActionBar/);
});

for (const [label, expression] of [
  ['memo', '{ $$typeof: Symbol.for("react.memo"), type: () => null }'],
  ['memo + forwardRef', '{ $$typeof: Symbol.for("react.memo"), type: { $$typeof: Symbol.for("react.forward_ref"), render: () => null } }'],
  ['nested memo', '{ $$typeof: Symbol.for("react.memo"), type: { $$typeof: Symbol.for("react.memo"), type: () => null } }'],
]) {
  test(`detail capability accepts valid ${label} component exports`, async (t) => {
    const componentExpressions = Object.fromEntries(detailExports.map(name => [name, expression]));
    assert.equal(await verifyMobilePackageSurface(detailPackage(t, { componentExpressions }), { detail:true }), '0.1.9');
  });
}

for (const [label, expression] of [
  ['memo without a component', '{ $$typeof: Symbol.for("react.memo"), type: {} }'],
  ['memo with an invalid forwardRef', '{ $$typeof: Symbol.for("react.memo"), type: { $$typeof: Symbol.for("react.forward_ref"), render: null } }'],
  ['cyclic memo', '(() => { const value = { $$typeof: Symbol.for("react.memo") }; value.type = value; return value; })()'],
]) {
  test(`detail capability rejects ${label} with the public export name`, async (t) => {
    const root = detailPackage(t, { componentExpressions: { MobileTimeline:expression } });
    await assert.rejects(verifyMobilePackageSurface(root, { detail:true }), /MobileTimeline/);
  });
}

test('documented detail command runs from an installed Skill without a source checkout', async (t) => {
  const markdown = fs.readFileSync(path.join(makeuiRoot, 'references/mobile-detail-components.md'), 'utf8');
  const match = markdown.match(/`node (\S+verify-mobile-package-surface\.mjs) "?<[^>]+>"? (--detail)`/);
  assert.ok(match, '详情文档必须提供可执行的随包校验命令');
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'makeui installed skill '));
  t.after(() => fs.rmSync(installRoot, { recursive:true, force:true }));
  const skillRoot = path.join(installRoot, '.agents/skills/makeui');
  fs.cpSync(path.join(makeuiRoot, 'scripts'), path.join(skillRoot, 'scripts'), { recursive:true });
  const result = spawnSync(process.execPath, [match[1], detailPackage(t), match[2]], { cwd:skillRoot, encoding:'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /mobile package surface verified: 0\.1\.9/);
});
