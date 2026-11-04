import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAdministratorFeedback } from './administrator-feedback-audit.mjs';

const imported = "import { MakeAppPermissionNotice } from '@qfei-design/make-app-observability/react';";
const check = source => auditAdministratorFeedback([{ file: 'Feedback.tsx', source }]);

test('the reported bare notice is a failure, not a package integration pass', () => {
  const result = check(`${imported}\nexport const Forbidden = () => <MakeAppPermissionNotice scope="resource" />;`);
  assert.equal(result.detected, true);
  assert.match(result.failures.join('\n'), /administrator_feedback_contacts_missing.*Feedback\.tsx/u);
});

test('unrelated query keywords cannot hide a missing presentation binding', () => {
  const result = check(`${imported}\nconst unused = auth.getAppAdministrators();
    export const Forbidden = () => <MakeAppPermissionNotice />;`);
  assert.equal(result.failures.length, 1);
});

test('an alias is checked using the public component import, not a host component name', () => {
  const result = check("import { MakeAppPermissionNotice as Notice } from '@qfei-design/make-app-observability/react';\nconst Forbidden = () => <Notice />;");
  assert.equal(result.detected, true);
  assert.equal(result.failures.length, 1);
});

test('namespace imports are checked without requiring a particular host name', () => {
  const result = check("import * as Feedback from '@qfei-design/make-app-observability/react';\nconst Forbidden = () => <Feedback.MakeAppPermissionNotice />;");
  assert.equal(result.detected, true);
  assert.equal(result.failures.length, 1);
});

test('an unconditional empty list cannot implement either embedded or queried contacts', () => {
  const result = check(`${imported}\nconst Forbidden = () => <MakeAppPermissionNotice administrators={[]} />;`);
  assert.match(result.failures.join('\n'), /administrator_feedback_contacts_always_empty/u);
});

for (const props of ['administrators={contacts}', '{...help}', 'administrators={embedded ?? []}', 'administrators={contacts.filter(item => item.name.length > 0)}']) {
  test(`a dynamic binding still requires behavioral evidence: ${props}`, () => {
    const result = check(`${imported}\nconst Forbidden = () => <MakeAppPermissionNotice ${props} />;`);
    assert.equal(result.detected, true);
    assert.deepEqual(result.failures, []);
  });
}

test('comments and source strings cannot fabricate a component import or render', () => {
  const result = check(`// ${imported}\nconst guide = ${JSON.stringify(`${imported}<MakeAppPermissionNotice />`)};`);
  assert.equal(result.detected, false);
  assert.deepEqual(result.failures, []);
});

test('a different package component with the same local name is not affected', () => {
  assert.equal(check("import { MakeAppPermissionNotice } from './custom'; const view = <MakeAppPermissionNotice />;").detected, false);
});

test('an earlier unrelated import does not become an observability import', () => {
  assert.equal(check("import { MakeAppPermissionNotice } from './custom'\nimport { MakeAppErrorNotice } from '@qfei-design/make-app-observability/react'\nconst view = <MakeAppPermissionNotice />;").detected, false);
});

test('emoji before the import do not shift source offsets', () => {
  assert.equal(check(`const title = '🔒';\n${imported}\nconst view = <MakeAppPermissionNotice />;`).failures.length, 1);
});

test('comments inside a real import cannot bypass the feedback gate', () => {
  const result = check("import { MakeAppPermissionNotice, /* existing error outlet */ MakeAppErrorNotice } from '@qfei-design/make-app-observability/react'; const view = <MakeAppPermissionNotice />;");
  assert.equal(result.detected, true);
  assert.equal(result.failures.length, 1);
});

test('type-only imports do not require a runtime feedback harness', () => {
  assert.equal(check("import type { MakeAppPermissionNotice } from '@qfei-design/make-app-observability/react';").detected, false);
  assert.equal(check("import { type MakeAppPermissionNotice } from '@qfei-design/make-app-observability/react';").detected, false);
});

test('only error notices from a namespace do not opt into the permission contact contract', () => {
  assert.equal(check("import * as Feedback from '@qfei-design/make-app-observability/react'; const view = <Feedback.MakeAppErrorNotice />;").detected, false);
});

test('re-exported components and non-JSX factories still require the host contract', () => {
  assert.equal(check("export { MakeAppPermissionNotice as Notice } from '@qfei-design/make-app-observability/react';").detected, true);
  const result = check(`${imported}\nconst view = React.createElement(MakeAppPermissionNotice, help);`);
  assert.equal(result.detected, true);
  assert.deepEqual(result.failures, []);
});

for (const call of ['auth.getAppAdministrators()', 'auth.getAppAdministrators(optionalUrl)', 'auth.getAdministrators()']) {
  test(`the source gate does not prescribe lookup arguments or URL shape: ${call}`, () => {
    const result = check(`${imported}\nconst load = () => ${call};\nconst view = <MakeAppPermissionNotice administrators={contacts} />;`);
    assert.deepEqual(result.failures, []);
    assert.equal(result.detected, true);
  });
}
