# Phase 1.5 — AI Prompt Specification

Canonical, version-controlled specification for the AI summarization
prompt used in `apps-script/Ai.gs`. The prompt text embedded in
`SUMMARY_SYSTEM_PROMPT_` **implements** this document — this document is
the source of truth for *why* the prompt is worded the way it is and
what it must never do. If the two ever disagree, this document wins and
`Ai.gs` should be corrected to match it, not the other way around.

This is documentation, not a loaded template — Apps Script does not read
this file at runtime. Keeping the two in sync is a manual discipline:
any change to `SUMMARY_SYSTEM_PROMPT_` must be accompanied by a matching
change here, including a version bump (see "Prompt Version" below).

## Prompt Version

`1.0` — introduced in Phase 1.5 Batch 4C, extracted into this document
in the following batch without any change in wording or behavior.
`Ai.gs` carries this same version number in `PROMPT_VERSION_` purely for
audit/log traceability; it is not stored in the Sheet schema (docs/25
§5.1 is locked — see docs/25 §9's escalation rule for changing it).

## Purpose

Rephrase a doctor's own post-consultation note into plain, patient-
readable language — nothing more. This prompt exists to make a clinical
note easier to read, not to generate, expand, or interpret clinical
content. It is the single AI-generation point in the Phase 1.5 pipeline
(docs/25 §6) and is treated as a **normalization layer, not a
content-generation layer**.

## Inputs

| Role | Content | Source |
|---|---|---|
| `system` | The full prompt text below | `SUMMARY_SYSTEM_PROMPT_` (static, not user-influenced) |
| `user` | The doctor's note, verbatim after server-side sanitization | `staff_submitted_note`, already validated by `Validation.gs` (docs/25 §5.1) — max 2000 characters, HTML-angle-bracket-stripped |

No other input reaches the model. It does not receive the patient's
name, condition slug, email address, or any Knowledge Engine content —
only the note text itself (docs/25 §6: "does not consult the Knowledge
Engine, does not add clinical content, and does not answer questions").

Model call parameters (see `Config.gs` → `CONFIG.AI`): model
`anthropic/claude-haiku-4.5` (locked, docs/25 §9.4), `temperature: 0`
(deterministic, minimizes embellishment), `max_tokens: 400`.

## Outputs

Plain text, 2-4 short sentences, no markdown, headers, bullet points,
disclaimers, or sign-off. This is a draft only (`ai_summary_draft`) —
never sent to a patient without doctor review and approval (Batch 4D)
and confirmed consent (docs/25 §9.2), both hard-gated in code, not left
as a UI-only checkbox.

## Safety Rules

The rules below are transcribed directly from `SUMMARY_SYSTEM_PROMPT_` —
this section and that constant must stay word-for-word equivalent in
meaning (paraphrasing for the doc is fine; the *rules* must not diverge):

1. No diagnosis, condition name, or clinical interpretation not
   explicitly stated in the note.
2. No treatment recommendations, medicines, dosages, or instructions not
   explicitly stated in the note.
3. No investigations, tests, or referrals not explicitly stated in the
   note.
4. No reassurance, encouragement, prognosis, or outcome statements
   unless that exact sentiment is explicitly written in the note.
5. No conclusion or summary judgment beyond what the note states.
6. No inference — nothing the doctor did not write, even if it seems
   medically obvious or likely.
7. No guessing at unclear abbreviations or phrases — keep close to
   source wording, or omit.
8. Omit unclear or incomplete details rather than filling the gap.
9. Every output sentence must be directly traceable to something
   explicitly written in the note; if it isn't, delete that sentence.

## Forbidden Behaviours

Restated as an explicit "never" list for anyone auditing the prompt
without reading it as numbered rules:

- Add a diagnosis.
- Add a recommendation.
- Add an investigation or test suggestion.
- Add a medicine, dosage, or treatment instruction.
- Add reassurance, encouragement, or a prognosis.
- Add a conclusion.
- Infer anything not written in the note.
- Expand an abbreviation or vague phrase into a specific claim.
- Embellish tone, certainty, or detail beyond the source.

Do not confuse "simplify vocabulary" with any of the above — the model
is explicitly told it is a rephrasing layer, not a medical assistant.

## Traceability Principles

- Every sentence in the output must be traceable to explicit content in
  `staff_submitted_note`. If a sentence can't be pointed back to a
  specific part of the note, it should not exist in the output.
- Traceability is enforced by the prompt (rule 9 above) **and**
  independently by code: `flagDrift_()` in `Ai.gs` does not trust that
  the prompt was followed. It flags (a) prohibited-category lexicon
  matches present in the output but absent from the note, and (b)
  individual sentences whose word-overlap with the note's vocabulary
  falls below `CONFIG.AI.SENTENCE_TRACEABILITY_MIN_OVERLAP` (0.3).
- Flags are advisory, not blocking — they are written to `error_log`
  (`AI_REVIEW_FLAGS:`) for the doctor reviewer (Batch 4D) to check
  against the draft. No draft is ever auto-approved or auto-sent; a
  human review-and-approve gate already sits between every draft and a
  patient, regardless of flag status (docs/25 §6, §9.2).
- The lexicon/overlap check is a heuristic, not a proof. It catches
  recognizable drift patterns and sentences with almost no vocabulary
  overlap with the source — it cannot prove a sentence is unsupported,
  only raise it for review.

## Future Evolution Notes

- **Model changes require a new Prompt Version**, not a silent edit —
  docs/25 §9.4 already locks the model for Phase 1.5; if a future phase
  changes it, re-validate this prompt against the new model (different
  models can interpret "omit rather than infer" differently) and bump
  the version here.
- **Do not widen scope.** If a future phase wants the AI to do more than
  normalize (e.g., organize a longer record, generate a title, answer a
  question), that is a new prompt and a new safety review — not an
  addition to this one. Keep this prompt's job small and auditable.
- **Traceability heuristic is a candidate for improvement**, not a
  finished mechanism. If Phase 2C's Digital Twin/AI Summaries work
  (docs/09, docs/24) needs stronger guarantees than lexicon + word
  overlap, that is the natural point to revisit — e.g., a second
  model call that verifies each sentence against the source, rather
  than a static lexicon. Not built now because it adds cost and latency
  the pilot doesn't need while a mandatory human review gate already
  exists.
- **This document, not the Apps Script editor, is canonical.** If a
  future contributor edits the live prompt directly in the Apps Script
  editor without updating this file and `Ai.gs` in the repository, that
  edit is out of process per `apps-script/README.md`'s "never treat the
  Apps Script editor as the canonical codebase" rule and should be
  reverted to match this document.
