/**
 * Reports — Batch PA-5 (docs/29 §13 Batch 5F). Implements
 * shared/schemas/report.schema.json version 1.0.0. Backs the
 * patient-facing Reports dashboard card (upload control + recent
 * uploads) and full history page (docs/29 §5, §8). The platform's first
 * arbitrary file-handling surface and its highest-risk Phase 2A feature
 * (docs/29 §8, §11) — binary content lives in Google Drive, never in a
 * Sheet cell; this file's Sheet row is metadata only. Preceded by a
 * dedicated pre-implementation review
 * (docs/42-REPORT-UPLOAD-READINESS-REVIEW.md), approved before any code
 * was written, per this session's own instruction.
 *
 * Not Foundation-prefixed function names beyond the `foundation`-prefixed
 * internals, for the same reason PatientIdentity.gs,
 * FoundationConsultationHistory.gs, and FoundationSymptomLog.gs aren't
 * generic infrastructure (docs/29 §2): this is a concrete entity built on
 * Foundation's frozen infrastructure, not infrastructure itself. Zero
 * modification to any frozen Foundation/Identity & Access/PA-3/PA-4 file —
 * reuses FoundationDataStore.gs's existing generic insert/getById/query
 * operations and FoundationAudit.gs's existing foundationLogAuditEvent_()
 * exactly as both were already designed to be reused (ADR-009).
 *
 * ---- Authorization: the application is the boundary, Drive is defense-in-depth only ----
 * Per the approved architecture decision (docs/42), authorization always
 * begins with this application, never with Drive's own sharing state.
 * `foundationGetPatientReports_()` and `foundationDownloadReport_()` both
 * take `patientId` only from an already-verified session (ADR-002,
 * enforced by the caller, same as every other Foundation entity read).
 * `foundationDownloadReport_()` additionally accepts a client-supplied
 * `recordId` — `foundationGetReportById_()` independently verifies the
 * fetched row's own `patient_id` matches before any Drive call is ever
 * made, the same "unguessability is not itself an authorization boundary"
 * discipline `foundationGetConsultationEntryById_()` established
 * (docs/40-CONSULTATION-IDENTITY-STRATEGY.md Q3). The Drive file itself is
 * never explicitly shared ("anyone with the link" or otherwise) — its
 * default, script-owner-only permission is a second, independent layer,
 * never the mechanism a legitimate request actually relies on. Downloads
 * never hand the browser a Drive URL; the server fetches the file's bytes
 * inside its own already-authorized execution and returns them
 * base64-encoded in the response envelope.
 *
 * ---- MIME validation: three layers, one disclosed limitation ----
 * Per the approved architecture decision, every mechanism realistically
 * available on this platform is used — never the filename extension
 * alone. See shared/constants/upload-limits.md for the full three-layer
 * discipline (extension, client-declared mime_type, server-side
 * content-based detection via `Utilities.newBlob()`'s documented
 * byte-structure sniffing) and its explicitly disclosed limitation: this
 * is a byte-signature heuristic, not a parser or a malware/virus scanner
 * (none exists anywhere in this stack, docs/29 §8's already-accepted
 * risk). This file does not claim stronger validation than actually
 * exists.
 *
 * ---- Lifecycle: create -> persist -> read. No update. No delete. ----
 * Per the approved architecture decisions: metadata becomes immutable
 * immediately after upload (no edit function exists or should exist) and
 * there is no delete function (deletion is explicitly out of this
 * batch's/phase's scope).
 *
 * ---- No staff Web App upload route ----
 * Per the approved architecture decision, `FoundationRouter.gs` gains no
 * staff-facing upload case. The only staff-attributed path is
 * `createFoundationReportForExistingDriveFile()` (bottom of this file), a
 * manually-run Apps Script editor wrapper — the same no-route,
 * no-Sheet-menu pattern `createFoundationConsultationEntry()` and
 * `createFoundationPatient()` already established for exactly this
 * category of gap.
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs, plus the platform's
 * own Utilities/DriveApp globals (no dependency on any other entity file).
 */

var FOUNDATION_REPORTS_SHEET_ = 'Reports';
var FOUNDATION_REPORTS_COLUMNS_ = ['record_id', 'patient_id', 'uploaded_at', 'file_name', 'drive_file_id', 'mime_type', 'size_bytes', 'uploaded_by'];

// "Capped (e.g. latest 50) for payload size/performance" — the same
// precedent docs/29 §6/§9 already set for Timeline/Symptom Tracker. A
// local constant, not FoundationConfig.gs — Foundation's ten files are
// frozen (docs/35 §9); every entity file since PatientIdentity.gs already
// declares its own sheet/column/limit constants locally.
var FOUNDATION_REPORTS_MAX_ENTRIES_ = 50;

// Placeholder — replace with the real, provisioned Reports Drive folder ID
// (test tier first, per docs/29 §7/§10's environment-separation rule),
// the same "fails loudly on an unprovisioned operational value"
// discipline FoundationDataStore.gs's PATIENT_SPREADSHEET_ID placeholder
// already established (DriveApp.getFolderById() throws naturally on an
// unreplaced placeholder — no separate explicit check is needed). Not
// FoundationConfig.gs, for the same "local constant" reason as above.
var FOUNDATION_REPORTS_DRIVE_FOLDER_ID_ = 'REPLACE_WITH_REPORTS_DRIVE_FOLDER_ID';

// Manually adapted from shared/constants/upload-limits.json version
// 1.0.0 — see that file's own header comment for the three-layer
// validation discipline this pairs with, and its disclosed
// content-sniffing limitation. Update both places by hand if the
// canonical values ever change, per shared/README.md's rule.
var FOUNDATION_ALLOWED_REPORT_FILE_TYPES_ = [
  { mimeType: 'application/pdf', extensions: ['.pdf'] },
  { mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  { mimeType: 'image/png', extensions: ['.png'] }
];
var FOUNDATION_ALLOWED_REPORT_MIME_TYPES_ = FOUNDATION_ALLOWED_REPORT_FILE_TYPES_.map(function (t) { return t.mimeType; });
var FOUNDATION_ALLOWED_REPORT_EXTENSIONS_ = FOUNDATION_ALLOWED_REPORT_FILE_TYPES_.reduce(function (all, t) { return all.concat(t.extensions); }, []);

// "Stored as a shared constant," per the approved architecture decision —
// never hardcoded independently here or in any frontend consumer.
// Manually adapted from shared/constants/upload-limits.json version
// 1.0.0's max_upload_bytes.
var FOUNDATION_REPORT_MAX_UPLOAD_BYTES_ = 5242880;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

function foundationGetFileExtension_(fileName) {
  var match = /\.[^.\/\\]+$/.exec(String(fileName || ''));
  return match ? match[0].toLowerCase() : '';
}

/**
 * The first, weakest of three defense-in-depth checks (shared/constants/
 * upload-limits.md) — trivially spoofed by renaming any file. Never
 * relied on alone; the real check is foundationDetectActualMimeType_()
 * below, applied only to the actual decoded bytes.
 */
function foundationIsAllowedReportExtension_(fileName) {
  return FOUNDATION_ALLOWED_REPORT_EXTENSIONS_.indexOf(foundationGetFileExtension_(fileName)) !== -1;
}

/**
 * The second of three defense-in-depth checks — the client-declared
 * `File.type`. Also spoofable by any client capable of crafting its own
 * request; useful only for a fast UX rejection before any bytes are
 * decoded, never the authorization-grade check.
 */
function foundationIsAllowedReportMimeType_(mimeType) {
  return FOUNDATION_ALLOWED_REPORT_MIME_TYPES_.indexOf(mimeType) !== -1;
}

function foundationExtensionForMimeType_(mimeType) {
  var entry = FOUNDATION_ALLOWED_REPORT_FILE_TYPES_.filter(function (t) { return t.mimeType === mimeType; })[0];
  return entry ? entry.extensions[0] : '';
}

// Base64 shape check only (standard alphabet, optional padding) — the
// real decode (and therefore the only trustworthy byte-length/content
// check) needs Utilities and happens in foundationCreateReport_() below,
// which cannot be a pure helper.
var FOUNDATION_BASE64_PATTERN_ = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid). Mirrors foundationValidateSymptomLogInput_()'s structure. Only
 * the extension and the client-declared mime_type are checked here (both
 * named, disclosed, non-authoritative signals) — the authoritative,
 * content-based check happens later in foundationCreateReport_(), once
 * the real bytes are decoded.
 */
function foundationValidateReportUploadInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.file_name !== 'string' || input.file_name.trim() === '') {
    errors.push('file_name is required.');
  } else if (!foundationIsAllowedReportExtension_(input.file_name)) {
    errors.push('That file type is not supported. Please upload a PDF, JPG, or PNG.');
  }
  if (!input || typeof input.mime_type !== 'string' || input.mime_type.trim() === '') {
    errors.push('mime_type is required.');
  } else if (!foundationIsAllowedReportMimeType_(input.mime_type)) {
    errors.push('That file type is not supported. Please upload a PDF, JPG, or PNG.');
  }
  if (!input || typeof input.file_base64 !== 'string' || input.file_base64.trim() === '' || !FOUNDATION_BASE64_PATTERN_.test(input.file_base64)) {
    errors.push('file_base64 must be a non-empty, well-formed base64 string.');
  }
  if (!input || typeof input.uploaded_by !== 'string' || input.uploaded_by.trim() === '') {
    errors.push('uploaded_by is required.');
  }
  return errors;
}

/**
 * Builds a Reports record (shared/schemas/report.schema.json). `file_name`
 * is the client-supplied display name, kept verbatim (trimmed) for
 * rendering only — never used to name the actual Drive object (docs/29
 * §8). `mimeType`/`sizeBytes` are always the server-detected/measured
 * values, passed in by the caller after the real content-based check.
 */
function foundationBuildReportRecord_(input, recordId, nowIso, driveFileId, detectedMimeType, sizeBytes) {
  return {
    record_id: recordId,
    patient_id: input.patient_id.trim(),
    uploaded_at: nowIso,
    file_name: input.file_name.trim(),
    drive_file_id: driveFileId,
    mime_type: detectedMimeType,
    size_bytes: sizeBytes,
    uploaded_by: input.uploaded_by.trim()
  };
}

/**
 * Sorts two entries for full-history display: uploaded_at descending — a
 * single sort key, the same scheme foundationCompareSymptomLogsDesc_()
 * already uses.
 */
function foundationCompareReportsDesc_(a, b) {
  if (a.uploaded_at !== b.uploaded_at) {
    return a.uploaded_at < b.uploaded_at ? 1 : -1;
  }
  return 0;
}

// ---- Apps Script-dependent helpers ----

/**
 * The third, authoritative defense-in-depth check (shared/constants/
 * upload-limits.md) — inspects the actual decoded bytes via Apps
 * Script's documented `Utilities.newBlob(data)` behavior ("attempts to
 * determine the correct extension and content-type of the data based on
 * the structure of the byte array"). A byte-signature heuristic, not a
 * parser or a malware/virus scanner — see shared/constants/
 * upload-limits.md's disclosed limitation for exactly what this does and
 * does not guarantee.
 */
function foundationDetectActualMimeType_(bytes) {
  return Utilities.newBlob(bytes).getContentType();
}

// ---- Sheets/Drive-backed operations ----

/**
 * Creates a new Report entry for the patient-facing upload route.
 * `input.patient_id` and `input.uploaded_by` must already be
 * session-derived by the caller (ADR-002) — for this route they are
 * always the same value, since a patient can only upload to their own
 * record. Validation failure is an expected outcome (direct envelope, not
 * the generic wrapper), the same convention every other Foundation
 * entity's create function already follows.
 */
function foundationCreateReport_(input) {
  var errors = foundationValidateReportUploadInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(input.file_base64);
  } catch (err) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'That file could not be read. Please try uploading it again.');
  }
  if (!bytes || bytes.length === 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'That file appears to be empty.');
  }
  // The real size check — the decoded byte length, never the
  // client-supplied file size (docs/29 §8: "client-side limits are UX
  // only, never trusted").
  if (bytes.length > FOUNDATION_REPORT_MAX_UPLOAD_BYTES_) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT',
      'That file is larger than the ' + (FOUNDATION_REPORT_MAX_UPLOAD_BYTES_ / (1024 * 1024)) + ' MB limit.');
  }
  // The real type check — content-based, not the client-declared
  // mime_type or the filename extension (both already checked above,
  // neither trusted alone).
  var detectedMimeType = foundationDetectActualMimeType_(bytes);
  if (!foundationIsAllowedReportMimeType_(detectedMimeType)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'That file type is not supported. Please upload a PDF, JPG, or PNG.');
  }

  return withFoundationErrorHandling_(function () {
    var recordId = generateFoundationId_();
    var driveObjectName = input.patient_id.trim() + '_' + recordId + foundationExtensionForMimeType_(detectedMimeType);
    var blob = Utilities.newBlob(bytes, detectedMimeType, driveObjectName);
    var folder = DriveApp.getFolderById(FOUNDATION_REPORTS_DRIVE_FOLDER_ID_);
    var driveFile = folder.createFile(blob);
    // Drive's default permission (script-owner-only) is left untouched —
    // never explicitly shared "anyone with the link" or otherwise
    // (docs/29 §8). Defense-in-depth only, per the approved architecture
    // decision: every read of this row re-verifies patient_id at the
    // application layer regardless of Drive's own permission state.
    var record = foundationBuildReportRecord_(input, recordId, foundationNowIso_(), driveFile.getId(), detectedMimeType, bytes.length);
    foundationDsInsert_(FOUNDATION_REPORTS_SHEET_, FOUNDATION_REPORTS_COLUMNS_, record);
    foundationLogAuditEvent_('report_uploaded', record.patient_id, record.uploaded_by, 'record_id=' + recordId + ';size_bytes=' + bytes.length + ';mime_type=' + detectedMimeType);
    return record;
  });
}

/**
 * Returns `patientId`'s own Report entries, sorted newest-first and
 * capped at FOUNDATION_REPORTS_MAX_ENTRIES_. `patientId` must already be
 * session-verified by the caller (ADR-002) — this function never
 * re-derives it and never accepts it from anywhere but a trusted caller.
 * Metadata only — no Drive call is made here (the full-history list does
 * not need file bytes, only foundationDownloadReport_() does).
 */
function foundationGetPatientReports_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_REPORTS_SHEET_, FOUNDATION_REPORTS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    rows.sort(function (a, b) { return foundationCompareReportsDesc_(a, b); });
    return rows.slice(0, FOUNDATION_REPORTS_MAX_ENTRIES_);
  });
}

/**
 * Returns a single Report's metadata by record_id, scoped strictly to
 * `patientId` — the same "unguessability is not itself an authorization
 * boundary" check foundationGetConsultationEntryById_() already
 * established (docs/40 Q3). A record that doesn't exist, and a record
 * that exists but belongs to a different patient, return the exact same
 * FOUNDATION_NOT_FOUND envelope, so a caller can never distinguish "not
 * yours" from "doesn't exist." No Drive call is made here — this is the
 * ownership gate foundationDownloadReport_() below runs before ever
 * touching Drive.
 */
function foundationGetReportById_(patientId, recordId) {
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_REPORTS_SHEET_, FOUNDATION_REPORTS_COLUMNS_, 'record_id', recordId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  var row = lookup.data;
  if (!row || row.patient_id !== patientId) {
    return buildFoundationErrorEnvelope_('FOUNDATION_NOT_FOUND', 'We could not find that report.');
  }
  return buildFoundationOkEnvelope_(row);
}

/**
 * Returns a single report's file content, base64-encoded, after the same
 * ownership gate foundationGetReportById_() enforces. Only after that
 * gate passes does this function ever call DriveApp — "authorization
 * always begins with the application," per the approved architecture
 * decision; Drive's own permission state is never consulted as part of
 * this check. Never returns a Drive URL — the browser receives file
 * bytes only, inside this already-authorized response envelope.
 */
function foundationDownloadReport_(patientId, recordId) {
  var lookup = foundationGetReportById_(patientId, recordId);
  if (lookup.status === 'error') {
    return lookup;
  }
  var row = lookup.data;
  return withFoundationErrorHandling_(function () {
    var blob = DriveApp.getFileById(row.drive_file_id).getBlob();
    return {
      record_id: row.record_id,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      file_base64: Utilities.base64Encode(blob.getBytes())
    };
  });
}

// ---- Manually-run wrapper (Apps Script editor dropdown) — the only staff-attributed path ----

function foundationValidateExistingDriveFileReportInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.drive_file_id !== 'string' || input.drive_file_id.trim() === '') {
    errors.push('drive_file_id is required.');
  }
  if (!input || typeof input.file_name !== 'string' || input.file_name.trim() === '') {
    errors.push('file_name is required.');
  }
  if (!input || typeof input.uploaded_by !== 'string' || input.uploaded_by.trim() === '') {
    errors.push('uploaded_by (staff identifier) is required.');
  }
  return errors;
}

/**
 * Attaches an already-existing Drive file — uploaded to Drive directly by
 * staff, outside this application (e.g. via the Drive UI) — to a
 * patient's Reports list. The only staff-attributed path to a Reports row
 * (no staff Web App route exists, per the approved architecture
 * decision). Reuses the referenced file in place; never copies or moves
 * it, so the calling staff member is responsible for having placed it
 * somewhere with an appropriately private Drive permission before running
 * this. Runs the same content-based type/size validation as the patient
 * upload route (foundationCreateReport_()) before writing any metadata.
 */
function foundationCreateReportForExistingDriveFile_(input) {
  var errors = foundationValidateExistingDriveFileReportInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }

  var bytes;
  try {
    bytes = DriveApp.getFileById(input.drive_file_id.trim()).getBlob().getBytes();
  } catch (err) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'That Drive file could not be read. Check the drive_file_id and try again.');
  }
  if (!bytes || bytes.length === 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'That Drive file appears to be empty.');
  }
  if (bytes.length > FOUNDATION_REPORT_MAX_UPLOAD_BYTES_) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT',
      'That file is larger than the ' + (FOUNDATION_REPORT_MAX_UPLOAD_BYTES_ / (1024 * 1024)) + ' MB limit.');
  }
  var detectedMimeType = foundationDetectActualMimeType_(bytes);
  if (!foundationIsAllowedReportMimeType_(detectedMimeType)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'That file type is not supported. Please attach a PDF, JPG, or PNG.');
  }

  return withFoundationErrorHandling_(function () {
    var recordId = generateFoundationId_();
    var record = foundationBuildReportRecord_(input, recordId, foundationNowIso_(), input.drive_file_id.trim(), detectedMimeType, bytes.length);
    foundationDsInsert_(FOUNDATION_REPORTS_SHEET_, FOUNDATION_REPORTS_COLUMNS_, record);
    foundationLogAuditEvent_('report_uploaded', record.patient_id, record.uploaded_by, 'record_id=' + recordId + ';size_bytes=' + bytes.length + ';mime_type=' + detectedMimeType + ';source=staff_wrapper');
    return record;
  });
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below and after uploading the source file to Drive
 * directly (outside this application). Not a Web App endpoint, not a
 * Sheet menu — see this file's own header comment for why a staff Web
 * App upload route is deliberately out of this batch's scope.
 */
function createFoundationReportForExistingDriveFile() {
  var result = foundationCreateReportForExistingDriveFile_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    drive_file_id: 'EDIT ME BEFORE RUNNING', // an existing Drive file's ID, already uploaded to Drive by staff
    file_name: 'EDIT ME BEFORE RUNNING', // display name shown to the patient
    uploaded_by: 'EDIT ME BEFORE RUNNING' // a staff identifier, e.g. 'staff:dr-sharma'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
