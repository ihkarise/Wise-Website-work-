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
 * Plan remain deliberately not pre-declared here. Batch PXP-5 adds a fourth
 * entry (`daily_checkin`) and Batch PXP-7 adds a fifth (`care_plan`) —
 * exactly the "a new module ... is added by registering a new registry
 * entry, by the batch that actually builds it" growth docs/47 §4 and this
 * file's own original header comment already anticipated; every earlier
 * row is untouched by each later addition. Batch PXP-10 (docs/44 §10.1/§22,
 * docs/47) removes the `symptom_tracker` entry below — Symptom Tracker's
 * dashboard entry is retired now that Daily Check-in (PXP-5) is proven in
 * production; `SymptomLogs` rows are retained permanently and
 * `log_symptom`/`get_symptom_logs` stay deprecated-but-functional (zero
 * lines changed in the frozen `apps-script/FoundationSymptomLog.gs` or
 * `FoundationRouter.gs`'s existing dispatch cases — see
 * shared/schemas/symptom-log.md's own "Deprecated (Batch PXP-10)" section).
 * Every other row is untouched by this removal.
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
  },
  {
    // Batch PXP-7 (docs/44 §12/§22) — the Personal Care Plan's own
    // registration. data_source mirrors daily_checkin's own convention:
    // the module's "preview" call is get_care_plan (the patient's current
    // plan); the card's own view additionally calls get_doctor_instructions
    // directly, the same way the Daily Check-in card calls
    // get_checkin_template beyond its own data_source. display_order: 40
    // places it after Reports (30) — the three PXP-3 rows and the PXP-5 row
    // above are untouched.
    module_id: 'care_plan',
    title: 'Care Plan',
    description: 'Your doctor-authored goals, instructions, and next review date.',
    icon: 'careplan',
    display_order: 40,
    visibility: 'patient',
    permissions: [],
    data_source: 'get_care_plan',
    empty_state: 'nodata',
    rendering_type: 'card',
    future_ai_capable: false,
    supports_notifications: false,
    supports_history: true,
    supports_export: false,
    supports_badges: false,
    supports_reminders: false,
    supports_ai: false,
    supports_doctor_notes: true,
    supports_patient_input: false
  },
  {
    // Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §18.1,
    // ADR-024/025/026) — the patient-facing Holoscan photo-capture card's own
    // registration. data_source mirrors reports' own convention: the
    // module's "preview" call is its recognition-history list
    // (get_holoscan_recognitions); the card's own upload form additionally
    // calls submit_holoscan_recognition directly, the same way the Reports
    // card calls upload_report beyond its own data_source. Fail-closed by
    // PatientModuleState absence — the same default every existing entry
    // already has (ADR-010); no new ADR required for this half (ADR-026
    // governs only the doctor-facing holoscan_review entry's own, heavier
    // rollout discipline).
    module_id: 'holoscan',
    title: 'Medication Photo Scan',
    description: 'Photograph a medicine you are currently taking so your doctor can review and confirm it as part of your medication history.',
    icon: 'holoscan',
    display_order: 20,
    visibility: 'patient',
    permissions: [],
    data_source: 'get_holoscan_recognitions',
    empty_state: 'nodata',
    rendering_type: 'card',
    future_ai_capable: false,
    supports_notifications: false,
    supports_history: true,
    supports_export: false,
    supports_badges: false,
    supports_reminders: false,
    supports_ai: true,
    supports_doctor_notes: true,
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
