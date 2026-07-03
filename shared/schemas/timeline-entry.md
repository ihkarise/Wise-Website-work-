# Timeline Entry (merged Timeline API response item)

Explains `timeline-entry.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Why this is a new contract, not a widened `consultation-history.schema.json`

`consultation-history.schema.json`'s own `.md` states plainly why its `entry_type` enum
stayed narrow: "every row this schema version stores has `entry_type: 'consultation'`...
The enum is intentionally restricted to what `ConsultationHistory` actually holds today."
That reasoning is about **what a `ConsultationHistory` row is** — it remains true and
unchanged by this batch: `ConsultationHistory` rows are still, and only ever, staff/
Phase-1.5-sourced consultation entries.

What changed is that `get_timeline`'s **response** is no longer a plain read of
`ConsultationHistory` — per docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md's approved
decision, a submitted `SymptomLogs` row now also appears in the same feed. Widening
`consultation-history.schema.json`'s own `entry_type` enum to include `symptom_log` would
conflate two different things: "what a `ConsultationHistory` row can be" (still just
`consultation`) and "what the Timeline API can return" (now two kinds of thing). This
schema is the second one — the concrete implementation of docs/33 §3.1's originally
general "Timeline Event" entity, finally given its own shape now that a second source
genuinely exists, exactly the trigger condition docs/33 §3.1 and docs/39 §2 both named in
advance.

## How the two sources map to this shape

`apps-script/FoundationTimeline.gs`'s `foundationGetPatientTimelineMerged_()` builds this
shape from two independent reads, never by modifying either source's own schema:

- **`ConsultationHistory`** (via the unmodified, frozen
  `foundationGetPatientTimeline_()`): each row maps through unchanged —
  `record_id`, `entry_date`, `entry_type: "consultation"`, `title`, `summary_text` all
  come directly from the row.
- **`SymptomLogs`**, `status: "submitted"` only, **never** `status: "draft"` (docs/41's
  approved "not shown in Timeline" rule for drafts): each row maps to
  `record_id` (the `SymptomLogs` row's own), `entry_date` (the row's `submitted_at`),
  `entry_type: "symptom_log"`, `title: "Symptom check-in"` (fixed), and `summary_text`
  synthesized at read time from `severity`/`sleep`/`energy`/`stress`/`notes` — never
  persisted, computed fresh on every `get_timeline` call.

Both lists are merged and re-sorted by `entry_date` descending (string comparison,
consistent with `foundationCompareConsultationEntriesDesc_()`'s own existing approach),
then capped at the same 50-entry limit `docs/29 §6` already establishes for Timeline —
applied once, to the merged list, not once per source.

## No detail-view lookup for `symptom_log` entries

Unlike `consultation` entries, a `symptom_log` Timeline item does not link to a
`get_timeline_entry`-style detail page. `docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md §2`
found no need for a separate Symptom Tracker detail view — a handful of 1-10 scale values
plus a short note doesn't warrant its own page the way a full clinical
`summary_text` does. The Timeline list renders a `symptom_log` entry's synthesized
summary inline; the patient's full Symptom Tracker history (drafts and all past
submitted entries) remains the Symptom Tracker's own dedicated page.

## Versioning

Version `1.0.0`. Any future third source (Care Plan, Phase 2B; Digital Twin milestones,
Phase 2D) widens this schema's `entry_type` enum the same way `symptom_log` was added
here — never by touching `consultation-history.schema.json`'s own, narrower enum.
