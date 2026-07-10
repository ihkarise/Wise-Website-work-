/**
 * AI Assistant Drift Check — Batch WPI-10 (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-
 * FREEZE.md §8.2, ADR-005/ADR-022, docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs
 * this batch). `AssistantDriftCheck_()` is the independent, code-level half of
 * ADR-005's three-part supervision pattern (prompt-level constraint + independent
 * code-level check + mandatory human review), applied to a doctor-facing tool for the
 * first time — structurally identical to `apps-script/Ai.gs`'s own `flagDrift_()`:
 *
 *   A. Category lexicon — words/phrases signaling the model added a prohibited
 *      content category (diagnosis, recommendation, medicine, investigation,
 *      reassurance, conclusion — the same six categories Ai.gs's DRIFT_LEXICON_
 *      already enumerates, docs/55 §8.2) which do not appear anywhere in the
 *      assembled context.
 *   B. Per-sentence word-overlap — any output sentence whose content words barely
 *      overlap the assembled context's own vocabulary is flagged as
 *      low-traceability, run against AssistantContextBuilder's own JSON (flattened
 *      to text) instead of a single free-text note (docs/55 §8.2).
 *
 * Advisory, never blocking (docs/55 §8.2) — flags are stored in
 * AIAssistantInteraction.ai_output_flags and shown to the doctor alongside the
 * draft; they never auto-reject or auto-edit the output, since the mandatory human
 * review gate (ADR-022 §8.3) already sits between any draft and any effect.
 *
 * Deliberately does NOT call apps-script/Ai.gs's splitSentences_()/sentenceOverlap_()
 * directly, even though both are pure, logically reusable helpers already sitting in
 * the same Apps Script project's flat global namespace: doing so would make a WPI-10
 * file depend on a Phase 1.5 file (frozen except for genuine bug fixes, docs/43 §12)
 * and would require this batch's validation harness to additionally load and mock
 * Ai.gs's own UrlFetchApp/CONFIG.AI dependencies just to exercise two pure string
 * functions — out of proportion to this batch's own scope. Two distinctly-named,
 * logically-identical local functions below avoid both that coupling and any Apps
 * Script namespace collision (declaring a second global `splitSentences_`/
 * `sentenceOverlap_` would itself be exactly the duplicate-global-name problem
 * validation/static-analysis/analyze.js exists to catch) — the same "a local,
 * independent constant/helper, not a dependency on a frozen file's own internals"
 * discipline CalculatorResult.gs's own MAX_ENTRIES local constant already
 * established, applied here to a pure function pair instead of a numeric constant.
 *
 * No dependency on any other module — leaf-level, pure logic only, the same standing
 * FoundationUtils.gs/FoundationContracts.gs already have. Covered directly by
 * Conformance Tests, never requiring a live model call to exercise.
 */

var FOUNDATION_AI_ASSISTANT_DRIFT_LEXICON_ = {
  diagnosis: ['diagnosed with', 'diagnosis is', 'confirmed as', 'this means you have'],
  recommendation: ['recommend', 'should take', 'should start', 'advise you to', 'suggest you', 'you need to'],
  medicine: ['prescribe', 'dosage', 'take this medicine', 'start medication', 'increase your dose'],
  investigation: ['order a test', 'get a scan', 'recommend a biopsy', 'blood test is needed', 'mri', 'ct scan', 'x-ray'],
  reassurance: ["don't worry", 'you will be fine', 'nothing to worry', 'you should feel relieved'],
  conclusion: ['in conclusion', 'overall, this means', 'this confirms', 'the takeaway is']
};

// Mirrors Ai.gs's CONFIG.AI.SENTENCE_TRACEABILITY_MIN_OVERLAP value exactly, as a
// local, independent constant — see this file's own header comment for why this
// batch does not read Phase 1.5's Config.gs directly.
var FOUNDATION_AI_ASSISTANT_SENTENCE_TRACEABILITY_MIN_OVERLAP_ = 0.3;

/**
 * Recursively collects every leaf string/number/boolean value out of `value`
 * (AssistantContextBuilder's own assembled context object) into one lowercase,
 * space-joined text blob — object keys and array/object structure are deliberately
 * ignored, so this checks traceability against the assembled *content*, the same
 * role `note` plays in Ai.gs's flagDrift_(note, summary).
 */
function foundationAiAssistantFlattenContextToText_(value) {
  var parts = [];
  function walk(node) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      parts.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      Object.keys(node).forEach(function (key) { walk(node[key]); });
    }
  }
  walk(value);
  return parts.join(' ').toLowerCase();
}

/**
 * Splits `text` into trimmed, non-empty sentences. Logically identical to
 * Ai.gs's splitSentences_() — see this file's own header comment for why this is a
 * distinctly-named, independent copy rather than a call into that file.
 */
function foundationAiAssistantSplitSentences_(text) {
  var marker = String.fromCharCode(1);
  return text
    .replace(/([.!?])\s+/g, '$1' + marker)
    .split(marker)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * Returns the fraction of `sentence`'s own substantive (4+ letter) words that also
 * appear in `contextTextLower`. Logically identical to Ai.gs's sentenceOverlap_() —
 * see this file's own header comment for why this is a distinctly-named, independent
 * copy rather than a call into that file.
 */
function foundationAiAssistantSentenceOverlap_(sentence, contextTextLower) {
  var words = sentence.toLowerCase().match(/[a-z]{4,}/g) || [];
  if (words.length === 0) return 1; // nothing substantive to check, don't flag
  var covered = words.filter(function (w) { return contextTextLower.indexOf(w) !== -1; });
  return covered.length / words.length;
}

/**
 * The capability-agnostic drift check docs/55 §8.2 requires. `context` is
 * AssistantContextBuilder's own assembled object (foundationBuildAiAssistantContext_()'s
 * `data`); `output` is the model's raw draft text. Returns an array of human-readable
 * flag strings — empty when clean, mirroring Ai.gs's flagDrift_() return shape exactly.
 * A heuristic, not a guarantee (Ai.gs's own header comment applies identically here) —
 * it cannot prove a sentence is unsupported, only raise it for the doctor's mandatory
 * review (ADR-022 §8.3) to check.
 */
function AssistantDriftCheck_(context, output) {
  var contextText = foundationAiAssistantFlattenContextToText_(context);
  var outputLower = output.toLowerCase();
  var flags = [];

  Object.keys(FOUNDATION_AI_ASSISTANT_DRIFT_LEXICON_).forEach(function (category) {
    var hit = FOUNDATION_AI_ASSISTANT_DRIFT_LEXICON_[category].some(function (phrase) {
      return outputLower.indexOf(phrase) !== -1 && contextText.indexOf(phrase) === -1;
    });
    if (hit) {
      flags.push('possible ' + category + ' not present in assembled context');
    }
  });

  foundationAiAssistantSplitSentences_(output).forEach(function (sentence, i) {
    if (foundationAiAssistantSentenceOverlap_(sentence, contextText) < FOUNDATION_AI_ASSISTANT_SENTENCE_TRACEABILITY_MIN_OVERLAP_) {
      flags.push('sentence ' + (i + 1) + ' has low traceability to assembled context: "' + sentence + '"');
    }
  });

  return flags;
}
