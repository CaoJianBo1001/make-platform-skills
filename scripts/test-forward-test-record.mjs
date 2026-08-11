#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertForwardTestScope,
  assertScenarioPassed,
  assertUniqueScenarioExecutionIds,
  computeForwardTestScopeHash,
  readForwardTestScopeEntries,
  readForwardTestScopeEntriesFromRoots,
} from './lib/forward-test-record.mjs';

const passingRecord = `
# Make App Actions 前向测试记录

## 执行信息

- Skill 内容 SHA-256：PLACEHOLDER

## 场景一：Ant Design 默认操作

提示词：为 Ant Design 列表接入操作按钮。

验收标准：必须使用 Ant Design 适配器。

执行方式：fresh-agent

执行批次：current-batch

执行标识：agent-1

输出证据：使用 Ant Design 标准操作。

结论：通过。

## 场景二：搜索条件下表头全选

执行方式：fresh-agent

执行批次：current-batch

执行标识：agent-2

输出证据：搜索条件下使用表头全选。

结论：通过。
`;

const passingScenario = assertScenarioPassed(passingRecord, {
  heading: '场景一：Ant Design 默认操作',
  evidencePatterns: [/Ant Design/i],
  requiredExecutionBatch: 'current-batch',
  requiredExecutionIdPattern: /^agent-\d+$/,
  requiredExecutionMethod: 'fresh-agent',
});
assert.equal(passingScenario.executionId, 'agent-1');
assert.doesNotThrow(() => assertUniqueScenarioExecutionIds(passingRecord, [
  '场景一：Ant Design 默认操作',
  '场景二：搜索条件下表头全选',
]));

const staticOnlyRecord = passingRecord.replace(
  '执行方式：fresh-agent',
  '执行方式：static-contract',
);
assert.throws(
  () => {
    assertScenarioPassed(staticOnlyRecord, {
      heading: '场景一：Ant Design 默认操作',
      evidencePatterns: [/Ant Design/i],
      requiredExecutionMethod: 'fresh-agent',
    });
  },
  /场景一：Ant Design 默认操作.*执行方式/s,
  'a static contract check must not satisfy a fresh-agent scenario',
);

const deferredFreshAgentRecord = passingRecord.replace(
  '执行方式：fresh-agent',
  '执行方式：static-contract（发布前补 fresh-agent）',
);
assert.throws(
  () => {
    assertScenarioPassed(deferredFreshAgentRecord, {
      heading: '场景一：Ant Design 默认操作',
      evidencePatterns: [/Ant Design/i],
      requiredExecutionMethod: 'fresh-agent',
    });
  },
  /场景一：Ant Design 默认操作.*执行方式/s,
  'a future fresh-agent note must not satisfy the current execution method',
);

const staleBatchRecord = passingRecord.replace(
  '执行批次：current-batch',
  '执行批次：historical-batch',
);
assert.throws(
  () => {
    assertScenarioPassed(staleBatchRecord, {
      heading: '场景一：Ant Design 默认操作',
      evidencePatterns: [/Ant Design/i],
      requiredExecutionBatch: 'current-batch',
      requiredExecutionMethod: 'fresh-agent',
    });
  },
  /场景一：Ant Design 默认操作.*执行批次/s,
  'a historical agent run must not satisfy the current execution batch',
);

const invalidExecutionIdRecord = passingRecord.replace(
  '执行标识：agent-1',
  '执行标识：历史结果',
);
assert.throws(
  () => {
    assertScenarioPassed(invalidExecutionIdRecord, {
      heading: '场景一：Ant Design 默认操作',
      evidencePatterns: [/Ant Design/i],
      requiredExecutionBatch: 'current-batch',
      requiredExecutionIdPattern: /^agent-\d+$/,
      requiredExecutionMethod: 'fresh-agent',
    });
  },
  /场景一：Ant Design 默认操作.*执行标识/s,
  'an invalid execution id must not satisfy a fresh-agent scenario',
);

const duplicatedExecutionIdRecord = passingRecord.replace(
  '执行标识：agent-2',
  '执行标识：agent-1',
);
assert.throws(
  () => assertUniqueScenarioExecutionIds(duplicatedExecutionIdRecord, [
    '场景一：Ant Design 默认操作',
    '场景二：搜索条件下表头全选',
  ]),
  /执行标识.*重复/s,
  'independent scenarios must not reuse one agent execution id',
);

const duplicatedBatchFieldRecord = passingRecord.replace(
  '执行批次：current-batch',
  '执行批次：current-batch\n\n执行批次：historical-batch',
);
assert.throws(
  () => {
    assertScenarioPassed(duplicatedBatchFieldRecord, {
      heading: '场景一：Ant Design 默认操作',
      evidencePatterns: [/Ant Design/i],
      requiredExecutionBatch: 'current-batch',
      requiredExecutionMethod: 'fresh-agent',
    });
  },
  /场景一：Ant Design 默认操作.*执行批次.*重复/s,
  'duplicated labeled fields must fail instead of accepting the first value',
);

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

const relatedScopeRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'forward-test-related-scope-'),
);
try {
  const actionsRoot = path.join(relatedScopeRoot, 'make-app-actions');
  const filterRoot = path.join(relatedScopeRoot, 'make-app-filter');
  fs.mkdirSync(actionsRoot, { recursive: true });
  fs.mkdirSync(filterRoot, { recursive: true });
  fs.writeFileSync(path.join(actionsRoot, 'SKILL.md'), 'actions');
  fs.writeFileSync(path.join(filterRoot, 'SKILL.md'), 'filter-v1');

  const scopeRoots = [
    { directory: actionsRoot, prefix: 'skills/make-app-actions' },
    { directory: filterRoot, prefix: 'skills/make-app-filter' },
  ];
  const relatedEntries = readForwardTestScopeEntriesFromRoots(scopeRoots);
  assert.deepEqual(
    relatedEntries.map(({ path: entryPath }) => entryPath).sort(),
    [
      'skills/make-app-actions/SKILL.md',
      'skills/make-app-filter/SKILL.md',
    ],
    'related skill roots must be namespaced in one deterministic hash scope',
  );
  const firstRelatedHash = computeForwardTestScopeHash(relatedEntries);

  fs.writeFileSync(path.join(filterRoot, 'SKILL.md'), 'filter-v2');
  const secondRelatedHash = computeForwardTestScopeHash(
    readForwardTestScopeEntriesFromRoots(scopeRoots),
  );
  assert.notEqual(
    firstRelatedHash,
    secondRelatedHash,
    'changing a related skill must invalidate the forward-test scope hash',
  );

  assert.throws(
    () => readForwardTestScopeEntriesFromRoots([
      { directory: actionsRoot, prefix: 'skills/duplicate' },
      { directory: filterRoot, prefix: 'skills/duplicate' },
    ]),
    /duplicate.*SKILL\.md/i,
    'duplicate namespaced paths must fail instead of silently hashing collisions',
  );
} finally {
  fs.rmSync(relatedScopeRoot, { force: true, recursive: true });
}

console.log('forward-test record tests: PASS');
