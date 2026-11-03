// 仅组合展示插槽；授权、草稿、校验、请求及提交状态机仍由审批包与宿主原链路拥有。
/**
 * @typedef {import('@qfei-design/make-app-approval/detail').ApprovalDetailLayoutSlots} ApprovalSlots
 * @typedef {import('react').ReactNode} ReactNode
 * @typedef {{
 *   content: ReactNode,
 *   sections: { key: string, label: string, content: ReactNode }[],
 *   opinion: ReactNode,
 *   feedback: ReactNode,
 *   actions: import('@qfei-design/make-app-mobile/primitives').MobileFormAction[]
 * }} MobileLayout
 */
/**
 * @overload
 * @param {ApprovalSlots} slots
 * @param {{presentation: 'mobile', hasFieldErrors?: boolean}} options
 * @returns {MobileLayout}
 */
/**
 * @overload
 * @param {ApprovalSlots} slots
 * @param {{presentation?: 'desktop' | 'tablet', hasFieldErrors?: boolean}} [options]
 * @returns {ApprovalSlots}
 */
/**
 * @param {ApprovalSlots} slots
 * @param {{presentation?: 'desktop' | 'tablet' | 'mobile', hasFieldErrors?: boolean}} [options]
 * @returns {ApprovalSlots | MobileLayout}
 */
export function composeApprovalTaskLayout(slots, { presentation = 'desktop', hasFieldErrors = false } = {}) {
  if (presentation !== 'mobile') return slots;
  if (!slots.sections) {
    return { content: slots.content, sections: [], opinion: null, feedback: null, actions: [] };
  }

  const { application, history, opinion, feedback } = slots.sections;
  return {
    content: null,
    sections: [
      { key: 'application', label: '审批详情', content: application },
      ...(history == null || typeof history === 'boolean' ? [] : [{ key: 'history', label: '审批记录', content: history }]),
    ],
    opinion,
    feedback,
    actions: (slots.actionItems ?? []).map((item) => ({
      key: item.actionType,
      label: item.label,
      onClick: item.onClick,
      loading: item.loading,
      disabled: item.disabled || item.loading || (hasFieldErrors && item.actionType !== 'RETURN'),
      variant: item.actionType === 'APPROVE' || item.actionType === 'SUBMIT' ? 'primary' : 'default',
    })),
  };
}
