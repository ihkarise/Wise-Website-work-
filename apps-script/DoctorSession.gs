/**
 * Doctor Session token issuance and verification — Batch WPI-1 (docs/50-
 * PHASE-3-TECHNICAL-PLAN.md §5.3/§5.5; docs/53-PHASE-3-IMPLEMENTATION-
 * RULES.md governs this and every later WPI batch). Implements
 * shared/schemas/doctor-session.schema.json version 1.0.0. Governed by
 * ADR-017 (Doctor Identity, permanently separate from Patient Identity)
 * and ADR-010 (security over convenience — short, non-renewing lifetime;
 * constant-time signature comparison).
 *
 * Reuses FoundationSession.gs's existing signing primitives WITHOUT
 * modifying that frozen file — the exact "additive wrapper" pattern
 * TrustedDevice.gs's Long-Lived Session already proved out at Batch
 * PXP-8. See shared/schemas/doctor-session.md's dedicated pre-ship
 * security review (docs/50 §14 gate) for the full analysis, including
 * exactly which primitives are reused (the signing secret and the HMAC
 * signing function, both unchanged) and the mechanical proof that a
 * Doctor Session token can never authorize a patient-scoped route, or
 * vice versa (structurally distinct, non-overlapping payload shapes:
 * doctor_id, never patient_id).
 *
 * Reused, unmodified, from FoundationSession.gs: FOUNDATION_SESSION_TOKEN_SEPARATOR_,
 * foundationBase64UrlEncodeString_, foundationBase64UrlDecodeToString_,
 * foundationSignSessionPayloadSegment_, foundationConstantTimeEquals_,
 * foundationGetSessionSigningSecret_, foundationIsSessionExpired_ (the
 * last is already generic — it only reads payload.expires_at, a field
 * name common to both payload shapes). Zero lines changed in
 * FoundationSession.gs.
 *
 * Depends on FoundationSession.gs (must load first — see harness.js's
 * FILES ordering), FoundationConfig.gs (SESSION_TTL_SECONDS, the same
 * bounded lifetime Patient Session uses — docs/50 §14: "Doctor Session
 * mirrors Patient Session's security posture exactly").
 */

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Builds the Doctor Session payload (shared/schemas/doctor-session.schema.json).
 * Mirrors foundationBuildSessionPayload_() exactly, doctor_id-keyed instead
 * of patient_id-keyed — a new function, not a call into the patient-side
 * one, since the two payload shapes must stay structurally distinct
 * (doctor-session.md's security review §2).
 */
function foundationBuildDoctorSessionPayload_(doctorId, issuedAtMs, ttlSeconds) {
  var issuedAt = new Date(issuedAtMs);
  var expiresAt = new Date(issuedAtMs + ttlSeconds * 1000);
  return {
    doctor_id: doctorId,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString()
  };
}

/**
 * Returns true only if `payload` has exactly the three contractual
 * fields, correctly typed, with doctor_id (never patient_id) as the
 * subject key. This is the check that mechanically prevents a Patient
 * Session payload from ever verifying as a Doctor Session — see
 * doctor-session.md's security review §2 for the full proof.
 */
function foundationIsValidDoctorSessionPayloadShape_(payload) {
  return !!payload
    && typeof payload.doctor_id === 'string' && payload.doctor_id.length > 0
    && typeof payload.issued_at === 'string'
    && typeof payload.expires_at === 'string';
}

// ---- Real entry points — reuse FoundationSession.gs's primitives unmodified ----

/**
 * Issues a Doctor Session token for `doctorId`, reusing
 * FoundationSession.gs's exact signing secret, HMAC function, and
 * base64url encoding — only the payload shape differs. The only function
 * real callers should use to mint a Doctor Session.
 */
function foundationIssueDoctorSessionToken_(doctorId) {
  if (!doctorId || typeof doctorId !== 'string') {
    throw new Error('foundationIssueDoctorSessionToken_: doctorId is required.');
  }
  var secret = foundationGetSessionSigningSecret_();
  var payload = foundationBuildDoctorSessionPayload_(doctorId, Date.now(), FOUNDATION_CONFIG.SESSION_TTL_SECONDS);
  var payloadSegment = foundationBase64UrlEncodeString_(JSON.stringify(payload));
  var signatureSegment = foundationSignSessionPayloadSegment_(payloadSegment, secret);
  return payloadSegment + FOUNDATION_SESSION_TOKEN_SEPARATOR_ + signatureSegment;
}

/**
 * Verifies `token` as a Doctor Session using the real signing secret and
 * the current time. Returns `{valid: true, doctorId, payload}` or
 * `{valid: false, reason}`; never throws — an invalid token is an
 * expected outcome, not an error. A token that is actually a valid,
 * signed Patient Session fails at the payload-shape check below (no
 * `doctor_id` key), never reaching a false-positive "valid" result — the
 * mechanical cross-identity-type guarantee doctor-session.md's security
 * review §2 documents and Stage 17's conformance checks prove directly.
 */
function foundationVerifyDoctorSessionToken_(token) {
  var secret;
  try {
    secret = foundationGetSessionSigningSecret_();
  } catch (err) {
    return { valid: false, reason: 'signing_secret_unavailable' };
  }

  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'missing_token' };
  }
  var parts = token.split(FOUNDATION_SESSION_TOKEN_SEPARATOR_);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'malformed_token' };
  }
  var payloadSegment = parts[0];
  var signatureSegment = parts[1];

  var expectedSignature = foundationSignSessionPayloadSegment_(payloadSegment, secret);
  if (!foundationConstantTimeEquals_(expectedSignature, signatureSegment)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  var payload;
  try {
    payload = JSON.parse(foundationBase64UrlDecodeToString_(payloadSegment));
  } catch (err) {
    return { valid: false, reason: 'malformed_payload' };
  }

  if (!foundationIsValidDoctorSessionPayloadShape_(payload)) {
    return { valid: false, reason: 'invalid_payload_shape' };
  }

  if (foundationIsSessionExpired_(payload, Date.now())) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, doctorId: payload.doctor_id, payload: payload };
}
