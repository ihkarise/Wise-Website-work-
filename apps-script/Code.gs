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

  try {
    var row = buildRow_(input);
    var recordId = appendRow_(row);
    logEvent_('submitted', recordId, 'Row written.');
    return jsonResponse_(200, { record_id: recordId });
  } catch (err) {
    logEvent_('failed', null, 'Sheet write error: ' + err.message);
    return jsonResponse_(500, { errors: ['Internal error while saving submission.'] });
  }
}

function doGet(e) {
  return jsonResponse_(405, { errors: ['This endpoint only accepts POST.'] });
}
