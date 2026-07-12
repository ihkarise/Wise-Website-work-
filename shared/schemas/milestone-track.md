# MilestoneTrack

Explains `milestone-track.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-11 (docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §11.1, ADR-027)

The per-patient, doctor-set **care-start anchor** the Health Milestone schedule counts
from. One active row per patient — upsert-style, mirroring `PatientProfile`'s own
one-per-patient discipline (PXP-1). Written only by a doctor's own deliberate
`set_milestone_track` action (`apps-script/MilestoneTrack.gs`); the patient never sets,
edits, or pauses a track.

## Why an explicit anchor entity exists

No authoritative "treatment start" date exists on the platform: `Patient.created_at` is
onboarding (not clinical care-start), and `Consultation` (docs/33 §2.1) is still
*Conceptual*. Rather than silently overload a frozen Foundation field with a clinical
meaning it was never defined to carry, this batch introduces one small, explicit,
doctor-set anchor (docs/58 §0.3). From it, the entire 30/90/180/365-day schedule is a
pure, deterministic computation.

## The schedule is computed, never stored

`care_start_date` is the only stored input to the schedule. The four milestone points and
their target dates and states (`upcoming`/`due`/`overdue`/`completed`) are recomputed on
every read (`foundationComputeMilestoneSchedule_`), never stored as rows — mirroring
`Analytics`/`Digital Twin`'s own "computed view, never a base table" discipline (docs/33
§7.6/§3.5). A corrected anchor transparently re-dates every not-yet-completed point with
zero stored-state migration. **No AI is involved** (ADR-027): the schedule is arithmetic,
not inference.

## `status`

`active` surfaces the computed schedule; `paused` stops surfacing it (a patient on hold)
without deleting any already-published review history.

## Security

Roster-validated at write (reuses `DoctorPatientRoster.gs`, never a new derivation).
Doctor/staff-authored only — the identical "doctors decide" boundary
`CarePlan`/`DoctorInstruction` already establish. The patient sees the *computed schedule*,
never this row directly.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `track_id` | Yes (server-generated UUID) | No |
| `patient_id` | Yes (roster-validated) | No |
| `care_start_date` | Yes (doctor-chosen) | Yes — by deliberate doctor upsert |
| `status` | Yes (`'active'`) | Yes — by deliberate doctor upsert |
| `created_by` / `created_at` | Yes | No |
| `updated_at` | Empty at creation | Server-set on each upsert edit |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version here
first, then a subsequent update to `apps-script/MilestoneTrack.gs` — never the reverse,
per `shared/README.md`.
