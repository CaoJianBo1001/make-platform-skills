#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const filterSkill = read('skills/make-app-filter/SKILL.md');
const filterIntegration = read('skills/make-app-filter/references/package-integration.md');
const filterStyle = read('skills/make-app-filter/references/ui-style.md');
const filterTesting = read('skills/make-app-filter/references/testing-and-pitfalls.md');
const filterAgent = read('skills/make-app-filter/agents/openai.yaml');
const mobileDefaults = read('skills/makeui/references/mobile-defaults.md');

assert.match(filterSkill, /make-app-filter@\^1\.1\.0/);
assert.match(filterSkill, /make-app-mobile@\^0\.1\.11/);
assert.match(filterIntegration, /MobileFilterSheet/);
assert.match(filterIntegration, /MobileFilterSelect/);
assert.match(filterIntegration, /Search-only phone lists do not require `MobileFilterSheet`/i);
assert.match(filterStyle, /MobileFilterSheet[\s\S]*?layout="mobile"/);
assert.match(filterStyle, /32px[\s\S]*?(?:className|mobile control class)/i);
assert.match(filterStyle, /MobileDateField[\s\S]*?MobileDateRangeField/);
assert.match(filterStyle, /layout="mobile"[\s\S]{0,250}disabled=\{saving\}/);
assert.match(filterStyle, /showTime[\s\S]*?(?:MobileDateTimeField|时间范围)/);
assert.match(filterIntegration, /<AdvancedFilterPanel[\s\S]{0,180}disabled=\{saving\}/);
assert.match(filterTesting, /远程搜索[\s\S]*?已选值[\s\S]*?回显/);
assert.match(filterTesting, /(?:32px|middle)[\s\S]*?日期/);
assert.match(filterTesting, /desktop\/tablet[\s\S]*?relation[\s\S]*?32px/i);
assert.match(mobileDefaults, /MobileFilterSheet/);
assert.match(mobileDefaults, /MobileFilterSelect/);
assert.match(filterAgent, /MobileFilterSheet/);

console.log('mobile filter release contract verified');
