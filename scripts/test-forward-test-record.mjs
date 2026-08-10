#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertForwardTestScope,
  assertScenarioPassed,
  computeForwardTestScopeHash,
  readForwardTestScopeEntries,
} from './lib/forward-test-record.mjs';

const passingRecord = `
# Make App Actions 前向测试记录

## 执行信息

- Skill 内容 SHA-256：PLACEHOLDER

## 场景一：Ant Design 默认操作

提示词：为 Ant Design 列表接入操作按钮。

验收标准：必须使用 Ant Design 适配器。

输出证据：使用 Ant Design 标准操作。

结论：通过。

## 场景二：搜索条件下表头全选

输出证据：搜索条件下使用表头全选。

结论：通过。
`;

assert.doesNotThrow(() => {
  assertScenarioPassed(passingRecord, {
    heading: '场景一：Ant Design 默认操作',
    evidencePatterns: [/Ant Design/i],
  });
});

const missingEvidence = passingRecord.replace(
  /^输出证据：使用 Ant Design 标准操作。$/m,
  '',
);
assert.throws(
  () => {
    assertScenarioPassed(missingEvidence, {
      heading: '场景一：Ant Design 默认操作',
      evidencePatterns: [/Ant Design/i],
    });
  },
  /场景一：Ant Design 默认操作.*输出证据/s,
  'prompt and acceptance text must not substitute for agent output evidence',
);

const failedFirstScenario = passingRecord.replace(
  '结论：通过。',
  '结论：失败。',
);
assert.throws(
  () => {
    assertScenarioPassed(failedFirstScenario, {
      heading: '场景一：Ant Design 默认操作',
      evidencePatterns: [/Ant Design/i],
    });
  },
  /场景一：Ant Design 默认操作.*通过/s,
  'a later passing scenario must not satisfy a failed scenario',
);

assert.throws(
  () => {
    assertScenarioPassed(passingRecord, {
      heading: '场景三：Arco 批量编辑',
      evidencePatterns: [/Arco/i],
    });
  },
  /场景三：Arco 批量编辑.*不存在/s,
  'a missing scenario must fail explicitly',
);

const scopeEntries = [
  { path: 'SKILL.md', content: 'skill content' },
  { path: 'references/service-contract.md', content: 'service contract' },
];
const scopeHash = computeForwardTestScopeHash(scopeEntries);
const scopedRecord = passingRecord.replace('PLACEHOLDER', scopeHash);

assert.doesNotThrow(() => assertForwardTestScope(scopedRecord, scopeHash));
assert.throws(
  () => assertForwardTestScope(scopedRecord, computeForwardTestScopeHash([
    ...scopeEntries,
    { path: 'references/new-rule.md', content: 'new rule' },
  ])),
  /SHA-256.*当前 Skill 内容不一致/,
  'a historical record must not validate changed Skill content',
);

const oneFileHash = computeForwardTestScopeHash([
  { path: 'a', content: Buffer.from('X\0b\0Y') },
]);
const twoFileHash = computeForwardTestScopeHash([
  { path: 'a', content: Buffer.from('X') },
  { path: 'b', content: Buffer.from('Y') },
]);
assert.notEqual(
  oneFileHash,
  twoFileHash,
  'scope hash framing must distinguish file content from later file entries',
);

const binaryScopeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forward-test-scope-'));
try {
  const assetPath = path.join(binaryScopeRoot, 'assets', 'icon.bin');
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.writeFileSync(assetPath, Buffer.from([0x80]));
  const firstBinaryHash = computeForwardTestScopeHash(
    readForwardTestScopeEntries(binaryScopeRoot),
  );

  fs.writeFileSync(assetPath, Buffer.from([0x81]));
  const secondBinaryHash = computeForwardTestScopeHash(
    readForwardTestScopeEntries(binaryScopeRoot),
  );

  assert.notEqual(
    firstBinaryHash,
    secondBinaryHash,
    'different binary asset bytes must produce different scope hashes',
  );
} finally {
  fs.rmSync(binaryScopeRoot, { force: true, recursive: true });
}

console.log('forward-test record tests: PASS');
