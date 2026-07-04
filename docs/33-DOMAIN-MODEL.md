# 33 - Domain Model
## Version 1.0 — 2026-07-02

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

## 2.3 Doctor Instruction — *Conceptual*

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

## 3.4 Care Plan — *Conceptual*

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

## 5.3 Calculator — *Conceptual (gap)*

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
| Doctor Instruction | Conceptual | Depends on Care Plan (2B) |
| AI Summary | Conceptual (pattern) | Instantiated by Phase 1.5, 2D |
| Timeline Event | Implemented | 2A (Batch PA-3, one entry_type) |
| Symptom Log | Implemented | 2A (Batch PA-4) |
| Report | Implemented | 2A (Batch PA-5) |
| Care Plan | Conceptual | Recommended 2B |
| Digital Twin | Conceptual (view) | Recommended 2D |
| Appointment | Conceptual (gap) | Unassigned |
| Notification | Conceptual (gap) | Unassigned |
| Knowledge Article | Conceptual | Unassigned |
| Knowledge Engine | Conceptual (system) | Unassigned |
| Calculator | Conceptual (gap) | Unassigned — roadmap omission |

Every "Unassigned" row above is carried into docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md
as a reported gap, not silently resolved by assigning it a phase here.
