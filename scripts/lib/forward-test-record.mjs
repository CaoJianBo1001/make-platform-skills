import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function assertScenarioPassed(
  markdown,
  {
    heading,
    evidencePatterns = [],
    requiredExecutionBatch,
    requiredExecutionIdPattern,
    requiredExecutionMethod,
  },
) {
  const sections = parseLevelTwoSections(markdown);
  const section = sections.get(heading);

  assert.ok(section, `前向测试场景“${heading}”不存在`);
  const executionMethod = readLabeledField(section, '执行方式', heading);
  if (requiredExecutionMethod !== undefined) {
    assert.equal(
      executionMethod,
      requiredExecutionMethod,
      `前向测试场景“${heading}”的执行方式必须为“${requiredExecutionMethod}”`,
    );
  }
  const executionBatch = readLabeledField(section, '执行批次', heading);
  if (requiredExecutionBatch !== undefined) {
    assert.equal(
      executionBatch,
      requiredExecutionBatch,
      `前向测试场景“${heading}”的执行批次必须为“${requiredExecutionBatch}”`,
    );
  }
  const executionId = readLabeledField(section, '执行标识', heading);
  if (requiredExecutionIdPattern !== undefined) {
    assert.match(
      executionId,
      requiredExecutionIdPattern,
      `前向测试场景“${heading}”的执行标识无效`,
    );
  }
  const evidence = readLabeledField(section, '输出证据', heading);
  assert.ok(evidence, `前向测试场景“${heading}”的输出证据不存在或为空`);
  for (const pattern of evidencePatterns) {
    assert.match(evidence, pattern, `前向测试场景“${heading}”缺少必要证据：${pattern}`);
  }
  const conclusion = readLabeledField(section, '结论', heading);
  assert.match(
    conclusion,
    /^(?:通过|pass)[。.]*$/i,
    `前向测试场景“${heading}”必须明确写为“结论：通过。”`,
  );

  return {
    executionBatch,
    executionId,
    executionMethod,
  };
}

export function assertUniqueScenarioExecutionIds(markdown, headings) {
  const sections = parseLevelTwoSections(markdown);
  const seenExecutionIds = new Map();

  for (const heading of headings) {
    const section = sections.get(heading);
    assert.ok(section, `前向测试场景“${heading}”不存在`);
    const executionId = readLabeledField(section, '执行标识', heading);
    assert.ok(executionId, `前向测试场景“${heading}”的执行标识不存在或为空`);
    const previousHeading = seenExecutionIds.get(executionId);
    assert.ok(
      !previousHeading,
      `前向测试执行标识“${executionId}”重复用于“${previousHeading}”和“${heading}”`,
    );
    seenExecutionIds.set(executionId, heading);
  }
}

export function assertForwardTestScope(markdown, expectedHash) {
  const hashMatch = markdown.match(
    /^\s*-\s*Skill 内容 SHA-256\s*[:：]\s*`?([a-f\d]{64})`?\s*$/im,
  );

  assert.ok(hashMatch, '前向测试记录必须包含 Skill 内容 SHA-256');
  assert.equal(
    hashMatch[1].toLowerCase(),
    expectedHash.toLowerCase(),
    '前向测试记录中的 Skill 内容 SHA-256 与当前 Skill 内容不一致',
  );
}

export function computeForwardTestScopeHash(entries) {
  const hash = createHash('sha256');
  const sortedEntries = [...entries].sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
  hash.update('qfei-forward-test-scope-v1\0', 'utf8');
  hash.update(encodeLength(sortedEntries.length));

  for (const entry of sortedEntries) {
    const pathBytes = Buffer.from(entry.path, 'utf8');
    const contentBytes = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');
    hash.update(encodeLength(pathBytes.length));
    hash.update(pathBytes);
    hash.update(encodeLength(contentBytes.length));
    hash.update(contentBytes);
  }

  return hash.digest('hex');
}

function encodeLength(length) {
  const encoded = Buffer.allocUnsafe(8);
  encoded.writeBigUInt64BE(BigInt(length));
  return encoded;
}

export function readForwardTestScopeEntries(directory) {
  const entries = [];
  const pending = [directory];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        entries.push({
          path: path.relative(directory, entryPath).split(path.sep).join('/'),
          content: fs.readFileSync(entryPath),
        });
      }
    }
  }

  return entries;
}

export function readForwardTestScopeEntriesFromRoots(roots) {
  assert.ok(
    Array.isArray(roots) && roots.length > 0,
    'forward-test scope roots must be a non-empty array',
  );

  const scopedEntries = [];
  const seenPaths = new Set();

  for (const root of roots) {
    assert.ok(
      root && typeof root.directory === 'string' && root.directory.length > 0,
      'forward-test scope root directory must be a non-empty string',
    );
    assert.ok(
      typeof root.prefix === 'string',
      'forward-test scope root prefix must be a string',
    );
    const normalizedPrefix = root.prefix
      .replaceAll('\\', '/')
      .replace(/^\/+|\/+$/g, '');

    for (const entry of readForwardTestScopeEntries(root.directory)) {
      const scopedPath = normalizedPrefix
        ? `${normalizedPrefix}/${entry.path}`
        : entry.path;
      assert.ok(
        !seenPaths.has(scopedPath),
        `duplicate forward-test scope path: ${scopedPath}`,
      );
      seenPaths.add(scopedPath);
      scopedEntries.push({ ...entry, path: scopedPath });
    }
  }

  return scopedEntries;
}

function parseLevelTwoSections(markdown) {
  const headingPattern = /^##[ \t]+(.+?)[ \t]*$/gm;
  const headings = [...markdown.matchAll(headingPattern)];
  const sections = new Map();

  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const heading = match[1].trim();
    assert.ok(!sections.has(heading), `前向测试记录包含重复章节“${heading}”`);

    const bodyStart = match.index + match[0].length;
    const bodyEnd = headings[index + 1]?.index ?? markdown.length;
    sections.set(heading, markdown.slice(bodyStart, bodyEnd));
  }

  return sections;
}

function readLabeledField(section, expectedLabel, heading = '') {
  const lines = section.split(/\r?\n/);
  const fieldPattern = /^\s*(提示词|验收标准|执行方式|执行批次|执行标识|输出证据|结论)\s*[:：]\s*(.*)$/;
  const fields = lines.flatMap((line, index) => {
    const match = line.match(fieldPattern);
    return match ? [{ index, label: match[1], value: match[2] }] : [];
  });
  const matchingFields = fields.filter(({ label }) => label === expectedLabel);

  assert.ok(
    matchingFields.length <= 1,
    `前向测试场景“${heading}”的字段“${expectedLabel}”重复`,
  );
  if (matchingFields.length === 0) return '';

  const field = matchingFields[0];
  const nextField = fields.find(({ index }) => index > field.index);
  return [
    field.value,
    ...lines.slice(field.index + 1, nextField?.index ?? lines.length),
  ].join('\n').trim();
}
