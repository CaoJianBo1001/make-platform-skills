// Additional, bounded static signals for context-driven hosts. These are not a
// JS interpreter: page/provider/hook behavior still needs production tests.
import { identifier as id, escapePattern as esc, stripComments, calls, closingIndex, declarations, parseCall, requiresGate, deniesWithoutGate, splitTopLevel, unwrap } from './permission-source-expressions.mjs';
const matches = (text, pattern) => [...text.matchAll(new RegExp(pattern, 'gs'))];
const has = (text, pattern) => new RegExp(pattern, 's').test(text);

function generationRefresh(source) {
  return matches(source, String.raw`\[(${id}),\s*(${id})\]\s*=\s*useState\(0\)`).some(([, generation, setter]) => {
    const key = matches(source, String.raw`const\s+(${id})\s*=\s*[^;\n]*\b${esc(generation)}\b`)[0]?.[1];
    if (!key) return false;
    return has(source, String.raw`refresh\s*:\s*\(\)\s*=>\s*${esc(setter)}\((${id})\s*=>\s*\1\s*\+\s*1\)`)
      && calls(source,'useEffect').some(effect => {
        const dependencies = unwrap(effect.args[1] ?? '');
        return dependencies.startsWith('[') && closingIndex(dependencies,0) === dependencies.length - 1
          && splitTopLevel(dependencies.slice(1,-1),',').includes(key)
          && has(effect.args[0] ?? '', String.raw`\.then\(async\b[\s\S]*?const\s+schema\s*=\s*await\s+${id}\([^;]*refresh\s*:\s*true[^;]*\);[\s\S]*?value\s*:\s*\{[^}]*\bschema\s*:`);
      })
      && has(source, String.raw`\.key\s*===\s*${esc(key)}\s*&&\s*${id}\.value\s*\?[^;]*:\s*null`)
      && has(source, String.raw`if\s*\(!(${id})\)\s*return\s+<[^;]+;[\s\S]*?<${id}\.Provider\s+value=\{\1\}>[^;]*key=\{${esc(key)}\}`);
  });
}

function contextConsumers(sources, source) {
  return sources.filter(generationRefresh).flatMap(provider => {
    const context = matches(provider, String.raw`<(${id})\.Provider\s+value=`)[0]?.[1];
    if (!context) return [];
    const hook = matches(provider, String.raw`(?:const|function)\s+(${id})\s*=\s*\(\)\s*=>\s*useContext\(${esc(context)}\)`)[0]?.[1];
    if (!hook) return [];
    return matches(source,String.raw`\b(${id})\s*=\s*${esc(hook)}\(\)`).map(([,name])=>name);
  });
}

function permissionCall(value, helpers, permission) {
  const call = parseCall(value);
  return call && helpers.includes(call.name) && (!permission || [JSON.stringify(permission), `'${permission}'`].includes(call.args.at(-1)));
}

function readGates(source, permission, knownTrue) {
  const helpers = ['canUseEntityOperation'];
  for (const declaration of declarations(source)) {
    const arrow = splitTopLevel(declaration.expression,'=>');
    if (arrow.length === 2 && requiresGate(arrow[1], value=>permissionCall(value,helpers),knownTrue)) helpers.push(declaration.name);
  }
  return declarations(source)
    .filter(({expression}) => requiresGate(expression,value=>permissionCall(value,helpers,permission),knownTrue))
    .map(({name})=>name);
}

function contentGuard(source, knownTrue) {
  return readGates(source, 'meta.entity.read', knownTrue).some(name =>
    calls(source,'if').some(call => deniesWithoutGate(call.args[0],name,knownTrue)
      && /^\s*(?:\{\s*)?return\s+<[^>]+\bresourceDenied\b/.test(source.slice(call.end))));
}

function contextNavigation(sources) {
  for (const source of sources) {
    if (!generationRefresh(source)) continue;
    const trim = declarations(source).find(({expression}) => calls(expression,'schema\\.entities\\.filter').some(call => {
      const arrow = splitTopLevel(call.args[0],'=>');
      return arrow.length === 2 && requiresGate(arrow[1],value=>permissionCall(value,['canUseEntityOperation'],'meta.entity.read'));
    }))?.name;
    if (!trim || !has(source, String.raw`schema\s*:\s*${esc(trim)}\(schema,\s*access\)`)) continue;
    const context = matches(source, String.raw`<(${id})\.Provider\s+value=`)[0]?.[1];
    if (!context) continue;
    const hook = matches(source, String.raw`(?:const|function)\s+(${id})\s*=\s*\(\)\s*=>\s*useContext\(${esc(context)}\)`)[0]?.[1];
    if (!hook) continue;
    for (const consumer of sources) {
      const access = matches(consumer, String.raw`const\s+(${id})\s*=\s*${esc(hook)}\(\)`)[0]?.[1];
      if (!access) continue;
      for (const [, collection] of matches(consumer, String.raw`const\s+(${id})\s*=\s*${esc(access)}\s*\?\s*${id}\.filter\([^;\n]*${esc(access)}\.schema\.entities\.some\([^;\n]*\.key\s*===\s*${id}\.entityKey`)) {
        const declaration = declarations(consumer).find(item=>item.name === collection);
        const filter = calls(declaration?.expression ?? '',`${id}\\.filter`)[0];
        const arrow = splitTopLevel(filter?.args[0] ?? '', '=>');
        if (arrow.length !== 2 || !requiresGate(arrow[1],value=>parseCall(value)?.name === `${access}.schema.entities.some`)) continue;
        if (has(consumer, String.raw`<${id}(?:\.\w+)?\b[^>]*>[\s\S]*?\{${esc(collection)}\.map\([^;]*<${id}\.Item\b`)) return true;
      }
    }
  }
  return false;
}

function hookClearsRows(sources) {
  for (const hookSource of sources) {
    for (const [, hook, enabled] of matches(hookSource, String.raw`export\s+const\s+(${id})\s*=\s*\([^)]*,\s*(${id})\s*=\s*true,?\s*\)\s*=>`)) {
      if (!has(hookSource, String.raw`if\s*\(!${esc(enabled)}\)\s*\{[^}]*set${id}\(\{[^}]*rows\s*:\s*\[\s*\][^}]*\}\);\s*return;`)) continue;
      const guards = [enabled, ...declarations(hookSource).filter(({expression})=>requiresGate(expression,value=>value===enabled)).map(({name})=>name)];
      if (!guards.some(gate => has(hookSource, String.raw`return\s*\{\s*rows\s*:\s*${esc(gate)}\s*\?\s*${id}\.rows\s*:\s*\[\s*\]`))) continue;
      for (const page of sources) {
        const hookExpression = declarations(hookSource).find(item=>item.name === hook)?.expression ?? '';
        const enabledIndex = splitTopLevel(unwrap(splitTopLevel(hookExpression,'=>')[0]),',').findIndex(arg=>new RegExp(`^${esc(enabled)}\\s*=`).test(arg));
        for (const gate of readGates(page, 'data.record.read',contextConsumers(sources,page))) {
          if (enabledIndex === undefined || enabledIndex < 0 || !calls(page,esc(hook)).some(call =>
            /const\s*\{\s*rows\b[^}]*\}\s*=\s*$/.test(page.slice(0,call.index))
            && requiresGate(call.args[enabledIndex] ?? '',value=>value===gate))) continue;
          const rows = ['rows', ...matches(page, String.raw`const\s+(${id})\s*=\s*(?:useMemo\(\(\)\s*=>\s*)?rows\.map\([^;]*`).map(([, name])=>name)];
          if (rows.some(name => has(page, String.raw`<${id}(?:Table|Grid|Canvas)\b[^>]*\brows=\{${esc(name)}\}`))) return true;
        }
      }
    }
  }
  return false;
}

export function runtimeSignals(rawSources) {
  const sources = rawSources.map(stripComments);
  return {
    refresh: sources.some(generationRefresh),
    route: sources.some(source=>contentGuard(source,contextConsumers(sources,source))),
    navigation: contextNavigation(sources),
    rows: hookClearsRows(sources),
  };
}
