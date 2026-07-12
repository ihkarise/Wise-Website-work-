# Doctor Module Registry

Explains `doctor-module-registry.json` (version `1.9.0`, the authoritative definition —
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

**Batch WPI-10 (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md §13, ADR-021/022/023)**
adds this registry's sixth real entry: `ai_assistant` — the platform's first
AI-generated-content doctor capability, backed by new, real, authenticated routes
(`AIAssistantContext.gs`'s `get_ai_assistant_capabilities`; `AIAssistantInteraction.gs`'s
`post_ai_assistant_query`/`post_ai_assistant_decision`). **Diverges from every prior
entry in exactly one way, per ADR-023:** this entry's own `DoctorModuleState` must
remain absent (fail-closed, ADR-010) for every doctor by default — enabling it is a
deliberate, disclosed, per-doctor administrative decision, never a bulk/default
rollout, unlike every prior entry's own "enable whenever convenient" treatment. Every
AI Assistant output is a non-persisting draft requiring doctor approval through the
target entity's own existing write path (ADR-022) — this registry entry only exposes
*that* capability; it grants AI Assistant no write authority of its own over any other
entity.

Every other illustrative capability named below (condition assignment, care-plan
authoring, module/calculator/template enablement) remains unregistered — each becomes
real by a later, separately-approved WPI batch adding its own registry entry here
(docs/53 §4's "a new registry entry is added by the batch that actually builds it"),
the same "prove the mechanism, let a later batch supply the first real instance"
posture `calculator-registry.json`'s own header comment already used for its own
not-yet-built calculators.

## Batch WPI-11 additions — `holoscan_review` and `medication_history` (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §18.2)

Adds this registry's seventh entry, `holoscan_review` — the platform's second
AI-output-review doctor capability (the first is `ai_assistant`, WPI-10), backed by a new,
real, authenticated route, `HoloscanRecognition.gs`'s `get_holoscan_review_queue`
(`FoundationRouter.gs`). **Diverges from every entry except `ai_assistant`, per
ADR-026:** this entry's own `DoctorModuleState` must remain absent (fail-closed,
ADR-010) for every doctor by default — enabling it is a deliberate, disclosed,
per-doctor administrative decision, never a bulk/default rollout.

Adds this registry's eighth entry, `medication_history` — a companion card to
`holoscan_review` (docs/56 §18.2/§19.3), reusing the Patient Roster card's own
patient-selection route for patient context (no new patient-lookup mechanism), backed
by `MedicationHistory.gs`'s dual-guarded `get_medication_history` route. Unlike
`holoscan_review`, this entry follows every other entry's own lighter-touch, normal
rollout convention (ADR-010's existing default only) — displaying an already
doctor-confirmed `MedicationHistory` record is not itself a model-output-review
surface, even though the record may have originated from an approved Holoscan
recognition.

## Batch PXP-11 addition — `milestone_review` (docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §18.2)

Adds this registry's ninth entry, `milestone_review` — the doctor-facing Health
Milestones authoring surface, reusing the Patient Roster card's own patient-selection
route for patient context (no new patient-lookup mechanism), backed by
`MilestoneReview.gs`'s roster-scoped `get_patient_milestones` route. Like
`medication_history` (and unlike `ai_assistant`/`holoscan_review`), this entry follows
every other entry's own **normal rollout** convention (ADR-010's existing
fail-closed-by-absence default only, `display_order: 90`) — it reviews **doctor-authored**
content, never model output, so there is no model-output-review risk to gate more tightly.
The feature is **non-AI** end to end (ADR-027); no new ADR governs this entry's rollout.

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
to real, by Batches WPI-4, WPI-5, WPI-7, WPI-8, and WPI-9 respectively; `ai_assistant`
is a sixth, not named by docs/50 §7.1 at all — named and designed instead by docs/55's
own dedicated architecture freeze, registered by Batch WPI-10), `display_name`,
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

Version `1.8.0` (bumped from `1.0.0` → `1.1.0` at Batch WPI-4 to add `patient_roster`;
→ `1.2.0` at Batch WPI-5 to add `appointments`; → `1.3.0` at Batch WPI-7 to add
`inventory`; → `1.4.0` at Batch WPI-8 to add `pillfill_orders`; → `1.5.0` at Batch
WPI-9 to add `analytics`; → `1.6.0` at Batch WPI-10 to add `ai_assistant`; → `1.8.0` at
Batch WPI-11 to add both `holoscan_review` and `medication_history` in the same batch, a
disclosed two-entries-in-one-version-bump). Adding a
new capability (a new `capability_key` row)
requires a new version here first, then a subsequent update to
`apps-script/DoctorModuleRegistry.gs`'s hand-ported copy — never the reverse, per
`shared/README.md`.
