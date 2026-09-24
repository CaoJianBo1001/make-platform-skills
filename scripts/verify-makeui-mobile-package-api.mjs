#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packageRootArgument = process.argv[2];
assert.ok(
  packageRootArgument,
  'usage: node verify-makeui-mobile-package-api.mjs <installed-package-root>',
);

const packageRoot = path.resolve(packageRootArgument);
const read = (relativePath) => fs.readFileSync(path.join(packageRoot, relativePath), 'utf8');
const packageJson = JSON.parse(read('package.json'));

const versionTuple = packageJson.version.split('.').map(Number);
assert.ok(
  versionTuple[0] > 0 || versionTuple[1] > 1 || (versionTuple[1] === 1 && versionTuple[2] >= 7),
  `expected @qfei-design/make-app-mobile >= 0.1.7, received ${packageJson.version}`,
);
assert.equal(packageJson.name, '@qfei-design/make-app-mobile');
assert.equal(packageJson.engines?.node, '>=22.12.0');
for (const publicEntry of ['.', './fields', './presentation', './pickers', './primitives', './shell', './styles.css']) {
  assert.ok(packageJson.exports?.[publicEntry], `missing public export ${publicEntry}`);
}

const pickerTypes = read('dist/pickers/mobile-search-picker-sheet.d.ts');
assert.match(pickerTypes, /selectionMode\?:\s*"single"\s*\|\s*"multiple"/);
assert.match(pickerTypes, /onConfirm\?:\s*\(payload:\s*MobilePickerConfirmPayload\)/);
assert.match(pickerTypes, /selectedKeys:\s*readonly string\[\]/);
assert.match(pickerTypes, /selectedItems:\s*readonly MobilePickerItem\[\]/);

const pickerIndexTypes = read('dist/pickers/index.d.ts');
for (const exportName of ['MobileSearchPickerSheet', 'MobileOptionPickerSheet', 'MobileDateField', 'MobileDateRangeField']) {
  assert.match(pickerIndexTypes, new RegExp(`\\b${exportName}\\b`), `missing public picker API ${exportName}`);
}
const fieldIndexTypes = read('dist/fields/index.d.ts');
for (const exportName of ['MobileIdentityField', 'MobileAttachmentField']) {
  assert.match(fieldIndexTypes, new RegExp(`\\b${exportName}\\b`), `missing public field API ${exportName}`);
}
const identityFieldTypes = read('dist/fields/mobile-identity-field.d.ts');
assert.match(identityFieldTypes, /identityKind:\s*MobileIdentityKind/);
assert.match(identityFieldTypes, /selectionMode\?:\s*"single"\s*\|\s*"multiple"/);
assert.match(identityFieldTypes, /onChange:\s*\(value:\s*MobileIdentityValue/);
const attachmentFieldTypes = read('dist/fields/mobile-attachment-field.d.ts');
assert.match(attachmentFieldTypes, /onChooseFiles:\s*\(files:\s*readonly File\[\]\)/);
assert.match(attachmentFieldTypes, /onRemove:\s*\(item:\s*MobileAttachmentFieldItem\)/);
const dateFieldTypes = read('dist/pickers/mobile-date-fields.d.ts');
assert.match(dateFieldTypes, /begin\?:\s*Date/);
assert.match(dateFieldTypes, /end\?:\s*Date/);
assert.match(dateFieldTypes, /seconds\?:\s*boolean/);
assert.match(dateFieldTypes, /onChange\?:\s*\(value:\s*\[Dayjs,\s*Dayjs\]\s*\|\s*undefined\)/);
const optionPickerTypes = read('dist/pickers/mobile-option-picker-sheet.d.ts');
assert.match(optionPickerTypes, /selectionMode\?:\s*"single"\s*\|\s*"multiple"/);
const mobileStyles = read('dist/styles.css');
assert.match(mobileStyles, /width:\s*calc\(100%\s*-\s*8px\)/);
assert.match(mobileStyles, /margin-inline:\s*4px/);
assert.match(mobileStyles, /make-app-mobile-date-wheel-selection/);
assert.match(mobileStyles, /\.make-app-mobile-form-action-bar__submit[\s\S]*?background:\s*var\(--make-mobile-primary\)/);
assert.match(mobileStyles, /\.make-app-mobile-picker\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/);
assert.match(mobileStyles, /\.make-app-mobile-identity-field__tags/);
assert.match(mobileStyles, /\.make-app-mobile-attachment-field__card/);

const actionBarTypes = read('dist/primitives/mobile-bottom-action-bar.d.ts');
assert.match(actionBarTypes, /actions:\s*readonly MobileBottomAction\[\]/);
const formActionBarTypes = read('dist/primitives/mobile-form-action-bar.d.ts');
assert.match(formActionBarTypes, /MobileFormActionBarProps/);
assert.match(formActionBarTypes, /onSubmit:\s*\(\)\s*=>\s*void/);
const primitiveIndexTypes = read('dist/primitives/index.d.ts');
assert.match(primitiveIndexTypes, /MobileFormActionBar/);
const accountDrawerTypes = read('dist/shell/mobile-account-drawer.d.ts');
assert.match(accountDrawerTypes, /showLogout\?:\s*boolean/);
assert.match(accountDrawerTypes, /tenantName\?:\s*string/);

const rootModule = await import(pathToFileURL(path.join(packageRoot, 'dist/index.mjs')));
assert.deepEqual(
  [767, 768, 1199, 1200].map((containerWidth) =>
    rootModule.resolveMakeAppPresentationMode({ containerWidth })),
  ['mobile', 'tablet', 'tablet', 'desktop'],
);

const shellModule = await import(pathToFileURL(path.join(packageRoot, 'dist/shell.mjs')));
const navigation = shellModule.composeMobileBottomNavigationItems({
  assistant: { icon: null, key: 'assistant', label: 'AI 助手' },
  businessItems: ['one', 'two', 'three', 'four'].map((key) => ({ icon: null, key, label: key })),
  workbench: { icon: null, key: 'workbench', label: '工作台' },
});
assert.deepEqual(navigation.map(({ key }) => key), ['one', 'two', 'three', 'assistant', 'workbench']);

console.log(`makeui mobile package API verified: ${packageJson.version}`);
