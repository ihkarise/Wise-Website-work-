/**
 * Notification — Batch WPI-6 (docs/50-PHASE-3-TECHNICAL-PLAN.md §9/§19;
 * docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every later WPI
 * batch). Implements shared/schemas/notification.schema.json version 1.0.0.
 * Promotes docs/33-DOMAIN-MODEL.md §4.2 from Designed to Implemented — a
 * shared *record* of what was sent, never a new delivery pipeline (docs/50
 * §9's own words). Every existing sender keeps its own transport code
 * entirely unchanged and additionally writes one Notification row.
 *
 * Not Foundation-prefixed, for the same reason Appointment.gs isn't (docs/29
 * §2): a concrete entity built on Foundation's frozen infrastructure, not
 * infrastructure itself.
 *
 * System-generated only, mirroring Session's own ownership model (docs/50
 * §9) — no human ever authors, edits, or deletes a row directly. No
 * manually-run Apps Script editor function exists for this entity (unlike
 * every doctor/staff-owned Phase 2B/WPI entity to date), and no
 * FoundationRouter.gs dispatch case ships in this batch — see
 * shared/schemas/notification.md's "No route in this batch" section for why
 * this mirrors Session rather than CalculatorResult.
 *
 * Three existing sender flows gain one additional, disclosed call each,
 * after their own existing send attempt completes (shared/schemas/
 * notification.md has the full disclosure):
 *   - apps-script/FoundationLoginFlow.gs (patient login-link)
 *   - apps-script/DoctorLoginFlow.gs (doctor login-link)
 *   - apps-script/Send.gs (Phase 1.5 visit-summary email)
 * None of the three files' own gate logic, transport mechanism, or existing
 * return values change.
 *
 * Depends on FoundationDataStore.gs, FoundationUtils.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs.
 */

var FOUNDATION_NOTIFICATIONS_SHEET_ = 'Notifications';
var FOUNDATION_NOTIFICATIONS_COLUMNS_ = ['notification_id', 'patient_id', 'doctor_id', 'recipient_email', 'channel', 'type', 'status', 'sent_at'];

var FOUNDATION_NOTIFICATION_CHANNELS_ = ['email'];
var FOUNDATION_NOTIFICATION_TYPES_ = ['login_link', 'visit_summary', 'appointment_reminder', 'inventory_low_stock', 'pillfill_order_status'];
var FOUNDATION_NOTIFICATION_STATUSES_ = ['sent', 'failed', 'read'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new Notification. Exactly one of patient_id/doctor_id/
 * recipient_email must be non-empty (every Notification has some subject
 * reference); patient_id and doctor_id are never both non-empty on the same
 * row (shared/schemas/notification.md's validation rule).
 */
function foundationValidateRecordNotificationInput_(input) {
  var errors = [];
  var patientId = (input && typeof input.patient_id === 'string') ? input.patient_id.trim() : '';
  var doctorId = (input && typeof input.doctor_id === 'string') ? input.doctor_id.trim() : '';
  var recipientEmail = (input && typeof input.recipient_email === 'string') ? input.recipient_email.trim() : '';

  if (patientId !== '' && doctorId !== '') {
    errors.push('patient_id and doctor_id may not both be non-empty on the same row.');
  }
  if (patientId === '' && doctorId === '' && recipientEmail === '') {
    errors.push('At least one of patient_id, doctor_id, or recipient_email is required.');
  }
  if (!input || FOUNDATION_NOTIFICATION_CHANNELS_.indexOf(input.channel) === -1) {
    errors.push('channel must be one of: ' + FOUNDATION_NOTIFICATION_CHANNELS_.join(', ') + '.');
  }
  if (!input || FOUNDATION_NOTIFICATION_TYPES_.indexOf(input.type) === -1) {
    errors.push('type must be one of: ' + FOUNDATION_NOTIFICATION_TYPES_.join(', ') + '.');
  }
  if (!input || (input.status !== 'sent' && input.status !== 'failed')) {
    errors.push('status must be one of: sent, failed.');
  }
  return errors;
}

/**
 * Builds a new Notification record (shared/schemas/notification.schema.json).
 * patient_id/doctor_id/recipient_email are each trimmed, empty-string
 * sentinels when not supplied. sent_at is always server-set.
 */
function foundationBuildNotificationRecord_(input, notificationId, nowIso) {
  return {
    notification_id: notificationId,
    patient_id: input.patient_id ? String(input.patient_id).trim() : '',
    doctor_id: input.doctor_id ? String(input.doctor_id).trim() : '',
    recipient_email: input.recipient_email ? String(input.recipient_email).trim() : '',
    channel: input.channel,
    type: input.type,
    status: input.status,
    sent_at: nowIso
  };
}

// ---- Sheets-backed operations ----

/**
 * Records a new Notification row. System-generated only — every caller is
 * an existing sender flow recording its own already-completed send attempt,
 * never a human or a Web App route. Validation failure is an expected
 * outcome (direct envelope, not the generic wrapper), the same convention
 * every other Foundation entity's input validation already follows.
 */
function foundationRecordNotification_(input) {
  var errors = foundationValidateRecordNotificationInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var notificationId = generateFoundationId_();
    var record = foundationBuildNotificationRecord_(input, notificationId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_NOTIFICATIONS_SHEET_, FOUNDATION_NOTIFICATIONS_COLUMNS_, record);
    return record;
  });
}

/**
 * Returns every Notification row belonging to `patientId`, newest first.
 * Internal-only in this batch — no FoundationRouter.gs dispatch case wraps
 * this yet (shared/schemas/notification.md's "Read helpers exist, but are
 * internal-only in this batch"). `patientId` must already be verified by
 * the caller — this function never re-derives or checks authorization.
 */
function foundationGetNotificationsForPatient_(patientId) {
  return withFoundationErrorHandling_(function () {
    var matching = foundationDsQuery_(FOUNDATION_NOTIFICATIONS_SHEET_, FOUNDATION_NOTIFICATIONS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    return foundationSortNotificationsNewestFirst_(matching);
  });
}

/**
 * Returns every Notification row belonging to `doctorId`, newest first.
 * Mirrors foundationGetNotificationsForPatient_() exactly, for the doctor
 * identity space. Internal-only in this batch, for the same reason.
 */
function foundationGetNotificationsForDoctor_(doctorId) {
  return withFoundationErrorHandling_(function () {
    var matching = foundationDsQuery_(FOUNDATION_NOTIFICATIONS_SHEET_, FOUNDATION_NOTIFICATIONS_COLUMNS_, function (row) {
      return row.doctor_id === doctorId;
    });
    return foundationSortNotificationsNewestFirst_(matching);
  });
}

/**
 * Sorts a list of Notification rows by sent_at descending (newest first),
 * mirroring get_doctor_instructions/get_care_plan/get_doctor_appointments's
 * own "newest first" convention, with a stable insertion-order tie-break.
 */
function foundationSortNotificationsNewestFirst_(rows) {
  var indexed = rows.map(function (row, i) { return { row: row, insertionIndex: i }; });
  indexed.sort(function (a, b) {
    if (a.row.sent_at !== b.row.sent_at) {
      return a.row.sent_at < b.row.sent_at ? 1 : -1;
    }
    return b.insertionIndex - a.insertionIndex;
  });
  return indexed.map(function (entry) { return entry.row; });
}
