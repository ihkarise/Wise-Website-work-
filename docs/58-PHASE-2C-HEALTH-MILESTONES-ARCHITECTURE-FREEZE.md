# 58 - Phase 2C Health Milestones Architecture Freeze
## Version 1.0 — 2026-07-16

> Architecture freeze only. No code, no schema file, no registry entry, no router case,
> no dashboard card, no Apps Script file, no frontend file is touched by this document.
> Phase 2C ("Health Milestones") has been named, but never scoped, since docs/24-ROADMAP.md
> first listed it and docs/32/docs/48 §1/§7 carried it forward as *"fully open, unscoped…
> each still requires its own separate architecture-freeze pass whenever next taken up"*
> (docs/24, Phase 2C/2D block). **This is that architecture-freeze pass**, authorized
> explicitly and separately, and scoped to Health Milestones only. It is the direct
> structural analogue of docs/55 (AI Assistant) and docs/56 (Holoscan) — a single,
> self-contained, feature-scoped freeze — adapted for a **non-AI, patient-facing** feature
> instead of an AI-output one. Every prior document that named Health Milestones
> (docs/21-WISE-PRODUCT-VISION.md's "Health Milestone Review," docs/23-PATIENT-LIFECYCLE.md's
> "Health Milestone Reviews," docs/33 §3.5's own "the non-AI Health Milestones work (Phase
> 2C)") is honored, not reopened, edited, or contradicted here; this document is additive to
> all of them. Phase 2A, Phase 2B, and Phase 3 (WPI-1 through WPI-12, including the WPI-11
> Holoscan implementation) all remain exactly as shipped and **frozen except for genuine
> bug fixes** (docs/43 §12, docs/48 §9, docs/57); nothing in this freeze depends on, or
> changes, any of them beyond reading their already-shipped, already-authenticated data and
> reusing their already-proven patterns.

---

# Version History

## v1.1 (2026-07-16) — Implementation note (this freeze remains the authoritative architecture; not re-opened)
- Batch PXP-11 implemented this architecture exactly as frozen (docs/33 §8's own
  Designed→Implemented status update records the shipped surface). This document is
  **not** re-opened or amended — it remains the authoritative architecture; this entry only
  records that implementation happened and lists the implementation-time decisions §22
  deliberately left open, now resolved:
  - **Grace window (§7/§22):** a milestone point reads `due` for **14 days** after its target
    date, then `overdue` (`FOUNDATION_MILESTONE_DUE_GRACE_DAYS_`).
  - **Post-publish correction (§10.3/§22):** publish is **terminal** in this batch — a
    published review's content is frozen (no edit, no versioning); a future batch may add a
    correction discipline under its own decision.
  - **`milestone_review` enforcement (§14/§18.2):** as a **normal-rollout** doctor entry, its
    read route (`get_patient_milestones`) guards by **session + roster only**, exactly like
    every other normal doctor entry (appointments/inventory/analytics/medication_history) —
    backend `DoctorModuleState` enforcement is reserved for the disabled-by-default AI
    features (ai_assistant/holoscan_review); fail-closed enablement for a normal entry is a
    dashboard-render concern (the card does not render when the state is absent/disabled),
    proven by the batch's browser suite. This is a clarification of §20's generic wording, not
    an architecture change.
  - **Batch name:** **PXP-11** — Phase 2C's first (and, as scoped, only) implementation batch,
    continuing the `PXP-` "Patient Experience Platform" batch sequence from Phase 2B (which
    ended at PXP-10).
  - **Page path (§19.1):** `my-health-journey/milestones/`.

## v1.0 (2026-07-16)
- Initial Phase 2C Health Milestones Architecture Freeze.

---

# 0. Framing

## 0.1 What Health Milestones is

**Health Milestones is the scheduled progress-review feature of "My Health Journey."** At
four fixed points in a patient's care journey — **30 Days, 90 Days, 6 Months, and 1 Year**
(docs/21's "Health Milestone Review," docs/24's Phase 2C scope) — a doctor authors a short,
structured **progress review** for that patient: how they are progressing, what has
improved, the current medicine picture, any investigations, the doctor's recommendations,
and the next goals (the exact six review dimensions docs/21 names). When the doctor
**publishes** a review, it appears — read-only and celebratory — on the patient's own "My
Health Journey," reinforcing docs/21's North Star: *"We don't want people to remain
patients. We want them to recover, leave treatment, and still stay connected with us."* The
schedule of the four milestone points is computed deterministically from a single, doctor-set
**care-start anchor date**; the review content is entirely doctor-authored. The doctor
remains the final authority at every step — this is the identical "doctors decide, patients
view" ownership boundary (docs/30 §2) that `CarePlan`/`DoctorInstruction` already establish,
applied here to a time-anchored progress review.

## 0.2 What Health Milestones is not, and does not touch

- **Not an AI feature.** Health Milestones generates **no** AI content, makes **no** model
  call, and produces **no** auto-written narrative of any kind (ADR-027, §5). This is the
  defining boundary of Phase 2C and the entire reason docs/24/docs/33 §3.5 deliberately
  separated it from Phase 2D (Digital Twin & AI Summaries): the Digital Twin's
  AI-narrated health story carries a materially higher AI-safety requirement (the full
  ADR-001/004/005 gate) that Health Milestones, being doctor-typed content, simply does not
  incur. A review is the doctor's own words, exactly as a `CarePlan`'s `goals` field is.
- **Not the Digital Twin (Phase 2D).** Health Milestones is not the "living health story"
  computed view of docs/21/docs/33 §3.5. A published milestone review is a natural future
  *input* to the Digital Twin's own computed narrative (§12.4), named here, not built.
- **Not a redefinition of `CarePlan.next_review_date`.** `CarePlan` (docs/33 §3.4) already
  carries a doctor-set `next_review_date` — the single, rolling "when should this patient
  next be seen" date the doctor updates after each follow-up. A Health Milestone is a
  different concept: one of four **fixed, care-start-anchored celebration points** (30/90/180/365
  days), not a rolling next-visit date. The two are deliberately not merged and carry no
  structural reference to one another in this freeze — a doctor may of course schedule a
  follow-up (`CarePlan.next_review_date`) to coincide with a milestone, but that is a manual,
  judgment-based act, not an automatic coupling. This mirrors docs/56 §0.2's own explicit
  disambiguation of `MedicationHistory` from `DoctorInstruction`(type: `medicine`), named
  here for the identical anti-conflation reason.
- **Not a scheduling/reminder engine.** Health Milestones computes *which* milestone points
  are due and *when* (§7), but it does not itself send reminders, emails, or push
  notifications. A milestone becoming due is a natural future `Notification` (WPI-6) source
  (§12.2), named, not built — Health Milestones introduces no new delivery pipeline, exactly
  as WPI-6 established that no feature does.
- **Not patient-authored.** The patient never sets the care-start anchor, never writes a
  review, and never changes a milestone's status — the identical "doctors decide, patients
  view" boundary every doctor-authored, patient-viewable entity on this platform already
  respects (§10).

## 0.3 The care-start anchor, named up front

The 30/90/180/365-day schedule requires a single anchor date to count from. **No existing
entity carries an authoritative "treatment start" date today.** `Patient.created_at` (docs/33
§1.1) records staff onboarding, not necessarily the clinical start of care; `Consultation`
(docs/33 §2.1) — the real-world encounter that would most honestly anchor "care start" —
remains *Conceptual*, unbuilt. Rather than silently overload `Patient.created_at` (a frozen
Foundation field) with a clinical meaning it was never defined to carry, this freeze
introduces one small, explicit, **doctor-set** anchor entity, `MilestoneTrack` (§11.1),
whose single job is to record the `care_start_date` the doctor deliberately chooses for a
patient — defaulting to nothing, requiring a doctor's own act to establish. From that one
anchor the entire schedule is a pure, deterministic computation (§7). This is the identical
honest-gap discipline docs/55 §0.2 (Knowledge Engine) and docs/56 §0.3 (Medicine Catalog)
already applied: name the missing anchor plainly and introduce the minimum real thing needed,
rather than improvise a meaning onto a frozen field.

---

# 1. Scope Decision

Following docs/49 §1's dependency-order test (repeated verbatim by docs/55 §1 and docs/56
§1): Health Milestones' architecture depends on Patient Identity/Session (Foundation), Doctor
Identity & Session (WPI-1), the Doctor Dashboard registry-driven pattern (ADR-020), the
Patient Module Registry/Patient Dashboard pattern (ADR-012, PXP-3/PXP-4), `DoctorPatientRoster.gs`'s
own derived roster (WPI-4), and the doctor-authored/patient-viewable ownership pattern
`CarePlan`/`DoctorInstruction` (PXP-7) already proved — **all shipped and frozen.** It does
**not** depend on the Digital Twin (Phase 2D), any AI capability (WPI-10/WPI-11), a Knowledge
Engine, or a Medicine Catalog — each of those remains exactly as open and unscoped as before.
This freeze may proceed on dependency grounds alone, the identical test WPI-10's and WPI-11's
own freezes already passed. Phase 2C was reordered *behind* Phase 3 on dependency grounds
(docs/49 §1: Phase 3 needed no part of Health Milestones first); that reordering is now
spent, and Phase 2C is taken up next with every dependency it needs already in place.

---

# 2. Dependency Confirmation

| Dependency | Status |
|---|---|
| Patient Identity & Session (Foundation) | Implemented, frozen |
| Doctor Identity & Session (WPI-1) | Implemented, frozen |
| Doctor Patient Roster derivation (`DoctorPatientRoster.gs`, WPI-4) | Implemented, frozen |
| Doctor Module Registry / Doctor Dashboard (WPI-3/WPI-4) | Implemented, frozen |
| Patient Module Registry / Patient Dashboard (PXP-3/PXP-4) | Implemented, frozen |
| Doctor-authored/patient-viewable ownership pattern (`CarePlan`/`DoctorInstruction`, PXP-7) | Implemented, frozen — reused as a structural template, not depended on functionally |
| Computed-view discipline (`Analytics`, WPI-9; `Digital Twin`, docs/33 §3.5) | Implemented/established — reused directly for the Milestone Schedule (§7) |
| Notification (WPI-6) | Implemented, frozen — a **future**, named, unbuilt consumer only (§12.2) |
| Timeline Event / ConsultationHistory (PA-3) | Implemented, frozen — a **future**, named, deferred consumer only (§12.1) |
| Consultation (docs/33 §2.1) | **Conceptual, unbuilt** — the reason the care-start anchor is introduced explicitly rather than derived (§0.3) |
| Any AI capability (WPI-10 AI Assistant, WPI-11 Holoscan) | **Not read, not called, not depended on** — Phase 2C is non-AI by definition (§0.2/ADR-027) |

No gap blocks the architecture work in this document.

---

# 3. Governing ADRs

- **ADR-002** (Patient Identity independent of authentication) — every milestone entity
  references `patient_id`, never a credential; §11.
- **ADR-004** (Digital Twin never diagnoses/treats) — a milestone review is doctor-authored
  progress commentary, never a diagnosis or treatment directive; §5/§10.
- **ADR-005** (AI always under doctor supervision) — reaffirmed by **absence**: because
  Health Milestones uses no AI at all, ADR-005's three-part gate is simply never entered.
  ADR-027 records the boundary that keeps it that way (§5).
- **ADR-006** (Sheets as implementation detail) — governs §11's future schema shape (flat
  columns, stable UUID `record_id`, no per-patient tabs).
- **ADR-009** (modules independently replaceable/testable) — every reused capability
  (roster derivation, registry rendering) is called through its own existing function, never
  re-implemented; §13.
- **ADR-010** (security before convenience / fail-closed) — governs §14/§18.
- **ADR-012** (Patient dashboard registry-driven) — governs the patient-facing
  `health_milestones` Module Registry entry, §18.
- **ADR-020** (Doctor Dashboard registry-driven) — governs the doctor-facing
  `milestone_review` Doctor Module Registry entry, §18.
- **ADR-027** (new) — Health Milestones are doctor-authored reviews on a deterministically
  computed schedule, never AI-generated or auto-inferred (§5, §7, §10).

No existing Accepted ADR is amended, widened, or reinterpreted by this document. ADR-027 is a
new, complementary record (ADR-007's "supersede, never silently edit" discipline).

---

# 4. Component Diagram

```
Doctor Session (WPI-1, frozen)
      |
      v
Doctor Dashboard -- new card: Milestone Review (§19), registry-driven,
      |  Doctor Module Registry entry: milestone_review (§18), NORMAL rollout
      |  (fail-closed by DoctorModuleState absence, ADR-010; not disabled-by-default
      |  -- it reviews doctor-authored content, never model output, §18.2)
      v
FoundationRouter.gs -- four new doctor-only dispatch cases (§17)
      |
      +--> set_milestone_track          (write, upsert; one MilestoneTrack row per
      |        roster patient -- the doctor-set care_start_date anchor, §11.1)
      |
      +--> get_patient_milestones       (read-only; one roster patient's track +
      |        DETERMINISTICALLY-COMPUTED schedule (§7) + every MilestoneReview,
      |        including drafts -- roster-scoped)
      |
      +--> save_milestone_review        (write; create/update ONE draft
      |        MilestoneReview row for a roster patient + milestone_type, §11.2)
      |
      +--> publish_milestone_review     (write; one-way draft -> published
               transition -- the single act that makes a review patient-visible)

Patient Session (Foundation, frozen)
      |
      v
"My Health Journey" Dashboard -- new card: Health Milestones (§19),
      |  registry-driven, Patient Module Registry entry: health_milestones (§18),
      |  fail-closed by PatientModuleState absence (ADR-012/PXP-3 precedent)
      v
FoundationRouter.gs -- one new patient-only dispatch case (§17)
      |
      +--> get_health_milestones        (read-only; the CALLER'S OWN computed
               schedule (§7) + only PUBLISHED MilestoneReview rows -- own record
               only, patient_id always session-derived, never a draft, never a
               roster-wide view)

Milestone Schedule (§7) -- a COMPUTED VIEW, never a stored entity
      (mirrors Analytics/Digital Twin's own computed-view discipline):
      for a patient with a known MilestoneTrack.care_start_date, deterministically
      derives the four milestone points (30/90/180/365 days) and each point's state
      (upcoming | due | completed | overdue) from care_start_date + today +
      whether a published MilestoneReview exists for that point. Nothing about
      the schedule is stored; it is recomputed on every read.
```

Five distinct dispatch cases total (§17): four reachable only via Doctor Session, one
reachable only via Patient Session. Unlike Holoscan's `get_medication_history`, **no route in
this freeze is dual-guarded** — the patient's read (`get_health_milestones`, own record,
published only) and the doctor's read (`get_patient_milestones`, roster-scoped, includes
drafts) are two separate, independently-scoped routes, the pre-Holoscan norm, deliberately
chosen here over replicating that rare exception.

---

# 5. Non-Goals

Health Milestones, in this freeze and in any future implementation of it, does **not**:

1. Generate, draft, summarize, or narrate any content with AI, or make any model/API call of
   any kind (ADR-027) — every review field is doctor-typed.
2. Auto-write, auto-populate, or infer a review from Symptom Log, Check-In Response,
   Calculator Result, Care Plan, or any other data — the doctor authors every field
   themselves (ADR-027). (A future, separately-approved batch may pre-*display* relevant data
   beside the authoring form as read-only reference, but the review text is always the
   doctor's own; §12.5.)
3. Automatically change a milestone's status based on elapsed time alone beyond the purely
   presentational `upcoming`/`due`/`overdue` computation (§7) — a milestone is `completed`
   only when a doctor has published a review for it, never merely because its date passed.
4. Diagnose, prescribe, or recommend a treatment action (ADR-004) — a review is progress
   commentary and next-goal setting, not a clinical directive; medicines and instructions
   remain `CarePlan`/`DoctorInstruction`'s domain (§0.2).
5. Send any reminder, email, or notification (§0.2/§12.2) — that is a future `Notification`
   consumer's concern, not built here.
6. Redefine, reference, or couple to `CarePlan.next_review_date` (§0.2).
7. Emit a `TimelineEvent` — the same disclosed `entry_type`-enum-widening deferral
   `CarePlan` (PXP-7) and Holoscan (WPI-11) both already made (§12.1).
8. Let a patient set the anchor, author a review, or see an unpublished draft (§10).
9. Implement any code, schema, registry entry, router case, or dashboard card — this document
   is architecture only.
10. Authorize Phase 2C to begin implementation — a separate, explicit approval is still
    required, mirroring docs/53 §9/§13/§15's discipline exactly.
11. Scope Phase 2D (Digital Twin & AI Summaries) or any other phase.

---

# 6. Care-Start Anchor Model

1. A milestone schedule cannot exist for a patient until a doctor establishes the anchor.
   The doctor, from the Milestone Review card (§19.2), sets `MilestoneTrack.care_start_date`
   for a roster patient via `set_milestone_track` (§17) — an **upsert** (one active row per
   patient), mirroring `PatientProfile`'s own one-per-patient upsert discipline (PXP-1,
   docs/33 §6.1) exactly.
2. `care_start_date` is a plain date the doctor chooses (typically the patient's first
   consultation / start of treatment). It is **never** client-supplied by the patient, and
   **never** silently derived from `Patient.created_at` — a doctor's deliberate act
   establishes it (§0.3).
3. Until a `MilestoneTrack` exists, the patient's Health Milestones card renders an honest
   empty/"not yet started" state (§19.1) — never a fabricated schedule counted from an
   assumed date.
4. The anchor is editable by the doctor (a corrected start date is a legitimate clinical
   correction), via the same upsert route; every edit is a deliberate doctor action, and a
   future implementation may retain prior anchor values for audit (an implementation-time
   decision, not fixed here). The four milestone points always recompute from the current
   anchor (§7).

---

# 7. Milestone Schedule (a computed view, never a stored entity)

Per ADR-027 and mirroring `Analytics` (docs/33 §7.6) and `Digital Twin` (docs/33 §3.5)'s own
"computed view, never a base table" discipline exactly:

- The schedule is **not** a stored entity. No row represents "the 30-day milestone" until and
  unless a doctor authors a `MilestoneReview` for it (§11.2). The set of milestone points and
  their target dates is a **pure, deterministic function** of `MilestoneTrack.care_start_date`,
  recomputed on every read of `get_health_milestones`/`get_patient_milestones`.
- The four points are fixed by docs/21: **`30_day`** (`care_start_date` + 30 days),
  **`90_day`** (+ 90 days), **`6_month`** (+ 6 calendar months), **`1_year`** (+ 1 calendar
  year). The `milestone_type` enum is deliberately fixed to exactly these four; any future
  additional milestone point is a separate, disclosed decision, never a silent enum widening
  (mirroring every other bounded enum's reserved-extension discipline on the platform).
- Each point's **derived state** is computed, never stored:
  - `completed` — a **published** `MilestoneReview` exists for this `(patient, milestone_type)`.
  - `due` — no published review yet, and today ≥ the point's target date, within a bounded
    grace window (the exact window is an implementation-time detail, §22).
  - `overdue` — no published review yet, and today is past the target date beyond that window.
  - `upcoming` — no published review yet, and today < the point's target date.
- The state computation is presentational and deterministic only. It **never** itself writes
  anything, **never** creates a review, and **never** marks a point `completed` on time
  elapsing alone — only a doctor's `publish_milestone_review` does that (§5 item 3, ADR-027).
- Because the schedule is computed, changing the anchor (§6) transparently re-dates every
  not-yet-completed point with zero stored-state migration — the same self-consistency
  Analytics' recompute-on-read model already guarantees.

---

# 8. Deterministic vs. AI Responsibility Split

| Concern | Deterministic (code) | AI |
|---|---|---|
| Care-start anchor | Doctor-set `MilestoneTrack.care_start_date` (§6) | **Never — no AI anywhere in this feature** |
| Which milestone points exist and their dates | Pure function of `care_start_date` (§7) | Never |
| A point's `upcoming`/`due`/`overdue`/`completed` state | Deterministically computed on read (§7) | Never |
| Review content (progress, improvements, medicines, investigations, recommendations, next goals) | **Doctor-typed, every field** (§10/§11.2) | Never (ADR-027) |
| Whether a review becomes patient-visible | The doctor, via `publish_milestone_review` (§17) | Never |
| Fail-closed enablement / rollout | Patient/Doctor Module Registry + Module State (ADR-010/012/020) | Never |

The entire right-hand column is empty by design — the single clearest statement of what
Phase 2C is (ADR-027).

---

# 9. (Reserved — no confidence/scoring concept applies)

Unlike Holoscan (docs/56 §9) or AI Assistant, Health Milestones produces no model output and
therefore has **no** confidence score, drift check, or lexicon check of any kind — there is
no AI output to score or check. This section is retained, empty, only to make that absence
explicit against the docs/55/56 template it parallels, so the omission reads as deliberate,
not overlooked.

---

# 10. Doctor Authorship & Patient Visibility Model

Health Milestones has **no** AI-supervision gate to apply (§9), because it has no AI output.
Its governing boundary is the simpler, older one `CarePlan`/`DoctorInstruction` already
establish (docs/30 §2, "doctors decide, patients view"):

## 10.1 Doctor authors every field
Every `MilestoneReview` field (§11.2) is typed by a roster-scoped doctor, `DoctorSession`-derived
`authored_by`. The patient supplies nothing to a review. There is no prompt, no draft-from-model,
no auto-fill (ADR-027, §5 item 2).

## 10.2 Draft is private; publish is the visibility boundary
A `MilestoneReview` is created as `draft` and is visible only to roster-scoped doctors (via
`get_patient_milestones`) until the doctor calls `publish_milestone_review` (§17), a one-way
`draft` → `published` transition. **Only a published review is ever returned to a patient**
(`get_health_milestones`, §17). This mirrors `CarePlan`'s active/superseded version discipline
and the general "patient never sees an unfinished doctor artifact" boundary — here without any
AI dimension, because there is none.

## 10.3 Status transitions are one-way and doctor-driven
`MilestoneReview.status` transitions `draft` → `published` exactly once, one-way, never
reverted (a correction to an already-published review is an implementation-time decision —
either an edit-in-place with an audit note, or a new version row mirroring `CarePlan`'s own
append-only versioning — named here, not fixed, §22). No status is ever set by elapsed time,
a missed date, or any non-doctor signal (§5 item 3, ADR-027).

---

# 11. New Entities (Designed, not Implemented — no schema file exists yet)

## 11.1 `MilestoneTrack` (Sheet-backed entity — the per-patient care-start anchor)

| Field | Type | Notes |
|---|---|---|
| `track_id` | string (UUID) | Server-generated identity column. |
| `patient_id` | string | Roster-validated at write (reuses `DoctorPatientRoster.gs`, never a new derivation). One active row per patient — upsert-style, mirroring `PatientProfile` (docs/33 §6.1). |
| `care_start_date` | string (ISO 8601 date) | The doctor-chosen anchor the schedule (§7) counts from. Never patient-supplied, never silently derived from `Patient.created_at` (§0.3/§6). |
| `status` | string enum | `active` \| `paused`. `paused` lets a doctor stop surfacing a schedule (e.g. a patient on hold) without deleting history; defaults to `active`. |
| `created_by` | string | `doctor_id`, `DoctorSession`-derived — the doctor who set the anchor. |
| `created_at` | string (ISO 8601) | Server-set at first creation. |
| `updated_at` | string, nullable (ISO 8601) | Server-set on each upsert edit of the anchor/status. |

**Ownership:** doctor/staff-authored only; the patient never creates, edits, or pauses a
track — the identical "doctors decide" boundary `CarePlan`/`DoctorInstruction` establish.
Patient-viewable indirectly only (the patient sees the *computed schedule*, §7, not this row
directly).

**Immutability:** `track_id`/`patient_id` immutable after creation; `care_start_date`/`status`
are the only editable fields, each edit a deliberate doctor upsert (§6).

**Security:** `patient_id` roster-validated at write; a doctor may read/write a `MilestoneTrack`
only for a patient in that doctor's own derived roster.

## 11.2 `MilestoneReview` (Sheet-backed entity — one doctor-authored progress review)

| Field | Type | Notes |
|---|---|---|
| `review_id` | string (UUID) | Server-generated identity column. |
| `patient_id` | string | Roster-validated at write. |
| `track_id` | string | References the parent `MilestoneTrack` (§11.1). |
| `milestone_type` | string enum | `30_day` \| `90_day` \| `6_month` \| `1_year` — the fixed four (§7). At most one review per `(patient_id, milestone_type)`. |
| `target_date` | string (ISO 8601 date) | The point's computed target date (§7), denormalized at authoring for an honest audit of what the schedule showed when the doctor wrote the review — recomputed for display, stored here only as a record. |
| `progress_summary` | string | Doctor-typed. The "Progress" dimension (docs/21). |
| `improvements` | string, nullable | Doctor-typed. The "Improvements" dimension. |
| `medicines_review` | string, nullable | Doctor-typed. The "Medicines" dimension — free-text commentary, **not** a structural reference to `DoctorInstruction`/`MedicationHistory` (§0.2). |
| `investigations` | string, nullable | Doctor-typed. The "Investigations" dimension. |
| `recommendations` | string, nullable | Doctor-typed. The "Recommendations" dimension. |
| `next_goals` | string, nullable | Doctor-typed. The "Next goals" dimension. |
| `status` | string enum | `draft` \| `published`. Always `draft` at creation; transitions one-way to `published` exactly once (§10.2/§10.3). |
| `authored_by` | string | `doctor_id`, `DoctorSession`-derived. |
| `created_at` | string (ISO 8601) | Server-set. |
| `updated_at` | string, nullable (ISO 8601) | Server-set on each draft edit. |
| `published_at` | string, nullable (ISO 8601) | Server-set at the moment `status` transitions to `published`. |

**Relationships:** belongs to one Patient and one `MilestoneTrack`; at most one per
`(patient_id, milestone_type)`. A published review makes its milestone point read as
`completed` in the computed schedule (§7).

**Ownership:** doctor/staff-authored only, patient-viewable **read-only and only when
`published`** — mirrors `CarePlan`'s "doctor-authored / patient-viewable" ownership exactly.
The patient never authors, edits, publishes, or deletes a review.

**Immutability:** `patient_id`/`track_id`/`milestone_type`/`created_at` immutable after
creation; review-content fields editable only while `draft`; the `status` → `published`
transition is one-way (§10.3). Post-publish correction discipline is an implementation-time
decision (§22).

**Security:** roster-scoped doctor read/write; session-derived patient read-only of their own
**published** rows.

## 11.3 Milestone Schedule (a computed view — not a stored entity)

Per §7/ADR-027: not a table, has no schema file, and is never written. A future
implementation derives it on read inside `get_health_milestones`/`get_patient_milestones`
from the patient's `MilestoneTrack` and their existing `MilestoneReview` rows — the identical
"computed on read, never stored" shape `Analytics.gs` already ships (docs/33 §7.6). Listed
here as an entity only to be explicit that it is deliberately **not** one.

---

# 12. Integration Points (named only, none built by this freeze)

## 12.1 Patient Timeline
A published `MilestoneReview` is a natural future `TimelineEvent` (`entry_type: milestone`)
source — the identical disclosed, deliberate deferral `CarePlan` (PXP-7, docs/33 §3.4) and
Holoscan (WPI-11, docs/56 §12.1) both already made: widening the frozen, conformance-tested
`consultation-history.schema.json` `entry_type` enum and touching `FoundationConsultationHistory.gs`
is new functionality, not a bug fix, and this freeze makes the same disclosed choice not to
touch that frozen file. A patient's milestones remain fully visible regardless, via their own
dedicated Health Milestones page (§19.1).

## 12.2 Notification (WPI-6)
A milestone reaching `due` is a natural future `Notification` source (e.g. a gentle
"your 90-day review is coming up" prompt, or a doctor-side "3 patients have a due milestone"
digest). This is a future, separately-approved use of `Notification`'s own existing record —
Health Milestones builds **no** delivery pipeline and adds **no** notification code in this
freeze (§0.2/§5 item 5).

## 12.3 Care Plan (PXP-7)
A doctor writing a milestone review will often consult the patient's current `CarePlan`
alongside it — a convenience of workflow, not a structural dependency. No field links
`MilestoneReview` to `CarePlan`, and `CarePlan.next_review_date` is neither read nor written
(§0.2). The authoring and read routes (§17) function identically whether or not a `CarePlan`
exists.

## 12.4 Future Digital Twin (Phase 2D)
A published `MilestoneReview` is a natural future read source for the Digital Twin's computed
narrative (docs/33 §3.5), alongside Timeline Event, Consultation Summary, Symptom Log, Report,
and Care Plan — named, not built, and gated by the same ADR-004 boundary (never diagnosis or
treatment) every other Digital Twin source already is. Phase 2C's non-AI, doctor-authored
reviews are precisely the kind of clean, doctor-owned input Phase 2D can later narrate under
its own full AI gate — which is exactly why docs/33 §3.5 separated the two.

## 12.5 Future data-assisted authoring aid
A future, separately-approved batch might display a patient's own already-stored Symptom
Log / Check-In / Calculator trends beside the review-authoring form as read-only reference,
to reduce the doctor's lookup effort. That would remain doctor-typed authorship (ADR-027) — a
display convenience, never an auto-written review — and is entirely unscoped here, requiring
its own approval, mirroring how this document itself was gated before existing.

---

# 13. Reuse Map (never re-implement)

| Concern | Reused, unmodified | Never re-implemented as |
|---|---|---|
| Roster scoping of a doctor's patients | `DoctorPatientRoster.gs` (WPI-4) | A new patient-lookup mechanism |
| Patient-facing card rendering / fail-closed enablement | Module Registry × `PatientModuleState` (PXP-3/PXP-4, ADR-012) | Hardcoded card logic |
| Doctor-facing card rendering / fail-closed enablement | Doctor Module Registry × `DoctorModuleState` (WPI-3/WPI-4, ADR-020) | Hardcoded card logic |
| Doctor-authored/patient-viewable ownership + one-way status transition | `CarePlan.gs`/`DoctorInstruction.gs` pattern (PXP-7) | A novel ownership model |
| Computed-on-read view (the schedule) | `Analytics.gs`/Digital Twin discipline (WPI-9, docs/33 §3.5) | A stored, drift-prone schedule table |
| Per-patient upsert (the anchor) | `PatientProfile` upsert discipline (PXP-1) | A multi-row anchor with ad-hoc "latest" logic |
| Session-derived identity on every route | `FoundationRouteGuard.gs`/`DoctorRouteGuard.gs` (Foundation/WPI-1) | Client-supplied `patient_id`/`doctor_id` |

Per ADR-009, every one of these is reached through its own existing function, never copied or
re-derived.

---

# 14. Security Model

- **`patient_id` roster-validated on every doctor write**, `DoctorSession`-derived `doctor_id`,
  never client-supplied — the same unconditional rule every doctor-authored feature already
  enforces.
- **`patient_id` always `PatientSession`-derived on the patient read route**
  (`get_health_milestones`), never client-supplied — own record only, published reviews only,
  never a draft, never a roster-wide view.
- **Cross-identity-type rejection.** Every doctor-guarded route rejects a `PatientSession`
  token, and the patient route rejects a `DoctorSession` token, mirroring WPI-1's Stage 17
  conformance precedent exactly.
- **Roster- and specialty-scoped.** A doctor may read or write a `MilestoneTrack`/`MilestoneReview`
  only for a patient in that doctor's own derived roster (`DoctorPatientRoster.gs`, reused).
- **Draft confidentiality.** A `draft` review is never returned to any patient by any route —
  the publish transition (§10.2) is the sole visibility boundary, enforced server-side, not by
  UI hiding alone.
- **Fail-closed enablement.** Both the patient (`health_milestones`) and doctor
  (`milestone_review`) capabilities render nothing when their registry entry or the caller's
  own module state is absent/disabled (ADR-010/012/020, §18).
- **No AI, no external call, no secret.** Health Milestones makes no model/API call and needs
  no API key or outbound request of any kind (ADR-027) — a strictly smaller attack surface
  than any AI feature on the platform.
- **No new write path into any existing entity.** Health Milestones writes only its own two
  Sheets (`MilestoneTracks`, `MilestoneReviews`) and reads existing data only through existing
  scoped readers (§13) — it never writes `CarePlan`, `Notification`, `TimelineEvent`, or any
  other entity.

---

# 15. Audit Trail

- `MilestoneTrack` — one row per patient; `care_start_date`/`status` editable by deliberate
  doctor upsert, each stamping `updated_at`; permanent (no deletion mechanism named).
- `MilestoneReview` — created `draft`, content editable while draft, one-way `published`
  transition stamping `published_at`; permanent. `target_date` preserves what the schedule
  showed at authoring time, an honest record even if the anchor is later corrected.
- The computed schedule (§7/§11.3) stores nothing and therefore has no audit trail of its own
  — it is always a faithful recomputation from the two entities above, which is precisely why
  it cannot drift.

---

# 16. Lifecycle, Deployment, Rollback, and Migration

**Lifecycle.** Every entity's state machine is fully specified in §11: `MilestoneTrack` is a
one-per-patient upsert; `MilestoneReview` is create-draft → edit-draft → publish (one-way).
No entity uses in-place mutation of a *published* clinical fact beyond the single defined
status transition — mirroring every prior WPI/PXP entity's one-way-transition discipline.

**Deployment.** No schema exists yet — nothing is deployed by this document. A future
implementation batch would add two new Sheet tabs (`MilestoneTracks`, `MilestoneReviews`),
each following ADR-006's binding discipline: flat, typed-by-convention columns, a stable
server-generated UUID primary key, no per-patient tabs — identical to every Sheet-backed
entity shipped so far. The schedule (§7) adds **no** tab.

**Rollback.** Because both the patient-facing (`health_milestones`) and doctor-facing
(`milestone_review`) capabilities are fail-closed by registry-entry/module-state absence
(ADR-010/012/020), the safest rollback of a future implementation is simply not registering —
or de-registering — those two Module Registry entries, mirroring Batch PXP-10's own Module
Registry removal precedent (docs/33 §3.2, §6.3) exactly: removing an entry silently stops the
corresponding card from rendering with zero change to the shared render path on either
dashboard, while every already-written `MilestoneTrack`/`MilestoneReview` row is retained
untouched.

**Migration.** No existing entity's schema is widened, narrowed, or otherwise touched by this
document — every new entity is wholly additive. The one disclosed, deferred migration-shaped
decision is §12.1's Timeline Event integration (the same `entry_type` enum-widening deferral
`CarePlan` and Holoscan already made and disclosed) — not required for Health Milestones to
function, and not performed by any future implementation batch without its own separate,
explicit decision to touch that frozen file.

**Scale.** Both new entities are low-volume by nature — at most one `MilestoneTrack` and four
`MilestoneReview` rows per patient over an entire care journey, and the schedule is an
O(1)-per-patient recompute over that tiny set. No new Sheets-at-scale review (docs/54) is
required; this is materially lighter than any ledger-recompute entity docs/54 already cleared.

---

# 17. Router Additions (named only — no `FoundationRouter.gs` change made by this document)

| Dispatch case | Type | Guard | Notes |
|---|---|---|---|
| `set_milestone_track` | Write (upsert) | Doctor (roster-scoped) | Creates or updates the caller's roster patient's single `MilestoneTrack` (`care_start_date`, `status`). Rejects a `patient_id` outside the caller's roster. |
| `get_patient_milestones` | Read-only | Doctor (roster-scoped) | Returns one roster patient's `MilestoneTrack`, computed schedule (§7), and every `MilestoneReview` including drafts. |
| `save_milestone_review` | Write | Doctor (roster-scoped) | Creates or updates one `draft` `MilestoneReview` for a roster patient + `milestone_type`. Rejects a write to an already-`published` review's content (§10.3). |
| `publish_milestone_review` | Write | Doctor (roster-scoped) | One-way `draft` → `published` transition on one `MilestoneReview` the caller has roster access to — the sole act that makes a review patient-visible. |
| `get_health_milestones` | Read-only | Patient (own record only) | Returns the caller's own computed schedule (§7) and only their **published** `MilestoneReview` rows. `patient_id` always session-derived. |

All five are additive — no existing dispatch case, route contract, or frozen file changes. No
route is dual-guarded (§4).

---

# 18. Registry Additions (named only — no registry JSON/`.gs` change made by this document)

## 18.1 Patient Module Registry — `health_milestones`
A future Phase 2C batch registers one new Patient Module Registry entry, structurally
identical to `Care Plan`'s/`Report`'s own entries (ADR-012, PXP-3/PXP-4):
```
module_id:     "health_milestones"
display_name:  "Health Milestones" (illustrative; not fixed by this document)
data_source:   "get_health_milestones"
```
Fail-closed by `PatientModuleState` absence (ADR-010) — the same default every existing
Patient Module Registry entry already has; no new ADR is required for this half, since
ADR-010/012's existing guarantee fully covers it.

## 18.2 Doctor Module Registry — `milestone_review`
A future Phase 2C batch registers one new Doctor Module Registry entry:
```
capability_key:  "milestone_review"
display_name:    "Milestone Review" (illustrative; not fixed by this document)
data_source:     "get_patient_milestones"
```
**Normal rollout — NOT disabled-by-default.** Unlike `ai_assistant` (ADR-023) and
`holoscan_review` (ADR-026), this entry carries **no** model-output-review risk (it authors
and reviews doctor-typed content, never AI output), so it follows the platform's normal
fail-closed-by-`DoctorModuleState`-absence default (ADR-010/020), exactly like `patient_roster`,
`appointments`, `inventory`, `analytics`, and `medication_history`. This contrast is stated
explicitly so a future implementer does not reflexively copy Holoscan's/AI Assistant's
disabled-by-default posture where its rationale does not apply. **No new ADR is required** for
this entry — ADR-020/010's existing discipline governs it fully.

---

# 19. Dashboard Additions (named only — no `dashboard.js` change made by this document, either side)

## 19.1 Patient Dashboard ("My Health Journey") — new Health Milestones card + linked page
- A read-only, celebratory milestone timeline showing the four points, each with its computed
  state (`upcoming`/`due`/`completed`/`overdue`, §7) and, for `completed` points, the doctor's
  **published** review — reinforcing docs/21's "celebrate progress" intent. Never shows a
  draft, never shows a raw or unpublished review.
- An honest empty/"not started yet" state when no `MilestoneTrack` exists for the patient
  (§6 item 3) — never a fabricated schedule.
- A link to a full Health Milestones page (illustrative path `/my-health-journey/milestones/`;
  not fixed by this document — mirroring `Care Plan`'s/`Report`'s own full-history-page
  precedent), calling `get_health_milestones` (§17) under its own patient-scoped guard, own
  record only. **Read-only**: no anchor control, no authoring control, no publish control —
  those are doctor-only (§19.2).
- Renders nothing when the `health_milestones` registry entry or the patient's own
  `PatientModuleState` is disabled — the same fail-closed rendering discipline every existing
  patient card follows. The linked page is reached only from this same card; no separate
  registry entry gates it, mirroring `Care Plan`'s/`Report`'s own full-history pages.

## 19.2 Doctor Dashboard — new Milestone Review card
- A roster-scoped patient selector, reusing the existing Patient Roster card's own route — no
  new patient-lookup mechanism.
- A care-start-anchor control (`set_milestone_track`) — set or correct the patient's
  `care_start_date`, establishing/adjusting the computed schedule (§6/§7).
- A per-point authoring area (`save_milestone_review`) for the six review dimensions (§11.2),
  and a distinct **Publish** control (`publish_milestone_review`) — the UI must make plain
  that a review is a private draft until published, and that publishing is what makes it
  visible to the patient (§10.2), never implying the patient can already see an unpublished
  draft.
- Renders nothing when the `milestone_review` registry entry or the doctor's own
  `DoctorModuleState` is disabled.

---

# 20. Validation Strategy

A future Phase 2C batch's validation suite (docs/47 §13 / docs/53 §7's identical Phase B) must,
at minimum:
- Reject a `DoctorSession` token on the patient-guarded route, and a `PatientSession` token on
  every doctor-guarded route, mirroring WPI-1's Stage 17.
- Reject a `patient_id` outside the caller doctor's own derived roster on every doctor-guarded
  route.
- Reject the request when the relevant registry entry or the caller's own module state is
  disabled (fail-closed, ADR-010).
- Verify `get_health_milestones` never returns a `draft` review to a patient, and never
  returns another patient's data.
- Verify `MilestoneReview.status` transitions `draft` → `published` exactly once, one-way, and
  that `save_milestone_review` refuses to edit a `published` review's content (§10.3).
- Verify `set_milestone_track` is a true upsert — a second call for the same patient updates
  the one row rather than creating a second (§6).
- Verify the computed schedule (§7) is derived server-side from `care_start_date` and is never
  accepted as a client-supplied value; verify a point reads `completed` only when a **published**
  review exists, never on elapsed time alone (§5 item 3).
- Verify `milestone_type` is constrained to exactly the four enum values.

---

# 21. Browser-Test Strategy

A future Phase 2C batch adds `validation/phase-2c-milestones/browser-test.js`, mirroring every
existing suite's discipline (local static server + headless Chromium, backend mocked at the
network layer), covering at minimum:
- The Health Milestones (patient) card and the Milestone Review (doctor) card each do not
  render at all when their own registry entry or module state is disabled — fail-closed.
- The patient card shows only published reviews and the honest empty state; no draft content
  ever appears in the patient view.
- The patient view exposes no anchor/authoring/publish control (read-only, §19.1).
- The doctor card's Publish control's own copy makes the draft-vs-published visibility boundary
  explicit (§10.2/§19.2).
- Keyboard/accessibility parity with every existing dashboard card (tab order, focus handling),
  mirroring PXP-8's own precedent.

---

# 22. Conformance Strategy & Disclosed Implementation-Time Decisions

Mirrors docs/53 §13's three-phase batch workflow. A future Phase 2C implementation batch's
Phase A self-review must be checked, section by section, against this document (§4 through §19)
before Phase B validation begins; any divergence is a **documented amendment to this document**,
never a silent deviation (docs/53 §14's identical requirement). In particular, these decisions
this freeze deliberately leaves open must each be disclosed in that batch's own roadmap/PR
entry, the same disclosure convention every prior WPI/PXP batch followed:
- The exact `due`/`overdue` grace window around each target date (§7).
- Whether a corrected `care_start_date` retains prior anchor values for audit (§6 item 4).
- The post-publish correction discipline for a `MilestoneReview` — edit-in-place-with-audit vs.
  append-only versioning à la `CarePlan` (§10.3).
- The exact patient/doctor page paths and display copy (§19).

---

# 23. Static-Analysis Rules (new — enforcing ADR-027's non-AI boundary as a code-level fact)

A future Phase 2C batch's static-analysis pass must add, at minimum:
1. **No milestone code path may make any AI/model/outbound call.** No file matching
   `Milestone*.gs` may call `UrlFetchApp`, any `callOpenRouter*`/model-invocation helper, or
   any AI-Assistant/Holoscan function — a grep-based check making ADR-027's "no AI, ever"
   boundary a *static* guarantee, not merely a documented intention (the identical style of
   single-most-important static rule docs/55 §18 item 1 / docs/56 §23 item 1 established for
   the AI features, inverted here to forbid AI entirely rather than bound it).
2. **No milestone review field may be written from any source but the doctor's own request.**
   A static check confirming no `Milestone*.gs` write path reads another entity's data into a
   review-content field (enforcing §5 item 2 / ADR-027).
3. **No new dispatch case may be reachable without the correct session type** — a static check
   confirming every doctor-guarded route rejects a `PatientSession` and the patient route
   rejects a `DoctorSession`, mirroring `FoundationRouteGuard.gs`/`DoctorRouteGuard.gs`'s
   existing convention.
4. **No milestone data may originate outside the caller's own roster/patient-ownership scope
   by construction** — a static check confirming no direct Sheet read bypasses
   `DoctorPatientRoster.gs`'s existing scoped derivation.

---

# 24. Architecture Readiness Review (critique of this freeze, per docs/51/docs/45's own role)

Folded into this document (as docs/55/56's single-feature freezes fold their own critique),
rather than a separate numbered readiness-review doc, because Phase 2C is a single feature.
The critical questions a separate readiness review would ask, answered:

1. **Is the care-start anchor a genuine new entity, or scope creep?** Genuine. §0.3 establishes
   that no authoritative treatment-start date exists on the platform, and overloading a frozen
   Foundation field (`Patient.created_at`) with clinical meaning would be a silent
   reinterpretation ADR-007 forbids. `MilestoneTrack` is the minimum honest thing needed, and
   it reuses `PatientProfile`'s existing upsert shape rather than inventing a new one.
2. **Should the schedule be stored or computed?** Computed (§7/§11.3). Storing four milestone
   rows per patient at anchor-set time would create a drift surface (a corrected anchor would
   strand stale stored dates) for zero benefit, since the schedule is a trivial pure function.
   The platform already has two precedents for exactly this choice — `Analytics` and the
   `Digital Twin` — and this freeze reuses that discipline rather than diverging from it.
3. **Is a new ADR justified, or over-production?** Justified, and exactly one (ADR-027). The
   no-AI-in-Phase-2C boundary and the computed-schedule-from-anchor decision are cross-cutting
   (they define the 2C/2D split and a reusable pattern) and are precisely the class of
   boundary the platform records as an ADR (cf. ADR-022/023/025/026). One ADR — not three, as
   the AI features each needed — because Health Milestones has no non-persisting-draft-through-
   another-entity concern and no disabled-by-default risk posture to record. §18.2 documents
   the *absence* of a disabled-by-default decision explicitly so its omission is not mistaken
   for an oversight.
4. **Does anything here touch a frozen file?** No. Every change this freeze contemplates for a
   future batch is additive (two new Sheets, five new dispatch cases, two new registry entries,
   two new cards, new validation). The single frozen-file temptation — a `TimelineEvent` for a
   published review — is explicitly deferred (§12.1), the same disclosed choice `CarePlan` and
   Holoscan already made.
5. **Is the feature honestly non-AI, or is AI hiding somewhere?** Honestly non-AI. §8's
   responsibility-split table has an empty AI column by construction; §23 item 1 makes that a
   static, enforceable fact for the implementation, not just a claim.
6. **Readiness verdict.** The architecture is internally consistent, depends only on shipped
   and frozen work, introduces the minimum new surface, reuses every applicable existing
   pattern, and leaves every genuinely-open decision explicitly disclosed for implementation
   time (§22). **Ready to freeze.** Not ready — and not authorized — to implement; that remains
   a separate, explicit approval (§26).

---

# 25. Risk Analysis

1. **Anchor ambiguity.** If a doctor sets an inaccurate `care_start_date`, every computed
   milestone date is off. Mitigated by making the anchor a deliberate, editable doctor action
   (§6) with an honest empty state until set (§0.3) — never a silently assumed date. Accepted,
   disclosed.
2. **Post-publish correction is deferred (§10.3/§22).** A real implementation risk if skipped
   rather than merely deferred — named here so the implementing batch chooses a discipline
   (edit-with-audit vs. versioning) deliberately, not by accident.
3. **Scope drift toward AI.** The single largest risk to Phase 2C's identity is a future
   "helpful" auto-drafted review — exactly the Phase 2D concern docs/33 §3.5 separated out.
   Mitigated permanently by ADR-027 and enforced statically by §23 item 1.
4. **Overlap confusion with `CarePlan.next_review_date`.** A doctor could reasonably wonder
   why there are "two review dates." Mitigated by §0.2's explicit disambiguation and by the
   two concepts carrying no structural link — the same anti-conflation treatment docs/56 §0.2
   applied to `MedicationHistory` vs. `DoctorInstruction`.
5. **Low adoption if the anchor is never set.** Because a schedule requires a doctor's anchor
   action, a patient whose doctor never sets one sees only an empty card. This is the correct,
   honest behavior (no fabricated schedule), accepted as the cost of not silently assuming an
   anchor; a future `Notification` nudge (§12.2) could surface un-anchored patients to
   doctors, but that is out of scope here.
6. **Milestone review content is unstructured free text.** The six dimensions are free-text
   fields, not structured data — deliberately, to keep authorship fast and human, matching
   `CarePlan.goals`'s own free-text precedent. A future structured form is possible but
   unscoped; this is an accepted, disclosed simplicity, not an oversight.

---

# 26. Dependency Analysis

- **Upstream (must exist first — all do):** Patient Identity/Session, Doctor Identity/Session
  (WPI-1), `DoctorPatientRoster.gs` (WPI-4), Patient & Doctor Module Registries + Module State
  (PXP-3/PXP-4, WPI-3/WPI-4), and the `CarePlan`/`Analytics` structural precedents (PXP-7,
  WPI-9). §2 confirms every one is shipped and frozen. No upstream gap blocks implementation.
- **Downstream (this freeze enables, does not build):** a future `TimelineEvent:milestone`
  source (§12.1), a future `Notification` milestone prompt (§12.2), and a future Digital Twin
  input (§12.4) — each named, each independently gated by its own future approval.
- **No circular or hidden dependency.** Health Milestones reads existing data only through
  existing scoped readers (§13) and writes only its own two Sheets (§14). It does not depend
  on, and is not depended on by, any AI feature.
- **Implementation-authorization dependency.** This freeze is a prerequisite for, but does not
  itself grant, a Phase 2C implementation batch — the identical Architecture Freeze →
  (separate approval) → Implementation gate docs/53 §15 defines and docs/55/56 both honored.

---

# 27. Validation Impact (of this documentation-only freeze)

This freeze changes **no** executable code, schema, or registry file, so it must leave every
existing suite exactly as it was:
- **Static Analysis** (`validation/static-analysis/analyze.js`) — unaffected; still 0 findings
  across the same 66 `apps-script/*.gs` files (this freeze adds no `.gs` file).
- **Conformance** (`validation/phase-2a-foundation/conformance.js`) — unaffected; still 801/801.
- **Phase 1.5 Regression** (`validation/phase-1-5/validate.js`) — unaffected; still 45/45.
- **Browser suites** — unaffected; still 17 suites / 370 checks (this freeze adds no page and
  no suite).
- The new suites named in §20/§21/§23 are **requirements a future implementation batch must
  satisfy**, not code added here.

The freeze's own validation obligation is therefore the inverse of an implementation batch's:
prove the change is inert with respect to code. That is confirmed by re-running the three
non-browser suites after the documentation change and observing identical results, and by
confirming `git` shows no `apps-script/`, `shared/`, or frontend file modified.

---

# 28. Repository Consistency Review (docs/53 §14 checklist, applied to this freeze)

- **Architecture consistency** — this document is additive to docs/49/50/51/52/53/54/55/56/57;
  it reopens, edits, or contradicts none of them (§0). Phase 2A/2B/3 remain frozen.
- **Schema consistency** — no schema file is added or changed; the entity shapes (§11) are
  design descriptions only, following ADR-006's convention for the eventual schema, exactly as
  docs/55/56 described their entities pre-implementation.
- **Contract consistency** — the five named dispatch cases (§17) are all additive; no existing
  route contract changes.
- **ADR consistency** — docs/31-ADR-INDEX.md is updated in the same change to add ADR-027 and
  reflect its grouping; ADR-027 amends no existing ADR (§3).
- **Documentation consistency** — docs/24 (roadmap), docs/31 (ADR index), docs/33 (domain
  model), and the root CHANGELOG are all updated in this same change; no stale cross-reference
  is left. docs/33 §3.5's existing forward reference to "the non-AI Health Milestones work
  (Phase 2C)" now resolves to this document.
- **Validation consistency** — every entity's future write path is named against a concrete
  future suite (§20/§21), and this freeze's own inertness is validated (§27), not merely
  asserted.
- **No temporary files, no debug artifacts, no local paths, no stale references.**

---

# 29. What This Freeze Does Not Do

- Does not implement any code, schema, registry entry, router case, or dashboard card.
- Does not authorize Phase 2C to begin implementation — a separate, explicit approval is still
  required, mirroring docs/53 §9/§13/§15's discipline.
- Does not use, add, or enable any AI capability, model call, or auto-generated content
  (ADR-027).
- Does not send any notification, reminder, or email (§12.2).
- Does not emit a `TimelineEvent` or touch `consultation-history.schema.json`/
  `FoundationConsultationHistory.gs` (§12.1).
- Does not read, write, or redefine `CarePlan.next_review_date` or any other existing entity's
  field (§0.2/§14).
- Does not widen, edit, or reinterpret any existing Accepted ADR — ADR-027 is a new,
  complementary record (ADR-007).
- Does not scope Phase 2D (Digital Twin & AI Summaries) or any other phase.

---

# Summary of Decisions This Freeze Makes

- Defines **Phase 2C — Health Milestones** as the scheduled, **non-AI, doctor-authored**
  progress-review feature of "My Health Journey": four fixed care-start-anchored points
  (30/90/180/365 days, docs/21) at which a doctor authors and publishes a short structured
  review the patient then sees, read-only and celebratory.
- Introduces one small, explicit, **doctor-set care-start anchor** (`MilestoneTrack`, §11.1)
  rather than silently overloading a frozen Foundation field, and computes the entire schedule
  deterministically from it (§7) as a view, never a stored table — reusing
  `Analytics`/`Digital Twin`'s existing computed-view discipline.
- Establishes, via **new ADR-027**, that Health Milestones generates no AI content, makes no
  model call, and infers no status from time alone — a milestone is `completed` only when a
  doctor publishes a review — permanently protecting the Phase 2C/2D separation and enforced
  statically (§23 item 1).
- Designs two new Sheet-backed entities (`MilestoneTrack`, `MilestoneReview`) plus one computed
  view (Milestone Schedule), all **Designed**, none implemented (§11).
- Names five new router dispatch cases (four doctor, one patient; none dual-guarded), two new
  registry entries (patient `health_milestones` normal; doctor `milestone_review` **normal
  rollout, explicitly not disabled-by-default**, §18.2), and two new dashboard cards — all
  specified, none built (§17–§19).
- Explicitly disambiguates a Health Milestone from `CarePlan.next_review_date` (§0.2), naming
  them as deliberately distinct, uncoupled concepts.
- Requires a new static-analysis rule class (§23), and validation/browser-test additions
  (§20/§21) a future implementation batch must satisfy.
- **Authorizes nothing beyond the architecture itself.** Phase 2C implementation still requires
  its own separate, explicit approval.
