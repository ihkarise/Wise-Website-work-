/**
 * Holoscan Recognition — Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md
 * §6/§7/§8/§9/§10/§11.1/§11.2/§17, ADR-024/025/026, docs/53-PHASE-3-IMPLEMENTATION-
 * RULES.md governs this batch). Implements shared/schemas/holoscan-recognition.schema.json
 * and shared/schemas/holoscan-recognition-item.schema.json version 1.0.0 — the entities
 * backing the patient-writable `submit_holoscan_recognition`, the patient-readable
 * `get_holoscan_recognitions`, the doctor-readable `get_holoscan_review_queue`, and the
 * doctor-writable, audit-only `post_holoscan_recognition_decision`.
 *
 * Orchestrates docs/56 §6-§9's full capture pipeline for `submit_holoscan_recognition`:
 * image upload (reuses FoundationReports.gs's own content-based MIME detection and
 * private-Drive-sharing enforcement, never a new file-handling mechanism) -> per-patient,
 * per-UTC-day rate limit -> one HoloscanRecognition row (status: uploaded) -> one bounded
 * vision-model call (reuses Ai.gs's/AIAssistantInteraction.gs's own
 * UrlFetchApp/OPENROUTER_API_KEY pattern, extended to multimodal input) ->
 * HoloscanRecognitionCheck_() (HoloscanRecognitionCheck.gs) applied to every extracted
 * candidate -> zero or more HoloscanRecognitionItem rows written (doctor_decision always
 * 'pending') -> HoloscanRecognition.status -> 'completed' | 'failed'. This freeze names a
 * bounded, observable status transition as the requirement without locking down whether
 * it happens synchronously or via a trigger (docs/56 §6 item 5); this batch's own
 * disclosed implementation-time decision is synchronous, within the same request, the
 * identical choice AIAssistantInteraction.gs already made for its own model call.
 *
 * `post_holoscan_recognition_decision` only ever patches the one HoloscanRecognitionItem
 * row it is given, transitioning doctor_decision away from 'pending' exactly once
 * (ADR-025's central guarantee) — it never calls any other entity's write function,
 * enforced at the code level by validation/static-analysis/analyze.js's Holoscan static
 * rule 1 (docs/56 §23 item 1). Creating a MedicationHistory row from an approved item is
 * the doctor's own, separate action (MedicationHistory.gs's create_medication_history_entry)
 * — this file never calls it.
 *
 * ---- Why this file defines its own local Holoscan config, never reading Config.gs ----
 * Mirrors AIAssistantInteraction.gs's own disclosed reasoning exactly: a local,
 * independent FOUNDATION_HOLOSCAN_MODEL_CONFIG_ object, never a read of Phase 1.5's own
 * Config.gs (frozen except for genuine bug fixes). The OPENROUTER_API_KEY Script Property
 * itself is genuinely reused (docs/56 §7.3/§14) — reading a shared runtime secret is not
 * the same as depending on a frozen file's own code or constants.
 *
 * ---- Image storage: reuses Report's file-handling mechanism, never a new one ----
 * Calls FoundationReports.gs's own foundationDetectActualMimeType_()/
 * foundationEnsureReportFilePrivate_() directly (docs/56 §6/§14: "no new file-handling
 * pattern invented for Holoscan specifically") against a dedicated, private Drive folder
 * (FOUNDATION_HOLOSCAN_DRIVE_FOLDER_ID_, a placeholder exactly like
 * FOUNDATION_REPORTS_DRIVE_FOLDER_ID_'s own precedent) — a separate folder from Reports',
 * since Holoscan images are a distinct capture type, never patient-partitioned, mirroring
 * docs/42 §5's discipline. Only JPEG/PNG are accepted (medicine photographs, never a PDF)
 * — a disclosed narrowing of Report's own three-type allow-list to the two that apply
 * here.
 *
 * ---- Rate limiting (docs/56 §6/§14) ----
 * A per-patient, per-UTC-day submission ceiling, implemented via CacheService +
 * LockService, mirroring AIAssistantInteraction.gs's own per-doctor rate limiter exactly
 * (docs/56 §6 item 6/§14's named requirement, exact mechanism left as an implementation-
 * time decision) — the same disclosed, not-yet-tuned budget discipline, fails open on a
 * CacheService error, this layer is a supplementary cost-control mechanic, not Holoscan's
 * actual security boundary (fail-closed enablement, roster/patient-session scoping remain
 * the real boundaries).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/
 * PXP-1..11/WPI-1..10 file, and zero modification to Phase 1.5's Config.gs/Ai.gs — reuses
 * FoundationDataStore.gs's/FoundationAudit.gs's existing generic operations,
 * FoundationReports.gs's existing foundationDetectActualMimeType_()/
 * foundationEnsureReportFilePrivate_()/foundationGetFileExtension_(), and
 * DoctorPatientRoster.gs's existing foundationGetDoctorPatientRoster_() exactly as each
 * was already designed to be reused (ADR-009).
 *
 * Depends on HoloscanRecognitionCheck.gs, FoundationReports.gs, DoctorPatientRoster.gs,
 * FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs.
 */

var FOUNDATION_HOLOSCAN_RECOGNITIONS_SHEET_ = 'HoloscanRecognitions';
var FOUNDATION_HOLOSCAN_RECOGNITIONS_COLUMNS_ = [
  'recognition_id', 'patient_id', 'image_refs', 'status', 'model', 'prompt_template_version',
  'submitted_at', 'processed_at', 'error_log'
];

var FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_ = 'HoloscanRecognitionItems';
var FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_COLUMNS_ = [
  'recognition_item_id', 'recognition_id', 'patient_id', 'source_image_ref', 'extracted_name',
  'extracted_strength', 'extracted_dosage_form', 'extracted_manufacturer', 'extracted_batch',
  'extracted_expiry', 'confidence_score', 'check_flags', 'catalog_match_status',
  'catalog_match_ref', 'doctor_decision', 'corrected_fields', 'decision_notes', 'decided_by',
  'decided_at', 'created_at'
];

var FOUNDATION_HOLOSCAN_DECIDABLE_STATUSES_ = ['approved', 'corrected_and_approved', 'rejected'];

// Placeholder — replace with the real, provisioned Holoscan Drive folder ID (test tier
// first, mirroring FOUNDATION_REPORTS_DRIVE_FOLDER_ID_'s own precedent exactly). A
// separate, dedicated folder from Reports' own — Holoscan images are a distinct capture
// type (docs/56 §6/§14).
var FOUNDATION_HOLOSCAN_DRIVE_FOLDER_ID_ = 'REPLACE_WITH_HOLOSCAN_DRIVE_FOLDER_ID';

// Medicine photographs only — never a PDF, a disclosed narrowing of Report's own
// three-type allow-list to the two that apply to a photographed medicine package.
var FOUNDATION_HOLOSCAN_ALLOWED_MIME_TYPES_ = ['image/jpeg', 'image/png'];

// Mirrors FOUNDATION_REPORT_MAX_UPLOAD_BYTES_'s own value — no stricter or looser ceiling
// invented for a second file-upload feature (docs/56 §20's "no weaker validation").
var FOUNDATION_HOLOSCAN_MAX_UPLOAD_BYTES_ = 5242880;

// A local, decoupled mirror of Config.gs's CONFIG.AI shape — see this file's own header
// comment for why this batch never reads that frozen Phase 1.5 file directly. The
// specific vision-capable model is this batch's own disclosed implementation-time choice
// (docs/56 §7.3 leaves it open) — the same model AI Assistant already uses, since it is
// this platform's only OpenRouter model choice evaluated so far.
var FOUNDATION_HOLOSCAN_MODEL_CONFIG_ = {
  OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MODEL: 'anthropic/claude-haiku-4.5',
  TEMPERATURE: 0,
  MAX_OUTPUT_TOKENS: 800
};

var FOUNDATION_HOLOSCAN_PROMPT_VERSION_ = '1.0';

// Implements apps-script/HOLOSCAN-PROMPTS.md's "Recognition Prompt" section exactly — if
// the two ever disagree, that document wins and this constant should be corrected to
// match it, per that document's own closing rule.
var FOUNDATION_HOLOSCAN_SYSTEM_PROMPT_ = 'You are a strict, deterministic packaging-text ' +
  'extraction tool with no clinical judgment of your own. You will be given one or more ' +
  'photographs of medicine packaging.\n\n' +
  'Your ONLY task: report, for each distinct medicine package shown, whatever text is ' +
  'literally visible on that packaging — name, strength, dosage form, manufacturer, ' +
  'batch, and expiry date. Each field is independently optional — if a field is not ' +
  'legible or not present, omit it. Never guess or infer a field you cannot actually ' +
  'read.\n\n' +
  'Hard rules — breaking any of these is a failure:\n' +
  '1. Never state what a recognized medicine is used for, treats, or is indicated for.\n' +
  '2. Never state a dosage, administration, or schedule instruction beyond text printed ' +
  'on the packaging itself.\n' +
  '3. Never state a drug-interaction claim of any kind.\n' +
  '4. Never state a diagnosis, prognosis, or treatment recommendation.\n' +
  '5. Output format: a JSON array only, one object per distinct medicine package, each ' +
  'with optional string fields name/strength/dosage_form/manufacturer/batch/expiry and a ' +
  'numeric confidence field (0.0-1.0) reflecting your own extraction confidence only. No ' +
  'markdown, no prose, no explanation outside the JSON array.\n\n' +
  'You are a transcription layer, not a medical assistant. Report only what the ' +
  'packaging literally says.';

// A deliberately small, not-yet-tuned budget, mirroring
// FOUNDATION_AI_ASSISTANT_RATE_LIMIT_MAX_PER_DAY_'s own disclaimer exactly.
var FOUNDATION_HOLOSCAN_RATE_LIMIT_MAX_PER_DAY_ = 10;
var FOUNDATION_HOLOSCAN_RATE_LIMIT_LOCK_TIMEOUT_MS_ = 5000;

var FOUNDATION_HOLOSCAN_MAX_ENTRIES_ = 50;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * submit_holoscan_recognition request's own shape. Each image's own content-based
 * validation happens in foundationCreateHoloscanRecognition_() itself, since that
 * requires decoding real bytes.
 */
function foundationValidateSubmitHoloscanRecognitionInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || !Array.isArray(input.images) || input.images.length === 0) {
    errors.push('At least one image is required.');
  } else {
    input.images.forEach(function (image, i) {
      if (!image || typeof image.file_name !== 'string' || image.file_name.trim() === '') {
        errors.push('images[' + i + '].file_name is required.');
      }
      if (!image || typeof image.mime_type !== 'string' || image.mime_type.trim() === '') {
        errors.push('images[' + i + '].mime_type is required.');
      }
      if (!image || typeof image.file_base64 !== 'string' || image.file_base64.trim() === '') {
        errors.push('images[' + i + '].file_base64 is required.');
      }
    });
  }
  return errors;
}

/**
 * Converts one HoloscanRecognition Sheet row (image_refs still a JSON string) into this
 * entity's real, contractual API shape — mirrors
 * foundationAiAssistantInteractionRowToApiShape_()'s own fail-soft degrade-to-empty
 * discipline for a malformed stored string (should never happen in practice).
 */
function foundationHoloscanRecognitionRowToApiShape_(row) {
  var parsedImageRefs;
  try {
    parsedImageRefs = JSON.parse(row.image_refs || '[]');
  } catch (err) {
    parsedImageRefs = [];
  }
  return {
    recognition_id: row.recognition_id,
    patient_id: row.patient_id,
    image_refs: parsedImageRefs,
    status: row.status,
    model: row.model,
    prompt_template_version: row.prompt_template_version,
    submitted_at: row.submitted_at,
    processed_at: row.processed_at,
    error_log: row.error_log
  };
}

/**
 * Converts one HoloscanRecognitionItem Sheet row (check_flags/corrected_fields still JSON
 * strings) into this entity's real, contractual API shape.
 */
function foundationHoloscanRecognitionItemRowToApiShape_(row) {
  var parsedFlags;
  try {
    parsedFlags = JSON.parse(row.check_flags || '[]');
  } catch (err) {
    parsedFlags = [];
  }
  var parsedCorrectedFields;
  try {
    parsedCorrectedFields = JSON.parse(row.corrected_fields || '{}');
  } catch (err) {
    parsedCorrectedFields = {};
  }
  return {
    recognition_item_id: row.recognition_item_id,
    recognition_id: row.recognition_id,
    patient_id: row.patient_id,
    source_image_ref: row.source_image_ref,
    extracted_name: row.extracted_name,
    extracted_strength: row.extracted_strength,
    extracted_dosage_form: row.extracted_dosage_form,
    extracted_manufacturer: row.extracted_manufacturer,
    extracted_batch: row.extracted_batch,
    extracted_expiry: row.extracted_expiry,
    confidence_score: row.confidence_score,
    check_flags: parsedFlags,
    catalog_match_status: row.catalog_match_status,
    catalog_match_ref: row.catalog_match_ref,
    doctor_decision: row.doctor_decision,
    corrected_fields: parsedCorrectedFields,
    decision_notes: row.decision_notes,
    decided_by: row.decided_by,
    decided_at: row.decided_at,
    created_at: row.created_at
  };
}

// ---- Rate limiting (CacheService + LockService — mirrors AIAssistantInteraction.gs exactly) ----

function foundationHoloscanRateLimitCacheKey_(patientId) {
  var utcDate = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', UTC
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, patientId + '::' + utcDate);
  var hex = digestBytes.map(function (b) {
    var unsigned = b < 0 ? b + 256 : b;
    var hexStr = unsigned.toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  }).join('');
  return 'foundation_holoscan_rl_' + hex;
}

/**
 * Returns true and increments the counter if patientId is still within today's (UTC)
 * submission budget; returns false once the budget is spent. Mirrors
 * foundationCheckAndIncrementAiAssistantRateLimit_() exactly, including its TTL clamp
 * (foundationSecondsUntilUtcMidnight_(), FOUNDATION_CACHE_SERVICE_MAX_TTL_SECONDS_ —
 * both already declared by AIAssistantInteraction.gs, reused here directly rather than
 * re-declared) and its fail-open discipline on a CacheService error or an unavailable
 * lock.
 */
function foundationCheckAndIncrementHoloscanRateLimit_(patientId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(FOUNDATION_HOLOSCAN_RATE_LIMIT_LOCK_TIMEOUT_MS_)) {
    Logger.log('HoloscanRecognition: rate-limit lock unavailable, failing open.');
    return true;
  }
  try {
    var cache = CacheService.getScriptCache();
    var key = foundationHoloscanRateLimitCacheKey_(patientId);
    var current = parseInt(cache.get(key), 10);
    if (isNaN(current)) current = 0;
    if (current >= FOUNDATION_HOLOSCAN_RATE_LIMIT_MAX_PER_DAY_) {
      return false;
    }
    var ttlSeconds = Math.min(FOUNDATION_CACHE_SERVICE_MAX_TTL_SECONDS_, foundationSecondsUntilUtcMidnight_());
    cache.put(key, String(current + 1), ttlSeconds);
    return true;
  } catch (err) {
    Logger.log('HoloscanRecognition: CacheService error, failing open: ' + (err && err.message ? err.message : err));
    return true;
  } finally {
    lock.releaseLock();
  }
}

// ---- Model call (reuses Ai.gs's/AIAssistantInteraction.gs's own UrlFetchApp/OPENROUTER_API_KEY pattern) ----

/**
 * Calls OpenRouter with the recognition system prompt and the uploaded image(s) as
 * multimodal user content. Mirrors callOpenRouterForAiAssistant_() exactly, extended to
 * image content blocks (docs/56 §7.3). Throws on any failure — the caller catches and
 * translates to HoloscanRecognition.status: 'failed'.
 */
function callOpenRouterForHoloscan_(images) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in Script Properties.');
  }
  var imageContentBlocks = images.map(function (image) {
    return {
      type: 'image_url',
      image_url: { url: 'data:' + image.mimeType + ';base64,' + image.base64 }
    };
  });
  var response = UrlFetchApp.fetch(FOUNDATION_HOLOSCAN_MODEL_CONFIG_.OPENROUTER_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: FOUNDATION_HOLOSCAN_MODEL_CONFIG_.MODEL,
      temperature: FOUNDATION_HOLOSCAN_MODEL_CONFIG_.TEMPERATURE,
      max_tokens: FOUNDATION_HOLOSCAN_MODEL_CONFIG_.MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: FOUNDATION_HOLOSCAN_SYSTEM_PROMPT_ },
        { role: 'user', content: [{ type: 'text', text: 'Extract every distinct medicine package visible in the attached image(s).' }].concat(imageContentBlocks) }
      ]
    })
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('OpenRouter request failed (HTTP ' + code + '): ' + response.getContentText());
  }
  var body = JSON.parse(response.getContentText());
  var content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenRouter response did not contain recognition output.');
  }
  return content.trim();
}

/**
 * Deterministic field parsing (docs/56 §7.4) — a pure mapping from the model's declared
 * JSON array shape to a list of candidate field objects. Never infers a field the model
 * did not report; throws (treated by the caller as a pipeline failure) if the model's
 * output is not a well-formed JSON array.
 */
function foundationParseHoloscanCandidates_(rawOutput) {
  var parsed = JSON.parse(rawOutput);
  if (!Array.isArray(parsed)) {
    throw new Error('Recognition output was not a JSON array of candidates.');
  }
  return parsed.map(function (candidate) {
    return {
      name: typeof candidate.name === 'string' ? candidate.name : '',
      strength: typeof candidate.strength === 'string' ? candidate.strength : '',
      dosage_form: typeof candidate.dosage_form === 'string' ? candidate.dosage_form : '',
      manufacturer: typeof candidate.manufacturer === 'string' ? candidate.manufacturer : '',
      batch: typeof candidate.batch === 'string' ? candidate.batch : '',
      expiry: typeof candidate.expiry === 'string' ? candidate.expiry : '',
      confidence: typeof candidate.confidence === 'number' && isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence)) : 0
    };
  });
}

// ---- Sheets/Drive-backed operations ----

/**
 * Runs the full submit_holoscan_recognition pipeline (this file's own header comment) and
 * writes one HoloscanRecognition row plus zero or more HoloscanRecognitionItem rows.
 * input.patient_id must already be PatientSession-derived by the caller (ADR-002) — this
 * function never re-derives it. Rejects (FOUNDATION_INVALID_INPUT) a malformed request
 * shape or any image failing content-based type/size validation before any Drive write or
 * model call happens; rejects (FOUNDATION_HOLOSCAN_RATE_LIMITED) a caller who has
 * exhausted today's submission budget. A genuine model-call or parsing failure still
 * writes the HoloscanRecognition row (status: 'failed', error_log populated) rather than
 * silently discarding the patient's own upload — the images are already safely stored in
 * Drive by that point.
 */
function foundationCreateHoloscanRecognition_(input) {
  var errors = foundationValidateSubmitHoloscanRecognitionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var patientId = input.patient_id.trim();

  if (!foundationCheckAndIncrementHoloscanRateLimit_(patientId)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_HOLOSCAN_RATE_LIMITED', 'You have reached today\'s Holoscan submission limit. Please try again tomorrow.');
  }

  // ---- Decode + validate every image's real, decoded bytes before any Drive write ----
  var decodedImages = [];
  for (var i = 0; i < input.images.length; i++) {
    var image = input.images[i];
    var bytes;
    try {
      bytes = Utilities.base64Decode(image.file_base64);
    } catch (err) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'One of your images could not be read. Please try uploading it again.');
    }
    if (!bytes || bytes.length === 0) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'One of your images appears to be empty.');
    }
    if (bytes.length > FOUNDATION_HOLOSCAN_MAX_UPLOAD_BYTES_) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT',
        'One of your images is larger than the ' + (FOUNDATION_HOLOSCAN_MAX_UPLOAD_BYTES_ / (1024 * 1024)) + ' MB limit.');
    }
    // The real, content-based type check — reuses FoundationReports.gs's own detection
    // function directly (this file's own header comment), never a re-implementation.
    var detectedMimeType = foundationDetectActualMimeType_(bytes);
    if (FOUNDATION_HOLOSCAN_ALLOWED_MIME_TYPES_.indexOf(detectedMimeType) === -1) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'That file type is not supported. Please upload a JPG or PNG photo.');
    }
    decodedImages.push({ bytes: bytes, mimeType: detectedMimeType });
  }

  return withFoundationErrorHandling_(function () {
    var recognitionId = generateFoundationId_();
    var nowIso = foundationNowIso_();
    var folder = DriveApp.getFolderById(FOUNDATION_HOLOSCAN_DRIVE_FOLDER_ID_);
    var imageRefs = decodedImages.map(function (decoded) {
      var driveObjectName = recognitionId + '-' + generateFoundationId_() + foundationExtensionForMimeType_(decoded.mimeType);
      var blob = Utilities.newBlob(decoded.bytes, decoded.mimeType, driveObjectName);
      var driveFile = folder.createFile(blob);
      // Enforced, not assumed — reuses Report's own private-sharing enforcement function
      // directly (docs/56 §14, this file's own header comment).
      foundationEnsureReportFilePrivate_(driveFile);
      return { drive_file_id: driveFile.getId(), mime_type: decoded.mimeType, size_bytes: decoded.bytes.length };
    });

    var recognitionRow = {
      recognition_id: recognitionId,
      patient_id: patientId,
      image_refs: JSON.stringify(imageRefs),
      status: 'processing',
      model: '',
      prompt_template_version: '',
      submitted_at: nowIso,
      processed_at: '',
      error_log: ''
    };
    foundationDsInsert_(FOUNDATION_HOLOSCAN_RECOGNITIONS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITIONS_COLUMNS_, recognitionRow);
    foundationLogAuditEvent_('holoscan_recognition_submitted', patientId, patientId, 'recognition_id=' + recognitionId + ';image_count=' + imageRefs.length);

    var itemRows = [];
    try {
      var rawOutput = callOpenRouterForHoloscan_(decodedImages.map(function (decoded) {
        return { mimeType: decoded.mimeType, base64: Utilities.base64Encode(decoded.bytes) };
      }));
      var candidates = foundationParseHoloscanCandidates_(rawOutput);
      var itemsNowIso = foundationNowIso_();
      candidates.forEach(function (candidate) {
        var checkFlags = HoloscanRecognitionCheck_(candidate);
        var itemRow = {
          recognition_item_id: generateFoundationId_(),
          recognition_id: recognitionId,
          patient_id: patientId,
          source_image_ref: imageRefs.length === 1 ? imageRefs[0].drive_file_id : '',
          extracted_name: candidate.name,
          extracted_strength: candidate.strength,
          extracted_dosage_form: candidate.dosage_form,
          extracted_manufacturer: candidate.manufacturer,
          extracted_batch: candidate.batch,
          extracted_expiry: candidate.expiry,
          confidence_score: candidate.confidence,
          check_flags: JSON.stringify(checkFlags),
          catalog_match_status: '',
          catalog_match_ref: '',
          doctor_decision: 'pending',
          corrected_fields: JSON.stringify({}),
          decision_notes: '',
          decided_by: '',
          decided_at: '',
          created_at: itemsNowIso
        };
        foundationDsInsert_(FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_COLUMNS_, itemRow);
        itemRows.push(itemRow);
      });

      recognitionRow.status = 'completed';
      recognitionRow.model = FOUNDATION_HOLOSCAN_MODEL_CONFIG_.MODEL;
      recognitionRow.prompt_template_version = FOUNDATION_HOLOSCAN_PROMPT_VERSION_;
      recognitionRow.processed_at = foundationNowIso_();
      foundationDsUpdateById_(FOUNDATION_HOLOSCAN_RECOGNITIONS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITIONS_COLUMNS_, 'recognition_id', recognitionId, {
        status: recognitionRow.status, model: recognitionRow.model,
        prompt_template_version: recognitionRow.prompt_template_version, processed_at: recognitionRow.processed_at
      });
      foundationLogAuditEvent_('holoscan_recognition_completed', patientId, patientId, 'recognition_id=' + recognitionId + ';item_count=' + itemRows.length);
    } catch (pipelineErr) {
      recognitionRow.status = 'failed';
      recognitionRow.processed_at = foundationNowIso_();
      recognitionRow.error_log = (pipelineErr && pipelineErr.message) ? pipelineErr.message : 'Recognition pipeline failed.';
      foundationDsUpdateById_(FOUNDATION_HOLOSCAN_RECOGNITIONS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITIONS_COLUMNS_, 'recognition_id', recognitionId, {
        status: recognitionRow.status, processed_at: recognitionRow.processed_at, error_log: recognitionRow.error_log
      });
      foundationLogAuditEvent_('holoscan_recognition_failed', patientId, patientId, 'recognition_id=' + recognitionId + ';reason=' + recognitionRow.error_log);
    }

    var apiRecognition = foundationHoloscanRecognitionRowToApiShape_(recognitionRow);
    apiRecognition.items = itemRows.map(foundationHoloscanRecognitionItemRowToApiShape_);
    return apiRecognition;
  });
}

/**
 * Returns patientId's own HoloscanRecognition history, newest-first, capped at
 * FOUNDATION_HOLOSCAN_MAX_ENTRIES_, each enriched with its own item drafts (docs/56 §17's
 * "caller's own recognition history + item drafts"). patientId must already be
 * PatientSession-verified by the caller — this function never re-derives it.
 */
function foundationGetPatientHoloscanRecognitions_(patientId) {
  return withFoundationErrorHandling_(function () {
    var recognitionRows = foundationDsQuery_(FOUNDATION_HOLOSCAN_RECOGNITIONS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITIONS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    recognitionRows.sort(function (a, b) {
      if (a.submitted_at !== b.submitted_at) return a.submitted_at < b.submitted_at ? 1 : -1;
      return 0;
    });
    var capped = recognitionRows.slice(0, FOUNDATION_HOLOSCAN_MAX_ENTRIES_);
    var itemRows = foundationDsQuery_(FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    return capped.map(function (recognitionRow) {
      var api = foundationHoloscanRecognitionRowToApiShape_(recognitionRow);
      api.items = itemRows
        .filter(function (itemRow) { return itemRow.recognition_id === recognitionRow.recognition_id; })
        .map(foundationHoloscanRecognitionItemRowToApiShape_);
      return api;
    });
  });
}

/**
 * Returns doctorId's own Holoscan review queue: every 'pending' HoloscanRecognitionItem
 * across the doctor's own derived roster (DoctorPatientRoster.gs's
 * foundationGetDoctorPatientRoster_(), reused, never re-derived). doctorId must already be
 * DoctorSession-verified by the caller.
 */
function foundationGetHoloscanReviewQueueForDoctor_(doctorId) {
  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup; // unexpected failure — already a safe, generic envelope
  }
  return withFoundationErrorHandling_(function () {
    var rosterPatientIds = rosterLookup.data.map(function (entry) { return entry.patient_id; });
    var pendingRows = foundationDsQuery_(FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_COLUMNS_, function (row) {
      return row.doctor_decision === 'pending' && rosterPatientIds.indexOf(row.patient_id) !== -1;
    });
    pendingRows.sort(function (a, b) {
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
      return 0;
    });
    return pendingRows.map(foundationHoloscanRecognitionItemRowToApiShape_);
  });
}

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * post_holoscan_recognition_decision request's own shape.
 */
function foundationValidatePostHoloscanRecognitionDecisionInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.recognition_item_id !== 'string' || input.recognition_item_id.trim() === '') {
    errors.push('recognition_item_id is required.');
  }
  if (!input || typeof input.doctor_decision !== 'string' || FOUNDATION_HOLOSCAN_DECIDABLE_STATUSES_.indexOf(input.doctor_decision) === -1) {
    errors.push('doctor_decision must be one of: approved, corrected_and_approved, rejected.');
  }
  if (input && input.doctor_decision === 'corrected_and_approved' && (!input.corrected_fields || typeof input.corrected_fields !== 'object')) {
    errors.push('corrected_fields is required when doctor_decision is corrected_and_approved.');
  }
  return errors;
}

/**
 * Records the caller doctor's one-way decision on a HoloscanRecognitionItem row they have
 * roster access to. input.doctor_id must already be DoctorSession-derived by the caller.
 * Rejects (FOUNDATION_INVALID_INPUT) an unknown recognition_item_id, one no longer
 * 'pending', or one for a patient outside the caller's own derived roster — the same
 * generic "not found or not yours" outcome every other Foundation entity's ownership
 * check already uses, never distinguishing which. Never writes to MedicationHistory or
 * MedicationDecision (ADR-025's central guarantee) — this function's only write target is
 * FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_.
 */
function foundationRecordHoloscanRecognitionDecision_(input) {
  var errors = foundationValidatePostHoloscanRecognitionDecisionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var recognitionItemId = input.recognition_item_id.trim();

  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_COLUMNS_, 'recognition_item_id', recognitionItemId);
  });
  if (lookup.status === 'error') {
    return lookup;
  }
  var existing = lookup.data;
  if (!existing || existing.doctor_decision !== 'pending') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'recognition_item_id must reference a still-pending Holoscan recognition item.');
  }

  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === existing.patient_id; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'recognition_item_id must reference a patient on your own roster.');
  }

  return withFoundationErrorHandling_(function () {
    var patch = {
      doctor_decision: input.doctor_decision,
      corrected_fields: JSON.stringify(input.doctor_decision === 'corrected_and_approved' ? input.corrected_fields : {}),
      decision_notes: (input.decision_notes || '').toString().trim(),
      decided_by: doctorId,
      decided_at: foundationNowIso_()
    };
    foundationDsUpdateById_(FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_COLUMNS_, 'recognition_item_id', recognitionItemId, patch);
    foundationLogAuditEvent_('holoscan_recognition_decision_recorded', existing.patient_id, doctorId, 'recognition_item_id=' + recognitionItemId + ';doctor_decision=' + input.doctor_decision);
    Object.keys(patch).forEach(function (key) { existing[key] = patch[key]; });
    return foundationHoloscanRecognitionItemRowToApiShape_(existing);
  });
}
