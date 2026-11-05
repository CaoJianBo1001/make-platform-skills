import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const shell = read('skills/makeui/references/app-shell-layout.md');
const adapter = read('skills/make-app-service/references/make-data-adapter.md');
for (const word of ['## 动态应用名称', 'appName', '浏览器标题', '禁止硬编码', 'appKey', '长名称', '后台改名', '不新增轮询']) {
  assert.ok(shell.includes(word), `UI 应用名称合同缺少 ${word}`);
}
for (const word of ['### 应用名称来源', 'app.name', 'appName', '缓存', '后台改名', 'appKey']) {
  assert.ok(adapter.includes(word), `Service 应用名称合同缺少 ${word}`);
}
assert.ok(read('skills/makeui/SKILL.md').includes('app-shell-layout.md#动态应用名称'));
assert.ok(read('skills/make-app-service/SKILL.md').includes('make-data-adapter.md#应用名称来源'));
console.log('动态应用名称文档合同通过；不替代宿主改名及长名称浏览器验收');
