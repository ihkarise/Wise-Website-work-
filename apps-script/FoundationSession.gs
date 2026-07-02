/**
 * Foundation-layer session token issuance and verification. Implements
 * shared/schemas/session.schema.json version 1.0.0 — see
 * shared/schemas/session.md for the wire-format spec and why the HMAC
 * signing step itself is deliberately not ported into a portable
 * reference file (a cryptographic primitive should call the runtime's
 * own implementation, never be hand-rolled for "portability").
 *
 * Governing ADRs: ADR-002 (identity independent of authentication),
 * ADR-003 (passwordless by default — a session is what a redeemed login
 * link becomes), ADR-010 (security over convenience — short, non-
 * renewing lifetime; constant-time signature comparison).
 *
 * Every function that needs the real signing secret or Apps Script's
 * HMAC primitive is named with a `WithSecret_`/`_` split so the pure
 * payload/expiry/shape logic can be tested in isolation, and the
 * signing round-trip can be tested with an explicit test secret,
 * without ever touching PropertiesService (FoundationTests.gs does
 * exactly this). Depends on FoundationConfig.gs for
 * SESSION_TTL_SECONDS and the Script Property key name.
 *
 * No LoginTokens sheet, no magic-link request/consume flow, and no Web
 * App route exist yet — this file only issues and verifies a session
 * once a patient_id is already known (see shared/schemas/session.md's
 * "Relationship to LoginTokens"). apps-script/README.md's F4 commitment
 * names this file and FoundationRouteGuard.gs only.
 */

var FOUNDATION_SESSION_TOKEN_SEPARATOR_ = '.';

// ---- Pure helpers — no Apps Script dependency, covered by FoundationTests.gs ----

/**
 * Builds the Session payload (shared/schemas/session.schema.json).
 * `issuedAtMs`/`ttlSeconds` are explicit parameters (never read from a
 * clock internally) so this function is deterministic and testable.
 */
function foundationBuildSessionPayload_(patientId, issuedAtMs, ttlSeconds) {
  var issuedAt = new Date(issuedAtMs);
  var expiresAt = new Date(issuedAtMs + ttlSeconds * 1000);
  return {
    patient_id: patientId,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString()
  };
}

/**
 * Returns true only if `payload` has exactly the three contractual
 * fields, correctly typed. Does not check expiry — see
 * foundationIsSessionExpired_() for that, kept separate so "malformed"
 * and "expired" are distinguishable rejection reasons.
 */
function foundationIsValidSessionPayloadShape_(payload) {
  return !!payload
    && typeof payload.patient_id === 'string' && payload.patient_id.length > 0
    && typeof payload.issued_at === 'string'
    && typeof payload.expires_at === 'string';
}

/**
 * Returns true if `payload.expires_at` is unparsable (fails closed —
 * treated as already expired, never as "no expiry") or has passed as of
 * `nowMs`. No silent renewal (docs/15 "session expiration", ADR-010) —
 * this function only ever answers "is this instant past expiry," never
 * extends one.
 */
function foundationIsSessionExpired_(payload, nowMs) {
  var expiresAtMs = Date.parse(payload.expires_at);
  if (isNaN(expiresAtMs)) return true;
  return nowMs >= expiresAtMs;
}

/**
 * Constant-time string comparison for the signature check
 * (foundationVerifySessionTokenWithSecret_()) — ADR-010: a naive `===`
 * short-circuits on the first differing character, leaking timing
 * information about how much of a forged signature was guessed
 * correctly. Both compared strings are fixed-length base64url-encoded
 * SHA-256 digests in real use, so the length-mismatch branch below is
 * not itself a meaningful timing signal.
 */
function foundationConstantTimeEquals_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  var mismatch = 0;
  for (var i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---- Apps Script-dependent helpers (Utilities only — no Sheet, no network) ----

function foundationBase64UrlEncodeBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function foundationBase64UrlEncodeString_(str) {
  return foundationBase64UrlEncodeBytes_(Utilities.newBlob(str).getBytes());
}

function foundationBase64UrlDecodeToString_(str) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(str)).getDataAsString();
}

function foundationSignSessionPayloadSegment_(payloadSegment, secret) {
  var signatureBytes = Utilities.computeHmacSha256Signature(payloadSegment, secret);
  return foundationBase64UrlEncodeBytes_(signatureBytes);
}

/**
 * Builds a signed session token for an already-resolved `patientId`,
 * using an explicit `secret`/`nowMs` rather than reading them
 * internally — the testable core. `foundationIssueSessionToken_()`
 * below is the real entry point real callers use.
 */
function foundationIssueSessionTokenWithSecret_(patientId, secret, nowMs) {
  if (!patientId || typeof patientId !== 'string') {
    throw new Error('foundationIssueSessionTokenWithSecret_: patientId is required.');
  }
  var payload = foundationBuildSessionPayload_(patientId, nowMs, FOUNDATION_CONFIG.SESSION_TTL_SECONDS);
  var payloadSegment = foundationBase64UrlEncodeString_(JSON.stringify(payload));
  var signatureSegment = foundationSignSessionPayloadSegment_(payloadSegment, secret);
  return payloadSegment + FOUNDATION_SESSION_TOKEN_SEPARATOR_ + signatureSegment;
}

/**
 * Verifies a session token against an explicit `secret`/`nowMs` — the
 * testable core. Returns `{valid: true, patientId, payload}` or
 * `{valid: false, reason}`; never throws on a malformed/forged/expired
 * token — an invalid token is an expected outcome, not an error.
 */
function foundationVerifySessionTokenWithSecret_(token, secret, nowMs) {
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

  if (!foundationIsValidSessionPayloadShape_(payload)) {
    return { valid: false, reason: 'invalid_payload_shape' };
  }

  if (foundationIsSessionExpired_(payload, nowMs)) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, patientId: payload.patient_id, payload: payload };
}

// ---- Real entry points — read the signing secret from Script Properties ----

/**
 * Reads FOUNDATION_SESSION_SIGNING_SECRET from Script Properties. Throws
 * if unset — the same "fails loudly on an unprovisioned operational
 * value" discipline FoundationDataStore.gs's PATIENT_SPREADSHEET_ID
 * placeholder already established; setting the real secret is an
 * operational step outside this repository.
 */
function foundationGetSessionSigningSecret_() {
  var secret = PropertiesService.getScriptProperties()
    .getProperty(FOUNDATION_CONFIG.SCRIPT_PROPERTY_KEYS.SESSION_SIGNING_SECRET);
  if (!secret) {
    throw new Error('FoundationSession: ' + FOUNDATION_CONFIG.SCRIPT_PROPERTY_KEYS.SESSION_SIGNING_SECRET + ' is not set in Script Properties.');
  }
  return secret;
}

/**
 * Issues a session token for `patientId` using the real signing secret
 * and the current time. The only function real callers should use to
 * mint a session.
 */
function foundationIssueSessionToken_(patientId) {
  return foundationIssueSessionTokenWithSecret_(patientId, foundationGetSessionSigningSecret_(), Date.now());
}

/**
 * Verifies `token` using the real signing secret and the current time.
 * The only function real callers should use to check a presented
 * session token. If the signing secret itself is not yet provisioned,
 * this is treated as every token being invalid (fails closed), not as
 * an unexpected error.
 */
function foundationVerifySessionToken_(token) {
  var secret;
  try {
    secret = foundationGetSessionSigningSecret_();
  } catch (err) {
    return { valid: false, reason: 'signing_secret_unavailable' };
  }
  return foundationVerifySessionTokenWithSecret_(token, secret, Date.now());
}
