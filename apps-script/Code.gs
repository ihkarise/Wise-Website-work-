/**
 * Web App entry point. Keep this file thin — it wires modules together
 * in order (parse -> sanitize -> validate -> persist -> log) and holds
 * no business logic of its own.
 */

function doPost(e) {
  var input;
  try {
    input = JSON.parse(e.postData.contents);
  } catch (err) {
    logEvent_('failed', null, 'Malformed JSON payload.');
    return jsonResponse_(400, { errors: ['Request body must be valid JSON.'] });
  }

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
      logEvent_('summarized', recordId, 'Draft written. Flags: ' + aiResult.flags.length);
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
