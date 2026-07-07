/**
 * Trusted Device + Long-Lived Session — Batch PXP-8 (docs/44-PHASE-2B-
 * TECHNICAL-PLAN.md §5, §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md
 * governs this and every later batch). Implements
 * shared/schemas/trusted-device.schema.json version 1.0.0. Governed by
 * ADR-015 — Magic Link remains the sole root of trust (docs/44 §5.7);
 * this file is an additive convenience layer alongside it, never a
 * replacement. PIN (PatientCredential) is explicitly out of scope for
 * this batch (docs/45 Part 5, docs/44 §22) — nothing here implements it.
 *
 * Not Foundation-prefixed, for the same reason CarePlan.gs and
 * DoctorAssignedCondition.gs aren't (docs/29 §2): a concrete entity built
 * on Foundation's frozen infrastructure, not infrastructure itself.
 *
 * Patient-owned — unlike every other Phase 2B entity shipped so far (all
 * doctor/staff-owned, since no real Doctor identity/session exists yet,
 * docs/33 §1.4), a Trusted Device is the patient's own device credential.
 * Every write (mark_device_trusted, revoke_trusted_device) is a real,
 * session-authenticated Web App route the patient calls directly — this
 * is the first Phase 2B entity with no manually-run Apps Script editor
 * wrapper at all.
 *
 * Long-Lived Session (docs/44 §5.5's implementation-time decision,
 * resolved here): an additive wrapper, never a modification to the
 * frozen FoundationSession.gs. foundationIssueLongLivedSessionToken_()
 * below calls that file's own already-existing pure helpers
 * (foundationBuildSessionPayload_, foundationBase64UrlEncodeString_,
 * foundationSignSessionPayloadSegment_, foundationGetSessionSigningSecret_,
 * FOUNDATION_SESSION_TOKEN_SEPARATOR_) with a different, longer TTL
 * constant — the token produced is byte-for-byte the same wire format
 * session.schema.json already defines, verified completely unmodified by
 * foundationVerifySessionToken_(). Zero lines changed in
 * FoundationSession.gs, FoundationRouteGuard.gs, or session.schema.json.
 * See shared/schemas/trusted-device.md for the full lifecycle, the
 * sliding-device-expiry design, and the disclosed revocation-latency
 * limitation this choice implies.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..7 file — reuses FoundationDataStore.gs's existing generic
 * insert/getById/updateById/query operations, FoundationAudit.gs's
 * existing foundationLogAuditEvent_(), and FoundationLoginTokens.gs's
 * existing foundationGenerateRawLoginToken_()/foundationHashLoginToken_()
 * exactly as all were already designed to be reused (ADR-009, and ADR-015
 * §Decision 1's own "the same entropy class as LoginToken... safely
 * reuses LoginToken's already-proven plain-SHA-256 hashing pattern").
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs, FoundationSession.gs,
 * FoundationLoginTokens.gs.
 */

var FOUNDATION_TRUSTED_DEVICES_SHEET_ = 'TrustedDevices';
var FOUNDATION_TRUSTED_DEVICES_COLUMNS_ = ['device_id', 'patient_id', 'device_token_hash', 'device_label', 'created_at', 'last_used_at', 'expires_at', 'revoked_at', 'revoked_by'];

// 90 days, sliding — extended to now + this TTL on every successful use
// (shared/schemas/trusted-device.md's "Sliding device expiry"). A local
// constant, not FoundationConfig.gs, mirroring FoundationLoginTokens.gs's
// own FOUNDATION_LOGIN_TOKEN_TTL_SECONDS_ precedent for not reopening
// that frozen file. Tunable later per ADR-010's established posture.
var FOUNDATION_TRUSTED_DEVICE_TTL_SECONDS_ = 60 * 60 * 24 * 90;

// 14 days — materially longer than FOUNDATION_CONFIG.SESSION_TTL_SECONDS's
// default 3600 seconds (docs/44 §5.1 mechanism 3's "materially longer TTL"
// requirement), while bounding shared/schemas/trusted-device.md's disclosed
// revocation-latency exposure window. Fixed, non-renewing per token — the
// same non-sliding discipline FoundationSession.gs's own base Session TTL
// already applies (ADR-010); only FOUNDATION_TRUSTED_DEVICE_TTL_SECONDS_
// above slides, not this one. Not fixed permanently — ADR-015's own Future
// Considerations names exact Long-Lived Session TTL as an implementation-
// time, tune-with-real-data parameter.
var FOUNDATION_LONG_LIVED_SESSION_TTL_SECONDS_ = 60 * 60 * 24 * 14;

var FOUNDATION_TRUSTED_DEVICE_LABEL_MAX_LENGTH_ = 60;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for mark_device_trusted's own input shape. `device_label` is the
 * only client-supplied field — patient_id is always session-derived by
 * the caller (FoundationRouter.gs), never validated here.
 */
function foundationValidateMarkDeviceTrustedInput_(input) {
  var errors = [];
  var label = input && input.device_label;
  if (label !== undefined && label !== null && label !== '' && typeof label !== 'string') {
    errors.push('device_label must be a string when provided.');
  }
  if (typeof label === 'string' && label.trim().length > FOUNDATION_TRUSTED_DEVICE_LABEL_MAX_LENGTH_) {
    errors.push('device_label must be ' + FOUNDATION_TRUSTED_DEVICE_LABEL_MAX_LENGTH_ + ' characters or fewer.');
  }
  return errors;
}

/**
 * Builds a new TrustedDevice record (shared/schemas/trusted-device.schema.json).
 * `deviceTokenHash` is precomputed and passed in, mirroring
 * foundationBuildLoginTokenRecord_()'s own convention — this function never
 * touches Utilities itself, so it stays fully deterministic and testable.
 */
function foundationBuildTrustedDeviceRecord_(patientId, deviceTokenHash, deviceLabel, deviceId, nowIso, expiresAtIso) {
  return {
    device_id: deviceId,
    patient_id: patientId,
    device_token_hash: deviceTokenHash,
    device_label: (deviceLabel || '').trim(),
    created_at: nowIso,
    last_used_at: '',
    expires_at: expiresAtIso,
    revoked_at: '',
    revoked_by: ''
  };
}

/**
 * Returns true if `record` is not revoked and not expired as of `nowMs` —
 * the two server-enforced presentation rules, mirroring
 * foundationEvaluateLoginTokenRecord_()'s own shape exactly (docs/29 §3's
 * discipline applied here to a rotating credential instead of a single-use
 * one). Fails closed on an unparsable expires_at, same as every other
 * expiry check in this codebase.
 */
function foundationEvaluateTrustedDeviceRecord_(record, nowMs) {
  if (record.revoked_at) {
    return { valid: false, reason: 'revoked' };
  }
  var expiresAtMs = Date.parse(record.expires_at);
  if (isNaN(expiresAtMs) || nowMs >= expiresAtMs) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, reason: null };
}

/**
 * Strips device_token_hash from a stored TrustedDevice row before it is
 * ever returned to a patient — a deliberate data-minimization choice
 * (shared/schemas/trusted-device.md's "Fields at a glance"), mirroring
 * download_report never returning a raw Drive URL. Every other field is
 * returned unchanged.
 */
function foundationRedactTrustedDeviceForPatient_(record) {
  return {
    device_id: record.device_id,
    patient_id: record.patient_id,
    device_label: record.device_label,
    created_at: record.created_at,
    last_used_at: record.last_used_at,
    expires_at: record.expires_at,
    revoked_at: record.revoked_at,
    revoked_by: record.revoked_by
  };
}

// ---- Long-Lived Session — additive wrapper around FoundationSession.gs's own primitives ----

/**
 * Builds a long-lived, signed Session token for an already-resolved
 * `patientId`, using an explicit `secret`/`nowMs` — the testable core,
 * mirroring foundationIssueSessionTokenWithSecret_()'s own shape exactly
 * (FoundationSession.gs), substituting
 * FOUNDATION_LONG_LIVED_SESSION_TTL_SECONDS_ for
 * FOUNDATION_CONFIG.SESSION_TTL_SECONDS. Every other step — payload shape,
 * base64url encoding, HMAC signing — is the identical, unmodified
 * FoundationSession.gs primitive, so the token this produces is
 * byte-for-byte the same wire format and is verified by
 * foundationVerifySessionToken_() completely unchanged.
 */
function foundationIssueLongLivedSessionTokenWithSecret_(patientId, secret, nowMs) {
  var payload = foundationBuildSessionPayload_(patientId, nowMs, FOUNDATION_LONG_LIVED_SESSION_TTL_SECONDS_);
  var payloadSegment = foundationBase64UrlEncodeString_(JSON.stringify(payload));
  var signatureSegment = foundationSignSessionPayloadSegment_(payloadSegment, secret);
  return payloadSegment + FOUNDATION_SESSION_TOKEN_SEPARATOR_ + signatureSegment;
}

/**
 * Issues a long-lived session token for `patientId` using the real signing
 * secret (FoundationSession.gs's own foundationGetSessionSigningSecret_())
 * and the current time — the only function real callers should use to mint
 * a long-lived session. Called only from foundationConsumeTrustedDevice_()
 * below, never directly from a Web App route (a Long-Lived Session is
 * always the result of presenting a Trusted Device, per ADR-015 §Decision
 * 1 — "Trusted Device is the credential; Long-Lived Session is the
 * resulting access window").
 */
function foundationIssueLongLivedSessionToken_(patientId) {
  return foundationIssueLongLivedSessionTokenWithSecret_(patientId, foundationGetSessionSigningSecret_(), Date.now());
}

// ---- Sheets-backed operations ----

/**
 * Creates a new Trusted Device for `patientId`, session-authenticated —
 * the platform's first Phase 2B write that is patient-, not doctor/staff-,
 * initiated. Reuses FoundationLoginTokens.gs's existing raw-token
 * generation and hashing exactly as ADR-015 §Decision 1 anticipates ("the
 * same entropy class as LoginToken... safely reuses LoginToken's already-
 * proven plain-SHA-256 hashing pattern — no new cryptographic bridge
 * needed"). Returns the *raw* device token exactly once, in
 * `data.device_token` — it is never persisted anywhere after this call
 * returns, the same discipline foundationCreateLoginToken_() already
 * established for its own raw token.
 */
function foundationCreateTrustedDevice_(patientId, deviceLabel) {
  var errors = foundationValidateMarkDeviceTrustedInput_({ device_label: deviceLabel });
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  return withFoundationErrorHandling_(function () {
    var rawToken = foundationGenerateRawLoginToken_();
    var tokenHash = foundationHashLoginToken_(rawToken);
    var deviceId = generateFoundationId_();
    var nowIso = foundationNowIso_();
    var expiresAtIso = new Date(Date.now() + FOUNDATION_TRUSTED_DEVICE_TTL_SECONDS_ * 1000).toISOString();
    var record = foundationBuildTrustedDeviceRecord_(patientId, tokenHash, deviceLabel, deviceId, nowIso, expiresAtIso);
    foundationDsInsert_(FOUNDATION_TRUSTED_DEVICES_SHEET_, FOUNDATION_TRUSTED_DEVICES_COLUMNS_, record);
    foundationLogAuditEvent_('trusted_device_created', patientId, patientId, 'device_id=' + deviceId);
    return {
      device_token: rawToken,
      device_id: deviceId,
      device_label: record.device_label,
      expires_at: record.expires_at
    };
  });
}

/**
 * Consumes a presented raw device token: hashes it, looks it up, checks it
 * is neither unknown, revoked, nor expired, rotates its stored hash to a
 * freshly generated raw token, slides its expiry forward, stamps
 * last_used_at, and issues a fresh Long-Lived Session — the platform's
 * "session renewal" mechanic, reusing this same action rather than adding
 * a separate one (docs/47 §4). Every failure mode (not found, revoked,
 * expired, malformed input) returns the same FOUNDATION_TRUSTED_DEVICE_INVALID
 * envelope with the same friendly message, mirroring
 * foundationConsumeLoginToken_()'s own "rejection is deliberately generic"
 * discipline exactly.
 */
function foundationConsumeTrustedDevice_(rawDeviceToken) {
  var invalidEnvelope = function () {
    return buildFoundationErrorEnvelope_('FOUNDATION_TRUSTED_DEVICE_INVALID', 'This device is no longer trusted. Please sign in again.');
  };

  if (!rawDeviceToken || typeof rawDeviceToken !== 'string') {
    return invalidEnvelope();
  }

  var tokenHash = foundationHashLoginToken_(rawDeviceToken);
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_TRUSTED_DEVICES_SHEET_, FOUNDATION_TRUSTED_DEVICES_COLUMNS_, 'device_token_hash', tokenHash);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }

  var record = lookup.data;
  if (!record) {
    foundationLogAuditEvent_('trusted_device_rejected', '', '', 'reason=not_found');
    return invalidEnvelope();
  }

  var evaluation = foundationEvaluateTrustedDeviceRecord_(record, Date.now());
  if (!evaluation.valid) {
    foundationLogAuditEvent_('trusted_device_rejected', record.patient_id, '', 'reason=' + evaluation.reason);
    return invalidEnvelope();
  }

  return withFoundationErrorHandling_(function () {
    var newRawToken = foundationGenerateRawLoginToken_();
    var newTokenHash = foundationHashLoginToken_(newRawToken);
    var nowIso = foundationNowIso_();
    var newExpiresAtIso = new Date(Date.now() + FOUNDATION_TRUSTED_DEVICE_TTL_SECONDS_ * 1000).toISOString();
    foundationDsUpdateById_(FOUNDATION_TRUSTED_DEVICES_SHEET_, FOUNDATION_TRUSTED_DEVICES_COLUMNS_, 'device_token_hash', tokenHash, {
      device_token_hash: newTokenHash,
      last_used_at: nowIso,
      expires_at: newExpiresAtIso
    });
    var sessionToken = foundationIssueLongLivedSessionToken_(record.patient_id);
    foundationLogAuditEvent_('trusted_device_consumed', record.patient_id, '', 'device_id=' + record.device_id);
    foundationLogAuditEvent_('long_lived_session_issued', record.patient_id, '', 'device_id=' + record.device_id);
    return {
      device_token: newRawToken,
      session_token: sessionToken,
      patient_id: record.patient_id
    };
  });
}

/**
 * Returns every TrustedDevice row belonging to `patientId` (active and
 * revoked alike — the patient's full device history, mirroring
 * foundationGetPatientConditionAssignments_()'s own "full history, not
 * just active" convention), sorted created_at descending (newest first),
 * with device_token_hash stripped from every row
 * (foundationRedactTrustedDeviceForPatient_()). `patientId` must already
 * be session-verified by the caller (ADR-002) — this function never
 * re-derives it.
 */
function foundationGetPatientTrustedDevices_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_TRUSTED_DEVICES_SHEET_, FOUNDATION_TRUSTED_DEVICES_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    rows.sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    return rows.map(function (row) { return foundationRedactTrustedDeviceForPatient_(row); });
  });
}

/**
 * Revokes `deviceId`, session-authenticated as `patientId` — self-service,
 * patient-only (there is no doctor/staff revocation path in this batch, a
 * device being the patient's own, not clinical content). An unknown
 * device_id or one belonging to a different patient is rejected with the
 * same generic FOUNDATION_NOT_FOUND foundationGetConsultationEntryById_()
 * already uses for its own cross-patient check (docs/40 Q3) — never
 * distinguishing "doesn't exist" from "not yours." Revoking an
 * already-revoked device is also rejected — a one-way, exactly-once
 * transition, mirroring foundationResolveCondition_()'s own discipline.
 */
function foundationRevokeTrustedDevice_(patientId, deviceId) {
  if (!deviceId || typeof deviceId !== 'string') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'device_id is required.');
  }
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_TRUSTED_DEVICES_SHEET_, FOUNDATION_TRUSTED_DEVICES_COLUMNS_, 'device_id', deviceId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  var record = lookup.data;
  if (!record || record.patient_id !== patientId || record.revoked_at) {
    return buildFoundationErrorEnvelope_('FOUNDATION_NOT_FOUND', 'We could not find that trusted device.');
  }
  return withFoundationErrorHandling_(function () {
    var revokedAt = foundationNowIso_();
    foundationDsUpdateById_(FOUNDATION_TRUSTED_DEVICES_SHEET_, FOUNDATION_TRUSTED_DEVICES_COLUMNS_, 'device_id', deviceId, {
      revoked_at: revokedAt,
      revoked_by: patientId
    });
    foundationLogAuditEvent_('trusted_device_revoked', patientId, patientId, 'device_id=' + deviceId);
    return { device_id: deviceId, revoked_at: revokedAt };
  });
}
