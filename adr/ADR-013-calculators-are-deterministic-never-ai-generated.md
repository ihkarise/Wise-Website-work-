# ADR-013: Calculators Are Deterministic and Never AI-Generated

## Status
Accepted

## Context
docs/21-WISE-PRODUCT-VISION.md describes two Calculator variants (Public: educational,
no login; Patient: stores results, integrated with My Health Journey) but, per
docs/33-DOMAIN-MODEL.md §5.3, "no phase in docs/24's roadmap currently claims it at
all... a genuine roadmap omission." Phase 2B's technical plan (docs/44) is the first
document to give Calculator Framework an actual implementation home. Before that
happens, this platform's Calculator concept needs the same kind of boundary ADR-004
already drew for Digital Twin — frozen before implementation, not left to erode
feature-by-feature once calculators exist and someone proposes a well-meaning
enhancement.

docs/33 already describes `CalculatorDefinition` as "currently hardcoded per-calculator
JS logic, not data-driven" — i.e., every calculator that has ever existed on this
platform (public condition pages already contain simple scoring/severity calculators)
has been a fixed, auditable formula, never a model call. Nothing in this platform's
history treats a calculator's output as something an AI produces or influences.

## Decision
A Calculator's result is always the output of a fixed, doctor/staff-authored,
version-controlled formula (`CalculatorDefinition`) applied to patient-supplied inputs —
deterministic, reproducible, and auditable: the same inputs against the same definition
version always produce the same result. A Calculator must never:
- Use an AI/LLM call to compute, adjust, or interpret its numeric result.
- Have its formula or scoring logic generated or modified by AI without doctor
  authorship and review (the same authorship discipline ADR-005 already requires for
  clinical content, applied here to formula logic).
- Present its result alongside AI-generated commentary that states or implies a
  diagnosis, prognosis, or treatment recommendation (this would independently violate
  ADR-004 the moment a calculator's output feeds into anything Digital-Twin-shaped).

A future feature that explains a calculator's result in AI-rephrased language (e.g.,
"here is what this score generally means," sourced from Knowledge-Engine-approved
educational content) is not prohibited by this ADR, but must independently satisfy the
full ADR-001/ADR-005 pattern — grounded in approved content, drift-checked,
doctor-reviewed before reaching a patient. This ADR concerns the *result itself*: it is
never AI-computed, regardless of how any surrounding explanatory text is produced.

## Consequences
- `CalculatorResult` records (docs/44 §16) always store which `CalculatorDefinition`
  version produced them, alongside the raw inputs — nothing here is a black box even to
  a later audit.
- A calculator can be built, tested, and shipped entirely without touching any AI
  guideline — it is ordinary deterministic logic, not a Knowledge-Engine consumer,
  unless a later feature explicitly layers AI-generated explanation on top of it (which
  then inherits ADR-001/005 in full).
- Bounds Calculator Framework's Phase 2B scope explicitly: building an "AI-estimated"
  or "AI-adjusted" calculator variant is out of scope for this ADR as written and would
  require a new ADR (a deliberate, reviewed decision) to introduce.

## Future Considerations
If a genuine product need for AI-assisted calculator interpretation emerges, evaluate it
against ADR-001/004/005 first, as its own explicitly-approved addition — not as an
extension folded quietly into the deterministic Calculator Framework this ADR defines.
