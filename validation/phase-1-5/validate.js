'use strict';
/**
 * Batch 4G validation run (docs/25-PHASE-1.5-TECHNICAL-PLAN.md §8/§10).
 * Run with: node validate.js  (no dependencies beyond Node's stdlib).
 *
 * Loads the real apps-script/*.gs source through harness.js and drives
 * it through every pipeline stage independently, then the full
 * end-to-end workflow, including the required failure modes: validation
 * failures, AI failures, provider (email) failures, consent failures,
 * review/rejection, and retention partial failures. See
 * validation/phase-1-5/README.md for scope and known limitations.
 */
const { buildSandbox, loadProject } = require('./harness');

let results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
}

const TEST_ACCESS_CODE = 'test-access-code';

function freshRow(overrides) {
  return Object.assign({
    access_code: TEST_ACCESS_CODE,
    condition_slug: 'mcas',
    staff_submitted_note: 'Reviewed symptom diary, discussed dietary trigger avoidance, confirmed supplement schedule.',
    patient_consent_confirmed: true,
    consent_confirmed_by: 'dr.sample@wisehomeopathy.com',
    recipient_email: 'test-patient@example.com'
  }, overrides);
}

function doPostJson(ctx, payload) {
  const e = { postData: { contents: JSON.stringify(payload) } };
  const output = ctx.doPost(e);
  return JSON.parse(output._text);
}

// ============================================================
// STAGE 0 — Existing Tests.gs unit suite, run through the real harness
// ============================================================
(function stage0_existing_unit_suite() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key' } });
  const ctx = loadProject(h.sandbox);
  const ok = ctx.runAllTests_();
  record('Stage0: apps-script/Tests.gs runAllTests_() — all 30 existing unit tests pass', ok === true);
})();

// ============================================================
// STAGE 1 — Staff Submission -> Validation (independent)
// ============================================================
(function stage1() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  const ctx = loadProject(h.sandbox);

  const wrongCode = doPostJson(ctx, freshRow({ access_code: 'wrong-code' }));
  record('Stage1: wrong access_code rejected (401), no row written', wrongCode.status === 401 && h.sheet.getLastRow() === 0,
    JSON.stringify(wrongCode));

  const missingCode = doPostJson(ctx, freshRow({ access_code: undefined }));
  record('Stage1: missing access_code rejected (401), no row written', missingCode.status === 401 && h.sheet.getLastRow() === 0,
    JSON.stringify(missingCode));

  const bad = doPostJson(ctx, freshRow({ patient_consent_confirmed: false }));
  record('Stage1: submission with consent unchecked is rejected (400)', bad.status === 400 && h.sheet.getLastRow() === 0,
    JSON.stringify(bad));

  const badSlug = doPostJson(ctx, freshRow({ condition_slug: 'not-real' }));
  record('Stage1: unknown condition_slug rejected, no row written', badSlug.status === 400 && h.sheet.getLastRow() === 0);

  const malformed = ctx.doPost({ postData: { contents: '{not json' } });
  const malformedBody = JSON.parse(malformed._text);
  record('Stage1: malformed JSON body rejected (400), no row written', malformedBody.status === 400 && h.sheet.getLastRow() === 0);

  const ok = doPostJson(ctx, freshRow());
  record('Stage1: valid submission accepted (200) and writes exactly one row',
    ok.status === 200 && h.sheet.getLastRow() === 2, JSON.stringify(ok));
})();

(function stage1_sheet_write_failure() {
  // §8.3's third named failure mode: "if Sheets write fails" during the
  // initial submission itself (distinct from a later retention/send
  // write failure, covered in Stage4/Stage5).
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  const ctx = loadProject(h.sandbox);
  h.sheet.appendRow = () => { throw new Error('simulated Sheets outage'); };

  const res = doPostJson(ctx, freshRow());
  record('Stage1: initial Sheets write failure returns 500, does not crash, no row visible',
    res.status === 500 && Array.isArray(res.errors), JSON.stringify(res));
})();

// ============================================================
// STAGE 2 — AI Normalization (independent: success + failure)
// ============================================================
(function stage2_success() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  const ctx = loadProject(h.sandbox);
  const res = doPostJson(ctx, freshRow());
  const row = h.sheet._rows[1];
  const draftCol = ctx.SCHEMA_COLUMNS.indexOf('ai_summary_draft');
  record('Stage2: AI success populates ai_summary_draft and reports ai_summary_generated=true',
    res.ai_summary_generated === true && !!row[draftCol]);
})();

(function stage2_failure_missing_key() {
  const h = buildSandbox({ scriptProperties: { STAFF_ACCESS_CODE: 'test-access-code' } }); // no OPENROUTER_API_KEY
  const ctx = loadProject(h.sandbox);
  const res = doPostJson(ctx, freshRow());
  const row = h.sheet._rows[1];
  const draftCol = ctx.SCHEMA_COLUMNS.indexOf('ai_summary_draft');
  const errCol = ctx.SCHEMA_COLUMNS.indexOf('error_log');
  record('Stage2: AI failure (missing key) still writes the row, leaves draft empty, logs error, still returns 200',
    res.status === 200 && res.ai_summary_generated === false && row[draftCol] === '' &&
    String(row[errCol]).indexOf('AI_SUMMARY_FAILED') === 0,
    'error_log=' + row[errCol]);
})();

(function stage2_failure_provider_error() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  h.setUrlFetchImpl(() => ({ getResponseCode: () => 500, getContentText: () => 'upstream error' }));
  const ctx = loadProject(h.sandbox);
  const res = doPostJson(ctx, freshRow());
  const row = h.sheet._rows[1];
  const draftCol = ctx.SCHEMA_COLUMNS.indexOf('ai_summary_draft');
  record('Stage2: AI provider HTTP failure leaves draft empty, submission still succeeds',
    res.status === 200 && res.ai_summary_generated === false && row[draftCol] === '');
})();

// ============================================================
// STAGE 3 — Doctor Review + Gate Evaluation (independent)
// ============================================================
(function stage3_gate_pure() {
  const h = buildSandbox();
  const ctx = loadProject(h.sandbox);
  const approved = { patient_consent_confirmed: true, review_status: ctx.REVIEW_STATUS.APPROVED, ai_summary_draft: 'x', recipient_email: 'a@b.com' };
  record('Stage3: gate passes when approved + consented', ctx.evaluateSendGate_(approved).canSend === true);

  const noConsent = Object.assign({}, approved, { patient_consent_confirmed: false });
  record('Stage3: gate blocks when consent is false even if approved', ctx.evaluateSendGate_(noConsent).canSend === false);

  const notApproved = Object.assign({}, approved, { review_status: ctx.REVIEW_STATUS.PENDING });
  record('Stage3: gate blocks when review_status is pending_review', ctx.evaluateSendGate_(notApproved).canSend === false);
})();

// ============================================================
// STAGE 4 — Email Delivery (independent: success + provider failure)
// ============================================================
(function stage4_email_success() {
  const h = buildSandbox();
  const ctx = loadProject(h.sandbox);
  ctx.getSheet_(); // ensure header row exists before manually appending data rows
  const row = { record_id: 'r1', patient_consent_confirmed: true, review_status: ctx.REVIEW_STATUS.APPROVED,
    ai_summary_draft: 'A plain-language summary.', recipient_email: 'patient@example.com' };
  h.sheet.appendRow(ctx.rowToArray_(Object.assign(ctx.buildRow_({
    condition_slug: 'mcas', staff_submitted_note: 'n', patient_consent_confirmed: true,
    consent_confirmed_by: 'x', recipient_email: 'patient@example.com'
  }), { record_id: 'r1', ai_summary_draft: 'A plain-language summary.', review_status: ctx.REVIEW_STATUS.APPROVED })));

  const result = ctx.attemptSend_(row);
  record('Stage4: attemptSend_ succeeds when gate passes and mail provider succeeds',
    result.sent === true && h.mailLog.length === 1);
  const updated = ctx.getRowObjectByRowIndex_(2);
  record('Stage4: successful send writes email_status=sent and email_sent_at',
    updated.email_status === ctx.EMAIL_STATUS.SENT && !!updated.email_sent_at);

  // Batch WPI-6 (docs/50 Section 9): a successful send also writes a
  // Notification row, in addition to (never instead of) email_status above.
  const notificationRows = h.foundationSpreadsheet._sheetsByName['Notifications']._debug().rows;
  record('Stage4: a successful send also records a Notification row (type visit_summary, status sent, recipient_email set — Phase 1.5 predates Patient Identity)',
    notificationRows.length === 1 && notificationRows[0][4] === 'email' && notificationRows[0][5] === 'visit_summary' &&
    notificationRows[0][6] === 'sent' && notificationRows[0][3] === 'patient@example.com' && notificationRows[0][1] === '' && notificationRows[0][2] === '');
})();

(function stage4_email_failure() {
  const h = buildSandbox();
  h.setMailImpl(() => { throw new Error('simulated MailApp quota exceeded'); });
  const ctx = loadProject(h.sandbox);
  ctx.getSheet_();
  h.sheet.appendRow(ctx.rowToArray_(Object.assign(ctx.buildRow_({
    condition_slug: 'mcas', staff_submitted_note: 'n', patient_consent_confirmed: true,
    consent_confirmed_by: 'x', recipient_email: 'patient@example.com'
  }), { record_id: 'r2', ai_summary_draft: 'A plain-language summary.', review_status: ctx.REVIEW_STATUS.APPROVED })));

  const row = ctx.getRowObjectByRowIndex_(2);
  const result = ctx.attemptSend_(row);
  const updated = ctx.getRowObjectByRowIndex_(2);
  record('Stage4: provider failure logs email_status=failed + error_log, does not throw',
    result.sent === false && updated.email_status === ctx.EMAIL_STATUS.FAILED &&
    String(updated.error_log).indexOf('EMAIL_SEND_FAILED') === 0);

  // Batch WPI-6: a failed send attempt also records a Notification row,
  // status failed — the transport's own real result, never masked.
  const notificationRows = h.foundationSpreadsheet._sheetsByName['Notifications']._debug().rows;
  record('Stage4: a failed send attempt also records a Notification row with status failed',
    notificationRows.length === 1 && notificationRows[0][6] === 'failed');
})();

(function stage4_consent_tampered_blocks_send() {
  const h = buildSandbox();
  const ctx = loadProject(h.sandbox);
  ctx.getSheet_();
  h.sheet.appendRow(ctx.rowToArray_(Object.assign(ctx.buildRow_({
    condition_slug: 'mcas', staff_submitted_note: 'n', patient_consent_confirmed: true,
    consent_confirmed_by: 'x', recipient_email: 'patient@example.com'
  }), { record_id: 'r3', ai_summary_draft: 'draft', review_status: ctx.REVIEW_STATUS.APPROVED,
        patient_consent_confirmed: false }))); // tampered directly

  const row = ctx.getRowObjectByRowIndex_(2);
  const result = ctx.attemptSend_(row);
  record('Stage4: tampered consent (false) blocks send even though review_status=approved',
    result.sent === false && h.mailLog.length === 0);

  // Batch WPI-6: a gate-blocked attempt never even reaches the point where
  // a Notification row would be recorded — no send was ever attempted, so
  // no row exists (the Notifications sheet is never even created).
  record('Stage4: a gate-blocked attempt records no Notification row at all',
    !h.foundationSpreadsheet._sheetsByName['Notifications']);
})();

// ============================================================
// STAGE 5 — Retention (independent: purge, skip, failure, idempotency)
// ============================================================
(function stage5_retention() {
  const h = buildSandbox();
  const ctx = loadProject(h.sandbox);
  ctx.getSheet_();
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  function mkRow(id, daysAgoSent, purged) {
    return Object.assign(ctx.buildRow_({
      condition_slug: 'mcas', staff_submitted_note: 'n', patient_consent_confirmed: true,
      consent_confirmed_by: 'x', recipient_email: id + '@example.com'
    }), {
      record_id: id,
      email_status: ctx.EMAIL_STATUS.SENT,
      email_sent_at: new Date(now - daysAgoSent * DAY).toISOString(),
      purged_at: purged || '',
      staff_submitted_note: 'PROTECTED-NOTE-' + id,
      review_status: ctx.REVIEW_STATUS.APPROVED
    });
  }

  h.sheet.appendRow(ctx.rowToArray_(mkRow('elig', 20, '')));      // eligible
  h.sheet.appendRow(ctx.rowToArray_(mkRow('recent', 3, '')));     // too recent
  h.sheet.appendRow(ctx.rowToArray_(mkRow('already', 40, new Date().toISOString()))); // already purged

  const result1 = ctx.purgeExpiredRecipientEmails_();
  record('Stage5: first purge run purges exactly the eligible row',
    result1.purged === 1 && result1.skipped === 2, JSON.stringify(result1));

  const eligAfter = ctx.getRowObjectByRowIndex_(2);
  record('Stage5: purged row has recipient_email cleared and purged_at stamped',
    eligAfter.recipient_email === '' && !!eligAfter.purged_at);
  record('Stage5: purged row\'s protected staff_submitted_note is untouched',
    eligAfter.staff_submitted_note === 'PROTECTED-NOTE-elig');
  record('Stage5: purged row\'s protected review_status is untouched',
    eligAfter.review_status === ctx.REVIEW_STATUS.APPROVED);

  const recentAfter = ctx.getRowObjectByRowIndex_(3);
  record('Stage5: too-recent row is completely untouched (recipient_email intact)',
    recentAfter.recipient_email === 'recent@example.com' && recentAfter.purged_at === '');

  const result2 = ctx.purgeExpiredRecipientEmails_();
  record('Stage5: second run is idempotent — purges nothing new',
    result2.purged === 0, JSON.stringify(result2));
})();

(function stage5_retention_partial_failure() {
  const h = buildSandbox();
  const ctx = loadProject(h.sandbox);
  ctx.getSheet_();
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  function mkRow(id, daysAgoSent) {
    return Object.assign(ctx.buildRow_({
      condition_slug: 'mcas', staff_submitted_note: 'n', patient_consent_confirmed: true,
      consent_confirmed_by: 'x', recipient_email: id + '@example.com'
    }), {
      record_id: id, email_status: ctx.EMAIL_STATUS.SENT,
      email_sent_at: new Date(now - daysAgoSent * DAY).toISOString()
    });
  }

  h.sheet.appendRow(ctx.rowToArray_(mkRow('good1', 20)));
  h.sheet.appendRow(ctx.rowToArray_(mkRow('bad', 20)));
  h.sheet.appendRow(ctx.rowToArray_(mkRow('good2', 20)));

  // Force updateRowByRecordId_ to throw only for the "bad" row.
  const originalUpdate = ctx.updateRowByRecordId_;
  ctx.updateRowByRecordId_ = function (recordId, fields) {
    if (recordId === 'bad') throw new Error('simulated Sheets write failure');
    return originalUpdate(recordId, fields);
  };

  const result = ctx.purgeExpiredRecipientEmails_();
  record('Stage5: one row failing does not stop the batch — other rows still purge',
    result.purged === 2 && result.failed === 1, JSON.stringify(result));

  const bad = ctx.getRowObjectByRowIndex_(3);
  record('Stage5: the failing row is left completely unmodified (safe partial-failure state)',
    bad.recipient_email === 'bad@example.com' && bad.purged_at === '');
})();

// ============================================================
// STAGE 6 — Full End-to-End Pipeline (success path)
// ============================================================
(function e2e_success() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  const ctx = loadProject(h.sandbox);

  // 1. Staff submission -> validation -> Sheet write -> AI normalization (synchronous, all in doPost)
  const submitRes = doPostJson(ctx, freshRow({ recipient_email: 'e2e-patient@example.com' }));
  record('E2E: submission succeeds and AI draft is generated',
    submitRes.status === 200 && submitRes.ai_summary_generated === true);

  const recordId = submitRes.record_id;
  const afterSubmit = ctx.getRowObjectByRowIndex_(2);
  record('E2E: row after submission is pending_review with a non-empty draft',
    afterSubmit.review_status === ctx.REVIEW_STATUS.PENDING && !!afterSubmit.ai_summary_draft);

  // 2. Doctor review (Sheet-bound custom menu simulation) -> gate evaluation -> email delivery
  h.sandbox.SpreadsheetApp.getActiveSheet = () => h.sheet;
  h.sheet.getActiveCell = () => ({ getRow: () => 2 });
  ctx.approveSelectedRowAsGenerated_();

  const afterReview = ctx.getRowObjectByRowIndex_(2);
  record('E2E: doctor approval writes review_status=approved and reviewed_by',
    afterReview.review_status === ctx.REVIEW_STATUS.APPROVED && afterReview.reviewed_by === 'dr.reviewer@wisehomeopathy.com');
  record('E2E: approval triggers a real send — mail provider was called exactly once',
    h.mailLog.length === 1 && h.mailLog[0].to === 'e2e-patient@example.com');
  record('E2E: email_status=sent and email_sent_at populated after approval',
    afterReview.email_status === ctx.EMAIL_STATUS.SENT && !!afterReview.email_sent_at);
  record('E2E: sent email HTML body embeds the actual AI draft text',
    h.mailLog[0].htmlBody.indexOf(afterReview.ai_summary_draft) !== -1);
  record('E2E: sent email has a non-empty htmlBody and correct subject',
    !!h.mailLog[0].htmlBody && h.mailLog[0].subject === ctx.CONFIG.EMAIL.SUBJECT);

  // Separate, explicit injection check: rebuild the template with a
  // draft containing HTML-special characters and confirm they're escaped.
  const injectionContent = ctx.buildVisitSummaryEmail_({ ai_summary_draft: '<script>alert(1)</script>' });
  record('E2E: email template escapes HTML-special characters in the AI draft',
    injectionContent.htmlBody.indexOf('<script>') === -1 && injectionContent.htmlBody.indexOf('&lt;script&gt;') !== -1);

  // 3. Retention — simulate 20 days later
  const originalDateNow = Date.now;
  const twentyDaysLater = originalDateNow() + 20 * 24 * 60 * 60 * 1000;
  const purgeResult = (function () {
    // isEligibleForPurge_ accepts nowMs explicitly; purgeExpiredRecipientEmails_
    // does not, so monkey-patch Date.now for the duration of this call only,
    // mirroring how the real time-driven trigger would behave 20 days later.
    global.Date.now = () => twentyDaysLater;
    try {
      return ctx.purgeExpiredRecipientEmails_();
    } finally {
      global.Date.now = originalDateNow;
    }
  })();
  record('E2E: retention purges the row 20 days after send', purgeResult.purged === 1, JSON.stringify(purgeResult));

  const afterPurge = ctx.getRowObjectByRowIndex_(2);
  record('E2E: after purge, recipient_email is cleared and purged_at stamped',
    afterPurge.recipient_email === '' && !!afterPurge.purged_at);
  record('E2E: after purge, doctor note, AI draft, and review status remain fully intact',
    afterPurge.staff_submitted_note === freshRow().staff_submitted_note &&
    afterPurge.ai_summary_draft === afterReview.ai_summary_draft &&
    afterPurge.review_status === ctx.REVIEW_STATUS.APPROVED &&
    afterPurge.email_status === ctx.EMAIL_STATUS.SENT);
})();

// ============================================================
// STAGE 7 — Full End-to-End Pipeline (rejection path — no send)
// ============================================================
(function e2e_rejection() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  const ctx = loadProject(h.sandbox);
  doPostJson(ctx, freshRow());
  h.sandbox.SpreadsheetApp.getActiveSheet = () => h.sheet;
  h.sheet.getActiveCell = () => ({ getRow: () => 2 });
  ctx.rejectSelectedRow_();
  const row = ctx.getRowObjectByRowIndex_(2);
  record('E2E rejection: review_status=rejected and no email is ever sent',
    row.review_status === ctx.REVIEW_STATUS.REJECTED && h.mailLog.length === 0 && row.email_status === ctx.EMAIL_STATUS.NOT_SENT);
})();

// ============================================================
// STAGE 8 — Full End-to-End Pipeline (tampered consent blocks send at review time)
// ============================================================
(function e2e_tampered_consent() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  const ctx = loadProject(h.sandbox);
  doPostJson(ctx, freshRow());
  // Simulate staff/doctor manually editing the consent cell directly in the Sheet.
  const consentCol = ctx.SCHEMA_COLUMNS.indexOf('patient_consent_confirmed');
  h.sheet._rows[1][consentCol] = false;

  h.sandbox.SpreadsheetApp.getActiveSheet = () => h.sheet;
  h.sheet.getActiveCell = () => ({ getRow: () => 2 });
  ctx.approveSelectedRowAsGenerated_();

  const row = ctx.getRowObjectByRowIndex_(2);
  record('E2E tampered consent: review_status becomes approved but NO email is sent',
    row.review_status === ctx.REVIEW_STATUS.APPROVED && h.mailLog.length === 0 && row.email_status === ctx.EMAIL_STATUS.NOT_SENT);
})();

// ============================================================
// STAGE 9 (IA-2) — Code.gs's Foundation dispatch shim is additive only
// ============================================================
(function foundationDispatchShim() {
  const h = buildSandbox({ scriptProperties: { OPENROUTER_API_KEY: 'test-key', STAFF_ACCESS_CODE: 'test-access-code' } });
  const calls = [];
  h.setFoundationRouterImpl((input) => {
    calls.push(input);
    return { _text: JSON.stringify({ status: 'ok', data: { stub: true }, error: null }), setMimeType: function () { return this; } };
  });
  const ctx = loadProject(h.sandbox);

  const result = doPostJson(ctx, { foundation_action: 'test_action', email: 'x@example.com' });
  record('Stage9: doPost() hands a foundation_action payload to handleFoundationRequest_ with the parsed input, and returns its result unchanged',
    calls.length === 1 && calls[0].foundation_action === 'test_action' && calls[0].email === 'x@example.com'
    && result.status === 'ok' && result.data.stub === true);
  record('Stage9: dispatching a foundation_action payload never touches Phase 1.5\'s Sheet, access-code gate, or execution log',
    h.sheet.getLastRow() === 0 && h.executionLog.length === 0);

  const normalResult = doPostJson(ctx, freshRow());
  record('Stage9: a normal Phase 1.5 payload (no foundation_action field) still falls through and is processed exactly as before this batch',
    calls.length === 1 && normalResult.record_id && h.sheet.getLastRow() === 2);
})();

// ============================================================
// Summary
// ============================================================
const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(70));
console.log(`${results.length - failed.length}/${results.length} validation checks passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(' - ' + f.name + (f.detail ? ' :: ' + f.detail : '')));
  process.exitCode = 1;
} else {
  console.log('All Batch 4G validation checks passed.');
}
