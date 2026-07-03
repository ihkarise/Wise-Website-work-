/**
 * Login Token infrastructure — IA-1, the first of two independent
 * Identity & Access batches this milestone was explicitly split into.
 * Implements shared/schemas/login-token.schema.json version 1.0.0 — see
 * shared/schemas/login-token.md for the hashing rationale, the raw
 * token's entropy source, and the used_at sentinel-value convention.
 *
 * IA-1 scope, deliberately: token generation, hashing, expiration, and
 * single-use enforcement only. Does NOT issue a Session
 * (FoundationSession.gs's foundationIssueSessionToken_() is never
 * called from this file), does NOT send an email, does NOT expose a
 * Web App route, and does NOT implement any authentication UI.
 * foundationConsumeLoginToken_() returns a resolved patient_id and
 * nothing more — IA-2 is what turns that into a real login.
 *
 * Not Foundation-prefixed for the same reason PatientIdentity.gs isn't
 * (docs/29 §2): this is a concrete entity built on top of Foundation's
 * frozen infrastructure, not infrastructure itself. Zero modification
 * to any of the ten frozen Foundation-family files — reuses
 * FoundationDataStore.gs's existing generic insert/getById/updateById
 * operations exactly as they were already designed to be reused
 * (ADR-009), and FoundationAudit.gs's existing foundationLogAuditEvent_()
 * exactly as-is.
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs,
 * FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_LOGIN_TOKENS_SHEET_ = 'LoginTokens';
var FOUNDATION_LOGIN_TOKENS_COLUMNS_ = ['token_hash', 'patient_id', 'issued_at', 'expires_at', 'used_at'];

// 15 minutes, per docs/29 §3's "checks not-expired (≈15 minutes)". A
// local constant, not FoundationConfig.gs — Foundation's ten files are
// frozen (docs/35 §9); every other entity file (PatientIdentity.gs,
// FoundationAudit.gs) already declares its own sheet/column constants
// locally rather than centralizing them, so this follows the existing
// convention rather than reopening a frozen file for one new value.
var FOUNDATION_LOGIN_TOKEN_TTL_SECONDS_ = 900;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Builds a LoginTokens record (shared/schemas/login-token.schema.json).
 * `tokenHash` is precomputed and passed in — this function never
 * touches Utilities itself, so it's fully deterministic and testable.
 * `used_at` is always '' at creation — the documented "not yet used"
 * sentinel (login-token.md).
 */
function foundationBuildLoginTokenRecord_(patientId, tokenHash, issuedAtMs, ttlSeconds) {
  var issuedAt = new Date(issuedAtMs);
  var expiresAt = new Date(issuedAtMs + ttlSeconds * 1000);
  return {
    token_hash: tokenHash,
    patient_id: patientId,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    used_at: ''
  };
}

/**
 * Returns true if `record.expires_at` is unparsable (fails closed) or
 * has passed as of `nowMs`. Mirrors FoundationSession.gs's
 * foundationIsSessionExpired_() exactly — same fail-closed contract.
 */
function foundationIsLoginTokenExpired_(record, nowMs) {
  var expiresAtMs = Date.parse(record.expires_at);
  if (isNaN(expiresAtMs)) return true;
  return nowMs >= expiresAtMs;
}

/**
 * Returns true if this token has already been consumed — any non-empty
 * `used_at` means single-use has already been spent.
 */
function foundationIsLoginTokenUsed_(record) {
  return typeof record.used_at === 'string' && record.used_at.length > 0;
}

/**
 * Evaluates an already-fetched record against the two server-enforced
 * rules (docs/29 §3): not expired, not already used. Returns
 * `{valid: true}` or `{valid: false, reason}` — `reason` is never
 * returned to a caller outside this file (see foundationConsumeLoginToken_()
 * below and login-token.md's "Rejection is deliberately generic");
 * it exists for audit-log detail and testability only.
 */
function foundationEvaluateLoginTokenRecord_(record, nowMs) {
  if (foundationIsLoginTokenExpired_(record, nowMs)) {
    return { valid: false, reason: 'expired' };
  }
  if (foundationIsLoginTokenUsed_(record)) {
    return { valid: false, reason: 'already_used' };
  }
  return { valid: true, reason: null };
}

// ---- Apps Script-dependent helpers (Utilities only — no Sheet, no network) ----

/**
 * Returns a hex-encoded SHA-256 digest of `rawToken`. Plain hash, never
 * HMAC — see login-token.md's "Why only the hash is ever stored" for
 * why that's the correct choice here (unlike FoundationSession.gs's
 * HMAC-signed session payload).
 */
function foundationHashLoginToken_(rawToken) {
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawToken);
  return digestBytes.map(function (b) {
    var unsigned = b < 0 ? b + 256 : b;
    var hex = unsigned.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Returns a high-entropy raw token: three concatenated
 * Utilities.getUuid() calls, hyphens stripped — see login-token.md's
 * "Where the raw token's entropy comes from" for why this clears
 * docs/29 §3's 256-bit target without a new randomness primitive.
 * Never stored anywhere — the caller (foundationCreateLoginToken_())
 * hashes it immediately and returns only the raw value, once, to its
 * own caller.
 */
function foundationGenerateRawLoginToken_() {
  return Utilities.getUuid().replace(/-/g, '')
    + Utilities.getUuid().replace(/-/g, '')
    + Utilities.getUuid().replace(/-/g, '');
}

// ---- Sheets-backed operations ----

/**
 * Generates, hashes, and stores a new single-use login token for
 * `patientId`. Returns the *raw* token exactly once, in `data.token` —
 * it is never persisted anywhere after this call returns. A future
 * batch (IA-2) is responsible for delivering it (e.g. via email); this
 * function has no knowledge of how it will be delivered.
 *
 * `patientId` validation failure is an expected outcome (direct
 * envelope, not the generic wrapper) — same convention
 * foundationCreatePatient_() already established.
 */
function foundationCreateLoginToken_(patientId) {
  if (!patientId || typeof patientId !== 'string') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'A valid patient_id is required.');
  }
  return withFoundationErrorHandling_(function () {
    var rawToken = foundationGenerateRawLoginToken_();
    var tokenHash = foundationHashLoginToken_(rawToken);
    var record = foundationBuildLoginTokenRecord_(patientId, tokenHash, Date.now(), FOUNDATION_LOGIN_TOKEN_TTL_SECONDS_);
    foundationDsInsert_(FOUNDATION_LOGIN_TOKENS_SHEET_, FOUNDATION_LOGIN_TOKENS_COLUMNS_, record);
    foundationLogAuditEvent_('login_token_issued', patientId, '', 'expires_at=' + record.expires_at);
    return {
      token: rawToken,
      patient_id: record.patient_id,
      issued_at: record.issued_at,
      expires_at: record.expires_at
    };
  });
}

/**
 * Consumes a raw login token: hashes it, looks it up, checks it is
 * neither unknown, expired, nor already used, marks it used, and
 * returns the resolved patient_id — nothing else. Every failure mode
 * (not found, expired, already used, malformed input) returns the same
 * FOUNDATION_LOGIN_TOKEN_INVALID envelope with the same friendly
 * message — see login-token.md's "Rejection is deliberately generic."
 *
 * Deliberately does NOT call foundationIssueSessionToken_() — IA-1's
 * explicit scope boundary. The caller (a future IA-2 route) is
 * responsible for turning a successful `{patient_id}` result into an
 * actual session.
 */
function foundationConsumeLoginToken_(rawToken) {
  var invalidEnvelope = function () {
    return buildFoundationErrorEnvelope_('FOUNDATION_LOGIN_TOKEN_INVALID', 'This login link is invalid or has expired.');
  };

  if (!rawToken || typeof rawToken !== 'string') {
    return invalidEnvelope();
  }

  var tokenHash = foundationHashLoginToken_(rawToken);
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_LOGIN_TOKENS_SHEET_, FOUNDATION_LOGIN_TOKENS_COLUMNS_, 'token_hash', tokenHash);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }

  var record = lookup.data;
  if (!record) {
    foundationLogAuditEvent_('login_token_rejected', '', '', 'reason=not_found');
    return invalidEnvelope();
  }

  var evaluation = foundationEvaluateLoginTokenRecord_(record, Date.now());
  if (!evaluation.valid) {
    foundationLogAuditEvent_('login_token_rejected', record.patient_id, '', 'reason=' + evaluation.reason);
    return invalidEnvelope();
  }

  var markUsed = withFoundationErrorHandling_(function () {
    var updated = foundationDsUpdateById_(
      FOUNDATION_LOGIN_TOKENS_SHEET_, FOUNDATION_LOGIN_TOKENS_COLUMNS_, 'token_hash', tokenHash,
      { used_at: foundationNowIso_() }
    );
    if (!updated) {
      throw new Error('FoundationLoginTokens: token row disappeared between lookup and update.');
    }
    return true;
  });
  if (markUsed.status === 'error') {
    return markUsed;
  }

  foundationLogAuditEvent_('login_token_consumed', record.patient_id, '', '');
  return buildFoundationOkEnvelope_({ patient_id: record.patient_id });
}

// ---- Manually-run wrapper (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder patient_id below — same minimal, no-route, no-UI pattern
 * PatientIdentity.gs's createFoundationPatient() already established
 * for exactly this "infrastructure only" scope.
 */
function createFoundationLoginToken() {
  var result = foundationCreateLoginToken_('EDIT ME BEFORE RUNNING — a real patient_id');
  Logger.log(JSON.stringify(result));
  return result;
}
