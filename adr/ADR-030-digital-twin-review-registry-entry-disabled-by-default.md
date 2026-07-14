# ADR-030: The Doctor Module Registry's `digital_twin_review` Entry Is Disabled by Default, Following ADR-023/ADR-026's Rollout Discipline

## Status
Accepted. Governs Phase 2D (Wise Digital Twin & AI Summaries,
docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md §13.2). Extends ADR-020 (Doctor Dashboard
registry-driven) and ADR-010 (security before convenience / fail-closed), and follows the
precedent of ADR-023 (`ai_assistant`) and ADR-026 (`holoscan_review`) for the
`digital_twin_review` entry specifically; amends none of them.

## Context
The Doctor Module Registry's normal rollout convention (ADR-020, ADR-010) is fail-closed by
`DoctorModuleState` absence, but enabling an entry is otherwise a routine, "enable whenever
convenient" administrative action — the treatment `patient_roster`, `appointments`,
`inventory`, `pillfill_orders`, `analytics`, `medication_history`, and (Phase 2C)
`milestone_review` all receive. ADR-023 established that the `ai_assistant` entry diverges from
this: because it produces AI-generated content, enabling it must be a deliberate, disclosed,
per-doctor decision, never a bulk/default rollout. ADR-026 extended the identical discipline to
`holoscan_review`.

Phase 2D's `digital_twin_review` is the platform's **third AI-output-review doctor surface,
and its highest-risk one** — because the content a doctor generates and reviews there is
destined for a *patient* (ADR-028), not just for the doctor's own consumption (as with
`ai_assistant`) or for an internal medication record (as with `holoscan_review`). Left on the
normal rollout convention, `digital_twin_review` could be enabled in bulk, putting a
patient-facing AI-generation capability in front of doctors who have not been deliberately
onboarded to its review responsibility.

## Decision
The Doctor Module Registry's `digital_twin_review` entry is **disabled by default for every
doctor.** Its `DoctorModuleState` must remain absent (fail-closed, ADR-010) unless a staff/
administrator explicitly enables it for a specific doctor — a deliberate, disclosed, per-doctor
decision, never a bulk or default-on rollout. This is the identical discipline ADR-023
established for `ai_assistant` and ADR-026 for `holoscan_review`, now applied to
`digital_twin_review`.

This applies only to the **doctor-facing review** entry. The patient-facing `health_story`
entry (docs/59 §13.1) is **not** governed by this ADR: it inherits the Patient Module
Registry's existing fail-closed-by-`PatientModuleState`-absence default (ADR-010/ADR-012), and
even when enabled it shows nothing until a doctor approves a narrative (ADR-028) — so no
separate disabled-by-default ADR is required or created for the patient half.

This ADR does not:
- Change the rollout discipline of any other Doctor Module Registry entry.
- Weaken any other Phase 2D boundary (ADR-004 content, ADR-028 doctor-approval-before-visibility,
  ADR-029 grounding all stand independently).

## Consequences
- A patient-facing AI-generation capability is never silently available to a doctor who was not
  deliberately enabled for it — the correct posture for the platform's highest-risk AI surface.
- Adoption of `digital_twin_review` is slower than a normal-rollout entry — a deliberate,
  accepted consequence of its risk profile, the identical trade-off ADR-023/ADR-026 already
  accepted for the prior two AI-review surfaces.
- A future validation suite must prove a doctor with `digital_twin_review` disabled is
  rejected on `generate_digital_twin_narrative`/`review_digital_twin_narrative`/
  `get_patient_digital_twin` (docs/59 §15), and that the card does not render (docs/59 §16) —
  the disabled-by-default guarantee must be tested, not merely asserted.

## Future Considerations
If, once the feature is proven in production, the clinic decides a broader rollout is
warranted, that is a future operational decision — but the default stays disabled, and any
change to the default itself would require superseding this ADR, never a silent implementation
choice. This ADR does not pre-approve such a change.
