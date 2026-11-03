import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeSignals } from './permission-runtime-signals.mjs';

const provider = `
export const useAccess = () => useContext(AccessContext);
export const trim = (schema, access) => ({ ...schema, entities: schema.entities.filter(entity => canUseEntityOperation(access, entity.key, "meta.entity.read")) });
function PermissionProvider() {
 const [generation, setGeneration] = useState(0);
 const key = scope + generation;
 useEffect(() => {
  loadPermission().then(async raw => {
   const access = normalizeAccess(raw);
   const schema = await getSchema({refresh:true});
   setState({key,value:{access,schema:trim(schema,access),generation}});
  });
 }, [key]);
 const value = state.key === key && state.value ? {...state.value,refresh:()=>setGeneration(n=>n+1)} : null;
 if (!value) return <Spin />;
 return <AccessContext.Provider value={value}><div key={key}>{children}</div></AccessContext.Provider>;
}`;
const page = `
const access = useAccess();
const permits = (entity, operation) => canUseEntityOperation(access, entity, operation);
const readable = permits(entityKey, "data.record.read") && permits(entityKey,"meta.entity.read");
const {rows,loading} = useRecords(entityKey, filter, Boolean(entity) && readable);
const displayRows = useMemo(() => rows.map(formatRow), [rows]);
if (access && (!readable || !entity)) return <AppShell resourceDenied><Alert /></AppShell>;
return <RecordTable rows={displayRows} />;`;
const hook = `export const useRecords = (entityKey, filter, enabled = true) => {
 const [state,setState] = useState({rows:[]});
 useEffect(() => { if (!enabled) {setState({rows:[],total:0});return;} loadRows(); return () => controller.abort(); }, [enabled]);
 const current = enabled && state.entityKey === entityKey;
 return {rows: current ? state.rows : []};
};`;
const nav = `const access = useAccess();
const navigation = access ? entries.filter(item => access.schema.entities.some(entity => entity.key === item.entityKey)) : entries;
return <Menu>{navigation.map(item => <Menu.Item key={item.entityKey} />)}</Menu>;`;
const all = [provider, page, hook, nav];
test('generation context, schema navigation and query hook accept arbitrary identifiers', () => {
 assert.deepEqual(runtimeSignals(all), {refresh:true, route:true, navigation:true, rows:true});
 assert.deepEqual(runtimeSignals(all.map(s=>s.replaceAll('readable','allowed').replaceAll('useRecords','useInvoices').replaceAll('generation','revision').replaceAll('setGeneration','setRevision'))), runtimeSignals(all));
});
for (const dependencies of ['[key, show, clear]', '[show, key, clear]', '[show, clear, key]', '[\n show, key, clear,\n]', '[show, key, callbacks.clear]']) {
 test(`refresh effect accepts its generation key among dependencies: ${dependencies}`, () => {
  assert.deepEqual(runtimeSignals([provider.replace('[key]', dependencies), page, hook, nav]), runtimeSignals(all));
 });
}
for (const dependencies of ['[]', '[show, clear]', '[keyExtra, show]', '["key", show]', '[state.key, show]', '[ready && key]']) {
 test(`refresh effect requires an exact generation dependency: ${dependencies}`, () => {
  assert.equal(runtimeSignals([provider.replace('[key]', dependencies)]).refresh, false);
 });
}
test('another effect with the key cannot lend its dependency to the refresh effect', () => {
 const input = provider.replace('[key]', '[show, clear]').replace('const value =', 'useEffect(() => { show(); }, [key]); const value =');
 assert.equal(runtimeSignals([input]).refresh, false);
});
test('additional dependencies do not excuse stale state or a missing Schema refresh', () => {
 for (const [before,after] of [['await getSchema({refresh:true})','cachedSchema'], ['state.key === key && state.value','state.value']]) {
  assert.equal(runtimeSignals([provider.replace('[key]', '[show, key, clear]').replace(before,after)]).refresh, false);
 }
});
for (const [name,index,before,after,key] of [
 ['no schema reload',0,'await getSchema({refresh:true})','cachedSchema','refresh'],
 ['stale context published',0,'state.key === key && state.value','state.value','refresh'],
 ['refresh without generation',0,'setGeneration(n=>n+1)','reloadRecords()','refresh'],
 ['unfiltered schema',0,'schema.entities.filter(entity => canUseEntityOperation(access, entity.key, "meta.entity.read"))','schema.entities','navigation'],
 ['unfiltered menu',3,'navigation.map','entries.map','navigation'],
 ['unrelated context',3,'useAccess()','useOtherContext()','navigation'],
 ['missing route permission',1,',"meta.entity.read"',',"data.record.read"','route'],
 ['guard unrelated to read',1,'!readable','!otherFlag','route'],
 ['query always enabled',1,'Boolean(entity) && readable','true','rows'],
 ['old rows retained',2,'rows: current ? state.rows : []','rows: state.rows','rows'],
 ['state not cleared',2,'setState({rows:[],total:0})','setLoading(false)','rows'],
 ['hook not used',1,'useRecords(entityKey','useOtherRecords(entityKey','rows'],
 ['unrelated row source',1,'rows={displayRows}','rows={cachedRows}','rows'],
]) test(name, () => {
 const input = [...all]; input[index] = input[index].replace(before,after);
 assert.notEqual(input[index],all[index]); assert.equal(runtimeSignals(input)[key],false);
});
test('commented signals never count',()=>assert.deepEqual(runtimeSignals(all.map(s=>`/*${s}*/`)),{refresh:false,route:false,navigation:false,rows:false}));

for (const [name,index,before,after,key] of [
 ['either permission is insufficient',1,'&& permits(entityKey,"meta.entity.read")','|| permits(entityKey,"meta.entity.read")','route'],
 ['either permission cannot enable rows',1,'&& permits(entityKey,"meta.entity.read")','|| permits(entityKey,"meta.entity.read")','rows'],
 ['permission wrapper cannot always allow',1,'=> canUseEntityOperation(access, entity, operation)','=> true || canUseEntityOperation(access, entity, operation)','route'],
 ['navigation predicate cannot always allow',0,'canUseEntityOperation(access, entity.key, "meta.entity.read"))','(canUseEntityOperation(access, entity.key, "meta.entity.read") || true))','navigation'],
 ['navigation predicate cannot invert permission',0,'=> canUseEntityOperation(access, entity.key','=> !canUseEntityOperation(access, entity.key','navigation'],
 ['query cannot use OR true',1,'Boolean(entity) && readable','true || readable','rows'],
 ['query cannot use nested fallback',1,'Boolean(entity) && readable','Boolean(entity) && (readable || cached)','rows'],
 ['query cannot invert permission',1,'Boolean(entity) && readable','!readable','rows'],
 ['query cannot use optional permission',1,'Boolean(entity) && readable','readable ? true : cached','rows'],
 ['permission as another argument is insufficient',1,'filter, Boolean(entity) && readable','readable, true','rows'],
 ['denial cannot depend on extra false guard',1,'(!readable || !entity)','(!readable && false)','route'],
 ['row return cannot use OR fallback',2,'enabled && state.entityKey === entityKey','enabled || state.entityKey === entityKey','rows'],
 ['consumer cannot bypass filtered schema',3,'entity.key === item.entityKey)','entity.key === item.entityKey) || true','navigation'],
]) test(name, () => {
 const input = [...all]; input[index] = input[index].replace(before,after);
 assert.notEqual(input[index],all[index]); assert.equal(runtimeSignals(input)[key],false);
});
test('conjunctions, redundant parentheses and guarded alternatives remain valid', () => {
 const input = [...all];
 input[1] = page.replace('Boolean(entity) && readable','((readable && ready) || (readable && cached))');
 assert.equal(runtimeSignals(input).rows,true);
});
