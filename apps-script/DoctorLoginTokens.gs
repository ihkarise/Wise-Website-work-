/**
 * Doctor Login Token infrastructure — Batch WPI-1 (docs/50-PHASE-3-
 * TECHNICAL-PLAN.md §5.4; docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs
 * this and every later WPI batch). Implements
 * shared/schemas/doctor-login-token.schema.json version 1.0.0 — see
 * shared/schemas/doctor-login-token.md for the hashing rationale (shared
 * with login-token.md's own) and the sheet-isolation security property
 * (doctor-session.md's security review §5).
 *
 * Mirrors apps-script/FoundationLoginTokens.gs (IA-1) exactly, for a
 * second, isolated identity space: token generation, hashing, expiration,
 * and single-use enforcement. Does NOT issue a Doctor Session
 * (foundationIssueDoctorSessionToken_() is never called from this file —
 * DoctorLoginFlow.gs is what turns a consumed token into a real login,
 * mirroring FoundationLoginTokens.gs/FoundationLoginFlow.gs's own IA-1/
 * IA-2 split).
 *
 * Reuses FoundationLoginTokens.gs's foundationGenerateRawLoginToken_() and
 * foundationHashLoginToken_() directly, unchanged — both were already
 * fully generic (neither references patient_id or any patient-specific
 * concept). Zero lines changed in FoundationLoginTokens.gs.
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs, FoundationLoginTokens.gs
 * (for the two reused generators above — must load first, see harness.js's
 * FILES ordering).
 */

var FOUNDATION_DOCTOR_LOGIN_TOKENS_SHEET_ = 'DoctorLoginTokens';
var FOUNDATION_DOCTOR_LOGIN_TOKENS_COLUMNS_ = ['token_hash', 'doctor_id', 'issued_at', 'expires_at', 'used_at'];

// 15 minutes — the same value FoundationLoginTokens.gs's own
// FOUNDATION_LOGIN_TOKEN_TTL_SECONDS_ locks for the patient side, declared
// as its own local constant (doctor-login-token.md's "TTL" section) rather
// than shared, mirroring every other entity file's own local-constant
// convention (not FoundationConfig.gs, which is frozen).
var FOUNDATION_DOCTOR_LOGIN_TOKEN_TTL_SECONDS_ = 900;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Builds a DoctorLoginTokens record (shared/schemas/doctor-login-token.schema.json).
 * Mirrors foundationBuildLoginTokenRecord_() exactly, doctor_id-keyed.
 */
function foundationBuildDoctorLoginTokenRecord_(doctorId, tokenHash, issuedAtMs, ttlSeconds) {
  var issuedAt = new Date(issuedAtMs);
  var expiresAt = new Date(issuedAtMs + ttlSeconds * 1000);
  return {
    token_hash: tokenHash,
    doctor_id: doctorId,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    used_at: ''
  };
}

/**
 * Returns true if `record.expires_at` is unparsable (fails closed) or has
 * passed as of `nowMs`. Mirrors foundationIsLoginTokenExpired_() exactly.
 */
function foundationIsDoctorLoginTokenExpired_(record, nowMs) {
  var expiresAtMs = Date.parse(record.expires_at);
  if (isNaN(expiresAtMs)) return true;
  return nowMs >= expiresAtMs;
}

/**
 * Returns true if this token has already been consumed.
 */
function foundationIsDoctorLoginTokenUsed_(record) {
  return typeof record.used_at === 'string' && record.used_at.length > 0;
}

/**
 * Evaluates an already-fetched record against the two server-enforced
 * rules: not expired, not already used. Mirrors
 * foundationEvaluateLoginTokenRecord_() exactly.
 */
function foundationEvaluateDoctorLoginTokenRecord_(record, nowMs) {
  if (foundationIsDoctorLoginTokenExpired_(record, nowMs)) {
    return { valid: false, reason: 'expired' };
  }
  if (foundationIsDoctorLoginTokenUsed_(record)) {
    return { valid: false, reason: 'already_used' };
  }
  return { valid: true, reason: null };
}

// ---- Sheets-backed operations ----

/**
 * Generates, hashes, and stores a new single-use login token for
 * `doctorId`. Returns the *raw* token exactly once, in `data.token` — it
 * is never persisted anywhere after this call returns. Mirrors
 * foundationCreateLoginToken_() exactly, reusing its two generator
 * helpers directly.
 */
function foundationCreateDoctorLoginToken_(doctorId) {
  if (!doctorId || typeof doctorId !== 'string') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'A valid doctor_id is required.');
  }
  return withFoundationErrorHandling_(function () {
    var rawToken = foundationGenerateRawLoginToken_();
    var tokenHash = foundationHashLoginToken_(rawToken);
    var record = foundationBuildDoctorLoginTokenRecord_(doctorId, tokenHash, Date.now(), FOUNDATION_DOCTOR_LOGIN_TOKEN_TTL_SECONDS_);
    foundationDsInsert_(FOUNDATION_DOCTOR_LOGIN_TOKENS_SHEET_, FOUNDATION_DOCTOR_LOGIN_TOKENS_COLUMNS_, record);
    foundationLogAuditEvent_('doctor_login_token_issued', '', '', 'doctor_id=' + doctorId + ' expires_at=' + record.expires_at);
    return {
      token: rawToken,
      doctor_id: record.doctor_id,
      issued_at: record.issued_at,
      expires_at: record.expires_at
    };
  });
}

/**
 * Consumes a raw doctor login token: hashes it, looks it up in
 * DoctorLoginTokens (never LoginTokens — doctor-login-token.md's
 * sheet-isolation property), checks it is neither unknown, expired, nor
 * already used, marks it used, and returns the resolved doctor_id —
 * nothing else. Every failure mode collapses to the same generic
 * FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID envelope, mirroring
 * foundationConsumeLoginToken_()'s "rejection is deliberately generic"
 * discipline exactly.
 */
function foundationConsumeDoctorLoginToken_(rawToken) {
  var invalidEnvelope = function () {
    return buildFoundationErrorEnvelope_('FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID', 'This login link is invalid or has expired.');
  };

  if (!rawToken || typeof rawToken !== 'string') {
    return invalidEnvelope();
  }

  var tokenHash = foundationHashLoginToken_(rawToken);
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_DOCTOR_LOGIN_TOKENS_SHEET_, FOUNDATION_DOCTOR_LOGIN_TOKENS_COLUMNS_, 'token_hash', tokenHash);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }

  var record = lookup.data;
  if (!record) {
    foundationLogAuditEvent_('doctor_login_token_rejected', '', '', 'reason=not_found');
    return invalidEnvelope();
  }

  var evaluation = foundationEvaluateDoctorLoginTokenRecord_(record, Date.now());
  if (!evaluation.valid) {
    foundationLogAuditEvent_('doctor_login_token_rejected', '', '', 'doctor_id=' + record.doctor_id + ' reason=' + evaluation.reason);
    return invalidEnvelope();
  }

  var markUsed = withFoundationErrorHandling_(function () {
    var updated = foundationDsUpdateById_(
      FOUNDATION_DOCTOR_LOGIN_TOKENS_SHEET_, FOUNDATION_DOCTOR_LOGIN_TOKENS_COLUMNS_, 'token_hash', tokenHash,
      { used_at: foundationNowIso_() }
    );
    if (!updated) {
      throw new Error('DoctorLoginTokens: token row disappeared between lookup and update.');
    }
    return true;
  });
  if (markUsed.status === 'error') {
    return markUsed;
  }

  foundationLogAuditEvent_('doctor_login_token_consumed', '', '', 'doctor_id=' + record.doctor_id);
  return buildFoundationOkEnvelope_({ doctor_id: record.doctor_id });
}
