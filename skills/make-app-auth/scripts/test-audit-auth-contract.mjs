#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const auditScript = path.join(scriptDir, 'audit-auth-contract.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-app-auth-audit-'));

try {
  const goodRoot = createFixture('good-service-fronted', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        if (!headers.get('x-forwarded-host')) {
          const host = source.get('host');
          if (host) headers.set('x-forwarded-host', host);
        }
        if (!headers.get('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  assert.match(runAudit(goodRoot), /status: PASS/);

  for (const version of ['^0.1.3', '0.1.3', '>0.1.2', '>=0.1.3 <0.2.0', '0.1.3 - 0.2.0', '^1.0.0']) {
    writeSdkDependency(goodRoot, version);
    assert.match(runAudit(goodRoot), /status: PASS/, `expected ${version} to pass`);
  }

  for (const version of ['^0.1.2', '<0.1.3', '>=0.1.3 || 0.1.2']) {
    writeSdkDependency(goodRoot, version);
    const output = runAudit(goodRoot, { expectFailure: true });
    assert.match(output, /sdk_version_too_old/, `expected ${version} to be rejected as too old`);
  }

  for (const version of ['workspace:*', 'file:../sdk', 'latest']) {
    writeSdkDependency(goodRoot, version);
    const output = runAudit(goodRoot, { expectFailure: true });
    assert.match(output, /sdk_version_unverifiable/, `expected ${version} to be rejected as unverifiable`);
  }

  writeSdkDependency(goodRoot, '^0.1.3');
  write(path.join(goodRoot, 'pnpm-workspace.yaml'), `
packages:
  - apps/*
overrides:
  '@qfeius/make-app-auth': 0.1.2
  `);
  const pnpmOverrideOutput = runAudit(goodRoot, { expectFailure: true });
  assert.match(pnpmOverrideOutput, /sdk_version_override_too_old/);
  fs.rmSync(path.join(goodRoot, 'pnpm-workspace.yaml'));

  write(
    path.join(goodRoot, 'pnpm-workspace.yaml'),
    `overrides: { unrelated-package: 1.0.0, '@qfeius/make-app-auth': 0.1.2 }`
  );
  const pnpmInlineOverrideOutput = runAudit(goodRoot, { expectFailure: true });
  assert.match(pnpmInlineOverrideOutput, /sdk_version_override_too_old/);
  fs.rmSync(path.join(goodRoot, 'pnpm-workspace.yaml'));

  write(path.join(goodRoot, 'package.json'), JSON.stringify({
    private: true,
    overrides: {
      '@qfeius/make-app-auth': '0.1.2'
    }
  }));
  const npmOverrideOutput = runAudit(goodRoot, { expectFailure: true });
  assert.match(npmOverrideOutput, /sdk_version_override_too_old/);

  write(path.join(goodRoot, 'package.json'), JSON.stringify({
    private: true,
    resolutions: {
      '@qfeius/make-app-auth': 'file:../make-app-auth'
    }
  }));
  const yarnResolutionOutput = runAudit(goodRoot, { expectFailure: true });
  assert.match(yarnResolutionOutput, /sdk_version_override_unverifiable/);

  write(path.join(goodRoot, 'package.json'), JSON.stringify({
    private: true,
    pnpm: {
      overrides: {
        '@qfeius/make-app-auth': '^0.1.3'
      }
    }
  }));
  assert.match(runAudit(goodRoot), /status: PASS/);
  fs.rmSync(path.join(goodRoot, 'package.json'));

  fs.rmSync(path.join(goodRoot, 'apps/ui/package.json'));
  const missingSdkVersionOutput = runAudit(goodRoot, { expectFailure: true });
  assert.match(missingSdkVersionOutput, /sdk_version_missing/);

  const antdThemeTokenRoot = createFixture('antd-theme-token-not-auth-token', {
    ui: `
      import { ConfigProvider } from 'antd';
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export function App() {
        return <ConfigProvider theme={{ token: { colorPrimary: '#2563eb' } }} />;
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  assert.match(runAudit(antdThemeTokenRoot), /status: PASS/);

  const constantNamespaceProxyRoot = createFixture('constant-namespace-proxy', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      const AUTH_BROWSER_PREFIX = '/api/make/auth';
      const OAUTH_BROWSER_PREFIX = '/api/make/oauth';
      const AUTH_GATEWAY_SCOPE = '/make/auth';
      const OAUTH_GATEWAY_SCOPE = '/make/oauth';
      function applyForwardedHostContext(headers, req) {
        const host = req.header('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      function toConfiguredMakePath(path) {
        return path.startsWith('/make/') ? path.slice('/make'.length) : path;
      }
      async function proxyMakeNamespace(req, res, browserPrefix, upstreamPrefix) {
        const headers = new Headers();
        const cookie = req.header('cookie');
        if (cookie) headers.set('cookie', cookie);
        applyForwardedHostContext(headers, req);
        const upstreamPath = toConfiguredMakePath(upstreamPrefix + req.path.slice(browserPrefix.length));
        const upstream = await fetch('http://make-gateway/make' + upstreamPath, { headers, redirect: 'manual' });
        const setCookie = upstream.headers.get('set-cookie');
        if (setCookie) res.setHeader('set-cookie', setCookie);
        const location = upstream.headers.get('location');
        if (location) res.setHeader('location', location);
      }
      app.use(AUTH_BROWSER_PREFIX, (req, res) => proxyMakeNamespace(req, res, AUTH_BROWSER_PREFIX, AUTH_GATEWAY_SCOPE));
      app.use(OAUTH_BROWSER_PREFIX, (req, res) => proxyMakeNamespace(req, res, OAUTH_BROWSER_PREFIX, OAUTH_GATEWAY_SCOPE));
    `
  });

  assert.match(runAudit(constantNamespaceProxyRoot), /status: PASS/);

  const localPreviewServiceRoot = createFixture('local-preview-service-token-adapter', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      function localPreviewHeaders(headers) {
        if (process.env.MAKE_APP_LOCAL_PREVIEW === 'true') {
          const accessToken = 'server-only-local-token';
          headers.set('authorization', 'Bearer ' + accessToken);
        }
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        localPreviewHeaders(headers);
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  assert.match(runAudit(localPreviewServiceRoot), /status: PASS/);

  const gatedPreviewAuthRoot = createFixture('gated-preview-auth-route', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      function localPreviewCurrentContext() {
        return Response.json({ data: { userId: 'local-preview-user', localPreview: true, authMode: 'token' } });
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (process.env.MAKE_APP_LOCAL_PREVIEW === 'true' && url.pathname === '/api/make/auth/current-context') {
          return localPreviewCurrentContext();
        }
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  assert.match(runAudit(gatedPreviewAuthRoot), /status: PASS/);

  const ungatedPreviewAuthRoot = createFixture('ungated-preview-auth-route', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      function localPreviewCurrentContext() {
        return Response.json({ data: { userId: 'local-preview-user', localPreview: true, authMode: 'token', grantVersion: 'local-preview' } });
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname === '/api/make/auth/current-context') {
          return localPreviewCurrentContext();
        }
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const ungatedPreviewAuthOutput = runAudit(ungatedPreviewAuthRoot, { expectFailure: true });
  assert.match(ungatedPreviewAuthOutput, /local_preview_auth_shadow/);

  const querySensitivePreviewAuthRoot = createFixture('query-sensitive-preview-auth-route', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function isLocalPreviewEnabled() {
        return process.env.MAKE_APP_LOCAL_PREVIEW === 'true';
      }
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      function localPreviewCurrentContext() {
        return Response.json({ data: { userId: 'local-preview-user', localPreview: true, authMode: 'token' } });
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (isLocalPreviewEnabled() && req.originalUrl === '/api/make/auth/current-context') {
          return localPreviewCurrentContext();
        }
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const querySensitivePreviewAuthOutput = runAudit(querySensitivePreviewAuthRoot, { expectFailure: true });
  assert.match(querySensitivePreviewAuthOutput, /local_preview_auth_query_sensitive_match/);

  const uiTokenModeRoot = createFixture('ui-token-mode', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', accessToken: 'browser-token' });
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const uiTokenModeOutput = runAudit(uiTokenModeRoot, { expectFailure: true });
  assert.match(uiTokenModeOutput, /token_mode_present/);

  const missingSetCookieRoot = createFixture('missing-set-cookie-passthrough', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers();
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const missingSetCookieOutput = runAudit(missingSetCookieRoot, { expectFailure: true });
  assert.match(missingSetCookieOutput, /session_complete_set_cookie_not_preserved/);

  const testOnlySetCookieRoot = createFixture('test-only-set-cookie-passthrough', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers();
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `,
    serviceTest: `
      export function testOnlyStringFixture() {
        return 'set-cookie should not satisfy production proxy audit';
      }
    `
  });

  const testOnlySetCookieOutput = runAudit(testOnlySetCookieRoot, { expectFailure: true });
  assert.match(testOnlySetCookieOutput, /session_complete_set_cookie_not_preserved/);

  const missingLocationRoot = createFixture('missing-location-passthrough', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
          const responseHeaders = new Headers();
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const missingLocationOutput = runAudit(missingLocationRoot, { expectFailure: true });
  assert.match(missingLocationOutput, /session_complete_location_not_preserved/);

  const missingHostRoot = createFixture('missing-host-context', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        return fetch('http://make-gateway/make/auth/session/complete', { headers, redirect: 'manual' });
      }
    `
  });

  const missingHostOutput = runAudit(missingHostRoot, { expectFailure: true });
  assert.match(missingHostOutput, /forwarded_host_context_missing/);
  assert.match(missingHostOutput, /forwarded_proto_context_missing/);

  const missingExpiredRoot = createFixture('missing-expired-handling', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      await auth.init({ redirect: true });
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        if (!headers.get('x-forwarded-host')) {
          const host = source.get('host');
          if (host) headers.set('x-forwarded-host', host);
        }
        if (!headers.get('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        return fetch('http://make-gateway/make/auth/session/complete', { headers, redirect: 'manual' });
      }
    `
  });

  const missingExpiredOutput = runAudit(missingExpiredRoot, { expectFailure: true });
  assert.match(missingExpiredOutput, /recoverable_auth_expired_missing/);

  const unsupportedReadyStatusRoot = createFixture('unsupported-ready-status', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const result = await auth.init({ redirect: true });
      if (result.status === 'ready') {
        renderApp();
      }
      if (result.reason === 'state_expired' || result.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        if (!headers.get('x-forwarded-host')) {
          const host = source.get('host');
          if (host) headers.set('x-forwarded-host', host);
        }
        if (!headers.get('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        if (url.pathname === '/api/make/app/schema') {
          return fetch('http://make-gateway/make/meta/schema', { headers });
        }
        return new Response('not found', { status: 404 });
      }
    `
  });

  const unsupportedReadyStatusOutput = runAudit(unsupportedReadyStatusRoot, { expectFailure: true });
  assert.match(unsupportedReadyStatusOutput, /unsupported_sdk_ready_status/);

  const businessApiScopeRoot = createFixture('business-api-wrong-scope', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      const MAKE_API_BASE_URL = 'http://make-gateway/api/make';
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        if (req.url.includes('/api/make/auth/session/complete')) {
          return fetch('http://make-gateway/make/auth/session/complete', { headers, redirect: 'manual' });
        }
        return fetch(MAKE_API_BASE_URL + '/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const businessApiScopeOutput = runAudit(businessApiScopeRoot, { expectFailure: true });
  assert.match(businessApiScopeOutput, /service_fronted_business_gateway_scope_wrong/);

  const dynamicGatewayApiScopeRoot = createFixture('dynamic-gateway-api-wrong-scope', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      const config = { makeGatewayBaseUrl: 'http://make-gateway.make-dev' };
      const AUTH_GATEWAY_SCOPE = '/make/auth';
      const OAUTH_GATEWAY_SCOPE = '/make/oauth';
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      function buildMakeUrl(path) {
        const normalizedPath = path.startsWith('/') ? path : '/' + path;
        return \`\${config.makeGatewayBaseUrl}/api/make\${normalizedPath}\`;
      }
      function buildNamespaceUrl(originalPath, browserPrefix, upstreamPrefix) {
        return config.makeGatewayBaseUrl + upstreamPrefix + originalPath.slice(browserPrefix.length);
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          const upstream = await fetch(buildNamespaceUrl(url.pathname, '/api/make/auth', AUTH_GATEWAY_SCOPE), { headers, redirect: 'manual' });
          const responseHeaders = new Headers(upstream.headers);
          const cookies = upstream.headers.getSetCookie?.() ?? [];
          for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
          const location = upstream.headers.get('location');
          if (location) responseHeaders.set('location', location);
          return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch(buildNamespaceUrl(url.pathname, '/api/make/oauth', OAUTH_GATEWAY_SCOPE), { headers, redirect: 'manual' });
        }
        return fetch(buildMakeUrl('/data/v1/record'), { method: 'POST', headers });
      }
    `
  });

  const dynamicGatewayApiScopeOutput = runAudit(dynamicGatewayApiScopeRoot, { expectFailure: true });
  assert.match(dynamicGatewayApiScopeOutput, /service_fronted_business_gateway_scope_wrong/);

  const spoofedForwardedHostRoot = createFixture('spoofed-forwarded-host', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        if (!headers.get('x-forwarded-host')) {
          const host = source.get('host');
          if (host) headers.set('x-forwarded-host', host);
        }
        if (!headers.get('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({
          cookie: req.headers.get('cookie') || '',
          'x-forwarded-host': req.headers.get('x-forwarded-host') || ''
        });
        applyForwardedHostContext(headers, req.headers);
        return fetch('http://make-gateway/make/auth/session/complete', { headers, redirect: 'manual' });
      }
    `
  });

  const spoofedForwardedHostOutput = runAudit(spoofedForwardedHostRoot, { expectFailure: true });
  assert.match(spoofedForwardedHostOutput, /forwarded_host_passthrough_present/);

  const rawDownloadUrlRoot = createFixture('raw-download-url', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export function ReceiptPreview() {
        return <img src="/api/make/data/v1/download/SampleApp/receipt.jpg" />;
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        if (!headers.get('x-forwarded-host')) {
          const host = source.get('host');
          if (host) headers.set('x-forwarded-host', host);
        }
        if (!headers.get('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        if (req.url.includes('/api/make/auth/session/complete')) {
          return fetch('http://make-gateway/make/auth/session/complete', { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const rawDownloadUrlOutput = runAudit(rawDownloadUrlRoot, { expectFailure: true });
  assert.match(rawDownloadUrlOutput, /service_fronted_raw_download_resource/);

  const endpointOnlyProxyRoot = createFixture('endpoint-only-proxy', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        if (req.url.includes('/api/make/auth/session/complete')) {
          return fetch('http://make-gateway/make/auth/session/complete', { headers, redirect: 'manual' });
        }
        if (req.url.includes('/api/make/auth/current-context')) {
          return fetch('http://make-gateway/make/auth/current-context', { headers });
        }
        if (req.url.includes('/api/make/oauth/challenge')) {
          return fetch('http://make-gateway/make/oauth/challenge', { headers });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const endpointOnlyProxyOutput = runAudit(endpointOnlyProxyRoot, { expectFailure: true });
  assert.match(endpointOnlyProxyOutput, /auth_proxy_missing/);

  const catchAllPassthroughRoot = createFixture('catch-all-passthrough', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        if (url.pathname.startsWith('/api/make/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api/make', ''), { headers });
        }
        return new Response('not found', { status: 404 });
      }
    `
  });

  const catchAllPassthroughOutput = runAudit(catchAllPassthroughRoot, { expectFailure: true });
  assert.match(catchAllPassthroughOutput, /service_fronted_catch_all_passthrough/);

  const appCatchAllPassthroughRoot = createFixture('app-catch-all-passthrough', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api/make', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/make/auth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        if (url.pathname.startsWith('/api/make/oauth/')) {
          return fetch('http://make-gateway/make' + url.pathname.replace('/api', ''), { headers, redirect: 'manual' });
        }
        if (url.pathname.startsWith('/api/make/app/')) {
          return proxyMakeBusiness(req, url.pathname.replace('/api/make/app', '/data'));
        }
        return new Response('not found', { status: 404 });
      }
    `
  });

  const appCatchAllPassthroughOutput = runAudit(appCatchAllPassthroughRoot, { expectFailure: true });
  assert.match(appCatchAllPassthroughOutput, /service_fronted_app_catch_all_passthrough/);

  const apiOnlyServicePrefixRoot = createFixture('api-only-service-prefix', {
    ui: `
      import { createMakeAppAuth } from '@qfeius/make-app-auth';
      const auth = createMakeAppAuth({ gatewayBaseUrl: '/api', unifiedLogin: true, apiAuthRedirect: true });
      const init = await auth.init({ redirect: true });
      if (init.reason === 'state_expired' || init.reason === 'challenge_expired') {
        await auth.login({ redirect: true });
      }
      export async function loadSchema() {
        return auth.api.get('/app/schema', { credentials: 'include' });
      }
    `,
    service: `
      function applyForwardedHostContext(headers, source) {
        const host = source.get('host');
        if (host) headers.set('x-forwarded-host', host);
        headers.set('x-forwarded-proto', 'https');
      }
      export async function proxy(req) {
        const headers = new Headers({ cookie: req.headers.get('cookie') || '' });
        applyForwardedHostContext(headers, req.headers);
        if (req.url.includes('/api/auth/session/complete')) {
          return fetch('http://make-gateway/make/auth/session/complete', { headers, redirect: 'manual' });
        }
        return fetch('http://make-gateway/make/data/v1/record', { method: 'POST', headers });
      }
    `
  });

  const apiOnlyServicePrefixOutput = runAudit(apiOnlyServicePrefixRoot, { expectFailure: true });
  assert.match(apiOnlyServicePrefixOutput, /service_fronted_gateway_base_wrong/);
  assert.match(apiOnlyServicePrefixOutput, /service_fronted_missing_make_prefix/);
  assert.match(apiOnlyServicePrefixOutput, /auth_proxy_missing/);

  console.log('audit-auth-contract tests: PASS');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function createFixture(name, files) {
  const root = path.join(tempRoot, name);
  write(path.join(root, 'apps/ui/package.json'), JSON.stringify({
    dependencies: {
      '@qfeius/make-app-auth': '^0.1.3'
    }
  }));
  write(path.join(root, 'apps/ui/src/app.ts'), files.ui);
  write(path.join(root, 'apps/service/src/app.ts'), files.service);
  if (files.serviceTest) {
    write(path.join(root, 'apps/service/src/app.test.ts'), files.serviceTest);
  }
  return root;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function writeSdkDependency(root, version) {
  write(path.join(root, 'apps/ui/package.json'), JSON.stringify({
    dependencies: {
      '@qfeius/make-app-auth': version
    }
  }));
}

function runAudit(root, options = {}) {
  try {
    return execFileSync(process.execPath, [
      auditScript,
      root,
      '--mode',
      'service-fronted',
      '--published'
    ], { encoding: 'utf8' });
  } catch (error) {
    if (options.expectFailure) {
      return `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    throw error;
  }
}
