'use strict';
/**
 * Foundation batch F5 conformance harness — a local, Node-only test
 * tool, mirroring validation/phase-1-5/harness.js's discipline exactly.
 * NOT deployed to Apps Script, NOT loaded by anything under
 * apps-script/. Its only job is to load the real, unmodified
 * Foundation-family .gs source into a mocked Apps Script runtime so
 * conformance.js can exercise the actual committed functions, not a
 * reimplementation of them.
 *
 * Mocks Utilities, PropertiesService, SpreadsheetApp, and Logger — the
 * only Apps Script globals any Foundation-family file touches.
 * `Utilities.computeHmacSha256Signature`/`computeDigest` are backed by
 * Node's real `crypto` module — a faithful mock of standard,
 * well-specified algorithms, not a guess (the same "mock the platform
 * API, run the real logic" discipline validation/phase-1-5/ and
 * Foundation's own F3/F4 ad hoc verification passes already
 * established). `computeDigest` backs `FoundationLoginTokens.gs`'s
 * (IA-1) SHA-256 token hashing.
 *
 * Extended in Identity & Access batch IA-2 with `CacheService` (backing
 * `FoundationRateLimit.gs`'s per-email counters) and `MailApp` (backing
 * `FoundationEmail.gs`'s login-link send) — both simple, faithful
 * in-memory/spy mocks, the same "mock the platform API, run the real
 * logic" discipline already applied to `Utilities`.
 *
 * Extended in Patient Access batch PA-3 with `FoundationConsultationHistory.gs`
 * in the FILES list — no new mock needed, since it only reuses
 * SpreadsheetApp/Utilities/Logger primitives already mocked above.
 *
 * Extended in Patient Access batch PA-4 with `FoundationSymptomLog.gs` and
 * `FoundationTimeline.gs` in the FILES list — again no new mock needed,
 * both reuse only already-mocked primitives.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');

var APPS_SCRIPT_DIR = path.resolve(__dirname, '../../apps-script');
var FILES = [
  'FoundationConfig.gs',
  'FoundationContracts.gs',
  'FoundationErrorHandling.gs',
  'FoundationUtils.gs',
  'FoundationDataStore.gs',
  'FoundationAudit.gs',
  'PatientIdentity.gs',
  'FoundationSession.gs',
  'FoundationRouteGuard.gs',
  'FoundationLoginTokens.gs',
  'FoundationRateLimit.gs',
  'FoundationEmail.gs',
  'FoundationLoginFlow.gs',
  'FoundationConsultationHistory.gs',
  'FoundationSymptomLog.gs',
  'FoundationTimeline.gs',
  'FoundationRouter.gs'
];

// ---------- Fake in-memory Spreadsheet (Patients + AuditLog sheets) ----------
function makeFakeSheet() {
  var header = null;
  var rows = [];
  return {
    getLastColumn: function () { return header ? header.length : 0; },
    getLastRow: function () { return rows.length + 1; },
    getRange: function (r, c, numRows, numCols) {
      return {
        getValues: function () {
          if (r === 1 && numRows === 1) return [header];
          var out = [];
          for (var i = 0; i < numRows; i++) {
            var rowIdx = r - 2 + i;
            out.push(rows[rowIdx] ? rows[rowIdx].slice(c - 1, c - 1 + numCols) : []);
          }
          return out;
        },
        setValue: function (v) { rows[r - 2][c - 1] = v; }
      };
    },
    appendRow: function (rowArray) {
      if (!header) { header = rowArray.slice(); return; }
      rows.push(rowArray.slice());
    },
    _debug: function () { return { header: header, rows: rows }; }
  };
}

function makeFakeSpreadsheet() {
  var sheetsByName = {};
  return {
    getSheetByName: function (name) { return sheetsByName[name] || null; },
    insertSheet: function (name) { var s = makeFakeSheet(); sheetsByName[name] = s; return s; },
    _sheetsByName: sheetsByName
  };
}

// ---------- Build the mocked global environment ----------
function buildSandbox(opts) {
  opts = opts || {};
  var scriptProperties = Object.assign({}, opts.scriptProperties || {});
  var executionLog = [];
  var spreadsheet = makeFakeSpreadsheet();
  var mailLog = [];
  var mailImpl = opts.mailImpl || function () { return true; };
  // A minimal, faithful in-memory CacheService.getScriptCache() mock —
  // ignores the TTL argument (no test in this suite needs real
  // expiration; FoundationRateLimit.gs's own header already documents
  // that a Cache eviction/expiry is a "fails open" scenario, not a
  // correctness-critical one to simulate here).
  var cacheStore = {};

  function toSignedByteArray(buf) {
    var out = [];
    for (var i = 0; i < buf.length; i++) {
      var b = buf[i];
      out.push(b > 127 ? b - 256 : b);
    }
    return out;
  }
  function toUnsignedBuffer(byteArray) {
    return Buffer.from(byteArray.map(function (b) { return b < 0 ? b + 256 : b; }));
  }

  var sandbox = {
    console: console,
    SpreadsheetApp: {
      openById: function () { return spreadsheet; }
    },
    PropertiesService: {
      getScriptProperties: function () {
        return {
          getProperty: function (key) {
            return Object.prototype.hasOwnProperty.call(scriptProperties, key) ? scriptProperties[key] : null;
          },
          setProperty: function (key, val) { scriptProperties[key] = val; }
        };
      }
    },
    Utilities: {
      getUuid: function () { return crypto.randomUUID(); },
      computeHmacSha256Signature: function (data, secret) {
        var digest = crypto.createHmac('sha256', secret).update(data, 'utf8').digest();
        return toSignedByteArray(digest);
      },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: function (algorithm, data) {
        var nodeAlgo = algorithm === 'SHA_256' ? 'sha256' : algorithm;
        var digest = crypto.createHash(nodeAlgo).update(data, 'utf8').digest();
        return toSignedByteArray(digest);
      },
      base64EncodeWebSafe: function (input) {
        var buf = Array.isArray(input) ? toUnsignedBuffer(input) : Buffer.from(String(input), 'utf8');
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      },
      base64DecodeWebSafe: function (str) {
        var normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        return toSignedByteArray(Buffer.from(normalized, 'base64'));
      },
      newBlob: function (input) {
        var buf = Array.isArray(input) ? toUnsignedBuffer(input) : Buffer.from(String(input), 'utf8');
        return {
          getBytes: function () { return toSignedByteArray(buf); },
          getDataAsString: function () { return buf.toString('utf8'); }
        };
      }
    },
    Logger: {
      log: function () {
        var args = Array.prototype.slice.call(arguments);
        executionLog.push(args.join(' '));
      }
    },
    CacheService: {
      getScriptCache: function () {
        return {
          get: function (key) { return Object.prototype.hasOwnProperty.call(cacheStore, key) ? cacheStore[key] : null; },
          put: function (key, value) { cacheStore[key] = String(value); }
        };
      }
    },
    MailApp: {
      sendEmail: function (msg) { mailLog.push(msg); return mailImpl(msg); }
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: function (text) {
        return { _text: text, setMimeType: function () { return this; } };
      }
    },
    Object: Object, JSON: JSON, Date: Date, Array: Array, String: String,
    Number: Number, RegExp: RegExp, Math: Math, Error: Error, isNaN: isNaN
  };
  sandbox.global = sandbox;
  return {
    sandbox: sandbox, spreadsheet: spreadsheet, scriptProperties: scriptProperties,
    executionLog: executionLog, mailLog: mailLog, cacheStore: cacheStore,
    setMailImpl: function (fn) { mailImpl = fn; }
  };
}

function loadProject(sandbox) {
  var ctx = vm.createContext(sandbox);
  FILES.forEach(function (file) {
    var code = fs.readFileSync(path.join(APPS_SCRIPT_DIR, file), 'utf8');
    new vm.Script(code, { filename: file }).runInContext(ctx);
  });
  return ctx;
}

module.exports = { buildSandbox: buildSandbox, loadProject: loadProject, FILES: FILES, APPS_SCRIPT_DIR: APPS_SCRIPT_DIR };
