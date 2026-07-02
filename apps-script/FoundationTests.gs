/**
 * Apps Script-native unit tests for Foundation's pure-logic functions —
 * no live Sheet or network calls, mirroring Phase 1.5's Tests.gs
 * discipline exactly. Run runFoundationTests() from the Apps Script
 * editor's function dropdown.
 *
 * Partial as of batch F3 — covers FoundationContracts.gs's envelope
 * builders (formalizing what batch F2 validated ad hoc in Node into a
 * real, committed, repeatable test) and this batch's pure helpers
 * (FoundationDataStore.gs's row/object conversion,
 * PatientIdentity.gs's input validation). FoundationSession.gs and
 * FoundationRouteGuard.gs's tests are added in batch F4.
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

  var failures = results.filter(function (r) { return !r.pass; });
  Logger.log(results.length + ' Foundation tests run, ' + failures.length + ' failed.');
  failures.forEach(function (f) { Logger.log('FAILED: ' + f.name); });
  return failures.length === 0;
}

function runFoundationTests() {
  return runFoundationTests_();
}
