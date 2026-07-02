# ADR-004: Digital Twin Never Generates Diagnosis or Treatment

## Status
Accepted

## Context
docs/21-WISE-PRODUCT-VISION.md already describes the Digital Twin as "not an electronic
medical record... a living health story," and docs/09-PHASE-2-ARCHITECTURE.md states
"AI organizes information only. Doctors remain responsible for clinical decisions." Both
are stated intentions, not a binding constraint checked against future feature work.
This ADR exists to freeze that boundary before any Phase 2C implementation begins, so it
cannot quietly erode feature-by-feature (e.g., a well-meaning "insights" widget that
starts suggesting next steps).

## Decision
The Digital Twin may summarize, organize, timeline, and visualize a patient's
already-recorded history: consultations, symptom logs, uploaded reports, and doctor
notes. It must never:
- State or imply a diagnosis.
- Recommend, suggest, or imply a treatment or medicine change.
- State a prognosis or predict a clinical outcome.
- Offer clinical reassurance not already given by a doctor in the source material.

Any output resembling these categories is a defect to be fixed, not a feature to be
shipped — regardless of how well-intentioned or how it was produced (rule-based or
AI-based).

## Consequences
- Every Digital Twin capability requires the same enforcement pattern ADR-005
  formalizes: a prompt-level constraint, an independent code-level check, and mandatory
  human review before anything reaches a patient.
- This deliberately bounds Digital Twin scope. A future "insights," "recommendations,"
  or "predicted recovery timeline" feature is out of scope for this ADR as written and
  would require a new ADR (a deliberate, reviewed decision) to introduce — never a
  silent addition.

## Future Considerations
As Digital Twin capabilities grow (progress trends, milestone summaries per docs/21's
Health Milestone Review), each new capability's design should be checked explicitly
against this ADR before being added to a batch's Definition of Done — recommended as a
standing checklist item in any future Digital Twin implementation plan.
