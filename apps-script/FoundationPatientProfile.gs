/**
 * Patient Profile — Batch PXP-1 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §17,
 * §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and every
 * later batch). Implements shared/schemas/patient-profile.schema.json
 * version 1.0.0. Recommended first Phase 2B batch (docs/45 Version 4.0's
 * readiness verdict) — zero dependency on any other Phase 2B batch.
 *
 * The platform's first patient-*mutable*, upsert-style entity: a single,
 * 1:1 row per patient_id, created lazily on first save and patched on
 * every save after that — unlike every prior entity (ConsultationHistory,
 * SymptomLogs, Reports), which is create-and-list-only. `patient_id` is
 * this row's own natural key; there is no separate record_id.
 *
 * Two open lifecycle questions docs/45 (Version 3.0/4.0, Part 5) carried
 * forward from Version 1.0 are resolved here, disclosed in full in
 * shared/schemas/patient-profile.md:
 *   - Lazy row creation: foundationGetPatientProfile_() returns a
 *     default-shaped, all-empty record (never FOUNDATION_NOT_FOUND) when
 *     no row exists yet — a patient's first visit is not an error state.
 *   - No Patient.status-based gating: profile view/edit works regardless
 *     of active/inactive/recovered, matching every existing patient-facing
 *     feature's own lack of status gating.
 *
 * A wholly separate entity/sheet from the frozen Patients sheet
 * (patient-identity.schema.json, ADR-002) — full_name/email/condition_slug/
 * status stay exactly where they are; this file never reads or writes them.
 *
 * Zero modification to any frozen Foundation/Identity & Access/PA-3/4/5
 * file — reuses FoundationDataStore.gs's existing generic insert/getById/
 * updateById operations (the first real production use of
 * foundationDsUpdateById_() for a patient-facing, patient-driven edit) and
 * FoundationAudit.gs's existing foundationLogAuditEvent_() exactly as both
 * were already designed to be reused (ADR-009).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_PATIENT_PROFILE_SHEET_ = 'PatientProfile';
var FOUNDATION_PATIENT_PROFILE_COLUMNS_ = ['patient_id', 'phone', 'date_of_birth', 'preferred_contact_method', 'emergency_contact', 'updated_at', 'updated_by'];

var FOUNDATION_PATIENT_PROFILE_CONTACT_METHODS_ = ['email', 'phone', 'sms'];

// Mirrors symptom-log.schema.json's notes-field size discipline, applied
// here to emergency_contact (shared/schemas/patient-profile.md).
var FOUNDATION_PATIENT_PROFILE_EMERGENCY_CONTACT_MAX_LENGTH_ = 200;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an empty-shaped PatientProfile record for a patient who has
 * never saved one yet — the lazy-creation resolution (shared/schemas/
 * patient-profile.md). Every optional field is '', matching
 * FoundationDataStore.gs's own row/object empty-string convention exactly,
 * so a lazily-created default is indistinguishable in shape from a real,
 * persisted-but-blank row.
 */
function foundationDefaultPatientProfile_(patientId) {
  return {
    patient_id: patientId,
    phone: '',
    date_of_birth: '',
    preferred_contact_method: '',
    emergency_contact: '',
    updated_at: '',
    updated_by: ''
  };
}

/**
 * Returns true only for a real, valid YYYY-MM-DD calendar date that is not
 * in the future (shared/schemas/patient-profile.md's date_of_birth rule).
 */
function foundationIsValidPastDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  var parts = value.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  var date = new Date(Date.UTC(year, month - 1, day));
  var isRealDate = date.getUTCFullYear() === year && (date.getUTCMonth() + 1) === month && date.getUTCDate() === day;
  if (!isRealDate) {
    return false;
  }
  return date.getTime() <= Date.now();
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). Every field is optional — an absent/empty value is always valid;
 * only a *provided, non-empty* value is checked against its own rule
 * (shared/schemas/patient-profile.md's Validation Rules section).
 */
function foundationValidatePatientProfileInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (input && input.phone !== undefined && input.phone !== null && input.phone !== '') {
    if (typeof input.phone !== 'string' || !/^[0-9+\-()\s]{7,20}$/.test(input.phone.trim())) {
      errors.push('phone must be 7-20 characters using only digits, spaces, and + - ( ) when provided.');
    }
  }
  if (input && input.date_of_birth !== undefined && input.date_of_birth !== null && input.date_of_birth !== '') {
    if (!foundationIsValidPastDate_(input.date_of_birth)) {
      errors.push('date_of_birth must be a real calendar date (YYYY-MM-DD) that is not in the future.');
    }
  }
  if (input && input.preferred_contact_method !== undefined && input.preferred_contact_method !== null && input.preferred_contact_method !== '') {
    if (typeof input.preferred_contact_method !== 'string' || FOUNDATION_PATIENT_PROFILE_CONTACT_METHODS_.indexOf(input.preferred_contact_method) === -1) {
      errors.push('preferred_contact_method must be one of: email, phone, sms.');
    }
  }
  if (input && input.emergency_contact !== undefined && input.emergency_contact !== null && input.emergency_contact !== '') {
    if (typeof input.emergency_contact !== 'string' || input.emergency_contact.trim().length > FOUNDATION_PATIENT_PROFILE_EMERGENCY_CONTACT_MAX_LENGTH_) {
      errors.push('emergency_contact must be ' + FOUNDATION_PATIENT_PROFILE_EMERGENCY_CONTACT_MAX_LENGTH_ + ' characters or fewer.');
    }
  }
  return errors;
}

/**
 * Builds a PatientProfile record (shared/schemas/patient-profile.schema.json).
 * `updated_at`/`updated_by` are always server-set — never patient-editable.
 */
function foundationBuildPatientProfileRecord_(input, nowIso) {
  return {
    patient_id: input.patient_id.trim(),
    phone: (input.phone || '').trim(),
    date_of_birth: (input.date_of_birth || '').trim(),
    preferred_contact_method: (input.preferred_contact_method || '').trim(),
    emergency_contact: (input.emergency_contact || '').trim(),
    updated_at: nowIso,
    updated_by: input.patient_id.trim()
  };
}

// ---- Sheets-backed operations ----

/**
 * Returns `patientId`'s own PatientProfile record, or a default-shaped
 * empty one if none has ever been saved (lazy creation — never
 * FOUNDATION_NOT_FOUND for this reason). `patientId` must already be
 * session-verified by the caller (ADR-002) — this function never
 * re-derives it and never accepts it from anywhere but a trusted caller.
 */
function foundationGetPatientProfile_(patientId) {
  return withFoundationErrorHandling_(function () {
    var row = foundationDsGetById_(FOUNDATION_PATIENT_PROFILE_SHEET_, FOUNDATION_PATIENT_PROFILE_COLUMNS_, 'patient_id', patientId);
    return row || foundationDefaultPatientProfile_(patientId);
  });
}

/**
 * Creates or updates `input.patient_id`'s own PatientProfile record —
 * the platform's first upsert (create-if-absent, else patch) for a
 * patient-facing, patient-driven edit. Validation failure is an expected
 * outcome (direct envelope, not the generic wrapper), the same convention
 * every other Foundation entity's input validation already follows.
 * `input.patient_id` must already be session-derived by the caller
 * (ADR-002) — this function never re-derives it and never trusts any
 * other source for it.
 */
function foundationSavePatientProfile_(input) {
  var errors = foundationValidatePatientProfileInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var patientId = input.patient_id.trim();
    var record = foundationBuildPatientProfileRecord_(input, foundationNowIso_());
    var existing = foundationDsGetById_(FOUNDATION_PATIENT_PROFILE_SHEET_, FOUNDATION_PATIENT_PROFILE_COLUMNS_, 'patient_id', patientId);
    if (existing) {
      foundationDsUpdateById_(FOUNDATION_PATIENT_PROFILE_SHEET_, FOUNDATION_PATIENT_PROFILE_COLUMNS_, 'patient_id', patientId, record);
      foundationLogAuditEvent_('patient_profile_updated', patientId, patientId, 'patient_id=' + patientId);
    } else {
      foundationDsInsert_(FOUNDATION_PATIENT_PROFILE_SHEET_, FOUNDATION_PATIENT_PROFILE_COLUMNS_, record);
      foundationLogAuditEvent_('patient_profile_created', patientId, patientId, 'patient_id=' + patientId);
    }
    return record;
  });
}
