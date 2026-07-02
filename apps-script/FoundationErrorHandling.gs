/**
 * withFoundationErrorHandling_() wraps a Foundation function call so every
 * caller gets a guaranteed response-envelope shape (FoundationContracts.gs)
 * back, never a raw thrown exception reaching them — ADR-010: the safer
 * behavior is the default, not an opt-in.
 *
 * Depends only on FoundationContracts.gs.
 */

/**
 * Calls `fn` with no arguments inside a try/catch. On success, wraps its
 * return value in a success envelope. On any thrown error, logs the real
 * error to Apps Script's built-in execution log (Logger — distinct from
 * Phase 1.5's own custom Logger.gs/logEvent_() module; no collision, no
 * dependency) for debugging, and returns a generic, safe error envelope —
 * the caller never sees the raw exception message.
 *
 * Persistent, structured audit logging of failures (an AuditLog sheet
 * entry, not just an ephemeral execution-log line) is layered on top of
 * this from batch F3 onward, once FoundationAudit.gs exists — this
 * wrapper's own job is narrower: guarantee the envelope shape, always.
 */
function withFoundationErrorHandling_(fn) {
  try {
    var result = fn();
    return buildFoundationOkEnvelope_(result);
  } catch (err) {
    Logger.log('Foundation error: ' + (err && err.message ? err.message : err));
    return buildFoundationErrorEnvelope_(
      'FOUNDATION_UNEXPECTED_ERROR',
      'Something went wrong. Please try again.'
    );
  }
}
