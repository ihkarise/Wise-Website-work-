/**
 * Consultation History — Batch PA-3 (docs/29 §13 Batch 5D). Implements
 * shared/schemas/consultation-history.schema.json version 1.0.0. Backs the
 * patient-facing Timeline (docs/29 §6) and Consultation History detail view
 * (docs/29 §7): a staff-authored or Phase-1.5-linked visit-history entry,
 * read-only for patients.
 *
 * Not Foundation-prefixed, for the same reason PatientIdentity.gs and
 * FoundationLoginTokens.gs aren't (docs/29 §2): this is a concrete entity
 * built on Foundation's frozen infrastructure, not infrastructure itself.
 * Zero modification to any frozen Foundation/Identity & Access file — reuses
 * FoundationDataStore.gs's existing generic insert/getById/query operations
 * and FoundationAudit.gs's existing foundationLogAuditEvent_() exactly as
 * both were already designed to be reused (ADR-009).
 *
 * Identity strategy (docs/40-CONSULTATION-IDENTITY-STRATEGY.md): record_id
 * is the only field that identifies a specific entry — never entry_date,
 * never row position. entry_date (plus created_at as a tiebreaker) governs
 * *display* order only (docs/39 §3) and is a wholly separate concern from
 * *identity*. Every patient-facing fetch of a specific record_id verifies
 * the row's own patient_id matches the session-derived patient_id before
 * returning it (docs/40 Q3) — record_id's unguessability is not itself an
 * authorization boundary.
 *
 * entry_type is always "consultation" in this schema version — see
 * shared/schemas/consultation-history.md for why the enum is deliberately
 * narrow rather than widened to docs/33 §3.1's full Timeline Event set.
 *
 * A deliberate simplification, stated openly: no staff-facing Web App tool
 * exists for creating entries. docs/29 §7 describes an "access-code-gated
 * internal tool" for this, but Foundation has no staff-authorization
 * primitive of its own (docs/29 §3's RBAC statement assumes staff continues
 * using Phase 1.5's separate STAFF_ACCESS_CODE-gated pathway, not a new
 * Foundation action), and building one would mean either reopening Code.gs
 * a second time for staff-side dispatch or inventing new Foundation
 * staff-auth infrastructure — both bigger architectural moves than this
 * batch's plan authorized. createFoundationConsultationEntry() (bottom of
 * this file) is the same manually-run, no-route, no-Sheet-menu pattern
 * PatientIdentity.gs's createFoundationPatient() and
 * FoundationLoginTokens.gs's createFoundationLoginToken() already
 * established for exactly this category of gap. A real staff tool remains
 * future work, not silently dropped.
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_CONSULTATION_HISTORY_SHEET_ = 'ConsultationHistory';
var FOUNDATION_CONSULTATION_HISTORY_COLUMNS_ = ['record_id', 'patient_id', 'entry_date', 'entry_type', 'title', 'summary_text', 'source_ref', 'created_by', 'created_at'];

// "Capped (e.g. latest 50) for payload size/performance" — docs/29 §6. A
// local constant, not FoundationConfig.gs — Foundation's ten files are
// frozen (docs/35 §9); every entity file since PatientIdentity.gs already
// declares its own sheet/column/limit constants locally rather than
// reopening a frozen file for one new value.
var FOUNDATION_CONSULTATION_HISTORY_MAX_ENTRIES_ = 50;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). Mirrors foundationValidatePatientInput_()'s structure.
 */
function foundationValidateConsultationEntryInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.entry_date !== 'string' || input.entry_date.trim() === '') {
    errors.push('entry_date is required.');
  }
  if (!input || typeof input.title !== 'string' || input.title.trim() === '') {
    errors.push('title is required.');
  }
  if (!input || typeof input.summary_text !== 'string' || input.summary_text.trim() === '') {
    errors.push('summary_text is required.');
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (staff identifier) is required.');
  }
  if (input && input.source_ref !== undefined && input.source_ref !== null && typeof input.source_ref !== 'string') {
    errors.push('source_ref must be a string when provided.');
  }
  return errors;
}

/**
 * Builds a ConsultationHistory record (shared/schemas/consultation-history.schema.json).
 * `entry_type` is always the fixed constant "consultation" — see this
 * file's own header comment and consultation-history.md for why.
 */
function foundationBuildConsultationEntryRecord_(input, recordId, nowIso) {
  return {
    record_id: recordId,
    patient_id: input.patient_id.trim(),
    entry_date: input.entry_date.trim(),
    entry_type: 'consultation',
    title: input.title.trim(),
    summary_text: input.summary_text.trim(),
    source_ref: (input.source_ref || '').trim(),
    created_by: input.created_by.trim(),
    created_at: nowIso
  };
}

/**
 * Sorts two entries for Timeline display: entry_date descending, with
 * created_at descending as an explicit tiebreaker (docs/39 §3) — entry_date
 * (the clinically meaningful visit date) and created_at (when the row was
 * actually written) can diverge, since staff may enter or backfill an entry
 * after the visit happened. Both are ISO-formatted strings, so a plain
 * string comparison sorts correctly without parsing.
 */
function foundationCompareConsultationEntriesDesc_(a, b) {
  if (a.entry_date !== b.entry_date) {
    return a.entry_date < b.entry_date ? 1 : -1;
  }
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1;
  }
  return 0;
}

/**
 * Deployment verification (2026-07-04) found that Google Sheets silently
 * converts a plain date string like "2026-07-01" written to a cell into a
 * real date value — so reading it back via SpreadsheetApp yields a native
 * Date object, not the original string. FOUNDATION_CONSULTATION_HISTORY's
 * entry_date is contractually a plain string (shared/schemas/
 * consultation-history.schema.json), so this normalizes any such Date
 * object back to a bare YYYY-MM-DD string before it ever reaches a caller.
 * Apps Script/Sheets anchors a date-only cell's value to UTC midnight
 * regardless of script/spreadsheet timezone, so the UTC getters below are
 * the correct, timezone-independent way to recover the original date.
 * A value that is already a string (e.g. a record just built in-memory by
 * foundationCreateConsultationEntry_(), never round-tripped through
 * Sheets) passes through unchanged.
 */
function foundationNormalizeEntryDate_(value) {
  if (Object.prototype.toString.call(value) !== '[object Date]') {
    return value;
  }
  var pad = function (n) { return n < 10 ? '0' + n : String(n); };
  return value.getUTCFullYear() + '-' + pad(value.getUTCMonth() + 1) + '-' + pad(value.getUTCDate());
}

// ---- Sheets-backed operations ----

/**
 * Creates a new Consultation History entry. Validation failure is an
 * expected outcome (direct envelope, not the generic wrapper) — same
 * convention foundationCreatePatient_() already established.
 */
function foundationCreateConsultationEntry_(input) {
  var errors = foundationValidateConsultationEntryInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var recordId = generateFoundationId_();
    var record = foundationBuildConsultationEntryRecord_(input, recordId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_CONSULTATION_HISTORY_SHEET_, FOUNDATION_CONSULTATION_HISTORY_COLUMNS_, record);
    foundationLogAuditEvent_('consultation_entry_created', record.patient_id, input.created_by, 'record_id=' + recordId);
    return record;
  });
}

/**
 * Returns `patientId`'s own Consultation History entries, sorted for
 * Timeline display (newest first) and capped at
 * FOUNDATION_CONSULTATION_HISTORY_MAX_ENTRIES_ (docs/29 §6). `patientId`
 * must already be session-verified by the caller (ADR-002) — this function
 * never re-derives it and never accepts it from anywhere but a trusted
 * caller.
 */
function foundationGetPatientTimeline_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_CONSULTATION_HISTORY_SHEET_, FOUNDATION_CONSULTATION_HISTORY_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    rows.forEach(function (row) { row.entry_date = foundationNormalizeEntryDate_(row.entry_date); });
    rows.sort(function (a, b) { return foundationCompareConsultationEntriesDesc_(a, b); });
    return rows.slice(0, FOUNDATION_CONSULTATION_HISTORY_MAX_ENTRIES_);
  });
}

/**
 * Returns a single Consultation History entry by record_id, scoped strictly
 * to `patientId` — the first Foundation-family read that takes a
 * client-supplied identifier, so ownership must be checked explicitly
 * (docs/40 Q3, docs/39 §10). A record that doesn't exist, and a record that
 * exists but belongs to a different patient, return the exact same
 * FOUNDATION_NOT_FOUND envelope — the same anti-enumeration discipline
 * login-token.md's "Rejection is deliberately generic" already established,
 * so a caller can never distinguish "not yours" from "doesn't exist."
 */
function foundationGetConsultationEntryById_(patientId, recordId) {
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_CONSULTATION_HISTORY_SHEET_, FOUNDATION_CONSULTATION_HISTORY_COLUMNS_, 'record_id', recordId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  var row = lookup.data;
  if (!row || row.patient_id !== patientId) {
    return buildFoundationErrorEnvelope_('FOUNDATION_NOT_FOUND', 'We could not find that consultation entry.');
  }
  row.entry_date = foundationNormalizeEntryDate_(row.entry_date);
  return buildFoundationOkEnvelope_(row);
}

// ---- Manually-run wrapper (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with a real entry's details. Not a Web App
 * endpoint, not a Sheet menu — see this file's own header comment for why
 * a real staff-facing tool is deliberately out of this batch's scope.
 */
function createFoundationConsultationEntry() {
  var result = foundationCreateConsultationEntry_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    entry_date: 'EDIT ME BEFORE RUNNING', // e.g. '2026-07-01'
    title: 'EDIT ME BEFORE RUNNING',
    summary_text: 'EDIT ME BEFORE RUNNING',
    source_ref: '', // optional — a Phase 1.5 ConsultationSummary record_id
    created_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
