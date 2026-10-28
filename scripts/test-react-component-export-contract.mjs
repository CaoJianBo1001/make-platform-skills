#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

// 两个 Skill 可独立安装，随包识别器必须通过同一行为合同，不能依赖另一个 Skill 的文件。
for (const skill of ['makeui', 'make-ai-assistant']) {
  test(`${skill} recognizes supported synchronous React component export shapes`, async () => {
    const { isReactComponentExport } = await import(`../skills/${skill}/scripts/react-component-contract.mjs`);
    const Component = () => null;
    const forwardRef = Object.freeze({$$typeof:Symbol.for('react.forward_ref'),render:Component});
    const memo = type => Object.freeze({$$typeof:Symbol.for('react.memo'),type});
    for (const valid of [Component, forwardRef, memo(Component), memo(forwardRef), memo(memo(Component))]) {
      assert.equal(isReactComponentExport(valid), true);
    }
    const cycle = {$$typeof:Symbol.for('react.memo')};
    cycle.type = cycle;
    for (const invalid of [null,undefined,{},[],42,'div',Symbol.for('react.memo'),memo({}),memo(null),cycle,{$$typeof:Symbol.for('react.forward_ref'),render:null},{$$typeof:Symbol.for('react.memo-other'),type:Component}]) {
      assert.equal(isReactComponentExport(invalid), false);
    }
  });
}
