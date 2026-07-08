/**
 * Doctor Module State — Batch WPI-3 (docs/50-PHASE-3-TECHNICAL-PLAN.md
 * §7.2/§19; docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every
 * later WPI batch). Implements
 * shared/schemas/doctor-module-state.schema.json version 1.0.0. Phase
 * 3/WHIMS's Pillar 2 (docs/49 §4) — per-doctor capability *enablement*, the
 * counterpart to DoctorModuleRegistry.gs's capability *availability*,
 * structurally parallel to PatientModuleState.gs/ModuleRegistry.gs but a
 * separate registry and a separate enablement table — never merged with
 * the patient-facing ones (ADR-020).
 *
 * Not Foundation-prefixed, for the same reason DoctorIdentity.gs and
 * PatientModuleState.gs aren't (docs/29 §2): a concrete entity built on
 * Foundation's frozen infrastructure, not infrastructure itself.
 *
 * Staff/administrative-owned, not doctor-owned — a hard boundary
 * (docs/50 §7.2, mirroring docs/44 §14's rule for PatientModuleState).
 * Every write is a staff/administrative action; a doctor never enables or
 * disables their own capability. Mirrors PatientModuleState.gs's
 * setFoundationModuleState() precedent exactly — the enable/disable tool is
 * a manually-run Apps Script editor function, not a new authenticated Web
 * App route. The one doctor-facing surface this batch adds is a read-only
 * route (FoundationRouter.gs's get_doctor_module_states), deriving
 * doctor_id exclusively from the verified DoctorSession.
 *
 * Composite-keyed on (doctor_id, capability_key), at most one row per pair
 * — mirrors PatientModuleState's own (patient_id, module_id) composite key
 * exactly. See shared/schemas/doctor-module-state.md for why this schema's
 * own server-derived state_key field exists: FoundationDataStore.gs's
 * getById_/updateById_ take a single idColumn, and that file is frozen
 * (touched only for a genuine bug fix, docs/53 §6) — state_key lets this
 * entity reuse those existing primitives unmodified rather than special-
 * case a composite key into shared, frozen infrastructure.
 *
 * Absence of a row for a given (doctor_id, capability_key) means that
 * capability is disabled for that doctor — fail-closed (ADR-010), the same
 * default docs/50 §7.2 requires. foundationGetDoctorModuleStates_() is the
 * one function responsible for presenting this correctly: it merges
 * DoctorModuleRegistry.gs's full capability list with whatever rows
 * actually exist, so a future consumer never has to remember to treat
 * "missing row" as "disabled" itself. The registry ships empty in this
 * batch (DoctorModuleRegistry.gs's own header comment), so this merge is
 * currently a no-op — correct and ready for a future batch's first real
 * entry.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..11/WPI-1/WPI-2 file — reuses FoundationDataStore.gs's
 * existing generic insert/getById/updateById/query operations and
 * FoundationAudit.gs's existing foundationLogAuditEvent_() exactly as both
 * were already designed to be reused (ADR-009).
 *
 * Depends on DoctorModuleRegistry.gs, FoundationDataStore.gs,
 * FoundationAudit.gs, FoundationUtils.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs.
 */

var FOUNDATION_DOCTOR_MODULE_STATE_SHEET_ = 'DoctorModuleState';
var FOUNDATION_DOCTOR_MODULE_STATE_COLUMNS_ = ['state_key', 'doctor_id', 'capability_key', 'enabled', 'enabled_by', 'enabled_at'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Builds this entity's deterministic, server-derived identity column —
 * never staff-supplied, never doctor-visible (shared/schemas/
 * doctor-module-state.md). Recomputing this from the same doctor_id/
 * capability_key pair always yields the same value.
 */
function foundationBuildDoctorModuleStateKey_(doctorId, capabilityKey) {
  return doctorId + '::' + capabilityKey;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). `doctor_id`/`capability_key`/`enabled`/`enabled_by` are all
 * required — an enablement write with a missing field is meaningless, the
 * same discipline foundationValidateSetModuleStateInput_() already applies
 * to PatientModuleState's own required-everything shape. capability_key
 * must resolve to a real Doctor Module Registry entry — always false today
 * since the registry ships empty (shared/schemas/doctor-module-state.md's
 * own disclosed "Registry ships empty" section), the same
 * fail-closed-by-absence discipline foundationValidateCalculatorResultInput_()
 * already establishes against an empty Calculator Registry.
 */
function foundationValidateSetDoctorModuleStateInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.capability_key !== 'string' || foundationGetRegisteredDoctorCapabilityKeys_().indexOf(input.capability_key) === -1) {
    errors.push('capability_key must be one of the registered Doctor Module Registry ids.');
  }
  if (!input || typeof input.enabled !== 'boolean') {
    errors.push('enabled must be a boolean.');
  }
  if (!input || typeof input.enabled_by !== 'string' || input.enabled_by.trim() === '') {
    errors.push('enabled_by (staff/administrative identifier) is required.');
  }
  return errors;
}

/**
 * Builds a DoctorModuleState record (shared/schemas/
 * doctor-module-state.schema.json). `enabled_at` is always server-set;
 * `state_key` is always server-derived, never accepted from `input`.
 */
function foundationBuildDoctorModuleStateRecord_(input, nowIso) {
  var doctorId = input.doctor_id.trim();
  var capabilityKey = input.capability_key;
  return {
    state_key: foundationBuildDoctorModuleStateKey_(doctorId, capabilityKey),
    doctor_id: doctorId,
    capability_key: capabilityKey,
    enabled: input.enabled,
    enabled_by: input.enabled_by.trim(),
    enabled_at: nowIso
  };
}

// ---- Sheets-backed operations ----

/**
 * Creates or updates the (input.doctor_id, input.capability_key) row — an
 * upsert, the same discipline foundationSetModuleState_() already
 * established for its own composite key, applied here to the doctor
 * identity space via state_key. Staff-only — input.doctor_id is
 * caller-supplied here (there is no staff session/identity concept in this
 * batch's scope; see this file's own header comment), never
 * DoctorSession-derived. Validation failure is an expected outcome (direct
 * envelope, not the generic wrapper), the same convention every other
 * Foundation entity's input validation already follows.
 */
function foundationSetDoctorModuleState_(input) {
  var errors = foundationValidateSetDoctorModuleStateInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var record = foundationBuildDoctorModuleStateRecord_(input, foundationNowIso_());
    var existing = foundationDsGetById_(FOUNDATION_DOCTOR_MODULE_STATE_SHEET_, FOUNDATION_DOCTOR_MODULE_STATE_COLUMNS_, 'state_key', record.state_key);
    if (existing) {
      foundationDsUpdateById_(FOUNDATION_DOCTOR_MODULE_STATE_SHEET_, FOUNDATION_DOCTOR_MODULE_STATE_COLUMNS_, 'state_key', record.state_key, record);
    } else {
      foundationDsInsert_(FOUNDATION_DOCTOR_MODULE_STATE_SHEET_, FOUNDATION_DOCTOR_MODULE_STATE_COLUMNS_, record);
    }
    foundationLogAuditEvent_(record.enabled ? 'doctor_module_state_enabled' : 'doctor_module_state_disabled', '', record.enabled_by, 'doctor_id=' + record.doctor_id + ' capability_key=' + record.capability_key);
    return record;
  });
}

/**
 * Returns `doctorId`'s capability-state view across the *entire* Doctor
 * Module Registry — one entry per registered capability, `enabled: false`
 * (fail-closed, ADR-010) synthesized for any capability with no
 * DoctorModuleState row yet, and the real, persisted row's own
 * `enabled`/`enabled_by`/`enabled_at` merged in wherever one exists.
 * `doctorId` must already be DoctorSession-verified by the caller
 * (ADR-017) for the doctor-facing route — this function never re-derives
 * it. Returns an empty list today (the registry ships empty, per
 * DoctorModuleRegistry.gs's own header comment) — correct and ready for a
 * future batch's first real entry.
 */
function foundationGetDoctorModuleStates_(doctorId) {
  return withFoundationErrorHandling_(function () {
    var existingRows = foundationDsQuery_(FOUNDATION_DOCTOR_MODULE_STATE_SHEET_, FOUNDATION_DOCTOR_MODULE_STATE_COLUMNS_, function (row) {
      return row.doctor_id === doctorId;
    });
    var byCapabilityKey = {};
    existingRows.forEach(function (row) { byCapabilityKey[row.capability_key] = row; });
    return foundationGetDoctorModuleRegistry_().map(function (capability) {
      var existing = byCapabilityKey[capability.capability_key];
      if (existing) {
        return existing;
      }
      return {
        state_key: foundationBuildDoctorModuleStateKey_(doctorId, capability.capability_key),
        doctor_id: doctorId,
        capability_key: capability.capability_key,
        enabled: false,
        enabled_by: '',
        enabled_at: ''
      };
    });
  });
}

// ---- Manually-run wrapper (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real doctor/capability/staff details.
 * Not a Web App endpoint — mirrors setFoundationModuleState()'s exact
 * precedent, applied here to the doctor identity space (docs/50 §7.2).
 * Every real invocation is rejected with FOUNDATION_INVALID_INPUT today
 * (the registry ships empty, shared/schemas/doctor-module-state.md's own
 * disclosed section) until a future batch registers a real capability.
 */
function setFoundationDoctorModuleState() {
  var result = foundationSetDoctorModuleState_({
    doctor_id: 'EDIT ME BEFORE RUNNING',
    capability_key: 'EDIT ME BEFORE RUNNING',
    enabled: true,
    enabled_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
