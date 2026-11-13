import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {correctAdapterSource} from '../skills/make-app-permission/scripts/fixtures/correct-permission-adapter.mjs';

const source = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../skills/make-app-permission/', import.meta.url)));
const runners = new Set(['audit-make-app-permission.mjs', 'permission-conformance-suite.mjs',
  'write-permission-conformance-suite.mjs', 'principal-response-conformance-suite.mjs']);
const read = file => fs.readFileSync(path.join(source, file), 'utf8');
const commands = document => [
  ...[...document.matchAll(/```(?:bash|sh)\n([\s\S]*?)\n```/g)]
    .flatMap(match => match[1].replace(/\\\r?\n\s*/g, ' ').split('\n')),
  ...[...document.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map(match => match[1]),
].map(line => line.trim()).filter(line => line.startsWith('node '))
  .map(line => ({line, args: line.match(/"[^"]*"|'[^']*'|\S+/g).slice(1)
    .map(token => token.replace(/^(["'])(.*)\1$/, '$2'))}))
  .filter(command => runners.has(path.basename(command.args[0])));

const installedWorkspace = check => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'permission installed guide '));
  const skill = path.join(workspace, '.agents', 'skills', 'make-app-permission');
  const host = path.join(workspace, 'host app');
  try {
    fs.cpSync(source, skill, {recursive: true});
    fs.mkdirSync(path.join(host, 'test', 'adapters'), {recursive: true});
    const model = path.join(host, 'test', 'adapters', 'permission model.mjs');
    const empty = path.join(host, 'test', 'adapters', 'empty adapter.mjs');
    fs.writeFileSync(model, correctAdapterSource);
    fs.writeFileSync(empty, 'export {};\n');
    fs.writeFileSync(path.join(host, 'test', 'adapters', 'principal-response.mjs'), 'export {};\n');
    fs.writeFileSync(path.join(host, 'test', 'adapters', 'administrator-feedback.mjs'), 'export {};\n');
    // 按文档的项目内工具示例复制完整目录，保留审计的相对导入依赖。
    fs.cpSync(path.join(skill, 'scripts'), path.join(host, 'tools', 'make-app-permission'), {recursive: true});
    check({skill, host, model, empty});
  } finally {
    fs.rmSync(workspace, {recursive: true, force: true});
  }
};

const execute = (command, fixture) => {
  const runner = path.basename(command.args[0]);
  const adapter = runner === 'permission-conformance-suite.mjs' ? fixture.model : fixture.empty;
  const replacements = {'<skill-dir>': fixture.skill, '<project-root>': fixture.host,
    '<host-adapter-module>': adapter, '<adapter-module>': adapter,
    '<host-write-adapter-module>': adapter, '<host-loader-adapter-module>': adapter};
  const args = command.args.map(token => Object.entries(replacements)
    .reduce((value, [placeholder, target]) => value.replaceAll(placeholder, target), token));
  const result = spawnSync(process.execPath, args, {cwd: fixture.host, encoding: 'utf8'});
  const output = result.stdout + result.stderr;
  assert.doesNotMatch(output, /MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/, `${command.line} 无法在安装后定位脚本或依赖：${output}`);
  if (runner === 'permission-conformance-suite.mjs') {
    assert.equal(result.status, 0, `${command.line} 未执行成功：${output}`);
    assert.match(output, /permission conformance: PASS/);
  } else {
    // 空项目和空适配器应由真实审计／套件拒绝，不把测试夹具当宿主验收。
    assert.equal(result.status, 1, `${command.line} 应保留验证失败：${output}`);
    const expected = runner === 'audit-make-app-permission.mjs' ? /no_ui_source/
      : runner === 'write-permission-conformance-suite.mjs' ? /adapter must export createWriteHarness/
        : /adapter must delegate to the production UI permission loader/;
    assert.match(output, expected, `${command.line} 未到达真实验证边界`);
  }
};

for (const file of ['SKILL.md', 'references/testing-and-audit.md']) {
  test(`${file} 的文档命令可在仅安装 Skill 的含空格目录执行`, () => {
    const entries = commands(read(file));
    for (const runner of runners) assert.ok(entries.some(entry => path.basename(entry.args[0]) === runner), `遗漏验证入口：${runner}`);
    installedWorkspace(fixture => entries.forEach(entry => execute(entry, fixture)));
  });
}

for (const format of ['inline', 'bash']) {
  test(`故障注入：${format} 中恢复源仓库相对路径必须失败`, () => {
    const command = 'node skills/make-app-permission/scripts/audit-make-app-permission.mjs "<project-root>"';
    const document = format === 'inline' ? `运行 \`${command}\`。` : `\`\`\`bash\n${command}\n\`\`\``;
    installedWorkspace(fixture => assert.throws(() => execute(commands(document)[0], fixture), /无法在安装后定位/));
  });
}

test('审计帮助文案提供安装后可定位的脚本路径', () => {
  installedWorkspace(fixture => {
    const result = spawnSync(process.execPath, [path.join(fixture.skill, 'scripts/audit-make-app-permission.mjs'), '--help'], {cwd: fixture.host, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const line = result.stdout.split('\n').find(value => value.trim().startsWith('node ')).trim();
    const script = line.match(/"[^"]*"|'[^']*'|\S+/g)[1].replace(/^(["'])(.*)\1$/, '$2').replaceAll('<skill-dir>', fixture.skill);
    const invoked = spawnSync(process.execPath, [script, '--help'], {cwd: fixture.host, encoding: 'utf8'});
    assert.equal(invoked.status, 0, invoked.stderr);
    assert.match(invoked.stdout, /Usage:/);
  });
});

test('项目内的权限门禁命令不依赖本机 Skill 安装目录', () => {
  const entries = commands(read('references/testing-and-audit.md')).filter(entry => entry.args[0].startsWith('tools/make-app-permission/'));
  assert.ok(entries.length > 0, '需要明确的项目内门禁示例');
  installedWorkspace(fixture => {
    fs.rmSync(fixture.skill, {recursive: true});
    entries.forEach(entry => execute(entry, fixture));
  });
});
