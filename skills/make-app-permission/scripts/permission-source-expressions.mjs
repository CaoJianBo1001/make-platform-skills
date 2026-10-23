// A bounded expression reader, not a JavaScript evaluator. Unknown atoms remain
// unknown; only supported boolean structure can establish a necessary gate.
export const identifier = String.raw`[A-Za-z_$][\w$]*`;
export const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Keep offsets and executable template interpolations. A slash inside a regex
// character class is never a comment delimiter. This is lexical masking, not
// a parser or an authorization proof; unknown expressions stay unknown below.
const lexicalCache = new Map();
function lexicalMasks(source) {
  if (lexicalCache.has(source)) return lexicalCache.get(source);
  const code = source.split(''), comments = source.split('');
  const blank = (start, end, comment = false) => {
    for (let i = start; i < end; i++) if (!/[\r\n]/.test(source[i])) {
      code[i] = ' ';
      if (comment) comments[i] = ' ';
    }
    if (!comment) code[start] = '_';
  };
  const regexEnd = start => {
    let inClass = false;
    for (let i = start + 1; i < source.length && !/[\r\n]/.test(source[i]); i++) {
      if (source[i] === '\\') { i++; continue; }
      if (source[i] === '[') inClass = true;
      else if (source[i] === ']') inClass = false;
      else if (source[i] === '/' && !inClass) {
        while (/[a-z]/i.test(source[i + 1] ?? '') && i + 1 < source.length) i++;
        return i + 1;
      }
    }
    return -1;
  };
  const contexts = [{ template: false, regexAllowed: true, previous: '', parens: [], braces: [] }];
  let i = 0;
  while (i < source.length) {
    const context = contexts.at(-1), ch = source[i], next = source[i + 1];
    if (context.template) {
      const start = i;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '`' || (source[i] === '$' && source[i + 1] === '{')) break;
        i++;
      }
      if (i > start) blank(start, i);
      if (source[i] === '`') { blank(i, ++i); contexts.pop(); }
      else if (i < source.length) {
        i += 2;
        contexts.push({ template: false, interpolation: true, regexAllowed: true, previous: '', parens: [], braces: [] });
      }
      continue;
    }
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && (next === '/' || next === '*')) {
      const start = i;
      if (next === '/') { while (i < source.length && !/[\r\n]/.test(source[i])) i++; }
      else { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; }
      blank(start, i, true); continue;
    }
    if (ch === '"' || ch === "'") {
      const start = i++;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i++] === ch) break;
      }
      blank(start, Math.min(i, source.length)); context.regexAllowed = false; context.previous = 'literal'; continue;
    }
    if (ch === '`') {
      blank(i, ++i); context.regexAllowed = false; context.previous = 'literal';
      contexts.push({ template: true }); continue;
    }
    if (ch === '/' && context.regexAllowed && context.previous !== '<') {
      const end = regexEnd(i);
      if (end >= 0) { blank(i, end); i = end; context.regexAllowed = false; context.previous = 'literal'; continue; }
    }
    if (/[A-Za-z_$\d]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[\w$]/.test(source[i])) i++;
      context.previous = source.slice(start, i);
      context.regexAllowed = /^(?:return|throw|case|delete|void|typeof|yield|await|in|of|instanceof|else|do)$/.test(context.previous);
      continue;
    }
    if (ch === '(') {
      context.parens.push(/^(?:if|while|for|with|switch|catch)$/.test(context.previous));
      context.regexAllowed = true;
    } else if (ch === ')') context.regexAllowed = context.parens.pop() ?? false;
    else if (ch === '{') {
      context.braces.push(context.previous === '=>' || context.previous === ')' || context.previous === 'else' || context.previous === 'try');
      context.regexAllowed = true;
    } else if (ch === '}') {
      if (context.interpolation && !context.braces.length) { contexts.pop(); i++; continue; }
      context.regexAllowed = context.braces.pop() ?? true;
    } else if (ch === ']') context.regexAllowed = false;
    else if ((ch === '+' || ch === '-') && next === ch) { context.previous = ch + ch; i += 2; continue; }
    else context.regexAllowed = ch !== '.';
    context.previous = ch === '>' && source[i - 1] === '=' ? '=>' : ch;
    i++;
  }
  const result = { code: code.join(''), comments: comments.join('') };
  if (lexicalCache.size >= 12) lexicalCache.delete(lexicalCache.keys().next().value);
  lexicalCache.set(source, result);
  return result;
}

export const stripComments = source => lexicalMasks(source).comments;

export function closingIndex(source, start) {
  return closingMaskIndex(codeMask(source), start);
}

function closingMaskIndex(source, start) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (')]}'.includes(ch)) {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

export function splitTopLevel(source, separator) {
  const mask = codeMask(source);
  const parts = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if ('([{'.includes(mask[i])) {
      const end = closingMaskIndex(mask,i);
      if (end < 0) return [source];
      i = end; continue;
    }
    if (mask.startsWith(separator,i)) {
      if (separator === '?' && ['?', '.'].includes(source[i + 1])) { i++; continue; }
      parts.push(source.slice(start,i).trim());
      i += separator.length - 1; start = i + 1;
    }
  }
  return [...parts,source.slice(start).trim()];
}

export function unwrap(source) {
  let value = source.trim();
  while (value.startsWith('(') && closingIndex(value,0) === value.length - 1) value = value.slice(1,-1).trim();
  return value;
}

export function parseCall(source) {
  const value = unwrap(source);
  const match = value.match(new RegExp(`^(${identifier}(?:\\.${identifier})*)\\s*\\(`));
  if (!match || closingIndex(value,match[0].length - 1) !== value.length - 1) return null;
  return {name:match[1], args:splitTopLevel(value.slice(match[0].length,-1),',')};
}

// Offsets are preserved when masking literals, so matches cannot come from
// comments/diagnostic strings. Returned arguments still retain real literals.
export function codeMask(source) {
  return lexicalMasks(source).code;
}

export function calls(source, namePattern) {
  const mask = codeMask(source);
  return [...mask.matchAll(new RegExp(`\\b(${namePattern})\\s*\\(`,'g'))].flatMap(match => {
    const open = match.index + match[0].length - 1;
    const end = closingIndex(source,open);
    if (end < 0) return [];
    return [{name:match[1],index:match.index,end:end + 1,args:splitTopLevel(source.slice(open + 1,end),',')}];
  });
}

export function declarations(source) {
  return [...codeMask(source).matchAll(new RegExp(`\\bconst\\s+(${identifier})\\s*=\\s*`,'g'))].map(match => {
    const start = match.index + match[0].length;
    const expression = splitTopLevel(source.slice(start),';')[0];
    return {name:match[1],expression,index:match.index,end:start + expression.length};
  });
}

function possibleTruths(source, atom) {
  const value = unwrap(source);
  const conditional = splitTopLevel(value,'?');
  if (conditional.length > 1) {
    if (conditional.length !== 2) return [true,false];
    const branches = splitTopLevel(conditional[1],':');
    if (branches.length !== 2) return [true,false];
    return possibleTruths(conditional[0],atom).flatMap(test => possibleTruths(branches[test ? 0 : 1],atom));
  }
  for (const operator of ['||','&&']) {
    const parts = splitTopLevel(value,operator);
    if (parts.length > 1) return [...new Set(parts.map(part=>possibleTruths(part,atom)).reduce((a,b)=>a.flatMap(x=>b.map(y=>operator === '&&' ? x && y : x || y))))];
  }
  if (value.startsWith('!') && !value.startsWith('!=')) return possibleTruths(value.slice(1),atom).map(x=>!x);
  const call = parseCall(value);
  if (call?.name === 'Boolean' && call.args.length === 1) return possibleTruths(call.args[0],atom);
  if (value === 'true') return [true];
  if (['false','null','undefined','0'].includes(value)) return [false];
  const known = atom(value);
  return known === undefined ? [true,false] : [known];
}

export function requiresGate(expression, matchesGate, knownTrue = []) {
  // A false/unknown expression with no occurrence of the gate is not evidence
  // that this particular permission is consumed.
  let seen = false;
  const outcomes = possibleTruths(expression, value => {
    if (matchesGate(value)) { seen = true; return false; }
    if (knownTrue.includes(value)) return true;
    return undefined;
  });
  return seen && !outcomes.includes(true);
}

export function deniesWithoutGate(expression, gate, knownTrue = []) {
  return possibleTruths(expression, value => value === gate ? false : knownTrue.includes(value) ? true : undefined).every(Boolean);
}
