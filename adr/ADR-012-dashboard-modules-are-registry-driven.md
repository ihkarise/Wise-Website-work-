# ADR-012: Patient Dashboard Capabilities Are Registry-Driven, With Per-Patient Enablement

## Status
Accepted

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
