/**
 * Sheet schema for Phase1.5_ConsultationSummaries (docs/25 §5.1).
 * SCHEMA_COLUMNS order is authoritative and IS the Sheet's header row —
 * Sheets.gs refuses to write if the live header ever drifts from this list.
 *
 * Batch 4A populates the first block of columns (record_id through
 * consent_confirmed_by, plus recipient_email) and defaults the rest.
 * Later batches (4C-4F) update those existing rows in place:
 *   4C -> ai_summary_draft, ai_model_used
 *   4D -> review_status, reviewed_by, reviewed_at
 *   4E -> email_status, email_sent_at
 *   4F -> purged_at (and clears recipient_email)
 */

var SCHEMA_COLUMNS = [
  'record_id',
  'created_at',
  'condition_slug',
  'staff_submitted_note',
  'patient_consent_confirmed',
  'consent_confirmed_by',
  'recipient_email',
  'ai_summary_draft',
  'ai_model_used',
  'review_status',
  'reviewed_by',
  'reviewed_at',
  'email_status',
  'email_sent_at',
  'error_log',
  'purged_at'
];

var REVIEW_STATUS = {
  PENDING: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EDITED_AND_APPROVED: 'edited_and_approved'
};

var EMAIL_STATUS = {
  NOT_SENT: 'not_sent',
  SENT: 'sent',
  FAILED: 'failed'
};

/**
 * Builds a full schema row from a validated submission. Every column is
 * always present (even if empty) so appendRow_ never has to guess order.
 */
function buildRow_(input) {
  return {
    record_id: Utilities.getUuid(),
    created_at: new Date().toISOString(),
    condition_slug: input.condition_slug,
    staff_submitted_note: input.staff_submitted_note,
    patient_consent_confirmed: input.patient_consent_confirmed,
    consent_confirmed_by: input.consent_confirmed_by,
    recipient_email: input.recipient_email,
    ai_summary_draft: '',
    ai_model_used: '',
    review_status: REVIEW_STATUS.PENDING,
    reviewed_by: '',
    reviewed_at: '',
    email_status: EMAIL_STATUS.NOT_SENT,
    email_sent_at: '',
    error_log: '',
    purged_at: ''
  };
}

function rowToArray_(row) {
  return SCHEMA_COLUMNS.map(function (col) { return row[col]; });
}
