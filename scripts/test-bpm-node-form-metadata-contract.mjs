import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const approval = read('skills/make-app-approval/SKILL.md');
const workflow = read('skills/make-app-approval/references/workflow-api.md');
const initiation = read('skills/make-app-approval/references/initiation-contract.md');
const detail = read('skills/make-app-approval/references/task-detail.md');
const verification = read('skills/make-app-approval/references/verification.md');
const service = read('skills/make-app-service/SKILL.md');
const conversion = read('skills/make-app-approval/references/node-form-metadata.md');

// 本文件只检查文档接线；行为验证由 test-bpm-node-form-metadata-behavior.mjs 执行。
for (const path of ['references/node-form-metadata.md', 'assets/bpm-node-form-metadata.mjs',
  'scripts/verify-node-form-metadata.mjs', 'scripts/fixtures/node-form-metadata.json']) {
  assert.ok(approval.includes(`](${path})`), `${path} 必须从 Skill 入口可发现`);
}
assert.match(workflow, /\]\(node-form-metadata\.md\)/);
assert.match(initiation, /\]\(node-form-metadata\.md\)/);
assert.match(conversion, /18/);
assert.match(verification, /verify-node-form-metadata\.mjs/);

for (const source of [approval, workflow, initiation, detail, service]) {
  assert.match(source, /bpm-node-form-metadata/, '审批字段来源必须指向节点元数据接口');
}
assert.match(workflow, /scene: ["']START["'][^\n]*appKey[^\n]*processKey/, '发起参数应由部署应用和启动配置确定');
assert.match(workflow, /scene: ["']TASK["'][^\n]*processInstanceId[^\n]*taskId/, '任务只传 TASK 定位');
assert.match(workflow, /不[^\n]*混传/, '两种场景不得混传参数');
assert.match(workflow, /fields[^\n]*properties[^\n]*validations/, '完整字段配置不能只保留名称和类型');
assert.match(workflow, /不[^\n]*formData[^\n]*fieldPermission[^\n]*actions/, '元数据不能替代任务值、权限和操作');
assert.match(verification, /已完成[^\n]*节点元数据/, '应验证已完成任务可读');
for (const source of [approval, workflow, initiation, detail, service]) {
  assert.doesNotMatch(source, /字段基础(?:信息|定义)统一(?:由|通过|读取) Meta[^\n]*entity/,
    '不能继续将普通 entity 作为 BPM 源字段定义的统一来源');
}
const linkedContracts = [
  'skills/make-app-permission/SKILL.md',
  'skills/make-app-permission/references/testing-and-audit.md',
  'skills/make-app-permission/references/ui-permission-runtime.md',
  'skills/makeui/references/component-usage.md',
  'skills/makedsl/references/MetaAPIDesign.md',
];
for (const file of linkedContracts) {
  const source = read(file);
  assert.doesNotMatch(source, /(?:字段定义|字段基础信息|基础定义)[^。\n]*(?:读取 Meta Entity|来自未做字段权限裁剪的 Meta|Entity GetResource 补)/,
    `${file} 不得继续引导用普通 Entity 补 BPM 源字段`);
  assert.doesNotMatch(source, /Entity 详情返回全部自定义字段，不按当前调用方的字段读取权限裁剪/,
    `${file} 不得承诺普通 Entity 绕过字段权限`);
  assert.match(source, /bpm-node-form-metadata/, `${file} 应与审批节点元数据合同一致`);
}
console.log(`${fileURLToPath(import.meta.url)}：BPM 节点元数据合同通过`);
