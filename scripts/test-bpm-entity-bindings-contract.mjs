#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 参数用于隔离副本故障注入，也可检查实际安装根目录（其下包含 skills/）。
const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const skills = ['make-app-approval', 'make-app-service', 'make-app-permission', 'makeui', 'makedsl'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const reference = 'skills/make-app-approval/references/entity-bindings.md';
assert.ok(fs.existsSync(path.join(root, reference)), '缺少独立实体绑定接入合同');
const contract = read(reference);
for (const marker of [
  '/make/workflow/v1/bpm-entity-definitions', 'MakeService.GetResource',
  'entityKeys', 'bpmDefinitionKey', 'data: []',
  '不代表发起权限', '不回退', '迟到', '已保存', '历史',
]) assert.ok(contract.includes(marker), `${reference} 缺少合同：${marker}`);
assert.ok(read('skills/make-app-approval/SKILL.md').includes('(references/entity-bindings.md)'), '审批入口未发现实体绑定合同');
for (const name of skills.slice(1)) {
  assert.ok(read(`skills/${name}/SKILL.md`).includes('entity-bindings.md'), `${name} 未交接独立查询合同`);
}

const verificationFile = 'skills/make-app-approval/references/verification.md';
const verification = read(verificationFile);
assert.ok(verification.includes('| 当前对象可访问，绑定查询成功且未命中 |'), `${verificationFile} 缺少独立绑定未命中的普通新建验收`);
assert.ok(verification.includes('| 绑定查询加载中或失败 |'), `${verificationFile} 缺少绑定未就绪的拒绝降级验收`);

// 表中逐操作校验权限来源，避免通用的“保存/发起”规则吞掉已有记录例外。
const row = name => {
  const line = contract.split('\n').find(value => value.startsWith(`| ${name} |`));
  assert.ok(line, `${reference} 缺少操作边界：${name}`);
  return line.split('|').slice(1, -1).map(cell => cell.trim());
};
const start = row('已有记录直接发起');
assert.equal(start[1], '查询', `${reference} 已有记录发起必须核验当前绑定`);
assert.match(start[2], /Workflow/, `${reference} 发起资格交由 Workflow 校验`);
assert.match(start[2], /不[^|]*START/, `${reference} 已有记录发起不能要求 START 字段`);
assert.match(start[2], /不[^|]*CRUD/, `${reference} 已有记录发起不能附加普通 CRUD 权限`);
const edit = row('已有记录普通编辑');
assert.equal(edit[1], '不依赖', `${reference} 普通编辑不能依赖当前绑定查询`);
assert.match(edit[2], /IAM[^|]*状态[^|]*锁/, `${reference} 普通编辑保留 IAM、状态和锁`);
for (const name of ['新建保存／保存并提交', '新建预上传／START Lookup']) {
  const operation = row(name);
  assert.equal(operation[1], '查询', `${reference} ${name} 必须核验绑定`);
  assert.match(operation[2], /START/, `${reference} ${name} 须交接启动字段授权`);
}
for (const name of ['任务详情／办理', '实例详情／历史／合法撤回']) {
  assert.equal(row(name)[1], '不依赖', `${reference} ${name} 不依赖当前绑定`);
}

const walk = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true })
  .sort((a, b) => a.name.localeCompare(b.name))
  .flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const files = skills.flatMap(name => walk(`skills/${name}`))
  .filter(file => /\.(?:md|mjs|js|ts|tsx|json|ya?ml)$/.test(file));
const oldSource = [
  /(?:Schema|Meta)[^\n]{0,100}(?:读取|获取|返回|提供|提取|含有|含有效|存在|包含)[^\n]{0,100}bpmDefinitionKey/i,
  /bpmDefinitionKey[^\n]{0,100}(?:来自|由|从|位于|在)[^\n]{0,100}(?:Schema|Meta)/i,
  /(?:read|get|extract|obtain)\b[^\n]{0,100}bpmDefinitionKey[^\n]{0,100}\bfrom\b[^\n]{0,50}(?:Schema|Meta)/i,
  /preserve\s+entity-level\s+[`'"]?bpmDefinitionKey/i,
  /运行时\s*Schema\s*key\s*(?:判定|判断)/i,
  /\b(?:schema|appSchema)(?:\?\.|\.)entities[^\n;]{0,160}(?:\.\s*bpmDefinitionKey|\[\s*['"]bpmDefinitionKey['"]\s*\])/,
];
// 只允许针对旧来源/接口的明确禁止或移除说明；按分句检查，防止无关否定掩盖正向指导。
const prohibitsSource = /(?:不再|不能|不得|不要|禁止|不允许|不)(?:从|读取|获取|使用|消费|依赖|提供|返回|取值|回退)[^\n]{0,100}(?:Schema|Meta)|(?:Schema|Meta)[^\n]{0,30}(?:不提供|不返回|不包含|不得|不能|不再)|\b(?:never|do not|must not|no longer)\b/i;
const removedApi = /bpm-node-form-metadata|\/(?:make\/)?meta\/entity\/query\/bpm-definitions/;
const prohibitsApi = /已移除|已删除|已废弃|不得调用|不再调用|禁止调用|不要调用|不调用|不能调用|\bremoved\b|\bdeprecated\b|\b(?:never|do not|must not)\b/i;
const failures = [];
for (const file of files) {
  const lines = read(file).split('\n');
  lines.forEach((line, index) => {
    if (/^\|\s*Schema\s*成功且无\s*key\s*\|/i.test(line)) {
      failures.push(`${file}:${index + 1}：旧验收仍以 Schema 无 key 判断普通新建`);
    }
    if (/Service\s*在保存、发起、预上传和\s*START\s*Lookup[^。\n]*再使用启动节点授权/.test(line)) {
      failures.push(`${file}:${index + 1}：已有记录发起与启动字段授权混写`);
    }
    for (const clause of line.split(/[。；;，,]/)) {
      if (oldSource.some(pattern => pattern.test(clause)) && !prohibitsSource.test(clause)) {
        failures.push(`${file}:${index + 1}：仍指导从 Schema／Meta 获取绑定`);
      }
      if (removedApi.test(clause) && !prohibitsApi.test(clause)) {
        failures.push(`${file}:${index + 1}：仍使用已移除的 BPM 接口或配套资源`);
      }
      if (/旧完整字段对象(?:格式)?(?:继续|仍然)?兼容/.test(clause)) {
        failures.push(`${file}:${index + 1}：仍保留旧完整字段对象回退`);
      }
    }
  });
}
assert.equal(failures.length, 0, failures.join('\n'));
console.log(`PASS：BPM 独立绑定来源、6 类操作边界及 ${files.length} 个跨 Skill 文件`);
