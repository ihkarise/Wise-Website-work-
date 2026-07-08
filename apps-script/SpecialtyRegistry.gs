/**
 * Specialty Registry — Batch WPI-2 (docs/50-PHASE-3-TECHNICAL-PLAN.md §6/§19,
 * ADR-018, docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every
 * later batch). Implements shared/constants/specialty-registry.json version
 * 1.0.0 and shared/constants/condition-specialty-map.json version 1.0.0.
 * Phase 3/WHIMS's Pillar 3 (docs/49 §4) — the platform's only mechanism for
 * naming which specialty exists at all and which condition belongs to which
 * specialty, mirroring ModuleRegistry.gs's/CalculatorRegistry.gs's own
 * "availability, not enablement" framing.
 *
 * Static, hand-maintained config — not a dynamic, admin-editable system in
 * this batch's scope, the same "static, staff/developer-maintained config"
 * precedent ModuleRegistry.gs/CalculatorRegistry.gs/TemplateRegistry.gs
 * already established.
 *
 * Manually adapted from shared/constants/specialty-registry.json and
 * shared/constants/condition-specialty-map.json, the same
 * duplication-by-convention ModuleRegistry.gs's own header comment already
 * established — update all three places by hand if either canonical list
 * ever changes, per shared/README.md's rule.
 *
 * Seeded, in this batch, with exactly one specialty (`homeopathy`) — no
 * second specialty is populated (docs/49 §3.1, ADR-018, specialty-registry.md).
 * Every condition slug in shared/constants/condition-slugs.json maps to that
 * one specialty today, resolving docs/50 §6.3's own named-but-undesigned
 * lookup table per docs/51 Part 1.4's recommendation to close it at this
 * batch.
 *
 * This file does not add `specialty_scope` to any Module Registry, Calculator
 * Registry, or Template Registry entry — those three files
 * (ModuleRegistry.gs, CalculatorRegistry.gs, TemplateRegistry.gs, and their
 * shared/constants/*.json sources) are untouched by this batch, zero lines,
 * per docs/50 §3. `specialty_scope` becomes a real, usable field only once a
 * future batch registers the first entry that actually needs it (docs/53
 * §4) — this file only makes a real Specialty record resolvable for that
 * future use.
 *
 * No dependency on any other file — leaf-level config, the same role
 * ModuleRegistry.gs/CalculatorRegistry.gs/TemplateRegistry.gs already play
 * for their own consumers. No FoundationRouter.gs dispatch case is added by
 * this batch — no doctor- or patient-facing surface reads this registry yet
 * (the Doctor Dashboard is WPI-4's scope), mirroring Calculator Registry's
 * (Batch PXP-6) own "mechanism ships before any consumer" precedent.
 */

var FOUNDATION_SPECIALTY_REGISTRY_ = [
  {
    specialty_slug: 'homeopathy',
    display_name: 'Homeopathy',
    status: 'active'
  }
];

var FOUNDATION_DEFAULT_SPECIALTY_SLUG_ = 'homeopathy';

var FOUNDATION_CONDITION_SPECIALTY_MAP_ = [
  { condition_slug: 'mcas', specialty_slug: 'homeopathy' },
  { condition_slug: 'hashimotos-thyroiditis', specialty_slug: 'homeopathy' },
  { condition_slug: 'chronic-urticaria', specialty_slug: 'homeopathy' },
  { condition_slug: 'eczema', specialty_slug: 'homeopathy' },
  { condition_slug: 'allergic-rhinitis', specialty_slug: 'homeopathy' },
  { condition_slug: 'eosinophilic-esophagitis', specialty_slug: 'homeopathy' },
  { condition_slug: 'pots', specialty_slug: 'homeopathy' },
  { condition_slug: 'dermographism', specialty_slug: 'homeopathy' }
];

/**
 * Returns the full, static Specialty Registry list. Pure, no Apps Script
 * dependency — covered directly by Conformance Tests, the same convention
 * every other Foundation-family pure helper already follows.
 */
function foundationGetSpecialtyRegistry_() {
  return FOUNDATION_SPECIALTY_REGISTRY_;
}

/**
 * Returns the exact specialty_slug registry entry, or null — mirrors
 * foundationGetCalculatorBySlugAndVersion_()'s exact-lookup shape.
 */
function foundationGetSpecialtyBySlug_(specialtySlug) {
  var matches = FOUNDATION_SPECIALTY_REGISTRY_.filter(function (s) {
    return s.specialty_slug === specialtySlug;
  });
  return matches[0] || null;
}

/**
 * Resolves the specialty a given condition_slug belongs to. A condition with
 * no explicit mapping (or an empty/unrecognized slug) resolves to
 * FOUNDATION_DEFAULT_SPECIALTY_SLUG_ — "a patient with no specialty-mapped
 * condition is treated as the implicit default specialty, matching today's
 * actual behavior exactly" (docs/50 §6.3). Never throws; always resolves to
 * a real specialty_slug.
 */
function foundationGetSpecialtyForCondition_(conditionSlug) {
  var match = FOUNDATION_CONDITION_SPECIALTY_MAP_.filter(function (m) {
    return m.condition_slug === conditionSlug;
  })[0];
  return match ? match.specialty_slug : FOUNDATION_DEFAULT_SPECIALTY_SLUG_;
}
