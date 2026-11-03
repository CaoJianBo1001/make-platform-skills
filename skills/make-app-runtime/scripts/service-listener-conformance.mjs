#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, ...extra] = process.argv.slice(2);
if (!entry || extra.length) {
  console.error('Usage: node service-listener-conformance.mjs <built-service-entry>');
  process.exit(2);
}

// Execute the actual entrypoint. Replace only its port with an ephemeral test
// port; preserve its host and read the address of the real opened socket.
const probe = `
  import { Server } from 'node:net';
  const originalListen = Server.prototype.listen;
  Server.prototype.listen = function (...args) {
    const options = args[0];
    const requestedPort = typeof options === 'object' && options !== null
      ? Number(options.port) : typeof options === 'number' ? options : NaN;
    if (requestedPort !== 3000) {
      process.send({ kind: 'listener', requestedPort: Number.isNaN(requestedPort) ? null : requestedPort });
      process.exitCode = 1;
      return this;
    }
    if (typeof options === 'object') args[0] = { ...options, port: 0 };
    else args[0] = 0;
    this.once('listening', () => {
      process.send({ kind: 'listener', requestedPort, address: this.address() });
      this.close(() => process.exit(0));
    });
    return originalListen.apply(this, args);
  };
  await import(${JSON.stringify(pathToFileURL(path.resolve(entry)).href)});
`;

let failed = 0;
for (const mode of ['unset', 'production']) {
  const name = `service_listener_node_env_${mode}`;
  const env = { ...process.env };
  if (mode === 'unset') delete env.NODE_ENV;
  else env.NODE_ENV = 'production';
  try {
    const result = await runProbe(env);
    assert.equal(result.requestedPort, 3000, 'production Service must request port 3000');
    assert.ok(['0.0.0.0', '::'].includes(result.address?.address), 'production Service must bind container interfaces, not loopback');
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;

function runProbe(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', probe], {
      env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let result;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Service did not open a verifiable socket within 5 seconds'));
    }, 5000);
    child.on('message', message => { if (message?.kind === 'listener') result = message; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Service startup did not complete successfully (exit ${code})`));
      else if (result) resolve(result);
      else reject(new Error(`Service exited without opening a verifiable socket (exit ${code})`));
    });
  });
}
