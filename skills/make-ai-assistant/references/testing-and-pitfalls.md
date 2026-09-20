# Testing and delivery gates

## TDD and public-contract checks

Test first: demonstrate a failing behavior/contract, make the minimal fix,
then refactor. Verify the installed exact package version and public `/client`,
`/make-app`, `/react` and `/styles.css` exports. Static audit is only a preflight;
focused executable UI, Service, typecheck, build and published-route checks
remain required.

## Make App v1 matrix

- Discovery: current authenticated App/tenant/user identity; Agent page 1 empty
  with continuation; mixed `channel` and `app_internal`; exactly one matching
  App-internal Agent; zero/multiple, mismatched App, missing/unknown type,
  repeated/absent cursor, abort and retry. Keep launcher visible throughout.
- Adapter: async capabilities fetch; optional feature gates; `retryOwner`
  exactly once; 401 login recovery without loop on permission 403; identity
  switch abort/dispose and no stale chat leakage.
- Service: exact `/api/make/app/ai/v1/**` 18-operation allowlist, method and
  query/body validation, `MAKE_APP_KEY` equality where present, all-write
  same-origin check, strict Gateway origin, local-preview/published path mapping,
  and acceptance of a trusted internal HTTP Gateway origin; no unversioned
  fallback or generic proxy. Cover all 18 operations in executable
  Service route tests; the static audit does not verify route completeness.
- HTTP: bare JSON; 201 chat, 202 message, 204 no-body; required
  `Make-AI-Api-Version` response header; version mismatch failure; SSE and file
  bytes untouched; `X-Request-ID`/retry headers; flat public errors across
  400/401/403/404/409/410/413/415/422/429/5xx without upstream diagnostics.
  A schema-valid unknown code retains its HTTP status and safe message; an
  invalid envelope becomes a safe upstream error. Test unknown code by HTTP
  category rather than a closed code allowlist.
- Chats: independent creation, opaque paginated Agent/chat/history cursors,
  initial history cursor omitted, titlePending refresh, revision conflicts,
  selection, feedback, update/pin/delete where `chat.management` is enabled.
- Stream: real incremental `response.*` deltas, optional unknown event, item
  done, reset, snapshot replacement, non-empty cursor resume, replay
  deduplication, terminal completion/failure/cancel and explicit remote cancel.
  Closing the panel keeps an in-flight run; switching identity cannot apply
  stale events. No native EventSource or host reconnect loop for Make App v1.
- File/image: stable upload/file/message IDs, server-sized parts, byte/digest
  integrity, retry/resume, complete/ready reference, content download only
  when supported, 202 acceptance versus later model interpretation failure.
  A product/security policy may narrow displayed `modelInputKinds`; claiming
  broader model support needs deployed-model evidence. Upload availability
  alone is insufficient.
- UI: package-owned task list, new conversation, plus menu, upload state,
  responsive layout, keyboard/focus behavior and drawer close/reopen. No host
  internal-selector override or duplicated error/composer UI. Safe context is
  not a permission grant.

## Platform Skill release forward test

Before releasing a changed protocol, host integration workflow, or ownership
boundary, run an independent fresh-agent forward test. Prepare an isolated
temporary Make App workspace with an authenticated shell, shared auth adapter,
empty assistant placement, Service skeleton, installed public package, and a
v1 Gateway fixture derived from the current backend OpenAPI, not from this
Skill's route table. It must not contain assistant integration code, another
App's implementation, or this change's proposed solution.

The Gateway fixture must retain operation request/response schemas and the
SSE event schemas from that pinned OpenAPI, including conditional upload
response fields and terminal event shapes. Test representative accepted and
rejected payloads, not just methods, paths and successful statuses. A
route/status-only fixture leaves DTO validation and stream recovery unverified;
record those gaps as release gates instead of calling the synthetic test
end-to-end coverage.

Give the independent evaluator only that workspace, this Skill, and a realistic
request to add the Agent chat with multi-session history, streaming, file/image
input, and Service routes. Do not reveal prior conclusions or direct the
evaluator to a reference POC. No real deployment, production credentials, or
external writes are needed. Inspect the resulting code and executable tests for
public-package imports, full Agent pagination and uniqueness, identity cleanup,
same-origin authenticated byte transport, the exact 18-route Service boundary,
SSE recovery, file/image transfer, and package-owned UI. Run the fixture tests,
typecheck, build, and the Skill's static audit; a static pass alone is not enough.

Record the fixture and backend-contract revisions, resolved package version,
evaluator result, test commands, failures, and corrective follow-up in the
release evidence. If the
evaluator needs another project's code, invents a legacy route, or cannot
complete the integration from this Skill and public package declarations,
release is blocked until the guidance is corrected and a fresh attempt passes.
If independent execution is unavailable, report that gate as unverified rather
than claiming the Skill is release-ready. Ordinary host fixes do not require
this platform-release exercise unless they change the Skill's contract.

## Completion and failure reporting

Run the Skill's audit, relevant host tests, Service tests, typecheck, build and
an existing-route render smoke test. Then verify authenticated published Dev
requests for discovery, capabilities, chat creation, message 202, real SSE,
history, cancellation and a representative file/image transfer where enabled.
Do not call an integration complete solely because tests or upload storage
pass. When the backend/model is not ready, report precisely which boundary
failed instead of adding a mock fallback to production.

If the installed package lacks required public exports/types, the route family
is unknown, or a deployed capability cannot be verified, stop that branch and
report the missing contract. Do not infer behavior from another App, package
source, examples, or an old unversioned endpoint.
Likewise, a skipped complete upload test because the current v1 backend fixture
is missing is an explicit unverified release gate, not a passing end-to-end
attachment result. Keep the skipped count in the release evidence.
