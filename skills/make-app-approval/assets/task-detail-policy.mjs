// raw must already contain located metadata, normalized Workflow permission
// enums, and visible-only fields/formData. Pass the SDK's public decoder.
export function readTaskDetailWithPolicy(raw, readApprovalTaskDetail) {
  // Validate ORIGINAL permissions/actions first; do not conceal a malformed
  // response by replacing editPermission before the SDK checks it.
  const detail = readApprovalTaskDetail(raw);
  // Verified SDK 0.2.11 still drops taskStatus and uses editPermission to render editors.
  // actions=[] alone does not prevent editing. Read status from the wire task.
  if (raw.taskStatus === 'PENDING' && detail.actions.length > 0) return detail;
  return {
    ...detail,
    fieldPermission: {...detail.fieldPermission, editPermission: {scope:'NONE'}},
    actions: [],
  };
}
