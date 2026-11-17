#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { checkInstalledSkillLinks } from './check-installed-skill-links.mjs';

const check = (content, prepare = () => {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-skill-links-'));
  const skill = path.join(root, 'fixture-skill');
  const issues = [];
  try {
    fs.mkdirSync(skill);
    fs.writeFileSync(path.join(skill, 'target.md'), '# 目标\n\n## 统计口径\n');
    prepare(root);
    fs.writeFileSync(path.join(skill, 'SKILL.md'), typeof content === 'function' ? content(root) : content);
    const valid = checkInstalledSkillLinks(root, ['fixture-skill'], {
      info() {},
      error(message, detail) { issues.push({ message, ...detail }); },
    });
    return { valid, issues };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

for (const [name, content] of [
  ['完整引用', '[说明][ref]\n\n[ref]: missing.md\n'],
  ['折叠引用', '[ref][]\n\n[ref]: missing.md\n'],
  ['快捷引用', '[ref]\n\n[ref]: missing.md\n'],
  ['下一行目标', '[说明][ref]\n\n[ref]:\n  missing.md "说明"\n'],
]) {
  test(`${name}的缺失目标必须失败并定位使用行`, () => {
    const result = check(content);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].reason, 'missing_link_target');
    assert.equal(result.issues[0].location, 'fixture-skill/SKILL.md:1');
  });
}

test('引用链接检查章节和越界，不因定义格式而绕过', () => {
  assert.equal(check('[章节][ref]\n\n[ref]: target.md#不存在\n').issues[0]?.reason, 'missing_link_anchor');
  assert.equal(check('[越界][ref]\n\n[ref]: ../../outside.md\n').issues[0]?.reason, 'outside_skills_root');
});

test('引用名称不区分大小写并合并空白，重复定义使用第一条', () => {
  const result = check('[说明][  METRIC   help ]\n\n[metric help]: <target.md#统计口径> "口径"\n[metric help]: missing.md\n');
  assert.equal(result.valid, true);
});

test('普通方括号、未使用定义、外部引用和内联链接保留合法行为', () => {
  const result = check('[普通文字]\n[unused]: missing.md\n[官方][web]\n[web]: https://example.com/docs\n[邮件](mailto:maintainer@example.com)\n[目标](target.md#统计口径)\n');
  assert.equal(result.valid, true);
});

for (const kind of ['内联', '引用']) {
  test(`${kind} file URL 不能当作外部网址跳过`, () => {
    const result = check((root) => {
      const href = pathToFileURL(path.join(root, 'fixture-skill', 'target.md')).href;
      return kind === '内联' ? `[本地](${href})\n` : `[本地][ref]\n\n[ref]: ${href}\n`;
    });
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].reason, 'non_portable_file_url');
  });
}

for (const [name, content] of [
  ['更长波浪围栏', '~~~md\n[示例](missing.md)\n~~~~\n[目标](target.md)\n'],
  ['更长反引号围栏', '```md\n[示例](missing.md)\n`````\n[目标](target.md)\n'],
  ['未闭合围栏', '~~~md\n[示例](missing.md)\n'],
  ['短围栏不能关闭', '~~~~md\n~~~\n[示例](missing.md)\n~~~~\n'],
  ['异类围栏不能关闭', '~~~md\n```\n[示例](missing.md)\n~~~\n'],
  ['围栏中的引用定义', '~~~md\n[ref]: missing.md\n~~~~\n[ref]\n'],
  ['行内代码与反引号', '`` `[示例](missing.md)` ``\n[目标](target.md)\n'],
]) {
  test(`${name}不会误检代码示例`, () => assert.equal(check(content).valid, true));
}

test('围栏后的真实链接仍被检查，CRLF 下行号保持准确', () => {
  const result = check('~~~md\r\n[示例](ignored.md)\r\n~~~~\r\n[真实][ref]\r\n\r\n[ref]: missing.md\r\n');
  assert.equal(result.valid, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].location, 'fixture-skill/SKILL.md:4');
});
