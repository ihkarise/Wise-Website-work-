/**
 * Symptom Log — Batch PA-4 (docs/29 §13 Batch 5E). Implements
 * shared/schemas/symptom-log.schema.json version 1.0.0. Backs the Symptom
 * Tracker (docs/29 §9, docs/33 §3.2) — the platform's first patient-
 * *writable* feature, and its first entity with a draft/submit state
 * machine, per docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md's approved
 * decisions: drafts are editable and private to the owning patient;
 * submitted entries are permanent, appear in the merged Timeline
 * (FoundationTimeline.gs), and become visible to clinic staff.
 *
 * Not Foundation-prefixed, for the same reason PatientIdentity.gs,
 * FoundationLoginTokens.gs, and FoundationConsultationHistory.gs aren't
 * (docs/29 §2): a concrete entity built on Foundation's frozen
 * infrastructure, not infrastructure itself. Zero modification to any
 * frozen Foundation/Identity & Access/Patient Access file — reuses
 * FoundationDataStore.gs's existing generic insert/getById/updateById/
 * query operations and FoundationAudit.gs's existing
 * foundationLogAuditEvent_() exactly as both were already designed to be
 * reused (ADR-009).
 *
 * Unlike every entity before it, patient_id here is never staff-supplied —
 * every function takes an already session-verified patientId as a trusted
 * parameter (ADR-002), the same discipline get_profile/get_timeline
 * already established, extended here to a write path for the first time.
 *
 * No manually-run staff wrapper exists, and none is needed — unlike
 * Patients/ConsultationHistory (which have no Web App creation route yet),
 * a Symptom Log is created entirely through this batch's own real,
 * patient-facing Web App routes (create_symptom_draft/update_symptom_draft/
 * submit_symptom_log/get_symptom_logs, FoundationRouter.gs).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_SYMPTOM_LOG_SHEET_ = 'SymptomLogs';
var FOUNDATION_SYMPTOM_LOG_COLUMNS_ = ['record_id', 'patient_id', 'status', 'severity', 'sleep', 'energy', 'stress', 'notes', 'condition_slug', 'created_at', 'updated_at', 'submitted_at'];

// "at most a bare recent-value list" (docs/29 §9). A local constant, not
// FoundationConfig.gs — Foundation's ten files are frozen (docs/35 §9);
// every entity file since PatientIdentity.gs already declares its own
// sheet/column/limit constants locally rather than reopening a frozen file
// for one new value.
var FOUNDATION_SYMPTOM_LOG_MAX_SUBMITTED_ = 50;
var FOUNDATION_SYMPTOM_LOG_NOTES_MAX_LENGTH_ = 2000;
var FOUNDATION_SYMPTOM_LOG_SCALE_VALUES_ = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if valid) for a
 * single scale field's value — used for severity/sleep/energy/stress.
 * Empty string is always a valid "unset" value here; the *submit-time*
 * rule (at least one field non-empty) is enforced separately by
 * foundationValidateSymptomLogForSubmit_(), not here.
 */
function foundationValidateSymptomLogScaleValue_(fieldName, value) {
  if (value === undefined || value === null) return []; // omitted entirely — treated as unset by the caller default
  if (FOUNDATION_SYMPTOM_LOG_SCALE_VALUES_.indexOf(String(value)) === -1) {
    return [fieldName + ' must be a whole number from 1 to 10, or left blank.'];
  }
  return [];
}

/**
 * Validates the mutable fields of a draft edit (or initial creation).
 * Deliberately permissive — a draft may be entirely empty, since it is
 * private, editable scratch space (docs/41 §3). This is NOT the submit
 * gate; see foundationValidateSymptomLogForSubmit_() for that.
 */
function foundationValidateSymptomLogFieldValues_(fields) {
  var errors = [];
  ['severity', 'sleep', 'energy', 'stress'].forEach(function (field) {
    errors = errors.concat(foundationValidateSymptomLogScaleValue_(field, fields && fields[field]));
  });
  if (fields && fields.notes !== undefined && fields.notes !== null) {
    if (typeof fields.notes !== 'string') {
      errors.push('notes must be text.');
    } else if (fields.notes.length > FOUNDATION_SYMPTOM_LOG_NOTES_MAX_LENGTH_) {
      errors.push('notes must be ' + FOUNDATION_SYMPTOM_LOG_NOTES_MAX_LENGTH_ + ' characters or fewer.');
    }
  }
  return errors;
}

/**
 * The submit-time gate (docs/41 §10, symptom-log.md "Submit"): re-checks
 * the row's own *currently stored* values — never trusts client-supplied
 * values at submit time, the same "re-read live state" discipline Phase
 * 1.5's evaluateSendGate_() already established for consent. A
 * deliberately minimal bar: at least one of severity/sleep/energy/stress/
 * notes must be non-empty. Nothing in docs/29 §9 requires every field to
 * be filled.
 */
function foundationValidateSymptomLogForSubmit_(record) {
  var hasScaleValue = ['severity', 'sleep', 'energy', 'stress'].some(function (field) {
    return record[field] !== '';
  });
  var hasNotes = typeof record.notes === 'string' && record.notes.trim() !== '';
  if (!hasScaleValue && !hasNotes) {
    return ['Add at least one value or a note before submitting.'];
  }
  return [];
}

/**
 * Builds a brand-new draft record (shared/schemas/symptom-log.schema.json).
 * conditionSlug is copied once from the patient's own profile at creation
 * time (docs/41 §10) — never independently editable through this entity
 * afterward.
 */
function foundationBuildSymptomLogDraftRecord_(patientId, conditionSlug, recordId, nowIso) {
  return {
    record_id: recordId,
    patient_id: patientId,
    status: 'draft',
    severity: '',
    sleep: '',
    energy: '',
    stress: '',
    notes: '',
    condition_slug: conditionSlug || '',
    created_at: nowIso,
    updated_at: nowIso,
    submitted_at: ''
  };
}

// ---- Sheets-backed operations ----

/**
 * Returns the patient's current open draft, or null if none exists.
 * Internal helper — not a Web App action of its own.
 */
function foundationFindOpenSymptomLogDraft_(patientId) {
  var rows = foundationDsQuery_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, function (row) {
    return row.patient_id === patientId && row.status === 'draft';
  });
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Returns the patient's open draft if one exists; otherwise creates a new
 * one. Deliberately one draft at a time per patient (docs/41, symptom-log.md
 * "one open draft per patient at a time") — avoids unbounded draft
 * accumulation and keeps get_symptom_logs's read shape simple.
 */
function foundationGetOrCreateSymptomLogDraft_(patientId, conditionSlug) {
  return withFoundationErrorHandling_(function () {
    var existing = foundationFindOpenSymptomLogDraft_(patientId);
    if (existing) return existing;
    var recordId = generateFoundationId_();
    var record = foundationBuildSymptomLogDraftRecord_(patientId, conditionSlug, recordId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, record);
    foundationLogAuditEvent_('symptom_log_draft_created', patientId, patientId, 'record_id=' + recordId);
    return record;
  });
}

/**
 * Looks up a Symptom Log row by record_id, scoped strictly to patientId —
 * the same anti-enumeration discipline foundationGetConsultationEntryById_()
 * already established (docs/40 Q3): a row that doesn't exist and a row
 * that belongs to a different patient return the identical
 * FOUNDATION_NOT_FOUND envelope. Internal helper shared by update/submit.
 */
function foundationGetOwnSymptomLogById_(patientId, recordId) {
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, 'record_id', recordId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  var row = lookup.data;
  if (!row || row.patient_id !== patientId) {
    return buildFoundationErrorEnvelope_('FOUNDATION_NOT_FOUND', 'We could not find that symptom log entry.');
  }
  return buildFoundationOkEnvelope_(row);
}

/**
 * Edits the mutable fields of the patient's own draft. Ownership is
 * checked first (anti-enumeration, generic rejection); only once
 * ownership is confirmed is the draft/submitted state checked — an
 * already-submitted row's own owner is not an enumeration risk, so that
 * rejection is specific and patient-facing (docs/41, symptom-log.md).
 */
function foundationUpdateSymptomLogDraft_(patientId, recordId, fields) {
  var errors = foundationValidateSymptomLogFieldValues_(fields);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var lookup = foundationGetOwnSymptomLogById_(patientId, recordId);
  if (lookup.status === 'error') {
    return lookup; // not found / not yours — already generic
  }
  var row = lookup.data;
  if (row.status !== 'draft') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'This entry has already been submitted and can no longer be edited.');
  }
  return withFoundationErrorHandling_(function () {
    var patch = { updated_at: foundationNowIso_() };
    ['severity', 'sleep', 'energy', 'stress', 'notes'].forEach(function (field) {
      if (fields && fields[field] !== undefined && fields[field] !== null) {
        patch[field] = field === 'notes' ? fields[field] : String(fields[field]);
      }
    });
    foundationDsUpdateById_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, 'record_id', recordId, patch);
    foundationLogAuditEvent_('symptom_log_draft_updated', patientId, patientId, 'record_id=' + recordId);
    var updated = foundationDsGetById_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, 'record_id', recordId);
    return updated;
  });
}

/**
 * Transitions the patient's own draft to submitted — irreversible.
 * Re-validates the row's own currently-stored values (never trusts the
 * request body at submit time). Ownership is checked first, same
 * anti-enumeration discipline as the update path above.
 */
function foundationSubmitSymptomLogDraft_(patientId, recordId) {
  var lookup = foundationGetOwnSymptomLogById_(patientId, recordId);
  if (lookup.status === 'error') {
    return lookup; // not found / not yours — already generic
  }
  var row = lookup.data;
  if (row.status !== 'draft') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'This entry has already been submitted.');
  }
  var submitErrors = foundationValidateSymptomLogForSubmit_(row);
  if (submitErrors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', submitErrors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var nowIso = foundationNowIso_();
    foundationDsUpdateById_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, 'record_id', recordId, {
      status: 'submitted',
      submitted_at: nowIso,
      updated_at: nowIso
    });
    foundationLogAuditEvent_('symptom_log_submitted', patientId, patientId, 'record_id=' + recordId);
    return foundationDsGetById_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, 'record_id', recordId);
  });
}

/**
 * Sorts two submitted entries newest-first by submitted_at — both are
 * ISO-formatted strings, so a plain string comparison sorts correctly
 * without parsing (mirrors foundationCompareConsultationEntriesDesc_()'s
 * own approach).
 */
function foundationCompareSymptomLogsDesc_(a, b) {
  if (a.submitted_at !== b.submitted_at) {
    return a.submitted_at < b.submitted_at ? 1 : -1;
  }
  return 0;
}

/**
 * Returns the patient's own Symptom Log history: the current open draft
 * (or null) plus their submitted entries, newest-first, capped at
 * FOUNDATION_SYMPTOM_LOG_MAX_SUBMITTED_. Both halves are the patient's own
 * data (docs/41: drafts are private to the patient, not hidden from them)
 * — this function is never called on another patient's behalf.
 */
function foundationGetPatientSymptomLogs_(patientId) {
  return withFoundationErrorHandling_(function () {
    var draft = foundationFindOpenSymptomLogDraft_(patientId);
    var submitted = foundationDsQuery_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, function (row) {
      return row.patient_id === patientId && row.status === 'submitted';
    });
    submitted.sort(function (a, b) { return foundationCompareSymptomLogsDesc_(a, b); });
    return {
      draft: draft,
      submitted: submitted.slice(0, FOUNDATION_SYMPTOM_LOG_MAX_SUBMITTED_)
    };
  });
}

/**
 * Returns only the patient's own *submitted* entries, newest-first,
 * unwrapped (a plain array, not an envelope) — the shape
 * FoundationTimeline.gs's merge step needs. Never includes drafts
 * (docs/41's "not shown in Timeline" rule for drafts). Throws on an
 * unexpected DataStore failure so the caller's own
 * withFoundationErrorHandling_() wrapper converts it into a safe, generic
 * envelope — this function does not build its own envelope, since it is
 * an internal building block, not a Web-App-facing entry point.
 */
function foundationGetSubmittedSymptomLogsForTimeline_(patientId) {
  var rows = foundationDsQuery_(FOUNDATION_SYMPTOM_LOG_SHEET_, FOUNDATION_SYMPTOM_LOG_COLUMNS_, function (row) {
    return row.patient_id === patientId && row.status === 'submitted';
  });
  rows.sort(function (a, b) { return foundationCompareSymptomLogsDesc_(a, b); });
  return rows;
}
