#!/usr/bin/env node
// make-app-permission contract version: 0.2.9
import fs from 'node:fs';
import path from 'node:path';

const USAGE = `Usage:
  node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>

Checks Make App single-app permission enforcement, including create operations and read-derived create fields. This is a static contract audit; it does not replace Service/UI tests.`;

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
const sharedUiRuntimeFiles = collectExistingSourceFiles([
  'apps/packages/permission-runtime/src',
  'packages/permission-runtime/src',
]);
const uiRuntimeFiles = [...uiFiles, ...sharedUiRuntimeFiles].filter(isRuntimeSourceFile);
const serviceFiles = collectSourceFiles(serviceRoot).filter(isRuntimeSourceFile);
const uiRuntimeText = readJoined(uiRuntimeFiles);
const serviceText = readJoined(serviceFiles);

const failures = [];
const warnings = [];

checkSourceRoots();
checkServiceContract();
checkUiContract();

printResult();
process.exit(failures.length > 0 ? 1 : 0);

function checkSourceRoots() {
  if (uiFiles.filter(isRuntimeSourceFile).length === 0) {
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
  if (hasUpstreamPlatformPermissionFilter(serviceText)) {
    failures.push('upstream_platform_permission_filter: App-scoped IAM requests must not filter on make.platform.* permission keys');
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
  if (!/createFields/.test(serviceText)) {
    failures.push('create_fields_contract_missing: Service schema normalization must preserve createFields independently from visible fields');
  }
  if (/createFields\s*:\s*[^,;\n]*(?:\?\?|\|\|)\s*(?:[^,;\n]*\.)?fields\b/.test(serviceText)) {
    failures.push('create_fields_fallback_to_visible_fields: missing createFields must be empty, not fall back to fields');
  }
}

function hasUpstreamPlatformPermissionFilter(source) {
  const platformPermissionKey = String.raw`['\"\x60]make\.platform(?:\.[^'\"\x60]+)?['\"\x60]`;
  const hasInlineFilter = new RegExp(
    String.raw`\bpermissionKeys?\s*:\s*\[[^\]]*${platformPermissionKey}`,
    's',
  ).test(source)
    || new RegExp(
      String.raw`\b(?:body|payload|request)\s*\.\s*permissionKeys?\s*=\s*\[[^\]]*${platformPermissionKey}`,
      's',
    ).test(source)
    || new RegExp(
      String.raw`\bpermissionKey\s+in\s+\[[^\]]*${platformPermissionKey}`,
      's',
    ).test(source);
  if (hasInlineFilter) return true;

  const platformPermissionAliases = [...source.matchAll(new RegExp(
    String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[[^\]]*${platformPermissionKey}`,
    'gs',
  ))].map((match) => match[1]);
  return platformPermissionAliases.some((alias) =>
    new RegExp(
      String.raw`\b(?:body|payload|request)\s*=\s*\{[^{}]{0,500}?\bpermissionKeys?\s*:\s*${alias}\b`,
      's',
    ).test(source)
    || new RegExp(
      String.raw`\b(?:body|payload|request)\s*\.\s*permissionKeys?\s*=\s*${alias}\b`,
      's',
    ).test(source));
}

function checkUiContract() {
  if (!uiRuntimeText) return;

  if (!/principal\/permission/.test(uiRuntimeText)) {
    failures.push('ui_permission_api_missing: UI must call the Service principal permission endpoint');
  }
  if (!/(PermissionProvider|MdmPermissionProvider)/.test(uiRuntimeText)) {
    failures.push('permission_provider_missing: UI must provide app-level permission context after auth');
  }
  if (!/refreshPermissions/.test(uiRuntimeText)) {
    failures.push('refresh_permissions_missing: UI must expose/use refreshPermissions for refresh-time reload');
  }
  checkProviderOrder();

  for (const key of ['read', 'create', 'update', 'delete']) {
    if (!new RegExp(`data\\.record\\.${key}`).test(uiRuntimeText)) {
      failures.push(`operation_key_missing_${key}: UI permission model must include data.record.${key}`);
    }
  }
  if (!/meta\.entity\.read/.test(uiRuntimeText)) {
    failures.push('entity_metadata_permission_key_missing: UI permission model must include meta.entity.read for entity navigation and routes');
  }
  for (const key of ['read', 'update']) {
    if (!new RegExp(`meta\\.field\\.${key}`).test(uiRuntimeText)) {
      failures.push(`field_permission_key_missing_${key}: UI permission model must include meta.field.${key}`);
    }
  }

  if (!/(canUseEntityOperation|canUse.*Operation|has.*Permission)/.test(uiRuntimeText)) {
    failures.push('operation_helper_missing: UI must have a helper to evaluate entity operation permission');
  }
  if (!/(canReadEntityField|visibleFieldsForEntity|visibleFieldKeys|META_FIELD_READ|meta\.field\.read)/.test(uiRuntimeText)) {
    failures.push('field_visibility_helper_missing: UI must evaluate field visibility from meta.field.read');
  }
  if (!/(canUpdateEntityField|editableFieldKeysForEntity|editableFieldNames|META_FIELD_UPDATE|meta\.field\.update)/.test(uiRuntimeText)) {
    failures.push('field_edit_helper_missing: UI must evaluate field editability from meta.field.update');
  }
  if (!/(canCreateEntityField|creatableFieldKeysForEntity)/.test(uiRuntimeText)) {
    failures.push('create_field_permission_helper_missing: UI must evaluate create fields from meta.field.read fieldAccess');
  }
  if (
    ['canUseEntityOperation', 'canCreateEntityField', 'canReadEntityField', 'canUpdateEntityField']
      .some((functionName) => namedFunctionAlwaysReturnsTrue(uiRuntimeText, functionName))
  ) {
    failures.push('permission_helper_unconditional_allow: permission helpers must evaluate current access instead of returning true unconditionally');
  }
  const stringificationFiles = findFieldAccessStateStringificationFiles(uiRuntimeFiles);
  if (stringificationFiles.length > 0) {
    failures.push(
      `field_access_state_stringified: preserve fieldAccess state arrays instead of coercing them to text (${stringificationFiles.join(', ')})`,
    );
  }
  if (!namedFunctionUsesPermissionKey(
    uiRuntimeText,
    'canCreateEntityField',
    /(?:META_FIELD_READ|meta\.field\.read)/,
  )) {
    failures.push('create_field_permission_key_missing: create-field permission must use meta.field.read');
  }
  if (namedFunctionUsesPermissionKey(
    uiRuntimeText,
    'canCreateEntityField',
    /(?:DATA_RECORD_CREATE|data\.record\.create)/,
  )) {
    failures.push('create_field_permission_uses_record_operation: create-field permission must not use data.record.create');
  }
  if (namedFunctionUsesPermissionKey(
    uiRuntimeText,
    'canCreateEntityField',
    /(?:META_FIELD_(?:CREATE|UPDATE)|meta\.field\.(?:create|update))/,
  )) {
    failures.push('create_field_permission_uses_wrong_field_dimension: create-field permission must use meta.field.read, not meta.field.create/update');
  }
  if (!/createFields/.test(uiRuntimeText)) {
    failures.push('create_fields_contract_missing: UI schema and create form must preserve and consume createFields');
  }
  if (/createFields\s*(?:\?\?\s*|\|\|\s*)(?:[^;\n]*\.)?fields\b/.test(uiRuntimeText)) {
    failures.push('create_fields_fallback_to_visible_fields: missing createFields must produce an empty create form');
  }
  if (hasEditableFieldsRuntimeConsumption(uiRuntimeText)) {
    failures.push('editable_fields_consumed_by_runtime: current edit/create behavior must ignore backend editableFields');
  }
  if (/\b(?:createFormFields|writableFormFields)\s*=\s*(?:visibleFields|editableFields|updateEditableFields)\b/.test(uiRuntimeText)) {
    failures.push('create_form_uses_visible_fields: create form fields must derive from createFields, not visible/editable fields');
  }
  if (/\btarget\w*(?:Display)?Fields\s*=\s*[^;\n]*\bcreateFields\b/i.test(uiRuntimeText)) {
    failures.push('lookup_target_uses_create_fields: Lookup target display fields must come from visible fields, not target createFields');
  }
  if (/(?:canEditEntityField|editableFieldKeysForEntity|editableFieldNames)\s*\([\s\S]{0,180}(?:DATA_RECORD_CREATE|DATA_RECORD_UPDATE|data\.record\.(?:create|update))/.test(uiRuntimeText)) {
    failures.push('field_permission_tied_to_data_record: field visibility/editability must use meta.field.*, not data.record.create/update');
  }
  if (hasRecordEntryEditableFieldCountGate(uiRuntimeText, {
    actionKeyPattern: '(?:create|new)',
    fieldOperationPattern: 'canCreate\\w*(?:Cell|Field)\\w*',
    jsxEntryPattern: 'onCreate',
    operationPattern: 'canCreate\\w*',
  })) {
    failures.push('create_entry_depends_on_editable_fields: create entry must depend on data.record.create only');
  }
  if (/\bonCreate\s*=\s*\{[^}]{0,1000}\b(?:creatable\w*|createFormFields|createSchemaFields)\s*\.\s*(?:length|size)/is.test(uiRuntimeText)) {
    failures.push('create_entry_depends_on_creatable_fields: create entry must depend on data.record.create only');
  }
  if (hasRecordEntryEditableFieldCountGate(uiRuntimeText, {
    actionKeyPattern: 'edit',
    fieldOperationPattern: '(?:canUpdate|canEdit)\\w*(?:Cell|Field)\\w*',
    jsxEntryPattern: 'onEdit',
    operationPattern: '(?:canUpdate\\w*|canEdit\\w*)',
  })) {
    failures.push('edit_entry_depends_on_editable_fields: edit entry must depend on data.record.update only');
  }
  if (!hasRouteGuardSignal(uiRuntimeText)) {
    failures.push('route_guard_missing: UI must block direct URL access to schema-missing objects and unauthorized fixed routes');
  }
  if (!hasEntityRouteGuardSignal(uiRuntimeText)) {
    failures.push('entity_route_not_gated_by_meta_entity_read: dynamic entity routes must require meta.entity.read');
  }
  if (!hasEntityNavigationGateSignal(uiRuntimeText)) {
    failures.push('entity_navigation_not_gated_by_meta_entity_read: entity navigation must use meta.entity.read rather than data.record.read');
  }
  if (!hasReadGateSignal(uiRuntimeText)) {
    failures.push('read_gate_missing: list/detail loading must be gated by data.record.read');
  }
  if (hasRecordReadGatedTableHeaders(uiRuntimeText)) {
    failures.push('table_headers_tied_to_record_read: table headers must derive from meta.field.read visible fields even when data.record.read is denied');
  }
  if (!hasRecordRowsClearSignal(uiRuntimeText)) {
    failures.push('record_rows_not_cleared_on_read_revoke: denied data.record.read must render an empty row set and clear cached record values');
  }
  if (!/DATA_RECORD_CREATE|data\.record\.create/.test(uiRuntimeText) || !/(onCreate|openCreate|canCreate)/.test(uiRuntimeText)) {
    failures.push('create_gate_missing: create entry/handler must be gated by create permission');
  }
  if (!/DATA_RECORD_UPDATE|data\.record\.update/.test(uiRuntimeText) || !/(onEdit|openEdit|canUpdate|onCellEditCommit)/.test(uiRuntimeText)) {
    failures.push('update_gate_missing: edit/cell edit must be gated by update permission');
  }
  if (!/DATA_RECORD_DELETE|data\.record\.delete/.test(uiRuntimeText) || !/(onDelete|deleteRecord|canDelete)/.test(uiRuntimeText)) {
    failures.push('delete_gate_missing: delete entry/handler must be gated by delete permission');
  }
  if (!/(filter.*Editable|editableFieldNames|editableFieldKeys|hiddenFields|formModel\.fields)/is.test(uiRuntimeText)) {
    failures.push('payload_field_filter_not_obvious: form/custom-page submit payload must filter unauthorized fields');
  }
  if (!hasCreatePayloadFilterSignal(uiRuntimeText) || hasObviousUnfilteredCreatePayload(uiRuntimeText)) {
    failures.push('create_payload_filter_not_obvious: create submit must build an allowlisted payload from current creatable fields');
  }
  if (!/refreshPermissions[\s\S]{0,500}(refresh|loadPage|fetch|close)/.test(uiRuntimeText)) {
    warnings.push('refresh_order_not_obvious: could not prove refreshPermissions runs before data refresh or workspace close');
  }
  if (
    /refreshPermissions/.test(uiRuntimeText)
    && !/(?:refreshSchema|reloadSchema|invalidateSchema|clearSchema)\s*\(|(?:schemaGeneration|accessGeneration|permissionGeneration)\s*(?:\+\+|[+]?=|:)/.test(uiRuntimeText)
  ) {
    failures.push('permission_refresh_does_not_refresh_schema: permission refresh must invalidate or reload permission-trimmed schema');
  }
}

function hasCreatePayloadFilterSignal(text) {
  const hasCreateMutation = /(createRecord|createMakeEntityRecord|submitCreate|handleCreate|onCreate)/.test(text);
  const hasCreateFieldSet = /(creatableFieldKeys|createFormFields|writableFormFields)/.test(text);
  const hasAllowlistBuilder = /(buildCreateRecordPayload|buildCreatePayload|filter[^\n]*(?:Creatable|CreateFields)|Object\.fromEntries)/.test(text);

  return hasCreateMutation && hasCreateFieldSet && hasAllowlistBuilder;
}

function hasObviousUnfilteredCreatePayload(text) {
  const rawArgument = /(?:createRecord|createMakeEntityRecord)\s*\(\s*(?:values|formValues|draft)\s*\)/;
  const spreadArgument = /(?:createRecord|createMakeEntityRecord)\s*\(\s*\{\s*\.\.\.(?:values|formValues|draft)\b/;
  const rawProperty = /\b(?:data|payload|record)\s*:\s*(?:values|formValues|draft)\b/;
  const spreadProperty = /\b(?:data|payload|record)\s*:\s*\{\s*\.\.\.(?:values|formValues|draft)\b/;

  return rawArgument.test(text) || spreadArgument.test(text) || rawProperty.test(text) || spreadProperty.test(text);
}

function namedFunctionUsesPermissionKey(text, functionName, permissionKeyPattern) {
  return extractNamedFunctionSources(text, functionName).some((source) =>
    permissionKeyPattern.test(source),
  );
}

function namedFunctionAlwaysReturnsTrue(text, functionName) {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(String.raw`\bfunction\s+${escapedName}\s*\([^)]*\)\s*\{\s*return\s+true\s*;?\s*\}`),
    new RegExp(String.raw`\b(?:const|let|var)\s+${escapedName}\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*true\s*;?`),
    new RegExp(String.raw`\b(?:const|let|var)\s+${escapedName}\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*return\s+true\s*;?\s*\}`),
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function findFieldAccessStateStringificationFiles(files) {
  return files.flatMap((file) => {
    const source = readFile(file);
    if (!isFieldAccessPermissionSource(source) || !hasFieldAccessStateStringification(source)) {
      return [];
    }
    return [path.relative(root, file)];
  });
}

function isFieldAccessPermissionSource(source) {
  return /\bfieldAccess\b/.test(source)
    && /(?:can(?:Create|Read|Update).*Field|canUseEntityField|evaluateField|resolveFieldPermission|normalizeFieldAccess)/.test(source);
}

function hasFieldAccessStateStringification(source) {
  const fieldAccessIdentifier = String.raw`(?:fieldAccess(?:Value|State|States)?|accessState(?:s)?|rawAccess(?:Value|State|States)?)`;
  const fieldAccessExpression = String.raw`(?:(?:[A-Za-z_$][\w$]*\s*(?:\?\.)?\s*\.\s*)?fieldAccess\b[^,;)\n]{0,100}|\b${fieldAccessIdentifier}\b)`;
  const directPatterns = [
    new RegExp(String.raw`\bString\s*\(\s*${fieldAccessExpression}`, 'i'),
    new RegExp(String.raw`\b(?:toText|asText|normalizeText|coerceText|stringifyValue)\s*\(\s*${fieldAccessExpression}`, 'i'),
    new RegExp(String.raw`\$\{\s*${fieldAccessExpression}[^}]*\}`, 'i'),
    new RegExp(String.raw`${fieldAccessExpression}\s*(?:\?\.)?\s*\.\s*(?:toString|join)\s*\(`, 'i'),
  ];
  const codeSource = maskJavaScriptNonCode(source);
  if (
    directPatterns.some((pattern) => (
      findPatternMatches(codeSource, pattern).some((match) => (
        !isDiagnosticCallArgument(codeSource.slice(0, match.index ?? 0))
      ))
    ))
  ) {
    return true;
  }

  const normalizationFunctionNames = new Set();
  const functionNamePattern = String.raw`([A-Za-z_$][\w$]*(?:Field_?Access|Access_?State)[\w$]*)`;
  const declarations = [
    new RegExp(String.raw`\bfunction\s+${functionNamePattern}\s*\(`, 'gi'),
    new RegExp(
      String.raw`\b(?:const|let|var)\s+${functionNamePattern}\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>`,
      'gi',
    ),
  ];
  for (const declaration of declarations) {
    for (const match of source.matchAll(declaration)) {
      normalizationFunctionNames.add(match[1]);
    }
  }

  return [...normalizationFunctionNames].some((functionName) => (
    extractNamedFunctionSources(source, functionName).some((functionSource) => (
      hasResultAffectingStateStringification(functionSource)
    ))
  ));
}

function hasResultAffectingStateStringification(functionSource) {
  const stateValue = String.raw`(?:value|input|rawValue|access)`;
  const patterns = [
    new RegExp(String.raw`\bString\s*\(\s*${stateValue}\b`, 'i'),
    new RegExp(
      String.raw`\b(?:toText|asText|normalizeText|coerceText|stringifyValue)\s*\(\s*${stateValue}\b`,
      'i',
    ),
    new RegExp(String.raw`\$\{\s*${stateValue}\b`, 'i'),
    new RegExp(
      String.raw`\b${stateValue}\s*(?:\?\.)?\s*\.\s*(?:toString|join)\s*\(`,
      'i',
    ),
  ];

  const codeSource = maskJavaScriptNonCode(functionSource);
  return patterns.some((pattern) => {
    return findPatternMatches(codeSource, pattern).some((match) => {
      const matchIndex = match.index ?? 0;
      const prefix = codeSource.slice(0, matchIndex);
      if (isReturnExpressionResult(prefix)) return true;
      if (isArrowExpressionResult(prefix)) return true;
      if (isInsideControlCondition(prefix)) return true;

      const assignedName = findAssignedName(prefix);
      if (assignedName && variableAffectsFunctionResult(codeSource, matchIndex, assignedName)) {
        return true;
      }

      const mutationTarget = findMutationTarget(prefix);
      return Boolean(
        mutationTarget
        && variableAffectsFunctionResult(codeSource, matchIndex, mutationTarget),
      );
    });
  });
}

function findPatternMatches(source, pattern) {
  const matcher = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
  return [...source.matchAll(matcher)];
}

function isDiagnosticCallArgument(prefix) {
  return findOpenGroupingContexts(prefix).some((group) => (
    group.character === '('
    && /\b(?:console|logger|log|[A-Za-z_$][\w$]*(?:Logger|Log))\s*(?:\?\.)?\.\s*(?:trace|debug|info|warn|error|log)\s*$/is.test(
      group.beforeOpening,
    )
  ));
}

function isInsideControlCondition(prefix) {
  return findOpenGroupingContexts(prefix).some((group) => (
    group.character === '('
    && /\b(?:if|switch|while|for)\s*$/.test(group.beforeOpening)
  ));
}

function findOpenGroupingContexts(prefix) {
  const source = maskJavaScriptNonCode(prefix);
  const closingToOpening = new Map([
    [')', '('],
    [']', '['],
    ['}', '{'],
  ]);
  const groupingStack = [];

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(' || character === '[' || character === '{') {
      groupingStack.push({
        character,
        beforeOpening: source.slice(0, index).trimEnd(),
      });
      continue;
    }

    const expectedOpening = closingToOpening.get(character);
    if (expectedOpening && groupingStack.at(-1)?.character === expectedOpening) {
      groupingStack.pop();
    }
  }

  return groupingStack;
}

function isReturnExpressionResult(prefix) {
  const returnMatches = [...prefix.matchAll(/\breturn\b/gi)];
  const lastReturn = returnMatches.at(-1);
  if (!lastReturn) return false;

  const resultMarker = '__QFEI_STATE_STRINGIFICATION__';
  const expressionPrefix = `${prefix.slice(
    (lastReturn.index ?? 0) + lastReturn[0].length,
  )}${resultMarker}`;
  const boundarySource = maskJavaScriptNonCode(expressionPrefix);
  const firstTokenIndex = boundarySource.search(/\S/);
  if (
    firstTokenIndex < 0
    || /[\r\n]/.test(boundarySource.slice(0, firstTokenIndex))
  ) {
    return false;
  }

  const closingToOpening = new Map([
    [')', '('],
    [']', '['],
    ['}', '{'],
  ]);
  const openingCharacters = new Set(closingToOpening.values());
  const groupingStack = [];

  for (let index = firstTokenIndex; index < boundarySource.length; index += 1) {
    const character = boundarySource[index];
    if (openingCharacters.has(character)) {
      groupingStack.push(character);
      continue;
    }
    const expectedOpening = closingToOpening.get(character);
    if (expectedOpening && groupingStack.at(-1) === expectedOpening) {
      groupingStack.pop();
      continue;
    }
    if (groupingStack.length > 0) continue;
    if (character === ';') return false;
    if (character !== '\n' && character !== '\r') continue;

    const nextIndex = character === '\r' && boundarySource[index + 1] === '\n'
      ? index + 2
      : index + 1;
    if (!expressionContinuesAcrossLine(boundarySource.slice(0, index), boundarySource.slice(nextIndex))) {
      return false;
    }
    index = nextIndex - 1;
  }

  return true;
}

function expressionContinuesAcrossLine(beforeLineBreak, afterLineBreak) {
  const before = beforeLineBreak.trimEnd();
  const after = afterLineBreak.trimStart();
  if (!before || !after) return false;

  if (/(?:\+\+|--)$/.test(before)) return false;
  if (
    /(?:=>|\?\?|\|\||&&|\*\*|===|!==|==|!=|<=|>=|<<|>>>?|[+\-*/%&|^<>=?:,.])$/.test(before)
    || /\b(?:as|satisfies|in|instanceof|new|typeof|void|delete|await|yield|keyof)$/.test(before)
  ) {
    return true;
  }

  if (/^(?:\+\+|--)/.test(after)) return false;
  return /^(?:\?\.|[.([`? :,]|\?\?|\|\||&&|\*\*|===|!==|==|!=|<=|>=|<<|>>>?|[+\-*/%&|^<>=]|(?:as|satisfies|in|instanceof)\b)/.test(
    after,
  );
}

function maskJavaScriptNonCode(source) {
  const output = [];
  const contexts = [{ type: 'code', templateExpression: false, braceDepth: 0 }];

  for (let index = 0; index < source.length; index += 1) {
    const context = contexts.at(-1);
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (context.type === 'line-comment') {
      if (character === '\n' || character === '\r') {
        contexts.pop();
        output.push(character);
      } else {
        output.push(' ');
      }
      continue;
    }

    if (context.type === 'block-comment') {
      if (character === '*' && nextCharacter === '/') {
        output.push(' ', ' ');
        contexts.pop();
        index += 1;
      } else {
        output.push(character === '\n' || character === '\r' ? character : ' ');
      }
      continue;
    }

    if (context.type === 'string') {
      if (character === '\\') {
        output.push(' ');
        if (index + 1 < source.length) {
          output.push(' ');
          index += 1;
        }
      } else {
        output.push(' ');
        if (character === context.quote) contexts.pop();
      }
      continue;
    }

    if (context.type === 'template') {
      if (character === '\\') {
        output.push(' ');
        if (index + 1 < source.length) {
          output.push(' ');
          index += 1;
        }
      } else if (character === '`') {
        output.push(' ');
        contexts.pop();
      } else if (character === '$' && nextCharacter === '{') {
        output.push('$', '{');
        contexts.push({ type: 'code', templateExpression: true, braceDepth: 0 });
        index += 1;
      } else {
        output.push(' ');
      }
      continue;
    }

    if (context.templateExpression && character === '}') {
      if (context.braceDepth === 0) {
        output.push('}');
        contexts.pop();
      } else {
        context.braceDepth -= 1;
        output.push(character);
      }
      continue;
    }
    if (context.templateExpression && character === '{') {
      context.braceDepth += 1;
      output.push(character);
      continue;
    }
    if (character === '/' && nextCharacter === '/') {
      output.push(' ', ' ');
      contexts.push({ type: 'line-comment' });
      index += 1;
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      output.push(' ', ' ');
      contexts.push({ type: 'block-comment' });
      index += 1;
      continue;
    }
    if (character === "'" || character === '"') {
      output.push('_');
      contexts.push({ type: 'string', quote: character });
      continue;
    }
    if (character === '`') {
      output.push('_');
      contexts.push({ type: 'template' });
      continue;
    }
    output.push(character);
  }

  return output.join('');
}

function isArrowExpressionResult(prefix) {
  const arrowIndex = prefix.lastIndexOf('=>');
  if (arrowIndex < 0) return false;
  const expressionPrefix = prefix.slice(arrowIndex + 2).trimStart();
  return !expressionPrefix.startsWith('{');
}

function findAssignedName(prefix) {
  const declaration = prefix.match(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*$/s,
  );
  if (declaration) return declaration[1];

  const assignment = prefix.match(
    /(?:^|[;{}])\s*([A-Za-z_$][\w$]*)\s*=\s*[^;]*$/s,
  );
  return assignment?.[1] ?? null;
}

function findMutationTarget(prefix) {
  return prefix.match(
    /\b([A-Za-z_$][\w$]*)\s*(?:\?\.)?\s*\.\s*(?:push|unshift|splice)\s*\([^;]*$/s,
  )?.[1] ?? null;
}

function variableAffectsFunctionResult(functionSource, matchIndex, variableName) {
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffix = functionSource.slice(matchIndex);
  const returnUse = new RegExp(String.raw`\breturn\b[^;}]*(?:\b${escapedName}\b)`, 's');
  const branchUse = new RegExp(
    String.raw`\b(?:if|switch|while)\s*\([^)]*\b${escapedName}\b`,
    's',
  );
  return returnUse.test(suffix) || branchUse.test(suffix);
}

function hasEditableFieldsRuntimeConsumption(text) {
  const directDerivation = /\b(?:create\w*Fields|edit(?!ableFields\b)\w*Fields|writable\w*Fields|form\w*Fields|fieldsForCreate|fieldsForEdit)\s*=\s*[^;\n]*(?:\.editableFields\b|\[['"]editableFields['"]\])/i;
  const passedToPermissionOrFormLogic = /(?:canCreateEntityField|canUpdateEntityField|creatableFieldKeysForEntity|editableFieldKeysForEntity|buildCreate\w*|buildEdit\w*|render\w*Form)\s*\([^)]*(?:\.editableFields\b|\[['"]editableFields['"]\])/is;

  return directDerivation.test(text)
    || passedToPermissionOrFormLogic.test(text);
}

function extractNamedFunctionSources(text, functionName) {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(
    String.raw`(?:function\s+${escapedName}\b|(?:const|let|var)\s+${escapedName}\b)`,
    'g',
  );
  const sources = [];

  for (const match of text.matchAll(declaration)) {
    const start = match.index ?? 0;
    const arrowIndex = text.indexOf('=>', start);
    const braceIndex = text.indexOf('{', start);
    const isArrow = arrowIndex >= 0 && (braceIndex < 0 || arrowIndex < braceIndex);

    if (isArrow) {
      const expressionStart = arrowIndex + 2;
      const firstCharacterIndex = text.slice(expressionStart).search(/\S/);
      const bodyStart = firstCharacterIndex < 0
        ? expressionStart
        : expressionStart + firstCharacterIndex;
      if (text[bodyStart] === '{') {
        const bodyEnd = findMatchingBraceEnd(text, bodyStart);
        sources.push(text.slice(start, bodyEnd));
      } else {
        const statementEnd = text.indexOf(';', bodyStart);
        sources.push(text.slice(start, statementEnd < 0 ? text.length : statementEnd + 1));
      }
      continue;
    }

    if (braceIndex >= 0) {
      sources.push(text.slice(start, findMatchingBraceEnd(text, braceIndex)));
    }
  }

  return sources;
}

function findMatchingBraceEnd(text, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}') depth -= 1;
    if (depth === 0) return index + 1;
  }
  return text.length;
}

function checkProviderOrder() {
  const appFiles = uiRuntimeFiles.filter((file) => /(?:^|[/\\])App\.[jt]sx?$/.test(file));
  const appText = readJoined(appFiles) || uiRuntimeText;
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

function hasEntityRouteGuardSignal(text) {
  const dynamicRouteFunctionNames = [
    'ObjectRoutePage',
    'EntityRoutePage',
  ];
  const routeGuardFunctionNames = [
    'SchemaObjectPage',
    'ObjectRouteGuard',
    'EntityRouteGuard',
  ];
  const dynamicRouteSources = dynamicRouteFunctionNames.flatMap((functionName) => (
    extractNamedFunctionSources(text, functionName)
  ));
  const routeGuardSources = routeGuardFunctionNames.flatMap((functionName) => (
    extractNamedFunctionSources(text, functionName)
  ));
  const preferredRouteSources = dynamicRouteSources.length > 0
    ? dynamicRouteSources
    : routeGuardSources;
  const sources = preferredRouteSources.length > 0 ? preferredRouteSources : [text];
  const entityGateVariable = String.raw`(?:can|has)(?:View|Read|Access|Use)\w*(?:Entity|Object|Metadata)\w*`;
  const directGuard = new RegExp(
    String.raw`\bif\s*\(\s*!\s*can(?:UseEntityOperation|Use.*Operation|Has.*Permission)\([^)]*(?:META_ENTITY_READ|meta\.entity\.read)[^)]*\)\s*\)\s*(?:\{\s*)?return\s+<(?:Result|Forbidden|Navigate|Redirect)`,
    'is',
  );
  const variableGuard = new RegExp(
    String.raw`\b(?:const|let)\s+(${entityGateVariable})\s*=\s*can(?:UseEntityOperation|Use.*Operation|Has.*Permission)\([^;\n]*(?:META_ENTITY_READ|meta\.entity\.read)[^;\n]*;[\s\S]{0,240}\bif\s*\(\s*!\s*\1\s*\)\s*(?:\{\s*)?return\s+<(?:Result|Forbidden|Navigate|Redirect)`,
    'is',
  );
  const protectedRoute = new RegExp(
    String.raw`\breturn\s*(?:\(\s*)?<(?:ProtectedRoute|AuthorizedRoute|RouteGuard)\b(?=[^>]*\b(?:permissionKey|permission)\s*=\s*\{?[^>]*(?:META_ENTITY_READ|meta\.entity\.read))(?=[^>]*\b(?:entityKey|objectKey)\s*=\s*\{?[^>]*(?:object|entity)\s*\.\s*(?:entityKey|key))[^>]*>`,
    'is',
  );

  return sources.some((source) => (
    directGuard.test(source)
      || variableGuard.test(source)
      || protectedRoute.test(source)
  ));
}

function hasReadGateSignal(text) {
  return (
    /(canRead|DATA_RECORD_READ|data\.record\.read)/.test(text)
    && /(enabled\s*:|onDataLoad=\{[^}]*\?|openDetail|fetchEntityRecord|fetch.*Detail)/s.test(text)
  );
}

function hasEntityNavigationGateSignal(text) {
  const navigationComponent = String.raw`<\w*(?:Navigation|Sidebar|SideBar|Menu)\w*\b[^>]*>`;
  const directMetaEntityGate = new RegExp(
    `${navigationComponent.slice(0, -1)}[^>]*\\b(?:visible|enabled)\\s*=\\s*\\{[^}]*meta\\.entity\\.read[^}]*\\}[^>]*>`,
    'is',
  );
  const entityGateVariable = String.raw`can(?:View|Read)(?:Entity|Object|Metadata)\w*`;
  const gatedNavigation = new RegExp(
    `${navigationComponent.slice(0, -1)}[^>]*\\b(?:visible|enabled)\\s*=\\s*\\{[^}]*${entityGateVariable}[^}]*\\}[^>]*>`,
    'is',
  );
  const entityGateDefinition = new RegExp(
    `\\b${entityGateVariable}\\s*=\\s*can(?:UseEntityOperation|Use.*Operation|Has.*Permission)\\([^;\\n]*(?:META_ENTITY_READ|meta\\.entity\\.read)`,
    'is',
  );
  const navigationCollectionProp = String.raw`(?:objects|entities|items|menuItems|navigationItems)`;
  const directFilteredNavigation = new RegExp(
    `${navigationComponent.slice(0, -1)}[^>]*\\b${navigationCollectionProp}\\s*=\\s*\\{\\s*(?:objects|entities)\\s*\\.\\s*filter\\s*\\([\\s\\S]{0,400}?(?:META_ENTITY_READ|meta\\.entity\\.read)[\\s\\S]{0,400}?\\)\\s*\\}[^>]*>`,
    'is',
  );
  const filteredEntityCollections = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:objects|entities)\s*\.\s*filter\s*\([\s\S]{0,400}?(?:META_ENTITY_READ|meta\.entity\.read)/gi;
  const filteredCollectionFeedsNavigation = [...text.matchAll(filteredEntityCollections)]
    .some((match) => {
      const collectionName = match[1];
      const escapedCollectionName = collectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const navigationConsumesCollection = new RegExp(
        `${navigationComponent.slice(0, -1)}[^>]*\\b${navigationCollectionProp}\\s*=\\s*\\{\\s*${escapedCollectionName}\\s*\\}[^>]*>`,
        'is',
      );
      return navigationConsumesCollection.test(text);
    });

  return directMetaEntityGate.test(text)
    || (gatedNavigation.test(text) && entityGateDefinition.test(text))
    || directFilteredNavigation.test(text)
    || filteredCollectionFeedsNavigation;
}

function hasRecordReadGatedTableHeaders(text) {
  const recordReadGate = String.raw`(?:can\w*(?:Read|View)\w*Record\w*|DATA_RECORD_READ|data\.record\.read)`;
  const visibleColumns = String.raw`(?:visible\w*(?:Fields|Columns|Headers)|fieldsFor(?:List|Table)|table\w*(?:Fields|Columns|Headers))`;
  const directColumnGate = new RegExp(
    `\\b(?:columns|fields|headers)\\s*=\\s*\\{[^}]{0,220}${recordReadGate}[^}]{0,220}${visibleColumns}|\\b(?:columns|fields|headers)\\s*=\\s*\\{[^}]{0,220}${visibleColumns}[^}]{0,220}${recordReadGate}`,
    'is',
  );
  const conditionalTableMount = new RegExp(
    `${recordReadGate}\\s*&&\\s*<[^>]*(?:Table|Grid|Canvas)[^>]*>|<[^>]*(?:Table|Grid|Canvas)[^>]*>[^<]{0,80}\\{\\s*${recordReadGate}\\s*&&`,
    'is',
  );
  const ternaryTableMount = new RegExp(
    `${recordReadGate}\\s*\\?\\s*<[^>]*(?:Table|Grid|Canvas)|<[^>]*(?:Table|Grid|Canvas)[^>]*>[^<]{0,80}\\{\\s*${recordReadGate}\\s*\\?`,
    'is',
  );
  const earlyReturnWithoutTable = new RegExp(
    `\\bif\\s*\\(\\s*!\\s*${recordReadGate}\\s*\\)\\s*(?:\\{\\s*)?return\\s+<(?:Empty|Result|Forbidden|NoData|AccessDenied|Placeholder)\\b`,
    'is',
  );
  const derivedColumnGate = new RegExp(
    `\\b(?:const|let)\\s+\\w*(?:Columns|Fields|Headers)\\w*\\s*=\\s*[^;\\n]*${recordReadGate}|\\b(?:const|let)\\s+\\w*(?:Columns|Fields|Headers)\\w*\\s*=\\s*[^;\\n]*${visibleColumns}[^;\\n]*${recordReadGate}`,
    'is',
  );

  return directColumnGate.test(text)
    || conditionalTableMount.test(text)
    || ternaryTableMount.test(text)
    || earlyReturnWithoutTable.test(text)
    || derivedColumnGate.test(text);
}

function hasRecordRowsClearSignal(text) {
  const recordReadGate = String.raw`(?:can\w*(?:Read|View)\w*Record\w*|DATA_RECORD_READ|data\.record\.read)`;
  const emptyRows = String.raw`(?:\[\s*\]|EMPTY_ROWS|emptyRows|noRows)`;
  const directTableRows = new RegExp(
    `<[^>]*(?:Table|Grid|Canvas)[^>]*\\b(?:rows|data|items|records)\\s*=\\s*\\{[^}]*${recordReadGate}[^}]*\\?[^}:]*(?:\\:\\s*${emptyRows})|<[^>]*(?:Table|Grid|Canvas)[^>]*\\b(?:rows|data|items|records)\\s*=\\s*\\{[^}]*${emptyRows}[^}]*\\:[^}]*${recordReadGate}`,
    'is',
  );
  const guardedRows = new RegExp(
    `\\b(?:const|let)\\s+(\\w*(?:Rows|Data|Items|Records)\\w*)\\s*=\\s*${recordReadGate}\\s*\\?[^;\\n]*\\:\\s*${emptyRows}`,
    'is',
  );
  const guardedRowsBoundToTable = [...text.matchAll(new RegExp(guardedRows.source, 'gi'))]
    .some((match) => {
      const rowsVariable = match[1];
      const escapedRowsVariable = rowsVariable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tableConsumesRows = new RegExp(
        `<[^>]*(?:Table|Grid|Canvas)[^>]*\\b(?:rows|data|items|records)\\s*=\\s*\\{\\s*${escapedRowsVariable}\\s*\\}`,
        'is',
      );
      return tableConsumesRows.test(text);
    });
  const boundTableRowsCleared = hasBoundTableRowsClearSignal(text, recordReadGate, emptyRows);

  return directTableRows.test(text) || guardedRowsBoundToTable || boundTableRowsCleared;
}

function hasBoundTableRowsClearSignal(text, recordReadGate, emptyRows) {
  const tableRowsBinding = /<[^>]*(?:Table|Grid|Canvas)[^>]*\b(?:rows|data|items|records)\s*=\s*\{\s*([A-Za-z_$][\w$]*)(?:\s*\.\s*((?:rows|data|items|records)))?\s*\}/gi;

  return [...text.matchAll(tableRowsBinding)].some((match) => {
    const rowSource = match[1];
    const escapedRowSource = rowSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rowSourceHasProperty = Boolean(match[2]);
    const clearExpression = rowSourceHasProperty
      ? String.raw`\b${escapedRowSource}\s*(?:\?\.)?\.\s*(?:clear|reset)\s*\(`
      : String.raw`\b(?:set|clear|reset)${rowSource[0].toUpperCase()}${rowSource.slice(1)}\s*\(\s*${emptyRows}`;
    const guardedClear = new RegExp(
      String.raw`\bif\s*\(\s*!\s*${recordReadGate}\s*\)[\s\S]{0,180}${clearExpression}`,
      'is',
    );
    return guardedClear.test(text);
  });
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

function collectExistingSourceFiles(candidates) {
  return candidates.flatMap((candidate) => {
    const absolute = path.join(root, candidate);
    return fs.existsSync(absolute) ? collectSourceFiles(absolute) : [];
  });
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
    && !/\.(?:stories|story|mock|fixture)\.[cm]?[jt]sx?$/i.test(basename)
    && !/(?:^|[/\\])(?:__tests__|test|tests|__mocks__|mocks?|__fixtures__|fixtures?)(?:[/\\]|$)/i.test(file);
}

function readJoined(files) {
  return files.map(readFile).join('\n');
}

function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
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
