# 55 - WPI-10 AI Assistant Architecture Freeze
## Version 1.0 — 2026-07-10

> Architecture freeze only. No code, no schema, no registry entry, no router case, no
> dashboard card, no Apps Script file, no frontend file is touched by this document.
> Written per ADR-019's own "Future Considerations": *"When AI Assistant... [is]
> eventually proposed for real, each requires its own technical plan and, per
> ADR-001/004/005/013's existing pattern, likely its own feature-specific ADRs."* This
> is that technical plan. docs/49 §9, docs/50 §13/§19, and docs/33 §7.7 all named AI
> Assistant "reserved, unscoped" — none of those documents is reopened, edited, or
> contradicted here; this document is additive, the same relationship docs/50 has to
> docs/49, or ADR-018 has to ADR-012. WPI-1 through WPI-9 remain exactly as shipped and
> frozen; nothing in this freeze depends on, or changes, any of them beyond reading their
> already-shipped, already-authenticated data.

---

# 0. Framing

The prior gate — docs/50 §19's "reserved, unscoped placeholder... not ready for any
scoping" — is closed by this document for the *architecture* question only. **This does
not authorize WPI-10 implementation.** Per docs/53 §9/§13/§15 (mirroring docs/47 §15),
Architecture Freeze and Implementation are separate, sequential phases; this document
completes the first for AI Assistant specifically and leaves the second exactly as
gated as every other WPI batch: requiring its own separate, explicit approval before a
single line of `apps-script/*.gs`, `shared/schemas/*.schema.json`,
`shared/constants/*.json`, or `doctor-dashboard/*` is touched.

## 0.1 What "AI Assistant" means in this document, and what it does not

Two different "AI Assistant" ideas exist in the platform's own documents and must not be
conflated:

1. **docs/22's "Website AI Assistant"** — listed under "Future Integrations," a
   patient-facing capability, entirely unscoped, not addressed by this document at all.
2. **docs/50 §19's WPI-10 "AI Assistant"** — a batch slot inside WHIMS, the doctor- and
   operations-facing phase (docs/49 §3's "doctor/operations-facing mirror" of Phase 2B).
   **This document scopes only this one** — a doctor-facing capability inside the
   already-frozen Doctor Dashboard (ADR-020), reachable only through a `DoctorSession`,
   with zero patient-facing surface, mirroring every WPI-1 through WPI-9 batch's own
   "doctor/staff only" discipline exactly.

Any future patient-facing AI capability remains exactly as unscoped as it was before
this document — named, not designed, per ADR-019, requiring its own, separate,
future architecture-freeze pass.

## 0.2 The Knowledge Engine gap, named up front

ADR-001 requires every AI output be traceable to Knowledge-Engine-approved content, but
ADR-001's own "Future Considerations" already discloses: *"A formal Knowledge Engine
implementation (structured storage, versioning, retrieval) does not exist yet."*
docs/33's Summary Table lists both Knowledge Article and Knowledge Engine as
*Conceptual, Unassigned*. This freeze does not build one — inventing a Knowledge Engine
as a side effect of an AI Assistant freeze would itself be undesigned scope creep. §5
below and ADR-021 resolve this the only honest way available: AI Assistant's retrieval
scope for this freeze is bounded to data that already exists and is already
traceable — the patient's own stored record — never a knowledge base that isn't built.

---

# 1. Scope Decision

Following docs/49 §1's own dependency-order test: AI Assistant's architecture depends on
Doctor Identity (WPI-1), Doctor Dashboard (WPI-4), and the registry-driven pattern
(ADR-020) — all shipped and frozen (see the prior turn's Architecture Readiness Report,
confirmed again at §2 below). It does **not** depend on Health Milestones (Phase 2C),
the Digital Twin (Phase 2D), Holoscan (WPI-11), or a real Knowledge Engine — each of
those remains exactly as open and unscoped as before. This freeze may proceed on
dependency grounds alone, the same test PXP-10 and Phase 3 itself already passed.

---

# 2. Dependency Confirmation (carried forward, not re-litigated)

| Dependency | Status |
|---|---|
| Doctor Identity & Session (WPI-1) | Implemented, frozen |
| Doctor Module Registry / Doctor Dashboard (WPI-3/WPI-4) | Implemented, frozen |
| Specialty Registry (WPI-2) | Implemented, frozen |
| Appointment (WPI-5) | Implemented, frozen |
| Notification (WPI-6) | Implemented, frozen |
| Inventory (WPI-7) | Implemented, frozen |
| PillFill Integration (WPI-8) | Implemented, frozen |
| Analytics (WPI-9) | Implemented, frozen |
| Care Plans / Doctor Instruction (PXP-7) | Implemented, frozen |
| Check-ins (PXP-5) | Implemented, frozen |
| Calculator Results (PXP-6, backend only) | Implemented, frozen |
| Knowledge Engine | **Conceptual, unbuilt** — scoped out of this freeze, §0.2/§5/ADR-021 |

No gap blocks the architecture work in this document. The Knowledge Engine gap blocks
only a *future, broader* AI Assistant retrieval scope, not this one.

---

# 3. Governing ADRs

This freeze is bound by every existing AI/clinical-authority ADR, unchanged, plus three
new, narrowly-scoped ADRs this document requires:

- **ADR-001** (Knowledge Engine primary source) — governs §5/§6.
- **ADR-004** (Digital Twin never diagnoses/treats) — governs §7/§8 (the same content
  boundary, applied to a doctor tool instead of a patient-facing one).
- **ADR-005** (AI always under doctor supervision) — governs §8 (the reference
  three-part pattern: prompt constraint, code-level check, mandatory human review).
- **ADR-010** (security before convenience / fail-closed) — governs §6/§13.
- **ADR-013** (calculators deterministic, never AI) — unaffected; AI Assistant never
  touches `CalculatorResult.result_value`, only reads it (§9.3).
- **ADR-017/018/020** — Doctor Identity, specialty scoping, registry-driven dashboard —
  reused as-is, no amendment.
- **ADR-019** — the platform-wide "reserve, don't implement" rule this whole document
  exists to satisfy.
- **ADR-021** (new) — AI Assistant's retrieval boundary (§5).
- **ADR-022** (new) — AI Assistant's non-persisting-draft supervision boundary (§8).
- **ADR-023** (new) — the `ai_assistant` registry entry's disabled-by-default rollout
  discipline (§13).

---

# 4. Component Diagram

```
DoctorSession (ADR-017, frozen)
      |
      v
Doctor Dashboard (doctor-dashboard/dashboard.js, ADR-020, frozen)
      |  registry-driven consumer of:
      v
Doctor Module Registry -- new entry: ai_assistant (§13), disabled by default (ADR-023)
      |
      v
AI Assistant Card (new dashboard card, spec only -- §14)
      |
      v
FoundationRouter.gs -- three new dispatch cases, doctor-guarded only (§12)
      |
      +--> get_ai_assistant_capabilities   (read-only; fixed capability list, §11.2)
      |
      +--> post_ai_assistant_query         (invoke one bounded capability)
      |        |
      |        v
      |     AssistantContextBuilder (deterministic, non-AI, §6)
      |        reads, roster- and specialty-scoped, read-only, via each entity's own
      |        EXISTING scoped reader function -- never a new direct Sheet read:
      |        - CarePlan / DoctorInstruction   (CarePlan.gs, DoctorInstruction.gs)
      |        - CheckInResponse                (CheckInResponse.gs)
      |        - CalculatorResult               (CalculatorResult.gs)
      |        - InventoryItem/Transaction       (InventoryItem.gs, InventoryTransaction.gs)
      |        - PillFillOrder                  (PillFillOrder.gs)
      |        - Appointment                    (Appointment.gs)
      |        - Notification (read-only)       (Notification.gs)
      |        - Analytics' own computed sections (Analytics.gs, reused not re-derived)
      |        |
      |        v
      |     Prompt Orchestrator (deterministic template assembly, §7)
      |        |
      |        v
      |     AI Model Call (mirrors Ai.gs's callOpenRouterSummary_ pattern exactly, §7.3)
      |        |
      |        v
      |     AssistantDriftCheck_() (mirrors flagDrift_(), independent of prompt, §8.2)
      |        |
      |        v
      |     AIAssistantInteraction row written (doctor_decision = 'pending', §11.1)
      |        |
      |        v
      |     Draft returned to the Doctor Dashboard, labeled "AI-generated draft --
      |     not saved" (§8.3, §14)
      |
      +--> post_ai_assistant_decision      (doctor accepts/edits/rejects; records the
               decision on the interaction row ONLY -- §8.3, §11.1)
                    |
                    v
             If accepted, the doctor separately opens the TARGET entity's own,
             already-existing, already-authenticated authoring surface (CarePlan's
             own authoring path, Notification's own record function, etc.) to
             actually persist anything. AI Assistant itself never gains a write
             path into any clinical entity (ADR-022, the load-bearing boundary of
             this whole freeze).
```

---

# 5. Retrieval Strategy (ADR-021)

AI Assistant's *only* retrieval source, for this freeze, is the calling doctor's own
roster- and specialty-scoped slice of already-stored, structured platform data — never
an unstructured knowledge base, article corpus, or the model's own general/training
knowledge. Every field the Context Builder assembles is a literal value copied from an
existing entity; nothing is paraphrased, summarized, or interpreted before it reaches
the prompt step. This keeps retrieval and generation cleanly separated (retrieval is
100% deterministic code; generation is the model's only job), mirrors `Ai.gs`'s existing
"the model receives only the note, nothing else" simplicity, and makes ADR-001's
traceability requirement trivially satisfiable: every fact in the assembled context has
a named source entity + field, and the drift check (§8.2) can verify against that
context directly rather than against an open-ended knowledge base.

This deliberately means AI Assistant v1 cannot answer general clinical-knowledge
questions ("what does this diagnosis usually mean") — only "what does this patient's
own record say." Extending retrieval to a real Knowledge Engine, once one exists, is
future work requiring its own ADR extending ADR-021, not a default this freeze grants.

---

# 6. Context Builder

`AssistantContextBuilder` (conceptual name for the future implementation batch;
`apps-script/AIAssistantContext.gs` is a natural home, not a filename this document
mandates) is pure, deterministic, non-AI code with one job: given a `doctor_id`
(session-derived, never client-supplied) and an optional `patient_id`, assemble a
bounded, flat JSON object of already-stored fields relevant to the requested capability
— and reject the request outright if `patient_id` is supplied but not present in that
doctor's own roster (`DoctorPatientRoster.gs`'s existing
`foundationGetDoctorPatientRoster_()`, reused, never re-derived, the same discipline
Analytics/Inventory/PillFill already established at WPI-7/8/9).

Rules, all enforced in code, none left to the prompt:
- **Roster-scoped.** A `patient_id` outside the caller's own derived roster is rejected
  before any read happens — never silently filtered after the fact.
- **Specialty-scoped.** Reuses each entity's own existing specialty-derivation view
  (`InventoryItem.gs`'s, `PillFillOrder.gs`'s), never a new derivation.
- **Capability-bounded.** Each `capability_key` (§11.2) declares its own fixed
  `context_sources` allow-list; the builder reads only what that capability declares —
  a `summarize_patient_status` call never pulls Inventory data, for example, even though
  the builder *could* technically reach it. No capability may request "everything."
  the caller's own roster.
- **Size-bounded, flat, deterministically serialized** — the same JSON storage
  discipline docs/44 §11.4 already established for `CheckInResponse`/`CalculatorResult`,
  applied here to a request payload instead of a stored row.
- **Read-only.** The builder never writes anything — not even the audit row, which is
  written after the model call returns (§8.2), not before.

---

# 7. Prompt Orchestration

A capability-specific, version-controlled prompt template (mirroring
`apps-script/PROMPTS.md`'s existing role as "the canonical, version-controlled source of
truth" and `Ai.gs`'s `PROMPT_VERSION_` convention) assembles the Context Builder's
output into a single, bounded request. No capability is a general chat turn:

## 7.1 No conversation, no memory
Every invocation is one bounded request/response. There is no multi-turn chat history,
no session-carried model memory, and no free-text doctor prompt field in this freeze's
scope — the doctor selects a fixed `capability_key` (§11.2) and, where the capability
calls for it, supplies a small number of *structured* inputs (e.g., a short bullet list
for `draft_care_plan_note`), never an open text box that becomes the entire prompt. This
is a deliberate, disclosed restraint: an open-ended chat surface is a materially
different, harder-to-govern feature than a fixed menu of bounded actions, and nothing in
docs/49/50's naming of "AI Assistant" commits this platform to building a chatbot. A
future, separately-approved, separately-ADR'd expansion toward free-form doctor
questions is not precluded by this document, but it is not what this freeze authorizes.

## 7.2 Numbered-rule system prompt, per capability
Each capability's system prompt is a `SUMMARY_SYSTEM_PROMPT_`-style, numbered-rule
specification (version-controlled in a future `apps-script/AI-ASSISTANT-PROMPTS.md`,
mirroring `PROMPTS.md`'s exact role), forbidding, at minimum:
1. Any diagnosis, condition name, or clinical interpretation not already present in the
   assembled context (ADR-001/ADR-004).
2. Any treatment, medicine, or dosage recommendation not already present in the
   assembled context (ADR-004, and never touching `CalculatorResult.result_value`
   itself — ADR-013).
3. Any prognosis, outcome prediction, or reassurance not already present in the
   assembled context (ADR-004).
4. Anything not directly traceable to a specific field in the assembled context — the
   same "delete the sentence if you can't point to its source" rule `Ai.gs`'s prompt
   already enforces.
5. Fixed, bounded output format per capability (plain short text for
   `summarize_patient_status`/`draft_care_plan_note`; a small structured flag list for
   `flag_checkin_anomalies`) — never markdown, headers, or a variable-shaped response
   the code-level check (§8.2) can't reliably parse.

## 7.3 Model call
Reuses the existing `PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY')`
/ `UrlFetchApp.fetch` pattern `Ai.gs`'s `callOpenRouterSummary_()` already established —
no new secret-management design, no new provider integration. `CONFIG.AI.MODEL`,
`CONFIG.AI.TEMPERATURE`, and `CONFIG.AI.MAX_OUTPUT_TOKENS` are reused or extended with
capability-specific overrides at implementation time; this freeze does not pick a model.

---

# 8. Doctor Supervision Model (ADR-005, ADR-022)

The three-part pattern ADR-005 declares the **reference implementation, not merely
inspiration** for every future AI feature, applied here in full:

## 8.1 Prompt-level constraint
§7.2's numbered rules, per capability, version-controlled.

## 8.2 Independent code-level check — `AssistantDriftCheck_()`
A capability-agnostic function, structurally identical to `flagDrift_()`:
- **Category lexicon check** — flags output containing prohibited-category phrases
  (diagnosis, prescription/dosage, investigation-ordering, reassurance, conclusion —
  the same six categories `DRIFT_LEXICON_` already enumerates) that do not appear
  anywhere in the assembled context.
- **Per-sentence traceability/overlap check** — any output sentence whose substantive
  words barely overlap the assembled context's own vocabulary is flagged
  low-traceability, mirroring `sentenceOverlap_()` exactly, run against the Context
  Builder's JSON (flattened to text) instead of a single free-text note.
- **Advisory, never blocking** — flags are stored in `AIAssistantInteraction.ai_output_flags`
  (§11.1) and shown to the doctor alongside the draft; they never auto-reject or
  auto-edit the output, because the human review gate (§8.3) already sits between any
  draft and any effect, exactly as `flagDrift_()`'s own doc comment already reasons.

## 8.3 Mandatory human review and approval — the load-bearing boundary (ADR-022)
No AI Assistant output ever writes to any clinical entity. Every draft is held only in
the `AIAssistantInteraction` row and the doctor's own screen until the doctor calls
`post_ai_assistant_decision` (§12) to record accept / edited-and-accept / reject.
**Acceptance records the decision only — it never itself persists anything into the
target entity.** If the doctor wants an accepted draft to become real (a new
`CarePlan` version, a `Notification`, anything), the doctor separately uses that target
entity's own existing, already-authenticated write path, exactly as if AI Assistant had
never been involved — AI Assistant only prefilled what the doctor would otherwise have
typed by hand. AI Assistant gains **zero** new write authority over any clinical entity.
This is ADR-022 in full and is this freeze's single most important boundary — every
other design choice in this document exists to make this one guarantee easy to verify
and hard to accidentally erode.

---

# 9. Deterministic vs. AI Responsibility Split

| Concern | Deterministic (code) | AI (model) |
|---|---|---|
| Which patient/records are visible at all | `AssistantContextBuilder` (roster + specialty scoping) | Never |
| What data enters the prompt | `AssistantContextBuilder` | Never |
| Drafting summary/note language | Never | Prompt Orchestrator -> model call |
| Traceability / prohibited-category flagging | `AssistantDriftCheck_()` | Never |
| Whether a draft is accepted, edited, or rejected | The doctor (human) | Never |
| Whether, and where, anything is actually persisted | The doctor, via the target entity's own existing write path | Never |
| Fail-closed enablement / rollout discipline | Doctor Module Registry + `DoctorModuleState` (ADR-010, ADR-023) | Never |
| `CalculatorResult.result_value` itself | The existing deterministic formula layer (ADR-013, untouched) | Never |

## 9.1 System-by-system interaction detail

### 9.1.1 Analytics (WPI-9)
Read-only reuse of `Analytics.gs`'s own six computed sections as high-level trend
context (e.g., "this doctor's check-in completion rate this month") for
`summarize_patient_status`-class capabilities. AI Assistant never computes its own
aggregate — it reads Analytics' output exactly as already computed, never
re-implementing or overriding it.

### 9.1.2 Care Plans (PXP-7)
Reads the patient's current `active` `CarePlan` version and its attached
`DoctorInstruction` rows (`CarePlan.gs`/`DoctorInstruction.gs`'s existing readers).
`draft_care_plan_note` may produce draft goal/note text a doctor can use as a starting
point for the plan's *next* version — it never creates, versions, or supersedes a
`CarePlan` row itself; that remains `CarePlan.gs`'s own authoring path exclusively
(§8.3).

### 9.1.3 Check-ins (PXP-5)
Reads `CheckInResponse` completion/answer data, scoped by `condition_slug` ->
specialty exactly as `Analytics.gs`'s own `check_in_completion` section already derives
it (reused, not re-implemented). `flag_checkin_anomalies` is deliberately
**deterministic-first**: missed-check-in counts and answer-value trend flags are
computed the same way Analytics computes its own counts (no model call at all for the
raw flags), with an *optional* AI-rephrased plain-language explanation layered on top of
already-deterministic flags — mirroring ADR-013's own "a future feature that explains a
calculator's result in AI-rephrased language... is not prohibited... but must
independently satisfy ADR-001/ADR-005" pattern, applied to a check-in flag instead of a
calculator result.

### 9.1.4 Calculator Results (PXP-6)
Read-only. AI Assistant may reference a patient's `CalculatorResult` history as context
("this patient's most recent score was X") but **never computes, adjusts, interprets, or
overrides `result_value`** — that field remains exclusively the deterministic formula
layer's output, unconditionally, per ADR-013 (unaffected and unamended by this freeze).

### 9.1.5 Inventory (WPI-7)
Read-only reuse of `InventoryItem.gs`'s specialty-scoped view, including its computed
`low_stock` boolean. A capability may surface "this patient's remedy is low stock" as
advisory context. AI Assistant never calls `InventoryTransaction.gs`'s write path —
stock levels are never affected by any AI Assistant action, directly or indirectly.

### 9.1.6 PillFill (WPI-8)
Read-only reuse of `PillFillOrder.gs`'s specialty-scoped view (order status, fulfillment
history) as context. AI Assistant never creates, fulfills, or cancels a `PillFillOrder`
— zero interaction with `InventoryTransaction.gs`'s `LockService`-protected dispense
path, directly or indirectly.

### 9.1.7 Appointments (WPI-5)
Read-only reuse of `Appointment.gs`'s existing reader for a patient's appointment
history/upcoming schedule, as scheduling context. AI Assistant never creates,
reschedules, or cancels an `Appointment`.

### 9.1.8 Notifications (WPI-6)
Read-only only, and only of a patient's own `Notification` history as context (e.g., "a
low-stock notification already went out for this patient's remedy") where a capability's
`context_sources` allow-list includes it. **AI Assistant never sends a Notification and
never calls `foundationRecordNotification_()`** — mirroring docs/50 §9's own "a shared
record of what was sent, never a new delivery pipeline" boundary exactly. If an accepted
AI Assistant draft logically implies a notification should go out, the doctor triggers
it through whatever existing path already triggers that Notification type today — no new
send flow is introduced by this freeze, for the same reason no new write path is
introduced anywhere else in §9.1.

---

# 10. Security Model

- **`doctor_id` always `DoctorSession`-derived**, never client-supplied — the same
  unconditional rule every WPI-1 through WPI-9 route already enforces.
- **Zero patient-facing surface.** Every new route (§12) is doctor-guarded only; a
  `PatientSession` token must be rejected on all three, the same conformance-proven
  cross-identity-rejection precedent WPI-1's Stage 17 established.
- **Roster- and specialty-scoped**, never cross-doctor, never cross-specialty (§6).
- **Fail-closed enablement**, and disabled-by-default specifically for this entry
  (ADR-010, ADR-023, §13).
- **Rate-limited.** Unlike every prior WPI-era read route, an AI Assistant call has real
  latency and real per-call cost (an outbound model API call). A bounded per-doctor,
  per-day invocation ceiling is a **named requirement** of this freeze; the exact
  mechanism (a simple daily counter row, keyed by `doctor_id` + UTC date, is the natural
  fit mirroring `LoginToken`/`DoctorLoginToken`'s own single-use-row precedent) is an
  implementation-time detail this document deliberately does not lock down further,
  the same "named, not over-specified" restraint docs/49 already applied to the
  Sheets-migration trigger (ADR-006).
- **API key handling** reuses the existing `OPENROUTER_API_KEY` Script Property — no new
  secret-management mechanism.
- **No new write path into any clinical entity** — §8.3/ADR-022, this freeze's central
  guarantee.

---

# 11. New Entities (Designed, not Implemented — no schema file exists yet)

## 11.1 `AIAssistantInteraction` (Sheet-backed entity — the audit/decision log)

| Field | Type | Notes |
|---|---|---|
| `interaction_id` | string (UUID) | Server-generated identity column, mirrors every other `_id` primary key. |
| `doctor_id` | string | `DoctorSession`-derived only, never client-supplied. |
| `patient_id` | string, nullable | Roster-validated at creation (§6) when present; null for roster-wide capabilities with no single patient target. |
| `capability_key` | string | References a fixed, registry-declared capability (§11.2). Never free text. |
| `context_snapshot` | string (JSON) | The exact, flat, size-bounded context object the Context Builder assembled and sent to the model — stored for audit/traceability, mirroring `CalculatorResult.input_snapshot`'s own "store what produced this result" precedent, applied to AI Assistant's own input instead. |
| `prompt_template_version` | string | Matches the version-controlled prompt spec (§7.2), mirrors `PROMPT_VERSION_`. |
| `model` | string | Mirrors `CONFIG.AI.MODEL`. |
| `ai_output` | string | The model's raw draft output. Never auto-applied anywhere (§8.3). |
| `ai_output_flags` | string (JSON array) | `AssistantDriftCheck_()`'s advisory flags (§8.2). Empty array, not null, when clean. |
| `doctor_decision` | string enum | `pending` \| `accepted` \| `edited_and_accepted` \| `rejected` \| `ignored`. Always `pending` at creation; transitions one-way, exactly once, mirroring `DoctorAssignedCondition`/`DoctorInstruction`'s existing one-way-status-transition precedent. |
| `decision_notes` | string, nullable | Optional doctor rationale. |
| `target_entity_type` | string, nullable | Recorded only if/when the doctor separately persists an accepted draft elsewhere — purely observational, never written by AI Assistant's own logic, never a live foreign key AI Assistant enforces (§8.3). |
| `target_entity_id` | string, nullable | Same provenance as `target_entity_type` — the doctor supplies both, after the fact, via `post_ai_assistant_decision`, if they choose to. |
| `created_at` | string (ISO 8601) | Server-set. |
| `decided_at` | string, nullable (ISO 8601) | Server-set at the moment `doctor_decision` transitions away from `pending`. |

Append-only except for the single `doctor_decision`/`decision_notes`/`target_entity_*`/
`decided_at` transition — the same shape `Appointment`'s and `DoctorInstruction`'s own
one-way lifecycle already established, applied to a decision instead of a status.

## 11.2 AI Assistant Capability Registry (config list, not a Sheet-backed schema — structurally parallel to Calculator Registry, mirroring calculator-registry.json's own "availability, not enablement" framing)

| Field | Notes |
|---|---|
| `capability_key` | Stable slug, e.g. `summarize_patient_status`. |
| `display_name` | Doctor-facing label. |
| `description` | Doctor-facing explanation of what the capability does and does not do. |
| `context_sources` | Explicit allow-list of entity types this capability's Context Builder call may read (§6) — never "all." |
| `output_shape` | `draft_text` \| `structured_flags` — constrains what the drift check (§8.2) expects to parse. |
| `target_entity_type` | Nullable — which existing entity's own write path an accepted draft would feed into, if any (purely descriptive; enforces nothing by itself — ADR-022 is the actual enforcement). |
| `requires_knowledge_engine` | Boolean, **must be `false`** for every entry in this freeze's scope (§5/ADR-021) — reserved for a future entry once a real Knowledge Engine exists. |
| `future_ai_capable` | Present for consistency with every other registry's reserved field (docs/44 §7.1/§8.1/§11.5, ADR-019) — always `false` here too; this registry does not reserve capability *for itself* to become more AI-capable than designed, it reserves the *other* registries' own fields, unchanged. |

**Illustrative, unregistered capabilities** (named the same way docs/50 §7.1 named
illustrative, unregistered Doctor Module Registry capabilities before any of them were
built — none of the three below is registered by this document, and whether a future
WPI-10 batch ships zero or one seeded entry is an implementation-time decision this
freeze does not mandate, mirroring the WPI-3-empty/WPI-4-first-entry split precedent):

1. `summarize_patient_status` — `context_sources`: care_plan, check_in_response,
   calculator_result, appointment. `output_shape`: draft_text. `target_entity_type`:
   null (pure read/display, never persisted anywhere).
2. `draft_care_plan_note` — `context_sources`: care_plan, doctor_instruction,
   check_in_response. `output_shape`: draft_text. `target_entity_type`: `care_plan`
   (doctor must still use `CarePlan.gs`'s own existing authoring path to save it, §8.3).
3. `flag_checkin_anomalies` — `context_sources`: check_in_response, calculator_result.
   `output_shape`: structured_flags. `target_entity_type`: null. Deterministic-first
   per §9.1.3 — the AI layer here is optional rephrasing of already-computed flags, not
   the source of the flags themselves.

---

# 12. Router Additions (named only — no `FoundationRouter.gs` change made by this document)

| Dispatch case | Type | Notes |
|---|---|---|
| `get_ai_assistant_capabilities` | Read-only | Returns the fixed capability list (§11.2), doctor-guarded, mirrors `get_doctor_module_states`'s shape. |
| `post_ai_assistant_query` | Write (audit only) | Invokes one `capability_key` for an optional roster `patient_id`; runs §6-§8's full pipeline; writes one `AIAssistantInteraction` row (`doctor_decision: 'pending'`); returns the draft + flags. Doctor-guarded only; rejects any `PatientSession` token (§10). Rate-limited (§10). |
| `post_ai_assistant_decision` | Write (decision only) | Records the caller doctor's one-way decision transition on an interaction row they own (§11.1). **Never writes to any other entity.** Doctor-guarded only. |

All three are additive — no existing dispatch case, route contract, or frozen file
changes.

---

# 13. Registry Additions (named only — no `shared/constants/doctor-module-registry.json` change made by this document)

A future WPI-10 batch registers exactly one new Doctor Module Registry entry:

```
capability_key:  "ai_assistant"
display_name:    "AI Assistant"
display_order:   60
data_source:     "get_ai_assistant_capabilities"
future_ai_capable: false   (consistent with every existing entry's reserved field —
                             this entry IS the AI-capable one; the field on every OTHER
                             entry stays reserved and unpopulated, unchanged)
```

**Diverges from every prior entry in exactly one way, per ADR-023:** this entry's
`DoctorModuleState` must remain absent (fail-closed, per ADR-010) for every doctor by
default, and enabling it is a deliberate, disclosed, per-doctor administrative decision
— never a bulk/default rollout, unlike the "enable whenever convenient" treatment every
prior entry (`patient_roster`, `appointments`, `inventory`, `pillfill_orders`,
`analytics`) has received so far.

---

# 14. Dashboard Additions (named only — no `doctor-dashboard/dashboard.js` change made by this document)

One new, registry-driven card, structurally parallel to the existing five cards (no
hardcoded per-capability rendering logic added to `renderDashboard()`):
- A capability picker constrained to `get_ai_assistant_capabilities`'s fixed list —
  never a free-text prompt box (§7.1).
- A roster-patient selector reusing the existing Patient Roster card's own data — no new
  patient-lookup mechanism.
- A draft output area that **always** shows an explicit, un-dismissable "AI-generated
  draft — not saved" banner above any Accept/Edit/Reject control, so the boundary in
  §8.3 is visible at the point of use, not just documented.
- Accept/Edit/Reject controls call `post_ai_assistant_decision` only. On acceptance, the
  UI must explicitly direct the doctor to the target entity's own existing authoring
  page — no auto-navigation-with-silent-prefill in this v1 (a disclosed, deliberately
  simple starting point; a smoother prefill UX is a possible future, separately-approved
  refinement per ADR-022's own "Future Considerations," not a gap in this freeze).
- Renders nothing at all when the registry entry or `DoctorModuleState` is disabled —
  the same fail-closed rendering discipline every existing card already follows.

---

# 15. Validation Strategy

A future WPI-10 batch's validation suite (docs/53 §7/§13 Phase B) must, at minimum:
- Reject a `PatientSession` token on all three new dispatch cases (§12), mirroring
  WPI-1's Stage 17.
- Reject a `patient_id` outside the caller doctor's own derived roster.
- Reject the request when the `ai_assistant` registry entry or the caller's own
  `DoctorModuleState` is disabled (fail-closed, ADR-010).
- Unit-test `AssistantDriftCheck_()` against known-bad outputs (lexicon hits per
  category, low-overlap sentences), mirroring `flagDrift_()`'s own existing test
  coverage shape.
- Statically or structurally verify `post_ai_assistant_decision` never itself writes to
  any entity's own Sheet beyond `AIAssistantInteraction` (§16 item 1).
- Verify `AIAssistantInteraction` rows are append-only except for the single
  decision-transition update, and that the transition happens at most once per row.
- Verify the per-doctor rate limit (§10) actually rejects a request once the ceiling is
  reached, once its exact mechanism is chosen at implementation time.

---

# 16. Browser-Test Strategy

- The AI Assistant card does not render at all when the registry entry or
  `DoctorModuleState` is disabled — fail-closed, mirroring every existing dashboard
  card's own browser-test coverage.
- The "AI-generated draft — not saved" banner is present and visible before any
  Accept/Edit/Reject control becomes interactable.
- The Accept action's own UI copy never implies data was saved by that action alone —
  it must explicitly name the target entity's own page as the next required step.
- Keyboard/accessibility parity with the existing five Doctor Dashboard cards
  (tab order, focus handling), mirroring PXP-8's own keyboard-tab-order precedent.

---

# 17. Conformance Strategy

Mirrors docs/53 §13's existing three-phase batch workflow exactly, with one addition
specific to this freeze: a future WPI-10 implementation batch's Phase A self-review must
be checked, section by section, against this document (§4 through §14) before Phase B
validation begins. Any divergence from this document is a **documented amendment to
this document**, filed the same way docs/53 §14 already requires architecture
consistency to be verified for every batch — never a silent deviation. In particular,
any implementation-time choice this document deliberately left open (the exact rate-limit
mechanism, §10; whether the capability registry ships empty or with one seeded entry,
§11.2) must be disclosed in that batch's own roadmap entry, the same disclosure
convention every WPI-1 through WPI-9 batch already followed for its own implementation-
time decisions.

---

# 18. Static-Analysis Rules (new — AI introduces a risk class no existing rule covers)

1. **No AI Assistant code path may call another entity's write function directly.** No
   file matching `AIAssistant*.gs` may call any function matching
   `save*(`/`create*(`/`update*(`/`record*(`/`fulfill*(` outside its own
   `AIAssistantInteraction` writer. A future validation suite must include a static
   grep-based check enforcing this — the single most important static rule this freeze
   requires, since it is the code-level guarantee behind ADR-022's own promise.
2. **No prompt template may change without a version bump**, mirroring
   `PROMPT_VERSION_`'s existing convention exactly — a static check comparing the
   prompt spec file's declared version against the constant referencing it in code.
3. **No new dispatch case may be reachable without a `DoctorSession`** — a static check
   confirming every AI Assistant route is registered through the doctor-guarded path
   only, mirroring `FoundationRouteGuard.gs`'s existing convention.
4. **No context field may originate outside the caller's own roster/specialty scope by
   construction** — `AssistantContextBuilder` may only call already-scoped reader
   functions (`foundationGetDoctorPatientRoster_()` and its siblings); a static check
   confirms no direct Sheet read bypasses those existing scoped readers.

---

# 19. Risks

1. **The "one extra doctor click to actually save" friction (§8.3/ADR-022)** may prove
   annoying enough in real use that a future team is tempted to quietly shortcut it —
   named explicitly so any future change to this boundary is a deliberate, reviewed ADR
   amendment, never a silent implementation choice.
2. **Rate-limit mechanism is deliberately unspecified (§10)** — a real implementation
   risk if skipped rather than merely deferred; the future WPI-10 batch's Definition of
   Done must include it, not treat it as optional polish.
3. **The Knowledge Engine gap (§0.2/§5)** bounds AI Assistant's usefulness more than a
   fully-grounded assistant eventually could be — an accepted, disclosed limitation, not
   an oversight; expanding it requires a real Knowledge Engine plus a new ADR, both
   future work.
4. **`AIAssistantInteraction.context_snapshot` duplicates already-stored PHI at rest**
   (each row's context is a copy of data that also lives in its own source entity) — an
   accepted cost of auditability (mirroring `CalculatorResult.input_snapshot`'s own
   precedent), not a new class of exposure, since the copy is doctor/staff-visible only,
   at the same access level as every source entity already carries.
5. **Disabled-by-default (ADR-023) slows adoption relative to every other Doctor Module
   Registry entry** — a deliberate, accepted consequence of AI Assistant's qualitatively
   different risk profile, not an oversight.

---

# 20. Documentation Impact

- `docs/33-DOMAIN-MODEL.md` — §7.7 updated from "Reserved — AI Assistant, Holoscan" to
  disclose AI Assistant's architecture-frozen (not implemented) status; two new entity
  subsections (`AIAssistantInteraction`, AI Assistant Capability Registry), both
  *Designed*, not *Implemented*; Summary Table row added.
- `docs/31-ADR-INDEX.md` — ADR-021, ADR-022, ADR-023 added.
- `docs/24-ROADMAP.md` — WPI-10 entry updated to disclose the architecture freeze,
  explicitly still not authorizing implementation.
- Root `CHANGELOG.md` — one documentation-only entry for this architecture-freeze pass,
  mirroring the original Phase 3 freeze's own CHANGELOG entry shape.
- `docs/49/50/51/52/53/54` — **not modified.** This document is additive to all of them,
  the same relationship docs/50 has to docs/49.

---

# 21. What This Freeze Does Not Do

- Does not implement any code, schema, registry entry, router case, or dashboard card.
- Does not authorize WPI-10 to begin implementation — a separate, explicit approval is
  still required, per docs/53 §9/§13/§15, unchanged.
- Does not build, or commit to a timeline for, a real Knowledge Engine (§0.2/§5).
- Does not scope Holoscan (WPI-11) or docs/22's patient-facing "Website AI Assistant" —
  both remain exactly as unscoped as before (§0.1).
- Does not scope Phase 2C (Health Milestones) or Phase 2D (Digital Twin & AI Summaries).
- Does not widen, edit, or reinterpret any existing Accepted ADR — ADR-021/022/023 are
  new, complementary records, per ADR-007's "supersede, never silently edit" rule.
- Does not pick a rate-limit mechanism, a model, or a final decision on whether the
  capability registry ships empty or seeded — each is a named, disclosed,
  implementation-time decision (§10, §11.2, §17), not a gap in this freeze.

---

# Summary of Decisions This Freeze Makes

- Scopes WPI-10 "AI Assistant" as the doctor-facing capability inside the already-frozen
  Doctor Dashboard — never the separate, still-unscoped patient-facing "Website AI
  Assistant" docs/22 also names (§0.1).
- Bounds retrieval to the patient's own already-stored structured record only, until a
  real Knowledge Engine exists (§5, ADR-021).
- Establishes that AI Assistant never gains a write path into any clinical entity —
  every output is a non-persisting draft; an accepted draft still requires the doctor's
  own, separate, existing write action on the target entity (§8.3, ADR-022).
- Makes the `ai_assistant` Doctor Module Registry entry disabled-by-default, diverging
  deliberately from every prior entry's rollout convention (§13, ADR-023).
- Defines one new Sheet-backed entity (`AIAssistantInteraction`, §11.1) and one new,
  Calculator-Registry-shaped capability config list (§11.2), both *Designed*, neither
  implemented.
- Names three new router dispatch cases, one new registry entry, and one new dashboard
  card, all specified but none built (§12-§14).
- Requires a new static-analysis rule class (§18) and validation/browser-test additions
  (§15-§16) a future implementation batch must satisfy.
- **Authorizes nothing beyond the architecture itself.** WPI-10 implementation still
  requires its own separate, explicit approval.
