# 59 - Phase 2D Digital Twin & AI Summaries Architecture Freeze
## Version 1.0 — 2026-07-16

> Architecture freeze only. No code, no schema file, no registry entry, no router case, no
> dashboard card, no Apps Script file, no frontend file is touched by this document.
> Phase 2D ("Wise Digital Twin & AI Summaries") has been **named, never scoped** since
> docs/24-ROADMAP.md first listed it and docs/33 §3.5 carried the Digital Twin forward as a
> *Conceptual (computed view)* entity, *"deliberately separated from the non-AI Health
> Milestones work (Phase 2C) because of its materially higher AI-safety requirements."*
> **This is that dedicated, feature-scoped architecture-freeze pass**, authorized explicitly
> and separately, and scoped to Phase 2D only. It is the direct structural analogue of
> docs/55 (WPI-10 AI Assistant) and docs/56 (WPI-11 Holoscan) — a single, self-contained,
> feature-scoped AI-content freeze — adapted for the platform's **first patient-facing
> AI-generated-content feature**. Every prior document that named the Digital Twin or AI
> Summaries (docs/21-WISE-PRODUCT-VISION.md's "Digital Twin"/"AI Summaries," docs/23's
> lifecycle, docs/22-WISE-KNOWLEDGE-ENGINE.md's "Future Integrations," docs/33 §2.4's "AI
> Summary" pattern and §3.5's "Digital Twin," ADR-004) is honored, not reopened, edited, or
> contradicted here; this document is additive to all of them. Phase 2A, Phase 2B, Phase 2C
> (Health Milestones), and Phase 3 (WPI-1 through WPI-12, incl. WPI-10 AI Assistant and
> WPI-11 Holoscan) all remain exactly as shipped and **frozen except for genuine bug fixes**;
> nothing in this freeze depends on, or changes, any of them beyond reading their
> already-shipped, already-authenticated data and reusing their already-proven patterns.

---

# Version History

## v1.0 (2026-07-16)
- Initial Phase 2D Digital Twin & AI Summaries Architecture Freeze.

---

# 0. Framing

## 0.1 What Phase 2D is

**Phase 2D is the Wise Digital Twin — the patient's "living health story" (docs/21) — plus
its AI Summaries and a deterministic Progress Analytics view.** Three sub-features, one
phase:

1. **Health Story** — a patient-facing, AI-narrated summary of the patient's own
   already-recorded history (consultation summaries, symptom logs, reports, care plan,
   check-ins, calculator results, medication history, health milestones), organized into one
   plain-language narrative. It **never** states a diagnosis, prognosis, treatment
   recommendation, or reassurance beyond what a doctor already recorded (ADR-004).
2. **AI Summaries** — the same AI-narrated shape as the Health Story, produced at a
   coarser cadence (e.g., a periodic progress summary), distinguished only by
   `narrative_type` (§11.1). Same pipeline, same gate, same boundaries.
3. **Progress Analytics** — a **deterministic, non-AI**, patient-scoped aggregation of the
   patient's own trends (check-in completion, symptom/calculator trend lines, milestone
   progress), mirroring `Analytics.gs`'s (WPI-9) own "computed view, never a base table,
   deterministic aggregation only" discipline — the patient-facing counterpart to WPI-9's
   doctor-facing Analytics. No model call is involved in this sub-feature at all.

The defining new fact of this phase: **it is the platform's first AI-generated content that
reaches a *patient* directly.** Every prior AI feature is either doctor-facing (WPI-10 AI
Assistant, WPI-11 Holoscan review) or, where patient-facing, already gated by a mandatory
doctor review before delivery (Phase 1.5's Consultation Summary email). Phase 2D's Health
Story / AI Summary inherits **that same Phase 1.5 gate** — a doctor reviews and approves (or
edits and approves, or rejects) every narrative before the patient ever sees it (ADR-005,
new ADR-028). This is why docs/33 §3.5 separated Phase 2D from the non-AI Phase 2C:
Phase 2D carries the platform's full AI-safety requirement, Phase 2C carried none.

## 0.2 What Phase 2D is not, and does not touch

- **Not diagnosis, treatment, prognosis, or reassurance.** ADR-004, permanent and
  unchanged, governs every narrative: the Digital Twin organizes and visualizes what already
  happened; it never tells a patient what should happen next medically (§5, ADR-028).
- **Not auto-delivered.** No narrative reaches a patient without a doctor's explicit
  approval (ADR-005, ADR-028) — the identical three-part gate (prompt constraint + code-level
  drift check + mandatory human review) Phase 1.5 already proved and ADR-005 declares the
  reference implementation for every AI feature.
- **Not a stored base table.** The Digital Twin *view* and the Progress Analytics *view* are
  computed on read from already-stored entities, never persisted as their own rows (ADR-004,
  ADR-028, mirroring `Analytics`/§3.5's existing discipline). Only the AI *narrative* audit/
  decision record (`DigitalTwinNarrative`, §11.1) and its doctor-approved published text are
  stored — the same "store the AI artifact and its review decision, compute the view" split
  Phase 1.5's Consultation Summary already established.
- **Not grounded in an unstructured knowledge base.** No real Knowledge Engine exists
  (§0.3). Retrieval is bounded to the patient's own already-stored, already-traceable
  structured record (ADR-001, new ADR-029) — the identical honest-gap discipline ADR-021
  applied to AI Assistant and ADR-024 to Holoscan.
- **Not a chatbot.** There is no free-text patient prompt, no conversation, no model memory
  (§7.1). The patient reads a doctor-approved narrative; they do not converse with a model.
- **Not docs/22's separate "Website AI Assistant."** That patient-facing, public,
  Knowledge-Engine-grounded Q&A capability (docs/55 §0.1) remains entirely unscoped and
  unaffected by this document.
- **Not a change to any existing AI feature.** WPI-10 AI Assistant and WPI-11 Holoscan are
  read as precedents/structural templates only; Phase 2D calls, depends on, and modifies none
  of their code, schemas, or registry entries.

## 0.3 The Knowledge Engine gap, named up front

Mirroring docs/55 §0.2 (AI Assistant) and docs/56 §0.3 (Holoscan): ADR-001 requires every AI
output be traceable to Knowledge-Engine-approved content, but no formal Knowledge Engine
(structured storage, versioning, retrieval) exists — docs/33's Summary Table lists Knowledge
Article and Knowledge Engine as *Conceptual, Unassigned*. This freeze does **not** build one;
inventing a Knowledge Engine as a side effect of a Digital Twin freeze would be undesigned
scope creep, the identical reasoning docs/55 §0.2 already applied. §5 and ADR-029 resolve
this the only honest way available: the Digital Twin's retrieval scope is bounded to data
that already exists and is already doctor-authored or patient-self-reported and stored — the
patient's own record — never a knowledge base that isn't built. Every fact in a narrative is
traceable to a named source entity + field in the assembled context, which is exactly what
makes ADR-004's "never beyond the source material" boundary and the code-level drift check
(§8.2) verifiable.

---

# 1. Scope Decision

Following docs/49 §1's dependency-order test (repeated by docs/55 §1, docs/56 §1, docs/58
§1): the Digital Twin's architecture depends on Patient Identity/Session (Foundation), the
Patient Module Registry/Patient Dashboard pattern (ADR-012, PXP-3/PXP-4), Doctor Identity &
Session (WPI-1) and `DoctorPatientRoster.gs` (WPI-4) for the doctor review surface, the full
AI-supervision pattern proven by Phase 1.5's Consultation Summary and generalized by WPI-10
AI Assistant (`Ai.gs`/`flagDrift_()` and `AIAssistantDriftCheck.gs`/`AssistantDriftCheck_()`
as structural templates), and the already-stored patient entities it narrates (Consultation
Summary, Timeline, Symptom Log, Report, Care Plan, Check-In, Calculator Result, Medication
History, Health Milestones) — **all shipped and frozen.** It does **not** depend on a real
Knowledge Engine, or on any unbuilt feature. Phase 2D was always the last of the Phase 2
family (docs/24: 2A → 2B → 2C → 2D) precisely because it needs the most upstream data to
narrate; every one of those dependencies now exists. This freeze may proceed on dependency
grounds alone.

---

# 2. Dependency Confirmation

| Dependency | Status |
|---|---|
| Patient Identity & Session (Foundation) | Implemented, frozen |
| Patient Module Registry / Patient Dashboard (PXP-3/PXP-4) | Implemented, frozen |
| Doctor Identity & Session (WPI-1) | Implemented, frozen |
| Doctor Patient Roster derivation (`DoctorPatientRoster.gs`, WPI-4) | Implemented, frozen |
| Doctor Module Registry / Doctor Dashboard (WPI-3/WPI-4) | Implemented, frozen |
| Consultation Summary + the AI-review gate (Phase 1.5, `Ai.gs`/`flagDrift_()`/`Review.gs`) | Implemented, frozen — the reference implementation of ADR-005, reused as a structural template, not depended on functionally |
| AI Assistant (WPI-10, `AIAssistantDriftCheck.gs`/`AIAssistantContext.gs`) | Implemented, frozen — structural template for the context builder + drift check, reused, not called |
| Patient-facing entities to narrate (Timeline, Symptom Log, Report, Care Plan, Check-In, Calculator Result, Medication History, Health Milestones) | Implemented, frozen — read-only, via each entity's own existing scoped reader |
| Analytics (WPI-9, computed-view discipline) | Implemented, frozen — the structural precedent for Progress Analytics (§6.3) |
| Knowledge Engine | **Conceptual, unbuilt** — scoped out of this freeze, §0.3/§5/ADR-029 |

No gap blocks the architecture work in this document. The Knowledge Engine gap blocks only a
*future, broader* narrative scope, not this one.

---

# 3. Governing ADRs

- **ADR-001** (Knowledge Engine primary source) — governs §5/§0.3, resolved the same
  disclosed-gap way ADR-021/ADR-024 resolved it.
- **ADR-004** (Digital Twin never diagnoses/treats/predicts/reassures) — the central content
  boundary of this entire phase, applied here for the first time to a real Digital Twin
  implementation, exactly as ADR-004's own Context anticipated ("freeze that boundary before
  any … implementation begins, so it cannot quietly erode feature-by-feature").
- **ADR-005** (AI always under doctor supervision) — governs §8: the three-part gate
  (prompt constraint + independent code-level check + mandatory human review before delivery),
  the identical Phase 1.5 Consultation Summary mechanism, applied to an aggregated narrative.
- **ADR-006** (Sheets as implementation detail) — governs §11's future schema shape for
  `DigitalTwinNarrative` (flat columns, stable UUID `record_id`, no per-patient tabs).
- **ADR-010** (security before convenience / fail-closed) — governs §10/§13.
- **ADR-012** (Patient dashboard registry-driven) — governs the patient-facing `health_story`
  Module Registry entry, §13.
- **ADR-013** (calculators deterministic, never AI) — unaffected; the Digital Twin reads
  `CalculatorResult.result_value` as context but never computes, adjusts, or interprets it
  (§9).
- **ADR-020** (Doctor Dashboard registry-driven) — governs the doctor-facing
  `digital_twin_review` Doctor Module Registry entry, §13.
- **ADR-021** (AI Assistant grounded in structured record only) — the AI-Assistant-scoped
  precedent ADR-029 extends to the patient-facing Digital Twin.
- **ADR-022** (AI Assistant non-persisting draft) — the doctor-facing precedent ADR-028
  adapts for a patient-facing artifact (where approval gates *patient visibility*, not merely
  persistence).
- **ADR-023 / ADR-026** (disabled-by-default AI-review registry entries) — the precedent
  ADR-030 follows for `digital_twin_review`.
- **ADR-028** (new) — the Digital Twin's patient-facing non-persisting-draft, doctor-approval-
  before-patient-visibility boundary, and its computed-not-stored view (§8/§10).
- **ADR-029** (new) — the Digital Twin's grounding boundary: the patient's own already-stored
  structured record only (§5).
- **ADR-030** (new) — the `digital_twin_review` Doctor Module Registry entry's
  disabled-by-default rollout discipline (§13).

No existing Accepted ADR is amended, widened, or reinterpreted. ADR-028/029/030 are new,
complementary records (ADR-007's "supersede, never silently edit" discipline).

---

# 4. Component Diagram

```
Doctor Session (WPI-1, frozen)
      |
      v
Doctor Dashboard -- new card: Digital Twin Review (§14), registry-driven,
      |  Doctor Module Registry entry: digital_twin_review (§13),
      |  DISABLED BY DEFAULT (ADR-030) -- the platform's third AI-output-review surface
      v
FoundationRouter.gs -- three new doctor-only dispatch cases (§12)
      |
      +--> get_patient_digital_twin        (read-only; one roster patient's computed
      |        Digital Twin view (§6.1) + Progress Analytics (§6.3) + every
      |        DigitalTwinNarrative incl. PENDING drafts -- roster-scoped)
      |
      +--> generate_digital_twin_narrative (write, audit only; runs the pipeline below
      |        for a roster patient, writes ONE DigitalTwinNarrative row,
      |        review_status: pending; NEVER patient-visible yet)
      |            |
      |            v
      |        DigitalTwinContextBuilder (deterministic, non-AI, §6.2)
      |            reads, roster-scoped, read-only, via each entity's OWN existing
      |            scoped reader -- never a new direct Sheet read:
      |            Consultation Summary, Timeline, Symptom Log, Report, Care Plan,
      |            Check-In Response, Calculator Result, Medication History,
      |            Health Milestone (published reviews only)
      |            |
      |            v
      |        Prompt Orchestrator (deterministic template assembly, §7)
      |            |
      |            v
      |        AI Model Call (mirrors Ai.gs's callOpenRouterSummary_ / AI Assistant's
      |            own model-call pattern, §7.3)
      |            |
      |            v
      |        DigitalTwinDriftCheck_() (independent code-level check, mirrors
      |            flagDrift_()/AssistantDriftCheck_(), §8.2) -- advisory flags
      |            |
      |            v
      |        DigitalTwinNarrative row written (review_status: pending, §11.1)
      |
      +--> review_digital_twin_narrative   (write, decision only; doctor approves /
               edits-and-approves / rejects ONE narrative; approval sets
               published_output -- the SOLE gate to patient visibility, ADR-028/ADR-005)

Patient Session (Foundation, frozen)
      |
      v
"My Health Journey" Dashboard -- new card: Health Story (§14), registry-driven,
      |  Patient Module Registry entry: health_story (§13), fail-closed by
      |  PatientModuleState absence (ADR-012/PXP-3 precedent)
      v
FoundationRouter.gs -- two new patient-only dispatch cases (§12)
      |
      +--> get_health_story         (read-only; the caller's OWN computed Digital Twin
      |        view + only APPROVED DigitalTwinNarrative rows -- NEVER a pending or
      |        rejected draft; patient_id always session-derived, own record only)
      |
      +--> get_progress_analytics   (read-only; the caller's OWN deterministic,
               non-AI Progress Analytics view (§6.3) -- always safe, no model output,
               no doctor gate needed since nothing is AI-generated)

Digital Twin view (§6.1) + Progress Analytics view (§6.3):
      COMPUTED VIEWS, never stored entities (ADR-004/ADR-028, mirrors Analytics/§3.5).
```

Five distinct dispatch cases total (§12): three doctor-only, two patient-only. **No route is
dual-guarded** — the doctor's roster-scoped review view (`get_patient_digital_twin`, includes
pending drafts) and the patient's own view (`get_health_story`, approved only) are two
separate, independently-scoped routes, the pre-Holoscan norm.

---

# 5. Retrieval Strategy (ADR-029)

The Digital Twin's *only* retrieval source, for this freeze, is the subject patient's own
already-stored, structured platform record — never an unstructured knowledge base, article
corpus, or the model's own general/training knowledge. Every field the Context Builder (§6.2)
assembles is a literal value copied from an existing entity via that entity's own existing
scoped reader; nothing is paraphrased, summarized, or interpreted before it reaches the
prompt step. Retrieval is 100% deterministic code; generation is the model's only job. This
makes ADR-001's traceability requirement and ADR-004's "never beyond the source material"
boundary trivially checkable — every fact in the assembled context names a source entity +
field, and the drift check (§8.2) verifies the model's output against that context directly.

This deliberately means the Digital Twin v1 cannot answer general health questions or
introduce any fact not already in the patient's record — it narrates "what your own record
says," never "what this condition usually means." Extending retrieval to a real Knowledge
Engine, once one exists, is future work requiring its own ADR extending ADR-029, not a
default this freeze grants.

---

# 6. The Three Computed Concerns

## 6.1 Digital Twin view (computed, never stored)
A deterministic, read-only aggregation of the patient's own structured entities into one
bounded object — the "living health story" *data*, before any narration. Computed on read,
never a stored row (ADR-004/ADR-028), mirroring `Analytics`/Digital Twin §3.5's own "computed
view, never a base table" discipline. It is the input both to the narrative pipeline (§7) and
to the patient's read route (`get_health_story`, alongside approved narratives).

## 6.2 DigitalTwinContextBuilder (deterministic, non-AI)
The pure, deterministic assembler (a future `apps-script/DigitalTwinContext.gs` is a natural
home; not mandated) — given a `patient_id` (roster-validated for a doctor caller,
session-derived for a patient caller), it builds a bounded, flat JSON object of already-stored
fields for the requested `narrative_type`. Rules, all enforced in code, none left to the
prompt (mirroring docs/55 §6 exactly):
- **Ownership/roster-scoped.** A doctor caller's `patient_id` must be in that doctor's own
  derived roster (`DoctorPatientRoster.gs`, reused); a patient caller reads their own record
  only, session-derived.
- **Narrative-type-bounded.** Each `narrative_type` (§11.1) declares its own fixed
  `context_sources` allow-list; the builder reads only what that type declares — never
  "everything."
- **Health-Milestone reads are published-only.** The builder reads only *published*
  `MilestoneReview` rows (never a draft), respecting Phase 2C's own patient-visibility
  boundary (docs/58 §10.2).
- **Size-bounded, flat, deterministically serialized** — the same JSON discipline
  `CalculatorResult`/`AIAssistantInteraction.context_snapshot` already use.
- **Read-only.** The builder never writes anything.

## 6.3 Progress Analytics view (deterministic, non-AI — no model call at all)
A patient-scoped, deterministic aggregation of the patient's own trends (check-in completion,
symptom/calculator trend summaries, milestone progress), computed on read, never stored,
never AI-generated — the exact `Analytics.gs` (WPI-9) discipline, applied patient-side and
patient-scoped. Because it produces **no** AI content, it needs **no** doctor-review gate: it
is served directly to the patient (`get_progress_analytics`) the same way any deterministic
read route already is. This is the "deterministic-first" half of Phase 2D (mirroring AI
Assistant's own `flag_checkin_anomalies` deterministic-first split, docs/55 §9.1.3), and is
the safest, always-available part of the patient's Digital Twin experience.

---

# 7. Prompt Orchestration (for the AI narrative only — §6.3 has no prompt)

A `narrative_type`-specific, version-controlled prompt template (a future
`apps-script/DIGITAL-TWIN-PROMPTS.md`, mirroring `PROMPTS.md`/`AI-ASSISTANT-PROMPTS.md`'s
exact role) assembles the Context Builder's output into one bounded request.

## 7.1 No conversation, no memory, no patient prompt
Every invocation is one bounded request/response, doctor-initiated (via
`generate_digital_twin_narrative`). There is no multi-turn chat, no model memory, and **no
free-text patient prompt field of any kind** — the patient never shapes the model input. This
is a deliberate, disclosed restraint distinguishing the Digital Twin from docs/22's separate,
unscoped "Website AI Assistant" chatbot (§0.2).

## 7.2 Numbered-rule system prompt, per narrative_type
Each `narrative_type`'s system prompt is a numbered-rule specification (version-controlled),
forbidding, at minimum, per ADR-004:
1. Any diagnosis, condition interpretation, or clinical conclusion not already present in the
   assembled context.
2. Any treatment, medicine, or dosage recommendation, or any change to one, not already
   present in the assembled context (never touching `CalculatorResult.result_value` — ADR-013).
3. Any prognosis, recovery-timeline prediction, or outcome forecast (ADR-004 names this
   category explicitly).
4. Any clinical reassurance not already given by a doctor in the source material (ADR-004).
5. Anything not directly traceable to a specific field in the assembled context — the "delete
   the sentence if you can't point to its source" rule `Ai.gs`'s prompt already enforces.
6. A fixed, bounded output shape (plain, short, patient-friendly prose) — never markdown
   headers or a variable-shaped response the drift check (§8.2) cannot reliably parse.

## 7.3 Model call
Reuses the existing `OPENROUTER_API_KEY` Script Property / `UrlFetchApp.fetch` pattern
`Ai.gs`'s `callOpenRouterSummary_()` and AI Assistant's own model-call step already
established — no new secret-management design, no new provider integration. The specific model
and generation parameters are implementation-time choices (`CONFIG.DIGITAL_TWIN.MODEL`, a
local, decoupled constant mirroring `AIAssistantInteraction.gs`'s "never a read of Phase 1.5's
frozen `Config.gs`" precedent) — this freeze does not pick one.

---

# 8. Patient-Facing Supervision Model (ADR-004, ADR-005, ADR-028)

The three-part pattern ADR-005 declares the reference implementation for every AI feature —
proven first by Phase 1.5's Consultation Summary (the platform's only *patient-facing*
AI-content precedent) and generalized by WPI-10 AI Assistant — is applied here in full, with
the patient-facing recipient making the review gate the boundary to **patient visibility**,
not merely to persistence.

## 8.1 Prompt-level constraint
§7.2's numbered rules, per `narrative_type`, version-controlled.

## 8.2 Independent code-level check — `DigitalTwinDriftCheck_()`
A `narrative_type`-agnostic function, structurally identical to `flagDrift_()`/
`AssistantDriftCheck_()`:
- **Category-lexicon check** — flags output containing prohibited-category phrases (diagnosis,
  prescription/dosage, prognosis/prediction, reassurance, investigation-ordering) that do not
  appear in the assembled context, reusing/extending the same lexicon-check shape
  `DRIFT_LEXICON_`/`AssistantDriftCheck_()` already established (never a second, parallel
  lexicon mechanism, §18 item 5).
- **Per-sentence traceability/overlap check** — any output sentence whose substantive words
  barely overlap the assembled context's own vocabulary is flagged low-traceability, mirroring
  `sentenceOverlap_()` exactly, run against the Context Builder's JSON (flattened to text).
- **Advisory, never blocking** — flags are stored alongside the narrative
  (`ai_output_flags`, §11.1) and shown to the reviewing doctor; they never auto-approve,
  auto-edit, or auto-reject, because the human review gate (§8.3) already sits between any
  draft and any patient — exactly `flagDrift_()`'s own reasoning.

## 8.3 Mandatory doctor review and approval — the load-bearing boundary (ADR-028)
**No Digital Twin narrative is ever shown to a patient until a doctor approves it.** Every
generated narrative is held only in its own `DigitalTwinNarrative` row (`review_status:
pending`) and the reviewing doctor's own screen. `get_health_story` (§12) returns **only
`approved` narratives** to a patient, enforced server-side — a `pending` or `rejected`
narrative is never returned to a patient by any route. The doctor calls
`review_digital_twin_narrative` (§12) to record `approved` / `edited_and_approved` /
`rejected`:
- On **`approved`**, the model's `ai_output` becomes the `published_output` the patient sees.
- On **`edited_and_approved`**, the doctor's own edited text becomes the `published_output` —
  the patient sees the doctor's words, and the original `ai_output` is retained alongside (not
  overwritten) as an honest audit of what the model produced.
- On **`rejected`**, nothing is ever shown to the patient; the row is retained as an audit
  record only.

This is ADR-028 in full — the patient-facing analog of ADR-022, and the direct continuation
of Phase 1.5's own `evaluateSendGate_()` "hard-gated on doctor approval, re-checked against
live values" discipline (ADR-005). It is this freeze's single most important boundary; every
other design choice exists to make it easy to verify and hard to erode.

---

# 9. Deterministic vs. AI Responsibility Split

| Concern | Deterministic (code) | AI (model) |
|---|---|---|
| Which patient's records are visible at all | `DigitalTwinContextBuilder` (ownership/roster scoping) | Never |
| What data enters the prompt | `DigitalTwinContextBuilder` (narrative-type allow-list) | Never |
| The Digital Twin *view* (§6.1) and Progress Analytics (§6.3) | Deterministic aggregation, computed on read, never stored | Never |
| Drafting the narrative language | Never | Prompt Orchestrator → model call (§7) |
| Traceability / prohibited-category flagging | `DigitalTwinDriftCheck_()` (§8.2) | Never |
| Whether a narrative is approved, edited, or rejected | The doctor (human) | Never |
| **Whether a patient ever sees a narrative** | The doctor's approval (ADR-028) | Never |
| `CalculatorResult.result_value` itself | The existing deterministic formula layer (ADR-013, untouched) | Never |
| Fail-closed enablement / rollout | Patient/Doctor Module Registry + Module State (ADR-010/012/020, ADR-030) | Never |
| Diagnosis, treatment, prognosis, reassurance | **Not produced at all** (ADR-004, §5/§7.2) | Never |

---

# 10. Security Model

- **`patient_id` roster-validated on every doctor route** (`DoctorPatientRoster.gs`, reused),
  `DoctorSession`-derived `doctor_id`, never client-supplied.
- **`patient_id` always `PatientSession`-derived on both patient routes** (`get_health_story`,
  `get_progress_analytics`), never client-supplied — own record only, approved narratives
  only, never a pending/rejected draft.
- **Cross-identity-type rejection.** Every doctor route rejects a `PatientSession` token and
  vice versa, mirroring WPI-1's Stage 17 conformance precedent exactly.
- **Patient visibility gated by doctor approval** (§8.3, ADR-028), enforced server-side (the
  read route filters to `approved`), not by UI hiding alone.
- **Fail-closed enablement.** The patient (`health_story`) card renders nothing when its
  registry entry or the patient's own `PatientModuleState` is absent/disabled; the doctor
  (`digital_twin_review`) card is **disabled by default** (ADR-030) and renders nothing until
  explicitly enabled per doctor.
- **Rate-limited.** A narrative generation carries real latency and real per-call model cost.
  A bounded per-doctor (or per-patient-per-day) generation ceiling is a **named requirement**
  of this freeze (mirroring docs/55 §10's identical per-doctor ceiling and docs/56 §6's
  per-patient ceiling); the exact mechanism is an implementation-time decision.
- **API key handling** reuses the existing `OPENROUTER_API_KEY` Script Property — no new
  secret-management mechanism.
- **No new write path into any narrated entity.** The Digital Twin reads Care Plan, Symptom
  Log, Report, Check-In, Calculator Result, Medication History, Health Milestones, and
  Consultation Summary only through their existing scoped readers; it writes **only** its own
  `DigitalTwinNarrative` rows. It never writes, and never triggers a write to, any narrated
  entity (§18 item 1).

---

# 11. New Entities (Designed, not Implemented — no schema file exists yet)

## 11.1 `DigitalTwinNarrative` (Sheet-backed entity — the AI narrative audit/decision/delivery record)

| Field | Type | Notes |
|---|---|---|
| `narrative_id` | string (UUID) | Server-generated identity column. |
| `patient_id` | string | The subject patient. Roster-validated at creation (a doctor generates it). |
| `narrative_type` | string enum | `health_story` \| `ai_summary` — the fixed set this freeze defines. Never free text. |
| `context_snapshot` | string (JSON) | The exact flat, size-bounded context object the Context Builder assembled and sent to the model — stored for audit/traceability, mirroring `AIAssistantInteraction.context_snapshot`/`CalculatorResult.input_snapshot`. |
| `prompt_template_version` | string | Matches the version-controlled prompt spec (§7.2). |
| `model` | string | Mirrors `CONFIG.DIGITAL_TWIN.MODEL`. |
| `ai_output` | string | The model's raw draft narrative. **Never shown to a patient directly** — only a doctor-approved `published_output` is (§8.3). Immutable once written (the honest record of what the model produced), retained even after an `edited_and_approved` decision. |
| `ai_output_flags` | string (JSON array) | `DigitalTwinDriftCheck_()`'s advisory flags (§8.2). Empty array, not null, when clean. |
| `review_status` | string enum | `pending` \| `approved` \| `edited_and_approved` \| `rejected`. Always `pending` at creation; transitions one-way, exactly once, mirroring `AIAssistantInteraction.doctor_decision`'s precedent. |
| `published_output` | string, nullable | The text the patient actually sees — set only on `approved` (equals `ai_output`) or `edited_and_approved` (the doctor's edited text). Null/empty while `pending` or when `rejected`. |
| `reviewed_by` | string, nullable | `doctor_id`, `DoctorSession`-derived, set at review time. |
| `review_notes` | string, nullable | Optional doctor rationale. |
| `created_at` | string (ISO 8601) | Server-set. |
| `reviewed_at` | string, nullable (ISO 8601) | Server-set at the moment `review_status` leaves `pending`. |

**Ownership:** doctor/staff-generated and doctor-reviewed; the patient never generates,
edits, approves, or rejects a narrative, and reads only its `published_output` once
`approved`/`edited_and_approved`. Mirrors Phase 1.5's Consultation Summary ownership exactly
(staff/AI-produced, doctor-reviewed, patient-received).

**Immutability:** `patient_id`/`narrative_type`/`context_snapshot`/`ai_output`/`ai_output_flags`/
`created_at` immutable once written; only the single `review_status` transition (plus
`published_output`/`reviewed_by`/`review_notes`/`reviewed_at`) is ever written after creation,
exactly once.

**Security:** roster-scoped doctor read/write of the review fields; session-derived patient
read-only of `published_output` for their own `approved`/`edited_and_approved` rows only.

## 11.2 Digital Twin view & Progress Analytics view (computed views — not stored entities)

Per §6.1/§6.3 and ADR-004/ADR-028: neither is a table, neither has a schema file, and neither
is ever written. A future implementation derives each on read from already-stored entities —
the identical "computed on read, never stored" shape `Analytics.gs` already ships (docs/33
§7.6) and docs/33 §3.5 already reserves for the Digital Twin. Listed here as entities only to
be explicit that they are deliberately **not** ones.

## 11.3 Digital Twin Narrative-Type config (config list, not a Sheet-backed schema)

Structurally parallel to the AI Assistant Capability Registry (docs/55 §11.2) and Calculator
Registry — a small, fixed config list, one entry per `narrative_type`, each declaring:
`narrative_type` (stable slug), `display_name`, `description`, `context_sources` (explicit
allow-list of entity types the Context Builder may read for this type — never "all"),
`output_shape` (`draft_text` — the only value this freeze defines), and `requires_knowledge_engine`
(**must be `false`** for every entry in this freeze's scope, §5/ADR-029). Two entries are
defined: `health_story` and `ai_summary`. Whether a future batch seeds one or both is an
implementation-time decision.

---

# 12. Router Additions (named only — no `FoundationRouter.gs` change made by this document)

| Dispatch case | Type | Guard | Notes |
|---|---|---|---|
| `get_patient_digital_twin` | Read-only | Doctor (roster-scoped) | One roster patient's computed Digital Twin view (§6.1) + Progress Analytics (§6.3) + every `DigitalTwinNarrative` including pending drafts. |
| `generate_digital_twin_narrative` | Write (audit only) | Doctor (roster-scoped) | Runs the §6.2–§8.2 pipeline for a roster patient + `narrative_type`; writes one `DigitalTwinNarrative` row (`review_status: pending`); returns the draft + flags. Rate-limited (§10). Never patient-visible. |
| `review_digital_twin_narrative` | Write (decision only) | Doctor (roster-scoped) | Records the caller doctor's one-way `approved`/`edited_and_approved`/`rejected` decision on one narrative they have roster access to; sets `published_output`. **Never writes any other entity** (ADR-028). The sole gate to patient visibility. |
| `get_health_story` | Read-only | Patient (own record only) | The caller's own computed Digital Twin view (§6.1) + only their `approved`/`edited_and_approved` narratives' `published_output` — never a pending or rejected draft. `patient_id` session-derived. |
| `get_progress_analytics` | Read-only | Patient (own record only) | The caller's own deterministic, non-AI Progress Analytics view (§6.3). No model output, no doctor gate. `patient_id` session-derived. |

All five are additive — no existing dispatch case, route contract, or frozen file changes. No
route is dual-guarded.

---

# 13. Registry Additions (named only — no registry JSON/`.gs` change made by this document)

## 13.1 Patient Module Registry — `health_story`
A future Phase 2D batch registers one new Patient Module Registry entry:
```
module_id:     "health_story"
display_name:  "Health Story" (illustrative; not fixed by this document)
data_source:   "get_health_story"
supports_ai:    true   (the first patient-facing entry for which this is genuinely true)
```
Fail-closed by `PatientModuleState` absence (ADR-010) — the same default every existing
Patient Module Registry entry already has; no new ADR is required for this half (the
patient's own PatientModuleState is already absent-by-default, and even when enabled the card
shows nothing until a doctor approves a narrative, §8.3). The card additionally surfaces
Progress Analytics via `get_progress_analytics` (a deterministic, always-safe view).

## 13.2 Doctor Module Registry — `digital_twin_review`
A future Phase 2D batch registers one new Doctor Module Registry entry:
```
capability_key:  "digital_twin_review"
display_name:    "Digital Twin Review" (illustrative; not fixed by this document)
data_source:     "get_patient_digital_twin"
```
**Disabled by default, per ADR-030** — the platform's third AI-output-review doctor surface
(after `ai_assistant`/ADR-023 and `holoscan_review`/ADR-026), and its highest-risk one, since
its output is destined for a *patient*. Its `DoctorModuleState` must remain absent
(fail-closed, ADR-010) for every doctor by default; enabling it is a deliberate, disclosed,
per-doctor administrative decision — never a bulk/default rollout.

---

# 14. Dashboard Additions (named only — no `dashboard.js` change made by this document, either side)

## 14.1 Patient Dashboard ("My Health Journey") — new Health Story card + linked page
- A read-only display of the patient's doctor-**approved** Health Story / AI Summaries (the
  `published_output` only — never a raw model draft, never a pending narrative), plus a
  Progress Analytics section (deterministic, from `get_progress_analytics`).
- An honest empty state when no narrative has been approved yet ("Your doctor is preparing
  your health story") — never a fabricated or auto-generated narrative shown as if reviewed.
- A link to a full Health Story page (illustrative path `/my-health-journey/health-story/`;
  not fixed), read-only, mirroring Care Plan's/Report's/Health Milestones' own full-history-page
  precedent.
- Renders nothing when the `health_story` registry entry or the patient's own
  `PatientModuleState` is disabled.

## 14.2 Doctor Dashboard — new Digital Twin Review card
- A roster-scoped patient selector (reusing the Patient Roster card's own route).
- A "Generate" control (`generate_digital_twin_narrative`, per `narrative_type`) and a draft
  output area that **always** shows an explicit, un-dismissable "AI-generated draft — not yet
  visible to the patient" banner above any Approve/Edit/Reject control, mirroring AI
  Assistant's own "AI-generated draft — not saved" banner (docs/55 §14) — adapted so the
  banner names *patient visibility* as the thing approval unlocks.
- Approve/Edit/Reject controls call `review_digital_twin_narrative` only; the UI makes plain
  that **only approval makes a narrative visible to the patient**, and that an edit-and-approve
  publishes the doctor's own words.
- Renders nothing when the `digital_twin_review` registry entry or the doctor's own
  `DoctorModuleState` is disabled.

---

# 15. Validation Strategy

A future Phase 2D batch's validation suite (docs/53 §7/§13 Phase B) must, at minimum:
- Reject a `PatientSession` token on every doctor route and a `DoctorSession` token on every
  patient route (WPI-1 Stage 17 precedent).
- Reject a `patient_id` outside the caller doctor's own derived roster on every doctor route.
- Reject the request when the relevant registry entry or the caller's own module state is
  disabled (fail-closed, ADR-010/ADR-030).
- **Verify `get_health_story` never returns a `pending` or `rejected` narrative to a patient**
  — only `approved`/`edited_and_approved` `published_output` (ADR-028's central guarantee,
  proven at runtime, not merely asserted).
- Verify `review_status` transitions `pending` → terminal exactly once, one-way; that
  `edited_and_approved` sets `published_output` to the doctor's text while retaining the
  original `ai_output`; and that `rejected` never yields a `published_output`.
- Unit-test `DigitalTwinDriftCheck_()` against known-bad outputs (diagnosis/treatment/prognosis/
  reassurance lexicon hits, low-overlap sentences), mirroring `flagDrift_()`/`AssistantDriftCheck_()`.
- Statically or structurally verify `generate_digital_twin_narrative`/
  `review_digital_twin_narrative` never write any entity's Sheet beyond `DigitalTwinNarrative`
  (§18 item 1).
- Verify Progress Analytics (`get_progress_analytics`) is deterministic and involves **no**
  model call at all.
- Verify the per-doctor/per-patient generation rate limit actually rejects once its ceiling is
  reached.

---

# 16. Browser-Test Strategy

A future Phase 2D batch adds `validation/phase-2d-digital-twin/browser-test.js`, mirroring
every existing suite's discipline (local static server + headless Chromium, backend mocked at
the network layer), covering at minimum:
- The Health Story (patient) card and the Digital Twin Review (doctor) card each do not render
  at all when their registry entry or module state is disabled — fail-closed.
- The patient card shows only approved `published_output` and the honest empty state; **no
  pending/rejected narrative and no raw `ai_output` ever appears in the patient view**.
- The patient card exposes no generate/approve/edit control (read-only).
- The doctor card's draft banner ("AI-generated draft — not yet visible to the patient") is
  present and precedes any Approve/Edit/Reject control; the Approve control's copy names patient
  visibility as what approval unlocks.
- Keyboard/accessibility parity with every existing dashboard card.

---

# 17. Conformance Strategy & Disclosed Implementation-Time Decisions

Mirrors docs/53 §13's three-phase batch workflow. A future Phase 2D implementation batch's
Phase A self-review must be checked, section by section, against this document (§4 through
§14) before Phase B validation begins; any divergence is a **documented amendment to this
document**, never a silent deviation (docs/53 §14). Decisions this freeze deliberately leaves
open, each to be disclosed in that batch's own roadmap/PR entry:
- The exact model and generation parameters (§7.3).
- The exact generation rate-limit mechanism (§10).
- Whether the narrative-type config ships one entry (`health_story`) or both (§11.3).
- Whether Health Story and Progress Analytics render as one patient card or two (§13.1/§14.1).
- The exact patient/doctor page paths and display copy (§14).
- The precise Progress Analytics metric set (a subset of Analytics' own sections, patient-scoped).

---

# 18. Static-Analysis Rules (new — patient-facing AI introduces the platform's highest AI risk class)

A future Phase 2D batch's static-analysis pass must add, at minimum:
1. **No Digital Twin code path may call another entity's write function directly.** No file
   matching `DigitalTwin*.gs` may call any `save*(`/`create*(`/`update*(`/`record*(`/`fulfill*(`
   function targeting any entity other than `DigitalTwinNarrative` itself — the code-level
   guarantee behind ADR-028, the identical single-most-important rule docs/55 §18 item 1 /
   docs/56 §23 item 1 required for the prior AI features.
2. **No prompt template may change without a version bump**, mirroring `PROMPT_VERSION_`'s
   convention exactly.
3. **Every doctor route is doctor-guarded only; every patient route is patient-guarded only**
   — a static check confirming the correct session guard on each new handler, mirroring
   `FoundationRouteGuard.gs`/`DoctorRouteGuard.gs`.
4. **No context field may originate outside the subject patient's own roster/ownership scope
   by construction** — a static check confirming no direct Sheet read bypasses the existing
   scoped readers / `DoctorPatientRoster.gs`.
5. **No prohibited-category output may be presented as diagnosis/treatment/prognosis/reassurance**
   — a static lexicon check reusing/extending `DigitalTwinDriftCheck_()`'s own single category
   lexicon (never a second, parallel lexicon mechanism).
6. **Progress Analytics makes no model/outbound call** — a static check confirming the
   deterministic Progress Analytics path (`get_progress_analytics`) contains no `UrlFetchApp`/
   model call, keeping the always-safe deterministic half provably AI-free.

---

# 19. Architecture Readiness Review (critique of this freeze, per docs/51/docs/45's role)

Folded into this document (as docs/55/56/58's single-feature freezes fold their own critique),
because Phase 2D is a single, self-contained feature-freeze. The critical questions answered:

1. **Is a patient-facing AI feature safe to freeze at all?** Yes, and only because the
   platform already proved the exact mechanism that makes it safe: Phase 1.5's Consultation
   Summary is a patient-facing AI artifact gated by mandatory doctor review, live-re-checked
   at send time. Phase 2D reuses that gate (ADR-005, ADR-028) rather than inventing a lighter
   one. The patient never receives un-reviewed model output.
2. **Is the Digital Twin a stored entity or a computed view?** Computed (§6.1/§6.3, ADR-004/
   ADR-028) — docs/33 §3.5 already committed to this, and this freeze does not diverge. Only
   the AI narrative audit/decision record and its approved text are stored; the aggregation
   views are recomputed on read (Analytics' precedent).
3. **Are three new ADRs justified, or over-production?** Justified, and exactly three —
   the identical count WPI-10 and WPI-11 each needed, and for the identical reasons: a
   grounding boundary (ADR-029, cf. ADR-021/024), a non-persisting-draft/approval boundary
   (ADR-028, cf. ADR-022/025), and a disabled-by-default rollout boundary for the doctor review
   surface (ADR-030, cf. ADR-023/026). ADR-028 is genuinely distinct from ADR-022 because its
   gate is *patient visibility*, not persistence-through-another-entity. The patient
   `health_story` entry needs **no** new ADR (existing fail-closed-by-absence default covers
   it), stated explicitly so its omission is deliberate, not an oversight.
4. **Does anything touch a frozen file?** No — every change is additive (one new Sheet entity,
   five new dispatch cases, two new registry entries, two new cards, new validation). The
   Digital Twin reads every narrated entity through its existing scoped reader; it writes only
   its own `DigitalTwinNarrative` rows.
5. **Is Progress Analytics honestly non-AI?** Yes — §6.3/§9 make its AI column empty by
   construction, and §18 item 6 makes that a static, enforceable fact. It is the deterministic-
   first, always-available half of the patient experience.
6. **Readiness verdict.** The architecture is internally consistent, depends only on shipped
   and frozen work, reuses the platform's proven AI-safety gate rather than a new one,
   introduces the minimum new surface, and leaves every genuinely-open decision disclosed for
   implementation time (§17). **Ready to freeze.** Not ready — and not authorized — to
   implement; that remains a separate, explicit approval (§22/§23).

---

# 20. Risk Analysis

1. **Patient-facing AI is the platform's highest-trust surface.** A single un-reviewed or
   drifting narrative reaching a patient would be a serious trust failure. Mitigated by the
   full ADR-005/ADR-028 gate: server-side `approved`-only filtering, an independent drift
   check, disabled-by-default doctor review, and a patient card that shows nothing until a
   doctor approves. Named as the primary risk so no future shortcut around the gate is silent.
2. **The "one extra doctor review per narrative" friction** (§8.3) may tempt a future team to
   auto-approve or batch-approve — the identical risk docs/55 §19 item 1 / docs/56 §24 item 1
   named. Named here so any change to the gate is a deliberate ADR amendment.
3. **The Knowledge Engine gap (§0.3/§5)** bounds narrative usefulness to the patient's own
   record — an accepted, disclosed limitation, not an oversight; closing it needs a real
   Knowledge Engine plus a new ADR.
4. **`context_snapshot` and stored narratives duplicate PHI at rest** — an accepted cost of
   auditability (mirroring `AIAssistantInteraction.context_snapshot`/`CalculatorResult.input_snapshot`),
   at the same doctor/staff-and-patient-only access level the source entities already carry.
5. **Generation rate-limit mechanism is deliberately unspecified (§10)** — a real
   implementation risk if skipped rather than deferred; the implementing batch's Definition of
   Done must include it.
6. **Progress Analytics could drift toward AI interpretation** if a future batch "helpfully"
   narrates it. Mitigated permanently by keeping it deterministic (§6.3) and statically AI-free
   (§18 item 6); any AI narration of analytics belongs in the gated narrative path, not here.
7. **ADR-004 boundary erosion** — a "predicted recovery timeline" or "insights" feature is the
   exact erosion ADR-004's own Context warned against. Named here as out of scope; introducing
   it would require a new ADR, never a silent addition.

---

# 21. Dependency Analysis

- **Upstream (must exist first — all do):** Patient & Doctor Identity/Session, `DoctorPatientRoster.gs`,
  the Patient & Doctor Module Registries + Module State, the narrated entities (Consultation
  Summary, Timeline, Symptom Log, Report, Care Plan, Check-In, Calculator Result, Medication
  History, Health Milestones), the Phase 1.5 / WPI-10 AI-review gate as a structural template,
  and Analytics (WPI-9) as the computed-view precedent. §2 confirms every one is shipped and
  frozen. No upstream gap blocks implementation.
- **Downstream (this freeze enables, does not build):** a future real Knowledge Engine could
  extend retrieval (ADR-029's own Future Considerations); a future `TimelineEvent:health_story`
  source could surface an approved narrative on the Timeline (the same frozen-`entry_type`-enum
  deferral Care Plan/Holoscan/Health Milestones all made) — named, not built.
- **No circular or hidden dependency.** The Digital Twin reads existing data only through
  existing scoped readers and writes only its own `DigitalTwinNarrative` rows; no narrated
  entity depends on it.
- **Implementation-authorization dependency.** This freeze is a prerequisite for, but does not
  itself grant, a Phase 2D implementation batch — the identical Architecture Freeze →
  (separate approval) → Implementation gate docs/53 §15 defines and docs/55/56/58 all honored.

---

# 22. Validation Impact (of this documentation-only freeze)

This freeze changes **no** executable code, schema, or registry file, so it must leave every
existing suite exactly as it was:
- **Static Analysis** — unaffected; still 0 findings across the same 68 `apps-script/*.gs`
  files (this freeze adds no `.gs` file).
- **Conformance** — unaffected; still 840/840.
- **Phase 1.5 Regression** — unaffected; still 45/45.
- **Browser suites** — unaffected; still 18 suites / 392 checks (this freeze adds no page and
  no suite).
- The new suites named in §15/§16/§18 are **requirements a future implementation batch must
  satisfy**, not code added here.

The freeze's own validation obligation is the inverse of an implementation batch's: prove the
change is inert with respect to code — confirmed by re-running the three non-browser suites
after the documentation change and observing identical results, and by confirming `git` shows
no `apps-script/`, `shared/`, or frontend file modified.

---

# 23. Repository Consistency Review (docs/53 §14 checklist, applied to this freeze)

- **Architecture consistency** — additive to docs/49/50/51/52/53/54/55/56/57/58; reopens,
  edits, or contradicts none. Phase 2A/2B/2C/3 remain frozen.
- **Schema consistency** — no schema file added or changed; the `DigitalTwinNarrative` shape
  (§11) is a design description only, following ADR-006's convention for the eventual schema,
  exactly as docs/55/56 described their entities pre-implementation.
- **Contract consistency** — the five named dispatch cases (§12) are all additive; no existing
  route contract changes.
- **ADR consistency** — docs/31-ADR-INDEX.md is updated in the same change to add ADR-028/029/030
  and reflect their grouping; none amends an existing ADR (§3).
- **Documentation consistency** — docs/24 (roadmap), docs/31 (ADR index), docs/33 (domain
  model), and the root CHANGELOG are all updated in this same change; no stale cross-reference
  left. docs/33 §3.5's existing "Phase 2D" forward reference now resolves to this document.
- **Validation consistency** — every entity's future write path and every AI-safety boundary
  is named against a concrete future suite (§15/§16/§18), and this freeze's own inertness is
  validated (§22).
- **No temporary files, no debug artifacts, no local paths, no stale references.**

---

# 24. What This Freeze Does Not Do

- Does not implement any code, schema, registry entry, router case, or dashboard card.
- Does not authorize Phase 2D to begin implementation — a separate, explicit approval is still
  required, mirroring docs/53 §9/§13/§15.
- Does not build, or commit to a timeline for, a real Knowledge Engine (§0.3/ADR-029).
- Does not scope docs/22's separate patient-facing "Website AI Assistant" (§0.2).
- Does not produce, or permit, any diagnosis, treatment, prognosis, or reassurance (ADR-004).
- Does not auto-deliver any AI output to a patient — every narrative is doctor-gated (ADR-028).
- Does not widen, edit, or reinterpret any existing Accepted ADR — ADR-028/029/030 are new,
  complementary records (ADR-007).
- Does not scope any phase beyond Phase 2D.

---

# Summary of Decisions This Freeze Makes

- Defines **Phase 2D — Wise Digital Twin & AI Summaries** as the platform's **first
  patient-facing AI-generated-content feature**: a doctor-generated, **doctor-approved-before-
  patient-visibility** health-story / AI-summary narrative (ADR-005, new ADR-028), plus a
  deterministic, non-AI Progress Analytics view.
- Reuses Phase 1.5's proven patient-facing AI-review gate (prompt constraint + independent
  drift check + mandatory doctor approval) rather than a lighter one — the patient never
  receives un-reviewed model output (§8, ADR-028).
- Keeps the Digital Twin and Progress Analytics as **computed views, never stored base tables**
  (§6, ADR-004/ADR-028); only the AI narrative audit/decision record and its approved text are
  stored (`DigitalTwinNarrative`, §11.1).
- Bounds retrieval to the patient's own already-stored structured record only, until a real
  Knowledge Engine exists (§5, new ADR-029) — never diagnosis, treatment, prognosis, or
  reassurance (ADR-004, §7.2).
- Makes the `digital_twin_review` Doctor Module Registry entry **disabled-by-default** (new
  ADR-030), the platform's third and highest-risk AI-output-review surface; the patient
  `health_story` entry inherits the existing fail-closed default with no new ADR.
- Defines one new Sheet-backed entity (`DigitalTwinNarrative`), two computed views (Digital
  Twin, Progress Analytics), and one fixed narrative-type config list (§11), all *Designed*,
  none implemented.
- Names five new router dispatch cases (three doctor, two patient; none dual-guarded), two new
  registry entries, and two new dashboard cards, all specified but none built (§12–§14).
- Requires a new static-analysis rule class (§18) and validation/browser-test additions
  (§15/§16) a future implementation batch must satisfy.
- **Authorizes nothing beyond the architecture itself.** Phase 2D implementation still requires
  its own separate, explicit approval.
