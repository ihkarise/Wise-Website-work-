# WPI-11 — Holoscan Recognition Prompt Specification

Canonical, version-controlled specification for Holoscan's recognition prompt, used in
`apps-script/HoloscanRecognition.gs`. Mirrors `apps-script/AI-ASSISTANT-PROMPTS.md`'s
exact role for AI Assistant's own prompt (docs/56 §7.2: "a version-controlled recognition-
instruction prompt (a future `apps-script/HOLOSCAN-PROMPTS.md`, mirroring `PROMPTS.md`'s/
`AI-ASSISTANT-PROMPTS.md`'s existing role exactly)") — the prompt text embedded in code
**implements** this document; if the two ever disagree, this document wins and the code
should be corrected to match it, not the other way around.

This is documentation, not a loaded template — Apps Script does not read this file at
runtime. Keeping the two in sync is a manual discipline: any change to the recognition
system prompt constant must be accompanied by a matching change here, including a version
bump.

---

## Recognition Prompt

### Prompt Version

`1.0` — introduced in Batch WPI-11.

### Purpose

Extract whatever text is visible on one or more photographed medicine packages into a
bounded, structured list of candidate medicines — name, strength, dosage form,
manufacturer, batch, and expiry date, each independently nullable if not legible or not
present. This is a **non-persisting, patient-initiated draft only** (ADR-025) — every
candidate requires a doctor's mandatory review (approve / correct / reject) before it can
ever become part of a patient's permanent Medication History, and even then only via the
doctor's own separate `create_medication_history_entry` action.

### Inputs

| Role | Content | Source |
|---|---|---|
| `system` | The full prompt text below | Static, not user-influenced |
| `user` | The uploaded image(s), as multimodal content blocks | The patient's own photographed medicine packaging — no other input reaches the model (docs/56 §7.1: no free-text patient prompt field exists) |

### Outputs

A fixed, bounded JSON shape: an array of zero or more candidate objects, each with
independently nullable `name`, `strength`, `dosage_form`, `manufacturer`, `batch`,
`expiry`, and a `confidence` (0.0–1.0) reflecting the model's own extraction confidence
only. Never markdown, prose, or a variable-shaped response the deterministic parsing step
(`apps-script/HoloscanRecognition.gs`'s field-parsing code) cannot reliably consume.

### Safety Rules

Transcribed directly from the system prompt constant — this section and that constant
must stay word-for-word equivalent in meaning (docs/56 §7.2, ADR-024):

1. Never state what a recognized medicine is used for, treats, or is indicated for.
2. Never state a dosage, administration, or schedule instruction beyond text printed on
   the packaging itself.
3. Never state a drug-interaction claim of any kind.
4. Never state a diagnosis, prognosis, or treatment recommendation.
5. Report only what is literally visible in the image(s) — every field is independently
   nullable; never guess or infer a field that is not legible or not present, to make a
   candidate look more complete than the source image supports.
6. Output the fixed structured shape above only — never markdown, headers, or
   free-form prose.

### Forbidden Behaviours

- State what a recognized medicine treats, is used for, or is indicated for.
- State a dosage, administration, or schedule recommendation.
- State any drug-interaction claim.
- State a diagnosis, prognosis, or treatment recommendation.
- Infer, guess, or fabricate a field not actually legible in the image(s).
- Merge two visually distinct medicines into one candidate, or split one medicine's
  packaging into two candidates, without the image itself clearly showing two distinct
  products.

### Traceability and Supervision

- `HoloscanRecognitionCheck_()` (`apps-script/HoloscanRecognitionCheck.gs`) independently
  re-checks every extracted field against the same five prohibited categories (docs/56
  §10.2) — advisory, never blocking; the doctor's own mandatory review (§10.3) is always
  the actual gate, regardless of flag status.
- Confidence never gates, blocks, or auto-rejects a candidate (docs/56 §9) — only the
  doctor's own review decides.
- The Medicine Catalog matching step is reserved, unbacked in this batch (docs/56 §8/
  ADR-024) — `catalog_match_status`/`catalog_match_ref` are never populated by this
  prompt or its parsing step.

### Future Evolution Notes

- **Model changes require a new Prompt Version**, not a silent edit.
- **Do not widen scope.** If a future phase wants this capability to answer a clinical
  question about a recognized medicine, that is a new capability requiring its own
  future, separately-approved ADR extending ADR-024 — not a quiet expansion of this
  prompt.
- **A future Medicine Catalog-grounded matching step is out of this prompt's scope
  entirely** — ADR-024 bounds this prompt to what is literally visible in the uploaded
  image(s).
- **This document, not the Apps Script editor, is canonical** — mirrors
  `apps-script/AI-ASSISTANT-PROMPTS.md`'s own closing rule exactly.
