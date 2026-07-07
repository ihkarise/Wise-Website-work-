# Module Registry

Explains `module-registry.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-3 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §7.1/§17/§22)

Phase 2B's Pillar 2 (docs/44 §4.1) — the platform's only mechanism for *exposing* a
capability to a patient, per ADR-012 (amended twice, most recently for this batch — see
the ADR's own amendment note). This batch delivers the registry and per-patient
enablement (`PatientModuleState`, `shared/schemas/patient-module-state.schema.json`)
only. **No dashboard rendering change ships in this batch** — `my-health-journey/
dashboard.js` is untouched; migrating its rendering onto this registry is the Dashboard
Registry batch (PXP-4), not this one.

## Availability vs. enablement — two separate concerns

This file defines *availability*: which modules exist as platform capabilities at all,
and their display/behavioral metadata. It says nothing about which patient sees which
module — that is `PatientModuleState`'s job, a per-patient, doctor/staff-written Sheet
row, absent-by-default (fail-closed, ADR-010, docs/44 §7.2/§14). A module listed here
is not automatically enabled for anyone.

## Generalized beyond "dashboard cards" (ADR-012's 2026-07-10 amendment)

Earlier framing (ADR-012's original Decision) described this registry as dashboard
infrastructure specifically. This batch's implementation generalizes that framing,
disclosed as an ADR-012 amendment: the registry is a platform-wide, data-driven
capability-exposure mechanism. The patient dashboard (via the still-unbuilt PXP-4)
remains its first and, as of this batch, its **only** implemented consumer — Timeline,
Personal Care Plan, and a future AI system are named in the ADR amendment as
*potential* future consumers of this same registry, the same "name it, do not scope
it" discipline ADR-016 already used for its own six future template categories. No new
consumer is built, wired, or authorized by this disclosure.

## Seeded modules — only what already exists

This batch seeds the registry with descriptors for the three already-implemented Phase
2A capabilities (Timeline, Symptom Tracker, Reports) — giving the future Dashboard
Registry batch (PXP-4) real rows to migrate onto, per ADR-012's own amendment history.
**Daily Check-ins, Calculators, and Personal Care Plan are deliberately not seeded
here** — inventing their `data_source`/shape now would front-run design decisions that
belong to their own future batches (PXP-5, PXP-6, PXP-7 respectively, per docs/47 §4:
"a new module ... is added by registering a new registry entry" — by the batch that
actually builds it). This mirrors `shared/constants/condition-slugs.json`'s own
"populate a real consumer, not a hypothetical one" discipline.

## Fields at a glance

| Field | Consumed by any code in PXP-3? | Purpose |
|---|---|---|
| `module_id` | Yes | Stable key; the only field `PatientModuleState` (docs/44 §7.2) references. |
| `title` | No (config only) | Human-readable display name for a future dashboard/consumer. |
| `description` | No (config only) | One-line explanation of the capability, for a future consumer UI. |
| `icon` | No (config only) | A future consumer's icon-selection key; no icon asset pipeline exists yet. |
| `display_order` | No (config only) | A future consumer's sort hint; no renderer reads this in PXP-3. |
| `visibility` | No (reserved) | `"patient"` (only value used today) vs. a reserved `"internal"` value for a possible future staff-facing consumer of this same registry — inert until such a consumer exists. |
| `permissions` | No (reserved) | Reserved for future per-module RBAC once a real Doctor/staff identity and role system exists (docs/33 §1.4, a disclosed gap) — always `[]` today. Does not affect who may write a `PatientModuleState` row: that write path is doctor/staff-only for every module, unconditionally, per docs/44 §14, regardless of this field's value. |
| `data_source` | No (config only) | The `foundation_action` a future consumer would call for this module's data. Already-live actions for the three seeded modules (`get_timeline`, `get_symptom_logs`, `get_reports`) — no new dispatch case is added by this batch. |
| `empty_state` | No (config only) | Mirrors `dashboard.js`'s existing empty-state badge vocabulary (`nodata`/`phase2a`/`future`, per ADR-012's Context) — a future PXP-4 consumer's own concern to read. |
| `rendering_type` | No (config only) | Reserved rendering-shape hint (`"card"` is the only value used today, matching every existing dashboard card's shape). |
| `future_ai_capable` | No (reserved, inert) | The exact reserved AI-compatibility field docs/44 §7.1/§15 requires every Module Registry descriptor to carry. No AI behavior exists; any eventual use is independently gated by ADR-001/004/005 (docs/44 §15), never by this field alone. |
| `supports_notifications` | No (reserved, inert) | Whether this module could someday raise a notification. No `Notification` entity exists yet (docs/33 §4.2, a disclosed gap) — purely a future extension point. |
| `supports_history` | No (reserved, inert) | Whether this module has a browsable history view (all three seeded modules do, today, via their own existing pages — this field does not drive that; it is metadata only). |
| `supports_export` | No (reserved, inert) | Whether this module could someday support a patient-initiated data export. |
| `supports_badges` | No (reserved, inert) | Whether this module could someday show an unread/pending-count badge. |
| `supports_reminders` | No (reserved, inert) | Whether this module could someday support a scheduled reminder. |
| `supports_ai` | No (reserved, inert) | A broader "could this module ever have an AI-driven interaction" flag, distinct from `future_ai_capable`'s narrower "AI-generated explanatory text" framing (docs/44 §7.1) — both reserved, both inert, neither implemented. |
| `supports_doctor_notes` | No (reserved, inert) | Whether this module could someday carry doctor-authored annotations distinct from its own primary content. |
| `supports_patient_input` | No (reserved, inert) | Whether this module accepts patient-submitted data at all (documentation-accurate today — Symptom Tracker and Reports do, Timeline does not — but not consumed by any authorization check; `FoundationRouteGuard.gs`'s session-derived authorization remains the sole real gate). |

**A field explicitly considered and left out: `enabled_by_default`.** Its name risks
being misread as overriding `PatientModuleState`'s fail-closed, absence-means-disabled
default (ADR-010, docs/44 §7.2) or docs/44 §14's locked "enablement is always an
explicit doctor/staff action, never automatic" rule — neither of which this batch
reopens. Omitted rather than shipped as a footgun; revisit only if a future batch (e.g.,
a doctor-facing admin UI) has a genuine need for a default-checkbox hint, and only with
that need's own explicit disclosure of how it stays advisory-only.

## No AI/calculator/care-plan behavior implemented

Every `supports_*`/`future_ai_capable` flag above is a reserved extension point only —
consumed by zero code in this batch, exactly like docs/44 §7.1's own AI-readiness
field. Adding real behavior behind any of them requires its own future, separately-
proposed and separately-approved batch (docs/44 §15 for anything AI-touching; ADR-013
if it ever touches a Calculator result).

## Versioning

Version `1.0.0`. Adding a new module descriptor (a new capability's own future batch)
or a new metadata field both require a new version here first, then updating
`apps-script/ModuleRegistry.gs`'s hand-ported copy — never the reverse, per
`shared/README.md`.
