#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [sourceRootArg, installedRootArg] = process.argv.slice(2);

if (!sourceRootArg || !installedRootArg) {
  console.error(
    'usage: node check-installed-skill-sync.mjs <source-skill-dir> <installed-skill-dir>',
  );
  process.exitCode = 2;
} else {
  const sourceRoot = path.resolve(sourceRootArg);
  const installedRoot = path.resolve(installedRootArg);

  console.log(
    `installed skill sync: checking source=${sourceRoot} installed=${installedRoot}`,
  );

  try {
    const sourceFiles = collectFiles(sourceRoot);
    const installedFiles = collectFiles(installedRoot);
    const findings = compareFileSets(sourceRoot, sourceFiles, installedRoot, installedFiles);

    if (findings.length === 0) {
      console.log(`installed skill sync: PASS (${sourceFiles.length} files)`);
    } else {
      console.error('installed skill sync: FAIL');
      for (const finding of findings) {
        console.error(`${finding.kind}: ${finding.relativePath}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`installed skill sync: ERROR: ${error.message}`);
    process.exitCode = 2;
  }
}

function collectFiles(root) {
  const rootStat = fs.statSync(root, { throwIfNoEntry: false });
  if (!rootStat?.isDirectory()) {
    throw new Error(`not a directory: ${root}`);
  }

  const visit = (directory, prefix = '') =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap((entry) => {
        const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          return visit(absolutePath, relativePath);
        }
        if (!entry.isFile()) {
          throw new Error(`unsupported filesystem entry: ${absolutePath}`);
        }
        return [relativePath];
      });

  return visit(root).sort((left, right) => left.localeCompare(right));
}

function compareFileSets(sourceRoot, sourceFiles, installedRoot, installedFiles) {
  const sourceSet = new Set(sourceFiles);
  const installedSet = new Set(installedFiles);
  const sourceOnly = sourceFiles
    .filter((relativePath) => !installedSet.has(relativePath))
    .map((relativePath) => ({ kind: 'source_only', relativePath }));
  const installedOnly = installedFiles
    .filter((relativePath) => !sourceSet.has(relativePath))
    .map((relativePath) => ({ kind: 'installed_only', relativePath }));
  const mismatches = sourceFiles
    .filter((relativePath) => installedSet.has(relativePath))
    .filter(
      (relativePath) =>
        !fs
          .readFileSync(path.join(sourceRoot, relativePath))
          .equals(fs.readFileSync(path.join(installedRoot, relativePath))),
    )
    .map((relativePath) => ({ kind: 'content_mismatch', relativePath }));

  return [...sourceOnly, ...installedOnly, ...mismatches].sort(
    (left, right) =>
      left.relativePath.localeCompare(right.relativePath) || left.kind.localeCompare(right.kind),
  );
}
