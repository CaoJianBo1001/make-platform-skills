#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] ?? path.join(scriptDir, '..'));

const read = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  assert.ok(
    fs.existsSync(filePath),
    `Expected ${relativePath} under repo root ${repoRoot}`,
  );
  return fs.readFileSync(filePath, 'utf8');
};

const section = (document, heading) => {
  const start = document.indexOf(heading);
  assert.notEqual(start, -1, `Expected section ${heading}`);
  const next = document.indexOf('\n## ', start + heading.length);
  return document.slice(start, next === -1 ? document.length : next);
};

const skill = read('skills/canvas-table-integration/SKILL.md');
const virtual = read(
  'skills/canvas-table-integration/references/virtual-table-patterns.md',
);
const coreApi = read(
  'skills/canvas-table-integration/references/core-props-methods-events.md',
);
const commonPitfalls = read(
  'skills/canvas-table-integration/references/common-pitfalls.md',
);
const trackWorkflows = read(
  'skills/canvas-table-integration/references/track-workflows.md',
);
const validated = read(
  'skills/canvas-table-integration/references/validated-usage-notes.md',
);
const canvasAgentMetadata = read(
  'skills/canvas-table-integration/agents/openai.yaml',
);
const serviceSkill = read('skills/make-app-service/SKILL.md');
const serviceContracts = read(
  'skills/make-app-service/references/service-api-contracts.md',
);
const serviceTesting = read(
  'skills/make-app-service/references/testing-and-safety.md',
);
const publicContract = section(
  virtual,
  '## 2. Confirm the installed public contract',
);
const bootstrapContract = section(virtual, '## 3. Bootstrap and page contract');
const loaderLifecycle = section(virtual, '## 4. Required loader lifecycle');
const largeDataScheduler = section(virtual, '## 5. Large-data scheduler');
const contextChanges = section(
  virtual,
  '## 7. Context changes and stale rows',
);
const cancellationBoundaries = section(
  virtual,
  '## 8. Cancellation across boundaries',
);

assert.match(
  canvasAgentMetadata,
  /short_description:\s*"[^"]*(virtual|large-data|scroll|虚拟|滚动)[^"]*"/i,
  'the CanvasTable UI metadata must expose virtual-loading capability instead of only schema display',
);
assert.match(
  canvasAgentMetadata,
  /default_prompt:\s*"[^"]*\$canvas-table-integration[^"]*(virtual|large-data|scroll|虚拟|滚动)[^"]*"/i,
  'the CanvasTable default prompt must include a representative virtual-loading task',
);

assert.match(
  skill,
  /(large data|large-data|大数据|快速滚动|拖拽滚动条)[\s\S]*(virtual-table-patterns\.md)/i,
  'the skill entry must route large-data or fast-scroll virtual loading to the dedicated reference',
);
assert.match(
  skill,
  /(AbortSignal|request cancellation|请求取消)[\s\S]*make-app-service/i,
  'the canvas skill must hand Service-side cancellation propagation to make-app-service',
);
assert.match(
  serviceSkill,
  /(request cancellation|AbortSignal|请求取消)[\s\S]*service-api-contracts\.md/i,
  'make-app-service must route request cancellation work to a concrete reference',
);
assert.match(
  serviceContracts,
  /## Request cancellation[\s\S]*AbortController[\s\S]*AbortSignal[\s\S]*(downstream|Make adapter|fetch)/i,
  'the Service contract must propagate a request-scoped abort signal to downstream work',
);
assert.match(
  serviceContracts,
  /(disconnect|closed|断开|断连)[\s\S]*(AbortError)[\s\S]*(cleanup|remove|清理|移除)/i,
  'the Service contract must define disconnect handling, expected AbortError behavior, and listener cleanup',
);
assert.match(
  serviceContracts,
  /(normal completion|completed response|正常响应|正常完成)[\s\S]*(must not|do not|不得|不能)[\s\S]*(abort|中止)/i,
  'normal Service response completion must not abort the downstream request signal',
);
assert.match(
  serviceContracts,
  /(writableEnded|headersSent|response finished|res\.writableEnded|completed flag|完成标记)/i,
  'Service cancellation guidance must include a concrete completion guard such as res.writableEnded or a framework equivalent',
);
assert.match(
  serviceTesting,
  /(normal completion|completed response|正常响应|正常完成)[\s\S]*(does not|must not|不会|不得)[\s\S]*(abort|中止)/i,
  'Service tests must cover that normal completion does not abort downstream work',
);

for (const publicApi of [
  'runVirtualPageLoad',
  'markPageLoadFailed',
  'getPagesInView',
  'maxCachedRows',
  'setVirtualPageData',
  'IVirtualPageRequestContext',
]) {
  assert.match(
    virtual,
    new RegExp(publicApi),
    `virtual loading guidance must cover the documented public API ${publicApi}`,
  );
}

assert.match(
  publicContract,
  /(identity-aware|request identity|请求身份)[\s\S]*(legacy|older|旧版|兼容)/i,
  'the public-contract section must select identity-aware or legacy loading from installed package docs',
);
assert.doesNotMatch(
  publicContract,
  /data:load\(page,\s*request\)`?\s+or\s+`?IVirtualPageRequestContext/i,
  'identity-aware selection must require a coherent request contract rather than any single request-related symbol',
);
assert.match(
  publicContract,
  /runVirtualPageLoad[\s\S]*(unavailable|missing|不可用|缺少)[\s\S]*request\.useRequestIdentity\(\)/i,
  'an identity-aware host that cannot use the helper must synchronously call the documented request claim method',
);
assert.match(
  publicContract,
  /(markPageLoadFailed|maxCachedRows|getPagesInView)[\s\S]*(unavailable|missing|缺少|不可用)[\s\S]*(upgrade|stop|blocker|升级|停止|阻塞)/i,
  'missing high-volume safety APIs must trigger an upgrade or blocker instead of an invented host equivalent',
);
assert.doesNotMatch(
  bootstrapContract,
  /async function loadTablePage[\s\S]*await[\s\S]*table\.setData/i,
  'bootstrap/page translation examples must not show an await before committing rows without an already-claimed request lifecycle',
);
assert.match(
  loaderLifecycle,
  /data:load[\s\S]*\(page,\s*request\)/i,
  'the preferred loader must receive the package request context',
);
assert.match(
  loaderLifecycle,
  /runVirtualPageLoad\([\s\S]*async\s*\(loadPage,\s*activeRequest\)[\s\S]*request\s*,?\s*\)/i,
  'the preferred loader must pass the emitted request through runVirtualPageLoad',
);
assert.match(
  loaderLifecycle,
  /setData\(rows,\s*loadPage,\s*activeRequest\)/i,
  'identity-aware success must return the matching request to setData',
);
assert.match(
  loaderLifecycle,
  /markPageLoadFailed\(failedPage,\s*failedRequest\)/i,
  'identity-aware failure must return the matching request to markPageLoadFailed',
);
assert.match(
  loaderLifecycle,
  /(out[- ]of[- ]range|越界)[\s\S]*(do not|must not|不得|禁止)[\s\S]*(backend|network|后端|网络)[\s\S]*markPageLoadFailed\(page,\s*request\)/i,
  'an identity-aware out-of-range request must skip network work and explicitly release its own marker',
);
assert.match(
  loaderLifecycle,
  /\.catch\([\s\S]*(AbortError|isAbortError|signal\.aborted)[\s\S]*(return|ignore|忽略)[\s\S]*logPageLoadFailure/i,
  'the preferred loader example must filter expected aborts before logging a page-load failure',
);
assert.match(
  loaderLifecycle,
  /setVirtualPageData\([\s\S]*(latest|authoritative|最新|权威)[\s\S]*(total|总数)/i,
  'responses with a latest total must use the package atomic virtual-page commit when documented',
);
assert.match(
  cancellationBoundaries,
  /(activeRequest|package request|表格请求)[\s\S]*signal[\s\S]*(scheduler|host|调度器|宿主)[\s\S]*signal[\s\S]*(AbortSignal\.any|compose|combine|组合|合并)/i,
  'the network request must abort from either the package request or the host scheduler signal',
);
assert.match(
  contextChanges,
  /clearData\(\)[\s\S]*(boundary|边界)[\s\S]*(begin|start|before|开始|之前)[\s\S]*(next generation|fresh request|bootstrap|新代次|新请求|重新引导)/i,
  'full table clearing must be the boundary that starts the fresh generation before a request is claimed',
);
assert.match(
  contextChanges,
  /(do not|never|不得|禁止)[\s\S]*clearData\(\)[\s\S]*(claimed|active|已认领|当前)[\s\S]*(request|请求)/i,
  'an identity-aware response must not clear data and then reuse the invalidated request',
);
assert.match(
  contextChanges,
  /clearData\(\)[\s\S]*(data:load|load event|加载事件)[\s\S]*(sole|single|only|唯一)[\s\S]*(bootstrap|引导|首屏)/i,
  'a clear-triggered fresh load must be the sole bootstrap instead of racing a second manual request',
);
assert.match(
  contextChanges,
  /(reset gate|context-reset gate|重置门控)[\s\S]*(markPageLoadFailed|release|释放)[\s\S]*(same|matching|对应|同一)[\s\S]*(request|请求)/i,
  'requests emitted while repositioning under the reset gate must be released with their own identity',
);

assert.match(
  virtual,
  /(same[- ]page|同一页|同页)[\s\S]*(pending|loading|进行中)[\s\S]*(dedup|去重|不得重复|不重复)/i,
  'virtual loading must deduplicate an already pending page request',
);
assert.match(
  virtual,
  /(fail|failure|cancel|失败|取消)[\s\S]*markPageLoadFailed/i,
  'failed or cancelled page loads must release the CanvasTable pending marker',
);
assert.match(
  virtual,
  /(fast scroll|scrollbar drag|快速滚动|拖拽滚动条)[\s\S]*(debounce|coalesce|合并窗口|收敛)[\s\S]*(before|先于|之前)[\s\S]*(request|network|请求|网络)/i,
  'fast scrollbar movement must coalesce target pages before starting network requests',
);
assert.match(
  virtual,
  /(concurren|并发)[\s\S]*(bounded|limit|上限|限制)[\s\S]*(2|two|可调|configurable)/i,
  'large-data loading must use a bounded, configurable concurrency limit with a documented baseline',
);
assert.match(
  virtual,
  /getPagesInView[\s\S]*(anchor|当前页|锚点页|触发页)[\s\S]*(prefetch|邻页|预取|radius)/i,
  'the desired page set must combine viewport pages, the anchor page, and bounded neighbor prefetch',
);
assert.match(
  largeDataScheduler,
  /(speculative|neighbor|邻页|预取)[\s\S]*(host cache|宿主缓存)[\s\S]*(do not|must not|不得|禁止)[\s\S]*(setData|setVirtualPageData)[\s\S]*(matching|own|对应|自己的)[\s\S]*data:load/i,
  'speculative pages without their own request identity must stay in host cache until the matching data:load event arrives',
);
assert.match(
  largeDataScheduler,
  /(generation|request identity|代次|请求身份)[\s\S]*(aborted|stale|已中止|过期)[\s\S]*(do not|must not|不得|禁止)[\s\S]*(reuse|dedup|attach|复用|去重|挂接)/i,
  'a new request generation must not attach to an aborted or stale same-page scheduler job',
);
assert.match(
  virtual,
  /((queued|队列|排队)[\s\S]*(stale|过期|不再需要)[\s\S]*(cancel|取消|移除)|(cancel|取消|移除)[\s\S]*(stale|过期|不再需要)[\s\S]*(queued|队列|排队))/i,
  'stale queued page requests must be cancelled',
);
assert.match(
  virtual,
  /((in-flight|进行中|已发出)[\s\S]*(stale|过期|不再需要)[\s\S]*AbortController|Abort[\s\S]*(stale|过期|不再需要)[\s\S]*(in-flight|进行中|已发出)[\s\S]*AbortController)/i,
  'stale in-flight page requests must be aborted with AbortController when supported',
);
assert.match(
  virtual,
  /AbortSignal[\s\S]*(Service|服务端|server)[\s\S]*(downstream|下游|DataAPI|fetch)/i,
  'request cancellation must propagate across the browser, service, and downstream fetch boundary',
);
assert.match(
  virtual,
  /make-app-service[\s\S]*(owns|负责|归属)[\s\S]*(Service|服务端|server)[\s\S]*(downstream|下游|DataAPI|fetch)/i,
  'the virtual loading reference must preserve the canvas-host versus Service implementation boundary',
);
assert.match(
  virtual,
  /(host cache|宿主缓存)[\s\S]*(maxCachedRows)[\s\S]*(same order|同一数量级|aligned|对齐)/i,
  'host and CanvasTable virtual caches must remain bounded at the same order of magnitude',
);
assert.match(
  virtual,
  /((farthest|最远)[\s\S]*(evict|淘汰)|(evict|淘汰)[\s\S]*(farthest|最远))[\s\S]*(reload|重新请求|重新加载)/i,
  'cache eviction must prefer pages farthest from the active viewport and allow later reloads',
);
assert.match(
  virtual,
  /(out[- ]of[- ]range|越界|总页数之外)[\s\S]*(do not|不得|不应|禁止)[\s\S]*(backend|后端|network|网络)[\s\S]*markPageLoadFailed/i,
  'known out-of-range pages must skip backend calls and release the pending marker',
);
assert.match(
  virtual,
  /(count endpoint|count 接口|first page|第一页)[\s\S]*(totalRowCount|总数)[\s\S]*(before|之前|再)[\s\S]*(enable|启用|create|创建)/i,
  'totalRowCount may come from a count endpoint or the first page but must be known before virtual mode starts',
);
assert.match(
  virtual,
  /(background|silent|滚动页|后台页)[\s\S]*setData\(rows, page(?:, request)?\)[\s\S]*((React state|页面级状态|父级状态)[\s\S]*(avoid|不要|避免|不得)|(avoid|不要|避免|不得)[\s\S]*(React state|页面级状态|父级状态))/i,
  'background scroll pages must write directly to CanvasTable without page-level React state churn',
);
assert.match(
  virtual,
  /(context|上下文|对象|筛选|排序)[\s\S]*(change|切换|变化)[\s\S]*(abort|取消)[\s\S]*(queue|队列)[\s\S]*(cache|缓存)[\s\S]*(scroll|滚动)/i,
  'query context changes must abort requests and reset queues, caches, and scroll state',
);
assert.match(
  contextChanges,
  /(short|不足一页|少于)[\s\S]*(identity-aware|request identity|请求身份)[\s\S]*(setVirtualPageData|setData)[\s\S]*(not|不得|不要|禁止)[\s\S]*clearData/i,
  'short-page handling must preserve request identity instead of clearing the active generation',
);
assert.match(
  coreApi,
  /setData\(data,\s*page\?,\s*request\?\)/,
  'core API reference must expose the request-aware setData signature for current virtual loading contracts',
);
assert.match(
  coreApi,
  /identity-aware[\s\S]*setData\(rows,\s*page,\s*request\)[\s\S]*legacy[\s\S]*setData\(rows,\s*page\)/i,
  'core API reference must distinguish current identity-aware virtual updates from legacy page-only updates',
);
assert.match(
  commonPitfalls,
  /identity-aware[\s\S]*setData\(rows,\s*page,\s*request\)[\s\S]*legacy[\s\S]*setData\(rows,\s*page\)/i,
  'common pitfalls must not give unqualified legacy page-only guidance for virtual mode',
);
assert.match(
  trackWorkflows,
  /virtual paged updates[\s\S]*identity-aware[\s\S]*setData\(rows,\s*page,\s*request\)[\s\S]*legacy[\s\S]*setData\(rows,\s*page\)/i,
  'track workflow checklist must document identity-aware virtual updates before legacy page-only updates',
);
assert.deepEqual(
  [
    ['core-props-methods-events.md', coreApi],
    ['common-pitfalls.md', commonPitfalls],
    ['track-workflows.md', trackWorkflows],
  ]
    .filter(([, text]) =>
      /virtual mode, always call `setData\(rows,\s*page\)`|virtual paged updates via `setData\(rows,\s*page\)`|virtual mode:\s*`setData\(rows,\s*page\)`/i.test(
        text,
      ),
    )
    .map(([fileName]) => fileName),
  [],
  'directly routed canvas references must not retain unqualified legacy page-only virtual loading guidance',
);
assert.match(
  virtual,
  /(120\s*ms)[\s\S]*(2[^\n]*(并发|concurrent)|(并发|concurrent)[^\n]*2)[\s\S]*(radius|半径)[^\n]*1[\s\S]*(30[^\n]*(页|pages))/i,
  'the reference must preserve the proven tunable baseline for debounce, concurrency, prefetch, and cache size',
);
assert.match(
  virtual,
  /(configurable|可配置|可调)[\s\S]*(not|不是|不得|不应)[\s\S]*(magic|硬编码|固定值|强制值)/i,
  'proven tuning values must remain configurable recommendations rather than universal magic constants',
);
assert.match(
  validated,
  /(large data|large-data|high-volume|大数据|高数据量)[\s\S]*(coalesc|合并|收敛)[\s\S]*(concurren|并发)[\s\S]*(stale|过期)[\s\S]*(abort|cancel|取消)/i,
  'validated usage notes must record the proven high-volume scheduler pattern without naming a downstream project',
);
assert.match(
  validated,
  /(legacy|page-only|旧版|仅页码)[\s\S]*(identity-aware|request identity|请求身份)[\s\S]*(not yet|尚未|未在)[\s\S]*(downstream|下游)/i,
  'validated usage notes must not overstate downstream validation of the identity-aware package contract',
);

console.log('canvas table virtual loading contract passed');
