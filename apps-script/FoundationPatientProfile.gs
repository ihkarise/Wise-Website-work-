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
var FOUNDATION_PATIENT_PROFILE_COLUMNS_ = ['patient_id', 'phone', 'date_of_birth', 'preferred_contact_method', 'emergency_contact', 'is_minor', 'guardian_name', 'guardian_relationship', 'guardian_consent_at', 'updated_at', 'updated_by'];

// Guardian consent (schema 1.1.0). Additive columns only — no existing
// column was renamed, reordered relative to its neighbours, or repurposed.
// A live sheet created before 1.1.0 must be migrated once with
// migratePatientProfileGuardianColumns() before these routes are used:
// FoundationDataStore.gs fails closed on header drift by design.
var FOUNDATION_PATIENT_PROFILE_MINOR_VALUES_ = ['yes', 'no'];
var FOUNDATION_PATIENT_PROFILE_GUARDIAN_NAME_MAX_LENGTH_ = 120;
var FOUNDATION_PATIENT_PROFILE_GUARDIAN_RELATIONSHIP_MAX_LENGTH_ = 60;

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
    is_minor: '',
    guardian_name: '',
    guardian_relationship: '',
    guardian_consent_at: '',
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
  if (input && input.is_minor !== undefined && input.is_minor !== null && input.is_minor !== '') {
    if (typeof input.is_minor !== 'string' || FOUNDATION_PATIENT_PROFILE_MINOR_VALUES_.indexOf(input.is_minor) === -1) {
      errors.push('is_minor must be one of: yes, no.');
    }
  }
  // Guardian fields are only meaningful for a declared minor, and for a
  // declared minor they are mandatory. Consent itself is never stored from
  // the request body — guardian_consent is an input-only affirmation that
  // causes the server to stamp guardian_consent_at (see the record builder).
  if (input && input.is_minor === 'yes') {
    if (typeof input.guardian_name !== 'string' || input.guardian_name.trim() === '') {
      errors.push('guardian_name is required when the patient is under 18.');
    } else if (input.guardian_name.trim().length > FOUNDATION_PATIENT_PROFILE_GUARDIAN_NAME_MAX_LENGTH_) {
      errors.push('guardian_name must be ' + FOUNDATION_PATIENT_PROFILE_GUARDIAN_NAME_MAX_LENGTH_ + ' characters or fewer.');
    }
    if (typeof input.guardian_relationship !== 'string' || input.guardian_relationship.trim() === '') {
      errors.push('guardian_relationship is required when the patient is under 18.');
    } else if (input.guardian_relationship.trim().length > FOUNDATION_PATIENT_PROFILE_GUARDIAN_RELATIONSHIP_MAX_LENGTH_) {
      errors.push('guardian_relationship must be ' + FOUNDATION_PATIENT_PROFILE_GUARDIAN_RELATIONSHIP_MAX_LENGTH_ + ' characters or fewer.');
    }
    if (input.guardian_consent !== true && !(typeof input.existing_guardian_consent_at === 'string' && input.existing_guardian_consent_at !== '')) {
      errors.push('guardian_consent must be explicitly affirmed when the patient is under 18.');
    }
  }
  return errors;
}

/**
 * Builds a PatientProfile record (shared/schemas/patient-profile.schema.json).
 * `updated_at`/`updated_by` are always server-set — never patient-editable.
 */
function foundationBuildPatientProfileRecord_(input, nowIso, existing) {
  var isMinor = (input.is_minor || '').trim();
  var previousConsentAt = (existing && typeof existing.guardian_consent_at === 'string') ? existing.guardian_consent_at : '';
  // guardian_consent_at is ALWAYS server-set and never read from the request
  // body. It is stamped the first time consent is affirmed for a declared
  // minor and preserved verbatim afterwards, so it records when consent was
  // actually given rather than when the row was last touched. Declaring the
  // patient an adult clears the guardian block outright, which is what keeps
  // adult profiles completely unaffected by this feature.
  var consentAt = '';
  if (isMinor === 'yes') {
    consentAt = previousConsentAt !== '' ? previousConsentAt : nowIso;
  }
  return {
    patient_id: input.patient_id.trim(),
    phone: (input.phone || '').trim(),
    date_of_birth: (input.date_of_birth || '').trim(),
    preferred_contact_method: (input.preferred_contact_method || '').trim(),
    emergency_contact: (input.emergency_contact || '').trim(),
    is_minor: isMinor,
    guardian_name: isMinor === 'yes' ? (input.guardian_name || '').trim() : '',
    guardian_relationship: isMinor === 'yes' ? (input.guardian_relationship || '').trim() : '',
    guardian_consent_at: consentAt,
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
  var patientId = (input && typeof input.patient_id === 'string') ? input.patient_id.trim() : '';

  // The existing row is read BEFORE validation, through the already-wrapped
  // reader, so that (a) a minor whose consent was recorded earlier can save
  // other profile fields without re-affirming consent on every save, and
  // (b) guardian_consent_at can be preserved rather than re-stamped.
  // Read failure is surfaced as-is and never treated as "no existing row",
  // which would silently lose a recorded consent timestamp.
  var existing = null;
  if (patientId !== '') {
    var existingEnvelope = foundationGetPatientProfile_(patientId);
    if (!existingEnvelope || existingEnvelope.status !== 'ok') {
      return existingEnvelope || buildFoundationErrorEnvelope_('FOUNDATION_UNEXPECTED_ERROR', 'Something went wrong. Please try again.');
    }
    // foundationGetPatientProfile_ lazily returns a default-shaped record for
    // a patient who has never saved one; updated_at === '' identifies that
    // case, so it is not mistaken for a persisted row.
    existing = (existingEnvelope.data && existingEnvelope.data.updated_at !== '') ? existingEnvelope.data : null;
  }

  var validationInput = {};
  for (var k in input) {
    if (Object.prototype.hasOwnProperty.call(input, k)) { validationInput[k] = input[k]; }
  }
  validationInput.existing_guardian_consent_at = (existing && existing.guardian_consent_at) || '';

  // Validation failure is an expected outcome and returns a DIRECT envelope,
  // never from inside withFoundationErrorHandling_ — that wrapper wraps its
  // return value in an ok-envelope, so an error returned from within it would
  // be reported to the caller as a success.
  var errors = foundationValidatePatientProfileInput_(validationInput);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }

  return withFoundationErrorHandling_(function () {
    var record = foundationBuildPatientProfileRecord_(input, foundationNowIso_(), existing);
    if (existing) {
      foundationDsUpdateById_(FOUNDATION_PATIENT_PROFILE_SHEET_, FOUNDATION_PATIENT_PROFILE_COLUMNS_, 'patient_id', patientId, record);
      foundationLogAuditEvent_('patient_profile_updated', patientId, patientId, 'patient_id=' + patientId);
    } else {
      foundationDsInsert_(FOUNDATION_PATIENT_PROFILE_SHEET_, FOUNDATION_PATIENT_PROFILE_COLUMNS_, record);
      foundationLogAuditEvent_('patient_profile_created', patientId, patientId, 'patient_id=' + patientId);
    }
    // A guardian-consent stamp is a distinct, auditable clinical-governance
    // event, logged separately from the ordinary profile write.
    if (record.guardian_consent_at !== '' && (!existing || existing.guardian_consent_at === '')) {
      foundationLogAuditEvent_('guardian_consent_recorded', patientId, patientId,
        'relationship=' + record.guardian_relationship + ';recorded_at=' + record.guardian_consent_at);
    }
    return record;
  });
}

// ---- One-time operational migration (schema 1.0.0 -> 1.1.0) ----

/**
 * Adds the four guardian-consent columns to a live PatientProfile sheet
 * created before schema 1.1.0. Run once from the Apps Script editor, the
 * same operator-run, idempotent pattern Retention.gs's
 * installRetentionTrigger() already established.
 *
 * Why this is needed at all: FoundationDataStore.gs fails closed when a
 * live header has drifted from the expected columns, which is deliberate —
 * it refuses to read or write a sheet whose shape it does not recognise
 * rather than silently writing into the wrong cells. Extending
 * FOUNDATION_PATIENT_PROFILE_COLUMNS_ therefore requires the live header to
 * be extended to match before the profile routes are used again.
 *
 * Safety properties:
 *   - Idempotent: running it again logs "already migrated" and changes nothing.
 *   - Additive only: it appends the four new headers after the existing ones.
 *     It never renames, reorders, deletes or rewrites an existing column, and
 *     it never touches a single data row, so historical values are untouched.
 *   - Refuses to guess: if the first five columns are not the expected 1.0.0
 *     prefix, it aborts with a message instead of migrating an unknown shape.
 *   - New sheets need no migration: foundationDsGetOrCreateSheet_ creates them
 *     with the full 1.1.0 header already.
 */
function migratePatientProfileGuardianColumns() {
  var expectedPrefix = ['patient_id', 'phone', 'date_of_birth', 'preferred_contact_method', 'emergency_contact'];
  var addedColumns = ['is_minor', 'guardian_name', 'guardian_relationship', 'guardian_consent_at'];
  var trailingColumns = ['updated_at', 'updated_by'];

  var sheet = foundationDsOpenSpreadsheet_().getSheetByName(FOUNDATION_PATIENT_PROFILE_SHEET_);
  if (!sheet) {
    Logger.log('migratePatientProfileGuardianColumns: no "' + FOUNDATION_PATIENT_PROFILE_SHEET_ +
      '" sheet exists yet — nothing to migrate. It will be created with the 1.1.0 header on first use.');
    return;
  }

  var lastCol = sheet.getLastColumn();
  var header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  var alreadyMigrated = header.length === FOUNDATION_PATIENT_PROFILE_COLUMNS_.length
    && FOUNDATION_PATIENT_PROFILE_COLUMNS_.every(function (c, i) { return header[i] === c; });
  if (alreadyMigrated) {
    Logger.log('migratePatientProfileGuardianColumns: already migrated — nothing to do.');
    return;
  }

  var isPre110 = header.length === expectedPrefix.length + trailingColumns.length
    && expectedPrefix.every(function (c, i) { return header[i] === c; })
    && trailingColumns.every(function (c, i) { return header[expectedPrefix.length + i] === c; });
  if (!isPre110) {
    throw new Error('migratePatientProfileGuardianColumns: the live header is neither the expected 1.0.0 shape ' +
      'nor the 1.1.0 shape, so it was NOT migrated. Found: [' + header.join(', ') + ']. ' +
      'Resolve the header manually before re-running.');
  }

  // Rewrite the header row only. The four new columns are appended after
  // emergency_contact, which is where they sit in FOUNDATION_PATIENT_PROFILE_COLUMNS_;
  // updated_at/updated_by move two columns right, so their existing values are
  // moved with them rather than being left behind under the new headers.
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var auditRange = sheet.getRange(2, expectedPrefix.length + 1, lastRow - 1, trailingColumns.length);
    var auditValues = auditRange.getValues();
    auditRange.clearContent();
    sheet.getRange(2, expectedPrefix.length + addedColumns.length + 1, lastRow - 1, trailingColumns.length).setValues(auditValues);
  }
  sheet.getRange(1, 1, 1, FOUNDATION_PATIENT_PROFILE_COLUMNS_.length).setValues([FOUNDATION_PATIENT_PROFILE_COLUMNS_]);

  Logger.log('migratePatientProfileGuardianColumns: migrated ' + Math.max(lastRow - 1, 0) +
    ' row(s) to schema 1.1.0. Existing values preserved; the four guardian columns are blank, ' +
    'which is the correct "not declared" state.');
}
