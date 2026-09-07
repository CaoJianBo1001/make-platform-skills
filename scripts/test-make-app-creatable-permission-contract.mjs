#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `Expected ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
};

const permissionSkill = read('skills/make-app-permission/SKILL.md');
const boundaries = read(
  'skills/make-app-permission/references/permission-boundaries.md',
);
const principalPermission = read(
  'skills/make-app-permission/references/service-principal-permission.md',
);
const runtime = read(
  'skills/make-app-permission/references/ui-permission-runtime.md',
);
const permissionTesting = read(
  'skills/make-app-permission/references/testing-and-audit.md',
);
const systemFieldContract = read(
  'skills/make-app-permission/references/system-field-contract.md',
);
const conformanceSuite = read(
  'skills/make-app-permission/scripts/permission-conformance-suite.mjs',
);
const permissionAudit = read(
  'skills/make-app-permission/scripts/audit-make-app-permission.mjs',
);
const installedSkillSync = read(
  'skills/make-app-permission/scripts/check-installed-skill-sync.mjs',
);
const installedSkillSyncTest = read(
  'skills/make-app-permission/scripts/test-installed-skill-sync.mjs',
);
const installedPlatformSkillsSync = read(
  'scripts/check-installed-make-platform-skills-sync.mjs',
);
const serviceSkill = read('skills/make-app-service/SKILL.md');
const serviceAdapter = read(
  'skills/make-app-service/references/make-data-adapter.md',
);
const serviceContracts = read(
  'skills/make-app-service/references/service-api-contracts.md',
);
const serviceLayering = read(
  'skills/make-app-service/references/service-layering.md',
);
const serviceTesting = read(
  'skills/make-app-service/references/testing-and-safety.md',
);
const authSkill = read('skills/make-app-auth/SKILL.md');
const authRequestAdapter = read(
  'skills/make-app-auth/references/request-adapter.md',
);
const authLogoutAnd401 = read(
  'skills/make-app-auth/references/logout-and-401.md',
);
const makeuiSkill = read('skills/makeui/SKILL.md');
const componentUsage = read('skills/makeui/references/component-usage.md');
const drawerLayout = read('skills/makeui/references/drawer-layout.md');
const routeLayout = read('skills/makeui/references/page-route-layout.md');
const readme = read('README.md');
const agentMetadata = read('skills/make-app-permission/agents/openai.yaml');

const permissionBundle = [
  permissionSkill,
  boundaries,
  principalPermission,
  runtime,
  permissionTesting,
  systemFieldContract,
].join('\n');
const serviceBundle = [
  serviceSkill,
  serviceAdapter,
  serviceContracts,
  serviceLayering,
  serviceTesting,
].join('\n');
const makeuiBundle = [makeuiSkill, componentUsage, drawerLayout, routeLayout].join(
  '\n',
);

assert.match(
  permissionSkill.split('---')[1] ?? '',
  /(字段可新建|可新建)[^"\n]*(creatable|createFields)|(creatable|createFields)[^"\n]*(字段可新建|可新建)/i,
  'make-app-permission trigger metadata must cover creatable/createFields requests',
);
assert.match(
  permissionSkill,
  /metadata:\s*\n\s*version:\s*0\.3\.1/,
  'make-app-permission must use the 0.3.1 default-enforcement and passthrough release revision',
);
assert.match(
  permissionSkill,
  /must be enabled by default for every generated or refactored Make App/i,
  'make-app-permission must be enabled by default for every Make App',
);
assert.doesNotMatch(
  permissionSkill,
  /only when the user requests it or the repository has an explicit delivery baseline/i,
  'make-app-permission must not make default enforcement opt-in',
);
assert.match(
  principalPermission,
  /preserve the upstream HTTP status, response body, and Content-Type unchanged/i,
  'principal permission route must pass through real Make IAM responses unchanged',
);
assert.doesNotMatch(
  principalPermission,
  /map upstream failures/i,
  'principal permission route must not map Make IAM failures into a Service envelope',
);
assert.match(
  serviceBundle,
  /direct.*Make.*proxy[\s\S]{0,700}(?:(?:status|状态)[\s\S]{0,240}(?:Content-Type|content type)[\s\S]{0,240}(?:body|响应体)[\s\S]{0,240}(?:unchanged|原样)[\s\S]{0,500}(?:2xx|200)[\s\S]{0,240}(?:4xx|403)[\s\S]{0,240}(?:5xx|500)|(?:2xx|200)[\s\S]{0,240}(?:4xx|403)[\s\S]{0,240}(?:5xx|500)[\s\S]{0,500}(?:status|状态)[\s\S]{0,240}(?:Content-Type|content type)[\s\S]{0,240}(?:body|响应体)[\s\S]{0,240}(?:unchanged|原样))/i,
  'direct Make proxies must preserve the real status, Content-Type, and body for 2xx, 4xx, and 5xx responses',
);
assert.doesNotMatch(
  serviceSkill,
  /When single-app permission enforcement is in scope[\s\S]{0,300}Otherwise do not add that proxy solely to satisfy this Skill/i,
  'make-app-service must not retain an opt-in exception for the mandatory permission proxy',
);
assert.match(
  serviceAdapter,
  /validateStatus\s*:\s*\(\)\s*=>\s*true/i,
  'Axios-like Make clients must resolve completed 4xx/5xx responses for transparent forwarding',
);
assert.match(
  serviceAdapter,
  /error\.response[\s\S]{0,500}(?:status|状态)[\s\S]{0,500}(?:Content-Type|content type)[\s\S]{0,500}(?:body|响应体)/i,
  'an existing client error response must be forwarded rather than replaced by a Service error',
);
assert.match(
  serviceContracts,
  /record-write-permission[\s\S]{0,240}records\/bulk[\s\S]{0,240}(?:existing|既有|established)[\s\S]{0,320}(?:do not|must not|不得|不能)[\s\S]{0,240}(?:successful (?:or|and) failed response|成功与失败响应|success and error|完整响应)/i,
  'the established action response contracts must not be changed by the direct-proxy rule',
);
assert.match(
  serviceSkill,
  /metadata:\s*\n\s*version:\s*0\.2\.1/,
  'make-app-service must use the 0.2.1 streamed-download passthrough revision',
);
assert.match(
  serviceContracts,
  /## Default route response modes[\s\S]{0,1800}\/api\/make\/app\/principal\/permission[\s\S]{0,240}(direct Make proxy|直接 Make 代理)[\s\S]{0,1800}\/api\/schema[\s\S]{0,240}(non-proxy|非代理)/i,
  'default route baseline must classify permission as a direct proxy and schema as a non-proxy route',
);
assert.match(
  serviceContracts,
  /\/api\/entities\/:entityKey\/records[\s\S]{0,240}(non-proxy|非代理)/i,
  'default route baseline must classify record normalization routes explicitly',
);
assert.match(
  serviceContracts,
  /Make file download proxy[\s\S]{0,240}Content-Type[\s\S]{0,240}Content-Disposition/i,
  'file download passthrough must preserve Content-Disposition as well as Content-Type',
);
assert.match(
  serviceTesting,
  /(200|2xx)[\s\S]{0,700}(403|4xx)[\s\S]{0,700}(500|5xx)[\s\S]{0,700}(JSON|json)[\s\S]{0,700}(text|文本)[\s\S]{0,700}(binary|二进制)/i,
  'Service tests must cover full passthrough for success, permission, server-error, JSON, text, and binary responses',
);
assert.match(
  serviceLayering,
  /(browser-facing|浏览器)[\s\S]{0,700}(safe|安全|sensitive|敏感)[\s\S]{0,700}(upstream|上游|Make)[\s\S]{0,700}(error|错误)/i,
  'Service layering must require browser-safe upstream error bodies before transparent forwarding',
);
assert.match(
  authSkill,
  /metadata:\s*\n\s*version:\s*0\.1\.5/,
  'make-app-auth must use the 0.1.5 default-permission revision',
);
assert.match(
  authRequestAdapter,
  /SDK owns the normal unified-login 401\/403 redirect/i,
  'the SDK must retain the established unified-login redirect handling for 401 and 403',
);
assert.match(
  authLogoutAnd401,
  /(401\/403|401、403|401 and 403)[\s\S]{0,500}(redirect|登录)/i,
  '401 and 403 must retain the established SDK redirect guidance',
);
assert.doesNotMatch(
  serviceContracts,
  /failed auth checks should return a stable 5xx\/contracted error/i,
  'Service contracts must not replace a completed Make auth response with a stable 5xx error',
);
assert.match(
  permissionBundle,
  /meta\.entity\.read[\s\S]{0,1000}(导航|navigation)[\s\S]{0,1000}meta\.field\.read[\s\S]{0,1000}(表头|headers|columns|列)[\s\S]{0,1000}data\.record\.read/i,
  'entity navigation, table headers, and record data must use independent meta.entity/meta.field/data.record read gates',
);
assert.match(
  permissionBundle,
  /createFields[\s\S]{0,1200}meta\.field\.read[\s\S]{0,1200}(creatable|readonly|editable|partialMask|fullMask|\*)/i,
  'create fields must be the createFields and meta.field.read create-state intersection',
);
assert.match(
  permissionBundle,
  /meta\.field\.create[^\n]*(not a platform permission point|不是平台权限点|must not be required)/i,
  'meta.field.create must be documented as an unsupported create-field permission point',
);
assert.match(
  boundaries,
  /Apply a matching `effect: deny` before allows; it denies the matching permission dimension\./,
  'deny semantics must be described per permission dimension, not as a record operation denial',
);
assert.doesNotMatch(
  permissionBundle,
  /fieldCondition|policy editing|permission groups/i,
  'the front-end App permission skill must not own back-office policy configuration',
);
for (const expectedValue of [
  'Make.Field.ID',
  'IDField',
  'create_user',
  'create_time',
  'update_user',
  'update_time',
  'qfei_create_user',
  'qfei_create_time',
  'qfei_update_user',
  'qfei_update_time',
]) {
  assert.match(
    systemFieldContract,
    new RegExp(expectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `system field contract must include ${expectedValue}`,
  );
}
assert.match(
  permissionTesting,
  /permission-conformance-suite\.mjs[\s\S]{0,500}(adapter|适配器)/i,
  'testing reference must require the executable permission conformance suite',
);
assert.match(
  permissionAudit,
  /field_access_state_stringified/,
  'permission audit must reject obvious fieldAccess state-array stringification',
);
assert.match(
  permissionAudit,
  /entity_route_not_gated_by_meta_entity_read[\s\S]{0,800}entity_navigation_not_gated_by_meta_entity_read[\s\S]{0,800}table_headers_tied_to_record_read[\s\S]{0,800}record_rows_not_cleared_on_read_revoke/i,
  'permission audit must reject missing entity route guards, record-read header gates, and stale record rows',
);
assert.match(
  permissionTesting,
  /(default test|默认测试|CI|publish gate|发布校验)[\s\S]{0,500}(audit|审计)[\s\S]{0,500}(conformance|一致性)/i,
  'host automation must continuously invoke both permission gates',
);
assert.match(
  permissionTesting,
  /check-installed-skill-sync\.mjs[\s\S]{0,500}(source-only|source_only)[\s\S]{0,300}(installed-only|installed_only)[\s\S]{0,300}(content-mismatch|content_mismatch)/i,
  'local release verification must compare the complete source and installed Skill trees',
);
for (const findingKind of ['source_only', 'installed_only', 'content_mismatch']) {
  assert.match(
    installedSkillSync,
    new RegExp(findingKind),
    `installed Skill sync checker must report ${findingKind}`,
  );
  assert.match(
    installedSkillSyncTest,
    new RegExp(findingKind),
    `installed Skill sync tests must cover ${findingKind}`,
  );
}
assert.match(
  installedPlatformSkillsSync,
  /make-app-permission[\s\S]{0,240}make-app-service[\s\S]{0,240}make-app-auth[\s\S]{0,240}make-app-actions[\s\S]{0,240}make-app-sort[\s\S]{0,240}make-app-group/i,
  'platform release sync check must cover every Skill changed by the shared Make response contract',
);
assert.match(
  permissionSkill,
  /npx skills update\s+qfeius\/make-platform-skills[\s\S]{0,500}check-installed-make-platform-skills-sync\.mjs/i,
  'permission release guidance must use the supported Skills CLI update command before the full sync check',
);
for (const conformanceCase of [
  'operation_create_absent_must_deny',
  'entity_metadata_read_is_independent_from_record_read',
  'named_entity_permission_does_not_leak',
  'invalid_requested_identifiers_fail_closed',
  'operation_global_permission_wildcard_allows',
  'operation_segment_permission_wildcard_allows',
  'operation_deny_does_not_deny_read_derived_create_field',
  'read_field_deny_does_not_deny_record_create_operation',
  'entity_resource_wildcard_matches',
  'parent_and_global_resources_match',
  'create_field_uses_meta_field_read_dimension',
  'read_dimension_access_states',
  'record_create_field_access_does_not_grant_meta_read',
  'legacy_meta_field_create_does_not_grant_create_field',
  'explicit_null_field_access_fails_closed',
  'invalid_field_access_state_fails_closed',
  'valid_field_access_state_lists_are_preserved',
  'blank_field_key_poison_entire_access',
  'invalid_effect_fails_closed',
  'malformed_row_poison_entire_access',
  'invalid_permission_key_does_not_match',
  'invalid_resource_namespace_does_not_match',
  'missing_app_scope_fails_closed',
  'app_resource_cannot_override_scope',
  'invalid_explicit_app_resource_fails_closed',
  'entity_wildcard_allow_restricts_app_allow',
  'same_specificity_allow_fields_union',
  'namespace_alias_same_specificity_allow_union',
  'same_specificity_named_hidden_overrides_wildcard',
  'same_specificity_named_hidden_overrides_named_allow',
  'same_specificity_named_hidden_overrides_unrestricted_allow',
  'system_id_and_audit_fields_are_not_create_capable',
  'system_id_fields_are_not_edit_capable',
  'similarly_named_business_fields_remain_create_capable',
  'audit_fields_can_remain_update_capable',
]) {
  assert.match(
    conformanceSuite,
    new RegExp(conformanceCase),
    `conformance suite must include ${conformanceCase}`,
  );
}
assert.match(
  permissionBundle,
  /(create|新建)[^\n]*(visibility|可见)[^\n]*(editability|可编辑)[^\n]*(separate|独立)|(separate|独立)[^\n]*(create|新建)[^\n]*(visibility|可见)[^\n]*(editability|可编辑)/i,
  'create, visible, and editable field sets must remain separate',
);
assert.match(
  permissionBundle,
  /createFields[^\n]*(missing|缺失)[^\n]*(empty|空)[^\n]*(no fallback|不回退)[^\n]*fields/i,
  'missing createFields must fail closed without falling back to fields',
);
assert.match(
  permissionBundle,
  /editableFields[^\n]*(ignore|ignored|不使用|忽略)/i,
  'editableFields must be explicitly ignored by current edit behavior',
);
assert.match(
  permissionBundle,
  /(exclude|排除|不可)[^\n]*(ID|审计|audit)[^\n]*(create|creatable|可新建)|(create|creatable|可新建)[^\n]*(exclude|排除|不可)[^\n]*(ID|审计|audit)/i,
  'create permission must exclude ID and audit fields',
);
assert.match(
  permissionBundle,
  /(审计|audit)[^\n]*(edit|editable|可编辑)[^\n]*(保留|remain|keep)|(保留|remain|keep)[^\n]*(审计|audit)[^\n]*(edit|editable|可编辑)/i,
  'audit fields must retain existing edit capability',
);
assert.match(
  permissionBundle,
  /data\.record\.create[^\n]*meta\.field\.read[^\n]*(separate|independent|独立)|meta\.field\.read[^\n]*data\.record\.create[^\n]*(separate|independent|独立)/i,
  'record create and read-derived create-field permissions must be independent',
);
assert.match(
  runtime,
  /canCreateEntityField[\s\S]{0,600}creatableFieldKeysForEntity/,
  'UI permission runtime must require create-field helpers',
);
assert.match(
  runtime,
  /(submit|提交)[\s\S]{0,1000}(allowlist|白名单)[\s\S]{0,800}(DevTools|inject|注入|unauthorized|未授权)/i,
  'create submit must rebuild an allowlisted payload and resist injected values',
);
assert.match(
  runtime,
  /refreshPermissions[\s\S]{0,700}(refreshSchema|invalidateSchema|Schema cache|Schema 缓存|schema generation)/i,
  'permission refresh must invalidate or reload permission-trimmed schema',
);
assert.match(
  runtime,
  /Lookup[\s\S]{0,600}fields[\s\S]{0,300}createFields[\s\S]{0,700}(target|目标)[^\n]*fields/i,
  'create-only Lookup source fields may use createFields while targets remain visible',
);
assert.match(
  runtime,
  /Make\.Field\.File[\s\S]{0,500}(recordID|record identity|记录标识)[\s\S]{0,700}(host|宿主|contract|合同)[\s\S]{0,700}(pre-upload|预上传|attachment array|附件数组)/i,
  'File create capability must be decided from the concrete host upload contract',
);
assert.match(
  runtime,
  /Make\.Field\.Lookup[\s\S]{0,700}lookup-options[\s\S]{0,900}(create|新建)[\s\S]{0,900}qfei_relation[\s\S]{0,900}(edit|编辑)[\s\S]{0,900}lookup-relations/i,
  'Lookup create/edit request and payload split must be explicit',
);
assert.match(
  runtime,
  /UI sends `\{ data: ordinaryAllowlistedData, relations:/i,
  'Lookup create must send separate data and relations objects',
);
assert.match(
  runtime,
  /Service must reject[^\n]*data\.qfei_relation/i,
  'Lookup create must reject raw qfei_relation',
);
assert.match(
  componentUsage,
  /field\.validations\.isRequired[\s\S]{0,400}required[^\n]*(prop|属性)/i,
  'makeui must define validations.isRequired as the Schema source for the required UI prop',
);

assert.match(
  principalPermission,
  /permissionKey[^\n]*meta\.field\.read[\s\S]{0,600}fieldAccess[\s\S]{0,300}creatable/,
  'principal permission response must show creatable fieldAccess on meta.field.read',
);
assert.doesNotMatch(
  principalPermission,
  /data\.record\.create[^\n]*fieldAccess[^\n]*(creatable|可新建)/i,
  'principal permission reference must not bind create fields to data.record.create',
);

assert.match(
  permissionTesting,
  /data\.record\.create[^\n]*deny[^\n]*meta\.field\.read[^\n]*allow[^\n]*(operation no|操作拒绝)[^\n]*(field yes|字段允许)/i,
  'testing guidance must keep operation deny independent from create-field allow',
);
assert.match(
  permissionTesting,
  /data\.record\.create[^\n]*allow[^\n]*meta\.field\.read[^\n]*deny[^\n]*(operation yes|操作允许)[^\n]*(field no|字段拒绝)/i,
  'testing guidance must keep create-field deny independent from record-create allow',
);
assert.doesNotMatch(
  permissionTesting,
  /\|\s*create deny\s*\|[^\n]*(entry|handler)[^\n]*field denied/i,
  'testing guidance must not couple an unspecified create deny to both dimensions',
);
assert.match(
  serviceBundle,
  /fields[\s\S]{0,500}createFields[\s\S]{0,700}(independent|separate|独立|分别)/i,
  'make-app-service must normalize fields and createFields independently',
);
assert.match(
  serviceBundle,
  /(principal|主体|user|用户)[^\n]*(cache|缓存)[^\n]*(isolate|隔离|不得.*共享|跨)/i,
  'permission-trimmed schema caches must be isolated by principal',
);
assert.match(
  serviceBundle,
  /(createFields)[^\n]*(missing|缺失)[^\n]*(empty|空)[^\n]*(no fallback|不回退)/i,
  'make-app-service must fail closed when createFields is missing',
);

assert.match(
  makeuiBundle,
  /(create|新建)[^\n]*(createFields|create field set|可新建字段集合)[\s\S]{0,500}(edit|编辑)[^\n]*(visible|可见)[^\n]*(editable|可编辑)/i,
  'makeui must hand create and edit forms different permission-derived field sets',
);
assert.match(
  componentUsage,
  /(required|必填)[^\n]*(rendered|渲染|authorized|授权|可新建|可编辑)/i,
  'required validation must only apply to rendered authorized fields',
);
assert.match(
  makeuiBundle,
  /(no creatable fields|无可新建字段|暂无可新建字段)[\s\S]{0,400}(empty|空状态|disabled|禁用)/i,
  'makeui must define the no-creatable-fields form state',
);

assert.match(
  readme,
  /(可新建|creatable|createFields)[^\n]*`make-app-permission`|`make-app-permission`[^\n]*(可新建|creatable|createFields)/i,
  'README routing must send creatable/createFields tasks to make-app-permission',
);
assert.match(
  agentMetadata,
  /(create|creatable|新建)[^\n]*(read|visible|可见)[^\n]*(update|edit|可编辑)/i,
  'agent metadata must advertise the complete create/read/update field chain',
);
console.log('make-app creatable permission contract passed');
