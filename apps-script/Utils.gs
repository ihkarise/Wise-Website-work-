/**
 * Small, stateless helpers shared across modules. Nothing here should
 * depend on CONFIG, Sheets, or any other module — keep it leaf-level.
 */

/**
 * NOTE: Apps Script Web Apps cannot set a real HTTP status code — every
 * doPost/doGet response is transported as HTTP 200 regardless of the
 * `status` value below. Callers (later batches' forms, curl, tests) must
 * parse the JSON body and branch on this field explicitly; checking the
 * transport-level HTTP status will always read 200, even on failure.
 */
function jsonResponse_(statusCode, body) {
  var payload = Object.assign({ status: statusCode }, body);
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
