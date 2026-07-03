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
 *     file.
 *
 * A disclosed, additive exception, same category as Code.gs's own
 * one-line dispatch shim (IA-2): this file was previously listed among
 * Identity & Access's six files "frozen except for bug fixes"
 * (docs/36 §12). Adding a new `case` to the switch below for a wholly new,
 * additive action — touching zero existing lines, changing zero existing
 * behavior — is this router's designed extension point, the same way
 * get_profile's own case was added here in IA-2. Every future data-feature
 * batch (5E, 5F) will need the same kind of addition; the freeze protects
 * existing routes from being restructured, not this file from ever
 * gaining a new one.
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
 * FoundationRouteGuard.gs, PatientIdentity.gs, FoundationConsultationHistory.gs.
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
 * Batch PA-3: returns the caller's own Consultation History, sorted and
 * capped for Timeline display (docs/29 §6). patient_id is always
 * session-derived, never client-supplied.
 */
function foundationHandleGetTimeline_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientTimeline_(patientId);
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
    default:
      envelope = buildFoundationErrorEnvelope_('FOUNDATION_UNKNOWN_ACTION', 'Unknown request.');
  }
  return foundationJsonResponse_(envelope);
}
