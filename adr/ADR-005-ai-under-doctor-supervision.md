# ADR-005: AI Always Operates Under Doctor Supervision

## Status
Accepted

## Context
docs/13-AI-GUIDELINES.md and docs/22-WISE-KNOWLEDGE-ENGINE.md already state that AI
assists and never replaces clinical judgement. Phase 1.5 turned that intention into a
concrete, working mechanism rather than leaving it as a policy statement: the
consultation-summary pipeline requires (1) a numbered-rule system prompt constraining
the model to normalization-only behavior, (2) `flagDrift_()`, a code-level check that
does not trust the prompt was followed, and (3) a mandatory doctor review-and-approve
step (`Review.gs`) before any AI output reaches a patient — with the send function
(`Send.gs`'s `evaluateSendGate_()`) hard-gated on that approval, re-checked against live
Sheet values, not submission-time state.

## Decision
Every AI-generated artifact that could reach a patient — a summary, a translation, an
organized note, a future Digital Twin narrative — must pass through all three of:
1. **Prompt-level constraint** — explicit, numbered rules restricting the model to
   organizing/rephrasing doctor-supplied content, never generating new clinical content.
2. **Independent code-level check** — a mechanism that does not assume the prompt was
   obeyed, and flags output that isn't traceable to its source input.
3. **Mandatory human review and approval** — a doctor or authorized staff member
   approves (or edits and approves, or rejects) before delivery. No AI output is ever
   auto-sent to a patient regardless of whether the code-level check raised a flag.

All three are required. No two of the three are considered sufficient on their own —
this is the load-bearing lesson from Phase 1.5 (docs/27 §4: "a code-level backstop
caught what a prompt alone couldn't guarantee").

## Consequences
- Every future AI feature inherits Phase 1.5's `Ai.gs` / `flagDrift_()` / review-gate
  shape as its **reference implementation**, not merely its inspiration. Deviating from
  this three-part pattern requires a new ADR, not a quieter implementation choice.
- Shipping new AI features is slower — each needs its own drift/traceability check
  designed for its content type — but this is the platform's core trust guarantee per
  docs/21's "AI assists, doctors decide" principle.

## Future Considerations
As a second and third AI feature are built (Digital Twin, AI Summaries), evaluate
whether the drift-check logic should become a shared, reusable module rather than
reimplemented per feature (today it is specific to `apps-script/Ai.gs`). Revisit when a
second real AI feature exists to generalize from, not speculatively now.
