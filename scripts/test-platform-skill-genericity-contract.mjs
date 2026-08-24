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
  'skills/make-ai-assistant',
  'skills/make-app-permission',
  'skills/make-app-service',
  'skills/make-app-sort',
  'skills/makeui',
];
const platformEntryFiles = ['README.md'];
const publishedContentDirectories = ['skills'];
const forbiddenProjectIdentifier = /\b[A-Za-z][A-Za-z0-9]*(?:Poc|Workbench)\b/i;
const forbiddenExecutionContext =
  /\/(?:root|Users|home|var\/folders|(?:private\/)?tmp)(?:\/|$)/;

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
  ...publishedContentDirectories.flatMap(collectSkillDocuments),
  ...platformEntryFiles,
];
const privacyCheckedFiles = [
  ...checkedFiles,
  ...collectFiles('scripts', /\.(?:mjs|js|ts|md|ya?ml)$/i),
];

for (const relativePath of checkedFiles) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  assert.doesNotMatch(
    content,
    forbiddenProjectIdentifier,
    `${relativePath} must not expose a concrete project identifier`,
  );
  assert.doesNotMatch(
    relativePath,
    forbiddenProjectIdentifier,
    `${relativePath} must not expose a concrete project identifier`,
  );
}

for (const relativePath of privacyCheckedFiles) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  assert.doesNotMatch(
    content,
    forbiddenExecutionContext,
    `${relativePath} must not expose a personal or local execution path`,
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
