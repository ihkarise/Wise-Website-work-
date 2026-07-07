# 44 - Phase 2B Technical Plan
## Version 4.0 — 2026-07-09

> **This document defines architecture only. It authorizes no production code.**
> Per docs/43-PHASE-2A-CLOSEOUT.md §12 and docs/24-ROADMAP.md's Phase 2B entry,
> implementation may not begin until a separate, explicit approval is given for a named
> batch from §22 below. Version 4.0 is a **documentation-only architecture-freeze
> finalization pass** (2026-07-09): no batch's scope, dependencies, data model, or risk
> classification changed. It (1) renames the implementation batch sequence from PCP-1…
> PCP-11 to PXP-1…PXP-11 for platform-wide naming consistency, (2) generalizes docs/44
> §11's Template Engine into a **Template Registry** (new **ADR-016**, complementing
> ADR-012 rather than replacing it), (3) refines the dashboard vision (§13) into a
> registry-driven "Health Journey," (4) reaffirms doctor-owned configuration as a named
> principle rather than an implication, (5) reaffirms every existing authentication
> principle unchanged, and (6) reserves, without implementing, AI-compatibility
> extension points across every registry. See "What Changed in Version 4.0" below.
> Version 3.0's own changes (2026-07-08) remain in full effect and are not restated here
> — see git history for that round's detail.

## What Changed in Version 4.0
- **Batch sequence renamed, no scope change:** PCP-1…PCP-11 → PXP-1…PXP-11. Three
  batch labels also updated for clarity, still no scope change: "Calculator Framework"
  batch → **PXP-6 Calculator Registry**; "Persistent Login" batch → **PXP-8 Trusted
  Device + Long-Lived Session + Optional PIN**; "Symptom Tracker retirement" → **PXP-10
  Symptom Tracker Migration**; "Validation & closeout" → **PXP-11 Closeout** (§22). The
  Doctor-Assigned Conditions, Module Engine, and Calculator Framework **pillar names**
  (§4) are unchanged — only the batch identifiers that deliver them are renamed.
- **Template Registry introduced (new ADR-016):** generalizes §11's Template Engine —
  previously scoped only to `CheckInTemplate` — into a registry pattern mirroring
  Module Registry (ADR-012) and Calculator Registry (ADR-013): versioned template
  descriptors, doctor-assigned, activatable/deactivatable, AI-compatible by reserved
  extension point, never patient-configured. `CheckInTemplate` becomes this registry's
  first concrete category, not a separate mechanism. Six future template categories are
  named as reserved, unscoped future consumers, not new work (§11).
- **Dashboard vision refined into "Health Journey":** §13 rewritten so the dashboard is
  explicitly a dynamic, registry-driven experience — nothing hardcoded per disease —
  rendering whatever the Module Registry says is enabled, for any patient, using the
  same mechanism regardless of condition.
- **Doctor-Owned Configuration reaffirmed as an explicit, named principle** (new §4.3):
  patients never configure their own dashboard, conditions, modules, calculators,
  check-ins, templates, or care plans — doctors configure all of it; this was already
  true throughout Version 3.0 but is now stated once, explicitly, in one place.
- **Existing authentication principles reaffirmed unchanged** (new §5.7 summary):
  passwordless-by-default, Magic Link as permanent root of trust, Trusted Device,
  Long-Lived Session, and PIN-as-optional-convenience-only are all restated as
  unchanged — no new decision, a consolidated restatement of ADR-003/ADR-015.
- **AI-readiness extension points reserved, not implemented**, across the Module
  Registry (§7.1), Calculator Registry (§8.1), and the new Template Registry (§11) —
  each registry descriptor reserves a field for future AI-compatibility metadata; no
  registry gains any AI behavior by this change (§15 unchanged, restated).

## What Changed in Version 3.0 (2026-07-08, prior round — kept for reference)
- **Doctor-Assigned Conditions settled and renamed:** Option B is approved (additive
  entity, frozen `Patient` schema untouched), renamed `DoctorAssignedCondition` to match
  the exact terminology now approved (§6).
- **Authentication revised again:** a **Long-Lived Session** is now an explicit, named
  mechanism alongside Trusted Device (not just an implementation detail of the token
  exchange), PIN is explicitly reframed as **convenience only**, and passwordless-by-
  default is reaffirmed as a permanent, non-negotiable constraint (**ADR-015**,
  supersedes ADR-014, which superseded ADR-011 — all three remain on record per
  ADR-007). §5 rewritten accordingly.
- **Module Engine elevated further:** the dashboard fully migrates onto the Module
  Registry, including existing Phase 2A cards (Timeline, Symptom Tracker, Reports) —
  not deferred indefinitely as ADR-012 originally allowed. Split into two batches:
  **Module Registry** (backend) and **Dashboard Registry** (frontend migration) — §7.
- **Calculator Framework gains an explicit Calculator Registry**, mirroring the Module
  Registry pattern, with pluggability and no disease-specific hardcoding stated as
  explicit constraints (§8).
- **Check-in template assignment settled:** templates are doctor-assigned according to
  active conditions; the patient never configures or selects a template (§10).
- **JSON storage policy is now concrete**, not an open design fork: schema versioning,
  migration strategy, and validation rules are specified (§11.4).
- **Per-patient module enablement settled:** always an explicit doctor/staff action,
  never automatic-by-condition, never patient-controlled (§14).
- **Digital Twin's future consumer list made explicit:** Timeline, Reports, Daily
  Check-ins, Care Plans, and Calculators, named individually (§16).
- **Implementation order rewritten to start with infrastructure**, per explicit
  direction: Patient Profile → Doctor-Assigned Conditions → Module Registry → Dashboard
  Registry → Daily Check-in Engine → Calculator Registry → Personal Care Plan →
  Trusted Device + Long-Lived Session + Optional PIN → AI Integration (reserved
  placeholder). Digital Twin remains a later roadmap consumer, outside this sequence
  (§22). Batches are now named PXP-1 through PXP-11 (renamed from PCP-1 through PCP-11
  — platform-wide naming, no scope change, §22).

---

# 0. Framing

Phase 2B is the **Wise Patient Experience Platform** — the set of architectural
capabilities that let a patient's ongoing relationship with Wise be personalized,
persistent, and structured around their specific condition(s), rather than a fixed,
one-size-fits-all dashboard. Personal Care Plan, Personalized Daily Check-ins, and the
Calculator Framework are three concrete *capabilities* this platform delivers — none of
them is the phase's identity by itself. Phase 2A (`docs/43`) is frozen except for
genuine bug fixes; nothing in this document modifies a single frozen file.

# 1. Objectives

1. Establish three **core architectural pillars** — Doctor-Assigned Conditions, Module
   Engine, Calculator Framework — as the platform's foundation, with every other
   capability explicitly described as a consumer of one or more pillars (§4).
2. Give every capability a data model, an ownership model, and an explicit
   security/AI boundary.
3. Achieve persistent login through four cooperating, named mechanisms — Magic Link,
   Trusted Device, Long-Lived Session, and an optional convenience PIN — while
   permanently reaffirming that passwords never become mandatory (§5, ADR-015).
4. Resolve, rather than merely surface, the design questions previous review rounds
   left open: Doctor-Assigned Conditions' data shape, Module Engine's dashboard-
   migration scope, Check-in template ownership, and JSON storage's versioning/
   migration/validation rules.
5. Produce a batch sequence (§22) that builds infrastructure before features, ships the
   three pillars early, and keeps every intermediate state deployable and reversible
   (ADR-008).

# 2. Scope

## 2.1 In Scope
- Architecture and data-model design for the three pillars and every capability that
  consumes them: Persistent Authentication (Magic Link, Trusted Device, Long-Lived
  Session, optional PIN), Patient Profile, Template Registry (§11, ADR-016; formerly
  "Template Engine"), Personalized Daily Check-ins, Personal Care Plan, Dashboard
  evolution (full registry migration), per-patient feature enablement.
- A reserved, unscoped placeholder for a future "AI Integration" batch (§22 item 9) —
  no concrete AI feature is designed in this document; the placeholder exists so the
  batch sequence has a named slot for whatever AI-touching capability is eventually
  proposed, gated by §15's boundaries when it is.
- AI-boundary definition for every capability that could ever touch AI.
- Digital Twin integration scope as it constrains this plan's own data shapes only.
- Migration planning from Phase 2A's existing Symptom Tracker v1 data and dashboard.
- ADR-012 (amended), ADR-013 (confirmed), ADR-015 (supersedes ADR-014, which
  superseded ADR-011).

## 2.2 Out of Scope
- Any production code.
- Digital Twin's own narrative/summarization logic (Phase 2D) — explicitly not
  tightly coupled to this plan's implementation (§16).
- Health Milestones (Phase 2C).
- Appointment (docs/33 §4.1).
- The Public (no-login) Calculator variant.
- Any concrete AI Integration feature design — §22 item 9 is a placeholder only.

## 2.3 Explicit Non-Goals
- This plan does not pick a final PIN length, Long-Lived Session TTL, or lockout
  threshold — implementation-time security-review parameters (§18).
- This plan does not decide whether the Public Calculator variant is ever built.
- This plan does not specify what "AI Integration" (§22 item 9) concretely does.

# 3. Relationship to Existing (Frozen) Architecture

Unchanged from Version 2.0: every new entity is `patient_id`-keyed (ADR-002), every
Sheet-backed entity follows ADR-006's flat-column/UUID-`record_id` convention except
where §11.4 documents a reasoned exception, batch ordering follows ADR-008/ADR-009, and
ADR-001/004/005 govern every AI-adjacent surface (§15). No existing
`apps-script/Foundation*.gs` file, `shared/*.schema.json`, or frozen HTML page is
modified by this plan.

# 4. Core Architectural Pillars

## 4.1 Why these three, specifically
- **Doctor-Assigned Conditions (§6)** is the platform's only mechanism for expressing
  *which patient needs which capability*. The patient never selects their own
  condition(s) — diagnosis is the doctor's, per docs/30 §2's "doctors decide." **The
  doctor also owns module enablement** (§14): Doctor-Assigned Conditions is the input a
  doctor uses when deciding which modules to turn on for a patient, not an automatic
  trigger that enables modules by itself.
- **Module Engine (§7)** is the platform's only mechanism for *exposing* a capability
  to a specific patient. This is now a fully committed, dashboard-wide architecture —
  every card on `/my-health-journey/`, existing and new, is generated from enabled
  modules rather than being a fixed page.
- **Calculator Framework (§8)** is the platform's first fully general-purpose,
  patient-facing, doctor-authored computation pattern, exposed through its own
  Calculator Registry — deterministic, versioned, independently pluggable, never
  hardcoded per disease.

## 4.2 Consumer map

| Capability | Consumes | How |
|---|---|---|
| Personalized Daily Check-ins (§10) | Doctor-Assigned Conditions, Module Engine | Templates are doctor-assigned per active condition (§10); the Check-in module is registered and enabled/disabled via the Module Engine (§7) |
| Personal Care Plan (§12) | Doctor-Assigned Conditions, Module Engine | Doctor Instructions reference a patient's assigned condition(s); the Care Plan module is registered via the Module Engine |
| Patient Dashboard evolution (§13) | Module Engine | The dashboard's registry-driven rendering path *is* the Module Engine's patient-facing surface — for every card, not only new ones |
| Per-patient feature enablement (§14) | Module Engine, Doctor-Assigned Conditions | `PatientModuleState` (§7.2) is the mechanism; a doctor's condition assignment is the input a doctor considers, never an automatic trigger |
| Persistent Authentication (§5) | *(none of the three pillars)* | Independent of all three — sequenced late (§22) since it is a platform-wide convenience layered on top of already-working, magic-link-accessible capabilities, not a dependency of any of them |

## 4.3 Doctor-Owned Configuration — Reaffirmed

**Patients never configure their own dashboard.** This was already true throughout
every capability above; this subsection states it once, explicitly, as a named
principle rather than an implication scattered across §6.3, §10.2, §14. A doctor (or
authorized staff member) is the sole configuring actor for:

- **Conditions** — `DoctorAssignedCondition` (§6): the doctor decides what a patient is
  being treated for. The patient never self-selects a condition.
- **Modules** — `PatientModuleState` (§7.2, §14): the doctor decides which dashboard
  capabilities are turned on. Never automatic-by-condition, never patient-controlled.
- **Calculators** — visibility governed by the same `PatientModuleState` mechanism
  (§8.4): the doctor decides which calculators a patient sees.
- **Check-ins** — `CheckInTemplate` assignment (§10.2): the doctor decides which
  template(s) apply. The patient never selects or edits a template.
- **Templates** — the Template Registry (§11, ADR-016): every template category (Daily
  Check-in and any future category) is doctor-assigned, never patient-configured, by
  the same rule as Check-ins above.
- **Care Plans** — `DoctorInstruction`/`CarePlan` (§12): doctor/staff-authored only,
  patient-viewable only.

**Patients simply receive the configured experience** — the dashboard (§13) renders
whatever a doctor has configured, using one general, registry-driven mechanism rather
than a per-patient or per-disease special case. This principle is not new — it is the
same "doctors decide" rule (docs/30 §2) already governing every pillar and capability
above — restated here once, in one place, so it is checkable without cross-referencing
six different sections.

# 5. Persistent Authentication Architecture (Revised Again — Four Named Mechanisms)

Governed by **ADR-015** (supersedes ADR-014, which superseded ADR-011 — all prior
records kept per ADR-007).

## 5.1 The four mechanisms
1. **Magic Link — the root of trust.** Unconditional, always available, the sole
   recovery path for every mechanism below. Nothing here changes Phase 2A's existing
   magic-link login.
2. **Trusted Device.** After authenticating via magic link, a patient may mark the
   current device as trusted. The server issues a `TrustedDevice` record and a long,
   random, server-generated device token — the same entropy class as `LoginToken`, so
   it safely reuses `LoginToken`'s already-proven plain-SHA-256 hashing pattern (no new
   cryptographic bridge needed). Revocable, time-bounded, rotates on every use.
3. **Long-Lived Session (named explicitly, per ADR-015).** Presenting a valid Trusted
   Device token issues a **long-lived** Session (a materially longer TTL than the
   default 60-minute Session — exact duration is an implementation-time parameter),
   not merely a fresh short one. This is what a patient actually experiences as
   "staying logged in." Revoking the issuing `TrustedDevice` invalidates the
   long-lived access it was granting; it does not affect a different device's
   independently-issued long-lived session.
4. **Optional PIN — convenience only, never mandatory.** Retained from ADR-011/014's
   design (opt-in, magic-link-gated setup/reset, iterated-HMAC hashing bridge since a
   PIN remains a human-chosen, low-entropy secret, rate-limited), explicitly reframed:
   a lightweight, secondary re-entry option (e.g., after a long-lived session ends, or
   on a device the patient prefers not to mark as trusted) — never positioned as
   equivalent in importance to Trusted Device, and never a precondition for anything.

## 5.2 Passwordless-by-default, reaffirmed permanently
Per ADR-015 §Decision 2/3: a patient who never opts into Trusted Device or PIN
experiences exactly ADR-003's original design — magic link, every time, nothing stored.
**Passwords never become mandatory in this or any future revision without a new ADR
that explicitly overturns this clause.** Nothing in this plan, at any version, has ever
proposed a mandatory password; this is now a standing, explicit constraint rather than
an implicit assumption.

## 5.3 Data model — `TrustedDevice`
`device_id` (UUID), `patient_id`, `device_token_hash` (SHA-256), `device_label`
(optional, for a patient-facing "manage my devices" view — recommended in-scope for
this mechanism's batch, per docs/45's prior finding that revocability without
visibility is not meaningfully usable), `created_at`, `last_used_at`, `expires_at`,
`revoked_at` (empty-string sentinel), `revoked_by`. Many per patient.

## 5.4 Data model — `PatientCredential` (optional PIN)
Unchanged from ADR-011/014: `credential_id`, `patient_id`, `credential_type` (`pin` —
`password` is retained as a schema option but not a product-recommended path, per
§5.2's convenience-only framing), `salt`, `credential_hash`, `iteration_count`,
`created_at`, `updated_at`, `failed_attempt_count`, `locked_until`, `last_used_at`.

## 5.5 Long-Lived Session — implementation note, not decided here
The existing Session mechanism (`FoundationSession.gs`) issues a fixed-TTL, HMAC-signed
token. Supporting a longer TTL for trusted-device-issued sessions requires either (a)
parameterizing the frozen `FoundationSession.gs` by issuance context, which would need
its own bug-fix-scope justification to touch a frozen file, or (b) an additive wrapper
that calls the existing signing primitive with a different constant. Which approach is
correct is an implementation-time decision for the batch that builds this (§22), not
fixed by this plan.

## 5.6 Open questions this plan does not decide
- Exact Long-Lived Session TTL and whether it is fixed or sliding (ADR-015's Future
  Considerations).
- Minimum PIN length, lockout threshold (§18, security review required).
- Whether Trusted Device and PIN can be active simultaneously (recommend: yes,
  independently, unless a real operational reason to restrict emerges).

## 5.7 Summary — Existing Principles Reaffirmed, Unchanged
No new authentication decision is made by this Version 4.0 pass. Restated once, in one
place, for a reviewer who reads only this subsection:
- **Passwordless-by-default** remains permanent (§5.2, ADR-003, reaffirmed by ADR-015).
- **Magic Link remains the root of trust** and the sole recovery path (§5.1, mechanism
  1) — nothing about it changes, ever, without a new ADR that explicitly overturns
  §5.2's clause.
- **Trusted Device remains supported** as the primary persistence mechanism (§5.1,
  mechanism 2).
- **Long-Lived Session remains supported** as the named, explicit mechanism a Trusted
  Device grants (§5.1, mechanism 3).
- **PIN remains optional convenience only** — never mandatory, never equivalent in
  importance to Trusted Device (§5.1, mechanism 4; §5.2).
- **Magic Link is never replaced** by any of the above — every additive mechanism
  exists *alongside* it, never instead of it.

# 6. Doctor-Assigned Conditions Architecture (Pillar 1) — Settled

## 6.1 Current state — a real gap
`condition_slug` on `Patient` is a single string, set once at patient creation by a
staff member running a manual Apps Script editor function, loosely validated, with no
update endpoint and no doctor-assignment workflow. This pillar is net-new.

## 6.2 Decision: `DoctorAssignedCondition` entity, additive (Option B approved)
**Approved and settled.** The frozen, conformance-tested `patient-identity.schema.json`
is **not** widened — no array conversion, no schema-version change to a shipped
contract. Instead, a new entity: **`DoctorAssignedCondition`** (`assignment_id` UUID,
`patient_id`, `condition_slug`, `assigned_by`, `assigned_at`, `status`:
active/resolved). Many-to-one Patient→Conditions, fully additive, full audit history of
every assignment and resolution.

**The patient never selects a condition.** Every write to this entity is a doctor/staff
action; there is no patient-facing assignment or self-report path for this entity (this
is distinct from `Patient.condition_slug`'s original staff-typed-at-creation field,
which this entity supersedes as the forward-going source of truth for "what condition
is this patient actively being treated for" without touching the frozen field itself).

## 6.3 As the foundation for pillars 2 and 3, and every consumer
Doctor-Assigned Conditions is what a doctor uses to decide which modules to enable
(§14), which Check-in template to assign (§10), and which Calculator is relevant (§8) —
in every case, **the doctor decides and acts explicitly**; condition assignment is
input to that decision, never an automatic trigger.

# 7. Module Engine Architecture (Pillar 2) — Elevated to Full Dashboard Migration

Governed by **ADR-012 (amended)**.

## 7.1 Module Registry (backend, config)
A versioned list of module descriptors — module id, display title, data-source dispatch
action, empty-state behavior, rendering shape. Static, staff/developer-maintained
config, not a dynamic admin-editable system in this plan's scope. **AI-readiness
(reserved, not implemented):** each descriptor reserves an extension-point field for
future AI-compatibility metadata (e.g., whether a future AI-generated explanation could
ever accompany this module's content) — no AI behavior exists today; the field exists
so a future capability doesn't require a schema redesign, subject to the full
ADR-001/004/005 gate whenever actually proposed (§15).

## 7.2 `PatientModuleState` (Sheet-backed)
`patient_id`, `module_id`, `enabled` (boolean), `enabled_by`, `enabled_at`. Absence of a
row means disabled by default (fail-closed, ADR-010). **Enablement is always an
explicit doctor/staff action** (§14) — never automatic-by-condition, never
patient-controlled.

## 7.3 Dashboard Registry (frontend) — now a committed migration, not a deferral
**Elevated per ADR-012's amendment:** the patient dashboard is generated from enabled
modules, not fixed pages — for **every** module, including the three existing Phase 2A
cards (Timeline, Symptom Tracker, Reports), not only new Phase 2B modules. This is a
distinct, later batch from Module Registry itself (§22: "Module Registry" then
"Dashboard Registry") — the registry and enablement mechanism ships first; migrating
`dashboard.js`'s hardcoded rendering onto it, for every card, ships as its own
subsequent batch. Migrating a card's *rendering* onto the registry does not change or
remove its underlying feature — Symptom Tracker's data and endpoints are unaffected by
this migration; only *how the card is decided to appear and be enabled* changes.
Symptom Tracker's actual retirement (§10.1) remains a separate, later, explicitly-
approved batch, distinct from this rendering migration.

## 7.4 As the foundation for every patient-facing consumer
Every new patient-facing module — Daily Check-ins (§10), Calculator (§8), Care Plan
(§12) — registers through this pillar. The dashboard's rendering (§13) *is* this
pillar's patient-facing surface for the whole dashboard, not a separate concern.

# 8. Calculator Framework Architecture (Pillar 3) — Confirmed, With a Calculator Registry

Governed by **ADR-013 (confirmed, unchanged)** — deterministic only, never AI-computed.

## 8.1 Calculator Registry (new, mirrors Module Registry)
A versioned list of available calculators — calculator slug, display title, input field
list, formula-definition reference, relevant condition(s) (metadata, not hardcoded
logic — see §8.3). Every calculator plugs into this registry; nothing about a specific
disease is special-cased in the Calculator Framework's own code. **AI-readiness
(reserved, not implemented):** mirroring §7.1, each registry entry reserves an
extension-point field for future AI-generated explanatory text about a result (never
the result itself, which stays deterministic forever per ADR-013) — no such feature
exists today; the reservation only avoids a future schema redesign.

## 8.2 Data model
`CalculatorDefinition` — a versioned code/config artifact (formula logic, input field
list), doctor/staff-authored and deterministic, referenced by the Calculator Registry,
not Sheet-backed. `CalculatorResult` (Sheet-backed): `record_id`, `patient_id`,
`calculator_slug`, `definition_version`, `input_snapshot` (JSON-encoded, see §11.4's
now-concrete policy), `result_value`, `computed_at`.

## 8.3 Pluggability — avoid hardcoding disease-specific calculators
**Explicit constraint, per approved direction:** a new calculator is added by
registering a new `CalculatorDefinition` and a Calculator Registry entry — never by
adding disease-specific branches inside shared Calculator Framework code. A
calculator's relevance to a condition is expressed as registry metadata (e.g., a
`relevant_condition_slugs` list), consumed generically by whatever logic later decides
default visibility (§14) — the framework itself has no knowledge of any specific
disease.

## 8.4 As a pillar
General-purpose, not single-use — any future deterministic, doctor-authored scoring or
assessment need is a new registry entry, not new architecture. Visibility to a given
patient is governed by `PatientModuleState` (§7.2), enabled only by explicit doctor
action (§14).

# 9. (Reserved — see §17 for the complete entity table)

# 10. Personalized Daily Check-ins Architecture (Replacing Symptom Tracker v1) — Settled

A consumer of Pillars 1 and 2.

## 10.1 "Replacing" remains a migration, not a single cutover
Unchanged from Version 2.0: Daily Check-ins ship alongside the existing Symptom
Tracker first, proven in production, then Symptom Tracker retirement ships as its own,
later, separately-approved batch (§22). Existing `SymptomLogs` rows are never deleted;
they remain permanent historical data.

## 10.2 Template assignment — settled: doctor-driven, never patient-configured
**The patient never configures, selects, or edits a Check-in template.** A
`CheckInTemplate` is assigned to a patient by a doctor/staff member, informed by (but
not automatically derived from) the patient's active `DoctorAssignedCondition`(s) —
the same "doctor decides, condition informs" pattern as module enablement (§6.3, §14).
This resolves Version 2.0's open question about multi-condition template selection:
**a doctor explicitly assigns which template(s) apply**, rather than the system
auto-resolving a conflict when a patient has more than one active condition.

## 10.3 Data model — `CheckInResponse`
`record_id`, `patient_id`, `template_id`, `template_version` (both stored — see §11.4;
pinning both is what makes a response permanently self-describing even as templates
evolve), `logged_at` (server-set), `answers` (JSON-encoded, §11.4), `condition_slug`
(optional, for reporting/filtering only — assignment authority is §10.2's doctor
action, not this field). Same lifecycle as `SymptomLog`: create → persist → read, no
update, no delete.

# 11. Template Registry Architecture (Generalized from Template Engine — ADR-016)

Governed by **ADR-016**, which complements ADR-012 (Module Registry) and ADR-013
(Calculator Registry) rather than replacing either.

## 11.1 What it's for
The mechanism by which a doctor/staff-authored question set (Daily Check-ins) or
content structure (Care Plan) is defined once and assigned per patient by a doctor,
per §10.2 — not a patient-facing configuration surface. **Generalized in Version 4.0:**
what this section originally called the "Template Engine," scoped only to
`CheckInTemplate`, is now understood as the first concrete category of a general
**Template Registry** — a versioned list of template descriptors (mirroring the Module
Registry and Calculator Registry pattern) from which any patient-facing form or
questionnaire is generated, never hardcoded per form. See §11.5 for the registry's
scope beyond Daily Check-ins.

## 11.2 Data model — `CheckInTemplate`
`template_id` (identifies the logical template, stable across edits), `version`
(integer, increments per edit), `condition_slug` (optional metadata — informs, does not
automatically determine, doctor assignment per §10.2), `questions` (ordered list of
`{field_key, label, type, min, max, required}`), `status` (active/retired),
`created_by`, `created_at`. A `(template_id, version)` pair is immutable once created;
editing a template creates a new `version` row under the same `template_id`, never an
in-place mutation.

## 11.3 The representational choice — approved
**Approved, per explicit direction:** template responses (`CheckInResponse.answers`)
and calculator inputs (`CalculatorResult.input_snapshot`) are stored as structured
JSON, not a fixed superset of generic columns. This is no longer an open design fork —
it is this plan's concrete policy, documented in full below.

## 11.4 JSON Storage: Versioning, Migration, and Validation Rules

**Schema versioning.**
- Every `CheckInTemplate` version is immutable once created (§11.2). A `CheckInResponse`
  row stores **both** `template_id` and `template_version` (§10.3) — never `template_id`
  alone — so the exact question set that produced a given `answers` payload is always
  unambiguously resolvable, even after the template has since been edited into a later
  version. The same discipline applies to `CalculatorResult.definition_version` (§8.2).
- A template/definition version's `questions`/input-field list is the JSON Schema for
  its own `answers`/`input_snapshot` payloads, generated at read time from the
  versioned question list (field_key → type/min/max/required), not maintained as a
  separately-versioned artifact — one source of truth per version, not two.

**Validation rules.**
- At write time, `answers`/`input_snapshot` must validate against the referenced
  `(template_id, template_version)` or `(calculator_slug, definition_version)`'s
  question/field list — every `field_key` present must exist in that version's
  definition, every `required` field must be present, every value must satisfy its
  declared `type`/`min`/`max` — using the same generic, dependency-free validation
  approach `validation/phase-2a-foundation/schema-validator.js` already established for
  `shared/*.schema.json` contracts. A row that fails this check is rejected before
  being persisted, the same fail-closed discipline every existing write endpoint uses.
- The JSON payload itself must be **size-bounded** at write time (mirroring
  `FoundationReports.gs`'s existing upload-size check), and its top-level shape must be
  a flat object (`{field_key: value}`) — no nested objects or arrays-of-objects in
  version 1 of this policy, keeping the validation surface small and auditable.
- Serialization must be **deterministic**: keys written in a fixed, stable order
  (e.g., the order `field_key`s appear in the template/definition's own question list)
  so re-serializing identical answers never produces a spurious byte-level diff — a
  concrete, checkable property, not just an aspiration.

**Migration strategy.**
- Adding a new optional question/field in a new template version is backward-
  compatible: older `CheckInResponse` rows simply lack the new `field_key`, and are
  still valid against the *version they were recorded against* — no migration of old
  rows is ever required or performed.
- Removing a question, changing a `field_key`'s type, or narrowing a `min`/`max` range
  requires a **new version**, never an in-place edit of an existing version's
  definition (§11.2) — old rows remain permanently valid against the old version they
  were recorded against, forever, even after the template is edited many times.
  There is no scenario in this policy where an existing `CheckInResponse` or
  `CalculatorResult` row is ever rewritten to match a newer version — versions are
  append-only and rows are immutable, consistent with every other entity's "no update"
  lifecycle in this plan (§10.3, §8.2).
- A future reporting/aggregation feature (e.g., a trend view) that needs to compare
  answers across versions must resolve each row's own `(template_id, template_version)`
  independently before interpreting it — this is a consumer-side responsibility, not
  something the storage layer resolves on the consumer's behalf.

**Known limitation, disclosed:** a doctor/staff member opening the raw Sheet directly
sees an unreadable JSON blob in the `answers`/`input_snapshot` column instead of a
plain value, unlike every other existing Sheet-backed entity. This is an accepted,
disclosed cost of this approved policy, not an oversight (docs/45 tracked this in
detail before this policy was approved).

## 11.5 Template Registry — Scope Beyond Daily Check-ins (New, ADR-016)

**Purpose, restated at the registry level:** patient-facing forms and questionnaires
must be generated from templates rather than hardcoded, for any category, not only
Daily Check-ins. `CheckInTemplate` (§11.2) is this registry's first concrete category
— proof the pattern works — not the only category the registry is designed for.

**Named future categories (reserved, unscoped, not designed by this document):**
Weekly Check-in, Monthly Review, Condition Review, Lifestyle Questionnaire, Follow-up
Questionnaire, and Doctor-created Templates. None of these is scoped, batched, or
authorized by this plan — naming them here only ensures that whichever is proposed
next reuses this one general mechanism instead of a bespoke one, the same discipline
already applied to Module Registry (§7) and Calculator Registry (§8).

**What the registry must support, for every category, without a code change:**
- **Versioning** — the immutable `(template_id, version)` discipline already specified
  in §11.2/§11.4 applies uniformly; a new category is a new set of registry rows, never
  new versioning logic.
- **Activation/deactivation** — `status` (active/retired, §11.2) generalizes to every
  category; retiring a template never deletes historical responses (§11.4's
  append-only, immutable-rows discipline).
- **Future AI compatibility (reserved, not implemented)** — mirroring §7.1/§8.1, every
  template descriptor reserves an extension-point field for future AI-compatibility
  metadata (e.g., whether a future AI-assisted summary of responses could ever be
  offered). No AI feature exists today; the field only avoids a future schema
  redesign, and any eventual use still requires the full ADR-001/004/005 gate (§15).
- **Doctor assignment** — every category follows §10.2's settled rule: a doctor/staff
  member assigns which template(s) apply; **the patient never configures, selects, or
  authors a template**, including a "Doctor-created Template" category, which means a
  template *authored by* a doctor, not one *configured by* a patient.

**Relationship to ADR-012:** this ADR is deliberately structured as a complement, not a
replacement — Module Registry governs *which capability* is exposed to a patient;
Template Registry governs *the shape of the form or questionnaire* a given capability
(e.g., the Daily Check-in module) renders once exposed. The two registries answer
different questions and are expected to be used together, not merged.

# 12. Personal Care Plan Architecture

Unchanged from Version 2.0. A consumer of Pillars 1 and 2. `DoctorInstruction`
(`instruction_id`, `patient_id`, `care_plan_id`, `consultation_id`, `instruction_type`,
`content`, `prescribed_by`, `effective_date`, `status`) and `CarePlan` (`care_plan_id`,
`patient_id`, `version`, `status`, `goals`, `next_review_date`, `created_by`,
`created_at`) promote docs/33 §2.3/§3.4 from Conceptual to designed. Doctor/staff-
authored only, patient-viewable only. A new Care Plan version emits a `TimelineEvent`
(`entry_type: care_plan`).

# 13. Patient Dashboard Evolution — "Health Journey," Refined (Version 4.0)

The Module Engine pillar's patient-facing surface, now covering the **entire**
dashboard (§7.3), not only new modules. This subsection refines, without changing, the
already-committed §7.3 decision: the dashboard is not a fixed page — it is the patient's
dynamic **Health Journey**, rendered entirely from whatever the Module Registry (§7.1)
says is enabled for that specific patient.

## 13.1 Registry-driven, not disease-driven
The dashboard has no per-disease code path, ever. Every card — existing or future —
is one Module Registry entry, rendered by the same generic loop regardless of which
condition(s) a patient is assigned (§6). A patient with condition A and a patient with
condition B see different *content* because they have different `PatientModuleState`
rows (§7.2, §14) — never because the dashboard contains an `if condition == 'A'`
branch anywhere. This is §7.3/§8.3's existing "never hardcoded per disease" constraint,
restated once at the whole-dashboard level rather than per-pillar.

## 13.2 Illustrative module categories (not a fixed or final list)
The kind of content the registry can render today or in a clearly-anticipated future
batch — illustrative, not a scope commitment beyond what §22 already batches:
- **Today's Tasks** — whatever check-ins, follow-ups, or actions are currently due.
- **Timeline** — existing, `TimelineEvent` (§3.1 docs/33), unchanged by this pass.
- **Reports** — existing, unchanged.
- **Check-ins** — Daily Check-in Engine (§10), and any future Template Registry
  category (§11.5), once individually batched and approved.
- **Calculators** — Calculator Registry (§8), once its batch ships.
- **Personal Care Plan** — §12, once its batch ships; currently an empty-state
  placeholder, exactly as today.
- **Future AI modules** — not designed here; §15's AI Boundaries and every registry's
  reserved AI-compatibility extension point (§7.1, §8.1, §11.5) exist so a future AI
  module, if and when actually proposed, plugs into the same registry mechanism rather
  than requiring a new one.
- **Digital Twin modules** — Phase 2D (§16), a future consumer, not part of this
  sequence.

Messages and Digital Twin remain `future`-badged placeholders today (Messages has no
architecture anywhere; Digital Twin is Phase 2D, §16) — naming them above as
illustrative future registry entries does not batch, schedule, or design either.

## 13.3 What this refinement changes, and what it does not
This is a **naming and framing refinement**, not a new architectural decision: §7.3's
migration batch (PXP-4, Dashboard Registry), its scope, and its risk classification
(docs/45's top-ranked risk) are all unchanged. "Health Journey" is this document's name
for the already-committed registry-driven dashboard vision (docs/21's own "My Health
Journey" product name, §22's `dashboard.js` target) — not a new UI, page, or batch.

# 14. Feature Enable/Disable Per Patient — Settled

`PatientModuleState` (§7.2) is the one mechanism. **Settled, per approved direction:
enablement is always an explicit doctor/staff action.** It is never automatic based on
a `DoctorAssignedCondition` (§6.2) — a condition assignment informs what a doctor
*might* enable, it does not itself enable anything — and it is never
patient-controlled. This resolves Version 2.0's open question in favor of the simpler,
more auditable default, now as a locked decision rather than a recommendation.

# 15. AI Boundaries — Reaffirmed

Unchanged from Version 2.0, reaffirmed per explicit direction: **AI never becomes the
source of truth. AI only consumes approved clinical data. Doctor approval remains
mandatory** — this is ADR-001/004/005 restated, not a new rule. No capability in §§4–14
requires, assumes, or authorizes any new AI integration. The reserved "AI Integration"
placeholder (§22 item 9) is exactly that — a reserved batch slot, with no concrete
feature designed here. Whatever is eventually proposed for it must independently
satisfy ADR-001 (grounded in Knowledge-Engine-approved content), ADR-005 (prompt
constraint + code-level check + mandatory doctor review before any patient sees
anything), and, if it touches Calculator results, ADR-013 (results themselves stay
deterministic; only surrounding explanatory text could ever be AI-generated, and only
under the full ADR-001/005 pattern).

# 16. Digital Twin Integration Scope for Phase 2B — Explicit Consumer List

Digital Twin's own architecture remains Phase 2D's responsibility (docs/24) and is
**not tightly coupled to this plan's implementation**, per explicit direction. Phase
2B's only obligation is data-shape compatibility: Digital Twin is a **future consumer**
of —
- **Timeline** (existing, `TimelineEvent`, extended by Care Plan updates, §12)
- **Reports** (existing, unchanged)
- **Daily Check-ins** (`CheckInResponse`, §10.3)
- **Care Plans** (`CarePlan`/`DoctorInstruction`, §12)
- **Calculators** (`CalculatorResult`, §8.2)

Every entity above is `patient_id`-keyed, timestamped, and never destructively
overwritten — the shape a future Digital Twin needs, without a redesign. This plan
builds no Digital Twin UI, narrative generation, or aggregation logic, and no batch in
§22 depends on Digital Twin existing.

# 17. Data Architecture — New/Promoted Entities Summary

| Entity | Pillar / capability | Status before this plan | Sheet-backed? |
|---|---|---|---|
| `PatientProfile` | Patient Profile (§18 note) | Did not exist | Yes |
| `DoctorAssignedCondition` | Pillar 1 (§6) | Did not exist (renamed from `ConditionAssignment`) | Yes |
| Module Registry | Pillar 2 (§7.1) | Did not exist | No (config) |
| `PatientModuleState` | Pillar 2 (§7.2) | Did not exist | Yes |
| Calculator Registry | Pillar 3 (§8.1) | Did not exist | No (config) |
| `CalculatorDefinition` | Pillar 3 (§8.2) | Conceptual (docs/33 §5.3) | No (config/code) |
| `CalculatorResult` | Pillar 3 (§8.2) | Conceptual (docs/33 §5.3) | Yes |
| Template Registry | Template Registry (§11, ADR-016) | Did not exist | No (config) |
| `CheckInTemplate` | Template Registry, first category (§11.2) | Did not exist | No (config/content) |
| `CheckInResponse` | Daily Check-ins (§10.3) | Did not exist | Yes |
| `DoctorInstruction` | Care Plan (§12) | Conceptual (docs/33 §2.3) | Yes |
| `CarePlan` | Care Plan (§12) | Conceptual (docs/33 §3.4) | Yes |
| `TrustedDevice` | Persistent auth (§5.3) | Did not exist | Yes |
| `PatientCredential` | Persistent auth, convenience-only (§5.4) | Did not exist | Yes |

Every Sheet-backed entity follows ADR-006's flat-column/UUID-`record_id` convention
except where §11.4 documents the JSON-encoded-column policy as a deliberate, now-fully-
specified exception. docs/33-DOMAIN-MODEL.md §6 is updated by this same change.

**Patient Profile (unchanged from Version 1.0 §5):** a separate entity from `Patient`
(never widening the frozen schema, same reasoning as §6.2 for Doctor-Assigned
Conditions). `patient_id` (1:1), `phone`, `date_of_birth`, `preferred_contact_method`,
`emergency_contact`, `updated_at`, `updated_by`.

# 18. Security Model

- **Authentication (§5):** Trusted Device and Long-Lived Session reuse `LoginToken`'s
  already-proven hashing pattern — no new cryptographic bridge for the primary
  mechanisms. The optional PIN path still requires a dedicated security review (real
  iteration count, minimum length, lockout threshold) before its batch ships,
  independent of Trusted Device/Long-Lived Session's approval.
- **`PatientProfile`** is the platform's first patient-mutable structured data — every
  write session-derived-`patient_id`-scoped and audit-logged.
- **`DoctorAssignedCondition` / `PatientModuleState` / `DoctorInstruction` / `CarePlan`**
  writes are staff/doctor-only, enforced server-side.
- **JSON-encoded columns** are size-bounded, flat-shape-only, and validated against
  their referenced version before persisting (§11.4) — not an unchecked blob.
- **`TrustedDevice` tokens** are exchanged, rotated on every use, and revocable — the
  same mitigation shape as industry-standard refresh-token rotation.

# 19. Migration From Phase 2A

Unchanged from Version 2.0: `Patient` unmodified; `SymptomLogs` retained permanently,
retirement is its own later batch; `LoginTokens`/`Session` unmodified, `TrustedDevice`
fully additive and reuses `LoginToken`'s hashing pattern; `dashboard.js` migrates fully
onto the Dashboard Registry (§7.3) as its own batch, with existing features unaffected
by the rendering-mechanism change itself; `FoundationRouter.gs` gains additive dispatch
cases only.

# 20. Risks

1. **JSON storage (§11.4)** — now a documented, concrete policy rather than an open
   fork; residual risk is the disclosed raw-Sheet-readability cost, not the design
   itself.
2. **Optional PIN hashing (§5.4)** — unchanged, still requires its own security review,
   now clearly scoped as affecting only patients who opt into the convenience path.
3. **Full dashboard migration (§7.3)** — larger implementation surface than Version
   2.0's deferred-migration approach (every existing card's rendering changes, not just
   new ones), but lower architectural risk, since it resolves ADR-012's original open
   "Future Consideration" deliberately rather than leaving two rendering paths
   (registry-driven and hardcoded) coexisting indefinitely.
4. **Long-Lived Session's implementation path (§5.5)** — whether it requires touching
   the frozen `FoundationSession.gs` is not decided here; a real open question for the
   batch that builds it.
5. **Scope size** — ten-plus batches (§22), mitigated by pillars/infrastructure-first
   sequencing giving each subsequent batch a firmer foundation to build on.

# 21. Documentation Impact

**Version 4.0 (2026-07-09, this pass):**

| Doc | Update needed | Status |
|---|---|---|
| docs/24-ROADMAP.md | Batch renaming PXP-1…PXP-11; Template Registry mention | Done, this change |
| docs/31-ADR-INDEX.md | Add ADR-016 (Template Registry) | Done, this change |
| docs/33-DOMAIN-MODEL.md | Batch renaming; add Template Registry entity (§6.7) | Done, this change |
| docs/44 (this document) | Version 4.0 | Done, this change |
| docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md | Version 4.0 | Done, this change |
| docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-REVIEW.md | Version 4.0 | Done, this change |
| `/adr/ADR-016` | New | Done, this change |
| CHANGELOG.md | Record this architecture-freeze finalization pass (no code change) | Done, this change |

**Version 3.0 (2026-07-08, prior pass — kept for reference):**

| Doc | Update needed | Status |
|---|---|---|
| docs/24-ROADMAP.md | Reflect settled decisions and revised implementation order | Done, that change |
| docs/31-ADR-INDEX.md | Add ADR-015, mark ADR-014 Superseded, note ADR-012 amendment | Done, that change |
| docs/33-DOMAIN-MODEL.md | Rename `ConditionAssignment` → `DoctorAssignedCondition`; add Long-Lived Session | Done, that change |
| `/adr/ADR-015` | New | Done, that change |
| `/adr/ADR-014` | Marked Superseded | Done, that change |
| `/adr/ADR-012` | Amendment note added | Done, that change |
| `shared/schemas/*.schema.json` for entities in §17 | Not yet written — created when each entity's implementing batch begins | Deferred, by design |

# 22. Implementation Batches — Infrastructure First

Re-ordered per explicit direction to build infrastructure before features. **No batch
below is authorized to begin by this document.**

| # | Batch | Delivers | Depends on | Risk / reversibility |
|---|---|---|---|---|
| 1 | **PXP-1 — Patient Profile** | `PatientProfile` + patient-facing profile view/edit | Nothing new | First patient-mutable structured data — its own authorization/audit review. Zero dependency on anything else, lowest-risk starting point. |
| 2 | **PXP-2 — Doctor-Assigned Conditions** (Pillar 1) | `DoctorAssignedCondition` + doctor/staff assignment tool | Nothing new | Zero patient-facing surface beyond a read-only reflection, if any. Fully reversible. |
| 3 | **PXP-3 — Module Registry** (Pillar 2, backend) | Module Registry config + `PatientModuleState`, no dashboard rendering change yet | PXP-2 informs future default-enablement discussion, not a hard dependency | Additive scaffold, invisible to patients until PXP-4. |
| 4 | **PXP-4 — Dashboard Registry** (Pillar 2, frontend) | `dashboard.js` rewritten to render all modules — including Timeline, Symptom Tracker, Reports — from PXP-3's registry | PXP-3 | Larger surface than a scaffold-only batch (touches every existing card's rendering path), but no underlying feature/data is changed — only how each card is decided to appear. |
| 5 | **PXP-5 — Daily Check-in Engine** | `CheckInTemplate` + `CheckInResponse` + patient-facing Check-in UI, doctor-assigned templates, registered via PXP-3/4, shipped alongside (not replacing) Symptom Tracker | PXP-2 (doctor-assigned templates), PXP-3/PXP-4 (registration/rendering) | Additive; Symptom Tracker untouched. |
| 6 | **PXP-6 — Calculator Registry** (Pillar 3, formerly called "Calculator Framework" — renamed for platform-wide naming consistency, no scope change) | Calculator Registry + `CalculatorDefinition` + `CalculatorResult` + Patient Calculator UI, registered via PXP-3/4 | PXP-3/PXP-4 | Deterministic logic only (ADR-013) — low risk. |
| 7 | **PXP-7 — Personal Care Plan** | `DoctorInstruction` + `CarePlan` + patient-facing read-only Care Plan view, registered via PXP-3/4 | PXP-2, PXP-3/PXP-4 | Doctor-authored only — no new patient-write surface. |
| 8 | **PXP-8 — Trusted Device + Long-Lived Session + Optional PIN** (formerly called "Persistent Login" — renamed for platform-wide naming consistency, no scope change) | `TrustedDevice` + Long-Lived Session issuance + optional `PatientCredential` (PIN) | Independent of pillars — sequenced late per explicit direction, benefiting from pillars already existing to make persistence worth having. PIN sub-batch requires its own dedicated security review before approval, independent of Trusted Device/Long-Lived Session. | Trusted Device/Long-Lived Session reuse proven hashing (low risk); PIN carries the disclosed hashing-bridge risk (§18), gated separately. |
| 9 | **PXP-9 — AI Integration** (reserved placeholder) | Nothing concrete — a named slot in the sequence for whatever AI-touching capability is eventually proposed | Whatever it turns out to require, decided when it is actually proposed | Not scoped; must independently satisfy §15/ADR-001/004/005/013 before any detail is added |
| — | **PXP-10 — Symptom Tracker Migration** (formerly called "Symptom Tracker retirement" — renamed for platform-wide naming consistency; still the cutover/retirement step of the migration described in §10.1, not a new scope; not one of the nine named items; added per ADR-008's requirement that retirement never bundle with its replacement's introduction) | Symptom Tracker dashboard entry removed, endpoints deprecated, `SymptomLogs` retained | PXP-5 proven in production first | Explicitly separate, later, own approval |
| — | **PXP-11 — Closeout** (formerly called "Validation & closeout" — renamed for platform-wide naming consistency, no scope change; mirrors every prior phase's closeout discipline) | Validation-suite build-out for every entity above + documentation closeout | All shipped batches above | Documentation/validation only |

Digital Twin is **not** in this sequence — it remains a later roadmap consumer (Phase
2D, §16), not a Phase 2B batch.

**Recommended first batch: PXP-1 (Patient Profile)** — per explicit direction to begin
with infrastructure rather than features, and the batch with the fewest dependencies
and lowest risk in the entire sequence.

**This plan does not authorize PXP-1, or any other batch, to begin.** Implementation
waits for a separate, explicit approval naming a specific batch.

# 23. Implementation-Time Amendment — Batch PXP-5 (2026-07-12)

Per docs/47-PHASE-2B-IMPLEMENTATION-RULES.md §12's explicit provision ("docs/44 itself
may still be amended ... if a later batch's real-world implementation surfaces a
genuine design gap"), this section records one such gap, found while implementing
PXP-5, and its fix — additively, without altering a single word of this document's own
frozen Version 4.0 body text above.

**The gap:** §10.2 settles that "a doctor explicitly assigns which template(s) apply"
to a patient, informed by their Doctor-Assigned Condition(s) — but neither §17's entity
table nor docs/33 §6.5 names a persisted shape for that assignment decision itself.
Without one, §10.2's rule has nothing to record a decision into, and
`CheckInResponse`'s own write path has no way to verify a patient is actually assigned
the `template_id` they are submitting against (as opposed to merely verifying it exists
in the registry at all).

**The fix:** `CheckInTemplateAssignment` — an exact structural mirror of §6.2's
already-approved `DoctorAssignedCondition` shape (many-per-patient, append-mostly,
doctor/staff-only, one-way resolve, no real Doctor identity/session yet per §1.4's
disclosed gap, no Web App write route). This is a gap-fill within PXP-5's own named
scope, not a new architectural decision: it introduces no new registry, no new ADR, and
does not alter §11's Template Registry design, §10.2's rule, or any other section above
— it only gives that already-settled rule a place to persist its decision. Full detail:
`shared/schemas/check-in-template-assignment.schema.json` and its companion `.md`,
`apps-script/CheckInTemplateAssignment.gs`'s own header comment, and docs/33 §6.5's
Batch PXP-5 status update.
