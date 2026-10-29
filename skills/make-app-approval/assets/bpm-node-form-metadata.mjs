// Service 纯转换参考：不发请求、不读取权限、不解包信封、不修改原响应。
import { isDeepStrictEqual } from 'node:util';

const fieldTypes = Object.freeze({
  ID: 'Make.Field.ID', TEXT: 'Make.Field.Text', TEXT_AREA: 'Make.Field.TextArea', URL: 'Make.Field.URL',
  NUMBER: 'Make.Field.Number', CURRENCY: 'Make.Field.Currency', PERCENT: 'Make.Field.Percent',
  DATE: 'Make.Field.Date', DATE_TIME: 'Make.Field.DateTime', DATE_RANGE: 'Make.Field.DateRange',
  SINGLE_SELECT: 'Make.Field.SingleSelect', MULTI_SELECT: 'Make.Field.MultiSelect',
  SINGLE_USER: 'Make.Field.SingleUser', MULTI_USER: 'Make.Field.MultiUser',
  SINGLE_DEPT: 'Make.Field.SingleDepartment', MULTI_DEPT: 'Make.Field.MultiDepartment',
  FILE: 'Make.Field.File', LOOKUP: 'Make.Field.Lookup',
});
export const isBpmFieldType = value => typeof value === 'string' && Object.values(fieldTypes).includes(value);
const propertyKeys = Object.freeze({
  ID: 'encoding', NUMBER: 'number', CURRENCY: 'currency', PERCENT: 'percent',
  DATE: 'date', DATE_TIME: 'date', DATE_RANGE: 'date',
  SINGLE_USER: 'person', MULTI_USER: 'person', SINGLE_DEPT: 'dept', MULTI_DEPT: 'dept',
  FILE: 'file', LOOKUP: 'lookup',
});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;

export class BpmNodeFormMetadataError extends Error {
  constructor(path, reason) {
    super(`审批节点元数据 ${path} ${reason}`);
    this.name = 'BpmNodeFormMetadataError';
    this.code = 'BPM_NODE_FORM_METADATA_INVALID';
    this.status = 502;
    this.path = path;
  }
}
const invalid = (path, reason = '缺失或无效') => { throw new BpmNodeFormMetadataError(path, reason); };
const requireObject = (value, path) => { if (!object(value)) invalid(path); };
const requireText = (value, path) => { if (!text(value)) invalid(path); };

const readAlias = (source, primary, alias, path) => {
  for (const key of [primary, alias]) if (source[key] !== undefined) requireText(source[key], `${path}.${key}`);
  if (source[primary] !== undefined && source[alias] !== undefined && source[primary] !== source[alias]) {
    invalid(`${path}.${primary}/${alias}`, '不一致');
  }
  const value = source[primary] ?? source[alias];
  requireText(value, `${path}.${primary}/${alias}`);
  return value;
};

const readType = (source, path) => {
  const enumType = source.makeFieldType;
  if (enumType !== undefined && !text(enumType)) invalid(`${path}.makeFieldType`);
  const mapped = text(enumType) && Object.hasOwn(fieldTypes, enumType) ? fieldTypes[enumType] : undefined;
  if (enumType !== undefined && !mapped) invalid(`${path}.makeFieldType`, '尚未适配此类型');
  if (typeof source.type === 'string') {
    const known = Object.entries(fieldTypes).find(([, value]) => value === source.type);
    if (!known) invalid(`${path}.type`, '尚未适配此类型');
    if (mapped !== undefined && mapped !== source.type) invalid(`${path}.type/makeFieldType`, '不一致');
    return { type: source.type, enumType: known[0] };
  }
  if (source.type !== undefined && !Number.isFinite(source.type)) invalid(`${path}.type`);
  if (!mapped) invalid(`${path}.makeFieldType`);
  return { type: mapped, enumType };
};

const mergeConfig = (properties, config, path) => {
  for (const key of Object.keys(config)) {
    if (Object.hasOwn(properties, key) && !isDeepStrictEqual(properties[key], config[key])) {
      invalid(`${path}.${key}`, '与类型专用配置不一致');
    }
  }
  return { ...properties, ...config };
};

const requireOptions = (options, path) => {
  if (!Array.isArray(options)) invalid(path);
  for (const [index, option] of options.entries()) {
    requireObject(option, `${path}[${index}]`);
    requireText(option.label, `${path}[${index}].label`);
    requireText(option.value, `${path}[${index}].value`);
  }
};

export function normalizeBpmField(source, index = 0) {
  const path = `data.fields[${index}]`;
  requireObject(source, path);
  const key = readAlias(source, 'key', 'fieldKey', path);
  const name = readAlias(source, 'name', 'fieldName', path);
  const { type, enumType } = readType(source, path);
  for (const key of ['properties', 'validations', 'capabilities']) {
    if (source[key] !== undefined) requireObject(source[key], `${path}.${key}`);
  }
  let properties = { ...source.properties };
  const bucket = propertyKeys[enumType];
  if (bucket && source[bucket] !== undefined) {
    requireObject(source[bucket], `${path}.${bucket}`);
    properties = mergeConfig(properties, source[bucket], `${path}.properties`);
  }
  if (enumType === 'SINGLE_SELECT' || enumType === 'MULTI_SELECT') {
    if (source.selection !== undefined) {
      requireObject(source.selection, `${path}.selection`);
      requireOptions(source.selection.fieldSelections, `${path}.selection.fieldSelections`);
      properties = mergeConfig(properties, { options: source.selection.fieldSelections }, `${path}.properties`);
    }
    requireOptions(properties.options, `${path}.properties.options`);
  }
  // 不按已知键白名单重建字段，扩展配置、校验及原始专用属性全部保留。
  return { ...source, key, name, type, properties };
}

export function normalizeBpmNodeFormMetadata(data, expected) {
  requireObject(expected, 'expected');
  if (!['START', 'TASK'].includes(expected.scene)) invalid('expected.scene');
  const required = expected.scene === 'START' ? ['appKey', 'entityKey', 'processKey', 'nodeKey'] : ['appKey', 'entityKey'];
  for (const key of required) requireText(expected[key], `expected.${key}`);
  requireObject(data, 'data');
  for (const key of ['appKey', 'entityKey', 'processKey', 'nodeKey', 'nodeName']) requireText(data[key], `data.${key}`);
  for (const key of ['appKey', 'entityKey', 'processKey', 'nodeKey']) {
    if (expected[key] !== undefined) {
      requireText(expected[key], `expected.${key}`);
      if (expected[key] !== data[key]) invalid(`data.${key}`, '与已授权上下文不匹配');
    }
  }
  if (!Array.isArray(data.fields)) invalid('data.fields');
  const keys = new Set();
  const fields = data.fields.map((source, index) => {
    const field = normalizeBpmField(source, index);
    if (keys.has(field.key)) invalid(`data.fields[${index}].key`, '重复');
    keys.add(field.key);
    return field;
  });
  return { ...data, fields };
}
