/**
 * Doctor review checkpoint (docs/25 §5.2, Batch 4D). This is a
 * Sheet-bound custom menu, not a Web App page — a doctor reviews and
 * approves a draft from inside the Sheet itself, authenticated as
 * whichever Workspace account has edit access to it. This intentionally
 * does not reuse Batch 4B's fetch/Web-App form pattern: docs/25 §5.2
 * explicitly allows "Sheet-bound or minimal UI" for this step, and for a
 * staff-paced, one-row-at-a-time review action, a custom menu is simpler
 * and more auditable than building a second HTML form.
 *
 * onOpen() must keep this exact name (no trailing underscore) — Apps
 * Script only auto-runs a simple trigger with this literal function
 * name when the spreadsheet is opened. Every other function here follows
 * the project's normal "_" convention for non-entry-point functions.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Consultation Summaries')
    .addItem('Approve selected row (as generated)', 'approveSelectedRowAsGenerated_')
    .addItem('Approve selected row (I edited the draft)', 'approveSelectedRowEdited_')
    .addItem('Reject selected row', 'rejectSelectedRow_')
    .addToUi();
}

function approveSelectedRowAsGenerated_() {
  reviewSelectedRow_(REVIEW_STATUS.APPROVED);
}

function approveSelectedRowEdited_() {
  reviewSelectedRow_(REVIEW_STATUS.EDITED_AND_APPROVED);
}

function rejectSelectedRow_() {
  reviewSelectedRow_(REVIEW_STATUS.REJECTED);
}

function reviewSelectedRow_(newStatus) {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();

  if (sheet.getName() !== CONFIG.SHEET_NAME) {
    ui.alert('Select a row on the "' + CONFIG.SHEET_NAME + '" sheet first.');
    return;
  }

  var rowIndex = sheet.getActiveCell().getRow();
  if (rowIndex < 2) {
    ui.alert('Select a data row, not the header row.');
    return;
  }

  var row = getRowObjectByRowIndex_(rowIndex);
  if (!row.record_id) {
    ui.alert('Selected row has no record_id — nothing to review.');
    return;
  }

  var reviewerEmail = Session.getActiveUser().getEmail() || 'unknown-reviewer';
  var fields = {
    review_status: newStatus,
    reviewed_by: reviewerEmail,
    reviewed_at: new Date().toISOString()
  };

  try {
    updateRowByRecordId_(row.record_id, fields);
    logEvent_('reviewed', row.record_id, 'review_status=' + newStatus + ' by ' + reviewerEmail);
  } catch (err) {
    ui.alert('Could not save review: ' + err.message);
    return;
  }

  if (newStatus === REVIEW_STATUS.REJECTED) {
    ui.alert('Row rejected. No email will be sent.');
    return;
  }

  // Re-read the row rather than reusing values captured above, so a
  // manual edit to patient_consent_confirmed (or anything else the gate
  // checks) between submission and review is still caught (docs/25 §6).
  var updatedRow = getRowObjectByRowIndex_(rowIndex);
  var gate = evaluateSendGate_(updatedRow);

  if (!gate.canSend) {
    ui.alert('Approved, but not ready to send: ' + gate.reason);
    logEvent_('failed', row.record_id, 'Send gate blocked after review: ' + gate.reason);
    return;
  }

  // Batch 4D proves the gate is enforced correctly; it does not yet call
  // MailApp/GmailApp. The actual patient-facing HTML template and
  // delivery call are Batch 4E's scope (docs/25 §9.6).
  ui.alert('Approved — consent and review gates both pass. Email delivery ' +
    'is not implemented until Batch 4E; nothing has been sent to the patient.');
  logEvent_('reviewed', row.record_id, 'Send gate passed; delivery not yet implemented (Batch 4E).');
}
