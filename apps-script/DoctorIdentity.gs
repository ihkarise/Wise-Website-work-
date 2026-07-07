/**
 * Doctor Identity — Batch WPI-1 (docs/50-PHASE-3-TECHNICAL-PLAN.md §5.1/
 * §5.2; docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every
 * later WPI batch). Implements shared/schemas/doctor-identity.schema.json
 * version 1.0.0. Governed by ADR-017 — a durable, platform-generated
 * doctor_id identity, structurally parallel to Patient Identity (ADR-002)
 * and never merged into, aliased with, or derived from it.
 *
 * Mirrors apps-script/PatientIdentity.gs exactly in structure, for the
 * same reason: a concrete entity built on Foundation's frozen
 * infrastructure, not infrastructure itself, hence not Foundation-prefixed
 * (docs/29 §2). No public Web App route exists for Doctor creation —
 * provisioning is a manually-run editor function
 * (createFoundationDoctor(), bottom of this file), mirroring
 * createFoundationPatient()'s precedent exactly (ADR-002/ADR-017's shared
 * "no public self-registration" rule).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs. Zero modification to
 * any frozen Foundation/Identity & Access/Patient Access/PXP-1..11 file.
 */

var FOUNDATION_DOCTORS_SHEET_ = 'Doctors';
var FOUNDATION_DOCTORS_COLUMNS_ = ['doctor_id', 'full_name', 'role', 'email', 'specialty_slug', 'status', 'created_at', 'created_by'];

// ---- Pure validation — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). Deliberately does not validate `specialty_slug` against a real
 * Specialty Registry entry — that registry does not exist until WPI-2
 * ships (docs/50 §6). See doctor-identity.md's "documented simplification"
 * section — the same deliberate, minimal choice
 * foundationValidatePatientInput_() already made for condition_slug at
 * Foundation batch F3.
 */
function foundationValidateDoctorInput_(input) {
  var errors = [];
  if (!input || typeof input.full_name !== 'string' || input.full_name.trim() === '') {
    errors.push('full_name is required.');
  }
  if (!input || (input.role !== 'physician' && input.role !== 'staff')) {
    errors.push('role must be "physician" or "staff".');
  }
  if (!input || typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('A valid email is required.');
  }
  if (input && input.specialty_slug !== undefined && input.specialty_slug !== null && input.specialty_slug !== ''
    && (typeof input.specialty_slug !== 'string' || input.specialty_slug.trim() === '')) {
    errors.push('specialty_slug must be a non-empty string when provided.');
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (staff/administrative identifier) is required.');
  }
  return errors;
}

// ---- Sheets-backed operations ----

/**
 * Creates a new Doctor record. Validation failures are an expected
 * outcome, not an unexpected error — returned directly via
 * buildFoundationErrorEnvelope_(), mirroring foundationCreatePatient_()'s
 * own convention exactly. Only genuinely unexpected failures (e.g. a
 * Sheets-write error) go through the generic wrapper.
 */
function foundationCreateDoctor_(input) {
  var errors = foundationValidateDoctorInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var doctorId = generateFoundationId_();
    var record = {
      doctor_id: doctorId,
      full_name: input.full_name.trim(),
      role: input.role,
      email: input.email.trim(),
      specialty_slug: (input.specialty_slug || '').toString().trim(),
      status: 'active',
      created_at: foundationNowIso_(),
      created_by: input.created_by.trim()
    };
    foundationDsInsert_(FOUNDATION_DOCTORS_SHEET_, FOUNDATION_DOCTORS_COLUMNS_, record);
    foundationLogAuditEvent_('doctor_created', '', input.created_by, 'doctor_id=' + doctorId);
    return record;
  });
}

/**
 * Looks up a Doctor record by doctor_id. A clean "not found" (no
 * exception, just no matching row) returns a specific
 * FOUNDATION_NOT_FOUND envelope, not the generic unexpected-error one —
 * mirrors foundationGetPatientById_() exactly.
 */
function foundationGetDoctorById_(doctorId) {
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_DOCTORS_SHEET_, FOUNDATION_DOCTORS_COLUMNS_, 'doctor_id', doctorId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (lookup.data === null) {
    return buildFoundationErrorEnvelope_('FOUNDATION_NOT_FOUND', 'We could not find that doctor record.');
  }
  return lookup;
}

/**
 * Finds a Doctor record by email. Doctor rows are staff/administrative-
 * provisioned (never user-typed), so a straight trim/lowercase compare is
 * sufficient — mirrors foundationFindPatientByEmail_() (DoctorLoginFlow.gs's
 * patient-side equivalent) exactly. Returns the record object or null, a
 * clean "not found" outcome, never an error.
 */
function foundationFindDoctorByEmail_(email) {
  var normalized = String(email).trim().toLowerCase();
  var matches = foundationDsQuery_(FOUNDATION_DOCTORS_SHEET_, FOUNDATION_DOCTORS_COLUMNS_, function (d) {
    return typeof d.email === 'string' && d.email.trim().toLowerCase() === normalized;
  });
  return matches.length > 0 ? matches[0] : null;
}

// ---- Manually-run wrapper (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real doctor's details. Not a Web App
 * endpoint, not a Sheet menu — the minimal "manually-run editor function"
 * pattern createFoundationPatient() already established, applied here to
 * Doctor Identity's own no-public-self-registration rule (ADR-017).
 */
function createFoundationDoctor() {
  var result = foundationCreateDoctor_({
    full_name: 'EDIT ME BEFORE RUNNING',
    role: 'EDIT ME BEFORE RUNNING — "physician" or "staff"',
    email: 'EDIT ME BEFORE RUNNING',
    specialty_slug: '',
    created_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
