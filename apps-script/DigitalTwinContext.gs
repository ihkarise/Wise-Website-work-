/**
 * Digital Twin Context, Digital Twin View & Progress Analytics — Batch PXP-12 (Phase 2D —
 * Wise Digital Twin & AI Summaries, docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md
 * §6/§11.3, ADR-004/ADR-028/ADR-029, docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this
 * batch). Implements shared/constants/digital-twin-narrative-registry.json version 1.0.0, plus
 * the three deterministic, non-AI concerns docs/59 §6 names:
 *
 *   1. DigitalTwinContextBuilder (§6.2) — given a resolved patient_id and a narrative_type,
 *      assembles the bounded, flat JSON object the narrative's prompt is built from, reading
 *      ONLY the entities that narrative_type's own context_sources allow-list declares — never
 *      "everything" (ADR-029). Every field is a literal value copied from an existing scoped
 *      reader; nothing is paraphrased or interpreted before it reaches the model.
 *   2. The Digital Twin view (§6.1) — a bounded, deterministic aggregation of the patient's own
 *      record into one summary object, computed on read, never stored (ADR-004/ADR-028).
 *   3. The Progress Analytics view (§6.3) — a deterministic, non-AI, patient-scoped trend view
 *      (the patient-facing counterpart to WPI-9's doctor-facing Analytics), computed on read,
 *      never stored, NEVER a model call — the always-safe half of the patient experience.
 *
 * ---- No AI here, by construction (docs/59 §18 item 6) ----
 * This file makes NO model/UrlFetchApp/AI call of any kind. The Digital Twin's only model call
 * lives in DigitalTwinNarrative.gs's generation pipeline; retrieval and both computed views are
 * 100% deterministic code. validation/static-analysis/analyze.js's Digital Twin static rules 4
 * and 6 enforce this at the code level: no direct Sheet primitive, and no outbound/model call,
 * in this file.
 *
 * ---- Grounded in scoped readers only (ADR-029, docs/59 §18 item 4) ----
 * Every context source is read through an already-existing, already-scoped reader function
 * (foundationGetCurrentCarePlanForPatient_(), foundationGetPatientCheckInResponses_(),
 * foundationGetPatientCalculatorResults_(), foundationGetPatientSymptomLogs_(),
 * foundationGetMedicationHistoryForPatient_(), foundationGetHealthMilestonesForPatient_()) —
 * never a new, direct Sheet read. The Health-Milestone reader returns PUBLISHED reviews only
 * (docs/58 §10.2), so the builder honors Phase 2C's own patient-visibility boundary for free
 * (docs/59 §6.2). patient_id must already be resolved (roster-validated for a doctor caller,
 * session-derived for a patient caller) by the caller — this file never re-derives or
 * re-authorizes it.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/PXP-1..11/
 * WPI-1..11 file — reuses each entity's existing scoped reader exactly as it was designed to be
 * reused (ADR-009).
 *
 * Depends on CarePlan.gs, CheckInResponse.gs, CalculatorResult.gs, FoundationSymptomLog.gs,
 * MedicationHistory.gs, MilestoneReview.gs, FoundationContracts.gs, FoundationErrorHandling.gs,
 * FoundationUtils.gs.
 */

// Hand-ported from shared/constants/digital-twin-narrative-registry.json version 1.0.0 — the
// same duplication-by-convention AIAssistantContext.gs's own capability registry already
// established (a browser/runtime has no build step to read the canonical JSON). Update both
// places by hand if the canonical list ever changes, per shared/README.md's rule.
var FOUNDATION_DIGITAL_TWIN_NARRATIVE_REGISTRY_ = [
  {
    narrative_type: 'health_story',
    display_name: 'Health Story',
    description: 'A plain-language narrative of the patient\'s own recorded history — care plan, recent check-ins, calculator results, symptom logs, medication history, and celebrated health milestones — organized into one readable story. Never a diagnosis, treatment, prognosis, or reassurance beyond what a doctor already recorded (ADR-004). Doctor-approved before the patient ever sees it (ADR-028).',
    context_sources: ['care_plan', 'check_in_response', 'calculator_result', 'symptom_log', 'medication_history', 'health_milestone'],
    output_shape: 'draft_text',
    requires_knowledge_engine: false,
    future_ai_capable: false
  },
  {
    narrative_type: 'ai_summary',
    display_name: 'AI Summary',
    description: 'The same AI-narrated shape as the Health Story, produced at a coarser cadence (a periodic progress summary) from a narrower slice of the patient\'s own record. Same pipeline, same doctor-approval gate, same content boundaries (ADR-004/ADR-028/ADR-029).',
    context_sources: ['check_in_response', 'calculator_result', 'health_milestone'],
    output_shape: 'draft_text',
    requires_knowledge_engine: false,
    future_ai_capable: false
  }
];

// A small, fixed cap per context source — the concrete mechanism behind docs/59 §6.2's
// "size-bounded" rule (row-count bounding, not a post-hoc byte-truncation that could produce
// invalid JSON), mirroring AIAssistantContext.gs's own FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_MAX_ENTRIES_.
var FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_MAX_ENTRIES_ = 8;

/**
 * Returns the full, static Digital Twin narrative-type registry. Pure, no Apps Script
 * dependency — covered directly by Conformance Tests.
 */
function foundationGetDigitalTwinNarrativeRegistry_() {
  return FOUNDATION_DIGITAL_TWIN_NARRATIVE_REGISTRY_;
}

/**
 * Returns the exact narrative_type registry entry, or null — mirrors
 * foundationGetAiAssistantCapabilityByKey_()'s exact-lookup shape.
 */
function foundationGetDigitalTwinNarrativeTypeByKey_(narrativeType) {
  var matches = FOUNDATION_DIGITAL_TWIN_NARRATIVE_REGISTRY_.filter(function (n) {
    return n.narrative_type === narrativeType;
  });
  return matches[0] || null;
}

// ---- Per-source builders — each reuses an existing, already-scoped patient reader ----
// Each returns a response-envelope-shaped value; foundationBuildDigitalTwinContext_() below
// short-circuits on the first error, mirroring foundationBuildAiAssistantContext_() exactly.

function foundationDigitalTwinContextSourceCarePlan_(patientId) {
  return foundationGetCurrentCarePlanForPatient_(patientId);
}

function foundationDigitalTwinContextSourceCheckInResponse_(patientId) {
  var lookup = foundationGetPatientCheckInResponses_(patientId);
  if (lookup.status === 'error') return lookup;
  return buildFoundationOkEnvelope_(lookup.data.slice(0, FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_MAX_ENTRIES_));
}

function foundationDigitalTwinContextSourceCalculatorResult_(patientId) {
  var lookup = foundationGetPatientCalculatorResults_(patientId);
  if (lookup.status === 'error') return lookup;
  return buildFoundationOkEnvelope_(lookup.data.slice(0, FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_MAX_ENTRIES_));
}

function foundationDigitalTwinContextSourceSymptomLog_(patientId) {
  var lookup = foundationGetPatientSymptomLogs_(patientId);
  if (lookup.status === 'error') return lookup;
  return buildFoundationOkEnvelope_(lookup.data.slice(0, FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_MAX_ENTRIES_));
}

function foundationDigitalTwinContextSourceMedicationHistory_(patientId) {
  var lookup = foundationGetMedicationHistoryForPatient_(patientId);
  if (lookup.status === 'error') return lookup;
  return buildFoundationOkEnvelope_(lookup.data.slice(0, FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_MAX_ENTRIES_));
}

function foundationDigitalTwinContextSourceHealthMilestone_(patientId) {
  // Returns PUBLISHED reviews only (foundationGetHealthMilestonesForPatient_'s own contract,
  // docs/58 §10.2) — the builder never sees a milestone draft.
  var lookup = foundationGetHealthMilestonesForPatient_(patientId);
  if (lookup.status === 'error') return lookup;
  return buildFoundationOkEnvelope_({
    schedule: lookup.data.schedule || [],
    reviews: (lookup.data.reviews || []).slice(0, FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_MAX_ENTRIES_)
  });
}

var FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_BUILDERS_ = {
  care_plan: foundationDigitalTwinContextSourceCarePlan_,
  check_in_response: foundationDigitalTwinContextSourceCheckInResponse_,
  calculator_result: foundationDigitalTwinContextSourceCalculatorResult_,
  symptom_log: foundationDigitalTwinContextSourceSymptomLog_,
  medication_history: foundationDigitalTwinContextSourceMedicationHistory_,
  health_milestone: foundationDigitalTwinContextSourceHealthMilestone_
};

/**
 * Assembles patientId's bounded, narrative-type-bounded context object for narrativeType,
 * reading only the entities that type's context_sources allow-list declares (ADR-029).
 * patientId must already be resolved and authorized by the caller. Returns a response-envelope:
 * FOUNDATION_INVALID_INPUT for an unknown narrative_type; otherwise the assembled context under
 * `data`. Mirrors foundationBuildAiAssistantContext_() exactly, minus the roster/capability
 * checks (the caller has already resolved patient_id).
 */
function foundationBuildDigitalTwinContext_(patientId, narrativeType) {
  var narrative = foundationGetDigitalTwinNarrativeTypeByKey_(narrativeType);
  if (!narrative) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'narrative_type must reference a real, registered Digital Twin narrative type.');
  }
  var context = {
    narrative_type: narrativeType,
    patient_id: patientId,
    generated_at: foundationNowIso_()
  };
  for (var i = 0; i < narrative.context_sources.length; i++) {
    var source = narrative.context_sources[i];
    var builder = FOUNDATION_DIGITAL_TWIN_CONTEXT_SOURCE_BUILDERS_[source];
    if (!builder) {
      // Registry declares a context_source this batch has no builder for — a disclosed gap
      // for whichever future batch adds it, never a crash (mirrors AIAssistantContext.gs).
      Logger.log('DigitalTwinContext: no context-source builder for "' + source + '" (narrative_type "' + narrativeType + '") — skipped.');
      continue;
    }
    var sourceResult = builder(patientId);
    if (sourceResult.status === 'error') {
      return sourceResult;
    }
    context[source] = sourceResult.data;
  }
  return buildFoundationOkEnvelope_(context);
}

// ---- Digital Twin view (§6.1) — computed on read, never stored (ADR-004/ADR-028) ----

/**
 * A deterministic, bounded summary of the patient's own structured record — the "living health
 * story" data, before any narration. Computed on read from each entity's own scoped reader,
 * never a stored row, mirroring Analytics.gs's own "computed view, never a base table"
 * discipline (docs/59 §6.1). patientId must already be resolved by the caller. Returns a
 * response-envelope.
 */
function foundationComputeDigitalTwinView_(patientId) {
  var carePlanLookup = foundationGetCurrentCarePlanForPatient_(patientId);
  if (carePlanLookup.status === 'error') return carePlanLookup;
  var checkInLookup = foundationGetPatientCheckInResponses_(patientId);
  if (checkInLookup.status === 'error') return checkInLookup;
  var calculatorLookup = foundationGetPatientCalculatorResults_(patientId);
  if (calculatorLookup.status === 'error') return calculatorLookup;
  var symptomLookup = foundationGetPatientSymptomLogs_(patientId);
  if (symptomLookup.status === 'error') return symptomLookup;
  var medicationLookup = foundationGetMedicationHistoryForPatient_(patientId);
  if (medicationLookup.status === 'error') return medicationLookup;
  var milestoneLookup = foundationGetHealthMilestonesForPatient_(patientId);
  if (milestoneLookup.status === 'error') return milestoneLookup;

  var schedule = milestoneLookup.data.schedule || [];
  var medications = medicationLookup.data || [];
  return buildFoundationOkEnvelope_({
    patient_id: patientId,
    generated_at: foundationNowIso_(),
    care_plan_present: !!carePlanLookup.data,
    care_plan_status: carePlanLookup.data ? (carePlanLookup.data.status || '') : '',
    check_in_count: checkInLookup.data.length,
    calculator_result_count: calculatorLookup.data.length,
    symptom_log_count: symptomLookup.data.length,
    medication_active_count: medications.filter(function (m) { return m.current_status === 'active'; }).length,
    medication_total_count: medications.length,
    milestones_total: schedule.length,
    milestones_celebrated: schedule.filter(function (p) { return p.state === 'completed'; }).length
  });
}

// ---- Progress Analytics view (§6.3) — deterministic, non-AI, NO model call ----

/**
 * A patient-scoped, deterministic aggregation of the patient's own trends — the exact
 * Analytics.gs (WPI-9) "computed view, never a base table, deterministic aggregation only"
 * discipline, applied patient-side (docs/59 §6.3). Because it produces NO AI content, it needs
 * NO doctor-review gate — it is served directly to the patient. patientId must already be
 * session-derived by the caller. Returns a response-envelope.
 */
function foundationComputeProgressAnalytics_(patientId) {
  var checkInLookup = foundationGetPatientCheckInResponses_(patientId);
  if (checkInLookup.status === 'error') return checkInLookup;
  var calculatorLookup = foundationGetPatientCalculatorResults_(patientId);
  if (calculatorLookup.status === 'error') return calculatorLookup;
  var symptomLookup = foundationGetPatientSymptomLogs_(patientId);
  if (symptomLookup.status === 'error') return symptomLookup;
  var milestoneLookup = foundationGetHealthMilestonesForPatient_(patientId);
  if (milestoneLookup.status === 'error') return milestoneLookup;

  var symptomLogs = symptomLookup.data || [];
  var severities = symptomLogs
    .map(function (row) { return typeof row.severity === 'number' ? row.severity : parseFloat(row.severity); })
    .filter(function (v) { return !isNaN(v); });
  var averageSeverity = severities.length
    ? Math.round((severities.reduce(function (a, b) { return a + b; }, 0) / severities.length) * 100) / 100
    : null;

  var resultsByCalculatorSlug = {};
  (calculatorLookup.data || []).forEach(function (row) {
    resultsByCalculatorSlug[row.calculator_slug] = (resultsByCalculatorSlug[row.calculator_slug] || 0) + 1;
  });

  var schedule = milestoneLookup.data.schedule || [];
  return buildFoundationOkEnvelope_({
    patient_id: patientId,
    generated_at: foundationNowIso_(),
    check_in_engagement: {
      total_check_ins: checkInLookup.data.length
    },
    symptom_trend: {
      total_logs: symptomLogs.length,
      average_severity: averageSeverity
    },
    calculator_engagement: {
      total_results: (calculatorLookup.data || []).length,
      results_by_calculator_slug: resultsByCalculatorSlug
    },
    milestone_progress: {
      total: schedule.length,
      celebrated: schedule.filter(function (p) { return p.state === 'completed'; }).length
    }
  });
}
