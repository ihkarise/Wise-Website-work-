/**
 * Audit logging (docs/15-SECURITY-STANDARDS.md: "Audit logging" — every
 * pipeline stage logged). Batch 4A only emits 'submitted' and 'failed';
 * later batches reuse logEvent_ for 'summarized', 'reviewed', 'sent'.
 *
 * This writes to the Apps Script execution log (Stackdriver), which is
 * separate from the per-row audit trail already kept in the Sheet itself
 * (error_log, review_status, email_status columns in Schema.gs).
 */

function logEvent_(stage, recordId, detail) {
  Logger.log('[phase1.5] stage=%s record_id=%s detail=%s',
    stage, recordId || 'n/a', detail || '');
}
