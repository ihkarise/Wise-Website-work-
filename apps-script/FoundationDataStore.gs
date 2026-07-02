/**
 * Foundation-layer data-access abstraction over Google Sheets. This is
 * the only Foundation file that calls SpreadsheetApp for Patient-domain
 * data — every other Foundation module reaches Sheet data only through
 * the functions here (ADR-006, ADR-009). Phase 1.5's own Sheets.gs
 * remains the sole owner of its own data; this file never touches
 * Phase1.5_ConsultationSummaries.
 *
 * Patient-domain data lives in its own spreadsheet, separate from Phase
 * 1.5's, even though the code now shares one Apps Script project
 * (docs/29 §14's Decision 1) — see FoundationConfig.gs's
 * PATIENT_SPREADSHEET_ID.
 *
 * Kept to four operations deliberately (insert/getById/updateById/query)
 * — no query language, no migrations, nothing beyond what Foundation's
 * entities actually need (avoiding over-abstraction at pilot scale).
 */

// ---- Pure helpers — no Apps Script dependency, covered by FoundationTests.gs ----

/**
 * Converts a raw Sheets row (an array, in column order) into an object
 * keyed by the given column names.
 */
function foundationDsRowToObject_(columns, rowArray) {
  var obj = {};
  columns.forEach(function (col, i) {
    obj[col] = rowArray[i] === undefined ? '' : rowArray[i];
  });
  return obj;
}

/**
 * Converts an object into a raw Sheets row (an array, in column order).
 * A missing or null field becomes an empty string, never undefined/null
 * written to a cell.
 */
function foundationDsObjectToRow_(columns, obj) {
  return columns.map(function (col) {
    var v = obj[col];
    return v === undefined || v === null ? '' : v;
  });
}

// ---- Sheets-backed operations — the only functions calling SpreadsheetApp ----

function foundationDsOpenSpreadsheet_() {
  return SpreadsheetApp.openById(FOUNDATION_CONFIG.PATIENT_SPREADSHEET_ID);
}

/**
 * Returns the named sheet, creating it (with a header row matching
 * `columns`) if it doesn't exist yet. If it does exist, refuses to
 * proceed when the live header has drifted from `columns` — fails
 * loudly instead of silently misaligning columns, the same discipline
 * Phase 1.5's Sheets.gs already applies to its own sheet.
 */
function foundationDsGetOrCreateSheet_(sheetName, columns) {
  var ss = foundationDsOpenSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(columns);
    return sheet;
  }
  var lastCol = sheet.getLastColumn() || columns.length;
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var matches = header.length === columns.length
    && columns.every(function (c, i) { return header[i] === c; });
  if (!matches) {
    throw new Error('FoundationDataStore: "' + sheetName + '"\'s live header has drifted from the expected columns.');
  }
  return sheet;
}

function foundationDsInsert_(sheetName, columns, record) {
  var sheet = foundationDsGetOrCreateSheet_(sheetName, columns);
  sheet.appendRow(foundationDsObjectToRow_(columns, record));
}

/**
 * Returns the first row where `idColumn` equals `id`, as an object, or
 * null if no row matches (an expected outcome, not an error — callers
 * decide what "not found" means for them).
 */
function foundationDsGetById_(sheetName, columns, idColumn, id) {
  var sheet = foundationDsGetOrCreateSheet_(sheetName, columns);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var idColIndex = columns.indexOf(idColumn);
  var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][idColIndex] === id) {
      return foundationDsRowToObject_(columns, values[i]);
    }
  }
  return null;
}

/**
 * Patches only the fields present in `patch` on the row where
 * `idColumn` equals `id`. Returns true if a row was found and updated,
 * false otherwise.
 */
function foundationDsUpdateById_(sheetName, columns, idColumn, id, patch) {
  var sheet = foundationDsGetOrCreateSheet_(sheetName, columns);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var idColIndex = columns.indexOf(idColumn);
  var ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      var rowIndex = i + 2;
      Object.keys(patch).forEach(function (key) {
        var colIndex = columns.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(rowIndex, colIndex + 1).setValue(patch[key]);
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * Returns every row (as objects) for which `predicateFn(rowObject)` is
 * truthy.
 */
function foundationDsQuery_(sheetName, columns, predicateFn) {
  var sheet = foundationDsGetOrCreateSheet_(sheetName, columns);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
  var results = [];
  values.forEach(function (row) {
    var obj = foundationDsRowToObject_(columns, row);
    if (predicateFn(obj)) results.push(obj);
  });
  return results;
}
