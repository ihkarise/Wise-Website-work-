/**
 * Check-In Response — Batch PXP-5 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §10,
 * §11.4, §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md governs this and
 * every later batch). Implements shared/schemas/check-in-response.schema.json
 * version 1.0.0. Backs the patient-facing Daily Check-in dashboard card
 * (dynamic form generated from the caller's current CheckInTemplate,
 * TemplateRegistry.gs/CheckInTemplateAssignment.gs) and its full-history
 * page — the designed successor to Symptom Log (§3.2), shipped alongside
 * it, never replacing it in this batch (docs/44 §10.1; Symptom Tracker's
 * own files are completely untouched by this batch).
 *
 * Create and list only, both scoped strictly to the session-derived
 * patient_id (ADR-002) — the same lifecycle FoundationSymptomLog.gs already
 * established for the platform's first patient-writable entity, applied
 * here to its second. No update, no delete, no per-entry get-by-id (no
 * product requirement for one, mirroring FoundationSymptomLog.gs's own
 * disclosed scope boundary).
 *
 * ---- JSON storage: docs/44 §11.4's now-concrete policy, implemented ----
 * `answers` is stored as a JSON-encoded string in a single Sheet cell — the
 * one disclosed exception to ADR-006's flat-column convention docs/44 §11.4
 * itself authorizes. This file is the *contract* boundary: every function
 * that returns a CheckInResponse record to a caller (foundationCreateCheckInResponse_(),
 * foundationGetPatientCheckInResponses_()) returns `answers` as a real,
 * parsed object — matching shared/schemas/check-in-response.schema.json's
 * own `answers: {type: "object"}` contract (shared/README.md's "Contract vs.
 * implementation-only detail": the JSON-string Sheet cell is an
 * implementation-only detail, never part of the contract itself). Only
 * foundationCreateCheckInResponse_()'s own internal Sheets-row build step
 * ever sees the serialized string form.
 *
 * Validation, at write time, enforces every docs/44 §11.4 rule: `answers`
 * must be a flat object (no nested objects/arrays); every present field_key
 * must exist in the referenced (template_id, template_version)'s own
 * question list; every `required` question must be present; every value
 * must satisfy its declared type/min/max; the referenced (template_id,
 * template_version) pair must be a real Template Registry entry
 * (TemplateRegistry.gs); and the caller must currently hold an *active*
 * CheckInTemplateAssignment naming that exact template_id (docs/44 §10.2 —
 * this is the check that makes "doctor decides" a real, enforced boundary
 * rather than an advisory one: a patient can only submit against a template
 * their doctor actually assigned them, never an arbitrary registry entry).
 * Serialization is deterministic — keys written in the template's own
 * question-list order (foundationBuildDeterministicCheckInAnswers_()) — so
 * re-serializing identical answers never produces a spurious byte-level
 * diff, the concrete, checkable property docs/44 §11.4 names.
 *
 * Not Foundation-prefixed, for the same reason FoundationSymptomLog.gs
 * isn't generic infrastructure (docs/29 §2): a concrete entity built on
 * Foundation's frozen infrastructure. Zero modification to any frozen
 * Foundation/Identity & Access/Patient Access/PXP-1..4 file — reuses
 * FoundationDataStore.gs's existing generic insert/query operations and
 * FoundationAudit.gs's existing foundationLogAuditEvent_() exactly as both
 * were already designed to be reused (ADR-009).
 *
 * `FOUNDATION_CHECKIN_ALLOWED_CONDITION_SLUGS_` below is manually adapted
 * from shared/constants/condition-slugs.json version 1.0.0, the same
 * duplication-by-convention FoundationSymptomLog.gs's own allowlist already
 * established — update both places by hand if the canonical list ever
 * changes, per shared/README.md's rule.
 *
 * Depends on TemplateRegistry.gs, CheckInTemplateAssignment.gs,
 * FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_CHECKIN_RESPONSES_SHEET_ = 'CheckInResponses';
var FOUNDATION_CHECKIN_RESPONSES_COLUMNS_ = ['record_id', 'patient_id', 'template_id', 'template_version', 'logged_at', 'answers', 'condition_slug'];

// Mirrors FoundationSymptomLog.gs's FOUNDATION_SYMPTOM_LOGS_MAX_ENTRIES_ —
// a local constant, not FoundationConfig.gs (Foundation's ten files are
// frozen, docs/35 §9).
var FOUNDATION_CHECKIN_RESPONSES_MAX_ENTRIES_ = 50;

// The real, server-side size bound docs/44 §11.4 requires ("mirroring
// FoundationReports.gs's existing upload-size check"), applied here to the
// serialized answers JSON text rather than decoded file bytes — a
// generous ceiling for a handful of short scale/text answers, never
// meant to be reached by a legitimate submission.
var FOUNDATION_CHECKIN_ANSWERS_MAX_BYTES_ = 8192;

// Manually adapted from shared/constants/condition-slugs.json v1.0.0 —
// see this file's own header comment.
var FOUNDATION_CHECKIN_ALLOWED_CONDITION_SLUGS_ = [
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
 * Returns an array of human-readable error strings (empty if `answers` is
 * valid against `questions`, the exact ordered question list of one
 * Template Registry version). The generic, dependency-free validation
 * discipline docs/44 §11.4 names — mirroring
 * validation/phase-2a-foundation/schema-validator.js's own spirit (generic,
 * no third-party dependency), implemented directly here since Apps Script
 * cannot require() that Node-only tooling file.
 */
function foundationValidateCheckInAnswers_(questions, answers) {
  var errors = [];
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    errors.push('answers must be a flat object.');
    return errors;
  }
  var knownFieldKeys = questions.map(function (q) { return q.field_key; });
  Object.keys(answers).forEach(function (key) {
    if (knownFieldKeys.indexOf(key) === -1) {
      errors.push('answers contains an unrecognized field "' + key + '".');
      return;
    }
    var value = answers[key];
    if (value !== null && typeof value === 'object') {
      errors.push('answers.' + key + ' must be a flat value, not an object or array (docs/44 §11.4).');
    }
  });
  questions.forEach(function (q) {
    var hasValue = Object.prototype.hasOwnProperty.call(answers, q.field_key) && answers[q.field_key] !== null && answers[q.field_key] !== undefined;
    if (q.required && !hasValue) {
      errors.push(q.field_key + ' is required.');
      return;
    }
    if (!hasValue) {
      return;
    }
    var value = answers[q.field_key];
    if (q.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(q.field_key + ' must be a number.');
      } else {
        if (q.min !== undefined && value < q.min) {
          errors.push(q.field_key + ' must be at least ' + q.min + '.');
        }
        if (q.max !== undefined && value > q.max) {
          errors.push(q.field_key + ' must be at most ' + q.max + '.');
        }
      }
    } else if (q.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(q.field_key + ' must be true or false.');
      }
    } else if (q.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(q.field_key + ' must be a string.');
      }
    }
  });
  return errors;
}

/**
 * Returns a new object containing only `answers`' fields that are actually
 * present, keyed in `questions`' own declared order — the deterministic
 * serialization docs/44 §11.4 requires ("keys written in a fixed, stable
 * order ... so re-serializing identical answers never produces a spurious
 * byte-level diff"). A string value is trimmed, the same convention every
 * other Foundation entity's string fields already follow.
 */
function foundationBuildDeterministicCheckInAnswers_(questions, answers) {
  var ordered = {};
  questions.forEach(function (q) {
    var hasValue = Object.prototype.hasOwnProperty.call(answers, q.field_key) && answers[q.field_key] !== null && answers[q.field_key] !== undefined;
    if (!hasValue) {
      return;
    }
    var value = answers[q.field_key];
    ordered[q.field_key] = typeof value === 'string' ? value.trim() : value;
  });
  return ordered;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for the request body's own shape — deeper checks requiring a
 * Template Registry/CheckInTemplateAssignment lookup happen in
 * foundationCreateCheckInResponse_() itself, mirroring
 * foundationResolveCondition_()'s "pure shape check first, stateful check
 * after" discipline.
 */
function foundationValidateCheckInResponseInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.template_id !== 'string' || input.template_id.trim() === '') {
    errors.push('template_id is required.');
  }
  if (!input || typeof input.template_version !== 'number' || !Number.isInteger(input.template_version) || input.template_version < 1) {
    errors.push('template_version must be a positive integer.');
  }
  if (!input || !input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) {
    errors.push('answers must be a flat object.');
  }
  if (input && input.condition_slug !== undefined && input.condition_slug !== null && input.condition_slug !== '') {
    if (typeof input.condition_slug !== 'string' || FOUNDATION_CHECKIN_ALLOWED_CONDITION_SLUGS_.indexOf(input.condition_slug) === -1) {
      errors.push('condition_slug must be one of the recognized condition tags.');
    }
  }
  return errors;
}

/**
 * Converts one Sheets row (a raw record with `answers` still a JSON
 * string) into this entity's real, contractual API shape — `answers`
 * parsed back into an object, per this file's own header comment on the
 * contract boundary. A malformed stored string (should never happen —
 * every write path serializes via JSON.stringify()) degrades to an empty
 * object rather than throwing, the same fail-soft discipline this
 * repository applies to any unexpected stored-data shape.
 */
function foundationCheckInRowToApiShape_(row) {
  var parsedAnswers;
  try {
    parsedAnswers = JSON.parse(row.answers || '{}');
  } catch (err) {
    parsedAnswers = {};
  }
  return {
    record_id: row.record_id,
    patient_id: row.patient_id,
    template_id: row.template_id,
    template_version: row.template_version,
    logged_at: row.logged_at,
    answers: parsedAnswers,
    condition_slug: row.condition_slug || ''
  };
}

/**
 * Sorts two entries for full-history display: logged_at descending.
 * Mirrors foundationCompareSymptomLogsDesc_() exactly.
 */
function foundationCompareCheckInResponsesDesc_(a, b) {
  if (a.logged_at !== b.logged_at) {
    return a.logged_at < b.logged_at ? 1 : -1;
  }
  return 0;
}

// ---- Sheets-backed operations ----

/**
 * Creates a new Check-In Response entry. `input.patient_id` must already
 * be session-derived by the caller (ADR-002) — this function never
 * re-derives it. Validation failure is an expected outcome (direct
 * envelope, not the generic wrapper), the same convention every other
 * Foundation entity's create function already follows. Order of checks:
 * (1) request shape, (2) the referenced (template_id, template_version)
 * is a real Template Registry entry, (3) the caller currently holds an
 * active CheckInTemplateAssignment naming that exact template_id (docs/44
 * §10.2's enforcement boundary), (4) answers validate against that
 * version's own question list, (5) the serialized size bound.
 */
function foundationCreateCheckInResponse_(input) {
  var errors = foundationValidateCheckInResponseInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }

  var patientId = input.patient_id.trim();
  var templateId = input.template_id.trim();

  var template = foundationGetTemplateByIdAndVersion_(templateId, input.template_version);
  if (!template) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'template_id/template_version does not match a real Template Registry entry.');
  }

  var assignmentLookup = foundationGetActiveTemplateAssignmentForPatient_(patientId);
  if (assignmentLookup.status === 'error') {
    return assignmentLookup; // unexpected failure — already a safe, generic envelope
  }
  if (!assignmentLookup.data || assignmentLookup.data.template_id !== templateId) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'You are not currently assigned this check-in template.');
  }

  var answerErrors = foundationValidateCheckInAnswers_(template.questions, input.answers);
  if (answerErrors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', answerErrors.join(' '));
  }

  var deterministicAnswers = foundationBuildDeterministicCheckInAnswers_(template.questions, input.answers);
  var answersJson = JSON.stringify(deterministicAnswers);
  if (answersJson.length > FOUNDATION_CHECKIN_ANSWERS_MAX_BYTES_) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'Your check-in answers are too long.');
  }

  return withFoundationErrorHandling_(function () {
    var recordId = generateFoundationId_();
    var sheetRow = {
      record_id: recordId,
      patient_id: patientId,
      template_id: templateId,
      template_version: input.template_version,
      logged_at: foundationNowIso_(),
      answers: answersJson,
      condition_slug: (input.condition_slug || '').trim()
    };
    foundationDsInsert_(FOUNDATION_CHECKIN_RESPONSES_SHEET_, FOUNDATION_CHECKIN_RESPONSES_COLUMNS_, sheetRow);
    foundationLogAuditEvent_('checkin_response_created', patientId, patientId, 'record_id=' + recordId + ';template_id=' + templateId + ';template_version=' + input.template_version);
    return foundationCheckInRowToApiShape_(sheetRow);
  });
}

/**
 * Returns `patientId`'s own Check-In Response entries, sorted newest-first
 * and capped at FOUNDATION_CHECKIN_RESPONSES_MAX_ENTRIES_, each converted
 * to this entity's contractual API shape (`answers` parsed, never the raw
 * stored JSON string). `patientId` must already be session-verified by the
 * caller (ADR-002) — this function never re-derives it.
 */
function foundationGetPatientCheckInResponses_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_CHECKIN_RESPONSES_SHEET_, FOUNDATION_CHECKIN_RESPONSES_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    rows.sort(function (a, b) { return foundationCompareCheckInResponsesDesc_(a, b); });
    return rows.slice(0, FOUNDATION_CHECKIN_RESPONSES_MAX_ENTRIES_).map(foundationCheckInRowToApiShape_);
  });
}
