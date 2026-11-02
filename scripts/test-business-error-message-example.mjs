#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 执行随 Skill 分发的示例，校验提取行为；不以文档关键词代替行为验证。
const document = readFileSync(new URL('../skills/make-app-observability/references/business-error-message.md', import.meta.url), 'utf8');
const example = [...document.matchAll(/```js\n([\s\S]*?)\n```/g)]
  .map(match => match[1]).find(source => source.includes('export function readPublicBusinessMessage('));
assert.ok(example, '公共业务错误合同必须随包携带可执行示例');
const { readPublicBusinessMessage: read } = await import(`data:text/javascript;base64,${Buffer.from(example).toString('base64')}`);
const reasons = [
  '未找到下一环节审批人，请联系审批管理员甲配置',
  '审批人未激活，请联系审批管理员乙处理',
  '数量必须 < 100，字段 UPDATE 不可为空',
  '业务说明：' + '请修正所选数据。'.repeat(100),
];
for (const msg of reasons) {
  const payload = Object.freeze({ code: 41000022, msg, message: '低优先级内容' });
  assert.equal(read(payload), msg);
  assert.equal(read({ ...payload, code: 987654 }), msg, '未知业务码不覆盖有效文案');
}
for (const msg of [undefined, null, '', '   ', 0, [], { detail: '不是字符串' }]) {
  assert.equal(read({ msg, message: reasons[0] }), reasons[0]);
  assert.equal(read({ msg, message: null, error: 'private diagnostics', stack: 'private stack' }), undefined);
}
for (const payload of [new Error('raw error'), null, undefined, [], 'raw body', 123]) {
  assert.equal(read(payload), undefined);
}
assert.equal(read({ msg: '  保留正文  ' }), '  保留正文  ');
console.log('公共业务错误文案示例行为验证通过');
