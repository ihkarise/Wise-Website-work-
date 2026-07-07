/**
 * Check-In Template Assignment — Batch PXP-5 (docs/44-PHASE-2B-TECHNICAL-PLAN.md
 * §10.2, §11, §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and
 * every later batch). Implements shared/schemas/
 * check-in-template-assignment.schema.json version 1.0.0.
 *
 * ---- A disclosed, additive gap-fill, not a new architectural decision ----
 * docs/44 §10.2 settles that "a doctor explicitly assigns which template(s)
 * apply" to a patient, informed by (never automatically derived from) their
 * DoctorAssignedCondition rows (docs/44 §6.3) — "rather than the system
 * auto-resolving a conflict when a patient has more than one active
 * condition." Neither docs/44 §17's entity table nor docs/33 §6.5 names a
 * persisted shape for that assignment decision itself — only
 * `CheckInTemplate` (the registry row, TemplateRegistry.gs) and
 * `CheckInResponse` (the patient's answers, CheckInResponse.gs) are named.
 * Without a persisted assignment, "a doctor explicitly assigns" has nothing
 * to record a decision into, and CheckInResponse.gs's own write path (which
 * must verify a patient is actually assigned the template_id they are
 * submitting against, not merely that the template_id exists at all) has no
 * mechanism to check against. This file is that minimal, disclosed fix — an
 * exact structural mirror of DoctorAssignedCondition.gs (docs/44 §6, already
 * twice-approved for exactly this "doctor decides, patient never
 * self-assigns" shape), not a new pattern, new registry, or new ADR. See
 * shared/constants/template-registry.md's own "Doctor assignment" section
 * and this batch's PR description for the same disclosure, per docs/47 §6's
 * "no hidden architecture changes" rule.
 *
 * Not Foundation-prefixed, for the same reason DoctorAssignedCondition.gs and
 * PatientModuleState.gs aren't (docs/29 §2): a concrete entity built on
 * Foundation's frozen infrastructure, not infrastructure itself.
 *
 * Doctor/staff-owned, not patient-owned — a hard boundary (docs/44 §4.3,
 * §10.2). Every write is a doctor/staff action; the patient never assigns,
 * edits, or resolves their own template assignment. No real Doctor identity/
 * authentication exists yet (docs/33 §1.4), so — mirroring
 * DoctorAssignedCondition.gs's assignFoundationCondition()/
 * resolveFoundationCondition() precedent exactly — the assignment/resolution
 * tool is a manually-run Apps Script editor function, not a new authenticated
 * Web App route. There is no patient-facing surface for this entity directly
 * (unlike DoctorAssignedCondition's own read-only reflection route) — a
 * patient's current template is read indirectly, resolved through
 * foundationGetCurrentCheckInTemplateForPatient_() below and exposed via
 * FoundationRouter.gs's get_checkin_template route.
 *
 * Many-per-patient, append-mostly: a row is created 'active' and may
 * transition to 'resolved' exactly once; it never reverts and is never
 * deleted or overwritten in place beyond that one transition — identical
 * lifecycle to DoctorAssignedCondition.gs's own rows.
 *
 * `template_id` is validated against TemplateRegistry.gs's
 * foundationGetRegisteredTemplateIds_() allowlist, the same
 * "validate against the registry this entity is not itself" discipline
 * PatientModuleState.gs's own module_id validation already established.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..4 file — reuses FoundationDataStore.gs's existing generic
 * insert/getById/updateById/query operations and FoundationAudit.gs's
 * existing foundationLogAuditEvent_() exactly as both were already designed
 * to be reused (ADR-009).
 *
 * Depends on TemplateRegistry.gs, FoundationDataStore.gs, FoundationAudit.gs,
 * FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_SHEET_ = 'CheckInTemplateAssignments';
var FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_COLUMNS_ = ['assignment_id', 'patient_id', 'template_id', 'assigned_by', 'assigned_at', 'status', 'resolved_at', 'resolved_by'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new assignment. Mirrors
 * foundationValidateAssignConditionInput_()'s structure exactly.
 */
function foundationValidateAssignCheckInTemplateInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.template_id !== 'string' || foundationGetRegisteredTemplateIds_().indexOf(input.template_id) === -1) {
    errors.push('template_id must be one of the registered Template Registry ids.');
  }
  if (!input || typeof input.assigned_by !== 'string' || input.assigned_by.trim() === '') {
    errors.push('assigned_by (doctor/staff identifier) is required.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a resolve operation's own input shape — mirrors
 * foundationValidateResolveConditionInput_() exactly. Whether `assignment_id`
 * actually resolves to an existing, active row is checked by
 * foundationResolveCheckInTemplateAssignment_() itself.
 */
function foundationValidateResolveCheckInTemplateAssignmentInput_(input) {
  var errors = [];
  if (!input || typeof input.assignment_id !== 'string' || input.assignment_id.trim() === '') {
    errors.push('assignment_id is required.');
  }
  if (!input || typeof input.resolved_by !== 'string' || input.resolved_by.trim() === '') {
    errors.push('resolved_by (doctor/staff identifier) is required.');
  }
  return errors;
}

/**
 * Builds a new, active CheckInTemplateAssignment record (shared/schemas/
 * check-in-template-assignment.schema.json). `assigned_at` is always
 * server-set; `resolved_at`/`resolved_by` start as empty-string sentinels.
 */
function foundationBuildCheckInTemplateAssignmentRecord_(input, assignmentId, nowIso) {
  return {
    assignment_id: assignmentId,
    patient_id: input.patient_id.trim(),
    template_id: input.template_id,
    assigned_by: input.assigned_by.trim(),
    assigned_at: nowIso,
    status: 'active',
    resolved_at: '',
    resolved_by: ''
  };
}

// ---- Sheets-backed operations ----

/**
 * Creates a new, active CheckInTemplateAssignment row for `input.patient_id`.
 * Doctor/staff-only — `input.patient_id` is caller-supplied here (there is
 * no patient session at assignment time), never session-derived. Validation
 * failure is an expected outcome (direct envelope, not the generic wrapper),
 * the same convention every other Foundation entity's input validation
 * already follows.
 */
function foundationAssignCheckInTemplate_(input) {
  var errors = foundationValidateAssignCheckInTemplateInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var assignmentId = generateFoundationId_();
    var record = foundationBuildCheckInTemplateAssignmentRecord_(input, assignmentId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_SHEET_, FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_COLUMNS_, record);
    foundationLogAuditEvent_('checkin_template_assigned', record.patient_id, record.assigned_by, 'assignment_id=' + assignmentId + ' template_id=' + record.template_id);
    return record;
  });
}

/**
 * Resolves an existing, active CheckInTemplateAssignment row by
 * `input.assignment_id`. Doctor/staff-only. Rejects
 * (FOUNDATION_INVALID_INPUT) an unknown `assignment_id` or one that is
 * already 'resolved' — a resolve is a one-way, exactly-once transition,
 * never idempotent, never reversible. Mirrors
 * foundationResolveCondition_()'s structure exactly, including its
 * pre-mutation existence/status check.
 */
function foundationResolveCheckInTemplateAssignment_(input) {
  var errors = foundationValidateResolveCheckInTemplateAssignmentInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var assignmentId = input.assignment_id.trim();
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_SHEET_, FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_COLUMNS_, 'assignment_id', assignmentId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (!lookup.data || lookup.data.status !== 'active') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'assignment_id must reference an existing, active assignment.');
  }
  var existing = lookup.data;
  return withFoundationErrorHandling_(function () {
    var resolvedBy = input.resolved_by.trim();
    var resolvedAt = foundationNowIso_();
    foundationDsUpdateById_(FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_SHEET_, FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_COLUMNS_, 'assignment_id', assignmentId, {
      status: 'resolved',
      resolved_at: resolvedAt,
      resolved_by: resolvedBy
    });
    foundationLogAuditEvent_('checkin_template_assignment_resolved', existing.patient_id, resolvedBy, 'assignment_id=' + assignmentId + ' template_id=' + existing.template_id);
    existing.status = 'resolved';
    existing.resolved_at = resolvedAt;
    existing.resolved_by = resolvedBy;
    return existing;
  });
}

/**
 * Returns `patientId`'s single most-recently-assigned still-`active`
 * CheckInTemplateAssignment row, or null if none exists. This is the
 * lookup CheckInResponse.gs's write path uses to verify a patient is
 * actually assigned the template_id they are submitting against (never
 * merely that the template_id exists in the registry at all), and the
 * lookup foundationGetCurrentCheckInTemplateForPatient_() below uses to
 * resolve which template a patient's Check-in card should render.
 */
function foundationGetActiveTemplateAssignmentForPatient_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_SHEET_, FOUNDATION_CHECKIN_TEMPLATE_ASSIGNMENTS_COLUMNS_, function (row) {
      return row.patient_id === patientId && row.status === 'active';
    });
    if (!rows.length) {
      return null;
    }
    rows.sort(function (a, b) { return a.assigned_at < b.assigned_at ? 1 : -1; });
    return rows[0];
  });
}

/**
 * Resolves `patientId`'s current Check-in template end to end: their
 * active assignment (if any) resolved to that template_id's latest active
 * Template Registry version (docs/44 §11.4: a patient always sees the
 * latest active version of the template they are assigned, never a pinned
 * version — only a recorded CheckInResponse pins template_version). Returns
 * an ok envelope with `data: null` for "not currently assigned" or "the
 * assigned template has no active version" — both a real, expected outcome
 * for a patient whose doctor has not yet acted, never an error (the same
 * "not an error state" discipline foundationDefaultPatientProfile_()
 * already established for a never-saved profile).
 */
function foundationGetCurrentCheckInTemplateForPatient_(patientId) {
  var assignmentLookup = foundationGetActiveTemplateAssignmentForPatient_(patientId);
  if (assignmentLookup.status === 'error') {
    return assignmentLookup;
  }
  if (!assignmentLookup.data) {
    return buildFoundationOkEnvelope_(null);
  }
  var latestVersion = foundationGetLatestActiveTemplateVersion_(assignmentLookup.data.template_id);
  return buildFoundationOkEnvelope_(latestVersion || null);
}

// ---- Manually-run wrappers (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real patient/template/staff details.
 * Not a Web App endpoint — no real Doctor identity/session exists yet
 * (docs/33 §1.4), so this is the doctor/staff assignment tool for this
 * batch, mirroring DoctorAssignedCondition.gs's assignFoundationCondition()
 * exactly.
 */
function assignFoundationCheckInTemplate() {
  var result = foundationAssignCheckInTemplate_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    template_id: 'EDIT ME BEFORE RUNNING',
    assigned_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real assignment/staff details. Not a
 * Web App endpoint, for the same reason assignFoundationCheckInTemplate()
 * isn't.
 */
function resolveFoundationCheckInTemplateAssignment() {
  var result = foundationResolveCheckInTemplateAssignment_({
    assignment_id: 'EDIT ME BEFORE RUNNING',
    resolved_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
