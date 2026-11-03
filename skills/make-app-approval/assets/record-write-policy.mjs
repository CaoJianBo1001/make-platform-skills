/**
 * 普通记录三终态兼容：保留审批包的原有限制，补齐已通过、已拒绝和已撤回只读。
 * 0.2.11 仅覆盖 APPROVED，REJECTED/CANCELLED 尚须本适配器；不假定新版已发布。
 * 不用于 Workflow 任务字段授权或删除；null 仍须通过宿主普通 IAM 检查。
 * @param {Readonly<Record<string, unknown>>} record 最新宿主记录
 * @param {typeof import('@qfei-design/make-app-approval').getRecordApprovalWriteRestriction} getPackageRestriction
 * @param {{ approvalEnabled?: boolean }} [options]
 */
export function getOrdinaryRecordWriteRestriction(record, getPackageRestriction, options) {
  const original = getPackageRestriction(record, options);
  if (original != null) return original;
  switch (record.qfei_process_instance_status) {
    case 'APPROVED': return { reason: 'approved', message: '该数据审批已通过，不可编辑' };
    case 'REJECTED': return { reason: 'ended', message: '该数据审批已拒绝，不可编辑' };
    case 'CANCELLED': return { reason: 'ended', message: '该数据审批已撤回，不可编辑' };
    default: return null;
  }
}
