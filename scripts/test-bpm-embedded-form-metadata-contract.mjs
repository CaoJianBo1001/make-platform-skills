import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
for (const path of ['skills/make-app-approval/SKILL.md', 'skills/make-app-approval/references/workflow-api.md', 'skills/make-app-approval/references/initiation-contract.md', 'skills/make-app-approval/references/task-detail.md', 'skills/make-app-approval/references/initiated-instances.md', 'skills/make-app-service/SKILL.md']) {
 const source = read(path);
 assert.match(source, /formMetadata/, `${path} 交接内嵌定义`);
 assert.doesNotMatch(source, /scene\s*:\s*["'](?:START|TASK)["']|再调用[^\n]*元数据|旧完整字段对象格式继续兼容/, `${path} 不保留旧请求或回退`);
}
const workflow = read('skills/make-app-approval/references/workflow-api.md');
for (const endpoint of ['bpm-start-config','bpm-task','bpm-process']) assert.match(workflow, new RegExp(endpoint));
assert.match(workflow, /bpmKey/);
assert.match(workflow, /bpm_resubmit_/);
assert.match(workflow, /当前 Meta/);
assert.match(workflow, /绑定[^\n]*BPM/);
const lookup = read('skills/make-app-approval/assets/bpm-lookup-metadata.mjs');
assert.doesNotMatch(lookup, /canReuseBpmStartMetadata/);
console.log('PASS：三个读取响应的内嵌元数据与旧补查逻辑移除合同');
