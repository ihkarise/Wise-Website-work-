/**
 * Doctor Instruction — Batch PXP-7 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §12,
 * §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and every
 * later batch). Implements shared/schemas/doctor-instruction.schema.json
 * version 1.0.0. The atomic unit of clinical direction (docs/33-DOMAIN-MODEL.md
 * §2.3), aggregated by a CarePlan (CarePlan.gs) into a patient's current set
 * of instructions.
 *
 * Not Foundation-prefixed, for the same reason CarePlan.gs and
 * DoctorAssignedCondition.gs aren't (docs/29 §2): a concrete entity built
 * on Foundation's frozen infrastructure, not infrastructure itself.
 *
 * Doctor/staff-owned, not patient-owned — a hard boundary (docs/44 §4.3,
 * shared/schemas/doctor-instruction.md). Every write (creation and a status
 * transition) is a doctor/staff action; the patient never creates, edits, or
 * resolves a row of this shape. No real Doctor identity/authentication
 * exists yet (docs/33 §1.4), so — mirroring DoctorAssignedCondition.gs's
 * assignFoundationCondition()/resolveFoundationCondition() precedent
 * exactly — both tools are manually-run Apps Script editor functions, not a
 * new authenticated Web App route. The one patient-facing surface this
 * batch adds is a read-only route (FoundationRouter.gs's
 * get_doctor_instructions), deriving patient_id exclusively from the
 * verified session.
 *
 * Many-per-patient, many-per-care_plan_id, append-mostly: a row is created
 * 'active' and may transition to 'discontinued' or 'completed' exactly
 * once; it never reverts and is never deleted or overwritten in place
 * beyond that one transition (docs/33 §2.3).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..6 file — reuses FoundationDataStore.gs's existing generic
 * insert/getById/updateById/query operations and FoundationAudit.gs's
 * existing foundationLogAuditEvent_() exactly as both were already designed
 * to be reused (ADR-009).
 *
 * Depends on CarePlan.gs, FoundationDataStore.gs, FoundationAudit.gs,
 * FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_DOCTOR_INSTRUCTIONS_SHEET_ = 'DoctorInstructions';
var FOUNDATION_DOCTOR_INSTRUCTIONS_COLUMNS_ = ['instruction_id', 'patient_id', 'care_plan_id', 'consultation_id', 'instruction_type', 'content', 'prescribed_by', 'effective_date', 'status'];

var FOUNDATION_DOCTOR_INSTRUCTION_TYPES_ = ['medicine', 'lifestyle', 'investigation', 'follow_up'];
var FOUNDATION_DOCTOR_INSTRUCTION_CLOSE_STATUSES_ = ['discontinued', 'completed'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new instruction. `patient_id`/`care_plan_id`/
 * `instruction_type`/`content`/`prescribed_by`/`effective_date` are all
 * required — the deeper check that `care_plan_id` actually belongs to
 * `patient_id` requires a Sheets read and happens in
 * foundationCreateDoctorInstruction_() itself, mirroring
 * foundationCreateCheckInResponse_()'s "pure shape check first, stateful
 * check after" discipline.
 */
function foundationValidateDoctorInstructionInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.care_plan_id !== 'string' || input.care_plan_id.trim() === '') {
    errors.push('care_plan_id is required.');
  }
  if (!input || typeof input.instruction_type !== 'string' || FOUNDATION_DOCTOR_INSTRUCTION_TYPES_.indexOf(input.instruction_type) === -1) {
    errors.push('instruction_type must be one of: medicine, lifestyle, investigation, follow_up.');
  }
  if (!input || typeof input.content !== 'string' || input.content.trim() === '') {
    errors.push('content is required.');
  }
  if (!input || typeof input.prescribed_by !== 'string' || input.prescribed_by.trim() === '') {
    errors.push('prescribed_by (doctor/staff identifier) is required.');
  }
  if (!input || typeof input.effective_date !== 'string' || input.effective_date.trim() === '') {
    errors.push('effective_date is required.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a status-update operation's own input shape — whether
 * `instruction_id` actually resolves to an existing, active row is checked
 * by foundationUpdateDoctorInstructionStatus_() itself, since that check
 * requires a Sheets read.
 */
function foundationValidateUpdateDoctorInstructionStatusInput_(input) {
  var errors = [];
  if (!input || typeof input.instruction_id !== 'string' || input.instruction_id.trim() === '') {
    errors.push('instruction_id is required.');
  }
  if (!input || typeof input.status !== 'string' || FOUNDATION_DOCTOR_INSTRUCTION_CLOSE_STATUSES_.indexOf(input.status) === -1) {
    errors.push('status must be one of: discontinued, completed.');
  }
  return errors;
}

/**
 * Builds a new, active DoctorInstruction record (shared/schemas/
 * doctor-instruction.schema.json). consultation_id is always an
 * empty-string sentinel today — no Consultation entity exists yet
 * (docs/33 §2.1, shared/schemas/doctor-instruction.md).
 */
function foundationBuildDoctorInstructionRecord_(input, instructionId) {
  return {
    instruction_id: instructionId,
    patient_id: input.patient_id.trim(),
    care_plan_id: input.care_plan_id.trim(),
    consultation_id: '',
    instruction_type: input.instruction_type,
    content: input.content.trim(),
    prescribed_by: input.prescribed_by.trim(),
    effective_date: input.effective_date.trim(),
    status: 'active'
  };
}

/**
 * Sorts two entries for full-history display: effective_date descending,
 * with insertion order as an explicit tiebreaker for same-date rows —
 * mirrors foundationGetPatientConditionAssignments_()'s own tiebreak
 * discipline (DoctorInstruction has no separate created_at field to
 * tiebreak on, per docs/44 §12's literal field list).
 */
function foundationCompareDoctorInstructionsDesc_(a, b) {
  if (a.row.effective_date !== b.row.effective_date) {
    return a.row.effective_date < b.row.effective_date ? 1 : -1;
  }
  return b.insertionIndex - a.insertionIndex;
}

// ---- Sheets-backed operations ----

/**
 * Creates a new, active DoctorInstruction row. Doctor/staff-only —
 * input.patient_id is caller-supplied here (there is no patient session at
 * creation time; see this file's own header comment), never
 * session-derived. Validation failure is an expected outcome (direct
 * envelope, not the generic wrapper). Rejects a care_plan_id that does not
 * belong to a real CarePlan row for the same patient_id (any version) —
 * the same "referenced entity must be real" discipline
 * foundationCreateCheckInResponse_() already applies to its own
 * (template_id, template_version) reference.
 */
function foundationCreateDoctorInstruction_(input) {
  var errors = foundationValidateDoctorInstructionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var patientId = input.patient_id.trim();
  var carePlanId = input.care_plan_id.trim();
  var carePlanLookup = withFoundationErrorHandling_(function () {
    var matches = foundationDsQuery_(FOUNDATION_CARE_PLANS_SHEET_, FOUNDATION_CARE_PLANS_COLUMNS_, function (row) {
      return row.care_plan_id === carePlanId && row.patient_id === patientId;
    });
    return matches.length > 0;
  });
  if (carePlanLookup.status === 'error') {
    return carePlanLookup; // unexpected failure — already a safe, generic envelope
  }
  if (!carePlanLookup.data) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'care_plan_id must reference an existing Care Plan for this patient.');
  }
  return withFoundationErrorHandling_(function () {
    var instructionId = generateFoundationId_();
    var record = foundationBuildDoctorInstructionRecord_(input, instructionId);
    foundationDsInsert_(FOUNDATION_DOCTOR_INSTRUCTIONS_SHEET_, FOUNDATION_DOCTOR_INSTRUCTIONS_COLUMNS_, record);
    foundationLogAuditEvent_('doctor_instruction_created', patientId, record.prescribed_by, 'instruction_id=' + instructionId + ' care_plan_id=' + carePlanId + ' instruction_type=' + record.instruction_type);
    return record;
  });
}

/**
 * Transitions an existing, active DoctorInstruction row to
 * input.status ('discontinued' or 'completed'). Doctor/staff-only. Rejects
 * (FOUNDATION_INVALID_INPUT) an unknown instruction_id or one that is not
 * currently 'active' — a one-way, exactly-once transition, never
 * idempotent, never reversible, mirroring
 * foundationResolveCondition_()'s own discipline exactly.
 */
function foundationUpdateDoctorInstructionStatus_(input) {
  var errors = foundationValidateUpdateDoctorInstructionStatusInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var instructionId = input.instruction_id.trim();
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_DOCTOR_INSTRUCTIONS_SHEET_, FOUNDATION_DOCTOR_INSTRUCTIONS_COLUMNS_, 'instruction_id', instructionId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (!lookup.data || lookup.data.status !== 'active') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'instruction_id must reference an existing, active instruction.');
  }
  var existing = lookup.data;
  return withFoundationErrorHandling_(function () {
    foundationDsUpdateById_(FOUNDATION_DOCTOR_INSTRUCTIONS_SHEET_, FOUNDATION_DOCTOR_INSTRUCTIONS_COLUMNS_, 'instruction_id', instructionId, { status: input.status });
    foundationLogAuditEvent_('doctor_instruction_' + input.status, existing.patient_id, existing.prescribed_by, 'instruction_id=' + instructionId);
    existing.status = input.status;
    return existing;
  });
}

/**
 * Returns every DoctorInstruction row belonging to `patientId` (every
 * status, across every one of the patient's Care Plan versions — an
 * instruction's relevance does not expire just because the plan summary
 * around it was later edited, shared/schemas/care-plan.md), sorted
 * effective_date descending. `patientId` must already be session-verified
 * by the caller (ADR-002) — this function never re-derives it.
 */
function foundationGetPatientDoctorInstructions_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_DOCTOR_INSTRUCTIONS_SHEET_, FOUNDATION_DOCTOR_INSTRUCTIONS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    var indexed = rows.map(function (row, i) { return { row: row, insertionIndex: i }; });
    indexed.sort(function (a, b) { return foundationCompareDoctorInstructionsDesc_(a, b); });
    return indexed.map(function (entry) { return entry.row; });
  });
}

// ---- Manually-run wrappers (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real patient/care-plan/staff details.
 * Not a Web App endpoint — no real Doctor identity/session exists yet
 * (docs/33 §1.4), so this is the doctor/staff creation tool for this batch,
 * mirroring DoctorAssignedCondition.gs's assignFoundationCondition() exactly.
 */
function createFoundationDoctorInstruction() {
  var result = foundationCreateDoctorInstruction_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    care_plan_id: 'EDIT ME BEFORE RUNNING',
    instruction_type: 'EDIT ME BEFORE RUNNING', // medicine | lifestyle | investigation | follow_up
    content: 'EDIT ME BEFORE RUNNING',
    prescribed_by: 'EDIT ME BEFORE RUNNING',
    effective_date: 'EDIT ME BEFORE RUNNING' // e.g. '2026-07-07'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real instruction details. Not a Web
 * App endpoint, for the same reason createFoundationDoctorInstruction()
 * isn't.
 */
function updateFoundationDoctorInstructionStatus() {
  var result = foundationUpdateDoctorInstructionStatus_({
    instruction_id: 'EDIT ME BEFORE RUNNING',
    status: 'EDIT ME BEFORE RUNNING' // discontinued | completed
  });
  Logger.log(JSON.stringify(result));
  return result;
}
