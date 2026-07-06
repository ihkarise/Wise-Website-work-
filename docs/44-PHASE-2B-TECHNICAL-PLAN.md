# 44 - Phase 2B Technical Plan
## Version 2.0 — 2026-07-06

> **This document defines architecture only. It authorizes no production code.**
> Per docs/43-PHASE-2A-CLOSEOUT.md §12 and docs/24-ROADMAP.md's Phase 2B entry,
> implementation may not begin until a separate, explicit approval is given for a named
> batch from §22 below. This is Version 2.0: the architecture documents were approved in
> principle (2026-07-06), with four required revisions before any batch could be
> considered — a broader Patient Experience Platform framing, a revised
> trusted-device-primary authentication strategy, Doctor-Assigned Conditions/Module
> Engine/Calculator Framework elevated to core architectural pillars, and a
> re-sequenced implementation order. All four are incorporated below. See "What Changed
> in Version 2.0" immediately after this notice.

## What Changed in Version 2.0
- **Vision (§0/§1):** Reframed from a narrow "Personal Care Plan" phase to a broader
  **Patient Experience Platform** — Personal Care Plan is now one capability the
  platform delivers, not the phase's identity.
- **Authentication (§5, was §4 in v1.0):** Fully revised. Persistent login is now
  achieved **primarily through Trusted Devices**, with PIN demoted to an **optional
  secondary** factor, both rooted in Magic Link. This supersedes v1.0's PIN-primary
  design (ADR-011, now superseded) with ADR-014. This also resolves docs/45 v1.0 Part 3
  item 1 (the plan's previously highest-ranked risk) — see §5.2.
  Docs/45 and docs/46 are updated to Version 2.0 to match.
- **Core Architectural Pillars (new §4):** Doctor-Assigned Conditions, Module Engine,
  and Calculator Framework are now presented as the phase's three foundational pillars
  — every other capability in this plan is described as building on top of them, not
  as a peer in a flat list.
- **Implementation sequence (§22):** Re-ordered so the three pillars ship first, ahead
  of consumers that depend on them and ahead of the (now lower-risk, but still
  independently gated) authentication work.

---

# 0. Framing

Phase 2B is the **Wise Patient Experience Platform** — the set of architectural
capabilities that let a patient's ongoing relationship with Wise be personalized,
persistent, and structured around their specific condition(s), rather than a fixed,
one-size-fits-all dashboard. Personal Care Plan, Personalized Daily Check-ins, and the
Calculator Framework are three concrete *capabilities* this platform delivers — none of
them is the phase's identity by itself. This corrects docs/24-ROADMAP.md's original
one-line framing ("Phase 2B — Personal Care Plan"), which undersold the actual
architectural work: a **Module Engine** and **Doctor-Assigned Conditions** are not
supporting infrastructure for Personal Care Plan alone — they are general-purpose
platform capabilities that Personal Care Plan, Daily Check-ins, and Calculator
Framework all sit on top of, and that any future Phase 2B-era capability would also sit
on top of.

Phase 2A (`docs/43`) is frozen except for genuine bug fixes. Nothing in this document
modifies a single frozen file. Every capability described here is additive: new Sheets,
new schemas, new Apps Script files, new dispatch cases, and — where the existing
frontend architecture cannot accommodate genuine growth without it (the dashboard
specifically) — a new, additive pattern that existing Phase 2A cards are not required to
adopt in the same batch (ADR-012).

# 1. Objectives

1. Establish three **core architectural pillars** — Doctor-Assigned Conditions, Module
   Engine, Calculator Framework — as the platform's foundation, with every other
   capability (Daily Check-ins, Care Plan, Dashboard evolution) explicitly described as
   a consumer of one or more pillars, not a parallel, independent feature (§4).
2. Give every capability a data model, an ownership model, and an explicit
   security/AI boundary — the same bar docs/29 held Phase 2A to.
3. Achieve persistent login primarily through a mechanism that does not inherit
   low-entropy-secret hashing risk — Trusted Devices — while keeping an optional PIN
   available and keeping Magic Link as the non-negotiable root of trust for both (§5).
4. Identify every place a design decision was **not** made because the requesting
   instruction explicitly forbade assuming one — surfaced as an open question and
   consolidated in docs/45.
5. Produce a batch sequence (§22) that ships the three pillars first, keeps every
   intermediate state deployable and reversible (ADR-008), and sequences consumers only
   after the pillar(s) they depend on exist.

# 2. Scope

## 2.1 In Scope
- Architecture and data-model design for the three pillars (Doctor-Assigned
  Conditions, Module Engine, Calculator Framework) and every capability that consumes
  them: Persistent Authentication (Trusted Device + optional PIN), Patient Profile,
  Template Engine, Personalized Daily Check-ins, Personal Care Plan, Dashboard
  evolution, per-patient feature enablement.
- AI-boundary definition for every above capability that could ever touch AI.
- Digital Twin integration scope **as it constrains this plan's own data shapes** —
  not Digital Twin's own architecture (Phase 2D, per docs/24).
- Migration planning from Phase 2A's existing Symptom Tracker v1 data and dashboard.
- New/amended ADRs (ADR-012, ADR-013, ADR-014; ADR-011 superseded).

## 2.2 Out of Scope
- Any production code. This is a documentation-only batch (see the notice at top).
- Digital Twin's own narrative/summarization logic (Phase 2D).
- Health Milestones (Phase 2C).
- Appointment (docs/33 §4.1) — a real, named gap, not a dependency of anything below.
- The Public (no-login) Calculator variant — only the Patient variant is in scope.

## 2.3 Explicit Non-Goals
- This plan does not migrate any existing Phase 2A card (Timeline, Symptom Tracker,
  Reports) onto the new Module Registry (ADR-012's Future Considerations defers this).
- This plan does not pick a final PIN length, device-token expiry, or lockout
  threshold — implementation-time security-review parameters (§18), not architecture.
- This plan does not decide whether the Public Calculator variant is ever built.

# 3. Relationship to Existing (Frozen) Architecture

Everything below is additive on top of:
- **ADR-002** (`patient_id` is the durable identity) — every new entity is keyed by
  `patient_id`, never by a credential, device, or condition.
- **ADR-006** (Sheets is an implementation detail) — every new Sheet-backed entity
  follows the same flat-column, UUID-`record_id`, migration-safe convention as
  `Patients`, `SymptomLogs`, `Reports`.
- **ADR-008/ADR-009** (independently deployable, independently replaceable) — governs
  §22's batch ordering and every module boundary below.
- **ADR-001/004/005** (Knowledge Engine grounding, Digital Twin boundary, doctor
  supervision) — reaffirmed, not modified, by §16.
- **`shared/` contracts** (`shared/README.md`) — every new schema below is proposed at
  the same fidelity docs/33 already uses for conceptual entities; the actual
  `shared/*.schema.json` files are written when a batch implements them.

No existing `apps-script/Foundation*.gs` file, `shared/*.schema.json`, or frozen HTML
page is modified by this plan. Every new dispatch case is additive to
`FoundationRouter.gs`'s existing action list (docs/46 confirms no name collisions).

# 4. Core Architectural Pillars

This section did not exist in v1.0, which presented twelve capabilities as a flat list.
Approving-review feedback (2026-07-06) requires Doctor-Assigned Conditions, Module
Engine, and Calculator Framework to be the phase's core pillars — the foundation every
other Phase 2B capability is built on, not a peer feature among equals.

## 4.1 Why these three, specifically
- **Doctor-Assigned Conditions (§6)** is the platform's only mechanism for expressing
  *which patient needs which capability*. Without it, personalization has no input:
  Daily Check-ins cannot select a condition-specific template, Care Plan instructions
  have no clinical anchor beyond free text, and per-patient feature enablement (§13)
  has no natural default rule.
- **Module Engine (§7)** is the platform's only mechanism for *exposing* a capability
  to a specific patient at all. Every patient-facing addition in this plan — Daily
  Check-ins, Calculator, Care Plan — needs a place to live on the dashboard and a way
  to be turned on or off per patient. Building each capability with its own bespoke
  enablement logic (as today's hardcoded six-card dashboard does) would mean
  reinventing this problem three more times.
- **Calculator Framework (§8)** is the platform's first fully general-purpose,
  patient-facing, doctor-authored computation pattern — deterministic, versioned,
  reusable for any future scoring/assessment need, not tied to one clinical use case.
  It closes a genuine, previously-unowned roadmap gap (docs/33 §5.3) and establishes
  the pattern (definition + versioned result) that other structured-input features can
  follow.

Personal Care Plan, Personalized Daily Check-ins, Patient Profile, and Dashboard
evolution are described in §9–§12 as **consumers** of one or more pillars, not as
independent architecture.

## 4.2 Consumer map

| Capability | Consumes | How |
|---|---|---|
| Personalized Daily Check-ins (§10) | Doctor-Assigned Conditions, Module Engine | Template selection is condition-driven (§6); the Check-in module is registered and enabled/disabled via the Module Engine (§7) |
| Personal Care Plan (§12) | Doctor-Assigned Conditions, Module Engine | Doctor Instructions reference a patient's assigned condition(s); the Care Plan module is registered via the Module Engine |
| Patient Dashboard evolution (§13) | Module Engine | The dashboard's registry-driven rendering path *is* the Module Engine's patient-facing surface |
| Per-patient feature enablement (§14) | Module Engine | `PatientModuleState` (§7.2) is the enablement mechanism itself |
| Persistent Authentication (§5) | *(none of the three pillars)* | Independent of all three — a platform-wide access mechanism, not a pillar-consuming feature. Sequenced early in §22 because low-friction return access benefits engagement with every pillar-built capability, not because it depends on one. |

# 5. Persistent Authentication Architecture (Revised — Trusted Device Primary)

## 5.1 What changed and why
v1.0 (ADR-011) made an opt-in PIN/password the primary persistent-login mechanism.
docs/45 v1.0 Part 3 ranked this the single highest-risk item in the whole plan: Google
Apps Script has no bcrypt/argon2/PBKDF2, so a human-chosen, low-entropy PIN could only
be protected by a manually iterated HMAC bridge — a disclosed workaround, not a solved
problem, and one that mattered most because it was the *primary* mechanism every
returning patient would depend on.

**ADR-014** (new, supersedes ADR-011) redirects: persistent login is now achieved
**primarily through Trusted Devices**, a mechanism that sidesteps the low-entropy
problem entirely rather than mitigating it, with **PIN retained as an optional,
secondary factor**, and **Magic Link named explicitly as the root of trust** for both.

## 5.2 Trusted Device — the primary mechanism
After authenticating via magic link, a patient may mark the current device as trusted.
The server issues a `TrustedDevice` record and a long, random, **server-generated**
device token — the same entropy class as `LoginToken` (not a human-chosen value). This
is the mechanism's key property: **because the token is machine-generated and
high-entropy, it can safely reuse the platform's existing, already-proven `LoginToken`
hashing pattern** (a plain SHA-256 fingerprint of an unguessable secret) instead of
needing any new cryptographic bridge. This is what actually reduces risk relative to
v1.0 — the primary mechanism no longer needs a workaround at all.

On a return visit, the client presents the device token once to receive a fresh,
short-lived Session token (unchanged TTL/mechanics from today's Session). The token
**rotates on every exchange** — each use invalidates the presented token and issues a
new one, mirroring `LoginToken`'s existing single-use discipline, bounding the value of
a copied/exfiltrated token to a single use before rotation would surface a conflict.
Trusted Device status is **revocable** (a "sign out this device" / "sign out
everywhere" patient action, or a staff action) and **time-bounded** (exact expiry is an
implementation-time parameter, per ADR-010's tune-with-real-data posture already
applied to Session TTL).

**Magic link is the root of trust**: establishing a new Trusted Device, and
re-establishing one after expiry or revocation, always requires a fresh magic-link
authentication first. There is no device-recovery path that bypasses email.

## 5.3 PIN — the optional, secondary mechanism
Retained from ADR-011, demoted from primary to secondary, unchanged in mechanism: opt-in
only, set up after an already-authenticated session, resolves to the same `patient_id`
(ADR-002), reset only via a fresh magic-link authentication, rate-limited failed
attempts, never able to block magic-link access. **The disclosed hashing risk from
v1.0 still applies to the PIN path specifically** — a PIN remains a human-chosen,
low-entropy secret regardless of its now-secondary role, and still requires the
iterated-HMAC bridge and its own dedicated security review before implementation (§18,
docs/45 Part 3). Demoting PIN to secondary reduces the *platform's* overall exposure
(most patients are expected to use Trusted Device, the safer mechanism, by default) but
does not reduce the *PIN path's own* risk for patients who do choose it.

## 5.4 Data model — `TrustedDevice` (new, primary)
`device_id` (UUID), `patient_id`, `device_token_hash` (SHA-256, per §5.2), `device_label`
(optional, e.g. derived from user-agent, for the patient's own "manage my devices" view),
`created_at`, `last_used_at`, `expires_at`, `revoked_at` (empty-string sentinel),
`revoked_by`. Many per patient (a patient may trust more than one device).

## 5.5 Data model — `PatientCredential` (secondary, unchanged from ADR-011/v1.0 §4.3)
`credential_id` (UUID), `patient_id`, `credential_type` (`pin` | `password`), `salt`,
`credential_hash` (iterated-HMAC output), `iteration_count`, `created_at`, `updated_at`,
`failed_attempt_count`, `locked_until` (empty-string sentinel), `last_used_at`.

## 5.6 Open questions this plan does not decide
- **Exact device-token expiry and rotation-failure handling** (e.g., what happens if a
  rotated token is presented a second time — treated as a possible theft signal, or
  simply rejected). ADR-014's Future Considerations defers this to real usage data.
- **Whether Trusted Device and PIN are mutually exclusive or a patient can have both
  active simultaneously.** Recommend allowing both independently (they serve different
  contexts — a personal phone vs. a shared computer) unless a real operational reason
  to restrict emerges.
- **Minimum PIN length / password complexity, device-token expiry duration, lockout
  threshold.** Left to the dedicated security review (§18), not assumed here.

# 6. Doctor-Assigned Conditions Architecture (Pillar 1)

## 6.1 Current state — a real gap, not a feature to extend
`condition_slug` on `Patient` is a single string, set once at patient creation by a
staff member running a manual Apps Script editor function
(`createFoundationPatient()`), loosely validated (not checked against the canonical
slug list — `apps-script/PatientIdentity.gs`'s own comment documents this as
deliberate). **There is no update endpoint, no staff UI, and no doctor-assignment
workflow for condition_slug today.** This pillar is not an extension of an existing
feature — it is a net-new capability, and the platform's foundation for everything else
in this plan.

## 6.2 The plural-conditions design fork
The request specifies "Conditions" (plural); the existing schema is a single string.
Two real options:

| Option | Description | Trade-off |
|---|---|---|
| **A — Widen `Patient.condition_slug` to an array** | Change the existing, conformance-tested `patient-identity.schema.json` field from string to array | Breaking schema-version change to a frozen, shipped contract; requires migrating every existing `Patient` row |
| **B — New `ConditionAssignment` entity** (`assignment_id`, `patient_id`, `condition_slug`, `assigned_by`, `assigned_at`, `status`: active/resolved) | Many-to-one Patient→Conditions, fully additive, full audit history | No schema change to any frozen file; a filtered list rather than a single field read |

**This plan recommends Option B** and treats it as effectively settled per docs/45 v1.0
Part 1.3's concurrence: Option A would require re-triaging `patient-identity.schema.json`'s
152 passing conformance checks against a widened field, and docs/43's freeze reserves
frozen-file changes for genuine bug fixes, which this is not. Option B is also the only
option that delivers the actual missing capability — a real, timestamped, audited
assignment *action* — not just a wider storage field.

## 6.3 As the foundation for pillars 2 and 3, and every consumer
Doctor-Assigned Conditions is what makes Module Engine's per-patient enablement (§7) and
Calculator Framework's relevance (§8.2) *personalized* rather than uniform, and what
Daily Check-ins (§10.3) and Care Plan (§12.1) anchor their content to. It is
deliberately sequenced first in §22 for this reason.

# 7. Module Engine Architecture (Pillar 2)

See **ADR-012** for the binding decision. Summarized here as this plan's second pillar:

## 7.1 Module Registry (config, not a Sheet)
A versioned list of module descriptors — module id, display title, data-source dispatch
action, empty-state behavior, rendering shape. Static, staff/developer-maintained
config (analogous in form to `shared/constants/condition-slugs.json`), not a dynamic
admin-editable system in this plan's scope — sufficient for the handful of modules
Phase 2B introduces; a staff-facing registry-editing tool is not proposed here.

## 7.2 `PatientModuleState` (new Sheet-backed entity)
`patient_id`, `module_id`, `enabled` (boolean), `enabled_by`, `enabled_at`. Absence of a
row for a given (patient, module) pair means **disabled by default** — fail-closed,
per ADR-010 applied to feature exposure. Default enablement may be informed by a
patient's assigned condition(s) (§6) — e.g., a condition-specific Calculator
auto-suggested, never auto-enabled without a staff/doctor action (§14).

## 7.3 As the foundation for every patient-facing consumer
Every new patient-facing module in this plan — Daily Check-ins (§10), Calculator (§8),
Care Plan (§12) — registers through this pillar and is individually enabled/disabled
per patient through it (§14). The dashboard's rendering evolution (§13) *is* this
pillar's patient-facing surface, not a separate concern.

## 7.4 Migration posture
Per ADR-012 and §2.3, existing Phase 2A cards (Timeline, Symptom Tracker, Reports) are
**not** required to migrate onto this registry in the same batch that introduces it.

# 8. Calculator Framework Architecture (Pillar 3)

Governed by **ADR-013** — deterministic only, never AI-computed. Closes docs/33 §5.3's
"roadmap omission" finding for the Patient variant.

## 8.1 Data model
`CalculatorDefinition` — a versioned code/config artifact (formula logic, input field
list), doctor/staff-authored and deterministic, not Sheet-backed. `CalculatorResult`
(Sheet-backed, new): `record_id`, `patient_id`, `calculator_slug`, `definition_version`,
`input_snapshot` (JSON-encoded, for reproducibility/audit — see §11.2's discussion of
this representational choice), `result_value`, `computed_at`.

## 8.2 As a pillar: general-purpose, not single-use
Unlike Daily Check-ins (a specific question-answer pattern) or Care Plan (a specific
clinical-authorship pattern), Calculator Framework is intentionally general — any future
deterministic, doctor-authored scoring or assessment need can be added as a new
`CalculatorDefinition` without new architecture, the same way a new `CheckInTemplate`
extends Daily Check-ins without new code (§11). Its visibility to a given patient is
governed by `PatientModuleState` (§7.2), potentially defaulted by Doctor-Assigned
Condition relevance (§6.3) — the exact default-enablement rule is not decided here
(§14).

# 9. Relationship to Existing Architecture — Full Entity Table

Moved and consolidated here (was split across sections in v1.0) now that pillars are
established: see §17 for the complete new/promoted entity table, cross-referenced to
whichever pillar or capability section defines it.

# 10. Personalized Daily Check-ins Architecture (Replacing Symptom Tracker v1)

A consumer of Pillars 1 and 2 (§4.2).

## 10.1 "Replacing" is a migration, not a single cutover
ADR-008 requires every batch to leave the system safely reversible. Daily Check-ins
ship **alongside** the existing Symptom Tracker first (both visible, both writable,
registered on the Module Registry from day one), proven in production, and only then —
as an explicitly separate, later batch — has the Symptom Tracker card retired. Existing
`SymptomLogs` rows are never deleted or migrated; they remain permanent historical data,
readable by a future Timeline/Digital Twin view alongside new `CheckInResponse` rows.

## 10.2 Template Engine — the mechanism behind personalization
The doctor/staff-authored, versioned question set (`CheckInTemplate`) a Daily Check-in
is built from. See §11 for the full Template Engine design and its own real
architectural tension with ADR-006's flat-column convention.

## 10.3 Data model — `CheckInResponse`
`record_id`, `patient_id`, `template_id` (references `CheckInTemplate`), `logged_at`
(server-set), `answers` (JSON-encoded, per §11.2), `condition_slug` (optional). Same
lifecycle as `SymptomLog`: create → persist → read, no update, no delete. Template
selection is driven by a patient's active Doctor-Assigned Condition (§6) — a patient
with condition X sees the `CheckInTemplate` where `condition_slug = X`, falling back to
a general template if none is condition-specific.

## 10.4 Open question
Whether a patient with multiple active conditions (§6.2) sees a merged template, one
template per condition, or a doctor-chosen single template is **not decided here** —
flagged for docs/45.

# 11. Template Engine Architecture

The general mechanism §10 (Daily Check-ins) and, at a lighter weight, §12 (Care Plan
sections) build on.

## 11.1 What it's for
The mechanism by which a doctor/staff-authored **question set** (Daily Check-ins) or
**content structure** (Care Plan) is defined once and applied per condition or per
patient, rather than hardcoded per feature the way today's fixed four-field Symptom
Tracker is.

## 11.2 The real architectural tension this creates
ADR-006 requires "flat, typed-by-convention columns." A Template Engine's purpose is
*variable* shape. Three options, evaluated:

| Option | Description | Assessment |
|---|---|---|
| **A — Fixed superset of generic columns** | e.g., ten generic `scale_1`…`scale_10` + `text_1`…`text_3` columns, reused/relabeled per template | Stays flat literally, but columns are meaningless without the template definition to interpret them |
| **B — JSON-encoded answers in one column** | `answers`/`input_snapshot` stores a JSON string; a versioned template/definition id defines how to interpret it | Sacrifices in-Sheet queryability of individual answers, but matches how a real future database would model this (a JSONB column or normalized child table) |
| **C — One Sheet per check-in type** | Mirrors the existing SymptomLog/ConsultationHistory pattern | Defeats the entire point of a Template Engine |

**This plan recommends Option B**, on the reasoning that ADR-006's binding requirement
is migration-safety, not literal column-flatness for its own sake. **Presented as a
recommendation requiring explicit sign-off** — docs/45 Part 1.5 flags a real,
disclosed cost (a doctor/staff member opening the raw Sheet directly would see an
unreadable JSON blob instead of a value, unlike every existing Sheet-backed entity).

## 11.3 Data model — `CheckInTemplate`
`template_id`, `condition_slug` (optional), `version`, `questions` (ordered list of
`{field_key, label, type, min, max, required}`), `status` (active/retired),
`created_by`, `created_at`. Versioned and append-only — editing a template creates a
new version, so historical `CheckInResponse` rows remain interpretable against the
template version active when recorded.

# 12. Personal Care Plan Architecture

A consumer of Pillars 1 and 2 (§4.2). Promotes docs/33 §3.4 (Care Plan) and §2.3
(Doctor Instruction) from *Conceptual* to designed, per docs/32 Part 2's original
recommendation.

## 12.1 Data model — `DoctorInstruction`
`instruction_id`, `patient_id`, `care_plan_id` (nullable), `consultation_id` (nullable),
`instruction_type` (medicine | lifestyle | investigation | follow_up — closes docs/23's
"Prescriptions" gap: a Prescription is a `medicine`-type instruction), `content`,
`prescribed_by`, `effective_date`, `status` (active/discontinued/completed). Created at
consultation or review time, never deleted.

## 12.2 Data model — `CarePlan`
`care_plan_id`, `patient_id`, `version` (integer, append-only), `status`
(active | superseded), `goals`, `next_review_date`, `created_by`, `created_at`. A Care
Plan version aggregates the patient's currently-active `DoctorInstruction` records by
reference — it does not copy their content.

## 12.3 Ownership
Doctor/staff-authored only, patient-viewable only — no patient-write path exists or is
proposed, consistent with docs/30 §2's "doctors decide."

## 12.4 Timeline integration
A new Care Plan version creates a `TimelineEvent`-shaped entry (`entry_type: care_plan`,
extending the existing enum docs/39 deliberately left narrowed to `["consultation"]`
until a second source existed — this is that second source), per docs/33 §3.1's own
forward-looking design.

# 13. Patient Dashboard Evolution

The Module Engine pillar's (§7) patient-facing surface, not separate architecture. The
existing three writable/readable cards (Timeline, Symptom Tracker, Reports) and the
three permanently-`future`-badged placeholders (Care Plan, Messages, Digital Twin) are
unaffected until a later, separately-scoped migration batch. Care Plan's placeholder
transitions from a permanent `future` badge to a real, registry-driven module the
moment its batch ships (§22); Messages and Digital Twin remain placeholders (Messages
has no architecture anywhere; Digital Twin is Phase 2D, §16).

# 14. Feature Enable/Disable Per Patient

`PatientModuleState` (§7.2) — one mechanism, not one per feature, per the Module Engine
pillar. Toggled by doctor/staff only, never the patient. **Not decided here:** whether
enablement can ever be automatic (e.g., a Calculator auto-enabling when a matching
condition is assigned) or must always be an explicit staff action — recommend
"always explicit" for Phase 2B's first batches, revisited only if manual toggling
proves to be real friction.

# 15. AI Boundaries

Reaffirms, does not modify, ADR-001/004/005.

- **Daily Check-ins**: question *selection* is condition-driven, not AI-driven (§10.3).
  No AI-generated question content is proposed. A future AI-adapted-question proposal
  must independently satisfy ADR-001.
- **Calculator Framework**: results are never AI-computed (ADR-013). AI-generated
  explanatory text about a result, if ever built, must satisfy ADR-001/005
  independently.
- **Care Plan**: doctor-authored only (§12.3). No AI-generated content proposed.
- **Trusted Device / PIN, Module Engine, Doctor-Assigned Conditions, Patient Profile**:
  no AI involvement of any kind proposed or required.

No capability in this plan requires, assumes, or authorizes any new AI integration
beyond what Phase 1.5/2A already built.

# 16. Digital Twin Integration Scope for Phase 2B

Per docs/24, Digital Twin's own architecture is Phase 2D's responsibility. Phase 2B's
only obligation is to ensure every new entity is **shaped so a future Digital Twin can
read it** without a redesign: `CheckInResponse`, `CalculatorResult`, and `CarePlan` are
all `patient_id`-keyed, timestamped, and never destructively overwritten; `CarePlan`
version transitions emit `TimelineEvent` rows (§12.4). This plan builds no Digital Twin
UI, narrative generation, or aggregation logic.

# 17. Data Architecture — New/Promoted Entities Summary

| Entity | Pillar / capability | Status before this plan | Sheet-backed? |
|---|---|---|---|
| `ConditionAssignment` | Pillar 1 (§6) | Did not exist | Yes |
| Module Registry | Pillar 2 (§7.1) | Did not exist | No (config) |
| `PatientModuleState` | Pillar 2 (§7.2) | Did not exist | Yes |
| `CalculatorDefinition` | Pillar 3 (§8.1) | Conceptual (docs/33 §5.3) | No (config/code) |
| `CalculatorResult` | Pillar 3 (§8.1) | Conceptual (docs/33 §5.3) | Yes |
| `TrustedDevice` | Persistent auth, primary (§5.4) | Did not exist | Yes |
| `PatientCredential` | Persistent auth, secondary (§5.5) | Did not exist | Yes |
| `PatientProfile` | Patient Profile (v1.0 §5, retained) | Did not exist | Yes |
| `CheckInTemplate` | Template Engine (§11.3) | Did not exist | No (config/content) |
| `CheckInResponse` | Daily Check-ins (§10.3) | Did not exist | Yes |
| `DoctorInstruction` | Care Plan (§12.1) | Conceptual (docs/33 §2.3) | Yes |
| `CarePlan` | Care Plan (§12.2) | Conceptual (docs/33 §3.4) | Yes |

Every Sheet-backed entity above follows ADR-006's flat-column/UUID-`record_id`
convention except where §11.2/§8.1 explicitly document a JSON-encoded column as the
deliberate, reasoned exception. docs/33-DOMAIN-MODEL.md §6 is updated by this same
change to reflect every row above, including `TrustedDevice` replacing
`PatientCredential` as the primary auth entity.

**Patient Profile note (unchanged from v1.0 §5):** recommended as a separate entity
from `Patient` (Option b), so the frozen, conformance-tested `patient-identity.schema.json`
is never touched — same reasoning as §6.2's Option B for Doctor-Assigned Conditions.
`phone`, `date_of_birth`, `preferred_contact_method`, `emergency_contact`, `updated_at`,
`updated_by`, keyed 1:1 with `Patient`.

# 18. Security Model

- **§5's authentication design is now the platform's most-reduced-risk item relative to
  v1.0**, not its highest — the primary mechanism (Trusted Device) reuses an
  already-proven hashing pattern. **The PIN path (§5.3) still carries the original,
  disclosed hashing-bridge risk** and still requires a dedicated security review
  (mirroring PA-7's magic-link/session review, docs/43 §6) before its batch ships,
  independent of Trusted Device's approval.
- **`PatientProfile`** is the platform's first patient-mutable structured data — every
  write must be session-derived-`patient_id`-scoped and audit-logged.
- **`ConditionAssignment` / `PatientModuleState` / `DoctorInstruction` / `CarePlan`**
  writes are staff/doctor-only, enforced server-side, never merely omitted from a
  patient-facing UI.
- **JSON-encoded columns** (`CheckInResponse.answers`, `CalculatorResult.input_snapshot`)
  must be size-bounded at write time (mirroring `FoundationReports.gs`'s existing
  upload-size check).
- **`TrustedDevice` tokens** are exchanged (never used directly as a long-lived API
  credential), rotated on every use, and revocable — the same mitigation shape as
  industry-standard refresh-token rotation (ADR-014 §Decision).

# 19. Migration From Phase 2A

| Existing Phase 2A surface | Migration posture |
|---|---|
| `Patient` (identity) | Unmodified. `PatientProfile` and `ConditionAssignment` reference it; neither widens nor replaces it. |
| `SymptomLogs` | Retained permanently, read-only historical data. Dashboard card retirement is a separate, later, explicitly-approved batch (§10.1, §22). |
| `LoginTokens` / `Session` | Unmodified. `TrustedDevice` and `PatientCredential` are fully additive; `LoginToken`'s hashing pattern is *reused* (not modified) by `TrustedDevice` (§5.2). |
| `dashboard.js` hardcoded cards | Unmodified for Timeline/Symptom Tracker/Reports. Care Plan's placeholder becomes real once its batch ships (§13); Messages/Digital Twin remain placeholders. |
| `FoundationRouter.gs` | Additive dispatch cases only — zero collisions (docs/46). |

No data migration script is required — every new entity starts empty.

# 20. Risks

1. **PIN hashing on Apps Script (§5.3, §5.5)** — still real, still requires a dedicated
   review, but no longer the platform's *primary* mechanism's risk (§18).
2. **JSON-encoded columns (§11.2, §8.1)** — a deliberate, disclosed departure from
   ADR-006's literal wording; sets a precedent worth explicit sign-off.
3. **Doctor-Assigned Conditions' Option A vs. B (§6.2)** — recommended settled (Option
   B) before Batch 1, reversing later is costly.
4. **Trusted Device token theft/replay (§5.2, §5.6)** — bounded by rotation and
   revocability, but the exact detection/response behavior on a replayed rotated token
   is an open, implementation-time question.
5. **Scope size** — the pillar framing reduces this relative to v1.0 by giving
   consumers an explicit foundation to build on rather than twelve independent items,
   but the batch count (§22) is unchanged.
6. **Vision/roadmap continuity** — docs/24 is updated in this same change to reflect
   the Patient Experience Platform framing; recorded so this reframing is traceable,
   not silently substituted for the original one-line entry.

# 21. Documentation Impact

| Doc | Update needed | Status |
|---|---|---|
| docs/24-ROADMAP.md | Reframe Phase 2B as Patient Experience Platform, name the three pillars | Done, this change |
| docs/31-ADR-INDEX.md | Add ADR-014, mark ADR-011 Superseded | Done, this change |
| docs/33-DOMAIN-MODEL.md | Add `TrustedDevice`; reframe `PatientCredential` as secondary | Done, this change |
| docs/44 (this document) | Version 2.0 — pillars, revised auth, re-sequenced batches | Done, this change |
| docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md | Version 2.0 | Done, this change |
| docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-REVIEW.md | Version 2.0 | Done, this change |
| `/adr/ADR-014` | New | Done, this change |
| `/adr/ADR-011` | Marked Superseded | Done, this change |
| CHANGELOG.md | Record this revision pass (no code change) | Done, this change |
| `shared/schemas/*.schema.json` for entities in §17 | Not yet written — created when each entity's implementing batch begins | Deferred, by design |

# 22. Implementation Batches (Re-sequenced)

Pillars first, then capabilities that consume them, then the independent (and now
lower-risk) authentication work, then retirement and closeout. **No batch below is
authorized to begin by this document.**

| Batch | Delivers | Depends on | Risk / reversibility |
|---|---|---|---|
| **PCP-1** | `ConditionAssignment` + staff assignment tool — **Pillar 1** | Nothing new | Zero patient-facing surface. Fully reversible. Recommended first batch. |
| **PCP-2** | Module Registry (config) + `PatientModuleState` + dashboard registry-rendering path, zero real modules registered yet — **Pillar 2** | Not strictly PCP-1, but informed by it for future default-enablement rules | Additive scaffold; existing cards unaffected (ADR-012). |
| **PCP-3** | `CalculatorDefinition` + `CalculatorResult` + Patient Calculator UI, registered via PCP-2 — **Pillar 3** | PCP-2 | Deterministic logic only (ADR-013) — low risk. |
| **PCP-4** | `TrustedDevice` — device-token issuance/exchange/rotation/revocation, magic link as root of trust | Independent of pillars; reuses `LoginToken`'s hashing pattern | Lower risk than v1.0's equivalent batch — no new hashing primitive required. |
| **PCP-5** | `PatientCredential` — optional secondary PIN, layered alongside PCP-4's mechanism | PCP-4 conceptually (shares root-of-trust framing). Requires its own dedicated security review first (§18, docs/45 Part 3). | Same disclosed hashing-bridge risk as v1.0's ADR-011 design — unchanged, still gated. |
| **PCP-6** | `PatientProfile` + patient-facing profile view/edit | None | First patient-mutable structured data — its own authorization/audit review. |
| **PCP-7** | `CheckInTemplate` + `CheckInResponse` + Daily Check-in patient UI, registered via PCP-2, shipped alongside (not replacing) Symptom Tracker | PCP-1 (condition-driven template selection), PCP-2 | Additive; Symptom Tracker untouched. |
| **PCP-8** | `DoctorInstruction` + `CarePlan` + patient-facing read-only Care Plan view, registered via PCP-2 | PCP-1, PCP-2 | Doctor-authored only — no new patient-write surface. |
| **PCP-9** | Symptom Tracker retirement (dashboard card removed, endpoints deprecated, `SymptomLogs` retained) | PCP-7 proven in production first | Explicitly separate, later, own approval. |
| **PCP-10** | Validation-suite build-out + documentation closeout, mirroring 5H/PA-7's discipline | All shipped batches above | Documentation/validation only. |

**Recommended first batch: PCP-1** (Doctor-Assigned Conditions, Pillar 1) — unchanged
from v1.0's recommendation, now more clearly justified as the foundation every other
pillar and consumer references.

**This plan does not authorize PCP-1, or any other batch, to begin.** Implementation
waits for a separate, explicit approval naming a specific batch.
