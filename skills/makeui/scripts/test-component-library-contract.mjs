#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, '..');

const read = (relativePath) => fs.readFileSync(path.join(skillDir, relativePath), 'utf8');

const skill = read('SKILL.md');
const componentUsage = read('references/component-usage.md');
const drawerLayout = read('references/drawer-layout.md');
const principles = read('references/principles.md');
const styling = read('references/styling-and-responsive.md');
const combined = `${skill}\n${componentUsage}\n${drawerLayout}\n${principles}\n${styling}`;
const removedLibrariesPattern = [
  ['Ant', ' Design'].join(''),
  ['Ant', 'D'].join(''),
  ['Ar', 'co', ' Design'].join(''),
  ['T', 'Design'].join(''),
  ['Kumo', ' UI'].join(''),
  ['Primer', ' React'].join(''),
  ['an', 'td'].join(''),
  'arco',
  ['@ant', '-design'].join(''),
  ['@cloudflare', '/kumo'].join(''),
  ['@pri', 'mer'].join(''),
  ['create', 'Antd'].join(''),
]
  .map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

assert.doesNotMatch(
  combined,
  new RegExp(`(?:${removedLibrariesPattern})`, 'i'),
  'makeui must not keep removed component-library candidates, package names, or adapter names',
);

assert.match(
  componentUsage,
  /shadcn\/ui[\s\S]*(platform default|默认组件系统|default component system)/i,
  'new Make UI projects must use shadcn/ui as the platform default component system',
);

[
  'Tailwind CSS',
  '@tailwindcss/vite',
  '@/*',
  'src/components/ui',
  'lucide-react',
].forEach((requiredText) => {
  assert.match(
    componentUsage,
    new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `shadcn/ui guidance must document ${requiredText}`,
  );
});

assert.match(
  componentUsage,
  /(pnpm dlx|npx|yarn dlx|bunx) shadcn@latest init/,
  'shadcn/ui guidance must document running init through a package runner',
);

assert.match(
  componentUsage,
  /(pnpm dlx|npx|yarn dlx|bunx) shadcn@latest add/,
  'shadcn/ui guidance must document adding components through a package runner',
);

assert.match(
  componentUsage,
  /(legacy all-in-one|缺口|gap|missing)[\s\S]*(do not|must not|不得|不能)[\s\S]*(another UI library|UI suite|组件库)/i,
  'component usage must explain how to handle components shadcn/ui does not provide without reintroducing another UI library',
);

assert.match(
  componentUsage,
  /(Date Picker|date picker)[\s\S]*Popover[\s\S]*Calendar/i,
  'date fields must map to shadcn/ui Date Picker composition through Popover and Calendar',
);

assert.match(
  componentUsage,
  /(Combobox|Command)[\s\S]*(remote|search|multi|候选|多选)/i,
  'searchable and multi-value selectors must map to shadcn/ui combobox/command-style controlled adapters',
);

assert.match(
  componentUsage,
  /(Attachment|attachment)[\s\S]*(native input|dropzone|upload|上传)/i,
  'file fields must map to shadcn/ui Attachment display plus project-owned upload/dropzone behavior',
);

assert.doesNotMatch(
  drawerLayout,
  /layout="vertical"|colon=\{false\}|`Drawer` on the right/,
  'Drawer layout must not prescribe library-specific Form props or a concrete Drawer component as the default baseline',
);

assert.match(
  drawerLayout,
  /right-side (?:panel|surface)[\s\S]*Sheet[\s\S]*side="right"/i,
  'Drawer layout must map the default right-side surface to shadcn/ui Sheet side="right"',
);

assert.match(
  styling,
  /Tailwind CSS[\s\S]*shadcn\/ui/i,
  'styling defaults must align with shadcn/ui Tailwind CSS setup',
);

console.log('makeui component library contract passed');
