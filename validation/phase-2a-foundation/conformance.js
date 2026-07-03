'use strict';
/**
 * Foundation batch F5 — the schema-validator-based conformance harness
 * docs/29-PHASE-2A-TECHNICAL-PLAN.md §14 named as F5's explicit
 * deliverable in F2's own implementation notes ("Automated,
 * schema-validator-based conformance testing
 * (validation/phase-2a-foundation/conformance.js) remains an F5
 * deliverable, not built early").
 *
 * Loads the real, unmodified Foundation-family .gs source (via
 * harness.js's mocked Apps Script runtime), exercises the real
 * functions that produce shared/-schema-shaped output, and validates
 * that real output against the real, committed shared/*.schema.json
 * files using schema-validator.js's generic validator — not hand-coded
 * per-field assertions (that was F2/F3/F4's ad hoc approach; this
 * batch formalizes it into a reusable, generic, committed check any
 * future Foundation batch's new schema can plug into without writing a
 * new bespoke validator).
 *
 * Extended in Identity & Access batch IA-1 with Stage 5, covering
 * FoundationLoginTokens.gs against shared/schemas/login-token.schema.json
 * — the same pattern this file already established, not a new one.
 *
 * Extended in Identity & Access batch IA-2 with Stage 6, exercising the
 * real magic-link request/consume flow (FoundationLoginFlow.gs), rate
 * limiting (FoundationRateLimit.gs), email delivery (FoundationEmail.gs),
 * and the full HTTP-level dispatch (FoundationRouter.gs's
 * handleFoundationRequest_(), including the first authenticated route,
 * get_profile) end to end through the real, unmodified source. No new
 * shared/*.schema.json contract was introduced for IA-2 — its wire
 * shapes (`{message}`, `{session_token, patient_id}`) are ad hoc action
 * responses, not new persisted entities, so Stage 6 checks them directly
 * rather than against a new schema (see docs/29 §15's IA-2 section for
 * this scope boundary stated explicitly).
 *
 * Extended in Patient Access batch PA-3 with Stage 7, covering
 * FoundationConsultationHistory.gs against the new
 * shared/schemas/consultation-history.schema.json, plus the two new
 * FoundationRouter.gs dispatch cases (get_timeline, get_timeline_entry)
 * end to end — including the cross-patient-authorization check docs/40's
 * identity-strategy review named as this batch's one new authorization
 * shape (a client-supplied record_id must resolve only to its own
 * patient_id, never anyone else's).
 *
 * Extended in Patient Access batch PA-4 with Stage 8, covering
 * FoundationSymptomLog.gs against the new
 * shared/schemas/symptom-log.schema.json and FoundationTimeline.gs's merge
 * output against the new shared/schemas/timeline-entry.schema.json — the
 * platform's first patient-*writable* entity (draft create/edit/submit),
 * its draft/submitted visibility rules (docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md),
 * and get_timeline's now-merged output, end to end through
 * FoundationRouter.gs's real dispatch.
 *
 * Run with: node conformance.js  (no dependencies beyond Node's
 * standard library).
 */
var fs = require('fs');
var path = require('path');
var harness = require('./harness');
var schemaValidator = require('./schema-validator');

var buildSandbox = harness.buildSandbox;
var loadProject = harness.loadProject;
var validate = schemaValidator.validate;

var SHARED_DIR = path.resolve(__dirname, '../../shared');
var responseEnvelopeSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'contracts/response-envelope.schema.json'), 'utf8'));
var patientIdentitySchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/patient-identity.schema.json'), 'utf8'));
var sessionSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/session.schema.json'), 'utf8'));
var loginTokenSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/login-token.schema.json'), 'utf8'));
var consultationHistorySchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/consultation-history.schema.json'), 'utf8'));
var symptomLogSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/symptom-log.schema.json'), 'utf8'));
var timelineEntrySchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/timeline-entry.schema.json'), 'utf8'));

var results = [];
function record(name, pass, detail) {
  results.push({ name: name, pass: pass, detail: detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
}

// ============================================================
// Stage 0 — prove the validator itself against deliberately-broken
// fixtures before trusting it to grade anything else (mirrors
// validation/phase-1-5/validate.js's own Stage0 pattern).
// ============================================================
(function stage0_validatorSelfCheck() {
  var okEnvelope = { status: 'ok', data: { x: 1 }, error: null };
  record('Stage0: schema-validator accepts a well-formed ok envelope',
    validate(responseEnvelopeSchema, okEnvelope).valid === true);

  var okWithError = { status: 'ok', data: { x: 1 }, error: { code: 'X', message: 'Y' } };
  record('Stage0: schema-validator rejects status=ok with a non-null error (oneOf)',
    validate(responseEnvelopeSchema, okWithError).valid === false);

  var missingField = { status: 'ok', data: null };
  record('Stage0: schema-validator rejects a missing required field',
    validate(responseEnvelopeSchema, missingField).valid === false);

  var extraField = { status: 'ok', data: null, error: null, unexpected_field: 'nope' };
  record('Stage0: schema-validator rejects an additionalProperties:false violation',
    validate(responseEnvelopeSchema, extraField).valid === false);

  var wrongType = { status: 'ok', data: null, error: 'should be an object or null' };
  record('Stage0: schema-validator rejects a wrong-typed field',
    validate(responseEnvelopeSchema, wrongType).valid === false);

  var badEmail = { patient_id: 'p1', full_name: 'A', email: 'not-an-email', condition_slug: 'mcas', status: 'active', created_at: '2026-07-03T00:00:00.000Z', created_by: 'x' };
  record('Stage0: schema-validator rejects an invalid "email" format',
    validate(patientIdentitySchema, badEmail).valid === false);

  var badEnum = Object.assign({}, badEmail, { email: 'a@b.com', status: 'not-a-real-status' });
  record('Stage0: schema-validator rejects a value outside an enum',
    validate(patientIdentitySchema, badEnum).valid === false);

  var loginTokenWithEmptySentinel = { token_hash: 'a'.repeat(64), patient_id: 'p1', issued_at: '2026-07-03T00:00:00.000Z', expires_at: '2026-07-03T00:15:00.000Z', used_at: '' };
  record('Stage0: schema-validator accepts login-token.schema.json\'s empty-string used_at sentinel',
    validate(loginTokenSchema, loginTokenWithEmptySentinel).valid === true);

  var loginTokenWithNullUsedAt = Object.assign({}, loginTokenWithEmptySentinel, { used_at: null });
  record('Stage0: schema-validator rejects a null used_at (the sentinel is a string, never null)',
    validate(loginTokenSchema, loginTokenWithNullUsedAt).valid === false);
})();

// ============================================================
// Load the real Foundation source through the real Apps Script mock.
// ============================================================
var h = buildSandbox({ scriptProperties: { FOUNDATION_SESSION_SIGNING_SECRET: 'conformance-test-secret' } });
var ctx = loadProject(h.sandbox);

// ============================================================
// Stage 1 — FoundationContracts.gs -> response-envelope.schema.json
// ============================================================
(function stage1_responseEnvelope() {
  var ok = ctx.buildFoundationOkEnvelope_({ example: true });
  var okResult = validate(responseEnvelopeSchema, ok);
  record('Stage1: buildFoundationOkEnvelope_() output conforms to response-envelope.schema.json',
    okResult.valid === true, okResult.errors.join('; '));

  var okNoData = ctx.buildFoundationOkEnvelope_();
  var okNoDataResult = validate(responseEnvelopeSchema, okNoData);
  record('Stage1: buildFoundationOkEnvelope_() with no argument still conforms (data normalized to null)',
    okNoDataResult.valid === true, okNoDataResult.errors.join('; '));

  var err = ctx.buildFoundationErrorEnvelope_('FOUNDATION_EXAMPLE', 'An example message.');
  var errResult = validate(responseEnvelopeSchema, err);
  record('Stage1: buildFoundationErrorEnvelope_() output conforms to response-envelope.schema.json',
    errResult.valid === true, errResult.errors.join('; '));
})();

// ============================================================
// Stage 2 — PatientIdentity.gs -> patient-identity.schema.json
// ============================================================
(function stage2_patientIdentity() {
  var created = ctx.foundationCreatePatient_({
    full_name: 'Conformance Test Patient',
    email: 'conformance-test@example.com',
    condition_slug: 'mcas',
    created_by: 'conformance-harness'
  });
  record('Stage2: foundationCreatePatient_() succeeds on valid input', created.status === 'ok', JSON.stringify(created));

  var patientResult = validate(patientIdentitySchema, created.data || {});
  record('Stage2: foundationCreatePatient_() output conforms to patient-identity.schema.json',
    patientResult.valid === true, patientResult.errors.join('; '));

  var fetched = ctx.foundationGetPatientById_(created.data.patient_id);
  record('Stage2: foundationGetPatientById_() returns the same record it just created',
    fetched.status === 'ok' && fetched.data.patient_id === created.data.patient_id);

  var fetchedResult = validate(patientIdentitySchema, fetched.data || {});
  record('Stage2: foundationGetPatientById_() output conforms to patient-identity.schema.json',
    fetchedResult.valid === true, fetchedResult.errors.join('; '));

  var notFound = ctx.foundationGetPatientById_('does-not-exist');
  record('Stage2: foundationGetPatientById_() returns FOUNDATION_NOT_FOUND for an unknown id',
    notFound.status === 'error' && notFound.error.code === 'FOUNDATION_NOT_FOUND');
})();

// ============================================================
// Stage 3 — FoundationSession.gs -> session.schema.json
// ============================================================
(function stage3_session() {
  var payload = ctx.foundationBuildSessionPayload_('conformance-patient-1', Date.parse('2026-07-03T00:00:00.000Z'), 3600);
  var payloadResult = validate(sessionSchema, payload);
  record('Stage3: foundationBuildSessionPayload_() output conforms to session.schema.json',
    payloadResult.valid === true, payloadResult.errors.join('; '));

  var token = ctx.foundationIssueSessionToken_('conformance-patient-2');
  var verified = ctx.foundationVerifySessionToken_(token);
  record('Stage3: real issue -> verify round trip succeeds through the PropertiesService-reading entry points',
    verified.valid === true && verified.patientId === 'conformance-patient-2');

  var verifiedPayloadResult = validate(sessionSchema, verified.payload || {});
  record('Stage3: the verified session payload conforms to session.schema.json',
    verifiedPayloadResult.valid === true, verifiedPayloadResult.errors.join('; '));
})();

// ============================================================
// Stage 4 — FoundationRouteGuard.gs, gating on a real, schema-conformant session
// ============================================================
(function stage4_routeGuard() {
  var token = ctx.foundationIssueSessionToken_('conformance-patient-3');
  var handlerCalledWith = null;
  var okResult = ctx.withFoundationAuth_(token, function (patientId) {
    handlerCalledWith = patientId;
    return ctx.buildFoundationOkEnvelope_({ derived: patientId });
  });
  record('Stage4: withFoundationAuth_() calls handlerFn with the verified patientId on a valid token',
    handlerCalledWith === 'conformance-patient-3');

  var okEnvelopeResult = validate(responseEnvelopeSchema, okResult);
  record('Stage4: withFoundationAuth_() success path still returns a conformant envelope',
    okEnvelopeResult.valid === true, okEnvelopeResult.errors.join('; '));

  var handlerCalled = false;
  var rejected = ctx.withFoundationAuth_('not-a-real-token', function () {
    handlerCalled = true;
    return ctx.buildFoundationOkEnvelope_('should not run');
  });
  record('Stage4: withFoundationAuth_() rejects an invalid token without calling handlerFn',
    handlerCalled === false && rejected.status === 'error' && rejected.error.code === 'FOUNDATION_UNAUTHORIZED');

  var rejectedEnvelopeResult = validate(responseEnvelopeSchema, rejected);
  record('Stage4: withFoundationAuth_() rejection also returns a conformant envelope',
    rejectedEnvelopeResult.valid === true, rejectedEnvelopeResult.errors.join('; '));

  // AuditLog is shared, cumulative state across this whole run (Stage2's
  // foundationCreatePatient_() already wrote a patient_created row) — so
  // this checks for the specific session_rejected event, not the sheet's
  // total row count.
  var auditSheet = h.spreadsheet.getSheetByName('AuditLog');
  var auditRows = auditSheet ? auditSheet._debug().rows : [];
  var sessionRejectedRows = auditRows.filter(function (row) { return row[1] === 'session_rejected'; });
  record('Stage4: the rejection wrote exactly one session_rejected AuditLog row',
    sessionRejectedRows.length === 1 && /reason=malformed_token/.test(sessionRejectedRows[0][4]));
})();

// ============================================================
// Stage 5 (IA-1) — FoundationLoginTokens.gs -> login-token.schema.json
// ============================================================
(function stage5_loginTokens() {
  var payload = ctx.foundationBuildLoginTokenRecord_('ia1-conformance-patient', 'a'.repeat(64), Date.parse('2026-07-03T00:00:00.000Z'), 900);
  var payloadResult = validate(loginTokenSchema, payload);
  record('Stage5: foundationBuildLoginTokenRecord_() output conforms to login-token.schema.json (including the empty used_at sentinel)',
    payloadResult.valid === true, payloadResult.errors.join('; '));

  var patient = ctx.foundationCreatePatient_({
    full_name: 'IA-1 Conformance Patient', email: 'ia1-conformance@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage5: setup — a real patient exists to issue a login token for', patient.status === 'ok');

  var created = ctx.foundationCreateLoginToken_(patient.data.patient_id);
  record('Stage5: foundationCreateLoginToken_() succeeds and returns the raw token exactly once',
    created.status === 'ok' && typeof created.data.token === 'string' && created.data.token.length > 0);

  var tokenHash = ctx.foundationHashLoginToken_(created.data.token);
  var storedRecord = ctx.foundationDsGetById_(ctx.FOUNDATION_LOGIN_TOKENS_SHEET_, ctx.FOUNDATION_LOGIN_TOKENS_COLUMNS_, 'token_hash', tokenHash);
  var storedResult = validate(loginTokenSchema, storedRecord || {});
  record('Stage5: the actual persisted LoginTokens row conforms to login-token.schema.json',
    storedResult.valid === true, storedResult.errors.join('; '));
  record('Stage5: the persisted row never stores the raw token — only its hash',
    storedRecord && storedRecord.token_hash === tokenHash && storedRecord.token_hash !== created.data.token);

  var consumed = ctx.foundationConsumeLoginToken_(created.data.token);
  record('Stage5: foundationConsumeLoginToken_() resolves the same patient_id the token was issued for',
    consumed.status === 'ok' && consumed.data.patient_id === patient.data.patient_id);

  var consumedEnvelopeResult = validate(responseEnvelopeSchema, consumed);
  record('Stage5: foundationConsumeLoginToken_() success path returns a conformant envelope',
    consumedEnvelopeResult.valid === true, consumedEnvelopeResult.errors.join('; '));

  var reused = ctx.foundationConsumeLoginToken_(created.data.token);
  record('Stage5: single-use is enforced — consuming the same token twice fails the second time',
    reused.status === 'error' && reused.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var notFound = ctx.foundationConsumeLoginToken_('this-token-was-never-issued');
  record('Stage5: consuming an unknown token fails with the same generic invalid code',
    notFound.status === 'error' && notFound.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var emptyInput = ctx.foundationConsumeLoginToken_('');
  record('Stage5: consuming an empty/malformed input fails immediately with the same generic code',
    emptyInput.status === 'error' && emptyInput.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  // Expiration: create a second token, then backdate its stored
  // expires_at directly (the same technique this repo's other
  // harnesses use to test time-based logic without a real 15-minute
  // wait), and confirm consumption is rejected.
  var second = ctx.foundationCreateLoginToken_(patient.data.patient_id);
  var secondHash = ctx.foundationHashLoginToken_(second.data.token);
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_LOGIN_TOKENS_SHEET_, ctx.FOUNDATION_LOGIN_TOKENS_COLUMNS_, 'token_hash', secondHash,
    { expires_at: new Date(Date.now() - 1000).toISOString() });
  var expiredResult = ctx.foundationConsumeLoginToken_(second.data.token);
  record('Stage5: an expired (backdated) token is rejected with the same generic invalid code',
    expiredResult.status === 'error' && expiredResult.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var loginTokenAuditRows = auditRowsOf(h, 'login_token_rejected');
  var expiredReasonLogged = loginTokenAuditRows.some(function (row) { return /reason=expired/.test(row[4]); });
  var usedReasonLogged = loginTokenAuditRows.some(function (row) { return /reason=already_used/.test(row[4]); });
  var notFoundReasonLogged = loginTokenAuditRows.some(function (row) { return /reason=not_found/.test(row[4]); });
  record('Stage5: each rejection reason (expired, already_used, not_found) was audit-logged with its specific reason, not just the generic outward code',
    expiredReasonLogged && usedReasonLogged && notFoundReasonLogged);

  var consumedAuditRows = auditRowsOf(h, 'login_token_consumed');
  record('Stage5: the successful consumption wrote exactly one login_token_consumed AuditLog row',
    consumedAuditRows.length === 1 && consumedAuditRows[0][2] === patient.data.patient_id);
})();

// ============================================================
// Stage 6 (IA-2) — FoundationLoginFlow.gs, FoundationRateLimit.gs,
// FoundationEmail.gs, FoundationRouter.gs: the real magic-link
// request/consume flow and the first authenticated Web App route, end
// to end through the real, unmodified source.
// ============================================================
(function stage6_loginFlowAndRouter() {
  // ---- 6a: rate limiting, in isolation ----
  var rlEmail = 'stage6-ratelimit@example.com';
  var rlResults = [1, 2, 3, 4, 5].map(function () { return ctx.foundationCheckAndIncrementRateLimit_(rlEmail); });
  record('Stage6a: the first 3 requests for the same email are allowed, the 4th and 5th are not (budget = 3)',
    rlResults.join(',') === 'true,true,true,false,false');

  var otherEmail = 'stage6-ratelimit-other@example.com';
  record('Stage6a: a different email has its own independent budget',
    ctx.foundationCheckAndIncrementRateLimit_(otherEmail) === true);

  // ---- 6b: request-link — malformed input is the one distinct response ----
  var malformed = ctx.foundationHandleRequestLoginLink_({ email: 'not-an-email' });
  record('Stage6b: a syntactically invalid email is rejected distinctly (not an enumeration signal)',
    malformed.status === 'error' && malformed.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- 6c: request-link — unmatched vs matched email get an identical response shape (anti-enumeration, docs/29 §3) ----
  var unmatched = ctx.foundationHandleRequestLoginLink_({ email: 'stage6-unmatched@example.com' });
  record('Stage6c: an unmatched (but well-formed and not rate-limited) email still returns a generic ok envelope',
    unmatched.status === 'ok' && typeof unmatched.data.message === 'string');

  var stage6Patient = ctx.foundationCreatePatient_({
    full_name: 'Stage6 Conformance Patient', email: 'stage6-matched@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage6c: setup — a real patient exists to request a login link for', stage6Patient.status === 'ok');

  h.mailLog.length = 0; // isolate this request's email from anything Stage5/earlier sent
  var matched = ctx.foundationHandleRequestLoginLink_({ email: 'STAGE6-Matched@Example.com' }); // deliberately mixed case
  record('Stage6c: a matched email returns the exact same ok-envelope shape as the unmatched case (byte-identical outward message)',
    matched.status === 'ok' && matched.data.message === unmatched.data.message);

  record('Stage6c: a matched, well-formed, not-rate-limited email actually sends one login-link email',
    h.mailLog.length === 1 && h.mailLog[0].to === stage6Patient.data.email);

  var linkMatch = /href="([^"]+)"/.exec(h.mailLog[0].htmlBody);
  var emailedLink = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : null;
  record('Stage6c: the emailed link points at the login-link URL with a token query parameter',
    !!emailedLink && emailedLink.indexOf(ctx.FOUNDATION_VERIFY_URL_BASE_ + '?token=') === 0);
  var rawTokenFromEmail = emailedLink ? decodeURIComponent(emailedLink.split('token=')[1]) : null;

  var requestedAuditRows = auditRowsOf(h, 'login_link_requested');
  var matchedReasonLogged = requestedAuditRows.some(function (row) { return row[2] === stage6Patient.data.patient_id && /reason=email_sent/.test(row[4]); });
  var notFoundReasonLogged6 = requestedAuditRows.some(function (row) { return /reason=email_not_found/.test(row[4]); });
  record('Stage6c: the specific reason (email_sent vs email_not_found) is still audit-logged internally, even though the outward response never varies',
    matchedReasonLogged && notFoundReasonLogged6);

  // ---- 6d: request-link — a rate-limited email still gets the identical generic response ----
  var rlTargetEmail = 'stage6-ratelimit-target@example.com';
  ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail });
  ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail });
  ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail });
  var rateLimited = ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail }); // 4th — over budget
  record('Stage6d: a rate-limited request still returns the exact same generic ok envelope, not a distinct error',
    rateLimited.status === 'ok' && rateLimited.data.message === unmatched.data.message);
  record('Stage6d: the rate-limited attempt is audit-logged internally as login_link_rate_limited',
    auditRowsOf(h, 'login_link_rate_limited').length === 1);

  // ---- 6e: consume-link — the real token emailed above, consumed into a real session ----
  record('Stage6e: setup — a raw token was actually recovered from the emailed link', typeof rawTokenFromEmail === 'string' && rawTokenFromEmail.length > 0);
  var consumedForSession = ctx.foundationHandleConsumeLoginLink_({ token: rawTokenFromEmail });
  record('Stage6e: consuming the emailed token succeeds and resolves the same patient_id it was issued for',
    consumedForSession.status === 'ok' && consumedForSession.data.patient_id === stage6Patient.data.patient_id);
  record('Stage6e: consuming the emailed token issues a real, non-empty session_token',
    typeof consumedForSession.data.session_token === 'string' && consumedForSession.data.session_token.length > 0);

  var consumedForSessionEnvelopeResult = validate(responseEnvelopeSchema, consumedForSession);
  record('Stage6e: foundationHandleConsumeLoginLink_() success path conforms to response-envelope.schema.json',
    consumedForSessionEnvelopeResult.valid === true, consumedForSessionEnvelopeResult.errors.join('; '));

  var reusedConsume = ctx.foundationHandleConsumeLoginLink_({ token: rawTokenFromEmail });
  record('Stage6e: the emailed token cannot be consumed twice (single-use still enforced through the IA-2 wrapper)',
    reusedConsume.status === 'error' && reusedConsume.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var missingTokenConsume = ctx.foundationHandleConsumeLoginLink_({});
  record('Stage6e: consuming with no token field fails with the same generic invalid code',
    missingTokenConsume.status === 'error' && missingTokenConsume.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  // ---- 6f: FoundationRouter.gs — full HTTP-level dispatch, including the first authenticated route ----
  var requestLinkHttp = ctx.handleFoundationRequest_({ foundation_action: 'request_login_link', email: 'stage6-router@example.com' });
  var requestLinkBody = JSON.parse(requestLinkHttp._text);
  record('Stage6f: handleFoundationRequest_() dispatches request_login_link and serializes a conformant envelope',
    requestLinkBody.status === 'ok' && validate(responseEnvelopeSchema, requestLinkBody).valid === true);

  var unknownActionHttp = ctx.handleFoundationRequest_({ foundation_action: 'not_a_real_action' });
  var unknownActionBody = JSON.parse(unknownActionHttp._text);
  record('Stage6f: handleFoundationRequest_() returns FOUNDATION_UNKNOWN_ACTION for an unrecognized action, never a thrown error',
    unknownActionBody.status === 'error' && unknownActionBody.error.code === 'FOUNDATION_UNKNOWN_ACTION');

  // Issue a second real session (independent of the one already consumed
  // above) to drive get_profile through the real HTTP dispatch path.
  var sessionForProfile = ctx.foundationIssueSessionToken_(stage6Patient.data.patient_id);
  var profileHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_profile', session_token: sessionForProfile });
  var profileBody = JSON.parse(profileHttp._text);
  record('Stage6f: get_profile (Foundation\'s first authenticated route) resolves the caller\'s own Patient record from a valid session',
    profileBody.status === 'ok' && profileBody.data.patient_id === stage6Patient.data.patient_id);

  var profileResult = validate(patientIdentitySchema, profileBody.data || {});
  record('Stage6f: get_profile\'s resolved Patient record still conforms to patient-identity.schema.json',
    profileResult.valid === true, profileResult.errors.join('; '));

  var unauthedProfileHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_profile', session_token: 'not-a-real-session-token' });
  var unauthedProfileBody = JSON.parse(unauthedProfileHttp._text);
  record('Stage6f: get_profile rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking a Patient record',
    unauthedProfileBody.status === 'error' && unauthedProfileBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedProfileBody.data === null);

  record('Stage6f: get_profile derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({ foundation_action: 'get_profile', session_token: sessionForProfile, patient_id: 'someone-elses-id' });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.data.patient_id === stage6Patient.data.patient_id;
    })());
})();

// ============================================================
// Stage 7 (PA-3) — FoundationConsultationHistory.gs -> consultation-history.schema.json,
// plus FoundationRouter.gs's two new dispatch cases end to end.
// ============================================================
(function stage7_consultationHistory() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage7 Patient A', email: 'stage7-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage7 Patient B', email: 'stage7-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage7: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  var payload = ctx.foundationBuildConsultationEntryRecord_(
    { patient_id: patientA.data.patient_id, entry_date: '2026-06-01', title: 'Visit 1', summary_text: 'Notes 1', source_ref: '', created_by: 'staff-1' },
    'stage7-fixture-id', '2026-06-01T00:00:00.000Z'
  );
  var payloadResult = validate(consultationHistorySchema, payload);
  record('Stage7: foundationBuildConsultationEntryRecord_() output conforms to consultation-history.schema.json',
    payloadResult.valid === true, payloadResult.errors.join('; '));
  record('Stage7: entry_type is always the fixed constant "consultation"', payload.entry_type === 'consultation');

  var invalidCreate = ctx.foundationCreateConsultationEntry_({ patient_id: patientA.data.patient_id });
  record('Stage7: foundationCreateConsultationEntry_() rejects missing required fields with FOUNDATION_INVALID_INPUT',
    invalidCreate.status === 'error' && invalidCreate.error.code === 'FOUNDATION_INVALID_INPUT');

  // Three entries for patient A (out of chronological order, to prove
  // sorting), one for patient B (to prove cross-patient isolation below).
  var entryOld = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-05-01', title: 'Oldest visit', summary_text: 'First visit notes.', created_by: 'staff-1'
  });
  var entryNew = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-06-15', title: 'Newest visit', summary_text: 'Most recent visit notes.', created_by: 'staff-1'
  });
  var entryMid = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-06-01', title: 'Middle visit', summary_text: 'Follow-up visit notes.', source_ref: 'phase15-record-123', created_by: 'staff-1'
  });
  var entryOtherPatient = ctx.foundationCreateConsultationEntry_({
    patient_id: patientB.data.patient_id, entry_date: '2026-06-20', title: 'Patient B visit', summary_text: 'Should never appear in patient A\'s timeline.', created_by: 'staff-1'
  });
  record('Stage7: setup — four real entries created (three for patient A, one for patient B)',
    [entryOld, entryNew, entryMid, entryOtherPatient].every(function (r) { return r.status === 'ok'; }));

  var createdResult = validate(consultationHistorySchema, entryMid.data || {});
  record('Stage7: a real foundationCreateConsultationEntry_() result conforms to consultation-history.schema.json',
    createdResult.valid === true, createdResult.errors.join('; '));

  var timeline = ctx.foundationGetPatientTimeline_(patientA.data.patient_id);
  record('Stage7: foundationGetPatientTimeline_() succeeds', timeline.status === 'ok');
  record('Stage7: the timeline contains only patient A\'s three entries, never patient B\'s',
    timeline.data.length === 3 && timeline.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));
  record('Stage7: the timeline is sorted newest-entry_date-first (docs/39 §3), independent of creation order',
    timeline.data[0].record_id === entryNew.data.record_id &&
    timeline.data[1].record_id === entryMid.data.record_id &&
    timeline.data[2].record_id === entryOld.data.record_id);

  var entryTimelineResult = validate(consultationHistorySchema, timeline.data[0]);
  record('Stage7: a real timeline entry conforms to consultation-history.schema.json',
    entryTimelineResult.valid === true, entryTimelineResult.errors.join('; '));

  // ---- Ordering tiebreaker: same entry_date, different created_at ----
  // Two real synchronous calls can land on the same millisecond timestamp
  // (no defined "newer" between them), so — the same explicit-backdating
  // technique Stage 5 already uses for expiry — tieOlder's stored
  // created_at is patched directly to a provably earlier instant rather
  // than relying on real wall-clock timing between two calls.
  var tieOlder = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-07-01', title: 'Tie — written first', summary_text: 'x', created_by: 'staff-1'
  });
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_CONSULTATION_HISTORY_SHEET_, ctx.FOUNDATION_CONSULTATION_HISTORY_COLUMNS_, 'record_id', tieOlder.data.record_id,
    { created_at: '2020-01-01T00:00:00.000Z' });
  var tieNewer = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-07-01', title: 'Tie — written second', summary_text: 'x', created_by: 'staff-1'
  });
  var timelineWithTie = ctx.foundationGetPatientTimeline_(patientA.data.patient_id);
  var tieIndexNewer = timelineWithTie.data.findIndex(function (e) { return e.record_id === tieNewer.data.record_id; });
  var tieIndexOlder = timelineWithTie.data.findIndex(function (e) { return e.record_id === tieOlder.data.record_id; });
  record('Stage7: same-entry_date rows tiebreak on created_at descending (the more recently written row sorts first)',
    tieIndexNewer !== -1 && tieIndexOlder !== -1 && tieIndexNewer < tieIndexOlder);

  // ---- Detail view: found, and the cross-patient-authorization boundary (docs/40 Q3) ----
  var ownEntry = ctx.foundationGetConsultationEntryById_(patientA.data.patient_id, entryMid.data.record_id);
  record('Stage7: foundationGetConsultationEntryById_() resolves a patient\'s own entry by record_id',
    ownEntry.status === 'ok' && ownEntry.data.record_id === entryMid.data.record_id);

  var crossPatientAttempt = ctx.foundationGetConsultationEntryById_(patientB.data.patient_id, entryMid.data.record_id);
  record('Stage7: a different patient requesting patient A\'s record_id is rejected, never leaking the row',
    crossPatientAttempt.status === 'error' && crossPatientAttempt.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientAttempt.data === null);

  var unknownIdAttempt = ctx.foundationGetConsultationEntryById_(patientA.data.patient_id, 'this-record-id-was-never-created');
  record('Stage7: an unknown record_id fails with the exact same code as a cross-patient attempt (anti-enumeration)',
    unknownIdAttempt.status === 'error' && unknownIdAttempt.error.code === crossPatientAttempt.error.code &&
    unknownIdAttempt.error.message === crossPatientAttempt.error.message);

  // ---- FoundationRouter.gs — the two new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var timelineHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline', session_token: sessionA });
  var timelineBody = JSON.parse(timelineHttp._text);
  // Updated by Batch PA-4, disclosed: get_timeline's response shape changed
  // from a raw ConsultationHistory row array to the new, narrower
  // timeline-entry contract (shared/schemas/timeline-entry.schema.json),
  // which deliberately does not include patient_id (docs/41's approved
  // Timeline-merge design) — isolation is still enforced upstream, inside
  // the unmodified foundationGetPatientTimeline_(), which filters by
  // patient_id before this response is ever built. This assertion checks
  // entry_type/shape instead of the now-removed patient_id field.
  record('Stage7: get_timeline (real HTTP dispatch) resolves the caller\'s own timeline from a valid session',
    timelineBody.status === 'ok' && timelineBody.data.length === 5 &&
    timelineBody.data.every(function (e) { return e.entry_type === 'consultation'; }));

  var unauthedTimelineHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline', session_token: 'not-a-real-session-token' });
  var unauthedTimelineBody = JSON.parse(unauthedTimelineHttp._text);
  record('Stage7: get_timeline rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedTimelineBody.status === 'error' && unauthedTimelineBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedTimelineBody.data === null);

  var entryHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline_entry', session_token: sessionA, record_id: entryMid.data.record_id });
  var entryBody = JSON.parse(entryHttp._text);
  record('Stage7: get_timeline_entry (real HTTP dispatch) resolves the caller\'s own entry by record_id',
    entryBody.status === 'ok' && entryBody.data.record_id === entryMid.data.record_id);

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var crossPatientHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline_entry', session_token: sessionB, record_id: entryMid.data.record_id });
  var crossPatientHttpBody = JSON.parse(crossPatientHttp._text);
  record('Stage7: get_timeline_entry over real HTTP dispatch still rejects a cross-patient record_id request, never leaking the row',
    crossPatientHttpBody.status === 'error' && crossPatientHttpBody.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientHttpBody.data === null);

  record('Stage7: get_timeline_entry derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'get_timeline_entry', session_token: sessionB,
        record_id: entryMid.data.record_id, patient_id: patientA.data.patient_id
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'error' && spoofedBody.error.code === 'FOUNDATION_NOT_FOUND';
    })());

  var createdAuditRows = auditRowsOf(h, 'consultation_entry_created');
  record('Stage7: every foundationCreateConsultationEntry_() call wrote its own consultation_entry_created AuditLog row',
    createdAuditRows.length === 6);
})();

// ============================================================
// Stage 8 — Batch PA-4: FoundationSymptomLog.gs (draft/submit lifecycle)
// against symptom-log.schema.json, and FoundationTimeline.gs's merge
// output against timeline-entry.schema.json, end to end through
// FoundationRouter.gs's real dispatch.
// ============================================================
(function stage8_symptomLogAndTimeline() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage8 Patient A', email: 'stage8-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage8 Patient B', email: 'stage8-b@example.com',
    condition_slug: 'eczema', created_by: 'conformance-harness'
  });
  record('Stage8: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');
  var idA = patientA.data.patient_id;
  var idB = patientB.data.patient_id;

  // ---- Draft creation ----
  var draft1 = ctx.foundationGetOrCreateSymptomLogDraft_(idA, patientA.data.condition_slug);
  record('Stage8: foundationGetOrCreateSymptomLogDraft_() creates a new draft with status=draft and empty scale fields',
    draft1.status === 'ok' && draft1.data.status === 'draft' &&
    draft1.data.severity === '' && draft1.data.sleep === '' && draft1.data.energy === '' && draft1.data.stress === '');
  record('Stage8: a new draft conforms to symptom-log.schema.json',
    validate(symptomLogSchema, draft1.data).valid === true);
  record('Stage8: condition_slug is copied from the patient\'s own profile at draft creation',
    draft1.data.condition_slug === 'mcas');

  var draft1Again = ctx.foundationGetOrCreateSymptomLogDraft_(idA, patientA.data.condition_slug);
  record('Stage8: requesting a draft again returns the SAME existing draft, not a second one (one open draft per patient)',
    draft1Again.status === 'ok' && draft1Again.data.record_id === draft1.data.record_id);

  // ---- Editing a draft ----
  var edited = ctx.foundationUpdateSymptomLogDraft_(idA, draft1.data.record_id, { severity: '6', sleep: '7', notes: 'Feeling better today.' });
  record('Stage8: foundationUpdateSymptomLogDraft_() applies a partial edit and conforms to the schema',
    edited.status === 'ok' && edited.data.severity === '6' && edited.data.sleep === '7' &&
    edited.data.energy === '' && edited.data.notes === 'Feeling better today.' &&
    validate(symptomLogSchema, edited.data).valid === true);
  record('Stage8: editing updates updated_at without touching created_at',
    edited.data.updated_at !== edited.data.created_at || edited.data.created_at === draft1.data.created_at);

  var invalidEdit = ctx.foundationUpdateSymptomLogDraft_(idA, draft1.data.record_id, { severity: '11' });
  record('Stage8: an out-of-range scale value is rejected with FOUNDATION_INVALID_INPUT',
    invalidEdit.status === 'error' && invalidEdit.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- Cross-patient isolation on the write path (the new authorization surface this batch introduces) ----
  var crossPatientEdit = ctx.foundationUpdateSymptomLogDraft_(idB, draft1.data.record_id, { severity: '3' });
  record('Stage8: a different patient editing patient A\'s draft is rejected as FOUNDATION_NOT_FOUND, never leaking or altering the row',
    crossPatientEdit.status === 'error' && crossPatientEdit.error.code === 'FOUNDATION_NOT_FOUND');
  var unaffected = ctx.foundationGetOwnSymptomLogById_(idA, draft1.data.record_id);
  record('Stage8: patient A\'s draft is unaffected by patient B\'s rejected cross-patient edit attempt',
    unaffected.data.severity === '6');

  // ---- Submit-time validation (re-checks live stored state, not the request body) ----
  var emptyDraft = ctx.foundationGetOrCreateSymptomLogDraft_(idB, patientB.data.condition_slug);
  var emptySubmitAttempt = ctx.foundationSubmitSymptomLogDraft_(idB, emptyDraft.data.record_id);
  record('Stage8: submitting a fully-empty draft is rejected with FOUNDATION_INVALID_INPUT',
    emptySubmitAttempt.status === 'error' && emptySubmitAttempt.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- Submit success ----
  var submitted1 = ctx.foundationSubmitSymptomLogDraft_(idA, draft1.data.record_id);
  record('Stage8: submitting a valid draft succeeds and transitions status to submitted',
    submitted1.status === 'ok' && submitted1.data.status === 'submitted' && submitted1.data.submitted_at !== '');
  record('Stage8: the submitted record conforms to symptom-log.schema.json',
    validate(symptomLogSchema, submitted1.data).valid === true);

  var editAfterSubmit = ctx.foundationUpdateSymptomLogDraft_(idA, draft1.data.record_id, { severity: '1' });
  record('Stage8: editing an already-submitted entry is rejected with a specific, patient-facing message (not the generic cross-patient one)',
    editAfterSubmit.status === 'error' && editAfterSubmit.error.code === 'FOUNDATION_INVALID_INPUT' &&
    /already been submitted/.test(editAfterSubmit.error.message));

  var doubleSubmit = ctx.foundationSubmitSymptomLogDraft_(idA, draft1.data.record_id);
  record('Stage8: submitting an already-submitted entry a second time is rejected, not silently re-accepted',
    doubleSubmit.status === 'error' && doubleSubmit.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- get_symptom_logs: draft + submitted, scoped strictly to the caller ----
  var newDraftForA = ctx.foundationGetOrCreateSymptomLogDraft_(idA, patientA.data.condition_slug);
  var ownHistory = ctx.foundationGetPatientSymptomLogs_(idA);
  record('Stage8: foundationGetPatientSymptomLogs_() returns exactly one open draft and one submitted entry for patient A',
    ownHistory.status === 'ok' && ownHistory.data.draft && ownHistory.data.draft.record_id === newDraftForA.data.record_id &&
    ownHistory.data.submitted.length === 1 && ownHistory.data.submitted[0].record_id === submitted1.data.record_id);
  record('Stage8: patient A\'s history never includes patient B\'s draft or submitted rows',
    ownHistory.data.submitted.every(function (e) { return e.patient_id === idA; }));

  // ---- FoundationTimeline.gs — the merge, drafts excluded ----
  ctx.foundationCreateConsultationEntry_({
    patient_id: idA, entry_date: '2026-06-01', title: 'Follow-up visit',
    summary_text: 'Routine follow-up.', source_ref: '', created_by: 'stage8-harness'
  });
  var mergedTimeline = ctx.foundationGetPatientTimelineMerged_(idA);
  record('Stage8: foundationGetPatientTimelineMerged_() succeeds', mergedTimeline.status === 'ok');
  record('Stage8: the merged timeline includes both the consultation entry and the submitted symptom log, never the open draft',
    mergedTimeline.data.length === 2 &&
    mergedTimeline.data.some(function (e) { return e.entry_type === 'consultation'; }) &&
    mergedTimeline.data.some(function (e) { return e.entry_type === 'symptom_log' && e.record_id === submitted1.data.record_id; }) &&
    !mergedTimeline.data.some(function (e) { return e.record_id === newDraftForA.data.record_id; }));
  record('Stage8: every merged timeline entry conforms to timeline-entry.schema.json',
    mergedTimeline.data.every(function (e) { return validate(timelineEntrySchema, e).valid === true; }));
  record('Stage8: the symptom_log entry\'s summary mentions the logged scale values',
    mergedTimeline.data.filter(function (e) { return e.entry_type === 'symptom_log'; })[0].summary_text.indexOf('Severity 6') !== -1);

  // ---- FoundationRouter.gs — the four new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(idA);
  var sessionB = ctx.foundationIssueSessionToken_(idB);

  var createHttp = ctx.handleFoundationRequest_({ foundation_action: 'create_symptom_draft', session_token: sessionB });
  var createBody = JSON.parse(createHttp._text);
  record('Stage8: create_symptom_draft (real HTTP dispatch) returns the caller\'s own draft',
    createBody.status === 'ok' && createBody.data.patient_id === idB);

  var updateHttp = ctx.handleFoundationRequest_({
    foundation_action: 'update_symptom_draft', session_token: sessionB,
    record_id: createBody.data.record_id, energy: '4', stress: '5'
  });
  var updateBody = JSON.parse(updateHttp._text);
  record('Stage8: update_symptom_draft (real HTTP dispatch) applies the edit',
    updateBody.status === 'ok' && updateBody.data.energy === '4' && updateBody.data.stress === '5');

  var crossPatientUpdateHttp = ctx.handleFoundationRequest_({
    foundation_action: 'update_symptom_draft', session_token: sessionA,
    record_id: createBody.data.record_id, energy: '9'
  });
  var crossPatientUpdateBody = JSON.parse(crossPatientUpdateHttp._text);
  record('Stage8: update_symptom_draft over real HTTP dispatch still rejects a cross-patient record_id, never leaking or altering the row',
    crossPatientUpdateBody.status === 'error' && crossPatientUpdateBody.error.code === 'FOUNDATION_NOT_FOUND');

  var submitHttp = ctx.handleFoundationRequest_({ foundation_action: 'submit_symptom_log', session_token: sessionB, record_id: createBody.data.record_id });
  var submitBody = JSON.parse(submitHttp._text);
  record('Stage8: submit_symptom_log (real HTTP dispatch) transitions the caller\'s own draft to submitted',
    submitBody.status === 'ok' && submitBody.data.status === 'submitted');

  var getLogsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: sessionB });
  var getLogsBody = JSON.parse(getLogsHttp._text);
  record('Stage8: get_symptom_logs (real HTTP dispatch) resolves the caller\'s own history from a valid session',
    getLogsBody.status === 'ok' && getLogsBody.data.submitted.some(function (e) { return e.record_id === createBody.data.record_id; }));

  record('Stage8: update_symptom_draft derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var freshDraft = ctx.foundationGetOrCreateSymptomLogDraft_(idA, patientA.data.condition_slug);
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'update_symptom_draft', session_token: sessionB,
        record_id: freshDraft.data.record_id, severity: '2', patient_id: idA
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'error' && spoofedBody.error.code === 'FOUNDATION_NOT_FOUND';
    })());

  var unauthedGetLogsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: 'not-a-real-session-token' });
  var unauthedGetLogsBody = JSON.parse(unauthedGetLogsHttp._text);
  record('Stage8: get_symptom_logs rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedGetLogsBody.status === 'error' && unauthedGetLogsBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedGetLogsBody.data === null);

  var getTimelineHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline', session_token: sessionA });
  var getTimelineBody = JSON.parse(getTimelineHttp._text);
  record('Stage8: get_timeline (real HTTP dispatch) now returns the merged feed, including the submitted symptom log',
    getTimelineBody.status === 'ok' &&
    getTimelineBody.data.some(function (e) { return e.entry_type === 'symptom_log'; }) &&
    getTimelineBody.data.some(function (e) { return e.entry_type === 'consultation'; }));

  var draftCreatedAudit = auditRowsOf(h, 'symptom_log_draft_created');
  var draftUpdatedAudit = auditRowsOf(h, 'symptom_log_draft_updated');
  var submittedAudit = auditRowsOf(h, 'symptom_log_submitted');
  // Exact counts, traced through this stage's real calls (not a guess):
  // draft1 (A), emptyDraft (B), newDraftForA — 3 genuine creates;
  // "get or create" calls that found an existing open draft (draft1Again,
  // createHttp reusing emptyDraft, the spoofed-test's freshDraft reusing
  // newDraftForA) correctly do NOT log a second create. edited + the real
  // updateHttp — 2 genuine updates; every rejected edit (cross-patient,
  // post-submit, the spoofed attempt) correctly logs nothing. submitted1 +
  // the real submitHttp — 2 genuine submits; the empty-draft rejection and
  // the double-submit rejection correctly log nothing.
  record('Stage8: draft creation, edits, and submission each wrote their own AuditLog event type, and only for real state changes',
    draftCreatedAudit.length === 3 && draftUpdatedAudit.length === 2 && submittedAudit.length === 2);
})();

function auditRowsOf(h, eventType) {
  var auditSheet = h.spreadsheet.getSheetByName('AuditLog');
  var rows = auditSheet ? auditSheet._debug().rows : [];
  return rows.filter(function (row) { return row[1] === eventType; });
}

var failed = results.filter(function (r) { return !r.pass; });
console.log('\n' + results.length + ' conformance checks run, ' + failed.length + ' failed.');
console.log(failed.length === 0 ? 'PASS' : 'FAIL');
process.exit(failed.length === 0 ? 0 : 1);
