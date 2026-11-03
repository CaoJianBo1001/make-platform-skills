// 节点 Lookup 纯依赖解析：输入须先经过节点定位与字段规范化；不发请求、不读取权限或记录。
import { BpmNodeFormMetadataError, isBpmFieldType, normalizeBpmNodeFormMetadata } from './bpm-node-form-metadata.mjs';
const text = value => typeof value === 'string' && Boolean(value.trim());
const invalid = (path, reason = '缺失或无效') => { throw new BpmNodeFormMetadataError(path, reason); };
export function resolveBpmLookupDependencies(metadata, fieldKeys) {
  if (!metadata || !text(metadata.appKey) || !text(metadata.entityKey) || !Array.isArray(metadata.fields)
    || !Array.isArray(fieldKeys) || fieldKeys.some(key => !text(key))) invalid('metadata/fieldKeys');
  const targets = new Map();
  return [...new Set(fieldKeys)].flatMap(fieldKey => {
    const fields = metadata.fields.filter(field => field.key === fieldKey);
    if (fields.length !== 1) invalid(`fields.${fieldKey}`, '缺失或重复');
    const field = fields[0];
    if (field.type !== 'Make.Field.Lookup') return [];
    const { relationKey, targetFieldKey, targetFieldType } = field.properties ?? {};
    if (!text(relationKey) || !text(targetFieldKey) || !isBpmFieldType(targetFieldType)) invalid(`fields.${fieldKey}.lookup`);
    const relations = Array.isArray(metadata.relations) ? metadata.relations.filter(relation => relation?.key === relationKey) : [];
    const relation = relations[0], { from, to } = relation?.properties ?? {};
    if (relations.length !== 1 || (relation.appKey !== undefined && relation.appKey !== metadata.appKey)
      || (relation.type !== undefined && relation.type !== 'Make.Relation')
      || !from || !to || !text(from.entityKey) || !text(to.entityKey)
      || !['one', 'many'].includes(from.cardinality) || !['one', 'many'].includes(to.cardinality)) invalid(`relations.${relationKey}`);
    // 与既有 Make 关系适配器一致：当前对象在 from 时取 to，否则取 from；自关联也按此方向。
    const target = from.entityKey === metadata.entityKey ? to : to.entityKey === metadata.entityKey ? from : undefined;
    if (!target) invalid(`relations.${relationKey}`, '与源对象不匹配');
    const identity = JSON.stringify([target.entityKey, targetFieldKey]);
    const original = target.entityKey === metadata.entityKey ? metadata.fields.find(item => item.key === targetFieldKey) : undefined;
    if ((targets.has(identity) && targets.get(identity) !== targetFieldType) || (original && original.type !== targetFieldType)) invalid(`fields.${fieldKey}.targetFieldType`, '冲突');
    targets.set(identity, targetFieldType);
    return [{ fieldKey, relationKey, targetEntityKey: target.entityKey, targetFieldKey, targetFieldType, multiple: target.cardinality === 'many' }];
  });
}

// 仅判断同一次 START 编排内的已有成功资料；不是跨请求缓存或上游错误恢复策略。
export function canReuseBpmStartMetadata(data, expected, fieldKeys) {
  if (expected?.scene !== 'START') invalid('expected.scene', '必须为 START');
  if (!Array.isArray(fieldKeys) || fieldKeys.some(key => !text(key))) invalid('fieldKeys');
  try {
    const metadata = normalizeBpmNodeFormMetadata(data, expected);
    resolveBpmLookupDependencies(metadata, fieldKeys);
    return true;
  } catch (error) {
    if (!(error instanceof BpmNodeFormMetadataError) || error.path.startsWith('expected')) throw error;
    return false;
  }
}
