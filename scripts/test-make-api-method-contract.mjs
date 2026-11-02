#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `Expected ${relativePath} under repo root ${repoRoot}`);
  return fs.readFileSync(filePath, 'utf8');
};

const metaApiDesign = read('skills/makedsl/references/MetaAPIDesign.md');
const dataApiDesign = read('skills/makedsl/references/DataAPIDesign.md');
const serviceAdapter = read('skills/make-app-service/references/make-data-adapter.md');
const authAuditTest = read('skills/make-app-auth/scripts/test-audit-auth-contract.mjs');

assert.match(
  metaApiDesign,
  /POST\s+https:\/\/dev-make\.qtech\.cn\/api\/make\/meta\/v1\/schema[\s\S]*X-Make-Target:\s*MakeService\.GetResource[\s\S]*"appKey"\s*:\s*"<APP_KEY>"/,
  'Meta API schema design must remain POST /meta/v1/schema with MakeService.GetResource and appKey body',
);

assert.match(
  dataApiDesign,
  /POST\s+https:\/\/dev-make\.qtech\.cn\/api\/make\/data\/v1\/record[\s\S]*X-Make-Target:\s*MakeService\.GetResource/,
  'Data API record GetResource design must remain POST /data/v1/record',
);

const assertNoDefaultFetchForMakePath = (content, pathPattern, label) => {
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (!/fetch\(/.test(line) || !pathPattern.test(line)) return;
    const snippet = lines.slice(index, index + 8).join('\n');
    assert.match(
      snippet,
      /method:\s*['"]POST['"]/,
      `${label} line ${index + 1} must explicitly use method: 'POST'`,
    );
  });
};

assert.doesNotMatch(
  serviceAdapter,
  /GET\s+\$\{(?:gatewayOrigin|publicGatewayOrigin)\}\/(?:make|api\/make)\/meta\/v1\/schema/,
  'make-app-service must not document GET for upstream /meta/v1/schema calls',
);
assert.match(
  serviceAdapter,
  /POST\s+\$\{gatewayOrigin\}\/make\/meta\/v1\/schema/,
  'make-app-service must document POST for published upstream /make/meta/v1/schema',
);
assert.match(
  serviceAdapter,
  /POST\s+\$\{publicGatewayOrigin\}\/api\/make\/meta\/v1\/schema/,
  'make-app-service must document POST for local-preview upstream /api/make/meta/v1/schema',
);
assert.match(
  serviceAdapter,
  /schema\/meta calls[\s\S]*`X-Make-Target: MakeService\.GetResource`[\s\S]*body `\{ appKey: config\.appKey/,
  'make-app-service schema adapter guidance must require target header and config appKey body',
);

// Auth documentation is executed by test-auth-app-context.mjs, including
// method, target header and body assertions without binding a wrapper name.
assertNoDefaultFetchForMakePath(
  authAuditTest,
  /\/data\/v1\/record/,
  'make-app-auth test-audit-auth-contract.mjs',
);

console.log('make api method contract passed');
