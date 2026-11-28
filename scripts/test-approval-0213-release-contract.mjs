import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(`../skills/make-app-approval/${path}`, import.meta.url),'utf8');
const list = read('references/package-and-list.md');
const instance = read('references/initiated-instances.md');
// 保留 0.2.13 起已存在的能力回归，当前正式接入基线为 0.2.17。
assert.match(list, /@qfei-design\/make-app-approval@0\.2\.17/);
assert.match(list, /0\.2\.13/);
assert.match(instance, /0\.2\.16/);
assert.doesNotMatch(instance, /新能力为源码候选|源码候选的|样板可.*候选产物/);
assert.match(instance, /ApprovalInstanceDetail/);
assert.match(instance, /tabs=\{\["pending", "approved", "initiated"\]\}/);
assert.match(instance, /UI 与 Service 同版/);
assert.match(instance, /精确版本/);
console.log('PASS：0.2.17 正式基线保留 0.2.13 已发起与实例能力');
