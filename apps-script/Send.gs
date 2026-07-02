/**
 * Gated send decision (docs/25 §6, §9.2, §5.2). Batch 4D builds and
 * proves this gate against real, reviewable rows; Batch 4E attaches the
 * actual MailApp/GmailApp call and the patient-facing HTML template to
 * it. No module in this project should call MailApp/GmailApp without
 * first passing the row through evaluateSendGate_() — this is the single
 * choke point for "is it safe to email this patient."
 *
 * Both conditions below are enforced here in code, not left as a UI-only
 * checkbox (docs/25 §6): a row can be tampered with directly in the
 * Sheet after submission, so this reads live values, not assumptions
 * carried over from when the row was created.
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
