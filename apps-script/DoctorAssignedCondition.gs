/**
 * Doctor Assigned Condition — Batch PXP-2 (docs/44-PHASE-2B-TECHNICAL-PLAN.md
 * §6, §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and every
 * later batch). Implements shared/schemas/doctor-assigned-condition.schema.json
 * version 1.0.0. Phase 2B's Pillar 1 (docs/44 §4.1) — the platform's only
 * mechanism for expressing which patient needs which capability.
 *
 * Not Foundation-prefixed, for the same reason PatientIdentity.gs,
 * FoundationSymptomLog.gs, and FoundationPatientProfile.gs aren't (docs/29
 * §2): this is a concrete entity built on Foundation's frozen infrastructure,
 * not infrastructure itself.
 *
 * Doctor/staff-owned, not patient-owned — a hard boundary (docs/44 §4.3,
 * shared/schemas/doctor-assigned-condition.md). Every write (assignment and
 * resolution) is a doctor/staff action; the patient never creates, edits, or
 * resolves a row of this shape. No real Doctor identity/authentication exists
 * yet (docs/33 §1.4, a named, disclosed gap), so — mirroring
 * PatientIdentity.gs's createFoundationPatient() precedent exactly — the
 * assignment/resolution tool is a manually-run Apps Script editor function,
 * not a new authenticated Web App route. The one patient-facing surface this
 * batch adds is a read-only route (FoundationRouter.gs's
 * get_doctor_assigned_conditions), deriving patient_id exclusively from the
 * verified session, the same authorization primitive every other Foundation
 * read route already uses.
 *
 * Many-per-patient, append-mostly: a row is created 'active' and may
 * transition to 'resolved' exactly once; it never reverts and is never
 * deleted or overwritten in place beyond that one transition. Re-assigning a
 * previously-resolved condition creates a new row, preserving the old one as
 * permanent history.
 *
 * A wholly additive entity — the frozen `Patients` sheet/
 * patient-identity.schema.json (ADR-002) is never widened; `Patient.
 * condition_slug` remains exactly where it is, untouched and unread by this
 * file (docs/45 Part 1.2's coexistence loose end, resolved: this batch does
 * not migrate any existing reader).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1 file — reuses FoundationDataStore.gs's existing generic
 * insert/updateById/query operations and FoundationAudit.gs's existing
 * foundationLogAuditEvent_() exactly as both were already designed to be
 * reused (ADR-009).
 *
 * `FOUNDATION_CONDITION_ASSIGNMENT_ALLOWED_SLUGS_` below is manually adapted
 * from shared/constants/condition-slugs.json version 1.0.0, the same
 * duplication-by-convention FoundationSymptomLog.gs's own allowlist already
 * established (a distinctly-named copy, not a shared global, to avoid a
 * cross-file static-analysis collision) — update both places by hand if the
 * canonical list ever changes, per shared/README.md's rule.
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_CONDITION_ASSIGNMENTS_SHEET_ = 'DoctorAssignedConditions';
var FOUNDATION_CONDITION_ASSIGNMENTS_COLUMNS_ = ['assignment_id', 'patient_id', 'condition_slug', 'assigned_by', 'assigned_at', 'status', 'resolved_at', 'resolved_by'];

var FOUNDATION_CONDITION_ASSIGNMENT_ALLOWED_SLUGS_ = [
  'mcas',
  'hashimotos-thyroiditis',
  'chronic-urticaria',
  'eczema',
  'allergic-rhinitis',
  'eosinophilic-esophagitis',
  'pots',
  'dermographism'
];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new assignment. `patient_id`/`condition_slug`/`assigned_by`
 * are all required — unlike PatientProfile's all-optional fields, an
 * assignment with a missing field is meaningless, not a valid partial state.
 */
function foundationValidateAssignConditionInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.condition_slug !== 'string' || FOUNDATION_CONDITION_ASSIGNMENT_ALLOWED_SLUGS_.indexOf(input.condition_slug) === -1) {
    errors.push('condition_slug must be one of the canonical condition slugs.');
  }
  if (!input || typeof input.assigned_by !== 'string' || input.assigned_by.trim() === '') {
    errors.push('assigned_by (doctor/staff identifier) is required.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a resolve operation's own input shape — this only validates
 * `resolved_by`'s presence; whether `assignment_id` actually resolves to an
 * existing, active row is checked by foundationResolveCondition_() itself,
 * since that check requires a Sheets read.
 */
function foundationValidateResolveConditionInput_(input) {
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
 * Builds a new, active DoctorAssignedCondition record (shared/schemas/
 * doctor-assigned-condition.schema.json). `assigned_at` is always
 * server-set; `resolved_at`/`resolved_by` start as empty-string sentinels.
 */
function foundationBuildConditionAssignmentRecord_(input, assignmentId, nowIso) {
  return {
    assignment_id: assignmentId,
    patient_id: input.patient_id.trim(),
    condition_slug: input.condition_slug,
    assigned_by: input.assigned_by.trim(),
    assigned_at: nowIso,
    status: 'active',
    resolved_at: '',
    resolved_by: ''
  };
}

// ---- Sheets-backed operations ----

/**
 * Creates a new, active DoctorAssignedCondition row for `input.patient_id`.
 * Doctor/staff-only — `input.patient_id` is caller-supplied here (there is
 * no patient session at assignment time; see this file's own header
 * comment), never session-derived. Validation failure is an expected
 * outcome (direct envelope, not the generic wrapper), the same convention
 * every other Foundation entity's input validation already follows.
 */
function foundationAssignCondition_(input) {
  var errors = foundationValidateAssignConditionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var assignmentId = generateFoundationId_();
    var record = foundationBuildConditionAssignmentRecord_(input, assignmentId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_CONDITION_ASSIGNMENTS_SHEET_, FOUNDATION_CONDITION_ASSIGNMENTS_COLUMNS_, record);
    foundationLogAuditEvent_('condition_assigned', record.patient_id, record.assigned_by, 'assignment_id=' + assignmentId + ' condition_slug=' + record.condition_slug);
    return record;
  });
}

/**
 * Resolves an existing, active DoctorAssignedCondition row by
 * `input.assignment_id`. Doctor/staff-only. Rejects (FOUNDATION_INVALID_INPUT)
 * an unknown `assignment_id` or one that is already 'resolved' — a resolve
 * is a one-way, exactly-once transition, never idempotent, never reversible.
 * The existence/status check happens before the mutating wrapper (mirroring
 * PatientIdentity.gs's foundationGetPatientById_() "not found" pattern) so
 * this expected rejection is returned directly, never nested inside
 * withFoundationErrorHandling_()'s own success envelope.
 */
function foundationResolveCondition_(input) {
  var errors = foundationValidateResolveConditionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var assignmentId = input.assignment_id.trim();
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_CONDITION_ASSIGNMENTS_SHEET_, FOUNDATION_CONDITION_ASSIGNMENTS_COLUMNS_, 'assignment_id', assignmentId);
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
    foundationDsUpdateById_(FOUNDATION_CONDITION_ASSIGNMENTS_SHEET_, FOUNDATION_CONDITION_ASSIGNMENTS_COLUMNS_, 'assignment_id', assignmentId, {
      status: 'resolved',
      resolved_at: resolvedAt,
      resolved_by: resolvedBy
    });
    foundationLogAuditEvent_('condition_resolved', existing.patient_id, resolvedBy, 'assignment_id=' + assignmentId + ' condition_slug=' + existing.condition_slug);
    existing.status = 'resolved';
    existing.resolved_at = resolvedAt;
    existing.resolved_by = resolvedBy;
    return existing;
  });
}

/**
 * Returns every DoctorAssignedCondition row belonging to `patientId`
 * (active and resolved alike — the patient's full assignment history),
 * sorted assigned_at descending (newest first), the same sort convention
 * get_timeline/get_symptom_logs/get_reports already use. Ties (two
 * assignments landing in the same millisecond, since assigned_at is this
 * entity's only timestamp, unlike ConsultationHistory's separate entry_date/
 * created_at pair) tiebreak on insertion order, most-recently-appended
 * first — Sheets' own append-only row order is itself a valid, monotonic
 * tiebreak, requiring no extra stored field. `patientId` must already be
 * session-verified by the caller (ADR-002) for the patient-facing route —
 * this function never re-derives it.
 */
function foundationGetPatientConditionAssignments_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_CONDITION_ASSIGNMENTS_SHEET_, FOUNDATION_CONDITION_ASSIGNMENTS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    var indexed = rows.map(function (row, i) { return { row: row, insertionIndex: i }; });
    indexed.sort(function (a, b) {
      if (a.row.assigned_at !== b.row.assigned_at) {
        return a.row.assigned_at < b.row.assigned_at ? 1 : -1;
      }
      return b.insertionIndex - a.insertionIndex;
    });
    return indexed.map(function (entry) { return entry.row; });
  });
}

// ---- Manually-run wrappers (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real patient/condition/staff details.
 * Not a Web App endpoint — no real Doctor identity/session exists yet
 * (docs/33 §1.4), so this is the doctor/staff assignment tool for this
 * batch, mirroring PatientIdentity.gs's createFoundationPatient() exactly.
 */
function assignFoundationCondition() {
  var result = foundationAssignCondition_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    condition_slug: 'EDIT ME BEFORE RUNNING',
    assigned_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real assignment/staff details. Not a
 * Web App endpoint, for the same reason assignFoundationCondition() isn't.
 */
function resolveFoundationCondition() {
  var result = foundationResolveCondition_({
    assignment_id: 'EDIT ME BEFORE RUNNING',
    resolved_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
