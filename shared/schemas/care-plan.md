# Care Plan

Explains `care-plan.schema.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-7 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §12, §22)

This contract, and `apps-script/CarePlan.gs`'s implementation of it, back Phase 2B's
Personal Care Plan capability — a consumer of Pillar 1 (Doctor Assigned Condition,
informing which patient needs a plan) and Pillar 2 (Module Engine, exposing the
capability), per docs/44 §4.2. Governed by `docs/47-PHASE-2B-IMPLEMENTATION-RULES.md`.

## Doctor-owned, not patient-owned — a hard boundary

**The patient never authors, edits, or versions their own Care Plan.** Every write is a
doctor/staff action, enforced server-side (docs/44 §4.3's "Doctor configures, patient
consumes" principle). No real Doctor identity/authentication exists yet (docs/33 §1.4,
a named, disclosed gap) — `created_by` is a free-text staff identifier, the same
provenance convention `doctor-assigned-condition.schema.json`'s `assigned_by` already
uses. Because there is no Doctor session to authenticate against, authoring/versioning
is a manually-run Apps Script editor function (`saveFoundationCarePlan()`), mirroring
`DoctorAssignedCondition.gs`'s `assignFoundationCondition()` precedent exactly — not a
new authenticated Web App route.

**The patient gets two read-only, session-derived routes** — `get_care_plan` (this
entity) and `get_doctor_instructions` (`doctor-instruction.schema.json`) — approved as
this batch's patient-facing surface (docs/44 §22: "patient-facing read-only Care Plan
view"). Both derive `patient_id` exclusively from the verified session, the same
authorization primitive every other Foundation read route already uses.

## `version_key` — a disclosed, additive per-row identity column

Many rows legitimately share the same `care_plan_id` (one per version), so
`apps-script/FoundationDataStore.gs`'s single-`idColumn` `foundationDsUpdateById_()`
cannot address one specific version by `care_plan_id` alone once a plan has more than
one version. `version_key` (`care_plan_id + '::' + version`, server-derived,
deterministic) is this schema's own disclosed, additive field — the same category of
implementation-time addition `patient-module-state.schema.json`'s `state_key` already
established, for the identical reason: reuse `FoundationDataStore.gs`'s existing
primitive unmodified rather than special-case a composite key into shared, frozen
infrastructure (docs/47 §6). Never doctor/staff-supplied, never patient-visible.

## Lifecycle: one evolving plan per patient, versioned, never edited in place

`care_plan_id` is a patient's plan's stable, logical identity — generated once, at the
first version's creation, and reused by every later version. Editing a plan (a new set
of goals, an updated `next_review_date`) never mutates an existing row: it appends a new
row sharing the same `care_plan_id`, with `version` incremented by exactly 1. Creating a
new version automatically flips the prior version's own `status` from `active` to
`superseded` — a one-way transition, never reverted. Exactly one `active` row exists per
`(patient_id, care_plan_id)` at any time; a patient with no Care Plan yet has zero rows
at all (`get_care_plan` returns `data: null`, not an error — the same "not yet
configured is not an error" discipline `get_checkin_template`'s unassigned-patient
outcome already established).

This mirrors `CheckInTemplate`'s own `(template_id, version)` discipline (docs/44
§11.2/§11.4) — a stable identity plus an incrementing, immutable-per-row version — reused
here rather than inventing a new versioning shape, per docs/47 §4's "extend an existing
pattern whenever possible."

## Relationship to Doctor Instruction

A Care Plan's `goals`/`next_review_date` are this version's own free-text summary.
The individual medicine/lifestyle/investigation/follow-up items a doctor has prescribed
live in `DoctorInstruction` rows (`doctor-instruction.schema.json`), each referencing
this plan's stable `care_plan_id` — many-per-plan, not versioned themselves (an
instruction's own `status` — active/discontinued/completed — tracks its individual
lifecycle independently of which Care Plan version is currently active). A patient's
`get_doctor_instructions` route returns every instruction ever attached to their plan's
`care_plan_id`, across every version, since an instruction's relevance does not expire
just because the plan summary around it was edited.

## Disclosed, deliberate scope decision: no Timeline Event emitted in this batch

docs/44 §12 states "a new Care Plan version emits a `TimelineEvent`
(`entry_type: care_plan`)." Implementing this requires widening
`consultation-history.schema.json`'s `entry_type` enum (currently `["consultation"]`
only) and changing `apps-script/FoundationConsultationHistory.gs`'s
`foundationBuildConsultationEntryRecord_()`, which today hardcodes
`entry_type: 'consultation'` — both are Phase 2A files, frozen except for a genuine bug
fix (docs/43 §12), and this is new functionality, not a bug fix. Per docs/47 §6 ("if a
batch's design genuinely requires touching a frozen file, that decision is made
explicitly, disclosed ... and justified" — the same discipline docs/44 §5.5 already
named as an open, implementation-time decision for a different batch), this batch makes
the disclosed, deliberate choice **not** to touch either frozen file. docs/33 §3.1
itself names widening `entry_type`'s enum as "the concrete signal that moment has
arrived — not before"; this batch does not treat itself as that moment, and defers
Timeline integration to a future, separately-approved change. A patient's Care Plan and
its full instruction history remain fully visible today via `get_care_plan`/
`get_doctor_instructions` and their own dedicated page
(`my-health-journey/care-plan/`) — only the *cross-cutting Timeline feed* does not yet
reflect a Care Plan update.

## Validation rules

- `patient_id`: required, non-empty.
- `goals`: required, non-empty.
- `next_review_date`: optional; when provided, must be a real, non-past-restricted
  `YYYY-MM-DD` calendar date (unlike `patient-profile.schema.json`'s `date_of_birth`,
  a review date is naturally in the future, so no "not in the future" check applies).
- `created_by`: required, non-empty (the doctor/staff identifier).

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly (not through the
generic error wrapper), the same convention every other entity's input validation
already follows.

## Fields at a glance

| Field | Set at first version? | Set at a later version? | Mutable by patient? |
|---|---|---|---|
| `version_key` | Yes (server-derived: `care_plan_id + '::' + version`) | Yes (new derived value, since `version` changed) | No |
| `care_plan_id` | Yes (server-generated UUID) | Reused, unchanged | No |
| `patient_id` | Yes (doctor/staff-supplied) | Reused, unchanged | No |
| `version` | Yes (`1`) | Yes (previous `version` + 1) | No |
| `status` | Yes (`'active'`) | Yes (`'active'`; prior row flips to `'superseded'`) | No |
| `goals` | Yes (doctor/staff-supplied) | Yes (doctor/staff-supplied) | No |
| `next_review_date` | Optional | Optional | No |
| `created_by` | Yes (doctor/staff-supplied) | Yes (doctor/staff-supplied) | No |
| `created_at` | Yes (server-set) | Yes (server-set) | No |

## No patient write path — ever, in this batch

There is no author/version Web App route in `FoundationRouter.gs`. The only routes this
batch adds are the read-only `get_care_plan` and `get_doctor_instructions`. Authoring
and versioning remain manually-run Apps Script editor functions until a real,
authenticated Doctor/staff identity and session mechanism exists — the same disclosed
gap `doctor-assigned-condition.md` already names (docs/33 §1.4), not solved or worked
around here.

## Versioning

Schema version `1.0.0`. Any field addition, removal, or type change requires a new
version here first, then a subsequent update to `apps-script/CarePlan.gs` — never the
reverse, per `shared/README.md`.
