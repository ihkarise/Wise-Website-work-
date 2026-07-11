#!/usr/bin/env node
/**
 * Static analysis of every apps-script/*.gs file. Checks: duplicate global
 * names, duplicate constants, duplicate function names, unused exported
 * helpers, circular dependencies, and Apps Script namespace collisions.
 *
 * Introduced by explicit requirement during Foundation Batch F3 — this
 * pass runs before validation on every Foundation batch from F3 onward
 * (docs/29-PHASE-2A-TECHNICAL-PLAN.md §14).
 *
 * No dependencies beyond Node's standard library, matching every other
 * validation tool in this repo (validation/phase-1-5/README.md). Scans
 * the whole apps-script/ project, not just Foundation's files — a
 * collision or a cycle is only meaningful against the actual shared
 * global namespace Apps Script gives one project, which now includes
 * Phase 1.5's files too (docs/29 §14's Decision 1).
 *
 * A note on "exported": Apps Script has no real export/import — every
 * top-level `function`/`var` in a project is implicitly global to that
 * whole project. This tool treats "exported" as "declared at column 0" —
 * the trailing-underscore convention (apps-script/README.md's "A note on
 * trailing underscores") is a human-readability signal, not real access
 * control, so it doesn't change what counts as reachable from elsewhere
 * in the project.
 *
 * A note on why two sections can report the same underlying finding:
 * "duplicate global names" and "Apps Script namespace collisions" are
 * the same detection mechanism, reported under both labels because both
 * were requested explicitly. "Duplicate function names" and "duplicate
 * constants" are that same finding set, filtered by declaration kind.
 * The PASS/FAIL problem count is de-duplicated so the same root cause is
 * never counted more than once — see report()'s comment.
 *
 * A note on how "usage" is detected, and its known limits: this is plain
 * regex/text analysis, not a real parser. Two adjustments were made after
 * this tool's first run against the real codebase produced two false
 * positives, kept here rather than silently fixed so the reasoning is on
 * the record:
 *   1. Comments and string-literal contents are stripped/neutralized
 *      before scanning for call-sites (via a string-aware pass, not a
 *      naive "//"-split — Config.gs's OPENROUTER_API_URL contains "//"
 *      inside a string literal, which a naive stripper would corrupt).
 *      Without this, Email.gs's own header comment ("Send.gs's
 *      evaluateSendGate_()/attemptSend_() never call MailApp...")
 *      registered as a real call to attemptSend_(), producing a false
 *      circular-dependency report (Email.gs -> Send.gs -> Email.gs).
 *   2. A function referenced as a quoted string — Apps Script's
 *      `menu.addItem('label', 'functionName')` pattern, used by
 *      Review.gs's onOpen() — counts as a real usage, not just a literal
 *      `name(` call. Without this, Review.gs's three menu-bound actions
 *      (approveSelectedRowAsGenerated_, approveSelectedRowEdited_,
 *      rejectSelectedRow_) all reported as unused, even though Apps
 *      Script calls them by name at runtime.
 * A third adjustment, made at Batch WPI-10: a function referenced only as a
 * bare identifier *value* inside an object literal (e.g.
 * `AIAssistantContext.gs`'s `FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_BUILDERS_
 * = { care_plan: foundationAiAssistantContextSourceCarePlan_, ... }`, a real
 * dispatch-table pattern this codebase already uses elsewhere, e.g.
 * `doctor-dashboard/dashboard.js`'s own `CAPABILITY_LOADERS`) is a real
 * usage, not dead code — but is neither a `name(` call nor a quoted-string
 * reference, so it fell outside both existing detectors. Rather than widen
 * the general call-site regex (risking new false negatives elsewhere, e.g.
 * matching a bare mention inside an unrelated comment), this is handled the
 * same documented-allowlist way `INFRASTRUCTURE_AHEAD_OF_CONSUMER` already
 * handles its own kind of real-but-undetected usage — see
 * `REFERENCED_ONLY_AS_OBJECT_VALUES` below.
 *
 * Neither adjustment can make this tool a substitute for actually running
 * the code — it narrows false positives, it does not eliminate every
 * possible one (e.g. a function referenced only via a dynamically built
 * string would still be missed).
 *
 * Usage: node validation/static-analysis/analyze.js
 * Exit code 0 if no findings, 1 if any check reports a problem.
 */

'use strict';

var fs = require('fs');
var path = require('path');

var APPS_SCRIPT_DIR = path.join(__dirname, '..', '..', 'apps-script');

// Names Apps Script itself reserves and invokes automatically (simple
// triggers, Web App entry points) — never "unused" even with zero
// textual call-sites in this repo, since the platform itself calls them.
var RESERVED_ENTRY_POINTS = ['doGet', 'doPost', 'onOpen', 'onEdit', 'onInstall'];

// No-underscore functions meant to be run manually from the Apps Script
// editor's dropdown (a human "calls" them by clicking Run — that leaves
// no textual call-site for this tool to find). Extend this list only
// when a new manually-run wrapper is added, with a comment pointing at
// the file that documents why it exists.
var MANUAL_DROPDOWN_WRAPPERS = [
  'runAllTests', // Tests.gs — Phase 1.5's unit test entry point
  'installRetentionTrigger', // Retention.gs — one-time setup step
  'purgeExpiredRecipientEmails', // Retention.gs — manual/scheduled entry point
  'runFoundationTests', // FoundationTests.gs — Foundation's unit test entry point
  'createFoundationPatient', // PatientIdentity.gs — F3's manually-run patient creation
  'createFoundationLoginToken', // FoundationLoginTokens.gs — IA-1's manually-run token creation
  'createFoundationConsultationEntry', // FoundationConsultationHistory.gs — PA-3's manually-run entry creation
  'createFoundationReportForExistingDriveFile', // FoundationReports.gs — PA-5's manually-run staff-attributed upload wrapper
  'assignFoundationCondition', // DoctorAssignedCondition.gs — PXP-2's manually-run doctor/staff assignment tool
  'resolveFoundationCondition', // DoctorAssignedCondition.gs — PXP-2's manually-run doctor/staff resolution tool
  'setFoundationModuleState', // PatientModuleState.gs — PXP-3's manually-run doctor/staff enable/disable tool
  'assignFoundationCheckInTemplate', // CheckInTemplateAssignment.gs — PXP-5's manually-run doctor/staff assignment tool
  'resolveFoundationCheckInTemplateAssignment', // CheckInTemplateAssignment.gs — PXP-5's manually-run doctor/staff resolution tool
  'saveFoundationCarePlan', // CarePlan.gs — PXP-7's manually-run doctor/staff authoring tool
  'createFoundationDoctorInstruction', // DoctorInstruction.gs — PXP-7's manually-run doctor/staff creation tool
  'updateFoundationDoctorInstructionStatus', // DoctorInstruction.gs — PXP-7's manually-run doctor/staff status-transition tool
  'createFoundationDoctor', // DoctorIdentity.gs — WPI-1's manually-run doctor provisioning tool
  'setFoundationDoctorModuleState', // DoctorModuleState.gs — WPI-3's manually-run staff/administrative enable/disable tool
  'createFoundationAppointment', // Appointment.gs — WPI-5's manually-run staff booking-intake tool
  'confirmFoundationAppointment', // Appointment.gs — WPI-5's manually-run doctor/staff confirmation tool
  'updateFoundationAppointmentStatus', // Appointment.gs — WPI-5's manually-run doctor/staff status-transition tool
  'createFoundationInventoryItem', // InventoryItem.gs — WPI-7's manually-run doctor/staff item-creation tool
  'retireFoundationInventoryItem', // InventoryItem.gs — WPI-7's manually-run doctor/staff retirement tool
  'updateFoundationInventoryItemThreshold', // InventoryItem.gs — WPI-7's manually-run doctor/staff threshold-update tool
  'recordFoundationInventoryTransaction', // InventoryTransaction.gs — WPI-7's manually-run doctor/staff transaction-recording tool
  'createFoundationPillFillOrder', // PillFillOrder.gs — WPI-8's manually-run doctor/staff order-creation tool
  'fulfillFoundationPillFillOrder', // PillFillOrder.gs — WPI-8's manually-run doctor/staff fulfillment tool
  'updateFoundationPillFillOrderStatus' // PillFillOrder.gs — WPI-8's manually-run doctor/staff status-transition tool
];

// Underscore-suffixed pure accessor functions, correctly unused *within
// apps-script/* by explicit, disclosed architectural design — a genuinely
// different case from MANUAL_DROPDOWN_WRAPPERS above (a human never "calls"
// these; no future call-site is missing due to an oversight). Every prior
// registry (Module, Calculator, Template) shipped its own first accessor
// function alongside a same-batch consumer that already called it
// (e.g. ModuleRegistry.gs's foundationGetModuleRegistry_() consumed by
// PatientModuleState.gs in the same batch, PXP-3). Batch WPI-2's Specialty
// Registry (docs/50-PHASE-3-TECHNICAL-PLAN.md §6/§19, ADR-018) is the first
// registry whose own batch scope is the mechanism only — no doctor- or
// patient-facing consumer exists yet (the Doctor Dashboard is WPI-3/WPI-4's
// scope) — mirroring Calculator Registry's (PXP-6) own "ships before any
// consumer" precedent one step further. Covered directly by Conformance
// Tests (Stage 18), not by any apps-script/ call-site. Extend this list only
// when a new batch's own registry/lookup accessor genuinely has zero
// same-batch consumer by disclosed design, with a comment naming the batch
// and, if known, the future batch expected to add the first real call-site.
var INFRASTRUCTURE_AHEAD_OF_CONSUMER = [
  'foundationGetSpecialtyRegistry_', // SpecialtyRegistry.gs — WPI-2; first real consumer expected at WPI-3/WPI-4 (Doctor Module Registry / Doctor Dashboard)
  'foundationGetSpecialtyBySlug_', // SpecialtyRegistry.gs — WPI-2; first real consumer expected at WPI-3/WPI-4
  'foundationGetSpecialtyForCondition_', // SpecialtyRegistry.gs — WPI-2; first real consumer expected at WPI-3/WPI-4 (patient-roster/registry specialty filtering, docs/50 §7.4)
  'foundationGetNotificationsForPatient_', // Notification.gs — WPI-6; no FoundationRouter.gs route in this batch by disclosed design (shared/schemas/notification.md's "No route in this batch", mirrors Session's own ownership model per docs/50 §9). Covered directly by Conformance Tests (Stage 22). First real consumer expected once a future dashboard "Messages" module is separately scoped.
  'foundationGetNotificationsForDoctor_' // Notification.gs — WPI-6; same disclosed reason as foundationGetNotificationsForPatient_ above
];

// Functions whose only real call-site is as a bare identifier *value* inside
// an object-literal dispatch table (never a `name(` call, never a quoted
// string) — see this file's own header comment, "A third adjustment." Extend
// this list only when a new batch's own dispatch-table entry is the sole
// reference to a function, with a comment naming the table and the batch.
var REFERENCED_ONLY_AS_OBJECT_VALUES = [
  'foundationAiAssistantContextSourceCarePlan_', // AIAssistantContext.gs — WPI-10; FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_BUILDERS_'s own care_plan entry
  'foundationAiAssistantContextSourceCheckInResponse_', // AIAssistantContext.gs — WPI-10; same table's check_in_response entry
  'foundationAiAssistantContextSourceCalculatorResult_', // AIAssistantContext.gs — WPI-10; same table's calculator_result entry
  'foundationAiAssistantContextSourceAppointment_' // AIAssistantContext.gs — WPI-10; same table's appointment entry
];

function listGsFiles() {
  return fs.readdirSync(APPS_SCRIPT_DIR)
    .filter(function (f) { return f.endsWith('.gs'); })
    .sort();
}

function readFiles(files) {
  var out = {};
  files.forEach(function (f) {
    out[f] = fs.readFileSync(path.join(APPS_SCRIPT_DIR, f), 'utf8');
  });
  return out;
}

/**
 * String-aware comment/string neutralizer. Replaces the *contents* of
 * every comment and every string/template literal with spaces (never
 * removing characters, so line numbers and column positions are
 * unchanged), while leaving real code untouched. This is what
 * distinguishes a real call-site from a mention inside a comment or an
 * incidental "//" inside a URL string.
 */
function neutralizeCommentsAndStrings(source) {
  var out = '';
  var i = 0;
  var n = source.length;
  var inLineComment = false;
  var inBlockComment = false;
  var stringChar = null; // '\'', '"', or '`' while inside that kind of literal

  while (i < n) {
    var c = source[i];
    var next = i + 1 < n ? source[i + 1] : '';

    if (inLineComment) {
      out += (c === '\n') ? c : ' ';
      if (c === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        out += '  ';
        inBlockComment = false;
        i += 2;
        continue;
      }
      out += (c === '\n') ? c : ' ';
      i++;
      continue;
    }
    if (stringChar) {
      if (c === '\\') {
        out += '  ';
        i += 2; // skip the escaped character too
        continue;
      }
      if (c === stringChar) {
        out += c;
        stringChar = null;
        i++;
        continue;
      }
      out += (c === '\n') ? c : ' ';
      i++;
      continue;
    }

    // Not inside a comment or a string right now.
    if (c === '/' && next === '/') { inLineComment = true; out += '  '; i += 2; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') { stringChar = c; out += c; i++; continue; }

    out += c;
    i++;
  }
  return out;
}

// Top-level (column-0) declarations only — matches this codebase's
// existing convention: every module-scope function/var is declared at
// column 0 in both Phase 1.5's and Foundation's files; nested
// declarations are indented and are not part of the shared global
// namespace this tool is checking.
function extractDeclarations(source) {
  var lines = source.split('\n');
  var decls = [];
  lines.forEach(function (line, idx) {
    var fnMatch = line.match(/^function\s+([A-Za-z0-9_]+)\s*\(/);
    if (fnMatch) {
      decls.push({ name: fnMatch[1], kind: 'function', line: idx + 1 });
      return;
    }
    var varMatch = line.match(/^var\s+([A-Za-z0-9_]+)\s*=/);
    if (varMatch) {
      decls.push({ name: varMatch[1], kind: 'var', line: idx + 1 });
    }
  });
  return decls;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyze() {
  var files = listGsFiles();
  var rawSources = readFiles(files);

  // Declarations are extracted from the raw source (a commented-out
  // declaration never starts a line with "function"/"var" at column 0,
  // so this is already safe without neutralizing).
  var declByName = {}; // name -> [{file, kind, line}]
  files.forEach(function (file) {
    extractDeclarations(rawSources[file]).forEach(function (decl) {
      declByName[decl.name] = declByName[decl.name] || [];
      declByName[decl.name].push(Object.assign({ file: file }, decl));
    });
  });

  // Call-site / reference scanning uses the neutralized source — see
  // neutralizeCommentsAndStrings()'s header comment for why. String
  // *literals* are re-scanned separately (on the raw source) to detect
  // Apps Script's menu.addItem('label', 'fnName')-style references,
  // which are a real usage, not noise to strip.
  var neutralizedSources = {};
  files.forEach(function (f) { neutralizedSources[f] = neutralizeCommentsAndStrings(rawSources[f]); });

  var findings = {
    duplicateGlobalNames: [],
    duplicateFunctionNames: [],
    duplicateConstants: [],
    unusedExportedHelpers: [],
    circularDependencies: [],
    namespaceCollisions: [],
    aiAssistantStaticRules: []
  };

  // Duplicate global names / Apps Script namespace collisions.
  Object.keys(declByName).sort().forEach(function (name) {
    var decls = declByName[name];
    if (decls.length > 1) {
      var entry = { name: name, declaredIn: decls.map(function (d) { return d.file + ':' + d.line; }) };
      findings.duplicateGlobalNames.push(entry);
      findings.namespaceCollisions.push(entry);
      if (decls.every(function (d) { return d.kind === 'function'; })) {
        findings.duplicateFunctionNames.push(entry);
      } else if (decls.every(function (d) { return d.kind === 'var'; })) {
        findings.duplicateConstants.push(entry);
      }
    }
  });

  // Unused exported helpers — zero real call-sites (a literal `name(`
  // invocation in real code) and zero quoted-string references (Apps
  // Script menu bindings) anywhere else in the project, excluding
  // reserved entry points and documented manual-dropdown wrappers.
  var allNeutralized = files.map(function (f) { return neutralizedSources[f]; }).join('\n');
  var allRaw = files.map(function (f) { return rawSources[f]; }).join('\n');
  Object.keys(declByName).sort().forEach(function (name) {
    if (declByName[name].length !== 1) return; // duplicates reported separately, not double-counted here
    var decl = declByName[name][0];
    if (decl.kind !== 'function') return;
    if (RESERVED_ENTRY_POINTS.indexOf(name) !== -1) return;
    if (MANUAL_DROPDOWN_WRAPPERS.indexOf(name) !== -1) return;
    if (INFRASTRUCTURE_AHEAD_OF_CONSUMER.indexOf(name) !== -1) return;
    if (REFERENCED_ONLY_AS_OBJECT_VALUES.indexOf(name) !== -1) return;

    var callPattern = new RegExp('\\b' + escapeRegExp(name) + '\\s*\\(', 'g');
    var callMatches = (allNeutralized.match(callPattern) || []).length; // includes the declaration line itself
    var quotedPattern = new RegExp('[\'"]' + escapeRegExp(name) + '[\'"]', 'g');
    var quotedMatches = (allRaw.match(quotedPattern) || []).length;

    if (callMatches + quotedMatches <= 1) {
      findings.unusedExportedHelpers.push({ name: name, file: decl.file, line: decl.line });
    }
  });

  // Circular dependencies — file-level call graph (real call-sites only,
  // via the neutralized source) + cycle detection.
  var fileOfName = {};
  Object.keys(declByName).forEach(function (name) {
    declByName[name].forEach(function (d) { fileOfName[name] = fileOfName[name] || d.file; });
  });

  var graph = {}; // file -> Set(file)
  files.forEach(function (f) { graph[f] = new Set(); });
  files.forEach(function (file) {
    Object.keys(declByName).forEach(function (name) {
      var owner = fileOfName[name];
      if (!owner || owner === file) return;
      var callPattern = new RegExp('\\b' + escapeRegExp(name) + '\\s*\\(', 'g');
      if (callPattern.test(neutralizedSources[file])) {
        graph[file].add(owner);
      }
    });
  });

  var visiting = new Set();
  var visited = new Set();
  var stack = [];

  function dfs(node) {
    if (visiting.has(node)) {
      var cycleStart = stack.indexOf(node);
      findings.circularDependencies.push(stack.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    graph[node].forEach(dfs);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
  files.forEach(dfs);

  // ============================================================
  // AI Assistant static rules (Batch WPI-10, docs/55-WPI-10-AI-ASSISTANT-
  // ARCHITECTURE-FREEZE.md §18) — a new risk class no existing check above
  // covers: AI-generated content reaching a doctor-facing surface. Four
  // rules, each named explicitly by docs/55 §18.
  // ============================================================
  var aiAssistantFiles = files.filter(function (f) { return /^AIAssistant.*\.gs$/.test(f); });

  // ---- Rule 1 (docs/55 §18 item 1) — the load-bearing one behind ADR-022: ----
  // no file matching AIAssistant*.gs may call another entity's write
  // function (save*/create*/update*/record*/fulfill*, including this
  // repo's actual foundationSave*/foundationCreate*/foundationUpdate*/
  // foundationRecord*/foundationFulfill* convention) — only its own.
  var writeCallPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  var writeVerbPattern = /^(?:foundation)?(?:save|create|update|record|fulfill)/i;
  aiAssistantFiles.forEach(function (file) {
    var match;
    writeCallPattern.lastIndex = 0;
    while ((match = writeCallPattern.exec(neutralizedSources[file])) !== null) {
      var calledName = match[1];
      if (!writeVerbPattern.test(calledName)) continue;
      var ownedByAiAssistant = declByName[calledName] && declByName[calledName].some(function (d) {
        return aiAssistantFiles.indexOf(d.file) !== -1;
      });
      if (!ownedByAiAssistant) {
        findings.aiAssistantStaticRules.push({
          rule: 'no-foreign-write-call',
          detail: file + ' calls "' + calledName + '(", a write-shaped function not declared in any AIAssistant*.gs file — ADR-022 requires AI Assistant to never write to any entity beyond its own AIAssistantInteraction row.'
        });
      }
    }
  });

  // ---- Rule 2 (docs/55 §18 item 2) — prompt spec and code stay version-locked ----
  var promptsMdPath = path.join(APPS_SCRIPT_DIR, 'AI-ASSISTANT-PROMPTS.md');
  if (fs.existsSync(promptsMdPath)) {
    var promptsMd = fs.readFileSync(promptsMdPath, 'utf8');
    var docVersionMatch = promptsMd.match(/Prompt Version\s*\n\n`([^`]+)`/);
    var codeVersionMatch = (rawSources['AIAssistantInteraction.gs'] || '').match(/FOUNDATION_AI_ASSISTANT_PROMPT_VERSION_\s*=\s*'([^']+)'/);
    var docVersion = docVersionMatch && docVersionMatch[1];
    var codeVersion = codeVersionMatch && codeVersionMatch[1];
    if (!docVersion || !codeVersion || docVersion !== codeVersion) {
      findings.aiAssistantStaticRules.push({
        rule: 'prompt-version-mismatch',
        detail: 'apps-script/AI-ASSISTANT-PROMPTS.md declares Prompt Version "' + docVersion + '" but apps-script/AIAssistantInteraction.gs\'s FOUNDATION_AI_ASSISTANT_PROMPT_VERSION_ is "' + codeVersion + '" — any prompt wording change must bump both together.'
      });
    }
  }

  // ---- Rule 3 (docs/55 §18 item 3) — every new dispatch case is doctor-guarded only ----
  var routerSource = rawSources['FoundationRouter.gs'] || '';
  ['foundationHandleGetAiAssistantCapabilities_', 'foundationHandlePostAiAssistantQuery_', 'foundationHandlePostAiAssistantDecision_'].forEach(function (handlerName) {
    var declLineIdx = routerSource.split('\n').findIndex(function (line) {
      return line.indexOf('function ' + handlerName + '(') === 0;
    });
    if (declLineIdx === -1) {
      findings.aiAssistantStaticRules.push({ rule: 'doctor-guard-missing', detail: handlerName + ' is not declared in FoundationRouter.gs.' });
      return;
    }
    var lines = routerSource.split('\n');
    var bodyLines = [];
    for (var li = declLineIdx + 1; li < lines.length && lines[li] !== '}'; li++) {
      bodyLines.push(lines[li]);
    }
    var body = bodyLines.join('\n');
    var usesDoctorGuard = /withFoundationDoctorAuth_\s*\(/.test(body);
    var usesPatientGuard = /withFoundationAuth_\s*\(/.test(body);
    if (!usesDoctorGuard || usesPatientGuard) {
      findings.aiAssistantStaticRules.push({
        rule: 'doctor-guard-missing',
        detail: handlerName + ' must call withFoundationDoctorAuth_() and never withFoundationAuth_() (the patient guard) — found doctor guard: ' + usesDoctorGuard + ', patient guard present: ' + usesPatientGuard + '.'
      });
    }
  });

  // ---- Rule 4 (docs/55 §18 item 4) — AssistantContextBuilder never bypasses existing scoped readers ----
  var contextSource = rawSources['AIAssistantContext.gs'] || '';
  var forbiddenDirectPrimitives = ['SpreadsheetApp', 'foundationDsQuery_', 'foundationDsGetById_', 'foundationDsInsert_', 'foundationDsUpdateById_'];
  forbiddenDirectPrimitives.forEach(function (primitive) {
    if (neutralizeCommentsAndStrings(contextSource).indexOf(primitive) !== -1) {
      findings.aiAssistantStaticRules.push({
        rule: 'context-builder-bypasses-scoped-reader',
        detail: 'AIAssistantContext.gs references "' + primitive + '" directly — AssistantContextBuilder may only call already-scoped reader functions (foundationGetDoctorPatientRoster_() and its siblings), never a direct Sheet primitive.'
      });
    }
  });

  return findings;
}

function report(findings) {
  function section(title, items, formatter) {
    console.log('\n' + title + ' (' + items.length + ')');
    if (items.length === 0) {
      console.log('  none found');
      return;
    }
    items.forEach(function (item) { console.log('  ' + formatter(item)); });
  }

  console.log('Static analysis — apps-script/*.gs (' + listGsFiles().length + ' files scanned)');

  section('Duplicate global names', findings.duplicateGlobalNames,
    function (f) { return f.name + ' declared in: ' + f.declaredIn.join(', '); });

  section('  -> filtered to duplicate function names', findings.duplicateFunctionNames,
    function (f) { return f.name + ': ' + f.declaredIn.join(', '); });

  section('  -> filtered to duplicate constants', findings.duplicateConstants,
    function (f) { return f.name + ': ' + f.declaredIn.join(', '); });

  section('Apps Script namespace collisions (same detection as duplicate global names)', findings.namespaceCollisions,
    function (f) { return f.name + ' would collide in the shared project namespace: ' + f.declaredIn.join(', '); });

  section('Unused exported helpers', findings.unusedExportedHelpers,
    function (f) { return f.name + ' (' + f.file + ':' + f.line + ') — zero call-sites or menu references found'; });

  section('Circular dependencies', findings.circularDependencies,
    function (cycle) { return cycle.join(' -> '); });

  section('AI Assistant static rules (Batch WPI-10, docs/55 §18)', findings.aiAssistantStaticRules,
    function (f) { return '[' + f.rule + '] ' + f.detail; });

  // De-duplicated problem count: duplicateFunctionNames/duplicateConstants
  // are subsets of duplicateGlobalNames, and namespaceCollisions is the
  // identical finding set under a second label — none of those three are
  // counted again here, only the three genuinely distinct root causes.
  var problems = findings.duplicateGlobalNames.length
    + findings.unusedExportedHelpers.length
    + findings.circularDependencies.length
    + findings.aiAssistantStaticRules.length;

  console.log('\n' + (problems === 0 ? 'PASS' : 'FAIL') + ' — ' + problems + ' distinct finding(s) across all checks.');
  return problems === 0;
}

if (require.main === module) {
  var ok = report(analyze());
  process.exit(ok ? 0 : 1);
}

module.exports = { analyze: analyze, report: report, neutralizeCommentsAndStrings: neutralizeCommentsAndStrings };
