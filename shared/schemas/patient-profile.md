# Patient Profile

Explains `patient-profile.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-1 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §17, §22)

This contract, and `apps-script/FoundationPatientProfile.gs`'s implementation of it,
back the platform's first patient-mutable structured data — the recommended first batch
of Phase 2B, per docs/44 §22 and docs/45 Version 4.0's readiness verdict. Governed by
`docs/47-PHASE-2B-IMPLEMENTATION-RULES.md`.

## Lifecycle: the platform's first upsert-style entity

Every prior Foundation-family entity (`ConsultationHistory`, `SymptomLogs`, `Reports`)
is create-and-list-only — an append-only log, never edited in place. `PatientProfile`
is different by design: a single, 1:1, mutable record per patient, read and then
genuinely edited by its own owner. `patient_id` is the row's natural key (there is no
separate `record_id`); a save either creates the row (if none exists yet) or patches the
existing one, reusing `FoundationDataStore.gs`'s already-generic
`foundationDsGetById_`/`foundationDsInsert_`/`foundationDsUpdateById_` operations exactly
as they were already designed to be reused (ADR-009) — no new Data Store primitive was
needed.

## The two open questions docs/45 (Version 3.0/4.0, Part 5) carried forward, resolved here

- **Eager vs. lazy row creation?** Resolved: **lazy.** No `PatientProfile` row exists
  until the patient's first save. `get_patient_profile` never returns
  `FOUNDATION_NOT_FOUND` for a patient who simply hasn't filled in their profile yet —
  that is an expected, normal first-visit state, not an error. It returns a
  default-shaped record instead: every optional field as `""`, `updated_at`/
  `updated_by` also `""` until the first real save. This avoids an unnecessary
  error-state on every patient's very first dashboard/profile-page visit.
- **`Patient.status = inactive`/`recovered` handling?** Resolved: **no status-based
  gating.** Profile view/edit is available regardless of the patient's `status` field
  on the frozen `Patients` sheet — consistent with every other existing patient-facing
  feature (Timeline, Symptom Tracker, Reports), none of which gates on `status` either.
  An inactive or recovered patient's contact/emergency details are exactly as relevant
  to keep current as an active patient's.

## Relationship to the frozen `Patients` sheet / `patient-identity.schema.json`

This is a wholly separate entity and sheet (`PatientProfile`), never a widening of
`patient-identity.schema.json` — the same reasoning docs/44 §6.2 already used for
`DoctorAssignedCondition`. `full_name`, `email`, `condition_slug`, and `status` remain
exactly where they are on the `Patients` sheet; nothing here reads or writes them.

## `emergency_contact` — a flat string, not a nested object

Per ADR-006's flat-column convention (every Sheet-backed entity is flat columns, not
nested JSON, except docs/44 §11.4's disclosed, narrow JSON-column exception, which does
not apply here), `emergency_contact` is one free-text field capturing name and phone
together (e.g. `"Jane Doe, +91 98765 43210"`), not a nested `{name, phone}` object.
Size-bounded at write time (200 characters) and HTML-escaped wherever displayed, the
same discipline `symptom-log.schema.json`'s `notes` field already established.

## Validation rules

- `phone`: optional; when non-empty, must match `/^[0-9+\-()\s]{7,20}$/` after trimming.
- `date_of_birth`: optional; when non-empty, must be a real, valid `YYYY-MM-DD`
  calendar date, not in the future.
- `preferred_contact_method`: optional; when non-empty, must be one of `email`,
  `phone`, `sms` — a closed, small vocabulary (schema `enum`), not a free string.
- `emergency_contact`: optional; when non-empty, capped at 200 characters after
  trimming.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly (not through the
generic error wrapper), the same convention every other entity's input validation
already follows.

## No dashboard card in this batch — a disclosed scope boundary

Unlike Symptom Tracker/Reports, this batch does not add a card to
`my-health-journey/dashboard.js` or touch `my-health-journey/index.html`'s card grid —
both remain frozen (`docs/38-PATIENT-ACCESS-DASHBOARD-SHELL-CLOSEOUT.md`). Patient
Profile is reachable at its own dedicated page (`/my-health-journey/profile/`), linked
from one small, disclosed addition to the dashboard header (a "My Profile" link, static
markup only, no `dashboard.js` logic touched). A future Dashboard Registry batch
(PXP-3/PXP-4) is the natural, already-planned place for Patient Profile to become a
registry-driven dashboard module if that is ever wanted — not decided or required here.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `patient_id` | Yes (session-derived) | No |
| `phone` | Yes (as `''` or a validated value) | Yes, by the patient |
| `date_of_birth` | Yes (as `''` or a validated value) | Yes, by the patient |
| `preferred_contact_method` | Yes (as `''` or a validated value) | Yes, by the patient |
| `emergency_contact` | Yes (as `''` or a validated value) | Yes, by the patient |
| `updated_at` | Yes (as `''` until the first save, then server-set to "now" on every save) | No — server-set only |
| `updated_by` | Yes (as `''` until the first save, then server-set to session-derived patient_id) | No — server-set only |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change — including ever adding a
doctor/staff-driven correction path — requires a new version here first, then a
subsequent update to `apps-script/FoundationPatientProfile.gs` — never the reverse, per
`shared/README.md`.
