import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {createFixtureBindingHarness} from './fixtures/bpm-binding-session-harness.mjs';

const verifierUrl = new URL('../skills/make-app-approval/scripts/verify-bpm-binding-session.mjs', import.meta.url);
const verifier = async () => {
  assert.ok(fs.existsSync(verifierUrl), '缺少可接入宿主真实控制器的随包时序验证器');
  return (await import(verifierUrl.href)).verifyBpmBindingSession;
};

test('绑定时序验证器通过合成控制器夹具，不作为真实 App 验收', async () => {
  const verify = await verifier();
  assert.deepEqual(await verify(options => createFixtureBindingHarness(options)), {passed: 6});
});
test('新会话对已保存记录的合法更新不被当作旧回调写入', async () => {
  const verify = await verifier();
  assert.deepEqual(await verify(options => createFixtureBindingHarness({...options, updateKnownRecord: true})), {passed: 6});
});
for (const [fault, scenario] of [
  ['compare-key-only', 'same-key-refresh'],
  ['drop-late-id', 'late-create-success'],
  ['drop-late-submit-id', 'late-submit-success'],
  ['submit-unknown-unprotected', 'unknown-submit'],
  ['refresh-changes-key', 'same-key-refresh'],
  ['refresh-clears-unknown', 'unknown-create'],
  ['stale-callback-clears-unknown', 'unknown-create'],
  ['finally-clears-unknown', 'unknown-create'],
  ['withdraw-shares-binding-cancel', 'withdraw-refresh'],
  ['late-create-update', 'late-create-success'],
  ['late-submit-update', 'late-submit-success'],
  ['stale-create-update', 'late-create-success'],
  ['stale-submit-update', 'late-submit-success'],
  ['upload-cancel-marks-unknown', 'same-key-refresh'],
]) test(`故障注入应拒绝 ${fault}`, async () => {
  const verify = await verifier();
  await assert.rejects(verify(options => createFixtureBindingHarness(options, fault)), error => {
    assert.ok(error.message.includes(scenario), error.message);
    return true;
  });
});

test('宿主未到达请求边界时有界失败，并清理控制器', async () => {
  const verify = await verifier();
  let disposed = 0;
  await assert.rejects(verify(options => {
    const host = createFixtureBindingHarness(options);
    return {...host, actions: () => ({save() {}, saveAndSubmit() {}, withdraw() {}}),
      dispose: async () => { disposed++; await host.dispose(); }};
  }, {timeoutMs: 10}), /same-key-refresh/);
  assert.equal(disposed, 1);
});

test('初始化超时后迟到的控制器只清理，不读取或执行其操作', async () => {
  const verify = await verifier();
  let completeSetup, options;
  const setup = new Promise(resolve => { completeSetup = resolve; });
  let disposed = 0, actionsRead = 0;
  await assert.rejects(verify(value => {
    options = value;
    return setup;
  }, {timeoutMs: 10}), /same-key-refresh/);
  const host = createFixtureBindingHarness(options);
  completeSetup({...host,
    actions: () => { actionsRead++; return host.actions(); },
    dispose: async () => { disposed++; await host.dispose(); },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(actionsRead, 0, '超时后不得继续验证场景');
  assert.equal(disposed, 1, '迟到的真实控制器仍须卸载，且只卸载一次');
});

test('验证会话超时后拒绝新的测试 I/O', async () => {
  const verify = await verifier();
  let options, disposed = 0;
  await assert.rejects(verify(value => {
    options = value;
    const host = createFixtureBindingHarness(value);
    return {...host, actions: () => ({save() {}, saveAndSubmit() {}, withdraw() {}}),
      dispose: async () => { disposed++; await host.dispose(); }};
  }, {timeoutMs: 10}), /same-key-refresh/);
  for (const resource of ['upload', 'write', 'start', 'withdraw']) {
    await assert.rejects(options.io[resource]({kind: 'create'}), /验证会话已结束/);
  }
  assert.equal(disposed, 1);
});

test('只安装 Skill 后，实际宿主桥接命令可运行且错误实现退出失败', async () => {
  await verifier();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'bpm session host bridge '));
  try {
    const skillDir = path.join(workspace, '.agents', 'skills', 'make-app-approval');
    fs.cpSync(new URL('../skills/make-app-approval/', import.meta.url), skillDir, {recursive: true});
    fs.mkdirSync(path.join(workspace, 'src'));
    fs.copyFileSync(new URL('./fixtures/bpm-binding-session-harness.mjs', import.meta.url), path.join(workspace, 'src', 'controller.mjs'));
    const adapter = path.join(workspace, 'host-adapter.mjs');
    const bridge = fault => `import {createFixtureBindingHarness} from './src/controller.mjs';\nexport const createBpmBindingSessionHarness = options => createFixtureBindingHarness(options, ${JSON.stringify(fault)});\n`;
    const guideFile = path.join(skillDir, 'references/binding-session-verification.md');
    assert.ok(fs.existsSync(guideFile), '缺少随包宿主桥接指南');
    const guide = fs.readFileSync(guideFile, 'utf8');
    const command = [...guide.matchAll(/```bash\n([^`]+)\n```/g)].map(match => match[1].trim()).find(line => line.startsWith('node '));
    assert.ok(command, '指南必须提供安装后可执行的验证命令');
    const documented = command.match(/"[^"]*"|'[^']*'|\S+/g).slice(1)
      .map(token => token.replace(/^(["'])(.*)\1$/, '$2').replaceAll('<skill-dir>', skillDir).replaceAll('<host-adapter-module>', adapter));
    const run = args => spawnSync(process.execPath, [documented[0], ...args], {cwd: workspace, encoding: 'utf8'});
    fs.writeFileSync(adapter, bridge(null));
    const good = spawnSync(process.execPath, documented, {cwd: workspace, encoding: 'utf8'});
    assert.equal(good.status, 0, good.stderr);
    assert.match(good.stdout, /PASS.*6/);
    fs.writeFileSync(adapter, bridge('compare-key-only'));
    const bad = run([adapter]);
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stderr, /same-key-refresh/);
    assert.equal(run([]).status, 2, '没有宿主适配器不能冒充宿主验证通过');
  } finally { fs.rmSync(workspace, {recursive: true, force: true}); }
});
