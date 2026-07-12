/**
 * Holoscan Recognition Check — Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-
 * FREEZE.md §10.2, ADR-005/ADR-024/ADR-025, docs/53-PHASE-3-IMPLEMENTATION-RULES.md
 * governs this batch). `HoloscanRecognitionCheck_()` is the independent, code-level half
 * of ADR-005's three-part supervision pattern (prompt-level constraint + independent
 * code-level check + mandatory human review), applied to Holoscan's own extracted
 * fields — structurally mirroring `apps-script/AIAssistantDriftCheck.gs`'s
 * `AssistantDriftCheck_()` exactly, adapted from a single free-text draft to a set of
 * short, independently-nullable extracted fields (docs/56 §7.2/§10.2).
 *
 * A category lexicon — words/phrases signaling the model added a prohibited content
 * category (diagnosis, dosage/schedule instruction, drug-interaction claim, treatment
 * recommendation, or prognosis — the five categories docs/56 §7.2 names, ADR-024) which
 * should never appear in a field that is supposed to be a raw extraction of packaging
 * text. Unlike `AssistantDriftCheck_()`, there is no assembled "context" to check
 * traceability against here — Holoscan's own extraction has no upstream stored record to
 * be traceable to; the check is lexicon-only, catching the model volunteering
 * interpretation instead of transcription.
 *
 * Advisory, never blocking (docs/56 §9/§10.2) — flags are stored in
 * `HoloscanRecognitionItem.check_flags` and shown to the doctor alongside each candidate;
 * they never auto-reject or auto-edit a candidate, since the mandatory human review gate
 * (ADR-025 §10.3) already sits between any candidate and any effect.
 *
 * Deliberately does NOT call `apps-script/AIAssistantDriftCheck.gs`'s own lexicon/helpers
 * directly, even though both are pure, logically reusable functions already sitting in
 * the same Apps Script project's flat global namespace: this file's own five-category
 * lexicon is a distinct, Holoscan-specific list (docs/56 §7.2's own five prohibitions,
 * not AI Assistant's six), so a second, independently-named lexicon constant is the
 * correct shape here, not a shared one — mirroring
 * `validation/static-analysis/analyze.js`'s own Holoscan static rule 5 requirement
 * ("reusing/extending `HoloscanRecognitionCheck_()`'s own category lexicon rather than
 * inventing a second, parallel lexicon mechanism" applies to a *second* Holoscan-only
 * lexicon, not to reusing AI Assistant's).
 *
 * No dependency on any other module — leaf-level, pure logic only, the same standing
 * `FoundationUtils.gs`/`FoundationContracts.gs`/`AIAssistantDriftCheck.gs` already have.
 * Covered directly by Conformance Tests, never requiring a live model call to exercise.
 */

var FOUNDATION_HOLOSCAN_CHECK_LEXICON_ = {
  diagnosis: ['diagnosed with', 'diagnosis is', 'confirmed as', 'this means you have', 'indicates a condition'],
  dosage_schedule: ['take twice daily', 'should take', 'increase your dose', 'start taking', 'stop taking this', 'recommended dose is'],
  drug_interaction: ['interacts with', 'do not take with', 'dangerous combination', 'avoid combining'],
  treatment_recommendation: ['recommend', 'you should start', 'advise you to', 'suggest you', 'you need to take'],
  prognosis: ['you will recover', 'expect improvement', 'this will cure', 'this will treat']
};

/**
 * Returns an array of human-readable flag strings (empty when clean) for one
 * `HoloscanRecognitionItem`'s own extracted fields — `extractedFields` is a plain object
 * of the model's own reported `name`/`strength`/`dosage_form`/`manufacturer`/`batch`/
 * `expiry` values (nulls/undefineds are skipped). A heuristic, not a proof — mirrors
 * `AssistantDriftCheck_()`'s own disclosed limitation exactly: it cannot prove a field is
 * a faithful transcription, only raise it for the doctor's mandatory review (docs/56
 * §10.3) to check.
 */
function HoloscanRecognitionCheck_(extractedFields) {
  var flags = [];
  var fieldNames = ['name', 'strength', 'dosage_form', 'manufacturer', 'batch', 'expiry'];
  var combinedTextLower = fieldNames
    .map(function (key) { return extractedFields && extractedFields[key] ? String(extractedFields[key]) : ''; })
    .join(' ')
    .toLowerCase();

  Object.keys(FOUNDATION_HOLOSCAN_CHECK_LEXICON_).forEach(function (category) {
    var hit = FOUNDATION_HOLOSCAN_CHECK_LEXICON_[category].some(function (phrase) {
      return combinedTextLower.indexOf(phrase) !== -1;
    });
    if (hit) {
      flags.push('possible ' + category + ' content in extracted fields — not a raw packaging transcription');
    }
  });

  return flags;
}
