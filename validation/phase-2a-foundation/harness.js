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
 * Extended in Patient Access batch PA-4 with `FoundationSymptomLog.gs` in
 * the FILES list — again no new mock needed, for the same reason.
 *
 * Extended in Patient Access batch PA-5 with `FoundationReports.gs` in the
 * FILES list, plus new mocks it actually needs — the first entirely new
 * platform primitive this harness has had to mock (docs/42-REPORTS-UPLOAD-
 * READINESS-REVIEW.md §5: "a repository-wide search confirms zero existing
 * use of DriveApp anywhere in apps-script/"):
 *   - `DriveApp` — `getFolderById()`/`createFile()`/`getFileById()`, a
 *     simple in-memory file store, PLUS `setSharing()`/`getSharingAccess()`/
 *     `getSharingPermission()` and `setTrashed()`/`isTrashed()`. The
 *     sharing/trash surface exists specifically so
 *     `validation/phase-2a-foundation/conformance.js`'s Stage 9 can
 *     directly assert two properties docs/42 names as this batch's most
 *     important ones to verify, not just design for: that a created
 *     report's Drive file is actually private (§6, "a default is not the
 *     same as a verified guarantee"), and that a Sheets-write failure
 *     after a successful Drive write is actually rolled back (§1/§15's
 *     named partial-failure mode), not merely assumed handled.
 *   - `Utilities.base64Decode`/`base64Encode` (the standard, non-web-safe
 *     alphabet — real file uploads are not URL-safe-encoded, unlike
 *     `FoundationSession.gs`'s token segments).
 *   - `Utilities.newBlob()`'s content-type parameter, plus a best-effort
 *     magic-byte content-type *detection* for when no content type is
 *     supplied. Disclosed here, deliberately, as an approximation: real
 *     Apps Script's `Utilities.newBlob(data)` is documented to "attempt to
 *     determine the correct extension and content-type of the data based
 *     on the structure of the byte array," but the exact algorithm is not
 *     independently specified beyond that sentence, and this repository
 *     has not verified the real platform's behavior against a live
 *     deployment (docs/42 §11's own named open item, still open — see
 *     shared/constants/upload-limits.md). This mock recognizes the three
 *     real magic-byte signatures Batch PA-5 actually needs (PDF, JPEG,
 *     PNG) and falls back to `application/octet-stream` otherwise, the
 *     same "mock the platform API, run the real logic" discipline as every
 *     other mock in this file, but with its one genuine uncertainty named
 *     rather than silently assumed identical to the real platform.
 *
 * Extended in Phase 2B batch PXP-1 with `FoundationPatientProfile.gs` in
 * the FILES list — no new mock needed, since it only reuses
 * SpreadsheetApp/Utilities/Logger primitives already mocked above,
 * including a real production exercise of `foundationDsUpdateById_()`
 * (previously only used by `FoundationLoginTokens.gs`'s system-managed
 * `used_at` patch and this harness's own test fixtures) for a genuinely
 * patient-driven field update.
 *
 * Extended in Phase 2B batch PXP-2 with `DoctorAssignedCondition.gs` in the
 * FILES list — no new mock needed, since it only reuses SpreadsheetApp/
 * Utilities/Logger primitives already mocked above.
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
  'FoundationReports.gs',
  'FoundationPatientProfile.gs',
  'DoctorAssignedCondition.gs',
  'ModuleRegistry.gs',
  'PatientModuleState.gs',
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

  // Best-effort magic-byte content-type detection — see this file's own
  // header comment for the disclosed uncertainty this approximates (real
  // Apps Script's exact newBlob() detection algorithm is not
  // independently specified, and has not been verified against a live
  // deployment for this repository). Recognizes only the three
  // signatures Batch PA-5 actually needs; anything else falls back to
  // Apps Script's own documented default for unrecognized binary data.
  function detectMimeTypeFromBytes(buf) {
    if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) { // '%PDF'
      return 'application/pdf';
    }
    if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) { // JPEG SOI marker
      return 'image/jpeg';
    }
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
      && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) { // PNG signature
      return 'image/png';
    }
    return 'application/octet-stream';
  }

  // ---------- Fake in-memory Drive (Reports' binary storage) ----------
  // Real Apps Script default: a file created by DriveApp.createFile() is
  // private to the script's own Drive, not "anyone"/"anyone with the
  // link" — this mock starts every file at PRIVATE/NONE to match, but
  // FoundationReports.gs's foundationEnsureReportFilePrivate_() still
  // explicitly calls setSharing() rather than relying on this default
  // (docs/42 §6: "a default is not the same as a verified guarantee") —
  // this mock's own default is deliberately not the only thing Stage 9's
  // privacy assertion depends on.
  var driveFilesById = {};
  var driveFileCounter = 0;
  function makeFakeDriveFile(blob) {
    driveFileCounter++;
    var id = 'fake-drive-file-' + driveFileCounter;
    var trashed = false;
    var sharingAccess = 'PRIVATE';
    var sharingPermission = 'NONE';
    var file = {
      getId: function () { return id; },
      getBlob: function () { return blob; },
      setSharing: function (access, permission) { sharingAccess = access; sharingPermission = permission; return file; },
      getSharingAccess: function () { return sharingAccess; },
      getSharingPermission: function () { return sharingPermission; },
      setTrashed: function (value) { trashed = !!value; return file; },
      isTrashed: function () { return trashed; }
    };
    driveFilesById[id] = file;
    return file;
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
      // Standard (non-web-safe) alphabet — Batch PA-5's uploaded file
      // content is not URL-safe-encoded, unlike FoundationSession.gs's
      // token segments.
      base64Encode: function (input) {
        var buf = Array.isArray(input) ? toUnsignedBuffer(input) : Buffer.from(String(input), 'utf8');
        return buf.toString('base64');
      },
      base64Decode: function (str) {
        return toSignedByteArray(Buffer.from(String(str), 'base64'));
      },
      newBlob: function (input, contentType, name) {
        var buf = Array.isArray(input) ? toUnsignedBuffer(input) : Buffer.from(String(input), 'utf8');
        var resolvedType = contentType || detectMimeTypeFromBytes(buf);
        return {
          getBytes: function () { return toSignedByteArray(buf); },
          getDataAsString: function () { return buf.toString('utf8'); },
          getContentType: function () { return resolvedType; },
          getName: function () { return name || null; }
        };
      }
    },
    DriveApp: {
      Access: { ANYONE: 'ANYONE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' },
      Permission: { NONE: 'NONE', VIEW: 'VIEW' },
      getFolderById: function () {
        return {
          createFile: function (blob) { return makeFakeDriveFile(blob); }
        };
      },
      getFileById: function (id) {
        var file = driveFilesById[id];
        if (!file) {
          throw new Error('DriveApp mock: no such file id "' + id + '"');
        }
        return file;
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
    setMailImpl: function (fn) { mailImpl = fn; },
    // Exposed so conformance.js can directly assert Drive-file
    // sharing/trash state (docs/42 §6/§15's named required checks) and
    // seed a "pre-existing Drive file" fixture for the staff-wrapper path
    // (createFoundationReportForExistingDriveFile_()), which reads a file
    // that was never created through foundationCreateReport_()'s own
    // folder.createFile() call.
    driveFilesById: driveFilesById,
    seedDriveFile: function (bytes, contentType, name) {
      var signedBytes = Buffer.isBuffer(bytes) ? toSignedByteArray(bytes) : bytes;
      var blob = sandbox.Utilities.newBlob(signedBytes, contentType, name);
      return makeFakeDriveFile(blob).getId();
    }
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
