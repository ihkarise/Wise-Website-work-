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
 * shared/schemas/symptom-log.schema.json, plus the two new
 * FoundationRouter.gs dispatch cases (log_symptom, get_symptom_logs) end
 * to end — the platform's first patient-*writable* route, so this stage's
 * highest-priority check is cross-patient isolation on both create and
 * list (docs/41 §12), the same authorization boundary already proven for
 * reads, verified here on a write.
 *
 * Extended in Patient Access batch PA-5 with Stage 9, covering
 * FoundationReports.gs against the new shared/schemas/report.schema.json,
 * plus the three new FoundationRouter.gs dispatch cases (upload_report,
 * get_reports, download_report) end to end — the platform's highest-risk
 * feature. Per docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md, this stage's
 * highest-priority checks are: the content-based MIME detection actually
 * rejects a file whose real bytes don't match its declared extension/
 * mime_type (proving the "every mechanism realistically available"
 * decision is real, not just a declared filename check); the server-side
 * size cap is enforced against real decoded bytes regardless of what the
 * client claims; cross-patient isolation on list and download (download
 * additionally proving the ownership check happens before any DriveApp
 * call); **the uploaded file's Drive sharing is verifiably private**
 * (docs/42 §6: "the single most important property to design for and
 * test explicitly in this batch" — a default is not the same as a
 * verified guarantee); and **a Sheets-write failure after a successful
 * Drive write is rolled back** (docs/42 §1/§15's named partial-write
 * failure mode — the platform's first entity spanning two independent
 * storage systems).
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
var reportSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/report.schema.json'), 'utf8'));
var uploadLimits = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'constants/upload-limits.json'), 'utf8'));

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

  // PA-4: schema-validator's new "integer" type and minimum/maximum
  // numeric-bounds support (symptom-log.schema.json's first real need for
  // either) — proven against a tiny local fragment schema, the same
  // "prove the tool before trusting it" discipline as every check above.
  var scaleFragment = { type: 'object', additionalProperties: false, required: ['severity'], properties: { severity: { type: 'integer', minimum: 1, maximum: 10 } } };
  record('Stage0: schema-validator accepts an in-range integer against a type:"integer" schema',
    validate(scaleFragment, { severity: 5 }).valid === true);
  record('Stage0: schema-validator rejects a non-integer number against a type:"integer" schema',
    validate(scaleFragment, { severity: 5.5 }).valid === false);
  record('Stage0: schema-validator rejects an integer below minimum',
    validate(scaleFragment, { severity: 0 }).valid === false);
  record('Stage0: schema-validator rejects an integer above maximum',
    validate(scaleFragment, { severity: 11 }).valid === false);
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
  record('Stage7: get_timeline (real HTTP dispatch) resolves the caller\'s own timeline from a valid session',
    timelineBody.status === 'ok' && timelineBody.data.length === 5 &&
    timelineBody.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));

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
// Stage 8 (PA-4) — FoundationSymptomLog.gs -> symptom-log.schema.json,
// plus FoundationRouter.gs's two new dispatch cases end to end. The
// platform's first patient-writable route.
// ============================================================
(function stage8_symptomLog() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage8 Patient A', email: 'stage8-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage8 Patient B', email: 'stage8-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage8: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  var payload = ctx.foundationBuildSymptomLogRecord_(
    { patient_id: patientA.data.patient_id, severity: 5, sleep: 6, energy: 4, stress: 3, notes: 'Felt a bit tired.', condition_slug: 'mcas' },
    'stage8-fixture-id', '2026-07-01T00:00:00.000Z'
  );
  var payloadResult = validate(symptomLogSchema, payload);
  record('Stage8: foundationBuildSymptomLogRecord_() output conforms to symptom-log.schema.json',
    payloadResult.valid === true, payloadResult.errors.join('; '));

  var missingScales = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5 });
  record('Stage8: foundationCreateSymptomLog_() rejects a partial log (missing sleep/energy/stress) with FOUNDATION_INVALID_INPUT — all four scale fields are mandatory (docs/41 §10 Q1)',
    missingScales.status === 'error' && missingScales.error.code === 'FOUNDATION_INVALID_INPUT');

  var outOfRange = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 11, sleep: 5, energy: 5, stress: 5 });
  record('Stage8: foundationCreateSymptomLog_() rejects an out-of-range scale value (11 > 10)',
    outOfRange.status === 'error' && outOfRange.error.code === 'FOUNDATION_INVALID_INPUT');

  var nonIntegerScale = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5.5, sleep: 5, energy: 5, stress: 5 });
  record('Stage8: foundationCreateSymptomLog_() rejects a non-integer scale value',
    nonIntegerScale.status === 'error' && nonIntegerScale.error.code === 'FOUNDATION_INVALID_INPUT');

  var badSlug = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5, sleep: 5, energy: 5, stress: 5, condition_slug: 'not-a-real-slug' });
  record('Stage8: foundationCreateSymptomLog_() rejects a condition_slug outside the canonical list (shared/constants/condition-slugs.json)',
    badSlug.status === 'error' && badSlug.error.code === 'FOUNDATION_INVALID_INPUT');

  // Three entries for patient A (with distinct logged_at instants, to
  // prove sorting), one for patient B (to prove cross-patient isolation).
  var entryOldest = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 3, sleep: 7, energy: 6, stress: 2, notes: 'Oldest entry.' });
  var entryMiddle = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5, sleep: 6, energy: 5, stress: 4, condition_slug: 'mcas' });
  var entryNewest = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 7, sleep: 4, energy: 3, stress: 6, notes: '<script>alert(1)</script>' });
  var entryOtherPatient = ctx.foundationCreateSymptomLog_({ patient_id: patientB.data.patient_id, severity: 8, sleep: 8, energy: 8, stress: 8 });
  record('Stage8: setup — four real entries created (three for patient A, one for patient B)',
    [entryOldest, entryMiddle, entryNewest, entryOtherPatient].every(function (r) { return r.status === 'ok'; }));

  var createdResult = validate(symptomLogSchema, entryMiddle.data || {});
  record('Stage8: a real foundationCreateSymptomLog_() result conforms to symptom-log.schema.json',
    createdResult.valid === true, createdResult.errors.join('; '));
  record('Stage8: logged_at is server-set, never accepted from a client-supplied field (docs/41 §10 Q2)',
    typeof entryMiddle.data.logged_at === 'string' && entryMiddle.data.logged_at.length > 0);
  record('Stage8: notes is stored raw (unescaped) — escaping happens at display time, the same convention every other free-text field already uses',
    entryNewest.data.notes === '<script>alert(1)</script>');

  // Backdate the two earlier entries directly (same technique Stage 5/7
  // already use) so ordering is provable without relying on real
  // wall-clock timing between three synchronous calls.
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_SYMPTOM_LOGS_SHEET_, ctx.FOUNDATION_SYMPTOM_LOGS_COLUMNS_, 'record_id', entryOldest.data.record_id,
    { logged_at: '2026-01-01T00:00:00.000Z' });
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_SYMPTOM_LOGS_SHEET_, ctx.FOUNDATION_SYMPTOM_LOGS_COLUMNS_, 'record_id', entryMiddle.data.record_id,
    { logged_at: '2026-06-01T00:00:00.000Z' });

  var logs = ctx.foundationGetPatientSymptomLogs_(patientA.data.patient_id);
  record('Stage8: foundationGetPatientSymptomLogs_() succeeds', logs.status === 'ok');
  record('Stage8: the list contains only patient A\'s three entries, never patient B\'s',
    logs.data.length === 3 && logs.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));
  record('Stage8: the list is sorted logged_at descending (newest first), independent of creation order',
    logs.data[0].record_id === entryNewest.data.record_id &&
    logs.data[1].record_id === entryMiddle.data.record_id &&
    logs.data[2].record_id === entryOldest.data.record_id);

  var logsEntryResult = validate(symptomLogSchema, logs.data[0]);
  record('Stage8: a real listed entry conforms to symptom-log.schema.json',
    logsEntryResult.valid === true, logsEntryResult.errors.join('; '));

  // ---- FoundationRouter.gs — the two new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var logSymptomHttp = ctx.handleFoundationRequest_({
    foundation_action: 'log_symptom', session_token: sessionA,
    severity: 6, sleep: 6, energy: 6, stress: 6, notes: 'Via HTTP dispatch.'
  });
  var logSymptomBody = JSON.parse(logSymptomHttp._text);
  record('Stage8: log_symptom (real HTTP dispatch) creates an entry for the caller\'s own session-derived patient_id',
    logSymptomBody.status === 'ok' && logSymptomBody.data.patient_id === patientA.data.patient_id);

  record('Stage8: log_symptom derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'log_symptom', session_token: sessionA, patient_id: 'someone-elses-id',
        severity: 5, sleep: 5, energy: 5, stress: 5
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.patient_id === patientA.data.patient_id;
    })());

  var unauthedLogSymptomHttp = ctx.handleFoundationRequest_({ foundation_action: 'log_symptom', session_token: 'not-a-real-session-token', severity: 5, sleep: 5, energy: 5, stress: 5 });
  var unauthedLogSymptomBody = JSON.parse(unauthedLogSymptomHttp._text);
  record('Stage8: log_symptom rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never writing a row',
    unauthedLogSymptomBody.status === 'error' && unauthedLogSymptomBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedLogSymptomBody.data === null);

  var getSymptomLogsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: sessionA });
  var getSymptomLogsBody = JSON.parse(getSymptomLogsHttp._text);
  record('Stage8: get_symptom_logs (real HTTP dispatch) resolves the caller\'s own entries from a valid session',
    getSymptomLogsBody.status === 'ok' && getSymptomLogsBody.data.length === 5 &&
    getSymptomLogsBody.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var getSymptomLogsHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: sessionB });
  var getSymptomLogsBodyB = JSON.parse(getSymptomLogsHttpB._text);
  record('Stage8: get_symptom_logs over real HTTP dispatch returns only patient B\'s own entry, never patient A\'s, proving cross-patient isolation on the platform\'s first patient-writable route',
    getSymptomLogsBodyB.status === 'ok' && getSymptomLogsBodyB.data.length === 1 && getSymptomLogsBodyB.data[0].patient_id === patientB.data.patient_id);

  var unauthedGetSymptomLogsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: 'not-a-real-session-token' });
  var unauthedGetSymptomLogsBody = JSON.parse(unauthedGetSymptomLogsHttp._text);
  record('Stage8: get_symptom_logs rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedGetSymptomLogsBody.status === 'error' && unauthedGetSymptomLogsBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedGetSymptomLogsBody.data === null);

  var invalidInputHttp = ctx.handleFoundationRequest_({ foundation_action: 'log_symptom', session_token: sessionA, severity: 5 });
  var invalidInputBody = JSON.parse(invalidInputHttp._text);
  record('Stage8: log_symptom over real HTTP dispatch still rejects a partial log with FOUNDATION_INVALID_INPUT',
    invalidInputBody.status === 'error' && invalidInputBody.error.code === 'FOUNDATION_INVALID_INPUT');

  var createdAuditRows = auditRowsOf(h, 'symptom_log_created');
  record('Stage8: every foundationCreateSymptomLog_() call (direct and via HTTP dispatch) wrote its own symptom_log_created AuditLog row',
    createdAuditRows.length === 6);
})();

// ============================================================
// Stage 9 (PA-5) — FoundationReports.gs -> report.schema.json, plus
// FoundationRouter.gs's three new dispatch cases end to end. The
// platform's highest-risk feature (docs/29 §8, §11;
// docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md).
// ============================================================
(function stage9_reports() {
  function pdfBytes(totalSize) {
    var header = Buffer.from('%PDF-1.4\n', 'utf8');
    var fillerSize = Math.max(0, (totalSize || 200) - header.length);
    return Buffer.concat([header, Buffer.alloc(fillerSize, 0x41)]);
  }
  function pngBytes() {
    return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  }
  function plainTextBytes() {
    return Buffer.from('This is just a plain text file, not a real PDF.', 'utf8');
  }
  function b64(buf) { return buf.toString('base64'); }

  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage9 Patient A', email: 'stage9-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage9 Patient B', email: 'stage9-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage9: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  record('Stage9: upload-limits.json\'s max_upload_bytes matches FoundationReports.gs\'s ported constant (shared/README.md\'s conformance discipline)',
    ctx.FOUNDATION_REPORT_MAX_UPLOAD_BYTES_ === uploadLimits.max_upload_bytes);

  // ---- Missing/malformed input, rejected before any byte is decoded ----
  var missingFields = ctx.foundationCreateReport_({ patient_id: patientA.data.patient_id });
  record('Stage9: foundationCreateReport_() rejects missing required fields with FOUNDATION_INVALID_INPUT',
    missingFields.status === 'error' && missingFields.error.code === 'FOUNDATION_INVALID_INPUT');

  var badExtension = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.exe', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes()), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a disallowed filename extension is rejected even with an otherwise-valid PDF payload (extension is a named, non-sole check)',
    badExtension.status === 'error' && badExtension.error.code === 'FOUNDATION_INVALID_INPUT');

  var badDeclaredMime = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/x-msdownload',
    file_base64: b64(pdfBytes()), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a disallowed client-declared mime_type is rejected even with an otherwise-valid PDF payload',
    badDeclaredMime.status === 'error' && badDeclaredMime.error.code === 'FOUNDATION_INVALID_INPUT');

  var malformedBase64 = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/pdf',
    file_base64: 'not-valid-base64!!! ###', uploaded_by: patientA.data.patient_id
  });
  record('Stage9: malformed base64 content is rejected with FOUNDATION_INVALID_INPUT',
    malformedBase64.status === 'error' && malformedBase64.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The real security proof: content-based detection catches what extension/declared-mime cannot ----
  var spoofedType = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/pdf',
    file_base64: b64(plainTextBytes()), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a file whose real bytes are plain text is rejected despite a matching .pdf extension AND a matching declared mime_type — proving content-based detection is a real, independent check, not just named in a comment',
    spoofedType.status === 'error' && spoofedType.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- Size cap enforced against real decoded bytes, never the client's claim ----
  var oversized = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes(ctx.FOUNDATION_REPORT_MAX_UPLOAD_BYTES_ + 1024)), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a file exceeding the configured max_upload_bytes is rejected, measured from the real decoded byte length',
    oversized.status === 'error' && oversized.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- A real, valid upload succeeds end to end ----
  var uploaded = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'Lab Result.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes(300)), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: foundationCreateReport_() succeeds on a real, valid PDF payload', uploaded.status === 'ok', JSON.stringify(uploaded));

  var uploadedResult = validate(reportSchema, uploaded.data || {});
  record('Stage9: foundationCreateReport_() output conforms to report.schema.json',
    uploadedResult.valid === true, uploadedResult.errors.join('; '));
  record('Stage9: the stored mime_type is the server-detected value, not merely an echo of the client-declared one',
    uploaded.data.mime_type === 'application/pdf');
  record('Stage9: size_bytes is the real decoded byte length (300), not any client-supplied number',
    uploaded.data.size_bytes === 300);
  record('Stage9: file_name is preserved verbatim for display, even though it is never used as the Drive object name',
    uploaded.data.file_name === 'Lab Result.pdf');
  record('Stage9: the Drive object is named using record_id alone — never patient_id and never the client-supplied filename (docs/42 §5)',
    h.driveFilesById[uploaded.data.drive_file_id] !== undefined &&
    h.driveFilesById[uploaded.data.drive_file_id].getBlob().getBytes().length === pdfBytes(300).length);

  // ---- docs/42 §6's own named "single most important" test: Drive sharing is verifiably private ----
  var uploadedDriveFile = h.driveFilesById[uploaded.data.drive_file_id];
  record('Stage9: setup — the uploaded report\'s real Drive file object exists in the mock store', !!uploadedDriveFile);
  record('Stage9: the uploaded file\'s Drive sharing access is explicitly PRIVATE — not ANYONE or ANYONE_WITH_LINK (docs/42 §6: "a default is not the same as a verified guarantee")',
    uploadedDriveFile.getSharingAccess() === h.sandbox.DriveApp.Access.PRIVATE &&
    uploadedDriveFile.getSharingAccess() !== h.sandbox.DriveApp.Access.ANYONE &&
    uploadedDriveFile.getSharingAccess() !== h.sandbox.DriveApp.Access.ANYONE_WITH_LINK);
  record('Stage9: the uploaded file\'s Drive sharing permission is explicitly NONE',
    uploadedDriveFile.getSharingPermission() === h.sandbox.DriveApp.Permission.NONE);

  // Second entry for patient A (a PNG, to prove the allowlist covers more
  // than one type) plus one for patient B (cross-patient isolation).
  var uploadedPng = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'scan.png', mime_type: 'image/png',
    file_base64: b64(pngBytes()), uploaded_by: patientA.data.patient_id
  });
  var uploadedForPatientB = ctx.foundationCreateReport_({
    patient_id: patientB.data.patient_id, file_name: 'other-patient.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes()), uploaded_by: patientB.data.patient_id
  });
  record('Stage9: setup — a second report for patient A (PNG) and one for patient B both succeed',
    uploadedPng.status === 'ok' && uploadedForPatientB.status === 'ok');

  // Backdate the first upload so ordering is provable without relying on
  // real wall-clock timing between two synchronous calls (same technique
  // Stage 5/7/8 already use).
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_REPORTS_SHEET_, ctx.FOUNDATION_REPORTS_COLUMNS_, 'record_id', uploaded.data.record_id,
    { uploaded_at: '2026-01-01T00:00:00.000Z' });

  var listA = ctx.foundationGetPatientReports_(patientA.data.patient_id);
  record('Stage9: foundationGetPatientReports_() succeeds', listA.status === 'ok');
  record('Stage9: the list contains only patient A\'s two reports, never patient B\'s',
    listA.data.length === 2 && listA.data.every(function (r) { return r.patient_id === patientA.data.patient_id; }));
  record('Stage9: the list is sorted uploaded_at descending (newest first)',
    listA.data[0].record_id === uploadedPng.data.record_id && listA.data[1].record_id === uploaded.data.record_id);

  var listEntryResult = validate(reportSchema, listA.data[0]);
  record('Stage9: a real listed report conforms to report.schema.json',
    listEntryResult.valid === true, listEntryResult.errors.join('; '));

  // ---- Download: ownership gate before any DriveApp call, real content round-trips ----
  var ownDownload = ctx.foundationDownloadReport_(patientA.data.patient_id, uploaded.data.record_id);
  record('Stage9: foundationDownloadReport_() resolves a patient\'s own report',
    ownDownload.status === 'ok' && ownDownload.data.record_id === uploaded.data.record_id);
  record('Stage9: the downloaded file content round-trips byte-for-byte with what was uploaded',
    Buffer.from(ownDownload.data.file_base64, 'base64').equals(pdfBytes(300)));

  var crossPatientDownload = ctx.foundationDownloadReport_(patientB.data.patient_id, uploaded.data.record_id);
  record('Stage9: a different patient requesting patient A\'s record_id is rejected, never leaking file content',
    crossPatientDownload.status === 'error' && crossPatientDownload.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientDownload.data === null);

  var unknownIdDownload = ctx.foundationDownloadReport_(patientA.data.patient_id, 'this-record-id-was-never-created');
  record('Stage9: an unknown record_id fails with the exact same code/message as a cross-patient attempt (anti-enumeration)',
    unknownIdDownload.status === 'error' && unknownIdDownload.error.code === crossPatientDownload.error.code &&
    unknownIdDownload.error.message === crossPatientDownload.error.message);

  // ---- FoundationRouter.gs — the three new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var uploadHttp = ctx.handleFoundationRequest_({
    foundation_action: 'upload_report', session_token: sessionA,
    file_name: 'via-http.pdf', mime_type: 'application/pdf', file_base64: b64(pdfBytes(150))
  });
  var uploadBody = JSON.parse(uploadHttp._text);
  record('Stage9: upload_report (real HTTP dispatch) creates a report for the caller\'s own session-derived patient_id',
    uploadBody.status === 'ok' && uploadBody.data.patient_id === patientA.data.patient_id && uploadBody.data.uploaded_by === patientA.data.patient_id);

  record('Stage9: upload_report derives patient_id/uploaded_by only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'upload_report', session_token: sessionA, patient_id: 'someone-elses-id', uploaded_by: 'someone-elses-id',
        file_name: 'spoof-attempt.pdf', mime_type: 'application/pdf', file_base64: b64(pdfBytes(150))
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.patient_id === patientA.data.patient_id && spoofedBody.data.uploaded_by === patientA.data.patient_id;
    })());

  var unauthedUploadHttp = ctx.handleFoundationRequest_({ foundation_action: 'upload_report', session_token: 'not-a-real-session-token', file_name: 'x.pdf', mime_type: 'application/pdf', file_base64: b64(pdfBytes()) });
  var unauthedUploadBody = JSON.parse(unauthedUploadHttp._text);
  record('Stage9: upload_report rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never writing a row',
    unauthedUploadBody.status === 'error' && unauthedUploadBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedUploadBody.data === null);

  var getReportsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_reports', session_token: sessionA });
  var getReportsBody = JSON.parse(getReportsHttp._text);
  // 4 so far for patient A: uploaded, uploadedPng (direct calls above),
  // uploadHttp's "via-http.pdf", and the spoofed-patient_id request just
  // above (which still succeeds, against the session-derived patient_id).
  record('Stage9: get_reports (real HTTP dispatch) resolves the caller\'s own reports from a valid session',
    getReportsBody.status === 'ok' && getReportsBody.data.length === 4 && getReportsBody.data.every(function (r) { return r.patient_id === patientA.data.patient_id; }));

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var getReportsHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_reports', session_token: sessionB });
  var getReportsBodyB = JSON.parse(getReportsHttpB._text);
  record('Stage9: get_reports over real HTTP dispatch returns only patient B\'s own report, never patient A\'s',
    getReportsBodyB.status === 'ok' && getReportsBodyB.data.length === 1 && getReportsBodyB.data[0].patient_id === patientB.data.patient_id);

  var downloadHttp = ctx.handleFoundationRequest_({ foundation_action: 'download_report', session_token: sessionA, record_id: uploaded.data.record_id });
  var downloadBody = JSON.parse(downloadHttp._text);
  record('Stage9: download_report (real HTTP dispatch) resolves the caller\'s own report content',
    downloadBody.status === 'ok' && downloadBody.data.record_id === uploaded.data.record_id &&
    Buffer.from(downloadBody.data.file_base64, 'base64').equals(pdfBytes(300)));

  var crossPatientDownloadHttp = ctx.handleFoundationRequest_({ foundation_action: 'download_report', session_token: sessionB, record_id: uploaded.data.record_id });
  var crossPatientDownloadHttpBody = JSON.parse(crossPatientDownloadHttp._text);
  record('Stage9: download_report over real HTTP dispatch still rejects a cross-patient record_id request, never leaking file content',
    crossPatientDownloadHttpBody.status === 'error' && crossPatientDownloadHttpBody.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientDownloadHttpBody.data === null);

  var unauthedDownloadHttp = ctx.handleFoundationRequest_({ foundation_action: 'download_report', session_token: 'not-a-real-session-token', record_id: uploaded.data.record_id });
  var unauthedDownloadHttpBody = JSON.parse(unauthedDownloadHttp._text);
  record('Stage9: download_report rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedDownloadHttpBody.status === 'error' && unauthedDownloadHttpBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedDownloadHttpBody.data === null);

  // ---- No update, no delete — the approved architecture decision, verified as an absence ----
  record('Stage9: no update/delete function exists for Reports (metadata is immutable after upload, per the approved architecture decision)',
    typeof ctx.foundationUpdateReport_ === 'undefined' && typeof ctx.foundationDeleteReport_ === 'undefined');

  // ---- The manually-run staff wrapper — the only staff-attributed path, no Web App route involved ----
  var preExistingFileId = h.seedDriveFile(pngBytes(), null, 'staff-uploaded-scan.png');
  var staffAttached = ctx.foundationCreateReportForExistingDriveFile_({
    patient_id: patientA.data.patient_id, drive_file_id: preExistingFileId,
    file_name: 'Staff-attached scan.png', uploaded_by: 'staff:dr-sharma'
  });
  record('Stage9: foundationCreateReportForExistingDriveFile_() succeeds against a real pre-existing Drive file, without re-uploading it',
    staffAttached.status === 'ok' && staffAttached.data.drive_file_id === preExistingFileId && staffAttached.data.uploaded_by === 'staff:dr-sharma');

  var staffAttachedResult = validate(reportSchema, staffAttached.data || {});
  record('Stage9: the staff-wrapper\'s output also conforms to report.schema.json',
    staffAttachedResult.valid === true, staffAttachedResult.errors.join('; '));

  var staffMissingFields = ctx.foundationCreateReportForExistingDriveFile_({ patient_id: patientA.data.patient_id });
  record('Stage9: foundationCreateReportForExistingDriveFile_() rejects missing required fields with FOUNDATION_INVALID_INPUT',
    staffMissingFields.status === 'error' && staffMissingFields.error.code === 'FOUNDATION_INVALID_INPUT');

  var staffBadType = ctx.foundationCreateReportForExistingDriveFile_({
    patient_id: patientA.data.patient_id, drive_file_id: h.seedDriveFile(plainTextBytes(), null, 'not-really-a-pdf.pdf'),
    file_name: 'Fake.pdf', uploaded_by: 'staff:dr-sharma'
  });
  record('Stage9: the staff wrapper runs the same content-based type check — a non-PDF/JPG/PNG Drive file is rejected',
    staffBadType.status === 'error' && staffBadType.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- docs/42 §1/§15's named partial-write failure mode: Drive succeeds, Sheets fails ----
  // Deliberately corrupt the live 'Reports' sheet's header (the same
  // "mock the platform, run the real logic" technique used throughout
  // this harness) so foundationDsInsert_()'s header-drift check throws —
  // this simulates a Sheets-write failure occurring strictly after the
  // Drive write inside foundationCreateReport_() has already succeeded.
  // Run last in this stage: it deliberately leaves 'Reports' unusable for
  // any further real inserts in this run.
  var driveFileIdsBeforePartialFailure = Object.keys(h.driveFilesById);
  h.spreadsheet.insertSheet(ctx.FOUNDATION_REPORTS_SHEET_).appendRow(['deliberately', 'wrong', 'header']);
  var partialFailureResult = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'partial-failure.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes(150)), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a Sheets-write failure after a successful Drive write is caught and returns the standard generic error envelope, never a raw exception',
    partialFailureResult.status === 'error' && partialFailureResult.error.code === 'FOUNDATION_UNEXPECTED_ERROR');

  var driveFileIdsAfterPartialFailure = Object.keys(h.driveFilesById);
  var orphanCandidateId = driveFileIdsAfterPartialFailure.filter(function (id) { return driveFileIdsBeforePartialFailure.indexOf(id) === -1; })[0];
  record('Stage9: setup — exactly one new Drive file was created by the failed upload attempt (the rollback candidate)',
    driveFileIdsAfterPartialFailure.length === driveFileIdsBeforePartialFailure.length + 1 && !!orphanCandidateId);
  record('Stage9: the Drive file created during the failed upload was rolled back (trashed) rather than left as a silent orphan — rollback is preferred, per the approved decision',
    !!orphanCandidateId && h.driveFilesById[orphanCandidateId].isTrashed() === true);

  var rollbackAuditRows = auditRowsOf(h, 'report_upload_rolled_back');
  record('Stage9: the rollback was audit-logged (report_upload_rolled_back) with the specific record/drive file ids, distinguishable from a normal successful upload',
    !!orphanCandidateId && rollbackAuditRows.some(function (row) { return row[4].indexOf(orphanCandidateId) !== -1; }));
  record('Stage9: no report_upload_orphaned_file event was logged for this run — rollback succeeded, so the "rollback impossible" fallback path was never taken',
    auditRowsOf(h, 'report_upload_orphaned_file').length === 0);

  var createdAuditRows = auditRowsOf(h, 'report_uploaded');
  record('Stage9: every successful upload (direct, via HTTP dispatch, and via the staff wrapper) wrote its own report_uploaded AuditLog row',
    createdAuditRows.length === 6);
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
