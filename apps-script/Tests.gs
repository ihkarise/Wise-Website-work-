/**
 * Manual unit tests for pure logic (Validation.gs, Ai.gs's flagDrift_(),
 * Send.gs's evaluateSendGate_(), Email.gs's buildVisitSummaryEmail_()/
 * Utils.gs's escapeHtml_()). No Sheets or network calls — safe to run
 * from the Apps Script editor at any time. attemptSend_() and
 * sendVisitSummaryEmail_() are NOT covered here since they call a real
 * Sheet and mail provider — see apps-script/README.md's manual test
 * steps for those. Run runAllTests_() and check the execution log for
 * FAIL lines.
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
    test_sanitizeTextStripsAngleBrackets_(),
    test_faithfulSummaryHasNoFlags_(),
    test_addedRecommendationIsFlagged_(),
    test_addedDiagnosisIsFlagged_(),
    test_lowOverlapSentenceIsFlagged_(),
    test_sendGatePassesWhenApprovedAndConsented_(),
    test_sendGateBlocksWhenConsentFalse_(),
    test_sendGateBlocksWhenNotApproved_(),
    test_sendGateBlocksWhenDraftEmpty_(),
    test_sendGateBlocksWhenRecipientEmailEmpty_(),
    test_sendGatePassesForEditedAndApproved_(),
    test_escapeHtmlNeutralizesTags_(),
    test_emailBodyEscapesDraftContent_(),
    test_emailBodyUsesConfiguredSubject_()
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

function test_faithfulSummaryHasNoFlags_() {
  var note = 'Discussed symptom diary and dietary trigger avoidance. Next follow-up in 3 weeks.';
  var summary = 'We talked about your symptom diary and dietary trigger avoidance. Your next follow-up is in 3 weeks.';
  var flags = flagDrift_(note, summary);
  return assert_('faithful rephrasing produces no drift flags', flags.length === 0);
}

function test_addedRecommendationIsFlagged_() {
  var note = 'Discussed symptom diary and dietary trigger avoidance.';
  var summary = 'We discussed your symptom diary. We recommend you start a low-histamine diet immediately.';
  var flags = flagDrift_(note, summary);
  return assert_('added recommendation not in note is flagged', flags.some(function (f) { return f.indexOf('recommendation') !== -1; }));
}

function test_addedDiagnosisIsFlagged_() {
  var note = 'Discussed ongoing skin symptoms and follow-up plan.';
  var summary = 'You are diagnosed with chronic urticaria and should follow the plan discussed.';
  var flags = flagDrift_(note, summary);
  return assert_('added diagnosis not in note is flagged', flags.some(function (f) { return f.indexOf('diagnosis') !== -1; }));
}

function test_lowOverlapSentenceIsFlagged_() {
  var note = 'Discussed symptom diary and dietary trigger avoidance.';
  var summary = 'Quantum energy realignment will resolve your condition permanently.';
  var flags = flagDrift_(note, summary);
  return assert_('sentence with near-zero word overlap is flagged', flags.some(function (f) { return f.indexOf('low traceability') !== -1; }));
}

function approvedRow_() {
  return {
    patient_consent_confirmed: true,
    review_status: REVIEW_STATUS.APPROVED,
    ai_summary_draft: 'A plain-language draft summary.',
    recipient_email: 'patient@example.com'
  };
}

function test_sendGatePassesWhenApprovedAndConsented_() {
  var gate = evaluateSendGate_(approvedRow_());
  return assert_('send gate passes when approved and consented', gate.canSend === true);
}

function test_sendGatePassesForEditedAndApproved_() {
  var row = approvedRow_();
  row.review_status = REVIEW_STATUS.EDITED_AND_APPROVED;
  var gate = evaluateSendGate_(row);
  return assert_('send gate passes for edited_and_approved', gate.canSend === true);
}

function test_sendGateBlocksWhenConsentFalse_() {
  var row = approvedRow_();
  row.patient_consent_confirmed = false;
  var gate = evaluateSendGate_(row);
  return assert_('send gate blocks when consent is false, even if approved', gate.canSend === false);
}

function test_sendGateBlocksWhenNotApproved_() {
  var row = approvedRow_();
  row.review_status = REVIEW_STATUS.PENDING;
  var gate = evaluateSendGate_(row);
  return assert_('send gate blocks when review_status is pending_review', gate.canSend === false);
}

function test_sendGateBlocksWhenDraftEmpty_() {
  var row = approvedRow_();
  row.ai_summary_draft = '';
  var gate = evaluateSendGate_(row);
  return assert_('send gate blocks when ai_summary_draft is empty', gate.canSend === false);
}

function test_sendGateBlocksWhenRecipientEmailEmpty_() {
  var row = approvedRow_();
  row.recipient_email = '';
  var gate = evaluateSendGate_(row);
  return assert_('send gate blocks when recipient_email is empty', gate.canSend === false);
}

// buildVisitSummaryEmail_/escapeHtml_ are pure (no MailApp/Sheets calls),
// unlike attemptSend_ and sendVisitSummaryEmail_ — those touch a real
// mail provider and Sheet, so they're covered by the manual test steps
// in apps-script/README.md instead of here.

function test_escapeHtmlNeutralizesTags_() {
  var out = escapeHtml_('<script>alert(1)</script> & "quoted"');
  var safe = out.indexOf('<script>') === -1 && out.indexOf('&lt;script&gt;') !== -1;
  return assert_('escapeHtml_ neutralizes tags and entities', safe);
}

function test_emailBodyEscapesDraftContent_() {
  var row = approvedRow_();
  row.ai_summary_draft = '<b>not from the model</b>';
  var content = buildVisitSummaryEmail_(row);
  var safe = content.htmlBody.indexOf('<b>not from the model</b>') === -1 &&
    content.htmlBody.indexOf('&lt;b&gt;') !== -1;
  return assert_('email body escapes ai_summary_draft before embedding', safe);
}

function test_emailBodyUsesConfiguredSubject_() {
  var content = buildVisitSummaryEmail_(approvedRow_());
  return assert_('email subject matches CONFIG.EMAIL.SUBJECT', content.subject === CONFIG.EMAIL.SUBJECT);
}
