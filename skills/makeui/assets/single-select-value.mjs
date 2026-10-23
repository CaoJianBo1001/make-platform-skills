// Reference adapter for the observed SingleSelect Data/Workflow wire shape.
// Reuse the host's existing field registry; do not install a second form store.
const selected = raw => Array.isArray(raw) ? raw[0] : raw;

export function singleSelectFormValue(raw) {
  const item = selected(raw);
  if (item == null || item === '') return undefined;
  if (typeof item !== 'object') return item;
  if (!Object.hasOwn(item, 'value')) throw new TypeError('SingleSelect option requires value');
  return item.value == null || item.value === '' ? undefined : item.value;
}

export function singleSelectSubmitValue(raw, emptyValue) {
  // The host supplies its confirmed clear value (e.g. null); default undefined
  // matches omission. Never infer clear semantics from a display-only fixture.
  return singleSelectFormValue(raw) ?? emptyValue;
}

export function singleSelectLabel(raw, options = []) {
  const value = singleSelectFormValue(raw);
  if (value === undefined) return '-';
  const configured = options.find(option => option.value === value);
  const item = selected(raw);
  return String(configured?.label ?? (typeof item === 'object' ? item?.label : undefined) ?? value);
}
