# Digital Twin Narrative-Type Registry

Explains `digital-twin-narrative-registry.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-12 (docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md §11.3, ADR-028/029/030)

A fixed, bounded config list — one entry per `narrative_type` the Digital Twin may generate.
Structurally parallel to `ai-assistant-capability-registry.json` and `calculator-registry.json`:
this file declares availability + each type's read allow-list; it is not a dynamic,
admin-editable system. `apps-script/DigitalTwinContext.gs` hand-ports it into a Foundation-prefixed
array — update both by hand if the canonical list ever changes.

## The two entries

Both share **one pipeline, one gate (ADR-028), one set of content boundaries (ADR-004)** —
they differ only in their `context_sources` allow-list and cadence:

- `health_story` — the patient's living health story, drawn from the broadest slice of their
  own record (care plan, check-ins, calculator results, symptom logs, medication history,
  health milestones).
- `ai_summary` — the same narrated shape at a coarser cadence, from a narrower slice
  (check-ins, calculator results, health milestones).

## Field-by-field

| Field | Meaning |
|---|---|
| `narrative_type` | Stable slug; the enum `digital-twin-narrative.schema.json` closes to `health_story`/`ai_summary`. |
| `display_name` | Human label for the doctor's generate control. Illustrative, not fixed. |
| `description` | What this type narrates. |
| `context_sources` | The explicit allow-list of the patient's own entity types the `DigitalTwinContextBuilder` may read for this type — **never "all"** (ADR-029). Each source resolves to an existing scoped patient reader. |
| `output_shape` | `draft_text` — the only value this freeze defines: plain, short, patient-friendly prose (docs/59 §7.2 item 6). |
| `requires_knowledge_engine` | **Must be `false`** for every entry in this freeze (§5/ADR-029). A reserved field for a future entry once a real Knowledge Engine exists. |
| `future_ai_capable` | Reserved, inert extension point (mirrors every other registry's own reserved field). |

## Grounding boundary (ADR-029)

The `context_sources` allow-list is the code-level expression of ADR-029: the Digital Twin
narrates only the patient's own already-stored structured record, never an unstructured
knowledge base or the model's general knowledge.
`validation/static-analysis/analyze.js`'s Digital Twin static rule 4 additionally forbids any
`DigitalTwinContext.gs` read that bypasses the existing scoped readers.

## Versioning

Version `1.0.0`. Any entry addition/removal or field change requires a new version here first,
then a subsequent update to `apps-script/DigitalTwinContext.gs` — never the reverse, per
`shared/README.md`.
