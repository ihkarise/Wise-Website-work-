# 33 - Domain Model
## Version 1.9 — 2026-07-12

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

## 1.4 Doctor — *Conceptual (gap)*

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
vs. a front-desk staff member) matter — plausibly Phase 3 (WiseOS) territory, per
docs/24, but flagged here since it's a real gap, not a hypothetical one. See
docs/34 for this as a reported finding.

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

## 2.3 Doctor Instruction — *Designed, not yet implemented (Phase 2B, docs/44 §12)*

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

## 3.2 Symptom Log — *Implemented (Batch PA-4)*

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

## 3.4 Care Plan — *Designed, not yet implemented (Phase 2B, docs/44 §12)*

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

---

## 3.5 Digital Twin — *Conceptual (computed view)*

**Purpose:** The patient's "living health story" (docs/21) — never a stored entity of
its own, always a computed, read-only view aggregating Timeline Event, Consultation
Summary, Symptom Log, Report, and (once it exists) Care Plan data into one narrative.
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
separated from the non-AI Health Milestones work (Phase 2C) because of its materially
higher AI-safety requirements.

---

# 4. Scheduling & Communication

## 4.1 Appointment — *Conceptual (gap)*

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

---

## 4.2 Notification — *Conceptual (gap)*

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

## 5.3 Calculator — *Designed, not yet implemented — Patient variant only (Phase 2B, docs/44 §8)*

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
forward as a still-open gap. Not yet implemented — see docs/44 §22's `PXP-6` batch.

---

# 6. Phase 2B Entities — *Designed, not yet implemented (docs/44-PHASE-2B-TECHNICAL-PLAN.md, Version 4.0)*

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

## 6.4 Calculator Registry, Calculator Definition, and Calculator Result — *Pillar 3*
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

---

# Summary Table

| Entity | Status | Phase (if any) |
|---|---|---|
| Patient | Implemented | 2A (Foundation F3) |
| Patient Identity | Implemented | 2A (Foundation F3) |
| Session | Implemented | 2A (Foundation F4) |
| Doctor | Conceptual (gap) | Unassigned |
| Consultation | Conceptual | Unassigned |
| Consultation Summary | Implemented | Phase 1.5 |
| Doctor Instruction | Designed, not yet implemented | 2B (docs/44 §12, batch PXP-7) |
| AI Summary | Conceptual (pattern) | Instantiated by Phase 1.5, 2D |
| Timeline Event | Implemented | 2A (Batch PA-3, one entry_type) |
| Symptom Log | Implemented | 2A (Batch PA-4) — Phase 2B coexists with, later retires (docs/44 §10.1, §22 batch PXP-10) |
| Report | Implemented | 2A (Batch PA-5) |
| Care Plan | Designed, not yet implemented | 2B (docs/44 §12, batch PXP-7) |
| Digital Twin | Conceptual (view) | Recommended 2D — future consumer of Timeline, Reports, Check-ins, Care Plans, Calculators (docs/44 §16), not tightly coupled to Phase 2B |
| Appointment | Conceptual (gap) | Unassigned |
| Notification | Conceptual (gap) | Unassigned |
| Knowledge Article | Conceptual | Unassigned |
| Knowledge Engine | Conceptual (system) | Unassigned |
| Calculator | Designed, not yet implemented — Patient variant only — **Pillar 3** | 2B (docs/44 §8, batch PXP-6, Calculator Registry). Public variant still unassigned — roadmap gap carried forward (docs/46 Part 3). |
| Patient Profile | **Implemented** | 2B (docs/44 §17, batch PXP-1 — shipped, the platform's first upsert-style entity) |
| Doctor Assigned Condition | **Implemented — Pillar 1** | 2B (docs/44 §6, batch PXP-2 — shipped, doctor/staff-owned; renamed from "Condition Assignment"; Option B (additive) settled and approved) |
| Module Registry / Patient Module State | **Implemented (backend scaffold + frontend consumer) — Pillar 2** | 2B (docs/44 §7, batch PXP-3 backend — shipped; docs/44 §7.3/§13, batch PXP-4 Dashboard Registry frontend consumer — shipped; the patient dashboard now renders every card from `PatientModuleState` × Module Registry, no hardcoded module knowledge in the render path) |
| Template Registry | **Implemented** | 2B (docs/44 §11/§11.5, ADR-016, batch PXP-5 — shipped, seeded with one template). Generalizes Check-In Template into a registry pattern; six future categories named, unscoped, unclaimed by any batch. |
| Check-In Template / Check-In Response | **Implemented** | 2B (docs/44 §11/§10, batch PXP-5 — shipped, shipped alongside Symptom Log, never replacing it). Template assignment settled: doctor-driven, patient never configures, enforced server-side via the disclosed additive `CheckInTemplateAssignment` entity. Now the Template Registry's first concrete category (§6.7). |
| Check-In Template Assignment (disclosed, additive gap-fill) | **Implemented** | 2B (docs/44 §10.2, batch PXP-5 — shipped). Fills a gap docs/44 §10.2 settles but names no persisted shape for; an exact structural mirror of Doctor Assigned Condition (§6.2). |
| Trusted Device | Designed, not yet implemented | 2B (docs/44 §5, ADR-015, batch PXP-8) |
| Long-Lived Session | Designed, not yet implemented (new in Version 3.0) | 2B (docs/44 §5, ADR-015, batch PXP-8) — the extended access window issued when a Trusted Device is presented; not a stored entity of its own, a parameterization of the existing Session mechanism |
| Patient Credential (optional, convenience-only) | Designed, not yet implemented | 2B (docs/44 §5, ADR-015 governing (ADR-011/ADR-014 superseded), batch PXP-8 — PIN sub-batch requires dedicated security review first, docs/45 Part 3) |

Every "Unassigned" row above is carried into docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md
as a reported gap, not silently resolved by assigning it a phase here.
