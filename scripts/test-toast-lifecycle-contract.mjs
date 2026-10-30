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
console.log('Toast 生命周期文档合同通过；发布和宿主行为须独立验证');
