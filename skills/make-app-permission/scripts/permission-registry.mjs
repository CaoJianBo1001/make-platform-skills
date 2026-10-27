// Documented data/meta keys for Make App consumers; not the platform-wide registry.
// This dictionary validates names only. It does not configure permissions or grant access.
// Source: AgenticDSL Design/PermissionDesign.md, data/meta entries in the built-in table.
// https://git.qtech.cn/make/AgenticDSL/-/blob/main/Design/PermissionDesign.md
export const registeredPermissionKeys = Object.freeze([
  "meta.app.create",
  "meta.app.read",
  "meta.app.update",
  "meta.app.delete",
  "meta.entity.create",
  "meta.entity.read",
  "meta.entity.update",
  "meta.entity.delete",
  "meta.field.create",
  "meta.field.read",
  "meta.field.update",
  "meta.field.delete",
  "meta.schema.read",
  "data.record.create",
  "data.record.read",
  "data.record.update",
  "data.record.delete",
  "data.record.bulkUpdate",
  "data.record.export",
  "data.file.create",
  "data.file.get",
  "data.file.delete",
  "data.file.download"
]);
const registered = new Set(registeredPermissionKeys);
export const isRegisteredPermission = key => typeof key === 'string' && registered.has(key);
export const matchesRegisteredPermission = (pattern, requested) => {
  if (!isRegisteredPermission(requested) || typeof pattern !== 'string') return false;
  if (!/^(?:[A-Za-z][\w-]*|\*)(?:\.(?:[A-Za-z][\w-]*|\*)){2}$/.test(pattern)) return false;
  const parts = requested.split('.');
  return pattern.split('.').every((part, index) => part === '*' || part === parts[index]);
};
