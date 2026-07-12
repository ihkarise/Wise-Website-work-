# MilestoneReview

Explains `milestone-review.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-11 (docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §11.2, ADR-027)

One doctor-authored **progress review** per `(patient, milestone_type)` — the six review
dimensions docs/21 names (Progress, Improvements, Medicines, Investigations,
Recommendations, Next goals). Authored via `save_milestone_review`
(`apps-script/MilestoneReview.gs`); published via `publish_milestone_review`.

## Non-AI — every field is doctor-typed (ADR-027)

Health Milestones is the platform's deliberately **non-AI** patient-progress feature
(docs/24/docs/33 §3.5 separated it from Phase 2D's AI-narrated Digital Twin for exactly
this reason). No review field is AI-generated, and none is auto-inferred from Symptom
Log / Check-In / Calculator / Care Plan data (docs/58 §5 item 2). `medicines_review` is
free-text commentary, **not** a structural reference to `DoctorInstruction`/
`MedicationHistory` (docs/58 §0.2). `validation/static-analysis/analyze.js`'s Milestone
static rules 1–2 enforce the no-AI, no-auto-fill boundary at the code level.

## Doctor-authored / patient-viewable-when-published

Created `draft` — private to roster-scoped doctors (`get_patient_milestones`) — and made
patient-visible only by the one-way `draft` → `published` transition (`publish_milestone_review`,
docs/58 §10.2/§10.3). **Only a published review is ever returned to a patient**
(`get_health_milestones` returns published rows only, enforced server-side, not by UI
hiding). Mirrors `CarePlan`'s doctor-authored/patient-viewable ownership exactly, minus any
AI dimension. The patient never authors, edits, publishes, or deletes a review.

## `target_date`

Server-computed from the parent `MilestoneTrack.care_start_date` + the point's offset
(docs/58 §7) — never client-supplied. Denormalized here as an honest audit of what the
schedule showed at authoring time; the live schedule recomputes it for display, so a later
anchor correction does not rewrite this record.

## Lifecycle

`draft` (content editable) → `published` (content frozen; the transition stamps
`published_at`). A published review's content can no longer be edited (`save_milestone_review`
refuses it). A published review makes its milestone point read `completed` in the computed
schedule; a draft never does (docs/58 §5 item 3). Post-publish correction discipline (edit
vs. new version) is a disclosed, deferred implementation decision (docs/58 §22) — this
version ships publish as terminal.

## Security

Roster-validated at write (reuses `DoctorPatientRoster.gs`). A review cannot be authored
until the patient has a `MilestoneTrack` anchor (a review needs a schedule to belong to).

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `review_id` / `patient_id` / `track_id` / `milestone_type` | Yes | No |
| `target_date` | Yes (server-computed) | Recomputed only while draft (re-derived from the anchor) |
| `progress_summary` (required) + 5 optional dimensions | Yes (doctor-typed) | Only while `draft` |
| `status` | Yes (`'draft'`) | One-way → `'published'`, exactly once |
| `authored_by` / `created_at` | Yes | No |
| `updated_at` | Empty at creation | Server-set on each draft edit |
| `published_at` | Empty at creation | Server-set once, at publish |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version here
first, then a subsequent update to `apps-script/MilestoneReview.gs` — never the reverse,
per `shared/README.md`.
