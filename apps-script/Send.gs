/**
 * Gated send decision + orchestration (docs/25 §6, §9.2, §5.2, §9.6).
 *
 * This module NEVER calls MailApp or GmailApp directly — that call
 * lives only in Email.gs:
 *
 *   Send.gs  →  Email.gs  →  Mail Provider (MailApp)
 *
 * evaluateSendGate_() is the single choke point for "is it safe to
 * email this patient" — both conditions it checks are enforced here in
 * code, not left as a UI-only checkbox (docs/25 §6). A row can be
 * tampered with directly in the Sheet after submission, so this reads
 * live values, not assumptions carried over from when the row was
 * created. attemptSend_() is the only function in this project allowed
 * to call Email.gs's sendVisitSummaryEmail_() — Review.gs calls
 * attemptSend_(), never Email.gs directly, so the gate can never be
 * bypassed by a future caller that forgets to check it.
 */
function evaluateSendGate_(row) {
  if (row.patient_consent_confirmed !== true) {
    return { canSend: false, reason: 'patient_consent_confirmed is not true.' };
  }
  if (row.review_status !== REVIEW_STATUS.APPROVED &&
      row.review_status !== REVIEW_STATUS.EDITED_AND_APPROVED) {
    return { canSend: false, reason: 'review_status is "' + row.review_status + '", not an approved state.' };
  }
  if (!row.ai_summary_draft) {
    return { canSend: false, reason: 'ai_summary_draft is empty — nothing to send.' };
  }
  if (!row.recipient_email) {
    return { canSend: false, reason: 'recipient_email is empty.' };
  }
  return { canSend: true, reason: null };
}

/**
 * Attempts delivery for one row: checks the gate, and only if it passes,
 * calls Email.gs. Always returns a result object, never throws. Writes
 * email_status/email_sent_at/error_log via Sheets.gs regardless of
 * outcome (docs/25 §8.3: failures must be logged, never silently
 * dropped) and logs every stage via Logger.gs.
 */
function attemptSend_(row) {
  var gate = evaluateSendGate_(row);
  if (!gate.canSend) {
    logEvent_('failed', row.record_id, 'Send gate blocked: ' + gate.reason);
    return { sent: false, reason: gate.reason };
  }

  var result = sendVisitSummaryEmail_(row); // Email.gs — the only caller of the mail provider

  var fields = result.ok
    ? { email_status: EMAIL_STATUS.SENT, email_sent_at: new Date().toISOString() }
    : { email_status: EMAIL_STATUS.FAILED, error_log: 'EMAIL_SEND_FAILED: ' + result.error };

  try {
    updateRowByRecordId_(row.record_id, fields);
  } catch (err) {
    logEvent_('failed', row.record_id, 'Could not log email result: ' + err.message);
  }

  if (result.ok) {
    logEvent_('sent', row.record_id, 'Email delivered to recipient.');
    return { sent: true, reason: null };
  }

  logEvent_('failed', row.record_id, 'Email send failed: ' + result.error);
  return { sent: false, reason: result.error };
}
