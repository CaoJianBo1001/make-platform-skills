/**
 * PC 历史表格和手机时间线共用；公共函数由宿主从审批包根入口传入。
 * @param {{processStatusAfter?: unknown}} event
 * @param {(value: unknown) => import('@qfei-design/make-app-approval').ApprovalStatusDisplay} getApprovalStatusDisplay
 * @returns {import('@qfei-design/make-app-approval').ApprovalStatusDisplay}
 */
export function formatApprovalHistoryResult(event, getApprovalStatusDisplay) {
  const display = getApprovalStatusDisplay(event.processStatusAfter);
  return event.processStatusAfter === 'RETURNING'
    ? { ...display, label: '退回修改' }
    : display;
}
