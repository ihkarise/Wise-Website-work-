# Module Registry

Explains `module-registry.json` (version `1.3.0` as of Batch PXP-11, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

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

Batch PXP-3 seeded the registry with descriptors for the three already-implemented
Phase 2A capabilities (Timeline, Symptom Tracker, Reports) — giving the Dashboard
Registry batch (PXP-4) real rows to migrate onto, per ADR-012's own amendment history.
**Calculators remain deliberately not seeded here** — inventing its `data_source`/shape
now would front-run a design decision that belongs to its own future batch (per docs/47
§4: "a new module ... is added by registering a new registry entry" — by the batch that
actually builds it). This mirrors `shared/constants/condition-slugs.json`'s own
"populate a real consumer, not a hypothetical one" discipline. Personal Care Plan was
seeded once its own batch (PXP-7) actually designed and built it — see below.

## Batch PXP-5 addition — `daily_checkin` (2026-07-12)

The Daily Check-in Engine (docs/44 §10/§11/§22) registers its own module here,
exactly the growth pattern this file's own header already anticipated — the three
PXP-3 rows above are untouched. `data_source: "get_checkin_responses"` mirrors
`symptom_tracker`'s own convention: the module's "preview" call is its
response-history list; the dashboard card's own form additionally calls
`get_checkin_template` (to know what to render — see
`shared/schemas/check-in-response.md`) and `submit_checkin_response` (to write)
directly, the same way the Symptom Tracker card calls `log_symptom` beyond its own
`data_source`. `display_order: 15` places it between Timeline (10) and Symptom
Tracker (20) — a same-day "something to do today" action ordered ahead of the two
existing self-report history cards.

## Batch PXP-7 addition — `care_plan` (2026-07-14)

The Personal Care Plan capability (docs/44 §12/§22) registers its own module here,
the same growth pattern PXP-5's `daily_checkin` addition already used — every earlier
row is untouched. `data_source: "get_care_plan"` mirrors `daily_checkin`'s own
convention: the module's "preview" call is the patient's current plan summary; the
dashboard card's own view additionally calls `get_doctor_instructions` directly (to
show the plan's attached instructions), the same way the Daily Check-in card calls
`get_checkin_template` beyond its own `data_source`. `display_order: 40` places it
after Reports (30) — read-only, doctor-authored content ordered after every card with
a patient write affordance. `supports_doctor_notes: true` is set for the first time by
any registry entry (documentation-accurate — this module's entire content is
doctor-authored — but still not consumed by any authorization check, per this file's
own "reserved, inert" discipline for every `supports_*` field).

## Batch PXP-10 removal — `symptom_tracker` (2026-07-15)

Symptom Tracker Migration (docs/44 §10.1/§22, docs/47) removes the `symptom_tracker`
entry seeded by Batch PXP-3 above — the growth pattern this file's header always
anticipated, run in reverse for the first time. **Depends on Daily Check-in (PXP-5)
proven in production first**, per docs/44 §22's own PXP-10 row — satisfied, since PXP-5
shipped and merged (docs/33 §6.5).

**What "dashboard entry removed" means concretely:** the `symptom_tracker` descriptor
is deleted from all three hand-ported copies (this canonical JSON,
`apps-script/ModuleRegistry.gs`'s `FOUNDATION_MODULE_REGISTRY_`, and
`my-health-journey/dashboard.js`'s own `MODULE_REGISTRY`) — the same "update all three
ports by hand" discipline this file's own header already named. Since the dashboard has
been fully registry-driven since Batch PXP-4, removing the entry is sufficient on its
own to stop the card from rendering for every patient; no change to
`renderDashboard()`/`filterEnabledModules()`/`dispatchLoaders()` is needed or made.
Dead card-rendering code specific to Symptom Tracker's own quick-log form
(`symptomFormHtml`/`symptomSummaryHtml`/`refreshSymptomSummary`/`wireSymptomForm`/
`loadSymptomPreview`/`CONDITION_OPTIONS`/`conditionOptionsHtml`) is removed from
`dashboard.js` in the same change, along with its `MODULE_LOADERS['get_symptom_logs']`
registration.

**What "endpoints deprecated" means concretely:** `log_symptom`/`get_symptom_logs`
(`apps-script/FoundationSymptomLog.gs`, `FoundationRouter.gs`'s existing dispatch
cases) are **not** modified — zero lines changed in either frozen Phase 2A file,
mirroring Batch PXP-8's "zero lines changed in `FoundationSession.gs`" discipline. Both
routes remain fully functional (no breaking API change, docs/47 §6) so a patient who
still has the standalone Symptom History page open, or any future staff tool, can keep
reading (and, if reached directly, writing) `SymptomLogs` rows — only the *registry
availability* that made the route reachable from the dashboard's own card is retired.
The deprecation itself is recorded as a documentation disclosure —
`shared/schemas/symptom-log.md`'s own "Deprecated (Batch PXP-10)" section — not a code
change to either endpoint.

**What is explicitly *not* removed:** `SymptomLogs` rows (never deleted, per docs/44
§10.1/§19) and the standalone Symptom History page
(`my-health-journey/symptoms/index.html`, `symptoms.js`) — both remain fully
functional, reachable by direct URL. This is a disclosed, deliberate scope boundary,
the same category of decision `care-plan.md`'s own "Disclosed, deliberate scope
decision" section already used: the page is now orphaned from dashboard navigation
(its own "View full history" link lived inside the now-removed Symptom Tracker card),
but deleting a page that still serves a patient's own permanent historical data would
be a strictly larger, unrequested change than docs/44 §22's own three-item PXP-10
scope ("dashboard entry removed, endpoints deprecated, SymptomLogs retained") names.

## Batch WPI-11 addition — `holoscan` (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §18.1)

The patient-facing Holoscan photo-capture card registers its own module here — every
earlier row is untouched. `data_source: "get_holoscan_recognitions"` mirrors `reports`'s
own convention: the module's "preview" call is its recognition-history list; the
dashboard card's own upload form additionally calls `submit_holoscan_recognition`
directly, the same way the Reports card calls `upload_report` beyond its own
`data_source`. `display_order: 20` places it between Daily Check-in (15) and Reports
(30). Fail-closed by `PatientModuleState` absence — the same default every existing
entry already has (ADR-010); no new ADR is required for this half (ADR-026 governs only
the doctor-facing `holoscan_review` entry's own, heavier rollout discipline,
`doctor-module-registry.md`).

## Batch PXP-11 addition — `health_milestones` (docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §18.1)

The patient-facing Health Milestones card registers its own module here — every earlier
row is untouched. `data_source: "get_health_milestones"` returns the caller's own computed
milestone schedule plus published reviews only (read-only — the card has no write
affordance at all, like `care_plan`). `display_order: 45` places it just after Care Plan
(40). Fail-closed by `PatientModuleState` absence — the same default every existing entry
already has (ADR-010); no new ADR is required (ADR-027 governs the feature's non-AI
boundary, not this entry's rollout). `supports_ai: false` — Health Milestones is the
platform's deliberately **non-AI** patient-progress feature (ADR-027, docs/33 §3.5's Phase
2C/2D separation).

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
