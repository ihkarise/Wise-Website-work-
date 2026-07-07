/**
 * Care Plan — Batch PXP-7 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §12, §22;
 * docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and every later
 * batch). Implements shared/schemas/care-plan.schema.json version 1.0.0.
 * A consumer of Pillar 1 (Doctor Assigned Condition) and Pillar 2 (Module
 * Engine), per docs/44 §4.2.
 *
 * Not Foundation-prefixed, for the same reason DoctorAssignedCondition.gs
 * and FoundationPatientProfile.gs aren't (docs/29 §2): a concrete entity
 * built on Foundation's frozen infrastructure, not infrastructure itself.
 *
 * Doctor/staff-owned, not patient-owned — a hard boundary (docs/44 §4.3,
 * shared/schemas/care-plan.md). Every write (authoring a first version or a
 * later version) is a doctor/staff action; the patient never authors, edits,
 * or versions their own plan. No real Doctor identity/authentication exists
 * yet (docs/33 §1.4), so — mirroring DoctorAssignedCondition.gs's
 * assignFoundationCondition() precedent exactly — the authoring tool is a
 * manually-run Apps Script editor function, not a new authenticated Web App
 * route. The one patient-facing surface this batch adds is a read-only
 * route (FoundationRouter.gs's get_care_plan), deriving patient_id
 * exclusively from the verified session.
 *
 * One evolving plan per patient, versioned, never edited in place:
 * care_plan_id is a stable, logical identity generated once and reused by
 * every later version row (mirrors CheckInTemplate's (template_id, version)
 * discipline, docs/44 §11.2/§11.4, per docs/47 §4's "extend an existing
 * pattern whenever possible"). Creating a new version automatically flips
 * the prior version's own status from active to superseded — exactly one
 * active row exists per (patient_id, care_plan_id) at a time. See
 * shared/schemas/care-plan.md for the full lifecycle and the disclosed,
 * deliberate decision not to emit a Timeline Event in this batch (docs/44
 * §12 names this; doing so would require touching two frozen Phase 2A
 * files for new functionality, not a bug fix, per docs/47 §6).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..6 file — reuses FoundationDataStore.gs's existing generic
 * insert/updateById/query operations and FoundationAudit.gs's existing
 * foundationLogAuditEvent_() exactly as both were already designed to be
 * reused (ADR-009).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_CARE_PLANS_SHEET_ = 'CarePlans';
var FOUNDATION_CARE_PLANS_COLUMNS_ = ['version_key', 'care_plan_id', 'patient_id', 'version', 'status', 'goals', 'next_review_date', 'created_by', 'created_at'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Builds this entity's deterministic, server-derived per-row identity
 * column — never doctor/staff-supplied, never patient-visible (shared/
 * schemas/care-plan.md). Many rows legitimately share the same
 * care_plan_id (one per version), so care_plan_id alone cannot address one
 * specific row via FoundationDataStore.gs's single-idColumn primitives;
 * this mirrors foundationBuildModuleStateKey_() (PatientModuleState.gs)
 * exactly, applied here to (care_plan_id, version) instead of
 * (patient_id, module_id).
 */
function foundationBuildCarePlanVersionKey_(carePlanId, version) {
  return carePlanId + '::' + version;
}

/**
 * Returns true only for a real, valid YYYY-MM-DD calendar date — unlike
 * foundationIsValidPastDate_() (FoundationPatientProfile.gs), a review date
 * is naturally expected in the future, so no "not in the future" bound
 * applies here (shared/schemas/care-plan.md's own disclosed rule).
 */
function foundationIsValidCalendarDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  var parts = value.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  var date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && (date.getUTCMonth() + 1) === month && date.getUTCDate() === day;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for authoring a Care Plan version (first or later — the same
 * validation applies to both, since foundationSaveCarePlan_() itself
 * decides which case it is). `goals`/`created_by` are required;
 * `next_review_date` is optional but must be a real calendar date when
 * provided.
 */
function foundationValidateCarePlanInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.goals !== 'string' || input.goals.trim() === '') {
    errors.push('goals is required.');
  }
  if (input && input.next_review_date !== undefined && input.next_review_date !== null && input.next_review_date !== '') {
    if (!foundationIsValidCalendarDate_(input.next_review_date)) {
      errors.push('next_review_date must be a real calendar date (YYYY-MM-DD) when provided.');
    }
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (doctor/staff identifier) is required.');
  }
  return errors;
}

/**
 * Builds a new CarePlan version record (shared/schemas/care-plan.schema.json).
 * `created_at` is always server-set; `status` is always 'active' — the
 * caller (foundationSaveCarePlan_()) is responsible for superseding any
 * prior active row for the same care_plan_id.
 */
function foundationBuildCarePlanRecord_(input, carePlanId, version, nowIso) {
  return {
    version_key: foundationBuildCarePlanVersionKey_(carePlanId, version),
    care_plan_id: carePlanId,
    patient_id: input.patient_id.trim(),
    version: version,
    status: 'active',
    goals: input.goals.trim(),
    next_review_date: (input.next_review_date || '').trim(),
    created_by: input.created_by.trim(),
    created_at: nowIso
  };
}

// ---- Sheets-backed operations ----

/**
 * Returns `patientId`'s current, active CarePlan row, or null if no plan
 * has ever been authored for this patient yet (not an error — the same
 * "not yet configured is not an error" discipline
 * foundationGetCurrentCheckInTemplateForPatient_()'s unassigned-patient
 * outcome already established). `patientId` must already be
 * session-verified by the caller (ADR-002) — this function never
 * re-derives it.
 */
function foundationGetCurrentCarePlanForPatient_(patientId) {
  return withFoundationErrorHandling_(function () {
    var activeRows = foundationDsQuery_(FOUNDATION_CARE_PLANS_SHEET_, FOUNDATION_CARE_PLANS_COLUMNS_, function (row) {
      return row.patient_id === patientId && row.status === 'active';
    });
    return activeRows.length ? activeRows[0] : null;
  });
}

/**
 * Creates or versions `input.patient_id`'s Care Plan. Doctor/staff-only —
 * input.patient_id is caller-supplied here (there is no patient session at
 * authoring time; see this file's own header comment), never
 * session-derived. Validation failure is an expected outcome (direct
 * envelope, not the generic wrapper), the same convention every other
 * Foundation entity's input validation already follows.
 *
 * If the patient has no existing active plan, this creates version 1 under
 * a newly-generated care_plan_id. If an active plan already exists, this
 * creates the next version under the *same* care_plan_id and flips the
 * prior version's own row to status=superseded — an append (new row) plus
 * one in-place patch (the prior row's status only), never an edit of the
 * new version's own content after the fact.
 */
function foundationSaveCarePlan_(input) {
  var errors = foundationValidateCarePlanInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var patientId = input.patient_id.trim();
  var existingLookup = withFoundationErrorHandling_(function () {
    var activeRows = foundationDsQuery_(FOUNDATION_CARE_PLANS_SHEET_, FOUNDATION_CARE_PLANS_COLUMNS_, function (row) {
      return row.patient_id === patientId && row.status === 'active';
    });
    return activeRows.length ? activeRows[0] : null;
  });
  if (existingLookup.status === 'error') {
    return existingLookup; // unexpected failure — already a safe, generic envelope
  }
  var existing = existingLookup.data;
  return withFoundationErrorHandling_(function () {
    var nowIso = foundationNowIso_();
    var carePlanId = existing ? existing.care_plan_id : generateFoundationId_();
    var version = existing ? existing.version + 1 : 1;
    var record = foundationBuildCarePlanRecord_(input, carePlanId, version, nowIso);
    if (existing) {
      // care_plan_id is not unique per row (many versions share it), so the
      // prior active version is addressed by its own version_key — the
      // disclosed, per-row identity column this schema adds specifically so
      // FoundationDataStore.gs's single-idColumn foundationDsUpdateById_()
      // can target exactly one row (shared/schemas/care-plan.md).
      foundationDsUpdateById_(FOUNDATION_CARE_PLANS_SHEET_, FOUNDATION_CARE_PLANS_COLUMNS_, 'version_key', existing.version_key, { status: 'superseded' });
    }
    foundationDsInsert_(FOUNDATION_CARE_PLANS_SHEET_, FOUNDATION_CARE_PLANS_COLUMNS_, record);
    foundationLogAuditEvent_(existing ? 'care_plan_versioned' : 'care_plan_created', patientId, record.created_by, 'care_plan_id=' + carePlanId + ' version=' + version);
    return record;
  });
}

// ---- Manually-run wrapper (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real patient/plan/staff details. Not a
 * Web App endpoint — no real Doctor identity/session exists yet
 * (docs/33 §1.4), so this is the doctor/staff authoring tool for this
 * batch, mirroring DoctorAssignedCondition.gs's assignFoundationCondition()
 * exactly. Run again with the same patient_id to create a new version
 * (goals/next_review_date update) rather than editing an existing row.
 */
function saveFoundationCarePlan() {
  var result = foundationSaveCarePlan_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    goals: 'EDIT ME BEFORE RUNNING',
    next_review_date: '', // optional, e.g. '2026-08-01'
    created_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
