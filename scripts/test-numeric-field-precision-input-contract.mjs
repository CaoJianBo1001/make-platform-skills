#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  validateNumericPrecisionInput,
} from './lib/numeric-field-precision-contract.mjs';

for (const testCase of [
  { rawText: '0', maxDecimalPlaces: 0, decimalPlaces: 0 },
  { rawText: '-12.30', maxDecimalPlaces: 2, decimalPlaces: 2 },
  { rawText: '+.5', maxDecimalPlaces: 1, decimalPlaces: 1 },
  { rawText: '85.00', maxDecimalPlaces: 2, decimalPlaces: 2 },
]) {
  assert.deepEqual(
    validateNumericPrecisionInput(testCase.rawText, testCase.maxDecimalPlaces),
    {
      valid: true,
      code: 'valid',
      rawText: testCase.rawText,
      normalizedText: testCase.rawText,
      decimalPlaces: testCase.decimalPlaces,
      maxDecimalPlaces: testCase.maxDecimalPlaces,
    },
  );
}

for (const testCase of [
  { rawText: '1.230', maxDecimalPlaces: 2, decimalPlaces: 3 },
  { rawText: '-3.005', maxDecimalPlaces: 2, decimalPlaces: 3 },
  { rawText: '0.001', maxDecimalPlaces: 2, decimalPlaces: 3 },
]) {
  assert.deepEqual(
    validateNumericPrecisionInput(testCase.rawText, testCase.maxDecimalPlaces),
    {
      valid: false,
      code: 'decimal-overflow',
      rawText: testCase.rawText,
      decimalPlaces: testCase.decimalPlaces,
      maxDecimalPlaces: testCase.maxDecimalPlaces,
    },
  );
}

for (const rawText of ['1e-3', '85%', '¥1.00', '1,000.00', '1.', '--1']) {
  assert.deepEqual(
    validateNumericPrecisionInput(rawText, 2),
    {
      valid: false,
      code: 'invalid-format',
      rawText,
      maxDecimalPlaces: 2,
    },
  );
}

assert.deepEqual(validateNumericPrecisionInput('', 2), {
  valid: true,
  code: 'empty',
  rawText: '',
  normalizedText: '',
  maxDecimalPlaces: 2,
});

assert.deepEqual(validateNumericPrecisionInput(' 1.20 ', 2), {
  valid: true,
  code: 'valid',
  rawText: ' 1.20 ',
  normalizedText: '1.20',
  decimalPlaces: 2,
  maxDecimalPlaces: 2,
});

assert.deepEqual(validateNumericPrecisionInput('   ', 2), {
  valid: true,
  code: 'empty',
  rawText: '   ',
  normalizedText: '',
  maxDecimalPlaces: 2,
});

assert.deepEqual(validateNumericPrecisionInput(1.23, 2), {
  valid: false,
  code: 'raw-text-required',
  rawText: 1.23,
  maxDecimalPlaces: 2,
});

for (const maxDecimalPlaces of [-1, 1.5, Number.NaN, '2']) {
  assert.deepEqual(
    validateNumericPrecisionInput('1.23', maxDecimalPlaces),
    {
      valid: false,
      code: 'invalid-decimal-limit',
      rawText: '1.23',
      maxDecimalPlaces,
    },
  );
}

console.log('numeric field precision input contract passed');
