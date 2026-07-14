# ADR-029: Digital Twin Retrieval Is Grounded Only in the Patient's Own Already-Stored Structured Record, Never an Unstructured Knowledge Base, Until a Real Knowledge Engine Exists

## Status
Accepted. Governs Phase 2D (Wise Digital Twin & AI Summaries,
docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md). Extends ADR-001 (Knowledge Engine
primary source) and ADR-021 (AI Assistant grounded in the patient's own structured record)
for the patient-facing Digital Twin specifically; amends neither.

## Context
ADR-001 requires every AI output be traceable to Knowledge-Engine-approved content, but its
own Future Considerations disclose that no formal Knowledge Engine (structured storage,
versioning, retrieval) exists yet — docs/33's Summary Table lists Knowledge Article and
Knowledge Engine as *Conceptual, Unassigned*. ADR-021 resolved this for AI Assistant (WPI-10)
by bounding its retrieval to the calling doctor's own roster-scoped slice of already-stored,
structured platform data, and ADR-024 resolved the analogous question for Holoscan (bounding
it to uploaded image content). The Digital Twin (Phase 2D) raises the identical question for
a **patient-facing** narrative: what may the model draw on when it narrates a patient's health
story?

Left unbounded, a Digital Twin narrative could import general medical knowledge from the
model's training data or an external corpus — introducing facts not traceable to the patient's
own record, which would both violate ADR-001's traceability requirement and make ADR-004's
"never beyond the source material" boundary and the code-level drift check (docs/59 §8.2)
unverifiable. Because the recipient is a patient (ADR-028), an un-grounded claim is
materially more dangerous here than in the doctor-facing AI Assistant.

## Decision
The Digital Twin's only retrieval source, for this freeze, is the **subject patient's own
already-stored, structured platform record** — assembled deterministically by the
`DigitalTwinContextBuilder` (docs/59 §6.2) from each source entity's own existing scoped
reader (Consultation Summary, Timeline, Symptom Log, Report, Care Plan, Check-In Response,
Calculator Result, Medication History, and *published* Health Milestone reviews only). Never
an unstructured knowledge base, article corpus, or the model's own general/training knowledge.

- Every field entering the prompt is a literal value copied from an existing entity; nothing
  is paraphrased, summarized, or interpreted before it reaches the model. Retrieval is 100%
  deterministic code; generation (narration) is the model's only job.
- Each `narrative_type` declares a fixed `context_sources` allow-list (docs/59 §11.3); the
  Context Builder reads only what that type declares — never "everything."
- `requires_knowledge_engine` must be `false` for every narrative-type entry in this freeze's
  scope. It is a reserved field for a future entry once a real Knowledge Engine exists.

This deliberately means the Digital Twin v1 cannot state any fact not already in the patient's
own record — it narrates "what your record says," never "what this condition usually means."

This ADR does not:
- Change what ADR-001/ADR-021/ADR-024 require of any other feature.
- Prohibit a future, separately-approved extension of retrieval to a real Knowledge Engine once
  one exists — that requires its own ADR extending this one, not a default this freeze grants.

## Consequences
- ADR-001's traceability requirement and ADR-004's content boundary are trivially checkable:
  every fact in a narrative names a source entity + field, and `DigitalTwinDriftCheck_()`
  (docs/59 §8.2) verifies output against that assembled context directly.
- The Digital Twin's usefulness is bounded to the patient's own record — an accepted, disclosed
  limitation (docs/59 §0.3/§20), not an oversight; broadening it requires a real Knowledge
  Engine plus a new ADR, both future work.
- A static-analysis rule (docs/59 §18 item 4) enforces that no Digital Twin context read
  bypasses the existing scoped readers — the grounding boundary is a code-level fact, not merely
  a documented intention.

## Future Considerations
When a real Knowledge Engine (structured, versioned, clinician-approved) is eventually built,
a future ADR may extend this one to let a narrative-type draw on Knowledge-Engine-approved
content in addition to the patient's own record — under the same ADR-001 traceability and
ADR-004/ADR-028 review discipline. This ADR neither schedules nor pre-approves that.
