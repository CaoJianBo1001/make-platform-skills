// 验证器自身的合成夹具，不随 Skill 分发，不是宿主保存实现或代码生成模板。
export const createFixtureBindingHarness = ({io, withAttachments, initialRecordId, bindingKey, updateKnownRecord}, fault) => {
  let generation = 0;
  let savedRecordId = initialRecordId;
  let writeUnknown = false;
  let busy = false;
  const bindingRequests = new Set();
  const current = captured => fault === 'compare-key-only' || captured === generation;
  const save = (captured, kind) => async () => {
    if (fault === `stale-${kind}-update` && !current(captured) && savedRecordId) {
      await io.write({kind: 'update', recordId: savedRecordId});
    }
    if (fault === 'stale-callback-clears-unknown' && !current(captured)) writeUnknown = false;
    if (updateKnownRecord && current(captured) && savedRecordId && !writeUnknown && !busy) {
      await io.write({kind: 'update', recordId: savedRecordId});
      return;
    }
    if (!current(captured) || writeUnknown || busy || savedRecordId) return;
    busy = true;
    const controller = new AbortController();
    bindingRequests.add(controller);
    try {
      if (withAttachments) for (const field of ['first', 'second']) {
        if (!current(captured)) return;
        await io.upload({field, signal: controller.signal});
        if (fault === 'upload-cancel-marks-unknown' && !current(captured)) writeUnknown = true;
        if (!current(captured)) return;
      }
      if (!current(captured)) return;
      writeUnknown = true;
      const result = await io.write({kind, signal: controller.signal});
      if ((fault === 'drop-late-id' || (fault === 'drop-late-submit-id' && kind === 'submit')) && !current(captured)) return;
      savedRecordId = result.recordId;
      writeUnknown = false;
      if (fault === `late-${kind}-update` && !current(captured)) {
        await io.write({kind: 'update', recordId: savedRecordId});
      }
      if (!current(captured)) return;
    } catch {
      // 写请求断流不能证明未落库；未发写请求时 writeUnknown 仍为 false。
      if (fault === 'submit-unknown-unprotected' && kind === 'submit') writeUnknown = false;
    } finally {
      if (fault === 'finally-clears-unknown') writeUnknown = false;
      busy = false;
      bindingRequests.delete(controller);
    }
  };
  return {
    actions() {
      const captured = generation;
      return {
        save: save(captured, 'create'),
        saveAndSubmit: save(captured, 'submit'),
        withdraw: async () => {
          const controller = new AbortController();
          if (fault === 'withdraw-shares-binding-cancel') bindingRequests.add(controller);
          try { await io.withdraw({signal: controller.signal}); }
          finally { bindingRequests.delete(controller); }
        },
      };
    },
    async refreshBinding() {
      generation++;
      if (fault === 'refresh-changes-key') bindingKey = 'different-flow';
      for (const controller of bindingRequests) controller.abort();
      if (fault === 'refresh-clears-unknown') writeUnknown = false;
    },
    snapshot: () => ({savedRecordId, writeUnknown, bindingKey}),
    flush: async () => {},
    dispose: async () => { for (const controller of bindingRequests) controller.abort(); },
  };
};
