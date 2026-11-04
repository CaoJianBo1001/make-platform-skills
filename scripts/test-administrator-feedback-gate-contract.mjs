import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasDirectCiNodeCommand } from './lib/ci-node-test-command.mjs';

test('the administrator feedback audit and behavioral gate stay in repository CI', async () => {
  const workflow = await readFile(new URL('../.github/workflows/skill-metadata-lint.yml', import.meta.url), 'utf8');
  for (const name of ['test-administrator-feedback-audit.mjs', 'test-administrator-feedback-conformance-suite.mjs']) {
    assert.ok(hasDirectCiNodeCommand(workflow, `skills/make-app-permission/scripts/${name}`), `${name} must execute in CI`);
  }
});
