import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationGate } from '../skills/make-app-permission/scripts/permission-navigation-signals.mjs';

const gate = 'canUseEntityOperation(access, item.entityKey, META_ENTITY_READ)';
const file = '/app/Page.tsx', wrapperFile = '/app/ObjectListViews.tsx';
const wrapper = `export function DesktopObjectListView({ objects }: Props) {
  const navigation = <ObjectNavigation items={objects} />;
  return <Layout>{navigation}</Layout>;
}`;
const entry = (source, name = file) => ({ file: name, source });
const page = (condition = gate) => `import { DesktopObjectListView } from './ObjectListViews';
function Page() {
 const filtered = objects.filter(item => ${condition});
 return <DesktopObjectListView objects={filtered} />;
}`;

for (const [label, condition, allowed] of [
  ['required gate', gate, true],
  ['conjunction', `(${gate}) && ready`, true],
  ['guarded alternatives', `(${gate} && ready) || (${gate} && cached)`, true],
  ['OR true', `${gate} || true`, false],
  ['negated', `!${gate}`, false],
  ['fallback', `${gate} ? true : cached`, false],
  ['wrong entity', gate.replace('item.entityKey', 'other.entityKey'), false],
  ['record read', gate.replace('META_ENTITY_READ', 'DATA_RECORD_READ'), false],
]) test(`imported wrapper: ${label}`, () => {
  assert.equal(navigationGate([entry(page(condition)), entry(wrapper, wrapperFile)]), allowed);
});

for (const [label, changePage, changeWrapper] of [
  ['unused filtered collection', s => s.replace('objects={filtered}', 'objects={objects}'), s => s],
  ['unused wrapper navigation', s => s, s => s.replace('return <Layout>{navigation}</Layout>;', 'return <ObjectNavigation items={rawObjects} />;')],
  ['wrapper renders filtered and raw collections', s => s, s => s.replace('{navigation}</Layout>', '{navigation}<ObjectNavigation items={rawObjects} /></Layout>')],
  ['wrapper has an unproved spread navigation', s => s, s => s.replace('{navigation}</Layout>', '{navigation}<ObjectNavigation {...rest} /></Layout>')],
  ['function-valued slot is not a rendered JSX value', s => s, s => s.replace('const navigation =', 'const navigation = () =>')],
  ['wrapper forwards raw collection', s => s, s => s.replace('items={objects}', 'items={allObjects}')],
  ['unrelated import', s => s.replace("'./ObjectListViews'", "'./OtherViews'"), s => s],
  ['same-named collection in other function', s => s.replace('return <Desktop', '} function Other() { return <Desktop'), s => s],
  ['mutated collection', s => s.replace('return <Desktop', 'filtered.push(hidden); return <Desktop'), s => s],
  ['wrapper mutates input', s => s, s => s.replace('const navigation', 'objects.push(hidden); const navigation')],
  ['spread can overwrite prop', s => s.replace('objects={filtered}', 'objects={filtered} {...rest}'), s => s],
  ['overwritten wrapper prop', s => s, s => s.replace('items={objects}', 'items={objects} {...rest}')],
  ['shadowed collection', s => s.replace('return <Desktop', 'function Inner(filtered) { return <Desktop').replace('/>;\n}', '/>; }\n}'), s => s],
  ['shadowed arrow parameter', s => s.replace('return <Desktop', 'return values.map(filtered => <Desktop').replace('/>;\n}', '/>);\n}'), s => s],
  ['wrapper nested parameter', s => s, s => s.replace('const navigation =', 'function Inner(objects) { return').replace('return <Layout>{navigation}</Layout>;', '} return <Inner objects={rawObjects} />;')],
  ['wrapper arrow parameter', s => s, s => s.replace('const navigation =', 'const navigation = values.map(objects =>').replace('/>;', '/>);')],
]) test(label, () => assert.equal(navigationGate([entry(changePage(page())), entry(changeWrapper(wrapper), wrapperFile)]), false));

test('collection aliases are outside the bounded recognizer, including later source mutation', () => {
  for (const mutation of ['', 'filtered.push(hidden);']) {
    const input = page().replace('return <Desktop', `const alias = filtered; ${mutation} return <Desktop`).replace('objects={filtered}', 'objects={alias}');
    assert.equal(navigationGate([entry(input), entry(wrapper, wrapperFile)]), false);
  }
});

test('a returned navigation component can receive the prop directly', () => {
  const direct = 'export function DesktopObjectListView({ objects }: Props) { return <ObjectNavigation items={objects} />; }';
  assert.equal(navigationGate([entry(page()), entry(direct, wrapperFile)]), true);
});

test('identity menus and menu icons are not business entity collections', () => {
  const layout = wrapper.replace('{navigation}</Layout>', '{navigation}<Menu /><CurrentUserMenu /></Layout>');
  assert.equal(navigationGate([entry(page()), entry(layout, wrapperFile)]), true);
});

test('destructured prop alias is forwarded', () => {
  assert.equal(navigationGate([entry(page()), entry(wrapper.replace('{ objects }', '{ objects: entries }').replace('items={objects}', 'items={entries}'), wrapperFile)]), true);
});

test('multiline filter with trailing comma forwards to the imported wrapper', () => {
  const input = page().replace(`item => ${gate}`, `(item) =>\n ${gate} && schemaHasEntity(schema, item.entityKey),\n`);
  assert.equal(navigationGate([entry(input), entry(wrapper, wrapperFile)]), true);
});

test('unimported same-name wrappers and inert text cannot establish a gate', () => {
  assert.equal(navigationGate([entry(page().replace(/import[^;]+;/, '')), entry(wrapper, wrapperFile)]), false);
  assert.equal(navigationGate([entry(`const text = ${JSON.stringify(page() + wrapper)};`)]), false);
});

test('another file cannot supply a same-named gate variable', () => {
  assert.equal(navigationGate([entry('const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);'), entry('<ObjectNavigation visible={canViewEntity} />', wrapperFile)]), false);
});

test('direct visible gates use the full boolean condition', () => {
  for (const [expression, expected] of [['allowed', true], ['allowed && ready', true], ['allowed || true', false], ['!allowed', false]]) {
    assert.equal(navigationGate([entry(`const allowed = canUseEntityOperation(access, object.entityKey, 'meta.entity.read'); <ObjectNavigation visible={${expression}} />`)]), expected);
  }
});

test('unused direct or wrapped JSX cannot authorize the rendered raw menu', () => {
  for (const component of ['ObjectNavigation', 'DesktopObjectListView']) {
    const source = page().replace('return <DesktopObjectListView objects={filtered} />;',
      `const unused = <${component} objects={filtered} />; return <ObjectNavigation items={objects} />;`);
    assert.equal(navigationGate([entry(source), entry(wrapper, wrapperFile)]), false);
  }
});

test('a safe direct menu cannot hide a raw sibling in the same rendered surface', () => {
  const source = `function Page() { const filtered = objects.filter(item => ${gate});
    return <><ObjectNavigation items={filtered} /><ObjectNavigation items={objects} /></>; }`;
  assert.equal(navigationGate([entry(source)]), false);
});

test('returned conditional JSX slots preserve the collection proof', () => {
  const source = page().replace('return <DesktopObjectListView objects={filtered} />;',
    'const view = compact ? <div /> : <DesktopObjectListView objects={filtered} />; return <Layout>{view}</Layout>;');
  assert.equal(navigationGate([entry(source), entry(wrapper, wrapperFile)]), true);
});

test('existing direct navigation in an arrow component remains recognized', () => {
  const source = `const Page = () => { const filtered = objects.filter(item => ${gate});
    return <ObjectNavigation items={filtered} />; };`;
  assert.equal(navigationGate([entry(source)]), true);
});
