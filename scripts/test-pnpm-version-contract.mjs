#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const listMarkdownFiles = (relativeDirectory) => {
  const directory = path.join(repoRoot, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
  });
};

const runtime = read('skills/make-app-runtime/SKILL.md');
const environment = read('skills/make-env-setup/SKILL.md');
const filter = read('skills/make-app-filter/SKILL.md');
const auth = read('skills/make-app-auth/SKILL.md');
const canvas = read('skills/canvas-table-integration/SKILL.md');
const cli = read('skills/makecli/SKILL.md');

assert.match(
  runtime,
  /"packageManager"\s*:\s*"pnpm@10\.20\.0"/,
  'make-app-runtime must pin generated Make Apps to pnpm 10.20.0',
);
assert.match(
  runtime,
  /"node"\s*:\s*"22\.20\.0"[\s\S]*"pnpm"\s*:\s*"10\.20\.0"/,
  'make-app-runtime must pin new or explicitly migrated Make Apps to Node.js 22.20.0 alongside pnpm 10.20.0',
);
assert.match(
  runtime,
  /Corepack 0\.34\.0/,
  'make-app-runtime must require the Corepack release bundled with Node.js 22.20.0',
);
assert.match(
  runtime,
  /\.nvmrc[\s\S]*22\.20\.0[\s\S]*(?:CI|Make build image)/,
  'make-app-runtime must require the actual build Node.js binary to be pinned as well as the manifest engine',
);
assert.match(
  runtime,
  /Existing Make Apps[\s\S]*explicit runtime migration/,
  'make-app-runtime must not migrate legacy Apps during unrelated work',
);
assert.doesNotMatch(
  runtime,
  /engineStrict:\s*true/,
  'make-app-runtime must not enable dependency engine strictness solely to pin the project runtime',
);
assert.match(
  runtime,
  /corepack pnpm install --frozen-lockfile/,
  'make-app-runtime must make reproducible Corepack installs part of publish readiness',
);
assert.match(
  runtime,
  /corepack pnpm run verify:publish/,
  'make-app-runtime must run the publish gate with the declared pnpm version',
);
assert.match(
  environment,
  /corepack install -g pnpm@10\.20\.0/,
  'make-env-setup must cache the Make App pnpm baseline with the current Corepack command',
);
assert.doesNotMatch(
  environment,
  /^\s*corepack prepare(?:\s|$)/m,
  'make-env-setup must not use the deprecated Corepack prepare command',
);
assert.doesNotMatch(
  environment,
  /for pkg in node pnpm git/,
  'make-env-setup must not upgrade pnpm through Homebrew',
);
assert.match(
  environment,
  /Make Apps require Node\.js 22\.20\.0; got/,
  'make-env-setup must reject every Node.js release except 22.20.0',
);
assert.match(
  environment,
  /Corepack must report 0\.34\.0; got/,
  'make-env-setup must verify the Corepack release required to install pnpm 10.20.0 from a cold cache',
);
assert.doesNotMatch(
  environment,
  /for pkg in node git/,
  'make-env-setup must not install an uncontrolled Node.js version through Homebrew',
);
assert.match(
  environment,
  /nvm install 22\.20\.0/,
  'make-env-setup must provide an exact Node.js installation path when nvm is available',
);
assert.match(
  filter,
  /"node"\s*:\s*"22\.20\.0"[\s\S]*corepack pnpm add @qfei-design\/make-app-filter@\^1\.0\.0/,
  'make-app-filter must add its dependency with the declared pnpm version',
);
assert.match(
  auth,
  /MAKE_APP_LOCAL_PREVIEW=true corepack pnpm run dev[\s\S]*Node\.js `22\.20\.0`/,
  'make-app-auth local preview must not use an ambient pnpm binary',
);
assert.match(
  canvas,
  /Make App:[\s\S]*Node\.js `22\.20\.0`/,
  'CanvasTable Make App installs must require the Make Node.js baseline',
);
assert.match(
  canvas,
  /Make App:[\s\S]*corepack pnpm add @qfei-design\/canvas-table/,
  'CanvasTable Make App installs must resolve through the Make runtime baseline',
);
assert.match(
  canvas,
  /If no lockfile exists:[\s\S]*Make App:[\s\S]*corepack pnpm add @qfei-design\/canvas-table/,
  'CanvasTable must not fall back to npm when a new Make App has no lockfile yet',
);
assert.match(
  canvas,
  /non-Make pnpm project:[\s\S]*pnpm add @qfei-design\/canvas-table/,
  'CanvasTable must preserve the existing pnpm workflow for non-Make projects',
);
assert.match(
  cli,
  /corepack pnpm run verify:publish[\s\S]*Node\.js `22\.20\.0`/,
  'makecli publishing guidance must preserve the Make App pnpm baseline',
);

const makeAppMarkdownFiles = fs.readdirSync(path.join(repoRoot, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('make-app-'))
  .flatMap((entry) => listMarkdownFiles(path.join('skills', entry.name)));

for (const relativePath of makeAppMarkdownFiles) {
  assert.doesNotMatch(
    read(relativePath),
    /(?<!corepack\s)\bpnpm\s+(?:add|install|run|--filter)\b/,
    `${relativePath} must not direct Make App package commands to an ambient pnpm binary`,
  );
}

console.log('pnpm version contract passed');
