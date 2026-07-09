#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));
const skillsDir = path.join(repoRoot, 'skills');

const cleanScalar = (rawValue) => {
  const value = rawValue.trim();
  const quoted = value.match(/^(["'])([\s\S]*)\1$/);
  return (quoted ? quoted[2] : value).trim();
};

const frontmatterLines = (content) => {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return null;

  const endIndex = lines.findIndex(
    (line, index) => index > 0 && line === '---',
  );

  return endIndex === -1 ? null : lines.slice(1, endIndex);
};

const topLevelValue = (lines, key) => {
  const prefix = `${key}:`;
  const line = lines.find((item) => item.startsWith(prefix));
  return line ? cleanScalar(line.slice(prefix.length)) : '';
};

const nestedValue = (lines, parent, key) => {
  const parentLine = `${parent}:`;
  const parentIndex = lines.findIndex((line) => line.startsWith(parentLine));
  if (parentIndex === -1) return '';

  for (const line of lines.slice(parentIndex + 1)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) break;

    const match = line.match(new RegExp(`^\\s+${key}:\\s*(.*)$`));
    if (match) return cleanScalar(match[1]);
  }

  return '';
};

const versionScanLines = (content) => {
  const lines = content.split(/\r?\n/);
  const endIndex = lines.findIndex(
    (line, index) => index > 0 && line === '---',
  );
  const startIndex = endIndex === -1 ? 0 : endIndex + 1;

  return lines
    .slice(startIndex)
    .map((line, index) => [startIndex + index + 1, line]);
};

const markdownFiles = (directory = skillsDir) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...markdownFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.relative(repoRoot, absolutePath));
    }
  }

  return files.sort();
};

const skillEntryFiles = () => {
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.join('skills', entry.name));
    }

    if (entry.isDirectory()) {
      const relativePath = path.join('skills', entry.name, 'SKILL.md');
      if (fs.existsSync(path.join(repoRoot, relativePath))) {
        files.push(relativePath);
      }
    }
  }

  return files.sort();
};

const failures = [];
const entryFiles = skillEntryFiles();
const markdownSkillFiles = markdownFiles();

for (const relativePath of entryFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = frontmatterLines(content);

  if (!lines) {
    failures.push(`${relativePath}: missing YAML frontmatter`);
    continue;
  }

  const requiredFields = [
    ['name', topLevelValue(lines, 'name')],
    ['description', topLevelValue(lines, 'description')],
    ['metadata.version', nestedValue(lines, 'metadata', 'version')],
  ];

  for (const [field, value] of requiredFields) {
    if (!value) failures.push(`${relativePath}: ${field} is required`);
  }
}

for (const relativePath of markdownSkillFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');

  for (const [lineNumber, line] of versionScanLines(content)) {
    if (/Current skill revision\s*:/i.test(line)) {
      failures.push(
        `${relativePath}:${lineNumber}: move skill revision to metadata.version`,
      );
    }

    if (/\bDocuments\s+\S+\s+\*\*v\d+\.\d+\.\d+\*\*/i.test(line)) {
      failures.push(
        `${relativePath}:${lineNumber}: move documented skill version to metadata.version`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `skill metadata lint passed (${entryFiles.length} entry files, ${markdownSkillFiles.length} markdown files)`,
);
