// Recognize direct Node commands, not arbitrary shell wrappers or npm scripts.
export function hasDirectCiNodeCommand(workflow, script) {
  const escaped = script.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const flags = '(?:[\\t ]+--(?!(?:eval|print|check|require|import|run)(?:[=\\t ]|$))[\\w-]+(?:=[^\\t \\r\\n]+)?)*';
  return new RegExp(
    `^[\\t ]*(?:(?:-[\\t ]+)?run:[\\t ]*)?node${flags}[\\t ]+(["']?)${escaped}\\1(?=[\\t ;\\r\\n]|$)`,
    'mu',
  ).test(workflow);
}
