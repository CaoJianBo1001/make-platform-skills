import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const skill = await readFile(new URL('../skills/makecli/SKILL.md', import.meta.url), 'utf8');
const command = skill.match(/`(makecli configure verify[^`]+)`/)?.[1];
assert.ok(command, '远端预检须提供可执行的命令形状');

// CLI 是外部边界：只记录文档实际传入的选择，不访问凭据或 Make 环境。
const recorder = `
  const args = process.argv.slice(1);
  const option = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index < 0 ? fallback : args[index + 1];
  };
  process.stdout.write(JSON.stringify({
    context: option('--context', 'production'),
    profile: option('--profile', 'default'),
    operation: args.slice(0, 2),
  }));
`;

for (const selection of [
  { context: 'dev', profile: 'analytics_review' },
  { context: 'test', profile: 'qa_review' },
]) {
  test(`文档预检沿用任务选择 ${selection.context}/${selection.profile}`, () => {
    const argv = command.replaceAll('<context>', selection.context)
      .replaceAll('<profile>', selection.profile).trim().split(/\s+/).slice(1);
    const result = spawnSync(process.execPath, ['-e', recorder, '--', ...argv], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ...selection, operation: ['configure', 'verify'] });
  });
}
