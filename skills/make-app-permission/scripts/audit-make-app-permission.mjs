#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const USAGE = `Usage:
  node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>

Checks Make App single-app permission enforcement. This is a static contract audit; it does not replace Service/UI tests.`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const projectRoot = args.find((arg) => !arg.startsWith('-')) || process.cwd();
const root = path.resolve(projectRoot);

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  failUsage(`Project root does not exist or is not a directory: ${root}`);
}

const uiRoot = firstExisting(['apps/ui/src', 'apps/ui', 'ui/src', 'src']);
const serviceRoot = firstExisting(['apps/service/src', 'apps/service', 'service/src', 'server/src']);
const uiFiles = collectSourceFiles(uiRoot);
const serviceFiles = collectSourceFiles(serviceRoot).filter(isRuntimeSourceFile);
const uiText = readJoined(uiFiles);
const serviceText = readJoined(serviceFiles);

const failures = [];
const warnings = [];

checkSourceRoots();
checkServiceContract();
checkUiContract();

printResult();
process.exit(failures.length > 0 ? 1 : 0);

function checkSourceRoots() {
  if (uiFiles.length === 0) {
    failures.push('no_ui_source: cannot find UI source under apps/ui/src, apps/ui, ui/src, or src');
  }
  if (serviceFiles.length === 0) {
    failures.push('no_service_source: single-app permission enforcement requires a Service proxy to Make IAM');
  }
}

function checkServiceContract() {
  if (!serviceText) return;

  if (!/principal\/permission/.test(serviceText)) {
    failures.push('service_permission_route_missing: Service must expose /principal/permission, normally /api/make/app/principal/permission');
  }
  if (!/\/api\/make\/app\b/.test(serviceText) && /principal\/permission/.test(serviceText)) {
    warnings.push('published_permission_prefix_not_obvious: could not find /api/make/app prefix for the published permission route');
  }
  if (!/\/iam\/v1\/principal\/permission/.test(serviceText)) {
    failures.push('iam_upstream_path_missing: Service must call Make IAM /iam/v1/principal/permission through make-gateway');
  }
  if (/\/make\/iam\/v1\/principal\/permission/.test(serviceText)) {
    failures.push('iam_upstream_wrong_make_scope: IAM principal permission must use /api/make/iam/v1/principal/permission, not /make/iam/v1/principal/permission');
  }
  if (/(?:makeIamGatewayScope|iamGatewayScope|IAM_SCOPE)\s*=\s*[`'"]\/make[`'"]/.test(serviceText)) {
    failures.push('iam_upstream_wrong_make_scope: IAM gateway scope must be /api/make, not /make');
  }
  if (!/\/api\/make\b/.test(serviceText) || !/(makeIamGatewayScope|IAM_SCOPE|gatewayScope|api\/make)/.test(serviceText)) {
    warnings.push('iam_api_make_scope_not_obvious: could not find an explicit /api/make scope for IAM upstream');
  }
  if (!/MakeService\.GetResource/.test(serviceText) || !/X-Make-Target/i.test(serviceText)) {
    failures.push('iam_target_header_missing: Service must send X-Make-Target: MakeService.GetResource');
  }
  if (!/meta\/app/.test(serviceText) || !/appKey/.test(serviceText)) {
    failures.push('app_scope_missing: Service must build scope make://<tenantId>/meta/app/<appKey>');
  }
  if (/make\.platform\./.test(serviceText)) {
    failures.push('platform_permission_filter_in_app_service: App permission Service code must not use platform make.platform.* keys');
  }
  if (/permissionKey\s+in\s+\[/.test(serviceText) && !/permissionKeys/.test(serviceText)) {
    warnings.push('permission_filter_maybe_defaulted: permissionKey filter found but no explicit permissionKeys option was detected');
  }
  if (!/(cookie|authorization)/i.test(serviceText)) {
    warnings.push('login_context_forwarding_not_obvious: could not find Cookie or Authorization forwarding in Service IAM code');
  }
  if (!/(x-forwarded-host|X-Forwarded-Host)/i.test(serviceText)) {
    warnings.push('forwarded_host_not_obvious: could not find forwarded host handling for gateway calls');
  }
}

function checkUiContract() {
  if (!uiText) return;

  if (!/principal\/permission/.test(uiText)) {
    failures.push('ui_permission_api_missing: UI must call the Service principal permission endpoint');
  }
  if (!/(PermissionProvider|MdmPermissionProvider)/.test(uiText)) {
    failures.push('permission_provider_missing: UI must provide app-level permission context after auth');
  }
  if (!/refreshPermissions/.test(uiText)) {
    failures.push('refresh_permissions_missing: UI must expose/use refreshPermissions for refresh-time reload');
  }
  checkProviderOrder();

  for (const key of ['read', 'create', 'update', 'delete']) {
    if (!new RegExp(`data\\.record\\.${key}`).test(uiText)) {
      failures.push(`operation_key_missing_${key}: UI permission model must include data.record.${key}`);
    }
  }
  for (const key of ['read', 'update']) {
    if (!new RegExp(`meta\\.field\\.${key}`).test(uiText)) {
      failures.push(`field_permission_key_missing_${key}: UI permission model must include meta.field.${key}`);
    }
  }

  if (!/(canUseEntityOperation|canUse.*Operation|has.*Permission)/.test(uiText)) {
    failures.push('operation_helper_missing: UI must have a helper to evaluate entity operation permission');
  }
  if (!/(canReadEntityField|visibleFieldsForEntity|visibleFieldKeys|META_FIELD_READ|meta\.field\.read)/.test(uiText)) {
    failures.push('field_visibility_helper_missing: UI must evaluate field visibility from meta.field.read');
  }
  if (!/(canUpdateEntityField|editableFieldKeysForEntity|editableFieldNames|META_FIELD_UPDATE|meta\.field\.update)/.test(uiText)) {
    failures.push('field_edit_helper_missing: UI must evaluate field editability from meta.field.update');
  }
  if (/(?:canEditEntityField|editableFieldKeysForEntity|editableFieldNames)\s*\([\s\S]{0,180}(?:DATA_RECORD_CREATE|DATA_RECORD_UPDATE|data\.record\.(?:create|update))/.test(uiText)) {
    failures.push('field_permission_tied_to_data_record: field visibility/editability must use meta.field.*, not data.record.create/update');
  }
  if (hasRecordEntryEditableFieldCountGate(uiText, {
    actionKeyPattern: '(?:create|new)',
    fieldOperationPattern: 'canCreate\\w*(?:Cell|Field)\\w*',
    jsxEntryPattern: 'onCreate',
    operationPattern: 'canCreate\\w*',
  })) {
    failures.push('create_entry_depends_on_editable_fields: create entry must depend on data.record.create only');
  }
  if (hasRecordEntryEditableFieldCountGate(uiText, {
    actionKeyPattern: 'edit',
    fieldOperationPattern: '(?:canUpdate|canEdit)\\w*(?:Cell|Field)\\w*',
    jsxEntryPattern: 'onEdit',
    operationPattern: '(?:canUpdate\\w*|canEdit\\w*)',
  })) {
    failures.push('edit_entry_depends_on_editable_fields: edit entry must depend on data.record.update only');
  }
  if (!hasRouteGuardSignal(uiText)) {
    failures.push('route_guard_missing: UI must block direct URL access to schema-missing objects and unauthorized fixed routes');
  }
  if (!hasReadGateSignal(uiText)) {
    failures.push('read_gate_missing: list/detail loading must be gated by data.record.read');
  }
  if (!/DATA_RECORD_CREATE|data\.record\.create/.test(uiText) || !/(onCreate|openCreate|canCreate)/.test(uiText)) {
    failures.push('create_gate_missing: create entry/handler must be gated by create permission');
  }
  if (!/DATA_RECORD_UPDATE|data\.record\.update/.test(uiText) || !/(onEdit|openEdit|canUpdate|onCellEditCommit)/.test(uiText)) {
    failures.push('update_gate_missing: edit/cell edit must be gated by update permission');
  }
  if (!/DATA_RECORD_DELETE|data\.record\.delete/.test(uiText) || !/(onDelete|deleteRecord|canDelete)/.test(uiText)) {
    failures.push('delete_gate_missing: delete entry/handler must be gated by delete permission');
  }
  if (!/(filter.*Editable|editableFieldNames|editableFieldKeys|hiddenFields|formModel\.fields)/is.test(uiText)) {
    failures.push('payload_field_filter_not_obvious: form/custom-page submit payload must filter unauthorized fields');
  }
  if (!/refreshPermissions[\s\S]{0,500}(refresh|loadPage|fetch|close)/.test(uiText)) {
    warnings.push('refresh_order_not_obvious: could not prove refreshPermissions runs before data refresh or workspace close');
  }
}

function checkProviderOrder() {
  const appFiles = uiFiles.filter((file) => /(?:^|[/\\])App\.[jt]sx?$/.test(file));
  const appText = readJoined(appFiles) || uiText;
  const authIndex = appText.search(/AuthGate|AuthProvider|useAuth/);
  const permissionIndex = appText.search(/PermissionProvider|MdmPermissionProvider/);
  const schemaIndex = appText.search(/SchemaProvider|MdmSchemaProvider/);
  const routerIndex = appText.search(/AppRouter|RouterProvider|Routes/);

  if (permissionIndex < 0) return;
  if (authIndex >= 0 && authIndex > permissionIndex) {
    failures.push('provider_order_wrong: PermissionProvider must mount inside/after auth');
  }
  if (schemaIndex >= 0 && schemaIndex < permissionIndex) {
    failures.push('provider_order_wrong: SchemaProvider must mount inside/after PermissionProvider');
  }
  if (routerIndex >= 0 && schemaIndex >= 0 && routerIndex < schemaIndex) {
    failures.push('provider_order_wrong: router should mount after schema and permission providers');
  }
}

function hasRouteGuardSignal(text) {
  return (
    /(findObjectByKey|schema\.(objects|entities)|objectsByKey|entitiesByKey)/.test(text)
    && /(objectKey|entityKey)/.test(text)
    && /(Result|Forbidden|forbidden|not[- ]?found|404|Navigate|redirect)/i.test(text)
  ) || (
    /(routeGuard|canEnterRoute|authorizedRoute|ProtectedRoute)/.test(text)
    && /(Permission|permission|schema)/.test(text)
  );
}

function hasReadGateSignal(text) {
  return (
    /(canRead|DATA_RECORD_READ|data\.record\.read)/.test(text)
    && /(enabled\s*:|onDataLoad=\{[^}]*\?|openDetail|fetchEntityRecord|fetch.*Detail)/s.test(text)
  );
}

function hasRecordEntryEditableFieldCountGate(text, {
  actionKeyPattern,
  fieldOperationPattern,
  jsxEntryPattern,
  operationPattern,
}) {
  const operation = String.raw`\(*\s*${operationPattern}\s*\)*`;
  const editableFieldCount = String.raw`(?:Boolean\s*\(\s*)?\(*\s*\w*editable\w*\s*\.\s*(?:length|size)(?:\s*>\s*0)?\s*\)*`;
  const operationThenFields = `${operation}\\s*&&\\s*${editableFieldCount}`;
  const fieldsThenOperation = `${editableFieldCount}\\s*&&\\s*${operation}`;
  const jsxEntry = new RegExp(
    String.raw`\b(?:${jsxEntryPattern})\s*=\s*\{([^}]{0,1000})\}`,
    'gi',
  );
  const actionKey = String.raw`\b(?:key|id|type)\s*:\s*['"](?:${actionKeyPattern})['"]`;
  const actionKeyMatcher = new RegExp(actionKey, 'i');
  const actionVisibility = /\b(?:visible|enabled)\s*:\s*([^,}]{0,500})/gi;

  for (const entry of text.matchAll(jsxEntry)) {
    if (hasRecordDirectGate(entry[1], {
      editableFieldCount,
      fieldOperationPattern,
      operationPattern,
    })) return true;
  }

  return extractDirectBraceBlocks(text).some((action) => {
    if (!actionKeyMatcher.test(action)) return false;
    for (const visibility of action.matchAll(actionVisibility)) {
      if (hasRecordDirectGate(visibility[1], {
        editableFieldCount,
        fieldOperationPattern,
        operationPattern,
      })) return true;
    }
    return false;
  });
}

function hasRecordDirectGate(expression, {
  editableFieldCount,
  fieldOperationPattern,
  operationPattern,
}) {
  const operation = String.raw`\(*\s*(${operationPattern})\s*\)*`;
  const fieldOperation = new RegExp(String.raw`^(?:${fieldOperationPattern})$`, 'i');
  const gatePatterns = [
    new RegExp(`${operation}\\s*&&\\s*${editableFieldCount}`, 'gi'),
    new RegExp(`${editableFieldCount}\\s*&&\\s*${operation}`, 'gi'),
  ];

  return gatePatterns.some((gatePattern) => (
    [...expression.matchAll(gatePattern)]
      .some((gate) => !fieldOperation.test(gate[1]))
  ));
}

function extractDirectBraceBlocks(text) {
  const blocks = [];
  const stack = [];
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '/' && nextCharacter === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') {
      stack.push({ children: [], start: index });
    } else if (character === '}' && stack.length > 0) {
      const block = stack.pop();
      blocks.push(readDirectBlockText(text, block, index + 1));
      if (stack.length > 0) {
        stack[stack.length - 1].children.push({
          end: index + 1,
          start: block.start,
        });
      }
    }
  }

  return blocks;
}

function readDirectBlockText(text, block, end) {
  const segments = [];
  let cursor = block.start;

  for (const child of block.children) {
    segments.push(text.slice(cursor, child.start), ' ');
    cursor = child.end;
  }
  segments.push(text.slice(cursor, end));

  return segments.join('');
}

function failUsage(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(2);
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    const absolute = path.join(root, candidate);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
      return absolute;
    }
  }
  return null;
}

function collectSourceFiles(start) {
  if (!start) return [];
  const files = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (shouldSkipDir(path.basename(current))) continue;
      for (const child of fs.readdirSync(current)) {
        stack.push(path.join(current, child));
      }
      continue;
    }
    if (stat.isFile() && isSourceFile(current)) {
      files.push(current);
    }
  }
  return files.sort();
}

function shouldSkipDir(name) {
  return new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.turbo']).has(name);
}

function isSourceFile(file) {
  return /\.(cjs|mjs|js|jsx|ts|tsx|json|html|vue|svelte)$/i.test(file);
}

function isRuntimeSourceFile(file) {
  const basename = path.basename(file);
  return !/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(basename)
    && !/(?:^|[/\\])(?:__tests__|test|tests)(?:[/\\]|$)/i.test(file);
}

function readJoined(files) {
  return files.map((file) => {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  }).join('\n');
}

function printResult() {
  console.log(`make-app-permission audit: ${root}`);
  if (failures.length > 0) {
    console.log('status: FAIL');
    console.log('\nFailures:');
    for (const failure of failures) console.log(`- ${failure}`);
  } else {
    console.log('status: PASS');
  }
  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}
