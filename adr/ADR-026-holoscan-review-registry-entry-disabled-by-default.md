# ADR-026: The Doctor Module Registry's `holoscan_review` Entry Is Disabled by Default, Mirroring ADR-023's Rollout Discipline

## Status
Accepted. Extends ADR-020 (Doctor-facing capabilities are registry-driven) and ADR-010
(security before convenience / fail-closed enablement) for the `holoscan_review` Doctor
Module Registry entry specifically, following the identical precedent ADR-023 already
set for `ai_assistant`; amends none of them.

## Context
ADR-023 established that the Doctor Module Registry's `ai_assistant` entry must stay
disabled, by default, for every doctor, diverging deliberately from every prior entry's
lighter-touch "enable whenever convenient" rollout convention — because AI Assistant is
the platform's first doctor-facing capability whose output is model-generated text a
doctor could act on carelessly. Holoscan's doctor-facing review surface
(`holoscan_review`, docs/56 §17/§19) shares the identical risk profile: it, too, presents
model-generated (vision/OCR-extracted) content — a candidate medicine name, strength,
dosage form — that a doctor reviews and may approve into `MedicationHistory`. ADR-023
was deliberately scoped only to the `ai_assistant` entry ("does not apply this rollout
discipline retroactively to any already-shipped entry"), so a new entry requires its own
decision, not an assumed inheritance, the same "each registry adopts the field
independently" discipline ADR-018 already established for `specialty_scope`.

## Decision
The Doctor Module Registry's `holoscan_review` entry is registered normally, exactly
like every other entry, by a future, separately-approved WPI-11 implementation batch —
nothing about the registry entry's own existence is withheld by this ADR. What must
remain absent, for every doctor, by default, is that doctor's own `DoctorModuleState`
row for `holoscan_review` — which ADR-010 already guarantees fails closed (absence of a
row means the capability does not render or function for that doctor). The capability is
unavailable to any doctor until a staff/administrative action explicitly creates an
enabled `DoctorModuleState` row for that specific doctor, individually — never a bulk
rollout applied automatically to an existing roster, the identical procedural constraint
ADR-023 already states for `ai_assistant`, word for word, applied here to a second entry.

This ADR does not:
- Change the Doctor Module Registry's mechanism itself — still ADR-020/ADR-010's
  existing fail-closed pattern, unmodified.
- Govern the *patient*-facing `holoscan` Module Registry entry (docs/56 §18.1) — that
  entry already inherits Module Registry/`PatientModuleState`'s existing fail-closed
  default (ADR-010, PXP-3 precedent) without needing a new ADR, the same way every other
  Module Registry entry already does; this ADR concerns only the doctor-facing review
  side's rollout discipline, which is the qualitatively different, model-output-review
  surface.
- Apply this rollout discipline retroactively to any already-shipped Doctor Module
  Registry entry (`patient_roster`, `appointments`, `inventory`, `pillfill_orders`,
  `analytics`, or `ai_assistant`) — each keeps its own existing convention, unchanged.

## Consequences
- A future WPI-11 implementation batch's Definition of Done must explicitly confirm no
  bulk-enablement path exists for `holoscan_review` — the identical named check ADR-023
  already requires for `ai_assistant`, applied here.
- Clinic adoption of Holoscan's doctor-review surface will necessarily be slower and more
  deliberate than adoption of any purely-informational Doctor Module Registry entry — an
  accepted, intended consequence, not an oversight.
- Two Doctor Module Registry entries now carry this heavier rollout discipline
  (`ai_assistant`, `holoscan_review`) — both AI-output-review surfaces, a small,
  deliberate pattern rather than a one-off exception, making a future third AI-output
  entry's own equivalent ADR easier to write by precedent, not harder.

## Future Considerations
Once Holoscan's review surface has real-world doctor usage with no disclosed incidents,
a future, separately-approved decision could relax this entry's rollout discipline to
match the lighter-touch entries' convention — mirroring ADR-023's own identical Future
Considerations exactly. Not assumed, scheduled, or pre-approved by this ADR.
