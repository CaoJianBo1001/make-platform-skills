# Permission feedback package

Read this for React App startup, route/data or operation denial presentation. Permission scope belongs to `make-app-permission`; identity and current-App administrator lookup belong to `make-app-auth`. The shared observability package owns presentation only, not navigation, authorization, HTTP, form state or Toast queue/duration policy.

## Install and release gate

- Use `MakeAppPermissionNotice` from `@qfei-design/make-app-observability/react`; do not add a separate feedback dependency. Install an exact version verified in the intended registry, using the host UI package's existing package manager. Do not change the host runtime or introduce a second lockfile.
- The permission additions are an unreleased API candidate until an actual registry artifact has been verified; a source version or local tarball is **not proof of registry publication**. The Trace-only `0.1.5` baseline does not establish permission component availability. Without a registry-resolvable version exposing this API, report a package release blocker. Only an explicitly approved local test may install a supplied tarball; do not commit a developer-specific tarball path or use Git/source copying as a release fallback.
- Verify the actual installed artifact, including public JS, TypeScript and CSS entries, rather than trusting a version string or template. Use the script below; `--allow-prerelease` is reserved for that explicit local-test opt-in and never proves publication.

```sh
node skills/makeui/scripts/verify-feedback-package-surface.mjs <installed-package-root>
# Explicitly approved local alpha test only:
node skills/makeui/scripts/verify-feedback-package-surface.mjs <installed-package-root> --allow-prerelease
```

The verifier uses the host's installed React and `react-dom/server`. It checks exports and representative rendered states, not route authorization, mounted layout, browser interaction or live IAM. Keep portable host verification project-local or versioned; do not reference a developer's global Skill directory in CI.

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
| `title`, `description` | Optional business-appropriate text; successful state uses the recovery title |
| `illustration` | Optional ReactNode; undefined uses the icon, null omits it |
| `className`, `style` | Host container/theme handoff, never a new permission engine |

There is no npm `showForbidden`, `useAppAdministrators` or automatic 403 interception export. `onReturn` and `onSwitchAccount` remain host navigation/account controls, not props of this npm component. React uses this package through one host-owned adapter. Keep existing non-React DOM helpers compatible; do not migrate a non-React App solely for this presentation package.

```tsx
// No authorized App entry: outside the business shell.
<AppPermissionFeedback {...help} variant="page" scope="app" onRetry={refreshAccess} />
// Denied route/data: inside the authorized shell's content/data slot.
<AppPermissionFeedback {...help} variant="inline" scope="resource" onRetry={refreshAccess} />
// Rejected save: inside the existing form, preserving permitted input.
<AppPermissionFeedback {...help} variant="inline" scope="operation" onRetry={refreshAccess} />
// Short operation feedback: existing persistent outlet owns queue and dismissal.
<MakeAppErrorNoticeViewport>
  <AppPermissionFeedback {...help} variant="toast" scope="operation" operationName="导出" onClose={dismissNotice} />
</MakeAppErrorNoticeViewport>
```

`help`, callbacks and `AppPermissionFeedback` above are host-owned. Import `MakeAppErrorNoticeViewport` from the same `/react` entry when used; reuse the existing outlet rather than nesting or duplicating it. Follow the installed package's public viewport/portal contract, not a copied demo layout. The host owns duration, queue deduplication and action context; the Toast component does not start a timer or portal itself. Select inline or Toast for one rejection rather than duplicating both messages.

## Host contact adapter example

The following `AppPermissionFeedback` is **App-owned example code**, not another npm export. `auth` is the established SDK instance; `contextKey` comes from the host's verified identity/tenant/App/environment generation, not browser token parsing. Keep the denial payload in event state rather than rebuilding it on every render. Validate contact response items in the host API boundary before using this typed example.

```tsx
import { useEffect, useState } from 'react';
import { MakeAppPermissionNotice, type MakeAppAdministratorContact, type MakeAppAdministratorStatus, type MakeAppPermissionNoticeProps } from '@qfei-design/make-app-observability/react';

type AdministratorApi = { getAppAdministrators?: () => Promise<MakeAppAdministratorContact[]> };
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
      contacts => { if (active) setHelp({ ...snapshot, contacts, status: 'ready' }); },
      () => { if (active) setHelp({ ...snapshot, contacts: [], status: 'error' }); },
    );
    return () => { active = false; };
  }, [auth, contextKey, payload, embedded]);
  const current = help?.auth === auth && help.contextKey === contextKey && help.payload === payload ? help : undefined;
  return <MakeAppPermissionNotice {...view}
    administrators={Array.isArray(embedded) ? embedded : current?.contacts ?? []}
    administratorStatus={Array.isArray(embedded) ? 'ready' : current?.status ?? (typeof auth.getAppAdministrators === 'function' ? 'loading' : 'ready')}
  />;
}
```

Embedded contacts render immediately; an explicit empty array is authoritative and triggers no query. Missing contacts use `auth.getAppAdministrators()` only when installed and available. SDK lookup has its own deadline and login/logout lifecycle; the host ignores stale responses on unmount or context changes. Missing capability keeps generic guidance but remains an independent-contact readiness gap. Never query protected records to obtain contacts, query IAM/Console from UI, or invent an SDK version supporting the method.

## Mounting and recovery

- No authorized App entry: App guard outside the business shell, `variant="page" scope="app"`; no business routes/loaders. A safe identity/brand header is host-owned.
- Any authorized entry: shell outside the object/fixed-page guard; `variant="inline" scope="resource"` occupies only the denied content slot. Keep authorized desktop/mobile navigation and user area; no `100vh` overlay. A host return action targets an actually authorized page, not blind browser back.
- Entity/field metadata allowed but record read denied: retain authorized navigation/headers and put `variant="inline" scope="resource"` in the data region. Clear cached rows/counts and disable denied reads; do not also show no-data artwork or a false zero count.
- Create/save/delete rejected: `variant="inline" scope="operation"` remains in the affected form/operation area, or use `variant="toast" scope="operation"` for a short action rejection. Host preserves permitted draft values and blocks the denied mutation. Read/field revocation still removes unauthorized server data. Toast uses compact administrator names separated by `、`; inline/page use avatar/name chips. Do not inject a hand-built avatar row into the Toast.
- Retry: host sets `checking`, refreshes permission and permission-trimmed Schema in one generation, then resolves the original target. Set `restored` only after that access generation is ready; load data only when authorized. The package never performs this work or replays a mutation. `denied` means explicit permission refusal; network/service failure uses `error`, not a guessed denial.
- Known `permission_denied` uses scoped feedback once while retaining diagnostic Trace handling. Do not duplicate it as a generic network failure card. Preserve the independent error outlet for 401/unknown403/503, permission/Schema load failures and other request errors.

## Required host evidence

Assert mounted navigation/header, zero denied business requests, record/cache invalidation, preserved allowed input, no automatic mutation after recovery, meaningful retry failure, embedded/empty/missing contacts and context-race cancellation. Test the real package after installation and at desktop/mobile widths. A CSS import, SSR verifier or scope attribute alone is not a complete Make App permission acceptance.
