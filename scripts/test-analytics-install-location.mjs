import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { resolveAnalyticsInstall } from './lib/analytics-install-location.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'analytics install '));
try {
  const globalBin = join(temporary, 'global', 'bin');
  const install = async (name, version) => {
    const modules = join(temporary, name, 'node_modules');
    const root = join(modules, '@qfei-design', 'make-app-analytics');
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: '@qfei-design/make-app-analytics', version }),
    );
    return { root, bin: join(modules, '.bin') };
  };
  const old = await install('old', '0.1.8');
  const release = await install('npm-exec', '0.1.9');
  assert.equal(
    await resolveAnalyticsInstall(
      [globalBin, old.bin, release.bin].join(delimiter),
    ),
    release.root,
    '忽略全局工具与旧制品，支持安装路径包含空格',
  );
  await assert.rejects(
    resolveAnalyticsInstall([globalBin, old.bin].join(delimiter)),
    /0\.1\.9/,
    '缺少正式制品必须失败，不能误报运行时通过',
  );
  await writeFile(join(release.root, 'package.json'), '{broken');
  await assert.rejects(resolveAnalyticsInstall(release.bin), SyntaxError);
  console.info('analytics isolated install location: PASS');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
