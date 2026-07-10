/**
 * AI Assistant Interaction — Batch WPI-10 (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-
 * FREEZE.md §7/§10/§11.1/§12, ADR-021/022/023, docs/53-PHASE-3-IMPLEMENTATION-RULES.md
 * governs this batch). Implements shared/schemas/ai-assistant-interaction.schema.json
 * version 1.0.0 — the entity backing both new write routes
 * (post_ai_assistant_query/post_ai_assistant_decision) and the one new read route
 * (get_ai_assistant_capabilities, served directly from
 * apps-script/AIAssistantContext.gs's registry — no entity logic of its own).
 *
 * Orchestrates docs/55 §4's full pipeline for `post_ai_assistant_query`:
 * capability lookup -> fail-closed enablement check (this batch's own disclosed,
 * intentional divergence from every prior WPI capability's "dashboard-rendering-only"
 * gating — docs/55 §10/§15 name AI Assistant's real per-call cost/risk as the reason a
 * server-side enablement check is required here specifically, reusing
 * DoctorModuleState.gs's existing foundationGetDoctorModuleStates_() reader, never a
 * new mechanism) -> per-doctor, per-UTC-day rate limit -> AssistantContextBuilder
 * (AIAssistantContext.gs) -> prompt assembly -> model call (reuses Ai.gs's own
 * UrlFetchApp/OPENROUTER_API_KEY pattern, via a local, decoupled config — see below) ->
 * AssistantDriftCheck_() (AIAssistantDriftCheck.gs) -> one AIAssistantInteraction row
 * written, doctor_decision always 'pending'.
 *
 * `post_ai_assistant_decision` only ever patches the one row it is given, transitioning
 * doctor_decision away from 'pending' exactly once (ADR-022's central guarantee) — it
 * never calls any other entity's write function. See this batch's own static-analysis
 * addition (validation/static-analysis/analyze.js) for the grep-based rule enforcing
 * that guarantee at the code level, per docs/55 §18 item 1.
 *
 * ---- Why this file defines its own local AI config, never reading Config.gs ----
 * docs/55 §7.3 names CONFIG.AI.MODEL/TEMPERATURE/MAX_OUTPUT_TOKENS as reusable "or
 * extended with capability-specific overrides at implementation time" — this batch's
 * disclosed implementation choice is a local, independent
 * FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_ object, never a read of Phase 1.5's own
 * Config.gs (frozen except for genuine bug fixes, docs/43 §12). This mirrors the exact
 * "a local constant, not a shared frozen file's own internals" discipline
 * CalculatorResult.gs's own MAX_ENTRIES local constant already established — the two
 * config objects happen to share the same OPENROUTER_API_URL/model values today, but
 * are never the same object, so a future Phase 1.5-only change to CONFIG.AI cannot
 * silently affect this batch, and vice versa. The OPENROUTER_API_KEY Script Property
 * itself is genuinely reused (docs/55 §7.3/§10) — reading a shared runtime secret is
 * not the same as depending on a frozen file's own code or constants.
 *
 * ---- Rate limiting (docs/55 §10) ----
 * A per-doctor, per-UTC-day invocation ceiling, implemented via CacheService, mirroring
 * FoundationRateLimit.gs's own "an ephemeral counter, not a Sheet-backed row, is the
 * correct pilot-scale choice" pattern — a disclosed, implementation-time decision
 * (docs/55 §10/§17 explicitly leave the exact mechanism open) that differs from that
 * section's own alternative suggestion of a Sheet-backed daily counter row. Fails open
 * on a CacheService error, mirroring FoundationRateLimit.gs's own documented exception
 * to ADR-010's "more secure default" — this layer is a supplementary cost-control
 * mechanic, not AI Assistant's actual security boundary (fail-closed enablement,
 * roster/specialty scoping, and DoctorSession authentication remain the real
 * boundaries, none of which fail open).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/
 * PXP-1..11/WPI-1..9 file, and zero modification to Phase 1.5's Config.gs/Ai.gs —
 * reuses FoundationDataStore.gs's/FoundationAudit.gs's existing generic operations,
 * DoctorModuleState.gs's existing foundationGetDoctorModuleStates_(), and
 * AIAssistantContext.gs's/AIAssistantDriftCheck.gs's own new functions exactly as each
 * was designed to be reused (ADR-009).
 *
 * Depends on AIAssistantContext.gs, AIAssistantDriftCheck.gs, DoctorModuleState.gs,
 * FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_AI_ASSISTANT_INTERACTIONS_SHEET_ = 'AIAssistantInteractions';
var FOUNDATION_AI_ASSISTANT_INTERACTIONS_COLUMNS_ = [
  'interaction_id', 'doctor_id', 'patient_id', 'capability_key', 'context_snapshot',
  'prompt_template_version', 'model', 'ai_output', 'ai_output_flags', 'doctor_decision',
  'decision_notes', 'target_entity_type', 'target_entity_id', 'created_at', 'decided_at'
];

var FOUNDATION_AI_ASSISTANT_DECIDABLE_STATUSES_ = ['accepted', 'edited_and_accepted', 'rejected', 'ignored'];

// A decoupled mirror of Config.gs's CONFIG.AI shape — see this file's own header
// comment for why this batch never reads that frozen Phase 1.5 file directly.
var FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_ = {
  OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MODEL: 'anthropic/claude-haiku-4.5',
  TEMPERATURE: 0,
  MAX_OUTPUT_TOKENS: 300
};

var FOUNDATION_AI_ASSISTANT_PROMPT_VERSION_ = '1.0';

// Implements apps-script/AI-ASSISTANT-PROMPTS.md's "Capability: summarize_patient_status"
// section exactly — if the two ever disagree, that document wins and this constant
// should be corrected to match it, per that document's own closing rule.
var FOUNDATION_AI_ASSISTANT_SUMMARIZE_PATIENT_STATUS_SYSTEM_PROMPT_ =
  'You are a strict, doctor-facing drafting tool with no clinical judgment of your ' +
  'own. You will be given one JSON object describing a single patient\'s already-' +
  'stored care plan, check-ins, calculator results, and appointments.\n\n' +
  'Your ONLY task: write 2-5 short, plain-language sentences summarizing what this ' +
  'JSON object already says. This is a reference draft for the doctor, never sent to ' +
  'the patient.\n\n' +
  'Hard rules — breaking any of these is a failure:\n' +
  '1. Do not add a diagnosis, condition name, or clinical interpretation not already ' +
  'present in the JSON.\n' +
  '2. Do not add a treatment, medicine, or dosage recommendation not already present ' +
  'in the JSON.\n' +
  '3. Do not add a prognosis, outcome prediction, or reassurance not already present ' +
  'in the JSON.\n' +
  '4. Every sentence you write must be directly traceable to a specific field in the ' +
  'JSON. If you cannot point to the exact field a sentence came from, delete that ' +
  'sentence.\n' +
  '5. Output format: plain text only, 2-5 sentences, no headers, no bullet points, no ' +
  'markdown, no disclaimers, no sign-off.\n\n' +
  'You are a summarization layer, not a medical assistant. Do not answer general ' +
  'clinical questions — only report what this specific JSON object already contains.';

var FOUNDATION_AI_ASSISTANT_SYSTEM_PROMPTS_ = {
  summarize_patient_status: FOUNDATION_AI_ASSISTANT_SUMMARIZE_PATIENT_STATUS_SYSTEM_PROMPT_
};

// CacheService.put()'s actual maximum TTL is 21600 seconds (6 hours) — a value
// above that is silently clamped by the platform, not rejected, so the
// original 86400 (24h) here never took effect: each counter actually expired
// after 6 hours, letting a doctor's per-day budget silently reset up to four
// times a day instead of once. The per-day ceiling below is enforced across
// FOUNDATION_AI_ASSISTANT_RATE_LIMIT_BUCKETS_PER_DAY_ consecutive windows of
// this exact size (see foundationCheckAndIncrementAiAssistantRateLimit_),
// rather than by requesting a longer TTL than the platform actually honors.
var FOUNDATION_AI_ASSISTANT_RATE_LIMIT_WINDOW_SECONDS_ = 21600;
var FOUNDATION_AI_ASSISTANT_RATE_LIMIT_BUCKETS_PER_DAY_ = 86400 / FOUNDATION_AI_ASSISTANT_RATE_LIMIT_WINDOW_SECONDS_;
var FOUNDATION_AI_ASSISTANT_RATE_LIMIT_MAX_PER_DAY_ = 20;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * post_ai_assistant_query request's own shape — the deeper capability/enablement/
 * roster checks happen in foundationCreateAiAssistantInteraction_() itself, mirroring
 * every other Foundation entity's "pure shape check first, stateful check after"
 * discipline.
 */
function foundationValidatePostAiAssistantQueryInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.capability_key !== 'string' || input.capability_key.trim() === '') {
    errors.push('capability_key is required.');
  }
  if (input && input.patient_id !== undefined && input.patient_id !== null && typeof input.patient_id !== 'string') {
    errors.push('patient_id must be a string when provided.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * post_ai_assistant_decision request's own shape — whether interaction_id actually
 * resolves to an existing, pending, caller-owned row is checked by
 * foundationRecordAiAssistantDecision_() itself.
 */
function foundationValidatePostAiAssistantDecisionInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.interaction_id !== 'string' || input.interaction_id.trim() === '') {
    errors.push('interaction_id is required.');
  }
  if (!input || typeof input.doctor_decision !== 'string' || FOUNDATION_AI_ASSISTANT_DECIDABLE_STATUSES_.indexOf(input.doctor_decision) === -1) {
    errors.push('doctor_decision must be one of: accepted, edited_and_accepted, rejected, ignored.');
  }
  return errors;
}

/**
 * Converts one Sheets row (context_snapshot/ai_output_flags still JSON strings) into
 * this entity's real, contractual API shape — mirrors
 * foundationCalculatorResultRowToApiShape_() exactly, including its fail-soft
 * degrade-to-empty behavior for a malformed stored string (should never happen — every
 * write path serializes via JSON.stringify()).
 */
function foundationAiAssistantInteractionRowToApiShape_(row) {
  var parsedContext;
  try {
    parsedContext = JSON.parse(row.context_snapshot || '{}');
  } catch (err) {
    parsedContext = {};
  }
  var parsedFlags;
  try {
    parsedFlags = JSON.parse(row.ai_output_flags || '[]');
  } catch (err) {
    parsedFlags = [];
  }
  return {
    interaction_id: row.interaction_id,
    doctor_id: row.doctor_id,
    patient_id: row.patient_id,
    capability_key: row.capability_key,
    context_snapshot: parsedContext,
    prompt_template_version: row.prompt_template_version,
    model: row.model,
    ai_output: row.ai_output,
    ai_output_flags: parsedFlags,
    doctor_decision: row.doctor_decision,
    decision_notes: row.decision_notes,
    target_entity_type: row.target_entity_type,
    target_entity_id: row.target_entity_id,
    created_at: row.created_at,
    decided_at: row.decided_at
  };
}

// ---- Rate limiting (CacheService — see this file's own header comment) ----

/**
 * Returns a cache key namespaced to this feature, the current UTC calendar day, and
 * one of that day's FOUNDATION_AI_ASSISTANT_RATE_LIMIT_BUCKETS_PER_DAY_ windows,
 * keyed by a hash of doctorId — mirrors foundationRateLimitCacheKey_()'s own
 * hash-the-identifier discipline. Each bucket is its own CacheService entry sized
 * to the platform's real 21600s TTL ceiling, never a single entry asked to outlive it.
 */
function foundationAiAssistantRateLimitCacheKey_(doctorId, utcDate, bucketIndex) {
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, doctorId + '::' + utcDate + '::' + bucketIndex);
  var hex = digestBytes.map(function (b) {
    var unsigned = b < 0 ? b + 256 : b;
    var hexStr = unsigned.toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  }).join('');
  return 'foundation_ai_assistant_rl_' + hex;
}

/**
 * Returns true and increments the counter if doctorId is still within today's (UTC)
 * request budget; returns false once the budget is spent. Fails open on a
 * CacheService error — see this file's own header comment for why that is the
 * disclosed, correct behavior here, mirroring FoundationRateLimit.gs's own precedent.
 *
 * The 24-hour budget is tracked as the sum of counts across today's buckets so far
 * (see FOUNDATION_AI_ASSISTANT_RATE_LIMIT_WINDOW_SECONDS_'s own comment for why a
 * single, longer-lived entry cannot be used instead) — only the current bucket is
 * incremented, but every earlier bucket from today still counts toward the ceiling
 * for as long as CacheService actually retains it.
 */
function foundationCheckAndIncrementAiAssistantRateLimit_(doctorId) {
  try {
    var cache = CacheService.getScriptCache();
    var now = new Date();
    var utcDate = now.toISOString().slice(0, 10); // 'YYYY-MM-DD', UTC
    var secondsSinceUtcMidnight = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
    var currentBucket = Math.floor(secondsSinceUtcMidnight / FOUNDATION_AI_ASSISTANT_RATE_LIMIT_WINDOW_SECONDS_);

    var total = 0;
    for (var b = 0; b <= currentBucket; b++) {
      var bucketCount = parseInt(cache.get(foundationAiAssistantRateLimitCacheKey_(doctorId, utcDate, b)), 10);
      if (!isNaN(bucketCount)) total += bucketCount;
    }
    if (total >= FOUNDATION_AI_ASSISTANT_RATE_LIMIT_MAX_PER_DAY_) {
      return false;
    }

    var currentKey = foundationAiAssistantRateLimitCacheKey_(doctorId, utcDate, currentBucket);
    var currentCount = parseInt(cache.get(currentKey), 10);
    if (isNaN(currentCount)) currentCount = 0;
    cache.put(currentKey, String(currentCount + 1), FOUNDATION_AI_ASSISTANT_RATE_LIMIT_WINDOW_SECONDS_);
    return true;
  } catch (err) {
    Logger.log('AIAssistantInteraction: CacheService error, failing open: ' + (err && err.message ? err.message : err));
    return true;
  }
}

// ---- Model call (reuses Ai.gs's own UrlFetchApp/OPENROUTER_API_KEY pattern) ----

/**
 * Calls OpenRouter with capabilityKey's own system prompt and the assembled context
 * (serialized) as the user message. Mirrors Ai.gs's callOpenRouterSummary_() exactly,
 * against this file's own local FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_ (see this file's
 * own header comment). Throws on any failure — callers catch and translate to a safe
 * envelope, mirroring summarizeNote_()'s own "never let a raw exception reach the
 * caller" discipline.
 */
function callOpenRouterForAiAssistant_(systemPrompt, userContent) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in Script Properties.');
  }
  var response = UrlFetchApp.fetch(FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_.OPENROUTER_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_.MODEL,
      temperature: FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_.TEMPERATURE,
      max_tokens: FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_.MAX_OUTPUT_TOKENS,
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
    throw new Error('OpenRouter response did not contain draft text.');
  }
  return content.trim();
}

// ---- Sheets-backed operations ----

/**
 * Runs the full post_ai_assistant_query pipeline (this file's own header comment) and
 * writes exactly one AIAssistantInteraction row on success. input.doctor_id must
 * already be DoctorSession-derived by the caller (ADR-017) — this function never
 * re-derives it. Rejects (FOUNDATION_INVALID_INPUT) a malformed request shape, an
 * unknown capability_key, a patient_id outside the caller's own roster, or a missing
 * patient_id a patient-scoped capability requires (AIAssistantContext.gs's own
 * checks); rejects (FOUNDATION_UNAUTHORIZED) a caller with the ai_assistant capability
 * not enabled (fail-closed, ADR-010/ADR-023); rejects
 * (FOUNDATION_AI_ASSISTANT_RATE_LIMITED) a caller who has exhausted today's budget;
 * rejects (FOUNDATION_AI_ASSISTANT_UNAVAILABLE) a genuine model-call failure.
 */
function foundationCreateAiAssistantInteraction_(input) {
  var errors = foundationValidatePostAiAssistantQueryInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var capabilityKey = input.capability_key.trim();

  // ---- Fail-closed enablement — this batch's own disclosed divergence, see header ----
  var statesLookup = foundationGetDoctorModuleStates_(doctorId);
  if (statesLookup.status === 'error') {
    return statesLookup;
  }
  var aiAssistantState = statesLookup.data.filter(function (s) { return s.capability_key === 'ai_assistant'; })[0];
  if (!aiAssistantState || aiAssistantState.enabled !== true) {
    return buildFoundationErrorEnvelope_('FOUNDATION_UNAUTHORIZED', 'AI Assistant is not enabled for your account. Contact your administrator.');
  }

  // ---- Rate limit ----
  if (!foundationCheckAndIncrementAiAssistantRateLimit_(doctorId)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_AI_ASSISTANT_RATE_LIMITED', 'You have reached today\'s AI Assistant usage limit. Please try again tomorrow.');
  }

  // ---- Context assembly (roster/capability-bounded, AIAssistantContext.gs) ----
  var contextLookup = foundationBuildAiAssistantContext_(doctorId, capabilityKey, input.patient_id);
  if (contextLookup.status === 'error') {
    return contextLookup;
  }
  var context = contextLookup.data;

  var systemPrompt = FOUNDATION_AI_ASSISTANT_SYSTEM_PROMPTS_[capabilityKey];
  if (!systemPrompt) {
    // A capability the registry knows about but this batch has not yet written a
    // prompt for — a disclosed gap for whichever future batch adds it, mirroring
    // AIAssistantContext.gs's own "no builder for this source" discipline.
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'This capability has no prompt implementation yet.');
  }

  var aiOutput;
  try {
    aiOutput = callOpenRouterForAiAssistant_(systemPrompt, JSON.stringify(context));
  } catch (err) {
    Logger.log('AIAssistantInteraction: model call failed: ' + (err && err.message ? err.message : err));
    return buildFoundationErrorEnvelope_('FOUNDATION_AI_ASSISTANT_UNAVAILABLE', 'Could not generate a draft right now. Please try again.');
  }

  var flags = AssistantDriftCheck_(context, aiOutput);

  return withFoundationErrorHandling_(function () {
    var interactionId = generateFoundationId_();
    var sheetRow = {
      interaction_id: interactionId,
      doctor_id: doctorId,
      patient_id: context.patient_id || '',
      capability_key: capabilityKey,
      context_snapshot: JSON.stringify(context),
      prompt_template_version: FOUNDATION_AI_ASSISTANT_PROMPT_VERSION_,
      model: FOUNDATION_AI_ASSISTANT_MODEL_CONFIG_.MODEL,
      ai_output: aiOutput,
      ai_output_flags: JSON.stringify(flags),
      doctor_decision: 'pending',
      decision_notes: '',
      target_entity_type: '',
      target_entity_id: '',
      created_at: foundationNowIso_(),
      decided_at: ''
    };
    foundationDsInsert_(FOUNDATION_AI_ASSISTANT_INTERACTIONS_SHEET_, FOUNDATION_AI_ASSISTANT_INTERACTIONS_COLUMNS_, sheetRow);
    foundationLogAuditEvent_('ai_assistant_query_created', '', doctorId, 'interaction_id=' + interactionId + ';capability_key=' + capabilityKey);
    return foundationAiAssistantInteractionRowToApiShape_(sheetRow);
  });
}

/**
 * Records the caller's one-way doctor_decision transition on an interaction row they
 * own. input.doctor_id must already be DoctorSession-derived by the caller. Rejects
 * (FOUNDATION_INVALID_INPUT) an unknown interaction_id, one not owned by the calling
 * doctor, or one no longer 'pending' — the same generic "not found or not yours"
 * outcome every other Foundation entity's ownership check already uses, never
 * distinguishing which. Never writes to any entity's Sheet other than
 * AIAssistantInteractions (ADR-022's central guarantee, docs/55 §18 item 1).
 */
function foundationRecordAiAssistantDecision_(input) {
  var errors = foundationValidatePostAiAssistantDecisionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var interactionId = input.interaction_id.trim();

  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_AI_ASSISTANT_INTERACTIONS_SHEET_, FOUNDATION_AI_ASSISTANT_INTERACTIONS_COLUMNS_, 'interaction_id', interactionId);
  });
  if (lookup.status === 'error') {
    return lookup;
  }
  var existing = lookup.data;
  if (!existing || existing.doctor_id !== doctorId || existing.doctor_decision !== 'pending') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'interaction_id must reference your own, still-pending AI Assistant interaction.');
  }

  return withFoundationErrorHandling_(function () {
    var patch = {
      doctor_decision: input.doctor_decision,
      decision_notes: (input.decision_notes || '').toString().trim(),
      target_entity_type: (input.target_entity_type || '').toString().trim(),
      target_entity_id: (input.target_entity_id || '').toString().trim(),
      decided_at: foundationNowIso_()
    };
    foundationDsUpdateById_(FOUNDATION_AI_ASSISTANT_INTERACTIONS_SHEET_, FOUNDATION_AI_ASSISTANT_INTERACTIONS_COLUMNS_, 'interaction_id', interactionId, patch);
    foundationLogAuditEvent_('ai_assistant_decision_recorded', '', doctorId, 'interaction_id=' + interactionId + ';doctor_decision=' + input.doctor_decision);
    Object.keys(patch).forEach(function (key) { existing[key] = patch[key]; });
    return foundationAiAssistantInteractionRowToApiShape_(existing);
  });
}
