# Session

Explains `session.schema.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## What this schema covers, and what it deliberately does not

`docs/33-DOMAIN-MODEL.md` §1.3 is explicit that Session is "not stored as a row at all
in the common case" — it is a self-verifying, HMAC-signed payload, not a database
record. `session.schema.json` therefore defines two things:

1. **The payload contract** — `patient_id`, `issued_at`, `expires_at`. These three
   fields, and only these three, are what a verified session actually proves.
2. **The wire format** (below) — how the payload and its signature travel together as
   one opaque string a client can hold in `sessionStorage` and send back on every
   request (docs/29 §3).

It does **not** define an algorithm for computing the signature itself. That is a
deliberate boundary, not an omission — see "Why no signing algorithm is ported into a
reference file" below.

## Wire format

```
<base64url(JSON.stringify(payload))>.<base64url(HMAC-SHA256(payload_segment, secret))>
```

- `payload_segment` is the exact base64url-encoded JSON string that appears before the
  `.` — the signature covers those bytes directly, never a re-serialized copy, so
  verification never depends on JSON key ordering being reproduced identically.
- The secret is `FOUNDATION_SESSION_SIGNING_SECRET`, a Script Property never committed
  to this repository (`FoundationConfig.gs`'s `SCRIPT_PROPERTY_KEYS.SESSION_SIGNING_SECRET`
  names the property; the value itself is set only in the Apps Script editor, same
  treatment as `STAFF_ACCESS_CODE`/`OPENROUTER_API_KEY`).
- A token with a `.` count other than exactly one, a payload segment that fails to
  base64url-decode or JSON-parse, or a signature that does not match a fresh
  recomputation over the presented payload segment, is invalid — full stop, no partial
  trust.

## Default session lifetime: 60 minutes

docs/29 §3 specifies a range ("short — 60–90 minutes — no silent renewal"). This
contract locks the concrete default to **3,600 seconds (60 minutes)** — the low end of
that range, per ADR-010 (security decisions take precedence over convenience: a
shorter default session lifetime is the more secure choice, and any exception to that
default would need to be its own deliberate, documented decision, not a silent
convenience trade). `apps-script/FoundationSession.gs`'s `FOUNDATION_SESSION_TTL_SECONDS_`
implements this exact value — see that file if the default ever needs revisiting.

## Why no signing algorithm is ported into a reference file

`shared/utils/core.reference.js` ports small, purely algorithmic helpers (UUID
generation, HTML escaping) as plain, portable JS specifically because their contract
*is* the algorithm — any correct implementation of that algorithm produces byte-
identical output everywhere.

HMAC-SHA256 is different: it is a standard, well-specified cryptographic primitive that
every real runtime already provides natively (Apps Script's
`Utilities.computeHmacSha256Signature`, Node's `crypto.createHmac('sha256', ...)`,
etc.) — the correct engineering choice is to call the runtime's own implementation,
never to hand-rolled-reimplement a cryptographic primitive in portable JS for
"portability" (rolling your own crypto is a well-known anti-pattern, not a style
choice). This is the same "conform to the contract, not necessarily the algorithm"
principle `shared/utils/core.md` already established for `generateId()` vs.
`Utilities.getUuid()`, applied here for a stronger reason: the algorithm genuinely must
not be reimplemented, not merely "doesn't need to be."

What *is* portable, and what this schema's wire-format section above fully specifies,
is everything outside the signature computation itself: the payload shape, the
base64url encoding, the `.`-joined wire format, and the expiry-comparison logic. Those
are implemented, tested, and covered by `apps-script/FoundationSession.gs`'s pure
helper functions (`FoundationTests.gs`); only the actual
`Utilities.computeHmacSha256Signature()` call is Apps-Script-native and untestable
outside that runtime — verified instead by an ad hoc Node pass that mocks the HMAC
primitive with Node's own `crypto` module (a faithful mock of a standard algorithm, the
same "mock the platform API, run the real logic" discipline `validation/phase-1-5/`
and Foundation's own F3 batch already established for `SpreadsheetApp`).

## Relationship to LoginTokens

docs/29 §4 locks a separate `LoginTokens` sheet (`token_hash`, `patient_id`,
`issued_at`, `expires_at`, `used_at`) — the single-use, stored artifact consumed to
*mint* a session in the first place. That sheet, and the magic-link request/consume
flow around it, is **not** part of this schema or Foundation batch F4's scope
(`apps-script/README.md`'s F4 commitment names only `FoundationSession.gs` and
`FoundationRouteGuard.gs`) — a session token can be issued and verified independently
of how it was obtained, and `FoundationSession.gs`'s `foundationIssueSessionToken_()`
takes an already-resolved `patient_id` as its input rather than assuming a particular
login mechanism upstream. `LoginTokens` remains open, tracked in docs/29 §13 (Batch 5B)
and §14, for a later batch.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change to the payload requires a
new version here first, then a subsequent update to
`apps-script/FoundationSession.gs` — never the reverse, per `shared/README.md`.
