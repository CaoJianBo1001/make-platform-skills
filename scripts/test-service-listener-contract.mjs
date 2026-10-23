#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const suite = path.join(root, 'skills/make-app-runtime/scripts/service-listener-conformance.mjs');
assert.ok(fs.existsSync(suite), 'Runtime must provide an executable container-listener regression, not only a port declaration');
assert.ok(fs.readFileSync(path.join(root, 'skills/make-app-runtime/SKILL.md'), 'utf8').includes('service-listener-conformance.mjs'), 'Runtime must route generated Apps to the listener regression');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'make-listener-contract-'));

try {
  for (const [name, listen, expected] of [
    ['explicit-ipv4', "server.listen(3000, '0.0.0.0')", true],
    ['options-object', "server.listen({ port: 3000, host: '0.0.0.0' })", true],
    ['delegated-host', "const config = { port: 3000, host: '0.0.0.0' }; server.listen(config)", true],
    ['loopback', "server.listen(3000, '127.0.0.1')", false],
    ['localhost', "server.listen(3000, 'localhost')", false],
    ['node-env-dependent', "server.listen(3000, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')", false],
    ['wrong-port', "server.listen(3001, '0.0.0.0')", false],
    ['log-only', "console.log('Service listening on 0.0.0.0:3000')", false],
    ['startup-crash', "server.listen(3000, '0.0.0.0', () => { throw new Error('startup failed'); })", false],
  ]) {
    const entry = path.join(temporary, `${name}.mjs`);
    fs.writeFileSync(entry, `import { createServer } from 'node:http';\nconst server = createServer((_req, res) => res.end('ok'));\n${listen};\n`);
    const result = spawnSync(process.execPath, [suite, entry], { encoding: 'utf8', timeout: 15000 });
    assert.ifError(result.error);
    assert.equal(result.status === 0, expected, `${name}: ${result.stdout}${result.stderr}`);
    if (expected) {
      assert.match(result.stdout, /PASS service_listener_node_env_unset/);
      assert.match(result.stdout, /PASS service_listener_node_env_production/);
    }
    if (name === 'node-env-dependent') assert.match(result.stderr, /FAIL service_listener_node_env_unset/);
  }
  console.log('service listener contract: PASS (3 valid entrypoints, 6 regression entrypoints)');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
