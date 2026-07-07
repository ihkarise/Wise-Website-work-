# ADR-018: Platform Registries Support Optional Specialty Scoping

## Status
Accepted. Complements ADR-012 (Module Registry), ADR-013 (Calculator Registry), and
ADR-016 (Template Registry) — amends none of them.

## Context
The Module Registry, Calculator Registry, and Template Registry (ADR-012/013/016) were
each designed generically — none hardcodes "homeopathy" anywhere in its own mechanism.
But every concrete entry shipped against any of them so far is implicitly
homeopathy-specific: the one seeded Check-In Template (`daily_wellness_checkin`), every
condition slug in production (`hashimotos-thyroiditis`, `mcas`, `chronic-urticaria`),
and the (currently empty) Calculator Registry's anticipated first entries. Nothing in
the existing architecture prevents a second specialty from populating its own entries —
but nothing names the concept either, which means the first time it is actually
attempted, it would be improvised rather than designed. docs/49 §3.1 names this gap
explicitly as a goal for Phase 3 ("production-scale architecture," "multi-specialty
use") for the first time.

## Decision
Every registry-driven mechanism on the platform (Module Registry, Calculator Registry,
Template Registry, and the new Doctor Module Registry, ADR-020) gains one new,
**optional** field: `specialty_scope`. An entry with no `specialty_scope` (every entry
that exists today) behaves exactly as it does now — globally visible, the implicit,
sole "default" specialty. An entry with a `specialty_scope` value is visible only to
doctors/patients associated with that specialty.

This ADR does not:
- Define what a `Specialty` record itself looks like beyond a stable slug (a future
  WHIMS batch's schema decision, docs/50 §5) — no more than ADR-002 designed the exact
  shape of `Patient` when it defined `patient_id`.
- Populate any specialty other than the implicit default.
- Change any existing registry entry — every Module Registry, Calculator Registry, and
  Template Registry entry shipped by Phase 2A/2B keeps working, unscoped, exactly as
  today. Adding `specialty_scope` is purely additive, the same "new optional field,
  no existing reader breaks" discipline docs/47 §6 already requires for schema changes.
- Require every registry to gain specialty scoping in the same batch — each registry
  adopts the field independently, at whichever future WHIMS batch actually needs it,
  per docs/47 §4's "a new registry entry, never new architecture" discipline applied to
  a shared field instead of a shared registry.

## Consequences
- A future specialty can be onboarded by adding registry entries scoped to it, never by
  forking Module Registry, Calculator Registry, Template Registry, or their rendering
  code — the same "configuration over hardcoding" principle docs/47 §2 already states,
  extended along a new (specialty) dimension instead of only a (patient) dimension.
- Doctor Identity (ADR-017) is a natural place to record which specialty (or
  specialties) a given doctor practices in, informing which scoped registry entries
  they can configure — a consumer relationship, not a new decision this ADR makes.
- No product commitment is made about which second specialty, if any, the clinic will
  ever actually add — this ADR only removes the architectural cost of doing so later.

## Future Considerations
If a genuinely new *kind* of specialty-scoping concern emerges beyond "which registry
entries are visible" (for example, specialty-specific compliance rules, or a
specialty-specific data-retention policy), that is a new decision requiring its own ADR
— this one governs registry-entry visibility only, following ADR-016's own precedent of
scoping a new ADR narrowly rather than stretching an existing one's Decision text to
cover unrelated territory.
