# Permission feedback package

Read this for React App startup, route/data or operation denial presentation. Permission scope belongs to `make-app-permission`; identity and current-App administrator lookup belong to `make-app-auth`. The shared observability package owns presentation and Toast timing/hiding, not navigation, authorization, HTTP, form state or the host queue.

## Install and release gate

- Use `MakeAppPermissionNotice` from `@qfei-design/make-app-observability/react`; do not add a separate feedback dependency. New or explicitly upgraded feedback integrations use the `0.1.10` lifecycle baseline; after verifying it in the intended registry, install with `corepack pnpm add @qfei-design/make-app-observability@^0.1.10` in the resolved UI package, or the host package manager's equivalent. Do not change the host runtime or introduce a second lockfile. Preserve untouched legacy Apps and their existing lockfiles; a new npm release does not update an existing lockfile or deployed bundle. An explicit dependency/lockfile upgrade, tests and redeployment are required.
- A planned release, source version or local tarball is **not proof of registry publication**. Verify the actual selected `0.1.10+` registry artifact before declaring automatic Toast dismissal available. If packaged prose still says an API is unreleased, resolve availability from the verified registry artifact and its actual public exports/types, not stale release wording. Without a registry-resolvable version exposing this API, report a package release blocker rather than silently installing an old version. Only an explicitly approved local test may install a supplied tarball; do not commit a developer-specific tarball path or use Git/source copying as a release fallback.
- Verify the actual installed artifact, including public JS, TypeScript and CSS entries, rather than trusting a version string or template. Use the script below; `--allow-prerelease` is reserved for that explicit local-test opt-in and never proves publication.

The package/Skill may be used before the administrator backend is deployed. Package availability is required; administrator-query availability is not. Render generic authorization guidance without blocking the App when the SDK method is missing or the endpoint is absent. Follow `make-app-auth/references/access-help.md#staggered-release-fallback` for lookup errors; this does not relax login, IAM or Schema checks.

From this Skill's actual installation directory, pass the absolute path of the target App's installed package:

```sh
node scripts/verify-feedback-package-surface.mjs "<installed-package-root>"
# Explicitly approved local alpha test only:
node scripts/verify-feedback-package-surface.mjs "<installed-package-root>" --allow-prerelease
```

The verifier uses the host's installed React and `react-dom/server`. It checks exports and representative rendered states, not route authorization, mounted layout, browser interaction or live IAM. Keep portable host verification project-local or versioned; do not reference a developer's global Skill directory in CI.

权限提示、错误提示和提示容器分别校验公开 ESM/CJS React 导出，使用与移动组件相同的函数、forwardRef、memo 及嵌套包装识别规则。缺失或无效导出仍失败；`normalizeMakeAppPermissionNotice` 是普通工具函数，必须保持可调用函数，不接受组件包装代替。

```tsx
import { MakeAppPermissionNotice } from '@qfei-design/make-app-observability/react';
import '@qfei-design/make-app-observability/styles.css';
```

Import the CSS once in the host UI entry, shared with the existing error card. Do not recreate the package's administrator/avatar/buttons/styles in each page or globally override its internals. Theme through the documented `--make-app-permission-primary`, `--make-app-permission-primary-hover`, `--make-app-permission-text` and `--make-app-permission-muted` variables on the component root. Keep host desktop/mobile navigation and error outlets outside this component. It never supplies the demo's scene switcher, App brand, sidebar, account area, business table, form or test timers.

## Public props

| Prop | Contract |
| --- | --- |
| `variant` | `toast`, `inline` (default), or `page`; presentation, not permission scope |
| `scope` | `app`, `resource` (default), or `operation`; host decides the denial range |
| `operationName` | Optional action label for Toast titles such as `导出` |
| `administrators` | Validated readonly `{ userId, name, avatarUrl? }[]`; direct user contacts only |
| `administratorStatus` | `ready`, `loading`, `error`; default `ready` |
| `retryStatus` | `idle`, `checking`, `denied`, `error`, `restored`; host-controlled |
| `onRetry`, `onClose` | Host callbacks; retry appears only for inline/page, close only for Toast; absent callbacks produce no fabricated buttons |
| `duration` | Toast seconds; default viewport value or 3; 0 is persistent; ignored for permission inline/page |
| `noticeKey` | Unique host event id; changes for every new notification, including identical content; ordinary rerenders retain it |
| `title`, `description` | Optional business-appropriate text; successful state uses the recovery title |
| `illustration` | Optional ReactNode; undefined uses the icon, null omits it |
| `className`, `style` | Host container/theme handoff, never a new permission engine |

There is no npm `showForbidden`, `useAppAdministrators` or automatic 403 interception export. `onReturn` and `onSwitchAccount` remain host navigation/account controls, not props of this npm component. React uses this package through one host-owned adapter. Keep existing non-React DOM helpers compatible; do not migrate a non-React App solely for this presentation package.

```tsx
// No authorized App entry: outside the business shell.
<AppPermissionFeedback {...help} variant="page" scope="app" onRetry={refreshAccess} />
// Denied route/read: replaces the authorized shell's entire business content slot.
<AppPermissionFeedback {...help} variant="inline" scope="resource" onRetry={refreshAccess} />
// Rejected save: inside the existing form, preserving permitted input.
<AppPermissionFeedback {...help} variant="inline" scope="operation" onRetry={refreshAccess} />
// Short operation feedback: existing persistent outlet owns queue and dismissal.
<MakeAppErrorNoticeViewport>
  <AppPermissionFeedback {...help} key={notice.id} noticeKey={notice.id}
    variant="toast" scope="operation" operationName="导出" onClose={() => dismissNotice(notice.id)} />
</MakeAppErrorNoticeViewport>
```

`help`, `notice`, callbacks and `AppPermissionFeedback` above are host-owned. Import `MakeAppErrorNoticeViewport` from the same `/react` entry when used; reuse the existing outlet rather than nesting or duplicating it. The package owns timing and hiding; the host owns queue deduplication, action context and removal of the matching item in `onClose`. Do not add a second host timer. Allocate `notice.id` once per event and pass it as both React key and `noticeKey`, including for ordinary `MakeAppErrorNotice`; this prevents unrelated rerenders or newly created callback references from extending the lifetime. A same-text new event gets a new id. Administrator loading itself must not reset the timer. Use the public `duration` prop for an intentional lifetime override. Select inline or Toast for one rejection rather than duplicating both messages.

When explicitly migrating existing feedback, follow [error outlet migration](../../make-app-observability/references/error-outlet-migration.md): operation Toasts reuse the root outlet, including Toasts produced through host adapters. Do not retain a page-local floating message container for packaged error or permission cards. Keep intentional inline/page guidance persistent and local validation in its existing surface.

## Toast 生命周期

统一遵循 [Toast 默认关闭与宿主接线](../../make-app-observability/references/package-integration.md#toast-默认关闭与宿主接线)。不能仅凭 `0.1.9` 版本号认定已支持自动关闭；先核对目标发布产物的公开文档、类型和挂载行为，新 API 尚未发布时报告发布阻断。

支持该合同的包默认 3 秒关闭权限 Toast，`duration` 单位为秒，0 常驻；权限 inline/page 始终常驻。宿主不重复设置计时器，通过 onClose 删除对应队列项；每次通知使用新的稳定 noticeKey，普通重渲染保持不变，重复触发同文案也重新计时。宿主适配器须转发 duration/noticeKey/onClose，不另建计时链路或因关闭重放业务操作。这两项属性仅在已确认支持的产物上使用；既有包表面校验器不证明计时能力，仍须按 observability 的行为验收要求验证。

## Host contact adapter example

The following `AppPermissionFeedback` is **App-owned example code**, not another npm export. `auth` is the established SDK instance; `contextKey` comes from the host's verified identity/tenant/App/environment generation, not browser token parsing. Keep the denial payload in event state rather than rebuilding it on every render. Validate contact response items in the host API boundary before using this typed example.

```tsx
import { useEffect, useState } from 'react';
import { MakeAppPermissionNotice, type MakeAppAdministratorContact, type MakeAppAdministratorStatus, type MakeAppPermissionNoticeProps } from '@qfei-design/make-app-observability/react';

type SDKAdministratorContact = Omit<MakeAppAdministratorContact, 'avatarUrl'> & { avatarUrl?: string | null };
type AdministratorApi = { api: unknown; getAppAdministrators?: () => Promise<SDKAdministratorContact[]> };
type DenialPayload = { data?: { appAdministrators?: MakeAppAdministratorContact[] } };
type Props = Omit<MakeAppPermissionNoticeProps, 'administrators' | 'administratorStatus'> & {
  auth: AdministratorApi; contextKey: string; payload?: DenialPayload;
};
type Help = { auth: AdministratorApi; contextKey: string; payload?: DenialPayload;
  contacts: MakeAppAdministratorContact[]; status: MakeAppAdministratorStatus };

export function AppPermissionFeedback({ auth, contextKey, payload, ...view }: Props) {
  const embedded = payload?.data?.appAdministrators;
  const [help, setHelp] = useState<Help>();
  useEffect(() => {
    const query = auth.getAppAdministrators;
    if (Array.isArray(embedded) || typeof query !== 'function') return;
    let active = true;
    const snapshot = { auth, contextKey, payload };
    setHelp({ ...snapshot, contacts: [], status: 'loading' });
    Promise.resolve().then(() => query.call(auth)).then(
      contacts => { if (active) setHelp({ ...snapshot, contacts: contacts.map(contact => ({ ...contact, avatarUrl: contact.avatarUrl ?? undefined })), status: 'ready' }); },
      error => {
        // An undeployed optional endpoint is a quiet generic-help fallback.
        const endpointMissing = error !== null && typeof error === 'object' && 'status' in error && error.status === 404;
        if (active) setHelp({ ...snapshot, contacts: [], status: endpointMissing ? 'ready' : 'error' });
      },
    );
    return () => { active = false; };
  }, [auth, contextKey, payload, embedded]);
  const current = help?.auth === auth && help.contextKey === contextKey && help.payload === payload ? help : undefined;
  return <MakeAppPermissionNotice {...view}
    retryStatus={view.retryStatus === 'denied' ? 'idle' : view.retryStatus}
    administrators={Array.isArray(embedded) ? embedded : current?.contacts ?? []}
    administratorStatus={Array.isArray(embedded) ? 'ready' : current?.status ?? (typeof auth.getAppAdministrators === 'function' ? 'loading' : 'ready')}
  />;
}
```

Embedded contacts render immediately; an explicit empty array is authoritative and triggers no query. Missing contacts use `auth.getAppAdministrators()` only when installed and available. SDK lookup has its own deadline and login/logout lifecycle; the host ignores stale responses on unmount or context changes. Missing capability or endpoint keeps generic guidance and does not block App readiness; report independent contact lookup as degraded, not verified. No permanent unsupported-capability cache prevents a later entry from discovering backend rollout. Never query protected records to obtain contacts, query IAM/Console from UI, or invent an SDK version supporting the method.

The `api` member is an existing SDK client member used only for structural type compatibility, never a contact-query fallback. Keep the helper optional so a client compiled against older SDK declarations can pass to this adapter. Verify both old/new SDK types as well as runtime behavior; a JavaScript `typeof` test alone does not prove TypeScript compatibility.

The adapter maps only the displayed retry prop from `denied` to `idle`: keep the
original denial, administrator list and refresh control without adding another
“仍未获得权限，请联系应用管理员授权” below the button. This also works with published
alpha artifacts that still render that duplicate footer. Do not mutate the
actual host access/retry state or override package CSS; pass `checking`, `error`
and `restored` through unchanged. No package upgrade is required for this host
compatibility, and a local component fix is not proof of a new npm release.

## Mounting and recovery

- No authorized App entry: App guard outside the business shell, `variant="page" scope="app"`; no business routes/loaders. A safe identity/brand header is host-owned.
- Any authorized entry: shell outside the object/fixed-page guard; `variant="inline" scope="resource"` replaces the entire business content slot, not a table-body or form-field slot. Keep authorized desktop/mobile navigation and the global identity header; clear object-specific title/breadcrumb/toolbar slots even when their container belongs to the shell. No `100vh` overlay. A host return action targets an actually authorized page, not blind browser back.
- Entity/field metadata allowed but record read denied, including runtime read revocation or classified read 403: use that same whole-content replacement. Unmount the object's business title, toolbar/search, statistics, table/card/form structure, headers, rows and dialogs. Do not retain an empty table or disabled controls. Clear cached records/counts/selections, invalidate old requests and keep denial state above the unmounted page; the npm component must not query/remove arbitrary host DOM. Do not also show no-data artwork or a false zero count. This does not remove metadata-authorized navigation or revoke independent create-only routes.
- Create/save/delete rejected: `variant="inline" scope="operation"` remains in the affected form/operation area, or use `variant="toast" scope="operation"` for a short action rejection. Host preserves permitted draft values and blocks the denied mutation. Read/field revocation still removes unauthorized server data. Toast uses compact administrator names separated by `、`; inline/page use avatar/name chips. Do not inject a hand-built avatar row into the Toast.
- Retry: host sets `checking`, refreshes permission and permission-trimmed Schema in one generation, then resolves the original target. Set `restored` only after that access generation is ready; load data only when authorized. The package never performs this work or replays a mutation. `denied` means explicit permission refusal; network/service failure uses `error`, not a guessed denial.
- Known `permission_denied` uses scoped feedback once while retaining diagnostic Trace handling. Do not duplicate it as a generic network failure card. Preserve the independent error outlet for 401/unknown403/503, permission/Schema load failures and other request errors.

## Required host evidence

Assert mounted navigation/global identity header and the absence of every original business title/toolbar/header/card/form/dialog on resource denial; cover both table and non-table layouts, initial denial and post-load revocation. Also assert zero subsequent denied business requests, record/cache invalidation, ignored late responses without remount loops, preserved allowed input for operation-only refusal, no automatic mutation after recovery, meaningful retry failure, embedded/empty/missing contacts and context-race cancellation. Cover generic page/inline/Toast rendering with no SDK method, an undeployed endpoint and failed/timed-out contact lookup; no help failure may become a global auth/request error. Test the real package after installation and at desktop/mobile widths. A CSS import, SSR verifier or scope attribute alone is not a complete Make App permission acceptance.

With the actual `0.1.10+` package and host queue, test default three-second dismissal, `duration={0}`, persistent inline/page, independent same-text events, no lifetime extension on unrelated rerender or administrator resolution, one matching queue removal on manual/timeout close, and timer cleanup on unmount. Keep these tests in the App's default test command; the legacy-compatible SSR verifier is not a timer test.
