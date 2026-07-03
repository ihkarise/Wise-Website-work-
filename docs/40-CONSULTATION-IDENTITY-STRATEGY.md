# 40 - Consultation Identity Strategy
## Architectural Clarification — Version 1.0 — 2026-07-03

> Requested before Batch PA-3 implementation begins. Per this session's instruction:
> **no code was written to produce this answer.** Grounded entirely in already-approved
> architecture (docs/29 §4/§6/§7, docs/33 §1.2/§3.1, ADR-002, ADR-006) — this document
> clarifies how existing decisions apply to Consultation Timeline identity; it does not
> introduce a new decision.

---

## 1. What should uniquely identify a consultation?

**`record_id` — a UUID, generated once, permanent.** This is not a new choice: docs/29
§4's already-approved `ConsultationHistory` schema already lists `record_id` as its
first column, and every other Phase 2A entity (`Patients.patient_id`,
`SymptomLogs.record_id`, `Reports.record_id`) already uses the identical pattern. This
review confirms `record_id` is the correct — and only — candidate, and rules out the
alternatives explicitly:

- **Not `entry_date` + `title`.** Neither is unique (a patient can have two same-day
  entries; titles are free text, staff-authored, and can collide or be edited).
- **Not row position in the sheet.** Google Sheets row order is not a stable identity —
  see Q4.
- **Not `source_ref`.** Optional and empty for staff-authored entries with no linked
  Phase 1.5 record (docs/29 §7) — cannot serve as a universal identifier since most rows
  may not have one.

## 2. Should that identifier remain stable across future SQL migration?

**Yes — this is exactly what `record_id` already exists to guarantee.** docs/29 §4's own
framing states the discipline this schema follows: "flat columns, stable UUID
`record_id`... SQL-migration-safe by design," directly extending ADR-006 (Sheets is an
implementation detail, not permanent architecture). A UUID primary key is precisely what
becomes a relational primary key in a future migration; a Sheets row's position is not
portable to a relational table at all (a table has no inherent row order without an
explicit sort). The same immutability standard already applied to `patient_id`
(docs/33 §1.2: "never reissued, never recycled") applies identically to a consultation's
`record_id`: set once at creation, never reused, never recycled — even if the row is
later edited (title/summary corrected by staff) or the patient's status changes.

## 3. Can it safely be exposed in URLs?

**Yes, provided the backend always re-verifies ownership on every fetch — the ID's
unguessability is a defense-in-depth property, not the authorization boundary itself.**
`record_id` is generated via `Utilities.getUuid()` (RFC 4122 v4, effectively random) —
unlike a sequential integer primary key, it cannot be enumerated by incrementing a
guess, so it is safe to appear in a URL (e.g. `?id=<record_id>`) in the sense that
merely seeing one patient's URL teaches an attacker nothing about how to construct
another patient's. **This alone is not sufficient authorization**, the same principle
already established for `FOUNDATION_UNAUTHORIZED`/`FOUNDATION_LOGIN_TOKEN_INVALID`'s
generic-rejection design (ADR-010): possessing a `record_id` must never be treated as
proof of ownership. Every detail-view fetch must independently verify the requested
row's own `patient_id` matches the session-derived `patient_id` (ADR-002) before
returning it — "unguessable" and "authorized" are two separate properties, and only the
second is a real security boundary. This is the specific new authorization shape
docs/39 §10 already flagged as required for this batch.

One related, narrower point: only the bare `record_id` should appear in a URL —
`title`/`summary_text` should never be embedded in a query string, since those are
patient health content and unnecessarily exposed to browser history/referrer/logs at
a much higher sensitivity than an opaque identifier.

## 4. Should Timeline use that identifier instead of relying on row order?

**Yes, unambiguously — for identity. Row order (specifically, `entry_date`) still
governs display sequence; the two are deliberately separate concerns.** Docs/39 §3
already established `entry_date` (with `created_at` as a tiebreaker) as the *sort key*
for how entries are displayed. This question is about *identity* — how a specific entry
is referenced, linked to, and fetched — which must be `record_id`, decoupled entirely
from wherever the row happens to sit in the sheet at query time. Relying on row/list
position as a de facto identifier would break in at least three concrete ways:

- A bookmarked or shared link to a specific entry would silently point at the wrong
  entry if the sheet is later resorted, or if a row above it is edited or removed by
  staff.
- Google Sheets does not guarantee stable read order across separate API calls — the
  same caution `foundationDsQuery_()`'s own row-scan approach already implies.
- It would collapse Q3's authorization check entirely: "the 2nd row this query
  returned" is not a stable, checkable value against a persisted `patient_id`, the way
  a `record_id` looked up via `foundationDsGetById_()`-style access is.

This mirrors, at the consultation level, the same identity/lookup-key separation ADR-002
already established at the patient level: `patient_id` (permanent identity) is kept
separate from `email` (a mutable lookup key). Here, `record_id` (permanent identity) is
kept separate from `entry_date`/list position (a mutable, redisplayable sort order).

## 5. Does any existing schema require changes?

**No schema change is required by this identity review.** `record_id` was already
present in docs/29 §4's `ConsultationHistory` schema from the start — this review
confirms the already-approved schema already has the correct identifier and clarifies
how it should be used (as the sole key for Timeline linking and detail-view fetches),
rather than discovering a missing column.

The one schema-adjacent recommendation on record remains docs/39 §2's `entry_type`
addition (aligning `ConsultationHistory` with docs/33 §3.1's more general Timeline
Event shape) — a **separate, pre-existing recommendation, unrelated to consultation
identity**, and unchanged by this document. It stands as previously stated: a
zero-behavior-change addition worth making at PA-3 implementation time to avoid a
future migration, not a requirement this identity review introduces.

---

## Summary

| Question | Answer |
|---|---|
| Unique identifier | `record_id` (UUID) — already in the approved schema |
| Stable across SQL migration | Yes — this is `record_id`'s designed purpose (ADR-006) |
| Safe in URLs | Yes, as an opaque reference only — never a substitute for a server-side ownership check |
| Timeline should use it, not row order | Yes — identity (`record_id`) and display order (`entry_date`) are separate concerns |
| Schema changes required | None, for identity. `entry_type` (docs/39 §2) remains a separate, already-recorded recommendation |

**This clarification does not by itself authorize PA-3 to begin** beyond what was
already approved in docs/39 — it resolves one open question that review's own §10 and
§6 depended on. Per this session's instruction, implementation proceeds immediately
after this document, exactly as docs/39 planned.
