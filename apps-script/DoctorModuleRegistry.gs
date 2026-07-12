/**
 * Doctor Module Registry — Batch WPI-3 (docs/50-PHASE-3-TECHNICAL-PLAN.md
 * §7.1/§19, ADR-020, docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this
 * and every later WPI batch) shipped this registry empty; Batch WPI-4
 * (docs/50 §7.3/§7.4/§19) adds this version's one entry. Implements
 * shared/constants/doctor-module-registry.json version 1.5.0. Phase
 * 3/WHIMS's Pillar 2 (docs/49 §4) — the platform's only mechanism for
 * naming which doctor-facing capability exists at all, mirroring
 * ModuleRegistry.gs's/CalculatorRegistry.gs's own "availability, not
 * enablement" framing, applied to a separate registry for a separate
 * identity type (Doctor Identity, ADR-017) — never merged with the
 * patient-facing Module Registry (ADR-020).
 *
 * Static, hand-maintained config — not a dynamic, admin-editable system in
 * this batch's scope, the same "static, staff/developer-maintained config"
 * precedent ModuleRegistry.gs/CalculatorRegistry.gs/SpecialtyRegistry.gs
 * already established.
 *
 * Manually adapted from shared/constants/doctor-module-registry.json, the
 * same duplication-by-convention ModuleRegistry.gs's own header comment
 * already established — update both places by hand if the canonical list
 * ever changes, per shared/README.md's rule.
 *
 * Batch WPI-4 registered this registry's first real, doctor-facing
 * capability: 'patient_roster' (docs/50 §7.4), backed by
 * DoctorPatientRoster.gs's get_doctor_patient_roster route. Batch WPI-5
 * (docs/50 §8) adds this version's second entry, 'appointments', backed by
 * Appointment.gs's new get_doctor_appointments route. Batch WPI-7 (docs/50
 * §10) adds this version's third entry, 'inventory', backed by
 * InventoryItem.gs's new get_inventory_items route. Batch WPI-8 (docs/50
 * §11) adds this version's fourth entry, 'pillfill_orders', backed by
 * PillFillOrder.gs's new get_pillfill_orders route. Batch WPI-9 (docs/50
 * §12) adds this version's fifth entry, 'analytics', backed by
 * Analytics.gs's new get_doctor_analytics route. Batch WPI-10
 * (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md §13, ADR-021/022/023)
 * adds this version's sixth entry, 'ai_assistant', backed by
 * AIAssistantContext.gs's/AIAssistantInteraction.gs's new
 * get_ai_assistant_capabilities/post_ai_assistant_query/
 * post_ai_assistant_decision routes — diverging from every prior entry in
 * exactly one way (ADR-023): this entry's own DoctorModuleState must remain
 * absent, fail-closed, for every doctor by default; enabling it is a
 * deliberate, disclosed, per-doctor administrative decision, never a
 * bulk/default rollout. Every other illustrative capability docs/50 §7.1
 * names (condition assignment, care-plan authoring, module/calculator/
 * template enablement) remains unregistered — each is added as its own
 * registry entry by whichever later, separately-approved WPI batch actually
 * designs and builds it (docs/53 §4's "a new registry entry, never new
 * architecture") — the same disclosed precedent CalculatorRegistry.gs
 * already established for its own batch.
 *
 * No dependency on any other file — leaf-level config, the same role
 * ModuleRegistry.gs/CalculatorRegistry.gs/SpecialtyRegistry.gs already
 * play for their own consumers.
 */

var FOUNDATION_DOCTOR_MODULE_REGISTRY_ = [
  {
    capability_key: 'patient_roster',
    display_name: 'Patient Roster',
    display_order: 10,
    data_source: 'get_doctor_patient_roster',
    future_ai_capable: false
  },
  {
    capability_key: 'appointments',
    display_name: 'Appointments',
    display_order: 20,
    data_source: 'get_doctor_appointments',
    future_ai_capable: false
  },
  {
    capability_key: 'inventory',
    display_name: 'Inventory',
    display_order: 30,
    data_source: 'get_inventory_items',
    future_ai_capable: false
  },
  {
    capability_key: 'pillfill_orders',
    display_name: 'PillFill Orders',
    display_order: 40,
    data_source: 'get_pillfill_orders',
    future_ai_capable: false
  },
  {
    capability_key: 'analytics',
    display_name: 'Analytics',
    display_order: 50,
    data_source: 'get_doctor_analytics',
    future_ai_capable: false
  },
  {
    capability_key: 'ai_assistant',
    display_name: 'AI Assistant',
    display_order: 60,
    data_source: 'get_ai_assistant_capabilities',
    future_ai_capable: false
  },
  {
    // Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §18.2,
    // ADR-024/025/026) — the platform's second AI-output-review doctor
    // capability. Diverges from every entry except ai_assistant, per
    // ADR-026: this entry's own DoctorModuleState must remain absent
    // (fail-closed, ADR-010) for every doctor by default.
    capability_key: 'holoscan_review',
    display_name: 'Holoscan Review',
    display_order: 70,
    data_source: 'get_holoscan_review_queue',
    future_ai_capable: false
  },
  {
    // Batch WPI-11 (docs/56 §18.2/§19.3) — a companion card to holoscan_review,
    // reusing DoctorPatientRoster.gs's own patient-selection route (docs/56
    // §19.3), backed by the dual-guarded get_medication_history route
    // (MedicationHistory.gs). A normal-rollout entry, ADR-010's existing
    // default — not restricted by ADR-026, since this entry only ever
    // displays an already doctor-confirmed record, never a model-generated
    // draft awaiting review.
    capability_key: 'medication_history',
    display_name: 'Medication History',
    display_order: 80,
    data_source: 'get_medication_history',
    future_ai_capable: false
  },
  {
    // Batch PXP-11 (Phase 2C — Health Milestones, docs/58 §18.2/§19.2, ADR-027) — the
    // doctor-facing Milestone Review card's own registration, backed by the roster-scoped
    // get_patient_milestones route. NORMAL rollout — deliberately NOT disabled-by-default
    // (contrast ai_assistant/ADR-023, holoscan_review/ADR-026): this entry reviews
    // doctor-authored content, never model output, so it carries no model-output-review
    // risk to gate more tightly. Fail-closed by DoctorModuleState absence, ADR-010's
    // existing default, exactly like patient_roster/appointments/inventory/analytics/
    // medication_history. No new ADR required (ADR-027 governs the non-AI boundary).
    capability_key: 'milestone_review',
    display_name: 'Milestone Review',
    display_order: 90,
    data_source: 'get_patient_milestones',
    future_ai_capable: false
  }
];

/**
 * Returns the full, static Doctor Module Registry list. Pure, no Apps
 * Script dependency — covered directly by Conformance Tests, the same
 * convention every other Foundation-family pure helper already follows.
 */
function foundationGetDoctorModuleRegistry_() {
  return FOUNDATION_DOCTOR_MODULE_REGISTRY_;
}

/**
 * Returns the array of every registered capability_key, the allowlist
 * DoctorModuleState.gs validates against — kept here, next to the
 * registry it is derived from, rather than hand-duplicated a second time.
 * Always empty today (the registry is seeded empty, per this file's own
 * header comment), correct and unexercised until a future batch registers
 * a real capability.
 */
function foundationGetRegisteredDoctorCapabilityKeys_() {
  return FOUNDATION_DOCTOR_MODULE_REGISTRY_.map(function (m) { return m.capability_key; });
}
