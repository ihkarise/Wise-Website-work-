# Doctor Module Registry

Explains `doctor-module-registry.json` (version `1.5.0`, the authoritative definition —
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
(`FoundationRouter.gs`). This is also the Doctor Dashboard's (WPI-4) own first
registry-driven card.

**Batch WPI-5 (docs/50 §8/§19)** adds this registry's second real entry: `appointments`
— the doctor's specialty-derived Appointments view (docs/50 §8), backed by a new, real,
authenticated route, `Appointment.gs`'s `get_doctor_appointments` (`FoundationRouter.gs`).
*(Disclosed correction: this paragraph was not added when Batch WPI-5 actually shipped —
the JSON file and `apps-script/DoctorModuleRegistry.gs` were both correctly updated to
1.2.0 at the time, but this companion `.md` was left describing only Batch WPI-3/WPI-4's
state until Batch WPI-7's own repository consistency review, §14, caught the drift. No
entity's shape, schema, or shipped behavior was ever incorrect — only this explanatory
document's own currency.)*

**Batch WPI-7 (docs/50 §10/§19)** adds this registry's third real entry: `inventory` —
the doctor's specialty-scoped `InventoryItem` stock-level view (docs/50 §10), backed by
a new, real, authenticated route, `InventoryItem.gs`'s `get_inventory_items`
(`FoundationRouter.gs`).

**Batch WPI-8 (docs/50 §11/§19)** adds this registry's fourth real entry:
`pillfill_orders` — the doctor's specialty-scoped `PillFillOrder` view (docs/50 §11,
specialty derived via each order's own referenced `InventoryItem`, since `PillFillOrder`
carries no `specialty_slug` of its own), backed by a new, real, authenticated route,
`PillFillOrder.gs`'s `get_pillfill_orders` (`FoundationRouter.gs`).

**Batch WPI-9 (docs/50 §12/§19)** adds this registry's fifth real entry: `analytics` —
the doctor's specialty-scoped, deterministic aggregate report (docs/50 §12; never a
stored entity, never an AI-generated interpretation, bounded to a fixed trailing
30-day window per docs/54 §18 item 4), backed by a new, real, authenticated route,
`Analytics.gs`'s `get_doctor_analytics` (`FoundationRouter.gs`).

Every other illustrative capability named below (condition assignment, care-plan
authoring, module/calculator/template enablement) remains unregistered — each becomes
real by a later, separately-approved WPI batch adding its own registry entry here
(docs/53 §4's "a new registry entry is added by the batch that actually builds it"),
the same "prove the mechanism, let a later batch supply the first real instance"
posture `calculator-registry.json`'s own header comment already used for its own
not-yet-built calculators.

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
docs/50 §7.1's own "not a batch commitment" framing — `patient_roster`, `appointments`,
`inventory`, `pillfill_orders`, and `analytics` are the five promoted from illustrative
to real, by Batches WPI-4, WPI-5, WPI-7, WPI-8, and WPI-9 respectively), `display_name`,
`display_order` (integer, mirrors `module-registry.json`'s own field), `data_source`
(loader key — the doctor-facing route a Doctor Dashboard card calls, mirroring
`module-registry.json`'s own field), `specialty_scope` (optional — absent means visible
regardless of specialty, present means visible only to a doctor associated with that
specialty, ADR-018 §6.2; absent on all five real entries so far, since only one
specialty exists today, docs/50 §6.1), `future_ai_capable` (reserved, presently inert —
mirrors `module-registry.json`'s and `calculator-registry.json`'s own AI-readiness
reservation, ADR-019).

## Doctor Dashboard consumer (Batches WPI-4, WPI-5, WPI-7, WPI-8, WPI-9)

`doctor-dashboard/dashboard.js` is the registry-driven consumer Batch WPI-4 added —
structurally parallel to `my-health-journey/dashboard.js`'s own post-PXP-4 discipline
(docs/50 §7.3): every card corresponds to a registry entry here the doctor is enabled
for (`DoctorModuleState`, per-doctor, staff-set — see doctor-module-state.md), with no
hardcoded per-capability rendering logic. `patient_roster` (WPI-4), `appointments`
(WPI-5), `inventory` (WPI-7), `pillfill_orders` (WPI-8), and `analytics` (WPI-9) are
this registry's five cards so far; adding a future capability means (i) add its
registry entry here and to `DoctorModuleRegistry.gs`, (ii) register its loader in
`doctor-dashboard/dashboard.js` — nothing else in the render path changes, mirroring
the exact Module-Registry-backend (PXP-3) / Dashboard-Registry-frontend (PXP-4) split
precedent already proven on the patient side.

## Versioning

Version `1.5.0` (bumped from `1.0.0` → `1.1.0` at Batch WPI-4 to add `patient_roster`;
→ `1.2.0` at Batch WPI-5 to add `appointments`; → `1.3.0` at Batch WPI-7 to add
`inventory`; → `1.4.0` at Batch WPI-8 to add `pillfill_orders`; → `1.5.0` at Batch
WPI-9 to add `analytics`). Adding a new capability (a new `capability_key` row)
requires a new version here first, then a subsequent update to
`apps-script/DoctorModuleRegistry.gs`'s hand-ported copy — never the reverse, per
`shared/README.md`.
