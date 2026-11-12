import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const skillRoot = new URL('skills/make-app-analytics/', root);

test('分发的分析指南只引用随 Skill 可取得的脚本', async () => {
  const files = [new URL('SKILL.md', skillRoot), ...(
    await readdir(new URL('references/', skillRoot))
  ).filter(name => name.endsWith('.md')).map(name => new URL(`references/${name}`, skillRoot))];
  for (const file of files) {
    const document = await readFile(file, 'utf8');
    for (const [script] of document.matchAll(/(?:[A-Za-z0-9_.-]+\/)*scripts\/[A-Za-z0-9_.-]+\.mjs\b/g)) {
      await assert.doesNotReject(access(new URL(script, skillRoot)),
        `${file.pathname}: ${script} 未随 Skill 交付，仓库维护命令应移出接入指南`);
    }
  }
});

test('仓库 CI 的实际制品与分析接入基线同版', async () => {
  const contract = await readFile(new URL('references/integration-contract.md', skillRoot), 'utf8');
  const baseline = contract.match(/@qfei-design\/make-app-analytics@(\d+\.\d+\.\d+)/)?.[1];
  assert.ok(baseline, '接入合同须声明已验证的制品基线');
  const workflow = await readFile(new URL('.github/workflows/skill-metadata-lint.yml', root), 'utf8');
  assert.equal(workflow.match(/--package=@qfei-design\/make-app-analytics@(\d+\.\d+\.\d+)/)?.[1], baseline);
});
