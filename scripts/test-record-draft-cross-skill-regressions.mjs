#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = path.join(root, 'scripts/test-record-drafts-and-field-defaults-contract.mjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'record-draft-cross-skill-'));
const source = file => fs.readFileSync(path.join(temporary, file), 'utf8');
const run = () => spawnSync(process.execPath, [contract, temporary], { encoding: 'utf8', timeout: 15000 });
const api = 'skills/make-app-service/references/service-api-contracts.md';
const controls = 'skills/makeui/references/mobile-form-controls.md';
const cases = [
  ['blanket Workflow state exclusion', api,
    text => text.replace(/^普通无草稿项目不生成按钮、字段或过滤。[^\n]+/m,
      '单元格、批量、附件、关系和 Workflow 不继承整单保存的参数或状态注入。'),
    /Workflow must not be blanket-excluded/],
  ['fixed single-action mobile standard', 'skills/makeui/references/mobile-visual-standard.md',
    text => text.replace(/^- 新建／编辑按[^\n]+/m,
      '- 新建／编辑底部保存／提交使用 MobileFormActionBar，单个按钮无图标、靠右并保留安全区。'),
    /save-intent matrix must be authoritative/],
  ['obsolete two-action anchor', 'skills/makeui/references/mobile-defaults.md',
    text => text.replace('mobile-form-controls.md#表单保存意图矩阵', 'mobile-form-controls.md#审批新建的双按钮例外'),
    /save-intent matrix must be authoritative|stale fixed-two-action guidance|broken section/],
  ['fixed-two validation wording', 'skills/make-app-approval/references/initiation-contract.md',
    text => text.replace(/^- “保存”和“保存并提交”均沿用[^\n]+/m,
      '- 两个保存动作均沿用必填和字段类型校验；不能用普通保存绕过必填。'),
    /approval instructions must not retain the old fixed-two-action rule/],
  ['missing combined-submit normal state', 'skills/make-app-service/references/business-record-drafts.md',
    text => text.replace('"bpmKey":"<enabled-process-key>","data":{"title":"完整内容","saveState":"normal"}',
      '"bpmKey":"<enabled-process-key>","data":{"title":"完整内容"}'),
    /record\/combined submit must explicitly write the project save state/],
  ['unsolicited draft intent', controls,
    text => text.replace('if (draftEnabled === true)', 'if (true)'),
    /save-intent matrix must preserve opt-in behavior/],
  ['state injection on existing starts/tasks', api,
    text => text.replace('已有记录发起 `/workflow/v1/bpm-process` 与任务办理 `/workflow/v1/bpm-task` 不自动注入或改写保存状态',
      '已有记录发起 `/workflow/v1/bpm-process` 与任务办理 `/workflow/v1/bpm-task` 也自动注入正常保存状态'),
    /existing starts and tasks must keep their own payloads/],
  ['two-only host fallback', controls,
    text => text.replace('两个或三个 Button', '两个 Button'),
    /stale fixed-two-action guidance|single-action public APIs need a documented two\/three-action host composition/],
];

try {
  fs.cpSync(path.join(root, 'skills'), path.join(temporary, 'skills'), { recursive: true });
  const baseline = run();
  assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
  for (const [name, file, mutate, expected] of cases) {
    const original = source(file);
    const mutated = mutate(original);
    assert.notEqual(mutated, original, `mutation did not apply: ${name}`);
    try {
      fs.writeFileSync(path.join(temporary, file), mutated);
      const result = run();
      assert.notEqual(result.status, 0, `contract accepted regression: ${name}`);
      assert.match(result.stdout + result.stderr, expected, `unrelated failure: ${name}`);
    } finally {
      fs.writeFileSync(path.join(temporary, file), original);
    }
  }
  console.log(`record draft cross-Skill regression guards: ${cases.length}/${cases.length} rejected; clean baseline passed`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
