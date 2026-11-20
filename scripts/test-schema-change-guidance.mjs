import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const cli = read('skills/makecli/SKILL.md');
const verification = read('skills/makecli/references/schema-change-verification.md');
const data = read('skills/makedsl/references/DataAPIDesign.md');
const preview = verification.match(/<!-- schema-preview -->\s*```bash\n([\s\S]*?)```/);
assert.ok(preview, '需要可单独执行的只读差异示例');
assert.doesNotMatch(cli, /makecli diff[^\n]*&&[^\n]*makecli apply/, '差异预览不能串联写入');
assert.doesNotMatch(cli, /diff exit code: 0 = no differences, 1 = differences found/,
  '入口不能保留将原始 CLI 退出码 1 直接当作差异成功的旧规则');
const sandbox = mkdtempSync(path.join(tmpdir(), 'make-schema-guidance-'));
const unchanged = {
  appKey: 'review-app',
  entities: [{ key: 'document', status: 'unchanged' }],
  relations: null,
  summary: { added: 0, removed: 0, changed: 0, unchanged: 1 },
};
const changed = {
  ...unchanged,
  entities: [{ key: 'document', status: 'changed', fields: [{ key: 'title', status: 'changed' }] }],
  summary: { added: 0, removed: 0, changed: 1, unchanged: 0 },
};
const cases = [
  { name: '配置错误也返回 1', status: 1, stderr: 'error: profile is not configured', expected: 2 },
  { name: '已验证无差异', status: 0, result: unchanged, expected: 0 },
  { name: '已验证有差异', status: 1, result: changed, expected: 1 },
  { name: '字段和唯一约束明细保留', status: 1, result: {
    ...changed, entities: [{ ...changed.entities[0], constraints: [{ name: 'document_unique', status: 'changed', detail: 'fields changed' }] }],
  }, expected: 1 },
  { name: '空切片输出 null', status: 0, result: {
    ...unchanged, entities: null, summary: { added: 0, removed: 0, changed: 0, unchanged: 0 },
  }, expected: 0 },
  { name: '通用执行错误', status: 2, stderr: 'error: request failed', expected: 2 },
  { name: '部分差异输出后仍报错', status: 1, result: changed, stderr: 'error: output interrupted', expected: 2 },
  { name: '其他错误码即使有差异 JSON 也不通过', status: 2, result: changed, expected: 2 },
  { name: '错误信封不是差异结果', status: 1, result: { code: 400, message: 'invalid profile' }, expected: 2 },
  { name: '退出 0 但没有输出', status: 0, expected: 2 },
  { name: '退出 1 但只有普通错误文本', status: 1, stdout: 'error: configuration invalid', expected: 2 },
  { name: '损坏 JSON', status: 1, stdout: '{"appKey":', expected: 2 },
  { name: '退出 0 但有差异', status: 0, result: changed, expected: 2 },
  { name: '退出 1 但无差异', status: 1, result: unchanged, expected: 2 },
  { name: '汇总遗漏字段', status: 0, result: { ...unchanged, summary: { changed: 0 } }, expected: 2 },
  { name: '汇总使用负数', status: 0, result: { ...unchanged, summary: { ...unchanged.summary, changed: -1 } }, expected: 2 },
  { name: '汇总与实际项目不一致', status: 1, result: { ...changed, entities: [] }, expected: 2 },
  { name: '项目状态未知', status: 1, result: { ...changed, entities: [{ key: 'document', status: 'unknown' }] }, expected: 2 },
  { name: '字段明细结构损坏', status: 1, result: { ...changed, entities: [{ ...changed.entities[0], fields: 'incomplete' }] }, expected: 2 },
  { name: '约束明细缺失名称', status: 1, result: { ...changed, entities: [{ ...changed.entities[0], constraints: [{ status: 'changed' }] }] }, expected: 2 },
  { name: '关系明细结构损坏', status: 1, result: {
    ...changed, entities: [], relations: [{ key: 'document_owner', status: 'changed', detail: {} }],
  }, expected: 2 },
  { name: '应用键缺失', status: 1, result: { ...changed, appKey: '' }, expected: 2 },
  { name: '进程被信号中断', signal: 'SIGTERM', expected: 2 },
];
try {
  const bin = path.join(sandbox, 'bin'); mkdirSync(bin);
  const log = path.join(sandbox, 'calls.jsonl');
  const installedSkill = path.join(sandbox, 'skill installation', 'makecli');
  cpSync(new URL('skills/makecli/', root), installedSkill, { recursive: true });
  writeFileSync(path.join(bin, 'makecli'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.SCHEMA_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] !== 'diff') process.exit(99);
process.stdout.write(process.env.SCHEMA_TEST_STDOUT || '');
process.stderr.write(process.env.SCHEMA_TEST_STDERR || '');
if (process.env.SCHEMA_TEST_SIGNAL) process.kill(process.pid, process.env.SCHEMA_TEST_SIGNAL);
else process.exit(Number(process.env.SCHEMA_TEST_EXIT));
`, { mode: 0o755 });
  for (const scenario of cases) {
    writeFileSync(log, '');
    const result = spawnSync('bash', ['-c', preview[1]], {cwd:sandbox,encoding:'utf8',env:{...process.env,
      PATH:`${bin}${path.delimiter}${process.env.PATH}`, SCHEMA_TEST_LOG:log,
      SCHEMA_TEST_EXIT:String(scenario.status ?? 0), SCHEMA_TEST_SIGNAL:scenario.signal ?? '',
      SCHEMA_TEST_STDOUT:scenario.stdout ?? (scenario.result ? JSON.stringify(scenario.result) : ''),
      SCHEMA_TEST_STDERR:scenario.stderr ?? '', MAKECLI_SKILL_DIR:installedSkill,
      MAKE_SCHEMA_DIR:'schema with spaces',MAKE_SCHEMA_CONTEXT:'dev',MAKE_SCHEMA_PROFILE:'existing-profile'}});
    assert.equal(result.status,scenario.expected,`${scenario.name}：错误必须与已验证差异区分；${result.stderr}`);
    if (scenario.expected === 2) assert.equal(result.stdout, '', `${scenario.name}：不能输出未经确认的差异`);
    else assert.deepEqual(JSON.parse(result.stdout), scenario.result, `${scenario.name}：保留完整差异结果`);
    const calls=readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));
    assert.deepEqual(calls,[['diff','-f','schema with spaces','--context','dev','--profile','existing-profile','--output','json']],
      `${scenario.name}：仅运行只读 diff，保留参数并明确请求 JSON，不调用 apply`);
  }
  const missing = spawnSync(process.execPath, [path.join(installedSkill, 'scripts/preview-schema-change.mjs'), '-f', 'schema'], {
    cwd: sandbox, encoding: 'utf8', env: { ...process.env, PATH: path.join(sandbox, 'missing-cli') },
  });
  assert.equal(missing.status, 2, '缺少 CLI 必须停止');
  assert.equal(missing.stdout, '');
} finally { rmSync(sandbox,{recursive:true,force:true}); }
// 文档守卫只验证交接没有被删，不将其当作 CLI/API 实际支持的证明。
for (const phrase of ['defaultValue', '实际应用键', '载荷', '读回', '缺 key', '未知']) assert.ok(verification.includes(phrase),phrase);
const batch=data.slice(data.indexOf('### 批量更新一列数据'),data.indexOf('### 获取单条 Record 数据'));
for (const phrase of ['部分成功','结果未知','读回','不能','待核实']) assert.ok(batch.includes(phrase),phrase);
console.log(`schema guidance: ${cases.length + 1} installed-preview scenarios passed, including CLI errors exiting 1; no writes, real platform behavior remains separate`);
