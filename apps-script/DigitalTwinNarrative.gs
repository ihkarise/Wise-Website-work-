/**
 * Digital Twin Narrative — Batch PXP-12 (Phase 2D — Wise Digital Twin & AI Summaries,
 * docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md §7/§8/§10/§11.1/§12, ADR-028/029/030,
 * docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this batch). Implements
 * shared/schemas/digital-twin-narrative.schema.json version 1.0.0 — the entity backing the two
 * doctor write routes (generate_digital_twin_narrative / review_digital_twin_narrative) and the
 * three read routes (get_patient_digital_twin, get_health_story, get_progress_analytics).
 *
 * The platform's FIRST patient-facing AI-generated content, under the full ADR-005 gate applied
 * to patient visibility (ADR-028): a doctor generates one narrative for one roster patient, an
 * independent drift check flags it, and NOTHING reaches the patient until that doctor approves
 * it. The patient read route (get_health_story) returns only `approved`/`edited_and_approved`
 * narratives' published_output — never a `pending` or `rejected` draft, never the raw ai_output
 * — enforced server-side (foundationGetHealthStoryForPatient_), not by UI hiding alone.
 *
 * ---- generate_digital_twin_narrative pipeline (docs/59 §4/§8) ----
 * roster validation (reuses DoctorPatientRoster.gs) -> fail-closed enablement check
 * (digital_twin_review DoctorModuleState, DISABLED BY DEFAULT per ADR-030, reuses
 * DoctorModuleState.gs's foundationGetDoctorModuleStates_()) -> per-doctor, per-UTC-day rate
 * limit (docs/59 §10, mirrors AIAssistantInteraction.gs's own CacheService counter, reusing its
 * foundationSecondsUntilUtcMidnight_()/FOUNDATION_CACHE_SERVICE_MAX_TTL_SECONDS_ helpers rather
 * than redeclaring them — genuine reuse, ADR-009) -> DigitalTwinContextBuilder
 * (DigitalTwinContext.gs, narrative-type-bounded, grounded in the patient's own record only,
 * ADR-029) -> prompt assembly -> model call (reuses the OPENROUTER_API_KEY Script Property /
 * UrlFetchApp pattern, via a local, decoupled config — never a read of Phase 1.5's frozen
 * Config.gs, docs/59 §7.3) -> DigitalTwinDriftCheck_() -> one DigitalTwinNarrative row written,
 * review_status always 'pending'.
 *
 * ---- review_digital_twin_narrative (docs/59 §8.3, ADR-028) ----
 * Records the caller doctor's one-way approved/edited_and_approved/rejected decision on ONE
 * narrative row for a patient they have roster access to, setting published_output — the SOLE
 * gate to patient visibility. Never writes any other entity's Sheet (statically enforced,
 * docs/59 §18 item 1) — the write-verb functions this file calls are all foundationDs*
 * primitives targeting DigitalTwinNarratives, plus its own generate/review functions.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/PXP-1..11/
 * WPI-1..11 file — reuses FoundationDataStore.gs's/FoundationAudit.gs's existing generic
 * operations, DoctorPatientRoster.gs's/DoctorModuleState.gs's existing readers, and
 * DigitalTwinContext.gs's/DigitalTwinDriftCheck.gs's own new functions exactly as each was
 * designed to be reused (ADR-009).
 *
 * Depends on DigitalTwinContext.gs, DigitalTwinDriftCheck.gs, DoctorPatientRoster.gs,
 * DoctorModuleState.gs, AIAssistantInteraction.gs (rate-limit helper reuse only),
 * FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs.
 */

var FOUNDATION_DIGITAL_TWIN_NARRATIVES_SHEET_ = 'DigitalTwinNarratives';
var FOUNDATION_DIGITAL_TWIN_NARRATIVES_COLUMNS_ = [
  'narrative_id', 'patient_id', 'narrative_type', 'context_snapshot', 'prompt_template_version',
  'model', 'ai_output', 'ai_output_flags', 'review_status', 'published_output', 'reviewed_by',
  'review_notes', 'created_at', 'reviewed_at'
];

// The two terminal, patient-visibility-granting decisions plus the terminal rejection.
var FOUNDATION_DIGITAL_TWIN_REVIEWABLE_STATUSES_ = ['approved', 'edited_and_approved', 'rejected'];
var FOUNDATION_DIGITAL_TWIN_PUBLISHED_STATUSES_ = ['approved', 'edited_and_approved'];

// A decoupled mirror of Config.gs's CONFIG.AI shape — this batch never reads that frozen Phase
// 1.5 file directly (docs/59 §7.3), the same discipline AIAssistantInteraction.gs's own local
// model config already established.
var FOUNDATION_DIGITAL_TWIN_MODEL_CONFIG_ = {
  OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MODEL: 'anthropic/claude-haiku-4.5',
  TEMPERATURE: 0,
  MAX_OUTPUT_TOKENS: 500
};

var FOUNDATION_DIGITAL_TWIN_PROMPT_VERSION_ = '1.0';

// Implements apps-script/DIGITAL-TWIN-PROMPTS.md's numbered-rule spec exactly — if the two ever
// disagree, that document wins and this constant should be corrected to match it (that
// document's own closing rule; static analysis Digital Twin rule 2 version-locks the two).
var FOUNDATION_DIGITAL_TWIN_HEALTH_STORY_SYSTEM_PROMPT_ =
  'You are a strict, patient-facing narration tool with no clinical judgment of your own. You ' +
  'will be given one JSON object describing a single patient\'s own already-recorded care plan, ' +
  'check-ins, calculator results, symptom logs, medication history, and celebrated health ' +
  'milestones.\n\n' +
  'Your ONLY task: write a short, warm, plain-language health story (4-8 short sentences) that ' +
  'narrates what this JSON object already says about the patient\'s own recorded journey. This ' +
  'is a draft for a doctor to review; it is NEVER shown to the patient until the doctor ' +
  'approves it.\n\n' +
  'Hard rules — breaking any of these is a failure:\n' +
  '1. Do not add a diagnosis, condition name, or clinical interpretation not already present ' +
  'in the JSON.\n' +
  '2. Do not add a treatment, medicine, or dosage recommendation, or any change to one, not ' +
  'already present in the JSON.\n' +
  '3. Do not add a prognosis, recovery-timeline prediction, or outcome forecast of any kind.\n' +
  '4. Do not add clinical reassurance not already given by a doctor in the JSON.\n' +
  '5. Every sentence you write must be directly traceable to a specific field in the JSON. If ' +
  'you cannot point to the exact field a sentence came from, delete that sentence.\n' +
  '6. Output format: plain text only, 4-8 short sentences, no headers, no bullet points, no ' +
  'markdown, no sign-off.\n\n' +
  'You narrate what this specific JSON object already contains — nothing else.';

var FOUNDATION_DIGITAL_TWIN_AI_SUMMARY_SYSTEM_PROMPT_ =
  'You are a strict, patient-facing narration tool with no clinical judgment of your own. You ' +
  'will be given one JSON object describing a single patient\'s own already-recorded check-ins, ' +
  'calculator results, and celebrated health milestones.\n\n' +
  'Your ONLY task: write a short, plain-language progress summary (2-5 short sentences) that ' +
  'narrates what this JSON object already says. This is a draft for a doctor to review; it is ' +
  'NEVER shown to the patient until the doctor approves it.\n\n' +
  'Hard rules — breaking any of these is a failure:\n' +
  '1. Do not add a diagnosis, condition name, or clinical interpretation not already present ' +
  'in the JSON.\n' +
  '2. Do not add a treatment, medicine, or dosage recommendation not already present in the ' +
  'JSON.\n' +
  '3. Do not add a prognosis, recovery-timeline prediction, or outcome forecast of any kind.\n' +
  '4. Do not add clinical reassurance not already given by a doctor in the JSON.\n' +
  '5. Every sentence must be directly traceable to a specific field in the JSON.\n' +
  '6. Output format: plain text only, 2-5 short sentences, no headers, no markdown, no ' +
  'sign-off.\n\n' +
  'You narrate what this specific JSON object already contains — nothing else.';

var FOUNDATION_DIGITAL_TWIN_SYSTEM_PROMPTS_ = {
  health_story: FOUNDATION_DIGITAL_TWIN_HEALTH_STORY_SYSTEM_PROMPT_,
  ai_summary: FOUNDATION_DIGITAL_TWIN_AI_SUMMARY_SYSTEM_PROMPT_
};

// Rate limit (docs/59 §10) — a per-doctor, per-UTC-day generation ceiling, mirroring
// AIAssistantInteraction.gs's own CacheService counter. A deliberately small budget (not a
// tuned production value); revisit once real usage exists.
var FOUNDATION_DIGITAL_TWIN_RATE_LIMIT_MAX_PER_DAY_ = 10;
var FOUNDATION_DIGITAL_TWIN_RATE_LIMIT_LOCK_TIMEOUT_MS_ = 5000;

// ---- Pure helpers — covered by Conformance Tests ----

function foundationValidateGenerateDigitalTwinNarrativeInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.narrative_type !== 'string' || !foundationGetDigitalTwinNarrativeTypeByKey_(input.narrative_type)) {
    errors.push('narrative_type must be one of: health_story, ai_summary.');
  }
  return errors;
}

function foundationValidateReviewDigitalTwinNarrativeInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.narrative_id !== 'string' || input.narrative_id.trim() === '') {
    errors.push('narrative_id is required.');
  }
  if (!input || FOUNDATION_DIGITAL_TWIN_REVIEWABLE_STATUSES_.indexOf(input.review_status) === -1) {
    errors.push('review_status must be one of: approved, edited_and_approved, rejected.');
  }
  if (input && input.review_status === 'edited_and_approved' && (typeof input.edited_output !== 'string' || input.edited_output.trim() === '')) {
    errors.push('edited_output is required when review_status is edited_and_approved.');
  }
  return errors;
}

/**
 * Converts one Sheets row (context_snapshot/ai_output_flags still JSON strings) into this
 * entity's full, contractual API shape — mirrors foundationAiAssistantInteractionRowToApiShape_()
 * exactly, including its fail-soft degrade-to-empty behavior for a malformed stored string.
 * This full shape (including ai_output) is returned only to a DOCTOR — never to a patient.
 */
function foundationDigitalTwinNarrativeRowToApiShape_(row) {
  var parsedContext;
  try { parsedContext = JSON.parse(row.context_snapshot || '{}'); } catch (err) { parsedContext = {}; }
  var parsedFlags;
  try { parsedFlags = JSON.parse(row.ai_output_flags || '[]'); } catch (err) { parsedFlags = []; }
  return {
    narrative_id: row.narrative_id,
    patient_id: row.patient_id,
    narrative_type: row.narrative_type,
    context_snapshot: parsedContext,
    prompt_template_version: row.prompt_template_version,
    model: row.model,
    ai_output: row.ai_output,
    ai_output_flags: parsedFlags,
    review_status: row.review_status,
    published_output: row.published_output,
    reviewed_by: row.reviewed_by,
    review_notes: row.review_notes,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at
  };
}

/**
 * The PATIENT-safe projection of a narrative row — only the doctor-approved published_output and
 * its identifying/timing metadata. NEVER exposes ai_output, ai_output_flags, or context_snapshot
 * to a patient (ADR-028). Only ever called for an approved/edited_and_approved row.
 */
function foundationDigitalTwinNarrativePatientShape_(row) {
  return {
    narrative_id: row.narrative_id,
    narrative_type: row.narrative_type,
    published_output: row.published_output,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at
  };
}

// ---- Fail-closed enablement (ADR-030) — the digital_twin_review capability is DISABLED BY
// DEFAULT; every doctor route requires it explicitly enabled for the caller. ----

/**
 * Returns null when doctorId has the digital_twin_review capability enabled, or a
 * FOUNDATION_UNAUTHORIZED error envelope otherwise (fail-closed, ADR-010/ADR-030). Reuses
 * DoctorModuleState.gs's existing reader, never a new mechanism — mirrors
 * AIAssistantInteraction.gs's own ai_assistant enablement check exactly.
 */
function foundationDigitalTwinRequireEnabled_(doctorId) {
  var statesLookup = foundationGetDoctorModuleStates_(doctorId);
  if (statesLookup.status === 'error') {
    return statesLookup;
  }
  var state = statesLookup.data.filter(function (s) { return s.capability_key === 'digital_twin_review'; })[0];
  if (!state || state.enabled !== true) {
    return buildFoundationErrorEnvelope_('FOUNDATION_UNAUTHORIZED', 'Digital Twin Review is not enabled for your account. Contact your administrator.');
  }
  return null;
}

/**
 * Returns null when doctorId has patientId on their own derived roster, or a
 * FOUNDATION_INVALID_INPUT error envelope otherwise. Reuses DoctorPatientRoster.gs unchanged.
 */
function foundationDigitalTwinRequireRoster_(doctorId, patientId) {
  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === patientId; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must belong to your own patient roster.');
  }
  return null;
}

// ---- Rate limiting (CacheService — reuses AIAssistantInteraction.gs's own helpers) ----

function foundationDigitalTwinRateLimitCacheKey_(doctorId) {
  var utcDate = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', UTC
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, doctorId + '::' + utcDate);
  var hex = digestBytes.map(function (b) {
    var unsigned = b < 0 ? b + 256 : b;
    var hexStr = unsigned.toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  }).join('');
  return 'foundation_digital_twin_rl_' + hex;
}

/**
 * Returns true and increments the counter if doctorId is still within today's (UTC) generation
 * budget; returns false once the budget is spent. Fails open on any CacheService/lock error —
 * mirrors foundationCheckAndIncrementAiAssistantRateLimit_() exactly (this is a supplementary
 * cost-control mechanic, not the actual security boundary, which is fail-closed enablement +
 * roster scoping + DoctorSession authentication, none of which fail open).
 */
function foundationCheckAndIncrementDigitalTwinRateLimit_(doctorId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(FOUNDATION_DIGITAL_TWIN_RATE_LIMIT_LOCK_TIMEOUT_MS_)) {
    Logger.log('DigitalTwinNarrative: rate-limit lock unavailable, failing open.');
    return true;
  }
  try {
    var cache = CacheService.getScriptCache();
    var key = foundationDigitalTwinRateLimitCacheKey_(doctorId);
    var current = parseInt(cache.get(key), 10);
    if (isNaN(current)) current = 0;
    if (current >= FOUNDATION_DIGITAL_TWIN_RATE_LIMIT_MAX_PER_DAY_) {
      return false;
    }
    var ttlSeconds = Math.min(FOUNDATION_CACHE_SERVICE_MAX_TTL_SECONDS_, foundationSecondsUntilUtcMidnight_());
    cache.put(key, String(current + 1), ttlSeconds);
    return true;
  } catch (err) {
    Logger.log('DigitalTwinNarrative: CacheService error, failing open: ' + (err && err.message ? err.message : err));
    return true;
  } finally {
    lock.releaseLock();
  }
}

// ---- Model call (reuses the OPENROUTER_API_KEY Script Property / UrlFetchApp pattern) ----

/**
 * Calls OpenRouter with the narrative_type's own system prompt and the assembled context
 * (serialized) as the user message. Mirrors callOpenRouterForAiAssistant_() exactly, against
 * this file's own local FOUNDATION_DIGITAL_TWIN_MODEL_CONFIG_. Throws on any failure — callers
 * catch and translate to a safe envelope.
 */
function callOpenRouterForDigitalTwin_(systemPrompt, userContent) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in Script Properties.');
  }
  var response = UrlFetchApp.fetch(FOUNDATION_DIGITAL_TWIN_MODEL_CONFIG_.OPENROUTER_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: FOUNDATION_DIGITAL_TWIN_MODEL_CONFIG_.MODEL,
      temperature: FOUNDATION_DIGITAL_TWIN_MODEL_CONFIG_.TEMPERATURE,
      max_tokens: FOUNDATION_DIGITAL_TWIN_MODEL_CONFIG_.MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]
    })
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('OpenRouter request failed (HTTP ' + code + '): ' + response.getContentText());
  }
  var body = JSON.parse(response.getContentText());
  var content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenRouter response did not contain narrative text.');
  }
  return content.trim();
}

// ---- Sheets-backed operations ----

/**
 * Runs the full generate_digital_twin_narrative pipeline (this file's own header comment) and
 * writes exactly one DigitalTwinNarrative row (review_status 'pending', never patient-visible)
 * on success. input.doctor_id must already be DoctorSession-derived by the caller (ADR-017).
 * Rejects a malformed request (FOUNDATION_INVALID_INPUT), a patient outside the caller's roster
 * (FOUNDATION_INVALID_INPUT), a caller without digital_twin_review enabled
 * (FOUNDATION_UNAUTHORIZED, ADR-030), an exhausted daily budget
 * (FOUNDATION_DIGITAL_TWIN_RATE_LIMITED), or a genuine model-call failure
 * (FOUNDATION_DIGITAL_TWIN_UNAVAILABLE).
 */
function foundationGenerateDigitalTwinNarrative_(input) {
  var errors = foundationValidateGenerateDigitalTwinNarrativeInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var patientId = input.patient_id.trim();
  var narrativeType = input.narrative_type;

  var enablement = foundationDigitalTwinRequireEnabled_(doctorId);
  if (enablement) { return enablement; }
  var rosterGuard = foundationDigitalTwinRequireRoster_(doctorId, patientId);
  if (rosterGuard) { return rosterGuard; }

  if (!foundationCheckAndIncrementDigitalTwinRateLimit_(doctorId)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_DIGITAL_TWIN_RATE_LIMITED', 'You have reached today\'s Digital Twin generation limit. Please try again tomorrow.');
  }

  var contextLookup = foundationBuildDigitalTwinContext_(patientId, narrativeType);
  if (contextLookup.status === 'error') {
    return contextLookup;
  }
  var context = contextLookup.data;

  var systemPrompt = FOUNDATION_DIGITAL_TWIN_SYSTEM_PROMPTS_[narrativeType];
  if (!systemPrompt) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'This narrative type has no prompt implementation yet.');
  }

  var aiOutput;
  try {
    aiOutput = callOpenRouterForDigitalTwin_(systemPrompt, JSON.stringify(context));
  } catch (err) {
    Logger.log('DigitalTwinNarrative: model call failed: ' + (err && err.message ? err.message : err));
    return buildFoundationErrorEnvelope_('FOUNDATION_DIGITAL_TWIN_UNAVAILABLE', 'Could not generate a narrative right now. Please try again.');
  }

  var flags = DigitalTwinDriftCheck_(context, aiOutput);

  return withFoundationErrorHandling_(function () {
    var narrativeId = generateFoundationId_();
    var sheetRow = {
      narrative_id: narrativeId,
      patient_id: patientId,
      narrative_type: narrativeType,
      context_snapshot: JSON.stringify(context),
      prompt_template_version: FOUNDATION_DIGITAL_TWIN_PROMPT_VERSION_,
      model: FOUNDATION_DIGITAL_TWIN_MODEL_CONFIG_.MODEL,
      ai_output: aiOutput,
      ai_output_flags: JSON.stringify(flags),
      review_status: 'pending',
      published_output: '',
      reviewed_by: '',
      review_notes: '',
      created_at: foundationNowIso_(),
      reviewed_at: ''
    };
    foundationDsInsert_(FOUNDATION_DIGITAL_TWIN_NARRATIVES_SHEET_, FOUNDATION_DIGITAL_TWIN_NARRATIVES_COLUMNS_, sheetRow);
    foundationLogAuditEvent_('digital_twin_narrative_generated', patientId, doctorId, 'narrative_id=' + narrativeId + ';narrative_type=' + narrativeType);
    return foundationDigitalTwinNarrativeRowToApiShape_(sheetRow);
  });
}

/**
 * Records the caller's one-way review decision on ONE narrative for a patient they have roster
 * access to — the sole gate to patient visibility (ADR-028). input.doctor_id must already be
 * DoctorSession-derived. On 'approved', published_output = ai_output; on 'edited_and_approved',
 * published_output = the doctor's edited text (ai_output retained, never overwritten); on
 * 'rejected', published_output stays empty. Never writes any entity's Sheet other than
 * DigitalTwinNarratives (docs/59 §18 item 1). Rejects (FOUNDATION_INVALID_INPUT) an unknown
 * narrative_id, one for a patient outside the caller's roster, or one no longer 'pending';
 * (FOUNDATION_UNAUTHORIZED) a caller without digital_twin_review enabled (ADR-030).
 */
function foundationReviewDigitalTwinNarrative_(input) {
  var errors = foundationValidateReviewDigitalTwinNarrativeInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var narrativeId = input.narrative_id.trim();
  var reviewStatus = input.review_status;

  var enablement = foundationDigitalTwinRequireEnabled_(doctorId);
  if (enablement) { return enablement; }

  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_DIGITAL_TWIN_NARRATIVES_SHEET_, FOUNDATION_DIGITAL_TWIN_NARRATIVES_COLUMNS_, 'narrative_id', narrativeId);
  });
  if (lookup.status === 'error') {
    return lookup;
  }
  var existing = lookup.data;
  if (!existing || existing.review_status !== 'pending') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'narrative_id must reference an existing, still-pending Digital Twin narrative.');
  }
  var rosterGuard = foundationDigitalTwinRequireRoster_(doctorId, existing.patient_id);
  if (rosterGuard) { return rosterGuard; }

  var publishedOutput = '';
  if (reviewStatus === 'approved') {
    publishedOutput = existing.ai_output;
  } else if (reviewStatus === 'edited_and_approved') {
    publishedOutput = input.edited_output.trim();
  }

  return withFoundationErrorHandling_(function () {
    var patch = {
      review_status: reviewStatus,
      published_output: publishedOutput,
      reviewed_by: doctorId,
      review_notes: (input.review_notes || '').toString().trim(),
      reviewed_at: foundationNowIso_()
    };
    foundationDsUpdateById_(FOUNDATION_DIGITAL_TWIN_NARRATIVES_SHEET_, FOUNDATION_DIGITAL_TWIN_NARRATIVES_COLUMNS_, 'narrative_id', narrativeId, patch);
    foundationLogAuditEvent_('digital_twin_narrative_reviewed', existing.patient_id, doctorId, 'narrative_id=' + narrativeId + ';review_status=' + reviewStatus);
    Object.keys(patch).forEach(function (key) { existing[key] = patch[key]; });
    return foundationDigitalTwinNarrativeRowToApiShape_(existing);
  });
}

/**
 * Returns every DigitalTwinNarrative row for patientId as full API shapes, sorted newest-first.
 * Internal helper; callers decide which subset/shape to expose.
 */
function foundationGetDigitalTwinNarrativesForPatient_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_DIGITAL_TWIN_NARRATIVES_SHEET_, FOUNDATION_DIGITAL_TWIN_NARRATIVES_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    rows.sort(function (a, b) { return a.created_at < b.created_at ? 1 : (a.created_at > b.created_at ? -1 : 0); });
    return rows.map(foundationDigitalTwinNarrativeRowToApiShape_);
  });
}

/**
 * get_patient_digital_twin (doctor route, docs/59 §12) — one roster patient's computed Digital
 * Twin view + Progress Analytics + EVERY DigitalTwinNarrative including pending drafts (full
 * shape, doctor-only). Enablement- and roster-gated. input.doctor_id must already be
 * DoctorSession-derived by the caller.
 */
function foundationGetPatientDigitalTwinForDoctor_(doctorId, requestedPatientId) {
  var patientId = (requestedPatientId || '').toString().trim();
  if (patientId === '') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id is required.');
  }
  var enablement = foundationDigitalTwinRequireEnabled_(doctorId);
  if (enablement) { return enablement; }
  var rosterGuard = foundationDigitalTwinRequireRoster_(doctorId, patientId);
  if (rosterGuard) { return rosterGuard; }

  var viewLookup = foundationComputeDigitalTwinView_(patientId);
  if (viewLookup.status === 'error') { return viewLookup; }
  var analyticsLookup = foundationComputeProgressAnalytics_(patientId);
  if (analyticsLookup.status === 'error') { return analyticsLookup; }
  var narrativesLookup = foundationGetDigitalTwinNarrativesForPatient_(patientId);
  if (narrativesLookup.status === 'error') { return narrativesLookup; }

  return buildFoundationOkEnvelope_({
    narrative_types: foundationGetDigitalTwinNarrativeRegistry_(),
    digital_twin: viewLookup.data,
    progress_analytics: analyticsLookup.data,
    narratives: narrativesLookup.data
  });
}

/**
 * get_health_story (patient route, docs/59 §12) — the caller's OWN computed Digital Twin view +
 * only their approved/edited_and_approved narratives' published_output (patient-safe shape,
 * NEVER a pending/rejected draft, never the raw ai_output). patientId is always
 * PatientSession-derived by the caller; any client-supplied patient_id is ignored upstream.
 */
function foundationGetHealthStoryForPatient_(patientId) {
  var viewLookup = foundationComputeDigitalTwinView_(patientId);
  if (viewLookup.status === 'error') { return viewLookup; }
  var narrativesLookup = foundationGetDigitalTwinNarrativesForPatient_(patientId);
  if (narrativesLookup.status === 'error') { return narrativesLookup; }

  var visible = narrativesLookup.data
    .filter(function (n) { return FOUNDATION_DIGITAL_TWIN_PUBLISHED_STATUSES_.indexOf(n.review_status) !== -1; })
    .map(function (n) { return foundationDigitalTwinNarrativePatientShape_(n); });

  return buildFoundationOkEnvelope_({
    digital_twin: viewLookup.data,
    narratives: visible
  });
}

/**
 * get_progress_analytics (patient route, docs/59 §12) — the caller's OWN deterministic, non-AI
 * Progress Analytics view (§6.3). No model output, no doctor gate. patientId is always
 * PatientSession-derived by the caller.
 */
function foundationGetProgressAnalyticsForPatient_(patientId) {
  var analyticsLookup = foundationComputeProgressAnalytics_(patientId);
  if (analyticsLookup.status === 'error') { return analyticsLookup; }
  return buildFoundationOkEnvelope_(analyticsLookup.data);
}
