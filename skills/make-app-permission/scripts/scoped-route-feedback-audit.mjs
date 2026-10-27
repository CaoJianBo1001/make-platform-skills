// A bounded static signal, not proof of the rendered tree. Runtime assertions remain required.
export function auditScopedRouteFeedback(sources) {
  const feedback = /<[A-Z][\w.]*\b[^>]*\bscope\s*=\s*(?:["']resource["']|\{[^}]*["']resource["'][^}]*\})[^>]*>/gu;
  const shell = /<([A-Z][\w.]*(?:Shell|Layout))\b[^>]*>([\s\S]*?)<\/\1\s*>/gu;
  const warnings = [];
  for (const { file, source } of sources) {
    const denials = [...source.matchAll(feedback)];
    if (!denials.length) continue;
    const localShells = [...source.matchAll(shell)];
    const component = file.split(/[/\\]/u).at(-1).replace(/\.[^.]+$/u, '');
    const parentShell = sources.some(parent => parent.file !== file
      && [...parent.source.matchAll(shell)].some(match => (
        new RegExp(`<${component}\\b`, 'u').test(match[2])
      )));
    if (parentShell) continue;
    if (denials.some(denial => !localShells.some(match => (
      denial.index >= match.index && denial.index < match.index + match[0].length
    )))) {
      warnings.push(`resource_route_shell_unverified: ${file}: resource feedback may replace the App shell; verify direct URL denial keeps navigation/header and makes zero protected requests`);
    }
  }
  return warnings;
}
