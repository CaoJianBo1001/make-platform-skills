import { calls, closingIndex, codeMask, declarations, escapePattern, identifier, parseCall, requiresGate, splitTopLevel, stripComments, unwrap } from './permission-source-expressions.mjs';

export const defaultCreateCalls = [
  {name:'createRecord',argument:0},
  {name:'createMakeEntityRecord',argument:0,property:'data'},
];

function scopeAt(source,index) {
  const stack = [];
  for (let i=0;i<index;i++) {
    if (source[i] === '{') stack.push(i);
    if (source[i] === '}') stack.pop();
  }
  return stack;
}
const containsScope = (parent,child) => parent.every((value,index)=>child[index] === value);
const singleIdentifier = value => new RegExp(`^${identifier}$`).test(value);
const propertyValue = (expression,property) => {
  const value = unwrap(expression);
  if (!value.startsWith('{') || closingIndex(value,0) !== value.length - 1) return null;
  const entries = splitTopLevel(value.slice(1,-1),',');
  // Spreads/computed keys can overwrite the authorized property.
  if (entries.some(entry=>entry.startsWith('...') || entry.startsWith('['))) return null;
  const matches = entries.flatMap(entry=>{
    const pair = splitTopLevel(entry,':');
    return pair[0] === property ? [pair.length === 1 ? property : pair.slice(1).join(':')] : [];
  });
  return matches.length === 1 ? matches[0] : null;
};

function parameterShadows(source,name,parentScope,currentScope,start,at) {
  // Concise arrow callbacks have no body brace and therefore are absent from
  // the lexical scope stack. Do not borrow a previous const through that binding.
  const arrows = new RegExp(`(?:\\b${escapePattern(name)}|\\([^()]*\\b${escapePattern(name)}\\b[^()]*\\))\\s*=>`, 'g');
  for (const match of source.slice(start,at).matchAll(arrows)) {
    let cursor = start + match.index + match[0].length;
    while (/\s/.test(source[cursor] ?? '') && cursor < at) cursor++;
    const block = source[cursor] === '{';
    for (;cursor < at;cursor++) {
      if ('([{'.includes(source[cursor])) {
        const end = closingIndex(source,cursor);
        if (end < 0 || at <= end) return true;
        if (block) break;
        cursor = end;
      } else if (',;)]}'.includes(source[cursor])) break;
    }
    if (cursor >= at) return true;
  }
  return currentScope.slice(parentScope.length).some(brace=>{
    const prefix = source.slice(0,brace).trimEnd().replace(/=>\s*$/,'').trimEnd();
    if (!prefix.endsWith(')')) return false;
    let depth = 1, open = prefix.length - 2;
    for (;open >= 0;open--) {
      if (prefix[open] === ')') depth++;
      if (prefix[open] === '(' && --depth === 0) break;
    }
    return open >= 0 && !/\b(?:if|for|while|switch|with)\s*$/.test(prefix.slice(0,open))
      && splitTopLevel(prefix.slice(open + 1,-1),',').some(param=>param.split(/[:=]/)[0].trim() === name);
  });
}

// Read a local member chain, including optional/computed access. Calls and
// arbitrary expressions are deliberately not followed across functions.
function memberChain(source,start) {
  let end = start;
  const members = [];
  while (end < source.length) {
    const tail = source.slice(end);
    const dot = tail.match(/^\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/);
    if (dot) { members.push(dot[1]); end += dot[0].length; continue; }
    const bracket = tail.match(/^\s*(?:\?\.\s*)?\[/);
    if (!bracket) break;
    const open = end + bracket[0].length - 1, close = closingIndex(source,open);
    if (close < 0) break;
    const key = source.slice(open + 1,close).trim();
    members.push(key.match(/^['"]([A-Za-z_$][\w$]*)['"]$/)?.[1] ?? null);
    end = close + 1;
  }
  return {end,members};
}

function mutatedBeforeUse(source,name,start,end) {
  const mask = codeMask(source), definitions = declarations(source);
  const root = definitions.find(item=>item.name === name && item.end === start);
  if (!root) return true;
  // Key by declaration, not name: a later same-name local must not erase an
  // earlier alias. Depth 2 means a shallow copy shares children, not own slots.
  const aliases = new Map([[root.index,0]]);
  const visible = (name,at) => {
    const scope = scopeAt(mask,at);
    const found = definitions.filter(item=>item.name === name && item.end < at && containsScope(scopeAt(mask,item.index),scope)).at(-1);
    return found && !parameterShadows(mask,name,scopeAt(mask,found.index),scope,found.end,at) ? found : null;
  };
  const reference = (expression,at) => {
    const value = unwrap(expression), name = value.match(new RegExp(`^(${identifier})\\b`))?.[1];
    if (!name) return null;
    const chain = memberChain(value,name.length), binding = visible(name,at);
    if (value.slice(chain.end).trim() || !binding || !aliases.has(binding.index)) return null;
    return {depth:chain.members.length,minimum:aliases.get(binding.index)};
  };
  for (const declaration of definitions) {
    if (declaration.index <= start || declaration.end >= end) continue;
    const direct = reference(declaration.expression,declaration.index);
    if (direct) { aliases.set(declaration.index,Math.max(0,direct.minimum - direct.depth)); continue; }
    const value = unwrap(declaration.expression);
    if (!value.startsWith('{') || closingIndex(value,0) !== value.length - 1) continue;
    const shared = splitTopLevel(value.slice(1,-1),',').filter(entry=>entry.startsWith('...'))
      .map(entry=>reference(entry.slice(3),declaration.index)).filter(Boolean);
    if (shared.length) aliases.set(declaration.index,Math.min(...shared.map(item=>Math.max(2,item.minimum - item.depth))));
  }
  for (const declaration of definitions.filter(item=>aliases.has(item.index))) {
    const minimum = aliases.get(declaration.index);
    for (const match of mask.slice(declaration.end,end).matchAll(new RegExp(`\\b${escapePattern(declaration.name)}\\b`,'g'))) {
      const at = declaration.end + match.index;
      if (/\bconst\s*$/.test(mask.slice(0,at))) continue;
      if (visible(declaration.name,at)?.index !== declaration.index) continue;
      const chain = memberChain(source,at + declaration.name.length), depth = chain.members.length;
      const tail = mask.slice(chain.end,end).trimStart();
      const assignment = /^(?:=(?!=|>)|(?:\?\?|&&|\|\||\*\*|[+?&|*/%^-])=|\+\+|--)/.test(tail);
      if (depth >= minimum && (assignment || /\bdelete\s*$/.test(mask.slice(0,at)))) return true;
      if (depth >= minimum && /^(?:add|delete|clear)$/.test(chain.members.at(-1) ?? '')
        && /^(?:\?\.\s*)?\(/.test(tail)) return true;
    }
  }
  return calls(source,'Object\\.(?:assign|defineProperty)').some(call=>{
    if (call.index <= start || call.index >= end) return false;
    const target = reference(call.args[0] ?? '',call.index);
    return target && target.depth + 1 >= target.minimum;
  });
}

function declaredFieldSet(source,name,at) {
  const mask = codeMask(source), scope = scopeAt(mask,at);
  const declaration = declarations(source).filter(item=>item.name === name && item.end < at && containsScope(scopeAt(mask,item.index),scope)).at(-1);
  return /creatable|create.*field|writable.*field/i.test(name) && Boolean(declaration
    && !parameterShadows(mask,name,scopeAt(mask,declaration.index),scope,declaration.end,at)
    && !mutatedBeforeUse(source,name,declaration.end,at));
}

function fieldCollectionProof(source,expression,at,trail = new Set()) {
  const value = unwrap(expression);
  if (trail.has(value) || trail.size > 16) return false;
  const next = new Set([...trail,value]);
  if (singleIdentifier(value)) {
    const mask = codeMask(source), scope = scopeAt(mask,at);
    const declaration = declarations(source).filter(item=>item.name === value && item.end < at && containsScope(scopeAt(mask,item.index),scope)).at(-1);
    return Boolean(declaration && !parameterShadows(mask,value,scopeAt(mask,declaration.index),scope,declaration.end,at)
      && !mutatedBeforeUse(source,value,declaration.end,at)
      && fieldCollectionProof(source,declaration.expression,declaration.index,next));
  }
  const call = parseCall(value);
  if (!call?.name.endsWith('.filter')) return false;
  const arrow = splitTopLevel(call.args[0],'=>');
  const field = unwrap(arrow[0] ?? '');
  if (arrow.length !== 2 || !singleIdentifier(field)) return false;
  return requiresGate(arrow[1],atom=>{
    const gate = parseCall(atom);
    return gate?.name.endsWith('.has') && gate.args.length === 1 && gate.args[0] === `${field}.key`
      && declaredFieldSet(source,gate.name.slice(0,-4),at);
  }) || fieldCollectionProof(source,call.name.slice(0,-7),at,next);
}

function localFieldProjection(source,call,at) {
  const mask = codeMask(source), scope = scopeAt(mask,at);
  const declaration = declarations(source).filter(item=>item.name === call.name && containsScope(scopeAt(mask,item.index),scope)).at(-1);
  if (!declaration) return false;
  const arrow = splitTopLevel(declaration.expression,'=>');
  if (arrow.length !== 2) return false;
  const parameters = splitTopLevel(unwrap(arrow[0]),',').map(param=>param.match(new RegExp(`^(${identifier})\\b`))?.[1]);
  const body = unwrap(arrow[1]);
  if (!body.startsWith('{') || closingIndex(body,0) !== body.length - 1) return false;
  const returned = body.slice(1,-1).trim().match(/^return\s+([\s\S]+?);?$/)?.[1];
  if (!returned) return false;
  const reducer = parseCall(returned.replace(/;\s*$/,'').replace(/\.reduce\s*<[^()]*>/,'.reduce'));
  if (!reducer?.name.endsWith('.reduce') || reducer.args.length !== 2 || reducer.args[1] !== '{}') return false;
  const fieldArgument = parameters.indexOf(reducer.name.slice(0,-7));
  if (fieldArgument < 0 || !fieldCollectionProof(source,call.args[fieldArgument] ?? '',at)) return false;
  const callback = splitTopLevel(reducer.args[0],'=>');
  const names = splitTopLevel(unwrap(callback[0] ?? ''),',');
  if (callback.length !== 2 || names.length !== 2 || !names.every(singleIdentifier)) return false;
  const [accumulator,field] = names.map(escapePattern);
  // A projection may only write accumulator[field.key] and return accumulator.
  // Any other reference (spread, extra property, alias, passing it to a helper)
  // is unsupported instead of being trusted because the helper has a nice name.
  const code = codeMask(callback[1]);
  if (new RegExp(`\\b${field}(?:\\.key)?\\s*=(?!=)|\\bObject\\.assign\\s*\\(\\s*${field}\\b`).test(code)) return false;
  const returns = [...code.matchAll(/\breturn\s+([^;{}]+)/g)];
  if (!returns.length || returns.some(([,value])=>value.trim() !== names[0])) return false;
  const writes = new RegExp(`\\b${accumulator}\\s*\\[\\s*${field}\\.key\\s*\\]\\s*=(?!=)`,'g');
  if (!writes.test(code)) return false;
  const remainder = code.replace(writes,'').replace(new RegExp(`\\breturn\\s+${accumulator}\\b`,'g'),'');
  return !new RegExp(`\\b${accumulator}\\b`).test(remainder);
}

function payloadProof(source, expression, at, property, trail = new Set(), useAt = at) {
  if (trail.size > 16) return 'unknown';
  const value = unwrap(expression ?? '');
  const marker = `${at}:${property ?? ''}:${value}`;
  if (!value || trail.has(marker)) return 'unknown';
  const next = new Set([...trail,marker]);
  const mask = codeMask(source);
  const scope = scopeAt(mask,at);

  if (singleIdentifier(value)) {
    const candidates = declarations(source).filter(declaration=>declaration.name === value && declaration.end < at && containsScope(scopeAt(mask,declaration.index),scope));
    const declaration = candidates.at(-1);
    if (!declaration) return 'unknown';
    if (parameterShadows(mask,value,scopeAt(mask,declaration.index),scope,declaration.end,at) || mutatedBeforeUse(source,value,declaration.end,useAt)) return 'unknown';
    return payloadProof(source,declaration.expression,declaration.index,property,next,useAt);
  }

  if (property) {
    const selected = propertyValue(value,property);
    return selected === null ? 'unknown' : payloadProof(source,selected,at,undefined,next,useAt);
  }
  // The legacy createRecord helper also accepts {data: ...} DTOs.
  const data = propertyValue(value,'data');
  if (data !== null) return payloadProof(source,data,at,undefined,next,useAt);
  if (value.startsWith('{') && closingIndex(value,0) === value.length - 1) {
    const entries = splitTopLevel(value.slice(1,-1),',').filter(Boolean);
    if (entries.length && entries.every(entry=>entry.startsWith('...'))) {
      const proofs = entries.map(entry=>payloadProof(source,entry.slice(3),at,undefined,next,useAt));
      if (proofs.every(proof=>proof === 'filtered')) return 'filtered';
      if (proofs.every(proof=>proof !== 'unknown')) return 'review';
    }
    return 'unknown';
  }

  const conditional = splitTopLevel(value,'?');
  if (conditional.length === 2) {
    const branches = splitTopLevel(conditional[1],':');
    if (branches.length !== 2) return 'unknown';
    if (['true','false'].includes(unwrap(conditional[0]))) return payloadProof(source,branches[unwrap(conditional[0]) === 'true' ? 0 : 1],at,undefined,next,useAt);
    const proofs = branches.map(branch=>payloadProof(source,branch,at,undefined,next,useAt));
    if (proofs.every(proof=>proof === 'filtered')) return 'filtered';
    // A BPM session may filter its branch upstream. Do not pretend this local
    // analysis has proved that branch, or incorrectly apply ordinary IAM to it.
    return proofs.includes('filtered') || proofs.includes('review') ? 'review' : 'unknown';
  }

  const call = parseCall(value.replace(/^await\s+/,''));
  if (call?.name === 'Object.fromEntries' && call.args.length === 1) {
    const entries = call.args[0];
    const filtered = calls(entries,'filter').find(site=>site.end === entries.length);
    if (!filtered) return 'unknown';
    const receiver = entries.slice(0,filtered.index).replace(/\.\s*$/,'');
    if (parseCall(receiver)?.name !== 'Object.entries') return 'unknown';
    const arrow = splitTopLevel(filtered.args[0],'=>');
    const key = arrow.length === 2 && unwrap(arrow[0]).match(/^\[\s*([\w$]+)(?:\s*,[^\]]*)?\s*\]$/)?.[1];
    if (!key) return 'unknown';
    const restricted = requiresGate(arrow[1],atom=>{
      const gate = parseCall(atom);
      if (!gate || gate.args.length !== 1 || unwrap(gate.args[0]) !== key || !gate.name.endsWith('.has')) return false;
      const set = gate.name.slice(0,-4);
      return declaredFieldSet(source,set,at);
    });
    return restricted ? 'filtered' : 'unknown';
  }

  if (call && singleIdentifier(call.name)) {
    if (localFieldProjection(source,call,at)) return 'filtered';
    // Inline a small local expression helper. Imported/complex builders need
    // production tests, never a name-only trust list.
    const pattern = new RegExp(`\\bfunction\\s+${escapePattern(call.name)}\\s*\\(`,'g');
    const definition = [...mask.matchAll(pattern)].filter(match=>containsScope(scopeAt(mask,match.index),scope)).at(-1);
    if (definition) {
      const open = definition.index + definition[0].length - 1;
      const end = closingIndex(source,open);
      const bodyStart = mask.indexOf('{',end);
      const bodyEnd = closingIndex(source,bodyStart);
      const body = source.slice(bodyStart + 1,bodyEnd).trim();
      const params = splitTopLevel(source.slice(open + 1,end),',');
      if (/^return\b/.test(body) && params.every(singleIdentifier)) {
        const returned = body.replace(/^return\s+/,'').replace(/;\s*$/,'');
        const mapped = returned.replace(new RegExp(`\\b(${params.map(escapePattern).join('|')})\\b`,'g'),name=>`(${call.args[params.indexOf(name)] ?? 'undefined'})`);
        return payloadProof(source,mapped,at,undefined,next,useAt);
      }
    }
    if (!definition && !declarations(source).some(item=>item.name === call.name)
      && call.args.some(argument=>fieldCollectionProof(source,argument,at))) return 'review';
  }
  return 'unknown';
}

export function auditCreatePayloads(rawSources, boundaries = defaultCreateCalls) {
  const results = rawSources.flatMap((rawSource,fileIndex)=>{
    const source = stripComments(rawSource);
    return boundaries.flatMap(boundary=>calls(source,escapePattern(boundary.name)).flatMap(call=>{
      if (/\bfunction\s*$/.test(source.slice(0,call.index))) return [];
      const argument = call.args[boundary.argument] ?? '';
      const origin = singleIdentifier(unwrap(argument)) ? `identifier ${unwrap(argument)}` : argument ? 'expression' : 'missing argument';
      return [{fileIndex, name:boundary.name, index:call.index, argument:boundary.argument, property:boundary.property, origin, proof:payloadProof(source,argument,call.index,boundary.property)}];
    }));
  });
  return {
    checked:results.length,
    recognizedNames:[...new Set(results.map(result=>result.name))],
    failures:results.filter(result=>result.proof === 'unknown'),
    reviews:results.filter(result=>result.proof === 'review'),
  };
}
