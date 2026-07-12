# 33 - Domain Model
## Version 1.27 — 2026-07-16

> Defines every major business entity in the Wise Platform: what it means, what it
> holds, how it relates to everything else, how it comes into being and ends, who is
> responsible for it, and where it is expected to go next. This document is the
> canonical entity-level reference — docs/29-PHASE-2A-TECHNICAL-PLAN.md's data
> architecture (§4) and any future phase's technical plan should describe *how* an
> entity is currently implemented (which Sheet, which columns) and reference this
> document for *what the entity means and why it has that shape*, rather than
> re-deriving it independently. Governed by docs/30-ARCHITECTURE-PRINCIPLES.md and the
> ADRs in `/adr/` (docs/31). No code or existing document was changed to produce this.

---

# How to Read This Document

Every entity below is marked with a **maturity status**:

| Status | Meaning |
|---|---|
| **Implemented** | A real, deployed schema already exists (Phase 1.5 or earlier). |
| **Planned** | Schema is defined and locked in docs/29 (Phase 2A), not yet built — awaiting approval to begin Batch 5A onward. |
| **Conceptual** | Named in product/architecture documentation, but no schema or phase currently owns it. Defined here so a future phase inherits a real model instead of starting blank — not an instruction to build it now. |

Several **Conceptual** entities surface a genuine gap in current documentation (no
phase claims them yet — e.g. Appointment, Doctor, Notification). These gaps are
carried into docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md rather than resolved here.

---

# Relationship Overview

```
Patient Identity ──1:1── Patient
      │                     │
      │ 1:N                 │ 1:N
      ▼                     ▼
   Session            Consultation ──1:1── Consultation Summary ─┐
                             │                                    │ (instance of)
                             │ 1:N                                ▼
                             ▼                              AI Summary (pattern)
                     Doctor Instruction
                             │
                             │ N:1 (aggregates into)
                             ▼
                         Care Plan

Patient Identity ──1:N── Timeline Event ──(sourced from)── Consultation Summary,
                                                             Symptom Log, Report,
                                                             (future) Care Plan events

Patient Identity ──1:N── Symptom Log
Patient Identity ──1:N── Report
Patient Identity ──1:N── Notification
Patient Identity ──1:N── Appointment ──(becomes, once held)── Consultation

Doctor ──1:N── Consultation
Doctor ──1:N── Doctor Instruction (authored by)

Knowledge Engine ──aggregates──> Knowledge Article, (future) Protocols, FAQs
Knowledge Engine ──grounds──> AI Summary (per ADR-001)

Digital Twin ──computed view over──> Timeline Event, Consultation Summary,
                                       Symptom Log, Report, Care Plan
                                       (never a base table itself — ADR-004)

Calculator ──(patient variant)──> Patient Identity-scoped results (not yet modeled)
```

---

# 1. Identity & Access

## 1.1 Patient — *Implemented (Foundation Batch F3)*

**Purpose:** The domain concept of a person under Wise's care — the full clinical and
relationship context, as distinct from the bare technical identity that references it.

**Attributes:** `full_name`, `condition_slug` (one or more), `status`
(active/inactive/recovered), contact details currently in use (`email`), onboarding
metadata (`created_by`, `created_at`).

**Relationships:** Wraps exactly one Patient Identity (1:1). Is the implicit subject of
every Consultation, Timeline Event, Symptom Log, Report, Appointment, and Notification
in the model — all of those reference the identity, not this profile, per ADR-002.

**Lifecycle:** Created by staff after a real consultation (no public self-registration,
docs/09, docs/29 §3). Status moves active → inactive/recovered per docs/23's Patient
Lifecycle (`Recovery` stage) — "we don't want people to remain patients." Never
hard-deleted while a clinical history exists; deactivation, not deletion, is the
default (data-retention decisions belong to a future "patient data belongs to the
patient" mechanism, docs/30 §3).

**Ownership:** Staff create and update profile attributes via an internal tool
(docs/29 §3, §7's pattern). The patient does not edit their own profile in Phase 2A —
consistent with "doctors decide, patients view" (docs/30 §2).

**Future evolution:** Contact-detail changes (email, phone) should update this record
without touching Patient Identity's `patient_id` (ADR-002) — that separation is the
entire point of splitting these two entities. A future self-service profile edit (e.g.,
updating a phone number) is plausible without violating any current ADR.

---

## 1.2 Patient Identity — *Implemented (Foundation Batch F3)*

**Purpose:** The minimal, permanent, technical identity every other record references.
Deliberately kept smaller than "Patient" so that authentication method, contact
details, and even profile data can all change without ever touching this record
(ADR-002).

**Attributes:** `patient_id` (UUID, generated once, never reused), `created_at`.
Nothing else — attributes that can plausibly change over a patient's lifetime belong to
Patient, not here.

**Relationships:** Referenced by every other patient-scoped entity in this model
(Session, Consultation, Timeline Event, Symptom Log, Report, Appointment,
Notification). Wrapped by exactly one Patient.

**Lifecycle:** Created once, at the same moment as the Patient record it wraps (staff
provisioning, docs/29 Batch 5A). Immutable for the life of the platform relationship —
never reissued, never recycled, even if the Patient record is later deactivated.

**Ownership:** System-generated only. No human ever assigns or edits a `patient_id`
directly.

**Future evolution:** If identity merging is ever needed (docs/32 §1.5 territory — two
accounts for one real person), this is the record that would need a deliberate,
audited merge process — not solved now, flagged for when it's a real problem
(docs/29 §3's Future Considerations, ADR-002).

---

## 1.3 Session — *Implemented (Foundation Batch F4)*

**Purpose:** Proof that a specific request is genuinely coming from an authenticated
Patient Identity, for a bounded window of time. The system's answer to "who is asking
right now," kept entirely separate from "who is this person" (ADR-002) and "how did
they prove it" (ADR-003).

**Attributes:** Not stored as a row at all in the common case — a self-verifying,
HMAC-signed payload of `{patient_id, issued_at, expires_at}` (docs/29 §3). The one
piece that *is* stored is the single-use `LoginTokens` record consumed to mint a
session: `token_hash`, `patient_id`, `issued_at`, `expires_at`, `used_at`.

**Relationships:** Resolves to exactly one Patient Identity. Has no relationship to
Patient (profile) directly — every authenticated call re-derives `patient_id` from the
session, never trusts a client-supplied one (docs/29 §3, §10).

**Lifecycle:** Born from a consumed, single-use login-link token; lives 60–90 minutes;
dies at expiry with no renewal (docs/15's "session expiration," enforced plainly per
ADR-010). Never persisted client-side beyond `sessionStorage` (cleared on tab close).

**Ownership:** Fully system-managed. No human ever views or edits a session directly.

**Future evolution:** If a second authentication factor is added later (ADR-003's
Future Considerations), it produces the exact same Session shape — this entity should
not need to change even if *how* it's obtained does.

---

## 1.4 Doctor — *Implemented (Batch WPI-1)*

> **Header corrected (Batch WPI-7's own repository consistency review, §14).**
> This section's header still read *Conceptual (gap)* even though the body below
> already records this entity's promotion first to *Designed* and then, at Batch
> WPI-1, to *Implemented* — the same category of stale-header drift docs/48 §5
> already corrected once for docs/33 itself. No entity's shape, schema, or shipped
> behavior changes; only this heading's own currency.

**Purpose:** The clinician or authorized staff member responsible for a Consultation,
a Doctor Instruction, or a review/approval action. Currently named informally
throughout documentation (docs/09's "Doctor Workflow," docs/29's `reviewed_by`/
`created_by` fields) but never modeled as its own identity entity.

**Attributes (proposed, not yet implemented):** `doctor_id`, `full_name`,
`role` (physician/staff), `email` (for Workspace-identity capture where applicable).

**Relationships:** Would author Consultations and Doctor Instructions, and perform
review/approval actions currently attributed only by free text (docs/29's
`consent_confirmed_by`, `reviewed_by`) or by `Session.getActiveUser().getEmail()`
(Phase 1.5's `Review.gs`, tied to whoever has Sheet edit access — not a real identity
record).

**Lifecycle:** N/A — not implemented.

**Ownership:** N/A — not implemented.

**Future evolution:** Today, "who did this" is captured two inconsistent ways: a Google
account identity (Phase 1.5's Sheet-bound review) and a free-text string (docs/29's
staff-entry pattern). Neither is a real, queryable Doctor identity. This becomes worth
solving once granular per-doctor audit trails or role distinctions (e.g., a physician
vs. a front-desk staff member) matter — plausibly Phase 3 territory, per
docs/24, but flagged here since it's a real gap, not a hypothetical one. See
docs/34 for this as a reported finding.

**Status update (2026-07-16, Phase 3/WHIMS architecture-freeze, docs/49/50, ADR-017):
promoted from Conceptual to Designed.** "Phase 3 (WiseOS)" above is renamed "Phase 3
(WHIMS Patient Intelligence Platform)" per docs/49 §2 — no scope change from the
rename itself. `DoctorIdentity`/`Doctor` (docs/50 §5) formalize this section's own
proposed attributes almost exactly (`doctor_id`, `full_name`, `role`, `email`, plus a
new `specialty_slug`), structurally parallel to Patient Identity/Patient (ADR-002) and
**never merged with either** (ADR-017). See §7.1 below for the full shape.

**Status update (2026-07-16, Batch WPI-1): promoted from Designed to Implemented.**
`DoctorIdentity`/`Doctor`/`DoctorSession`/`DoctorLoginToken` have shipped
(`shared/schemas/doctor-identity.schema.json`, `doctor-session.schema.json`,
`doctor-login-token.schema.json`; `apps-script/DoctorIdentity.gs`, `DoctorSession.gs`,
`DoctorLoginTokens.gs`, `DoctorEmail.gs`, `DoctorLoginFlow.gs`, `DoctorRouteGuard.gs`) —
the platform's first doctor-facing infrastructure, staff/administrative-provisioned
only (no public self-registration), authenticated via the same passwordless magic-link
mechanism ADR-003 already establishes for patients. `DoctorSession` reuses
`FoundationSession.gs`'s signing secret and HMAC primitive unchanged — zero lines
touched in that frozen file — while remaining structurally impossible to confuse with a
Patient `Session` (disjoint payload shapes, proven directly by
`validation/phase-2a-foundation/conformance.js`'s Stage 17, not just asserted; full
security analysis in `shared/schemas/doctor-session.md`). Zero role-based permission
logic is implemented — `role` is stored and returned only. No doctor-facing frontend
page ships in this batch (`FoundationRouter.gs` gains three new, additive dispatch
cases: `request_doctor_login_link`, `consume_doctor_login_link`, `get_doctor_profile`).
See §7.1 below for the full shape.

---

# 2. Clinical Encounter

## 2.1 Consultation — *Conceptual*

**Purpose:** The real-world clinical encounter between a Doctor and a Patient — the
event everything else in this section is downstream of. docs/20 §3 named the fact that
"treatment happens entirely off-website today" (WhatsApp, video call, in-person) as
the single biggest architectural gap in the patient journey; this entity is the data
model's honest acknowledgment that the encounter itself is not currently captured
anywhere as a first-class record — only its *output* (a Consultation Summary) is.

**Attributes (conceptual):** `consultation_id`, `patient_id`, `doctor_id` (once Doctor
exists), `date`, `mode` (in-person/video/phone — not currently tracked anywhere),
`condition_slug`.

**Relationships:** Would be the anchor that Consultation Summary, Doctor Instruction,
and (once it exists) Appointment all reference. Today, Consultation Summary and
ConsultationHistory entries exist *without* a Consultation record underneath them —
they're written directly by staff, with no formal link back to how the visit was
scheduled or when it actually happened beyond the free-text `entry_date` field.

**Lifecycle:** N/A — not implemented as a discrete record today.

**Ownership:** N/A — not implemented.

**Future evolution:** If Appointment (§4.2) is ever built, a completed Appointment
naturally becomes a Consultation record, which then anchors a Consultation Summary and
any Doctor Instructions from that visit — closing docs/20 §3's gap at the data-model
level, not just the product-journey level. Recommended as a natural next step once
Appointment exists; not required for Phase 2A.

---

## 2.2 Consultation Summary — *Implemented (Phase 1.5)*

**Purpose:** A doctor-reviewed, patient-friendly summary of a consultation, generated
by rephrasing a doctor's own note — the platform's first working example of the AI
Summary pattern (§5.4) and the concrete data Phase 2A's Consultation History (docs/29
§7) reuses rather than re-collects.

**Attributes:** `record_id` (UUID), `created_at`, `condition_slug`,
`staff_submitted_note`, `patient_consent_confirmed`, `consent_confirmed_by`,
`recipient_email`, `ai_summary_draft`, `ai_model_used`, `review_status`, `reviewed_by`,
`reviewed_at`, `email_status`, `email_sent_at`, `error_log`, `purged_at` — full detail
in docs/12 and docs/25 §5.1.

**Relationships:** Conceptually belongs to one Consultation (§2.1), though no
Consultation record currently exists to formally link to — the relationship is
implicit today. Optionally referenced by a Timeline Event/ConsultationHistory row via
`source_ref` (docs/29 §7), avoiding re-entry of already-approved content. Is the first
concrete instance of the AI Summary pattern (§5.4).

**Lifecycle:** Submitted by staff → AI-drafted → doctor-reviewed
(approved/edited_and_approved/rejected) → emailed (or not) → `recipient_email` purged
automatically 14 days after send (docs/25 §9.3). The row itself (minus the purged
email) persists as a permanent audit record.

**Ownership:** Written only by the Phase 1.5 Apps Script pipeline, staff-triggered,
access-code-gated. Never patient-writable.

**Future evolution:** Phase 2A's Consultation History (docs/29 §7) already reuses this
entity via `source_ref` rather than duplicating it — the correct pattern going forward
for any future feature that needs to show or reuse an already-approved summary.

---

## 2.3 Doctor Instruction — *Implemented (Phase 2B, Batch PXP-7, docs/44 §12)*

**Purpose:** The atomic unit of clinical direction — a single medicine, lifestyle
change, investigation order, or follow-up instruction — that a doctor gives during or
after a consultation. Currently exists only as unstructured free text embedded inside
`staff_submitted_note` (Consultation Summary) or, once built, inside Care Plan (§4.1) —
never as its own discrete, queryable record.

**Attributes (conceptual):** `instruction_id`, `patient_id`, `consultation_id`,
`instruction_type` (medicine/lifestyle/investigation/follow_up), `content`,
`prescribed_by` (Doctor), `effective_date`, `status` (active/discontinued/completed).

**Relationships:** Would belong to one Consultation and one Patient; would be
aggregated by Care Plan (§4.1) into a patient's current set of active instructions.
Conceptually answers docs/23-PATIENT-LIFECYCLE.md's otherwise-unmodeled
"Prescriptions" list item (docs/32 §1.5) — a Prescription is simply a Doctor
Instruction of type `medicine`, not a separate entity.

**Lifecycle:** N/A — not implemented. Would be created at consultation time, updated
(discontinued) at a follow-up, never deleted (audit trail of what was ever prescribed).

**Ownership:** N/A — not implemented; would be doctor/staff-authored only, per
"doctors decide" (docs/30 §2).

**Future evolution:** Becomes real once Care Plan (Phase 2B, per docs/32's roadmap
recommendation) is architected — Care Plan cannot meaningfully exist without this
entity underneath it, since "current goals, medicines, lifestyle guidance, doctor
instructions" (docs/09) are all instances of Doctor Instruction.

**Status update (2026-07-04, renumbered 2026-07-08 for docs/44 Version 3.0):**
docs/44-PHASE-2B-TECHNICAL-PLAN.md §12 formalizes this entity's exact attributes
(`instruction_id`, `patient_id`, `care_plan_id`, `consultation_id`, `instruction_type`,
`content`, `prescribed_by`, `effective_date`, `status`) and confirms the
Prescription-is-a-`medicine`-type-instruction mapping this section already anticipated.
A consumer of Doctor Assigned Condition (Pillar 1) and Module Engine (Pillar 2), per
docs/44 §4.2. Not yet implemented — see docs/44 §22's `PXP-7` batch.

**Status update (2026-07-14, Batch PXP-7): Implemented.**
`apps-script/DoctorInstruction.gs` backs `foundationCreateDoctorInstruction_()`/
`foundationUpdateDoctorInstructionStatus_()`/`foundationGetPatientDoctorInstructions_()`,
matching docs/44 §12's field list exactly. Doctor/staff-owned, a hard boundary — the
patient never creates, edits, or resolves a row of this shape. No real Doctor identity/
authentication exists yet (docs/33 §1.4), so creation and status transitions are
manually-run Apps Script editor functions
(`createFoundationDoctorInstruction()`/`updateFoundationDoctorInstructionStatus()`),
mirroring `DoctorAssignedCondition.gs`'s precedent exactly. Every write validates that
`care_plan_id` references a real `CarePlan` row (§3.4) for the same patient — the "Care
Plan cannot meaningfully exist without this entity underneath it" relationship this
section already anticipated, enforced server-side. `status` transitions
`active` → `discontinued`/`completed` exactly once, one-way, never reverted. One
read-only, session-derived route — `get_doctor_instructions` (`FoundationRouter.gs`) —
returns the caller's full instruction history across every version of their plan
(`care_plan_id` is stable across Care Plan versions, §3.4).

---

## 2.4 AI Summary — *Conceptual (pattern)*

**Purpose:** Not a single stored entity, but the **general pattern** every AI-generated,
patient-facing artifact on the platform must follow, per ADR-005: prompt-level
constraint + independent code-level traceability check + mandatory human review before
delivery. Consultation Summary (§2.2) is the first concrete instance. A future Digital
Twin narrative (§4.3) would be a second.

**Attributes (pattern-level, not a row):** source content reference, prompt version
used, drift/traceability flags, review status, reviewer, delivery status — Consultation
Summary's own columns are a direct instantiation of this shape.

**Relationships:** Consultation Summary *is-a* AI Summary. Any future AI-generated
Digital Twin narrative would also *is-a* AI Summary — sharing this shape is what makes
ADR-005 enforceable consistently rather than reinvented per feature.

**Lifecycle:** N/A at the pattern level — see Consultation Summary for the one existing
instance's lifecycle.

**Ownership:** Governed by ADR-001 (grounded in the Knowledge Engine) and ADR-005
(doctor supervision) — never a standalone, ungoverned AI output.

**Future evolution:** As a second real AI feature is built (Phase 2D's Digital Twin),
evaluate whether the drift-check/review-gate logic should become a shared, reusable
module rather than reimplemented per feature (ADR-005's own Future Considerations
already flags this).

---

## 2.5 Doctor Instruction, Consultation, and Appointment: closing docs/20's "THE GAP"

Noted here rather than as a separate entity: docs/20 §3 identified "THE GAP" — the
website has no role between booking and Phase 2 login. This domain model shows that gap
concretely at the data level too: Appointment (§4.2) does not exist, so nothing
currently links a public booking-form submission to the Consultation it results in, or
the Consultation Summary that follows it. Closing this is not required for Phase 2A but
is a natural, well-justified next step once Appointment is built (see docs/34).

---

# 3. Patient-Facing Data

## 3.1 Timeline Event — *Implemented (Batch PA-3, one entry_type)*

**Purpose:** A single entry in a patient's merged, reverse-chronological health feed —
the general shape behind docs/29 §6's Timeline. Deliberately generalized here beyond
docs/29's current scope (which sources only from Consultation Summary/
ConsultationHistory) so future event sources (Care Plan updates, Digital Twin
milestones) can plug into the same feed without a redesign. Concretely implemented as
the `ConsultationHistory` sheet (`apps-script/FoundationConsultationHistory.gs`,
`shared/schemas/consultation-history.schema.json`) — see
docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md §2 and
`shared/schemas/consultation-history.md` for why the implemented schema's `entry_type`
enum stays narrowed to `["consultation"]` rather than the full set below until a second
source actually exists.

**Attributes:** `record_id`, `patient_id`, `entry_date`, `entry_type`
(consultation/note/milestone — extensible; only `consultation` has a real implementation
today), `title`, `summary_text`, `source_ref` (pointer to the entity that produced this
event — e.g., a Consultation Summary `record_id`), `created_by`, `created_at`.
`record_id` is this entity's permanent identity — never `entry_date`, never row/list
position (docs/40-CONSULTATION-IDENTITY-STRATEGY.md).

**Relationships:** Belongs to one Patient Identity. `source_ref` points at whichever
entity actually generated the event — today, only Consultation Summary; future
entry_types would point at Care Plan or Digital Twin events.

**Lifecycle:** Created when a source event is approved for patient visibility (e.g., a
Consultation Summary reaches `approved`/`edited_and_approved`). Read-only for patients
once created — never patient-edited (docs/30 §2).

**Ownership:** Written by staff/doctor tooling only, mirroring Consultation Summary's
review-gated write path. Today, staff creation is a manually-run Apps Script editor
function (`createFoundationConsultationEntry()`) — a real, access-code-gated staff Web
App tool remains future work (docs/29 §16's Batch PA-3 notes state this simplification
openly).

**Future evolution:** As Care Plan (Phase 2B) and Digital Twin (Phase 2D) are built,
each should emit Timeline Events through this same shape rather than the dashboard
querying multiple sheets directly — keeps the Timeline read path stable regardless of
how many source entities eventually feed it (ADR-009's replaceability principle,
applied to a read model). Widening `entry_type`'s enum is the concrete signal that
moment has arrived — not before (`shared/schemas/consultation-history.md`).

---

## 3.2 Symptom Log — *Implemented (Batch PA-4), retired from the patient dashboard (Batch PXP-10)*

**Purpose:** A patient's own, plain data-capture entry — severity, sleep, energy,
stress, and optional notes — logged by the patient, about themselves. The only entity
in this model a patient writes directly (docs/29 §9).

**Attributes:** `record_id`, `patient_id`, `logged_at`, `severity`, `sleep`, `energy`,
`stress`, `notes`, `condition_slug` (optional).

**Relationships:** Belongs to one Patient Identity, written by that same identity only
(session-derived, never client-supplied — docs/29 §3, §10). Feeds Timeline Event
(future extension) and, much later, Digital Twin's symptom-trend view (§4.3) — never
directly analyzed or commented on by AI in Phase 2A (docs/29 §9's explicit boundary).

**Lifecycle:** Created by the patient at will; never edited or deleted by the patient
once submitted (an honest, permanent self-report — consistent with an audit-style
health record, not a mutable journal). Retained indefinitely, subject to future
"patient data belongs to the patient" mechanisms (docs/30 §3).

**Ownership:** Patient-owned and patient-written; staff/doctor can view but not alter
a patient's own entries — the health record belongs to the patient, not staff, for this
one entity.

**Future evolution:** The natural first data source for Digital Twin's "symptom trends"
(docs/09) once Phase 2D exists — no schema change anticipated, only a new consumer.

**Status update (2026-07-15, Batch PXP-10): dashboard entry retired, endpoints
deprecated, data retained.** Symptom Tracker Migration (docs/44 §10.1/§22, docs/47),
gated on Daily Check-in (§6.5) proven in production — satisfied, since PXP-5 shipped
and merged. The `symptom_tracker` Module Registry entry is removed from all three
hand-ported copies (`shared/constants/module-registry.json`,
`apps-script/ModuleRegistry.gs`, `my-health-journey/dashboard.js`'s own
`MODULE_REGISTRY`), so the dashboard's fully registry-driven rendering (Batch PXP-4)
simply stops rendering the card for every patient — zero change to
`renderDashboard()`/`filterEnabledModules()`/`dispatchLoaders()` itself. **This
section's own schema, lifecycle, and `apps-script/FoundationSymptomLog.gs` are
completely unchanged** — zero lines touched in that frozen file or in
`FoundationRouter.gs`'s existing `log_symptom`/`get_symptom_logs` dispatch cases,
mirroring Batch PXP-8's own "zero lines changed in a frozen file" discipline; both
routes stay fully functional (no breaking API contract, docs/47 §6). **Data is retained
exactly as this section's own "never edited or deleted" lifecycle already promised** —
no `SymptomLogs` row is touched, migrated, or deleted by this batch. The standalone
Symptom History page (`my-health-journey/symptoms/`) is unchanged and still reachable
by direct URL; it is simply no longer linked from the dashboard, since its only link
lived inside the now-removed card. Full detail:
`shared/schemas/symptom-log.md`'s own "Deprecated (Batch PXP-10)" section and
`shared/constants/module-registry.md`'s own "Batch PXP-10 removal" section.

---

## 3.3 Report — *Implemented (Batch PA-5)*

**Purpose:** A document (lab result, prescription received elsewhere, prior medical
record) a patient uploads to their own record. The platform's first arbitrary
file-handling surface and its highest-risk Phase 2A feature (docs/29 §8, §11).

**Attributes:** `record_id`, `patient_id`, `uploaded_at`, `file_name`, `drive_file_id`,
`mime_type`, `size_bytes`, `uploaded_by` (patient or staff).

**Relationships:** Belongs to one Patient Identity. Conceptually satisfies docs/21
Digital Twin's "Investigation history" component (§4.3) — an uploaded lab report *is*
investigation history, without needing a separate entity to represent it.

**Lifecycle:** Uploaded by a patient (or staff, on a patient's behalf) → stored in
Drive, metadata row written → viewable/downloadable by that patient and by staff with
Drive access → no automated deletion currently planned (unlike Consultation Summary's
14-day email purge, which is a narrower, Phase-1.5-specific policy, not a general rule).

**Ownership:** Patient-uploaded content, staff-reviewable. No AI processes report
content in Phase 2A (docs/29 §0's explicit "no AI anywhere in this phase").

**Future evolution:** A natural target for future OCR/structured-data-extraction work
(e.g., pulling lab values into Digital Twin trends) — explicitly out of scope until an
AI Summary-pattern (§2.4) implementation is designed for it, per ADR-001/005.

---

## 3.4 Care Plan — *Implemented (Phase 2B, Batch PXP-7, docs/44 §12)*

**Purpose:** The patient's currently active goals, medicines, lifestyle guidance, and
next review date — docs/09's "Personal Care Plan" module. No architecture exists for
it yet; docs/32 §Part 2 recommends it become its own phase (Phase 2B) precisely because
of this.

**Attributes (conceptual):** `care_plan_id`, `patient_id`, `active_instructions`
(references to Doctor Instruction, §2.3), `goals`, `next_review_date`, `version`
(care plans change after follow-ups — likely needs versioning, not in-place editing, to
preserve history).

**Relationships:** Aggregates Doctor Instruction records for one Patient Identity.
Would emit Timeline Events (§3.1) when updated.

**Lifecycle:** N/A — not implemented.

**Ownership:** N/A — not implemented; would be doctor-authored, patient-viewable only,
consistent with "doctors decide."

**Future evolution:** Requires Doctor Instruction (§2.3) to exist first as a real
entity. Recommended as Phase 2B per docs/32 — deliberately excluded from docs/29's
Phase 2A scope, shown only as an empty state (docs/29 §5) until it has its own
architecture-freeze pass.

**Status update (2026-07-04, renumbered 2026-07-08 for docs/44 Version 3.0):** That
architecture-freeze pass is docs/44 (§12), which formalizes `care_plan_id`,
`patient_id`, an append-only `version` integer, `status`, `goals`, `next_review_date`,
`created_by`, `created_at`, and confirms the versioning instinct this section already
named. Doctor-authored/patient-viewable ownership (below) is unchanged. A consumer of
Doctor Assigned Condition (Pillar 1) and Module Engine (Pillar 2), per docs/44 §4.2.
Not yet implemented — see docs/44 §22's `PXP-7` batch.

**Status update (2026-07-14, Batch PXP-7): Implemented.** `apps-script/CarePlan.gs`
backs `foundationSaveCarePlan_()`/`foundationGetCurrentCarePlanForPatient_()`, matching
docs/44 §12's field list plus one disclosed, additive field (`version_key` — a
server-derived, deterministic per-row identity, mirroring `PatientModuleState`'s own
`state_key` precedent, see `shared/schemas/care-plan.md`). `care_plan_id` is a stable,
logical identity reused across every version — the versioning instinct this section
already named is now implemented as append-only version rows, never in-place editing:
creating a new version automatically flips the prior version's own row from
`status: active` to `status: superseded`, so exactly one active row exists per plan at
any time. Doctor/staff-owned, a hard boundary — the patient never authors or versions
their own plan; no real Doctor identity/authentication exists yet (docs/33 §1.4), so
authoring is a manually-run Apps Script editor function (`saveFoundationCarePlan()`),
mirroring `DoctorAssignedCondition.gs`'s precedent exactly. Two read-only,
session-derived routes — `get_care_plan` and `get_doctor_instructions`
(`FoundationRouter.gs`) — are this batch's patient-facing surface, plus a dedicated
dashboard card and full-detail page (`my-health-journey/care-plan/`), registered via the
Module Registry/Dashboard Registry exactly as docs/44 §22 names for this batch.
**Disclosed, deliberate scope decision:** docs/44 §12 states a new Care Plan version
"emits a `TimelineEvent` (`entry_type: care_plan`)" — implementing this would require
widening the frozen, conformance-tested `consultation-history.schema.json`'s
`entry_type` enum and changing `FoundationConsultationHistory.gs`, both Phase 2A files
frozen except for a genuine bug fix (docs/43 §12), and this is new functionality, not a
bug fix. Per docs/47 §6, this batch makes the disclosed choice not to touch either
frozen file this batch — see `shared/schemas/care-plan.md`'s own "Disclosed, deliberate
scope decision" section for the full reasoning. A patient's plan and instruction history
remain fully visible via `get_care_plan`/`get_doctor_instructions` and their own
dedicated page; only the cross-cutting Timeline feed does not yet reflect a Care Plan
update.

---

## 3.5 Digital Twin — *Designed (Phase 2D architecture freeze, docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md, ADR-028/029/030); still a computed view, never a stored base table*

**Purpose:** The patient's "living health story" (docs/21) — never a stored entity of
its own, always a computed, read-only view aggregating Timeline Event, Consultation
Summary, Symptom Log, Report, Care Plan, Check-In, Calculator Result, Medication History,
and (published) Health Milestone data into one narrative.
Bound permanently by ADR-004: never generates diagnosis or treatment.

**Attributes:** None of its own — a view/aggregate, not a base table.

**Relationships:** Reads from every patient-scoped entity in this model. Produces
AI Summary-pattern (§2.4) narrative output, subject to the full ADR-001/004/005 gate.

**Lifecycle:** N/A — computed on demand or periodically regenerated, not a
create/update/delete lifecycle of its own.

**Ownership:** System-computed; any AI-narrated portion is doctor-reviewed before a
patient sees it, per ADR-005 — no exception for this being "just a summary of existing
data."

**Future evolution:** Phase 2D (per docs/32's recommended roadmap split) — deliberately
separated from the non-AI Health Milestones work (Phase 2C, now architecturally frozen —
§8, docs/58, ADR-027) because of its materially higher AI-safety requirements. A published
Health Milestone review (§8.2) is a natural future *input* to this computed view, named in
docs/58 §12.4, not built.

**Status update (2026-07-16, Phase 2D architecture freeze, docs/59, ADR-028/029/030):
architecturally frozen (not implemented).** Phase 2D is the platform's **first patient-facing
AI-generated-content feature** — three sub-features: a **Health Story** (an AI-narrated
summary of the patient's own recorded history), **AI Summaries** (the same shape at a coarser
cadence, distinguished by `narrative_type`), and a deterministic, non-AI **Progress
Analytics** view (the patient-facing counterpart to WPI-9's doctor-facing Analytics, computed
on read, no model call). The Digital Twin view and the Progress Analytics view remain
**computed views, never stored base tables** (ADR-004/ADR-028); only the AI narrative
audit/decision/delivery record and its doctor-approved published text are stored (§3.6
`DigitalTwinNarrative`, below). **Every narrative is doctor-approved before the patient ever
sees it** (ADR-005/ADR-028) — the identical three-part gate (prompt constraint + independent
drift check + mandatory doctor review) Phase 1.5's Consultation Summary (§2.2) already proved,
applied to an aggregated narrative; `get_health_story` returns only `approved`/
`edited_and_approved` narratives to a patient, never a pending or rejected draft. Retrieval is
grounded in the patient's own already-stored structured record only, until a real Knowledge
Engine exists (ADR-029, mirroring ADR-021/024). Five new router dispatch cases (three doctor
roster-scoped, two patient own-record; none dual-guarded), one new Patient Module Registry
entry (`health_story`, fail-closed by absence) and one new Doctor Module Registry entry
(`digital_twin_review`, **disabled by default per ADR-030** — the platform's third and
highest-risk AI-output-review surface). See docs/59 §4–§18 for the full design; all *Designed*,
none implemented — Phase 2D implementation requires its own separate, explicit approval.

## 3.6 Digital Twin Narrative — *Designed (Phase 2D architecture freeze, docs/59 §11.1, ADR-028/029)*
The Sheet-backed audit/decision/delivery record for one AI-generated Digital Twin narrative
(`narrative_type`: `health_story` or `ai_summary`). **Purpose:** to store what the model
produced (`ai_output`, immutable), the assembled context it was grounded in
(`context_snapshot`, for traceability), the independent drift check's advisory flags
(`ai_output_flags`), the doctor's one-way review decision (`review_status`: `pending` →
`approved`/`edited_and_approved`/`rejected`), and the doctor-approved text the patient
actually sees (`published_output`, set only on approval). Mirrors Phase 1.5's Consultation
Summary (§2.2) ownership exactly (AI-produced, doctor-reviewed, patient-received) and
AIAssistantInteraction's (§7.7) draft-then-decision shape. **Ownership:** doctor/staff-generated,
doctor-reviewed; the patient reads only `published_output` for `approved`/`edited_and_approved`
rows, never a draft. **Lifecycle:** created `pending`, one-way `review_status` transition
(exactly once) as the sole gate to patient visibility (ADR-028); every other field immutable.
**Full detail:** docs/59 §11.1.

---

# 4. Scheduling & Communication

## 4.1 Appointment — *Implemented (Batch WPI-5)*

> **Header corrected (Batch WPI-7's own repository consistency review, §14).**
> This section's header still read *Conceptual (gap)* even though the body below
> already records this entity's promotion first to *Designed* and then, at Batch
> WPI-5, to *Implemented* — the same category of stale-header drift docs/48 §5
> already corrected once for docs/33 itself. No entity's shape, schema, or shipped
> behavior changes; only this heading's own currency.

**Purpose:** The scheduled or requested clinical encounter — the entity that should sit
between a public booking-form submission and a Consultation actually happening. Does
not exist today: `contact.html`'s booking form is a Netlify Forms submission
(name/email/phone/condition/message) with no persisted, queryable Appointment record —
no status (`requested`/`confirmed`/`completed`/`cancelled`), no assigned Doctor, no
date/time slot tracked anywhere in this platform's own data.

**Attributes (conceptual):** `appointment_id`, `patient_id` (once a Patient Identity
exists — a first-time visitor booking obviously doesn't have one yet), `doctor_id`,
`requested_at`, `scheduled_at`, `status`, `condition_slug`.

**Relationships:** Would precede and become a Consultation (§2.1) once held —
concretely closing docs/20 §3's "THE GAP" at the data-model level, connecting the
public website's booking flow to Phase 2A's patient-facing history for the first time.

**Lifecycle:** N/A — not implemented. Today, a booking form submission lives only in
Netlify's form-storage, entirely outside this platform's own data architecture.

**Ownership:** N/A — not implemented.

**Future evolution:** A concrete, well-justified candidate for a future phase (see
docs/34) — not required for docs/29's Phase 2A scope, but worth prioritizing once
Phase 2A's identity/session infrastructure exists, since an Appointment naturally
needs to resolve to a Patient Identity once one exists.

**Status update (2026-07-16, Phase 3/WHIMS architecture-freeze, docs/49/50): promoted
from Conceptual to Designed.** docs/50 §8 gives this entity an owning phase for the
first time, per docs/34 Part 4 item 4's own recommendation. Nullable `patient_id`/
`doctor_id` fields are confirmed (a first-time visitor booking has neither yet, exactly
as this section already anticipated); a `specialty_slug` field is added (ADR-018). The
booking-form-to-`Appointment` intake mechanism is deliberately left as an
implementation-time decision, not designed here. Not yet implemented — see docs/50
§19's `WPI-5` batch.

**Status update (2026-07-16, Batch WPI-5): promoted from Designed to Implemented.**
`Appointment` has shipped (`shared/schemas/appointment.schema.json`,
`apps-script/Appointment.gs`) — staff/doctor-facing only, exactly as docs/50 §8 scoped
it; no patient-facing Appointment UI exists. `patient_id`/`doctor_id` are real,
empty-string-sentinel-until-assigned fields, validated against a real Patient
Identity/Doctor when supplied; `specialty_slug` is server-derived once, at creation,
from `condition_slug` via `SpecialtyRegistry.gs`'s `foundationGetSpecialtyForCondition_()`
(ADR-018). Lifecycle is one-way and exactly-once:
`requested` → `confirmed` (assigns a real `doctor_id`/`scheduled_at`) → `completed`, or
`requested`/`confirmed` → `cancelled` — mirroring `DoctorInstruction.gs`'s own
one-way-transition discipline. The booking-form-to-`Appointment` intake question docs/50
§8 left open is resolved as a disclosed, staff-run tool
(`createFoundationAppointment()`), mirroring `DoctorAssignedCondition.gs`'s
`assignFoundationCondition()` precedent exactly, not a new public write endpoint — every
write (creation, confirmation, status transitions) remains a manually-run Apps Script
editor function. One new, additive, read-only `FoundationRouter.gs` dispatch case
(`get_doctor_appointments`) returns the caller's own specialty-derived Appointments view,
`doctor_id` always `DoctorSession`-derived — the same specialty-derivation discipline
`DoctorPatientRoster.gs`'s patient roster already established, including its own
disclosed multi-doctor-per-specialty limitation (docs/50 §7.4, docs/51 Part 1.6). The
Doctor Dashboard's Doctor Module Registry gains its second real entry, `appointments`
(`shared/constants/doctor-module-registry.json` 1.1.0 → 1.2.0), rendering one new,
read-only card. See `shared/schemas/appointment.md` for the full lifecycle and
disclosed-decision detail.

---

## 4.2 Notification — *Implemented (Batch WPI-6)*

> **Header corrected (Batch WPI-7's own repository consistency review, §14).**
> This section's header still read *Conceptual (gap)* even though the body below
> already records this entity's promotion first to *Designed* and then, at Batch
> WPI-6, to *Implemented* — the same category of stale-header drift docs/48 §5
> already corrected once for docs/33 itself. No entity's shape, schema, or shipped
> behavior changes; only this heading's own currency.

**Purpose:** Any message the platform sends to a person — currently implemented
entirely ad hoc, once per feature, rather than as a shared entity. Phase 1.5's
`Email.gs` sends visit-summary emails; docs/29's login-link email is a second,
independently-implemented email flow. Neither is modeled as an instance of a shared
"Notification" concept.

**Attributes (conceptual):** `notification_id`, `patient_id`, `channel` (email/SMS/
in-app), `type` (login_link/visit_summary/future appointment_reminder), `status`
(sent/failed/read), `sent_at`.

**Relationships:** Belongs to one Patient Identity. Would be produced by Consultation
Summary's send step, Session's login-link step, and any future appointment-reminder or
Care Plan follow-up reminder.

**Lifecycle:** N/A — not implemented as a shared entity today; each feature currently
implements its own send-and-log logic independently.

**Ownership:** N/A — not implemented.

**Future evolution:** Worth unifying before a third ad hoc email flow is built — two
independent implementations (Phase 1.5's and docs/29's) is a reasonable place to stop
and observe; a third would be a real DRY violation. Flagged as a simplification
opportunity in docs/34 rather than acted on now, since docs/29's login-link email is
still only planned, not built.

**Status update (2026-07-16, Phase 3/WHIMS architecture-freeze, docs/49/50): promoted
from Conceptual to Designed.** docs/34's own "revisit only when a third independent
flow is proposed" trigger has been passed — docs/50 §10/§11 add a fourth and fifth
flow (Inventory low-stock alerts, PillFill order-status updates) on top of the two
already named here. docs/50 §9 scopes Notification as a shared *record* of what was
sent, not a new delivery pipeline — every existing sender keeps its own transport code
and additionally writes a Notification row. Not yet implemented — see docs/50 §19's
`WPI-6` batch.

**Status update (2026-07-16, Batch WPI-6): promoted from Designed to Implemented.**
`Notification` has shipped (`shared/schemas/notification.schema.json`,
`apps-script/Notification.gs`) — a shared record of what was sent, never a new
delivery pipeline, exactly as docs/50 §9 scoped it. `patient_id`/`doctor_id` are both
nullable (empty-string sentinel), mirroring `Appointment`'s own convention — never
both non-empty on the same row; a disclosed, additive `recipient_email` fallback field
covers Phase 1.5's visit-summary flow, which predates Patient Identity and has no
`patient_id` to reference. Three currently-real sender flows are unified:
`FoundationLoginFlow.gs`'s patient login-link email, `DoctorLoginFlow.gs`'s doctor
login-link email, and Phase 1.5's `Send.gs` visit-summary email — each gains exactly
one additional, disclosed statement recording its own already-completed send attempt,
with no change to its own gate, transport, or return value. **Ownership:
system-generated only, mirroring Session's own ownership model** — no manually-run
editor function, and zero `FoundationRouter.gs` dispatch case ships in this batch (a
disclosed scope decision distinguishing this entity from `CalculatorResult`'s "backend
only, but still routed" precedent). Two internal-only read helpers
(`foundationGetNotificationsForPatient_`/`foundationGetNotificationsForDoctor_`)
satisfy docs/53 §5's create/read requirement, exercised directly by the conformance
harness's Stage 22 — neither is reachable over HTTP yet. Full detail:
`shared/schemas/notification.md`.

---

# 5. Knowledge & Tools

## 5.1 Knowledge Article — *Conceptual*

**Purpose:** A single piece of doctor-approved educational content — a blog post, a
condition-page section, an FAQ answer. Currently these exist as hand-authored HTML
files (per Phase 1.5 Batch 4A's explicit decision, docs/25 §11: "the public site's
condition references are hand-authored HTML anchors, not data-driven"), not as
structured, queryable rows. This entity describes the shape they would take *if* the
site ever becomes data-driven — not a plan to make that change now.

**Attributes (conceptual):** `article_id`/`slug`, `title`, `body`, `condition_slug`
(tag), `review_status`, `author`, `published_at` — mirroring docs/22's source list
(protocols, notes, articles, FAQs, research summaries, calculator explanations all
share this rough shape).

**Relationships:** Aggregated and prioritized by Knowledge Engine (§5.2). Grounds
AI Summary-pattern (§2.4) outputs per ADR-001.

**Lifecycle:** N/A as a stored entity today — governed instead by docs/06's content
guidelines and docs/22's "clinician review, version controlled, replace obsolete
information" lifecycle, applied to files, not rows.

**Ownership:** Clinician-approved, per docs/22's governance rule — content authorship
process is unchanged by this document.

**Future evolution:** Revisit whether this becomes data-driven only if/when dedicated
condition pages move off hand-authored HTML (the exact trigger condition Phase 1.5
already named, docs/25 §11) — not before.

---

## 5.2 Knowledge Engine — *Conceptual (system-level aggregate)*

**Purpose:** Not a stored entity — the trusted-source system described in docs/22 and
locked as permanent by ADR-001. Aggregates Knowledge Article and other doctor-approved
sources, in the priority order docs/22 defines (protocols → clinical notes → articles →
FAQs → research → calculator explanations), and is the thing every AI Summary-pattern
output must be traceable to.

**Attributes:** None of its own — a governance/retrieval layer over other entities.

**Relationships:** Aggregates Knowledge Article (§5.1) and future protocol/FAQ
entities not yet separately modeled. Grounds every AI Summary (§2.4).

**Lifecycle:** N/A.

**Ownership:** Clinician-governed per docs/22.

**Future evolution:** Currently satisfied entirely by inline, per-request doctor-
supplied text (Phase 1.5's `staff_submitted_note` pattern) — there is no real retrieval
implementation yet. Needed for real once Phase 2D (Digital Twin/AI Summaries) requires
grounding a narrative in more than one request's worth of context — flagged in
docs/32's Final Architecture Review as a remaining risk, repeated here at the entity
level.

---

## 5.3 Calculator — *Implemented — backend only — Patient variant only (Phase 2B, Batch PXP-6, docs/44 §8)*

**Purpose:** docs/21 describes two variants — Public (no login, no storage,
educational) and Patient (stores progress, historical trends, integrated with My
Health Journey). Neither has a schema, and — distinct from every other "Conceptual"
entity in this document — **no phase in docs/24's roadmap currently claims it at all**,
public or patient variant. This is a genuine roadmap omission, not just an
unimplemented-but-planned feature.

**Attributes (conceptual):** `CalculatorDefinition` (currently hardcoded per-calculator
JS logic, not data-driven) and, for the patient variant, `CalculatorResult`
(`patient_id`, `calculator_slug`, `result_value`, `computed_at`) — structurally similar
to Symptom Log (§3.2).

**Relationships:** Patient-variant results would belong to one Patient Identity and
could feed Timeline Event/Digital Twin the same way Symptom Log does.

**Lifecycle:** N/A — not implemented.

**Ownership:** N/A — not implemented.

**Future evolution:** Needs an explicit roadmap owner (docs/34 flags this) — the
patient variant's storage shape is close enough to Symptom Log's that it could
plausibly reuse the same batch pattern once scheduled.

**Status update (2026-07-04, renumbered 2026-07-08 for docs/44 Version 3.0):** The
Patient variant now has a roadmap owner — Phase 2B (docs/44 §8), governed by ADR-013
(calculators are deterministic, never AI-generated, confirmed unchanged), and elevated
to **Pillar 3** of Phase 2B's core architecture (docs/44 §4) — a general-purpose,
doctor-authored computation pattern exposed through its own **Calculator Registry**
(docs/44 §8.1), never a single-use, hardcoded, disease-specific feature (docs/44 §8.3).
`CalculatorDefinition` and `CalculatorResult` attributes are formalized in docs/44
§8.2, matching this section's own conceptual shape. **The Public (no-login) variant
remains unclaimed** — docs/44 §2.2 explicitly excludes it; docs/46 Part 3 carries this
forward as a still-open gap.

**Status update (2026-07-13, Batch PXP-6):** **Implemented — backend only.** See §6.8
for the shipped shape. `CalculatorRegistry.gs`/`calculator-registry.json` and
`CalculatorResult.gs`/`calculator-result.schema.json` back the generic, pluggable
registry-and-result mechanism; `submit_calculator_result`/`get_calculator_results`
(`FoundationRouter.gs`) are the platform's fourth patient-writable route pair. **The
registry ships with zero registered calculators** — a deliberate, disclosed scope
decision (`calculator-registry.md`'s "Ships empty" section): this batch's own scope is
the mechanism only, not a concrete `CalculatorDefinition`. No Module Registry entry, no
dashboard card, no patient-facing UI — a disclosed, explicit narrowing from docs/44
§22's own PXP-6 row (which names "Patient Calculator UI" as part of this batch),
mirroring the Module Registry (PXP-3, backend) / Dashboard Registry (PXP-4, frontend)
split precedent exactly. The Public (no-login) variant remains unclaimed, unchanged by
this batch.

---

# 6. Phase 2B Entities — *Mostly Implemented — see individual subsections and the Summary Table below (docs/44-PHASE-2B-TECHNICAL-PLAN.md, Version 4.0)*

Net-new entities that did not exist even conceptually in this document before Phase 2B's
architecture-freeze pass. Doctor Instruction (§2.3), Care Plan (§3.4), and Calculator
(§5.3) were already conceptual and are promoted in place above rather than restated
here. Full field-level detail lives in docs/44 — this section records only each
entity's purpose and relationships, at the same fidelity the rest of this document uses.
**Updated 2026-07-08** for docs/44 Version 3.0: `Condition Assignment` renamed to
`DoctorAssignedCondition` per approved terminology; authentication gained an explicit
Long-Lived Session mechanism (ADR-015, supersedes ADR-014, which superseded ADR-011);
Module Engine's dashboard migration is now committed for every card, not deferred
(ADR-012, amended); a Calculator Registry was added alongside the Module Registry.
**Updated 2026-07-09** for docs/44 Version 4.0 (documentation-only architecture-freeze
finalization, no entity's shape changed): implementation batches renamed PCP-1…PCP-11
→ PXP-1…PXP-11 throughout this section and the Summary Table below; a Template
Registry entity added (§6.7, new ADR-016), generalizing Check-In Template (§6.5) into
its first concrete category.
**Updated 2026-07-09** for Batch PXP-2 (implementation): Doctor Assigned Condition
(§6.2) promoted from *Designed* to **Implemented** — see that subsection's own status
update for the shipped shape, the resolved docs/45 Part 1.2 coexistence loose end, and
the one read-only patient route this batch adds.
**Updated 2026-07-10** for Batch PXP-3 (implementation): Module Registry and Patient
Module State (§6.3) promoted from *Designed* to **Implemented** — see that
subsection's own status update for the shipped shape, ADR-012's second amendment
(generalizing the registry's framing beyond dashboard-only infrastructure), and the
disclosed scope boundary that no dashboard rendering changes in this batch.
**Updated 2026-07-11** for Batch PXP-4 (implementation): §6.3 promoted from
**Implemented (backend scaffold)** to **Implemented (backend scaffold + frontend
consumer)** — the patient dashboard is now a registry-driven consumer of PXP-3's
Module Registry plus `PatientModuleState`. Every card that renders corresponds to a
registry entry the patient is enabled for; `renderDashboard()` no longer contains any
hardcoded knowledge of a specific module. See §6.3's own status update for the
disclosed frozen-file exception (`my-health-journey/dashboard.js`, the exact
"authorized migration" case ADR-012 (amended) commits to), the removal of the three
pre-PXP-4 hardcoded "future" placeholder cards, and the new dedicated PXP-4 browser-
test suite.
**Updated 2026-07-12** for Batch PXP-5 (implementation): §6.5 (Check-In Template and
Check-In Response) and §6.7 (Template Registry) promoted from *Designed* to
**Implemented** — see those subsections' own status updates for the shipped shape,
the new `daily_checkin` Module Registry entry, and the one disclosed, additive
gap-fill entity (`CheckInTemplateAssignment`) this batch adds to make docs/44 §10.2's
"a doctor explicitly assigns" requirement actually enforceable.
**Updated 2026-07-13** for Batch PXP-6 (implementation): §5.3 (Calculator) and new
§6.8 (Calculator Registry and Calculator Result) promoted to **Implemented — backend
only** — see those subsections' own status updates for the shipped shape and the
disclosed "ships empty, no UI in this batch" scope decision.
**Updated 2026-07-14** for Batch PXP-7 (implementation): §2.3 (Doctor Instruction) and
§3.4 (Care Plan) promoted from *Designed* to **Implemented** — see those subsections'
own status updates for the shipped shape, the disclosed additive `version_key` field,
and the disclosed decision not to emit a Timeline Event in this batch (docs/44 §12
names this; doing so would require touching two frozen Phase 2A files for new
functionality, not a bug fix, per docs/47 §6).
**Updated 2026-07-15** for Batch PXP-10 (implementation, docs/44 §10.1/§22, docs/47):
§3.2 (Symptom Log) updated in place — its dashboard entry is retired (the
`symptom_tracker` Module Registry entry removed from all three hand-ported copies) and
its `log_symptom`/`get_symptom_logs` endpoints are deprecated by documentation
disclosure only (zero lines changed in either frozen Apps Script file); `SymptomLogs`
rows are retained permanently and the standalone Symptom History page remains
reachable by direct URL, unlinked from the dashboard. §6.3 (Module Registry) updated
to record the registry's first removal.
**Updated 2026-07-15** for Batch PXP-11 (Closeout, documentation-only): three stale
status tags left over from earlier batches, corrected — §5.3 (Calculator)'s header
still read *Designed, not yet implemented* though Batch PXP-6 had already promoted it
to *Implemented — backend only* in its own body text (§5.3's "Status update
(2026-07-13, Batch PXP-6)" paragraph); §6.4 (the pre-PXP-6 Calculator Registry design)
was left as an unmarked, stale duplicate of §6.8 (the batch's actual shipped shape) and
now carries an explicit superseded-pointer note rather than silently disagreeing with
the Summary Table, which already pointed to §6.8; and this section's own top-level
header still read *Designed, not yet implemented* though nine of its eleven
subsections are now Implemented. No entity's shape, schema, or status changed — these
are the same corrections in kind as docs/43-PHASE-2A-CLOSEOUT.md §5 made to a stale
`docs/CHANGELOG.md` notice at the equivalent point in Phase 2A's own closeout.

## 6.1 Patient Profile — *Implemented (Batch PXP-1)*
**Purpose:** Patient-editable structured contact/personal data (phone, date of birth,
preferred contact method, emergency contact), kept separate from the identity fields on
Patient (§1.1) so the frozen, conformance-tested `patient-identity.schema.json` is never
widened. The platform's first entity a patient edits directly, rather than only reads or
appends to — and its first upsert-style (create-or-update) entity, unlike every prior
entity's create-and-list-only lifecycle. **Relationships:** 1:1 with Patient. **Full
detail:** docs/44 §17, shared/schemas/patient-profile.schema.json,
shared/schemas/patient-profile.md.

**Status update (this change):** Implemented. `apps-script/FoundationPatientProfile.gs`
backs `get_patient_profile`/`save_patient_profile` (`FoundationRouter.gs`), and
`my-health-journey/profile/` is the patient-facing view/edit page, linked from one
disclosed addition to the dashboard header (`#profileLink`). docs/45 Version 4.0's two
open lifecycle questions (eager-vs-lazy creation, `Patient.status` gating) are resolved:
lazy creation (no row exists until the first save; a never-saved profile returns a real,
default-shaped record, never `FOUNDATION_NOT_FOUND`) and no status-based gating (profile
view/edit works regardless of active/inactive/recovered, matching every other existing
patient-facing feature). No dashboard card was added in this batch — see
shared/schemas/patient-profile.md's disclosed scope boundary.

## 6.2 Doctor Assigned Condition — *Pillar 1, Implemented (Batch PXP-2)* (renamed from "Condition Assignment")
**Purpose:** A doctor-authored record of which condition(s) are currently active for a
patient, with a full assign/resolve audit trail — replacing today's single, staff-typed,
never-updated `condition_slug` field with a real, many-to-one, doctor-driven workflow.
**The patient never selects a condition — diagnosis and assignment are the doctor's
alone.** The foundation every other Phase 2B pillar and capability builds on (docs/44
§4). **Relationships:** Many per Patient; informs (never automatically triggers) Daily
Check-in template assignment (§6.5) and Calculator/module enablement, both of which
remain explicit doctor actions (docs/44 §14). **Full detail:** docs/44 §6 — the Option
A/B design fork from earlier review rounds is now **settled: Option B, additive,
approved**. `Patient.condition_slug` itself is untouched.

**Status update (this change):** Implemented. `apps-script/DoctorAssignedCondition.gs`
backs `foundationAssignCondition_()`/`foundationResolveCondition_()`/
`foundationGetPatientConditionAssignments_()`. Doctor/staff-owned, a hard boundary: the
patient never creates, edits, or resolves a row of this shape. No real Doctor identity/
authentication exists yet (docs/33 §1.4, a disclosed gap), so assignment and resolution
are manually-run Apps Script editor functions (`assignFoundationCondition()`/
`resolveFoundationCondition()`), mirroring `PatientIdentity.gs`'s
`createFoundationPatient()` precedent exactly — not a new authenticated Web App route.
The schema adds `resolved_at`/`resolved_by` (empty-string sentinels until resolved)
beyond docs/44 §6.2's own summary field list, completing the "full audit history of
every assignment **and resolution**" docs/44 already named as this entity's intent
(shared/schemas/doctor-assigned-condition.md). One read-only, session-derived route —
`get_doctor_assigned_conditions` (`FoundationRouter.gs`) — is this batch's approved,
minimal patient-facing surface (docs/44 §22's "zero patient-facing surface beyond a
read-only reflection, if any"); it is infrastructure for later batches (Module
Registry, Dashboard Registry, Daily Check-in Engine, Calculator Registry, Personal Care
Plan) to eventually consume, not a patient-facing feature — no UI is built on top of it
in this batch. **docs/45 Version 3.0/4.0 Part 1.2's coexistence loose end is resolved:**
this batch is purely additive; `Patient.condition_slug` and every existing reader of it
are completely untouched, and no existing reader is required to migrate as part of this
change.

## 6.3 Module Registry and Patient Module State — *Pillar 2, Implemented (Batches PXP-3 backend, PXP-4 frontend consumer)*
**Purpose:** A config-level list of available capabilities (Module Registry) plus a
per-patient enablement record (`PatientModuleState`) — the mechanism behind ADR-012
(amended twice) and docs/44 §7/§14's per-patient feature enable/disable requirement.
**Enablement is always an explicit doctor/staff action — never automatic based on a
Doctor Assigned Condition, never patient-controlled** (docs/44 §14, settled). Governs
whether Daily Check-ins, Calculator, and Care Plan will someday appear on a given
patient's dashboard, once each of those batches ships. **The dashboard's rendering will
become fully registry-driven for every module, including the pre-existing Timeline,
Symptom Tracker, and Reports cards** — not deferred indefinitely as originally allowed
(ADR-012's first amendment; docs/44 §7.3/§13 "Dashboard Registry," PXP-4, is its own
dedicated, still-unbuilt migration batch — this batch ships no dashboard rendering
change). **Relationships:** `PatientModuleState` is many-per-Patient (one row per
module). **Full detail:** docs/44 §7, ADR-012 (amended twice).

**Status update (this change):** Implemented, as a backend scaffold only.
`shared/constants/module-registry.json` (Module Registry) and
`apps-script/ModuleRegistry.gs` (its hand-ported runtime copy) define module
*availability*, seeded with descriptors for the three already-implemented Phase 2A
capabilities (Timeline, Symptom Tracker, Reports) only — Daily Check-ins, Calculators,
and Personal Care Plan are deliberately not pre-declared, per
`shared/constants/module-registry.md`'s own disclosed reasoning (inventing their shape
now would front-run their own future batches' design decisions). `shared/schemas/
patient-module-state.schema.json` and `apps-script/PatientModuleState.gs` implement
per-patient *enablement*: one row per `(patient_id, module_id)` pair, addressed by a
server-derived, deterministic `state_key` field (so the frozen, single-idColumn
`FoundationDataStore.gs` needed no change), fail-closed by absence (ADR-010) —
`foundationGetPatientModuleStates_()` merges real rows with synthesized, empty-sentinel
defaults for any module a doctor/staff member has never acted on. No real Doctor
identity/authentication exists yet (docs/33 §1.4), so enable/disable stays a
manually-run Apps Script editor function (`setFoundationModuleState()`), mirroring
`DoctorAssignedCondition.gs`'s own precedent exactly. One read-only, session-derived
route — `get_patient_module_states` (`FoundationRouter.gs`) — is this batch's approved,
minimal patient-facing surface; it has no UI consumer in this batch (docs/44 §22's
"no dashboard rendering change yet" for PXP-3) and is infrastructure for the future
Dashboard Registry batch (PXP-4) to eventually consume. **ADR-012 was amended a second
time** (2026-07-10) to generalize its framing from dashboard-specific infrastructure to
a platform-wide capability-exposure mechanism — the dashboard remains its first and,
as of this batch, its only implemented consumer; Timeline, Personal Care Plan, and a
future AI system are named, not scoped, as potential future consumers, the same
discipline ADR-016 already established for its own future template categories. The
registry's descriptor shape also gained additional, presently-inert display/
extensibility metadata and a family of reserved `supports_*` capability flags (mirroring
docs/44 §7.1's own AI-readiness reservation) — see `shared/constants/
module-registry.md` for the full, disclosed field list, including one field
(`enabled_by_default`) considered and deliberately omitted for risking contradiction
with the fail-closed/doctor-only-enablement rule.

**Status update (Batch PXP-4, 2026-07-11):** the patient dashboard
(`my-health-journey/dashboard.js`) is now a registry-driven consumer of this
subsection's Module Registry plus `PatientModuleState`. Every card that renders
corresponds to a registry entry the patient is enabled for (`enabled === true`);
`renderDashboard()` no longer contains any hardcoded knowledge of a specific
`module_id`, `title`, `display_order`, or `data_source`. `PatientModuleState` is now
the sole source of enablement — fail-closed: absence of an enabled row means the card
does not render (matching PXP-3's fail-closed default at the backend). The Module
Registry is the sole source of presentation. A loader-dispatcher maps each registry
`data_source` string to its registered loader function; adding a new module later
means (i) add its registry entry, (ii) register a loader — nothing in the render
path changes. One disclosed frozen-file exception: `my-health-journey/dashboard.js`,
the exact "authorized migration" case ADR-012 (amended) commits to and docs/44 §7.3
requires. The three pre-PXP-4 hardcoded "future" placeholder cards (Care Plan,
Messages, Digital Twin) no longer render on any patient's dashboard, since none are
in the Module Registry (docs/47 §4: a not-yet-built module is not pre-declared by an
earlier batch guessing its shape; each will re-appear via its own future batch's
registry entry, not a hardcoded call in `dashboard.js`). Zero backend change — the
batch is entirely a frontend consumer of PXP-3's already-shipped
`get_patient_module_states` route. New browser-test suite
`validation/pxp-4-dashboard-registry/` covers PXP-4's own new surface (empty
dashboard, per-patient enablement, `display_order` ordering, unregistered
`data_source` fail-soft, `filterEnabledModules` pure-function behavior, session
fail-closed on state rejection).

**Status update (2026-07-15, Batch PXP-10):** the registry's first removal. The
`symptom_tracker` entry (§6.3's own PXP-3 seeding) is deleted from all three
hand-ported copies (`shared/constants/module-registry.json`,
`apps-script/ModuleRegistry.gs`, `my-health-journey/dashboard.js`), the same
"update all three ports by hand" discipline every prior addition already followed, run
in reverse for the first time. `PatientModuleState` itself is unaffected — any
already-persisted `symptom_tracker` row simply stops matching a registry entry and is
silently dropped by `foundationGetPatientModuleStates_()`'s existing registry-merge
logic (no schema change, no migration). See §3.2's own status update and
`shared/constants/module-registry.md`'s "Batch PXP-10 removal" section for full detail.

## 6.4 Calculator Registry, Calculator Definition, and Calculator Result — *Superseded by §6.8 (Batch PXP-6) — retained as pre-implementation history, not current*

> **PXP-11 closeout note (2026-07-15):** This subsection describes the pre-PXP-6
> *design*, written before Batch PXP-6 shipped. When PXP-6 implemented this pillar, its
> shipped shape was recorded in a new §6.8 rather than updating this subsection in
> place, leaving this section stale (still showing no status tag) while the Summary
> Table below already correctly pointed to §6.8. **§6.8 is the current, authoritative
> description of this entity.** The text below is kept only as a historical record of
> the pre-implementation design, per docs/00's "keep history, correct the stale
> current-status framing" rule (the same fix docs/43-PHASE-2A-CLOSEOUT.md §5 applied to
> the old `docs/CHANGELOG.md`) — not re-read as current.

**Purpose:** A registry of available calculators (Calculator Registry, mirroring the
Module Registry) referencing versioned, deterministic, doctor/staff-authored formulas
(`CalculatorDefinition`) and a patient's computed results against one
(`CalculatorResult`) — see §5.3 above for this entity's promotion from Conceptual, and
docs/44 §8/ADR-013 (confirmed) for why it is a general-purpose pillar rather than a
single-use feature. **A new calculator is added by registering a new definition — never
by hardcoding a disease-specific branch inside shared Calculator Framework code**
(docs/44 §8.3). **Relationships:** `CalculatorResult` belongs to one Patient; visibility
governed by Patient Module State (§6.3), enabled only by explicit doctor action.
**Full detail:** docs/44 §8.

## 6.5 Check-In Template and Check-In Response — *Implemented (Batch PXP-5)*
**Purpose:** A doctor/staff-authored, versioned question set (`CheckInTemplate`) and a
patient's recorded answers against one (`CheckInResponse`) — the mechanism behind
"Personalized Daily Check-ins," a consumer of Pillars 1 and 2, designed as the eventual
successor to Symptom Log (§3.2) once proven in production alongside it (never a single
atomic cutover, per ADR-008). **Template assignment is settled: a doctor explicitly
assigns which template(s) apply to a patient, informed by — never automatically derived
from — their Doctor Assigned Condition(s) (§6.2). The patient never configures or
selects a template** (docs/44 §10.2). **Relationships:** `CheckInResponse` belongs to
one Patient and references one `CheckInTemplate` by **both** `template_id` and
`template_version` (docs/44 §11.4 — pinning both, not just the former, is what keeps a
response permanently interpretable even after the template is later edited). **Full
detail:** docs/44 §11/§10, including the now-concrete JSON storage versioning/
migration/validation policy (docs/44 §11.4) that resolves what docs/45 Version 2.0
tracked as this pass's highest open risk.

**Status update (this change):** Implemented.
`apps-script/TemplateRegistry.gs`/`shared/constants/template-registry.json` seed the
Template Registry's first concrete category with one template,
`daily_wellness_checkin` v1 (four questions). `apps-script/CheckInResponse.gs`/
`shared/schemas/check-in-response.schema.json` back `submit_checkin_response`/
`get_checkin_responses` (`FoundationRouter.gs`) — the platform's first entity
implementing docs/44 §11.4's JSON storage policy in full: `answers` is a flat object,
validated field-by-field against the referenced `(template_id, template_version)`'s
own question list, size-bounded, and serialized with deterministic key order.
`my-health-journey/dashboard.js` gains a `daily_checkin` module registered the same
way every module since PXP-4 is (one `MODULE_REGISTRY` entry, one registered loader),
rendering a dynamic form generated from the caller's own current template's question
metadata — the dashboard's first form not hardcoded to a fixed field set.
`my-health-journey/checkins/` is the new full-history page, mirroring
`my-health-journey/symptoms/`'s existing pattern. Shipped alongside, never replacing,
Symptom Log (§3.2) — `SymptomLogs` and its own routes are completely untouched
(docs/44 §10.1).

**Disclosed, additive gap-fill (this change):** docs/44 §10.2 settles that "a doctor
explicitly assigns which template(s) apply" to a patient, but names no persisted shape
for that assignment anywhere in docs/44 §17 or this document. `CheckInTemplateAssignment`
(`shared/schemas/check-in-template-assignment.schema.json`,
`apps-script/CheckInTemplateAssignment.gs`) fills this gap — an exact structural mirror
of the already-approved Doctor Assigned Condition (§6.2) pattern: many-per-patient,
append-mostly, doctor/staff-only (`assignFoundationCheckInTemplate()`/
`resolveFoundationCheckInTemplateAssignment()`, manually-run editor functions, no real
Doctor identity/session yet, §1.4), no Web App write route. `CheckInResponse.gs`'s
write path enforces this assignment directly — a patient can only submit against a
`template_id` they currently hold an active assignment for, never merely one that
exists in the registry, making docs/44 §10.2's rule an enforced boundary rather than an
advisory one. This is a gap-fill within PXP-5's own named scope, not a new
architectural decision, new registry, or new ADR.

## 6.6 Persistent Authentication — Magic Link, Trusted Device, Long-Lived Session, Optional PIN
**Purpose:** Four cooperating, named mechanisms for patient login, governed by
**ADR-015** (supersedes ADR-014, which superseded ADR-011 — all three records exist,
only ADR-015 is current). **Magic Link** is the unconditional root of trust and sole
recovery path — unchanged from Phase 2A. **`TrustedDevice`** is a machine-generated,
high-entropy device token, hashed the same proven way `LoginToken` already is (§1.3),
rooted in a magic-link event. **Long-Lived Session** (named explicitly by ADR-015,
not merely implicit in a token exchange) is the actual extended access window issued
once a Trusted Device is presented — revoking the issuing device invalidates the
long-lived access it was granting, without affecting a different device's independent
session. **`PatientCredential`** (an optional PIN) is explicitly reframed as a
**convenience-only, secondary** factor — never mandatory, never equivalent in
importance to the first three. **The platform continues to operate passwordless by
default for any patient who opts into neither Trusted Device nor PIN** — a permanent,
explicit constraint per ADR-015, not merely a current-state description.
**Relationships:** `TrustedDevice` is many-per-Patient; `PatientCredential` is
0-or-1-per-type per Patient; both resolve to the same `patient_id` (ADR-002) and exist
alongside — never replacing — Session/LoginToken (§1.2/§1.3). **Full detail:** docs/44
§5, ADR-015 (governing), ADR-014 and ADR-011 (both superseded, retained by reference).

**`TrustedDevice` and Long-Lived Session — Implemented (Batch PXP-8, docs/44 §5/§22).**
`shared/schemas/trusted-device.schema.json` + `apps-script/TrustedDevice.gs` ship the
first Phase 2B entity that is *patient*-owned rather than doctor/staff-owned (every
write is a real, session-authenticated Web App route — `mark_device_trusted`,
`revoke_trusted_device` — with no manually-run editor counterpart at all, unlike every
prior PXP-1..7 entity). Long-Lived Session resolves docs/44 §5.5's implementation-time
question as an **additive wrapper**: `TrustedDevice.gs`'s
`foundationIssueLongLivedSessionToken_()` reuses `FoundationSession.gs`'s own
unmodified signing primitives with a longer, local TTL constant — zero lines changed
in the frozen `FoundationSession.gs`, `FoundationRouteGuard.gs`, or
`session.schema.json`. `consume_trusted_device` (the presented device token is itself
the credential) both rotates the device token and issues a fresh Long-Lived Session in
one action — this is also this design's "session renewal" mechanic, with no separate
renew action. **PIN (`PatientCredential`) remains explicitly out of scope for this
batch** — docs/45 Part 5's dedicated-security-review gate is still open, unchanged by
this batch.

## 6.7 Template Registry — *Implemented (Batch PXP-5), generalizes Check-In Template (§6.5)*
**Purpose:** A config-level registry of template descriptors (mirroring Module
Registry §6.3 and Calculator Registry §6.4) from which any patient-facing form or
questionnaire is generated, never hardcoded per form. Governed by **new ADR-016**,
which complements ADR-012 rather than amending or superseding it — Module Registry
governs which *capability* a patient sees; Template Registry governs the *shape* of a
form or questionnaire a capability renders once exposed. **`CheckInTemplate` (§6.5) is
this registry's first concrete category, not a separate mechanism** — the same
versioning (`template_id`/`version`), activation (`status`: active/retired), and
doctor-assignment discipline §6.5 already describes for Check-in templates applies
uniformly to any future category. **Named future categories, reserved and unscoped —
not designed, batched, or authorized by this document:** Weekly Check-in, Monthly
Review, Condition Review, Lifestyle Questionnaire, Follow-up Questionnaire, and
Doctor-created Templates (a template *authored by* a doctor, never one *configured by*
a patient — the same "doctors decide" rule as every other Phase 2B capability).
**AI-readiness (reserved, not implemented):** every template descriptor reserves an
extension-point field for future AI-compatibility metadata; no AI behavior exists
today, and any eventual use remains gated by the full ADR-001/004/005 pattern.
**Relationships:** `CheckInTemplate`/`CheckInResponse` (§6.5) are this registry's first
instantiated category; any future category would follow the same relationship shape.
**Full detail:** docs/44 §11/§11.5, ADR-016.

**Status update (this change):** Implemented, seeded with exactly one template
(§6.5's own status update). `template_category` (fixed to `"daily_checkin"` for every
row in this batch) is a disclosed, additive field beyond docs/44 §11.2's literal field
list — the concrete mechanism §11.5 requires ("support, for every category, without a
code change") but does not itself name a field for; see
`shared/constants/template-registry.md`'s own disclosure. The six future categories
named above remain unseeded, unscoped, and unclaimed by this batch.

## 6.8 Calculator Registry and Calculator Result — *Pillar 3, Implemented — backend only (Batch PXP-6)*
**Purpose:** A registry of available, deterministic, doctor/staff-authored calculators
(Calculator Registry, mirroring Module Registry §6.3 and Template Registry §6.7)
referencing versioned input-field definitions (`CalculatorDefinition`, embedded
directly in each registry entry, the same convention `CheckInTemplate`'s `questions`
already established rather than a separate file) and a patient's computed results
against one (`CalculatorResult`) — see §5.3 above for this entity's own promotion.
**A new calculator is added by registering a new registry entry — never by hardcoding
a disease-specific branch inside shared Calculator Framework code** (docs/44 §8.3).
**Relationships:** `CalculatorResult` belongs to one Patient; visibility would be
governed by Patient Module State (§6.3), once a future batch wires a calculator into
the Module Registry — no separate assignment entity exists for this pillar, unlike
Check-In Template (§6.5). **Full detail:** docs/44 §8, ADR-013.

**Status update (this change):** Implemented — backend only.
`apps-script/CalculatorRegistry.gs`/`shared/constants/calculator-registry.json` define
the registry mechanism, **seeded with zero calculators** — a deliberate, disclosed
scope decision (`calculator-registry.md`'s "Ships empty" section): this batch's own
scope is the generic registry-and-result mechanism only, not a concrete
`CalculatorDefinition` (disease-specific or otherwise). `apps-script/CalculatorResult.gs`/
`shared/schemas/calculator-result.schema.json` back `submit_calculator_result`/
`get_calculator_results` (`FoundationRouter.gs`) — the platform's second entity
implementing docs/44 §11.4's JSON storage policy in full (`check-in-response.schema.json`'s
own `.md` had already named this as its anticipated "second use"): `input_snapshot` is
a flat object, validated field-by-field against the referenced
`(calculator_slug, definition_version)`'s own `input_fields`, size-bounded, and
serialized with deterministic key order. `result_value` is never computed by this
generic layer — ADR-013's formula logic is a future batch's responsibility once a real
calculator is authored; this batch only validates and stores whatever value the caller
supplies. **No Module Registry entry, no dashboard card, no patient-facing UI in this
batch** — a disclosed, explicit scope narrowing from docs/44 §22's own PXP-6 row
(which names "Patient Calculator UI" as part of this batch), mirroring the Module
Registry (PXP-3 backend) / Dashboard Registry (PXP-4 frontend) split precedent exactly.
Conformance tests prove the generic mechanism end to end via a synthetic, clearly-
labeled test-only fixture pushed directly into the test harness's own registry array
(never committed to `calculator-registry.json` itself) — see
`validation/phase-2a-foundation/conformance.js`'s Stage 14 for detail.

---

# 7. Phase 3 — WHIMS Patient Intelligence Platform Entities — *Batches WPI-1 through WPI-10 Implemented, WPI-11 Implemented — a post-Phase-3-closure implementation batch, docs/56/ADR-024/025/026*

Net-new entities named by Phase 3's architecture-freeze pass (docs/49/50, 2026-07-16).
Doctor (§1.4), Appointment (§4.1), and Notification (§4.2) were already conceptual and
are promoted in place above rather than restated here. Full field-level detail lives in
docs/50 — this section records only each entity's purpose and relationships, at the
same fidelity the rest of this document uses.

**Updated 2026-07-16** for the WPI-11 implementation batch (post-Phase-3-closure, docs/56,
ADR-024/025/026): this section's own top-level header still read *"Batches WPI-1 through
WPI-9 Implemented, WPI-10 Implemented, WPI-11 Architecture-Frozen (not implemented) — Phase
3 Closed (WPI-12, docs/57)"* — accurate at Phase 3's own closure (docs/57), but stale once
this batch implemented WPI-11's already-frozen architecture. Phase 3 itself
(WHIMS Patient Intelligence Platform, WPI-1 through WPI-10, plus the WPI-12 closeout) remains
closed and frozen except for genuine bug fixes, per docs/57 — this batch does not reopen it;
WPI-11 was always docs/57's own named, disclosed exception ("its slot stays reserved for a
future, separately-approved implementation batch"), and that future batch is this one. No
entity's shape, schema, or shipped behavior beyond this batch's own disclosed WPI-11 addition
changed by this header correction.

**Updated 2026-07-16** for Batch WPI-12 (Closeout, documentation-only, docs/57): this
section's own top-level header still read *"Mostly Designed, Batches WPI-1/WPI-2/WPI-3/
WPI-4/WPI-5/WPI-6/WPI-7 Implemented"* even though WPI-8, WPI-9, and WPI-10 had each
already promoted their own subsections to *Implemented* by this point, and WPI-11 had
already promoted its own to *Designed* (architecture-frozen) — found during this
batch's own repository consistency review (docs/53 §14), the same "keep history,
correct the stale current-status framing" rule docs/48 §5/WPI-7's own consistency
review already applied twice to this same document. No entity's shape, schema, or
shipped behavior changed by this header correction. Phase 3 is now closed (docs/57).

**Updated 2026-07-16** for Batch WPI-8 (implementation): §7.5 (PillFill Order)
promoted from *Designed* to **Implemented** — see that subsection's own status update
for the shipped shape, the dedicated fulfill operation's reuse of
`InventoryTransaction.gs`'s `LockService`-protected dispense and `Notification.gs`'s
`pillfill_order_status` record, and the Doctor Module Registry's fourth real entry,
`pillfill_orders`.

**Updated 2026-07-16** for Batch WPI-7 (implementation): §7.4 (Inventory Item and
Inventory Transaction) promoted from *Designed* to **Implemented** — see that
subsection's own status update for the shipped shape, the platform's first
`LockService` use (docs/54 §7/§18/§19), and the Doctor Module Registry's third real
entry, `inventory`. This same change also corrects three stale section headers left
over from earlier batches — §1.4 (Doctor), §4.1 (Appointment), and §4.2 (Notification)
each still read *Conceptual (gap)* in their own header even though each entity's own
body text already recorded its later promotion to *Designed* and then *Implemented*
(Batches WPI-1, WPI-5, and WPI-6 respectively) — found during this batch's own
repository consistency review (docs/53 §14). No entity's shape, schema, or shipped
behavior changed by any of these three header corrections, the same "keep history,
correct the stale current-status framing" rule docs/48 §5 already applied once to this
same document.

## 7.1 Doctor Identity, Doctor, Doctor Session, Doctor Login Token — *Implemented (Batch WPI-1)*
Structurally parallel to Patient Identity/Patient/Session/LoginTokens (§1.1–1.3),
**never merged with any of them** (ADR-017). `DoctorSession` reuses
`FoundationSession.gs`'s existing signing primitives without modifying that frozen
file — the same pattern `TrustedDevice.gs`'s Long-Lived Session already proved out.
Cross-identity-type authorization confusion is structurally prevented, not just
asserted — proven directly by conformance Stage 17 (see `shared/schemas/
doctor-session.md`'s dedicated security review). **Relationships:** Every doctor-owned
Phase 2B entity's `created_by`/`prescribed_by`/`resolved_by` field gains a real
`doctor_id` to reference once each is individually migrated onto it (a future batch,
not WPI-1) — alongside, not replacing, today's free-text values. **Full detail:**
docs/50 §5; shipped shape: `shared/schemas/doctor-identity.schema.json`,
`doctor-session.schema.json`, `doctor-login-token.schema.json`.

## 7.2 Specialty — *Implemented (Batch WPI-2)*
A config-level list of specialty descriptors (`specialty_slug`, `display_name`,
`status`), seeded with exactly one entry — the platform's current, implicit specialty
(homeopathy), named explicitly for the first time (ADR-018). Every registry (Module,
Calculator, Template, Doctor Module) is *designed* to gain an optional
`specialty_scope` field (ADR-018); absent, an entry behaves exactly as it does today —
this batch does not add a populated `specialty_scope` entry to Module Registry,
Calculator Registry, or Template Registry, since none has a second specialty's entry to
scope yet (docs/53 §4: each registry adopts the field independently, at whichever
future batch first needs it for that specific registry). **Relationships:** A Doctor's
specialty is `Doctor.specialty_slug` (§7.1) directly, still unvalidated against this
registry (a disclosed, deferred wiring decision — `apps-script/DoctorIdentity.gs` is a
frozen WPI-1 file, untouched by this batch); a Patient's effective specialty is derived
from their active Doctor Assigned Condition(s) (§6.2) via the new, additive
Condition-to-Specialty Map (`shared/constants/condition-specialty-map.json`) — not a
change to that entity's own schema, and not yet consumed by any patient- or
doctor-facing route (infrastructure for a future batch, docs/50 §7.4). **Full detail:**
docs/50 §6; shipped shape: `shared/constants/specialty-registry.json`,
`shared/constants/condition-specialty-map.json`, `apps-script/SpecialtyRegistry.gs`.

## 7.3 Doctor Module Registry and Doctor Module State — *Implemented (Batch WPI-3 backend, Batch WPI-4 frontend consumer + first real entry)*
Structurally parallel to Module Registry/Patient Module State (§6.3), but a separate
registry — patient-facing and doctor-facing capabilities are never exposed through one
shared mechanism (ADR-020). **Ships empty at Batch WPI-3** (docs/50 §7.1's own "not a
batch commitment" framing) — the same disclosed "mechanism before any concrete
instance" precedent `shared/constants/calculator-registry.json` already established.
`DoctorModuleState`'s fail-closed absence-of-row default and one read-only route
(`get_doctor_module_states`, `doctor_id` derived only from a verified `DoctorSession`)
mirror `PatientModuleState`'s exact WPI-1-era precedent. **Relationships:** Governs
whether a doctor sees patient-roster, condition-assignment, care-plan-authoring,
module/calculator/template-enablement, inventory, or analytics capabilities, once each
is registered by its own WPI batch. Patient roster is **derived** from Doctor Assigned
Condition + specialty (§7.2), not a new stored entity — disclosed limitation at
multi-doctor-per-specialty scale, docs/50 §7.4. **Full detail:** docs/50 §7; shipped
shape: `shared/constants/doctor-module-registry.json`,
`shared/schemas/doctor-module-state.schema.json`;
`apps-script/DoctorModuleRegistry.gs`, `apps-script/DoctorModuleState.gs`.

**Status update (2026-07-16, Batch WPI-4): registry-driven Doctor Dashboard shipped,
plus this registry's first real entry.** A new, authenticated, doctor-facing page
(`doctor-dashboard/index.html` + `dashboard.js`) is now a registry-driven consumer of
this subsection's Doctor Module Registry plus `DoctorModuleState` — structurally
parallel to `my-health-journey/dashboard.js`'s own post-PXP-4 discipline: every card
that renders corresponds to a registry entry the doctor is enabled for
(`enabled === true`); `renderDashboard()` contains no hardcoded knowledge of any
specific `capability_key`. This batch registers the registry's first real entry,
`patient_roster` (`shared/constants/doctor-module-registry.json` version bumped
1.0.0 → 1.1.0), implementing docs/50 §7.4's derived patient roster: a new,
read-only, `DoctorSession`-authenticated route (`get_doctor_patient_roster`,
`apps-script/DoctorPatientRoster.gs`) returns every distinct patient with at least one
active Doctor Assigned Condition (§6.2) whose `condition_slug` maps (via the
Condition-to-Specialty Map, §7.2) to the doctor's own `specialty_slug` (or the
implicit default specialty, if none is set). No new stored entity — the roster is a
derived view exactly as docs/50 §7.4 designed, unaffected by this batch's disclosed
multi-doctor-per-specialty limitation. **Disclosed, additive prerequisite beyond
docs/50 §19's literal WPI-4 scope:** reaching an authenticated Doctor Dashboard
requires a doctor-facing login flow, which no batch (WPI-1 through WPI-3) built a
frontend for (WPI-1 shipped only the backend routes, `request_doctor_login_link`/
`consume_doctor_login_link`, explicitly with "zero doctor-facing frontend page").
This batch adds `doctor-login.html`/`doctor-verify.html` (root, `noindex`, mirroring
`login.html`/`verify.html` exactly, minus the Trusted Device mechanism, which has no
doctor-side equivalent) as the minimal, necessary path to the dashboard this batch
itself introduces — the same kind of implementation-time plumbing decision docs/50 §8
already left open for Appointment's own intake mechanism, disclosed here rather than
silently assumed. Zero modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1..3 file — `my-health-journey/` is completely untouched.

## 7.4 Inventory Item and Inventory Transaction — *Implemented (Batch WPI-7)*
`InventoryItem` (stock-keeping record) plus an append-only `InventoryTransaction`
ledger — mirroring Care Plan's (§3.4) own append-only-versioning discipline rather
than mutating a running total in place. `quantity_on_hand` is a derived/cached value,
never the sole source of truth. **Relationships:** A `dispense` transaction is created
when a PillFill Order (§7.5) is fulfilled; crossing `reorder_threshold` produces an
`inventory_low_stock` Notification (§4.2). **Full detail:** docs/50 §10.

**Status update (2026-07-16, Batch WPI-7): Implemented.** Gated on
docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md closing the Sheets-at-production-scale
pre-condition docs/49 §7/docs/51 Part 3 item 1 named specifically for this batch.
`apps-script/InventoryItem.gs`/`shared/schemas/inventory-item.schema.json` and
`apps-script/InventoryTransaction.gs`/`shared/schemas/
inventory-transaction.schema.json` ship exactly as docs/50 §10 designed:
`quantity_on_hand` is never accepted from a create/update request (always `0` at
creation) and is recomputed in full from the ledger's own `change_qty` rows every time
a transaction is recorded — never a cached-value-plus-delta update — the same
recovery-strategy discipline docs/54 §13 names. **The platform's first use of
`LockService`** (docs/54 §7/§18/§19's required mitigation) wraps
`foundationRecordInventoryTransaction_()`'s entire append-then-recompute-then-cache-
write sequence; a contended lock returns a new, expected `FOUNDATION_LOCK_UNAVAILABLE`
envelope and performs no write at all, never a silent, unsynchronized race — additive
only, zero change to `FoundationDataStore.gs` or any other frozen file.
`InventoryTransaction.gs` is strictly append-only, with no `updateById`/patch call
anywhere in its own implementation targeting its own ledger sheet (docs/54 §19).
Doctor/staff-owned, never patient-facing — every write (create, retire,
threshold-update, and every stock-movement transaction) is a manually-run Apps Script
editor function, mirroring `Appointment.gs`'s/`CarePlan.gs`'s precedent exactly, a
deliberate continuation (not a departure) of every prior WPI batch's "doctor/staff-owned
entity writes stay manually-run" discipline even though a real `DoctorSession` already
exists. The one doctor-facing surface this batch adds is a read-only route
(`get_inventory_items`), doctor_id always `DoctorSession`-derived, returning the
caller's own specialty-scoped, active `InventoryItem` list enriched with a computed
`low_stock` boolean — registered as the Doctor Module Registry's third real entry,
`inventory` (`shared/constants/doctor-module-registry.json` version 1.2.0 → 1.3.0,
`display_order: 30`), rendering one new, read-only Doctor Dashboard card. Crossing
`reorder_threshold` records an `inventory_low_stock` Notification via `Notification.gs`'s
own existing, unmodified mechanism (WPI-6) — a new call site adopting an
already-designed extension point, zero lines changed in `Notification.gs` itself;
`doctor_id` is set to the transaction's own `created_by`, and no real email transport is
built for this alert in this batch (a disclosed, minimal choice, `shared/schemas/
inventory-transaction.md`'s own "Low-stock Notification" section). Zero modification to
any frozen Foundation/Identity & Access/Patient Access/PXP-1..11/WPI-1..6 file.

## 7.5 PillFill Order — *Implemented (Batch WPI-8)*
Connects a `medicine`-type Doctor Instruction (§2.3's own "Prescription is a
`medicine`-type Doctor Instruction" mapping) to fulfillment. **Relationships:**
Belongs to one Doctor Instruction and one Patient Identity; fulfillment draws down one
Inventory Item (§7.4) and produces a `pillfill_order_status` Notification (§4.2). No
external vendor API contract is designed — this entity is the platform's own internal
order-and-fulfillment record only. **Full detail:** docs/50 §11.

**Status update (2026-07-16, Batch WPI-8): Implemented.**
`apps-script/PillFillOrder.gs`/`shared/schemas/pillfill-order.schema.json` ship exactly
as docs/50 §11 designed, plus one disclosed, additive `created_by` provenance field
mirroring `appointment.schema.json`'s/`inventory-item.schema.json`'s own precedent.
Doctor/staff-owned, never patient-facing — every write (create, the dedicated fulfill
operation, and every other status transition) is a manually-run Apps Script editor
function, mirroring `Appointment.gs`'s/`InventoryItem.gs`'s own precedent exactly. The
dedicated fulfill operation (`foundationFulfillPillFillOrder_()`) is the one operation
with side effects: it reuses `InventoryTransaction.gs`'s existing, unmodified
`foundationRecordInventoryTransaction_()` (reason `dispense`) — the first real,
non-manual trigger for that function's `LockService` critical section (docs/54 §7/§17's
own "the concrete trigger for this becoming real, not just theoretical") — and
`Notification.gs`'s existing, unmodified `foundationRecordNotification_()` (type
`pillfill_order_status`), reusing both mechanisms rather than inventing parallel ones.
If the InventoryTransaction call fails for any reason, including a contended lock, the
order's own status is never touched — no partial fulfillment, proven directly by
`validation/phase-2a-foundation/conformance.js`'s new Stage 24 (a genuine, external-lock-
contention test mirroring Stage 23's own discipline). Once fulfilled, an order can no
longer be cancelled — a disclosed boundary, docs/50 §11 designs no reversal mechanism.
`PillFillOrder` carries no `specialty_slug` of its own; the one doctor-facing surface
this batch adds is a read-only route (`get_pillfill_orders`, `doctor_id` always
`DoctorSession`-derived), returning the caller's own PillFill Orders, specialty-scoped
by joining each order to its own referenced `InventoryItem` (mirroring
`InventoryItem`'s own specialty filter) — registered as the Doctor Module Registry's
fourth real entry, `pillfill_orders` (`shared/constants/doctor-module-registry.json`
version 1.3.0 → 1.4.0, `display_order: 40`), rendering one new, read-only Doctor
Dashboard card. Zero modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1..7 file (full reasoning: `shared/schemas/pillfill-order.md`).

## 7.6 Analytics — *Implemented (Batch WPI-9, computed view — never a base table)*
Not a stored entity — mirrors Digital Twin's (§3.5) own "computed view, never a base
table" discipline; `apps-script/Analytics.gs` reads across Check-In Response,
Calculator Result, Care Plan, Doctor Assigned Condition (via `DoctorPatientRoster.gs`'s
own derivation, reused, not re-implemented), Inventory Item/Inventory Transaction,
PillFill Order, and Appointment — every entity docs/50 §12 names, and no other.
**Every report is a deterministic aggregation — never an AI-generated interpretation,
prediction, or recommendation**; any future AI-assisted analytics narrative is
independently gated by ADR-001/004/005/019, identically to every other reserved
extension point on the platform. Bounded to a fixed trailing 30-day window, never "all
history" (docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md §18 item 4's own forward
constraint on this batch). Doctor/staff-facing only, never patient-facing; one new,
read-only `FoundationRouter.gs` route (`get_doctor_analytics`), Doctor Module
Registry's fifth real entry, `analytics`. **Full detail:** docs/50 §12.

## 7.7 AI Assistant — *Implemented (Batch WPI-10, docs/55, ADR-021/022/023)*; Holoscan — *Implemented (Batch WPI-11, docs/56, ADR-024/025/026)*
**Status update (2026-07-16, architecture freeze):** AI Assistant's architecture was
frozen — its own separate, feature-specific technical plan (docs/55-WPI-10-AI-ASSISTANT-
ARCHITECTURE-FREEZE.md) and three new ADRs (ADR-021 retrieval boundary, ADR-022
non-persisting-draft doctor-approval boundary, ADR-023 disabled-by-default registry
rollout), fulfilling ADR-019's own "Future Considerations" ask for AI Assistant
specifically.

**Status update (2026-07-16, Batch WPI-10): promoted from Designed to Implemented.**
`AIAssistantInteraction` (`shared/schemas/ai-assistant-interaction.schema.json`,
`apps-script/AIAssistantInteraction.gs`) and the AI Assistant Capability Registry
(`shared/constants/ai-assistant-capability-registry.json`,
`apps-script/AIAssistantContext.gs`, seeded with one entry, `summarize_patient_status` —
a disclosed, implementation-time scope decision docs/55 §11.2/§17 left open) have
shipped, matching docs/55 §4–§18 exactly. `AssistantContextBuilder`
(`apps-script/AIAssistantContext.gs`'s `foundationBuildAiAssistantContext_()`) assembles
a roster- and capability-bounded context strictly from already-stored, structured
platform data, never an unstructured knowledge base (ADR-021) — reusing
`DoctorPatientRoster.gs`'s, `CarePlan.gs`'s, `CheckInResponse.gs`'s,
`CalculatorResult.gs`'s, and `Appointment.gs`'s existing scoped readers, never a direct
Sheet read. `AssistantDriftCheck_()` (`apps-script/AIAssistantDriftCheck.gs`) is the
independent, code-level half of ADR-005's supervision pattern, structurally mirroring
`Ai.gs`'s own `flagDrift_()` without depending on that frozen Phase 1.5 file. Every AI
Assistant output is a non-persisting draft, held only in its own `AIAssistantInteraction`
row until the doctor calls `post_ai_assistant_decision` — recording a decision never
itself writes to any other entity (ADR-022, statically enforced by a new grep-based
static-analysis rule, docs/55 §18 item 1). Three new, additive `FoundationRouter.gs`
dispatch cases (`get_ai_assistant_capabilities`, `post_ai_assistant_query`,
`post_ai_assistant_decision`) are doctor-guarded only; `post_ai_assistant_query` is this
batch's one genuinely new *write* route among every WPI-1..9 doctor-facing route, but the
only Sheet it writes is `AIAssistantInteractions`. One new, additive Doctor Module
Registry entry (`ai_assistant`, `display_order: 60`) — **disabled by default for every
doctor, per ADR-023**, diverging deliberately from every prior entry's lighter-touch
rollout convention; enabling it is a per-doctor, staff/administrative decision, never a
bulk rollout. A per-doctor, per-UTC-day rate limit (`CacheService`, mirroring
`FoundationRateLimit.gs`'s own pattern) bounds real per-call model cost. The "My Health
Journey"-equivalent Doctor Dashboard gains one new, registry-driven card — a capability
picker (never a free-text prompt box, docs/55 §7.1), a roster-patient selector reusing
the existing Patient Roster card's own route, and a draft area whose "AI-generated draft
— not saved" banner always renders above any Accept/Edit/Reject control. AI Assistant's
retrieval remains bounded to the patient's own already-stored structured record only, per
ADR-021, since a real Knowledge Engine (§7.7 note below) does not yet exist. Governed
permanently by ADR-019, still bounded by ADR-001/004/005/013 in full. This entry is the
platform's doctor-facing AI Assistant only (inside the Doctor Dashboard, ADR-020) —
docs/22-WISE-KNOWLEDGE-ENGINE.md's separate, patient-facing "Website AI Assistant"
remains entirely unscoped, unaffected by this update (docs/55 §0.1). Zero modification to
any frozen Foundation/Identity & Access/Patient Access/PXP-1..11/WPI-1..9 file, and zero
modification to Phase 1.5's `Config.gs`/`Ai.gs` — every config/prompt/threshold this batch
needs is its own local, decoupled definition, never a read of a frozen file's own
internals (mirroring `CalculatorResult.gs`'s own "a local constant, not a shared frozen
file" precedent).

Every registry on the platform still carries the same inert AI-compatibility field
docs/44 §7.1/§8.1/§11.5 already established, governed permanently by ADR-019 — this
status update does not populate any of those other reserved fields; it designs one
new, dedicated capability (AI Assistant) instead.

**Status update (2026-07-16, Holoscan architecture freeze, docs/56, ADR-024/025/026):
promoted from named-but-unscoped to *Designed*.** Holoscan's purpose — undefined by any
document since docs/49 §9 first named it, per ADR-019's own "reserve, don't implement"
discipline — has now been supplied by the clinic and is architecturally frozen (not
implemented) as the **Patient Medication Recognition Engine**: a patient photographs
medicines currently being taken; a vision/OCR pipeline extracts a draft medication
candidate per recognized item; a doctor reviews every candidate (approve / correct /
reject) before anything enters the patient's permanent record, mirroring AI Assistant's
own non-persisting-draft discipline (ADR-022, extended by new ADR-025); once on record,
a doctor separately marks a medicine Continue / Stop / Replace / Unknown at any later
time, each an append-only decision. See §7.8 below for the full entity shape. Holoscan
does not read, match against, or write `InventoryItem`/`InventoryTransaction`/
`PillFillOrder` (§7.4/§7.5) — clinic stock management is out of scope; it does not
diagnose, recommend treatment, or check drug interactions (ADR-024); and no real
Medicine Catalog exists to match recognized text against — a disclosed gap mirroring
§5.2's own Knowledge Engine gap, not an invented workaround.

**Status update (2026-07-16, Batch WPI-11): promoted from Designed to Implemented.**
`HoloscanRecognition`/`HoloscanRecognitionItem` (`shared/schemas/holoscan-recognition.schema.json`/
`holoscan-recognition-item.schema.json`, `apps-script/HoloscanRecognition.gs`) and
`MedicationHistory`/`MedicationDecision` (`shared/schemas/medication-history.schema.json`/
`medication-decision.schema.json`, `apps-script/MedicationHistory.gs`) have shipped,
matching docs/56 §4–§23 exactly. The capture pipeline reuses `FoundationReports.gs`'s own
content-based MIME detection and private-Drive-sharing enforcement unmodified (narrowed to
JPEG/PNG only), then makes one bounded, multimodal vision-model call (reusing
`AIAssistantInteraction.gs`'s own `UrlFetchApp`/`OPENROUTER_API_KEY` pattern), then runs
`HoloscanRecognitionCheck_()` (`apps-script/HoloscanRecognitionCheck.gs`) — a
Holoscan-specific, five-category lexicon check, advisory only, structurally mirroring
`AssistantDriftCheck_()` without depending on it. `HoloscanRecognitionItem` is never
automatically promoted to `MedicationHistory` — approving/correcting/rejecting an item
(`post_holoscan_recognition_decision`) patches only that item's own row; the doctor's own,
separate `create_medication_history_entry` action is the only write path into
`MedicationHistory` (ADR-025, statically enforced by a new grep-based static-analysis rule,
docs/56 §23 item 1). `MedicationHistory.current_status` is derived, never client-supplied
— recomputed from the `MedicationDecision` append-only ledger inside a `LockService`
critical section, mirroring `InventoryItem.quantity_on_hand`'s own recompute-from-ledger
discipline exactly (§7.4, WPI-7). `get_medication_history` is this platform's one
dual-guarded route — reachable via either a verified DoctorSession (roster-scoped) or a
verified PatientSession (own record only), each receiving an independently-scoped slice of
the same underlying data. Seven new, additive `FoundationRouter.gs` dispatch cases; one new
Patient Module Registry entry (`holoscan`, normal rollout, ADR-010's existing default) and
two new Doctor Module Registry entries (`holoscan_review`, **disabled by default for every
doctor, per ADR-026**, mirroring `ai_assistant`'s own precedent exactly; `medication_history`,
normal rollout, since displaying an already doctor-confirmed record is not itself a
model-output-review surface). The "My Health Journey" dashboard gains one new,
registry-driven Holoscan card (a multi-photo upload form, never a raw un-reviewed candidate
shown as confirmed) plus a linked, read-only Medication History page
(`my-health-journey/medications/`); the Doctor Dashboard gains two new cards — Holoscan
Review (an always-visible "AI-recognized — not yet in Medication History" banner above any
Approve/Correct/Reject control) and Medication History (Continue/Stop/Replace/Unknown
controls calling `record_medication_decision` only). Zero modification to any frozen
Foundation/Identity & Access/Patient Access/PXP-1..11/WPI-1..10 file, and zero modification
to `InventoryItem.gs`/`InventoryTransaction.gs`/`PillFillOrder.gs`/`AIAssistantInteraction.gs`
— every reused capability is called through its own existing function, never re-implemented
(ADR-009). The Medicine Catalog gap (§0.3/ADR-024) remains open and disclosed —
`catalog_match_status`/`catalog_match_ref` remain reserved, unbacked fields.

## 7.8 Holoscan Entities — *Implemented (Batch WPI-11, docs/56, ADR-024/025/026)*

**`HoloscanRecognition`** — one patient-initiated capture session (one or more uploaded
medicine photographs), processed together. **Purpose:** the durable record of what was
uploaded and the pipeline's own processing status — never itself a clinical fact.
**Relationships:** belongs to one Patient Identity; produces zero or more
`HoloscanRecognitionItem` rows. **Lifecycle:** `uploaded` → `processing` →
`completed` \| `failed`, one-way. **Ownership:** patient-owned at creation (the upload
act), system-owned thereafter — the patient never edits or deletes a submitted
recognition, the same "logged, never edited" discipline Symptom Log (§3.2) already
established. **Full detail:** docs/56 §11.1.

**`HoloscanRecognitionItem`** — one candidate medicine extracted from a
`HoloscanRecognition`'s images — the draft/audit row, structurally mirroring
`AIAssistantInteraction`'s (§7.7) own draft-then-decision shape, applied to a vision-
extraction pipeline instead of a text-generation one. **Purpose:** holds the model's
raw extraction (name, strength, dosage form, manufacturer, batch, expiry — each
independently nullable), a confidence score, reserved-but-unbacked catalog-match
fields (§0.3/docs/56 §8, since no Medicine Catalog exists), and the doctor's own
one-way review decision (`pending` → `approved` \| `corrected_and_approved` \|
`rejected`). **Relationships:** many-per-`HoloscanRecognition`; produces, at most, one
`MedicationHistory` row — created only by the doctor's own separate action, never
automatically (ADR-025, the load-bearing boundary mirroring ADR-022 exactly).
**Ownership:** system-generated (pipeline output); the decision fields are
doctor/roster-owned only — the patient may read, never write, a decision. **Full
detail:** docs/56 §11.2.

**`MedicationHistory`** — the patient's permanent, doctor-authored medication record.
**Purpose:** what a patient is verified, by photographic evidence and doctor review,
to actually be taking — deliberately distinct from `DoctorInstruction`
(type: `medicine`, §2.3), which records what *this clinic* prescribed; the two are not
merged and may honestly diverge (docs/56 §0.2). **Relationships:** belongs to one
Patient; sourced from at most one `HoloscanRecognitionItem` in this freeze's scope
(a reserved, unimplemented `source_type: doctor_manual_entry` is named for a future,
photo-free entry path); has many `MedicationDecision` rows, its own append-only
ledger. **Lifecycle:** created once by a doctor's deliberate write action;
`current_status` (`active` \| `stopped` \| `replaced` \| `unknown`) is the only field
ever recomputed after creation — a pure, derived function of the latest
`MedicationDecision` row, mirroring `InventoryItem.quantity_on_hand`'s own
recompute-from-append-only-ledger discipline exactly (§7.4, WPI-7, docs/54).
**Ownership:** doctor/staff-authored only, patient-viewable, read-only — the same
"doctors decide" boundary `CarePlan`/`DoctorInstruction` already establish. **Full
detail:** docs/56 §11.3.

**`MedicationDecision`** — the append-only ledger of every doctor decision
(Continue / Stop / Replace / Unknown) made against a `MedicationHistory` entry over its
lifetime, mirroring `InventoryTransaction`'s (§7.4) own relationship to
`InventoryItem.quantity_on_hand` precisely, applied to medication status instead of
stock quantity. **Purpose:** the complete audit history the clinic's own brief for this
feature explicitly required, kept as discrete, immutable events rather than a single
mutable status field. **Relationships:** many-per-`MedicationHistory`; many-per-Patient.
**Lifecycle:** N/A — each row is a discrete, permanent event; no update, no delete,
ever, mirroring `InventoryTransaction.gs`'s own explicit append-only discipline
(docs/54 §19). **Ownership:** doctor/staff-owned only, roster-scoped — never
patient-writable. **Full detail:** docs/56 §11.4.

---

# 8. Phase 2C — Health Milestones Entities — *Implemented (Batch PXP-11, docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md, ADR-027)*

> **Placement note (additive, not a phase-ordering claim):** this section follows §7
> (Phase 3) for a purely additive, non-renumbering reason — exactly as §4.1 Appointment
> (a Phase 3 entity) already sits under "Scheduling & Communication" rather than in strict
> phase order. Phase 2C is numerically earlier than Phase 3, but its architecture was
> frozen (and now implemented) later (2026-07-16, after Phase 3 shipped and was closed), on
> the dependency grounds docs/24/docs/58 §1 record.

**Status update (2026-07-16, Batch PXP-11): promoted from Designed to Implemented.**
`MilestoneTrack` (`shared/schemas/milestone-track.schema.json`, `apps-script/MilestoneTrack.gs`)
and `MilestoneReview` (`shared/schemas/milestone-review.schema.json`,
`apps-script/MilestoneReview.gs`) have shipped, matching docs/58 §4–§23 exactly. The milestone
**schedule** is a computed view (`foundationComputeMilestoneSchedule_` in `MilestoneTrack.gs`),
never a stored table — derived on read from the doctor-set `care_start_date`, mirroring
`Analytics.gs`'s own recompute-on-read discipline (§7.6). A `MilestoneReview` is created
`draft` and made patient-visible only by the one-way `publish_milestone_review` transition;
`get_health_milestones` returns published reviews only to a patient, `get_patient_milestones`
returns all reviews including drafts to the roster-scoped doctor. **No AI is used anywhere**
(ADR-027), enforced by a new `validation/static-analysis/analyze.js` Health Milestones static
rule (no `UrlFetchApp`/model call in any `Milestone*.gs`) and proven at runtime by
`conformance.js`'s Stage 28. Five new, additive `FoundationRouter.gs` dispatch cases
(`set_milestone_track`, `get_patient_milestones`, `save_milestone_review`,
`publish_milestone_review`, `get_health_milestones`); one new Patient Module Registry entry
(`health_milestones`, normal rollout) and one new Doctor Module Registry entry
(`milestone_review`, **normal rollout — not disabled-by-default**, since it reviews
doctor-authored content, never model output). The "My Health Journey" dashboard gains one
new, registry-driven Health Milestones card plus a linked, read-only milestones page
(`my-health-journey/milestones/`); the Doctor Dashboard gains one new Milestone Review card
(care-start-anchor control + per-point authoring + an explicit Publish control whose copy
makes the draft-vs-published visibility boundary plain). Zero modification to any frozen
Foundation/Identity & Access/Patient Access/PXP-1..10/WPI-1..12 file — every reused capability
(roster derivation, registry rendering, calendar-date validation) is called through its own
existing function, never re-implemented (ADR-009). **Disclosed implementation-time decisions**
(docs/58 §22): the `due`→`overdue` grace window is 14 days; publish is terminal (no
post-publish edit/version in this batch); `milestone_review`'s read route guards by
session+roster only (like every other normal-rollout doctor entry — backend
`DoctorModuleState` enforcement is reserved for the disabled-by-default AI features);
enablement fail-closes at the dashboard-render layer.

**Feature summary (architecture frozen then implemented the same day, docs/58, ADR-027).**
The long-named-but-unscoped "Health Milestones" (docs/21's "Health Milestone Review,"
docs/23's "Health Milestone Reviews," §3.5's own "the non-AI Health Milestones work (Phase
2C)") is now a shipped feature. Health Milestones is the
**scheduled, non-AI, doctor-authored progress-review feature of "My Health Journey"**: at
four fixed care-start-anchored points — 30 Days, 90 Days, 6 Months, 1 Year (docs/21) — a
doctor authors and publishes a short structured review (progress, improvements, medicines,
investigations, recommendations, next goals) that the patient then sees, read-only and
celebratory. **No AI is used anywhere in this feature** (ADR-027) — that is the defining
boundary docs/24/§3.5 used to separate Phase 2C from Phase 2D (Digital Twin & AI Summaries).
The schedule of the four points is a **deterministic computed view** (never a stored entity,
mirroring Analytics §7.6 and Digital Twin §3.5), derived from a single doctor-set care-start
anchor; a milestone reads `completed` only when a doctor has published its review, never on
elapsed time alone. See docs/58 §4–§23 for the full entity shape, router/registry/dashboard
additions, and validation strategy.

**Disambiguation from `CarePlan.next_review_date` (§3.4):** a Health Milestone is one of four
**fixed, care-start-anchored celebration points**, not `CarePlan`'s single rolling
"when to next see this patient" date. The two are deliberately distinct and carry no
structural reference to one another (docs/58 §0.2) — the identical anti-conflation treatment
§7.7/§7.8 applied to `MedicationHistory` vs. `DoctorInstruction`(type: `medicine`).

## 8.1 `MilestoneTrack` — *Implemented (Batch PXP-11, docs/58 §11.1, ADR-027)*
The per-patient **care-start anchor**: one row per patient, doctor-set, recording the
`care_start_date` the 30/90/180/365-day schedule counts from, plus a `status`
(`active`/`paused`). **Purpose:** to establish the schedule's anchor explicitly rather than
silently overloading a frozen Foundation field (`Patient.created_at` is onboarding, not
clinical care-start; Consultation §2.1 is Conceptual) — docs/58 §0.3. Upsert-style, one
active row per patient, mirroring Patient Profile's (§6.1) own upsert discipline.
**Ownership:** doctor/staff-authored, roster-scoped; the patient never sets or edits it.
**Lifecycle:** created and edited by deliberate doctor upsert (`set_milestone_track`); the
computed schedule always re-dates from the current anchor. **Full detail:** docs/58 §11.1.

## 8.2 `MilestoneReview` — *Implemented (Batch PXP-11, docs/58 §11.2, ADR-027)*
One doctor-authored progress review for one `(patient, milestone_type)` — the six
free-text review dimensions docs/21 names, plus `status` (`draft`/`published`). **Purpose:**
the doctor's own words celebrating and recording progress at a milestone point; entirely
doctor-typed, never AI-generated or auto-inferred (ADR-027). **Ownership:** doctor/staff-authored,
patient-viewable **read-only and only when `published`** — mirrors Care Plan's (§3.4)
"doctor-authored / patient-viewable" ownership exactly. **Lifecycle:** created `draft`
(private to roster doctors), one-way `draft` → `published` transition
(`publish_milestone_review`) as the sole patient-visibility boundary; a published review
makes its milestone point read `completed` in the computed schedule. **Full detail:** docs/58 §11.2.

## 8.3 Milestone Schedule — *Implemented as a computed view — never a base table (Batch PXP-11, docs/58 §7/§11.3, ADR-027)*
Not a stored entity — mirrors Analytics' (§7.6) and Digital Twin's (§3.5) own "computed
view, never a base table" discipline. For a patient with a known `MilestoneTrack.care_start_date`,
a future implementation deterministically derives the four milestone points and each point's
state (`upcoming`/`due`/`completed`/`overdue`) on read, from the anchor + today + whether a
published `MilestoneReview` exists. Stores nothing; therefore cannot drift. **Full detail:**
docs/58 §7.

---

# Summary Table

| Entity | Status | Phase (if any) |
|---|---|---|
| Patient | Implemented | 2A (Foundation F3) |
| Patient Identity | Implemented | 2A (Foundation F3) |
| Session | Implemented | 2A (Foundation F4) |
| Doctor / Doctor Identity / Doctor Session / Doctor Login Token | **Implemented** | 3/WHIMS (docs/50 §5, ADR-017, batch WPI-1 — shipped, staff/administrative-provisioned only, DoctorSession reuses FoundationSession.gs's unmodified signing secret/HMAC primitive, cross-identity-type confusion structurally prevented and directly proven by conformance Stage 17) |
| Consultation | Conceptual | Unassigned |
| Consultation Summary | Implemented | Phase 1.5 |
| Doctor Instruction | **Implemented** | 2B (docs/44 §12, batch PXP-7 — shipped, doctor/staff-owned, aggregated by Care Plan via its stable care_plan_id) |
| AI Summary | Conceptual (pattern) | Instantiated by Phase 1.5, 2D |
| Timeline Event | Implemented | 2A (Batch PA-3, one entry_type) |
| Symptom Log | Implemented, **dashboard entry retired (Batch PXP-10)** | 2A (Batch PA-4) — dashboard entry removed and endpoints deprecated (docs/44 §10.1, §22 batch PXP-10, shipped); `SymptomLogs` rows and their standalone history page remain, schema/Apps Script file unchanged |
| Report | Implemented | 2A (Batch PA-5) |
| Care Plan | **Implemented** | 2B (docs/44 §12, batch PXP-7 — shipped, one evolving plan per patient, append-only versioned, Timeline Event emission deliberately deferred — see §3.4's own status update) |
| Digital Twin | **Designed (computed view — never a base table)** | 2D (docs/59 §6.1, ADR-004/028/029 — architecture frozen; the patient's living health story, a computed read-only aggregation of the patient's own record, AI-narrated and doctor-approved before the patient sees it; never a stored entity) |
| Digital Twin Narrative | **Designed** | 2D (docs/59 §11.1, ADR-028/029 — the Sheet-backed audit/decision/delivery record for one AI narrative (health_story/ai_summary); pending→approved/edited_and_approved/rejected one-way; patient sees only approved published_output; mirrors Consultation Summary's doctor-review gate) |
| Progress Analytics | **Designed (computed view — never a base table)** | 2D (docs/59 §6.3, ADR-004 — a deterministic, non-AI, patient-scoped trend aggregation, the patient-facing counterpart to WPI-9 Analytics; computed on read, no model call, no doctor gate needed) |
| Appointment | **Implemented** | 3/WHIMS (docs/50 §8, batch WPI-5 — shipped, staff/doctor-facing only, nullable patient_id/doctor_id, server-derived specialty_slug, one-way requested→confirmed→completed/cancelled lifecycle, one read-only `get_doctor_appointments` route, Doctor Module Registry's second real entry `appointments`) |
| Notification | **Implemented** | 3/WHIMS (docs/50 §9, batch WPI-6 — shipped, a shared record of what was sent, never a new delivery pipeline; nullable patient_id/doctor_id, disclosed additive recipient_email fallback; system-generated only, zero FoundationRouter.gs dispatch case) |
| Specialty | **Implemented** | 3/WHIMS (docs/50 §6, ADR-018, batch WPI-2 — shipped, seeded with one specialty (homeopathy), plus the additive Condition-to-Specialty Map; no populated `specialty_scope` entry added to Module/Calculator/Template Registry, none needs one yet, docs/53 §4) |
| Doctor Module Registry / Doctor Module State | **Implemented (backend + frontend consumer)** | 3/WHIMS (docs/50 §7, ADR-020, batch WPI-3 backend — shipped, registry ships empty, fail-closed `DoctorModuleState`, one read-only `get_doctor_module_states` route; batch WPI-4 — shipped, registry-driven Doctor Dashboard, first real entry `patient_roster`, docs/50 §7.4; batch WPI-5 — shipped, second real entry `appointments`, docs/50 §8; batch WPI-7 — shipped, third real entry `inventory`, docs/50 §10; batch WPI-8 — shipped, fourth real entry `pillfill_orders`, docs/50 §11; batch WPI-9 — shipped, fifth real entry `analytics`, docs/50 §12) |
| Inventory Item / Inventory Transaction | **Implemented** | 3/WHIMS (docs/50 §10, batch WPI-7 — shipped, quantity_on_hand derived/recomputed from an append-only ledger, the platform's first LockService use per docs/54 §7/§19, Doctor Module Registry's third real entry `inventory`) |
| PillFill Order | **Implemented** | 3/WHIMS (docs/50 §11, batch WPI-8 — shipped, connects a medicine-type Doctor Instruction to fulfillment; the dedicated fulfill operation reuses InventoryTransaction.gs's LockService-protected dispense and Notification.gs's pillfill_order_status record; Doctor Module Registry's fourth real entry, pillfill_orders) |
| Analytics | **Implemented (computed view — never a base table)** | 3/WHIMS (docs/50 §12, batch WPI-9 — shipped, reads across seven existing entities, bounded to a fixed trailing 30-day window, non-AI deterministic aggregation only, Doctor Module Registry's fifth real entry `analytics`) |
| AI Assistant Interaction | **Implemented** | 3/WHIMS (docs/55 §11.1, ADR-021/022, batch WPI-10 — shipped, append-only audit/decision log except one one-way doctor_decision transition; AI Assistant never writes to any other clinical entity, statically enforced) |
| AI Assistant Capability Registry | **Implemented — backend only** | 3/WHIMS (docs/55 §11.2, batch WPI-10 — shipped, structurally parallel to Calculator Registry, seeded with one entry, `summarize_patient_status`; disabled by default per ADR-023, a fixed, bounded menu, never a free-form chat surface) |
| Holoscan Recognition / Holoscan Recognition Item | **Implemented** | 3/WHIMS (docs/56 §11.1/§11.2, ADR-024/025, batch WPI-11 — shipped, the patient-initiated capture session and its draft/audit candidate rows; mirrors AIAssistantInteraction's draft-then-decision shape and Report's Drive file-upload pattern; never automatically writes Medication History, statically enforced) |
| Medication History / Medication Decision | **Implemented** | 3/WHIMS (docs/56 §11.3/§11.4, ADR-024/025, batch WPI-11 — shipped, the permanent, doctor-authored medication record and its own append-only clinical-decision ledger; current_status derived from the ledger, mirroring InventoryItem/InventoryTransaction's recompute-from-ledger discipline, WPI-7/docs/54; deliberately distinct from DoctorInstruction type: medicine, docs/56 §0.2) |
| Milestone Track | **Implemented** | 2C (docs/58 §11.1, ADR-027, batch PXP-11 — shipped, the per-patient doctor-set care-start anchor the 30/90/180/365-day schedule counts from; upsert-style, one active row per patient, mirroring Patient Profile; non-AI, doctor-authored) |
| Milestone Review | **Implemented** | 2C (docs/58 §11.2, ADR-027, batch PXP-11 — shipped, one doctor-authored, patient-viewable-when-published progress review per (patient, milestone_type); six free-text dimensions per docs/21; draft→published one-way, published-only patient visibility server-enforced; no AI, mirrors Care Plan's doctor-authored/patient-viewable ownership) |
| Milestone Schedule | **Implemented (computed view — never a base table)** | 2C (docs/58 §7/§11.3, ADR-027, batch PXP-11 — shipped, the four milestone points and their states derived deterministically on read from the anchor + published reviews; stored nowhere, mirrors Analytics/Digital Twin) |
| Knowledge Article | Conceptual | Unassigned |
| Knowledge Engine | Conceptual (system) | Unassigned |
| Calculator | **Implemented — backend only — Pillar 3** | 2B (docs/44 §8, batch PXP-6, Calculator Registry — shipped, registry seeded empty, no UI; see §6.8). Public variant still unassigned — roadmap gap carried forward (docs/46 Part 3). |
| Patient Profile | **Implemented** | 2B (docs/44 §17, batch PXP-1 — shipped, the platform's first upsert-style entity) |
| Doctor Assigned Condition | **Implemented — Pillar 1** | 2B (docs/44 §6, batch PXP-2 — shipped, doctor/staff-owned; renamed from "Condition Assignment"; Option B (additive) settled and approved) |
| Module Registry / Patient Module State | **Implemented (backend scaffold + frontend consumer) — Pillar 2** | 2B (docs/44 §7, batch PXP-3 backend — shipped; docs/44 §7.3/§13, batch PXP-4 Dashboard Registry frontend consumer — shipped; the patient dashboard now renders every card from `PatientModuleState` × Module Registry, no hardcoded module knowledge in the render path; batch PXP-10 removed the `symptom_tracker` entry — the registry's first removal, docs/44 §10.1/§22) |
| Template Registry | **Implemented** | 2B (docs/44 §11/§11.5, ADR-016, batch PXP-5 — shipped, seeded with one template). Generalizes Check-In Template into a registry pattern; six future categories named, unscoped, unclaimed by any batch. |
| Check-In Template / Check-In Response | **Implemented** | 2B (docs/44 §11/§10, batch PXP-5 — shipped, shipped alongside Symptom Log, never replacing it). Template assignment settled: doctor-driven, patient never configures, enforced server-side via the disclosed additive `CheckInTemplateAssignment` entity. Now the Template Registry's first concrete category (§6.7). |
| Check-In Template Assignment (disclosed, additive gap-fill) | **Implemented** | 2B (docs/44 §10.2, batch PXP-5 — shipped). Fills a gap docs/44 §10.2 settles but names no persisted shape for; an exact structural mirror of Doctor Assigned Condition (§6.2). |
| Trusted Device | **Implemented** | 2B (docs/44 §5, ADR-015, batch PXP-8 — shipped, patient-owned, no manually-run editor counterpart) |
| Long-Lived Session | **Implemented** | 2B (docs/44 §5, ADR-015, batch PXP-8 — shipped as an additive wrapper around `FoundationSession.gs`'s own unmodified primitives; the extended access window issued when a Trusted Device is presented; not a stored entity of its own, a parameterization of the existing Session mechanism) |
| Patient Credential (optional, convenience-only) | Designed, not yet implemented | 2B (docs/44 §5, ADR-015 governing (ADR-011/ADR-014 superseded) — PIN sub-batch remains explicitly out of scope for PXP-8, still requires its own dedicated security review first, docs/45 Part 3/Part 5) |

Every "Unassigned" row above is carried into docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md
as a reported gap, not silently resolved by assigning it a phase here.
