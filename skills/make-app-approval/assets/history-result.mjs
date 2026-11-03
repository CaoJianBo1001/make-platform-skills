/**
 * PC 历史表格与手机时间线共用；后端 actionResult 已是展示文本。
 * @param {{actionResult?: unknown}} event
 * @returns {string}
 */
export function formatApprovalHistoryResult(event) {
  return typeof event.actionResult === 'string' && event.actionResult.trim()
    ? event.actionResult
    : '-';
}
