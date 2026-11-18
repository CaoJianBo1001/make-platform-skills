#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test, { after } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = mkdtempSync(path.join(tmpdir(), 'bpm binding contract '));
const names = ['make-app-approval', 'make-app-service', 'make-app-permission', 'makeui', 'makedsl'];
for (const name of names) cpSync(path.join(root, 'skills', name), path.join(fixture, 'skills', name), { recursive: true });
after(() => rmSync(fixture, { recursive: true, force: true }));

const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/test-bpm-entity-bindings-contract.mjs'), fixture], { encoding: 'utf8' });
const mutate = (file, change, check) => {
  const target = path.join(fixture, file);
  const original = readFileSync(target, 'utf8');
  try { writeFileSync(target, change(original)); check(run()); }
  finally { writeFileSync(target, original); }
};
const reference = 'skills/make-app-approval/references/entity-bindings.md';

test('普通新建验收必须由独立绑定查询成功未命中决定', () => {
  const file = 'skills/make-app-approval/references/verification.md';
  const document = readFileSync(path.join(root, file), 'utf8');
  assert.equal(/Schema\s*成功且无\s*key/.test(document), false, '不能保留 Schema 无 key 决定普通新建的旧验收');
  const row = document.split('\n').find(line => line.startsWith('| 当前对象可访问，绑定查询成功且未命中 |'));
  assert.ok(row, '宿主矩阵应覆盖对象访问资格及绑定查询成功未命中');
  assert.match(row, /普通字段集/);
  assert.match(document, /绑定查询加载中或失败[^\n]*不[^\n]*普通新建/);
});

test('真实文件恢复旧的 Schema 无 key 验收行必须被检查发现', () => {
  const file = 'skills/make-app-approval/references/verification.md';
  mutate(file, original => `${original}\n| Schema 成功且无 key | 普通字段集，保存不调用启动配置/发起接口 |\n`, result => {
    assert.notEqual(result.status, 0, '旧验收行仍能通过检查');
    assert.ok(result.stderr.includes(file), result.stderr);
  });
});

test('当前合同分别说明新建、已有记录发起、普通编辑和历史授权', () => {
  const document = readFileSync(path.join(root, reference), 'utf8');
  const rows = document.split('\n').filter(line => line.startsWith('|'));
  const start = rows.find(line => line.startsWith('| 已有记录直接发起 |'));
  assert.ok(start, '缺少已有记录直接发起的独立授权规则');
  assert.match(start, /Workflow/);
  assert.match(start, /不[^|]*START/);
  assert.match(start, /不[^|]*CRUD/);
  const edit = rows.find(line => line.startsWith('| 已有记录普通编辑 |'));
  assert.ok(edit, '缺少已有记录普通编辑的独立授权规则');
  assert.match(edit, /不依赖/);
  assert.match(edit, /IAM[^|]*状态[^|]*锁/);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
});

const legacy = [
  ['skills/make-app-approval/references/generation-rules.md', '审批新建从成功返回的 Schema 读取对象的 bpmDefinitionKey。'],
  ['skills/makedsl/SKILL.md', '`bpmDefinitionKey` 由运行时 Meta 返回。'],
  ['skills/make-app-service/SKILL.md', '根据字段 key 再调用 /make/workflow/v1/bpm-node-form-metadata 获取审批字段元数据。'],
  ['skills/make-app-permission/references/ui-permission-runtime.md', 'Schema 对象顶层包含有效 bpmDefinitionKey，按它切换审批新建。'],
  ['skills/makeui/references/component-usage.md', 'Read bpmDefinitionKey from Schema to decide approval creation.'],
  ['skills/make-app-approval/references/workflow-api.md', 'POST /make/meta/entity/query/bpm-definitions 查询流程绑定。'],
  ['skills/make-app-approval/assets/standalone-page-boundaries.mjs', '\nconst definition = schema.entities[0].bpmDefinitionKey;'],
  ['skills/make-app-approval/references/initiation-contract.md', '\nconst definition = schema.entities[0]["bpmDefinitionKey"];'],
  ['skills/make-app-approval/references/form-metadata.md', '旧完整字段对象格式继续兼容。'],
];
for (const [file, injected] of legacy) {
  test(`实际文件故障注入应拦截旧指导：${file} / ${injected.trim()}`, () => {
    mutate(file, original => `${original}\n${injected}\n`, result => {
      assert.notEqual(result.status, 0, `旧逻辑重新出现仍通过：${file}`);
      assert.ok(result.stderr.includes(file), `失败应定位注入文件：${result.stderr}`);
    });
  });
}

test('明确禁止旧来源和说明旧接口已移除的文字允许保留', () => {
  mutate(reference, original => `${original}\n禁止从 Schema 读取 bpmDefinitionKey；旧 /make/meta/entity/query/bpm-definitions 已移除；不得调用 bpm-node-form-metadata。\n`, result => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test('新接口结果仍允许读取 bpmDefinitionKey，不因变量名 entity 误报', () => {
  mutate('skills/make-app-approval/assets/standalone-page-boundaries.mjs', original => `${original}\nconst definitions = await getBpmEntityDefinitions(["claim"]);\nconst entity = definitions[0];\nconst definition = entity.bpmDefinitionKey;\n`, result => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test('同一行的禁止说明不能掩盖随后恢复旧取值的正向指导', () => {
  mutate(reference, original => `${original}\n不要相信旧配置；实际从 Schema 返回的 bpmDefinitionKey 判断审批。\n`, result => {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(reference));
  });
});

test('不能重新把所有发起动作套用启动节点授权', () => {
  mutate(reference, original => `${original}\nService 在保存、发起、预上传和 START Lookup 边界重新查询当前绑定，再使用启动节点授权。\n`, result => {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(reference));
  });
});

test('删除已有记录发起的独立授权行会失败', () => {
  mutate(reference, original => original.split('\n').filter(line => !line.startsWith('| 已有记录直接发起 |')).join('\n'), result => {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(reference));
  });
});
