/**
 * Route protection — gates a Foundation handler behind a verified
 * session token, deriving patient_id only from the verified token, per
 * ADR-002/docs/29 §3's "never accept patient_id as client-supplied
 * input" rule. This is the "route protection" half of
 * apps-script/README.md's F4 commitment (session issuance/verification
 * is FoundationSession.gs).
 *
 * Depends on FoundationSession.gs (verification), FoundationContracts.gs
 * (the error envelope shape), FoundationAudit.gs (rejection logging).
 *
 * No Foundation Web App route (doPost) exists yet to call this from —
 * PatientIdentity.gs's own header comment notes the same gap for patient
 * creation. This batch delivers the gate itself, ready for whichever
 * future batch wires an actual endpoint through it.
 */

/**
 * Verifies `sessionToken` and logs a FoundationAudit event when
 * rejected ("F4's unauthorized-session-attempt logging",
 * FoundationAudit.gs's own forward-referencing comment from batch F3).
 * Never logs on success — an audit trail of every valid request would
 * duplicate whatever the protected handler itself already logs, and
 * isn't this function's job.
 */
function foundationRequireSession_(sessionToken) {
  var verification = foundationVerifySessionToken_(sessionToken);
  if (!verification.valid) {
    foundationLogAuditEvent_('session_rejected', '', '', 'reason=' + verification.reason);
  }
  return verification;
}

/**
 * Calls `handlerFn(patientId)` only if `sessionToken` verifies. On an
 * invalid/expired/missing token, returns a FOUNDATION_UNAUTHORIZED
 * envelope directly and never calls `handlerFn` at all — `handlerFn`
 * itself is expected to already return a response-envelope-shaped
 * value (e.g. via withFoundationErrorHandling_() or a builder call
 * directly), the same convention every other Foundation entity function
 * follows, so this wrapper's own return value is just whatever
 * `handlerFn` returns, unchanged, on the success path.
 */
function withFoundationAuth_(sessionToken, handlerFn) {
  var verification = foundationRequireSession_(sessionToken);
  if (!verification.valid) {
    return buildFoundationErrorEnvelope_('FOUNDATION_UNAUTHORIZED', 'Please log in again.');
  }
  return handlerFn(verification.patientId);
}
