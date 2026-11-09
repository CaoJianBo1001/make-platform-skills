#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(scriptDir, 'check-installed-make-platform-skills-sync.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-platform-skills-sync-'));
const sourceRoot = path.join(tempRoot, 'source');
const installedRoot = path.join(tempRoot, 'installed');
const skillNames = [
  'makeui',
  'make-app-permission',
  'make-app-service',
  'make-app-analytics',
  'make-app-auth',
  'make-app-actions',
  'make-app-approval',
  'makedsl',
  'make-app-filter',
  'make-app-sort',
  'make-app-group',
  'make-ai-assistant',
  'make-app-runtime',
  'make-app-observability',
  'make-env-setup',
  'canvas-table-integration',
];

try {
  for (const skillName of skillNames) {
    writeSkill(sourceRoot, skillName, 'source');
    writeSkill(installedRoot, skillName, 'source');
  }

  assert.match(runChecker(), /installed Make platform skills sync: PASS/);

  for (const skillName of ['make-app-approval', 'makedsl', 'make-app-analytics']) {
    fs.rmSync(path.join(installedRoot, skillName), { recursive: true });
    const missingOutput = runChecker({ expectFailure: true });
    assert.match(missingOutput, new RegExp(skillName));
    assert.match(missingOutput, /(?:not a directory|missing|ENOENT)/i);
    writeSkill(installedRoot, skillName, 'stale');
    const staleOutput = runChecker({ expectFailure: true });
    assert.match(staleOutput, new RegExp(skillName));
    assert.match(staleOutput, /content_mismatch/);
    writeSkill(installedRoot, skillName, 'source');
  }

  const analyticsReference = path.join(
    installedRoot,
    'make-app-analytics',
    'references',
    'query-performance.md',
  );
  fs.rmSync(analyticsReference);
  const missingAnalyticsReference = runChecker({ expectFailure: true });
  assert.match(missingAnalyticsReference, /make-app-analytics/);
  assert.match(missingAnalyticsReference, /query-performance\.md/);
  writeSkill(installedRoot, 'make-app-analytics', 'source');
  fs.writeFileSync(analyticsReference, 'stale performance contract\n');
  const staleAnalyticsReference = runChecker({ expectFailure: true });
  assert.match(staleAnalyticsReference, /query-performance\.md/);
  assert.match(staleAnalyticsReference, /content_mismatch/);
  writeSkill(installedRoot, 'make-app-analytics', 'source');
  assert.match(runChecker(), /installed Make platform skills sync: PASS/);

  writeSkill(installedRoot, 'makeui', 'stale');
  const makeuiMismatchOutput = runChecker({ expectFailure: true });
  assert.match(makeuiMismatchOutput, /makeui/);
  assert.match(makeuiMismatchOutput, /content_mismatch/);
  writeSkill(installedRoot, 'makeui', 'source');

  writeSkill(installedRoot, 'make-app-auth', 'stale');
  const mismatchOutput = runChecker({ expectFailure: true });
  assert.match(mismatchOutput, /make-app-auth/);
  assert.match(mismatchOutput, /content_mismatch/);
  writeSkill(installedRoot, 'make-app-auth', 'source');

  fs.rmSync(path.join(installedRoot, 'make-app-observability'), { recursive: true });
  const missingTraceOutput = runChecker({ expectFailure: true });
  assert.match(missingTraceOutput, /make-app-observability/);
  assert.match(missingTraceOutput, /(?:not a directory|missing|ENOENT)/i);
  writeSkill(installedRoot, 'make-app-observability', 'source');

  writeSkill(installedRoot, 'make-app-filter', 'stale');
  const filterMismatchOutput = runChecker({ expectFailure: true });
  assert.match(filterMismatchOutput, /make-app-filter/);
  assert.match(filterMismatchOutput, /content_mismatch/);
  writeSkill(installedRoot, 'make-app-filter', 'source');

  for (const skillName of ['make-app-runtime', 'make-env-setup', 'canvas-table-integration']) {
    writeSkill(installedRoot, skillName, 'stale');
    const mismatchOutput = runChecker({ expectFailure: true });
    assert.match(mismatchOutput, new RegExp(skillName));
    assert.match(mismatchOutput, /content_mismatch/);
    writeSkill(installedRoot, skillName, 'source');
  }

  // 源和安装文件完全一致时，安装后失效的链接仍必须被识别。
  const linkReference = 'references/installed-links.md';
  fs.writeFileSync(path.join(tempRoot, 'README.md'), '# 仓库维护说明\n');
  writeMatchingFile('make-app-analytics', linkReference, '[仓库说明](../../../README.md)\n');
  const outsideLink = runChecker({ expectFailure: true });
  assert.match(outsideLink, /outside_skills_root/);
  assert.match(outsideLink, /installed-links\.md:1/);

  writeMatchingFile('make-app-analytics', linkReference, '[缺失参考](missing.md)\n');
  assert.match(runChecker({ expectFailure: true }), /missing_link_target/);

  writeMatchingFile('make-app-analytics', linkReference, '[错误章节](contract.md#missing)\n');
  assert.match(runChecker({ expectFailure: true }), /missing_link_anchor/);

  writeMatchingFile('make-app-analytics', linkReference, '[引用][ref]\n\n[ref]: missing.md\n');
  assert.match(runChecker({ expectFailure: true }), /missing_link_target/);

  writeMatchingFile('make-app-service', 'references/字段 合同.md',
    '# 字段合同\n\n## 数值与单位\n\n## 数值与单位\n\n<a id="explicit-anchor"></a>\n');
  writeMatchingFile('make-app-analytics', linkReference, [
    '[同 Skill 参考](contract.md)',
    '[关联 Skill](../../make-app-service/SKILL.md#make-app-service)',
    '[中文与空格](<../../make-app-service/references/字段%20合同.md#数值与单位-1>)',
    '[显式锚点](<../../make-app-service/references/字段%20合同.md#explicit-anchor>)',
    '[官方文档](https://example.com/docs#remote-anchor)',
    '[邮件](mailto:maintainer@example.com)',
    '`[代码中的占位链接](does-not-exist.md)`',
    '```md',
    '[示例链接](also-does-not-exist.md)',
    '```',
    '~~~md',
    '[示例引用][ref]',
    '[ref]: ignored.md',
    '~~~~',
    '',
  ].join('\n'));
  assert.match(runChecker(), /installed Make platform skills sync: PASS/);

  console.log('installed Make platform skills sync tests: PASS');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function writeSkill(root, skillName, version) {
  const skillRoot = path.join(root, skillName);
  fs.mkdirSync(path.join(skillRoot, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), `---\nname: ${skillName}\n---\n\n# ${skillName}\n\n${version}\n`);
  fs.writeFileSync(path.join(skillRoot, 'references', 'contract.md'), `${version}\n`);
  if (skillName === 'make-app-analytics') {
    fs.writeFileSync(
      path.join(skillRoot, 'references', 'query-performance.md'),
      `${version}\n`,
    );
  }
}

function writeMatchingFile(skillName, relativePath, content) {
  for (const root of [sourceRoot, installedRoot]) {
    const target = path.join(root, skillName, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function runChecker(options = {}) {
  const result = spawnSync(process.execPath, [checker, sourceRoot, installedRoot], {
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (options.expectFailure) {
    assert.notEqual(result.status, 0, '缺失或过期的技能必须导致同步检查失败');
    return output;
  }
  if (result.status === 0) {
    return output;
  }
  throw new Error(output);
}
