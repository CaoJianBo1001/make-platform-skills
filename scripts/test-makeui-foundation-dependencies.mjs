import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('the standalone Skill fallback declares the tested official runtime dependencies', async () => {
  const contract = JSON.parse(await readFile(new URL('../skills/makeui/assets/antd-foundation/foundation.json', import.meta.url), 'utf8'));
  assert.equal(contract.contract, 'makeui-antd-foundation/v1');
  assert.equal(contract.library, 'antd');
  assert.deepEqual(contract.dependencies, { antd: '6.7.2', dayjs: '1.11.20', 'lucide-react': '1.47.0' });
  assert.equal(contract.peerDependencies.react, '>=18.0.0');
  assert.equal(contract.peerDependencies['react-dom'], '>=18.0.0');
});
