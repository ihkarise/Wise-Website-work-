# Doctor Module State

Explains `doctor-module-state.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-3 (docs/50-PHASE-3-TECHNICAL-PLAN.md §7.2, §19, ADR-020)

Phase 3/WHIMS's Pillar 2 (docs/49 §4) per-doctor enablement mechanism, governed by
ADR-020 and docs/53-PHASE-3-IMPLEMENTATION-RULES.md. Paired with
`shared/constants/doctor-module-registry.json` (capability *availability*) — this
schema is capability *enablement*, a strictly separate concern, mirroring
`patient-module-state.schema.json`'s own relationship to `module-registry.json`
exactly, for the doctor identity space instead of the patient one.

## A separate registry and a separate enablement table — never merged with the patient-facing ones (ADR-020)

`DoctorModuleState` does not extend, alias, or share storage with
`PatientModuleState`. Patient-facing and doctor-facing capabilities are exposed to
different identity types (Patient Identity vs. Doctor Identity, ADR-017) and must
never be conflated — the same reasoning that keeps Doctor Identity itself permanently
separate from Patient Identity now applies one layer up, to each identity type's own
enablement table.

## Composite key — `state_key`, not a single `record_id`

Unlike `DoctorIdentity` (one row per doctor, keyed on its own `doctor_id`), this
entity is keyed on the pair `(doctor_id, capability_key)` — at most one row per pair,
patched in place on every subsequent enable/disable, the same upsert discipline
`PatientModuleState` already established for its own `(patient_id, module_id)` pair.
`apps-script/FoundationDataStore.gs`'s existing `foundationDsGetById_`/
`foundationDsUpdateById_` operate on a single `idColumn`, and that file is frozen
(touched only for a genuine, disclosed bug fix, per docs/53 §6) — so rather than
special-case a composite key into that shared primitive, this schema adds its own
`state_key` field: a **server-derived, deterministic** string,
`doctor_id + '::' + capability_key`, never staff-supplied and never doctor-visible.
`apps-script/DoctorModuleState.gs` uses `state_key` as the `idColumn` for
`foundationDsGetById_`/`foundationDsUpdateById_`, and `doctor_id` alone (via
`foundationDsQuery_`) for the list route — no new Data Store primitive was added
(docs/53 §6's "additive changes" discipline: reuse what exists).

## Fail-closed absence — the one rule this entity exists to enforce

**No row for a given `(doctor_id, capability_key)` means that capability is disabled
for that doctor.** This is not a default value written into a row — it is the
*absence* of a row entirely, exactly ADR-010's "the safer behavior is the default, not
an opt-in," applied here to doctor-facing capability exposure (docs/50 §7.2's own
words, restated at the schema level). Never automatic from `Doctor.role` or
`Doctor.specialty_slug` alone (docs/50 §7.2, mirroring docs/44 §14's "never automatic
from a condition assignment" rule, applied here to role/specialty instead of
condition). `foundationGetDoctorModuleStates_()` is the one function responsible for
presenting this correctly: it merges the full Doctor Module Registry's capability list
with whatever rows actually exist, so a consumer never has to remember to treat
"missing row" as "disabled" itself.

## Registry ships empty in this batch — a disclosed, inherited constraint

`shared/constants/doctor-module-registry.json` ships with zero entries in Batch WPI-3
(see that file's own `.md` for the full "ships empty" disclosure, mirroring
`calculator-registry.json`'s own precedent). Consequently,
`foundationValidateSetDoctorModuleStateInput_()`'s `capability_key` check —
"must be one of the registered Doctor Module Registry capability_key values" — is
impossible to satisfy today: every real write is rejected until a future batch
registers the first real capability, the same fail-closed-by-absence discipline
`calculator-result.md`'s own validation-rules section already discloses for
`CalculatorResult` against an empty `CalculatorRegistry`. This is a deliberate,
disclosed consequence of shipping the mechanism ahead of any concrete capability, not
a defect — `foundationGetDoctorModuleStates_()` still works correctly against a doctor
with zero real rows, returning zero synthesized entries (an empty registry has no
capabilities to synthesize defaults for).

## Staff-only — no doctor self-service write path

Every write (`foundationSetDoctorModuleState_()`) is a staff/administrative action.
Mirrors `apps-script/PatientModuleState.gs`'s own `setFoundationModuleState()`
precedent exactly: the enable/disable tool is a manually-run Apps Script editor
function (`setFoundationDoctorModuleState()`), not a new authenticated Web App route —
the same "administrative provisioning stays off the authenticated surface" discipline
`createFoundationDoctor()` already established for Doctor Identity itself, applied
here to capability enablement. The one doctor-facing surface this batch adds is a
read-only route (`FoundationRouter.gs`'s `get_doctor_module_states`), deriving
`doctor_id` exclusively from the verified `DoctorSession` — the same authorization
primitive every other Foundation read route already uses.

## No dashboard consumer in this batch — a disclosed scope boundary

`get_doctor_module_states` returns data today with no UI reading it — no doctor-facing
HTML page is added by this batch. The Doctor Dashboard batch (WPI-4) is the planned,
already-approved-in-principle place this becomes visible to a doctor, mirroring the
exact Module-Registry-backend (PXP-3) / Dashboard-Registry-frontend (PXP-4) split
precedent already proven on the patient side.

## Validation rules

- `doctor_id`: required, non-empty string.
- `capability_key`: required, must be one of `shared/constants/
  doctor-module-registry.json`'s canonical `capability_key` values (hand-ported into
  `apps-script/DoctorModuleRegistry.gs`'s own allowlist, mirroring
  `PatientModuleState.gs`'s `module_id` allowlist convention exactly) — impossible to
  satisfy today, since the registry ships empty (see "Registry ships empty" above).
- `enabled`: required, boolean.
- `enabled_by`: required, non-empty string (the staff identifier performing this
  write).

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other entity's input validation already follows.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `state_key` | Yes (server-derived: `doctor_id + '::' + capability_key`) | No |
| `doctor_id` | Yes (staff-supplied at write time; session-derived at read time) | No |
| `capability_key` | Yes (staff-supplied, validated against the registry) | No |
| `enabled` | Yes | Yes — by a subsequent staff write only |
| `enabled_by` | Yes | Yes — overwritten on every subsequent write with the newest actor |
| `enabled_at` | Yes (server-set) | Yes — overwritten on every subsequent write with the newest timestamp |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/DoctorModuleState.gs` — never the
reverse, per `shared/README.md`.
