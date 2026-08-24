#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, '..');

const read = (relativePath) => fs.readFileSync(path.join(skillDir, relativePath), 'utf8');

const skill = read('SKILL.md');
const drawerLayout = read('references/drawer-layout.md');
const pageRouteLayout = read('references/page-route-layout.md');

assert.match(
  skill,
  /create, edit, and detail[\s\S]*renderable field collection[\s\S]*empty[\s\S]*empty state[\s\S]*field grid[\s\S]*form\/detail panel[\s\S]*border/i,
  'makeui must make the zero-renderable-field presentation rule explicit for every CRUD surface',
);

assert.match(
  skill,
  /zero editable set[\s\S]*(does not trigger|must not trigger)[\s\S]*visible read-only fields/i,
  'makeui must not treat visible read-only edit fields as a zero-field state',
);

assert.match(
  drawerLayout,
  /zero-field state[\s\S]*create[\s\S]*edit[\s\S]*detail[\s\S]*renderable/i,
  'Drawer guidance must define one zero-field rule for create, edit, and detail',
);
assert.match(
  drawerLayout,
  /do not render[\s\S]*(field grid|form panel)[\s\S]*(section panel|card)[\s\S]*(Form\.Item|placeholder)[\s\S]*(border|shadow)/i,
  'Drawer zero-field guidance must remove all empty field-container chrome',
);
assert.match(
  drawerLayout,
  /(center|centre)[\s\S]*(available Drawer body|Drawer body[\s\S]*(center|centre))/i,
  'Drawer zero-field guidance must center the empty state in the available Drawer body',
);

assert.match(
  pageRouteLayout,
  /zero-field[\s\S]*empty state[\s\S]*(border|panel|card)/i,
  'route create/edit/detail pages must share the zero-field chrome-free empty-state rule',
);

console.log('makeui empty field surface contract passed');
