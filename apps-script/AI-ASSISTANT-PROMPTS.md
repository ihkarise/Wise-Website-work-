# WPI-10 — AI Assistant Prompt Specification

Canonical, version-controlled specification for AI Assistant's prompt(s), used in
`apps-script/AIAssistantInteraction.gs`. Mirrors `apps-script/PROMPTS.md`'s exact role
for Phase 1.5's summarization prompt (docs/55 §7.2: "version-controlled in a future
`apps-script/AI-ASSISTANT-PROMPTS.md`, mirroring `PROMPTS.md`'s exact role") — the
prompt text embedded in code **implements** this document; if the two ever disagree,
this document wins and the code should be corrected to match it, not the other way
around.

This is documentation, not a loaded template — Apps Script does not read this file at
runtime. Keeping the two in sync is a manual discipline: any change to a capability's
system prompt constant must be accompanied by a matching change here, including a
version bump.

One capability, one prompt section — a future capability (`draft_care_plan_note`,
`flag_checkin_anomalies`, or any later addition to
`shared/constants/ai-assistant-capability-registry.json`) gets its own dedicated
section below when it is registered, never a shared, generic prompt across
capabilities (docs/55 §7.2's own "fixed, bounded output format per capability" rule).

---

## Capability: `summarize_patient_status`

### Prompt Version

`1.0` — introduced in Batch WPI-10.

### Purpose

Draft a short, plain-language summary of one roster patient's current status —
current Care Plan goals, recent Check-In activity, recent Calculator Results, and
recent Appointment history — strictly from the assembled context. This is a
**non-persisting, doctor-facing reference draft only** (ADR-022) — never saved
anywhere by this capability itself, never sent to a patient, never a substitute for
the doctor's own clinical judgment.

### Inputs

| Role | Content | Source |
|---|---|---|
| `system` | The full prompt text below | Static, not user-influenced |
| `user` | The assembled context object, serialized | `AssistantContextBuilder`'s own output (`apps-script/AIAssistantContext.gs`'s `foundationBuildAiAssistantContext_()`), bounded to exactly `care_plan`, `check_in_response`, `calculator_result`, and `appointment` (this capability's own declared `context_sources`) |

No other input reaches the model — no free-text doctor prompt field exists in this
capability (docs/55 §7.1), no Knowledge Engine content (none exists yet, ADR-021), no
data outside the four declared context sources.

Model call parameters (see `apps-script/AIAssistantInteraction.gs`'s own local
`FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_` — a decoupled mirror of `Config.gs`'s
`CONFIG.AI` shape, not a read of that frozen Phase 1.5 file, per this batch's own
disclosed implementation-time decision): model `anthropic/claude-haiku-4.5` (the same
model Phase 1.5's own summarization step already uses — no new model evaluation was
performed for this batch), `temperature: 0` (deterministic, minimizes embellishment),
`max_tokens: 300`.

### Outputs

Plain text, 2-5 short sentences, no markdown, headers, bullet points, disclaimers, or
sign-off. This is a draft only (`AIAssistantInteraction.ai_output`) — never
auto-applied anywhere; held only in the interaction row and the doctor's own screen
until a decision is recorded (ADR-022).

### Safety Rules

Transcribed directly from the system prompt constant — this section and that constant
must stay word-for-word equivalent in meaning:

1. No diagnosis, condition name, or clinical interpretation not already present in the
   assembled context (ADR-001/ADR-004).
2. No treatment, medicine, or dosage recommendation not already present in the
   assembled context (ADR-004) — and never touching a Calculator Result's own
   `result_value` field, which remains exclusively the deterministic formula layer's
   output (ADR-013).
3. No prognosis, outcome prediction, or reassurance not already present in the
   assembled context (ADR-004).
4. Nothing not directly traceable to a specific field in the assembled context — the
   same "delete the sentence if you can't point to its source" rule `Ai.gs`'s own
   prompt already enforces.
5. Plain short text only, 2-5 sentences — never markdown, headers, or a variable-shaped
   response the code-level check (`AssistantDriftCheck_()`) can't reliably parse.

### Forbidden Behaviours

- Add a diagnosis or clinical interpretation.
- Add a treatment, medicine, or dosage recommendation.
- Add a prognosis, outcome prediction, or reassurance.
- Answer a general clinical-knowledge question ("what does this diagnosis usually
  mean") — this capability only reports what the patient's own record already says
  (ADR-021).
- Infer anything not present in the assembled context, even if it seems clinically
  obvious or likely.

### Traceability Principles

- Every sentence in the output must be traceable to explicit content in the assembled
  context object. If a sentence can't be pointed back to a specific field, it should
  not exist in the output.
- Traceability is enforced by the prompt (rule 4 above) **and** independently by code:
  `AssistantDriftCheck_()` in `apps-script/AIAssistantDriftCheck.gs` does not trust
  that the prompt was followed. It flags (a) prohibited-category lexicon matches
  present in the output but absent from the flattened context, and (b) individual
  sentences whose word-overlap with the context's own vocabulary falls below
  `FOUNDATION_AI_ASSISTANT_SENTENCE_TRACEABILITY_MIN_OVERLAP_` (0.3).
- Flags are advisory, not blocking — they are stored in
  `AIAssistantInteraction.ai_output_flags` for the doctor to see alongside the draft.
  No draft is ever auto-applied; a human review-and-decide gate (ADR-022) already sits
  between every draft and any effect, regardless of flag status.
- The lexicon/overlap check is a heuristic, not a proof — see
  `apps-script/AIAssistantDriftCheck.gs`'s own header comment.

### Future Evolution Notes

- **Model changes require a new Prompt Version**, not a silent edit.
- **Do not widen scope.** If a future phase wants this capability to do more than
  summarize (e.g. answer a general clinical-knowledge question, or accept a free-text
  doctor prompt), that is a new capability and, per ADR-021, a new retrieval-boundary
  decision — not a quiet expansion of this one.
- **A future Knowledge-Engine-grounded capability is out of this prompt's scope
  entirely** — ADR-021 bounds every capability in this freeze to the patient's own
  structured record; extending that requires its own future ADR, not a prompt edit
  here.
- **This document, not the Apps Script editor, is canonical** — mirrors
  `apps-script/PROMPTS.md`'s own closing rule exactly.
