#!/usr/bin/env node
// 离线复制固定公共合同；不连接 Gateway，不覆盖已有文件。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const destination = process.argv[2] && path.resolve(process.argv[2]);
const source = new URL('./fixtures/agent-v1/', import.meta.url);
try {
  if (!destination || process.argv.length !== 3)
    throw new Error(
      'usage: node prepare-gateway-fixture.mjs <new-contract-directory>'
    );
  const manifest = JSON.parse(
    fs.readFileSync(new URL('source.json', source), 'utf8')
  );
  const files = new Map([
    ['source.json', fs.readFileSync(new URL('source.json', source))],
  ]);
  for (const name of [
    'openapi.json',
    'data.openapi.json',
    'events.schema.json',
  ]) {
    const bytes = fs.readFileSync(new URL(name, source));
    if (
      createHash('sha256').update(bytes).digest('hex') !== manifest.sha256[name]
    )
      throw new Error('hash_mismatch: ' + name);
    files.set(name, bytes);
  }
  if (fs.existsSync(destination))
    throw new Error('destination_exists: choose a new directory');
  if (destination === fileURLToPath(source))
    throw new Error('destination_is_source');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination); // exclusive: a concurrent invocation must not overwrite it
  try {
    for (const [name, bytes] of files)
      fs.writeFileSync(path.join(destination, name), bytes, { flag: 'wx' });
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
  console.log('Gateway contracts prepared: ' + manifest.sourceCommit);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
