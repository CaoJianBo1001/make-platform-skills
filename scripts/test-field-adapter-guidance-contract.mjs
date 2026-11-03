import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 文档路由防退化；交互行为由审批包标准示例的真实组件测试证明。
const read = file => readFileSync(new URL(`../skills/makeui/${file}`, import.meta.url), 'utf8');
for (const file of ['SKILL.md', 'references/mobile-form-controls.md', 'references/component-usage.md']) {
  assert.match(read(file), /field-adapter-regressions\.md/, `${file} 必须引导共享字段回归`);
}
const regression = read('references/field-adapter-regressions.md');
for (const term of ['单选', '多选', '初始', '取消', '重新打开', 'scopeKey', 'selectedItems', 'rawText', 'RETURN', 'focus-visible', '320', '390', '767', '1280']) {
  assert.ok(regression.includes(term), `字段回归缺少 ${term}`);
}
for (const point of ['validations.minimum', 'validations.maximum', 'JSON number']) {
  assert.ok(regression.includes(point), `数值提交指导缺少 ${point}`);
}
assert.match(regression, /examples\/field-adapters/);
const metadataTarget = '../../make-app-approval/references/task-detail.md#元数据读取合同';
const links = [...regression.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
assert.ok(links.includes(metadataTarget), '字段示例必须交接到当前审批节点元数据合同，不把示例文档作为接口权限来源');
const metadata = readFileSync(new URL(metadataTarget.split('#')[0], new URL('../skills/makeui/references/field-adapter-regressions.md', import.meta.url)), 'utf8');
assert.ok(metadata.includes('### 元数据读取合同'), '交接锚点必须存在');
assert.doesNotMatch(regression, /\/Users\/|expensePoc|\.codex\/skills/);
console.log('字段适配文档路由与验收矩阵通过（不代替浏览器交互测试）');
