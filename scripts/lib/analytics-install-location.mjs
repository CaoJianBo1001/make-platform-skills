import { readFile } from 'node:fs/promises';
import { delimiter, resolve } from 'node:path';

/** npm exec 将隔离 node_modules/.bin 加入 PATH；不依赖机器上的全局工具。 */
export async function resolveAnalyticsInstall(searchPath = '') {
  for (const entry of searchPath.split(delimiter).filter(Boolean)) {
    const root = resolve(entry, '..', '@qfei-design/make-app-analytics');
    let manifest;
    try {
      manifest = JSON.parse(
        await readFile(resolve(root, 'package.json'), 'utf8'),
      );
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
      throw error;
    }
    if (
      manifest.name === '@qfei-design/make-app-analytics' &&
      manifest.version === '0.1.9'
    )
      return root;
  }
  throw new Error('隔离环境没有安装 @qfei-design/make-app-analytics@0.1.9');
}
