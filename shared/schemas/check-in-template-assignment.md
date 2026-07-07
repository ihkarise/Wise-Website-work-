# Check-In Template Assignment

Explains `check-in-template-assignment.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch PXP-5 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §10.2, §11, §22)

## Why this entity exists — a disclosed, additive gap-fill

docs/44 §10.2 settles that "a doctor explicitly assigns which template(s) apply" to a
patient, informed by (never automatically derived from) their `DoctorAssignedCondition`
rows — "rather than the system auto-resolving a conflict when a patient has more than
one active condition." Neither docs/44 §17's entity table nor docs/33 §6.5 names a
persisted shape for that assignment decision itself; only `CheckInTemplate` (the
registry row) and `CheckInResponse` (the patient's answers) are named there.

Without a persisted assignment, "a doctor explicitly assigns" has nothing to record a
decision into, and `apps-script/CheckInResponse.gs`'s own write path has no way to
verify a patient is actually assigned the `template_id` they are submitting against
(as opposed to merely verifying the `template_id` exists in the registry at all — a much
weaker check that would let any patient submit against any template). This entity is
the minimal, disclosed fix: an exact structural mirror of
`doctor-assigned-condition.schema.json`'s own already-twice-approved shape (many-per-
patient, append-mostly, doctor/staff-only, one-way resolve), not a new pattern, a new
registry, or a new ADR. Per docs/47 §6's "no hidden architecture changes" rule, this
gap and its fix are disclosed here, in `apps-script/CheckInTemplateAssignment.gs`'s own
header comment, in `shared/constants/template-registry.md`'s "Doctor assignment"
section, and in this batch's PR description — not left implicit.

## Assignment names a template, not a version

`template_id` alone is stored — never `template_version`. An assignment is a doctor's
decision about *which template* a patient uses, not a decision to pin them to a
specific edit of it. `apps-script/CheckInTemplateAssignment.gs`'s
`foundationGetCurrentCheckInTemplateForPatient_()` always resolves an active assignment
to that `template_id`'s **latest active** Template Registry version (docs/44 §11.4) —
the same reasoning `patient-module-state.md` already applies to module *enablement*
being separate from module *availability* detail. Only a recorded `CheckInResponse` row
pins a specific `(template_id, template_version)` pair, permanently, per docs/44 §11.4.

## Doctor/staff-only — no patient write path, mirroring DoctorAssignedCondition

Every write (`foundationAssignCheckInTemplate_()`/
`foundationResolveCheckInTemplateAssignment_()`) is a doctor/staff action. No real
Doctor identity/authentication exists yet (docs/33 §1.4, the same disclosed gap
`DoctorAssignedCondition.gs` already carries), so — mirroring that file's own
`assignFoundationCondition()`/`resolveFoundationCondition()` precedent exactly — the
assignment/resolution tool is a manually-run Apps Script editor function
(`assignFoundationCheckInTemplate()`/`resolveFoundationCheckInTemplateAssignment()`),
not a new authenticated Web App route.

## No direct patient-facing read route for this entity

Unlike `DoctorAssignedCondition`, this entity has no `get_check_in_template_assignments`
route of its own. A patient's current template is resolved *indirectly*, through
`foundationGetCurrentCheckInTemplateForPatient_()`, exposed as `FoundationRouter.gs`'s
`get_checkin_template` route — a patient learns *what template they should fill out
today*, never the raw assignment/audit-trail row shape this schema describes.

## Validation rules

- `patient_id`: required, non-empty string.
- `template_id`: required, must be one of `shared/constants/template-registry.json`'s
  canonical `template_id` values (hand-ported into
  `apps-script/TemplateRegistry.gs`'s own `foundationGetRegisteredTemplateIds_()`
  allowlist).
- `assigned_by`: required, non-empty string (the doctor/staff identifier performing
  this write).
- A resolve operation additionally requires `assignment_id` (must reference an
  existing, currently-`active` row) and `resolved_by`.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other Foundation entity's input validation already follows.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to
`apps-script/CheckInTemplateAssignment.gs` — never the reverse, per
`shared/README.md`.
