import test from 'node:test';
import assert from 'node:assert/strict';
import { auditScopedRouteFeedback } from './scoped-route-feedback-audit.mjs';

const route = { file: 'router/AppRouter.jsx', source: 'function AppRouter() { return <ForbiddenPanel scope="resource" />; }' };
test('resource feedback before shell mounting is unverified', () => {
  assert.match(auditScopedRouteFeedback([route])[0], /resource_route_shell_unverified/u);
});
test('a parent application shell is accepted', () => {
  assert.deepEqual(auditScopedRouteFeedback([route, { file: 'App.jsx', source: '<AppShell><AppRouter /></AppShell>' }]), []);
});
test('a content-scoped feedback wrapper is accepted', () => {
  assert.deepEqual(auditScopedRouteFeedback([{ ...route, source: '<WorkspaceLayout><ForbiddenPanel scope="resource" /></WorkspaceLayout>' }]), []);
});
test('full-App denial does not require a shell', () => {
  assert.deepEqual(auditScopedRouteFeedback([{ ...route, source: '<ForbiddenPanel scope="app" />' }]), []);
});
test('a shell belonging to a business page does not prove root route retention', () => {
  assert.equal(auditScopedRouteFeedback([route, { file: 'BusinessPage.jsx', source: '<AppShell><BusinessPage /></AppShell>' }]).length, 1);
});
test('normal business shell in a later return cannot hide an earlier denied return', () => {
  assert.equal(auditScopedRouteFeedback([{ ...route, source: route.source + ' function Allowed() { return <AppShell><BusinessPage /></AppShell>; }' }]).length, 1);
});
