/**
 * Doctor Module Registry — Batch WPI-3 (docs/50-PHASE-3-TECHNICAL-PLAN.md
 * §7.1/§19, ADR-020, docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this
 * and every later WPI batch) shipped this registry empty; Batch WPI-4
 * (docs/50 §7.3/§7.4/§19) adds this version's one entry. Implements
 * shared/constants/doctor-module-registry.json version 1.1.0. Phase
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
 * InventoryItem.gs's new get_inventory_items route. Every other illustrative
 * capability docs/50 §7.1 names (condition assignment, care-plan authoring,
 * module/calculator/template enablement, PillFill orders, analytics)
 * remains unregistered — each is added as its own registry entry by
 * whichever later, separately-approved WPI batch actually designs and
 * builds it (docs/53 §4's "a new registry entry, never new architecture")
 * — the same disclosed precedent CalculatorRegistry.gs already established
 * for its own batch.
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
