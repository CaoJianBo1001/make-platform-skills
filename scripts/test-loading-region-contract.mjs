import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// 文档合同检查，不冒充宿主页面的浏览器布局验证。
const shell = read('skills/makeui/references/app-shell-layout.md');
assert.match(shell, /## 区域加载态/);
for (const requirement of ['水平和垂直居中', 'Shell 尚未挂载', '主内容区', 'Drawer', '明确的可用高度', 'position: relative', 'inset: 0', 'role="status"', 'getBoundingClientRect', '按钮内']) {
  assert.ok(shell.includes(requirement), `区域加载合同缺少：${requirement}`);
}
for (const file of ['skills/makeui/SKILL.md', 'skills/make-app-permission/references/ui-permission-runtime.md', 'skills/make-app-auth/SKILL.md']) {
  assert.match(read(file), /app-shell-layout\.md#区域加载态/, `${file} 必须交接统一加载布局合同`);
}
assert.match(read('skills/makeui/SKILL.md'), /存量项目.*提前返回.*权限守卫.*Provider/, '存量项目检查须覆盖权限守卫和 Provider 的提前返回分支');
console.log('区域加载态文档合同通过；实际几何居中需宿主浏览器验收');
