const labels = new Map([
  ['UNSUBMITTED', '未提交'], ['IN_APPROVAL', '审批中'], ['APPROVED', '已通过'],
  ['REJECTED', '已拒绝'], ['RETURNING', '退回中'], ['CANCELLED', '已撤回'],
]);
/**
 * 流程状态名称；不用于时间线 actionResult，且不改变任何动作或写入资格。
 * @param {unknown} value
 * @param {(value: unknown) => import('@qfei-design/make-app-approval').ApprovalStatusDisplay} getApprovalStatusDisplay
 * @returns {import('@qfei-design/make-app-approval').ApprovalStatusDisplay}
 */
export function formatApprovalProcessStatus(value, getApprovalStatusDisplay) {
  const display = getApprovalStatusDisplay(value);
  const label = typeof value === 'string' ? labels.get(value) : undefined;
  return label ? { ...display, label } : display;
}
