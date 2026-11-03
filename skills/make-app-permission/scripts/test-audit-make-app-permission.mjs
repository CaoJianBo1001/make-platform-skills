#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
      export const META_ENTITY_READ = 'meta.entity.read';
      export const META_FIELD_READ = 'meta.field.read';
      export const BUSINESS_RECORD_UPDATE = 'data.record.update';
      function evaluateOperation(access, entityKey, permissionKey) {
        return Boolean(access && entityKey && permissionKey);
      }
      function normalizeFieldAccessStates(fieldAccessValue) {
        const states = Array.isArray(fieldAccessValue) ? fieldAccessValue : [fieldAccessValue];
        return states.filter((state) => typeof state === 'string').map((state) => state.trim());
      }
      function evaluateField(access, entityKey, fieldKey, permissionKey) {
        const fieldAccess = access?.permissions?.[0]?.fieldAccess ?? {};
        const states = normalizeFieldAccessStates(fieldAccess[fieldKey]);
        return Boolean(entityKey && permissionKey && states.length > 0);
      }
      export function canUseEntityOperation(access, entityKey, permissionKey) { return evaluateOperation(access, entityKey, permissionKey); }
      export function canCreateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, DATA_RECORD_CREATE); }
      export function canReadEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, META_FIELD_READ); }
      export function canUpdateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE); }
      export function creatableFieldKeysForEntity(access, entityKey, fields) { return new Set(fields.map((field) => field.key)); }
      export function visibleFieldsForEntity(access, entityKey, fields) { return fields; }
      export function editableFieldKeysForEntity() { return new Set(['name']); }
    `,
    router: `
      export function AppRouter() { return <Routes><Route path="objects/:objectKey" element={<ObjectRoutePage />} /></Routes>; }
      function ObjectRoutePage() {
        const { objectKey } = useParams();
        const object = findObjectByKey(schema, objectKey);
        if (!object) return <Result status="404" title="not-found" />;
        const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);
        if (!canViewEntity) return <Result status="403" title="forbidden" />;
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
      const { refreshSchema } = useMakeSchemaEntities();
      const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);
      const canReadRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_READ);
      const canCreateRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_CREATE);
      const canUpdateRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_UPDATE);
      const canDeleteRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_DELETE);
      const visibleFields = visibleFieldsForEntity(access, object.entityKey, fields);
      const normalizedSchema = { ...object, properties: { ...object.properties, editableFields: object.properties?.editableFields ?? [] } };
      const createSchemaFields = object.properties?.createFields ?? [];
      const creatableFieldKeys = creatableFieldKeysForEntity(access, object.entityKey, createSchemaFields);
      const createFormFields = createSchemaFields.filter((field) => creatableFieldKeys.has(field.key));
      const updateEditableFieldKeys = editableFieldKeysForEntity(access, object.entityKey, visibleFields);
      const recordState = useVirtualResourceItems(key, api, { enabled: canReadRecord });
      const tableRows = canReadRecord ? recordState.items : [];
      function filterDraftByEditableFields(draft) { return Object.fromEntries(Object.entries(draft).filter(([key]) => updateEditableFieldKeys.has(key))); }
      function buildCreatePayload(values) { return Object.fromEntries(Object.entries(values).filter(([key]) => creatableFieldKeys.has(key))); }
      async function submitCreate(values) {
        if (!canUseEntityOperation(access, object.entityKey, DATA_RECORD_CREATE)) throw new Error('forbidden');
        return createRecord(buildCreatePayload(values));
      }
      async function refreshObjectWorkspace() {
        const nextAccess = await refreshPermissions();
        await refreshSchema();
        closeWorkspaceForPermissionChange(nextAccess);
        if (canUseEntityOperation(nextAccess, object.entityKey, DATA_RECORD_READ)) await recordState.refresh();
      }
      <MasterDataToolbar onCreate={canCreateRecord ? openCreate : undefined} />
      <ObjectNavigation object={object} visible={canViewEntity} />
      <MasterDataCanvasTable columns={visibleFields} rows={tableRows} onDataLoad={canReadRecord ? recordState.loadPage : undefined} onCellEditCommit={canUpdateRecord ? commit : undefined} />
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
      export function normalizeEntitySchema(entity) {
        return {
          ...entity,
          properties: {
            ...entity.properties,
            fields: Array.isArray(entity.properties?.fields) ? entity.properties.fields : [],
            createFields: Array.isArray(entity.properties?.createFields) ? entity.properties.createFields : [],
          },
        };
      }
    `,
  });

  const goodOutput = runAudit(goodRoot);
  assert.match(goodOutput, /status: PASS/);
  assert.match(goodOutput, /create calls: checked=1; filtered=1; unproven=0; review=0/);

  const regexModel = String.raw`const tenantPattern = /^make:\/\/[^/*]+$/;` + '\n' + goodFiles.permissionModel;
  assert.match(runAudit(createFixture('regex-before-permission-model', {
    ...goodFiles, permissionModel: regexModel,
  })), /status: PASS/);
  assert.match(runAudit(createFixture('regex-before-wrong-permission', {
    ...goodFiles, permissionModel: regexModel.replace('return evaluateField(access, entityKey, fieldKey, DATA_RECORD_CREATE);', 'return evaluateField(access, entityKey, fieldKey, META_FIELD_READ);'),
  }), { expectFailure: true }), /create_field_permission_key_missing/);

  for (const [name, expression] of [
    ['or-true', 'canViewEntity || true'],
    ['negated', '!canViewEntity'],
    ['fallback', 'canViewEntity ? true : cached'],
    ['direct-or-true', 'canUseEntityOperation(access, object.entityKey, "meta.entity.read") || true'],
  ]) {
    const fixture = createFixture(`navigation-visible-${name}`, {
      ...goodFiles, page: goodFiles.page.replace('visible={canViewEntity}', `visible={${expression}}`),
    });
    assert.match(runAudit(fixture, { expectFailure: true }), /entity_navigation_not_gated_by_meta_entity_read/);
  }

  for (const [name, predicate, allowed] of [
    ['valid', 'canUseEntityOperation(access, item.entityKey, META_ENTITY_READ)', true],
    ['and', 'canUseEntityOperation(access, item.entityKey, META_ENTITY_READ) && ready', true],
    ['or-true', 'canUseEntityOperation(access, item.entityKey, META_ENTITY_READ) || true', false],
    ['negated', '!canUseEntityOperation(access, item.entityKey, META_ENTITY_READ)', false],
  ]) for (const wrapper of [false, true]) {
    const navigation = wrapper ? '<DesktopObjectListView objects={authorizedObjects} />' : '<ObjectNavigation items={authorizedObjects} />';
    const fixture = createFixture(`navigation-filter-${name}-${wrapper}`, {
      ...goodFiles,
      page: goodFiles.page.replace('<ObjectNavigation object={object} visible={canViewEntity} />',
        `const authorizedObjects = objects.filter(item => ${predicate});\n${navigation}\n`
        + (wrapper ? 'function DesktopObjectListView({ objects }: Props) { return <ObjectNavigation items={objects} />; }' : '')),
    });
    assert.match(runAudit(fixture, { expectFailure: !allowed }), allowed ? /status: PASS/ : /entity_navigation_not_gated_by_meta_entity_read/);
  }

  const legacyEditRoot = createFixture('legacy-business-edit', {
    ...goodFiles,
    permissionModel: goodFiles.permissionModel.replaceAll('BUSINESS_RECORD_UPDATE', 'META_FIELD_UPDATE').replace("META_FIELD_UPDATE = 'data.record.update'", "META_FIELD_UPDATE = 'meta.field.update'"),
  });
  assert.match(runAudit(legacyEditRoot, { expectFailure: true }), /business_field_edit_uses_metadata_update/);
  const fallbackEditRoot = createFixture('metadata-edit-fallback', {
    ...goodFiles,
    permissionModel: goodFiles.permissionModel.replace('return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE);', "return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE) || evaluateField(access, entityKey, fieldKey, 'meta.field.update');"),
  });
  assert.match(runAudit(fallbackEditRoot, { expectFailure: true }), /business_field_edit_uses_metadata_update/);

  for (const [name, diagnostic] of [
    ['block-comment', '/* Do not use meta.field.update for business edit. */'],
    ['line-comment', '// Do not use META_FIELD_UPDATE for business edit.\n'],
    ['diagnostic-string', "console.info('meta.field.update');"],
    ['diagnostic-constant', 'console.info(META_FIELD_UPDATE);'],
    ['inert-string', "const guidance = 'meta.field.update';"],
    ['error-message', "const guidance = new Error('meta.field.update');"],
    ['comment-brace', '/* } meta.field.update { */'],
  ]) {
    const harmlessRoot = createFixture('harmless-edit-' + name, {
      ...goodFiles,
      permissionModel: goodFiles.permissionModel.replace('return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE);', diagnostic + ' return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE);'),
    });
    assert.match(runAudit(harmlessRoot), /status: PASS/, name);
  }

  const commentedFallbackRoot = createFixture('commented-metadata-fallback', {
    ...goodFiles,
    permissionModel: goodFiles.permissionModel.replace('return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE);', "return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE) || evaluateField(access, entityKey, fieldKey, /* old permission */ 'meta.field.update');"),
  });
  assert.match(runAudit(commentedFallbackRoot, {expectFailure: true}), /business_field_edit_uses_metadata_update/);

  // Relocating production code and renaming a helper must not change its contract.
  const customRoot = createFixture('custom-layout', goodFiles);
  fs.mkdirSync(path.join(customRoot, 'clients'), {recursive:true});
  fs.mkdirSync(path.join(customRoot, 'services'), {recursive:true});
  fs.renameSync(path.join(customRoot, 'apps/ui/src'), path.join(customRoot, 'clients/browser'));
  fs.renameSync(path.join(customRoot, 'apps/service/src'), path.join(customRoot, 'services/api'));
  const modelPath = path.join(customRoot, 'clients/browser/features/permissions/principalPermissionModel.js');
  write(path.join(customRoot, 'packages/access-core/index.js'), fs.readFileSync(modelPath, 'utf8').replaceAll('canCreateEntityField', 'canCreateField'));
  fs.rmSync(modelPath);
  write(path.join(customRoot, 'audit.json'), JSON.stringify({
    uiRoots: ['clients/browser'], serviceRoots: ['services/api'], sharedRoots: ['packages/access-core'],
    symbols: {canCreateEntityField: 'canCreateField'},
  }));
  assert.match(runAudit(customRoot, {args:['--config', 'audit.json']}), /status: PASS/);
  const customModel = path.join(customRoot, 'packages/access-core/index.js');
  write(customModel, fs.readFileSync(customModel, 'utf8').replace('fieldKey, DATA_RECORD_CREATE); }', "fieldKey, 'meta.field.create'); }"));
  assert.match(runAudit(customRoot, {args:['--config', 'audit.json'], expectFailure:true}), /create_field_permission_uses_wrong_field_dimension/);
  write(path.join(customRoot, 'bad.json'), JSON.stringify({sharedRoots:['missing']}));
  assert.match(runAudit(customRoot, {args:['--config', 'bad.json'], expectFailure:true}), /Configured source directory/);
  write(path.join(customRoot, 'unknown.json'), JSON.stringify({skipChecks:['create_gate_missing']}));
  assert.match(runAudit(customRoot, {args:['--config', 'unknown.json'], expectFailure:true}), /Unknown audit config/);

  const callbackRoot = createFixture('create-callback-filter', {
    ...goodFiles, page: goodFiles.page + '\nfunction prepare(values) { return {data: values, relations: {}}; }',
  });
  assert.match(runAudit(callbackRoot), /status: PASS/, 'an intermediate DTO is not a raw create mutation');

  const createCallConfig = {createCalls:[{name:'createRecordForApproval',argument:1}]};
  const configuredCreate = (name,statement) => {
    const fixture = createFixture(name,{...goodFiles,page:goodFiles.page.replace('return createRecord(buildCreatePayload(values));',statement)});
    write(path.join(fixture,'audit.json'),JSON.stringify(createCallConfig));
    return fixture;
  };
  const validCreate = configuredCreate('configured-create-payload','const payload = buildCreatePayload(values); return createRecordForApproval(entityKey,payload,relations,key);');
  assert.match(runAudit(validCreate,{args:['--config','audit.json']}),/status: PASS/);
  write(path.join(goodRoot,'missing-call.json'),JSON.stringify({createCalls:[{name:'missingCreateBoundary',argument:1}]}));
  assert.match(runAudit(goodRoot,{args:['--config','missing-call.json'],expectFailure:true}),/configured_create_call_not_found/);
  const unconfiguredOutput = runAudit(validCreate,{expectFailure:true});
  assert.match(unconfiguredOutput,/create_call_not_recognized/,'an unconfigured boundary cannot borrow a global filter signal');
  assert.match(unconfiguredOutput,/create calls: checked=0; filtered=0; unproven=0; review=0/);
  assert.doesNotMatch(unconfiguredOutput,/create_payload_unverified_call/);

  const sessionRoot = createFixture('cross-callback-create-diagnostics', {
    ...goodFiles, page: goodFiles.page.replace('return createRecord(buildCreatePayload(values));', `
      saveSession({prepare: () => buildCreatePayload(values), create: (payload) => dependencies.createWorkorder(payload)});
      saveSession({prepare: () => buildCreatePayload(values), create: (payload) => dependencies.createEntityRecord(entityKey, payload)});
    `),
  });
  write(path.join(sessionRoot,'audit.json'),JSON.stringify({createCalls:[
    {name:'dependencies.createWorkorder',argument:0}, {name:'dependencies.createEntityRecord',argument:1},
  ]}));
  const sessionResult = spawnSync(process.execPath,[auditScript,sessionRoot,'--config','audit.json'],{encoding:'utf8'});
  assert.equal(sessionResult.status,1,'unproved callback payloads must keep a nonzero failure');
  assert.match(sessionResult.stdout,/create calls: checked=2; filtered=0; unproven=2; review=0/);
  assert.match(sessionResult.stdout,/dependencies\.createWorkorder: payload argument\[0\] \(identifier payload\).*source unproven/);
  assert.match(sessionResult.stdout,/dependencies\.createEntityRecord: payload argument\[1\] \(identifier payload\).*source unproven/);
  assert.doesNotMatch(sessionResult.stdout,/create_call_not_recognized|status: PASS/);
  for (const [name,statement] of [
    ['unused-filter','const payload = buildCreatePayload(values); return createRecordForApproval(entityKey,values,relations,key);'],
    ['wrong-argument','const payload = buildCreatePayload(values); return createRecordForApproval(payload,values,relations,key);'],
    ['same-name-other-function','function other() { const payload = buildCreatePayload(values); } return createRecordForApproval(entityKey,payload,relations,key);'],
    ['literal-filter','const message = "const payload = buildCreatePayload(values)"; return createRecordForApproval(entityKey,values,relations,key);'],
  ]) {
    const fixture = configuredCreate(name,statement);
    assert.match(runAudit(fixture,{args:['--config','audit.json'],expectFailure:true}),/create_payload_filter_not_obvious/);
  }
  const conditionalCreate = configuredCreate('conditional-create-payload','const payload = latest.config ? values : buildCreatePayload(values); return createRecordForApproval(entityKey,payload,relations,key);');
  const reviewOutput = runAudit(conditionalCreate,{args:['--config','audit.json'],expectFailure:true});
  assert.match(reviewOutput,/status: REVIEW_REQUIRED/);
  assert.doesNotMatch(reviewOutput,/status: PASS/);
  assert.match(reviewOutput,/create_payload_branch_requires_review/);
  for (const value of [[],[{name:'createRecordForApproval',argument:-1}],[{name:'createRecordForApproval',argument:1.5}],[{name:'createRecordForApproval',argument:1,skip:true}]]) {
    write(path.join(validCreate,'invalid-create.json'),JSON.stringify({createCalls:value}));
    assert.match(runAudit(validCreate,{args:['--config','invalid-create.json'],expectFailure:true}),/Invalid createCalls/);
  }

  for (const [name, call] of [
    ['inline-raw-create', 'return createRecord({data: values});'],
    ['alias-raw-create', 'const payload = {data: values}; return createRecord(payload);'],
  ]) {
    const fixture = createFixture(name, {...goodFiles, page: goodFiles.page.replace('return createRecord(buildCreatePayload(values));',call)});
    assert.match(runAudit(fixture,{expectFailure:true}), /create_payload_filter_not_obvious/);
  }
  const excludedRoot = createFixture('configured-test-only-runtime', {...goodFiles,permissionModel:''});
  write(path.join(excludedRoot,'packages/access-core/model.test.js'),goodFiles.permissionModel);
  write(path.join(excludedRoot,'audit.json'),JSON.stringify({sharedRoots:['packages/access-core']}));
  assert.match(runAudit(excludedRoot,{args:['--config','audit.json'],expectFailure:true}),/create_field_permission_key_missing/);

  const unrelatedContentRoot = createFixture('unrelated-content-guard', {
    ...goodFiles,
    router: goodFiles.router.replace('if (!canViewEntity) return <Result status="403" title="forbidden" />;', ''),
    page: goodFiles.page + `
      function OtherPage() {
        const allowed = canUseEntityOperation(access, otherEntity, "meta.entity.read");
        if (!allowed) return <AppShell resourceDenied />;
      }
    `,
  });
  assert.match(runAudit(unrelatedContentRoot,{expectFailure:true}),/entity_route_not_gated/);

  const iamPathCases = [
    { name: 'single-quoted-api-iam', expression: "new URL('/api/make/iam/v1/principal/permission', gatewayOrigin)" },
    { name: 'double-quoted-api-iam', expression: 'new URL("/api/make/iam/v1/principal/permission", gatewayOrigin)' },
    { name: 'template-api-iam', expression: '`${gatewayOrigin}/api/make/iam/v1/principal/permission`' },
    { name: 'absolute-api-iam', expression: "'http://gateway.invalid/api/make/iam/v1/principal/permission'" },
    { name: 'api-host-correct-iam', expression: "'http://api/api/make/iam/v1/principal/permission'" },
    { name: 'query-api-iam', expression: "new URL('/api/make/iam/v1/principal/permission?diagnostic=1', gatewayOrigin)" },
    { name: 'literal-wrong-iam', expression: "new URL('/make/iam/v1/principal/permission', gatewayOrigin)", expectFailure: true },
    { name: 'template-wrong-iam', expression: '`${gatewayOrigin}/make/iam/v1/principal/permission`', expectFailure: true },
    { name: 'absolute-wrong-iam', expression: "'http://gateway.invalid/make/iam/v1/principal/permission'", expectFailure: true },
    { name: 'api-host-wrong-iam', expression: "'http://api/make/iam/v1/principal/permission'", expectFailure: true },
    { name: 'correct-before-wrong-iam', expression: "new URL('/api/make/iam/v1/principal/permission', gatewayOrigin)",
      after: "export function legacyPrincipalPermission() { return fetch(new URL('/make/iam/v1/principal/permission', gatewayOrigin)); }", expectFailure: true },
    { name: 'wrong-before-correct-iam', expression: "new URL('/api/make/iam/v1/principal/permission', gatewayOrigin)",
      before: "export function legacyPrincipalPermission() { return fetch(new URL('/make/iam/v1/principal/permission', gatewayOrigin)); }", expectFailure: true },
  ];
  for (const fixture of iamPathCases) {
    const service = goodFiles.service.replace(
      "'http://make-gateway.make-dev' + makeIamGatewayScope + PRINCIPAL_PERMISSION_PATH",
      () => fixture.expression,
    );
    assert.notEqual(service, goodFiles.service, `${fixture.name} must change the actual IAM call`);
    const fixtureRoot = createFixture(fixture.name, {
      ...goodFiles,
      service: `const gatewayOrigin = 'http://gateway.invalid';\n${fixture.before ?? ''}\n${service}\n${fixture.after ?? ''}`,
    });
    const output = runAudit(fixtureRoot, { expectFailure: fixture.expectFailure ?? false });
    if (fixture.expectFailure) {
      assert.match(output, /iam_upstream_wrong_make_scope/, `${fixture.name} must reject the wrong IAM scope`);
    } else {
      assert.match(output, /status: PASS/, `${fixture.name} must accept the correct IAM scope`);
      assert.doesNotMatch(output, /iam_upstream_wrong_make_scope/);
    }
  }
  console.log(`IAM upstream path regressions: PASS (${iamPathCases.length} cases)`);

  const platformResponseFilterRoot = createFixture('platform-response-filter', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: `${goodFiles.service}
      function isUnrelatedPermissionRow(permission) {
        return permission.resource === 'make://tenant-1' && permission.permissionKey === 'make.platform.admin';
      }
    `,
  });
  assert.match(
    runAudit(platformResponseFilterRoot),
    /status: PASS/,
    'local filtering of an extra platform response row must not be treated as an upstream platform permission filter',
  );

  const upstreamPlatformPermissionFilterRoot = createFixture('upstream-platform-permission-filter', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service.replace(
      'const body = { scope };',
      "const body = { scope, permissionKeys: ['make.platform.admin'] };",
    ),
  });
  assert.match(
    runAudit(upstreamPlatformPermissionFilterRoot, { expectFailure: true }),
    /upstream_platform_permission_filter/,
  );

  const upstreamPlatformPermissionAliasFilterRoot = createFixture('upstream-platform-permission-alias-filter', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service.replace(
      'const body = { scope };',
      "const platformPermissionKeys = ['make.platform.admin'];\n        const body = { scope, permissionKeys: platformPermissionKeys };",
    ),
  });
  assert.match(
    runAudit(upstreamPlatformPermissionAliasFilterRoot, { expectFailure: true }),
    /upstream_platform_permission_filter/,
  );

  const upstreamPlatformPermissionPropertyAliasFilterRoot = createFixture('upstream-platform-permission-property-alias-filter', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service.replace(
      'const body = { scope };',
      "const platformPermissionKeys = ['make.platform.admin'];\n        const body = { scope };\n        body.permissionKeys = platformPermissionKeys;",
    ),
  });
  assert.match(
    runAudit(upstreamPlatformPermissionPropertyAliasFilterRoot, { expectFailure: true }),
    /upstream_platform_permission_filter/,
  );

  const missingEntityMetadataPermissionRoot = createFixture('missing-entity-metadata-permission', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace("      export const META_ENTITY_READ = 'meta.entity.read';\n", ''),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(missingEntityMetadataPermissionRoot, { expectFailure: true }),
    /entity_metadata_permission_key_missing/,
  );

  const entityNavigationUsesRecordReadRoot = createFixture('entity-navigation-uses-record-read', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      '<ObjectNavigation object={object} visible={canViewEntity} />',
      '<ObjectNavigation object={object} visible={canReadRecord} />',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityNavigationUsesRecordReadRoot, { expectFailure: true }),
    /entity_navigation_not_gated_by_meta_entity_read/,
  );

  const entityNavigationUsesUnboundEntityFilterRoot = createFixture('entity-navigation-uses-unbound-entity-filter', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page
      .replace(
        'const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);',
        `const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);
      const unrelatedEntities = entities.filter((candidate) => canUseEntityOperation(access, candidate.entityKey, META_ENTITY_READ));`,
      )
      .replace(
        '<ObjectNavigation object={object} visible={canViewEntity} />',
        '<ObjectNavigation object={object} visible={canReadRecord} />',
      ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityNavigationUsesUnboundEntityFilterRoot, { expectFailure: true }),
    /entity_navigation_not_gated_by_meta_entity_read/,
    'an unrelated entity filter must not satisfy the navigation gate',
  );

  const entityNavigationUsesBoundEntityFilterRoot = createFixture('entity-navigation-uses-bound-entity-filter', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page
      .replace(
        'const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);',
        `const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);
      const visibleEntities = entities.filter((candidate) => canUseEntityOperation(access, candidate.entityKey, META_ENTITY_READ));`,
      )
      .replace(
        '<ObjectNavigation object={object} visible={canViewEntity} />',
        '<ObjectNavigation entities={visibleEntities} />',
      ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityNavigationUsesBoundEntityFilterRoot),
    /status: PASS/,
    'a metadata-filtered entity collection must satisfy the navigation gate when it is consumed by navigation',
  );

  const entityRouteMissingMetadataGuardRoot = createFixture('entity-route-missing-metadata-guard', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router.replace(
      "        const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);\n        if (!canViewEntity) return <Result status=\"403\" title=\"forbidden\" />;\n",
      '',
    ),
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityRouteMissingMetadataGuardRoot, { expectFailure: true }),
    /entity_route_not_gated_by_meta_entity_read/,
  );

  const entityRouteUsesUnrelatedProtectedRouteRoot = createFixture('entity-route-uses-unrelated-protected-route', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router
      .replace(
        "        const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);\n        if (!canViewEntity) return <Result status=\"403\" title=\"forbidden\" />;\n",
        '',
      )
      .concat('\nconst protectedSettingsRoute = <ProtectedRoute permissionKey={META_ENTITY_READ} />;'),
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityRouteUsesUnrelatedProtectedRouteRoot, { expectFailure: true }),
    /entity_route_not_gated_by_meta_entity_read/,
    'a protected route outside the dynamic entity route must not satisfy the entity-route gate',
  );

  const entityRouteUsesDetachedProtectedRouteRoot = createFixture('entity-route-uses-detached-protected-route', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router
      .replace(
        "        const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);\n        if (!canViewEntity) return <Result status=\"403\" title=\"forbidden\" />;\n",
        '        const detachedGuard = <ProtectedRoute permissionKey={META_ENTITY_READ} entityKey={object.entityKey} />;\n',
      ),
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityRouteUsesDetachedProtectedRouteRoot, { expectFailure: true }),
    /entity_route_not_gated_by_meta_entity_read/,
    'a detached protected route inside ObjectRoutePage must not satisfy the entity-route gate',
  );

  const entityRouteUsesBoundProtectedRouteRoot = createFixture('entity-route-uses-bound-protected-route', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router.replace(
      `        const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);
        if (!canViewEntity) return <Result status="403" title="forbidden" />;
        return <SchemaObjectPage object={object} />;`,
      '        return <ProtectedRoute permissionKey={META_ENTITY_READ} entityKey={object.entityKey}><SchemaObjectPage object={object} /></ProtectedRoute>;',
    ),
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityRouteUsesBoundProtectedRouteRoot),
    /status: PASS/,
    'a protected route returned from ObjectRoutePage and bound to the current entity must satisfy the entity-route gate',
  );

  const entityRouteUsesUnrelatedSchemaObjectGuardRoot = createFixture('entity-route-uses-unrelated-schema-object-guard', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router
      .replace(
        "        const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);\n        if (!canViewEntity) return <Result status=\"403\" title=\"forbidden\" />;\n",
        '',
      )
      .concat(`
      function SchemaObjectPage() {
        const canViewEntity = canUseEntityOperation(access, object.entityKey, META_ENTITY_READ);
        if (!canViewEntity) return <Result status="403" title="forbidden" />;
        return <section />;
      }`),
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(entityRouteUsesUnrelatedSchemaObjectGuardRoot, { expectFailure: true }),
    /entity_route_not_gated_by_meta_entity_read/,
    'a metadata guard in a different page component must not satisfy ObjectRoutePage',
  );

  const tableHeadersUseRecordReadRoot = createFixture('table-headers-use-record-read', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'columns={visibleFields}',
      'columns={canReadRecord ? visibleFields : []}',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(tableHeadersUseRecordReadRoot, { expectFailure: true }),
    /table_headers_tied_to_record_read/,
  );

  const resourceContentReplacedByEarlyReturnRoot = createFixture('resource-content-replaced-by-early-return', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      '<MasterDataToolbar',
      'if (!canReadRecord) return <Forbidden variant="inline" scope="resource" />;\n<MasterDataToolbar',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(resourceContentReplacedByEarlyReturnRoot),
    /status: PASS/,
    'a resource guard may unmount the entire business content before its toolbar/table/detail',
  );

  const resourceContentReplacedByTernaryRoot = createFixture('resource-content-replaced-by-ternary', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: `function OrderTablePage() { ${goodFiles.page.replace('<MasterDataToolbar', 'return <><MasterDataToolbar')} </>; }
      function ObjectContent() {
        const canReadRecord = canUseEntityOperation(access, object.entityKey, DATA_RECORD_READ);
        return canReadRecord ? <OrderTablePage /> : <Forbidden variant="inline" scope="resource" />;
      }`,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(resourceContentReplacedByTernaryRoot),
    /status: PASS/,
    'replacing the whole content component is not a column-authorization error',
  );

  const tableHeadersHiddenByDerivedColumnsRoot = createFixture('table-headers-hidden-by-derived-columns', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page
      .replace(
        'const tableRows = canReadRecord ? recordState.items : [];',
        'const tableRows = canReadRecord ? recordState.items : [];\nconst tableColumns = canReadRecord ? visibleFields : [];',
      )
      .replace('columns={visibleFields}', 'columns={tableColumns}'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(tableHeadersHiddenByDerivedColumnsRoot, { expectFailure: true }),
    /table_headers_tied_to_record_read/,
  );

  const recordRowsNotClearedRoot = createFixture('record-rows-not-cleared', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'const tableRows = canReadRecord ? recordState.items : [];',
      'const tableRows = recordState.items;',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(recordRowsNotClearedRoot, { expectFailure: true }),
    /record_rows_not_cleared_on_read_revoke/,
  );

  const guardedRowsNotBoundToTableRoot = createFixture('guarded-rows-not-bound-to-table', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace('rows={tableRows}', 'rows={recordState.items}'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(guardedRowsNotBoundToTableRoot, { expectFailure: true }),
    /record_rows_not_cleared_on_read_revoke/,
  );

  const recordRowsUseUnrelatedClearRoot = createFixture('record-rows-use-unrelated-clear', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page
      .replace(
        'const tableRows = canReadRecord ? recordState.items : [];',
        'const tableRows = recordState.items;\nif (!canReadRecord) unrelatedRows.clear();',
      )
      .replace('rows={tableRows}', 'rows={recordState.items}'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(recordRowsUseUnrelatedClearRoot, { expectFailure: true }),
    /record_rows_not_cleared_on_read_revoke/,
    'clearing an unrelated store must not satisfy the table row-revocation gate',
  );

  const recordRowsUseUnrelatedDirectRowsRoot = createFixture('record-rows-use-unrelated-direct-rows', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page
      .replace(
        'const tableRows = canReadRecord ? recordState.items : [];',
        'const tableRows = recordState.items;',
      )
      .replace('rows={tableRows}', 'rows={recordState.items}')
      .concat('\n<Summary rows={canReadRecord ? summaryRows : []} />;'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(recordRowsUseUnrelatedDirectRowsRoot, { expectFailure: true }),
    /record_rows_not_cleared_on_read_revoke/,
    'a non-table rows prop must not satisfy the table row-revocation gate',
  );

  const recordRowsClearedByBoundStoreRoot = createFixture('record-rows-cleared-by-bound-store', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page
      .replace(
        'const tableRows = canReadRecord ? recordState.items : [];',
        'if (!canReadRecord) recordState.clear();',
      )
      .replace('rows={tableRows}', 'rows={recordState.items}'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(recordRowsClearedByBoundStoreRoot),
    /status: PASS/,
    'clearing the store that supplies table rows must satisfy the row-revocation gate',
  );

  const sharedRuntimeRoot = createFixture('shared-permission-runtime', {
    app: goodFiles.app,
    permissionModel: `export * from '@example/permission-runtime';`,
    sharedRuntime: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(sharedRuntimeRoot),
    /status: PASS/,
    'workspace permission runtime packages are part of the UI contract surface',
  );

  const sharedRuntimeOnlyRoot = path.join(tempRoot, 'shared-runtime-only');
  write(
    path.join(sharedRuntimeOnlyRoot, 'apps/packages/permission-runtime/src/index.js'),
    goodFiles.permissionModel,
  );
  write(path.join(sharedRuntimeOnlyRoot, 'apps/service/src/app.js'), goodFiles.service);
  assert.match(
    runAudit(sharedRuntimeOnlyRoot, { expectFailure: true }),
    /no_ui_source/,
    'a shared package must not masquerade as the UI application root',
  );

  const testOnlySignalsRoot = createFixture('test-only-signals', {
    app: `export function App() { return <AppRouter />; }`,
    permissionModel: goodFiles.permissionModel,
    router: `export function AppRouter() { return <Routes><Route path="objects/:objectKey" element={<SchemaObjectPage />} /></Routes>; }`,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
    tests: `
      test('mentions missing production contracts', () => {
        expect('PermissionProvider findObjectByKey schema.objects Result 404 forbidden Navigate').toBeTruthy();
      });
    `,
    stories: `
      export const PermissionStory = () => <PermissionProvider><Result status="404" /></PermissionProvider>;
    `,
  });
  const testOnlySignalsOutput = runAudit(testOnlySignalsRoot, { expectFailure: true });
  assert.match(testOnlySignalsOutput, /permission_provider_missing/);
  assert.match(testOnlySignalsOutput, /route_guard_missing/);

  const normalizedEditableFieldsRoot = createFixture('normalized-editable-fields', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'const normalizedSchema = { ...object, properties: { ...object.properties, editableFields: object.properties?.editableFields ?? [] } };',
      `const editableFields = Array.isArray(object.properties?.editableFields)
        ? object.properties.editableFields.map((field) => ({ ...field }))
        : [];
      const normalizedSchema = { ...object, properties: { ...object.properties, editableFields } };`,
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(normalizedEditableFieldsRoot),
    /status: PASS/,
    'preserving and normalizing editableFields at the schema boundary is not runtime consumption',
  );

  const unconditionalAllowRoot = createFixture('unconditional-allow', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel
      .replace('return evaluateOperation(access, entityKey, permissionKey);', 'return true;')
      .replace('export function canCreateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, DATA_RECORD_CREATE); }', 'export function canCreateEntityField() { return true; }')
      .replace('return evaluateField(access, entityKey, fieldKey, META_FIELD_READ);', 'return true;')
      .replace('return evaluateField(access, entityKey, fieldKey, BUSINESS_RECORD_UPDATE);', 'return true;'),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(unconditionalAllowRoot, { expectFailure: true }),
    /permission_helper_unconditional_allow/,
  );

  const stringifiedFieldAccessRoot = createFixture('stringified-field-access', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace(
      'const states = normalizeFieldAccessStates(fieldAccess[fieldKey]);',
      'const states = [String(fieldAccess[fieldKey])];',
    ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  const stringifiedFieldAccessOutput = runAudit(stringifiedFieldAccessRoot, { expectFailure: true });
  assert.match(stringifiedFieldAccessOutput, /field_access_state_stringified/);
  assert.match(stringifiedFieldAccessOutput, /validate fieldAccess members explicitly; preserve supported array semantics/,
    'audit must reject string coercion without instructing hosts to reject valid IAM arrays');

  const textHelperStringifiedAccessRoot = createFixture('text-helper-stringified-access', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel
      .replace(
        "export const BUSINESS_RECORD_UPDATE = 'data.record.update';",
        "export const BUSINESS_RECORD_UPDATE = 'data.record.update';\n      const toText = (value) => String(value ?? '').trim();",
      )
      .replace(
        "const states = Array.isArray(fieldAccessValue) ? fieldAccessValue : [fieldAccessValue];",
        "const states = [toText(fieldAccessValue)];",
      ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(textHelperStringifiedAccessRoot, { expectFailure: true }),
    /field_access_state_stringified/,
  );

  for (const [name, parameterName, coercion] of [
    ['string-access-state', 'accessState', 'String(accessState)'],
    ['text-helper-access', 'access', 'toText(access)'],
  ]) {
    const aliasedAccessRoot = createFixture(name, {
      app: goodFiles.app,
      permissionModel: goodFiles.permissionModel
        .replace(
          "export const BUSINESS_RECORD_UPDATE = 'data.record.update';",
          "export const BUSINESS_RECORD_UPDATE = 'data.record.update';\n      const toText = (value) => String(value ?? '').trim();",
        )
        .replaceAll('fieldAccessValue', parameterName)
        .replace(
          `const states = Array.isArray(${parameterName}) ? ${parameterName} : [${parameterName}];`,
          `const states = [${coercion}];`,
        ),
      router: goodFiles.router,
      page: goodFiles.page,
      api: goodFiles.api,
      service: goodFiles.service,
    });
    assert.match(
      runAudit(aliasedAccessRoot, { expectFailure: true }),
      /field_access_state_stringified/,
    );
  }

  const templateStringifiedAccessRoot = createFixture('template-stringified-access', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace(
      'const states = normalizeFieldAccessStates(fieldAccess[fieldKey]);',
      'const states = [`${fieldAccess[fieldKey]}`];',
    ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(templateStringifiedAccessRoot, { expectFailure: true }),
    /field_access_state_stringified/,
  );

  const directBranchStringificationRoot = createFixture('direct-branch-stringification', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace(
      `function normalizeFieldAccessStates(fieldAccessValue) {
        const states = Array.isArray(fieldAccessValue) ? fieldAccessValue : [fieldAccessValue];
        return states.filter((state) => typeof state === 'string').map((state) => state.trim());
      }`,
      `function normalizeFieldAccessStates(value) {
        if (String(value) === 'readonly') return ['readonly'];
        return [];
      }`,
    ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(directBranchStringificationRoot, { expectFailure: true }),
    /field_access_state_stringified/,
    'stringification used directly by a permission branch must fail the audit',
  );

  const diagnosticStringificationRoot = createFixture('diagnostic-stringification', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel
      .replace(
        'function normalizeFieldAccessStates(fieldAccessValue) {',
        `function normalizeFieldAccessStates(value) {
          if (value == null) console.warn('missing fieldAccess state', String(value));`,
      )
      .replaceAll('fieldAccessValue', 'value'),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.doesNotMatch(
    runAudit(diagnosticStringificationRoot),
    /field_access_state_stringified/,
    'diagnostic-only stringification must not block an otherwise valid permission runtime',
  );

  for (const [name, diagnosticStatement] of [
    [
      'explicit-field-access-diagnostic',
      "console.warn('missing fieldAccess state', String(fieldAccessValue));",
    ],
    [
      'structured-field-access-diagnostic',
      'console.warn({ state: String(fieldAccessValue) });',
    ],
    [
      'comment-only-field-access-stringification',
      '// Avoid String(fieldAccessValue) because it flattens state arrays.',
    ],
    [
      'string-literal-only-field-access-stringification',
      "const diagnosticGuidance = 'Avoid String(fieldAccessValue) here';",
    ],
  ]) {
    const nonResultStringificationRoot = createFixture(name, {
      app: goodFiles.app,
      permissionModel: goodFiles.permissionModel.replace(
        'function normalizeFieldAccessStates(fieldAccessValue) {',
        `function normalizeFieldAccessStates(fieldAccessValue) {
          ${diagnosticStatement}`,
      ),
      router: goodFiles.router,
      page: goodFiles.page,
      api: goodFiles.api,
      service: goodFiles.service,
    });
    assert.doesNotMatch(
      runAudit(nonResultStringificationRoot),
      /field_access_state_stringified/,
      `${name} must not block an otherwise valid permission runtime`,
    );
  }

  const semicolonlessDiagnosticRoot = createFixture('semicolonless-diagnostic-stringification', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace(
      `function normalizeFieldAccessStates(fieldAccessValue) {
        const states = Array.isArray(fieldAccessValue) ? fieldAccessValue : [fieldAccessValue];
        return states.filter((state) => typeof state === 'string').map((state) => state.trim());
      }`,
      `function normalizeFieldAccessStates(value) {
        if (value == null) return []
        console.warn('missing fieldAccess state', String(value))
        const states = Array.isArray(value) ? value : [value]
        return states.filter((state) => typeof state === 'string').map((state) => state.trim())
      }`,
    ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.doesNotMatch(
    runAudit(semicolonlessDiagnosticRoot),
    /field_access_state_stringified/,
    'ASI must end an earlier return before diagnostic-only stringification',
  );

  const continuedReturnStringificationRoot = createFixture('continued-return-stringification', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace(
      `function normalizeFieldAccessStates(fieldAccessValue) {
        const states = Array.isArray(fieldAccessValue) ? fieldAccessValue : [fieldAccessValue];
        return states.filter((state) => typeof state === 'string').map((state) => state.trim());
      }`,
      `function normalizeFieldAccessStates(value) {
        return value ||
          String(value)
      }`,
    ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(continuedReturnStringificationRoot, { expectFailure: true }),
    /field_access_state_stringified/,
    'an operator-continued return still makes stringification affect the result',
  );

  for (const [name, coercion] of [
    ['to-string-field-access', 'fieldAccess[fieldKey].toString()'],
    ['join-field-access', "fieldAccess[fieldKey].join(',')"],
  ]) {
    const methodStringifiedAccessRoot = createFixture(name, {
      app: goodFiles.app,
      permissionModel: goodFiles.permissionModel.replace(
        'normalizeFieldAccessStates(fieldAccess[fieldKey])',
        `[${coercion}]`,
      ),
      router: goodFiles.router,
      page: goodFiles.page,
      api: goodFiles.api,
      service: goodFiles.service,
    });
    assert.match(
      runAudit(methodStringifiedAccessRoot, { expectFailure: true }),
      /field_access_state_stringified/,
    );
  }

  const indirectNormalizerStringificationRoot = createFixture(
    'indirect-normalizer-stringification',
    {
      app: goodFiles.app,
      permissionModel: goodFiles.permissionModel.replace(
        `function normalizeFieldAccessStates(fieldAccessValue) {
        const states = Array.isArray(fieldAccessValue) ? fieldAccessValue : [fieldAccessValue];
        return states.filter((state) => typeof state === 'string').map((state) => state.trim());
      }`,
        `function normalizeFieldAccessStates(value) {
        const normalizedStates = [String(value)];
        return normalizedStates;
      }`,
      ),
      router: goodFiles.router,
      page: goodFiles.page,
      api: goodFiles.api,
      service: goodFiles.service,
    },
  );
  assert.match(
    runAudit(indirectNormalizerStringificationRoot, { expectFailure: true }),
    /field_access_state_stringified/,
  );

  for (const [name, replacement] of [
    [
      'multiline-normalizer-stringification',
      `function normalizeFieldAccessStates(value) {
        return [
          String(value),
        ];
      }`,
    ],
    [
      'arrow-object-normalizer-stringification',
      `const normalizeFieldAccessStates = (value) => ({
        states: [String(value)],
      }).states;`,
    ],
  ]) {
    const resultStringifiedAccessRoot = createFixture(name, {
      app: goodFiles.app,
      permissionModel: goodFiles.permissionModel.replace(
        `function normalizeFieldAccessStates(fieldAccessValue) {
        const states = Array.isArray(fieldAccessValue) ? fieldAccessValue : [fieldAccessValue];
        return states.filter((state) => typeof state === 'string').map((state) => state.trim());
      }`,
        replacement,
      ),
      router: goodFiles.router,
      page: goodFiles.page,
      api: goodFiles.api,
      service: goodFiles.service,
    });
    assert.match(
      runAudit(resultStringifiedAccessRoot, { expectFailure: true }),
      /field_access_state_stringified/,
    );
  }

  const legitimateStringNormalizationRoot = createFixture('legitimate-string-normalization', {
    app: goodFiles.app,
    permissionModel: `${goodFiles.permissionModel}
      const normalizedScope = String(permission.scope ?? '').trim();
      const normalizedFieldKey = String(fieldKey ?? '').trim();
      const normalizedFieldAccess = normalizeFieldAccessStates('readonly');
      const normalizeLabel = (value) => String(value ?? '').trim();
      const serializePermission = (access) => String(access);
    `,
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.doesNotMatch(
    runAudit(legitimateStringNormalizationRoot),
    /field_access_state_stringified/,
  );

  const missingCreateFieldsRoot = createFixture('missing-create-fields', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'const createSchemaFields = object.properties?.createFields ?? [];',
      'const createSchemaFields = fields;',
    ),
    api: goodFiles.api,
    service: goodFiles.service.replace(
      'createFields: Array.isArray(entity.properties?.createFields) ? entity.properties.createFields : [],',
      '',
    ),
  });
  assert.match(
    runAudit(missingCreateFieldsRoot, { expectFailure: true }),
    /create_fields_contract_missing/,
  );

  const createFieldsFallbackRoot = createFixture('create-fields-fallback', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'object.properties?.createFields ?? []',
      'object.properties?.createFields ?? fields',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(createFieldsFallbackRoot, { expectFailure: true }),
    /create_fields_fallback_to_visible_fields/,
  );

  const createFormUsesVisibleFieldsRoot = createFixture('create-form-uses-visible-fields', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'const createFormFields = createSchemaFields.filter((field) => creatableFieldKeys.has(field.key));',
      'const createFormFields = visibleFields.filter((field) => creatableFieldKeys.has(field.key));',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(createFormUsesVisibleFieldsRoot, { expectFailure: true }),
    /create_form_uses_visible_fields/,
  );

  const missingCreateFieldHelperRoot = createFixture('missing-create-field-helper', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel
      .replace('export function canCreateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, DATA_RECORD_CREATE); }', '')
      .replace('export function creatableFieldKeysForEntity(access, entityKey, fields) { return new Set(fields.map((field) => field.key)); }', ''),
    router: goodFiles.router,
    page: goodFiles.page
      .replace(
        'const creatableFieldKeys = creatableFieldKeysForEntity(access, object.entityKey, createSchemaFields);',
        'const creatableFieldKeys = new Set(createSchemaFields.map((field) => field.key));',
      ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(missingCreateFieldHelperRoot, { expectFailure: true }),
    /create_field_permission_helper_missing/,
  );

  const createFieldHelperUsesRecordOperationRoot = createFixture('create-helper-uses-record-operation', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace(
      'export function canCreateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, DATA_RECORD_CREATE); }',
      'export function canCreateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, META_FIELD_READ); }',
    ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(createFieldHelperUsesRecordOperationRoot, { expectFailure: true }),
    /create_field_permission_key_missing/,
  );

  const createFieldHelperUsesLegacyMetaCreateRoot = createFixture('create-helper-uses-legacy-meta-create', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel.replace(
      'export function canCreateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, DATA_RECORD_CREATE); }',
      "export function canCreateEntityField(access, entityKey, fieldKey) { return evaluateField(access, entityKey, fieldKey, 'meta.field.create'); }",
    ),
    router: goodFiles.router,
    page: goodFiles.page,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(createFieldHelperUsesLegacyMetaCreateRoot, { expectFailure: true }),
    /create_field_permission_uses_wrong_field_dimension/,
  );

  const editableFieldsCreateRoot = createFixture('editable-fields-create', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'object.properties?.createFields ?? []',
      'object.properties?.editableFields ?? []',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(editableFieldsCreateRoot, { expectFailure: true }),
    /create_form_uses_editable_fields/,
  );

  const editableFieldsEditRoot = createFixture('editable-fields-edit', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: `${goodFiles.page}\nconst editFields = object.properties?.editableFields?.filter(Boolean) ?? [];`,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(editableFieldsEditRoot),
    /status: PASS/,
  );

  const unfilteredCreatePayloadRoot = createFixture('unfiltered-create-payload', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'return createRecord(buildCreatePayload(values));',
      'return createRecord(values);',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(unfilteredCreatePayloadRoot, { expectFailure: true }),
    /create_payload_filter_not_obvious/,
  );

  const spreadCreatePayloadRoot = createFixture('spread-create-payload', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace(
      'return createRecord(buildCreatePayload(values));',
      'return createRecord({ ...values });',
    ),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(spreadCreatePayloadRoot, { expectFailure: true }),
    /create_payload_filter_not_obvious/,
  );

  const lookupTargetUsesCreateFieldsRoot = createFixture('lookup-target-uses-create-fields', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: `${goodFiles.page}\nconst targetDisplayFields = targetEntity.properties.createFields ?? [];`,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(lookupTargetUsesCreateFieldsRoot, { expectFailure: true }),
    /lookup_target_uses_create_fields/,
  );

  const permissionOnlyRefreshRoot = createFixture('permission-only-refresh', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace('await refreshSchema();', ''),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(permissionOnlyRefreshRoot, { expectFailure: true }),
    /permission_refresh_does_not_refresh_schema/,
  );

  const validFieldEditGates = [
    {
      name: 'cell-editable-field-count',
      source: 'const cellEditable = canEditCell && updateEditableFieldKeys.size > 0;',
    },
    {
      name: 'entity-field-editable-count',
      source: 'const fieldEditable = canEditEntityField && updateEditableFieldKeys.size > 0;',
    },
    {
      name: 'create-cell-editable-count',
      source: 'const createCellEnabled = canCreateCell && updateEditableFieldKeys.size > 0;',
    },
    {
      name: 'cell-editor-on-edit',
      source: '<CellEditor onEdit={canEditCell && updateEditableFieldKeys.size > 0 ? commitCellEdit : undefined} />;',
    },
    {
      name: 'independent-action-and-field-objects',
      source: `
        function buildUi() {
          const recordAction = { key: 'edit', visible: true };
          const fieldConfig = { visible: canEdit && updateEditableFieldKeys.size > 0 };
          return { recordAction, fieldConfig };
        }
      `,
    },
  ];

  for (const validGate of validFieldEditGates) {
    const validGateRoot = createFixture(validGate.name, {
      app: goodFiles.app,
      permissionModel: goodFiles.permissionModel,
      router: goodFiles.router,
      page: `${goodFiles.page}\n${validGate.source}`,
      api: goodFiles.api,
      service: goodFiles.service,
    });
    assert.doesNotMatch(runAudit(validGateRoot), /edit_entry_depends_on_editable_fields/);
  }

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
  assert.match(runAudit(fieldTiedToDataRecordRoot), /status: PASS/);

  const editDependsOnEditableFieldsRoot = createFixture('edit-depends-on-editable-fields', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: goodFiles.page.replace('onEdit={canUpdateRecord ? openEdit : undefined}', 'onEdit={canUpdateRecord && updateEditableFieldKeys.size ? openEdit : undefined}'),
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(runAudit(editDependsOnEditableFieldsRoot, { expectFailure: true }), /edit_entry_depends_on_editable_fields/);

  const invalidEditableFieldGates = [
    {
      name: 'edit-parenthesized-fields',
      source: 'onEdit={canUpdateRecord ? openEdit : undefined}',
      replacement: 'onEdit={canUpdateRecord && (updateEditableFieldKeys.size > 0) ? openEdit : undefined}',
      failure: /edit_entry_depends_on_editable_fields/,
    },
    {
      name: 'edit-boolean-fields',
      source: 'onEdit={canUpdateRecord ? openEdit : undefined}',
      replacement: 'onEdit={canUpdateRecord && Boolean(updateEditableFieldKeys.size > 0) ? openEdit : undefined}',
      failure: /edit_entry_depends_on_editable_fields/,
    },
    {
      name: 'edit-fields-first',
      source: 'onEdit={canUpdateRecord ? openEdit : undefined}',
      replacement: 'onEdit={(updateEditableFieldKeys.size > 0) && canUpdateRecord ? openEdit : undefined}',
      failure: /edit_entry_depends_on_editable_fields/,
    },
    {
      name: 'edit-generic-can-update',
      source: 'onEdit={canUpdateRecord ? openEdit : undefined}',
      replacement: 'onEdit={canUpdate && updateEditableFieldKeys.size > 0 ? openEdit : undefined}',
      failure: /edit_entry_depends_on_editable_fields/,
    },
    {
      name: 'edit-generic-can-edit',
      source: 'onEdit={canUpdateRecord ? openEdit : undefined}',
      replacement: 'onEdit={canEdit && updateEditableFieldKeys.size > 0 ? openEdit : undefined}',
      failure: /edit_entry_depends_on_editable_fields/,
    },
    {
      name: 'edit-multiline-generic-handler',
      source: 'onEdit={canUpdateRecord ? openEdit : undefined}',
      replacement: `onEdit={
        canUpdate && updateEditableFieldKeys.size > 0
          ? launchEditor
          : undefined
      }`,
      failure: /edit_entry_depends_on_editable_fields/,
    },
    {
      name: 'edit-record-gate-with-cell-condition',
      source: 'onEdit={canUpdateRecord ? openEdit : undefined}',
      replacement: 'onEdit={canUpdate && updateEditableFieldKeys.size > 0 && canEditCell ? openEdit : undefined}',
      failure: /edit_entry_depends_on_editable_fields/,
    },
    {
      name: 'create-parenthesized-fields',
      source: 'onCreate={canCreateRecord ? openCreate : undefined}',
      replacement: 'onCreate={canCreateRecord && (updateEditableFieldKeys.size > 0) ? openCreate : undefined}',
      failure: /create_entry_depends_on_editable_fields/,
    },
    {
      name: 'create-depends-on-creatable-fields',
      source: 'onCreate={canCreateRecord ? openCreate : undefined}',
      replacement: 'onCreate={canCreateRecord && creatableFieldKeys.size > 0 ? openCreate : undefined}',
      failure: /create_entry_depends_on_creatable_fields/,
    },
  ];

  for (const invalidGate of invalidEditableFieldGates) {
    const invalidGateRoot = createFixture(invalidGate.name, {
      app: goodFiles.app,
      permissionModel: goodFiles.permissionModel,
      router: goodFiles.router,
      page: goodFiles.page.replace(invalidGate.source, invalidGate.replacement),
      api: goodFiles.api,
      service: goodFiles.service,
    });
    assert.match(runAudit(invalidGateRoot, { expectFailure: true }), invalidGate.failure);
  }

  const editActionDependsOnEditableFieldsRoot = createFixture('edit-action-depends-on-editable-fields', {
    app: goodFiles.app,
    permissionModel: goodFiles.permissionModel,
    router: goodFiles.router,
    page: `${goodFiles.page}
      const recordActions = [{
        key: 'edit',
        visible: canEdit && updateEditableFieldKeys.size > 0,
        meta: { source: 'toolbar' },
        onClick: openEdit,
      }];
    `,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(
    runAudit(editActionDependsOnEditableFieldsRoot, { expectFailure: true }),
    /edit_entry_depends_on_editable_fields/,
  );

  const batchEditDependsOnEditableFieldsRoot = createFixture('batch-edit-depends-on-editable-fields', {
    app: goodFiles.app,
    permissionModel: `${goodFiles.permissionModel}\nexport const DATA_RECORD_BULK_UPDATE = 'data.record.bulkUpdate';`,
    router: goodFiles.router,
    page: `${goodFiles.page}
      const batchEditableFields = resolveBatchEditableFields(fields);
      const recordSelectionActions = [{
        key: 'bulk-edit',
        visible: currentCanBulkUpdate && batchEditableFields.length > 0,
      }];
      const actionDependencies = [currentCanBulkUpdate, currentCanDelete, currentCanUpdate];
    `,
    api: goodFiles.api,
    service: goodFiles.service,
  });
  assert.match(runAudit(batchEditDependsOnEditableFieldsRoot), /status: PASS/);

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
  if (files.tests) {
    write(path.join(root, 'apps/ui/src/App.test.jsx'), files.tests);
  }
  if (files.stories) {
    write(path.join(root, 'apps/ui/src/App.stories.jsx'), files.stories);
  }
  if (files.sharedRuntime) {
    write(path.join(root, 'apps/packages/permission-runtime/src/index.js'), files.sharedRuntime);
  }

  if (name === 'good-app') {
    Object.assign(goodFiles, files);
  }
  return root;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function runAudit(root, { expectFailure = false, args = [] } = {}) {
  try {
    const output = execFileSync(process.execPath, [auditScript, root, ...args], { encoding: 'utf8' });
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
