#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));
const frontendSkillDirectories = [
  'skills/makeui',
  'skills/canvas-table-integration',
  'skills/make-app-permission',
];
const publishedFilePattern = /\.(?:md|ya?ml|mjs|js|ts)$/i;
const forbiddenProjectContent = /\b[A-Za-z][A-Za-z0-9]*(?:Poc|Workbench|Console)\b|\bPOC\b/i;
const forbiddenLocalPath = /(?:~\/|\/(?:Users|home|root|var\/folders|private\/tmp|tmp)\/)/;

const collectFiles = (relativeDirectory) => {
  const absoluteDirectory = path.join(repoRoot, relativeDirectory);
  const files = [];
  const visit = (currentDirectory) => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && publishedFilePattern.test(entry.name)) {
        files.push(path.relative(repoRoot, absolutePath));
      }
    }
  };

  visit(absoluteDirectory);
  return files.sort();
};

for (const relativePath of frontendSkillDirectories.flatMap(collectFiles)) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  assert.doesNotMatch(
    content,
    forbiddenProjectContent,
    `${relativePath} must not expose project-specific or POC-only content`,
  );
  assert.doesNotMatch(
    content,
    forbiddenLocalPath,
    `${relativePath} must not embed a local machine path`,
  );
}

console.log('make app frontend platformization contract passed');
