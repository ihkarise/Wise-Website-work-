/**
 * AI summarization step (docs/25 §6, §9.4). This module is a
 * NORMALIZATION layer, not a content-generation layer: it may only
 * rephrase the doctor's own note into plain language. It must never add
 * a diagnosis, recommendation, investigation, medicine, reassurance, or
 * conclusion that is not already present in staff_submitted_note.
 *
 * Two independent lines of defense enforce this, per the requirement
 * that the principle live in both the prompt and the implementation:
 *   1. SUMMARY_SYSTEM_PROMPT_ — instructs the model to normalize only.
 *   2. flagDrift_() — a model-independent, code-level check that flags
 *      (does not silently trust) output the prompt alone can't guarantee.
 * Neither line of defense is a substitute for the doctor review gate
 * built in Batch 4D — this module only ever writes a *draft*.
 *
 * PROMPT SPECIFICATION: apps-script/PROMPTS.md is the canonical,
 * version-controlled source of truth for SUMMARY_SYSTEM_PROMPT_ below —
 * its purpose, inputs/outputs, safety rules, forbidden behaviours, and
 * traceability principles. The string below implements that spec; if
 * they ever disagree, PROMPTS.md wins and this file should be corrected
 * to match it. Any wording change here requires a matching update (and
 * version bump) there.
 */

var PROMPT_VERSION_ = '1.0'; // Must match "Prompt Version" in PROMPTS.md.

var SUMMARY_SYSTEM_PROMPT_ =
  'You are a strict text-normalization tool for a healthcare clinic\'s ' +
  'internal visit-summary pipeline. You have no clinical judgment and must ' +
  'not use medical knowledge beyond understanding vocabulary.\n\n' +
  'Your ONLY task: rewrite the clinician\'s note below into 2-4 short, ' +
  'plain-language sentences a patient can read comfortably.\n\n' +
  'Hard rules — breaking any of these is a failure:\n' +
  '1. Do not add a diagnosis, condition name, or clinical interpretation ' +
  'not explicitly stated in the note.\n' +
  '2. Do not add treatment recommendations, medicines, dosages, or ' +
  'instructions not explicitly stated in the note.\n' +
  '3. Do not add investigations, tests, or referrals not explicitly ' +
  'stated in the note.\n' +
  '4. Do not add reassurance, encouragement, prognosis, or outcome ' +
  'statements unless that exact sentiment is explicitly written in the ' +
  'note.\n' +
  '5. Do not add a conclusion or summary judgment beyond what the note ' +
  'states.\n' +
  '6. Do not infer anything the doctor did not write, even if it seems ' +
  'medically obvious or likely.\n' +
  '7. Do not guess at what an unclear abbreviation or phrase means — ' +
  'keep it close to the source wording, or omit it.\n' +
  '8. If a detail is unclear or incomplete, omit it. Do not fill gaps.\n' +
  '9. Every sentence you output must be directly traceable to something ' +
  'explicitly written in the note. If you cannot point to the exact part ' +
  'of the note a sentence came from, delete that sentence.\n\n' +
  'You are a rephrasing layer, not a medical assistant. Simplify ' +
  'vocabulary and sentence structure only. Preserve meaning — do not add ' +
  'meaning, and do not silently drop clinically material information; ' +
  'only omit something when it is genuinely unclear, never because it is ' +
  'inconvenient.\n\n' +
  'Output format: plain text only, 2-4 sentences, no headers, no bullet ' +
  'points, no markdown, no disclaimers, no sign-off.';

/**
 * Orchestrates the AI step for one row. Never throws — callers get a
 * result object so a failed AI call can be logged without losing the
 * already-written row (docs/25 §8.3: AI failures must land in error_log,
 * never silently drop).
 */
function summarizeNote_(note) {
  try {
    var summary = callOpenRouterSummary_(note);
    var flags = flagDrift_(note, summary);
    return {
      ok: true,
      summary: summary,
      model: CONFIG.AI.MODEL,
      flags: flags
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function callOpenRouterSummary_(note) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in Script Properties.');
  }

  var response = UrlFetchApp.fetch(CONFIG.AI.OPENROUTER_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: CONFIG.AI.MODEL,
      temperature: CONFIG.AI.TEMPERATURE,
      max_tokens: CONFIG.AI.MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT_ },
        { role: 'user', content: note }
      ]
    })
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('OpenRouter request failed (HTTP ' + code + '): ' + response.getContentText());
  }

  var body = JSON.parse(response.getContentText());
  var content = body && body.choices && body.choices[0] &&
    body.choices[0].message && body.choices[0].message.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenRouter response did not contain summary text.');
  }
  return content.trim();
}

/**
 * Code-level backstop for docs/25 §6's "rejects/flags any output that
 * introduces content not traceable to the source note." Two checks:
 *
 *  A. Category lexicon — words/phrases that signal the model added a
 *     prohibited content category (diagnosis, recommendation, medicine,
 *     investigation, reassurance, conclusion) which do not appear
 *     anywhere in the original note.
 *  B. Per-sentence word-overlap — any summary sentence whose content
 *     words barely overlap with the note's vocabulary is flagged as
 *     low-traceability, independent of which category it might be.
 *
 * This is a heuristic, not a guarantee — it cannot prove a sentence is
 * unsupported, only raise it for the doctor reviewer (Batch 4D) to check.
 * Flags never block the draft from being written; they are logged
 * alongside it so review has something concrete to check against.
 */
function flagDrift_(note, summary) {
  var noteLower = note.toLowerCase();
  var flags = [];

  Object.keys(DRIFT_LEXICON_).forEach(function (category) {
    var hit = DRIFT_LEXICON_[category].some(function (phrase) {
      return summary.toLowerCase().indexOf(phrase) !== -1 && noteLower.indexOf(phrase) === -1;
    });
    if (hit) {
      flags.push('possible ' + category + ' not present in source note');
    }
  });

  splitSentences_(summary).forEach(function (sentence, i) {
    if (sentenceOverlap_(sentence, noteLower) < CONFIG.AI.SENTENCE_TRACEABILITY_MIN_OVERLAP) {
      flags.push('sentence ' + (i + 1) + ' has low traceability to source note: "' + sentence + '"');
    }
  });

  return flags;
}

var DRIFT_LEXICON_ = {
  diagnosis: ['diagnosed with', 'diagnosis is', 'confirmed as', 'this means you have'],
  recommendation: ['recommend', 'should take', 'should start', 'advise you to', 'suggest you', 'you need to'],
  medicine: ['prescribe', 'dosage', 'take this medicine', 'start medication', 'increase your dose'],
  investigation: ['order a test', 'get a scan', 'recommend a biopsy', 'blood test is needed', 'mri', 'ct scan', 'x-ray'],
  reassurance: ["don't worry", 'you will be fine', 'nothing to worry', 'you should feel relieved'],
  conclusion: ['in conclusion', 'overall, this means', 'this confirms', 'the takeaway is']
};

function splitSentences_(text) {
  // Marker-based split avoids lookbehind regex, for broader runtime
  // compatibility across Apps Script's V8 versions. Uses an explicit
  // control character (never appears in real note/summary text) rather
  // than a literal in source, so the marker stays visible and greppable.
  var marker = String.fromCharCode(1);
  return text
    .replace(/([.!?])\s+/g, '$1' + marker)
    .split(marker)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

function sentenceOverlap_(sentence, noteLower) {
  var words = sentence.toLowerCase().match(/[a-z]{4,}/g) || [];
  if (words.length === 0) return 1; // nothing substantive to check, don't flag
  var covered = words.filter(function (w) { return noteLower.indexOf(w) !== -1; });
  return covered.length / words.length;
}
