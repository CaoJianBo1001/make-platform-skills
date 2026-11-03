// 仅识别同步 React 组件导出形态；普通工具函数仍须单独按 function 检查。
export const isReactComponentExport = (component, ancestors = []) => {
  if (typeof component === 'function') return true;
  if (component?.$$typeof === Symbol.for('react.forward_ref')) {
    return typeof component.render === 'function';
  }
  return component?.$$typeof === Symbol.for('react.memo')
    && !ancestors.includes(component)
    && isReactComponentExport(component.type, [...ancestors, component]);
};
