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
 *   - mark_device_trusted / get_trusted_devices / revoke_trusted_device —
 *     Batch PXP-8 additions (docs/44 §5/§22, ADR-015, docs/47), the
 *     Trusted Device + Long-Lived Session capability. All three are
 *     authenticated; patient_id is always session-derived, never
 *     client-supplied. Unlike every other Phase 2B entity, TrustedDevice
 *     is patient-owned — mark_device_trusted and revoke_trusted_device are
 *     the platform's first Phase 2B writes with no manually-run editor
 *     counterpart at all (TrustedDevice.gs's own header comment).
 *   - consume_trusted_device — Batch PXP-8's one unauthenticated addition,
 *     mirroring consume_login_link exactly: the presented raw device token
 *     is itself the credential, so there is no session yet to authenticate
 *     with. On success, rotates the device token and issues a Long-Lived
 *     Session — an additive wrapper around FoundationSession.gs's own
 *     unmodified signing primitives (TrustedDevice.gs's own header
 *     comment; docs/44 §5.5's implementation-time decision, resolved here
 *     without touching that frozen file).
 *
 *   - request_doctor_login_link / consume_doctor_login_link / get_doctor_profile —
 *     Batch WPI-1 additions (docs/50-PHASE-3-TECHNICAL-PLAN.md §5, docs/53,
 *     ADR-017), the platform's first doctor-facing infrastructure batch.
 *     Mirrors request_login_link/consume_login_link/get_profile exactly, for
 *     a second, permanently distinct identity space — doctor_id is derived
 *     only from a verified DoctorSession (withFoundationDoctorAuth_(),
 *     DoctorRouteGuard.gs), never from client-supplied input, never
 *     interchangeable with patient_id (shared/schemas/doctor-session.md's
 *     dedicated security review). request_doctor_login_link and
 *     consume_doctor_login_link are this batch's two unauthenticated
 *     additions, mirroring the patient-side request/consume pair exactly.
 *     get_doctor_profile is the one authenticated read route, returning the
 *     caller's own Doctor record — the doctor-side proof point that
 *     withFoundationDoctorAuth_() works end to end, mirroring get_profile's
 *     own role at Batch IA-2 exactly. No Doctor creation route exists here
 *     or is planned — Doctor rows are staff/administrative-provisioned only,
 *     via DoctorIdentity.gs's manually-run createFoundationDoctor()
 *     (ADR-017's "no public self-registration" rule).
 *
 *   - get_doctor_module_states — Batch WPI-3 addition (docs/50-PHASE-3-
 *     TECHNICAL-PLAN.md §7.2, docs/53, ADR-020), mirroring
 *     get_patient_module_states exactly, for the Doctor Module Registry
 *     (DoctorModuleRegistry.gs) instead of the patient-facing Module
 *     Registry. Read-only — there is no corresponding write route; every
 *     write is a staff/administrative action via DoctorModuleState.gs's
 *     manually-run setFoundationDoctorModuleState() (see that file's own
 *     header comment). doctor_id is derived only from a verified
 *     DoctorSession, never from client-supplied input.
 *
 *   - get_doctor_patient_roster — Batch WPI-4 addition (docs/50-PHASE-3-
 *     TECHNICAL-PLAN.md §7.4/§19), the Doctor Dashboard's one shipped
 *     capability (DoctorPatientRoster.gs, registered as
 *     shared/constants/doctor-module-registry.json's `patient_roster`
 *     entry). Read-only, derived — no new stored entity, no write route.
 *     doctor_id is derived only from a verified DoctorSession, mirroring
 *     get_doctor_module_states exactly.
 *
 *   - get_doctor_appointments — Batch WPI-5 addition (docs/50-PHASE-3-
 *     TECHNICAL-PLAN.md §8/§19), the Doctor Dashboard's second capability
 *     (Appointment.gs, registered as shared/constants/
 *     doctor-module-registry.json's `appointments` entry). Read-only —
 *     every Appointment write (creation, confirmation, status transitions)
 *     is doctor/staff-only and remains a manually-run Apps Script editor
 *     function (Appointment.gs's createFoundationAppointment()/
 *     confirmFoundationAppointment()/updateFoundationAppointmentStatus()),
 *     mirroring every earlier doctor/staff-only entity's precedent exactly
 *     — there is no create/confirm/status-update route reachable over
 *     HTTP. doctor_id is derived only from a verified DoctorSession,
 *     mirroring get_doctor_patient_roster exactly. Returns the doctor's
 *     specialty-derived Appointments view (Appointment.gs's
 *     foundationGetDoctorAppointments_()), the same specialty-derivation
 *     discipline the patient roster already established.
 *
 *   - get_inventory_items — Batch WPI-7 addition (docs/50-PHASE-3-
 *     TECHNICAL-PLAN.md §10/§19, docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md),
 *     the Doctor Dashboard's third capability (InventoryItem.gs, registered
 *     as shared/constants/doctor-module-registry.json's `inventory` entry).
 *     Read-only — every InventoryItem/InventoryTransaction write (create,
 *     retire, threshold-update, and every stock-movement transaction) is
 *     doctor/staff-only and remains a manually-run Apps Script editor
 *     function (InventoryItem.gs's createFoundationInventoryItem()/
 *     retireFoundationInventoryItem()/updateFoundationInventoryItemThreshold();
 *     InventoryTransaction.gs's recordFoundationInventoryTransaction()),
 *     mirroring every earlier doctor/staff-only entity's precedent exactly
 *     — there is no create/retire/record-transaction route reachable over
 *     HTTP. doctor_id is derived only from a verified DoctorSession,
 *     mirroring get_doctor_appointments exactly. Returns the doctor's
 *     specialty-scoped, active InventoryItem list (InventoryItem.gs's
 *     foundationGetInventoryItemsForDoctor_()), each entry enriched with a
 *     computed low_stock boolean — the same specialty-scoping discipline
 *     the patient roster/appointments views already establish.
 *
 *   - get_pillfill_orders — Batch WPI-8 addition (docs/50-PHASE-3-
 *     TECHNICAL-PLAN.md §11/§19), the Doctor Dashboard's fourth capability
 *     (PillFillOrder.gs, registered as shared/constants/
 *     doctor-module-registry.json's `pillfill_orders` entry). Read-only —
 *     every PillFillOrder write (create, fulfill, and every other status
 *     transition) is doctor/staff-only and remains a manually-run Apps
 *     Script editor function (PillFillOrder.gs's
 *     createFoundationPillFillOrder()/fulfillFoundationPillFillOrder()/
 *     updateFoundationPillFillOrderStatus()), mirroring every earlier
 *     doctor/staff-only entity's precedent exactly — there is no create/
 *     fulfill/status-update route reachable over HTTP. doctor_id is
 *     derived only from a verified DoctorSession, mirroring
 *     get_inventory_items exactly. Returns the doctor's specialty-scoped
 *     PillFillOrder list (PillFillOrder.gs's
 *     foundationGetPillFillOrdersForDoctor_()), specialty derived via each
 *     order's own referenced InventoryItem (this entity carries no
 *     specialty_slug of its own) — the same specialty-scoping discipline
 *     the patient roster/appointments/inventory views already establish.
 *
 *   - get_doctor_analytics — Batch WPI-9 addition (docs/50-PHASE-3-
 *     TECHNICAL-PLAN.md §12/§19, docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md
 *     §18 item 4), the Doctor Dashboard's fifth capability (Analytics.gs,
 *     registered as shared/constants/doctor-module-registry.json's
 *     `analytics` entry). Read-only — Analytics is never a stored entity
 *     (docs/50 §12), so there is nothing for this route to write. doctor_id
 *     is derived only from a verified DoctorSession, mirroring
 *     get_pillfill_orders exactly. Returns the doctor's specialty-scoped,
 *     deterministic aggregate report (Analytics.gs's
 *     foundationGetAnalyticsForDoctor_()), bounded to a fixed trailing
 *     30-day window — never "all history", never an AI-generated
 *     interpretation or prediction.
 *
 *   - get_ai_assistant_capabilities / post_ai_assistant_query /
 *     post_ai_assistant_decision — Batch WPI-10 additions (docs/55-WPI-10-AI-
 *     ASSISTANT-ARCHITECTURE-FREEZE.md §12, ADR-021/022/023), the Doctor
 *     Dashboard's sixth capability (AIAssistantContext.gs/
 *     AIAssistantInteraction.gs, registered as shared/constants/
 *     doctor-module-registry.json's `ai_assistant` entry, disabled by default
 *     per ADR-023). All three are doctor-guarded only — doctor_id is always
 *     DoctorSession-derived, never client-supplied, and a real Patient Session
 *     token is rejected on all three, mirroring get_doctor_analytics's own
 *     precedent exactly. get_ai_assistant_capabilities is read-only, returning
 *     the fixed capability list. post_ai_assistant_query is this batch's one
 *     genuinely new *write* route among every WPI-1..9 doctor-facing route (all
 *     of which were read-only) — but the only Sheet it writes is
 *     AIAssistantInteractions; it never creates, updates, or fulfills any other
 *     entity (ADR-022, statically enforced per docs/55 §18 item 1).
 *     post_ai_assistant_decision records the caller's own one-way decision
 *     transition on an interaction row they own, and likewise never writes
 *     anywhere else. Zero modification to CarePlan.gs, DoctorInstruction.gs,
 *     CheckInResponse.gs, CalculatorResult.gs, InventoryItem.gs,
 *     InventoryTransaction.gs, PillFillOrder.gs, Appointment.gs, or
 *     Notification.gs — AI Assistant only reads each through its own existing,
 *     already-scoped reader function.
 *
 *   - submit_holoscan_recognition / get_holoscan_recognitions —
 *     Batch WPI-11 additions (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md
 *     §6/§17, ADR-024/025/026), the platform's first patient-initiated,
 *     image-input AI capability (HoloscanRecognition.gs, registered as
 *     shared/constants/module-registry.json's `holoscan` entry). Both are
 *     patient-guarded only — patient_id is always PatientSession-derived,
 *     never client-supplied. submit_holoscan_recognition is a write route:
 *     it uploads image(s) via Report's own existing Drive mechanism
 *     (reused, never a new one), then runs the capture/recognition
 *     pipeline, writing exactly one HoloscanRecognition row plus zero or
 *     more HoloscanRecognitionItem rows — it never writes to
 *     MedicationHistory or MedicationDecision (ADR-025). get_holoscan_recognitions
 *     is read-only, returning the caller's own recognition history plus each
 *     item's own draft/review status.
 *
 *   - get_holoscan_review_queue / post_holoscan_recognition_decision —
 *     Batch WPI-11 additions (docs/56 §17), the Doctor Dashboard's seventh
 *     capability (HoloscanRecognition.gs, registered as shared/constants/
 *     doctor-module-registry.json's `holoscan_review` entry, disabled by
 *     default per ADR-026, mirroring `ai_assistant`'s own precedent
 *     exactly). Both are doctor-guarded only — doctor_id is always
 *     DoctorSession-derived, never client-supplied. get_holoscan_review_queue
 *     is read-only, returning pending HoloscanRecognitionItem rows across the
 *     caller's own derived roster (DoctorPatientRoster.gs, reused, never
 *     re-derived). post_holoscan_recognition_decision is a write route, audit
 *     only — it records the caller's one-way decision (approve/
 *     corrected-and-approve/reject) on ONE HoloscanRecognitionItem row the
 *     caller has roster access to; it never writes to any other entity's
 *     Sheet (ADR-025, statically enforced per docs/56 §23 item 1).
 *
 *   - get_medication_history — Batch WPI-11 addition (docs/56 §17), this
 *     platform's one dual-guarded route: reachable via either a verified
 *     DoctorSession (roster-scoped, any patient on the caller's own roster)
 *     or a verified PatientSession (own record only, patient_id always
 *     session-derived) — MedicationHistory.gs's own
 *     foundationGetMedicationHistoryDualGuarded_() resolves which identity
 *     type presented the token; this router never re-derives or re-verifies
 *     the session itself. Read-only — returns one patient's MedicationHistory
 *     rows plus each row's own MedicationDecision ledger.
 *
 *   - create_medication_history_entry / record_medication_decision — Batch
 *     WPI-11 additions (docs/56 §10.3/§10.4/§17, ADR-025), the doctor's own,
 *     separate write paths into MedicationHistory/MedicationDecision — never
 *     called by HoloscanRecognition.gs's own pipeline or decision route.
 *     Both are doctor-guarded only — doctor_id is always DoctorSession-derived,
 *     never client-supplied. create_medication_history_entry creates one
 *     MedicationHistory row, optionally using an approved
 *     HoloscanRecognitionItem as pre-fill/provenance only (MedicationHistory.gs
 *     itself validates that reference, never a live foreign key it enforces
 *     beyond creation time). record_medication_decision creates one new,
 *     append-only MedicationDecision row (continue/stop/replace/unknown)
 *     and deterministically recomputes MedicationHistory.current_status from
 *     the full ledger, inside a LockService critical section mirroring
 *     InventoryTransaction.gs's own precedent exactly (WPI-7, docs/54 §19).
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
 * CalculatorRegistry.gs, CalculatorResult.gs, CarePlan.gs, DoctorInstruction.gs,
 * TrustedDevice.gs, DoctorIdentity.gs, DoctorSession.gs, DoctorLoginTokens.gs,
 * DoctorEmail.gs, DoctorLoginFlow.gs, DoctorRouteGuard.gs,
 * DoctorModuleRegistry.gs, DoctorModuleState.gs, DoctorPatientRoster.gs,
 * Appointment.gs, InventoryItem.gs, AIAssistantContext.gs, AIAssistantInteraction.gs,
 * HoloscanRecognition.gs, HoloscanRecognitionCheck.gs, MedicationHistory.gs,
 * DigitalTwinContext.gs, DigitalTwinDriftCheck.gs, DigitalTwinNarrative.gs.
 *
 *   - get_patient_digital_twin / generate_digital_twin_narrative /
 *     review_digital_twin_narrative — Batch PXP-12 additions (Phase 2D, docs/59 §12,
 *     ADR-028/029/030), the Doctor Dashboard's eighth capability (DigitalTwinNarrative.gs,
 *     registered as shared/constants/doctor-module-registry.json's `digital_twin_review`
 *     entry, disabled by default per ADR-030). All three are doctor-guarded only — doctor_id
 *     is always DoctorSession-derived, never client-supplied. get_patient_digital_twin is
 *     read-only (one roster patient's computed Digital Twin view + Progress Analytics + every
 *     narrative including pending drafts). generate_digital_twin_narrative is a write route: it
 *     writes exactly one DigitalTwinNarrative row (review_status pending, never patient-visible);
 *     it never creates, updates, or fulfills any other entity (ADR-028, statically enforced per
 *     docs/59 §18 item 1). review_digital_twin_narrative records the caller's one-way
 *     approved/edited_and_approved/rejected decision, setting published_output — the sole gate to
 *     patient visibility — and likewise never writes anywhere else.
 *   - get_health_story / get_progress_analytics — Batch PXP-12 additions (docs/59 §12), the
 *     patient-facing half of Phase 2D. Both are patient-guarded only — patient_id is always
 *     PatientSession-derived, never client-supplied. get_health_story returns the caller's own
 *     computed Digital Twin view + ONLY their approved/edited_and_approved narratives'
 *     published_output (never a pending/rejected draft, never the raw ai_output, ADR-028).
 *     get_progress_analytics returns the caller's own deterministic, non-AI Progress Analytics
 *     view — no model output, no doctor gate. Neither is dual-guarded (docs/59 §4).
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
 * Batch PXP-8: marks the caller's current device as trusted, issuing a
 * new TrustedDevice + its one-time raw device_token. patient_id is always
 * session-derived, never client-supplied — the same authorization
 * primitive every other write route already uses. device_label is the
 * only other field, validated by foundationCreateTrustedDevice_() itself.
 */
function foundationHandleMarkDeviceTrusted_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationCreateTrustedDevice_(patientId, input && input.device_label);
  });
}

/**
 * Batch PXP-8: the one unauthenticated addition this batch makes,
 * mirroring consume_login_link exactly — the presented device_token is
 * itself the credential, so there is no session yet to derive patient_id
 * from. On success, rotates the device token and issues a fresh
 * Long-Lived Session (TrustedDevice.gs's foundationConsumeTrustedDevice_()).
 */
function foundationHandleConsumeTrustedDevice_(input) {
  return foundationConsumeTrustedDevice_(input && input.device_token);
}

/**
 * Batch PXP-8: returns the caller's own TrustedDevice rows (active and
 * revoked alike, device_token_hash always redacted), for the patient-facing
 * "manage my devices" view (docs/44 §5.3). patient_id is always
 * session-derived, never client-supplied.
 */
function foundationHandleGetTrustedDevices_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientTrustedDevices_(patientId);
  });
}

/**
 * Batch PXP-8: revokes one of the caller's own TrustedDevice rows by
 * device_id — self-service, patient-only. patient_id is always
 * session-derived; foundationRevokeTrustedDevice_() itself performs the
 * ownership check and returns the same generic FOUNDATION_NOT_FOUND
 * whether device_id doesn't exist or belongs to someone else.
 */
function foundationHandleRevokeTrustedDevice_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationRevokeTrustedDevice_(patientId, input && input.device_id);
  });
}

/**
 * Batch WPI-1: handles a doctor login-link request. Mirrors
 * foundationHandleRequestLoginLink_() exactly, for the Doctor identity
 * space. Unauthenticated — this is the necessarily-public first step of
 * the doctor magic-link flow.
 */
function foundationHandleRequestDoctorLoginLinkRoute_(input) {
  return foundationHandleRequestDoctorLoginLink_(input);
}

/**
 * Batch WPI-1: consumes a presented doctor login-link token into a real
 * Doctor Session. Mirrors foundationHandleConsumeLoginLink_() exactly, for
 * the Doctor identity space. Unauthenticated — the presented token itself
 * is the credential, so there is no session yet to authenticate with.
 */
function foundationHandleConsumeDoctorLoginLinkRoute_(input) {
  return foundationHandleConsumeDoctorLoginLink_(input);
}

/**
 * Batch WPI-1: returns the caller's own Doctor record, resolved strictly
 * from the verified DoctorSession — mirrors foundationHandleGetProfile_()
 * exactly, the doctor-side proof point that withFoundationDoctorAuth_()
 * works end to end. doctor_id is always session-derived, never
 * client-supplied.
 */
function foundationHandleGetDoctorProfile_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetDoctorById_(doctorId);
  });
}

/**
 * Batch WPI-3: returns the caller's own DoctorModuleState view across the
 * entire Doctor Module Registry (DoctorModuleRegistry.gs), synthesizing a
 * fail-closed `enabled: false` entry for any capability with no persisted
 * row yet — mirrors foundationHandleGetPatientModuleStates_() exactly.
 * doctor_id is always DoctorSession-derived, never client-supplied.
 * Read-only — there is no corresponding write route (see this file's own
 * header comment). Returns an empty list today — the Doctor Module
 * Registry ships empty in this batch (DoctorModuleRegistry.gs's own
 * header comment).
 */
function foundationHandleGetDoctorModuleStates_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetDoctorModuleStates_(doctorId);
  });
}

/**
 * Batch WPI-4: returns the caller's own derived patient roster
 * (DoctorPatientRoster.gs) — the Doctor Dashboard's one shipped capability
 * this batch registers (`patient_roster`, doctor-module-registry.json).
 * doctor_id is always DoctorSession-derived, never client-supplied.
 * Read-only — no write route exists for this derived view (docs/50 §7.4).
 */
function foundationHandleGetDoctorPatientRoster_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetDoctorPatientRoster_(doctorId);
  });
}

/**
 * Batch WPI-5: returns the caller's own derived Appointments view
 * (Appointment.gs) — the Doctor Dashboard's second capability this batch
 * registers (`appointments`, doctor-module-registry.json). doctor_id is
 * always DoctorSession-derived, never client-supplied. Read-only — every
 * Appointment write is doctor/staff-only via a manually-run Apps Script
 * editor function (Appointment.gs's own header comment); no write route
 * exists here.
 */
function foundationHandleGetDoctorAppointments_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetDoctorAppointments_(doctorId);
  });
}

/**
 * Batch WPI-7: returns the caller's own specialty-scoped, active
 * InventoryItem list (InventoryItem.gs) — the Doctor Dashboard's third
 * capability this batch registers (`inventory`, doctor-module-registry.json).
 * doctor_id is always DoctorSession-derived, never client-supplied.
 * Read-only — every InventoryItem/InventoryTransaction write is
 * doctor/staff-only via a manually-run Apps Script editor function
 * (InventoryItem.gs's/InventoryTransaction.gs's own header comments); no
 * write route exists here.
 */
function foundationHandleGetInventoryItems_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetInventoryItemsForDoctor_(doctorId);
  });
}

/**
 * Batch WPI-8: returns the caller's own specialty-scoped PillFillOrder list
 * (PillFillOrder.gs) — the Doctor Dashboard's fourth capability this batch
 * registers (`pillfill_orders`, doctor-module-registry.json). doctor_id is
 * always DoctorSession-derived, never client-supplied. Read-only — every
 * PillFillOrder write is doctor/staff-only via a manually-run Apps Script
 * editor function (PillFillOrder.gs's own header comment); no write route
 * exists here.
 */
function foundationHandleGetPillFillOrders_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetPillFillOrdersForDoctor_(doctorId);
  });
}

/**
 * Batch WPI-9: returns the caller's own specialty-scoped, bounded-window
 * Analytics report (Analytics.gs) — the Doctor Dashboard's fifth capability
 * this batch registers (`analytics`, doctor-module-registry.json).
 * doctor_id is always DoctorSession-derived, never client-supplied.
 * Read-only — Analytics is never a stored entity (docs/50 §12), so there is
 * nothing to write here.
 */
function foundationHandleGetDoctorAnalytics_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetAnalyticsForDoctor_(doctorId);
  });
}

/**
 * Batch WPI-10: returns the fixed, doctor-guarded AI Assistant capability list
 * (AIAssistantContext.gs) — the Doctor Dashboard's sixth capability this batch
 * registers (`ai_assistant`, doctor-module-registry.json, disabled by default,
 * ADR-023). doctor_id is always DoctorSession-derived, never client-supplied.
 * Read-only — this route never checks per-doctor enablement itself (that check
 * belongs to post_ai_assistant_query, the route with a real per-call cost);
 * returning the fixed menu to any authenticated doctor is harmless, mirroring
 * every other read-only capability route's own precedent.
 */
function foundationHandleGetAiAssistantCapabilities_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return buildFoundationOkEnvelope_(foundationGetAiAssistantCapabilityRegistry_());
  });
}

/**
 * Batch WPI-10: invokes one AI Assistant capability for the caller, optionally
 * scoped to one of the caller's own roster patients — this batch's one genuinely
 * new *write* route among every WPI-1..9 doctor-facing route (docs/55 §12).
 * doctor_id is always DoctorSession-derived, never client-supplied.
 * foundationCreateAiAssistantInteraction_() itself enforces fail-closed
 * enablement, the per-doctor rate limit, roster/capability-bounded context
 * assembly, and the independent drift check before writing exactly one
 * AIAssistantInteraction row (ADR-021/022/023).
 */
function foundationHandlePostAiAssistantQuery_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationCreateAiAssistantInteraction_({
      doctor_id: doctorId,
      capability_key: input && input.capability_key,
      patient_id: input && input.patient_id
    });
  });
}

/**
 * Batch WPI-10: records the caller's one-way decision (accepted/edited_and_accepted/
 * rejected/ignored) on one of their own AI Assistant interaction rows. doctor_id is
 * always DoctorSession-derived, never client-supplied. Never writes to any entity's
 * Sheet other than AIAssistantInteractions (ADR-022's central guarantee).
 */
function foundationHandlePostAiAssistantDecision_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationRecordAiAssistantDecision_({
      doctor_id: doctorId,
      interaction_id: input && input.interaction_id,
      doctor_decision: input && input.doctor_decision,
      decision_notes: input && input.decision_notes,
      target_entity_type: input && input.target_entity_type,
      target_entity_id: input && input.target_entity_id
    });
  });
}

/**
 * Batch WPI-11: submits one Holoscan photo capture for the caller — patient_id is always
 * PatientSession-derived, never client-supplied. Every other field (images) comes from the
 * request body and is validated, decoded, and content-type-checked by
 * foundationCreateHoloscanRecognition_() itself before any Drive write or model call
 * happens.
 */
function foundationHandleSubmitHoloscanRecognition_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationCreateHoloscanRecognition_({
      patient_id: patientId,
      images: input && input.images
    });
  });
}

/**
 * Batch WPI-11: returns the caller's own Holoscan recognition history, including each
 * item's own extraction and review status. patient_id is always session-derived, never
 * client-supplied.
 */
function foundationHandleGetHoloscanRecognitions_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetPatientHoloscanRecognitions_(patientId);
  });
}

/**
 * Batch WPI-11: returns the caller's own Holoscan review queue (HoloscanRecognition.gs) —
 * the Doctor Dashboard's seventh capability this batch registers (`holoscan_review`,
 * doctor-module-registry.json, disabled by default per ADR-026). doctor_id is always
 * DoctorSession-derived, never client-supplied. Read-only — pending HoloscanRecognitionItem
 * rows across the caller's own derived roster.
 */
function foundationHandleGetHoloscanReviewQueue_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetHoloscanReviewQueueForDoctor_(doctorId);
  });
}

/**
 * Batch WPI-11: records the caller doctor's one-way decision (approve/corrected-and-approve/
 * reject) on one HoloscanRecognitionItem row they have roster access to. doctor_id is always
 * DoctorSession-derived, never client-supplied. Never writes to MedicationHistory or
 * MedicationDecision (ADR-025).
 */
function foundationHandlePostHoloscanRecognitionDecision_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationRecordHoloscanRecognitionDecision_({
      doctor_id: doctorId,
      recognition_item_id: input && input.recognition_item_id,
      doctor_decision: input && input.doctor_decision,
      corrected_fields: input && input.corrected_fields,
      decision_notes: input && input.decision_notes
    });
  });
}

/**
 * Batch WPI-11: this platform's one dual-guarded route (docs/56 §17) — reachable via
 * either a verified DoctorSession or a verified PatientSession.
 * MedicationHistory.gs's own foundationGetMedicationHistoryDualGuarded_() resolves which
 * identity type presented the token and returns the correspondingly-scoped slice; this
 * handler never derives patient_id or doctor_id itself.
 */
function foundationHandleGetMedicationHistory_(input) {
  return foundationGetMedicationHistoryDualGuarded_(input && input.session_token, input && input.patient_id);
}

/**
 * Batch WPI-11: the doctor's own, separate write action creating one MedicationHistory row
 * (docs/56 §10.3/ADR-025) — never called by HoloscanRecognition.gs's own pipeline. doctor_id
 * is always DoctorSession-derived, never client-supplied.
 */
function foundationHandleCreateMedicationHistoryEntry_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationCreateMedicationHistoryEntry_({
      doctor_id: doctorId,
      patient_id: input && input.patient_id,
      medicine_name: input && input.medicine_name,
      strength: input && input.strength,
      dosage_form: input && input.dosage_form,
      manufacturer: input && input.manufacturer,
      source_recognition_item_id: input && input.source_recognition_item_id
    });
  });
}

/**
 * Batch WPI-11: creates one new, append-only MedicationDecision row (continue/stop/replace/
 * unknown) and deterministically recomputes MedicationHistory.current_status from the full
 * ledger (docs/56 §10.4). doctor_id is always DoctorSession-derived, never client-supplied.
 */
function foundationHandleRecordMedicationDecision_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationRecordMedicationDecision_({
      doctor_id: doctorId,
      medication_history_id: input && input.medication_history_id,
      decision_type: input && input.decision_type,
      replacement_medication_history_id: input && input.replacement_medication_history_id,
      notes: input && input.notes
    });
  });
}

/**
 * Batch PXP-11 (Phase 2C — Health Milestones, docs/58 §17): sets/updates the caller's own
 * roster patient's single MilestoneTrack care-start anchor (upsert). doctor_id is always
 * DoctorSession-derived, never client-supplied. Non-AI (ADR-027).
 */
function foundationHandleSetMilestoneTrack_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationSetMilestoneTrack_({
      doctor_id: doctorId,
      patient_id: input && input.patient_id,
      care_start_date: input && input.care_start_date,
      status: input && input.status
    });
  });
}

/**
 * Batch PXP-11 (docs/58 §17): returns one roster patient's MilestoneTrack, the
 * deterministically-computed schedule, and every MilestoneReview including drafts.
 * Read-only, roster-scoped. doctor_id is always DoctorSession-derived, never client-supplied.
 */
function foundationHandleGetPatientMilestones_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetPatientMilestonesForDoctor_(doctorId, input && input.patient_id);
  });
}

/**
 * Batch PXP-11 (docs/58 §17): creates or updates one draft MilestoneReview for a roster
 * patient + milestone_type — doctor-authored, never AI-generated (ADR-027). doctor_id is
 * always DoctorSession-derived, never client-supplied.
 */
function foundationHandleSaveMilestoneReview_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationSaveMilestoneReview_({
      doctor_id: doctorId,
      patient_id: input && input.patient_id,
      milestone_type: input && input.milestone_type,
      progress_summary: input && input.progress_summary,
      improvements: input && input.improvements,
      medicines_review: input && input.medicines_review,
      investigations: input && input.investigations,
      recommendations: input && input.recommendations,
      next_goals: input && input.next_goals
    });
  });
}

/**
 * Batch PXP-11 (docs/58 §17): the one-way draft->published transition that makes a
 * MilestoneReview patient-visible (docs/58 §10.2). doctor_id is always DoctorSession-derived,
 * never client-supplied.
 */
function foundationHandlePublishMilestoneReview_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationPublishMilestoneReview_({
      doctor_id: doctorId,
      review_id: input && input.review_id
    });
  });
}

/**
 * Batch PXP-11 (docs/58 §17): returns the caller's OWN computed milestone schedule and only
 * their PUBLISHED reviews — own record only, patient_id always PatientSession-derived, never
 * a draft, never a roster-wide view. Not dual-guarded (docs/58 §4) — the doctor's own
 * roster-scoped view is the separate get_patient_milestones route.
 */
function foundationHandleGetHealthMilestones_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetHealthMilestonesForPatient_(patientId);
  });
}

/**
 * Batch PXP-12 (Phase 2D — Wise Digital Twin & AI Summaries, docs/59 §12, ADR-028/029/030):
 * one roster patient's computed Digital Twin view + Progress Analytics + every
 * DigitalTwinNarrative including pending drafts (full, doctor-only shape). Read-only,
 * enablement- and roster-gated (digital_twin_review disabled by default, ADR-030). doctor_id
 * is always DoctorSession-derived, never client-supplied.
 */
function foundationHandleGetPatientDigitalTwin_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGetPatientDigitalTwinForDoctor_(doctorId, input && input.patient_id);
  });
}

/**
 * Batch PXP-12 (docs/59 §12): runs the generation pipeline for a roster patient +
 * narrative_type, writing one DigitalTwinNarrative row (review_status pending, NEVER
 * patient-visible). doctor_id is always DoctorSession-derived, never client-supplied.
 * foundationGenerateDigitalTwinNarrative_() itself enforces fail-closed enablement (ADR-030),
 * roster scope, the per-doctor rate limit, grounded context assembly (ADR-029), and the
 * independent drift check. The only Sheet it writes is DigitalTwinNarratives (ADR-028,
 * statically enforced per docs/59 §18 item 1).
 */
function foundationHandleGenerateDigitalTwinNarrative_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationGenerateDigitalTwinNarrative_({
      doctor_id: doctorId,
      patient_id: input && input.patient_id,
      narrative_type: input && input.narrative_type
    });
  });
}

/**
 * Batch PXP-12 (docs/59 §8.3/§12, ADR-028): records the caller's one-way
 * approved/edited_and_approved/rejected decision on one narrative for a roster patient — the
 * SOLE gate to patient visibility. doctor_id is always DoctorSession-derived, never
 * client-supplied. Never writes any entity's Sheet other than DigitalTwinNarratives.
 */
function foundationHandleReviewDigitalTwinNarrative_(input) {
  return withFoundationDoctorAuth_(input && input.session_token, function (doctorId) {
    return foundationReviewDigitalTwinNarrative_({
      doctor_id: doctorId,
      narrative_id: input && input.narrative_id,
      review_status: input && input.review_status,
      edited_output: input && input.edited_output,
      review_notes: input && input.review_notes
    });
  });
}

/**
 * Batch PXP-12 (docs/59 §12, ADR-028): the caller's OWN computed Digital Twin view + only their
 * approved/edited_and_approved narratives' published_output — never a pending or rejected draft,
 * never the raw ai_output. patient_id is always PatientSession-derived, never client-supplied.
 * Not dual-guarded — the doctor's roster-scoped view is the separate get_patient_digital_twin
 * route (docs/59 §4).
 */
function foundationHandleGetHealthStory_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetHealthStoryForPatient_(patientId);
  });
}

/**
 * Batch PXP-12 (docs/59 §6.3/§12): the caller's OWN deterministic, non-AI Progress Analytics
 * view — no model output, no doctor gate. patient_id is always PatientSession-derived, never
 * client-supplied.
 */
function foundationHandleGetProgressAnalytics_(input) {
  return withFoundationAuth_(input && input.session_token, function (patientId) {
    return foundationGetProgressAnalyticsForPatient_(patientId);
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
    case 'mark_device_trusted':
      envelope = foundationHandleMarkDeviceTrusted_(input);
      break;
    case 'consume_trusted_device':
      envelope = foundationHandleConsumeTrustedDevice_(input);
      break;
    case 'get_trusted_devices':
      envelope = foundationHandleGetTrustedDevices_(input);
      break;
    case 'revoke_trusted_device':
      envelope = foundationHandleRevokeTrustedDevice_(input);
      break;
    case 'request_doctor_login_link':
      envelope = foundationHandleRequestDoctorLoginLinkRoute_(input);
      break;
    case 'consume_doctor_login_link':
      envelope = foundationHandleConsumeDoctorLoginLinkRoute_(input);
      break;
    case 'get_doctor_profile':
      envelope = foundationHandleGetDoctorProfile_(input);
      break;
    case 'get_doctor_module_states':
      envelope = foundationHandleGetDoctorModuleStates_(input);
      break;
    case 'get_doctor_patient_roster':
      envelope = foundationHandleGetDoctorPatientRoster_(input);
      break;
    case 'get_doctor_appointments':
      envelope = foundationHandleGetDoctorAppointments_(input);
      break;
    case 'get_inventory_items':
      envelope = foundationHandleGetInventoryItems_(input);
      break;
    case 'get_pillfill_orders':
      envelope = foundationHandleGetPillFillOrders_(input);
      break;
    case 'get_doctor_analytics':
      envelope = foundationHandleGetDoctorAnalytics_(input);
      break;
    case 'get_ai_assistant_capabilities':
      envelope = foundationHandleGetAiAssistantCapabilities_(input);
      break;
    case 'post_ai_assistant_query':
      envelope = foundationHandlePostAiAssistantQuery_(input);
      break;
    case 'post_ai_assistant_decision':
      envelope = foundationHandlePostAiAssistantDecision_(input);
      break;
    case 'submit_holoscan_recognition':
      envelope = foundationHandleSubmitHoloscanRecognition_(input);
      break;
    case 'get_holoscan_recognitions':
      envelope = foundationHandleGetHoloscanRecognitions_(input);
      break;
    case 'get_holoscan_review_queue':
      envelope = foundationHandleGetHoloscanReviewQueue_(input);
      break;
    case 'post_holoscan_recognition_decision':
      envelope = foundationHandlePostHoloscanRecognitionDecision_(input);
      break;
    case 'get_medication_history':
      envelope = foundationHandleGetMedicationHistory_(input);
      break;
    case 'create_medication_history_entry':
      envelope = foundationHandleCreateMedicationHistoryEntry_(input);
      break;
    case 'record_medication_decision':
      envelope = foundationHandleRecordMedicationDecision_(input);
      break;
    case 'set_milestone_track':
      envelope = foundationHandleSetMilestoneTrack_(input);
      break;
    case 'get_patient_milestones':
      envelope = foundationHandleGetPatientMilestones_(input);
      break;
    case 'save_milestone_review':
      envelope = foundationHandleSaveMilestoneReview_(input);
      break;
    case 'publish_milestone_review':
      envelope = foundationHandlePublishMilestoneReview_(input);
      break;
    case 'get_health_milestones':
      envelope = foundationHandleGetHealthMilestones_(input);
      break;
    case 'get_patient_digital_twin':
      envelope = foundationHandleGetPatientDigitalTwin_(input);
      break;
    case 'generate_digital_twin_narrative':
      envelope = foundationHandleGenerateDigitalTwinNarrative_(input);
      break;
    case 'review_digital_twin_narrative':
      envelope = foundationHandleReviewDigitalTwinNarrative_(input);
      break;
    case 'get_health_story':
      envelope = foundationHandleGetHealthStory_(input);
      break;
    case 'get_progress_analytics':
      envelope = foundationHandleGetProgressAnalytics_(input);
      break;
    default:
      envelope = buildFoundationErrorEnvelope_('FOUNDATION_UNKNOWN_ACTION', 'Unknown request.');
  }
  return foundationJsonResponse_(envelope);
}
