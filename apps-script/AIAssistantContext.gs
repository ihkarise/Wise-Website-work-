/**
 * AI Assistant Context — Batch WPI-10 (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-
 * FREEZE.md §6/§11.2, ADR-021, docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this
 * batch). Implements shared/constants/ai-assistant-capability-registry.json version
 * 1.0.0, and `AssistantContextBuilder` (docs/55 §6) — the deterministic, non-AI code
 * that assembles the bounded, flat context object a capability's prompt is built from.
 *
 * ---- AI Assistant Capability Registry (config, static) ----
 * Static, hand-maintained config — not a dynamic, admin-editable system in this
 * batch's scope, the same "static, staff/developer-maintained config" precedent
 * ModuleRegistry.gs/CalculatorRegistry.gs/DoctorModuleRegistry.gs already established.
 * Manually adapted from shared/constants/ai-assistant-capability-registry.json, the
 * same duplication-by-convention those files' own header comments already established
 * — update both places by hand if the canonical list ever changes, per
 * shared/README.md's rule.
 *
 * ---- AssistantContextBuilder (docs/55 §6) ----
 * Pure, deterministic, non-AI code with one job: given a doctor_id (DoctorSession-
 * derived, never client-supplied) and an optional patient_id, assemble a bounded,
 * flat JSON object of already-stored fields relevant to the requested capability.
 * Rules, all enforced here, none left to the prompt:
 *   - Roster-scoped — a patient_id outside the caller's own derived roster
 *     (DoctorPatientRoster.gs's foundationGetDoctorPatientRoster_(), reused, never
 *     re-derived) is rejected before any read happens.
 *   - Capability-bounded — each capability_key declares its own fixed
 *     context_sources allow-list; this builder reads only what that capability
 *     declares. No capability may request "everything."
 *   - Size-bounded — every per-source read is capped to a small, fixed number of
 *     most-recent entries (5), the same bounding discipline as an explicit byte
 *     ceiling, applied here via row-count rather than a post-hoc truncation that
 *     could produce invalid JSON (docs/55 §6's "size-bounded, flat" requirement).
 *   - Read-only — this builder never writes anything, not even the audit row
 *     (AIAssistantInteraction.gs writes that after the model call returns).
 *   - Every context source is read through an already-existing, already-scoped
 *     reader function (foundationGetCurrentCarePlanForPatient_(),
 *     foundationGetPatientCheckInResponses_(), foundationGetPatientCalculatorResults_(),
 *     foundationGetDoctorAppointments_()) — never a new, direct Sheet read
 *     (docs/55 §18 item 4's static-analysis requirement).
 *
 * Seeded with one registered capability, summarize_patient_status — see
 * shared/constants/ai-assistant-capability-registry.md for the disclosed "ships with
 * one entry" scope decision. This file's own per-source builder map only implements
 * the four sources that one capability actually declares (care_plan,
 * check_in_response, calculator_result, appointment) — a future capability naming an
 * unimplemented source is a disclosed gap for whichever later batch registers it, not
 * a silent crash (foundationBuildAiAssistantContext_() skips, rather than throws on,
 * an unrecognized source key).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/
 * PXP-1..11/WPI-1..9 file — reuses DoctorPatientRoster.gs's, CarePlan.gs's,
 * CheckInResponse.gs's, CalculatorResult.gs's, and Appointment.gs's existing reader
 * functions exactly as each was already designed to be reused (ADR-009).
 *
 * Depends on DoctorPatientRoster.gs, CarePlan.gs, CheckInResponse.gs,
 * CalculatorResult.gs, Appointment.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs, FoundationUtils.gs.
 */

var FOUNDATION_AI_ASSISTANT_CAPABILITY_REGISTRY_ = [
  {
    capability_key: 'summarize_patient_status',
    display_name: 'Summarize Patient Status',
    description: 'Drafts a short, plain-language summary of one roster patient\'s current care plan, recent check-ins, calculator results, and appointment history — reference only, never saved anywhere by this capability itself.',
    context_sources: ['care_plan', 'check_in_response', 'calculator_result', 'appointment'],
    output_shape: 'draft_text',
    target_entity_type: null,
    requires_knowledge_engine: false,
    future_ai_capable: false
  }
];

// Every context_source key here belongs to one specific patient — a capability
// declaring any of these requires a real patient_id (docs/55 §6/§11.2's own
// per-capability description already implies this for summarize_patient_status; this
// is the generic rule that implication follows from, so a future capability doesn't
// need to redeclare it). inventory/analytics (doctor-roster-wide, not one-patient-
// scoped) are deliberately absent — no capability using either exists yet.
var FOUNDATION_AI_ASSISTANT_PATIENT_SCOPED_CONTEXT_SOURCES_ = [
  'care_plan', 'doctor_instruction', 'check_in_response', 'calculator_result', 'appointment', 'pillfill_order'
];

// A small, fixed cap per context source — the concrete mechanism behind docs/55 §6's
// "size-bounded" rule (row-count bounding, not a post-hoc byte-truncation that could
// produce invalid JSON).
var FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_MAX_ENTRIES_ = 5;

/**
 * Returns the full, static AI Assistant Capability Registry list. Pure, no Apps
 * Script dependency — covered directly by Conformance Tests, the same convention
 * every other Foundation-family pure helper already follows.
 */
function foundationGetAiAssistantCapabilityRegistry_() {
  return FOUNDATION_AI_ASSISTANT_CAPABILITY_REGISTRY_;
}

/**
 * Returns the exact capability_key registry entry, or null — mirrors
 * foundationGetSpecialtyBySlug_()'s exact-lookup shape.
 */
function foundationGetAiAssistantCapabilityByKey_(capabilityKey) {
  var matches = FOUNDATION_AI_ASSISTANT_CAPABILITY_REGISTRY_.filter(function (c) {
    return c.capability_key === capabilityKey;
  });
  return matches[0] || null;
}

/**
 * True if `capability`'s own context_sources includes at least one patient-scoped
 * source — the generic rule a capability like summarize_patient_status's own
 * requirement follows from.
 */
function foundationAiAssistantCapabilityRequiresPatient_(capability) {
  return capability.context_sources.some(function (source) {
    return FOUNDATION_AI_ASSISTANT_PATIENT_SCOPED_CONTEXT_SOURCES_.indexOf(source) !== -1;
  });
}

// ---- Per-source builders — each reuses an existing, already-scoped reader ----

function foundationAiAssistantContextSourceCarePlan_(doctorId, patientId) {
  return foundationGetCurrentCarePlanForPatient_(patientId);
}

function foundationAiAssistantContextSourceCheckInResponse_(doctorId, patientId) {
  var lookup = foundationGetPatientCheckInResponses_(patientId);
  if (lookup.status === 'error') return lookup;
  return buildFoundationOkEnvelope_(lookup.data.slice(0, FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_MAX_ENTRIES_));
}

function foundationAiAssistantContextSourceCalculatorResult_(doctorId, patientId) {
  var lookup = foundationGetPatientCalculatorResults_(patientId);
  if (lookup.status === 'error') return lookup;
  return buildFoundationOkEnvelope_(lookup.data.slice(0, FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_MAX_ENTRIES_));
}

function foundationAiAssistantContextSourceAppointment_(doctorId, patientId) {
  var lookup = foundationGetDoctorAppointments_(doctorId);
  if (lookup.status === 'error') return lookup;
  var forPatient = lookup.data.filter(function (row) { return row.patient_id === patientId; });
  return buildFoundationOkEnvelope_(forPatient.slice(0, FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_MAX_ENTRIES_));
}

var FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_BUILDERS_ = {
  care_plan: foundationAiAssistantContextSourceCarePlan_,
  check_in_response: foundationAiAssistantContextSourceCheckInResponse_,
  calculator_result: foundationAiAssistantContextSourceCalculatorResult_,
  appointment: foundationAiAssistantContextSourceAppointment_
};

/**
 * Assembles doctorId's bounded, roster-scoped, capability-bounded context object for
 * capabilityKey, optionally scoped to one roster patientId. doctorId must already be
 * DoctorSession-verified by the caller — this function never re-derives it. Returns a
 * response-envelope-shaped value: FOUNDATION_INVALID_INPUT for an unknown
 * capability_key, a missing patient_id a patient-scoped capability requires, or a
 * patient_id outside the caller's own derived roster; otherwise the assembled context
 * object under `data`.
 */
function foundationBuildAiAssistantContext_(doctorId, capabilityKey, patientId) {
  var capability = foundationGetAiAssistantCapabilityByKey_(capabilityKey);
  if (!capability) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'capability_key must reference a real, registered AI Assistant capability.');
  }

  var trimmedPatientId = (patientId || '').toString().trim();
  var requiresPatient = foundationAiAssistantCapabilityRequiresPatient_(capability);
  if (requiresPatient && trimmedPatientId === '') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id is required for this capability.');
  }

  if (trimmedPatientId !== '') {
    var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
    if (rosterLookup.status === 'error') {
      return rosterLookup;
    }
    var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === trimmedPatientId; });
    if (!onRoster) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must belong to your own patient roster.');
    }
  }

  var context = {
    capability_key: capabilityKey,
    doctor_id: doctorId,
    patient_id: trimmedPatientId,
    generated_at: foundationNowIso_()
  };

  for (var i = 0; i < capability.context_sources.length; i++) {
    var source = capability.context_sources[i];
    var builder = FOUNDATION_AI_ASSISTANT_CONTEXT_SOURCE_BUILDERS_[source];
    if (!builder) {
      // Registry declares a context_source this batch has no builder for — a
      // disclosed gap for whichever future batch registers a capability needing it
      // (this file's own header comment), never a crash.
      Logger.log('AIAssistantContext: no context-source builder for "' + source + '" (capability_key "' + capabilityKey + '") — skipped.');
      continue;
    }
    var sourceResult = builder(doctorId, trimmedPatientId);
    if (sourceResult.status === 'error') {
      return sourceResult;
    }
    context[source] = sourceResult.data;
  }

  return buildFoundationOkEnvelope_(context);
}
