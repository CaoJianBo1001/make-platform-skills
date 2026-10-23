// A bounded expression reader, not a JavaScript evaluator. Unknown atoms remain
// unknown; only supported boolean structure can establish a necessary gate.
export const identifier = String.raw`[A-Za-z_$][\w$]*`;
export const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const stripComments = source => source.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (whole, literal) => literal ?? ' ');

function quoteEnd(source, start) {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '\\') i++;
    else if (source[i] === source[start]) return i;
  }
  return source.length;
}

export function closingIndex(source, start) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if ('\'"`'.includes(ch)) { i = quoteEnd(source, i); continue; }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (')]}'.includes(ch)) {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

export function splitTopLevel(source, separator) {
  const parts = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if ('\'"`'.includes(source[i])) { i = quoteEnd(source,i); continue; }
    if ('([{'.includes(source[i])) {
      const end = closingIndex(source,i);
      if (end < 0) return [source];
      i = end; continue;
    }
    if (source.startsWith(separator,i)) {
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
  return source.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, text => text.replace(/[^\n]/g,' '));
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
