import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const script = fileURLToPath(new URL('./verify-feedback-package-surface.mjs', import.meta.url));
const mobileScript = fileURLToPath(new URL('./verify-mobile-package-surface.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const withPackage = (changes, check) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-surface-test-'));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: '@qfei-design/make-app-observability', version: '0.1.9', ...changes }));
  try { check(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
};

test('help documents the local prerelease boundary', () => {
  const result = run('--help');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--allow-prerelease/u);
});
test('a missing install is a package readiness failure', () => {
  const result = run(path.join(os.tmpdir(), 'feedback-package-does-not-exist'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_package_unavailable/u);
});
test('the package name must match the requested dependency', () => withPackage({ name: '@other/feedback' }, directory => {
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_package_name_mismatch/u);
}));
for (const version of ['0.1.0', '0.1.8', '0.1.8-alpha.2']) {
  test(`installed version ${version} is below the new feedback baseline`, () => withPackage({ version }, directory => {
    const result = run(directory, '--allow-prerelease');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /feedback_version_unsupported/u);
  }));
}
for (const version of ['0.1.9', '0.2.0', '1.0.0']) {
  test(`installed version ${version} still requires public exports`, () => withPackage({ version }, directory => {
    const result = run(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /feedback_public_export_missing/u);
  }));
}
test('prerelease requires an explicit local-test opt-in', () => withPackage({ version: '0.1.9-alpha.0' }, directory => {
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_prerelease_requires_opt_in/u);
}));
test('an opted-in prerelease still requires actual public exports', () => withPackage({ version: '0.1.9-alpha.0' }, directory => {
  const result = run(directory, '--allow-prerelease');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_public_export_missing/u);
}));
test('a missing CSS export is not hidden by an existing React export', () => withPackage({ exports: { './react': { import: './index.mjs', require: './index.cjs', types: './index.d.ts' } } }, directory => {
  fs.writeFileSync(path.join(directory, 'index.mjs'), 'export const MakeAppPermissionNotice = () => null;');
  fs.writeFileSync(path.join(directory, 'index.cjs'), 'exports.MakeAppPermissionNotice = () => null;');
  fs.writeFileSync(path.join(directory, 'index.d.ts'), 'export declare function MakeAppPermissionNotice(): null;');
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_css_export_missing/u);
}));
test('a public export cannot escape the installed package', () => withPackage({ exports: { './react': { import: '../outside.mjs', require: './index.cjs', types: './index.d.ts' } } }, directory => {
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_export_outside_package/u);
}));
test('a root export cannot stand in for the required React subpath', () => withPackage({ exports: { '.': './index.mjs' } }, directory => {
  fs.writeFileSync(path.join(directory, 'index.mjs'), 'export const MakeAppPermissionNotice = () => null;');
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /feedback_public_export_missing/u);
}));

const installReactDependencies = directory => {
  const dependencies = createRequire(path.resolve(process.env.MAKE_FEEDBACK_TEST_DEPENDENCIES ?? '.', 'package.json'));
  fs.mkdirSync(path.join(directory, 'node_modules'));
  for (const name of ['react', 'react-dom']) {
    fs.symlinkSync(path.dirname(dependencies.resolve(`${name}/package.json`)), path.join(directory, 'node_modules', name), 'junction');
  }
};

// These are verifier fixtures rendered with real React, not published npm artifacts.
const withValidPackage = check => withPackage({ exports: {
  '.': { import: './core.mjs', types: './core.d.ts' },
  './react': { import: './react.mjs', require: './react.cjs', types: './react.d.ts' },
  './styles.css': { default: './styles.css', types: './styles.css.d.ts' },
} }, directory => {
  installReactDependencies(directory);
  const files = {
    'core.mjs': 'export const normalizeMakeAppPermissionNotice = input => input;',
    'core.d.ts': 'export declare function normalizeMakeAppPermissionNotice(input: unknown): unknown;',
    'react.mjs': `import components from './components.cjs'; export const { MakeAppPermissionNotice, MakeAppErrorNotice, MakeAppErrorNoticeViewport } = components;`,
    'react.cjs': `module.exports = require('./components.cjs');`,
    'react.d.ts': 'export declare function MakeAppPermissionNotice(props: unknown): unknown;',
    'styles.css': '.make-app-error-notice.make-app-error-notice--permission { display: flex; }',
    'styles.css.d.ts': 'export {};',
    'components.cjs': `
      const React = require('react');
      function MakeAppPermissionNotice({ variant = 'inline', scope = 'resource', administrators = [], retryStatus, onRetry, onClose, operationName }) {
        const children = [React.createElement('p', { key: 'help' }, '请联系应用管理员'),
          ...administrators.map(admin => React.createElement('span', { key: admin.userId }, admin.name))];
        if (retryStatus === 'error') children.push(React.createElement('p', { key: 'error' }, '暂时无法检查权限'));
        if (retryStatus === 'restored') children.push(React.createElement('p', { key: 'restored' }, '权限已恢复'));
        if (onRetry && retryStatus !== 'restored') children.push(React.createElement('button', {
          key: 'retry', disabled: retryStatus === 'checking', onClick: onRetry,
        }, retryStatus === 'checking' ? '正在检查' : '刷新权限'));
        if (variant === 'toast') {
          children.push(React.createElement('p', { key: 'operation' }, '暂无' + operationName + '权限'));
          if (onClose) children.push(React.createElement('button', { key: 'close', 'aria-label': '关闭权限提示', onClick: onClose }, '关闭'));
        }
        return React.createElement('section', { 'data-scope': scope, 'data-variant': variant }, ...children);
      }
      function MakeAppErrorNotice({ traceId }) { return React.createElement('p', null, traceId); }
      module.exports = { MakeAppPermissionNotice, MakeAppErrorNotice, MakeAppErrorNoticeViewport: () => null };
    `,
  };
  for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), source);
  check(directory);
});

test('a complete valid package passes ESM/CJS imports and real React SSR checks', () => withValidPackage(directory => {
  const result = run(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /feedback package surface verified: 0\.1\.9/u);
}));

for (const [name, file, before, after, failure] of [
  ['unsafe administrator HTML', 'components.cjs', "{ key: admin.userId }, admin.name", "{ key: admin.userId, dangerouslySetInnerHTML: { __html: admin.name } }", 'feedback_name_not_escaped'],
  ['enabled checking action', 'components.cjs', "disabled: retryStatus === 'checking'", 'disabled: false', 'feedback_checking_not_disabled'],
  ['automatic retry during rendering', 'components.cjs', 'const children = [', 'if (onRetry) onRetry(); const children = [', 'feedback_automatic_host_action'],
  ['lost existing trace display', 'components.cjs', "React.createElement('p', null, traceId)", "React.createElement('p', null, 'missing trace')", 'feedback_existing_trace_display_missing'],
  ['missing CJS permission export', 'react.cjs', "module.exports = require('./components.cjs');", 'module.exports = {};', 'feedback_cjs_component_missing'],
]) {
  test(`an otherwise valid package rejects ${name}`, () => withValidPackage(directory => {
    const filename = path.join(directory, file);
    const source = fs.readFileSync(filename, 'utf8');
    const mutated = source.replace(before, after);
    assert.notEqual(mutated, source, 'the fixture mutation must change the exercised package');
    fs.writeFileSync(filename, mutated);
    const result = run(directory);
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(failure), result.stderr);
  }));
}

const wrappers = [
  ['memo', 'React.memo(Component)'],
  ['forwardRef', 'React.forwardRef((props, ref) => React.createElement(Component, props))'],
  ['memo-forwardRef', 'React.memo(React.forwardRef((props, ref) => React.createElement(Component, props)))'],
  ['nested-memo', 'React.memo(React.memo(Component))'],
];
const invalidComponents = [
  ['missing', 'undefined'],
  ['object', '{}'],
  ['invalid-memo', '{ $$typeof: Symbol.for("react.memo"), type: {} }'],
  ['invalid-forwardRef', '{ $$typeof: Symbol.for("react.forward_ref"), render: null }'],
  ['cyclic-memo', '(() => { const value = { $$typeof: Symbol.for("react.memo") }; value.type = value; return value; })()'],
];
const feedbackExports = [
  ['MakeAppPermissionNotice', 'feedback_component_missing', 'feedback_cjs_component_missing'],
  ['MakeAppErrorNotice', 'feedback_existing_error_component_missing', 'feedback_cjs_error_component_missing'],
  ['MakeAppErrorNoticeViewport', 'feedback_existing_viewport_missing', 'feedback_cjs_viewport_missing'],
];
const replaceFeedbackExport = (directory, format, name, expression) => {
  const others = feedbackExports.map(([key]) => key).filter(key => key !== name);
  fs.writeFileSync(path.join(directory, format === 'ESM' ? 'react.mjs' : 'react.cjs'), format === 'ESM'
    ? `import React from 'react'; import components from './components.cjs'; const Component = components.${name}; export const { ${others.join(', ')} } = components; export const ${name} = ${expression};`
    : `const React = require('react'); const components = require('./components.cjs'); const Component = components.${name}; module.exports = { ...components, ${name}: ${expression} };`);
};

for (const [name, esmFailure, cjsFailure] of feedbackExports) {
  for (const format of ['ESM', 'CJS']) {
    for (const [wrapper, expression] of wrappers) {
      test(`${format} ${name} accepts supported ${wrapper} exports`, () => withValidPackage(directory => {
        replaceFeedbackExport(directory, format, name, expression);
        const result = run(directory);
        assert.equal(result.status, 0, result.stderr);
      }));
    }
    for (const [kind, expression] of invalidComponents) {
      test(`${format} ${name} rejects ${kind}`, () => withValidPackage(directory => {
        replaceFeedbackExport(directory, format, name, expression);
        const result = run(directory);
        assert.equal(result.status, 1, result.stderr);
        assert.ok(result.stderr.includes(format === 'ESM' ? esmFailure : cjsFailure), result.stderr);
      }));
    }
  }
}

for (const [wrapper, expression] of [...wrappers, ['object', '{}']]) {
  test(`ordinary normalizer must remain a function and reject ${wrapper}`, () => withValidPackage(directory => {
    fs.writeFileSync(path.join(directory, 'core.mjs'), `import React from 'react'; const Component = () => null; export const normalizeMakeAppPermissionNotice = ${expression};`);
    const result = run(directory);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /feedback_normalizer_missing/);
  }));
}

const withValidMobilePackage = check => withPackage({
  name: '@qfei-design/make-app-mobile',
  exports: { './styles.css': './mobile.css', './fields': './fields.mjs', './primitives': './primitives.mjs' },
}, directory => {
  installReactDependencies(directory);
  fs.writeFileSync(path.join(directory, 'mobile.css'), `
    .make-app-mobile-picker__search input { font-size: 16px; }
    .make-app-mobile-picker__selected { touch-action: pan-x pinch-zoom; }
    .make-app-mobile-attachment-field__upload { box-sizing: border-box; height: 48px; }
  `);
  fs.writeFileSync(path.join(directory, 'attachment.cjs'), `
    const React = require('react');
    module.exports = ({items, onRetry}) => {
      const item = items[0];
      const status = item.status === 'pending'
        ? React.createElement('span', {className:'make-app-mobile-attachment-field__status-icon', 'aria-label':'待上传'})
        : item.status === 'error'
          ? onRetry
            ? React.createElement('button', {className:'make-app-mobile-attachment-field__retry', 'aria-label':'重新上传' + item.name})
            : React.createElement('span', {className:'make-app-mobile-attachment-field__status'}, '上传失败')
          : null;
      return React.createElement('div', null, status);
    };
  `);
  fs.writeFileSync(path.join(directory, 'fields.mjs'), `import Component from './attachment.cjs'; export const MobileAttachmentField = Component;`);
  fs.writeFileSync(path.join(directory, 'primitives.mjs'), ['MobileTimeline','MobileDetailSection','MobileFieldRow','MobileTextArea','MobileDetailPage','MobileFormActionBar','MobileFormSheet'].map(name => `export const ${name} = () => null;`).join('\n'));
  check(directory);
});

for (const detail of [false, true]) {
  for (const [wrapper, expression] of [['function', 'Component'], ...wrappers]) {
    test(`attachment ${wrapper} renders correctly with detail=${detail}`, () => withValidMobilePackage(directory => {
      fs.writeFileSync(path.join(directory, 'fields.mjs'), `import React from 'react'; import Component from './attachment.cjs'; export const MobileAttachmentField = ${expression};`);
      const result = spawnSync(process.execPath, [mobileScript, directory, ...(detail ? ['--detail'] : [])], {encoding:'utf8'});
      assert.equal(result.status, 0, result.stderr);
    }));
  }
  for (const [kind, expression] of invalidComponents) {
    test(`attachment rejects ${kind} with detail=${detail}`, () => withValidMobilePackage(directory => {
      fs.writeFileSync(path.join(directory, 'fields.mjs'), `export const MobileAttachmentField = ${expression};`);
      const result = spawnSync(process.execPath, [mobileScript, directory, ...(detail ? ['--detail'] : [])], {encoding:'utf8'});
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /MobileAttachmentField/);
    }));
  }
}

test('documented feedback commands run from an independently installed Skill', () => withValidPackage(directory => {
  const installed = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback installed Skill '));
  try {
    fs.cpSync(path.dirname(script), path.join(installed, 'scripts'), {recursive:true});
    const markdown = fs.readFileSync(new URL('../references/permission-feedback.md', import.meta.url), 'utf8');
    const commands = [...markdown.matchAll(/node (\S+verify-feedback-package-surface\.mjs) "?<installed-package-root>"?( --allow-prerelease)?/g)];
    assert.equal(commands.length, 2, '同时执行正式产物与本地预发布产物的文档命令');
    for (const [, command, prerelease] of commands) {
      const result = spawnSync(process.execPath, [command, directory, ...(prerelease ? [prerelease.trim()] : [])], {cwd:installed, encoding:'utf8'});
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /feedback package surface verified/);
    }
  } finally { fs.rmSync(installed, {recursive:true, force:true}); }
}));
