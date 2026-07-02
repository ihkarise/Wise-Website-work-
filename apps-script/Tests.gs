/**
 * Manual unit tests for pure logic (Validation.gs, Schema.gs). No Sheets
 * or network calls — safe to run from the Apps Script editor at any time.
 * Run runAllTests_() and check the execution log for FAIL lines.
 *
 * This is a starting point for docs/25 §8.2's "unit-level checks"; Batch
 * 4G is responsible for the full backend testing checklist, including
 * live-Sheet and failure-path cases this file does not cover.
 */

function runAllTests_() {
  var results = [
    test_validSubmissionPasses_(),
    test_missingConsentFails_(),
    test_unknownConditionSlugFails_(),
    test_oversizedNoteFails_(),
    test_invalidEmailFails_(),
    test_sanitizeTextStripsAngleBrackets_()
  ];

  var failures = results.filter(function (r) { return !r.pass; });
  results.forEach(function (r) {
    Logger.log('[test] %s: %s', r.pass ? 'PASS' : 'FAIL', r.name);
  });
  Logger.log('%s/%s tests passed', results.length - failures.length, results.length);
  return failures.length === 0;
}

function assert_(name, condition) {
  return { name: name, pass: !!condition };
}

function validPayload_() {
  return {
    condition_slug: 'mcas',
    staff_submitted_note: 'Discussed follow-up plan and next steps.',
    patient_consent_confirmed: true,
    consent_confirmed_by: 'dr.sample@wisehomeopathy.com',
    recipient_email: 'patient@example.com'
  };
}

function test_validSubmissionPasses_() {
  var result = validateSubmission_(validPayload_());
  return assert_('valid submission passes', result.valid === true && result.errors.length === 0);
}

function test_missingConsentFails_() {
  var payload = validPayload_();
  payload.patient_consent_confirmed = false;
  var result = validateSubmission_(payload);
  return assert_('missing consent fails', result.valid === false);
}

function test_unknownConditionSlugFails_() {
  var payload = validPayload_();
  payload.condition_slug = 'not-a-real-condition';
  var result = validateSubmission_(payload);
  return assert_('unknown condition_slug fails', result.valid === false);
}

function test_oversizedNoteFails_() {
  var payload = validPayload_();
  payload.staff_submitted_note = new Array(CONFIG.LIMITS.STAFF_NOTE_MAX_LENGTH + 2).join('a');
  var result = validateSubmission_(payload);
  return assert_('oversized note fails', result.valid === false);
}

function test_invalidEmailFails_() {
  var payload = validPayload_();
  payload.recipient_email = 'not-an-email';
  var result = validateSubmission_(payload);
  return assert_('invalid email fails', result.valid === false);
}

function test_sanitizeTextStripsAngleBrackets_() {
  var out = sanitizeText_('<script>alert(1)</script>');
  return assert_('sanitizeText_ strips angle brackets', out.indexOf('<') === -1 && out.indexOf('>') === -1);
}
