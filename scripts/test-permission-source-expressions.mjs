import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeMask, stripComments, calls, splitTopLevel } from '../skills/make-app-permission/scripts/permission-source-expressions.mjs';

for (const literal of [
  String.raw`/^make:\/\/[^/*]+$/`,
  String.raw`/["'\x60/*]/g`,
  String.raw`/escaped\\\/[/*]/`,
]) test(`regex remains a literal: ${literal}`, () => {
  const source = `const pattern = ${literal};\nfunction allowed() { return check(access, "meta.field.read"); } // ignored`;
  assert.equal(stripComments(source).slice(0, source.indexOf(' // ignored')), source.slice(0, source.indexOf(' // ignored')));
  const masked = codeMask(source);
  assert.equal(masked.length, source.length);
  assert.match(masked, /function allowed\(\)/);
  assert.equal(calls(source, 'check').length, 1);
  assert.doesNotMatch(masked, /make|ignored|meta\.field\.read/);
});

test('regex diagnostic text and comments cannot create executable calls', () => {
  const source = String.raw`const pattern = /canUseEntityOperation(access, entity, META_ENTITY_READ)/;
  const text = "canUseEntityOperation(access, entity, META_ENTITY_READ)";
  /* canUseEntityOperation(access, entity, META_ENTITY_READ) */`;
  assert.equal(calls(source, 'canUseEntityOperation').length, 0);
});

test('division and regex after control conditions keep following code', () => {
  const source = String.raw`const ratio = total / count / 2; if (ready) /[/*]/.test(value); check(ratio);`;
  assert.match(codeMask(source), /total \/ count \/ 2/);
  assert.equal(calls(source, 'check').length, 1);
});

test('template interpolation keeps code, including nested templates and regex', () => {
  const source = 'const text = `ignore /* ${check(/[/*]/, `inner ${read()}`)} end`; next();';
  assert.equal(calls(source, 'check|read|next').length, 3);
  assert.equal(stripComments(source), source);
  assert.equal(codeMask(source).length, source.length);
});

test('regex punctuation does not split call arguments or boolean expressions', () => {
  assert.deepEqual(calls('check(/[(),;{}]/, value)', 'check')[0].args, ['/[(),;{}]/', 'value']);
  assert.deepEqual(splitTopLevel('matches(/[|&?:]/) && gate', '&&'), ['matches(/[|&?:]/)', 'gate']);
});

test('comments preserve offsets and line breaks without hiding the next file', () => {
  const source = '/* note\n*/\ncheck(value); // tail';
  assert.equal(stripComments(source).length, source.length);
  assert.equal(calls(source, 'check')[0].index, source.indexOf('check'));
  codeMask('/* unfinished');
  assert.equal(calls('check(value)', 'check').length, 1);
});
