# Doctor Assigned Condition

Explains `doctor-assigned-condition.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch PXP-2 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §6, §22)

This contract, and `apps-script/DoctorAssignedCondition.gs`'s implementation of it,
back Phase 2B's Pillar 1 — the platform's only mechanism for expressing which
patient needs which capability (docs/44 §4.1). Governed by
`docs/47-PHASE-2B-IMPLEMENTATION-RULES.md`.

## Doctor-owned, not patient-owned — a hard boundary

**The patient never creates, edits, or resolves a row of this shape.** Every write —
both assignment and resolution — is a doctor/staff action, enforced server-side
(docs/44 §4.3's "Doctor configures, patient consumes" principle, applied here as the
first pillar it governs). No real Doctor identity/authentication exists yet
(docs/33 §1.4, a named, disclosed gap) — `assigned_by`/`resolved_by` are free-text
staff identifiers, the same provenance convention `patient-identity.schema.json`'s
`created_by` already uses, not a foreign key into a Doctor table that doesn't exist.
Because there is no Doctor session to authenticate against, the assignment/resolution
tool is a manually-run Apps Script editor function (`assignFoundationCondition()` /
`resolveFoundationCondition()`), mirroring `PatientIdentity.gs`'s
`createFoundationPatient()` precedent exactly — not a new authenticated Web App route.

**The patient does get one, read-only, session-derived route** — `get_doctor_assigned_
conditions` — approved as this batch's minimal patient-facing surface (docs/44 §22's
"zero patient-facing surface beyond a read-only reflection, if any"). It returns only
the caller's own assignment rows, deriving `patient_id` exclusively from the verified
session, the same authorization primitive every other Foundation read route already
uses. This route is infrastructure for later batches (Module Registry, Dashboard
Registry, Daily Check-in Engine, Calculator Registry, Personal Care Plan all consume
"what is this patient's condition" per docs/44 §4.2) — no patient-facing UI is built on
top of it in this batch.

## Lifecycle: many-per-patient, append-mostly

Unlike `PatientProfile` (1:1, upsert), `DoctorAssignedCondition` is many-per-patient —
a patient may have several active or historical assignments. A row is created active
and may transition to `resolved` exactly once via the resolve operation; it never
reverts from `resolved` back to `active` and is never deleted. Re-assigning a
previously-resolved condition creates a **new** row, preserving the old one as
permanent history — the same "no update, no delete, append instead" discipline every
other Foundation-family entity (`ConsultationHistory`, `SymptomLogs`, `Reports`)
already follows for its own lifecycle, applied here to a genuine state transition
rather than only to new facts.

## `resolved_at`/`resolved_by` — completing the audit lifecycle

docs/44 §6.2 names `assignment_id`, `patient_id`, `condition_slug`, `assigned_by`,
`assigned_at`, and `status` explicitly, and separately states this entity provides
"full audit history of every assignment **and resolution**." `resolved_at`/
`resolved_by` are this batch's disclosed, additive completion of that stated intent —
the same category of implementation-time field-level decision Batch PXP-1 made for its
own two open lifecycle questions (`shared/schemas/patient-profile.md`). Both are empty-
string sentinels until a resolve actually happens, mirroring `login-token.schema.json`'s
`used_at` convention.

## Relationship to `Patient.condition_slug` — the docs/45 Part 1.2 loose end, resolved

docs/45's readiness review (Version 3.0/4.0, Part 1.2) named an open question: what
reads `Patient.condition_slug` today, and whether those readers must change. **Resolved
here: this batch is purely additive.** `Patient.condition_slug` and every existing
reader of it (e.g. `FoundationSymptomLog.gs`'s own condition_slug field, unrelated to
this entity) are completely untouched by PXP-2. `DoctorAssignedCondition` becomes the
forward-going source of truth only for code that is written to consume it going
forward — no batch is required to migrate an existing reader as part of this change,
and none does.

## Validation rules

- `patient_id`: required, non-empty.
- `condition_slug`: required, must be one of the canonical slugs (manually adapted into
  `FOUNDATION_CONDITION_ASSIGNMENT_ALLOWED_SLUGS_`, the same duplication-by-convention
  `symptom-log.schema.json`'s own allowlist already established — update both places by
  hand if the canonical list ever changes, per `shared/README.md`'s rule).
- `assigned_by`: required, non-empty (the doctor/staff identifier).
- Resolve operation: `assignment_id` must reference an existing, currently-`active` row
  (resolving an unknown or already-`resolved` `assignment_id` is rejected); `resolved_by`
  is required, non-empty.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly (not through the
generic error wrapper), the same convention every other entity's input validation
already follows.

## Fields at a glance

| Field | Set at assignment? | Set at resolution? | Mutable by patient? |
|---|---|---|---|
| `assignment_id` | Yes (server-generated UUID) | — | No |
| `patient_id` | Yes (doctor/staff-supplied) | — | No |
| `condition_slug` | Yes (doctor/staff-supplied, validated) | — | No |
| `assigned_by` | Yes (doctor/staff-supplied) | — | No |
| `assigned_at` | Yes (server-set) | — | No |
| `status` | Yes (`'active'`) | Yes (`'resolved'`) | No |
| `resolved_at` | `''` | Yes (server-set) | No |
| `resolved_by` | `''` | Yes (doctor/staff-supplied) | No |

## No patient write path — ever, in this batch

There is no `assign`/`resolve` Web App route in `FoundationRouter.gs`. The only route
this batch adds is the read-only `get_doctor_assigned_conditions`. Assignment and
resolution remain manually-run Apps Script editor functions until a real, authenticated
Doctor/staff identity and session mechanism exists — a future gap named in docs/33 §1.4,
not solved or worked around here.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/DoctorAssignedCondition.gs` — never
the reverse, per `shared/README.md`.
