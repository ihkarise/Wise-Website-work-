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

/**
 * Updates one or more columns on the row matching recordId, by column
 * name (must exist in SCHEMA_COLUMNS). Used by later pipeline stages
 * (AI summary, review, send, purge) that act on a row Code.gs already
 * wrote via appendRow_ — never re-derives the full row, only patches it.
 */
function updateRowByRecordId_(recordId, fields) {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('No data rows exist yet.');
  }

  var recordIdCol = SCHEMA_COLUMNS.indexOf('record_id') + 1;
  var ids = sheet.getRange(2, recordIdCol, lastRow - 1, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === recordId) {
      targetRow = i + 2; // +1 for header, +1 for 1-indexing
      break;
    }
  }
  if (targetRow === -1) {
    throw new Error('No row found for record_id ' + recordId + '.');
  }

  Object.keys(fields).forEach(function (col) {
    var colIndex = SCHEMA_COLUMNS.indexOf(col);
    if (colIndex === -1) {
      throw new Error('Unknown column "' + col + '" — not in SCHEMA_COLUMNS.');
    }
    sheet.getRange(targetRow, colIndex + 1).setValue(fields[col]);
  });
}
