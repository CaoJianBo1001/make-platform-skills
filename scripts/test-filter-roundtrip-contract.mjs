import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const base = 'skills/make-app-filter/';
const file = `${base}references/roundtrip-and-errors.md`;
assert.ok(existsSync(fileURLToPath(new URL(file, root))), 'missing portable roundtrip/error contract');
const contract = read(file);
for (const requirement of ['compileAdvancedFilterToCel', 'compileListFilter', 'parseCelToAdvancedFilter', 'unsupportedExpression', '256', 'search-only', 'advanced-filter', 'A -> B -> A', 'structureError']) {
  assert.ok(contract.includes(requirement), `missing ${requirement}`);
}
for (const file of ['SKILL.md', 'references/package-integration.md', 'references/filter-model.md', 'references/preset-integration.md', 'references/service-translation.md', 'references/testing-and-pitfalls.md', 'references/operator-matrix.md']) {
  assert.match(read(base + file), /roundtrip-and-errors\.md/, `missing discoverable contract link in ${file}`);
}
assert.doesNotMatch(read(base + 'references/service-translation.md'), /compile to no expression|If no valid expression exists/);
assert.doesNotMatch(read(base + 'references/testing-and-pitfalls.md'), /undefined for no valid expression/);
assert.match(read('skills/make-app-service/references/service-api-contracts.md'), /保留.*括号/);
assert.match(read('skills/make-app-service/references/testing-and-safety.md'), /表达式原文/);

assert.doesNotMatch(contract, /dffb7fc|本轮修复|包仓库 dev/);
assert.match(contract, /search-only[^\n]*(不|无需)[^\n]*Preset/);

console.log('Filter roundtrip/error documentation contract passed (static consistency only).');
