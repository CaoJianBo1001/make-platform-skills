// 可移植的边界参考；不替代宿主路由、授权、会话生命周期或保存控制器。
export const resolveBpmStandaloneEntity = (entities, requested) =>
  entities.find(entity => entity.key === requested)
  ?? entities.find(entity => entity.name === requested);

// 只用于可取消的附件预上传，不把创建／提交成功后失效的会话误判为未落库。
export const runBpmAttachmentStep = async ({ signal, isCurrent }, upload) => {
  const check = () => {
    signal.throwIfAborted();
    if (!isCurrent()) throw new DOMException('审批表单会话已失效', 'AbortError');
  };
  check();
  const result = await upload(signal);
  check();
  return result;
};
