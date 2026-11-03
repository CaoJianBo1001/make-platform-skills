// Bounded navigation evidence: local boolean gates/filters and one imported or
// local function component forwarding a destructured collection prop unchanged.
import path from 'node:path';
import { closingIndex, codeMask, declarations, escapePattern as esc, identifier as id, parseCall, requiresGate, splitTopLevel, stripComments, unwrap } from './permission-source-expressions.mjs';

const collectionProps = new Set(['objects', 'entities', 'items', 'menuItems', 'navigationItems']);
const isNavigation = name => /Navigation|Sidebar|SideBar|Menu/.test(name);
const isIdentifier = value => new RegExp(`^${id}$`).test(value);
const scopeAt = (mask, at) => {
  const scope = [];
  for (let i = 0; i < at; i++) {
    if (mask[i] === '{') scope.push(i);
    else if (mask[i] === '}') scope.pop();
  }
  return scope;
};
const containsScope = (parent, child) => parent.every((brace, index) => child[index] === brace);

function tags(source, mask) {
  return [...mask.matchAll(new RegExp(`<(${id})\\b`, 'g'))].flatMap(match => {
    const props = new Map();
    let index = match.index + match[0].length, uncertain = false;
    while (index < mask.length && mask[index] !== '>') {
      if (mask[index] === '{') {
        const end = closingIndex(source, index);
        if (end < 0) return [];
        uncertain = true; index = end + 1; continue;
      }
      const prop = mask.slice(index).match(new RegExp(`^(${id})\\s*=\\s*\\{`));
      if (!prop) { index++; continue; }
      const open = index + prop[0].length - 1, end = closingIndex(source, open);
      if (end < 0) return [];
      if (props.has(prop[1])) uncertain = true;
      props.set(prop[1], source.slice(open + 1, end).trim()); index = end + 1;
    }
    return [{ name: match[1], index: match.index, props, uncertain }];
  });
}

function functions(source, mask) {
  return [...mask.matchAll(new RegExp(`\\bfunction\\s+(${id})\\s*\\(`, 'g'))].flatMap(match => {
    const open = match.index + match[0].length - 1, end = closingIndex(source, open);
    const body = /^\s*(?::\s*[\w.<>]+\s*)?\{/.exec(mask.slice(end + 1));
    if (end < 0 || !body) return [];
    const start = end + body[0].length, close = closingIndex(source, start);
    return close < 0 ? [] : [{ name: match[1], index: match.index, params: source.slice(open + 1, end), start, end: close }];
  });
}

function mutated(context, name, start, end) {
  const target = esc(name), assign = String.raw`(?:=(?!=|>)|[+?&|*/-]=|\+\+|--)`;
  return new RegExp(`\\b${target}\\s*(?:${assign}|\\.[\\w$]+\\s*${assign}|\\[[^\\]]*\\]\\s*${assign}|\\.(?:push|unshift|splice|fill|copyWithin)\\s*\\()|\\bObject\\.assign\\s*\\(\\s*${target}\\b`).test(context.mask.slice(start, end));
}

function localDeclaration(context, name, at) {
  const scope = scopeAt(context.mask, at);
  const declaration = context.declarations.filter(item => item.name === name && item.end < at && containsScope(scopeAt(context.mask, item.index), scope)).at(-1);
  if (!declaration || mutated(context, name, declaration.end, at)) return null;
  // A function parameter cannot borrow evidence from an outer const of the same name.
  if (parameterShadow(context, name, declaration.end, at)) return null;
  return declaration;
}

function parameterShadow(context, name, start, at) {
  const binding = new RegExp(`\\b${esc(name)}\\b`);
  if (context.functions.some(fn => fn.index > start && fn.start < at && at < fn.end && binding.test(fn.params))) return true;
  // Do not borrow an outer binding through a callback parameter. This bounded
  // check deliberately leaves more complex callback flow to production tests.
  return [...context.mask.slice(start, at).matchAll(new RegExp(`(${id}|\\([^()]*\\))\\s*=>`, 'g'))]
    .some(match => binding.test(match[1]));
}

function permissionCall(value, item) {
  const call = parseCall(value);
  return call?.name === 'canUseEntityOperation' && call.args.length === 3
    && ['META_ENTITY_READ', '"meta.entity.read"', "'meta.entity.read'"].includes(unwrap(call.args[2]))
    && (!item || [`${item}.entityKey`, `${item}.key`].includes(unwrap(call.args[1])));
}

function gateProof(context, expression, at) {
  return requiresGate(expression, atom => {
    if (permissionCall(atom)) return true;
    if (!isIdentifier(atom)) return false;
    const declaration = localDeclaration(context, atom, at);
    return Boolean(declaration && requiresGate(declaration.expression, value => permissionCall(value)));
  });
}

function collectionProof(context, expression, at) {
  let value = unwrap(expression);
  if (isIdentifier(value)) {
    const declaration = localDeclaration(context, value, at);
    if (!declaration) return false;
    value = unwrap(declaration.expression);
  }
  const filter = parseCall(value);
  if (!filter?.name.endsWith('.filter') || filter.args.filter(Boolean).length !== 1) return false;
  const arrow = splitTopLevel(filter.args[0], '=>'), item = unwrap(arrow[0] ?? '');
  return arrow.length === 2 && isIdentifier(item) && requiresGate(arrow[1], atom => permissionCall(atom, item));
}

function importedComponent(context, name, contexts) {
  const imports = /\bimport\s*\{([^}]+)\}\s*from\s*(['"])([^'"]+)\2/g;
  for (const match of context.source.matchAll(imports)) {
    if (context.mask.slice(match.index, match.index + 6) !== 'import' || !match[3].startsWith('.')) continue;
    const binding = match[1].split(',').map(part => part.trim().split(/\s+as\s+/)).find(parts => parts.at(-1) === name);
    if (!binding) continue;
    const target = path.resolve(path.dirname(context.file), match[3]);
    const candidates = contexts.filter(candidate => [target, ...['.tsx', '.jsx', '.ts', '.js', '/index.tsx', '/index.jsx', '/index.ts', '/index.js'].map(suffix => target + suffix)].includes(candidate.file));
    if (candidates.length !== 1) return null;
    const definition = candidates[0].functions.find(fn => fn.name === binding[0] && /\bexport\s*$/.test(candidates[0].mask.slice(0, fn.index)));
    return definition ? { context: candidates[0], definition } : null;
  }
  return null;
}

function forwardedProps(context, definition) {
  const params = definition.params.trim();
  if (!params.startsWith('{')) return [];
  const end = closingIndex(params, 0);
  if (end < 0 || !/^\s*(?::\s*[\w.<>]+)?\s*$/.test(params.slice(end + 1))) return [];
  const navigation = renderedNavigation(context, definition);
  if (!navigation.length || navigation.some(tag => tag.uncertain)) return [];
  const bindings = splitTopLevel(params.slice(1, end), ',').map(part => part.split(':').map(value => value.trim()));
  return bindings.filter(parts => parts.length <= 2 && parts.every(isIdentifier)).flatMap(([prop, alias = prop]) => {
    if (mutated(context, alias, definition.start, definition.end)) return [];
    return navigation.every(tag => !parameterShadow(context, alias, definition.start, tag.index)
      && [...tag.props].some(([key, value]) => collectionProps.has(key) && value === alias)) ? [prop] : [];
  });
}

function renderedTags(context, definition) {
  // Only direct component returns and one local JSX slot are supported. Merely
  // constructing a navigation element inside an unused const is not evidence.
  const returns = [...context.mask.matchAll(/\breturn\s+/g)]
    .filter(match => definition.start < match.index && match.index < definition.end && scopeAt(context.mask, match.index).at(-1) === definition.start)
    .map(match => {
      const start = match.index + match[0].length;
      const expression = splitTopLevel(context.source.slice(start, definition.end), ';')[0];
      return { start, end: start + expression.length, expression: codeMask(expression) };
    });
  return context.tags.filter(tag => definition.start < tag.index && tag.index < definition.end
    && returns.some(result => (result.start <= tag.index && tag.index < result.end)
      || context.declarations.some(declaration => definition.start < declaration.index && declaration.index < tag.index && tag.index < declaration.end && declaration.end < result.start
        && splitTopLevel(declaration.expression, '=>').length === 1
        && (unwrap(declaration.expression).startsWith('<') || splitTopLevel(declaration.expression, '?').length === 2)
        && scopeAt(context.mask, declaration.index).at(-1) === definition.start
        && (new RegExp(`\\{\\s*${esc(declaration.name)}\\s*\\}`).test(result.expression)
          || unwrap(result.expression) === declaration.name))));
}

function renderedNavigation(context, definition) {
  return renderedTags(context, definition).filter(tag => isNavigation(tag.name)
    && (tag.uncertain || [...tag.props.keys()].some(prop => collectionProps.has(prop))));
}

export function navigationGate(entries) {
  const contexts = entries.map(entry => {
    const source = stripComments(entry.source), mask = codeMask(source);
    return { file: path.resolve(entry.file), source, mask, declarations: declarations(source), functions: functions(source, mask), tags: tags(source, mask) };
  });
  return contexts.some(context => {
    const surfaces = new Map();
    for (const tag of context.tags) {
      const owner = context.functions.filter(fn => fn.start < tag.index && tag.index < fn.end).at(-1);
      if (owner && !renderedTags(context, owner).includes(tag)) continue;
      let proof;
      if (isNavigation(tag.name)) {
        if (!tag.uncertain && ![...tag.props.keys()].some(prop => collectionProps.has(prop) || ['visible', 'enabled'].includes(prop))) continue;
        proof = !tag.uncertain && (['visible', 'enabled'].some(prop => tag.props.has(prop) && gateProof(context, tag.props.get(prop), tag.index))
          || [...tag.props].some(([prop, value]) => collectionProps.has(prop) && collectionProof(context, value, tag.index)));
      } else {
        const local = context.functions.find(fn => fn.name === tag.name && containsScope(scopeAt(context.mask, fn.index), scopeAt(context.mask, tag.index)));
        const target = local ? { context, definition: local } : importedComponent(context, tag.name, contexts);
        if (!target || !renderedNavigation(target.context, target.definition).length) continue;
        proof = !tag.uncertain && forwardedProps(target.context, target.definition).some(prop => tag.props.has(prop) && collectionProof(context, tag.props.get(prop), tag.index));
      }
      const key = owner?.start ?? -1;
      surfaces.set(key, [...(surfaces.get(key) ?? []), proof]);
    }
    return [...surfaces.values()].some(proofs => proofs.length && proofs.every(Boolean));
  });
}
