/**
 * Module Registry — Batch PXP-3 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §7.1,
 * §17, §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and every
 * later batch). Implements shared/constants/module-registry.json version
 * 1.0.0. Phase 2B's Pillar 2 (docs/44 §4.1) — the platform's only mechanism
 * for expressing which patient-facing capabilities exist at all
 * (availability, as distinct from PatientModuleState.gs's per-patient
 * enablement — see ADR-012, amended).
 *
 * Static, hand-maintained config — not a dynamic, admin-editable system in
 * this batch's scope (docs/44 §7.1). Manually adapted from
 * shared/constants/module-registry.json, the same duplication-by-convention
 * DoctorAssignedCondition.gs's own condition-slug allowlist already
 * established (a distinctly-named copy, not a shared global, to avoid a
 * cross-file static-analysis collision) — update both places by hand if the
 * canonical list ever changes, per shared/README.md's rule.
 *
 * Seeded, in Batch PXP-3, with only the three already-implemented Phase 2A
 * capabilities (Timeline, Symptom Tracker, Reports) — see
 * shared/constants/module-registry.md for why Calculators and Personal Care
 * Plan remain deliberately not pre-declared here. Batch PXP-5 adds the
 * fourth entry below (`daily_checkin`) — exactly the "a new module ... is
 * added by registering a new registry entry, by the batch that actually
 * builds it" growth docs/47 §4 and this file's own original header comment
 * already anticipated; the three PXP-3 rows above are untouched.
 *
 * Every `supports_*`/`future_ai_capable` field below is a reserved,
 * presently-inert extension point, consumed by zero code in this batch —
 * mirroring docs/44 §7.1's own AI-readiness reservation, generalized to a
 * broader family of future capability dimensions (see
 * shared/constants/module-registry.md's field-by-field table for what each
 * one is reserved for and why).
 *
 * No dependency on any other file — leaf-level config, the same role
 * shared/constants/condition-slugs.json's hand-ported copies already play
 * for their own consumers.
 */

var FOUNDATION_MODULE_REGISTRY_ = [
  {
    module_id: 'timeline',
    title: 'Timeline',
    description: 'A merged, reverse-chronological feed of consultation history and other health events.',
    icon: 'timeline',
    display_order: 10,
    visibility: 'patient',
    permissions: [],
    data_source: 'get_timeline',
    empty_state: 'nodata',
    rendering_type: 'card',
    future_ai_capable: false,
    supports_notifications: false,
    supports_history: true,
    supports_export: false,
    supports_badges: false,
    supports_reminders: false,
    supports_ai: false,
    supports_doctor_notes: false,
    supports_patient_input: false
  },
  {
    module_id: 'symptom_tracker',
    title: 'Symptom Tracker',
    description: "The patient's own severity/sleep/energy/stress self-report history.",
    icon: 'symptoms',
    display_order: 20,
    visibility: 'patient',
    permissions: [],
    data_source: 'get_symptom_logs',
    empty_state: 'nodata',
    rendering_type: 'card',
    future_ai_capable: false,
    supports_notifications: false,
    supports_history: true,
    supports_export: false,
    supports_badges: false,
    supports_reminders: true,
    supports_ai: false,
    supports_doctor_notes: false,
    supports_patient_input: true
  },
  {
    module_id: 'reports',
    title: 'Reports',
    description: 'Uploaded lab results, prescriptions, and prior medical records.',
    icon: 'reports',
    display_order: 30,
    visibility: 'patient',
    permissions: [],
    data_source: 'get_reports',
    empty_state: 'nodata',
    rendering_type: 'card',
    future_ai_capable: false,
    supports_notifications: false,
    supports_history: true,
    supports_export: true,
    supports_badges: false,
    supports_reminders: false,
    supports_ai: false,
    supports_doctor_notes: false,
    supports_patient_input: true
  },
  {
    // Batch PXP-5 (docs/44 §10/§11/§22) — the Daily Check-in Engine's own
    // registration. data_source mirrors symptom_tracker's own convention:
    // the module's "preview" call is its response-history list
    // (get_checkin_responses); the card's own form additionally calls
    // get_checkin_template (to know what to render) and
    // submit_checkin_response (to write) directly, the same way Symptom
    // Tracker's card calls log_symptom beyond its own get_symptom_logs
    // data_source.
    module_id: 'daily_checkin',
    title: 'Daily Check-in',
    description: 'A short, doctor-assigned daily check-in on how you are feeling today.',
    icon: 'checkin',
    display_order: 15,
    visibility: 'patient',
    permissions: [],
    data_source: 'get_checkin_responses',
    empty_state: 'nodata',
    rendering_type: 'card',
    future_ai_capable: false,
    supports_notifications: false,
    supports_history: true,
    supports_export: false,
    supports_badges: false,
    supports_reminders: true,
    supports_ai: false,
    supports_doctor_notes: false,
    supports_patient_input: true
  }
];

/**
 * Returns the full, static Module Registry list. Pure, no Apps Script
 * dependency — covered directly by Conformance Tests, the same convention
 * every other Foundation-family pure helper already follows.
 */
function foundationGetModuleRegistry_() {
  return FOUNDATION_MODULE_REGISTRY_;
}

/**
 * Returns the array of every registered module_id, the allowlist
 * PatientModuleState.gs validates against — kept here, next to the
 * registry it is derived from, rather than hand-duplicated a second time.
 */
function foundationGetRegisteredModuleIds_() {
  return FOUNDATION_MODULE_REGISTRY_.map(function (m) { return m.module_id; });
}
