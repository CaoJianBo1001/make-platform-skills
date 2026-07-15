#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const auditScript = path.join(scriptDir, 'audit-make-app-permission.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-app-permission-audit-'));
const goodFiles = {};

try {
  const goodRoot = createFixture('good-app', {
    app: `
      export function App() {
        return <AuthGate><MdmPermissionProvider><MdmSchemaProvider><AppRouter /></MdmSchemaProvider></MdmPermissionProvider></AuthGate>;
      }
    `,
    permissionModel: `
      export const DATA_RECORD_READ = 'data.record.read';
      export const DATA_RECORD_CREATE = 'data.record.create';
      export const DATA_RECORD_UPDATE = 'data.record.update';
      export const DATA_RECORD_DELETE = 'data.record.delete';
      export const META_FIELD_READ = 'meta.field.read';
      export const META_FIELD_UPDATE = 'meta.field.update';
      export function canUseEntityOperation() { return true; }
      export function canReadEntityField() { return true; }
      export function canUpdateEntityField() { return true; }
      export function visibleFieldsForEntity(access, entityKey, fields) { return fields; }
      export function editableFieldKeysForEntity() { return new Set(['name']); }
    `,
    router: `
      export function AppRouter() { return <Routes><Route path="objects/:objectKey" element={<ObjectRoutePage />} /></Routes>; }
      function ObjectRoutePage() {
        const { objectKey } = useParams();
        const object = findObjectByKey(schema, objectKey);
        if (!object) return <Result status="404" title="not-found" />;
        return <SchemaObjectPage object={object} />;
      }
      function DefaultObjectRedirect() {
        const defaultObjectKey = firstObjectKey(schema);
        if (!defaultObjectKey) return <Result status="403" title="forbidden" />;
        return <Navigate to={'/objects/' + defaultObjectKey} />;
      }
    `,
    page: `
      const { refreshPermissions } = useMdmPermissions();
      const canReadRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_READ);
      const canCreateRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_CREATE);
      const canUpdateRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_UPDATE);
      const canDeleteRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_DELETE);
      const visibleFields = visibleFieldsForEntity(access, object.entityKey, fields);
      const updateEditableFieldKeys = editableFieldKeysForEntity(access, object.entityKey, visibleFields);
      const recordState = useVirtualResourceItems(key, api, { enabled: canReadRecord });
      function filterDraftByEditableFields(draft) { return Object.fromEntries(Object.entries(draft).filter(([key]) => updateEditableFieldKeys.has(key))); }
      async function refreshObjectWorkspace() {
        const nextAccess = await refreshPermissions();
        closeWorkspaceForPermissionChange(nextAccess);
        if (canUseEntityOperation(nextAccess, object.entityKey, DATA_RECORD_READ)) await recordState.refresh();
      }
      <MasterDataToolbar onCreate={canCreateRecord ? openCreate : undefined} />
      <MasterDataCanvasTable onDataLoad={canReadRecord ? recordState.loadPage : undefined} onCellEditCommit={canUpdateRecord ? commit : undefined} />
      <Detail onEdit={canUpdateRecord ? openEdit : undefined} onDelete={canDeleteRecord ? deleteRecord : undefined} />
    `,
    api: `
      export function createPrincipalPermissionApi(auth) {
        return { fetchPrincipalPermissions: () => auth.api.get('/app/principal/permission') };
      }
    `,
    service: `
      const PRINCIPAL_PERMISSION_PATH = '/iam/v1/principal/permission';
      const makeIamGatewayScope = '/api/make';
      const PRINCIPAL_PERMISSION_TARGET = 'MakeService.GetResource';
      export function registerPrincipalPermissionRoutes(app) {
        app.get('/api/make/app/principal/permission', (req, res) => makeIamClient.getPrincipalPermissions({ headers: req.headers }));
      }
      export async function getPrincipalPermissions(context) {
        const appKey = process.env.MAKE_APP_KEY;
        const tenantId = context.headers['x-tenant-id'];
        const scope = \`make://\${tenantId}/meta/app/\${appKey}\`;
        const body = { scope };
        const headers = {
          Cookie: context.headers.cookie,
          'X-Forwarded-Host': context.headers.host,
          'X-Make-Target': PRINCIPAL_PERMISSION_TARGET,
        };
        return fetch('http://make-gateway.make-dev' + makeIamGatewayScope + PRINCIPAL_PERMISSION_PATH, { method: 'POST', headers, body: JSON.stringify(body) });
      }
    `,
  });

  assert.match(runAudit(goodRoot), /status: PASS/);

  const missingPermissionRoot = createFixture('missing-permission', {
    app: `export function App() { return <AuthGate><MdmSchemaProvider><AppRouter /></MdmSchemaProvider></AuthGate>; }`,
    permissionModel: `export const DATA_RECORD_READ = 'data.record.read';`,
    router: `export function AppRouter() { return <Routes />; }`,
    page: `export function Page() { return <button onClick={fetchRecords}>load</button>; }`,
    api: ``,
    service: `export function app() {}`,
  });
  assert.match(runAudit(missingPermissionRoot, { expectFailure: true }), /permission_provider_missing/);

  const wrongIamRoot = createFixture('wrong-iam-path', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service.replace("makeIamGatewayScope = '/api/make'", "makeIamGatewayScope = '/make'"),
  });
  assert.match(runAudit(wrongIamRoot, { expectFailure: true }), /iam_upstream_wrong_make_scope/);

  const missingRouteGuardRoot = createFixture('missing-route-guard', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: `export function AppRouter() { return <Routes><Route path="objects/:objectKey" element={<SchemaObjectPage />} /></Routes>; }`,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(runAudit(missingRouteGuardRoot, { expectFailure: true }), /route_guard_missing/);

  const fieldTiedToDataRecordRoot = createFixture('field-tied-to-data-record', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace('editableFieldKeysForEntity(access, object.entityKey, visibleFields)', 'editableFieldKeysForEntity(access, object.entityKey, visibleFields, DATA_RECORD_UPDATE)'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(runAudit(fieldTiedToDataRecordRoot, { expectFailure: true }), /field_permission_tied_to_data_record/);

  const editDependsOnEditableFieldsRoot = createFixture('edit-depends-on-editable-fields', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace('onEdit={canUpdateRecord ? openEdit : undefined}', 'onEdit={canUpdateRecord && updateEditableFieldKeys.size ? openEdit : undefined}'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(runAudit(editDependsOnEditableFieldsRoot, { expectFailure: true }), /edit_entry_depends_on_editable_fields/);

  console.log('audit-make-app-permission tests: PASS');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

function createFixture(name, files) {
  const root = path.join(tempRoot, name);
  write(path.join(root, 'apps/ui/src/App.jsx'), files.app);
  write(path.join(root, 'apps/ui/src/features/permissions/principalPermissionModel.js'), files.permissionModel);
  write(path.join(root, 'apps/ui/src/router/AppRouter.jsx'), files.router);
  write(path.join(root, 'apps/ui/src/features/objects/SchemaObjectPage.jsx'), files.page);
  write(path.join(root, 'apps/ui/src/lib/service-api/permissions.js'), files.api);
  write(path.join(root, 'apps/service/src/app.js'), files.service);

  if (name === 'good-app') {
    Object.assign(goodFiles, files);
  }
  return root;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function runAudit(root, { expectFailure = false } = {}) {
  try {
    const output = execFileSync(process.execPath, [auditScript, root], { encoding: 'utf8' });
    if (expectFailure) {
      assert.fail(`Expected audit failure for ${root}, got:\n${output}`);
    }
    return output;
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (!expectFailure) {
      assert.fail(`Expected audit success for ${root}, got:\n${output}`);
    }
    return output;
  }
}
