/**
 * Medication History — Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md
 * §10.3/§10.4/§11.3/§11.4/§17, ADR-024/025/026, docs/53-PHASE-3-IMPLEMENTATION-RULES.md
 * governs this batch). Implements shared/schemas/medication-history.schema.json and
 * shared/schemas/medication-decision.schema.json version 1.0.0 — the permanent,
 * doctor-authored medication record and its own append-only clinical-status ledger.
 *
 * `create_medication_history_entry` is the doctor's own, separate, deliberate write
 * action (ADR-025's central guarantee) — it may use an approved HoloscanRecognitionItem's
 * fields as pre-fill only; it never itself is called by HoloscanRecognition.gs, and
 * HoloscanRecognition.gs is never called by this file, keeping the two write paths
 * structurally distinct, enforced at the code level by
 * validation/static-analysis/analyze.js's Holoscan static rule 1 (docs/56 §23 item 1).
 *
 * `MedicationHistory.current_status` is never client-supplied — it is recomputed from
 * the latest MedicationDecision row every time `record_medication_decision` runs,
 * mirroring InventoryItem.quantity_on_hand's/InventoryTransaction.gs's own
 * recompute-from-ledger, LockService-protected discipline exactly (WPI-7, docs/54
 * §7/§13/§19) — the platform's second use of this exact pattern (its first use of
 * LockService for a second, independent entity).
 *
 * `get_medication_history` is this batch's one dual-guarded route (docs/56 §17): reachable
 * via either a verified DoctorSession (roster-scoped, any patient on the caller's own
 * roster) or a verified PatientSession (own record only, patient_id always session-derived,
 * any client-supplied patient_id ignored) — FoundationRouter.gs's own handler resolves
 * which session type presented the token and calls this file's own
 * foundationGetMedicationHistoryDualGuarded_() accordingly; this file never re-derives or
 * re-verifies a session token itself.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/
 * PXP-1..11/WPI-1..10 file, and zero modification to HoloscanRecognition.gs itself —
 * reuses FoundationDataStore.gs's/FoundationAudit.gs's existing generic operations and
 * DoctorPatientRoster.gs's existing foundationGetDoctorPatientRoster_() exactly as each
 * was already designed to be reused (ADR-009).
 *
 * Depends on DoctorPatientRoster.gs, FoundationDataStore.gs, FoundationAudit.gs,
 * FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs,
 * FoundationSession.gs (get_medication_history's own dual-guard resolution),
 * DoctorSession.gs.
 */

var FOUNDATION_MEDICATION_HISTORY_SHEET_ = 'MedicationHistory';
var FOUNDATION_MEDICATION_HISTORY_COLUMNS_ = [
  'medication_history_id', 'patient_id', 'medicine_name', 'strength', 'dosage_form',
  'manufacturer', 'source_type', 'source_recognition_item_id', 'current_status',
  'created_at', 'created_by'
];

var FOUNDATION_MEDICATION_DECISIONS_SHEET_ = 'MedicationDecisions';
var FOUNDATION_MEDICATION_DECISIONS_COLUMNS_ = [
  'decision_id', 'medication_history_id', 'patient_id', 'decision_type',
  'replacement_medication_history_id', 'notes', 'decided_by', 'decided_at'
];

var FOUNDATION_MEDICATION_DECISION_TYPES_ = ['continue', 'stop', 'replace', 'unknown'];

// Mirrors FOUNDATION_INVENTORY_LOCK_TIMEOUT_MS_'s own value and reasoning exactly —
// generous enough for this batch's own low-frequency, pilot-scale write volume.
var FOUNDATION_MEDICATION_DECISION_LOCK_TIMEOUT_MS_ = 5000;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * create_medication_history_entry request's own shape. Whether source_recognition_item_id
 * (when supplied) is approved/corrected_and_approved and within the caller's own roster
 * is checked by foundationCreateMedicationHistoryEntry_() itself, since that requires a
 * Sheets read.
 */
function foundationValidateCreateMedicationHistoryEntryInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.medicine_name !== 'string' || input.medicine_name.trim() === '') {
    errors.push('medicine_name is required.');
  }
  if (input && input.source_recognition_item_id !== undefined && input.source_recognition_item_id !== null
    && input.source_recognition_item_id !== '' && typeof input.source_recognition_item_id !== 'string') {
    errors.push('source_recognition_item_id must be a string when provided.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * record_medication_decision request's own shape. Whether medication_history_id (and,
 * for 'replace', replacement_medication_history_id) resolves to a real, roster-accessible
 * row is checked by foundationRecordMedicationDecision_() itself.
 */
function foundationValidateRecordMedicationDecisionInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.medication_history_id !== 'string' || input.medication_history_id.trim() === '') {
    errors.push('medication_history_id is required.');
  }
  if (!input || FOUNDATION_MEDICATION_DECISION_TYPES_.indexOf(input.decision_type) === -1) {
    errors.push('decision_type must be one of: continue, stop, replace, unknown.');
  }
  if (input && input.decision_type === 'replace' && (typeof input.replacement_medication_history_id !== 'string' || input.replacement_medication_history_id.trim() === '')) {
    errors.push('replacement_medication_history_id is required when decision_type is replace.');
  }
  return errors;
}

function foundationMedicationHistoryRowToApiShape_(row) {
  return {
    medication_history_id: row.medication_history_id,
    patient_id: row.patient_id,
    medicine_name: row.medicine_name,
    strength: row.strength,
    dosage_form: row.dosage_form,
    manufacturer: row.manufacturer,
    source_type: row.source_type,
    source_recognition_item_id: row.source_recognition_item_id,
    current_status: row.current_status,
    created_at: row.created_at,
    created_by: row.created_by
  };
}

function foundationMedicationDecisionRowToApiShape_(row) {
  return {
    decision_id: row.decision_id,
    medication_history_id: row.medication_history_id,
    patient_id: row.patient_id,
    decision_type: row.decision_type,
    replacement_medication_history_id: row.replacement_medication_history_id,
    notes: row.notes,
    decided_by: row.decided_by,
    decided_at: row.decided_at
  };
}

/**
 * Derives MedicationHistory.current_status from `decisionRows` (every MedicationDecision
 * row for one medication_history_id) by decided_at — the latest row wins, mirroring
 * InventoryItem.quantity_on_hand's own "recompute in full from the ledger" discipline
 * exactly (never a cached-value-plus-delta update). Defaults to 'active' when no decision
 * row exists yet (docs/56 §11.3's own "no MedicationDecision row required to establish
 * that initial state").
 */
function foundationDeriveMedicationCurrentStatus_(decisionRows) {
  if (!decisionRows.length) return 'active';
  var latest = decisionRows.reduce(function (a, b) { return a.decided_at >= b.decided_at ? a : b; });
  if (latest.decision_type === 'continue') return 'active';
  if (latest.decision_type === 'stop') return 'stopped';
  if (latest.decision_type === 'replace') return 'replaced';
  return 'unknown';
}

// ---- Sheets-backed operations ----

/**
 * Creates a new MedicationHistory row — the doctor's own, separate, deliberate action
 * (ADR-025). input.doctor_id must already be DoctorSession-derived by the caller. Rejects
 * (FOUNDATION_INVALID_INPUT) a malformed request shape, a patient_id outside the caller's
 * own derived roster, or a source_recognition_item_id not in
 * approved/corrected_and_approved state or outside the caller's own roster (docs/56 §17).
 * current_status always starts 'active' — never accepted from `input`.
 */
function foundationCreateMedicationHistoryEntry_(input) {
  var errors = foundationValidateCreateMedicationHistoryEntryInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var patientId = input.patient_id.trim();

  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === patientId; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must belong to your own patient roster.');
  }

  var sourceRecognitionItemId = (input.source_recognition_item_id || '').toString().trim();
  if (sourceRecognitionItemId !== '') {
    var itemLookup = withFoundationErrorHandling_(function () {
      return foundationDsGetById_(FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_SHEET_, FOUNDATION_HOLOSCAN_RECOGNITION_ITEMS_COLUMNS_, 'recognition_item_id', sourceRecognitionItemId);
    });
    if (itemLookup.status === 'error') {
      return itemLookup;
    }
    var sourceItem = itemLookup.data;
    var itemDecidedOk = sourceItem && (sourceItem.doctor_decision === 'approved' || sourceItem.doctor_decision === 'corrected_and_approved');
    var itemOnRoster = sourceItem && sourceItem.patient_id === patientId;
    if (!itemDecidedOk || !itemOnRoster) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'source_recognition_item_id must reference an approved or corrected-and-approved recognition item for this same patient, on your own roster.');
    }
  }

  return withFoundationErrorHandling_(function () {
    var record = {
      medication_history_id: generateFoundationId_(),
      patient_id: patientId,
      medicine_name: input.medicine_name.trim(),
      strength: input.strength ? String(input.strength).trim() : '',
      dosage_form: input.dosage_form ? String(input.dosage_form).trim() : '',
      manufacturer: input.manufacturer ? String(input.manufacturer).trim() : '',
      source_type: sourceRecognitionItemId !== '' ? 'holoscan_recognition' : 'doctor_manual_entry',
      source_recognition_item_id: sourceRecognitionItemId,
      current_status: 'active',
      created_at: foundationNowIso_(),
      created_by: doctorId
    };
    foundationDsInsert_(FOUNDATION_MEDICATION_HISTORY_SHEET_, FOUNDATION_MEDICATION_HISTORY_COLUMNS_, record);
    foundationLogAuditEvent_('medication_history_entry_created', patientId, doctorId, 'medication_history_id=' + record.medication_history_id);
    return foundationMedicationHistoryRowToApiShape_(record);
  });
}

/**
 * Returns one patient's MedicationHistory rows plus each row's own MedicationDecision
 * ledger — the shape both the doctor- and patient-facing callers of
 * get_medication_history share (docs/56 §17). `patientId` must already be resolved by the
 * caller (roster-validated for a doctor caller, session-derived for a patient caller —
 * see foundationGetMedicationHistoryDualGuarded_() below).
 */
function foundationGetMedicationHistoryForPatient_(patientId) {
  return withFoundationErrorHandling_(function () {
    var historyRows = foundationDsQuery_(FOUNDATION_MEDICATION_HISTORY_SHEET_, FOUNDATION_MEDICATION_HISTORY_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    var decisionRows = foundationDsQuery_(FOUNDATION_MEDICATION_DECISIONS_SHEET_, FOUNDATION_MEDICATION_DECISIONS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    return historyRows.map(function (historyRow) {
      var api = foundationMedicationHistoryRowToApiShape_(historyRow);
      api.decisions = decisionRows
        .filter(function (d) { return d.medication_history_id === historyRow.medication_history_id; })
        .map(foundationMedicationDecisionRowToApiShape_);
      return api;
    });
  });
}

/**
 * get_medication_history's own dual-guard resolution (docs/56 §17) — tries a real,
 * verified DoctorSession first (roster-scoped, requestedPatientId required and validated
 * against the caller's own derived roster), then falls back to a real, verified
 * PatientSession (own record only, requestedPatientId ignored, patient_id always
 * session-derived). Rejects (FOUNDATION_UNAUTHORIZED) a token that verifies as neither.
 * Called directly by FoundationRouter.gs's own get_medication_history handler — this is
 * the one route on this platform reachable by either identity type (docs/56 §4/§17),
 * each receiving a different, independently-scoped slice of the same underlying data,
 * never a shared, unscoped result.
 */
function foundationGetMedicationHistoryDualGuarded_(sessionToken, requestedPatientId) {
  var doctorVerification = foundationVerifyDoctorSessionToken_(sessionToken);
  if (doctorVerification.valid) {
    var doctorId = doctorVerification.doctorId;
    var trimmedPatientId = (requestedPatientId || '').toString().trim();
    if (trimmedPatientId === '') {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id is required.');
    }
    var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
    if (rosterLookup.status === 'error') {
      return rosterLookup;
    }
    var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === trimmedPatientId; });
    if (!onRoster) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must belong to your own patient roster.');
    }
    return buildFoundationOkEnvelope_(foundationGetMedicationHistoryForPatient_(trimmedPatientId).data);
  }

  var patientVerification = foundationVerifySessionToken_(sessionToken);
  if (patientVerification.valid) {
    // Own record only — any client-supplied patient_id is ignored, the same
    // unconditional rule every patient-facing read route already enforces.
    return buildFoundationOkEnvelope_(foundationGetMedicationHistoryForPatient_(patientVerification.patientId).data);
  }

  foundationLogAuditEvent_('session_rejected', '', '', 'reason=get_medication_history_neither_identity_type');
  return buildFoundationErrorEnvelope_('FOUNDATION_UNAUTHORIZED', 'Please log in again.');
}

/**
 * Records a new MedicationDecision row against a MedicationHistory row the caller has
 * roster access to, then recomputes and caches that row's own current_status from the
 * full ledger — mirrors foundationRecordInventoryTransaction_()'s own
 * append-then-recompute-then-cache-write, LockService-protected sequence exactly
 * (docs/54 §7/§19, docs/56 §10.4). input.doctor_id must already be DoctorSession-derived
 * by the caller. Rejects (FOUNDATION_INVALID_INPUT) an unknown medication_history_id, one
 * outside the caller's own roster, or (for decision_type: 'replace') an unknown/
 * out-of-roster replacement_medication_history_id. If the lock cannot be acquired,
 * returns FOUNDATION_LOCK_UNAVAILABLE and performs no write at all.
 */
function foundationRecordMedicationDecision_(input) {
  var errors = foundationValidateRecordMedicationDecisionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var medicationHistoryId = input.medication_history_id.trim();

  var historyLookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_MEDICATION_HISTORY_SHEET_, FOUNDATION_MEDICATION_HISTORY_COLUMNS_, 'medication_history_id', medicationHistoryId);
  });
  if (historyLookup.status === 'error') {
    return historyLookup;
  }
  var historyRow = historyLookup.data;
  if (!historyRow) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'medication_history_id must reference an existing MedicationHistory row.');
  }
  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === historyRow.patient_id; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'medication_history_id must reference a patient on your own roster.');
  }

  var replacementId = (input.replacement_medication_history_id || '').toString().trim();
  if (input.decision_type === 'replace') {
    var replacementLookup = withFoundationErrorHandling_(function () {
      return foundationDsGetById_(FOUNDATION_MEDICATION_HISTORY_SHEET_, FOUNDATION_MEDICATION_HISTORY_COLUMNS_, 'medication_history_id', replacementId);
    });
    if (replacementLookup.status === 'error') {
      return replacementLookup;
    }
    var replacementRow = replacementLookup.data;
    if (!replacementRow || replacementRow.patient_id !== historyRow.patient_id || replacementId === medicationHistoryId) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'replacement_medication_history_id must reference a different, existing MedicationHistory row for the same patient.');
    }
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(FOUNDATION_MEDICATION_DECISION_LOCK_TIMEOUT_MS_)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_LOCK_UNAVAILABLE', 'Another medication update is in progress. Please try again.');
  }
  try {
    return withFoundationErrorHandling_(function () {
      var decisionRecord = {
        decision_id: generateFoundationId_(),
        medication_history_id: medicationHistoryId,
        patient_id: historyRow.patient_id,
        decision_type: input.decision_type,
        replacement_medication_history_id: input.decision_type === 'replace' ? replacementId : '',
        notes: (input.notes || '').toString().trim(),
        decided_by: doctorId,
        decided_at: foundationNowIso_()
      };
      foundationDsInsert_(FOUNDATION_MEDICATION_DECISIONS_SHEET_, FOUNDATION_MEDICATION_DECISIONS_COLUMNS_, decisionRecord);

      var allDecisionsForHistory = foundationDsQuery_(FOUNDATION_MEDICATION_DECISIONS_SHEET_, FOUNDATION_MEDICATION_DECISIONS_COLUMNS_, function (row) {
        return row.medication_history_id === medicationHistoryId;
      });
      var newStatus = foundationDeriveMedicationCurrentStatus_(allDecisionsForHistory);
      foundationDsUpdateById_(FOUNDATION_MEDICATION_HISTORY_SHEET_, FOUNDATION_MEDICATION_HISTORY_COLUMNS_, 'medication_history_id', medicationHistoryId, { current_status: newStatus });
      foundationLogAuditEvent_('medication_decision_recorded', historyRow.patient_id, doctorId, 'medication_history_id=' + medicationHistoryId + ';decision_type=' + input.decision_type + ';current_status=' + newStatus);

      return foundationMedicationDecisionRowToApiShape_(decisionRecord);
    });
  } finally {
    lock.releaseLock();
  }
}
