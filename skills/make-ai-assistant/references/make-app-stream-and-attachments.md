# Make App v1 stream and file/image transfer

## SDK-owned response stream

The public Client uses Fetch and `AsyncIterable<Uint8Array>` for SSE. A host
provides the authenticated raw-byte transport and AbortSignal propagation; it
does **not** provide `EventSource`, a parser or a reconnect loop for Make App
v1. `client.responses.subscribe` and the `/make-app` adapter own event parsing,
bounded retry, deduplication, snapshot recovery and history reconciliation.

The supported `response.*` events include `subscribed`, `state`, output item
added, text delta, item done, reset, snapshot and completed/failed/cancelled
terminal events. Incremental text appends; a snapshot replaces the matching
response state. Unknown optional events are not permission to execute actions.
Only non-empty persistent event IDs can advance resume. The SDK treats an
unconfirmed stream failure using its snapshot/history recovery; the host must
not replay a send with a new `messageId` or mix a stale stream into a new
chat/identity. A drawer close or local iterator close is not remote
cancellation; explicit stop uses `client.responses.cancel` through the package
transport. `cancelRequested` can precede the terminal state.

## Upload, media reference and download

The package Client and React attachment flow own the sequence: stable `fileId` → start upload → split by
server-returned `partSize` → `putPart` with raw bytes and stable zero-based
`:part` index → complete → ready `contentRef` → message `parts`. It can resume
confirmed parts and retry an individual failed part with the same bytes. Do
not hard-code part sizing or recreate this sequence in a host callback. A host
must preserve binary request/response bodies and avoid JSON-unwrapping content.

For A13/A14/A16 test fixtures, the v1 `Upload` response requires `id`,
`status`, `name`, `contentType`, `sizeBytes`, `partSize` and `completedParts`.
An `uploading` response additionally requires `expiresAt`; a `ready` response
requires `content` with `kind: "reference"`, `contentRef`, `sizeBytes` and
`digestSha256`. These are conditional backend schema requirements even if an
individual public TypeScript property is optional. A fixture missing them can
correctly fail the package decoder with `AI_PROTOCOL_ERROR`; do not diagnose
that as a Service upload failure.

The composer presents one package-owned “上传文件或图片” entry when its negotiated
`attachments.upload` feature and required transport methods are present. If
`attachments.read` is absent, there is no download entry. The host must not
add a second hidden file input or split file/image into competing menus.

`modelInputKinds` comes from the Agent's current capabilities. It describes
what the model is reported to accept, independently from upload/storage
capability. A host may narrow the displayed list for a documented product or
security policy; broadening or claiming model support requires deployed-model
validation. Do not globally prescribe a text-only override.
Uploading a file/image successfully is not proof that the model interpreted
it. A valid media message can be accepted with HTTP 202 and later terminate
with `response.failed` and top-level snapshot `code/message` carrying
`AI_UNSUPPORTED_MEDIA`; report the terminal run failure
separately from transport completion. Do not turn it into an upload failure,
silently discard the attachment or retry a terminal model error.

The UI offers a generic file/image picker, not a client-side MIME capability
catalog. An unsupported upload MIME is a pre-acceptance 415 /
`AI_UNSUPPORTED_MEDIA` at A13; an input kind recognized by v1 but unavailable
for the selected Agent can be a 422 / `AI_UNSUPPORTED_INPUT` at A08. A 202
means only message acceptance, not model understanding. Service validation
must follow the backend v1 contract rather than silently rejecting valid
InputPart kinds. Do not force client-side MIME conversion or infer support
merely from file extension.

The Client validates the media tuple and reference shape; the package composer
sends only locally ready content references with returned size/digest. The
server remains authoritative for ready state, ownership and expiry, and can
reject a stale or foreign reference. Do not claim the Client alone detects an
expired upload. Apply server-advertised limits before large allocations, retain
safe progress/error state, and avoid logging bytes or private file content.
Abort and identity changes stop local work; explicit cancel is a separate
remote operation.
