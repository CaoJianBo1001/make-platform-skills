#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exportFile = (root, entry, condition, code) => {
  const target = typeof entry === 'string' ? entry : entry?.[condition] ?? entry?.default;
  assert.ok(typeof target === 'string', code);
  const resolved = path.resolve(root, target);
  assert.ok(resolved.startsWith(root + path.sep), 'feedback_export_outside_package');
  assert.ok(target.startsWith('./'), code);
  assert.ok(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), code);
  assert.ok(fs.realpathSync(resolved).startsWith(root + path.sep), 'feedback_export_outside_package');
  return resolved;
};

export async function verifyFeedbackPackageSurface(directory, { allowPrerelease = false } = {}) {
  assert.ok(fs.existsSync(path.join(directory, 'package.json')), 'feedback_package_unavailable');
  const root = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.name, '@qfeius/make-app-feedback', 'feedback_package_name_mismatch');
  const version = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/u.exec(manifest.version ?? '');
  assert.ok(version && (Number(version[1]) > 0 || Number(version[2]) >= 1), 'feedback_version_unsupported');
  assert.ok(!version[4] || allowPrerelease, 'feedback_prerelease_requires_opt_in');
  const entry = manifest.exports?.['.'];
  const esm = exportFile(root, entry, 'import', 'feedback_public_export_missing');
  const cjs = exportFile(root, entry, 'require', 'feedback_public_export_missing');
  exportFile(root, entry, 'types', 'feedback_public_types_missing');
  const css = exportFile(root, manifest.exports?.['./styles.css'], 'default', 'feedback_css_export_missing');
  exportFile(root, manifest.exports?.['./styles.css'], 'types', 'feedback_css_types_missing');
  assert.ok(fs.readFileSync(css, 'utf8').trim(), 'feedback_css_empty');

  const require = createRequire(path.join(root, 'package.json'));
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { PermissionFeedback } = await import(pathToFileURL(esm).href);
  assert.equal(typeof PermissionFeedback, 'function', 'feedback_component_missing');
  assert.equal(typeof require(cjs).PermissionFeedback, 'function', 'feedback_cjs_component_missing');
  const render = props => renderToStaticMarkup(React.createElement(PermissionFeedback, props));
  for (const scope of ['app', 'resource', 'operation']) {
    const html = render({ scope, administrators: [{ userId: '1', name: '<script>name</script>' }] });
    assert.ok(html.includes(`data-scope="${scope}"`), `feedback_scope_missing: ${scope}`);
    assert.ok(html.includes('&lt;script&gt;name&lt;/script&gt;'), 'feedback_name_not_escaped');
    assert.ok(!html.includes('<script>'), 'feedback_unsafe_name_html');
  }
  const empty = render({ scope: 'resource' });
  assert.ok(empty.includes('请联系应用管理员'), 'feedback_generic_help_missing');
  assert.ok(!/<button\b/u.test(empty), 'feedback_fabricated_action');
  let callbacks = 0;
  const checking = render({ scope: 'resource', retryStatus: 'checking', onRetry: () => callbacks++ });
  assert.match(checking, /<button\b[^>]*\bdisabled(?:=""|\s|>)/u, 'feedback_checking_not_disabled');
  assert.ok(checking.includes('正在检查'), 'feedback_checking_state_missing');
  const error = render({ scope: 'resource', retryStatus: 'error', onRetry: () => callbacks++ });
  assert.ok(error.includes('暂时无法检查权限'), 'feedback_retry_error_missing');
  const restored = render({ scope: 'operation', retryStatus: 'restored', onRetry: () => callbacks++ });
  assert.ok(restored.includes('权限已恢复'), 'feedback_restored_state_missing');
  assert.equal(callbacks, 0, 'feedback_automatic_host_action');
  return manifest.version;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node verify-feedback-package-surface.mjs <installed-package-root> [--allow-prerelease]\n--allow-prerelease is only for explicitly approved local testing; it does not prove registry publication.');
  } else {
    try {
      assert.ok(args[0] && !args[0].startsWith('-'), 'feedback_package_unavailable: provide the installed package root');
      assert.ok(args.slice(1).every(arg => arg === '--allow-prerelease'), 'feedback_unknown_option');
      const version = await verifyFeedbackPackageSurface(path.resolve(args[0]), { allowPrerelease: args.includes('--allow-prerelease') });
      console.log(`feedback package surface verified: ${version}; host route and runtime tests are still required`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'feedback_package_verification_failed');
      process.exitCode = 1;
    }
  }
}
