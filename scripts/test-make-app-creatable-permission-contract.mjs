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
const serviceSkill = read('skills/make-app-service/SKILL.md');
const serviceAdapter = read(
  'skills/make-app-service/references/make-data-adapter.md',
);
const serviceContracts = read(
  'skills/make-app-service/references/service-api-contracts.md',
);
const serviceTesting = read(
  'skills/make-app-service/references/testing-and-safety.md',
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
  /metadata:\s*\n\s*version:\s*0\.2\.3/,
  'make-app-permission must use the planned 0.2.3 contract revision',
);
assert.match(
  permissionBundle,
  /createFields[\s\S]{0,1200}meta\.field\.create[\s\S]{0,1200}creatable/i,
  'create fields must be the createFields and meta.field.create creatable intersection',
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
for (const conformanceCase of [
  'operation_create_absent_must_deny',
  'named_entity_permission_does_not_leak',
  'invalid_requested_identifiers_fail_closed',
  'operation_global_permission_wildcard_allows',
  'operation_segment_permission_wildcard_allows',
  'operation_deny_does_not_deny_create_field_dimension',
  'create_field_deny_does_not_deny_record_create_operation',
  'entity_resource_wildcard_matches',
  'parent_and_global_resources_match',
  'field_dimensions_are_independent',
  'record_create_field_access_does_not_grant_meta_create',
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
  /(independent|独立)[^\n]*(creatable|可新建)[^\n]*(visible|可见)[^\n]*(editable|可编辑)|(creatable|可新建)[^\n]*(visible|可见)[^\n]*(editable|可编辑)[^\n]*(independent|独立)/i,
  'creatable, visible, and editable field permissions must be independent',
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
  /data\.record\.create[^\n]*meta\.field\.create[^\n]*(independent|独立)|meta\.field\.create[^\n]*data\.record\.create[^\n]*(independent|独立)/i,
  'record create and field create permissions must be independent',
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
  /permissionKey[^\n]*meta\.field\.create[\s\S]{0,600}fieldAccess[\s\S]{0,300}creatable/,
  'principal permission response must show creatable fieldAccess on meta.field.create',
);
assert.doesNotMatch(
  principalPermission,
  /data\.record\.create[^\n]*fieldAccess[^\n]*(creatable|可新建)/i,
  'principal permission reference must not bind create fields to data.record.create',
);

assert.match(
  permissionTesting,
  /data\.record\.create[^\n]*deny[^\n]*meta\.field\.create[^\n]*allow[^\n]*(operation no|操作拒绝)[^\n]*(field yes|字段允许)/i,
  'testing guidance must keep operation deny independent from create-field allow',
);
assert.match(
  permissionTesting,
  /data\.record\.create[^\n]*allow[^\n]*meta\.field\.create[^\n]*deny[^\n]*(operation yes|操作允许)[^\n]*(field no|字段拒绝)/i,
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
