# Core Utilities

Explains `core.reference.js` (version `1.0.0`, the authoritative definition — this file
explains, it does not define, per `shared/README.md`'s format rule).

## `generateId()`

**Contract:** returns a 36-character, lowercase, hyphenated RFC 4122 v4 UUID string.

**Apps Script adaptation note — conform to the contract, not the algorithm.** The
reference implementation generates a v4 UUID from `Math.random()`, which is enough to
demonstrate the exact output shape in portable JS. Apps Script provides a native,
better-suited primitive — `Utilities.getUuid()` — that already satisfies this contract.
`apps-script/FoundationUtils.gs`'s `generateFoundationId_()` calls `Utilities.getUuid()`
directly rather than porting the reference algorithm. This is the concrete case
`shared/README.md` means by "implementations conform to the contract" — the *shape* of
what comes out must match; the *method* of producing it is free to use whatever the
runtime does best.

## `nowIso()`

**Contract:** returns the current instant as an ISO 8601 string, UTC, millisecond
precision (e.g. `"2026-07-02T18:04:11.123Z"`) — matches the timestamp convention
already used throughout Phase 1.5's schema (`docs/12`, `docs/25` §5.1), so Foundation's
timestamps read identically wherever they appear.

**Apps Script adaptation:** `new Date().toISOString()` — identical to the reference; no
native alternative needed here.

## `escapeHtml(value)`

**Contract:** coerces `value` to a string (never throws on a non-string input) and
replaces the five HTML-significant characters (`&`, `<`, `>`, `"`, `'`) with their
entity equivalents. Output is safe to embed in an HTML text or attribute context.

**Why this exists as a shared contract, not just a Phase-1.5-specific helper:**
Phase 1.5's `apps-script/Utils.gs` already has its own `escapeHtml_()`, used to
neutralize AI-generated content before embedding it in an email (docs/15: "no raw HTML
injected into email templates"). Foundation needs identical behavior for its own
future HTML-rendering needs, but **cannot reuse Phase 1.5's function name** — both
files now live in the same Apps Script project (per docs/29 §14's Decision 1), and
Apps Script functions share one global namespace per project, so a same-named function
in a second file would silently overwrite the first. `apps-script/FoundationUtils.gs`
implements this contract as `escapeFoundationHtml_()` — same algorithm as Phase 1.5's
`escapeHtml_()`, distinct name, zero collision risk. This is a real, load-bearing
reason `shared/` exists: the contract (what escaping means) is defined once here, even
though two distinctly-named functions in the same project each implement it.

## Versioning

Version `1.0.0`. A change to any function's contract (return type, escaped character
set, timestamp format) requires a new version here first, then a subsequent update to
`apps-script/FoundationUtils.gs` — never the reverse, per `shared/README.md`.
