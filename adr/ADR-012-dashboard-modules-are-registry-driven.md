# ADR-012: Patient Dashboard Capabilities Are Registry-Driven, With Per-Patient Enablement

## Status
Accepted. **Amended (2026-07-08):** a further architecture review elevated this ADR's
original "Future Considerations" question (whether existing Phase 2A cards should ever
migrate onto the registry) into a committed decision: "Patient dashboards should be
generated from enabled modules rather than fixed pages." The original Decision's
allowance that existing cards are "not required to migrate in the same batch" that
introduces the registry remains literally true — they migrate in the very next batch
(named "Dashboard Registry" in docs/44 §22), not the one that introduces the registry
itself — but migration itself is no longer optional or deferred indefinitely. See
docs/44 §7/§13 (Version 3.0) for the committed migration batch. The core Decision below
(registry-driven, per-patient-enabled modules) is unchanged; only the scope of what
migrates, and when, is resolved.

**Amended again (2026-07-10, Batch PXP-3 implementation):** this ADR's own title and
Context/Decision text frame the Module Registry as dashboard-specific infrastructure
("the patient dashboard is driven by a Module Registry"). PXP-3's implementation
generalizes that framing: the Module Registry is a platform-wide, data-driven
capability-exposure mechanism — module *availability* (the registry) and module
*enablement* (`PatientModuleState`) are decided once, generically, for any patient-
facing capability, not only ones a dashboard card renders. The patient dashboard (via
the still-unbuilt Dashboard Registry, PXP-4) remains this registry's first and, as of
PXP-3, its only implemented consumer — nothing about that changes. **Named, but
explicitly not scoped, batched, or authorized by this amendment:** Timeline, Personal
Care Plan, and a future AI system are disclosed as *potential* future consumers of the
same registry/`PatientModuleState` mechanism, the same "name a future consumer without
scoping it" discipline ADR-016 already established for its own six future template
categories. This amendment authorizes no new consumer, no new batch, and no behavior
change — `PatientModuleState`'s fail-closed absence-of-row default (this ADR's own
Decision, restated below) and docs/44 §14's "enablement is always an explicit doctor/
staff action" are both unchanged and unreopened. Only the registry's own descriptor
shape gains additional, purely additive, presently-inert metadata fields (display/
extensibility metadata, and a family of reserved `supports_*` capability flags mirroring
this ADR's own AI-readiness reservation) so that a genuinely new consumer, if one is
ever actually proposed, does not require a schema redesign — see
`shared/constants/module-registry.md` for the full, disclosed field list.

## Context
`my-health-journey/dashboard.js`'s `renderDashboard()` hardcodes exactly six cards by
name (Timeline, Symptoms, Reports, Care Plan, Messages, Digital Twin), each with its own
independently written preview-loader function and a manually chosen empty-state badge
(`nodata`/`phase2a`/`future`). There is no card registry, no config-driven list, and no
per-patient enablement check anywhere — adding a seventh capability today means writing
a seventh hardcoded function and manually choosing its badge, and every patient sees
every card regardless of whether it applies to them.

Phase 2B introduces Module Engine, Personalized Daily Check-ins, Calculator Framework,
and Personal Care Plan — four new capabilities that must appear on the dashboard — plus
an explicit product requirement (docs/44 §13) that some capabilities be enabled or
disabled per patient (e.g., a Calculator relevant only to one condition, a Care Plan
that only exists once a doctor has authored one). Continuing the hand-coded pattern
would mean the sixth, seventh, eighth, and ninth card each independently reinventing
enablement logic — the exact per-module reinvention ADR-009 already warns against for
backend modules, now surfacing at the dashboard layer.

## Decision
The patient dashboard is driven by a **Module Registry**: a single, versioned list of
module descriptors (module id, title, data-source action, empty-state behavior,
rendering shape) that `dashboard.js` iterates over, rather than a fixed sequence of
named function calls. Each patient's dashboard renders only the subset of registered
modules currently enabled for them, resolved from a per-patient enablement record
(`PatientModuleState`, docs/44 §16) that a doctor or staff member — never the patient
themself — can toggle.

A module's *availability* (does it exist as a platform capability at all) is separate
from its *enablement* (is it turned on for this specific patient) — the registry defines
the former, `PatientModuleState` the latter. A module absent from `PatientModuleState`
for a given patient defaults to disabled, not enabled — the same fail-closed default
ADR-010 already establishes for security decisions, applied here to feature exposure.

This does not require every existing card to be migrated in the same batch — Timeline,
Symptom Tracker, and Reports may continue to render through their existing hand-written
functions until a later batch migrates them, provided every *new* Phase 2B module is
built against the registry from the start (ADR-008: additive, reversible, no forced
rewrite of working, frozen Phase 2A code as a side effect of introducing a new pattern).

## Consequences
- A new schema/config surface (`PatientModuleState`, and a module-registry
  config/constants file analogous to `shared/constants/condition-slugs.json`) is
  required before any Phase 2B module ships.
- Enabling or disabling a capability per patient becomes a data change, not a code
  change — directly required for Doctor-Assigned Conditions to gate which modules
  (e.g., a condition-specific Calculator) a given patient sees.
- Slower to ship the very first registry-driven module than it would be to hand-code one
  more card — the same up-front-cost-for-later-leverage trade-off ADR-009 already
  accepted for backend modules.
- Existing Phase 2A cards are not required to migrate immediately; a future batch may
  migrate them for consistency, but that is a deliberate, separately-scoped decision,
  not a consequence of this ADR.

## Future Considerations
Once at least one existing Phase 2A card (Timeline, Symptom Tracker, or Reports) and at
least one new Phase 2B module both exist side by side, evaluate whether migrating the
former onto the registry is worth the (by-then well-understood) cost — do not decide
this speculatively now.
