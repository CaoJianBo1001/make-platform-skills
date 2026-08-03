#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(
    fs.existsSync(filePath),
    `Expected ${relativePath} under repo root ${repoRoot}`,
  );
  return fs.readFileSync(filePath, 'utf8');
};

const skill = read('skills/makeui/SKILL.md');
const componentUsage = read('skills/makeui/references/component-usage.md');
const drawerLayout = read('skills/makeui/references/drawer-layout.md');
const pageRouteLayout = read('skills/makeui/references/page-route-layout.md');

assert.match(
  skill,
  /(自定义|custom)[\s\S]*(表单|form)[\s\S]*(字段|field)[\s\S]*(受控|controlled)/i,
  'makeui must promote custom form field controls as controlled adapters',
);
assert.match(
  skill,
  /value\/onChange\/onBlur\/id\/disabled|value[\s\S]*onChange[\s\S]*onBlur[\s\S]*id[\s\S]*disabled/,
  'makeui must name the required host form controlled props',
);

assert.match(
  componentUsage,
  /(宿主表单|host form)[\s\S]*(受控|controlled)[\s\S]*(自定义字段|custom field|field component)/i,
  'component usage must define a host-form controlled custom field contract',
);
for (const prop of ['value', 'onChange', 'onBlur', 'id', 'disabled']) {
  assert.match(
    componentUsage,
    new RegExp(`\\\`${prop}\\\`|\\b${prop}\\b`),
    `component usage must require ${prop} to be accepted and forwarded`,
  );
}
assert.match(
  componentUsage,
  /(SingleUser|人员)[\s\S]*(SingleDepartment|部门)[\s\S]*(Lookup|关联|lookup)/i,
  'component usage must apply the contract to user, department, and lookup selectors',
);
assert.match(
  componentUsage,
  /(validateFields|form store|表单状态|表单值|form value)[\s\S]*(显示|display|视觉|selected)/i,
  'component usage must require submit/validation state to match the displayed selection',
);
assert.match(
  componentUsage,
  /(local state|内部 state|内部状态)[\s\S]*(must not|do not|不得|不能)[\s\S]*(source of truth|唯一|选中值|selected)/i,
  'component usage must reject local-only selected state as the source of truth',
);
assert.match(
  componentUsage,
  /(Ant Design|AntD|Arco|shadcn|component library|组件库)[\s\S]*(does not require|not require|不要求|不能.*强制|不得.*强制)/i,
  'component usage must keep the contract component-library neutral',
);
for (const line of `${componentUsage}\n${skill}`.split('\n')) {
  assert.doesNotMatch(
    line,
    /(must|必须|require|要求)[^。\n]*(Ant Design|AntD)[^。\n]*(Select|Form\.Item)|(?:必须|要求)[^。\n]*(使用|采用)[^。\n]*(Ant Design|AntD)/i,
    'makeui must not require Ant Design Select/Form.Item for the controlled-field contract',
  );
}

assert.match(
  drawerLayout,
  /(component-usage\.md|controlled|受控)[\s\S]*(form|表单)[\s\S]*(field|字段)/i,
  'drawer layout must route form field controls to the controlled-field contract',
);
assert.match(
  pageRouteLayout,
  /(component-usage\.md|controlled|受控)[\s\S]*(form|表单)[\s\S]*(field|字段)/i,
  'route form pages must route field controls to the controlled-field contract',
);

console.log('makeui controlled field contract passed');
