/**
 * Patient Identity — the first concrete entity built on top of
 * Foundation, not Foundation infrastructure itself (docs/29 §2's naming-
 * scope note: this file is intentionally not `Foundation`-prefixed).
 * Implements shared/schemas/patient-identity.schema.json version 1.0.0.
 *
 * No public Web App route exists for this yet — patient creation is a
 * manually-run editor function (createFoundationPatient(), bottom of
 * this file), per this batch's explicit, minimal scope. A staff-friendly
 * form or Sheet menu is future work, not part of Foundation.
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs,
 * FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_PATIENTS_SHEET_ = 'Patients';
var FOUNDATION_PATIENTS_COLUMNS_ = ['patient_id', 'full_name', 'email', 'condition_slug', 'status', 'created_at', 'created_by'];

// ---- Pure validation — no Apps Script dependency, covered by FoundationTests.gs ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). Deliberately does not validate `condition_slug` against Phase
 * 1.5's canonical allowlist — see shared/schemas/patient-identity.md's
 * "documented simplification" section for why.
 */
function foundationValidatePatientInput_(input) {
  var errors = [];
  if (!input || typeof input.full_name !== 'string' || input.full_name.trim() === '') {
    errors.push('full_name is required.');
  }
  if (!input || typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('A valid email is required.');
  }
  if (!input || typeof input.condition_slug !== 'string' || input.condition_slug.trim() === '') {
    errors.push('condition_slug is required.');
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (staff identifier) is required.');
  }
  return errors;
}

// ---- Sheets-backed operations ----

/**
 * Creates a new Patient record. Validation failures are an expected
 * outcome, not an unexpected error — returned directly via
 * buildFoundationErrorEnvelope_(), not routed through
 * withFoundationErrorHandling_()'s generic catch-all (FoundationContracts.gs's
 * own header comment states this distinction; this is its first real
 * use). Only genuinely unexpected failures (e.g. a Sheets-write error)
 * go through the generic wrapper.
 */
function foundationCreatePatient_(input) {
  var errors = foundationValidatePatientInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var patientId = generateFoundationId_();
    var record = {
      patient_id: patientId,
      full_name: input.full_name.trim(),
      email: input.email.trim(),
      condition_slug: input.condition_slug.trim(),
      status: 'active',
      created_at: foundationNowIso_(),
      created_by: input.created_by.trim()
    };
    foundationDsInsert_(FOUNDATION_PATIENTS_SHEET_, FOUNDATION_PATIENTS_COLUMNS_, record);
    foundationLogAuditEvent_('patient_created', patientId, input.created_by, 'Created via createFoundationPatient()');
    return record;
  });
}

/**
 * Looks up a Patient record by patient_id. A clean "not found" (no
 * exception, just no matching row) returns a specific
 * FOUNDATION_NOT_FOUND envelope, not the generic unexpected-error one —
 * only an actual DataStore failure goes through the generic path.
 */
function foundationGetPatientById_(patientId) {
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_PATIENTS_SHEET_, FOUNDATION_PATIENTS_COLUMNS_, 'patient_id', patientId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (lookup.data === null) {
    return buildFoundationErrorEnvelope_('FOUNDATION_NOT_FOUND', 'We could not find that patient record.');
  }
  return lookup;
}

// ---- Manually-run wrapper (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real patient's details. Not a Web
 * App endpoint, not a Sheet menu — the minimal "manually-run editor
 * function" this batch's plan calls for.
 */
function createFoundationPatient() {
  var result = foundationCreatePatient_({
    full_name: 'EDIT ME BEFORE RUNNING',
    email: 'EDIT ME BEFORE RUNNING',
    condition_slug: 'EDIT ME BEFORE RUNNING',
    created_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
