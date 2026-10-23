import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDirectCiNodeCommand } from './lib/ci-node-test-command.mjs';

const script = 'skills/makeui/scripts/test-verify-feedback-package-surface.mjs';
for (const command of [
  `node ${script}`,
  `node --test ${script}`,
  `node --test --test-reporter=spec "${script}"`,
  `node --enable-source-maps --test '${script}'`,
  `run: node --test ${script}`,
  `- run: node --test ${script}`,
  `    node --test ${script} # run the package regression`,
]) {
  test(`equivalent direct CI command: ${command}`, () => {
    assert.equal(hasDirectCiNodeCommand(command, script), true);
  });
}

for (const command of [
  '',
  `# node --test ${script}`,
  `echo "node --test ${script}"`,
  `node --test ${script}.bak`,
  `node --test other/${script}`,
  `node --eval "${script}"`,
  `node --print "${script}"`,
  `node --check ${script}`,
]) {
  test(`absent or diagnostic text is not a CI command: ${command}`, () => {
    assert.equal(hasDirectCiNodeCommand(command, script), false);
  });
}
