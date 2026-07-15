#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const makeuiFiles = [
  'skills/makeui/SKILL.md',
  'skills/makeui/references/component-structure.md',
  'skills/makeui/references/component-usage.md',
];

const canvasFiles = [
  'skills/canvas-table-integration/SKILL.md',
  'skills/canvas-table-integration/references/make-field-display-patterns.md',
  'skills/canvas-table-integration/references/track-workflows.md',
];

const makeFilterFiles = [
  'skills/make-app-filter/SKILL.md',
  'skills/make-app-filter/references/operator-matrix.md',
];

const requiredFieldTypes = [
  'Make.Field.ID',
  'Make.Field.Text',
  'Make.Field.TextArea',
  'Make.Field.URL',
  'Make.Field.Number',
  'Make.Field.Currency',
  'Make.Field.Percent',
  'Make.Field.Date',
  'Make.Field.DateTime',
  'Make.Field.DateRange',
  'Make.Field.SingleSelect',
  'Make.Field.MultiSelect',
  'Make.Field.SingleUser',
  'Make.Field.MultiUser',
  'Make.Field.SingleDepartment',
  'Make.Field.MultiDepartment',
  'Make.Field.File',
  'Make.Field.Lookup',
];

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(
    fs.existsSync(filePath),
    `Expected ${relativePath} under repo root ${repoRoot}`,
  );
  return fs.readFileSync(filePath, 'utf8');
};

for (const relativePath of makeuiFiles) {
  const content = read(relativePath);
  assert.match(
    content,
    /apps\/ui\/src\/lib\/make-field-types\.ts/,
    `${relativePath} must require a shared Make field type registry in apps/ui`,
  );
  assert.match(
    content,
    /registry[\s\S]*(form|detail|table|editor)/i,
    `${relativePath} must require host-owned field-type consumers to share the registry`,
  );
  assert.doesNotMatch(
    content,
    /(advanced filter value editors|筛选值编辑器|filter support flags)/i,
    `${relativePath} must not assign package-owned filter semantics to the host registry`,
  );
}

for (const relativePath of canvasFiles) {
  const content = read(relativePath);
  assert.match(
    content,
    /apps\/ui\/src\/lib\/make-field-types\.ts/,
    `${relativePath} must point Track C to the shared field type registry`,
  );
  assert.doesNotMatch(
    content,
    /(advanced filter value editors|筛选值编辑器|filter support flags)/i,
    `${relativePath} must not assign package-owned filter semantics to the host registry`,
  );
}

const combinedFilterDocs = makeFilterFiles.map(read).join('\n');
assert.match(
  combinedFilterDocs,
  /(host|宿主)[\s\S]*(registry|字段类型)[\s\S]*(must not|does not|不得|不能)[\s\S]*(operator|操作符|value editor|值编辑器)/i,
  'make-app-filter must state that host registries do not own filter operators or value editors',
);

const combinedCanvasDocs = canvasFiles.map(read).join('\n');
assert.match(
  combinedCanvasDocs,
  /displayGroup[\s\S]*renderKind[\s\S]*width[\s\S]*align/,
  'Track C docs must describe the registry metadata used by CanvasTable columns',
);

for (const fieldType of requiredFieldTypes) {
  assert.match(
    combinedCanvasDocs,
    new RegExp(fieldType.replaceAll('.', '\\.')),
    `Track C docs must cover ${fieldType}`,
  );
}

const collectMarkdown = (relativeDir) => {
  const absoluteDir = path.join(repoRoot, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return collectMarkdown(relativePath);
    return entry.isFile() && entry.name.endsWith('.md') ? [[relativePath, read(relativePath)]] : [];
  });
};

const reviewedSkillMarkdown = [
  ...collectMarkdown('skills/canvas-table-integration'),
  ...collectMarkdown('skills/make-app-filter'),
  ...collectMarkdown('skills/makeui'),
];
const exactUserCandidateContract = /GET \/api\/users\?keyword=&page=&size=/g;
const exactDepartmentCandidateContract = /GET \/api\/departments\?keyword=&page=&size=/g;
const countMatches = (content, pattern) => [...content.matchAll(pattern)].length;

assert.equal(
  reviewedSkillMarkdown.reduce(
    (count, [, content]) => count + countMatches(content, exactUserCandidateContract),
    0,
  ),
  1,
  'the exact user candidate endpoint contract must have one canonical owner across the three skills',
);
assert.equal(
  reviewedSkillMarkdown.reduce(
    (count, [, content]) => count + countMatches(content, exactDepartmentCandidateContract),
    0,
  ),
  1,
  'the exact department candidate endpoint contract must have one canonical owner across the three skills',
);
assert.match(
  read('skills/makeui/references/component-usage.md'),
  /GET \/api\/users\?keyword=&page=&size=[\s\S]*GET \/api\/departments\?keyword=&page=&size=/,
  'makeui component usage must remain the canonical candidate-source UI contract',
);

console.log('make field type registry contract passed');
