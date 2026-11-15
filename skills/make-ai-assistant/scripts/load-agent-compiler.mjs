import { loadTypeScriptCompiler } from './load-typescript-compiler.mjs';

const auditFunctions =
  `forEachChild isArrayBindingPattern isArrayLiteralExpression
isAsExpression isBinaryExpression isBindingElement isCallExpression isExportDeclaration
isExternalModuleReference isForInStatement isForOfStatement isIdentifier
isImportDeclaration isImportEqualsDeclaration isImportTypeNode isJsxOpeningElement
isJsxSelfClosingElement isLiteralTypeNode isNamedExports isNamedImports isNamespaceImport
isNonNullExpression isObjectBindingPattern isObjectLiteralExpression isParameter
isParenthesizedExpression isPostfixUnaryExpression isPrefixUnaryExpression
isPropertyAccessExpression isPropertyAssignment isShorthandPropertyAssignment
isSpreadAssignment isSpreadElement isStringLiteral isStringLiteralLike
isTemplateExpression isTypeAssertionExpression isVariableDeclaration
isVariableDeclarationList`.split(/\s+/);

export function loadAgentCompiler(
  workspace,
  { purpose = 'audit', compilerWorkspace, requireImpl } = {},
) {
  const functions = [
    'createProgram',
    'createSourceFile',
    ...(purpose === 'example'
      ? [
          'createCompilerHost',
          'getPreEmitDiagnostics',
          'flattenDiagnosticMessageText',
        ]
      : auditFunctions),
  ];
  const enums =
    purpose === 'example'
      ? [
          'ScriptTarget.ES2022',
          'ModuleKind.ESNext',
          'ModuleResolutionKind.Bundler',
          'JsxEmit.ReactJSX',
        ]
      : [
          'ScriptTarget.Latest',
          'JsxEmit.Preserve',
          'SyntaxKind.FirstAssignment',
          'SyntaxKind.LastAssignment',
          'SyntaxKind.EqualsToken',
          'SyntaxKind.PlusPlusToken',
          'SyntaxKind.MinusMinusToken',
        ];
  return loadTypeScriptCompiler(workspace, {
    requiredFunctions: functions,
    requiredEnums: enums,
    compilerWorkspace,
    requireImpl,
  });
}
