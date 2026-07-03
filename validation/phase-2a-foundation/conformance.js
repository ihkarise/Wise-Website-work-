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

function auditRowsOf(h, eventType) {
  var auditSheet = h.spreadsheet.getSheetByName('AuditLog');
  var rows = auditSheet ? auditSheet._debug().rows : [];
  return rows.filter(function (row) { return row[1] === eventType; });
}

var failed = results.filter(function (r) { return !r.pass; });
console.log('\n' + results.length + ' conformance checks run, ' + failed.length + ' failed.');
console.log(failed.length === 0 ? 'PASS' : 'FAIL');
process.exit(failed.length === 0 ? 0 : 1);
