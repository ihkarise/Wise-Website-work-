/**
 * Apps Script-native unit tests for Foundation's pure-logic functions —
 * no live Sheet or network calls, mirroring Phase 1.5's Tests.gs
 * discipline exactly. Run runFoundationTests() from the Apps Script
 * editor's function dropdown.
 *
 * Covers FoundationContracts.gs's envelope builders (formalizing what
 * batch F2 validated ad hoc in Node into a real, committed, repeatable
 * test), F3's pure helpers (FoundationDataStore.gs's row/object
 * conversion, PatientIdentity.gs's input validation), and F4's pure
 * session/route-guard logic (FoundationSession.gs's payload/expiry/
 * signature-comparison helpers plus a full issue-then-verify round trip
 * against an explicit test secret — never PropertiesService, so this
 * suite stays offline and side-effect-free; see FoundationSession.gs's
 * `WithSecret_` split).
 */

function foundationAssert_(name, condition) {
  return { name: name, pass: !!condition };
}

function runFoundationTests_() {
  var results = [];

  // ---- FoundationContracts.gs ----
  var ok = buildFoundationOkEnvelope_({ x: 1 });
  results.push(foundationAssert_('buildFoundationOkEnvelope_ sets status ok', ok.status === 'ok'));
  results.push(foundationAssert_('buildFoundationOkEnvelope_ carries data', ok.data.x === 1));
  results.push(foundationAssert_('buildFoundationOkEnvelope_ sets error null', ok.error === null));

  var okNoData = buildFoundationOkEnvelope_();
  results.push(foundationAssert_('buildFoundationOkEnvelope_ normalizes missing data to null', okNoData.data === null));

  var err = buildFoundationErrorEnvelope_('SOME_CODE', 'A message');
  results.push(foundationAssert_('buildFoundationErrorEnvelope_ sets status error', err.status === 'error'));
  results.push(foundationAssert_('buildFoundationErrorEnvelope_ sets data null', err.data === null));
  results.push(foundationAssert_('buildFoundationErrorEnvelope_ carries code/message',
    err.error.code === 'SOME_CODE' && err.error.message === 'A message'));

  // ---- FoundationDataStore.gs pure helpers ----
  var cols = ['a', 'b', 'c'];
  var obj = foundationDsRowToObject_(cols, ['1', '2', '3']);
  results.push(foundationAssert_('foundationDsRowToObject_ maps columns to keys',
    obj.a === '1' && obj.b === '2' && obj.c === '3'));

  var row = foundationDsObjectToRow_(cols, { a: '1', c: '3' });
  results.push(foundationAssert_('foundationDsObjectToRow_ orders by columns, blanks missing field',
    row[0] === '1' && row[1] === '' && row[2] === '3'));

  // ---- PatientIdentity.gs pure validation ----
  var validInput = { full_name: 'Jane Doe', email: 'jane@example.com', condition_slug: 'mcas', created_by: 'staff@example.com' };
  results.push(foundationAssert_('foundationValidatePatientInput_ accepts valid input',
    foundationValidatePatientInput_(validInput).length === 0));

  results.push(foundationAssert_('foundationValidatePatientInput_ rejects missing full_name',
    foundationValidatePatientInput_(Object.assign({}, validInput, { full_name: '' })).length > 0));

  results.push(foundationAssert_('foundationValidatePatientInput_ rejects invalid email',
    foundationValidatePatientInput_(Object.assign({}, validInput, { email: 'not-an-email' })).length > 0));

  results.push(foundationAssert_('foundationValidatePatientInput_ rejects missing condition_slug',
    foundationValidatePatientInput_(Object.assign({}, validInput, { condition_slug: '' })).length > 0));

  results.push(foundationAssert_('foundationValidatePatientInput_ rejects missing created_by',
    foundationValidatePatientInput_(Object.assign({}, validInput, { created_by: '' })).length > 0));

  // ---- FoundationSession.gs pure helpers ----
  var FIXED_NOW_MS = Date.parse('2026-07-02T12:00:00.000Z');
  var payload = foundationBuildSessionPayload_('patient-123', FIXED_NOW_MS, 3600);
  results.push(foundationAssert_('foundationBuildSessionPayload_ carries patient_id',
    payload.patient_id === 'patient-123'));
  results.push(foundationAssert_('foundationBuildSessionPayload_ sets issued_at to the given instant',
    payload.issued_at === new Date(FIXED_NOW_MS).toISOString()));
  results.push(foundationAssert_('foundationBuildSessionPayload_ sets expires_at ttlSeconds later',
    payload.expires_at === new Date(FIXED_NOW_MS + 3600 * 1000).toISOString()));

  results.push(foundationAssert_('foundationIsValidSessionPayloadShape_ accepts a well-formed payload',
    foundationIsValidSessionPayloadShape_(payload) === true));
  results.push(foundationAssert_('foundationIsValidSessionPayloadShape_ rejects a missing patient_id',
    foundationIsValidSessionPayloadShape_(Object.assign({}, payload, { patient_id: '' })) === false));
  results.push(foundationAssert_('foundationIsValidSessionPayloadShape_ rejects a null payload',
    foundationIsValidSessionPayloadShape_(null) === false));

  results.push(foundationAssert_('foundationIsSessionExpired_ is false before expires_at',
    foundationIsSessionExpired_(payload, FIXED_NOW_MS + 1000) === false));
  results.push(foundationAssert_('foundationIsSessionExpired_ is true at exactly expires_at',
    foundationIsSessionExpired_(payload, FIXED_NOW_MS + 3600 * 1000) === true));
  results.push(foundationAssert_('foundationIsSessionExpired_ is true well after expires_at',
    foundationIsSessionExpired_(payload, FIXED_NOW_MS + 3601 * 1000) === true));
  results.push(foundationAssert_('foundationIsSessionExpired_ fails closed on an unparsable expires_at',
    foundationIsSessionExpired_({ expires_at: 'not-a-date' }, FIXED_NOW_MS) === true));

  results.push(foundationAssert_('foundationConstantTimeEquals_ accepts identical strings',
    foundationConstantTimeEquals_('abc123', 'abc123') === true));
  results.push(foundationAssert_('foundationConstantTimeEquals_ rejects a one-character difference',
    foundationConstantTimeEquals_('abc123', 'abc124') === false));
  results.push(foundationAssert_('foundationConstantTimeEquals_ rejects a length mismatch',
    foundationConstantTimeEquals_('abc123', 'abc12') === false));

  // ---- FoundationSession.gs full round trip (explicit test secret — never PropertiesService) ----
  var TEST_SECRET = 'foundation-test-secret-not-a-real-key';
  var token = foundationIssueSessionTokenWithSecret_('patient-abc', TEST_SECRET, FIXED_NOW_MS);
  var verifiedFresh = foundationVerifySessionTokenWithSecret_(token, TEST_SECRET, FIXED_NOW_MS + 1000);
  results.push(foundationAssert_('issue-then-verify round trip succeeds within the TTL window',
    verifiedFresh.valid === true && verifiedFresh.patientId === 'patient-abc'));

  var verifiedExpired = foundationVerifySessionTokenWithSecret_(token, TEST_SECRET, FIXED_NOW_MS + 3600 * 1000 + 1000);
  results.push(foundationAssert_('verify rejects a token past its TTL',
    verifiedExpired.valid === false && verifiedExpired.reason === 'expired'));

  var verifiedWrongSecret = foundationVerifySessionTokenWithSecret_(token, 'a-different-secret', FIXED_NOW_MS + 1000);
  results.push(foundationAssert_('verify rejects a token signed with a different secret',
    verifiedWrongSecret.valid === false && verifiedWrongSecret.reason === 'signature_mismatch'));

  var tamperedToken = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A');
  var verifiedTampered = foundationVerifySessionTokenWithSecret_(tamperedToken, TEST_SECRET, FIXED_NOW_MS + 1000);
  results.push(foundationAssert_('verify rejects a tampered signature segment',
    verifiedTampered.valid === false && verifiedTampered.reason === 'signature_mismatch'));

  results.push(foundationAssert_('verify rejects a malformed token (no separator)',
    foundationVerifySessionTokenWithSecret_('not-a-real-token', TEST_SECRET, FIXED_NOW_MS).reason === 'malformed_token'));
  results.push(foundationAssert_('verify rejects a missing token',
    foundationVerifySessionTokenWithSecret_('', TEST_SECRET, FIXED_NOW_MS).reason === 'missing_token'));

  // Note: foundationRequireSession_()/withFoundationAuth_() (FoundationRouteGuard.gs)
  // are not covered here — their rejection path calls foundationLogAuditEvent_(),
  // which touches a live Sheet (FoundationDataStore.gs), the same reason
  // FoundationDataStore.gs's/PatientIdentity.gs's own Sheet-touching functions
  // aren't in this offline suite either. Verified instead by an ad hoc
  // functional pass against a minimal in-memory SpreadsheetApp mock, same
  // discipline batch F3 used for foundationCreatePatient_/foundationGetPatientById_.

  var failures = results.filter(function (r) { return !r.pass; });
  Logger.log(results.length + ' Foundation tests run, ' + failures.length + ' failed.');
  failures.forEach(function (f) { Logger.log('FAILED: ' + f.name); });
  return failures.length === 0;
}

function runFoundationTests() {
  return runFoundationTests_();
}
