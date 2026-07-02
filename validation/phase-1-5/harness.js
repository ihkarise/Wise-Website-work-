'use strict';
/**
 * Batch 4G validation harness — a local, Node-only test tool. NOT
 * deployed to Apps Script, NOT part of the production pipeline, and NOT
 * loaded by anything under apps-script/. Its only job is to prove the
 * committed .gs source behaves as designed, without a live Google
 * Workspace deployment.
 *
 * It loads the real apps-script/*.gs source files (unmodified — read
 * from disk and executed as-is) into a mocked Apps Script runtime
 * (SpreadsheetApp, PropertiesService, UrlFetchApp, MailApp, ScriptApp,
 * Session, Logger, ContentService, Utilities) backed by an in-memory
 * fake Sheet, and drives the actual pipeline code through synthetic
 * scenarios end to end.
 *
 * This exercises the real Code.gs/Ai.gs/Sheets.gs/Review.gs/Send.gs/
 * Email.gs/Retention.gs logic exactly as committed — not a
 * reimplementation of it — which is the strongest verification possible
 * without a live deployment. See validation/phase-1-5/README.md for
 * what this does and does not prove.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APPS_SCRIPT_DIR = path.resolve(__dirname, '../../apps-script');
const FILES = [
  'Config.gs', 'Schema.gs', 'Validation.gs', 'Utils.gs', 'Logger.gs',
  'Sheets.gs', 'Ai.gs', 'Send.gs', 'Email.gs', 'Review.gs', 'Retention.gs',
  'Code.gs', 'Tests.gs'
];

// ---------- Fake in-memory Sheet ----------
function makeFakeSheet() {
  const rows = []; // array of arrays, rows[0] is header once written
  return {
    getName: () => 'Phase1.5_ConsultationSummaries',
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    setFrozenRows: () => {},
    appendRow: (arr) => { rows.push(arr.slice()); },
    getRange: (r, c, numRows, numCols) => {
      numRows = numRows || 1;
      numCols = numCols || 1;
      return {
        getValues: () => {
          const out = [];
          for (let i = 0; i < numRows; i++) {
            const rowIdx = r - 1 + i;
            const rowArr = rows[rowIdx] || [];
            const slice = [];
            for (let j = 0; j < numCols; j++) slice.push(rowArr[c - 1 + j] !== undefined ? rowArr[c - 1 + j] : '');
            out.push(slice);
          }
          return out;
        },
        setValue: (val) => { rows[r - 1][c - 1] = val; }
      };
    },
    _rows: rows
  };
}

// ---------- Build the mocked global environment ----------
function buildSandbox(opts) {
  opts = opts || {};
  const sheet = makeFakeSheet();
  const scriptProperties = Object.assign({}, opts.scriptProperties || {});
  const executionLog = [];
  const mailLog = [];
  const triggers = [];
  let urlFetchImpl = opts.urlFetchImpl || defaultOpenRouterMock;
  let mailImpl = opts.mailImpl || function () { return true; };
  let sessionEmail = opts.sessionEmail || 'dr.reviewer@wisehomeopathy.com';

  const sandbox = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => (name === sheet.getName() ? sheet : null),
        insertSheet: () => sheet
      }),
      getActiveSheet: () => sheet,
      getUi: () => ({
        createMenu: () => ({
          addItem: function () { return this; },
          addToUi: () => {}
        }),
        alert: (msg) => { executionLog.push('[UI ALERT] ' + msg); }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => (Object.prototype.hasOwnProperty.call(scriptProperties, key) ? scriptProperties[key] : null),
        setProperty: (key, val) => { scriptProperties[key] = val; },
        deleteProperty: (key) => { delete scriptProperties[key]; }
      })
    },
    UrlFetchApp: {
      fetch: (url, params) => urlFetchImpl(url, params)
    },
    MailApp: {
      sendEmail: (msg) => { mailLog.push(msg); return mailImpl(msg); }
    },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger: (fnName) => {
        const t = { handlerFunction: fnName, getHandlerFunction: () => fnName };
        return {
          timeBased: function () { return this; },
          everyDays: function () { return this; },
          atHour: function () { return this; },
          create: () => { triggers.push(t); return t; }
        };
      }
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => sessionEmail })
    },
    Utilities: {
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2, 10)
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (text) => ({
        _text: text,
        setMimeType: function () { return this; }
      })
    },
    Logger: {
      log: function () {
        const args = Array.prototype.slice.call(arguments);
        executionLog.push(args.join(' '));
      }
    },
    Object, JSON, Date, Array, String, Number, RegExp, Math, Error, isNaN
  };
  sandbox.global = sandbox;
  return { sandbox, sheet, scriptProperties, executionLog, mailLog, triggers,
    setUrlFetchImpl: (fn) => { urlFetchImpl = fn; },
    setMailImpl: (fn) => { mailImpl = fn; },
    setSessionEmail: (email) => { sessionEmail = email; } };
}

function defaultOpenRouterMock(url, params) {
  const body = JSON.parse(params.payload);
  const note = body.messages[1].content;
  // Faithful, boring "AI" stand-in: normalize without adding content.
  const summary = 'Summary: ' + note.slice(0, 200);
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ choices: [{ message: { content: summary } }] })
  };
}

function loadProject(sandbox) {
  const ctx = vm.createContext(sandbox);
  for (const file of FILES) {
    const code = fs.readFileSync(path.join(APPS_SCRIPT_DIR, file), 'utf8');
    new vm.Script(code, { filename: file }).runInContext(ctx);
  }
  return ctx;
}

module.exports = { buildSandbox, loadProject, FILES, APPS_SCRIPT_DIR };
