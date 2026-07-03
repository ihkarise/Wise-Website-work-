/**
 * HTTP-level dispatch for Foundation's Web App routes — IA-2's "first
 * real Web App route" deliverable (docs/29 §15). This is what
 * apps-script/Code.gs's doPost() delegates to when the parsed request
 * body carries a `foundation_action` field (see Code.gs's own header
 * comment for the dispatch boundary and why that one line is the only
 * change made to a Phase 1.5 file).
 *
 * Every action below returns a response-envelope-shaped value
 * (FoundationContracts.gs); this file's only job is picking the right
 * handler and serializing the result to the wire — the same "thin entry
 * point, no business logic" discipline Code.gs's own header comment
 * already states for Phase 1.5. get_profile, get_timeline, and
 * get_timeline_entry are all pure wiring (withFoundationAuth_ + a single
 * already-existing entity call, no validation or orchestration of their
 * own), so all three live here directly rather than in their own files;
 * request/consume (real orchestration across multiple Foundation
 * entities) live in FoundationLoginFlow.gs.
 *
 * Unauthenticated actions (docs/29 §3's necessarily-public request-link
 * step): request_login_link, consume_login_link.
 * Authenticated actions (routed through withFoundationAuth_(),
 * FoundationRouteGuard.gs), deriving patient_id only from the verified
 * session, never from the request body (ADR-002, docs/29 §3):
 *   - get_profile — IA-2's original authenticated route.
 *   - get_timeline / get_timeline_entry — Batch PA-3 additions (docs/29
 *     §13 Batch 5D). get_timeline_entry additionally verifies the
 *     requested record_id's own patient_id matches the session-derived
 *     one before returning it (docs/40-CONSULTATION-IDENTITY-STRATEGY.md
 *     Q3) — record_id's unguessability is not itself an authorization
 *     boundary, so FoundationConsultationHistory.gs's
 *     foundationGetConsultationEntryById_() performs that check, not this
 *     file. Note: get_timeline now dispatches through
 *     FoundationTimeline.gs's foundationGetPatientTimelineMerged_() (Batch
 *     PA-4, see below), not FoundationConsultationHistory.gs's
 *     foundationGetPatientTimeline_() directly — the only behavior change
 *     in this file this batch makes; get_timeline_entry is unchanged.
 *   - create_symptom_draft / update_symptom_draft / submit_symptom_log /
 *     get_symptom_logs — Batch PA-4 additions (docs/29 §13 Batch 5E),
 *     the platform's first patient-*writable* routes. All four derive
 *     patient_id only from the verified session, never the request body,
 *     the same discipline every route above already follows.
 *
 * A disclosed, additive exception, same category as Code.gs's own
 * one-line dispatch shim (IA-2): this file was previously listed among
 * Identity & Access's six files "frozen except for bug fixes"
 * (docs/36 §12). Adding a new `case` to the switch below for a wholly new,
 * additive action — touching zero existing lines, changing zero existing
 * behavior — is this router's designed extension point, the same way
 * get_profile's own case was added here in IA-2. Batch PA-4 uses this
 * extension point four more times, and additionally repoints
 * get_timeline's one existing case at a new merge function (see above) —
 * disclosed here rather than silently made, per this session's "do not
 * modify frozen components except for bug fixes, and disclose any
 * exception" instruction. The freeze protects existing routes from being
 * restructured on their own terms, not this file from ever gaining a new
 * one or from a later-approved product decision (Symptom Log entries
 * appearing in Timeline) changing what an existing route returns.
 *
 * Uses ContentService directly, not Code.gs's own jsonResponse_() helper
 * — that helper wraps its body in a numeric-status envelope
 * (`{status: <http-like code>, ...}`) shaped for Phase 1.5's own
 * clients, which would collide with and overwrite Foundation's own
 * string-valued `status: 'ok'|'error'` envelope field
 * (FoundationContracts.gs, shared/contracts/response-envelope.schema.json)
 * if the two were nested. Building the response directly here avoids
 * that shape collision entirely and avoids any dependency on a Phase 1.5
 * file.
 *
 * Depends on FoundationContracts.gs, FoundationLoginFlow.gs,
 * FoundationRouteGuard.gs, PatientIdentity.gs, FoundationConsultationHistory.gs,
 * FoundationTimeline.gs, FoundationSymptomLog.gs.
 */

/**
 * Foundation's first authenticated route: returns the caller's own
 * Patient record, resolved strictly from the verified session.
 */
function foundationHandleGetProfile_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientById_(patientId);
  });
}

/**
 * Batch PA-3, updated Batch PA-4: returns the caller's own merged
 * Timeline — ConsultationHistory entries plus submitted (never draft)
 * Symptom Log entries, sorted and capped together (docs/29 §6,
 * docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md's approved decision).
 * patient_id is always session-derived, never client-supplied.
 */
function foundationHandleGetTimeline_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientTimelineMerged_(patientId);
  });
}

/**
 * Batch PA-3: returns a single Consultation History entry by record_id,
 * scoped strictly to the caller's own session-derived patient_id
 * (docs/40 Q3) — foundationGetConsultationEntryById_() itself performs the
 * ownership check and returns the same generic FOUNDATION_NOT_FOUND
 * whether the record_id doesn't exist or belongs to someone else.
 */
function foundationHandleGetTimelineEntry_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetConsultationEntryById_(patientId, input && input.record_id);
  });
}

/**
 * Batch PA-4: returns the caller's own open Symptom Log draft, creating
 * one if none exists yet (FoundationSymptomLog.gs's "one open draft per
 * patient at a time" rule). condition_slug is copied from the caller's
 * own Patient profile at creation time (docs/41 §10) — this is the one
 * place a profile lookup precedes the entity call, since
 * foundationGetOrCreateSymptomLogDraft_() itself never reaches into
 * PatientIdentity.gs.
 */
function foundationHandleCreateSymptomDraft_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    var profile = foundationGetPatientById_(patientId);
    if (profile.status === 'error') {
      return profile; // unexpected — already a safe, generic envelope
    }
    return foundationGetOrCreateSymptomLogDraft_(patientId, profile.data.condition_slug);
  });
}

/**
 * Batch PA-4: edits the mutable fields of the caller's own draft.
 * foundationUpdateSymptomLogDraft_() itself verifies ownership and draft
 * status before applying any change.
 */
function foundationHandleUpdateSymptomDraft_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationUpdateSymptomLogDraft_(patientId, input && input.record_id, {
      severity: input && input.severity,
      sleep: input && input.sleep,
      energy: input && input.energy,
      stress: input && input.stress,
      notes: input && input.notes
    });
  });
}

/**
 * Batch PA-4: submits the caller's own draft — irreversible.
 * foundationSubmitSymptomLogDraft_() re-validates the row's own stored
 * values, never the request body, before allowing the transition.
 */
function foundationHandleSubmitSymptomLog_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationSubmitSymptomLogDraft_(patientId, input && input.record_id);
  });
}

/**
 * Batch PA-4: returns the caller's own Symptom Log history — their
 * current open draft (or null) plus their submitted entries. Both halves
 * are the patient's own data; drafts are private to the patient but never
 * hidden from the patient themselves (docs/41).
 */
function foundationHandleGetSymptomLogs_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientSymptomLogs_(patientId);
  });
}

/**
 * Serializes a response-envelope-shaped value to the wire. Apps Script
 * Web Apps cannot set a real HTTP status code (every response transports
 * as HTTP 200 regardless — the same platform fact Code.gs's own
 * jsonResponse_() documents) — callers branch on the JSON body's
 * `status` field, here meaning 'ok'/'error' per FoundationContracts.gs,
 * not Phase 1.5's numeric convention.
 */
function foundationJsonResponse_(envelope) {
  return ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Routes a parsed Foundation request body to the right handler by its
 * `foundation_action` field. An unrecognized action is an expected,
 * generic outcome, not a thrown error.
 */
function handleFoundationRequest_(input) {
  var action = input && input.foundation_action;
  var envelope;
  switch (action) {
    case 'request_login_link':
      envelope = foundationHandleRequestLoginLink_(input);
      break;
    case 'consume_login_link':
      envelope = foundationHandleConsumeLoginLink_(input);
      break;
    case 'get_profile':
      envelope = foundationHandleGetProfile_(input);
      break;
    case 'get_timeline':
      envelope = foundationHandleGetTimeline_(input);
      break;
    case 'get_timeline_entry':
      envelope = foundationHandleGetTimelineEntry_(input);
      break;
    case 'create_symptom_draft':
      envelope = foundationHandleCreateSymptomDraft_(input);
      break;
    case 'update_symptom_draft':
      envelope = foundationHandleUpdateSymptomDraft_(input);
      break;
    case 'submit_symptom_log':
      envelope = foundationHandleSubmitSymptomLog_(input);
      break;
    case 'get_symptom_logs':
      envelope = foundationHandleGetSymptomLogs_(input);
      break;
    default:
      envelope = buildFoundationErrorEnvelope_('FOUNDATION_UNKNOWN_ACTION', 'Unknown request.');
  }
  return foundationJsonResponse_(envelope);
}
