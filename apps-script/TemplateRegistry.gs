/**
 * Template Registry — Batch PXP-5 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §11,
 * §11.5, §17, §22; ADR-016; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs
 * this and every later batch). Implements shared/constants/
 * template-registry.json version 1.0.0. Phase 2B's fourth registry
 * (docs/44 §11.5, ADR-016) — the platform's only mechanism for expressing
 * *the shape* of a patient-facing form or questionnaire, complementing
 * (never replacing) Module Registry's own "which capability is exposed"
 * concern (ADR-012).
 *
 * Static, hand-maintained config — not a dynamic, doctor-editable authoring
 * system in this batch's scope (docs/44 §11.1's own "not a patient-facing
 * configuration surface" framing, extended here to mean no admin UI either,
 * mirroring ModuleRegistry.gs's own "static, staff/developer-maintained
 * config" precedent exactly). No real Doctor identity/authentication exists
 * yet (docs/33 §1.4), so "doctor-authored" content is, for this batch,
 * developer-maintained content deployed on a doctor/staff member's behalf —
 * the same disclosed gap every other Phase 2B entity file already carries.
 *
 * Manually adapted from shared/constants/template-registry.json, the same
 * duplication-by-convention ModuleRegistry.gs's own header comment already
 * established — update both places by hand if the canonical list ever
 * changes, per shared/README.md's rule.
 *
 * Seeded, in this batch, with exactly one template — `daily_wellness_checkin`
 * v1 — the Template Registry's first concrete category (`template_category:
 * 'daily_checkin'`, docs/44 §11.5's own naming). The six future categories
 * docs/44 §11.5 names (Weekly Check-in, Monthly Review, Condition Review,
 * Lifestyle Questionnaire, Follow-up Questionnaire, Doctor-created Templates)
 * are deliberately not pre-declared here — the same "name it, do not scope
 * it" discipline module-registry.md already applied to its own future
 * consumers.
 *
 * `template_category` is this file's own disclosed, additive field beyond
 * docs/44 §11.2's literal field list — the concrete mechanism §11.5 requires
 * ("must support, for every category, without a code change") but does not
 * itself name a field for. See shared/constants/template-registry.md for the
 * full disclosure.
 *
 * `future_ai_capable` is the reserved, presently-inert AI-compatibility
 * extension point docs/44 §11.5 requires every template descriptor to
 * carry — consumed by zero code in this batch, mirroring ModuleRegistry.gs's
 * own `future_ai_capable` reservation exactly.
 *
 * `(template_id, version)` is immutable once created (docs/44 §11.2/§11.4) —
 * editing a template's questions means appending a new version row under the
 * same template_id, never mutating an existing entry in place.
 *
 * No dependency on any other file — leaf-level config, the same role
 * ModuleRegistry.gs already plays for its own consumers.
 */

var FOUNDATION_TEMPLATE_REGISTRY_ = [
  {
    template_id: 'daily_wellness_checkin',
    version: 1,
    template_category: 'daily_checkin',
    condition_slug: '',
    questions: [
      { field_key: 'overall_feeling', label: 'How are you feeling today, overall?', type: 'number', min: 1, max: 10, required: true },
      { field_key: 'symptom_severity', label: "Rate today's symptom severity", type: 'number', min: 1, max: 10, required: true },
      { field_key: 'took_medication', label: 'Did you take your prescribed medication today?', type: 'boolean', required: true },
      { field_key: 'notes', label: 'Anything else your doctor should know? (optional)', type: 'string', required: false }
    ],
    status: 'active',
    future_ai_capable: false,
    created_by: 'system',
    created_at: '2026-07-09T00:00:00.000Z'
  }
];

/**
 * Returns the array of every distinct, registered template_id — the
 * allowlist CheckInTemplateAssignment.gs validates a doctor/staff
 * assignment's template_id against, kept here next to the registry it is
 * derived from, mirroring foundationGetRegisteredModuleIds_() exactly.
 */
function foundationGetRegisteredTemplateIds_() {
  var ids = FOUNDATION_TEMPLATE_REGISTRY_.map(function (t) { return t.template_id; });
  return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
}

/**
 * Returns the exact (template_id, version) registry entry, or null — the
 * immutable-pair lookup docs/44 §11.4 requires every CheckInResponse write
 * to validate against before persisting.
 */
function foundationGetTemplateByIdAndVersion_(templateId, version) {
  var matches = FOUNDATION_TEMPLATE_REGISTRY_.filter(function (t) {
    return t.template_id === templateId && t.version === version;
  });
  return matches[0] || null;
}

/**
 * Returns the highest-version `status: 'active'` entry for `templateId`, or
 * null if none is active — what a patient's Check-in card actually renders
 * today. A template with only retired versions (none currently active)
 * returns null, the same "nothing to show" outcome as an unassigned patient.
 */
function foundationGetLatestActiveTemplateVersion_(templateId) {
  var activeVersions = FOUNDATION_TEMPLATE_REGISTRY_.filter(function (t) {
    return t.template_id === templateId && t.status === 'active';
  });
  if (!activeVersions.length) {
    return null;
  }
  return activeVersions.reduce(function (latest, t) {
    return t.version > latest.version ? t : latest;
  });
}
