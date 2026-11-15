// 静态证据检查：只豁免公共类型约束下的共享 Agent 原始响应桥。
// 未识别的等价控制流仍需人工核查；此检查不替代字节流/取消/认证行为测试。
export function auditRawMakeFetches(ts, files) {
  const program = ts.createProgram(files, {
    allowJs: true,
    noResolve: true,
    noLib: true,
    jsx: ts.JsxEmit.Preserve,
  });
  const checker = program.getTypeChecker();
  const hits = [];
  const symbol = (node) =>
    node &&
    (ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node));
  const unshadowed = (node) => !symbol(node)?.declarations?.length;
  const unwrap = (node) => {
    while (
      node &&
      (ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression?.(node))
    )
      node = node.expression;
    return node;
  };
  const walk = (node, visit) => {
    visit(node);
    ts.forEachChild(node, (child) => walk(child, visit));
  };
  const property = (node, name) =>
    !!node && ts.isPropertyAccessExpression(node) && node.name.text === name;
  const member = (node, object, name) =>
    property(node, name) && symbol(node.expression) === symbol(object);
  const aliasRoot = (node, seen = new Set()) => {
    node = unwrap(node);
    while (
      node &&
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node))
    )
      node = unwrap(node.expression);
    if (!node || !ts.isIdentifier(node)) return;
    const binding = symbol(node);
    if (!binding || seen.has(binding)) return binding;
    const declaration = binding.declarations?.find(ts.isVariableDeclaration);
    const initializer = unwrap(declaration?.initializer);
    return declaration &&
      declaration.parent.flags & ts.NodeFlags.Const &&
      initializer &&
      ts.isIdentifier(initializer)
      ? aliasRoot(initializer, new Set([...seen, binding]))
      : binding;
  };
  const mutated = new Set();
  for (const source of program.getSourceFiles())
    walk(source, (node) => {
      const target =
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
          ? node.left
          : ts.isDeleteExpression(node)
            ? node.expression
            : undefined;
      if (
        target &&
        (ts.isPropertyAccessExpression(target) ||
          ts.isElementAccessExpression(target))
      )
        mutated.add(aliasRoot(target));
    });
  const literal = (node, seen = new Set()) => {
    node = unwrap(node);
    if (!node) return;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isIdentifier(node)) {
      const binding = symbol(node);
      if (!binding || seen.has(binding)) return;
      seen.add(binding);
      const declaration = binding.declarations?.find(ts.isVariableDeclaration);
      if (declaration && declaration.parent.flags & ts.NodeFlags.Const)
        return literal(declaration.initializer, seen);
    }
  };
  const hasExport = (node) =>
    node?.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const derived = (node, object, name, seen = new Set()) => {
    node = unwrap(node);
    if (!node) return false;
    if (member(node, object, name)) return true;
    if (ts.isIdentifier(node)) {
      const binding = symbol(node);
      if (!binding || seen.has(binding)) return false;
      seen.add(binding);
      const declaration = binding.declarations?.find(ts.isVariableDeclaration);
      return (
        !!declaration &&
        !!(declaration.parent.flags & ts.NodeFlags.Const) &&
        derived(declaration.initializer, object, name, seen)
      );
    }
    if (ts.isAwaitExpression(node))
      return derived(node.expression, object, name, seen);
    if (ts.isPropertyAccessExpression(node))
      return derived(node.expression, object, name, seen);
    if (ts.isObjectLiteralExpression(node))
      return node.properties.some(
        (p) =>
          ts.isSpreadAssignment(p) &&
          derived(p.expression, object, name, new Set(seen))
      );
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      if (
        property(node.expression, 'stringify') &&
        node.expression.expression.getText() === 'JSON'
      )
        return false;
      return (node.arguments ?? []).some((argument) =>
        derived(argument, object, name, new Set(seen))
      );
    }
    return false;
  };
  const origin = (node) =>
    property(node, 'origin') &&
    ((ts.isIdentifier(node.expression) &&
      node.expression.text === 'location' &&
      unshadowed(node.expression)) ||
      (property(node.expression, 'location') &&
        ts.isIdentifier(node.expression.expression) &&
        ['window', 'globalThis'].includes(node.expression.expression.text) &&
        unshadowed(node.expression.expression)));
  const globalName = (node, name) =>
    (ts.isIdentifier(node) && node.text === name && unshadowed(node)) ||
    (property(node, name) &&
      ts.isIdentifier(node.expression) &&
      ['window', 'globalThis'].includes(node.expression.text) &&
      unshadowed(node.expression));
  // 只求值有静态证据的目标；不能解析的动态路径交给调用方报告复核。
  const requestTarget = (node, seen = new Set()) => {
    node = unwrap(node);
    if (!node) return;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isIdentifier(node)) {
      const binding = symbol(node);
      if (!binding || seen.has(binding) || mutated.has(aliasRoot(node))) return;
      const declaration = binding.declarations?.find(ts.isVariableDeclaration);
      if (declaration && declaration.parent.flags & ts.NodeFlags.Const)
        return requestTarget(
          declaration.initializer,
          new Set([...seen, binding])
        );
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = requestTarget(node.left, new Set(seen));
      const right = requestTarget(node.right, new Set(seen));
      if (left !== undefined && right !== undefined) return left + right;
    }
    if (property(node, 'href') || property(node, 'url'))
      return requestTarget(node.expression, seen);
    if (ts.isCallExpression(node)) {
      if (globalName(node.expression, 'String') && node.arguments.length === 1)
        return requestTarget(node.arguments[0], seen);
      if (property(node.expression, 'toString') && node.arguments.length === 0)
        return requestTarget(node.expression.expression, seen);
    }
    if (!ts.isNewExpression(node)) return;
    if (globalName(node.expression, 'Request'))
      return requestTarget(node.arguments?.[0], seen);
    if (!globalName(node.expression, 'URL')) return;
    const input = requestTarget(node.arguments?.[0], new Set(seen));
    if (input === undefined) return;
    const sameOriginBase = origin(node.arguments?.[1]);
    const base = sameOriginBase
      ? 'https://audit.invalid/'
      : requestTarget(node.arguments?.[1], new Set(seen));
    try {
      const address = new URL(input, base);
      // 只有已证明使用浏览器 origin 且输入没有覆盖 origin，才保留同源证据。
      if (
        sameOriginBase &&
        !/^(?:[A-Za-z][\w+.-]*:|[\\/]{2})/.test(input) &&
        address.origin === 'https://audit.invalid'
      )
        return address.pathname + address.search + address.hash;
      return address.href;
    } catch {
      return;
    }
  };
  const makeScope = (value) => {
    if (value === undefined || !/^(?:\/|[A-Za-z][\w+.-]*:)/.test(value)) return;
    try {
      return /^\/api\/make(?:\/|$)/.test(
        new URL(value, 'https://audit.invalid/').pathname
      );
    } catch {
      return;
    }
  };
  const fieldValues = (object) =>
    new Map(
      object.properties.flatMap((p) => {
        if (ts.isShorthandPropertyAssignment(p)) return [[p.name.text, p.name]];
        if (ts.isPropertyAssignment(p))
          return [
            [p.name.getText().replace(/^['"]|['"]$/g, ''), p.initializer],
          ];
        return [];
      })
    );

  for (const source of program.getSourceFiles()) {
    const types = new Map();
    let hasJsx = false;
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        statement.moduleSpecifier.text !==
          '@qfei-design/make-ai-assistant/agent'
      )
        continue;
      const imports = statement.importClause?.namedBindings;
      if (imports && ts.isNamespaceImport(imports))
        types.set(symbol(imports.name), '*');
      else if (imports)
        for (const item of imports.elements) {
          if (
            (item.propertyName ?? item.name).text ===
            'AgentAuthenticatedTransport'
          )
            types.set(symbol(item.name), 'AgentAuthenticatedTransport');
        }
    }
    walk(source, (node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
        hasJsx = true;
    });
    const transportType = (node) => {
      if (!node || !ts.isTypeReferenceNode(node)) return false;
      const name = node.typeName;
      return ts.isIdentifier(name)
        ? types.get(symbol(name)) === 'AgentAuthenticatedTransport'
        : ts.isQualifiedName(name) &&
            types.get(symbol(name.left)) === '*' &&
            name.right.text === 'AgentAuthenticatedTransport';
    };
    function bridgeFor(call) {
      let method = call.parent;
      while (method && !ts.isFunctionLike(method)) method = method.parent;
      if (
        !method ||
        !ts.isMethodDeclaration(method) ||
        method.name?.getText(source) !== 'request' ||
        !ts.isObjectLiteralExpression(method.parent) ||
        hasJsx
      )
        return;
      const object = method.parent;
      let parent = object.parent;
      while (
        parent &&
        (ts.isParenthesizedExpression(parent) ||
          ts.isAsExpression(parent) ||
          ts.isSatisfiesExpression?.(parent))
      )
        parent = parent.parent;
      const retry = object.properties.find(
        (p) => p.name?.getText(source) === 'retryOwner'
      );
      if (
        !retry ||
        !ts.isPropertyAssignment(retry) ||
        !['sdk', 'transport'].includes(literal(retry.initializer))
      )
        return;
      let typed = false,
        exported = false;
      if (ts.isVariableDeclaration(parent)) {
        typed = transportType(parent.type) || transportType(object.parent.type);
        exported = hasExport(parent.parent.parent);
      } else if (ts.isReturnStatement(parent)) {
        let factory = parent.parent;
        while (factory && !ts.isFunctionLike(factory)) factory = factory.parent;
        typed = transportType(factory?.type);
        exported =
          hasExport(factory) ||
          (ts.isVariableDeclaration(factory?.parent) &&
            hasExport(factory.parent.parent.parent));
      }
      if (
        !typed ||
        !exported ||
        method.parameters.length < 2 ||
        method.parameters.some((p) => !ts.isIdentifier(p.name))
      )
        return;
      return {
        method,
        request: method.parameters[0].name,
        options: method.parameters[1].name,
      };
    }
    function guardedURL(call, bridge) {
      let argument = unwrap(call.arguments[0]);
      if (property(argument, 'href')) argument = argument.expression;
      if (!ts.isIdentifier(argument)) return false;
      if (mutated.has(aliasRoot(argument))) return false;
      const declaration = symbol(argument)?.declarations?.find(
        ts.isVariableDeclaration
      );
      const initializer = unwrap(declaration?.initializer);
      if (
        !declaration ||
        !(declaration.parent.flags & ts.NodeFlags.Const) ||
        !initializer ||
        !ts.isNewExpression(initializer) ||
        !ts.isIdentifier(initializer.expression) ||
        initializer.expression.text !== 'URL' ||
        symbol(initializer.expression) ||
        !member(initializer.arguments?.[0], bridge.request, 'path') ||
        !origin(initializer.arguments?.[1])
      )
        return false;
      const originCheck = (node) =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind ===
          ts.SyntaxKind.ExclamationEqualsEqualsToken &&
        member(node.left, argument, 'origin') &&
        origin(node.right);
      const pathCheck = (node) =>
        ts.isPrefixUnaryExpression(node) &&
        node.operator === ts.SyntaxKind.ExclamationToken &&
        ts.isCallExpression(node.operand) &&
        property(node.operand.expression, 'startsWith') &&
        member(node.operand.expression.expression, argument, 'pathname') &&
        literal(node.operand.arguments[0]) === '/api/make/app/agent/v1/';
      return bridge.method.body.statements.some((statement) => {
        if (
          !ts.isIfStatement(statement) ||
          statement.end > call.pos ||
          statement.elseStatement
        )
          return false;
        const condition = unwrap(statement.expression);
        if (
          !ts.isBinaryExpression(condition) ||
          condition.operatorToken.kind !== ts.SyntaxKind.BarBarToken ||
          !(
            (originCheck(condition.left) && pathCheck(condition.right)) ||
            (pathCheck(condition.left) && originCheck(condition.right))
          )
        )
          return false;
        const statements = ts.isBlock(statement.thenStatement)
          ? statement.thenStatement.statements
          : [statement.thenStatement];
        return statements.length === 1 && ts.isThrowStatement(statements[0]);
      });
    }
    const scopedLiteral = (value) => {
      if (!value?.startsWith('/api/make/app/agent/v1/')) return false;
      const parsed = new URL(value, 'https://fixture.invalid');
      return (
        parsed.origin === 'https://fixture.invalid' &&
        parsed.pathname.startsWith('/api/make/app/agent/v1/') &&
        !/%(?:2e|2f|5c)/i.test(parsed.pathname)
      );
    };
    function rawResponse(call, bridge) {
      const init = unwrap(call.arguments[1]);
      if (
        !init ||
        !ts.isObjectLiteralExpression(init) ||
        init.properties.some(ts.isSpreadAssignment)
      )
        return false;
      const options = fieldValues(init);
      if (
        literal(options.get('credentials')) !== 'include' ||
        literal(options.get('redirect')) !== 'manual' ||
        !derived(options.get('signal'), bridge.options, 'signal') ||
        !member(options.get('method'), bridge.request, 'method') ||
        !['headers', 'body'].every((name) =>
          derived(options.get(name), bridge.request, name)
        )
      )
        return false;
      let declaration = call.parent;
      if (ts.isAwaitExpression(declaration)) declaration = declaration.parent;
      if (
        !ts.isVariableDeclaration(declaration) ||
        !ts.isIdentifier(declaration.name)
      )
        return false;
      const response = declaration.name;
      let valid = false,
        parsed = false;
      walk(bridge.method.body, (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          symbol(node.expression.expression) === symbol(response) &&
          ['json', 'text', 'blob', 'arrayBuffer', 'formData'].includes(
            node.expression.name.text
          )
        )
          parsed = true;
        if (
          !ts.isReturnStatement(node) ||
          !node.expression ||
          !ts.isObjectLiteralExpression(unwrap(node.expression))
        )
          return;
        const returned = unwrap(node.expression);
        if (returned.properties.some(ts.isSpreadAssignment)) return;
        const fields = fieldValues(returned);
        let body = false;
        if (fields.has('body'))
          walk(fields.get('body'), (child) => {
            if (member(child, response, 'body')) body = true;
          });
        if (
          member(fields.get('status'), response, 'status') &&
          derived(fields.get('headers'), response, 'headers') &&
          body
        )
          valid = true;
      });
      return valid && !parsed;
    }
    walk(source, (node) => {
      if (!ts.isCallExpression(node)) return;
      const callee = node.expression;
      const fetch =
        (ts.isIdentifier(callee) &&
          callee.text === 'fetch' &&
          unshadowed(callee)) ||
        (property(callee, 'fetch') &&
          ts.isIdentifier(callee.expression) &&
          ['window', 'globalThis'].includes(callee.expression.text) &&
          unshadowed(callee.expression));
      if (!fetch) return;
      const value = requestTarget(node.arguments[0]);
      const bridge = bridgeFor(node);
      if (!bridge) {
        const scope = makeScope(value);
        if (scope === false) return;
        if (scope === undefined) {
          hits.push({
            file: source.fileName,
            url: '<unresolved request target>',
            reason: 'raw_fetch_scope_unproven',
            review: true,
          });
          return;
        }
      }
      if (
        bridge &&
        (value !== undefined
          ? scopedLiteral(value)
          : guardedURL(node, bridge)) &&
        rawResponse(node, bridge)
      )
        return;
      hits.push({
        file: source.fileName,
        url: value ?? '<dynamic Agent path>',
        reason: bridge ? 'agent_bridge_unproven' : 'raw_make_fetch',
      });
    });
  }
  return hits;
}
