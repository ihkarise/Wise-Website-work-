# Doctor Instruction

Explains `doctor-instruction.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch PXP-7 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §12, §22)

This contract, and `apps-script/DoctorInstruction.gs`'s implementation of it, back
Phase 2B's Personal Care Plan capability, alongside `care-plan.schema.json`. Governed by
`docs/47-PHASE-2B-IMPLEMENTATION-RULES.md`.

## Doctor-owned, not patient-owned — a hard boundary

**The patient never creates, edits, or resolves an instruction of this shape.** Every
write — both creation and a status transition — is a doctor/staff action, enforced
server-side (docs/44 §4.3). No real Doctor identity/authentication exists yet
(docs/33 §1.4), so `prescribed_by` is a free-text staff identifier, and both
creation and status-transition tools are manually-run Apps Script editor functions
(`createFoundationDoctorInstruction()` / `updateFoundationDoctorInstructionStatus()`),
mirroring `DoctorAssignedCondition.gs`'s precedent exactly — not a new authenticated Web
App route. The patient's one read-only route, `get_doctor_instructions`, is documented
in `care-plan.md`.

## Lifecycle: many-per-patient, many-per-plan, append-mostly

A row is created with `status: 'active'` and may transition to `'discontinued'` or
`'completed'` exactly once via the doctor/staff-only status-update operation — it never
reverts and is never deleted or overwritten in place beyond that one transition
(docs/33 §2.3: "updated (discontinued) at a follow-up, never deleted"). A new
prescription is always a new row, never a mutation of a closed one — the same
"no update, no delete, append instead" discipline every other Foundation-family entity
already follows for its own lifecycle events.

## `care_plan_id` — attaching an instruction to its plan

Every instruction references the `care_plan_id` of an existing `CarePlan` row
(`care-plan.schema.json`) for the same `patient_id` — checked at write time
(`foundationCreateDoctorInstruction_()` rejects an unknown or cross-patient
`care_plan_id`). Because `care_plan_id` is stable across a plan's own versions
(`care-plan.md`), an instruction remains correctly attached to its plan's full lineage
even after the plan itself is later versioned — an instruction is not itself versioned
and does not need to be re-created when its plan is.

## `consultation_id` — a disclosed, presently-empty field

docs/44 §12 names `consultation_id` as part of this entity's shape, anticipating a
future link to a real `Consultation` record. No `Consultation` entity exists yet
(docs/33 §2.1, a disclosed, unrelated gap this batch does not attempt to close) — every
row's `consultation_id` is an empty-string sentinel today, mirroring
`consultation-history.schema.json`'s own `source_ref` convention. A future batch that
implements `Consultation` can populate this field on new rows without a schema change.

## `instruction_type` — Prescription is a `medicine`-typed instruction

docs/33 §2.3 anticipated this exact mapping: a Prescription is simply a
`DoctorInstruction` with `instruction_type: 'medicine'`, not a separate entity. The
other three values (`lifestyle`, `investigation`, `follow_up`) cover every other kind of
clinical direction docs/09 names ("current goals, medicines, lifestyle guidance, doctor
instructions").

## Validation rules

- `patient_id`: required, non-empty.
- `care_plan_id`: required, non-empty, must reference an existing `CarePlan` row (any
  version) for the same `patient_id`.
- `instruction_type`: required, must be one of `medicine`/`lifestyle`/`investigation`/
  `follow_up`.
- `content`: required, non-empty (the instruction text itself).
- `prescribed_by`: required, non-empty (the doctor/staff identifier).
- `effective_date`: required, non-empty.
- Status-update operation: `instruction_id` must reference an existing, currently-
  `active` row (updating an unknown or already-closed `instruction_id` is rejected);
  the target `status` must be `discontinued` or `completed`.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly (not through the
generic error wrapper), the same convention every other entity's input validation
already follows.

## Fields at a glance

| Field | Set at creation? | Set at status update? | Mutable by patient? |
|---|---|---|---|
| `instruction_id` | Yes (server-generated UUID) | — | No |
| `patient_id` | Yes (doctor/staff-supplied) | — | No |
| `care_plan_id` | Yes (doctor/staff-supplied, validated) | — | No |
| `consultation_id` | `''` (disclosed sentinel) | — | No |
| `instruction_type` | Yes (doctor/staff-supplied, validated) | — | No |
| `content` | Yes (doctor/staff-supplied) | — | No |
| `prescribed_by` | Yes (doctor/staff-supplied) | — | No |
| `effective_date` | Yes (doctor/staff-supplied) | — | No |
| `status` | Yes (`'active'`) | Yes (`'discontinued'` or `'completed'`) | No |

## No patient write path — ever, in this batch

There is no create/update-status Web App route in `FoundationRouter.gs`. The only route
this batch adds for this entity is the read-only `get_doctor_instructions`. Creation and
status transitions remain manually-run Apps Script editor functions until a real,
authenticated Doctor/staff identity and session mechanism exists.

## Versioning

Schema version `1.0.0`. Any field addition, removal, or type change requires a new
version here first, then a subsequent update to `apps-script/DoctorInstruction.gs` —
never the reverse, per `shared/README.md`.
