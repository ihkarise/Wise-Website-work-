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

## Ships empty — a deliberate, disclosed scope decision

Unlike Module Registry (seeded with three already-implemented Phase 2A capabilities)
and Specialty Registry (seeded with one concrete `homeopathy` entry), this batch
registers **zero** doctor-facing capabilities. As of this batch, no doctor-facing
capability has a real, authenticated `data_source` route to point at — every existing
doctor-adjacent backend function (condition assignment, care-plan authoring, module
enablement) is still a manually-run Apps Script editor tool, not a Web App route a
Doctor Dashboard card could call, and `get_doctor_profile` (Batch WPI-1) is an
identity utility, not a dashboard-card capability. This batch's own scope is the
generic registry-and-state mechanism only; no concrete capability descriptor is
authored, reviewed, or shipped by it. A future capability becomes real by a later,
separately-approved WPI batch adding its own registry entry here (docs/53 §4's "a new
registry entry is added by the batch that actually builds it") — this file's own shape
is already complete and ready for that entry to slot into, exactly the same "prove the
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

## Entry shape — once a future batch adds one (docs/50 §7.1)

Each row in `capabilities` (once a future batch adds one) is shaped:
`capability_key` (stable identifier — illustrative examples named by docs/50 §7.1
include `patient_roster`, `condition_assignment`, `care_plan_authoring`,
`module_state_management`, `inventory`, `pillfill_orders`, `analytics`; illustrative
only, not a batch commitment, mirroring docs/50 §7.1's own "not a batch commitment"
framing), `display_name`, `display_order` (integer, mirrors `module-registry.json`'s
own field), `data_source` (loader key — the doctor-facing route a future Doctor
Dashboard card calls, mirroring `module-registry.json`'s own field), `specialty_scope`
(optional — absent means visible regardless of specialty, present means visible only
to a doctor associated with that specialty, ADR-018 §6.2), `future_ai_capable`
(reserved, presently inert — mirrors `module-registry.json`'s and
`calculator-registry.json`'s own AI-readiness reservation, ADR-019).

## No Doctor Dashboard consumer in this batch

Deliberately deferred: this batch does not build any doctor-facing HTML page — a
disclosed, explicit scope boundary matching docs/50 §19's own WPI-3 (backend) / WPI-4
(Doctor Dashboard, frontend consumer) split. The registry-and-state mechanism ships
first; doctor-facing rendering is a later, separately-scoped batch once at least one
real capability exists to render, mirroring the exact
Module-Registry-backend (PXP-3) / Dashboard-Registry-frontend (PXP-4) split precedent
already proven on the patient side, and `calculator-registry.md`'s own analogous "No
Module Registry entry, no dashboard UI in this batch" section.

## Versioning

Version `1.0.0`. Adding a new capability (a new `capability_key` row) requires a new
version here first, then a subsequent update to
`apps-script/DoctorModuleRegistry.gs`'s hand-ported copy — never the reverse, per
`shared/README.md`.
