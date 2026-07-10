# ADR-022: AI Assistant Output Is Always a Non-Persisting Draft Requiring Doctor Approval Through the Target Entity's Own Existing Write Path

## Status
Accepted. Extends ADR-004 (Digital Twin never generates diagnosis or treatment) and
ADR-005 (AI always operates under doctor supervision) to AI Assistant (WPI-10)
specifically; amends neither.

## Context
ADR-005 requires a prompt-level constraint, an independent code-level check, and a
mandatory human review-and-approve step before any AI output reaches a *patient* —
established at Phase 1.5 for content flowing outward from the clinic. AI Assistant
(docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md) is the platform's first AI feature
aimed at a *doctor* rather than a patient, and it raises a question ADR-005 never had to
answer: once a doctor reviews and approves an AI Assistant draft, does AI Assistant get
its own write path into the clinical entity that draft concerns (Care Plan,
Notification, etc.), or does approval only ever produce a draft the doctor must still
save through that entity's own existing mechanism? Left undecided, a future
implementation could add a "convenience" shortcut write route for AI Assistant, which
would quietly erode the doctor-supervision boundary ADR-005 exists to protect and repeat
the exact "well-meaning insights widget that starts suggesting next steps" failure mode
ADR-004's own Context section named as the thing to guard against before it happens, not
after.

## Decision
AI Assistant never writes to any clinical entity — `CarePlan`, `DoctorInstruction`,
`Notification`, `Appointment`, `InventoryItem`, `InventoryTransaction`, `PillFillOrder`,
or any other Sheet-backed entity — beyond its own `AIAssistantInteraction` audit row
(docs/55 §11.1). Every AI Assistant output is a draft, held only in that interaction row
and the doctor's own screen, until the doctor explicitly accepts, edits-and-accepts, or
rejects it. Recording that decision persists the decision only — it never itself writes
anything into the target entity. If the doctor wants an accepted draft to become real,
the doctor must separately invoke that target entity's own existing, already-
authenticated write path — exactly as if AI Assistant had never been involved — AI
Assistant only prefilled what the doctor would otherwise have typed by hand. AI
Assistant gains **zero** new write authority over any clinical entity, ever, under this
ADR. This mirrors ADR-004's Digital Twin boundary (organize and summarize, never decide
or act) applied to a doctor-facing tool instead of a patient-facing one, and gives
ADR-005's mandatory-review step real teeth for the first time on the doctor side: review
is not just "look before anything happens," it is "look, and then still have to perform
the actual save yourself, on the record's own page, through the record's own existing
mechanism."

This ADR does not:
- Prohibit a future, separately-approved UX refinement that pre-fills the target
  entity's own authoring form with the accepted draft text, provided the doctor's own
  existing save action on that form remains the only thing that actually persists
  data — an implementation-time UX decision, not a new write path, and does not itself
  require a new ADR as long as this ADR's core guarantee holds.
- Change what ADR-004/ADR-005 require of any other AI feature.

## Consequences
- Every accepted AI Assistant draft costs the doctor one additional, deliberate save
  action on the target entity's own page — a small, accepted friction, traded for the
  guarantee that AI Assistant is never a hidden second write path into any clinical
  record.
- The audit trail stays complete and honest: `AIAssistantInteraction.target_entity_id`,
  when the doctor optionally supplies it after the fact, cross-references a record the
  doctor actually created through the record's own mechanism — never a record AI
  Assistant created on the doctor's behalf.
- A static-analysis rule (docs/55 §18 item 1) is required specifically because this
  ADR's guarantee must be a code-level fact, not merely a documented intention —
  mirroring ADR-005's own "prompt-level constraint plus independent code-level check"
  discipline, applied here to an architectural boundary instead of clinical content.

## Future Considerations
If this friction proves too costly in real doctor usage, a future, separately-approved
ADR may consider a tighter integration (e.g., a one-click "save to Care Plan" action
still gated on an explicit doctor click) — this ADR does not pre-approve or schedule
that change; it only states the boundary that any such future change would have to
justify relaxing.
