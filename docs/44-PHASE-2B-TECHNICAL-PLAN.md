# 44 - Phase 2B Technical Plan
## Version 1.0 — 2026-07-04

> **This document defines architecture only. It authorizes no production code.**
> Per docs/43-PHASE-2A-CLOSEOUT.md §12 and docs/24-ROADMAP.md's Phase 2B entry,
> implementation may not begin until a separate, explicit approval is given for a named
> batch from §21 below. This plan, docs/45 (Architecture Readiness Review), and docs/46
> (Repository Consistency Review) are the architecture-freeze pass docs/32 Part 2
> required before Phase 2B implementation could ever start — the same discipline
> docs/29/30/31/33/34 applied to Phase 2A before Batch 5A began.

---

# 0. Framing

Phase 2A (`docs/43`) is frozen except for genuine bug fixes. Nothing in this document
modifies a single frozen file. Every Phase 2B capability described here is designed as
**additive**: new Sheets, new schemas, new Apps Script files, new dispatch cases, and —
where the existing frontend architecture cannot accommodate genuine growth without it
(the dashboard specifically) — a new, additive pattern that existing Phase 2A cards are
not required to adopt in the same batch (ADR-012).

docs/24-ROADMAP.md's Phase 2B entry, as it stood before this document, read only:
"Phase 2B — Personal Care Plan. Requires its own architecture-freeze pass... no
technical plan exists yet." The scope actually requested for this planning pass is
substantially larger than that one line: persistent authentication, Patient Profile,
Doctor-Assigned Conditions, a Module Engine, a Template Engine, Personalized Daily
Check-ins (replacing Symptom Tracker v1), a Calculator Framework, Personal Care Plan
itself, Dashboard evolution, per-patient feature enablement, AI boundaries, and Digital
Twin integration scope. This is flagged explicitly in docs/46 Part 3 as a real roadmap
scope expansion, not silently absorbed — docs/24 is updated by this same change to
describe the expanded scope, but the roadmap update does not itself constitute
implementation approval.

# 1. Objectives

1. Give every capability below a data model, an ownership model, and an explicit
   security/AI boundary — the same bar docs/29 held Phase 2A to.
2. Resolve the one direct conflict this scope creates with existing, Accepted
   architecture (ADR-003 vs. persistent authentication) through a formal ADR amendment,
   not a silent choice (ADR-011).
3. Identify every place a design decision was **not** made because the requesting
   instruction explicitly forbade assuming one — surfaced as an open question in §§4–15
   and consolidated in docs/45.
4. Produce a batch sequence (§21) that keeps every intermediate state deployable and
   reversible (ADR-008), mirroring Phase 2A's foundation → auth → data → highest-risk →
   visibility ordering.

# 2. Scope

## 2.1 In Scope
- Architecture and data-model design for: Persistent Authentication, Patient Profile,
  Doctor-Assigned Conditions, Module Engine, Template Engine, Personalized Daily
  Check-ins, Calculator Framework, Personal Care Plan, Dashboard evolution, per-patient
  feature enablement.
- AI-boundary definition for every above capability that could ever touch AI.
- Digital Twin integration scope **as it constrains Phase 2B's own data shapes** —
  not Digital Twin's own architecture (that is Phase 2D's, per docs/24).
- Migration planning from Phase 2A's existing Symptom Tracker v1 data and dashboard.
- New/amended ADRs (ADR-011, ADR-012, ADR-013).

## 2.2 Out of Scope
- Any production code. This is a documentation-only batch (see the notice at top).
- Digital Twin's own narrative/summarization logic (Phase 2D, requires the full
  ADR-001/004/005 pattern per docs/24).
- Health Milestones (Phase 2C).
- Appointment (docs/33 §4.1) — a real, named gap, but not requested for this pass and
  not a dependency of anything in §§4–15 below.
- Resolving Calculator's pre-existing roadmap-ownership gap beyond giving it a home in
  Phase 2B (docs/33 §5.3, docs/34 Part 3/Part 4 item 5 — this plan closes that specific
  gap by claiming the Patient-variant Calculator for Phase 2B; the Public/no-login
  variant remains unclaimed, see docs/46 Part 3).

## 2.3 Explicit Non-Goals
- This plan does not attempt to migrate any existing Phase 2A card (Timeline, Symptom
  Tracker, Reports) onto the new Module Registry (ADR-012's Future Considerations
  defers that explicitly).
- This plan does not pick a final PIN length, iteration count, or lockout threshold —
  those are implementation-time security-review parameters (§17), not architecture.
- This plan does not decide whether the Public (no-login) Calculator variant is ever
  built — only the Patient variant is in scope here.

# 3. Relationship to Existing (Frozen) Architecture

Everything below is additive on top of:
- **ADR-002** (`patient_id` is the durable identity) — every new entity below is keyed
  by `patient_id`, never by a credential or a condition.
- **ADR-006** (Sheets is an implementation detail) — every new Sheet-backed entity
  follows the same flat-column, UUID-`record_id`, migration-safe convention as
  `Patients`, `SymptomLogs`, `Reports`.
- **ADR-008/ADR-009** (independently deployable, independently replaceable) — governs
  §21's batch ordering and every module boundary below.
- **ADR-001/004/005** (Knowledge Engine grounding, Digital Twin boundary, doctor
  supervision) — reaffirmed, not modified, by §14/§15.
- **`shared/` contracts** (`shared/README.md`) — every new schema below is proposed at
  the same fidelity docs/33 already uses for conceptual entities; the actual
  `shared/*.schema.json` files are written when a batch implements them, per the
  Foundation-era precedent (docs/29 §14: "shared-first, implementation-second").

No existing `apps-script/Foundation*.gs` file, `shared/*.schema.json`, or frozen HTML
page is modified by this plan. Every new dispatch case is additive to
`FoundationRouter.gs`'s existing action list (docs/46 confirms no name collisions).

# 4. Persistent Authentication Architecture

## 4.1 The conflict, and how it's resolved
ADR-003 states "no patient password is ever collected, stored, or reset" — an absolute
prohibition. The requested capability ("password/PIN with Magic Link recovery") directly
contradicts that sentence. **ADR-011** (new) resolves this by formal amendment, not
silent override: magic link remains the mandatory, always-available default; a
PIN/password is an **opt-in**, additive second factor a patient may set up only after
already authenticating once via magic link; it resolves to the same `patient_id`
(ADR-002) and can never lock a patient out of magic-link access. See ADR-011 for the
full decision and its Consequences.

## 4.2 Why Apps Script forces a real, disclosed trade-off here
Neither of the platform's two existing hashing mechanisms is safe to reuse unmodified
for a human-chosen, low-entropy secret:

| Mechanism | Used for today | Why it's unsafe for a PIN/password as-is |
|---|---|---|
| `Utilities.computeDigest` (SHA-256) | LoginToken fingerprint | Plain, unsalted, no work factor — safe only because the input (a 3×UUID token) is already unguessable. A 4–6 digit PIN hashed this way is brute-forceable offline in milliseconds if the row is ever exfiltrated. |
| `Utilities.computeHmacSha256Signature` | Session-token signature | A single fast keyed MAC pass, designed to *authenticate* a payload, not to resist offline guessing of a low-entropy secret. |

Google Apps Script has no bcrypt/argon2/scrypt/PBKDF2 binding. This plan's proposed
mitigation (ADR-011 §4): a per-credential random salt plus a manually iterated
HMAC-SHA256 construction (repeated keying, not a single pass) to impose a real, tunable
work factor — a documented bridge, not a best-practice primitive. **This is flagged as
the single highest-risk item in the entire Phase 2B scope** (see docs/45 Part 3) and
requires a dedicated security review, with a real iteration count chosen against Apps
Script's execution-time ceiling, before any batch implementing it ships.

## 4.3 Data model — `PatientCredential` (new)
`credential_id` (UUID), `patient_id`, `credential_type` (enum: `pin` | `password`),
`salt` (random, per-credential), `credential_hash` (iterated-HMAC output),
`iteration_count` (stored per-row so a future increase doesn't invalidate old rows),
`created_at`, `updated_at`, `failed_attempt_count`, `locked_until` (empty-string
sentinel when not locked), `last_used_at`. One active row per patient per
`credential_type` — no history of prior credentials retained (a password/PIN change
overwrites, unlike every other append-only entity in this platform, because a credential
is not clinical history).

## 4.4 Open questions this plan does not decide
- **Minimum PIN length / password complexity rule.** Left to the dedicated security
  review (§17), not assumed here.
- **Exact lockout threshold and duration.** ADR-010 favors the more secure default, but
  the concrete number is an implementation-time tuning decision informed by real usage,
  the same posture ADR-010's own Future Considerations already took for session
  lifetime.
- **Whether a PIN and a password are mutually exclusive or a patient could set up
  both.** Not specified — recommend starting with "at most one active persistent
  credential type per patient" as the simplest safe default, revisited only if a real
  need for both emerges.

# 5. Patient Profile Architecture

## 5.1 What "Patient Profile" adds beyond the existing Patient Identity record
Today's `Patient` schema (`shared/schemas/patient-identity.schema.json`) holds only
`patient_id`, `full_name`, `email`, `condition_slug`, `status`, `created_at`,
`created_by` — an identity record, not a profile. docs/33 §1.1 confirms "the patient
does not edit their own profile in Phase 2A" — there is no profile-editing surface at
all today, patient- or staff-facing.

**Decision needed, not assumed here:** does "Patient Profile" mean (a) new
patient-editable fields added to the existing `Patient` record (phone number, date of
birth, address, emergency contact), or (b) a separate `PatientProfile` entity
referencing `patient_id`, kept apart from the conformance-tested, frozen
`patient-identity.schema.json`? Per ADR-006/ADR-009's additive-over-destructive
discipline and the same reasoning applied to Doctor-Assigned Conditions (§6), **this
plan recommends (b)** — a new `PatientProfile` entity — so that the frozen,
conformance-tested `Patient` schema and its 152 passing conformance checks are never
touched. This is a recommendation for docs/45 to evaluate, not a locked decision.

## 5.2 Proposed data model — `PatientProfile` (new, additive)
`patient_id` (1:1 with Patient, not its own UUID), `phone` (optional, empty-string
sentinel), `date_of_birth` (optional), `preferred_contact_method`, `emergency_contact`
(optional), `updated_at`, `updated_by`. Editable by the patient themselves (unlike
`Patient` identity fields) — the first Phase 2B entity where the patient, not staff, is
the primary author. `full_name` and `email` remain governed by the existing `Patient`
record; `PatientProfile` never duplicates them.

## 5.3 Security implication
This is the platform's first patient-*self-editable* structured data outside a
write-once log (SymptomLog/Report are append-only; this is mutable). Requires its own
authorization check (a patient may only ever update their own `PatientProfile`,
session-derived `patient_id`, never client-supplied — the same discipline as every
existing write endpoint) and its own audit-log event on every update (who changed what,
when — precedent: every existing write already logs to `AuditLog`).

# 6. Doctor-Assigned Conditions Architecture

## 6.1 Current state — a real gap, not a feature to extend
`condition_slug` on `Patient` is a single string, set once at patient creation by a
staff member running a manual Apps Script editor function
(`createFoundationPatient()`), loosely validated (not checked against the canonical
slug list — `apps-script/PatientIdentity.gs`'s own comment documents this as
deliberate). **There is no update endpoint, no staff UI, and no doctor-assignment
workflow for condition_slug today.** "Doctor-assigned Conditions" as requested is not an
extension of an existing feature — it is a net-new capability.

## 6.2 The plural-conditions design fork
The request specifies "Conditions" (plural); the existing schema is a single string.
Two real options, not decided here:

| Option | Description | Trade-off |
|---|---|---|
| **A — Widen `Patient.condition_slug` to an array** | Change the existing, conformance-tested `patient-identity.schema.json` field from string to array | Breaking schema-version change to a frozen, shipped contract; requires migrating every existing `Patient` row (pilot-scale, likely zero or few real patients today — low migration risk, but still touches a frozen file, which docs/43's freeze rules reserve for genuine bug fixes only) |
| **B — New `ConditionAssignment` entity** (`assignment_id`, `patient_id`, `condition_slug`, `assigned_by`, `assigned_at`, `status`: active/resolved) | Many-to-one Patient→Conditions, fully additive, full audit history of who assigned/resolved which condition and when | No schema change to any frozen file; slightly more complex to query ("all active conditions for patient X" is a filtered list, not a single field read) |

**This plan recommends Option B**, consistent with every other Phase 2B recommendation
in this document favoring additive entities over widening frozen, already-conformant
schemas (docs/43's freeze rule: "frozen except for bug fixes" — widening a field is not
a bug fix). Option B also directly enables the actual missing capability: a real
doctor-facing assignment *action* with a timestamp and an author, not just a wider
storage field. **This is a recommendation for docs/45/the approving reviewer to confirm,
not a locked decision** — Option A remains available if a future reviewer judges the
migration risk acceptable and prefers a simpler query shape.

## 6.3 Relationship to Module Engine and Calculator Framework
Doctor-Assigned Conditions is the mechanism that would drive per-patient module/
calculator relevance (e.g., a condition-specific Daily Check-in template or Calculator
only appearing for patients with that condition actively assigned) — see §7/§9/§10. No
automatic enablement rule is decided here; §13 covers the enablement mechanism itself.

# 7. Module Engine Architecture

See **ADR-012** for the binding decision. Summarized here with the concrete new
surfaces it requires:

## 7.1 Module Registry (config, not a Sheet)
A versioned list of module descriptors, analogous in form to
`shared/constants/condition-slugs.json`: module id, display title, data-source dispatch
action, empty-state behavior, rendering shape. Static, staff/developer-maintained — not
patient- or even doctor-editable.

## 7.2 `PatientModuleState` (new Sheet-backed entity)
`patient_id`, `module_id`, `enabled` (boolean), `enabled_by`, `enabled_at`. Absence of a
row for a given (patient, module) pair means **disabled by default** — fail-closed,
consistent with ADR-010 applied to feature exposure rather than security specifically.

## 7.3 Migration posture
Per ADR-012 and §2.3, existing Phase 2A cards (Timeline, Symptom Tracker, Reports) are
**not** required to migrate onto this registry in the same batch that introduces it.
Every *new* Phase 2B module (Daily Check-ins, Calculator, Care Plan) is built against
the registry from its first batch.

# 8. Template Engine Architecture

## 8.1 What it's for
The mechanism by which a doctor/staff-authored **question set** (for Daily Check-ins,
§9) or **content structure** (for Care Plan sections, §11) is defined once and applied
per condition or per patient, rather than hardcoded per feature the way today's fixed
four-field Symptom Tracker is.

## 8.2 The real architectural tension this creates
ADR-006 requires "flat, typed-by-convention columns" for every Sheet-backed schema.
A Template Engine's entire purpose is *variable* shape — different conditions ask
different questions. These two requirements are in genuine tension, and this plan does
not resolve it by assumption. Three options, evaluated:

| Option | Description | Assessment |
|---|---|---|
| **A — Fixed superset of generic columns** | e.g., ten generic `scale_1`…`scale_10` + `text_1`…`text_3` columns, reused/relabeled per template | Stays flat (ADR-006-compliant in the literal sense) but columns are meaningless without the template definition to interpret them — arguably *less* migration-safe than option B, since a real database migration would still need the template metadata to make sense of the columns |
| **B — JSON-encoded answers in one column** | `CheckInResponse.answers` stores a JSON string; the template definition (versioned, referenced by id) defines how to interpret it | Sacrifices in-Sheet queryability of individual answers (cannot easily `SUM()` a column in the raw Sheet), but is exactly how a real future database would model this (a JSONB column or a normalized child table) — arguably *more* aligned with ADR-006's actual intent ("design for migration to SQL... without changing frontend APIs") than a fixed superset that a real schema would never actually use |
| **C — One Sheet per check-in type** | Mirrors the existing SymptomLog/ConsultationHistory pattern — a dedicated Sheet per template | Sacrifices the entire point of a Template Engine (defining new templates without new Sheets/code) |

**This plan recommends Option B**, on the reasoning that ADR-006's binding requirement
is migration-safety, not literal column-flatness for its own sake, and a JSON-encoded
answers blob keyed by a versioned template id is the more honest, more migration-safe
representation of genuinely variable-shape data. **This is presented as a recommendation
requiring explicit sign-off, not a locked decision** — it is the second-most consequential
open design fork in this plan after §4's authentication trade-off, because it sets a
precedent for how every future variable-shape entity on this platform is modeled.

## 8.3 Data model — `CheckInTemplate` (config/content, staff-authored)
`template_id`, `condition_slug` (optional — a template can be condition-specific or
general), `version`, `questions` (ordered list of `{field_key, label, type, min, max,
required}`), `status` (active/retired), `created_by`, `created_at`. Versioned and
append-only, like Care Plan (§11) — editing a template creates a new version rather than
mutating one in place, so historical `CheckInResponse` rows remain interpretable against
the template version that was active when they were recorded.

# 9. Personalized Daily Check-ins Architecture (Replacing Symptom Tracker v1)

## 9.1 "Replacing" is a migration, not a single cutover
ADR-008 requires every batch to leave the system safely reversible. This plan proposes
Daily Check-ins ship **alongside** the existing Symptom Tracker first (both visible,
both writable, on the Module Registry from day one), proven in production, and only
then — as an explicitly separate, later batch — has the Symptom Tracker card retired
from the dashboard. Existing `SymptomLogs` rows are never deleted or migrated into the
new schema; they remain permanent historical data (consistent with every other
patient-facing entity's "never delete" convention), readable by a future Timeline/
Digital Twin view alongside new `CheckInResponse` rows, distinguishable by which entity
produced them.

## 9.2 Data model — `CheckInResponse` (new; supersedes `SymptomLogs` as the
   forward-going write path once the retirement batch ships)
`record_id`, `patient_id`, `template_id` (references `CheckInTemplate`, §8.3),
`logged_at` (server-set, following `SymptomLog`'s already-settled precedent),
`answers` (JSON-encoded, per §8.2 Option B), `condition_slug` (optional, mirrors
`SymptomLog`'s existing convention). Same lifecycle as `SymptomLog`: create → persist →
read, no update, no delete.

## 9.3 Personalization mechanism
"Personalized" means: which `CheckInTemplate` a patient sees is a function of their
active Doctor-Assigned Condition(s) (§6) — a patient with condition X sees the
`CheckInTemplate` where `condition_slug = X`, falling back to a general template if none
is condition-specific. This plan does not specify AI-driven personalization of question
*content* per individual patient (that would require Knowledge-Engine grounding per
ADR-001, and no such grounding source is proposed here) — personalization in this plan's
scope is template selection by condition, not per-patient question generation.

## 9.4 Open question
Whether a patient with multiple active conditions (§6.2) sees a merged template, one
template per condition, or a doctor-chosen single template is **not decided here** —
flagged for docs/45.

# 10. Calculator Framework Architecture

Governed by **ADR-013** (new) — deterministic only, never AI-computed. Closes docs/33
§5.3 / docs/34 Part 3's "roadmap omission" finding for the Patient variant specifically
(docs/46 Part 3 notes the Public/no-login variant remains unclaimed).

## 10.1 Data model
`CalculatorDefinition` — not Sheet-backed; a versioned code/config artifact (formula
logic, input field list) analogous to `CheckInTemplate` but doctor/staff-authored and
deterministic rather than a question set. `CalculatorResult` (Sheet-backed, new):
`record_id`, `patient_id`, `calculator_slug`, `definition_version`, `input_snapshot`
(JSON-encoded, for reproducibility/audit — same representational choice as §8.2 Option
B, for the same reason), `result_value`, `computed_at`.

## 10.2 Relationship to Module Engine
A Calculator is a module like any other (§7) — its visibility to a given patient is
governed by `PatientModuleState`, potentially defaulted by Doctor-Assigned Condition
relevance (§6.3), exact default-enablement rule not decided here.

# 11. Personal Care Plan Architecture

Promotes docs/33 §3.4 (Care Plan) and §2.3 (Doctor Instruction) from *Conceptual* to
designed, per docs/32 Part 2's original recommendation that this become its own phase.

## 11.1 Data model — `DoctorInstruction` (new; formalizes docs/33 §2.3)
`instruction_id`, `patient_id`, `care_plan_id` (nullable — an instruction can exist tied
to a consultation before a Care Plan aggregates it), `consultation_id` (nullable),
`instruction_type` (medicine | lifestyle | investigation | follow_up — closes docs/23's
"Prescriptions" gap per docs/33 §2.3/docs/34 §2.3: a Prescription is simply a `medicine`-
type instruction), `content`, `prescribed_by`, `effective_date`, `status`
(active/discontinued/completed). Created at consultation or review time, never deleted
— an audit trail of everything ever prescribed, per docs/33 §2.3's own "Future
evolution" note.

## 11.2 Data model — `CarePlan` (new; formalizes docs/33 §3.4)
`care_plan_id`, `patient_id`, `version` (integer, append-only — a new version is created
on every material change, never an in-place edit, per docs/33 §3.4's own note that Care
Plans "likely need versioning... to preserve history"), `status` (active | superseded),
`goals`, `next_review_date`, `created_by`, `created_at`. A Care Plan version aggregates
the patient's currently-active `DoctorInstruction` records by reference — it does not
copy their content.

## 11.3 Ownership
Doctor/staff-authored only, patient-viewable only — no patient-write path exists or is
proposed, consistent with docs/30 §2's "doctors decide" and docs/33 §3.4's own
"Ownership" note.

## 11.4 Timeline integration
Per docs/33 §3.1's own forward-looking design ("Deliberately generalized... so future
event sources (Care Plan updates...) can plug into the same feed without a redesign"),
a new Care Plan version creates a `TimelineEvent`-shaped entry (`entry_type: care_plan`,
extending the existing enum which docs/39 deliberately left narrowed to
`["consultation"]` until a second source existed — this is that second source).

# 12. Patient Dashboard Evolution

Per ADR-012: the dashboard becomes registry-driven for every new Phase 2B module (Daily
Check-ins, Calculator, Care Plan). The existing three writable/readable cards (Timeline,
Symptom Tracker, Reports) and the three permanently-`future`-badged placeholders
(Care Plan, Messages, Digital Twin) are unaffected until a later, separately-scoped
migration batch. Care Plan's placeholder specifically transitions from a permanent
`future` badge to a real, registry-driven module the moment its first implementation
batch ships — Messages and Digital Twin remain `future` (Messages has no architecture
anywhere in this plan or any prior document; Digital Twin is explicitly Phase 2D, §15).

# 13. Feature Enable/Disable Per Patient

This is `PatientModuleState` (§7.2) — one mechanism, not a separate one per feature.
Who may toggle it: doctor/staff only, never the patient themselves (consistent with
§6's condition-assignment ownership and §11.3's Care Plan ownership — patients are
consistently read-mostly with respect to clinical/administrative state in this
platform's existing architecture). **Not decided here:** whether enablement can ever be
automatic (e.g., a Calculator auto-enabling when a matching condition is assigned) or
must always be an explicit staff action — flagged for docs/45.

# 14. AI Boundaries

Reaffirms, does not modify, ADR-001/004/005. Applied explicitly to every Phase 2B
surface that could ever touch AI:

- **Daily Check-ins**: question *selection* is condition-driven, not AI-driven (§9.3).
  No AI-generated question content is proposed in this plan. If a future batch proposes
  AI-adapted questions, it must independently satisfy ADR-001 (grounded in
  Knowledge-Engine-approved content) — not assumed satisfied by this plan.
- **Calculator Framework**: results are never AI-computed (ADR-013). AI-generated
  explanatory text about a result, if ever built, must satisfy the full ADR-001/005
  pattern independently (ADR-013 §Decision, final paragraph).
- **Care Plan**: doctor-authored only (§11.3). No AI-generated content is proposed
  anywhere in Care Plan's data model. An AI-assisted *drafting aid* for doctors (never
  patient-facing without doctor approval) is not proposed here and would need its own
  design pass if ever wanted.
- **Module Engine / Patient Profile / Doctor-Assigned Conditions**: no AI involvement of
  any kind proposed or required.

No Phase 2B capability in this plan requires, assumes, or authorizes any new AI
integration beyond what Phase 1.5/2A already built (the Consultation Summary pipeline).

# 15. Digital Twin Integration Scope for Phase 2B

Per docs/24, Digital Twin's own architecture is Phase 2D's responsibility and requires
"the full ADR-001/ADR-004/ADR-005 AI-supervision pattern before any implementation
begins" — none of that is this plan's job. Phase 2B's only Digital Twin-relevant
obligation, per docs/33 §3.5 ("reads from every patient-scoped entity in this model"),
is to ensure every new entity this plan defines is **shaped so a future Digital Twin can
read it** without a redesign:
- `CheckInResponse`, `CalculatorResult`, and `CarePlan` are all `patient_id`-keyed,
  timestamped, and (per §9.1/§10.1/§11.2) never destructively overwritten — the same
  read-friendly shape `SymptomLog`/`Report`/`ConsultationHistory` already have.
- `CarePlan` version transitions emit `TimelineEvent` rows (§11.4), extending the
  existing aggregation point docs/33 §3.1 already designed for exactly this purpose.

This plan builds no Digital Twin UI, narrative generation, or aggregation logic of any
kind. "Integration" here means data-shape compatibility only.

# 16. Data Architecture — New/Promoted Entities Summary

| Entity | Status before this plan | Status after this plan | Sheet-backed? |
|---|---|---|---|
| `PatientProfile` | Did not exist | Proposed (§5) | Yes |
| `ConditionAssignment` | Did not exist | Proposed, Option B recommended (§6) | Yes |
| Module Registry | Did not exist | Proposed as config, not a Sheet (§7.1) | No |
| `PatientModuleState` | Did not exist | Proposed (§7.2) | Yes |
| `CheckInTemplate` | Did not exist | Proposed, config/content (§8.3) | No |
| `CheckInResponse` | Did not exist | Proposed, supersedes `SymptomLogs` as forward write path (§9.2) | Yes |
| `CalculatorDefinition` | Conceptual (docs/33 §5.3) | Proposed, config/code (§10.1) | No |
| `CalculatorResult` | Conceptual (docs/33 §5.3) | Proposed (§10.1) | Yes |
| `DoctorInstruction` | Conceptual (docs/33 §2.3) | Proposed (§11.1) | Yes |
| `CarePlan` | Conceptual (docs/33 §3.4) | Proposed (§11.2) | Yes |
| `PatientCredential` | Did not exist | Proposed (§4.3) | Yes |

Every Sheet-backed entity above follows ADR-006's flat-column/UUID-`record_id`
convention except where §8.2/§10.1 explicitly document a JSON-encoded column as the
deliberate, reasoned exception. docs/33-DOMAIN-MODEL.md is updated by this same change
to reflect every row above (see docs/33 §6 "Phase 2B Entities," added alongside this
plan).

# 17. Security Model

- **§4's authentication trade-off** is the dominant new risk this plan introduces — see
  docs/45 Part 3 for the full analysis and the explicit statement that a dedicated
  security review (mirroring PA-7's magic-link/session review, docs/43 §6) is required
  before any batch implementing `PatientCredential` ships.
- **`PatientProfile`** is the platform's first patient-*mutable* structured data — every
  write must be session-derived-`patient_id`-scoped and audit-logged, per §5.3.
- **`ConditionAssignment` / `PatientModuleState` / `DoctorInstruction` / `CarePlan`**
  writes are staff/doctor-only — every write endpoint must reject a patient-authenticated
  session attempting to write to these, not merely omit a patient-facing UI for it
  (the same "authorization is enforced server-side, never just hidden client-side"
  discipline every existing Foundation route already follows).
- **JSON-encoded columns** (`CheckInResponse.answers`, `CalculatorResult.input_snapshot`)
  must still be size-bounded at write time (mirroring `FoundationReports.gs`'s existing
  upload-size check) to prevent a single row from growing unboundedly.
- No new secret material is introduced except `PatientCredential`'s salt (stored
  alongside the hash, per standard practice — a salt is not a secret, only the hash
  input needs to stay server-side).

# 18. Migration From Phase 2A

| Existing Phase 2A surface | Migration posture |
|---|---|
| `Patient` (identity) | Unmodified. `PatientProfile` and `ConditionAssignment` reference it; neither widens nor replaces it. |
| `SymptomLogs` | Retained permanently, read-only historical data. Not migrated into `CheckInResponse`. Dashboard card retirement is a separate, later, explicitly-approved batch (§9.1, §21). |
| `LoginTokens` / `Session` | Unmodified. `PatientCredential` (§4.3) is fully additive. |
| `dashboard.js` hardcoded cards | Unmodified for Timeline/Symptom Tracker/Reports. Care Plan's placeholder becomes real once its batch ships (§12); Messages/Digital Twin remain placeholders. |
| `FoundationRouter.gs` | Additive dispatch cases only — every new action name checked against the existing list (docs/46 confirms zero collisions). |

No data migration script is required for this plan's scope — every new entity starts
empty; no existing row needs reshaping.

# 19. Risks

1. **PIN/password hashing on Apps Script (§4.2)** — highest severity, see docs/45 Part 3.
2. **JSON-encoded columns (§8.2, §10.1)** — a deliberate, disclosed departure from
   ADR-006's literal flat-column wording; mitigated by keeping the *entity* flat
   (one row per response/result) and confining variability to one bounded, size-checked
   column, but this sets a precedent worth the approving reviewer's explicit attention.
3. **Doctor-Assigned Conditions' Option A vs. B (§6.2)** — choosing Option A later
   (widening the frozen `Patient` schema) after Option B (a separate entity) has already
   shipped would require an actual migration; recommend deciding before Batch 1 of this
   scope, not mid-sequence.
4. **Scope size** — twelve substantial capabilities in one architecture-freeze pass is
   larger than Phase 2A's own per-milestone freezes (Foundation, then Identity & Access,
   then Patient Access, each separately). §21's batch sequence deliberately does not
   require all twelve to ship before any one does.
5. **Roadmap/scope mismatch** — docs/24's prior one-line Phase 2B entry named only
   "Personal Care Plan"; this plan's actual scope is far larger. Recorded explicitly in
   docs/46 Part 3, not silently absorbed.

# 20. Documentation Impact

| Doc | Update needed | Status |
|---|---|---|
| docs/24-ROADMAP.md | Expand Phase 2B entry to reflect actual scope, reference docs/44 | Done, this change |
| docs/31-ADR-INDEX.md | Add ADR-011/012/013, note ADR-003 amendment | Done, this change |
| docs/33-DOMAIN-MODEL.md | Add §6 "Phase 2B Entities," promote Care Plan/Doctor Instruction/Calculator from Conceptual | Done, this change |
| docs/44 (this document) | New | Done, this change |
| docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md | New | Done, this change |
| docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-REVIEW.md | New | Done, this change |
| `/adr/ADR-011/012/013` | New | Done, this change |
| CHANGELOG.md | Record this architecture-freeze pass (no code change) | Done, this change |
| `shared/schemas/*.schema.json` for entities in §16 | Not yet written — created when each entity's implementing batch begins, per Foundation-era precedent (docs/29 §14) | Deferred, by design |

# 21. Implementation Batches

Sequenced by dependency and risk, mirroring docs/29 §13's foundation → auth → data →
highest-risk ordering. **No batch below is authorized to begin by this document.**

| Batch | Delivers | Depends on | Risk / reversibility |
|---|---|---|---|
| **PCP-1** | `ConditionAssignment` entity + staff assignment tool (no patient-facing surface) | Nothing new — additive to existing `Patient` | Zero patient-facing surface. Fully reversible. |
| **PCP-2** | Module Registry (config) + `PatientModuleState` + dashboard registry-rendering path, with zero real modules registered yet (a no-op scaffold) | PCP-1 not required, but logically informs default-enablement rules later | Additive; existing cards unaffected (ADR-012 §2.3). |
| **PCP-3** | `PatientProfile` entity + patient-facing profile view/edit | PCP-2 not required | First patient-mutable structured data — its own authorization/audit review before shipping. |
| **PCP-4** | `PatientCredential` + PIN/password setup, verification, and rate-limiting flow, magic link unaffected | PCP-3 not required. Requires the dedicated security review named in §17/docs/45 Part 3 first. | Highest security risk in this scope — ships only after its own review, independent of this plan's approval. |
| **PCP-5** | `CheckInTemplate` + `CheckInResponse` + Daily Check-in patient UI, registered as a module via PCP-2, shipped alongside (not replacing) Symptom Tracker | PCP-1 (for condition-driven template selection), PCP-2 | Additive; Symptom Tracker untouched. |
| **PCP-6** | `CalculatorDefinition` + `CalculatorResult` + Patient Calculator UI, registered as a module via PCP-2 | PCP-2 | Deterministic logic only (ADR-013) — lower risk than PCP-4/PCP-5. |
| **PCP-7** | `DoctorInstruction` + `CarePlan` + patient-facing read-only Care Plan view, registered as a module via PCP-2 | PCP-1 (instructions reference conditions/consultations) | Doctor-authored only — no new patient-write surface. |
| **PCP-8** | Symptom Tracker retirement (dashboard card removed, endpoints deprecated, `SymptomLogs` data retained) | PCP-5 proven in production first | Explicitly separate, later, own approval — never bundled with PCP-5 (§9.1). |
| **PCP-9** | Validation-suite build-out (conformance/regression coverage for every above entity) + documentation closeout, mirroring 5H/PA-7's closeout discipline | All shipped batches above | Documentation/validation only, no new product surface. |

**Recommended first batch: PCP-1.** Zero patient-facing surface, zero security exposure,
and it resolves §6.2's design fork in practice before anything downstream (PCP-5, PCP-6,
PCP-7) depends on it — the same "resolve the foundational entity first" opening move
Phase 2A made with Batch 5A/F1.

**This plan does not authorize PCP-1 to begin.** Implementation waits for a separate,
explicit approval naming a specific batch, per this session's instruction.
