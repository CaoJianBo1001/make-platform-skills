const PLAIN_DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * Executable oracle for the Make numeric-field raw-input precision contract.
 * Downstream form and cell adapters may implement an equivalent local helper,
 * but must preserve these observable results. `rawText` is diagnostic input;
 * only `normalizedText` is safe to parse or submit after a valid result.
 */
export function validateNumericPrecisionInput(rawText, maxDecimalPlaces) {
  if (!Number.isInteger(maxDecimalPlaces) || maxDecimalPlaces < 0) {
    return {
      valid: false,
      code: 'invalid-decimal-limit',
      rawText,
      maxDecimalPlaces,
    };
  }

  if (typeof rawText !== 'string') {
    return {
      valid: false,
      code: 'raw-text-required',
      rawText,
      maxDecimalPlaces,
    };
  }

  const candidate = rawText.trim();
  if (candidate.length === 0) {
    return {
      valid: true,
      code: 'empty',
      rawText,
      normalizedText: candidate,
      maxDecimalPlaces,
    };
  }

  if (!PLAIN_DECIMAL_PATTERN.test(candidate)) {
    return {
      valid: false,
      code: 'invalid-format',
      rawText,
      maxDecimalPlaces,
    };
  }

  const parsedValue = Number(candidate);
  if (!Number.isFinite(parsedValue)) {
    return {
      valid: false,
      code: 'invalid-format',
      rawText,
      maxDecimalPlaces,
    };
  }

  const decimalPlaces = candidate.includes('.')
    ? candidate.length - candidate.indexOf('.') - 1
    : 0;

  if (decimalPlaces > maxDecimalPlaces) {
    return {
      valid: false,
      code: 'decimal-overflow',
      rawText,
      decimalPlaces,
      maxDecimalPlaces,
    };
  }

  return {
    valid: true,
    code: 'valid',
    rawText,
    normalizedText: candidate,
    decimalPlaces,
    maxDecimalPlaces,
  };
}
