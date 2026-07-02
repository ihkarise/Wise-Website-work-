# Response Envelope

Explains `response-envelope.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Why this shape exists

Google Apps Script Web Apps cannot set a real HTTP status code — every `doPost`/`doGet`
response transports as HTTP 200 regardless of what actually happened
(`apps-script/Utils.gs`'s `jsonResponse_()` already documents this for Phase 1.5's
pipeline). A caller must be able to tell success from failure, and get a safe,
consistent shape either way, entirely from the response body. The envelope is that
shape, generalized beyond Phase 1.5's one-off pattern into a contract every Foundation
function returns, per ADR-009 (every module's interface is explicit and narrow) and
ADR-010 (fail safely — a caller should never have to guess what a failure looks like).

## Shape at a glance

```json
// Success
{ "status": "ok", "data": { "...": "..." }, "error": null }

// Failure
{ "status": "error", "data": null, "error": { "code": "FOUNDATION_NOT_FOUND", "message": "We couldn't find that record." } }
```

Both keys (`data` and `error`) are always present — only one is ever non-null,
enforced by the schema's `oneOf`. A caller can safely check `status` first, then read
`data` or `error` without an extra existence check.

## Error `code` vs. `message`

- `code` is for **programs** — stable, machine-readable, safe to branch logic on
  (e.g. a frontend deciding whether to show a "try again" button vs. a "contact us"
  message). Once shipped, a code's meaning must never change — add a new one instead.
- `message` is for **people** — plain language, never a stack trace or raw exception
  text, matching docs/04's Error State component rule ("Friendly. Actionable. Never
  technical."). `apps-script/FoundationErrorHandling.gs`'s catch-all handler always
  supplies a generic, safe message here — the real exception detail, if ever needed for
  debugging, goes to Apps Script's execution log, never to the caller.

## How Apps Script implements this

`apps-script/FoundationContracts.gs` provides two builders —
`buildFoundationOkEnvelope_(data)` and `buildFoundationErrorEnvelope_(code, message)` —
so no call site constructs the object shape by hand. `FoundationErrorHandling.gs`'s
`withFoundationErrorHandling_()` wraps a function call and guarantees one of these two
builders is what a caller ultimately receives, even if the wrapped function throws.

## Versioning

This is version `1.0.0`. A breaking change (removing a required field, changing a
type, changing what a `status` value means) requires a new major version and a
`shared/`-first update, per `shared/README.md`'s rule — implementations are updated
only after `shared/` changes, never before, never in the same step for anything but a
contract's first creation.
