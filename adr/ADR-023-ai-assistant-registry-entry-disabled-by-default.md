# ADR-023: The Doctor Module Registry's `ai_assistant` Entry Is Disabled by Default, Diverging From Every Prior Entry's Rollout Convention

## Status
Accepted. Extends ADR-020 (Doctor-facing capabilities are registry-driven) and ADR-010
(security before convenience / fail-closed enablement) for the `ai_assistant` Doctor
Module Registry entry specifically; amends neither.

## Context
ADR-020 already requires every doctor-facing capability to be a Doctor Module Registry
entry, fail-closed by the absence of a `DoctorModuleState` row (ADR-010). In practice,
every entry shipped so far (`patient_roster`, WPI-4; `appointments`, WPI-5; `inventory`,
WPI-7; `pillfill_orders`, WPI-8; `analytics`, WPI-9) is a plain, read-only informational
view with no realistic harm from broad enablement, and no prior WPI batch has had to
decide whether a capability should default to on or off once a clinic actually starts
enabling doctors for it — enablement has simply been an administrative action, applied
whenever convenient, with no disclosed rollout discipline beyond the mechanism's own
fail-closed starting state. AI Assistant (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-
FREEZE.md) is qualitatively different: even with ADR-021's retrieval boundary and
ADR-022's non-persisting-draft boundary both in place, it is the platform's first
doctor-facing capability whose output is model-generated text a doctor could act on
carelessly. Treating its rollout identically to `analytics`'s "enable whenever
convenient" precedent risks exactly the kind of quiet normalization ADR-019 exists to
prevent — a capability becoming broadly available before anyone has deliberately
decided, clinic by clinic and doctor by doctor, that it should be.

## Decision
The Doctor Module Registry's `ai_assistant` entry (once a future, separately-approved
WPI-10 batch actually registers it) must remain unregistered — its `DoctorModuleState`
absent, which ADR-010 already guarantees fails closed — for every doctor by default.
Enabling it for any given doctor must be a deliberate, disclosed, staff/administrative
decision made individually, per doctor, never a bulk rollout applied automatically to an
existing roster the way a purely informational entry reasonably could be. This is not a
new code mechanism beyond what ADR-010 already guarantees (fail-closed-by-absence
already means every doctor starts disabled, for every entry, today) — it is a
**procedural** constraint governing how a future implementation and clinic rollout must
treat this one entry differently from every prior one: no bulk/default-enablement
script, no "enable for all doctors" migration step, ever, specifically for
`ai_assistant`.

This ADR does not:
- Change the Doctor Module Registry's mechanism itself — still ADR-020/ADR-010's
  existing fail-closed pattern, unmodified.
- Apply this rollout discipline retroactively to any already-shipped entry
  (`patient_roster`, `appointments`, `inventory`, `pillfill_orders`, `analytics`) —
  each keeps its own existing, lighter-touch enablement convention, unchanged.

## Consequences
- A future WPI-10 implementation batch's Definition of Done must explicitly confirm no
  bulk-enablement path exists for `ai_assistant` — the same way every prior batch
  confirms fail-closed behavior in its own validation suite, with one additional,
  named check specific to this entry.
- Clinic adoption of AI Assistant will necessarily be slower and more deliberate than
  adoption of any prior Doctor Module Registry entry — an accepted, intended
  consequence of this ADR, not an oversight or a missed rollout optimization.

## Future Considerations
Once AI Assistant has real-world doctor usage with no disclosed incidents, a future,
separately-approved decision could relax this entry's rollout discipline to match the
other entries' lighter-touch convention — not assumed, scheduled, or pre-approved by
this ADR.
