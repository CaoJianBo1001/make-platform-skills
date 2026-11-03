#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isReactComponentExport } from './react-component-contract.mjs';

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
  assert.equal(manifest.name, '@qfei-design/make-app-observability', 'feedback_package_name_mismatch');
  const version = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/u.exec(manifest.version ?? '');
  assert.ok(version && (Number(version[1]) > 0 || Number(version[2]) > 1
    || (Number(version[2]) === 1 && Number(version[3]) >= 9)), 'feedback_version_unsupported: require @qfei-design/make-app-observability >= 0.1.9');
  assert.ok(!version[4] || allowPrerelease, 'feedback_prerelease_requires_opt_in');
  const entry = manifest.exports?.['./react'];
  const esm = exportFile(root, entry, 'import', 'feedback_public_export_missing');
  const cjs = exportFile(root, entry, 'require', 'feedback_public_export_missing');
  exportFile(root, entry, 'types', 'feedback_public_types_missing');
  const css = exportFile(root, manifest.exports?.['./styles.css'], 'default', 'feedback_css_export_missing');
  exportFile(root, manifest.exports?.['./styles.css'], 'types', 'feedback_css_types_missing');
  const styles = fs.readFileSync(css, 'utf8');
  assert.ok(styles.trim(), 'feedback_css_empty');
  assert.ok(styles.includes('.make-app-error-notice.make-app-error-notice--permission'), 'feedback_permission_css_missing');
  const coreEntry = manifest.exports?.['.'];
  const coreEsm = exportFile(root, coreEntry, 'import', 'feedback_core_export_missing');
  exportFile(root, coreEntry, 'types', 'feedback_core_types_missing');

  const require = createRequire(path.join(root, 'package.json'));
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { MakeAppPermissionNotice, MakeAppErrorNotice, MakeAppErrorNoticeViewport } = await import(pathToFileURL(esm).href);
  const cjsComponents = require(cjs);
  for (const [component, code] of [
    [MakeAppPermissionNotice, 'feedback_component_missing'],
    [cjsComponents.MakeAppPermissionNotice, 'feedback_cjs_component_missing'],
    [MakeAppErrorNotice, 'feedback_existing_error_component_missing'],
    [cjsComponents.MakeAppErrorNotice, 'feedback_cjs_error_component_missing'],
    [MakeAppErrorNoticeViewport, 'feedback_existing_viewport_missing'],
    [cjsComponents.MakeAppErrorNoticeViewport, 'feedback_cjs_viewport_missing'],
  ]) {
    assert.ok(isReactComponentExport(component), code);
  }
  const core = await import(pathToFileURL(coreEsm).href);
  assert.equal(typeof core.normalizeMakeAppPermissionNotice, 'function', 'feedback_normalizer_missing');
  const traceId = '1234567890abcdef1234567890abcdef';
  const oldError = renderToStaticMarkup(React.createElement(MakeAppErrorNotice, { kind: 'network', title: '请求失败', traceId }));
  assert.ok(oldError.includes(traceId), 'feedback_existing_trace_display_missing');
  const render = props => renderToStaticMarkup(React.createElement(MakeAppPermissionNotice, props));
  for (const [variant, scope] of [['page', 'app'], ['inline', 'resource'], ['inline', 'operation'], ['toast', 'operation']]) {
    const html = render({ variant, scope, administrators: [{ userId: '1', name: '<script>name</script>' }] });
    assert.ok(html.includes(`data-scope="${scope}"`), `feedback_scope_missing: ${scope}`);
    assert.ok(html.includes(`data-variant="${variant}"`), `feedback_variant_missing: ${variant}`);
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
  assert.ok(!/<button\b/u.test(restored), 'feedback_restored_action_not_removed');
  const toast = render({ variant: 'toast', scope: 'operation', operationName: '导出', onClose: () => callbacks++ });
  assert.ok(toast.includes('暂无导出权限'), 'feedback_operation_name_missing');
  assert.ok(toast.includes('关闭权限提示'), 'feedback_toast_close_missing');
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
