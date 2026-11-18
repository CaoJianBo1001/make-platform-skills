#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBpmField } from '../skills/make-app-approval/assets/bpm-node-form-metadata.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const policyPath = 'skills/make-app-service/references/business-record-drafts.md';
const uiPath = 'skills/makeui/references/record-drafts-and-defaults.md';
const policy = read(policyPath);
const ui = read(uiPath);
const field = read('skills/makedsl/references/FieldDesign.md');
const data = read('skills/makedsl/references/DataAPIDesign.md');
let checks = 0;
const requireText = (text, pattern, description) => {
  assert.match(text, pattern, description);
  checks++;
};

for (const name of ['makedsl', 'make-app-service', 'makeui', 'make-app-approval',
  'make-app-actions', 'canvas-table-integration', 'make-app-filter', 'make-app-group',
  'make-app-permission', 'make-ai-assistant', 'makecli']) {
  const source = read(`skills/${name}/SKILL.md`);
  requireText(source, /business-record-drafts\.md|record-drafts-and-defaults\.md/,
    `${name} must route the optional capability to its contract`);
}
requireText(policy, /没有草稿需求时，不主动要求用户选择，不添加草稿按钮、保存状态字段或额外过滤/,
  'ordinary generation must remain free of unsolicited draft features');
requireText(policy, /字段默认值是独立能力，不以启用草稿为前提/, 'defaults are independent');
requireText(policy, /按 entityKey 显式登记状态 fieldKey、正常值、草稿值/,
  'the project owns the mapping; no platform field or name heuristic');
requireText(policy, /不能用可见 `fields` 代替 `createFields`/, 'create-only fields remain valid');
requireText(policy, /BPM START 字段白名单/, 'generated values respect START authorization');
requireText(policy, /单元格、批量、附件、关系等局部修改[\s\S]*不注入、不改变原保存状态/,
  'partial writes must not promote a persisted draft');
requireText(policy, /普通 Update 只校验已提交字段[\s\S]*整条记录[\s\S]*|整条记录[\s\S]*普通 Update 只校验已提交字段/,
  'promotion must handle incomplete stored drafts');
requireText(policy, /不新增普通记录读取权限要求/, 'promotion must not invent an IAM read gate');
requireText(policy, /内容与状态尽可能在同一授权写入中提交/, 'state and content share the write');
requireText(policy, /已有正式效果不能只靠改标识撤销/, 'downgrading consumed data needs its original policy');
requireText(policy, /isDraft=true` 却省略业务状态[\s\S]*默认 normal/,
  'all write ingress must preserve the state invariant despite the normal default');
requireText(policy, /必要附件\/关系仍未完成[\s\S]*正式业务效果/,
  'partial writes must not claim atomic formal publication');

const blocks = [...policy.matchAll(/```http\n([\s\S]*?)```/g)].map(match => match[1].trim());
assert.equal(blocks.length, 2);
for (const [index, block] of blocks.entries()) {
  const lines = block.split('\n');
  const request = new URL(lines[0].split(' ')[1], 'https://gateway.example');
  const body = JSON.parse(lines.at(-1));
  assert.equal(lines[0].split(' ')[0], 'POST');
  assert.equal(request.pathname, '/api/make/data/v1/record');
  assert.equal(request.searchParams.get('isDraft'), index === 0 ? 'true' : 'false');
  assert.equal(request.searchParams.getAll('isDraft').length, 1);
  assert.equal(lines[1], `X-Make-Target: MakeService.${index === 0 ? 'Create' : 'Update'}Resource`);
  assert.equal(body.data.saveState, index === 0 ? 'draft' : 'normal');
  assert.equal('isDraft' in body, false);
  assert.equal('isDraft' in body.data, false);
  if (index === 1) assert.equal(body.recordID, '<original-id>');
  checks++;
}
requireText(data, /空值、重复参数[\s\S]*HTTP 状态为 `200`[\s\S]*`code` 为 `400`/,
  'invalid draft parameters are not successful HTTP200 writes');
requireText(data, /保存回调仍会执行/, 'platform callbacks are not automatically disabled');
requireText(data, /批量更新字段、文件接口、内部服务及工作流调用本次不扩展草稿参数/,
  'do not invent parameters for unrelated platform endpoints');
requireText(policy, /允许列表[\s\S]*不要使用 `saveState != 'draft'`/, 'unknown values are not formal data');
for (const topic of ['分子和分母', '关联成员', 'Rollup', '正式口径切换前', 'Webhook', 'AI/RAG/工具数据',
  '已有投影', '用户清空筛选、OR 条件或 Preset', '显式 ID 集合', 'select-all', '缓存', '实际消费者及其责任边界']) {
  assert.ok(policy.includes(topic), `missing consumer policy: ${topic}`);
  checks++;
}

requireText(field, /`defaultValue` 是字段顶层可选属性，与 `properties`、`validations` 平级/,
  'defaults use the actual field contract');
requireText(field, /不增加 `type` \/ `value` 包装/, 'no invented default-value DTO');
for (const type of ['Text', 'TextArea', 'Number', 'SingleSelect', 'MultiSelect', 'Date', 'DateTime',
  'DateRange', 'Percent', 'Currency', 'URL', 'SingleUser', 'MultiUser', 'SingleDepartment', 'MultiDepartment']) {
  assert.ok(field.includes(`| ${type} |`), `missing default value format for ${type}`);
  checks++;
}
requireText(field, /只在创建 Record 时，对请求 `data` 中未出现字段 key 的字段补齐/,
  'missing key differs from explicit empty values');
requireText(field, /更新记录，包括批量更新或将已有字段清空 \| 不补默认值/,
  'defaults do not refill updates');
requireText(field, /不回填、不修改已有记录/, 'defaults do not migrate historical rows');
requireText(field, /ID \| 不支持非 `null` 默认值/, 'generated IDs are not fixed defaults');
requireText(field, /File \| 本期不支持非 `null` 默认值/, 'files still use upload');
requireText(field, /Lookup \/ Rollup \/ Count \/ Formula \| 不支持非 `null` 默认值/,
  'derived fields are not writable defaults');
requireText(ui, /默认值初始化仅一次[\s\S]*提交失败及用户主动清空不得重新覆盖用户输入/,
  'refreshes and failed saves preserve user edits');
requireText(ui, /普通保存明确未落库[\s\S]*结束 pending[\s\S]*允许修正后再次保存/,
  'definite failed writes release the ordinary form');
requireText(ui, /写入结果未知[\s\S]*防重复创建保护/, 'unknown writes remain guarded');

// Execute the actual bundled normalizer: metadata defaults must survive the
// conversion boundary, without being invented when the upstream omitted them.
for (const [type, value, properties] of [
  ['Number', 0, {}], ['Text', '', {}], ['Text', null, {}],
  ['MultiSelect', [], { options: [{ label: 'A', value: 'a' }] }],
  ['DateRange', { begin: '2026-11-01', end: '2026-11-18' }, {}],
]) {
  const source = { key: 'example', name: '示例', type: `Make.Field.${type}`, properties, defaultValue: value };
  const original = structuredClone(source);
  const actual = normalizeBpmField(source);
  assert.deepEqual(actual.defaultValue, value);
  assert.equal(Object.hasOwn(actual, 'defaultValue'), true);
  assert.equal(Object.hasOwn(actual.properties, 'defaultValue'), false);
  assert.deepEqual(source, original);
  checks++;
}
assert.equal(Object.hasOwn(normalizeBpmField({ key: 'example', name: '示例', type: 'Make.Field.Text' }), 'defaultValue'), false);
checks++;

// Resolve local Markdown links from all newly authored contract paragraphs.
const changedDocs = [policyPath, uiPath];
const slug = heading => heading.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
for (const name of changedDocs) {
  for (const match of read(name).matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^[a-z]+:\/\//i.test(target)) continue;
    const [file, fragment] = target.split('#');
    const resolved = file ? path.resolve(root, path.dirname(name), file) : path.join(root, name);
    assert.ok(resolved.startsWith(root + path.sep));
    assert.ok(fs.existsSync(resolved), `broken reference in ${name}: ${target}`);
    if (fragment) {
      const headings = [...fs.readFileSync(resolved, 'utf8').matchAll(/^#+ (.+)$/gm)].map(m => slug(m[1]));
      assert.ok(headings.includes(fragment), `broken section in ${name}: ${target}`);
    }
    checks++;
  }
}
console.log(`record draft/default contracts: ${checks} checks passed, including bundled metadata normalization; host behavior is verified separately`);
