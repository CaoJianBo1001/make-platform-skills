import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const integration = read('skills/make-app-observability/references/package-integration.md');
const feedback = read('skills/makeui/references/permission-feedback.md');
const verification = read('skills/make-app-observability/references/testing-and-audit.md');
// 静态文档一致性回归，不证明已发布版本或组件计时行为。
for (const source of [integration, feedback]) {
  for (const token of ['noticeKey', 'duration', 'onClose', '3 秒', '0.1.9']) {
    assert.ok(source.includes(token), `生命周期合同缺少 ${token}`);
  }
  assert.match(source, /不重复.*计时器/);
  assert.match(source, /不能.*0\.1\.9.*自动关闭/);
}
assert.doesNotMatch(feedback, /Toast component does not start a timer|host owns duration/);
assert.match(verification, /自动关闭.*队列/);
assert.match(verification, /noticeKey/);

// 推荐版本与能力起点分开：0.1.11 同步公共文案合同，计时能力始于 0.1.10。
const skill = read('skills/make-app-observability/SKILL.md');
for (const source of [skill, integration]) {
  assert.match(source, /\^0\.1\.11/);
  assert.doesNotMatch(source, /\^0\.1\.10/);
}
assert.match(integration, /0\.1\.11[^\n]*公共[^\n]*文案/);
assert.match(integration, /0\.1\.10[^\n]*计时/);
console.log('Toast 生命周期及推荐版本合同通过；发布和宿主行为须独立验证');
