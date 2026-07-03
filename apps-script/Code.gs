/**
 * Web App entry point. Keep this file thin — it wires modules together
 * in order (parse -> sanitize -> validate -> persist -> log) and holds
 * no business logic of its own.
 *
 * Foundation/Phase 1.5 dispatch boundary (docs/29 §14 Decision 1 locked
 * one shared Apps Script project, not a separate one, for all Phase 2A
 * backend work — and Google Apps Script permits exactly one global
 * doPost() per project, so a second, independently-routable HTTP entry
 * point cannot exist alongside this one). `foundation_action` is a
 * marker field Phase 1.5's own payload shape never uses (see
 * Validation.gs's full field list: access_code, condition_slug,
 * staff_submitted_note, patient_consent_confirmed, consent_confirmed_by,
 * recipient_email — no collision). Its presence hands the entire request
 * to FoundationRouter.gs's handleFoundationRequest_(), unchanged,
 * *before* any Phase 1.5-specific parsing, sanitizing, or access-code
 * check runs — Foundation's routes have their own, entirely different
 * authentication model (a session token or none at all for the
 * necessarily-public request-link step, docs/29 §3), not
 * STAFF_ACCESS_CODE. Its absence falls through to every line below,
 * unchanged, exactly as this function behaved before IA-2. This is the
 * one, deliberately narrow exception to "never modifying Phase 1.5's
 * existing files" — see apps-script/README.md's "Foundation/Phase 1.5
 * dispatch boundary" section for the fuller reasoning and the
 * alternative considered (a second Apps Script project) and not taken.
 */

function doPost(e) {
  var input;
  try {
    input = JSON.parse(e.postData.contents);
  } catch (err) {
    logEvent_('failed', null, 'Malformed JSON payload.');
    return jsonResponse_(400, { errors: ['Request body must be valid JSON.'] });
  }

  if (input && typeof input.foundation_action === 'string') {
    return handleFoundationRequest_(input);
  }

  if (!verifyAccessCode_(input && input.access_code)) {
    logEvent_('unauthorized', null, 'Missing or invalid staff access code.');
    return jsonResponse_(401, { errors: ['Invalid access code.'] });
  }
  delete input.access_code;

  if (input && typeof input.staff_submitted_note === 'string') {
    input.staff_submitted_note = sanitizeText_(input.staff_submitted_note);
  }

  var validation = validateSubmission_(input);
  if (!validation.valid) {
    logEvent_('failed', null, validation.errors.join('; '));
    return jsonResponse_(400, { errors: validation.errors });
  }

  var recordId;
  try {
    var row = buildRow_(input);
    recordId = appendRow_(row);
    logEvent_('submitted', recordId, 'Row written.');
  } catch (err) {
    logEvent_('failed', null, 'Sheet write error: ' + err.message);
    return jsonResponse_(500, { errors: ['Internal error while saving submission.'] });
  }

  // AI summarization runs synchronously in the same execution (docs/25
  // §9.5, locked). A failure here does not undo the row write above —
  // the submission already succeeded; the draft is simply left empty
  // and the failure is logged for the doctor reviewer to see.
  var aiResult = summarizeNote_(input.staff_submitted_note);
  if (aiResult.ok) {
    try {
      updateRowByRecordId_(recordId, {
        ai_summary_draft: aiResult.summary,
        ai_model_used: aiResult.model,
        error_log: aiResult.flags.length > 0
          ? 'AI_REVIEW_FLAGS: ' + aiResult.flags.join(' | ')
          : ''
      });
      logEvent_('summarized', recordId, 'Draft written (prompt v' + PROMPT_VERSION_ + '). Flags: ' + aiResult.flags.length);
    } catch (err) {
      logEvent_('failed', recordId, 'Could not write AI summary: ' + err.message);
    }
  } else {
    logEvent_('failed', recordId, 'AI summarization failed: ' + aiResult.error);
    try {
      updateRowByRecordId_(recordId, { error_log: 'AI_SUMMARY_FAILED: ' + aiResult.error });
    } catch (err) {
      logEvent_('failed', recordId, 'Could not log AI failure: ' + err.message);
    }
  }

  return jsonResponse_(200, { record_id: recordId, ai_summary_generated: aiResult.ok });
}

function doGet(e) {
  return jsonResponse_(405, { errors: ['This endpoint only accepts POST.'] });
}
