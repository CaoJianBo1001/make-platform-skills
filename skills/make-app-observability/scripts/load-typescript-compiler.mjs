import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// 每个 Skill 独立携带此模块；只按指定工作区的 Node 规则解析，不扫描全局工具。
export function loadTypeScriptCompiler(
  workspace,
  {
    requiredFunctions = ['createProgram'],
    requiredEnums = ['JsxEmit.Preserve'],
    compilerWorkspace,
    requireImpl,
  } = {},
) {
  if (compilerWorkspace) {
    let directory = false;
    try {
      directory = fs.statSync(path.resolve(compilerWorkspace)).isDirectory();
    } catch {}
    if (!directory)
      throw unavailable(
        '--compiler-workspace must name an existing tooling directory.',
      );
  }
  const require =
    requireImpl ??
    createRequire(
      path.resolve(compilerWorkspace ?? workspace, '__skill_compiler__.cjs'),
    );
  const failures = [];
  for (const name of [
    'typescript',
    '@typescript/typescript6',
    'typescript-compiler-api',
  ]) {
    try {
      const compiler = require(name);
      const missing = [
        ...requiredFunctions.filter(
          (key) => typeof compiler?.[key] !== 'function',
        ),
        ...requiredEnums.filter(
          (key) =>
            key.split('.').reduce((value, part) => value?.[part], compiler) ===
            undefined,
        ),
      ];
      if (missing.length) {
        failures.push(`${name}: missing ${missing.slice(0, 4).join(', ')}`);
        continue;
      }
      let version = 'unknown';
      try {
        const manifest = require(name + '/package.json');
        if (typeof manifest?.version === 'string') version = manifest.version;
      } catch {}
      return {
        compiler,
        name,
        version,
        apiVersion: compiler.version ?? 'unknown',
      };
    } catch (error) {
      failures.push(`${name}: ${error?.code ?? error?.name ?? 'load failed'}`);
    }
  }
  throw unavailable(
    failures.join('; ') +
      '. Keep the project compiler; provide a compatible official compiler API in this workspace or --compiler-workspace=<tooling-workspace>.',
  );
}

function unavailable(detail) {
  const error = new Error('compiler_api_unavailable: ' + detail);
  error.code = 'compiler_api_unavailable';
  return error;
}
