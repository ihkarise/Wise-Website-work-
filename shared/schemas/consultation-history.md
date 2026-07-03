# Consultation History Entry

Explains `consultation-history.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch PA-3 (docs/29 §13 Batch 5D)

This contract, and `apps-script/FoundationConsultationHistory.gs`'s implementation of
it, back the first patient-writable-by-staff, patient-readable feature in Phase 2A: a
doctor-approved or staff-authored visit-history entry, surfaced to the patient as a
Timeline preview card, a full Timeline list, and a single-entry Consultation History
detail view (docs/29 §6/§7). Entries are **read-only for patients** — no patient-editing
endpoint exists or should exist for `title`/`summary_text` (docs/30 §2, "doctors
decide").

## `entry_type` — why it exists, and why its enum is narrow

docs/33-DOMAIN-MODEL.md §3.1 models a more general **Timeline Event** entity, deliberately
including an `entry_type` field (`consultation`/`note`/`milestone`, described as
"extensible") so future Care Plan and Digital Twin events could plug into the same feed
without a redesign. docs/29 §4's original `ConsultationHistory` column list did not
include this field — a real, concrete gap, surfaced in
docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md §2 and closed here: every row this
schema version stores has `entry_type: "consultation"`, added now (zero behavior change,
since it's the only value that has ever existed) specifically to avoid a schema
migration the day a second Timeline Event source is built. The enum is intentionally
restricted to `["consultation"]` rather than widened to include `note`/`milestone`
speculatively — those values belong to entities that don't exist yet (Care Plan, Phase
2B; Digital Twin, Phase 2D), and per `shared/README.md`'s versioning rule, a schema is
widened when an implementation actually needs the new value, not in anticipation of one.

## `record_id` — the identity strategy (docs/40)

`record_id` is a UUID, generated once via `generateFoundationId_()` (Apps Script's
native `Utilities.getUuid()`, the same primitive every other Foundation entity uses),
and is the **only** field the Timeline list, the dashboard preview card, and the
Consultation History detail view should ever use to reference or fetch a specific
entry. It is deliberately decoupled from `entry_date` (which governs *display* order
only, per the Ordering section below) and from row position in the underlying Sheet
(which is not a stable identifier at all — see
docs/40-CONSULTATION-IDENTITY-STRATEGY.md Q4 for the concrete failure modes this avoids).

**Safe to appear in a URL as an opaque reference, never as a substitute for a
server-side ownership check.** `record_id`'s randomness (RFC 4122 v4) makes it
unguessable, but unguessability is not authorization — every fetch by `record_id` must
independently verify the row's own `patient_id` matches the session-derived
`patient_id` before returning it (docs/40 Q3). A request for a `record_id` that does not
exist, or exists but belongs to a different patient, returns the same generic
`FOUNDATION_NOT_FOUND` — the same anti-enumeration discipline `login-token.md`'s
"Rejection is deliberately generic" already established, applied here so a patient can
never learn "that ID exists, it's just not yours" versus "that ID doesn't exist" as two
distinguishable outcomes.

## Ordering

Timeline display order is `entry_date` descending, with `created_at` descending as an
explicit tiebreaker for same-`entry_date` rows (docs/39 §3) — `entry_date` (the
clinically meaningful visit date) and `created_at` (when the row was actually written)
can diverge, since staff may enter or backfill an entry after the visit happened. This
is purely a *display* concern, entirely separate from `record_id`'s identity role above.

## `source_ref` — the same legitimately-empty sentinel convention as `used_at`

Mirrors `login-token.schema.json`'s `used_at` field exactly: `FoundationDataStore.gs`'s
row/object conversion already writes an empty string for any missing field, so
`source_ref` reuses that existing convention rather than inventing a new null-handling
rule. Empty string means "authored directly by staff, no linked Phase 1.5 record";
a non-empty value is a Phase 1.5 `Phase1.5_ConsultationSummaries` `record_id` (docs/29
§7's second sourcing path). The patient-facing read path never needs to resolve
`source_ref` itself — both sourcing paths already land in this same row shape, so
`FoundationConsultationHistory.gs` never reads Phase 1.5's sheet.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `record_id` | Yes | No — permanent, the row's identity (docs/40) |
| `patient_id` | Yes | No |
| `entry_date` | Yes | No (a correction would be a staff edit, not a patient action — out of this batch's scope) |
| `entry_type` | Yes (always `"consultation"`) | No |
| `title` | Yes | No (patient-facing, staff-authored; read-only for patients) |
| `summary_text` | Yes | No (read-only for patients — docs/30 §2) |
| `source_ref` | Yes (as `''` or a Phase 1.5 record_id) | No |
| `created_by` | Yes | No |
| `created_at` | Yes | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change — including ever widening
`entry_type`'s enum — requires a new version here first, then a subsequent update to
`apps-script/FoundationConsultationHistory.gs` — never the reverse, per
`shared/README.md`.
