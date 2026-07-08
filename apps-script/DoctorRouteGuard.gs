/**
 * Doctor route protection — Batch WPI-1 (docs/50-PHASE-3-TECHNICAL-PLAN.md
 * §14). Gates a doctor-facing handler behind a verified DoctorSession
 * token, deriving doctor_id only from the verified token, mirroring
 * FoundationRouteGuard.gs's withFoundationAuth_()/foundationRequireSession_()
 * exactly for a second, permanently distinct identity space (ADR-017).
 *
 * See shared/schemas/doctor-session.md's dedicated security review §2 for
 * the mechanical proof that a real Patient Session token presented here
 * is rejected (invalid_payload_shape, no doctor_id key), never
 * mistakenly authorized.
 *
 * Depends on DoctorSession.gs (verification), FoundationContracts.gs (the
 * error envelope shape), FoundationAudit.gs (rejection logging).
 */

/**
 * Verifies `sessionToken` as a Doctor Session and logs a FoundationAudit
 * event when rejected, mirroring foundationRequireSession_() exactly.
 * Never logs on success. patient_id is left empty in the audit row (no
 * natural patient for a doctor-scoped event) — doctor-session.md's
 * security review §8.
 */
function foundationRequireDoctorSession_(sessionToken) {
  var verification = foundationVerifyDoctorSessionToken_(sessionToken);
  if (!verification.valid) {
    foundationLogAuditEvent_('doctor_session_rejected', '', '', 'reason=' + verification.reason);
  }
  return verification;
}

/**
 * Calls `handlerFn(doctorId)` only if `sessionToken` verifies as a real
 * Doctor Session. On an invalid/expired/missing/wrong-identity-type
 * token, returns a FOUNDATION_UNAUTHORIZED envelope directly and never
 * calls `handlerFn` at all — mirrors withFoundationAuth_() exactly.
 */
function withFoundationDoctorAuth_(sessionToken, handlerFn) {
  var verification = foundationRequireDoctorSession_(sessionToken);
  if (!verification.valid) {
    return buildFoundationErrorEnvelope_('FOUNDATION_UNAUTHORIZED', 'Please log in again.');
  }
  return handlerFn(verification.doctorId);
}
