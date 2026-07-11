# 56 - WPI-11 Holoscan Architecture Freeze
## Version 1.0 — 2026-07-16

> Architecture freeze only. No code, no schema, no registry entry, no router case, no
> dashboard card, no Apps Script file, no frontend file is touched by this document.
> Every prior document that named "Holoscan" (docs/24, docs/49 §9, docs/50 §13,
> ADR-019) explicitly refused to invent a scope for it, requiring "its own dedicated,
> separately-approved architecture-freeze pass once its purpose is actually defined by
> the clinic, not before" (docs/49 §9). **The clinic has now defined that purpose** —
> Holoscan is the **Patient Medication Recognition Engine** described below, supplied
> directly for this freeze, not inferred or invented by this document. Written per
> ADR-019's own "Future Considerations": *"When... Holoscan... [is] eventually proposed
> for real, each requires its own technical plan and, per ADR-001/004/005's existing
> pattern, likely its own feature-specific ADRs."* This is that technical plan, mirroring
> docs/55's own role for AI Assistant (WPI-10) exactly. docs/24, docs/33 §7.7, docs/49
> §9, docs/50 §13, and ADR-019 are none of them reopened, edited, or contradicted here;
> this document is additive, the same relationship docs/55 has to docs/49/50. WPI-1
> through WPI-10 remain exactly as shipped and frozen; nothing in this freeze depends on,
> or changes, any of them beyond reading their already-shipped, already-authenticated
> data and reusing their already-proven patterns.

---

# 0. Framing

## 0.1 What Holoscan is

**Holoscan is the Patient Medication Recognition Engine.** A patient photographs one or
more medicines they are currently taking (any medicine — homeopathic remedies dispensed
by this clinic, medicines from another clinic or pharmacy, over-the-counter products);
Holoscan's pipeline extracts whatever text is visible on the packaging and produces a
**draft** medication candidate for each recognized item. **Nothing is automatically
accepted.** A doctor reviews every candidate — approving, correcting, or rejecting it —
before anything becomes part of the patient's permanent Medication History. Once a
medicine is part of that permanent record, the doctor separately, and at any later time,
marks it Continue, Stop, Replace, or Unknown, building a complete, append-only audit
trail of the patient's medication history over time. The doctor remains the final
authority at every step; this is the identical "AI assists, doctors decide" principle
(CLAUDE.md, ADR-005) already governing every AI feature on the platform, applied here to
an image-recognition pipeline instead of a text-generation one.

## 0.2 What Holoscan is not, and does not touch

- **Not clinic inventory management.** Holoscan never reads, matches against, or writes
  `InventoryItem`/`InventoryTransaction` (docs/33 §7.4). A patient's photographed
  medicine may or may not be something this clinic stocks at all — Holoscan's subject is
  the patient's own reported medication use, not this clinic's stock levels. Any
  resemblance between a recognized medicine name and an `InventoryItem.item_name` is,
  in this freeze, coincidental and unused.
- **Not PillFill.** Holoscan never reads or writes `PillFillOrder` (docs/33 §7.5) —
  fulfillment of clinic-prescribed remedies is a fully separate concern.
- **Not the same thing as a Doctor Instruction of type `medicine`.** docs/33 §2.3
  already established "Prescription is a `medicine`-type Doctor Instruction" — that
  entity records what a doctor at *this* clinic told a patient to take, as part of a
  Care Plan. `MedicationHistory` (§11.3 below) records what a patient is verified, by
  photographic evidence and doctor review, to actually be taking — which may include
  medicines this clinic never prescribed at all (another physician's prescription, an
  over-the-counter product, a supplement). The two entities are deliberately not merged
  and carry no structural reference to one another in this freeze; a doctor comparing
  the two is a manual, judgment-based act, exactly the same "doctors decide" boundary
  every other cross-entity clinical judgment on this platform already respects. This
  mirrors docs/55 §0.1's own disambiguation of two different "AI Assistant" concepts —
  named explicitly here to prevent an equivalent conflation.
- **Not diagnosis, not a treatment recommendation, not a drug-interaction check.** See
  ADR-024 and §5 (Non-Goals) below.
- **Not a Knowledge-Engine-grounded feature.** See §0.3 immediately below.

## 0.3 The Medicine Catalog gap, named up front

Mirroring docs/55 §0.2's disclosure of the Knowledge Engine gap: no structured Medicine
Catalog, drug dictionary, or reference vocabulary exists anywhere on this platform
today. `InventoryItem` (docs/33 §7.4) is this clinic's own homeopathy-scoped stock
record, not a general medicine reference, and is explicitly out of scope for Holoscan
per §0.2 above. This freeze does not build one — inventing a Medicine Catalog as a side
effect of a recognition-pipeline freeze would itself be undesigned scope creep, the
identical reasoning docs/55 §0.2 already applied to the Knowledge Engine. §8 and ADR-024
resolve this the only honest way available: Holoscan's "medicine catalog matching"
pipeline stage (originally named in the clinic's own brief for this feature) is
**reserved, not implemented** — its fields exist on `HoloscanRecognitionItem` so a
future, separately-scoped Medicine Catalog can populate them later, but nothing backs
them in this freeze. Recognition confidence (§9) reflects OCR/vision-extraction
confidence only, never a catalog-match confidence, since no catalog exists to match
against.

---

# 1. Scope Decision

Following docs/49 §1's dependency-order test, repeated verbatim by docs/55 §1 for AI
Assistant: Holoscan's architecture depends on Patient Identity/Session (Foundation),
Doctor Identity & Session (WPI-1), the Doctor Dashboard registry-driven pattern
(ADR-020), the Patient Module Registry pattern (ADR-012/PXP-3), and Report's own
already-proven Drive file-upload pattern (docs/29 §8/§11, Batch PA-5) — all shipped and
frozen. It does **not** depend on Health Milestones (Phase 2C), the Digital Twin
(Phase 2D), a real Medicine Catalog, or a real Knowledge Engine — each of those remains
exactly as open and unscoped as before. This freeze may proceed on dependency grounds
alone, the identical test WPI-10's own freeze already passed.

---

# 2. Dependency Confirmation

| Dependency | Status |
|---|---|
| Patient Identity & Session (Foundation) | Implemented, frozen |
| Doctor Identity & Session (WPI-1) | Implemented, frozen |
| Doctor Module Registry / Doctor Dashboard (WPI-3/WPI-4) | Implemented, frozen |
| Patient Module Registry / Patient Dashboard (PXP-3/PXP-4) | Implemented, frozen |
| Specialty Registry (WPI-2) | Implemented, frozen |
| Report (Drive file-upload pattern, Batch PA-5) | Implemented, frozen |
| AI Assistant (WPI-10, supervision-pattern precedent reused, not depended on functionally) | Implemented, frozen |
| Doctor Patient Roster derivation (`DoctorPatientRoster.gs`, WPI-4) | Implemented, frozen |
| Sheets-at-production-scale review (docs/54) | Closed — its append-only-ledger/derived-cache/`LockService` discipline is reused directly for `MedicationHistory`/`MedicationDecision`, §16 |
| Medicine Catalog | **Does not exist** — scoped out of this freeze, §0.3/§8/ADR-024 |
| Inventory / PillFill Integration | **Not read, not written** — explicitly out of scope, §0.2 |

No gap blocks the architecture work in this document.

---

# 3. Governing ADRs

- **ADR-001** (Knowledge Engine primary source) — governs §0.3/§8, resolved the same
  disclosed-gap way ADR-021 resolved it for AI Assistant.
- **ADR-004** (Digital Twin never diagnoses/treats) — governs §5/§9, the content
  boundary applied to a patient-facing capture pipeline.
- **ADR-005** (AI always under doctor supervision) — governs §10 (the reference
  three-part pattern: prompt constraint, code-level check, mandatory human review).
- **ADR-006** (Sheets as implementation detail) — governs §11's future schema shape
  (flat columns, stable UUID `record_id`, no per-patient tabs).
- **ADR-010** (security before convenience / fail-closed) — governs §14/§18.
- **ADR-012** (Patient dashboard registry-driven) — governs the patient-facing
  `holoscan` Module Registry entry, §18.
- **ADR-017/018/020** — Doctor Identity, specialty scoping, Doctor Dashboard
  registry-driven — reused as-is, no amendment.
- **ADR-019** — the platform-wide "reserve, don't implement" rule this document
  satisfies for Holoscan specifically, the same way docs/55 satisfied it for AI
  Assistant.
- **ADR-021/022/023** — AI Assistant's retrieval/draft/rollout precedents, reused as
  structural templates throughout this document, not depended on functionally (Holoscan
  does not call AI Assistant's code, §12.2).
- **ADR-024** (new) — Holoscan's image-content-only grounding boundary (§0.3, §5, §9).
- **ADR-025** (new) — Holoscan's non-persisting-draft, doctor-approval boundary (§10).
- **ADR-026** (new) — the `holoscan_review` registry entry's disabled-by-default
  rollout discipline (§18).

---

# 4. Component Diagram

```
Patient Session (Foundation, frozen)
      |
      v
"My Health Journey" Dashboard -- new card: Holoscan (§19), registry-driven
      |  Patient Module Registry entry: holoscan (§18), fail-closed by
      |  PatientModuleState absence (ADR-012/PXP-3 precedent)
      v
FoundationRouter.gs -- two new patient-guarded dispatch cases (§17)
      |
      +--> submit_holoscan_recognition   (write; uploads image(s), creates one
      |        HoloscanRecognition row, status: uploaded)
      |            |
      |            v
      |        Image storage -- reuses Report.gs's existing Drive-upload
      |        mechanism unmodified (docs/29 §8/§11, Batch PA-5) -- never a
      |        new file-handling pattern
      |            |
      |            v
      |        Capture Pipeline (§6) -- deterministic orchestration code
      |            |
      |            v
      |        OCR / Recognition Pipeline (§7) -- one vision-capable model
      |        call per recognition, mirrors Ai.gs's callOpenRouterSummary_
      |        pattern extended to image input (§7.3)
      |            |
      |            v
      |        Deterministic field parsing -> zero or more
      |        HoloscanRecognitionItem rows (draft, doctor_decision: pending)
      |            |
      |            v
      |        Medicine Matching (§8) -- reserved, unbacked in this freeze
      |        (ADR-024, §0.3)
      |            |
      |            v
      |        HoloscanRecognition.status -> completed | failed
      |
      +--> get_holoscan_recognitions     (read-only; caller's own recognition
               history + item drafts, session-derived patient_id only)

Doctor Session (WPI-1, frozen)
      |
      v
Doctor Dashboard -- two new cards: Holoscan Review, Medication History (§19),
      |  registry-driven, Doctor Module Registry entry: holoscan_review (§18),
      |  disabled by default (ADR-026)
      v
FoundationRouter.gs -- four new doctor-guarded dispatch cases (§17)
      |
      +--> get_holoscan_review_queue        (read-only; pending
      |        HoloscanRecognitionItem rows across the doctor's own derived
      |        roster, reusing DoctorPatientRoster.gs unmodified)
      |
      +--> post_holoscan_recognition_decision  (write, audit only; records
      |        approve / corrected_and_approve / reject on ONE
      |        HoloscanRecognitionItem row -- never writes MedicationHistory,
      |        ADR-025)
      |
      +--> get_medication_history           (read-only; one roster patient's
      |        MedicationHistory + its own MedicationDecision ledger)
      |
      +--> create_medication_history_entry  (write; the doctor's own,
      |        SEPARATE action -- creates one MedicationHistory row, using an
      |        approved HoloscanRecognitionItem's fields as pre-fill only,
      |        ADR-025's load-bearing boundary)
      |
      +--> record_medication_decision       (write, append-only; one new
               MedicationDecision row -- continue / stop / replace / unknown --
               MedicationHistory.current_status deterministically recomputed
               from the latest row, mirroring InventoryItem's derived-cache-
               from-ledger discipline, WPI-7/docs/54)
```

---

# 5. Non-Goals

Holoscan, in this freeze and in any future implementation of it, does **not**:

1. Diagnose any condition, or state what a recognized medicine treats (ADR-024).
2. Recommend a dosage, a schedule change, or any treatment action (ADR-004/ADR-024).
3. Check for, warn about, or infer drug interactions — named only as a possible future
   "interaction checker" (§12.5), entirely unscoped, requiring its own future,
   separately-approved architecture-freeze pass, mirroring how this very document was
   gated before existing.
4. Automatically create, update, or infer any `MedicationHistory` or
   `MedicationDecision` row — every one is a doctor's own deliberate, separate write
   action (ADR-025).
5. Read, match against, or write `InventoryItem`, `InventoryTransaction`, or
   `PillFillOrder` (§0.2).
6. Build, seed, or commit to a timeline for a real Medicine Catalog (§0.3/ADR-024).
7. Implement any code, schema, registry entry, router case, or dashboard card — this
   document is architecture only.
8. Authorize WPI-11 to begin implementation — a separate, explicit approval is still
   required, per docs/53 §9/§13/§15, unchanged.
9. Scope WPI-12 (Closeout) or any phase beyond WPI-11.

---

# 6. Capture Pipeline

1. Patient selects one or more medicine photographs in the "My Health Journey"
   Holoscan card (§19).
2. Client-side validation (file type, size ceiling) mirrors Report's own existing
   discipline (docs/29 §11) exactly — no new file-acceptance policy invented.
3. Each image is uploaded to Drive via the same deterministic mechanism
   `Report.gs`/docs/29 §8 already established for patient file upload — Holoscan
   introduces no new file-handling code path, only a new caller of the existing one.
4. On successful upload, `submit_holoscan_recognition` creates one `HoloscanRecognition`
   row (§11.1), `status: uploaded`, `patient_id` always `PatientSession`-derived, never
   client-supplied — the same unconditional rule every patient-writable route on this
   platform already enforces (Symptom Log, Report, Check-In Response, Calculator
   Result).
5. The pipeline then transitions the row through `processing` to `completed` or
   `failed` (§7-§9) — **whether this happens synchronously within the same request or
   via an asynchronous Apps Script trigger is a named, disclosed implementation-time
   decision**, the identical restraint docs/55 §10 already applied to AI Assistant's
   rate-limit mechanism: this freeze names the requirement (a bounded, observable
   status transition) without locking down the exact mechanism.
6. A per-patient submission rate/volume ceiling is a **named requirement** of this
   freeze (mirroring docs/55 §10's identical per-doctor ceiling for AI Assistant, since
   each recognition carries a real outbound model-API cost) — the exact mechanism is an
   implementation-time decision, not specified further here.

---

# 7. OCR / Recognition Pipeline

## 7.1 One bounded request per recognition, no conversation
Mirroring docs/55 §7.1's "no conversation, no memory" restraint: each
`HoloscanRecognition` is one bounded request (the uploaded image set) to one
vision-capable model call, never a multi-turn exchange, and never a free-text patient
prompt field — the patient supplies photographs only, nothing else shapes the request.

## 7.2 Numbered-rule system prompt
A version-controlled recognition-instruction prompt (a future
`apps-script/HOLOSCAN-PROMPTS.md`, mirroring `PROMPTS.md`'s/
`AI-ASSISTANT-PROMPTS.md`'s existing role exactly) governs the model call, forbidding at
minimum, per ADR-024:
1. Any statement of what a recognized medicine is used for, treats, or is indicated
   for.
2. Any dosage, administration, or schedule instruction beyond text printed on the
   packaging itself.
3. Any drug-interaction claim of any kind.
4. Any diagnosis, prognosis, or treatment recommendation.
5. A fixed, bounded output shape (one structured candidate per recognized medicine,
   each field independently nullable) — never markdown, prose, or a variable-shaped
   response the deterministic parsing step (§7.4) cannot reliably consume.

## 7.3 Model call
Reuses the existing `PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY')`
/ `UrlFetchApp.fetch` pattern `Ai.gs`'s `callOpenRouterSummary_()` and AI Assistant's own
model-call step (docs/55 §7.3) already established, extended to multimodal (image)
input — no new secret-management design, no new provider integration. The specific
vision-capable model is an implementation-time choice (`CONFIG.HOLOSCAN.MODEL`, a local,
decoupled constant mirroring `AIAssistantInteraction.gs`'s own "never a read of Phase
1.5's frozen `Config.gs`" precedent, docs/55's Documentation Impact note) — this freeze
does not pick one.

## 7.4 Deterministic field parsing
The model's structured response is parsed by deterministic code into zero or more
`HoloscanRecognitionItem` rows (§11.2) — one per distinct medicine the model reports
recognizing across the image set. Parsing is a pure mapping from the model's declared
output shape to the entity's fields; it never infers a field the model did not report,
and never merges two model-reported candidates into one without the model itself having
distinguished them.

---

# 8. Medicine Matching (reserved, not implemented)

Per §0.3/ADR-024: `HoloscanRecognitionItem` reserves `catalog_match_status` and
`catalog_match_ref` fields for a future comparison against a real Medicine Catalog. In
this freeze, no such catalog exists, so both fields are always null/unset — never
populated by a fabricated or partial matching mechanism improvised to look complete. A
future, separately-approved ADR extending ADR-024 (mirroring ADR-021's own Future
Considerations for a real Knowledge Engine) is required before this step becomes real.

---

# 9. Confidence Scoring

`HoloscanRecognitionItem.confidence_score` is the vision model's own reported confidence
in its text extraction for that specific candidate (a 0.0–1.0 value), passed through
deterministically by code — never recomputed, amplified, or averaged by any downstream
step. It reflects extraction confidence only, never a clinical or catalog-match
confidence (§8). The doctor review UI (§19) may surface low-confidence items more
prominently, but confidence **never gates, blocks, or auto-rejects** a candidate —
mirroring `AssistantDriftCheck_()`'s own "advisory, never blocking" discipline (docs/55
§8.2) exactly: the doctor's own review (§10) is always the actual gate, regardless of
score.

---

# 10. Doctor Supervision Model (ADR-005, ADR-025)

The three-part pattern ADR-005 declares the reference implementation for every AI
feature, and docs/55 §8 already applied in full to AI Assistant, is applied here again,
adapted for an image-recognition pipeline with a two-entity target instead of a single
draft-and-decide entity:

## 10.1 Prompt-level constraint
§7.2's numbered rules, version-controlled.

## 10.2 Independent code-level check
A Holoscan-specific, capability-agnostic function (a future
`HoloscanRecognitionCheck_()`, structurally mirroring `AssistantDriftCheck_()`/
`flagDrift_()` exactly) applies the same category-lexicon check (§7.2's five
prohibitions, reusing/extending the same six-category lexicon shape `DRIFT_LEXICON_`
already established) against every `HoloscanRecognitionItem`'s extracted text fields
before the item is shown to any doctor. Flags are stored alongside the item (a reserved,
advisory field mirroring `AIAssistantInteraction.ai_output_flags`) and are, identically
to AI Assistant's own discipline, **advisory, never blocking** — the human review gate
below already sits between any draft and any effect.

## 10.3 Mandatory human review and approval — the load-bearing boundary (ADR-025)
No Holoscan recognition ever writes to `MedicationHistory` or `MedicationDecision`.
Every candidate is held only in its own `HoloscanRecognitionItem` row and the doctor's
own screen until the doctor calls `post_holoscan_recognition_decision` (§17) to record
approve / corrected-and-approve / reject. **Approval records the decision only — it
never itself creates a `MedicationHistory` row.** If the doctor wants an approved
recognition to become a permanent record, the doctor separately calls
`create_medication_history_entry` (§17), using the approved draft as pre-fill only —
exactly as if Holoscan had never been involved beyond supplying that pre-fill. This is
ADR-025 in full, the identical guarantee ADR-022 already gives AI Assistant, applied
here to a second feature and a second target entity shape.

## 10.4 Ongoing clinical decisions are equally non-automatic
Once a `MedicationHistory` row exists, every later Continue/Stop/Replace/Unknown action
is its own doctor-authored `MedicationDecision` row (§11.4), via
`record_medication_decision` (§17) — never inferred from elapsed time, a missed
appointment, or any other signal. `MedicationHistory.current_status` is a pure,
deterministic function of the latest `MedicationDecision` row for that medication,
recomputed the same way `InventoryItem.quantity_on_hand` is recomputed from
`InventoryTransaction`'s append-only ledger (WPI-7, docs/54 §13/§19) — never a
cached-value-plus-delta update, and never client-settable directly.

---

# 11. New Entities (Designed, not Implemented — no schema file exists yet)

## 11.1 `HoloscanRecognition` (Sheet-backed entity — one capture session)

| Field | Type | Notes |
|---|---|---|
| `recognition_id` | string (UUID) | Server-generated identity column. |
| `patient_id` | string | `PatientSession`-derived only, never client-supplied. |
| `image_refs` | array of objects (JSON) | `{drive_file_id, mime_type, size_bytes}` per uploaded image — reuses `Report.gs`'s own file-metadata shape (docs/33 §3.3), never a new file-reference convention. |
| `status` | string enum | `uploaded` → `processing` → `completed` \| `failed`. One-way, mirrors `Appointment`/`DoctorInstruction`'s existing transition discipline. |
| `model` | string | Mirrors `CONFIG.HOLOSCAN.MODEL` / `AIAssistantInteraction.model`'s precedent. |
| `prompt_template_version` | string | Matches the version-controlled recognition-instruction prompt (§7.2). |
| `submitted_at` | string (ISO 8601) | Server-set at creation. |
| `processed_at` | string, nullable (ISO 8601) | Server-set when `status` leaves `processing`. |
| `error_log` | string, nullable | Mirrors `ConsultationSummary.error_log`'s own precedent; populated only on `status: failed`. |

**Ownership:** patient-owned at creation (the upload act), system-owned thereafter
(pipeline-driven status transitions only) — the patient never edits or deletes a
recognition once submitted, the identical "logged, never edited" honest-permanent-record
discipline Symptom Log (docs/33 §3.2) already established.

**Immutability:** `patient_id` and `image_refs` immutable after creation; `status`
transitions one-way only, exactly as named above.

**Security:** `patient_id` always session-derived; doctor read access is roster-scoped
only (a doctor may read a `HoloscanRecognition` only for a patient present in that
doctor's own derived roster, reusing `DoctorPatientRoster.gs` unmodified — never a new
derivation).

## 11.2 `HoloscanRecognitionItem` (Sheet-backed entity — one candidate medicine, the draft/audit row)

| Field | Type | Notes |
|---|---|---|
| `recognition_item_id` | string (UUID) | Server-generated identity column. |
| `recognition_id` | string | References the parent `HoloscanRecognition` (§11.1). |
| `patient_id` | string | Denormalized from the parent, the same convention `CarePlan`/`DoctorInstruction` already use for direct roster-scoped queries. |
| `source_image_ref` | string, nullable | Which uploaded image (by `drive_file_id`) this candidate was extracted from, when attributable to one image. |
| `extracted_name` | string, nullable | Raw OCR/vision-extracted medicine name — "extract if available" per this feature's own brief; nullable, never guessed. |
| `extracted_strength` | string, nullable | Same nullability discipline. |
| `extracted_dosage_form` | string, nullable | Same. |
| `extracted_manufacturer` | string, nullable | Same. |
| `extracted_batch` | string, nullable | Same. |
| `extracted_expiry` | string, nullable | Same. |
| `confidence_score` | number (0.0–1.0) | Model-reported extraction confidence only, passed through as-is (§9). |
| `check_flags` | array (JSON), nullable | `HoloscanRecognitionCheck_()`'s advisory flags (§10.2). Empty array, not null, when clean. |
| `catalog_match_status` | string, nullable | Reserved, unbacked in this freeze (§8/ADR-024). |
| `catalog_match_ref` | string, nullable | Reserved, unbacked in this freeze (§8/ADR-024). |
| `doctor_decision` | string enum | `pending` \| `approved` \| `corrected_and_approved` \| `rejected`. Always `pending` at creation; transitions one-way, exactly once, mirroring `AIAssistantInteraction.doctor_decision`'s identical precedent. |
| `corrected_fields` | object (JSON), nullable | The doctor's field-level corrections, populated only when `doctor_decision: corrected_and_approved`. |
| `decision_notes` | string, nullable | Optional doctor rationale. |
| `decided_by` | string, nullable | `doctor_id`, `DoctorSession`-derived, set at decision time. |
| `decided_at` | string, nullable (ISO 8601) | Server-set at the moment `doctor_decision` transitions away from `pending`. |
| `created_at` | string (ISO 8601) | Server-set. |

**Relationships:** many-per-`HoloscanRecognition`; produces, at most, one
`MedicationHistory` row (§11.3) — created only by the doctor's own separate action
(§10.3/ADR-025), never automatically.

**Ownership:** system-generated (pipeline output); `doctor_decision`/`corrected_fields`/
`decision_notes`/`decided_by`/`decided_at` written by a roster-scoped doctor only. The
patient may read their own recognition items (to see what was detected and its review
status) but never writes `doctor_decision` — the identical "patient never edits a
doctor's decision" boundary `DoctorInstruction`/`CarePlan` already establish.

**Immutability:** every `extracted_*`/`confidence_score`/`check_flags` field is
immutable once written (the traceability record of what the model actually produced,
mirroring `AIAssistantInteraction.context_snapshot`/`ai_output`'s own "store what
produced this" precedent); only the single `doctor_decision` transition (plus its
attendant fields) is ever written after creation, exactly once.

**Security rules:** roster-scoped doctor read/write only for the decision fields;
`patient_id`-session-scoped patient read-only for the rest.

## 11.3 `MedicationHistory` (Sheet-backed entity — the permanent, doctor-authored medication record)

| Field | Type | Notes |
|---|---|---|
| `medication_history_id` | string (UUID) | Server-generated identity column. |
| `patient_id` | string | Roster-validated at creation (reuses `DoctorPatientRoster.gs`, never a new derivation). |
| `medicine_name` | string | The doctor-confirmed final name (equal to `extracted_name`, or the doctor's `corrected_fields` value, if `corrected_and_approved`). |
| `strength` | string, nullable | Same provenance discipline. |
| `dosage_form` | string, nullable | Same. |
| `manufacturer` | string, nullable | Same. |
| `source_type` | string enum | `holoscan_recognition` — the only value this freeze populates. `doctor_manual_entry` is a **reserved, unimplemented** enum value for a future, separately-scoped batch that lets a doctor record a medication with no photograph at all — named here so the field never needs a breaking widen later, mirroring every other registry's own inert reserved-field convention (ADR-019). |
| `source_recognition_item_id` | string, nullable | References the originating `HoloscanRecognitionItem` (§11.2) when `source_type: holoscan_recognition`. Purely observational provenance — never a live foreign key Holoscan itself enforces beyond validation at creation time (mirrors `AIAssistantInteraction.target_entity_id`'s own precedent exactly). |
| `current_status` | string enum | `active` \| `stopped` \| `replaced` \| `unknown`. **Derived, never client-supplied** — recomputed from the latest `MedicationDecision` row (§11.4) every time one is recorded, defaulting to `active` at creation with no `MedicationDecision` row required to establish that initial state, mirroring `InventoryItem.quantity_on_hand`'s own recompute-from-ledger discipline exactly (WPI-7). |
| `created_at` | string (ISO 8601) | Server-set. |
| `created_by` | string | `doctor_id`, `DoctorSession`-derived — the doctor who took the separate, deliberate `create_medication_history_entry` action (§10.3/ADR-025). |

**Relationships:** belongs to one Patient; sourced from at most one
`HoloscanRecognitionItem` in this freeze's scope; has many `MedicationDecision` rows
(§11.4), its own append-only ledger.

**Lifecycle:** created once, by a doctor's own deliberate write action; `current_status`
is the only field ever recomputed after creation, and only as a pure function of
`MedicationDecision` (§11.4) — every other field is immutable once written (an honest
record of what was confirmed at approval time; a genuine correction to `medicine_name`
itself, as opposed to a status change, is out of this freeze's scope and would require
its own future decision, named here as a disclosed gap rather than silently assumed
possible).

**Ownership:** doctor/staff-authored only — the patient never creates, edits, or
resolves a `MedicationHistory` row directly, the identical "doctors decide" boundary
`CarePlan`/`DoctorInstruction` already establish. Patient-viewable, read-only (mirrors
`CarePlan`'s own "doctor-authored/patient-viewable" ownership exactly).

**Security rules:** roster-scoped doctor write; session-derived patient read of their
own rows only.

## 11.4 `MedicationDecision` (Sheet-backed entity — the append-only clinical-status ledger)

| Field | Type | Notes |
|---|---|---|
| `decision_id` | string (UUID) | Server-generated identity column. |
| `medication_history_id` | string | References the parent `MedicationHistory` (§11.3). |
| `patient_id` | string | Denormalized, the same `CarePlan`/`DoctorInstruction` convention. |
| `decision_type` | string enum | `continue` \| `stop` \| `replace` \| `unknown`. |
| `replacement_medication_history_id` | string, nullable | Populated only when `decision_type: replace` — references a **different**, already-existing `MedicationHistory` row that replaces this one. **Disclosed boundary:** the replacement medication must already exist as its own `MedicationHistory` row (via its own prior Holoscan recognition and approval) before it can be referenced here — this freeze names no mechanism for recording a replacement medication that was never itself photographed and recognized, the identical honest-gap discipline applied throughout this document rather than inventing a workaround. |
| `notes` | string, nullable | Optional doctor rationale. |
| `decided_by` | string | `doctor_id`, `DoctorSession`-derived. |
| `decided_at` | string (ISO 8601) | Server-set. |

**Relationships:** many-per-`MedicationHistory` (its own append-only ledger); many-per-
Patient.

**Lifecycle:** each row is a discrete, permanent event. `MedicationHistory.current_status`
is a pure function of the most recent `MedicationDecision` row for that
`medication_history_id` — the "state machine" lives here, in the ledger, exactly
mirroring `InventoryTransaction`'s relationship to `InventoryItem.quantity_on_hand`
(WPI-7, docs/54 §7/§13/§19), including that precedent's `LockService`-protected
append-then-recompute-then-cache-write discipline, reused directly rather than
re-derived, for the identical race-condition reason docs/54 §19 already names.

**Immutability:** strictly append-only — no update, no patch, ever, on this entity's own
Sheet, mirroring `InventoryTransaction.gs`'s own explicit discipline exactly (docs/54
§19).

**Ownership:** doctor/staff-owned only, roster-scoped, `DoctorSession`-derived — never
patient-writable.

**Security rules:** roster-scoped doctor write only; session-derived patient read-only
of their own rows.

---

# 12. Integration Points (named only, none built by this freeze)

## 12.1 Patient Timeline
A `MedicationHistory` entry reaching `active` status is a natural future
`TimelineEvent` (`entry_type: medication`) source — the identical disclosed, deliberate
deferral `CarePlan` already made at Batch PXP-7 (docs/33 §3.4's own "disclosed,
deliberate scope decision" section): widening the frozen `consultation-history.schema.json`'s
`entry_type` enum is new functionality, not a bug fix, and this freeze makes the same
disclosed choice not to touch that frozen file. A patient's medication history remains
fully visible via `get_medication_history` and its own dedicated page regardless.

## 12.2 AI Assistant (WPI-10)
`MedicationHistory` is a plausible future addition to a `context_sources` allow-list
entry in AI Assistant's own Capability Registry (docs/55 §11.2) — e.g., a future
`summarize_patient_status` revision that includes medication data. This is a future,
separately-approved change to **AI Assistant's own registry**, governed by ADR-021's
existing capability-bounded discipline; Holoscan does not call, depend on, or modify any
AI Assistant code, schema, or registry entry in this freeze.

## 12.3 Appointments (WPI-5)
A doctor reviewing Holoscan submissions may naturally do so around an upcoming or recent
`Appointment` — a convenience of workflow timing, not a structural dependency. No new
field links `HoloscanRecognition`/`HoloscanRecognitionItem`/`MedicationHistory` to
`Appointment` in this freeze; the review and decision routes (§17) function identically
whether or not an Appointment exists, the same "read-only reference, no coupling"
restraint AI Assistant's own §9.1.7 already applied to Appointments.

## 12.4 Future Digital Twin (Phase 2D)
`MedicationHistory` is a natural future read source for Digital Twin's computed view
(docs/33 §3.5), alongside Timeline Event, Consultation Summary, Symptom Log, Report, and
Care Plan — named, not built, and gated by the same ADR-004 boundary (never diagnosis or
treatment) every other Digital Twin source already is.

## 12.5 Future interaction checker
A drug-interaction-checking capability is named by the clinic's own brief for this
feature but is entirely unscoped by this document — it would read `MedicationHistory`
across a patient's active medications and require its own real Medicine Catalog/drug-
interaction reference (§0.3), its own architecture-freeze pass, and its own ADR gate,
mirroring exactly how this document itself was gated before existing. Not designed,
timelined, or committed to here.

---

# 13. Deterministic vs. AI Responsibility Split

| Concern | Deterministic (code) | AI (vision/OCR model) |
|---|---|---|
| Which patient's images are processed | `PatientSession`-derived, image ownership | Never |
| Image storage (Drive) | Reuses `Report.gs`'s existing mechanism unmodified | Never |
| Text/field extraction from an image | Never | Vision model call (§7) |
| Confidence score | Passed through as-is, never recomputed | Model-reported (§9) |
| Category-lexicon / traceability check | `HoloscanRecognitionCheck_()` (§10.2) | Never |
| Medicine catalog matching | Reserved, unbacked (§8) | Never (no catalog exists to match against) |
| Whether a recognition item is approved, corrected, or rejected | The doctor (human) | Never |
| Whether a `MedicationHistory` row is created at all | The doctor, via `create_medication_history_entry` | Never |
| `MedicationHistory.current_status` | Deterministically recomputed from `MedicationDecision`'s ledger | Never |
| Diagnosis, treatment recommendation, drug-interaction inference | Not produced by Holoscan at all (§5/ADR-024) | Never |
| Fail-closed enablement / rollout discipline | Patient/Doctor Module Registry + Module State (ADR-010, ADR-026) | Never |

---

# 14. Security Model

- **`patient_id` always `PatientSession`-derived**, never client-supplied, on every
  patient-writable route (§17) — the same unconditional rule every prior
  patient-writable feature already enforces.
- **`doctor_id` always `DoctorSession`-derived**, never client-supplied, on every
  doctor-guarded route.
- **Cross-identity-type rejection.** Every doctor-guarded route rejects a
  `PatientSession` token and vice versa, mirroring WPI-1's Stage 17 conformance
  precedent exactly.
- **Roster- and specialty-scoped.** A doctor may read or act on Holoscan/Medication data
  only for a patient present in that doctor's own derived roster
  (`DoctorPatientRoster.gs`, reused, never re-derived).
- **File-upload risk mirrors Report's own "highest-risk feature" discipline** (docs/29
  §8/§11) exactly — the same file-type/size validation, the same Drive-storage
  mechanism, no new file-handling pattern invented for Holoscan specifically.
- **Fail-closed enablement**, and disabled-by-default specifically for the doctor-facing
  review entry (ADR-010, ADR-026, §18).
- **Rate/volume-limited.** Mirroring docs/55 §10's identical concern for AI Assistant: a
  Holoscan recognition has real latency and real per-call model cost. A bounded
  per-patient, per-day submission ceiling is a named requirement (§6); the exact
  mechanism is an implementation-time detail, deliberately not locked down further here.
- **API key handling** reuses the existing `OPENROUTER_API_KEY` Script Property — no new
  secret-management mechanism.
- **No new write path into `MedicationHistory`/`MedicationDecision`** beyond the
  doctor's own separate, explicit actions — ADR-025, this freeze's central guarantee,
  mirroring ADR-022's role for AI Assistant.

---

# 15. Audit Trail

- `HoloscanRecognition` — created once, status-only transitions thereafter, permanent
  (no deletion mechanism named).
- `HoloscanRecognitionItem` — append-only except its single `doctor_decision` transition
  (exactly once), permanent, including every `extracted_*` field as originally produced
  by the model — the honest record of what the pipeline actually output, never
  overwritten even after a doctor's correction (the correction lives in
  `corrected_fields`, alongside, not in place of, the original extraction).
- `MedicationHistory` — created once by a doctor's deliberate action; `current_status`
  is the only field ever recomputed, always from the `MedicationDecision` ledger.
- `MedicationDecision` — strictly append-only forever, mirroring
  `InventoryTransaction.gs`'s own explicit discipline (docs/54 §19) — the complete audit
  history the clinic's own brief for this feature explicitly required.
- Uploaded images (`image_refs`) are retained permanently, mirroring Report's own "no
  automated deletion currently planned" precedent (docs/33 §3.3) — a disclosed,
  accepted cost, not an oversight.

---

# 16. Lifecycle, Deployment, Rollback, and Migration

**Lifecycle.** Every entity's state machine is fully specified in §11 above; no entity
in this freeze uses in-place mutation of a clinical fact — only append-only rows and
one narrowly-scoped, single-use status transition per entity (`HoloscanRecognition.status`,
`HoloscanRecognitionItem.doctor_decision`), mirroring every prior WPI/PXP entity's own
one-way-transition discipline.

**Deployment.** No schema exists yet — nothing is deployed by this document. A future
implementation batch would add four new Sheet tabs
(`HoloscanRecognitions`, `HoloscanRecognitionItems`, `MedicationHistory`,
`MedicationDecisions`), each following ADR-006's binding discipline: flat, typed-by-
convention columns, a stable server-generated UUID primary key, no per-patient tabs —
identical to every Sheet-backed entity shipped so far.

**Rollback.** Because both the patient-facing (`holoscan`) and doctor-facing
(`holoscan_review`) capabilities are fail-closed by registry-entry/module-state absence
(ADR-010, ADR-012, ADR-026), the safest rollback of a future implementation is simply
not registering — or de-registering — those two Module Registry entries, mirroring
Batch PXP-10's own Module Registry removal precedent (docs/33 §3.2) exactly: removing an
entry silently stops the corresponding card from rendering with zero change to
`renderDashboard()`/`filterEnabledModules()`/`dispatchLoaders()` on either dashboard,
while every already-written row (`HoloscanRecognition`, `HoloscanRecognitionItem`,
`MedicationHistory`, `MedicationDecision`) is retained untouched, exactly as Symptom Log
data was retained untouched at that same batch.

**Migration.** No existing entity's schema is widened, narrowed, or otherwise touched
by this document — every new entity is wholly additive. The one disclosed, deferred
migration-shaped decision named by this freeze is §12.1's Timeline Event integration
(the same `entry_type` enum-widening deferral `CarePlan` already made and disclosed at
PXP-7) — not required for Holoscan to function, and not performed by any future
implementation batch without its own separate, explicit decision to touch that frozen
file.

**Scale.** `MedicationHistory.current_status`'s recompute-from-ledger pattern is
structurally identical to `InventoryItem.quantity_on_hand`'s (WPI-7) — the platform's
already-proven, already-scale-reviewed (docs/54) `LockService`-protected mitigation for
exactly this shape of concurrent-write race is required here too, reused directly, not
re-derived or re-gated. No new Sheets-at-scale review is required by this freeze; docs/54's
existing clearance (Green at launch/Year 1, Yellow-adjacent through Year 5) already
covers this recompute-from-append-only-ledger shape generally, per docs/54 §13's own
stated pattern-level (not just Inventory-specific) applicability.

---

# 17. Router Additions (named only — no `FoundationRouter.gs` change made by this document)

| Dispatch case | Type | Guard | Notes |
|---|---|---|---|
| `submit_holoscan_recognition` | Write | Patient | Uploads image(s), creates one `HoloscanRecognition` row (`status: uploaded`), triggers the capture/recognition pipeline (§6-§9). |
| `get_holoscan_recognitions` | Read-only | Patient | Caller's own recognition history, including each item's extraction and review status. |
| `get_holoscan_review_queue` | Read-only | Doctor | Pending `HoloscanRecognitionItem` rows (`doctor_decision: pending`) across the caller's own derived roster. |
| `post_holoscan_recognition_decision` | Write (audit only) | Doctor | Records the caller doctor's one-way decision (approve / corrected-and-approve / reject) on ONE `HoloscanRecognitionItem` row they have roster access to. **Never writes to `MedicationHistory` or any other entity** (ADR-025). |
| `get_medication_history` | Read-only | Doctor (roster-scoped) and Patient (own record only) | Returns one patient's `MedicationHistory` rows plus each row's own `MedicationDecision` ledger. |
| `create_medication_history_entry` | Write | Doctor | The doctor's own, separate action (§10.3/ADR-025) — creates one `MedicationHistory` row, optionally referencing an approved `HoloscanRecognitionItem` as provenance/pre-fill. Rejects a `source_recognition_item_id` outside the caller's own roster, or one not in `approved`/`corrected_and_approved` state. |
| `record_medication_decision` | Write (append-only) | Doctor | Creates one new `MedicationDecision` row (continue / stop / replace / unknown) against a `MedicationHistory` row the caller has roster access to; deterministically recomputes `MedicationHistory.current_status`. |

All seven are additive — no existing dispatch case, route contract, or frozen file
changes.

---

# 18. Registry Additions (named only — no registry JSON/`.gs` change made by this document)

## 18.1 Patient Module Registry — `holoscan`
A future WPI-11 batch registers one new Patient Module Registry entry, structurally
identical to Report's/Check-In's own entries (ADR-012, PXP-3/PXP-4 precedent):
```
module_id:     "holoscan"
display_name:  "Medication Photo Scan" (illustrative; not fixed by this document)
data_source:   "get_holoscan_recognitions"
```
Fail-closed by `PatientModuleState` absence (ADR-010) — the same default every existing
Patient Module Registry entry already has; no new ADR is required for this half, since
ADR-010's existing guarantee already fully covers it.

## 18.2 Doctor Module Registry — `holoscan_review`
A future WPI-11 batch registers one new Doctor Module Registry entry:
```
capability_key:  "holoscan_review"
display_name:    "Holoscan Review" (illustrative; not fixed by this document)
data_source:     "get_holoscan_review_queue"
```
**Diverges from every entry except `ai_assistant`, per ADR-026:** this entry's
`DoctorModuleState` must remain absent (fail-closed, ADR-010) for every doctor by
default, and enabling it is a deliberate, disclosed, per-doctor administrative
decision — never a bulk/default rollout — the identical discipline ADR-023 already
established for `ai_assistant`, now extended to a second AI-output-review surface.

A `MedicationHistory` view is reachable from the same "Holoscan Review" card or a
companion "Medication History" card — this document does not fix which; either shape
satisfies ADR-020's registry-driven requirement equally, an implementation-time
presentation decision.

---

# 19. Dashboard Additions (named only — no `dashboard.js` change made by this document, either side)

## 19.1 Patient Dashboard ("My Health Journey") — new Holoscan card
- A photo-upload affordance (one or more images per submission), mirroring the Reports
  card's own upload-form precedent exactly (docs/44 §17's pattern reused, not
  reinvented).
- A recognition-history list showing each past submission's status (`uploaded` /
  `processing` / `completed` / `failed`) and, once reviewed, each item's decision —
  never showing a raw, un-reviewed candidate as if it were already part of the patient's
  medication record.
- Renders nothing when the `holoscan` registry entry or the patient's own
  `PatientModuleState` is disabled — the same fail-closed rendering discipline every
  existing patient card already follows.

## 19.2 Doctor Dashboard — new Holoscan Review card
- A roster-scoped review queue, reusing the existing Patient Roster card's own route
  for patient context — no new patient-lookup mechanism.
- A draft output area that **always** shows an explicit, un-dismissable
  "AI-recognized — not yet in Medication History" banner above any Approve/Correct/
  Reject control, mirroring AI Assistant's own "AI-generated draft — not saved" banner
  precedent exactly (docs/55 §14), so ADR-025's boundary is visible at the point of use.
- Approve/Correct/Reject controls call `post_holoscan_recognition_decision` only. On
  approval, the UI must explicitly direct the doctor to a separate "Add to Medication
  History" action (`create_medication_history_entry`) — no auto-navigation-with-silent-
  prefill in this v1, the identical disclosed restraint docs/55 §14 already applied to
  AI Assistant's own Accept action.
- Renders nothing when the `holoscan_review` registry entry or the doctor's own
  `DoctorModuleState` is disabled.

## 19.3 Doctor Dashboard — new Medication History card/page
- A roster-scoped, per-patient Medication History view (reusing the Patient Roster
  card's own patient-selection route), listing every `MedicationHistory` row with its
  current, deterministically-derived status and full `MedicationDecision` ledger.
- Continue/Stop/Replace/Unknown controls call `record_medication_decision` only —
  never implying a status changed until the doctor's own explicit action records it.

---

# 20. Validation Strategy

A future WPI-11 batch's validation suite (docs/53 §7/§13 Phase B) must, at minimum:
- Reject a `DoctorSession` token on every patient-guarded route, and a `PatientSession`
  token on every doctor-guarded route, mirroring WPI-1's Stage 17.
- Reject a `patient_id` outside the caller doctor's own derived roster on every
  doctor-guarded route.
- Reject the request when the relevant registry entry or the caller's own module state
  is disabled (fail-closed, ADR-010).
- Verify `HoloscanRecognitionItem.doctor_decision` transitions exactly once, one-way.
- Verify `MedicationDecision` rows are strictly append-only — no update/patch call
  anywhere in a future implementation's own code targeting that entity's Sheet (docs/54
  §19's identical requirement for `InventoryTransaction`).
- Verify `MedicationHistory.current_status` is always server-recomputed from the
  `MedicationDecision` ledger and is never accepted as a client-supplied value on any
  write route.
- Statically or structurally verify `post_holoscan_recognition_decision` never itself
  writes to any entity's Sheet beyond `HoloscanRecognitionItems` (§23 item 1).
- Verify `create_medication_history_entry` rejects a `source_recognition_item_id` not
  in `approved`/`corrected_and_approved` state, or outside the caller's own roster.
- Unit-test a future `HoloscanRecognitionCheck_()` against known-bad outputs (lexicon
  hits per §7.2's five prohibited categories), mirroring `AssistantDriftCheck_()`'s own
  existing test-coverage shape.
- Verify the per-patient submission rate/volume limit (§6/§14) actually rejects a
  request once its ceiling is reached, once its exact mechanism is chosen at
  implementation time.
- Verify file-type/size validation on upload mirrors Report's own existing, already-
  tested discipline exactly (no weaker validation introduced for a second file-upload
  feature).

---

# 21. Browser-Test Strategy

- The Holoscan (patient) card and the Holoscan Review / Medication History (doctor)
  cards each do not render at all when their own registry entry or module state is
  disabled — fail-closed, mirroring every existing dashboard card's own browser-test
  coverage.
- The "AI-recognized — not yet in Medication History" banner is present and visible
  before any Approve/Correct/Reject control becomes interactable.
- The Approve action's own UI copy never implies `MedicationHistory` was updated by
  that action alone — it must explicitly name the separate "Add to Medication History"
  step as still required.
- Continue/Stop/Replace/Unknown controls never imply a change occurred before the
  doctor's own explicit confirmation completes.
- Keyboard/accessibility parity with every existing dashboard card (tab order, focus
  handling), mirroring PXP-8's own keyboard-tab-order precedent.

---

# 22. Conformance Strategy

Mirrors docs/53 §13's existing three-phase batch workflow exactly, with one addition
specific to this freeze, mirroring docs/55 §17's identical requirement: a future WPI-11
implementation batch's Phase A self-review must be checked, section by section, against
this document (§4 through §19) before Phase B validation begins. Any divergence from
this document is a **documented amendment to this document**, filed the same way docs/53
§14 already requires architecture consistency to be verified for every batch — never a
silent deviation. In particular, any implementation-time choice this document
deliberately left open (the exact submission rate-limit mechanism, §6/§14; synchronous
vs. asynchronous pipeline execution, §6; the specific vision-capable model, §7.3; whether
Holoscan Review and Medication History render as one card or two, §18.2) must be
disclosed in that batch's own roadmap entry, the same disclosure convention every prior
WPI/PXP batch already followed for its own implementation-time decisions.

---

# 23. Static-Analysis Rules (new — mirrors docs/55 §18's identical AI-risk-class rationale)

1. **No Holoscan code path may call `MedicationHistory`'s or `MedicationDecision`'s
   write function directly, outside its own designated routes.** No file matching
   `Holoscan*.gs` may call any function matching `save*(`/`create*(`/`update*(`/
   `record*(` targeting `MedicationHistory`/`MedicationDecision` — only
   `create_medication_history_entry`'s and `record_medication_decision`'s own,
   separately-invoked implementation functions may do so, and neither may be called
   from any `Holoscan*.gs` file's own recognition-pipeline code path. A future
   validation suite must include a static grep-based check enforcing this — the
   identical, single most important static rule docs/55 §18 item 1 required for AI
   Assistant, now required again for the code-level guarantee behind ADR-025.
2. **No recognition prompt template may change without a version bump**, mirroring
   `PROMPT_VERSION_`'s/AI Assistant's own identical convention exactly.
3. **No new dispatch case may be reachable without the correct session type** — a
   static check confirming every patient-guarded route rejects a `DoctorSession` and
   vice versa, mirroring `FoundationRouteGuard.gs`'s existing convention.
4. **No context or candidate field may originate outside the caller's own
   roster/patient-ownership scope by construction** — a static check confirming no
   direct Sheet read bypasses `DoctorPatientRoster.gs`'s existing scoped derivation.
5. **No extracted or corrected field may be presented as a diagnosis, treatment
   recommendation, or drug-interaction claim** — a static lexicon check reusing/
   extending `HoloscanRecognitionCheck_()`'s own category lexicon (§10.2/§7.2) rather
   than inventing a second, parallel lexicon mechanism.

---

# 24. Risks

1. **The "one extra doctor click to actually save" friction (§10.3/ADR-025)**, the
   identical risk docs/55 §19 item 1 already named for AI Assistant, recurs here — named
   explicitly so any future shortcut remains a deliberate, reviewed ADR amendment, never
   a silent implementation choice.
2. **The Medicine Catalog gap (§0.3/§8)** bounds Holoscan's matching usefulness more
   than a fully-grounded recognition pipeline eventually could — an accepted, disclosed
   limitation, not an oversight; closing it requires a real Medicine Catalog plus a new
   ADR, both future work.
3. **Photograph quality is entirely outside this platform's control.** A blurry,
   partial, or poorly-lit photograph may yield low-confidence or entirely absent
   extraction for some or all fields — an inherent, disclosed limitation of any
   photo-based recognition pipeline, not a defect; the doctor's mandatory review (§10)
   is the platform's answer to this risk, not a higher-accuracy model.
4. **Rate/volume-limit mechanism is deliberately unspecified (§6/§14)** — a real
   implementation risk if skipped rather than merely deferred, the identical concern
   docs/55 §19 item 2 already named for AI Assistant's own rate limit.
5. **Retained images and extracted text duplicate potentially sensitive personal data
   at rest** (a photographed medicine label may itself disclose a condition) — an
   accepted cost of the feature's own core mechanism (the photograph *is* the input),
   at the same doctor/staff-and-patient-only access level every other patient-uploaded
   file (Report) already carries, not a new class of exposure.
6. **Disabled-by-default doctor review (ADR-026) slows adoption relative to every
   purely-informational Doctor Module Registry entry** — a deliberate, accepted
   consequence of Holoscan's model-output-review risk profile, not an oversight, the
   identical trade-off ADR-023 already accepted for AI Assistant.
7. **`MedicationHistory` and `DoctorInstruction`(type: `medicine`) can diverge** (a
   patient's actual medication use, per Holoscan, may not match what this clinic
   prescribed) — named explicitly (§0.2) as an intentional, honest reflection of
   reality rather than a defect to reconcile automatically; reconciliation, if ever
   wanted, is a future doctor-facing feature requiring its own design, not silently
   assumed here.

---

# 25. Documentation Impact

- `docs/33-DOMAIN-MODEL.md` — §7.7 updated to disclose Holoscan's architecture-frozen
  (not implemented) status, replacing "Holoscan remains named, not designed"; four new
  entity subsections (`HoloscanRecognition`, `HoloscanRecognitionItem`,
  `MedicationHistory`, `MedicationDecision`), all *Designed*, not *Implemented*; Summary
  Table rows added.
- `docs/31-ADR-INDEX.md` — ADR-024, ADR-025, ADR-026 added.
- `docs/24-ROADMAP.md` — WPI-11 entry updated to disclose the architecture freeze,
  explicitly still not authorizing implementation.
- Root `CHANGELOG.md` — one documentation-only entry for this architecture-freeze pass,
  mirroring docs/55's own "WPI-10 Architecture Freeze" CHANGELOG entry shape exactly.
- `docs/49/50/51/52/53/54/55` — **not modified.** This document is additive to all of
  them, the same relationship docs/55 has to docs/49/50.

---

# 26. What This Freeze Does Not Do

(Restated from §5 in governance-document form, mirroring docs/55 §21's closing
structure exactly.)

- Does not implement any code, schema, registry entry, router case, or dashboard card.
- Does not authorize WPI-11 to begin implementation — a separate, explicit approval is
  still required, per docs/53 §9/§13/§15, unchanged.
- Does not build, or commit to a timeline for, a real Medicine Catalog (§0.3/ADR-024).
- Does not scope a drug-interaction checker (§12.5) or Phase 2C/2D.
- Does not read, match against, or write `InventoryItem`, `InventoryTransaction`, or
  `PillFillOrder` (§0.2).
- Does not widen, edit, or reinterpret any existing Accepted ADR — ADR-024/025/026 are
  new, complementary records, per ADR-007's "supersede, never silently edit" rule.
- Does not pick a vision model, a rate-limit mechanism, or a final decision on whether
  Holoscan Review and Medication History render as one dashboard card or two — each is a
  named, disclosed, implementation-time decision (§7.3, §6/§14, §18.2), not a gap in
  this freeze.
- Does not scope WPI-12 (Closeout) or any phase beyond WPI-11.

---

# Summary of Decisions This Freeze Makes

- Defines Holoscan (WPI-11) as the **Patient Medication Recognition Engine**: a
  patient-initiated photo-capture pipeline producing doctor-reviewed medication
  candidates, per the clinic's own supplied purpose — replacing the prior "named, not
  designed" placeholder status (docs/49 §9, ADR-019) for this item specifically.
- Bounds recognition to what is literally visible in the uploaded image(s), never a
  diagnosis, treatment recommendation, or drug-interaction claim (§0.3, §5, ADR-024),
  and names the platform's still-unbuilt Medicine Catalog as an honest, disclosed gap
  rather than an invented workaround.
- Establishes that Holoscan never gains a write path into `MedicationHistory` or
  `MedicationDecision` — every recognition is a non-persisting draft; an approved
  recognition still requires the doctor's own, separate, existing write action to
  become a permanent record (§10.3, ADR-025), and every later clinical status change
  is its own doctor-authored, append-only decision (§10.4).
- Designs `MedicationHistory`'s `current_status` as a derived, recomputed-from-ledger
  field, reusing `InventoryItem`/`InventoryTransaction`'s own already-proven,
  already-scale-reviewed pattern (WPI-7, docs/54) rather than inventing a new one.
- Makes the `holoscan_review` Doctor Module Registry entry disabled-by-default,
  mirroring `ai_assistant`'s own precedent exactly (§18.2, ADR-026), while the
  patient-facing `holoscan` entry inherits the existing Module Registry fail-closed
  default with no new ADR required.
- Defines four new Sheet-backed entities (`HoloscanRecognition`,
  `HoloscanRecognitionItem`, `MedicationHistory`, `MedicationDecision`, §11), all
  *Designed*, none implemented.
- Names seven new router dispatch cases, two new registry entries, and three new
  dashboard cards, all specified but none built (§17-§19).
- Requires a new static-analysis rule class (§23) and validation/browser-test additions
  (§20-§21) a future implementation batch must satisfy.
- Explicitly disambiguates `MedicationHistory` from the existing `DoctorInstruction`
  (type: `medicine`) entity (§0.2), naming their possible divergence as an accepted,
  honest reality rather than a defect.
- **Authorizes nothing beyond the architecture itself.** WPI-11 implementation still
  requires its own separate, explicit approval.
