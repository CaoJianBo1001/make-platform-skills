// Bounded source checks only. Dynamic props and helper calls are not behavioral proof.
export function auditAdministratorFeedback(sources) {
  const failures = [];
  let detected = false;
  for (const { file, source } of sources) {
    const code = maskNonCode(source);
    const importSource = maskNonCode(source, true);
    const names = new Set();
    const imports = /\b(import|export)\s+([\w$,*{}\s]+?)\s+from\s*(['"])@qfei-design\/make-app-observability\/react\3/gu;
    for (const match of importSource.matchAll(imports)) {
      if (code.slice(match.index, match.index + match[1].length) !== match[1]) continue;
      const selected = match[2].match(/(?:\{|,)\s*MakeAppPermissionNotice(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*(?=,|\})/u);
      if (selected && !/^\s*type\b/u.test(match[2])) {
        detected = true;
        names.add(selected[1] ?? 'MakeAppPermissionNotice');
      }
      const namespace = match[2].match(/\*\s+as\s+([A-Za-z_$][\w$]*)/u)?.[1];
      if (namespace && new RegExp(`\\b${escape(namespace)}\\.MakeAppPermissionNotice\\b`, 'u').test(code)) {
        detected = true;
        names.add(`${namespace}.MakeAppPermissionNotice`);
      }
    }
    for (const name of names) {
      const tags = new RegExp(`<${escape(name)}\\b`, 'gu');
      for (const match of code.matchAll(tags)) {
        const attributes = openingAttributes(code, match.index + match[0].length);
        if (attributes === undefined) continue;
        const spread = /\{\s*\.\.\./u.test(attributes);
        if (!/\badministrators\s*=/u.test(attributes) && !spread) {
          failures.push(`administrator_feedback_contacts_missing: ${file}: ${name} must receive contacts through the production host adapter`);
        } else if (!spread && /\badministrators\s*=\s*\{\s*(?:\[\s*\]|undefined|null)\s*\}/u.test(attributes)) {
          failures.push(`administrator_feedback_contacts_always_empty: ${file}: an unconditional empty prop cannot render embedded or queried contacts`);
        }
      }
    }
  }
  return { detected, failures };
}

function openingAttributes(code, start) {
  let depth = 0;
  for (let index = start; index < code.length; index++) {
    if (code[index] === '{') depth++;
    if (code[index] === '}') depth--;
    if (code[index] === '>' && depth === 0) return code.slice(start, index);
  }
}

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function maskNonCode(source, commentsOnly = false) {
  let state = 'code';
  let escaped = false;
  const chars = source.split('');
  for (let index = 0; index < chars.length; index++) {
    const current = source[index];
    const next = source[index + 1];
    const wasComment = state === 'line' || state === 'block';
    if (state === 'line' && current === '\n') state = 'code';
    if (state === 'code') {
      if (current === '/' && next === '/') state = 'line';
      else if (current === '/' && next === '*') state = 'block';
      else if (['"', "'", '`'].includes(current)) state = current;
      else continue;
    } else if (state === 'block' && current === '*' && next === '/') {
      chars[index] = chars[index + 1] = ' ';
      index++;
      state = 'code';
      continue;
    } else if (["'", '"', '`'].includes(state)) {
      if (escaped) escaped = false;
      else if (current === '\\') escaped = true;
      else if (current === state) state = 'code';
    }
    if (current !== '\n' && current !== '\r'
      && (!commentsOnly || wasComment || state === 'line' || state === 'block')) chars[index] = ' ';
  }
  return chars.join('');
}
