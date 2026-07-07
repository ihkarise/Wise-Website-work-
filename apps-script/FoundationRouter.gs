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
 *   - log_symptom / get_symptom_logs — Batch PA-4 additions (docs/29 §13
 *     Batch 5E), the platform's first patient-*writable* route.
 *     log_symptom's patient_id is session-derived exactly like every
 *     read route above — the write path reuses the same authorization
 *     primitive, not a new one (docs/41 §12).
 *   - upload_report / get_reports / download_report — Batch PA-5
 *     additions (docs/29 §13 Batch 5F), the platform's highest-risk
 *     feature. upload_report's patient_id (and uploaded_by) are
 *     session-derived exactly like log_symptom's. download_report
 *     additionally verifies the requested record_id's own patient_id
 *     matches the session-derived one before ever calling DriveApp
 *     (docs/40-CONSULTATION-IDENTITY-STRATEGY.md Q3's discipline, applied
 *     here to Drive content) — FoundationReports.gs's
 *     foundationGetReportById_()/foundationDownloadReport_() perform that
 *     check, not this file. Drive's own sharing permission is never the
 *     authorization boundary (docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md
 *     §6) — this router never returns a Drive URL, only server-fetched,
 *     base64-encoded file bytes.
 *   - get_patient_profile / save_patient_profile — Batch PXP-1 additions
 *     (docs/44-PHASE-2B-TECHNICAL-PLAN.md §17/§22, docs/47), the platform's
 *     first Phase 2B route and its first patient-*mutable*, upsert-style
 *     entity. Both derive patient_id exclusively from the verified
 *     session, exactly like every route above — save_patient_profile
 *     reuses the same authorization primitive log_symptom/upload_report
 *     already use, applied here to an update instead of an append.
 *   - get_doctor_assigned_conditions — Batch PXP-2 addition (docs/44 §6/§22,
 *     docs/47), Phase 2B's Pillar 1 read surface. patient_id is
 *     session-derived exactly like every route above. This is a read-only
 *     route: there is no assign/resolve route here, and none is planned —
 *     DoctorAssignedCondition writes are doctor/staff-only and, since no
 *     real Doctor identity/session exists yet (docs/33 §1.4), remain
 *     manually-run Apps Script editor functions
 *     (DoctorAssignedCondition.gs's assignFoundationCondition()/
 *     resolveFoundationCondition()), not a Web App route.
 *   - get_patient_module_states — Batch PXP-3 addition (docs/44 §7/§22,
 *     ADR-012 (amended), docs/47), Phase 2B's Pillar 2 read surface.
 *     patient_id is session-derived exactly like every route above. Returns
 *     the caller's own module-state view across the entire Module Registry
 *     (ModuleRegistry.gs), synthesizing a fail-closed `enabled: false` entry
 *     for any module with no PatientModuleState row yet. This is a
 *     read-only route: there is no enable/disable route here, and none is
 *     planned — PatientModuleState writes are doctor/staff-only and, since
 *     no real Doctor identity/session exists yet (docs/33 §1.4), remain a
 *     manually-run Apps Script editor function
 *     (PatientModuleState.gs's setFoundationModuleState()), not a Web App
 *     route. No dashboard rendering change ships in this batch — this route
 *     has no UI consumer yet; migrating dashboard.js onto this registry is
 *     the Dashboard Registry batch (PXP-4), not this one.
 *   - get_checkin_template — Batch PXP-5 addition (docs/44 §10/§11/§22,
 *     ADR-016, docs/47), the Daily Check-in Engine's own read route.
 *     patient_id is session-derived exactly like every route above. Resolves
 *     the caller's current CheckInTemplateAssignment (CheckInTemplateAssignment.gs)
 *     to that template_id's latest active Template Registry version
 *     (TemplateRegistry.gs) — returns `data: null` (not an error) when the
 *     caller has no active assignment yet, the same "not yet configured is
 *     not an error" discipline get_patient_profile's lazy-creation default
 *     already established.
 *   - submit_checkin_response — Batch PXP-5 addition, the platform's third
 *     patient-writable route (after log_symptom, upload_report). patient_id
 *     is session-derived exactly like log_symptom's; every other field
 *     (template_id, template_version, answers, condition_slug) comes from
 *     the request body and is validated by foundationCreateCheckInResponse_()
 *     itself, including the server-side check that the caller currently
 *     holds an active assignment naming the submitted template_id (docs/44
 *     §10.2's enforcement boundary) before any answer-shape validation runs.
 *   - get_checkin_responses — Batch PXP-5 addition, returns the caller's own
 *     Check-In Response entries, sorted and capped for the full-history/
 *     dashboard-preview display, mirroring get_symptom_logs exactly.
 *     patient_id is always session-derived, never client-supplied. There is
 *     no assign/resolve-template-assignment route reachable over HTTP —
 *     CheckInTemplateAssignment writes are doctor/staff-only and, since no
 *     real Doctor identity/session exists yet, remain manually-run Apps
 *     Script editor functions (CheckInTemplateAssignment.gs's
 *     assignFoundationCheckInTemplate()/resolveFoundationCheckInTemplateAssignment()),
 *     mirroring every earlier doctor/staff-only entity's precedent exactly.
 *   - submit_calculator_result / get_calculator_results — Batch PXP-6
 *     additions (docs/44 §8/§22, ADR-013, docs/47), Phase 2B's Pillar 3.
 *     patient_id is always session-derived, never client-supplied — the
 *     same authorization primitive submit_checkin_response/
 *     get_checkin_responses already use. submit_calculator_result's every
 *     other field (calculator_slug, definition_version, input_snapshot,
 *     result_value) comes from the request body and is validated by
 *     foundationCreateCalculatorResult_() itself, including the check that
 *     the referenced (calculator_slug, definition_version) is a real
 *     Calculator Registry entry — always false today, since
 *     CalculatorRegistry.gs ships with zero registered calculators in this
 *     batch (see that file's own header comment); this batch ships the
 *     generic registry-and-result mechanism only, with no Module Registry
 *     entry and no dashboard/UI consumer (a disclosed, explicit scope
 *     narrowing from docs/44 §22's own PXP-6 row, mirroring the Module
 *     Registry (PXP-3, backend) / Dashboard Registry (PXP-4, frontend)
 *     split precedent — see docs/24-ROADMAP.md's PXP-6 entry for the full
 *     disclosure).
 *   - get_care_plan / get_doctor_instructions — Batch PXP-7 additions
 *     (docs/44 §12/§22, docs/47), the Personal Care Plan capability.
 *     patient_id is always session-derived, never client-supplied — the
 *     same authorization primitive every read route above already uses.
 *     Both are read-only: there is no author/create/status-update route
 *     reachable over HTTP — CarePlan and DoctorInstruction writes are
 *     doctor/staff-only and, since no real Doctor identity/session exists
 *     yet (docs/33 §1.4), remain manually-run Apps Script editor functions
 *     (CarePlan.gs's saveFoundationCarePlan(); DoctorInstruction.gs's
 *     createFoundationDoctorInstruction()/
 *     updateFoundationDoctorInstructionStatus()), mirroring every earlier
 *     doctor/staff-only entity's precedent exactly. get_care_plan returns
 *     `data: null` (not an error) when the caller has no Care Plan authored
 *     yet, the same "not yet configured is not an error" discipline
 *     get_checkin_template's unassigned-patient outcome already established.
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
 * FoundationRouteGuard.gs, PatientIdentity.gs, FoundationConsultationHistory.gs,
 * FoundationSymptomLog.gs, FoundationReports.gs, FoundationPatientProfile.gs,
 * DoctorAssignedCondition.gs, ModuleRegistry.gs, PatientModuleState.gs,
 * TemplateRegistry.gs, CheckInTemplateAssignment.gs, CheckInResponse.gs,
 * CalculatorRegistry.gs, CalculatorResult.gs, CarePlan.gs, DoctorInstruction.gs.
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
 * Batch PA-4: creates a new Symptom Log entry for the caller. patient_id
 * is always session-derived, never client-supplied — the same
 * authorization primitive get_timeline already uses, applied here to the
 * platform's first patient-writable route (docs/41 §12). Every other
 * field (severity/sleep/energy/stress/notes/condition_slug) comes from
 * the request body and is validated by foundationCreateSymptomLog_()
 * itself.
 */
function foundationHandleLogSymptom_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationCreateSymptomLog_({
      patient_id: patientId,
      severity: input && input.severity,
      sleep: input && input.sleep,
      energy: input && input.energy,
      stress: input && input.stress,
      notes: input && input.notes,
      condition_slug: input && input.condition_slug
    });
  });
}

/**
 * Batch PA-4: returns the caller's own Symptom Log entries, sorted and
 * capped for the full-history/dashboard-preview display (docs/41 §2).
 * patient_id is always session-derived, never client-supplied.
 */
function foundationHandleGetSymptomLogs_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientSymptomLogs_(patientId);
  });
}

/**
 * Batch PA-5: creates a new Report entry for the caller. patient_id and
 * uploaded_by are both derived exclusively from the verified session —
 * the same authorization primitive log_symptom already uses, applied
 * here to the platform's highest-risk feature (docs/29 §8, docs/42).
 * Every other field (file_name, mime_type, file_base64) comes from the
 * request body and is validated by foundationCreateReport_() itself,
 * including the real, content-based MIME check once the bytes are
 * decoded.
 */
function foundationHandleUploadReport_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationCreateReport_({
      patient_id: patientId,
      file_name: input && input.file_name,
      mime_type: input && input.mime_type,
      file_base64: input && input.file_base64,
      uploaded_by: patientId
    });
  });
}

/**
 * Batch PA-5: returns the caller's own Report metadata, sorted and capped
 * for the full-history/dashboard-preview display. patient_id is always
 * session-derived, never client-supplied. No file content is returned
 * here — see download_report for that.
 */
function foundationHandleGetReports_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientReports_(patientId);
  });
}

/**
 * Batch PA-5: returns a single report's file content, base64-encoded,
 * scoped strictly to the caller's own session-derived patient_id.
 * foundationDownloadReport_() itself performs the ownership check (via
 * foundationGetReportById_()) before ever calling DriveApp — Drive's own
 * permission state is never consulted as part of this authorization.
 */
function foundationHandleDownloadReport_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationDownloadReport_(patientId, input && input.record_id);
  });
}

/**
 * Batch PXP-1: returns the caller's own PatientProfile record (or a
 * default-shaped empty one, if none has ever been saved — the lazy-
 * creation resolution, shared/schemas/patient-profile.md). patient_id is
 * always session-derived, never client-supplied.
 */
function foundationHandleGetPatientProfile_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientProfile_(patientId);
  });
}

/**
 * Batch PXP-1: creates or updates the caller's own PatientProfile record —
 * the platform's first patient-mutable, upsert-style write. patient_id is
 * always session-derived, never client-supplied — the same authorization
 * primitive log_symptom/upload_report already use, applied here to an
 * update instead of an append. Every other field (phone/date_of_birth/
 * preferred_contact_method/emergency_contact) comes from the request body
 * and is validated by foundationSavePatientProfile_() itself.
 */
function foundationHandleSavePatientProfile_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationSavePatientProfile_({
      patient_id: patientId,
      phone: input && input.phone,
      date_of_birth: input && input.date_of_birth,
      preferred_contact_method: input && input.preferred_contact_method,
      emergency_contact: input && input.emergency_contact
    });
  });
}

/**
 * Batch PXP-2: returns the caller's own DoctorAssignedCondition rows
 * (active and resolved alike), sorted newest-assigned-first. patient_id is
 * always session-derived, never client-supplied. Read-only — there is no
 * corresponding write route (see this file's own header comment).
 */
function foundationHandleGetDoctorAssignedConditions_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientConditionAssignments_(patientId);
  });
}

/**
 * Batch PXP-3: returns the caller's own PatientModuleState view across the
 * entire Module Registry (ModuleRegistry.gs), synthesizing a fail-closed
 * `enabled: false` entry for any module with no persisted row yet.
 * patient_id is always session-derived, never client-supplied. Read-only —
 * there is no corresponding write route (see this file's own header
 * comment).
 */
function foundationHandleGetPatientModuleStates_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientModuleStates_(patientId);
  });
}

/**
 * Batch PXP-5: returns the caller's current Check-in template — their
 * active CheckInTemplateAssignment resolved to that template_id's latest
 * active Template Registry version, or `data: null` if no active
 * assignment exists yet (not an error — a patient's doctor simply hasn't
 * assigned one yet). patient_id is always session-derived, never
 * client-supplied.
 */
function foundationHandleGetCheckInTemplate_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetCurrentCheckInTemplateForPatient_(patientId);
  });
}

/**
 * Batch PXP-5: creates a new Check-In Response entry for the caller.
 * patient_id is always session-derived, never client-supplied — the same
 * authorization primitive log_symptom/upload_report already use. Every
 * other field (template_id, template_version, answers, condition_slug)
 * comes from the request body and is validated by
 * foundationCreateCheckInResponse_() itself, including the check that the
 * caller currently holds an active assignment naming the submitted
 * template_id (docs/44 §10.2).
 */
function foundationHandleSubmitCheckInResponse_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationCreateCheckInResponse_({
      patient_id: patientId,
      template_id: input && input.template_id,
      template_version: input && input.template_version,
      answers: input && input.answers,
      condition_slug: input && input.condition_slug
    });
  });
}

/**
 * Batch PXP-5: returns the caller's own Check-In Response entries, sorted
 * and capped for the full-history/dashboard-preview display, mirroring
 * get_symptom_logs exactly. patient_id is always session-derived, never
 * client-supplied.
 */
function foundationHandleGetCheckInResponses_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientCheckInResponses_(patientId);
  });
}

/**
 * Batch PXP-6: creates a new Calculator Result entry for the caller.
 * patient_id is always session-derived, never client-supplied — the same
 * authorization primitive submit_checkin_response already uses. Every
 * other field (calculator_slug, definition_version, input_snapshot,
 * result_value) comes from the request body and is validated by
 * foundationCreateCalculatorResult_() itself, including the check that the
 * referenced (calculator_slug, definition_version) is a real Calculator
 * Registry entry.
 */
function foundationHandleSubmitCalculatorResult_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationCreateCalculatorResult_({
      patient_id: patientId,
      calculator_slug: input && input.calculator_slug,
      definition_version: input && input.definition_version,
      input_snapshot: input && input.input_snapshot,
      result_value: input && input.result_value
    });
  });
}

/**
 * Batch PXP-6: returns the caller's own Calculator Result entries, sorted
 * and capped for a future full-history/dashboard-preview display, mirroring
 * get_checkin_responses exactly. patient_id is always session-derived,
 * never client-supplied.
 */
function foundationHandleGetCalculatorResults_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientCalculatorResults_(patientId);
  });
}

/**
 * Batch PXP-7: returns the caller's own current Care Plan, or `data: null`
 * if none has ever been authored yet (not an error — the same "not yet
 * configured is not an error" discipline get_checkin_template's
 * unassigned-patient outcome already established). patient_id is always
 * session-derived, never client-supplied.
 */
function foundationHandleGetCarePlan_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetCurrentCarePlanForPatient_(patientId);
  });
}

/**
 * Batch PXP-7: returns the caller's own DoctorInstruction entries, across
 * every one of their Care Plan's versions, sorted newest-effective-date
 * first, mirroring get_doctor_assigned_conditions exactly. patient_id is
 * always session-derived, never client-supplied.
 */
function foundationHandleGetDoctorInstructions_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientDoctorInstructions_(patientId);
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
    case 'log_symptom':
      envelope = foundationHandleLogSymptom_(input);
      break;
    case 'get_symptom_logs':
      envelope = foundationHandleGetSymptomLogs_(input);
      break;
    case 'upload_report':
      envelope = foundationHandleUploadReport_(input);
      break;
    case 'get_reports':
      envelope = foundationHandleGetReports_(input);
      break;
    case 'download_report':
      envelope = foundationHandleDownloadReport_(input);
      break;
    case 'get_patient_profile':
      envelope = foundationHandleGetPatientProfile_(input);
      break;
    case 'save_patient_profile':
      envelope = foundationHandleSavePatientProfile_(input);
      break;
    case 'get_doctor_assigned_conditions':
      envelope = foundationHandleGetDoctorAssignedConditions_(input);
      break;
    case 'get_patient_module_states':
      envelope = foundationHandleGetPatientModuleStates_(input);
      break;
    case 'get_checkin_template':
      envelope = foundationHandleGetCheckInTemplate_(input);
      break;
    case 'submit_checkin_response':
      envelope = foundationHandleSubmitCheckInResponse_(input);
      break;
    case 'get_checkin_responses':
      envelope = foundationHandleGetCheckInResponses_(input);
      break;
    case 'submit_calculator_result':
      envelope = foundationHandleSubmitCalculatorResult_(input);
      break;
    case 'get_calculator_results':
      envelope = foundationHandleGetCalculatorResults_(input);
      break;
    case 'get_care_plan':
      envelope = foundationHandleGetCarePlan_(input);
      break;
    case 'get_doctor_instructions':
      envelope = foundationHandleGetDoctorInstructions_(input);
      break;
    default:
      envelope = buildFoundationErrorEnvelope_('FOUNDATION_UNKNOWN_ACTION', 'Unknown request.');
  }
  return foundationJsonResponse_(envelope);
}
