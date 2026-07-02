/**
 * Foundation-layer append-only audit log — a cross-cutting event trail
 * distinct from any entity's own status columns (docs/15, ADR-010).
 * Depends only on FoundationDataStore.gs and FoundationUtils.gs.
 *
 * Batch F3 introduces this for one event type: patient_created. Future
 * batches (F4's session verification rejections, later batches' upload/
 * symptom-log events) log through this same function — the schema below
 * does not change shape as event types are added, only the values in
 * event_type/detail do.
 */

var FOUNDATION_AUDIT_SHEET_ = 'AuditLog';
var FOUNDATION_AUDIT_COLUMNS_ = ['event_id', 'event_type', 'patient_id', 'actor', 'detail', 'occurred_at'];

/**
 * Appends one audit event. `patientId` and `actor` may be empty strings
 * for events with no natural patient/actor (neither is currently
 * expected in batch F3, but the column exists for batches that need it,
 * e.g. F4's unauthorized-session-attempt logging).
 */
function foundationLogAuditEvent_(eventType, patientId, actor, detail) {
  foundationDsInsert_(FOUNDATION_AUDIT_SHEET_, FOUNDATION_AUDIT_COLUMNS_, {
    event_id: generateFoundationId_(),
    event_type: eventType,
    patient_id: patientId || '',
    actor: actor || '',
    detail: detail || '',
    occurred_at: foundationNowIso_()
  });
}
