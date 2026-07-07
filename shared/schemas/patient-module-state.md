# Patient Module State

Explains `patient-module-state.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch PXP-3 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §7.2, §22)

Phase 2B's Pillar 2 (docs/44 §4.1) per-patient enablement mechanism, governed by
ADR-012 (amended twice) and docs/47-PHASE-2B-IMPLEMENTATION-RULES.md. Paired with
`shared/constants/module-registry.json` (module *availability*) — this schema is module
*enablement*, a strictly separate concern.

## Composite key — `state_key`, not a single `record_id`

Unlike `DoctorAssignedCondition` (many-per-patient, its own random-UUID
`assignment_id`), this entity is keyed on the pair `(patient_id, module_id)` — at most
one row per pair, patched in place on every subsequent enable/disable, the same upsert
discipline `PatientProfile` already established for its own `patient_id`-only key.
`apps-script/FoundationDataStore.gs`'s existing `foundationDsGetById_`/
`foundationDsUpdateById_` operate on a single `idColumn`, and that file is frozen
(touched only for a genuine, disclosed bug fix, per docs/47 §6) — so rather than
special-case a composite key into that shared primitive, this schema adds its own
`state_key` field: a **server-derived, deterministic** string,
`patient_id + '::' + module_id`, never doctor/staff-supplied and never patient-visible.
`apps-script/PatientModuleState.gs` uses `state_key` as the `idColumn` for
`foundationDsGetById_`/`foundationDsUpdateById_`, and `patient_id` alone (via
`foundationDsQuery_`) for the list route — no new Data Store primitive was added
(docs/47 §6's "additive changes" discipline: reuse what exists). Deliberately
deterministic rather than a random UUID: recomputing it from `patient_id`/`module_id`
always yields the same value, so there is no drift risk between it and the two natural
columns it is derived from — a doctor/staff caller never supplies or edits it directly.

## Fail-closed absence — the one rule this entity exists to enforce

**No row for a given `(patient_id, module_id)` means that module is disabled for that
patient.** This is not a default value written into a row — it is the *absence* of a
row entirely, exactly ADR-010's "the safer behavior is the default, not an opt-in,"
applied here to feature exposure (docs/44 §7.2's own words, restated at the schema
level). `foundationGetPatientModuleStates_()` is the one function responsible for
presenting this correctly: it merges the full registry's module list with whatever rows
actually exist, so a consumer never has to remember to treat "missing row" as
"disabled" itself.

## Doctor/staff-only — no patient write path, mirroring DoctorAssignedCondition

Every write (`foundationSetModuleState_()`) is a doctor/staff action. No real Doctor
identity/authentication exists yet (docs/33 §1.4, the same disclosed gap
`DoctorAssignedCondition.gs` already carries), so — mirroring that file's own
`assignFoundationCondition()`/`resolveFoundationCondition()` precedent exactly — the
enable/disable tool is a manually-run Apps Script editor function
(`setFoundationModuleState()`), not a new authenticated Web App route. The one
patient-facing surface this batch adds is a read-only route
(`FoundationRouter.gs`'s `get_patient_module_states`), deriving `patient_id` exclusively
from the verified session — the same authorization primitive every other Foundation
read route already uses.

## No dashboard consumer in this batch — a disclosed scope boundary

`get_patient_module_states` returns data today with no UI reading it —
`my-health-journey/dashboard.js` is untouched by this batch (docs/44 §22's own PXP-3
row: "no dashboard rendering change yet"). The Dashboard Registry batch (PXP-4) is the
planned, already-approved-in-principle place this becomes visible to a patient.

## Validation rules

- `patient_id`: required, non-empty string.
- `module_id`: required, must be one of `shared/constants/module-registry.json`'s
  canonical `module_id` values (hand-ported into
  `apps-script/PatientModuleState.gs`'s own allowlist, mirroring
  `DoctorAssignedCondition.gs`'s `condition_slug` allowlist convention exactly).
- `enabled`: required, boolean.
- `enabled_by`: required, non-empty string (the doctor/staff identifier performing this
  write).

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other entity's input validation already follows.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `state_key` | Yes (server-derived: `patient_id + '::' + module_id`) | No |
| `patient_id` | Yes (doctor/staff-supplied at write time; session-derived at read time) | No |
| `module_id` | Yes (doctor/staff-supplied, validated against the registry) | No |
| `enabled` | Yes | Yes — by a subsequent doctor/staff write only |
| `enabled_by` | Yes | Yes — overwritten on every subsequent write with the newest actor |
| `enabled_at` | Yes (server-set) | Yes — overwritten on every subsequent write with the newest timestamp |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/PatientModuleState.gs` — never the
reverse, per `shared/README.md`.
