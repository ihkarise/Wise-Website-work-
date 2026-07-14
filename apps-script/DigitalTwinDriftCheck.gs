/**
 * Digital Twin Drift Check — Batch PXP-12 (Phase 2D, docs/59-PHASE-2D-DIGITAL-TWIN-
 * ARCHITECTURE-FREEZE.md §8.2, ADR-004/ADR-005/ADR-028, docs/53-PHASE-3-IMPLEMENTATION-RULES.md
 * governs this batch). `DigitalTwinDriftCheck_()` is the independent, code-level half of
 * ADR-005's three-part supervision pattern (prompt-level constraint + independent code-level
 * check + mandatory human review), applied here to the platform's FIRST patient-facing AI
 * content — structurally identical to AIAssistantDriftCheck.gs's own AssistantDriftCheck_() and
 * Ai.gs's flagDrift_():
 *
 *   A. Category lexicon — words/phrases signaling the model added a prohibited content category
 *      (diagnosis, recommendation, medicine, investigation, reassurance, prognosis, conclusion —
 *      the same category family the prior two AI features already enumerate, extended with
 *      ADR-004's own "prognosis/recovery-timeline" category that a patient-facing narrative must
 *      never introduce) which do not appear anywhere in the assembled context.
 *   B. Per-sentence word-overlap — any output sentence whose content words barely overlap the
 *      assembled context's own vocabulary is flagged low-traceability, run against
 *      DigitalTwinContextBuilder's own JSON (flattened to text).
 *
 * Advisory, never blocking (docs/59 §8.2) — flags are stored in
 * DigitalTwinNarrative.ai_output_flags and shown to the reviewing doctor; they never
 * auto-approve, auto-edit, or auto-reject, because the mandatory doctor review gate (ADR-028)
 * already sits between any draft and any patient.
 *
 * ONE lexicon mechanism only (docs/59 §18 item 5) — this file declares exactly one lexicon
 * constant; no other DigitalTwin*.gs declares a parallel one, enforced by
 * validation/static-analysis/analyze.js's Digital Twin static rule 5.
 *
 * Deliberately does NOT call Ai.gs's or AIAssistantDriftCheck.gs's splitSentences_/
 * sentenceOverlap_ — doing so would either depend on a frozen Phase 1.5 file or duplicate a
 * global name across files (exactly the duplicate-global-name problem static analysis exists to
 * catch). Two distinctly-named, logically-identical local functions below avoid both, the same
 * "a local, independent helper, not a dependency on a frozen file's own internals" discipline
 * AIAssistantDriftCheck.gs already established.
 *
 * No dependency on any other module — leaf-level, pure logic only. Covered directly by
 * Conformance Tests, never requiring a live model call to exercise.
 */

var FOUNDATION_DIGITAL_TWIN_DRIFT_LEXICON_ = {
  diagnosis: ['diagnosed with', 'diagnosis is', 'confirmed as', 'this means you have', 'you have been diagnosed'],
  recommendation: ['recommend', 'should take', 'should start', 'advise you to', 'suggest you', 'you need to', 'you must'],
  medicine: ['prescribe', 'dosage', 'take this medicine', 'start medication', 'increase your dose', 'change your medicine'],
  investigation: ['order a test', 'get a scan', 'recommend a biopsy', 'blood test is needed', 'mri', 'ct scan', 'x-ray'],
  reassurance: ["don't worry", 'you will be fine', 'nothing to worry', 'you should feel relieved', 'you are cured'],
  prognosis: ['you will recover', 'expect to recover', 'recovery timeline', 'you should be better by', 'the outlook is', 'you will improve by'],
  conclusion: ['in conclusion', 'overall, this means', 'this confirms', 'the takeaway is']
};

// Mirrors AIAssistantDriftCheck.gs's / Ai.gs's own SENTENCE_TRACEABILITY_MIN_OVERLAP value
// exactly, as a local, independent constant.
var FOUNDATION_DIGITAL_TWIN_SENTENCE_TRACEABILITY_MIN_OVERLAP_ = 0.3;

/**
 * Recursively collects every leaf string/number/boolean value out of `value`
 * (DigitalTwinContextBuilder's own assembled context object) into one lowercase, space-joined
 * text blob — object keys and structure ignored, so this checks traceability against the
 * assembled *content*, mirroring AIAssistantDriftCheck.gs's own flatten helper exactly.
 */
function foundationDigitalTwinFlattenContextToText_(value) {
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
 * Splits `text` into trimmed, non-empty sentences. Logically identical to Ai.gs's
 * splitSentences_() — a distinctly-named, independent copy (see this file's own header comment).
 */
function foundationDigitalTwinSplitSentences_(text) {
  var marker = String.fromCharCode(1);
  return text
    .replace(/([.!?])\s+/g, '$1' + marker)
    .split(marker)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * Returns the fraction of `sentence`'s own substantive (4+ letter) words that also appear in
 * `contextTextLower`. Logically identical to Ai.gs's sentenceOverlap_() — a distinctly-named,
 * independent copy (see this file's own header comment).
 */
function foundationDigitalTwinSentenceOverlap_(sentence, contextTextLower) {
  var words = sentence.toLowerCase().match(/[a-z]{4,}/g) || [];
  if (words.length === 0) return 1; // nothing substantive to check, don't flag
  var covered = words.filter(function (w) { return contextTextLower.indexOf(w) !== -1; });
  return covered.length / words.length;
}

/**
 * The narrative-type-agnostic drift check docs/59 §8.2 requires. `context` is
 * DigitalTwinContextBuilder's own assembled object (foundationBuildDigitalTwinContext_()'s
 * `data`); `output` is the model's raw draft narrative. Returns an array of human-readable flag
 * strings — empty when clean, mirroring AssistantDriftCheck_()'s return shape exactly. A
 * heuristic, not a guarantee — it cannot prove a sentence is unsupported, only raise it for the
 * doctor's mandatory review (ADR-028) to check.
 */
function DigitalTwinDriftCheck_(context, output) {
  var contextText = foundationDigitalTwinFlattenContextToText_(context);
  var outputLower = output.toLowerCase();
  var flags = [];

  Object.keys(FOUNDATION_DIGITAL_TWIN_DRIFT_LEXICON_).forEach(function (category) {
    var hit = FOUNDATION_DIGITAL_TWIN_DRIFT_LEXICON_[category].some(function (phrase) {
      return outputLower.indexOf(phrase) !== -1 && contextText.indexOf(phrase) === -1;
    });
    if (hit) {
      flags.push('possible ' + category + ' not present in assembled context');
    }
  });

  foundationDigitalTwinSplitSentences_(output).forEach(function (sentence, i) {
    if (foundationDigitalTwinSentenceOverlap_(sentence, contextText) < FOUNDATION_DIGITAL_TWIN_SENTENCE_TRACEABILITY_MIN_OVERLAP_) {
      flags.push('sentence ' + (i + 1) + ' has low traceability to assembled context: "' + sentence + '"');
    }
  });

  return flags;
}
