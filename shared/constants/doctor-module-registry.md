# Doctor Module Registry

Explains `doctor-module-registry.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch WPI-3 (docs/50-PHASE-3-TECHNICAL-PLAN.md §7.1/§19/§22, ADR-020)

Phase 3/WHIMS's Pillar 2 (docs/49 §4) — a registry of available, doctor-facing
capabilities, structurally parallel to the Module Registry
(`module-registry.json`, ADR-012, "which capability is exposed") but a separate
registry, for a separate identity type (Doctor Identity, ADR-017), never merged with
the patient-facing one (ADR-020). This batch delivers the registry mechanism and
`DoctorModuleState` (`shared/schemas/doctor-module-state.schema.json`) — a generic,
pluggable enablement path any future doctor-facing capability can use without a code
change to either file, the same pluggability `module-registry.json`'s own PXP-3
precedent already established.

## Ships empty (Batch WPI-3) — first entry added (Batch WPI-4)

Unlike Module Registry (seeded with three already-implemented Phase 2A capabilities)
and Specialty Registry (seeded with one concrete `homeopathy` entry), Batch WPI-3
registered **zero** doctor-facing capabilities: no doctor-facing capability had a real,
authenticated `data_source` route to point at yet — every existing doctor-adjacent
backend function (condition assignment, care-plan authoring, module enablement) was
still a manually-run Apps Script editor tool, not a Web App route a Doctor Dashboard
card could call, and `get_doctor_profile` (Batch WPI-1) is an identity utility, not a
dashboard-card capability. That batch's own scope was the generic registry-and-state
mechanism only; no concrete capability descriptor was authored, reviewed, or shipped by
it.

**Batch WPI-4 (docs/50 §7.3/§7.4/§19)** adds this registry's first real entry:
`patient_roster` — the doctor's derived patient roster (docs/50 §7.4), backed by a new,
real, authenticated route, `DoctorPatientRoster.gs`'s `get_doctor_patient_roster`
(`FoundationRouter.gs`). This is also the Doctor Dashboard's (WPI-4) own first, and so
far only, registry-driven card. Every other illustrative capability named below
(condition assignment, care-plan authoring, module/calculator/template enablement,
inventory, PillFill orders, analytics) remains unregistered — each becomes real by a
later, separately-approved WPI batch adding its own registry entry here (docs/53 §4's "a
new registry entry is added by the batch that actually builds it"), the same "prove the
mechanism, let a later batch supply the first real instance" posture
`calculator-registry.json`'s own header comment already used for its own not-yet-built
calculators.

## Doctor Module Registry vs. Module Registry — two registries, one job, two audiences

Module Registry governs which capability a *patient* sees at all. Doctor Module
Registry governs which capability a *doctor* sees at all — structurally the same
question, deliberately answered by two separate registries rather than one shared one,
since Patient Identity and Doctor Identity are permanently separate (ADR-017) and a
shared registry would eventually force an identity-type branch into otherwise-generic
framework code, the exact kind of hardcoded conditional ADR-020 exists to prevent.

## Entry shape (docs/50 §7.1)

Each row in `capabilities` is shaped: `capability_key` (stable identifier —
illustrative examples named by docs/50 §7.1 include `patient_roster`,
`condition_assignment`, `care_plan_authoring`, `module_state_management`, `inventory`,
`pillfill_orders`, `analytics`; illustrative only, not a batch commitment, mirroring
docs/50 §7.1's own "not a batch commitment" framing — `patient_roster` is the one
promoted from illustrative to real by this batch), `display_name`, `display_order`
(integer, mirrors `module-registry.json`'s own field), `data_source` (loader key — the
doctor-facing route a Doctor Dashboard card calls, mirroring `module-registry.json`'s
own field), `specialty_scope` (optional — absent means visible regardless of
specialty, present means visible only to a doctor associated with that specialty,
ADR-018 §6.2; absent on `patient_roster`, since only one specialty exists today,
docs/50 §6.1), `future_ai_capable` (reserved, presently inert — mirrors
`module-registry.json`'s and `calculator-registry.json`'s own AI-readiness reservation,
ADR-019).

## Doctor Dashboard consumer (Batch WPI-4)

`doctor-dashboard/dashboard.js` is the registry-driven consumer this batch adds —
structurally parallel to `my-health-journey/dashboard.js`'s own post-PXP-4 discipline
(docs/50 §7.3): every card corresponds to a registry entry here the doctor is enabled
for (`DoctorModuleState`, per-doctor, staff-set — see doctor-module-state.md), with no
hardcoded per-capability rendering logic. `patient_roster` is this batch's one card;
adding a future capability means (i) add its registry entry here and to
`DoctorModuleRegistry.gs`, (ii) register its loader in `doctor-dashboard/dashboard.js`
— nothing else in the render path changes, mirroring the exact
Module-Registry-backend (PXP-3) / Dashboard-Registry-frontend (PXP-4) split precedent
already proven on the patient side.

## Versioning

Version `1.1.0` (bumped from `1.0.0` at Batch WPI-4 to add the `patient_roster` entry).
Adding a new capability (a new `capability_key` row) requires a new version here first,
then a subsequent update to `apps-script/DoctorModuleRegistry.gs`'s hand-ported copy —
never the reverse, per `shared/README.md`.
