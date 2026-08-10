import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function assertScenarioPassed(markdown, { heading, evidencePatterns = [] }) {
  const sections = parseLevelTwoSections(markdown);
  const section = sections.get(heading);

  assert.ok(section, `前向测试场景“${heading}”不存在`);
  const evidence = readLabeledField(section, '输出证据');
  assert.ok(evidence, `前向测试场景“${heading}”的输出证据不存在或为空`);
  for (const pattern of evidencePatterns) {
    assert.match(evidence, pattern, `前向测试场景“${heading}”缺少必要证据：${pattern}`);
  }
  const conclusion = readLabeledField(section, '结论');
  assert.match(
    conclusion,
    /^(?:通过|pass)[。.]*$/i,
    `前向测试场景“${heading}”必须明确写为“结论：通过。”`,
  );
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

function readLabeledField(section, expectedLabel) {
  const lines = section.split(/\r?\n/);
  const fieldPattern = /^\s*(提示词|验收标准|输出证据|结论)\s*[:：]\s*(.*)$/;
  const valueLines = [];
  let collecting = false;

  for (const line of lines) {
    const field = line.match(fieldPattern);
    if (field) {
      if (collecting) break;
      if (field[1] === expectedLabel) {
        collecting = true;
        valueLines.push(field[2]);
      }
    } else if (collecting) {
      valueLines.push(line);
    }
  }

  return valueLines.join('\n').trim();
}
