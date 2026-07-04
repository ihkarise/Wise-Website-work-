/**
 * Symptom Log — Batch PA-4 (docs/29 §13 Batch 5E). Implements
 * shared/schemas/symptom-log.schema.json version 1.0.0. Backs the
 * patient-facing Symptom Tracker dashboard card (quick-log form +
 * most-recent-value summary) and full history page (docs/29 §5, §9).
 *
 * The platform's first patient-*writable* entity (docs/29 §11, docs/41
 * §12/§15) — every other Foundation-family write so far (Patient,
 * LoginToken, ConsultationHistory) was staff- or system-authored. Create
 * and list only, both scoped strictly to the session-derived patient_id
 * (ADR-002); no update, no delete (docs/33 §3.2, docs/41 §4/§5). No
 * get-by-id exists in this schema version — docs/41 §12 found no product
 * requirement for a per-entry detail fetch, so the simpler
 * create-own/list-own authorization surface Consultation History's
 * `foundationGetConsultationEntryById_()` needed does not apply here.
 *
 * Not Foundation-prefixed, for the same reason PatientIdentity.gs,
 * FoundationLoginTokens.gs, and FoundationConsultationHistory.gs aren't
 * (docs/29 §2): this is a concrete entity built on Foundation's frozen
 * infrastructure, not infrastructure itself. Zero modification to any
 * frozen Foundation/Identity & Access/PA-3 file — reuses
 * FoundationDataStore.gs's existing generic insert/query operations and
 * FoundationAudit.gs's existing foundationLogAuditEvent_() exactly as
 * both were already designed to be reused (ADR-009).
 *
 * `FOUNDATION_ALLOWED_CONDITION_SLUGS_` below is manually adapted from
 * shared/constants/condition-slugs.json version 1.0.0 (see that file's
 * companion .md for why this is the first real second consumer of the
 * canonical list, closing the deferral shared/README.md and
 * shared/schemas/patient-identity.md both named) — update both places by
 * hand if the canonical list ever changes, per shared/README.md's rule.
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_SYMPTOM_LOGS_SHEET_ = 'SymptomLogs';
var FOUNDATION_SYMPTOM_LOGS_COLUMNS_ = ['record_id', 'patient_id', 'logged_at', 'severity', 'sleep', 'energy', 'stress', 'notes', 'condition_slug'];

// "Capped... for payload size (mirroring docs/29 §6's Timeline cap
// precedent)" — docs/41 §2. A local constant, not FoundationConfig.gs —
// Foundation's ten files are frozen (docs/35 §9); every entity file since
// PatientIdentity.gs already declares its own sheet/column/limit
// constants locally rather than reopening a frozen file for one new value.
var FOUNDATION_SYMPTOM_LOGS_MAX_ENTRIES_ = 50;

// Manually adapted from shared/constants/condition-slugs.json v1.0.0 —
// see this file's own header comment.
var FOUNDATION_ALLOWED_CONDITION_SLUGS_ = [
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
 * Returns true only for an in-range integer 1-10 — accepts a JS number
 * only (not a numeric string), since the client sends real JSON numbers
 * (docs/41 §10: "server validates, client is UX only").
 */
function foundationIsValidSymptomScale_(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). Mirrors foundationValidateConsultationEntryInput_()'s structure.
 * All four scale fields are mandatory (docs/41 §10 Q1, resolved) — no
 * partial log is accepted.
 */
function foundationValidateSymptomLogInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  ['severity', 'sleep', 'energy', 'stress'].forEach(function (field) {
    if (!input || !foundationIsValidSymptomScale_(input[field])) {
      errors.push(field + ' must be a whole number from 1 to 10.');
    }
  });
  if (input && input.notes !== undefined && input.notes !== null && typeof input.notes !== 'string') {
    errors.push('notes must be a string when provided.');
  }
  if (input && input.condition_slug !== undefined && input.condition_slug !== null && input.condition_slug !== '') {
    if (typeof input.condition_slug !== 'string' || FOUNDATION_ALLOWED_CONDITION_SLUGS_.indexOf(input.condition_slug) === -1) {
      errors.push('condition_slug must be one of the recognized condition tags.');
    }
  }
  return errors;
}

/**
 * Builds a SymptomLogs record (shared/schemas/symptom-log.schema.json).
 * `logged_at` is always the server-provided `nowIso` — never
 * patient-editable (docs/41 §10 Q2, resolved).
 */
function foundationBuildSymptomLogRecord_(input, recordId, nowIso) {
  return {
    record_id: recordId,
    patient_id: input.patient_id.trim(),
    logged_at: nowIso,
    severity: input.severity,
    sleep: input.sleep,
    energy: input.energy,
    stress: input.stress,
    notes: (input.notes || '').trim(),
    condition_slug: (input.condition_slug || '').trim()
  };
}

/**
 * Sorts two entries for full-history display: logged_at descending. A
 * single sort key is sufficient here (unlike Timeline's entry_date +
 * created_at tiebreaker, docs/39 §3) — logged_at is this entity's only
 * timestamp, always server-set, so two entries can only tie if written in
 * the same millisecond, an acceptable, undefined-order edge case.
 */
function foundationCompareSymptomLogsDesc_(a, b) {
  if (a.logged_at !== b.logged_at) {
    return a.logged_at < b.logged_at ? 1 : -1;
  }
  return 0;
}

// ---- Sheets-backed operations ----

/**
 * Creates a new Symptom Log entry. Validation failure is an expected
 * outcome (direct envelope, not the generic wrapper) — same convention
 * foundationCreateConsultationEntry_() already established. `input.patient_id`
 * must already be session-derived by the caller (ADR-002) — this function
 * never re-derives it and never trusts any other source for it.
 */
function foundationCreateSymptomLog_(input) {
  var errors = foundationValidateSymptomLogInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var recordId = generateFoundationId_();
    var record = foundationBuildSymptomLogRecord_(input, recordId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_SYMPTOM_LOGS_SHEET_, FOUNDATION_SYMPTOM_LOGS_COLUMNS_, record);
    foundationLogAuditEvent_('symptom_log_created', record.patient_id, record.patient_id, 'record_id=' + recordId);
    return record;
  });
}

/**
 * Returns `patientId`'s own Symptom Log entries, sorted newest-first and
 * capped at FOUNDATION_SYMPTOM_LOGS_MAX_ENTRIES_ (docs/41 §2). `patientId`
 * must already be session-verified by the caller (ADR-002) — this
 * function never re-derives it and never accepts it from anywhere but a
 * trusted caller.
 */
function foundationGetPatientSymptomLogs_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_SYMPTOM_LOGS_SHEET_, FOUNDATION_SYMPTOM_LOGS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    rows.sort(function (a, b) { return foundationCompareSymptomLogsDesc_(a, b); });
    return rows.slice(0, FOUNDATION_SYMPTOM_LOGS_MAX_ENTRIES_);
  });
}
