# ADR-019: AI and Advanced-Capability Extension Points Are Reserved Platform-Wide, Never Implemented Without Separate Approval

## Status
Accepted. Reaffirms and generalizes ADR-001, ADR-004, ADR-005, and ADR-013's existing
AI-supervision gate; elevates docs/47 §2's Phase-2B-scoped "AI extension points only"
implementation rule to a permanent, platform-wide architectural principle. Amends none
of ADR-001/004/005/013.

## Context
docs/44 §7.1/§8.1/§11.5 already reserve an inert AI-compatibility field in the Module,
Calculator, and Template Registries — a Phase-2B-scoped implementation rule
(docs/47 §2), not a standing architectural principle binding future phases. Phase 3
(WHIMS) is the first phase to name an "AI Assistant" capability directly in the
product roadmap (docs/24's original "WiseOS" list) and to sit alongside a second named,
entirely undefined item ("Holoscan," docs/49 §9) that could plausibly also carry future
AI or advanced-analysis behavior. Without a standing, platform-wide rule, each future
phase would have to reinvent the same "reserve, don't implement" discipline
independently — the exact per-feature reinvention risk ADR-009 and ADR-012 already
guard against for backend modules and dashboard capabilities respectively.

## Decision
Every extension point reserved anywhere on the platform for a future AI or
advanced-capability feature — the existing Module/Calculator/Template Registry fields,
and any equivalent field a future registry (Doctor Module Registry, ADR-020; any
registry Pillar 3/ADR-018 scopes by specialty) reserves — is **inert until a future,
separately-proposed feature is independently gated by the full ADR-001 (Knowledge
Engine grounding) / ADR-004 (Digital Twin never diagnoses) / ADR-005 (mandatory
doctor-supervision gate) / ADR-013 (calculators stay deterministic, never AI-generated)
pattern, at the time that feature is actually proposed.**

Naming a capability in a roadmap document (docs/24's "AI Assistant," "Holoscan") is not
scoping it, designing it, or authorizing it. A named-but-unscoped item may be carried
across any number of architecture-freeze passes — mirroring PXP-9's own precedent
exactly, docs/44 §22, docs/45, docs/48 §1/§7 — without ever becoming real until a
dedicated technical plan and any ADRs it needs are written and approved for it
specifically.

This ADR does not:
- Implement any AI behavior, prompt, model call, or inference path.
- Change what ADR-001/004/005/013 already require of a real AI feature once one is
  proposed.
- Scope AI Assistant or Holoscan (docs/49 §9 states this explicitly for this review;
  this ADR makes the same restraint permanent, not just true for this one document).

## Consequences
- Every future phase inherits one clear rule instead of re-deriving "should we reserve
  a field for this" per feature: reserve the field, gate the feature, always in that
  order, always separately approved.
- A registry's own architecture-freeze pass (this review's docs/50, or any future one)
  can name a reserved extension point without that naming being mistaken for a design
  or an implementation commitment — closing a real ambiguity risk the "reserved
  placeholder" language alone did not fully close for PXP-9 until docs/45 and docs/48
  both had to restate it explicitly.
- No implementation timeline is created or implied for AI Assistant or Holoscan by this
  ADR — both remain exactly as open as they were before it.

## Future Considerations
When AI Assistant, Holoscan, or Phase 2D's Digital Twin AI Summaries are eventually
proposed for real, each requires its own technical plan and, per ADR-001/004/005's
existing pattern, likely its own feature-specific ADRs (the same expectation docs/32
Part 2 already stated for Digital Twin narrative generation specifically) — this ADR
does not pre-approve any of that future design, it only guarantees the gate they must
each still pass through.
