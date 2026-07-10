# ADR-021: AI Assistant Retrieval Is Grounded Only in the Patient's Own Structured Record, Never an Unstructured Knowledge Base, Until a Real Knowledge Engine Exists

## Status
Accepted. Extends ADR-001 (Knowledge Engine is the primary knowledge source) for AI
Assistant (WPI-10) specifically; amends none of it.

## Context
ADR-001 requires every AI-generated or AI-assisted output be traceable to
Knowledge-Engine-approved content. ADR-001's own "Future Considerations" already
discloses that "a formal Knowledge Engine implementation (structured storage,
versioning, retrieval) does not exist yet" and names a future public AI assistant as
one of the things likely to trigger building one. docs/33-DOMAIN-MODEL.md's Summary
Table lists both Knowledge Article and Knowledge Engine as *Conceptual, Unassigned* —
no schema, no storage, no retrieval mechanism exists anywhere in the platform today.
docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md is the first document to actually
design an AI feature since ADR-001 was written, and it cannot ground itself in a
retrieval system that does not exist without either violating ADR-001 or quietly
inventing a Knowledge Engine as an undesigned side effect of an unrelated freeze. This
ADR resolves that tension for AI Assistant specifically, the deliberate, narrow way
ADR-001's own Future Considerations anticipated: "revisit only to add implementation
detail... when [a future AI feature] is designed."

## Decision
AI Assistant's every retrieval source is limited to the calling doctor's own roster-
and specialty-scoped slice of already-stored, structured platform data — Care Plans,
Doctor Instructions, Check-In Responses, Calculator Results, Inventory Items and
Transactions, PillFill Orders, Appointments, and Analytics' own already-computed
sections — never a free-text knowledge base, article corpus, or the model's own general
or training knowledge. Every value assembled into an AI Assistant prompt is a literal
field copied from an existing entity; nothing is retrieved from, or answered out of,
anything other than the patient's own record. This makes ADR-001's traceability
requirement trivially and completely satisfiable: the model is never asked a general
clinical-knowledge question it could only answer from training data, only asked to
summarize, organize, or rephrase data it has been handed — the same normalization-only
discipline `apps-script/Ai.gs` already established for prose input, applied here to
structured input instead.

This ADR does not:
- Build a real Knowledge Engine, or commit to a timeline for one.
- Expand AI Assistant to answer general clinical-knowledge questions.
- Change what ADR-001 requires of any other, non-AI-Assistant feature.

## Consequences
- AI Assistant cannot answer "what does this diagnosis generally mean" or any
  knowledge-base-shaped question — only "what does this patient's own record say."
- A future capability that retrieves real Knowledge-Engine content requires both a real
  Knowledge Engine (a separate, currently-unbuilt system) and its own ADR explicitly
  extending this one — never a silent broadening of AI Assistant's retrieval scope.
- AI Assistant's usefulness is deliberately bounded by this ADR, not by an
  implementation shortcut — a disclosed, accepted limitation.

## Future Considerations
Once a real Knowledge Engine exists (ADR-001's own deferred item), a future,
separately-approved ADR may extend AI Assistant's retrieval scope to include it. This
ADR's structured-record-only boundary is AI Assistant's starting scope, not a
permanent ceiling.
