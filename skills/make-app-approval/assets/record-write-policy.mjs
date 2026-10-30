/**
 * 旧包兼容：保留审批包的基础限制，再补充 APPROVED 只读。
 * 0.2.11 已提供相同规则，升级并核验实际产物后直接复用包函数，无需复制此适配器。
 * 不用于 Workflow 任务字段授权；null 仍须通过宿主普通 IAM 检查。
 * @param {Readonly<Record<string, unknown>>} record 最新宿主记录
 * @param {typeof import('@qfei-design/make-app-approval').getRecordApprovalWriteRestriction} getPackageRestriction
 * @param {{ approvalEnabled?: boolean }} [options]
 */
export function getOrdinaryRecordWriteRestriction(record, getPackageRestriction, options) {
  return getPackageRestriction(record, options) ?? (
    record.qfei_process_instance_status === 'APPROVED'
      ? { reason: 'approved', message: '该数据审批已通过，不可编辑' }
      : null
  );
}
