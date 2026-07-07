/**
 * Calculator Registry — Batch PXP-6 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §8.1,
 * §17, §22; ADR-013; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this
 * and every later batch). Implements shared/constants/calculator-registry.json
 * version 1.0.0. Phase 2B's Pillar 3 (docs/44 §4.1) — the platform's only
 * mechanism for expressing which deterministic, doctor/staff-authored
 * calculators exist at all, mirroring ModuleRegistry.gs's "availability, not
 * enablement" framing and TemplateRegistry.gs's "shape, not capability"
 * framing.
 *
 * Static, hand-maintained config — not a dynamic, doctor-editable authoring
 * system in this batch's scope, the same "static, staff/developer-maintained
 * config" precedent ModuleRegistry.gs and TemplateRegistry.gs already
 * established.
 *
 * Manually adapted from shared/constants/calculator-registry.json, the same
 * duplication-by-convention ModuleRegistry.gs's and TemplateRegistry.gs's own
 * header comments already established — update both places by hand if the
 * canonical list ever changes, per shared/README.md's rule.
 *
 * Deliberately seeded empty in this batch — see
 * shared/constants/calculator-registry.md's "Ships empty" section for the
 * full, disclosed reasoning: this batch's own scope is the generic
 * registry-and-result mechanism only; no concrete CalculatorDefinition
 * (disease-specific or otherwise) is authored or registered here. A future
 * calculator is added as its own registry entry by whichever later,
 * separately-approved batch actually designs and authors it (docs/47 §4's
 * "a new calculator is a new registry entry, never new architecture").
 *
 * No formula-execution logic exists anywhere in this file or
 * CalculatorResult.gs — an entry's formula_reference is a descriptive
 * pointer only, never executable code (docs/44 §8.3's "never hardcoded per
 * disease" constraint, ADR-013's "deterministic, doctor-authored, never
 * AI-computed" constraint, both satisfied by this file never computing
 * anything itself).
 *
 * No dependency on any other file — leaf-level config, the same role
 * ModuleRegistry.gs/TemplateRegistry.gs already play for their own
 * consumers.
 */

var FOUNDATION_CALCULATOR_REGISTRY_ = [];

/**
 * Returns the exact (calculator_slug, version) registry entry, or null — the
 * immutable-pair lookup docs/44 §11.4 requires every CalculatorResult write
 * to validate against before persisting, mirroring
 * foundationGetTemplateByIdAndVersion_() exactly. Always null today (the
 * registry is seeded empty, per this file's own header comment), correct
 * and unexercised until a future batch registers a real calculator — used
 * by CalculatorResult.gs's foundationCreateCalculatorResult_().
 */
function foundationGetCalculatorBySlugAndVersion_(calculatorSlug, version) {
  var matches = FOUNDATION_CALCULATOR_REGISTRY_.filter(function (c) {
    return c.calculator_slug === calculatorSlug && c.version === version;
  });
  return matches[0] || null;
}
