# Symptom Log Entry

Explains `symptom-log.schema.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PA-4 (docs/29 §13 Batch 5E)

This contract, and `apps-script/FoundationSymptomLog.gs`'s implementation of it, back
the platform's first patient-**writable** feature (docs/29 §9, docs/33 §3.2). Preceded
by `docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md`, which resolved this schema's two open
questions before it was written (below).

## Lifecycle: create → persist → read. No update. No delete.

Per docs/33 §3.2 and docs/41 §1/§4/§5: a Symptom Log entry is logged by the patient, at
will, and is never edited or deleted afterward by the patient or by staff — an honest,
permanent self-report, not a mutable journal. `apps-script/FoundationSymptomLog.gs`
provides only a create function and a patient-scoped list function; no update or delete
endpoint exists or should exist for this entity.

## The two open questions docs/41 raised, resolved before this schema was written

- **Q1 — are all four scale fields mandatory?** Resolved: **yes.** `severity`, `sleep`,
  `energy`, and `stress` are all required, integer, 1–10. A patient cannot submit a
  partial log in this schema version.
- **Q2 — is `logged_at` ever patient-editable?** Resolved: **no.** Always server-set to
  the write-time instant (`foundationNowIso_()`), consistent with every other
  `created_at`-style field's provenance discipline elsewhere in this platform. Unlike
  `consultation-history.schema.json`'s `entry_date`, there is no separate
  patient-chosen date field — `logged_at` is both the record's timestamp and its sole
  sort key.

## `record_id` — identity, reserved for future use

A UUID, generated once via `generateFoundationId_()`, the same primitive every other
Foundation entity uses. Unlike `consultation-history.schema.json`, no
`foundationGetSymptomLogById_()`-style function is built in this schema version — docs/41
§2/§12 found no product requirement for a per-entry detail fetch (a Symptom Log row has
no long-form text that would benefit from its own page). `record_id` is still stored on
every row so a future detail view, if ever approved, does not require a migration.

## `notes` and `condition_slug` — the shared empty-string sentinel

Both fields mirror `consultation-history.schema.json`'s `source_ref` field exactly:
`FoundationDataStore.gs`'s row/object conversion already writes an empty string for any
missing field, so both reuse that existing convention rather than inventing a new
null-handling rule. `notes` is optional free text, HTML-escaped wherever displayed,
never trusted as markup. `condition_slug` is optional; when provided, it must be one of
`shared/constants/condition-slugs.json`'s canonical slugs —
`apps-script/FoundationSymptomLog.gs` validates this at write time, since this schema
closes the "no second real consumer yet" deferral `shared/schemas/patient-identity.md`
and `shared/README.md` both named.

## No relationship to Consultation, Timeline, or AI

By design, not omission (docs/41 §6/§7/§9): no `consultation_id` or `source_ref`-style
pointer exists on this schema, and this batch does not add `SymptomLogs` rows into the
Timeline query. No field here is ever read, summarized, or analyzed by AI in this phase
(docs/29 §0/§9) — pure data capture, pure data display.

## Ordering

Full-history display order is `logged_at` descending — a single sort key, simpler than
`consultation-history.schema.json`'s two-key (`entry_date` + `created_at` tiebreaker)
scheme, because `logged_at` is this entity's only timestamp.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `record_id` | Yes | No — permanent, reserved for a possible future detail view |
| `patient_id` | Yes (session-derived) | No |
| `logged_at` | Yes (server-set to "now") | No — never patient-editable (Q2 above) |
| `severity` | Yes (required) | No |
| `sleep` | Yes (required) | No |
| `energy` | Yes (required) | No |
| `stress` | Yes (required) | No |
| `notes` | Yes (as `''` or free text) | No |
| `condition_slug` | Yes (as `''` or a canonical slug) | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change — including ever adding an
update/delete endpoint or a `consultation_id` relationship — requires a new version here
first, then a subsequent update to `apps-script/FoundationSymptomLog.gs` — never the
reverse, per `shared/README.md`.

## Deprecated (Batch PXP-10, 2026-07-15)

Symptom Tracker Migration (docs/44 §10.1/§22, docs/47) retires this entity's dashboard
entry point now that Daily Check-in (PXP-5) is proven in production as its successor.
**This schema itself, and `apps-script/FoundationSymptomLog.gs`'s implementation of it,
are unchanged** — zero lines touched in either file, the same "zero lines changed"
discipline Batch PXP-8 already established for `FoundationSession.gs`. `log_symptom`
and `get_symptom_logs` (`FoundationRouter.gs`'s existing dispatch cases) remain fully
functional, with no breaking change to either route's request/response contract
(docs/47 §6) — this is a documentation-level deprecation notice, not a code change:

- `log_symptom`/`get_symptom_logs` are no longer called from any dashboard card
  (`shared/constants/module-registry.md`'s own "Batch PXP-10 removal" section) — the
  `symptom_tracker` Module Registry entry that made the card reachable is gone.
- The standalone Symptom History page (`my-health-journey/symptoms/`) is untouched and
  still calls `get_symptom_logs` directly — a patient who already has it bookmarked, or
  navigates to it by direct URL, can still read their own permanent history. It is no
  longer linked from the dashboard.
- `SymptomLogs` rows already written are retained permanently, per docs/44 §10.1/§19 —
  this entity's own "never edited or deleted" lifecycle (above) is unaffected.
- New patient-facing daily self-report work should use the Daily Check-in Engine
  (`shared/schemas/check-in-response.md`) going forward, not this entity — this schema
  is not expected to gain a new version for that purpose.
