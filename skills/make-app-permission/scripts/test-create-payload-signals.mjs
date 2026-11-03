import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditCreatePayloads } from './create-payload-signals.mjs';

const calls = [{name:'saveBusinessRecord',argument:1}];
const filter = 'Object.fromEntries(Object.entries(data).filter(([key]) => creatableFieldKeys.has(key)))';
const source = body => `const creatableFieldKeys = new Set(createFields.map(field => field.key)); async function submit(data) { ${body} }`;
const audit = body => auditCreatePayloads([source(body)],calls);
const pass = result => {assert.equal(result.checked,1);assert.deepEqual(result.failures,[]);assert.deepEqual(result.reviews,[]);};
const fail = result => {assert.equal(result.checked,1);assert.equal(result.failures.length,1);};

test('the configured argument must consume the allowlisted value',()=>pass(audit(`const payload = ${filter}; return saveBusinessRecord(entity, payload, relations);`)));
test('parenthesized inline payload and alias chain are accepted',()=>{
 pass(audit(`return saveBusinessRecord(entity, (${filter}), relations);`));
 pass(audit(`const payload = ${filter}; const input = payload; return saveBusinessRecord(entity, input, relations);`));
});
for (const raw of ['data','values','formValues','draft','{...data}','{...payload,...data}']) test(`unused allowlist cannot protect ${raw}`,()=>fail(audit(`const payload = ${filter}; return saveBusinessRecord(entity, ${raw}, relations);`)));
test('placing a filtered payload at the wrong argument does not count',()=>fail(audit(`const payload = ${filter}; return saveBusinessRecord(payload, data, relations);`)));
test('comments and quoted fake filters cannot protect a mutation',()=>fail(audit(`/* const payload = ${filter}; */ const text = 'const payload = ${filter}'; return saveBusinessRecord(entity,data);`)));
test('filter must actually restrict keys',()=>fail(audit(`const payload = ${filter.replace('creatableFieldKeys.has(key)','creatableFieldKeys.has(key) || true')}; return saveBusinessRecord(entity,payload);`)));
test('reassignment or mutation invalidates the consumed alias',()=>{
 fail(audit(`let payload = ${filter}; payload = data; return saveBusinessRecord(entity,payload);`));
 fail(audit(`const payload = ${filter}; Object.assign(payload,data); return saveBusinessRecord(entity,payload);`));
 fail(audit(`const payload = ${filter}; payload.secret = data.secret; return saveBusinessRecord(entity,payload);`));
 fail(audit(`const payload = ${filter}; const input = payload; payload.secret = data.secret; return saveBusinessRecord(entity,input);`));
 fail(audit(`const payload = ${filter}; const input = payload; input.secret = data.secret; return saveBusinessRecord(entity,payload);`));
});
for (const [name,change] of [
 ['child alias', 'const alias=payload.data; alias.secret=data.secret; function unused(){const alias=payload.data;}'],
 ['shallow copy', 'const copy={...payload,}; copy.data.secret=data.secret;'],
 ['shallow copy with an own property', 'const copy={...payload, trace:"test"}; copy.data.secret=data.secret;'],
 ['computed child alias', 'const alias=payload["data"]; alias["secret"]=data.secret;'],
]) test(`post-filter injection through ${name} cannot pass`,()=>{
 const body=`const payload={data:${filter}}; ${change} return saveBusinessRecord(entity,payload);`;
 const submitted=new Function('data','createFields','entity','saveBusinessRecord',source(body)+'; return submit(data);');
 // The same snippet must really add the unauthorized key, not just resemble a write.
 return submitted({title:'allowed',secret:'injected'},[{key:'title'}],'order',(_entity,payload)=>{
  assert.deepEqual(Object.keys(payload.data),['title','secret']);
  fail(audit(body));
 });
});
for (const mutation of ['creatableFieldKeys.add("secret")', 'creatableFieldKeys?.["add"]("secret")', 'const allowed=creatableFieldKeys; allowed?.["add"]("secret")']) {
 test(`a modified allowlist cannot establish filtering: ${mutation}`,()=>fail(audit(`${mutation}; return saveBusinessRecord(entity,${filter});`)));
}
test('read-only uses, independent copy properties and later allowlist changes remain valid',()=>{
 for (const change of [
  'const alias=payload.data; Object.keys(alias);',
  'const copy={...payload, trace:"test"}; copy.trace="changed";',
  'const copy={...payload}; copy.data={secret:"local-only"};',
  'const alias=payload.data; function unused(){const alias={}; alias.secret="local";}',
  'creatableFieldKeys.add("later");',
 ]) pass(audit(`const payload={data:${filter}}; ${change} return saveBusinessRecord(entity,payload);`));
});
test('a shadowing parameter cannot borrow an outer payload definition',()=>fail(audit(`const payload = ${filter}; function nested(payload) { return saveBusinessRecord(entity,payload); }`)));
test('a guarded block does not shadow the payload',()=>pass(audit(`const payload = ${filter}; if (payload) { return saveBusinessRecord(entity,payload); }`)));
test('another function or file cannot lend an allowlist to the write',()=>{
 fail(audit(`function other() { const payload = ${filter}; return payload; } return saveBusinessRecord(entity,payload);`));
 const result = auditCreatePayloads([source(`const payload = ${filter};`),source('return saveBusinessRecord(entity,payload);')],calls);
 fail(result);
});
test('a local helper must return the filtered value',()=>{
 pass(audit(`function build(input) { return ${filter.replaceAll('data','input')}; } return saveBusinessRecord(entity,build(data));`));
 fail(audit(`function build(input) { const payload = ${filter.replaceAll('data','input')}; return input; } return saveBusinessRecord(entity,build(data));`));
});
const projection = `
 const writableFormFields = fields.filter(field => creatableFieldKeys.has(field.key));
 const project = (values: Values, permitted: Field[]) => {
   return permitted.reduce<Record<string, unknown>>((payload, field) => {
     const value = values[field.key];
     if (value === undefined) return payload;
     payload[field.key] = normalize(field, value);
     return payload;
   }, {});
 };
 const payload = project(data, writableFormFields.filter(field => field.type !== 'File'));
 return saveBusinessRecord(entity,payload);
`;
test('a field-driven reducer consumes the actual filtered field collection',()=>pass(audit(projection)));
test('comparisons and multiline trailing commas are not payload/field mutations',()=>pass(audit(projection
 .replace('const payload = project','if (writableFormFields.length === 0) throw new Error("empty"); const payload = project')
 .replace("writableFormFields.filter(field => field.type !== 'File')", "writableFormFields.filter(\n(field) => field.type !== 'File',\n)"))));
test('a reducer cannot use an unfiltered field list or add arbitrary keys',()=>{
 fail(audit(projection.replace("writableFormFields.filter(field => field.type !== 'File')",'fields')));
 fail(audit(projection.replace('payload[field.key] = normalize(field, value);','payload.secret = values.secret; payload[field.key] = normalize(field, value);')));
 fail(audit(projection.replace('}, {});','}, {...values});')));
 fail(audit(projection.replace('payload[field.key] = normalize(field, value);',"field.key = 'secret'; payload[field.key] = normalize(field, value);")));
 fail(audit(projection.replace('return payload;','return values;')));
});
test('an external transform of filtered fields still requires review',()=>{
 const result = audit(`const writableFormFields = fields.filter(field => creatableFieldKeys.has(field.key)); const payload = ${filter}; const files = await uploadValues(writableFormFields, data); return saveBusinessRecord(entity,{...payload,...files});`);
 assert.deepEqual(result.failures,[]); assert.equal(result.reviews.length,1);
});
test('DTO payload property is checked, including shorthand and aliases',()=>{
 const spec = [{name:'api.create',argument:0,property:'data'}];
 pass(auditCreatePayloads([source(`const data = ${filter.replaceAll('data','values')}; const request = {entity, data}; return api.create(request);`)],spec));
 fail(auditCreatePayloads([source(`const payload = ${filter}; return api.create({entity,data});`)],spec));
});
test('constant branches cannot hide an unused filter',()=>fail(audit(`const payload = true ? data : ${filter}; return saveBusinessRecord(entity,payload);`)));
test('conditional ordinary/approval payloads require explicit review, never unconditional PASS',()=>{
 const result = audit(`const payload = latest.config ? data : ${filter}; return saveBusinessRecord(entity,payload);`);
 assert.equal(result.checked,1); assert.deepEqual(result.failures,[]); assert.equal(result.reviews.length,1);
});
test('all recognized calls must be checked',()=>{
 const result = audit(`const payload = ${filter}; saveBusinessRecord(entity,payload); saveBusinessRecord(entity,data);`);
 assert.equal(result.checked,2); assert.equal(result.failures.length,1);
});
test('a call followed by a standalone block is still a mutation',()=>{
 const result = audit(`saveBusinessRecord(entity,data)\n{}; const payload = ${filter}; saveBusinessRecord(entity,payload);`);
 assert.equal(result.checked,2); assert.equal(result.failures.length,1);
});
test('definitions, comments and strings are not create calls',()=>{
 const result = auditCreatePayloads(['function saveBusinessRecord(a,b) {}', 'const saveBusinessRecord = (a,b) => api.post(b);', '// saveBusinessRecord(entity,data)', 'const s="saveBusinessRecord(entity,data)";', 'const r=/saveBusinessRecord(entity,data)/;'],calls);
 assert.equal(result.checked,0);
});

test('callback payload provenance stays unproved even when prepare contains a filter',()=>{
 for (const input of [filter, 'data']) {
  const body = `saveSession({prepare: () => (${input}), create: payload => saveBusinessRecord(entity,payload)});`;
  assert.doesNotThrow(() => new Function(source(body)));
  fail(audit(body));
 }
});

// A callback binding is distinct from an outer filtered const of the same name.
test('an outer filtered payload cannot lend proof to a shadowing callback parameter',()=>{
 for (const create of ['payload => saveBusinessRecord(entity,payload)', '(payload) => saveBusinessRecord(entity,payload)', 'payload => { return saveBusinessRecord(entity,payload); }']) {
  fail(audit(`const payload = ${filter}; saveSession({prepare: () => data, create: ${create}});`));
 }
});

test('a completed sibling callback does not shadow a later filtered write',()=>{
 for (const sibling of ['const unused = payload => payload;', 'values.map(payload => payload);', 'const unused = payload => { return payload; };']) {
  pass(audit(`const payload = ${filter}; ${sibling} return saveBusinessRecord(entity,payload);`));
 }
});
