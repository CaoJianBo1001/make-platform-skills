#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));
const platformSkillDirectories = [
  'skills/canvas-table-integration',
  'skills/make-app-filter',
  'skills/make-app-group',
  'skills/make-app-service',
  'skills/make-app-sort',
  'skills/makeui',
];
const platformEntryFiles = ['README.md'];
const forbiddenProjectNames =
  /(BizFinancePoc|ExpensePoc|uju[-_]?mdm|ClaimTable|DemoWorkbench)/i;
const forbiddenPersonalContext =
  /(\/Users\/[^\s`)]+|\/home\/[^\s`)]+|\/var\/folders\/[^\s`)]+|\/(?:private\/)?tmp\/[^\s`)]+)/;

const collectSkillDocuments = (relativeDirectory) => {
  const absoluteDirectory = path.join(repoRoot, relativeDirectory);
  assert.ok(
    fs.existsSync(absoluteDirectory),
    `Expected ${relativeDirectory} under repo root ${repoRoot}`,
  );

  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectSkillDocuments(relativePath);
    return /\.(md|ya?ml)$/i.test(entry.name) ? [relativePath] : [];
  });
};

const collectFiles = (relativeDirectory, filePattern) => {
  const absoluteDirectory = path.join(repoRoot, relativeDirectory);
  assert.ok(
    fs.existsSync(absoluteDirectory),
    `Expected ${relativeDirectory} under repo root ${repoRoot}`,
  );

  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectFiles(relativePath, filePattern);
    return filePattern.test(entry.name) ? [relativePath] : [];
  });
};

const checkedFiles = [
  ...platformSkillDirectories.flatMap(collectSkillDocuments),
  ...platformEntryFiles,
];
const privacyCheckedFiles = [
  ...checkedFiles,
  ...collectSkillDocuments('docs'),
  ...collectFiles('scripts', /\.(?:mjs|js|ts|md|ya?ml)$/i),
];

for (const relativePath of checkedFiles) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  assert.doesNotMatch(
    content,
    forbiddenProjectNames,
    `${relativePath} must describe platform behavior without project-specific names`,
  );
}

for (const relativePath of privacyCheckedFiles) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  assert.doesNotMatch(
    content,
    forbiddenPersonalContext,
    `${relativePath} must not expose personal usernames or local machine paths`,
  );
}

const filterDocuments = collectSkillDocuments('skills/make-app-filter')
  .map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
  .join('\n');
assert.doesNotMatch(
  filterDocuments,
  /"expression"\s*:\s*"(?!<filterExpression>"|")/,
  'make-app-filter expression examples must use <filterExpression> instead of business fields or values',
);

console.log('platform skill genericity contract passed');
