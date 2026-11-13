import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {normalizeBpmFormMetadata} from '../skills/make-app-approval/assets/bpm-form-metadata.mjs';
import {resolveBpmLookupDependencies} from '../skills/make-app-approval/assets/bpm-lookup-metadata.mjs';
import * as layouts from '../skills/make-app-approval/assets/mobile-detail-layout.mjs';
const read = path => readFileSync(new URL(`../skills/${path}`, import.meta.url), 'utf8');

const verifyInstalledCommands = document => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'approval installed guide '));
  const skillDir = path.join(workspace, '.agents', 'skills', 'make-app-approval');
  try {
    cpSync(new URL('../skills/make-app-approval/', import.meta.url), skillDir, {recursive: true});
    const bridge = path.join(workspace, 'host-adapter.mjs');
    writeFileSync(bridge, "export {normalizeBpmFormMetadata} from './.agents/skills/make-app-approval/assets/bpm-form-metadata.mjs';\n");
    const commands = [...document.matchAll(/```bash\n([\s\S]*?)\n```/g)]
      .flatMap(match => match[1].split('\n')).map(line => line.trim()).filter(line => line.startsWith('node '));
    assert.ok(commands.length > 0, '安装指南必须提供可执行验证命令');
    for (const command of commands) {
      const args = command.match(/"[^"]*"|'[^']*'|\S+/g).slice(1)
        .map(token => token.replace(/^(["'])(.*)\1$/, '$2'))
        .map(token => token.replaceAll('<skill-dir>', skillDir)
          // 旧写法按原文说明映射到实际 Skill 目录，仓库根 scripts 不做补齐。
          .replace(/^skills\/make-app-approval\//, `${skillDir}/`)
          .replace('/absolute/path/to/host-adapter.mjs', bridge));
      const result = spawnSync(process.execPath, args, {cwd: workspace, encoding: 'utf8'});
      assert.equal(result.status, 0, `${command} 在独立安装后失败：${result.stderr}`);
      assert.match(result.stdout, /PASS/);
    }
  } finally {
    rmSync(workspace, {recursive: true, force: true});
  }
};

test('分发指南中的验证命令在仅安装 Skill 的含空格目录可运行', () => {
  verifyInstalledCommands(read('make-app-approval/references/form-metadata.md'));
});
test('故障注入：把仓库级测试重新放回随包命令时能够检出缺失文件', () => {
  const document = read('make-app-approval/references/form-metadata.md');
  verifyInstalledCommands(document);
  assert.throws(() => verifyInstalledCommands(`${document}\n\n\`\`\`bash\nnode scripts/test-bpm-skill-review-regressions.mjs\n\`\`\`\n`), /独立安装后失败/);
});

test('缺省配置按真实转换合同接受，文档不能继续要求缺失选项时报错', () => {
  for (const makeFieldType of ['SINGLE_SELECT','MULTI_SELECT']) for (const config of [{},{selection:{}},{selection:{fieldSelections:[]}}]) {
    const node={appKey:'sample_app',entityKey:'sample_entity',processKey:'flow',nodeKey:'start',nodeName:'申请',fields:[{fieldKey:'state',fieldName:'状态',makeFieldType,...config}],relations:[]};
    assert.equal(normalizeBpmFormMetadata(node,{appKey:node.appKey,entityKey:node.entityKey}).fields.length,1);
  }
  assert.doesNotMatch(read('make-app-approval/references/form-metadata.md'),/缺失选项[^。\n]*报错/);
});
test('Lookup 可执行文档样例明确位于 data.formMetadata，不能读旧 data.fields/relations', () => {
  const document=read('make-app-approval/references/lookup-metadata.md');
  const example=JSON.parse([...document.matchAll(/```json\n([\s\S]*?)\n```/g)][0][1]);
  assert.ok(example.data?.formMetadata,'文档示例必须显式展示内嵌位置');
  assert.equal(example.data.fields,undefined); assert.equal(example.data.relations,undefined);
  const node=normalizeBpmFormMetadata(example.data.formMetadata,{appKey:'sample_app',entityKey:'sample_entity',processKey:'sample_flow',nodeKey:'start'});
  assert.deepEqual(resolveBpmLookupDependencies(node,['relatedName']),[{fieldKey:'relatedName',relationKey:'sample_relation',targetEntityKey:'sample_target',targetFieldKey:'title',targetFieldType:'Make.Field.Text',multiple:false}]);
});
test('手机规范区分任务与实例，不再限制两页签或将所有详情当任务', () => {
  const mobile=read('make-app-approval/references/mobile.md');
  assert.doesNotMatch(mobile,/仅待处理与已完成/);
  assert.match(mobile,/initiated/);
  assert.match(mobile,/ApprovalInstanceDetail/);
  assert.match(mobile,/referenceType/);
  assert.match(mobile,/实例[^\n]*不[^\n]*taskId/);
  assert.match(mobile,/实例[^\n]*日期[^\n]*申请人/);
  assert.match(mobile,/composeApprovalInstanceLayout/);
  assert.match(mobile,/ApprovalInstanceDetail\.presentation/);
  const list=read('make-app-approval/references/package-and-list.md');
  assert.match(list,/以下[^\n]*仅[^\n]*任务页签/);
  assert.match(list,/实例[^\n]*application\/history\/feedback/);
});
test('makeui 与审批地址表共同保留三种独立入口', () => {
  for(const file of ['makeui/references/page-route-layout.md','make-app-approval/references/standalone-pages.md']) {
    const document=read(file);
    for(const route of ['/bpm/objects/:entityKey/new','/bpm/tasks/:processInstanceId/:taskId','/bpm/instances/:processInstanceId']) assert.ok(document.includes(route),`${file} 缺少 ${route}`);
  }
});
test('实例手机布局只有只读正文与反馈，无 taskId、意见、动作，失败时保留重试', () => {
  assert.equal(typeof layouts.composeApprovalInstanceLayout,'function');
  const {composeApprovalInstanceLayout}=layouts;
  const retry={type:'retry',onClick(){}};
  assert.deepEqual(composeApprovalInstanceLayout({title:'详情',content:retry},{presentation:'mobile'}),{content:retry,sections:[],feedback:null});
  const application={type:'form'},history={type:'history'},feedback={type:'feedback'};
  const slots={sections:{application,history,feedback},content:{duplicate:true}};
  const result=composeApprovalInstanceLayout(slots,{presentation:'mobile'});
  assert.deepEqual(result,{content:null,sections:[{key:'application',label:'审批详情',content:application},{key:'history',label:'审批记录',content:history}],feedback});
  assert.equal(composeApprovalInstanceLayout(slots,{presentation:'desktop'}),slots);
  for(const absent of [false,true,null,undefined]) assert.equal(composeApprovalInstanceLayout({sections:{application,history:absent,feedback}},{presentation:'mobile'}).sections.length,1);
  assert.equal('opinion' in result,false);assert.equal('actions' in result,false);
});

const fixture=JSON.parse(readFileSync(new URL('../skills/make-app-approval/scripts/fixtures/form-metadata.json',import.meta.url),'utf8'));
for(const key of ['response','taskResponse','instanceResponse']) test(`${key} 读取夹具使用本次内嵌元数据，缺失或定位冲突不回退`, () => {
  const envelope=fixture[key];assert.equal(envelope?.code,200,`缺少 ${key} 成功夹具`);
  const data=envelope.data;
  const expected={appKey:fixture.expected.appKey,entityKey:fixture.expected.entityKey,
    processKey:key==='response'?data.processKey:data.bpmKey,
    ...(key==='response'?{nodeKey:data.startNodeKey}:{}),
  };
  const result=normalizeBpmFormMetadata(data.formMetadata,expected);
  assert.ok(result.fields.some(field => field.key==='amount'));
  assert.throws(() => normalizeBpmFormMetadata(undefined,expected));
  assert.throws(() => normalizeBpmFormMetadata({...data.formMetadata,processKey:'other'},expected));
  if(key==='taskResponse') assert.notEqual(data.taskDefinitionKey,result.nodeKey,'退回重提使用实际表单节点');
  if(key==='instanceResponse') {assert.equal('taskId' in data,false);assert.deepEqual(data.currentTasks,[]);assert.equal('editPermission' in data.fieldPermission,false);}
});
