/**
 * The only module that touches SpreadsheetApp. No other file in this
 * project should reference SpreadsheetApp directly — route all Sheet
 * access through here so the write path stays auditable in one place.
 */

function getSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CONFIG.SHEET_NAME);
  }
  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SCHEMA_COLUMNS);
    sheet.setFrozenRows(1);
    return;
  }

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var matches = header.length === SCHEMA_COLUMNS.length &&
    SCHEMA_COLUMNS.every(function (col, i) { return header[i] === col; });

  if (!matches) {
    throw new Error(
      'Sheet header does not match SCHEMA_COLUMNS. Refusing to write ' +
      '(schema drift — reconcile the Sheet header manually before resuming writes).'
    );
  }
}

function appendRow_(row) {
  var sheet = getSheet_();
  sheet.appendRow(rowToArray_(row));
  return row.record_id;
}
