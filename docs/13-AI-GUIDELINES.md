# Wise Homeopathy AI Guidelines
## Version 2.0

Purpose: Define responsible AI usage.

## AI Principles
- AI assists, never replaces clinicians.
- AI summarizes, organizes and explains.
- AI never diagnoses.
- AI never prescribes.
- AI never changes treatment.

## Approved Uses
- Summaries
- Timeline generation
- Symptom organization
- FAQ assistance
- Content drafting

## Future
Support My Health Journey, Personal Care Plan and Wise Digital Twin.

## Worked Example — Phase 1.5 Consultation Summary (Batch 4C)

The first concrete implementation of "AI summarizes, organizes and
explains" (never diagnoses, prescribes, or changes treatment). Full
detail: `apps-script/Ai.gs`, `apps-script/README.md` ("AI boundaries"),
docs/25-PHASE-1.5-TECHNICAL-PLAN.md §6.

The AI step is treated as a **normalization layer, not a
content-generation layer**: it may only rephrase a doctor's own note into
plain language. It must never add a diagnosis, recommendation,
investigation, medicine, reassurance, or conclusion not already in the
source note — every output sentence must be traceable to something the
doctor actually wrote. If information is missing or unclear, the model is
instructed to omit it, never infer or fill the gap.

This is enforced two ways, deliberately independent of each other so a
prompt failure alone can't silently pass through:
1. An explicit, numbered-rule system prompt instructing normalization-only
   behavior (`SUMMARY_SYSTEM_PROMPT_` in `apps-script/Ai.gs`).
2. A code-level check (`flagDrift_()`) that does not trust the prompt was
   followed — it flags summary content matching a prohibited-category
   lexicon not present in the source note, and flags individual sentences
   with low word-overlap against the note's vocabulary. Flags are
   advisory (logged for doctor review, never auto-blocking or
   auto-sending) because a human review-and-approve gate already sits
   between any draft and a patient (docs/25 §6, §9.2 — Batch 4D).

This pattern — prompt-level constraint plus an independent code-level
check, both feeding a mandatory human review step — is the reference
implementation for any future AI usage in this platform, not a one-off
for Phase 1.5.
