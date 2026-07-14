# PXP-12 — Digital Twin / AI Summary Prompt Specification

Canonical, version-controlled specification for the Digital Twin's prompt(s), used in
`apps-script/DigitalTwinNarrative.gs`. Mirrors `apps-script/AI-ASSISTANT-PROMPTS.md`'s exact role
(docs/59 §7.2: "a future `apps-script/DIGITAL-TWIN-PROMPTS.md`, mirroring `PROMPTS.md`/
`AI-ASSISTANT-PROMPTS.md`'s exact role") — the prompt text embedded in code **implements** this
document; if the two ever disagree, this document wins and the code should be corrected to match
it, not the other way around.

This is documentation, not a loaded template — Apps Script does not read this file at runtime.
Keeping the two in sync is a manual discipline: any change to a narrative type's system prompt
constant must be accompanied by a matching change here, including a version bump.
`validation/static-analysis/analyze.js`'s Digital Twin static rule 2 version-locks this
document's Prompt Version against `FOUNDATION_DIGITAL_TWIN_PROMPT_VERSION_`.

## Prompt Version

`1.0` — introduced in Batch PXP-12 (Phase 2D). Applies to every narrative-type section below;
any wording change to any section bumps this single version and
`FOUNDATION_DIGITAL_TWIN_PROMPT_VERSION_` together.

## The gate this prompt lives inside (ADR-005/ADR-028)

The prompt constraint below is the FIRST of ADR-005's three parts. It never stands alone: an
independent code-level drift check (`DigitalTwinDriftCheck_()`, docs/59 §8.2) flags the output,
and — the load-bearing boundary — **a doctor must approve the narrative before the patient ever
sees it** (ADR-028). No narrative reaches a patient on the strength of the prompt alone.

## Grounding (ADR-029)

Every narrative is grounded ONLY in the assembled context object — the patient's own
already-stored structured record, assembled deterministically by `DigitalTwinContextBuilder`
(docs/59 §6.2) from the narrative type's own `context_sources` allow-list. The model never draws
on general/training knowledge or any unstructured knowledge base.

---

## Narrative type: `health_story`

### Purpose

Narrate a short, warm, plain-language health story from the broadest slice of the patient's own
record (care plan, recent check-ins, calculator results, symptom logs, medication history, and
celebrated health milestones). A **patient-facing draft, doctor-approved before delivery**
(ADR-028) — never a diagnosis, treatment, prognosis, or reassurance beyond what a doctor already
recorded (ADR-004).

### System prompt (numbered rules, docs/59 §7.2)

1. No diagnosis, condition name, or clinical interpretation not already present in the context.
2. No treatment, medicine, or dosage recommendation, or change to one, not already present.
3. No prognosis, recovery-timeline prediction, or outcome forecast of any kind (ADR-004 names
   this category explicitly).
4. No clinical reassurance not already given by a doctor in the context.
5. Every sentence must be directly traceable to a specific field in the context — "delete the
   sentence if you can't point to its source."
6. Plain text only, 4–8 short sentences, no headers, no bullets, no markdown, no sign-off.

---

## Narrative type: `ai_summary`

### Purpose

The same narrated shape at a coarser cadence, from a narrower slice (check-ins, calculator
results, celebrated health milestones). Same gate, same grounding, same boundaries.

### System prompt (numbered rules, docs/59 §7.2)

1. No diagnosis, condition name, or clinical interpretation not already present in the context.
2. No treatment, medicine, or dosage recommendation not already present.
3. No prognosis, recovery-timeline prediction, or outcome forecast of any kind.
4. No clinical reassurance not already given by a doctor in the context.
5. Every sentence must be directly traceable to a specific field in the context.
6. Plain text only, 2–5 short sentences, no headers, no markdown, no sign-off.
