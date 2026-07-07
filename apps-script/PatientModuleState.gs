/**
 * Patient Module State — Batch PXP-3 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §7.2,
 * §17, §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and every
 * later batch). Implements shared/schemas/patient-module-state.schema.json
 * version 1.0.0. Phase 2B's Pillar 2 (docs/44 §4.1) — per-patient module
 * *enablement*, the counterpart to ModuleRegistry.gs's module *availability*
 * (ADR-012, amended).
 *
 * Not Foundation-prefixed, for the same reason DoctorAssignedCondition.gs and
 * FoundationPatientProfile.gs aren't (docs/29 §2): a concrete entity built on
 * Foundation's frozen infrastructure, not infrastructure itself.
 *
 * Doctor/staff-owned, not patient-owned — a hard boundary (docs/44 §14,
 * shared/schemas/patient-module-state.md). Every write is a doctor/staff
 * action; the patient never enables or disables their own module. No real
 * Doctor identity/authentication exists yet (docs/33 §1.4, a named, disclosed
 * gap), so — mirroring DoctorAssignedCondition.gs's assignFoundationCondition()
 * precedent exactly — the enable/disable tool is a manually-run Apps Script
 * editor function, not a new authenticated Web App route. The one
 * patient-facing surface this batch adds is a read-only route
 * (FoundationRouter.gs's get_patient_module_states), deriving patient_id
 * exclusively from the verified session.
 *
 * Composite-keyed on (patient_id, module_id), at most one row per pair —
 * unlike DoctorAssignedCondition's append-mostly, many-per-patient rows. See
 * shared/schemas/patient-module-state.md for why this schema's own
 * server-derived state_key field exists: FoundationDataStore.gs's
 * getById_/updateById_ take a single idColumn, and that file is frozen
 * (touched only for a genuine bug fix, docs/47 §6) — state_key lets this
 * entity reuse those existing primitives unmodified rather than special-case
 * a composite key into shared, frozen infrastructure.
 *
 * Absence of a row for a given (patient_id, module_id) means that module is
 * disabled for that patient — fail-closed (ADR-010), the same default
 * docs/44 §7.2 requires. foundationGetPatientModuleStates_() is the one
 * function responsible for presenting this correctly: it merges
 * ModuleRegistry.gs's full module list with whatever rows actually exist, so
 * a future consumer never has to remember to treat "missing row" as
 * "disabled" itself.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1/PXP-2 file — reuses FoundationDataStore.gs's existing generic
 * insert/getById/updateById/query operations and FoundationAudit.gs's
 * existing foundationLogAuditEvent_() exactly as both were already designed
 * to be reused (ADR-009).
 *
 * Depends on ModuleRegistry.gs, FoundationDataStore.gs, FoundationAudit.gs,
 * FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_PATIENT_MODULE_STATE_SHEET_ = 'PatientModuleState';
var FOUNDATION_PATIENT_MODULE_STATE_COLUMNS_ = ['state_key', 'patient_id', 'module_id', 'enabled', 'enabled_by', 'enabled_at'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Builds this entity's deterministic, server-derived identity column —
 * never doctor/staff-supplied, never patient-visible (shared/schemas/
 * patient-module-state.md). Recomputing this from the same patient_id/
 * module_id pair always yields the same value.
 */
function foundationBuildModuleStateKey_(patientId, moduleId) {
  return patientId + '::' + moduleId;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). `patient_id`/`module_id`/`enabled`/`enabled_by` are all required —
 * an enablement write with a missing field is meaningless, the same
 * discipline foundationValidateAssignConditionInput_() already applies to
 * DoctorAssignedCondition's own required-everything shape.
 */
function foundationValidateSetModuleStateInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.module_id !== 'string' || foundationGetRegisteredModuleIds_().indexOf(input.module_id) === -1) {
    errors.push('module_id must be one of the registered Module Registry ids.');
  }
  if (!input || typeof input.enabled !== 'boolean') {
    errors.push('enabled must be a boolean.');
  }
  if (!input || typeof input.enabled_by !== 'string' || input.enabled_by.trim() === '') {
    errors.push('enabled_by (doctor/staff identifier) is required.');
  }
  return errors;
}

/**
 * Builds a PatientModuleState record (shared/schemas/
 * patient-module-state.schema.json). `enabled_at` is always server-set;
 * `state_key` is always server-derived, never accepted from `input`.
 */
function foundationBuildModuleStateRecord_(input, nowIso) {
  var patientId = input.patient_id.trim();
  var moduleId = input.module_id;
  return {
    state_key: foundationBuildModuleStateKey_(patientId, moduleId),
    patient_id: patientId,
    module_id: moduleId,
    enabled: input.enabled,
    enabled_by: input.enabled_by.trim(),
    enabled_at: nowIso
  };
}

// ---- Sheets-backed operations ----

/**
 * Creates or updates the (input.patient_id, input.module_id) row — an
 * upsert, the same discipline foundationSavePatientProfile_() already
 * established for its own 1:1 key, applied here to a composite one via
 * state_key. Doctor/staff-only — input.patient_id is caller-supplied here
 * (there is no patient session at enablement time; see this file's own
 * header comment), never session-derived. Validation failure is an expected
 * outcome (direct envelope, not the generic wrapper), the same convention
 * every other Foundation entity's input validation already follows.
 */
function foundationSetModuleState_(input) {
  var errors = foundationValidateSetModuleStateInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var record = foundationBuildModuleStateRecord_(input, foundationNowIso_());
    var existing = foundationDsGetById_(FOUNDATION_PATIENT_MODULE_STATE_SHEET_, FOUNDATION_PATIENT_MODULE_STATE_COLUMNS_, 'state_key', record.state_key);
    if (existing) {
      foundationDsUpdateById_(FOUNDATION_PATIENT_MODULE_STATE_SHEET_, FOUNDATION_PATIENT_MODULE_STATE_COLUMNS_, 'state_key', record.state_key, record);
    } else {
      foundationDsInsert_(FOUNDATION_PATIENT_MODULE_STATE_SHEET_, FOUNDATION_PATIENT_MODULE_STATE_COLUMNS_, record);
    }
    foundationLogAuditEvent_(record.enabled ? 'module_state_enabled' : 'module_state_disabled', record.patient_id, record.enabled_by, 'module_id=' + record.module_id);
    return record;
  });
}

/**
 * Returns `patientId`'s module-state view across the *entire* Module
 * Registry — one entry per registered module, `enabled: false` (fail-closed,
 * ADR-010) synthesized for any module with no PatientModuleState row yet,
 * and the real, persisted row's own `enabled`/`enabled_by`/`enabled_at`
 * merged in wherever one exists. `patientId` must already be
 * session-verified by the caller (ADR-002) for the patient-facing route —
 * this function never re-derives it.
 */
function foundationGetPatientModuleStates_(patientId) {
  return withFoundationErrorHandling_(function () {
    var existingRows = foundationDsQuery_(FOUNDATION_PATIENT_MODULE_STATE_SHEET_, FOUNDATION_PATIENT_MODULE_STATE_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    var byModuleId = {};
    existingRows.forEach(function (row) { byModuleId[row.module_id] = row; });
    return foundationGetModuleRegistry_().map(function (module) {
      var existing = byModuleId[module.module_id];
      if (existing) {
        return existing;
      }
      return {
        state_key: foundationBuildModuleStateKey_(patientId, module.module_id),
        patient_id: patientId,
        module_id: module.module_id,
        enabled: false,
        enabled_by: '',
        enabled_at: ''
      };
    });
  });
}

// ---- Manually-run wrappers (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real patient/module/staff details. Not
 * a Web App endpoint — no real Doctor identity/session exists yet
 * (docs/33 §1.4), so this is the doctor/staff enable/disable tool for this
 * batch, mirroring DoctorAssignedCondition.gs's assignFoundationCondition()
 * exactly.
 */
function setFoundationModuleState() {
  var result = foundationSetModuleState_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    module_id: 'EDIT ME BEFORE RUNNING',
    enabled: true,
    enabled_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
