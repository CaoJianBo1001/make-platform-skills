#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const scripts = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-fixture-'));
const hashes = {
  'openapi.json':
    'a3c77518616e6508877f06baeb815622df08f893981e261c637158aee6798303',
  'data.openapi.json':
    '7372ee21a1bde993d73fa43e8374b87dd96d406847a77d0806b1ad21df8915b0',
  'events.schema.json':
    '47b44cdab77abdd1545c443edd0e0cbf116736060c8e7afce089d9bd3ee53959',
};
try {
  const installed = path.join(root, '独立 Skill scripts');
  fs.cpSync(scripts, installed, { recursive: true });
  const script = path.join(installed, 'prepare-gateway-fixture.mjs');
  const output = path.join(root, 'blank-app/contracts');
  const run = () =>
    spawnSync(process.execPath, [script, output], {
      cwd: root,
      encoding: 'utf8',
    });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const source = JSON.parse(fs.readFileSync(path.join(output, 'source.json')));
  assert.equal(source.sourceCommit, '1238c719e70ed80fd26976aedbc174bdff7998b4');
  assert.deepEqual(source.sha256, hashes);
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(
      createHash('sha256')
        .update(fs.readFileSync(path.join(output, file)))
        .digest('hex'),
      hash
    );
  }
  const documents = Object.fromEntries(
    Object.keys(hashes).map((file) => [
      file,
      JSON.parse(fs.readFileSync(path.join(output, file))),
    ])
  );
  let references = 0;
  const verifyReferences = (node, file) => {
    if (!node || typeof node !== 'object') return;
    if (node.$ref) {
      const [target, pointer = ''] = node.$ref.split('#');
      assert.ok(
        !target || Object.hasOwn(documents, target),
        'fixtures must resolve all schema references offline: ' + node.$ref
      );
      let value = documents[target || file];
      for (const key of pointer.split('/').slice(1))
        value = value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')];
      assert.ok(value !== undefined, 'missing schema reference: ' + node.$ref);
      references++;
    }
    for (const value of Object.values(node)) verifyReferences(value, file);
  };
  for (const [file, document] of Object.entries(documents))
    verifyReferences(document, file);
  assert.ok(references > 100, 'verify the actual complete contract graph');
  fs.writeFileSync(path.join(output, 'keep.txt'), 'keep');
  assert.notEqual(
    run().status,
    0,
    'must not overwrite an existing fixture directory'
  );
  assert.equal(fs.readFileSync(path.join(output, 'keep.txt'), 'utf8'), 'keep');
  fs.rmSync(output, { recursive: true });
  fs.appendFileSync(
    path.join(installed, 'fixtures/agent-v1/data.openapi.json'),
    '\n'
  );
  const tampered = run();
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /hash_mismatch/);
  assert.equal(
    fs.existsSync(output),
    false,
    'hash verification must finish before output writes'
  );
  console.log(
    'bundled Gateway fixture: isolated install, pinned hashes, no overwrite and tamper checks passed'
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
