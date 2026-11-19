import { loadMonetaryExample, verifyMonetaryExample } from './lib/analytics-monetary-example.mjs';

await loadMonetaryExample();
if (process.env.MAKE_ANALYTICS_PACKAGE_ROOT) await verifyMonetaryExample(process.env.MAKE_ANALYTICS_PACKAGE_ROOT);
else console.info('monetary examples: 配置模块已执行，未提供正式包目录，跳过接口运行验收');
