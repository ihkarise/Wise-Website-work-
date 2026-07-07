'use strict';
/**
 * Foundation batch F5 — the schema-validator-based conformance harness
 * docs/29-PHASE-2A-TECHNICAL-PLAN.md §14 named as F5's explicit
 * deliverable in F2's own implementation notes ("Automated,
 * schema-validator-based conformance testing
 * (validation/phase-2a-foundation/conformance.js) remains an F5
 * deliverable, not built early").
 *
 * Loads the real, unmodified Foundation-family .gs source (via
 * harness.js's mocked Apps Script runtime), exercises the real
 * functions that produce shared/-schema-shaped output, and validates
 * that real output against the real, committed shared/*.schema.json
 * files using schema-validator.js's generic validator — not hand-coded
 * per-field assertions (that was F2/F3/F4's ad hoc approach; this
 * batch formalizes it into a reusable, generic, committed check any
 * future Foundation batch's new schema can plug into without writing a
 * new bespoke validator).
 *
 * Extended in Identity & Access batch IA-1 with Stage 5, covering
 * FoundationLoginTokens.gs against shared/schemas/login-token.schema.json
 * — the same pattern this file already established, not a new one.
 *
 * Extended in Identity & Access batch IA-2 with Stage 6, exercising the
 * real magic-link request/consume flow (FoundationLoginFlow.gs), rate
 * limiting (FoundationRateLimit.gs), email delivery (FoundationEmail.gs),
 * and the full HTTP-level dispatch (FoundationRouter.gs's
 * handleFoundationRequest_(), including the first authenticated route,
 * get_profile) end to end through the real, unmodified source. No new
 * shared/*.schema.json contract was introduced for IA-2 — its wire
 * shapes (`{message}`, `{session_token, patient_id}`) are ad hoc action
 * responses, not new persisted entities, so Stage 6 checks them directly
 * rather than against a new schema (see docs/29 §15's IA-2 section for
 * this scope boundary stated explicitly).
 *
 * Extended in Patient Access batch PA-3 with Stage 7, covering
 * FoundationConsultationHistory.gs against the new
 * shared/schemas/consultation-history.schema.json, plus the two new
 * FoundationRouter.gs dispatch cases (get_timeline, get_timeline_entry)
 * end to end — including the cross-patient-authorization check docs/40's
 * identity-strategy review named as this batch's one new authorization
 * shape (a client-supplied record_id must resolve only to its own
 * patient_id, never anyone else's).
 *
 * Extended in Patient Access batch PA-4 with Stage 8, covering
 * FoundationSymptomLog.gs against the new
 * shared/schemas/symptom-log.schema.json, plus the two new
 * FoundationRouter.gs dispatch cases (log_symptom, get_symptom_logs) end
 * to end — the platform's first patient-*writable* route, so this stage's
 * highest-priority check is cross-patient isolation on both create and
 * list (docs/41 §12), the same authorization boundary already proven for
 * reads, verified here on a write.
 *
 * Extended in Patient Access batch PA-5 with Stage 9, covering
 * FoundationReports.gs against the new shared/schemas/report.schema.json,
 * plus the three new FoundationRouter.gs dispatch cases (upload_report,
 * get_reports, download_report) end to end — the platform's highest-risk
 * feature. Per docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md, this stage's
 * highest-priority checks are: the content-based MIME detection actually
 * rejects a file whose real bytes don't match its declared extension/
 * mime_type (proving the "every mechanism realistically available"
 * decision is real, not just a declared filename check); the server-side
 * size cap is enforced against real decoded bytes regardless of what the
 * client claims; cross-patient isolation on list and download (download
 * additionally proving the ownership check happens before any DriveApp
 * call); **the uploaded file's Drive sharing is verifiably private**
 * (docs/42 §6: "the single most important property to design for and
 * test explicitly in this batch" — a default is not the same as a
 * verified guarantee); and **a Sheets-write failure after a successful
 * Drive write is rolled back** (docs/42 §1/§15's named partial-write
 * failure mode — the platform's first entity spanning two independent
 * storage systems).
 *
 * Extended in Phase 2B batch PXP-1 with Stage 10, covering
 * FoundationPatientProfile.gs against the new
 * shared/schemas/patient-profile.schema.json, plus the two new
 * FoundationRouter.gs dispatch cases (get_patient_profile,
 * save_patient_profile) end to end — the platform's first patient-mutable,
 * upsert-style entity. Per docs/47-PHASE-2B-IMPLEMENTATION-RULES.md §5's
 * per-entity requirements, this stage's highest-priority checks are: the
 * lazy-creation resolution (a patient with no saved row yet gets a real,
 * default-shaped record, never FOUNDATION_NOT_FOUND); a first save inserts
 * a new row while a second save patches the same row in place (proving
 * the upsert branch, not a duplicate insert); cross-patient isolation on
 * both branches; and every field's own validation rule
 * (shared/schemas/patient-profile.md).
 *
 * Extended in Phase 2B batch PXP-2 with Stage 11, covering
 * DoctorAssignedCondition.gs against the new
 * shared/schemas/doctor-assigned-condition.schema.json, plus the one new
 * FoundationRouter.gs dispatch case (get_doctor_assigned_conditions) end to
 * end — Phase 2B's Pillar 1. This stage's highest-priority checks are:
 * every assignment write requires a doctor/staff-supplied patient_id,
 * condition_slug, and assigned_by (never session-derived, since there is no
 * patient session at assignment time); many-per-patient (multiple active
 * assignments coexist for one patient); the resolve operation is a
 * one-way, exactly-once transition (an unknown or already-resolved
 * assignment_id is rejected); and the one read route
 * (get_doctor_assigned_conditions) is session-derived and cross-patient
 * isolated, with no corresponding write route reachable over HTTP.
 *
 * Extended in Phase 2B batch PXP-5 with Stage 13, covering
 * TemplateRegistry.gs, CheckInTemplateAssignment.gs (a disclosed, additive
 * gap-fill entity — see that file's own header comment), and
 * CheckInResponse.gs against the new shared/schemas/
 * check-in-template-assignment.schema.json and shared/schemas/
 * check-in-response.schema.json, plus the three new FoundationRouter.gs
 * dispatch cases (get_checkin_template, submit_checkin_response,
 * get_checkin_responses) end to end. This stage's highest-priority checks
 * are: docs/44 §11.4's JSON storage policy is real (a flat-object
 * requirement, unknown-field rejection, required-field rejection, type/min/
 * max validation, and deterministic key-order serialization); a patient can
 * only submit a response against a template_id they currently hold an
 * active assignment for, never merely one that exists in the registry
 * (docs/44 §10.2's enforcement boundary); every returned CheckInResponse's
 * `answers` is a real, parsed object, never the raw stored JSON string
 * (shared/README.md's "Contract vs. implementation-only detail"); and
 * cross-patient isolation on every new route, mirroring every earlier
 * stage's own discipline. Stage 12's own module-registry-derived count
 * assertions (`3`) are updated to `4` in this same change — a mechanical,
 * disclosed consequence of ModuleRegistry.gs's own designed, additive
 * growth (docs/47 §4) now that this batch registers a fourth module
 * (`daily_checkin`); PXP-3's actual shipped rows/logic are untouched, only
 * this test file's hardcoded expectation of *how many* rows exist today.
 *
 * Extended in Phase 2B batch PXP-6 with Stage 14, covering
 * CalculatorRegistry.gs and CalculatorResult.gs against the new
 * shared/schemas/calculator-result.schema.json, plus the two new
 * FoundationRouter.gs dispatch cases (submit_calculator_result,
 * get_calculator_results) end to end -- Phase 2B's Pillar 3. The shipped
 * shared/constants/calculator-registry.json is deliberately seeded empty
 * (see that file's own .md for the disclosed "ships empty" scope decision)
 * -- every real create attempt against it is therefore expected to be
 * rejected ("calculator_slug/definition_version does not match a real
 * Calculator Registry entry"), the same fail-closed-by-absence outcome
 * patient-module-state.md already documents for its own registry. To still
 * prove the generic input_snapshot-validation/deterministic-serialization/
 * storage mechanism end to end without shipping any concrete calculator
 * (disease-specific or otherwise) in the committed registry, this stage
 * temporarily pushes one synthetic, clearly-labeled test-only fixture
 * entry directly into the loaded sandbox's own
 * ctx.FOUNDATION_CALCULATOR_REGISTRY_ array (never into
 * shared/constants/calculator-registry.json itself) for the duration of
 * its own happy-path checks, then removes it again -- mirroring Stage 0's
 * own "prove the tool against a deliberately-constructed fixture" spirit,
 * applied here to a registry array instead of a schema fragment. This
 * stage's highest-priority checks are: the registry ships empty in
 * production, so a real create against it is rejected; the generic
 * validation/deterministic-serialization logic is correct against a
 * synthetic fixture; every returned CalculatorResult's input_snapshot is a
 * real, parsed object, never the raw stored JSON string; and cross-patient
 * isolation on every new route, mirroring every earlier stage's own
 * discipline.
 *
 * Extended in Phase 2B batch PXP-7 with Stage 15, covering CarePlan.gs and
 * DoctorInstruction.gs against the new shared/schemas/care-plan.schema.json
 * and shared/schemas/doctor-instruction.schema.json, plus the two new
 * FoundationRouter.gs dispatch cases (get_care_plan, get_doctor_instructions)
 * end to end. Also updates Stage 12's Module Registry count/membership
 * assertions (`4`) to `5` in this same change — the same mechanical,
 * disclosed consequence PXP-5's own Stage-12 update already established
 * (docs/47 §4's designed, additive growth) — now that this batch registers
 * a fifth module (`care_plan`); PXP-3's actual shipped rows/logic are
 * untouched, only this test file's hardcoded expectation of *how many* rows
 * exist today. This stage's highest-priority checks are: CarePlan's
 * append-only versioning (a new version always supersedes exactly the prior
 * active row, never any other row, via the disclosed version_key identity
 * column); DoctorInstruction's care_plan_id existence/ownership check
 * (rejects a care_plan_id that does not belong to the caller); the one-way,
 * exactly-once status transitions both entities' resolve-style operations
 * share with DoctorAssignedCondition's own precedent; and cross-patient
 * isolation on every new route, mirroring every earlier stage's own
 * discipline.
 *
 * Extended in Phase 2B batch PXP-8 with Stage 16, covering TrustedDevice.gs
 * against the new shared/schemas/trusted-device.schema.json, plus the four
 * new FoundationRouter.gs dispatch cases (mark_device_trusted,
 * consume_trusted_device, get_trusted_devices, revoke_trusted_device) end
 * to end — Persistent Authentication (ADR-015). This stage's
 * highest-priority checks are: a Long-Lived Session token issued by
 * foundationConsumeTrustedDevice_() verifies successfully through
 * FoundationSession.gs's own real, completely unmodified
 * foundationVerifySessionToken_() (proving docs/44 §5.5's additive-wrapper
 * decision is real, not just designed) and carries a materially longer
 * expires_at than a magic-link-issued session's own unchanged 3600-second
 * TTL, proven side by side in the same check; the device token rotates on
 * every successful consume (the pre-rotation raw token is rejected on a
 * second attempt); revoked and expired devices are both rejected with the
 * same generic FOUNDATION_TRUSTED_DEVICE_INVALID code, never
 * distinguishing which (mirroring FoundationLoginTokens.gs's own
 * "rejection is deliberately generic" discipline); device_token_hash never
 * appears in get_trusted_devices' response (the disclosed data-minimization
 * choice, shared/schemas/trusted-device.md); revoke_trusted_device rejects
 * an unknown or another patient's device_id with the same generic
 * FOUNDATION_NOT_FOUND get_timeline_entry's own cross-patient check already
 * uses; and cross-patient isolation on every new route, mirroring every
 * earlier stage's own discipline.
 *
 * Updated in Phase 2B batch PXP-10 (Symptom Tracker Migration, docs/44
 * §10.1/§22): Stage 12's Module Registry count/membership assertions (`5`)
 * drop to `4` — the registry's first *removal* rather than an addition,
 * since ModuleRegistry.gs retires its `symptom_tracker` entry now that
 * Daily Check-in (PXP-5) is proven in production. The "never written,
 * still a synthesized fail-closed default" example switches from
 * `symptom_tracker` (removed) to `daily_checkin` (still registered,
 * still untouched by either write in this stage). No apps-script/*.gs file
 * beyond ModuleRegistry.gs's own designed, additive/subtractive registry
 * array changes for this batch — FoundationSymptomLog.gs and
 * FoundationRouter.gs's existing log_symptom/get_symptom_logs dispatch
 * cases are completely untouched (deprecated by documentation disclosure
 * only, shared/schemas/symptom-log.md), so this stage's own Stage 8
 * (Symptom Log) assertions are unaffected and still pass unchanged.
 *
 * Extended in Phase 3/WHIMS batch WPI-1 with Stage 17, covering
 * DoctorIdentity.gs, DoctorSession.gs, DoctorLoginTokens.gs, DoctorEmail.gs,
 * DoctorLoginFlow.gs, and DoctorRouteGuard.gs end to end (Doctor Identity &
 * Session, docs/50 §5, ADR-017) — the platform's first doctor-facing
 * infrastructure. This stage's highest-priority checks are the ones
 * shared/schemas/doctor-session.md's dedicated pre-ship security review
 * (docs/50 §14 gate) names as needing direct proof, not just argument: a
 * real, freshly-issued DoctorSession token is rejected by the patient-side
 * withFoundationAuth_() guard, and a real, freshly-issued patient Session
 * token is rejected by the new withFoundationDoctorAuth_() guard — proving
 * the two identity spaces' structurally distinct payload shapes
 * (doctor_id vs. patient_id) actually prevent cross-identity-type
 * authorization confusion, not merely assert it. Also covers: a Doctor
 * Session's signing secret is the identical FOUNDATION_SESSION_SIGNING_SECRET
 * a magic-link-issued Patient Session already uses (proving the disclosed,
 * accepted shared-secret design choice is real); doctor login token
 * issuance/consumption/single-use/expiry mirrors LoginTokens' own discipline
 * exactly, stored in a separate DoctorLoginTokens sheet; cross-doctor
 * isolation on get_doctor_profile; and the full HTTP dispatch round trip
 * (request_doctor_login_link, consume_doctor_login_link, get_doctor_profile).
 *
 * Run with: node conformance.js  (no dependencies beyond Node's
 * standard library).
 */
var fs = require('fs');
var path = require('path');
var harness = require('./harness');
var schemaValidator = require('./schema-validator');

var buildSandbox = harness.buildSandbox;
var loadProject = harness.loadProject;
var validate = schemaValidator.validate;

var SHARED_DIR = path.resolve(__dirname, '../../shared');
var responseEnvelopeSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'contracts/response-envelope.schema.json'), 'utf8'));
var patientIdentitySchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/patient-identity.schema.json'), 'utf8'));
var sessionSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/session.schema.json'), 'utf8'));
var loginTokenSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/login-token.schema.json'), 'utf8'));
var consultationHistorySchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/consultation-history.schema.json'), 'utf8'));
var symptomLogSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/symptom-log.schema.json'), 'utf8'));
var reportSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/report.schema.json'), 'utf8'));
var uploadLimits = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'constants/upload-limits.json'), 'utf8'));
var patientProfileSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/patient-profile.schema.json'), 'utf8'));
var doctorAssignedConditionSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/doctor-assigned-condition.schema.json'), 'utf8'));
var patientModuleStateSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/patient-module-state.schema.json'), 'utf8'));
var checkInTemplateAssignmentSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/check-in-template-assignment.schema.json'), 'utf8'));
var checkInResponseSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/check-in-response.schema.json'), 'utf8'));
var calculatorResultSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/calculator-result.schema.json'), 'utf8'));
var carePlanSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/care-plan.schema.json'), 'utf8'));
var doctorInstructionSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/doctor-instruction.schema.json'), 'utf8'));
var trustedDeviceSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/trusted-device.schema.json'), 'utf8'));
var doctorIdentitySchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/doctor-identity.schema.json'), 'utf8'));
var doctorSessionSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/doctor-session.schema.json'), 'utf8'));
var doctorLoginTokenSchema = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'schemas/doctor-login-token.schema.json'), 'utf8'));

var results = [];
function record(name, pass, detail) {
  results.push({ name: name, pass: pass, detail: detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
}

// ============================================================
// Stage 0 — prove the validator itself against deliberately-broken
// fixtures before trusting it to grade anything else (mirrors
// validation/phase-1-5/validate.js's own Stage0 pattern).
// ============================================================
(function stage0_validatorSelfCheck() {
  var okEnvelope = { status: 'ok', data: { x: 1 }, error: null };
  record('Stage0: schema-validator accepts a well-formed ok envelope',
    validate(responseEnvelopeSchema, okEnvelope).valid === true);

  var okWithError = { status: 'ok', data: { x: 1 }, error: { code: 'X', message: 'Y' } };
  record('Stage0: schema-validator rejects status=ok with a non-null error (oneOf)',
    validate(responseEnvelopeSchema, okWithError).valid === false);

  var missingField = { status: 'ok', data: null };
  record('Stage0: schema-validator rejects a missing required field',
    validate(responseEnvelopeSchema, missingField).valid === false);

  var extraField = { status: 'ok', data: null, error: null, unexpected_field: 'nope' };
  record('Stage0: schema-validator rejects an additionalProperties:false violation',
    validate(responseEnvelopeSchema, extraField).valid === false);

  var wrongType = { status: 'ok', data: null, error: 'should be an object or null' };
  record('Stage0: schema-validator rejects a wrong-typed field',
    validate(responseEnvelopeSchema, wrongType).valid === false);

  var badEmail = { patient_id: 'p1', full_name: 'A', email: 'not-an-email', condition_slug: 'mcas', status: 'active', created_at: '2026-07-03T00:00:00.000Z', created_by: 'x' };
  record('Stage0: schema-validator rejects an invalid "email" format',
    validate(patientIdentitySchema, badEmail).valid === false);

  var badEnum = Object.assign({}, badEmail, { email: 'a@b.com', status: 'not-a-real-status' });
  record('Stage0: schema-validator rejects a value outside an enum',
    validate(patientIdentitySchema, badEnum).valid === false);

  var loginTokenWithEmptySentinel = { token_hash: 'a'.repeat(64), patient_id: 'p1', issued_at: '2026-07-03T00:00:00.000Z', expires_at: '2026-07-03T00:15:00.000Z', used_at: '' };
  record('Stage0: schema-validator accepts login-token.schema.json\'s empty-string used_at sentinel',
    validate(loginTokenSchema, loginTokenWithEmptySentinel).valid === true);

  var loginTokenWithNullUsedAt = Object.assign({}, loginTokenWithEmptySentinel, { used_at: null });
  record('Stage0: schema-validator rejects a null used_at (the sentinel is a string, never null)',
    validate(loginTokenSchema, loginTokenWithNullUsedAt).valid === false);

  // PA-4: schema-validator's new "integer" type and minimum/maximum
  // numeric-bounds support (symptom-log.schema.json's first real need for
  // either) — proven against a tiny local fragment schema, the same
  // "prove the tool before trusting it" discipline as every check above.
  var scaleFragment = { type: 'object', additionalProperties: false, required: ['severity'], properties: { severity: { type: 'integer', minimum: 1, maximum: 10 } } };
  record('Stage0: schema-validator accepts an in-range integer against a type:"integer" schema',
    validate(scaleFragment, { severity: 5 }).valid === true);
  record('Stage0: schema-validator rejects a non-integer number against a type:"integer" schema',
    validate(scaleFragment, { severity: 5.5 }).valid === false);
  record('Stage0: schema-validator rejects an integer below minimum',
    validate(scaleFragment, { severity: 0 }).valid === false);
  record('Stage0: schema-validator rejects an integer above maximum',
    validate(scaleFragment, { severity: 11 }).valid === false);
})();

// ============================================================
// Load the real Foundation source through the real Apps Script mock.
// ============================================================
var h = buildSandbox({ scriptProperties: { FOUNDATION_SESSION_SIGNING_SECRET: 'conformance-test-secret' } });
var ctx = loadProject(h.sandbox);

// ============================================================
// Stage 1 — FoundationContracts.gs -> response-envelope.schema.json
// ============================================================
(function stage1_responseEnvelope() {
  var ok = ctx.buildFoundationOkEnvelope_({ example: true });
  var okResult = validate(responseEnvelopeSchema, ok);
  record('Stage1: buildFoundationOkEnvelope_() output conforms to response-envelope.schema.json',
    okResult.valid === true, okResult.errors.join('; '));

  var okNoData = ctx.buildFoundationOkEnvelope_();
  var okNoDataResult = validate(responseEnvelopeSchema, okNoData);
  record('Stage1: buildFoundationOkEnvelope_() with no argument still conforms (data normalized to null)',
    okNoDataResult.valid === true, okNoDataResult.errors.join('; '));

  var err = ctx.buildFoundationErrorEnvelope_('FOUNDATION_EXAMPLE', 'An example message.');
  var errResult = validate(responseEnvelopeSchema, err);
  record('Stage1: buildFoundationErrorEnvelope_() output conforms to response-envelope.schema.json',
    errResult.valid === true, errResult.errors.join('; '));
})();

// ============================================================
// Stage 2 — PatientIdentity.gs -> patient-identity.schema.json
// ============================================================
(function stage2_patientIdentity() {
  var created = ctx.foundationCreatePatient_({
    full_name: 'Conformance Test Patient',
    email: 'conformance-test@example.com',
    condition_slug: 'mcas',
    created_by: 'conformance-harness'
  });
  record('Stage2: foundationCreatePatient_() succeeds on valid input', created.status === 'ok', JSON.stringify(created));

  var patientResult = validate(patientIdentitySchema, created.data || {});
  record('Stage2: foundationCreatePatient_() output conforms to patient-identity.schema.json',
    patientResult.valid === true, patientResult.errors.join('; '));

  var fetched = ctx.foundationGetPatientById_(created.data.patient_id);
  record('Stage2: foundationGetPatientById_() returns the same record it just created',
    fetched.status === 'ok' && fetched.data.patient_id === created.data.patient_id);

  var fetchedResult = validate(patientIdentitySchema, fetched.data || {});
  record('Stage2: foundationGetPatientById_() output conforms to patient-identity.schema.json',
    fetchedResult.valid === true, fetchedResult.errors.join('; '));

  var notFound = ctx.foundationGetPatientById_('does-not-exist');
  record('Stage2: foundationGetPatientById_() returns FOUNDATION_NOT_FOUND for an unknown id',
    notFound.status === 'error' && notFound.error.code === 'FOUNDATION_NOT_FOUND');
})();

// ============================================================
// Stage 3 — FoundationSession.gs -> session.schema.json
// ============================================================
(function stage3_session() {
  var payload = ctx.foundationBuildSessionPayload_('conformance-patient-1', Date.parse('2026-07-03T00:00:00.000Z'), 3600);
  var payloadResult = validate(sessionSchema, payload);
  record('Stage3: foundationBuildSessionPayload_() output conforms to session.schema.json',
    payloadResult.valid === true, payloadResult.errors.join('; '));

  var token = ctx.foundationIssueSessionToken_('conformance-patient-2');
  var verified = ctx.foundationVerifySessionToken_(token);
  record('Stage3: real issue -> verify round trip succeeds through the PropertiesService-reading entry points',
    verified.valid === true && verified.patientId === 'conformance-patient-2');

  var verifiedPayloadResult = validate(sessionSchema, verified.payload || {});
  record('Stage3: the verified session payload conforms to session.schema.json',
    verifiedPayloadResult.valid === true, verifiedPayloadResult.errors.join('; '));
})();

// ============================================================
// Stage 4 — FoundationRouteGuard.gs, gating on a real, schema-conformant session
// ============================================================
(function stage4_routeGuard() {
  var token = ctx.foundationIssueSessionToken_('conformance-patient-3');
  var handlerCalledWith = null;
  var okResult = ctx.withFoundationAuth_(token, function (patientId) {
    handlerCalledWith = patientId;
    return ctx.buildFoundationOkEnvelope_({ derived: patientId });
  });
  record('Stage4: withFoundationAuth_() calls handlerFn with the verified patientId on a valid token',
    handlerCalledWith === 'conformance-patient-3');

  var okEnvelopeResult = validate(responseEnvelopeSchema, okResult);
  record('Stage4: withFoundationAuth_() success path still returns a conformant envelope',
    okEnvelopeResult.valid === true, okEnvelopeResult.errors.join('; '));

  var handlerCalled = false;
  var rejected = ctx.withFoundationAuth_('not-a-real-token', function () {
    handlerCalled = true;
    return ctx.buildFoundationOkEnvelope_('should not run');
  });
  record('Stage4: withFoundationAuth_() rejects an invalid token without calling handlerFn',
    handlerCalled === false && rejected.status === 'error' && rejected.error.code === 'FOUNDATION_UNAUTHORIZED');

  var rejectedEnvelopeResult = validate(responseEnvelopeSchema, rejected);
  record('Stage4: withFoundationAuth_() rejection also returns a conformant envelope',
    rejectedEnvelopeResult.valid === true, rejectedEnvelopeResult.errors.join('; '));

  // AuditLog is shared, cumulative state across this whole run (Stage2's
  // foundationCreatePatient_() already wrote a patient_created row) — so
  // this checks for the specific session_rejected event, not the sheet's
  // total row count.
  var auditSheet = h.spreadsheet.getSheetByName('AuditLog');
  var auditRows = auditSheet ? auditSheet._debug().rows : [];
  var sessionRejectedRows = auditRows.filter(function (row) { return row[1] === 'session_rejected'; });
  record('Stage4: the rejection wrote exactly one session_rejected AuditLog row',
    sessionRejectedRows.length === 1 && /reason=malformed_token/.test(sessionRejectedRows[0][4]));
})();

// ============================================================
// Stage 5 (IA-1) — FoundationLoginTokens.gs -> login-token.schema.json
// ============================================================
(function stage5_loginTokens() {
  var payload = ctx.foundationBuildLoginTokenRecord_('ia1-conformance-patient', 'a'.repeat(64), Date.parse('2026-07-03T00:00:00.000Z'), 900);
  var payloadResult = validate(loginTokenSchema, payload);
  record('Stage5: foundationBuildLoginTokenRecord_() output conforms to login-token.schema.json (including the empty used_at sentinel)',
    payloadResult.valid === true, payloadResult.errors.join('; '));

  var patient = ctx.foundationCreatePatient_({
    full_name: 'IA-1 Conformance Patient', email: 'ia1-conformance@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage5: setup — a real patient exists to issue a login token for', patient.status === 'ok');

  var created = ctx.foundationCreateLoginToken_(patient.data.patient_id);
  record('Stage5: foundationCreateLoginToken_() succeeds and returns the raw token exactly once',
    created.status === 'ok' && typeof created.data.token === 'string' && created.data.token.length > 0);

  var tokenHash = ctx.foundationHashLoginToken_(created.data.token);
  var storedRecord = ctx.foundationDsGetById_(ctx.FOUNDATION_LOGIN_TOKENS_SHEET_, ctx.FOUNDATION_LOGIN_TOKENS_COLUMNS_, 'token_hash', tokenHash);
  var storedResult = validate(loginTokenSchema, storedRecord || {});
  record('Stage5: the actual persisted LoginTokens row conforms to login-token.schema.json',
    storedResult.valid === true, storedResult.errors.join('; '));
  record('Stage5: the persisted row never stores the raw token — only its hash',
    storedRecord && storedRecord.token_hash === tokenHash && storedRecord.token_hash !== created.data.token);

  var consumed = ctx.foundationConsumeLoginToken_(created.data.token);
  record('Stage5: foundationConsumeLoginToken_() resolves the same patient_id the token was issued for',
    consumed.status === 'ok' && consumed.data.patient_id === patient.data.patient_id);

  var consumedEnvelopeResult = validate(responseEnvelopeSchema, consumed);
  record('Stage5: foundationConsumeLoginToken_() success path returns a conformant envelope',
    consumedEnvelopeResult.valid === true, consumedEnvelopeResult.errors.join('; '));

  var reused = ctx.foundationConsumeLoginToken_(created.data.token);
  record('Stage5: single-use is enforced — consuming the same token twice fails the second time',
    reused.status === 'error' && reused.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var notFound = ctx.foundationConsumeLoginToken_('this-token-was-never-issued');
  record('Stage5: consuming an unknown token fails with the same generic invalid code',
    notFound.status === 'error' && notFound.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var emptyInput = ctx.foundationConsumeLoginToken_('');
  record('Stage5: consuming an empty/malformed input fails immediately with the same generic code',
    emptyInput.status === 'error' && emptyInput.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  // Expiration: create a second token, then backdate its stored
  // expires_at directly (the same technique this repo's other
  // harnesses use to test time-based logic without a real 15-minute
  // wait), and confirm consumption is rejected.
  var second = ctx.foundationCreateLoginToken_(patient.data.patient_id);
  var secondHash = ctx.foundationHashLoginToken_(second.data.token);
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_LOGIN_TOKENS_SHEET_, ctx.FOUNDATION_LOGIN_TOKENS_COLUMNS_, 'token_hash', secondHash,
    { expires_at: new Date(Date.now() - 1000).toISOString() });
  var expiredResult = ctx.foundationConsumeLoginToken_(second.data.token);
  record('Stage5: an expired (backdated) token is rejected with the same generic invalid code',
    expiredResult.status === 'error' && expiredResult.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var loginTokenAuditRows = auditRowsOf(h, 'login_token_rejected');
  var expiredReasonLogged = loginTokenAuditRows.some(function (row) { return /reason=expired/.test(row[4]); });
  var usedReasonLogged = loginTokenAuditRows.some(function (row) { return /reason=already_used/.test(row[4]); });
  var notFoundReasonLogged = loginTokenAuditRows.some(function (row) { return /reason=not_found/.test(row[4]); });
  record('Stage5: each rejection reason (expired, already_used, not_found) was audit-logged with its specific reason, not just the generic outward code',
    expiredReasonLogged && usedReasonLogged && notFoundReasonLogged);

  var consumedAuditRows = auditRowsOf(h, 'login_token_consumed');
  record('Stage5: the successful consumption wrote exactly one login_token_consumed AuditLog row',
    consumedAuditRows.length === 1 && consumedAuditRows[0][2] === patient.data.patient_id);
})();

// ============================================================
// Stage 6 (IA-2) — FoundationLoginFlow.gs, FoundationRateLimit.gs,
// FoundationEmail.gs, FoundationRouter.gs: the real magic-link
// request/consume flow and the first authenticated Web App route, end
// to end through the real, unmodified source.
// ============================================================
(function stage6_loginFlowAndRouter() {
  // ---- 6a: rate limiting, in isolation ----
  var rlEmail = 'stage6-ratelimit@example.com';
  var rlResults = [1, 2, 3, 4, 5].map(function () { return ctx.foundationCheckAndIncrementRateLimit_(rlEmail); });
  record('Stage6a: the first 3 requests for the same email are allowed, the 4th and 5th are not (budget = 3)',
    rlResults.join(',') === 'true,true,true,false,false');

  var otherEmail = 'stage6-ratelimit-other@example.com';
  record('Stage6a: a different email has its own independent budget',
    ctx.foundationCheckAndIncrementRateLimit_(otherEmail) === true);

  // ---- 6b: request-link — malformed input is the one distinct response ----
  var malformed = ctx.foundationHandleRequestLoginLink_({ email: 'not-an-email' });
  record('Stage6b: a syntactically invalid email is rejected distinctly (not an enumeration signal)',
    malformed.status === 'error' && malformed.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- 6c: request-link — unmatched vs matched email get an identical response shape (anti-enumeration, docs/29 §3) ----
  var unmatched = ctx.foundationHandleRequestLoginLink_({ email: 'stage6-unmatched@example.com' });
  record('Stage6c: an unmatched (but well-formed and not rate-limited) email still returns a generic ok envelope',
    unmatched.status === 'ok' && typeof unmatched.data.message === 'string');

  var stage6Patient = ctx.foundationCreatePatient_({
    full_name: 'Stage6 Conformance Patient', email: 'stage6-matched@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage6c: setup — a real patient exists to request a login link for', stage6Patient.status === 'ok');

  h.mailLog.length = 0; // isolate this request's email from anything Stage5/earlier sent
  var matched = ctx.foundationHandleRequestLoginLink_({ email: 'STAGE6-Matched@Example.com' }); // deliberately mixed case
  record('Stage6c: a matched email returns the exact same ok-envelope shape as the unmatched case (byte-identical outward message)',
    matched.status === 'ok' && matched.data.message === unmatched.data.message);

  record('Stage6c: a matched, well-formed, not-rate-limited email actually sends one login-link email',
    h.mailLog.length === 1 && h.mailLog[0].to === stage6Patient.data.email);

  var linkMatch = /href="([^"]+)"/.exec(h.mailLog[0].htmlBody);
  var emailedLink = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : null;
  record('Stage6c: the emailed link points at the login-link URL with a token query parameter',
    !!emailedLink && emailedLink.indexOf(ctx.FOUNDATION_VERIFY_URL_BASE_ + '?token=') === 0);
  var rawTokenFromEmail = emailedLink ? decodeURIComponent(emailedLink.split('token=')[1]) : null;

  var requestedAuditRows = auditRowsOf(h, 'login_link_requested');
  var matchedReasonLogged = requestedAuditRows.some(function (row) { return row[2] === stage6Patient.data.patient_id && /reason=email_sent/.test(row[4]); });
  var notFoundReasonLogged6 = requestedAuditRows.some(function (row) { return /reason=email_not_found/.test(row[4]); });
  record('Stage6c: the specific reason (email_sent vs email_not_found) is still audit-logged internally, even though the outward response never varies',
    matchedReasonLogged && notFoundReasonLogged6);

  // ---- 6d: request-link — a rate-limited email still gets the identical generic response ----
  var rlTargetEmail = 'stage6-ratelimit-target@example.com';
  ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail });
  ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail });
  ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail });
  var rateLimited = ctx.foundationHandleRequestLoginLink_({ email: rlTargetEmail }); // 4th — over budget
  record('Stage6d: a rate-limited request still returns the exact same generic ok envelope, not a distinct error',
    rateLimited.status === 'ok' && rateLimited.data.message === unmatched.data.message);
  record('Stage6d: the rate-limited attempt is audit-logged internally as login_link_rate_limited',
    auditRowsOf(h, 'login_link_rate_limited').length === 1);

  // ---- 6e: consume-link — the real token emailed above, consumed into a real session ----
  record('Stage6e: setup — a raw token was actually recovered from the emailed link', typeof rawTokenFromEmail === 'string' && rawTokenFromEmail.length > 0);
  var consumedForSession = ctx.foundationHandleConsumeLoginLink_({ token: rawTokenFromEmail });
  record('Stage6e: consuming the emailed token succeeds and resolves the same patient_id it was issued for',
    consumedForSession.status === 'ok' && consumedForSession.data.patient_id === stage6Patient.data.patient_id);
  record('Stage6e: consuming the emailed token issues a real, non-empty session_token',
    typeof consumedForSession.data.session_token === 'string' && consumedForSession.data.session_token.length > 0);

  var consumedForSessionEnvelopeResult = validate(responseEnvelopeSchema, consumedForSession);
  record('Stage6e: foundationHandleConsumeLoginLink_() success path conforms to response-envelope.schema.json',
    consumedForSessionEnvelopeResult.valid === true, consumedForSessionEnvelopeResult.errors.join('; '));

  var reusedConsume = ctx.foundationHandleConsumeLoginLink_({ token: rawTokenFromEmail });
  record('Stage6e: the emailed token cannot be consumed twice (single-use still enforced through the IA-2 wrapper)',
    reusedConsume.status === 'error' && reusedConsume.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  var missingTokenConsume = ctx.foundationHandleConsumeLoginLink_({});
  record('Stage6e: consuming with no token field fails with the same generic invalid code',
    missingTokenConsume.status === 'error' && missingTokenConsume.error.code === 'FOUNDATION_LOGIN_TOKEN_INVALID');

  // ---- 6f: FoundationRouter.gs — full HTTP-level dispatch, including the first authenticated route ----
  var requestLinkHttp = ctx.handleFoundationRequest_({ foundation_action: 'request_login_link', email: 'stage6-router@example.com' });
  var requestLinkBody = JSON.parse(requestLinkHttp._text);
  record('Stage6f: handleFoundationRequest_() dispatches request_login_link and serializes a conformant envelope',
    requestLinkBody.status === 'ok' && validate(responseEnvelopeSchema, requestLinkBody).valid === true);

  var unknownActionHttp = ctx.handleFoundationRequest_({ foundation_action: 'not_a_real_action' });
  var unknownActionBody = JSON.parse(unknownActionHttp._text);
  record('Stage6f: handleFoundationRequest_() returns FOUNDATION_UNKNOWN_ACTION for an unrecognized action, never a thrown error',
    unknownActionBody.status === 'error' && unknownActionBody.error.code === 'FOUNDATION_UNKNOWN_ACTION');

  // Issue a second real session (independent of the one already consumed
  // above) to drive get_profile through the real HTTP dispatch path.
  var sessionForProfile = ctx.foundationIssueSessionToken_(stage6Patient.data.patient_id);
  var profileHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_profile', session_token: sessionForProfile });
  var profileBody = JSON.parse(profileHttp._text);
  record('Stage6f: get_profile (Foundation\'s first authenticated route) resolves the caller\'s own Patient record from a valid session',
    profileBody.status === 'ok' && profileBody.data.patient_id === stage6Patient.data.patient_id);

  var profileResult = validate(patientIdentitySchema, profileBody.data || {});
  record('Stage6f: get_profile\'s resolved Patient record still conforms to patient-identity.schema.json',
    profileResult.valid === true, profileResult.errors.join('; '));

  var unauthedProfileHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_profile', session_token: 'not-a-real-session-token' });
  var unauthedProfileBody = JSON.parse(unauthedProfileHttp._text);
  record('Stage6f: get_profile rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking a Patient record',
    unauthedProfileBody.status === 'error' && unauthedProfileBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedProfileBody.data === null);

  record('Stage6f: get_profile derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({ foundation_action: 'get_profile', session_token: sessionForProfile, patient_id: 'someone-elses-id' });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.data.patient_id === stage6Patient.data.patient_id;
    })());
})();

// ============================================================
// Stage 7 (PA-3) — FoundationConsultationHistory.gs -> consultation-history.schema.json,
// plus FoundationRouter.gs's two new dispatch cases end to end.
// ============================================================
(function stage7_consultationHistory() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage7 Patient A', email: 'stage7-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage7 Patient B', email: 'stage7-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage7: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  var payload = ctx.foundationBuildConsultationEntryRecord_(
    { patient_id: patientA.data.patient_id, entry_date: '2026-06-01', title: 'Visit 1', summary_text: 'Notes 1', source_ref: '', created_by: 'staff-1' },
    'stage7-fixture-id', '2026-06-01T00:00:00.000Z'
  );
  var payloadResult = validate(consultationHistorySchema, payload);
  record('Stage7: foundationBuildConsultationEntryRecord_() output conforms to consultation-history.schema.json',
    payloadResult.valid === true, payloadResult.errors.join('; '));
  record('Stage7: entry_type is always the fixed constant "consultation"', payload.entry_type === 'consultation');

  var invalidCreate = ctx.foundationCreateConsultationEntry_({ patient_id: patientA.data.patient_id });
  record('Stage7: foundationCreateConsultationEntry_() rejects missing required fields with FOUNDATION_INVALID_INPUT',
    invalidCreate.status === 'error' && invalidCreate.error.code === 'FOUNDATION_INVALID_INPUT');

  // Three entries for patient A (out of chronological order, to prove
  // sorting), one for patient B (to prove cross-patient isolation below).
  var entryOld = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-05-01', title: 'Oldest visit', summary_text: 'First visit notes.', created_by: 'staff-1'
  });
  var entryNew = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-06-15', title: 'Newest visit', summary_text: 'Most recent visit notes.', created_by: 'staff-1'
  });
  var entryMid = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-06-01', title: 'Middle visit', summary_text: 'Follow-up visit notes.', source_ref: 'phase15-record-123', created_by: 'staff-1'
  });
  var entryOtherPatient = ctx.foundationCreateConsultationEntry_({
    patient_id: patientB.data.patient_id, entry_date: '2026-06-20', title: 'Patient B visit', summary_text: 'Should never appear in patient A\'s timeline.', created_by: 'staff-1'
  });
  record('Stage7: setup — four real entries created (three for patient A, one for patient B)',
    [entryOld, entryNew, entryMid, entryOtherPatient].every(function (r) { return r.status === 'ok'; }));

  var createdResult = validate(consultationHistorySchema, entryMid.data || {});
  record('Stage7: a real foundationCreateConsultationEntry_() result conforms to consultation-history.schema.json',
    createdResult.valid === true, createdResult.errors.join('; '));

  var timeline = ctx.foundationGetPatientTimeline_(patientA.data.patient_id);
  record('Stage7: foundationGetPatientTimeline_() succeeds', timeline.status === 'ok');
  record('Stage7: the timeline contains only patient A\'s three entries, never patient B\'s',
    timeline.data.length === 3 && timeline.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));
  record('Stage7: the timeline is sorted newest-entry_date-first (docs/39 §3), independent of creation order',
    timeline.data[0].record_id === entryNew.data.record_id &&
    timeline.data[1].record_id === entryMid.data.record_id &&
    timeline.data[2].record_id === entryOld.data.record_id);

  var entryTimelineResult = validate(consultationHistorySchema, timeline.data[0]);
  record('Stage7: a real timeline entry conforms to consultation-history.schema.json',
    entryTimelineResult.valid === true, entryTimelineResult.errors.join('; '));

  // ---- Ordering tiebreaker: same entry_date, different created_at ----
  // Two real synchronous calls can land on the same millisecond timestamp
  // (no defined "newer" between them), so — the same explicit-backdating
  // technique Stage 5 already uses for expiry — tieOlder's stored
  // created_at is patched directly to a provably earlier instant rather
  // than relying on real wall-clock timing between two calls.
  var tieOlder = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-07-01', title: 'Tie — written first', summary_text: 'x', created_by: 'staff-1'
  });
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_CONSULTATION_HISTORY_SHEET_, ctx.FOUNDATION_CONSULTATION_HISTORY_COLUMNS_, 'record_id', tieOlder.data.record_id,
    { created_at: '2020-01-01T00:00:00.000Z' });
  var tieNewer = ctx.foundationCreateConsultationEntry_({
    patient_id: patientA.data.patient_id, entry_date: '2026-07-01', title: 'Tie — written second', summary_text: 'x', created_by: 'staff-1'
  });
  var timelineWithTie = ctx.foundationGetPatientTimeline_(patientA.data.patient_id);
  var tieIndexNewer = timelineWithTie.data.findIndex(function (e) { return e.record_id === tieNewer.data.record_id; });
  var tieIndexOlder = timelineWithTie.data.findIndex(function (e) { return e.record_id === tieOlder.data.record_id; });
  record('Stage7: same-entry_date rows tiebreak on created_at descending (the more recently written row sorts first)',
    tieIndexNewer !== -1 && tieIndexOlder !== -1 && tieIndexNewer < tieIndexOlder);

  // ---- Detail view: found, and the cross-patient-authorization boundary (docs/40 Q3) ----
  var ownEntry = ctx.foundationGetConsultationEntryById_(patientA.data.patient_id, entryMid.data.record_id);
  record('Stage7: foundationGetConsultationEntryById_() resolves a patient\'s own entry by record_id',
    ownEntry.status === 'ok' && ownEntry.data.record_id === entryMid.data.record_id);

  var crossPatientAttempt = ctx.foundationGetConsultationEntryById_(patientB.data.patient_id, entryMid.data.record_id);
  record('Stage7: a different patient requesting patient A\'s record_id is rejected, never leaking the row',
    crossPatientAttempt.status === 'error' && crossPatientAttempt.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientAttempt.data === null);

  var unknownIdAttempt = ctx.foundationGetConsultationEntryById_(patientA.data.patient_id, 'this-record-id-was-never-created');
  record('Stage7: an unknown record_id fails with the exact same code as a cross-patient attempt (anti-enumeration)',
    unknownIdAttempt.status === 'error' && unknownIdAttempt.error.code === crossPatientAttempt.error.code &&
    unknownIdAttempt.error.message === crossPatientAttempt.error.message);

  // ---- FoundationRouter.gs — the two new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var timelineHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline', session_token: sessionA });
  var timelineBody = JSON.parse(timelineHttp._text);
  record('Stage7: get_timeline (real HTTP dispatch) resolves the caller\'s own timeline from a valid session',
    timelineBody.status === 'ok' && timelineBody.data.length === 5 &&
    timelineBody.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));

  var unauthedTimelineHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline', session_token: 'not-a-real-session-token' });
  var unauthedTimelineBody = JSON.parse(unauthedTimelineHttp._text);
  record('Stage7: get_timeline rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedTimelineBody.status === 'error' && unauthedTimelineBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedTimelineBody.data === null);

  var entryHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline_entry', session_token: sessionA, record_id: entryMid.data.record_id });
  var entryBody = JSON.parse(entryHttp._text);
  record('Stage7: get_timeline_entry (real HTTP dispatch) resolves the caller\'s own entry by record_id',
    entryBody.status === 'ok' && entryBody.data.record_id === entryMid.data.record_id);

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var crossPatientHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_timeline_entry', session_token: sessionB, record_id: entryMid.data.record_id });
  var crossPatientHttpBody = JSON.parse(crossPatientHttp._text);
  record('Stage7: get_timeline_entry over real HTTP dispatch still rejects a cross-patient record_id request, never leaking the row',
    crossPatientHttpBody.status === 'error' && crossPatientHttpBody.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientHttpBody.data === null);

  record('Stage7: get_timeline_entry derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'get_timeline_entry', session_token: sessionB,
        record_id: entryMid.data.record_id, patient_id: patientA.data.patient_id
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'error' && spoofedBody.error.code === 'FOUNDATION_NOT_FOUND';
    })());

  var createdAuditRows = auditRowsOf(h, 'consultation_entry_created');
  record('Stage7: every foundationCreateConsultationEntry_() call wrote its own consultation_entry_created AuditLog row',
    createdAuditRows.length === 6);
})();

// ============================================================
// Stage 8 (PA-4) — FoundationSymptomLog.gs -> symptom-log.schema.json,
// plus FoundationRouter.gs's two new dispatch cases end to end. The
// platform's first patient-writable route.
// ============================================================
(function stage8_symptomLog() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage8 Patient A', email: 'stage8-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage8 Patient B', email: 'stage8-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage8: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  var payload = ctx.foundationBuildSymptomLogRecord_(
    { patient_id: patientA.data.patient_id, severity: 5, sleep: 6, energy: 4, stress: 3, notes: 'Felt a bit tired.', condition_slug: 'mcas' },
    'stage8-fixture-id', '2026-07-01T00:00:00.000Z'
  );
  var payloadResult = validate(symptomLogSchema, payload);
  record('Stage8: foundationBuildSymptomLogRecord_() output conforms to symptom-log.schema.json',
    payloadResult.valid === true, payloadResult.errors.join('; '));

  var missingScales = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5 });
  record('Stage8: foundationCreateSymptomLog_() rejects a partial log (missing sleep/energy/stress) with FOUNDATION_INVALID_INPUT — all four scale fields are mandatory (docs/41 §10 Q1)',
    missingScales.status === 'error' && missingScales.error.code === 'FOUNDATION_INVALID_INPUT');

  var outOfRange = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 11, sleep: 5, energy: 5, stress: 5 });
  record('Stage8: foundationCreateSymptomLog_() rejects an out-of-range scale value (11 > 10)',
    outOfRange.status === 'error' && outOfRange.error.code === 'FOUNDATION_INVALID_INPUT');

  var nonIntegerScale = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5.5, sleep: 5, energy: 5, stress: 5 });
  record('Stage8: foundationCreateSymptomLog_() rejects a non-integer scale value',
    nonIntegerScale.status === 'error' && nonIntegerScale.error.code === 'FOUNDATION_INVALID_INPUT');

  var badSlug = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5, sleep: 5, energy: 5, stress: 5, condition_slug: 'not-a-real-slug' });
  record('Stage8: foundationCreateSymptomLog_() rejects a condition_slug outside the canonical list (shared/constants/condition-slugs.json)',
    badSlug.status === 'error' && badSlug.error.code === 'FOUNDATION_INVALID_INPUT');

  // Three entries for patient A (with distinct logged_at instants, to
  // prove sorting), one for patient B (to prove cross-patient isolation).
  var entryOldest = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 3, sleep: 7, energy: 6, stress: 2, notes: 'Oldest entry.' });
  var entryMiddle = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 5, sleep: 6, energy: 5, stress: 4, condition_slug: 'mcas' });
  var entryNewest = ctx.foundationCreateSymptomLog_({ patient_id: patientA.data.patient_id, severity: 7, sleep: 4, energy: 3, stress: 6, notes: '<script>alert(1)</script>' });
  var entryOtherPatient = ctx.foundationCreateSymptomLog_({ patient_id: patientB.data.patient_id, severity: 8, sleep: 8, energy: 8, stress: 8 });
  record('Stage8: setup — four real entries created (three for patient A, one for patient B)',
    [entryOldest, entryMiddle, entryNewest, entryOtherPatient].every(function (r) { return r.status === 'ok'; }));

  var createdResult = validate(symptomLogSchema, entryMiddle.data || {});
  record('Stage8: a real foundationCreateSymptomLog_() result conforms to symptom-log.schema.json',
    createdResult.valid === true, createdResult.errors.join('; '));
  record('Stage8: logged_at is server-set, never accepted from a client-supplied field (docs/41 §10 Q2)',
    typeof entryMiddle.data.logged_at === 'string' && entryMiddle.data.logged_at.length > 0);
  record('Stage8: notes is stored raw (unescaped) — escaping happens at display time, the same convention every other free-text field already uses',
    entryNewest.data.notes === '<script>alert(1)</script>');

  // Backdate the two earlier entries directly (same technique Stage 5/7
  // already use) so ordering is provable without relying on real
  // wall-clock timing between three synchronous calls.
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_SYMPTOM_LOGS_SHEET_, ctx.FOUNDATION_SYMPTOM_LOGS_COLUMNS_, 'record_id', entryOldest.data.record_id,
    { logged_at: '2026-01-01T00:00:00.000Z' });
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_SYMPTOM_LOGS_SHEET_, ctx.FOUNDATION_SYMPTOM_LOGS_COLUMNS_, 'record_id', entryMiddle.data.record_id,
    { logged_at: '2026-06-01T00:00:00.000Z' });

  var logs = ctx.foundationGetPatientSymptomLogs_(patientA.data.patient_id);
  record('Stage8: foundationGetPatientSymptomLogs_() succeeds', logs.status === 'ok');
  record('Stage8: the list contains only patient A\'s three entries, never patient B\'s',
    logs.data.length === 3 && logs.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));
  record('Stage8: the list is sorted logged_at descending (newest first), independent of creation order',
    logs.data[0].record_id === entryNewest.data.record_id &&
    logs.data[1].record_id === entryMiddle.data.record_id &&
    logs.data[2].record_id === entryOldest.data.record_id);

  var logsEntryResult = validate(symptomLogSchema, logs.data[0]);
  record('Stage8: a real listed entry conforms to symptom-log.schema.json',
    logsEntryResult.valid === true, logsEntryResult.errors.join('; '));

  // ---- FoundationRouter.gs — the two new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var logSymptomHttp = ctx.handleFoundationRequest_({
    foundation_action: 'log_symptom', session_token: sessionA,
    severity: 6, sleep: 6, energy: 6, stress: 6, notes: 'Via HTTP dispatch.'
  });
  var logSymptomBody = JSON.parse(logSymptomHttp._text);
  record('Stage8: log_symptom (real HTTP dispatch) creates an entry for the caller\'s own session-derived patient_id',
    logSymptomBody.status === 'ok' && logSymptomBody.data.patient_id === patientA.data.patient_id);

  record('Stage8: log_symptom derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'log_symptom', session_token: sessionA, patient_id: 'someone-elses-id',
        severity: 5, sleep: 5, energy: 5, stress: 5
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.patient_id === patientA.data.patient_id;
    })());

  var unauthedLogSymptomHttp = ctx.handleFoundationRequest_({ foundation_action: 'log_symptom', session_token: 'not-a-real-session-token', severity: 5, sleep: 5, energy: 5, stress: 5 });
  var unauthedLogSymptomBody = JSON.parse(unauthedLogSymptomHttp._text);
  record('Stage8: log_symptom rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never writing a row',
    unauthedLogSymptomBody.status === 'error' && unauthedLogSymptomBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedLogSymptomBody.data === null);

  var getSymptomLogsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: sessionA });
  var getSymptomLogsBody = JSON.parse(getSymptomLogsHttp._text);
  record('Stage8: get_symptom_logs (real HTTP dispatch) resolves the caller\'s own entries from a valid session',
    getSymptomLogsBody.status === 'ok' && getSymptomLogsBody.data.length === 5 &&
    getSymptomLogsBody.data.every(function (e) { return e.patient_id === patientA.data.patient_id; }));

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var getSymptomLogsHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: sessionB });
  var getSymptomLogsBodyB = JSON.parse(getSymptomLogsHttpB._text);
  record('Stage8: get_symptom_logs over real HTTP dispatch returns only patient B\'s own entry, never patient A\'s, proving cross-patient isolation on the platform\'s first patient-writable route',
    getSymptomLogsBodyB.status === 'ok' && getSymptomLogsBodyB.data.length === 1 && getSymptomLogsBodyB.data[0].patient_id === patientB.data.patient_id);

  var unauthedGetSymptomLogsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_symptom_logs', session_token: 'not-a-real-session-token' });
  var unauthedGetSymptomLogsBody = JSON.parse(unauthedGetSymptomLogsHttp._text);
  record('Stage8: get_symptom_logs rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedGetSymptomLogsBody.status === 'error' && unauthedGetSymptomLogsBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedGetSymptomLogsBody.data === null);

  var invalidInputHttp = ctx.handleFoundationRequest_({ foundation_action: 'log_symptom', session_token: sessionA, severity: 5 });
  var invalidInputBody = JSON.parse(invalidInputHttp._text);
  record('Stage8: log_symptom over real HTTP dispatch still rejects a partial log with FOUNDATION_INVALID_INPUT',
    invalidInputBody.status === 'error' && invalidInputBody.error.code === 'FOUNDATION_INVALID_INPUT');

  var createdAuditRows = auditRowsOf(h, 'symptom_log_created');
  record('Stage8: every foundationCreateSymptomLog_() call (direct and via HTTP dispatch) wrote its own symptom_log_created AuditLog row',
    createdAuditRows.length === 6);
})();

// ============================================================
// Stage 9 (PA-5) — FoundationReports.gs -> report.schema.json, plus
// FoundationRouter.gs's three new dispatch cases end to end. The
// platform's highest-risk feature (docs/29 §8, §11;
// docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md).
// ============================================================
(function stage9_reports() {
  function pdfBytes(totalSize) {
    var header = Buffer.from('%PDF-1.4\n', 'utf8');
    var fillerSize = Math.max(0, (totalSize || 200) - header.length);
    return Buffer.concat([header, Buffer.alloc(fillerSize, 0x41)]);
  }
  function pngBytes() {
    return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  }
  function plainTextBytes() {
    return Buffer.from('This is just a plain text file, not a real PDF.', 'utf8');
  }
  function b64(buf) { return buf.toString('base64'); }

  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage9 Patient A', email: 'stage9-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage9 Patient B', email: 'stage9-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage9: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  record('Stage9: upload-limits.json\'s max_upload_bytes matches FoundationReports.gs\'s ported constant (shared/README.md\'s conformance discipline)',
    ctx.FOUNDATION_REPORT_MAX_UPLOAD_BYTES_ === uploadLimits.max_upload_bytes);

  // ---- Missing/malformed input, rejected before any byte is decoded ----
  var missingFields = ctx.foundationCreateReport_({ patient_id: patientA.data.patient_id });
  record('Stage9: foundationCreateReport_() rejects missing required fields with FOUNDATION_INVALID_INPUT',
    missingFields.status === 'error' && missingFields.error.code === 'FOUNDATION_INVALID_INPUT');

  var badExtension = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.exe', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes()), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a disallowed filename extension is rejected even with an otherwise-valid PDF payload (extension is a named, non-sole check)',
    badExtension.status === 'error' && badExtension.error.code === 'FOUNDATION_INVALID_INPUT');

  var badDeclaredMime = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/x-msdownload',
    file_base64: b64(pdfBytes()), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a disallowed client-declared mime_type is rejected even with an otherwise-valid PDF payload',
    badDeclaredMime.status === 'error' && badDeclaredMime.error.code === 'FOUNDATION_INVALID_INPUT');

  var malformedBase64 = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/pdf',
    file_base64: 'not-valid-base64!!! ###', uploaded_by: patientA.data.patient_id
  });
  record('Stage9: malformed base64 content is rejected with FOUNDATION_INVALID_INPUT',
    malformedBase64.status === 'error' && malformedBase64.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The real security proof: content-based detection catches what extension/declared-mime cannot ----
  var spoofedType = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/pdf',
    file_base64: b64(plainTextBytes()), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a file whose real bytes are plain text is rejected despite a matching .pdf extension AND a matching declared mime_type — proving content-based detection is a real, independent check, not just named in a comment',
    spoofedType.status === 'error' && spoofedType.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- Size cap enforced against real decoded bytes, never the client's claim ----
  var oversized = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'report.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes(ctx.FOUNDATION_REPORT_MAX_UPLOAD_BYTES_ + 1024)), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a file exceeding the configured max_upload_bytes is rejected, measured from the real decoded byte length',
    oversized.status === 'error' && oversized.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- A real, valid upload succeeds end to end ----
  var uploaded = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'Lab Result.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes(300)), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: foundationCreateReport_() succeeds on a real, valid PDF payload', uploaded.status === 'ok', JSON.stringify(uploaded));

  var uploadedResult = validate(reportSchema, uploaded.data || {});
  record('Stage9: foundationCreateReport_() output conforms to report.schema.json',
    uploadedResult.valid === true, uploadedResult.errors.join('; '));
  record('Stage9: the stored mime_type is the server-detected value, not merely an echo of the client-declared one',
    uploaded.data.mime_type === 'application/pdf');
  record('Stage9: size_bytes is the real decoded byte length (300), not any client-supplied number',
    uploaded.data.size_bytes === 300);
  record('Stage9: file_name is preserved verbatim for display, even though it is never used as the Drive object name',
    uploaded.data.file_name === 'Lab Result.pdf');
  record('Stage9: the Drive object is named using record_id alone — never patient_id and never the client-supplied filename (docs/42 §5)',
    h.driveFilesById[uploaded.data.drive_file_id] !== undefined &&
    h.driveFilesById[uploaded.data.drive_file_id].getBlob().getBytes().length === pdfBytes(300).length);

  // ---- docs/42 §6's own named "single most important" test: Drive sharing is verifiably private ----
  var uploadedDriveFile = h.driveFilesById[uploaded.data.drive_file_id];
  record('Stage9: setup — the uploaded report\'s real Drive file object exists in the mock store', !!uploadedDriveFile);
  record('Stage9: the uploaded file\'s Drive sharing access is explicitly PRIVATE — not ANYONE or ANYONE_WITH_LINK (docs/42 §6: "a default is not the same as a verified guarantee")',
    uploadedDriveFile.getSharingAccess() === h.sandbox.DriveApp.Access.PRIVATE &&
    uploadedDriveFile.getSharingAccess() !== h.sandbox.DriveApp.Access.ANYONE &&
    uploadedDriveFile.getSharingAccess() !== h.sandbox.DriveApp.Access.ANYONE_WITH_LINK);
  record('Stage9: the uploaded file\'s Drive sharing permission is explicitly NONE',
    uploadedDriveFile.getSharingPermission() === h.sandbox.DriveApp.Permission.NONE);

  // Second entry for patient A (a PNG, to prove the allowlist covers more
  // than one type) plus one for patient B (cross-patient isolation).
  var uploadedPng = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'scan.png', mime_type: 'image/png',
    file_base64: b64(pngBytes()), uploaded_by: patientA.data.patient_id
  });
  var uploadedForPatientB = ctx.foundationCreateReport_({
    patient_id: patientB.data.patient_id, file_name: 'other-patient.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes()), uploaded_by: patientB.data.patient_id
  });
  record('Stage9: setup — a second report for patient A (PNG) and one for patient B both succeed',
    uploadedPng.status === 'ok' && uploadedForPatientB.status === 'ok');

  // Backdate the first upload so ordering is provable without relying on
  // real wall-clock timing between two synchronous calls (same technique
  // Stage 5/7/8 already use).
  ctx.foundationDsUpdateById_(ctx.FOUNDATION_REPORTS_SHEET_, ctx.FOUNDATION_REPORTS_COLUMNS_, 'record_id', uploaded.data.record_id,
    { uploaded_at: '2026-01-01T00:00:00.000Z' });

  var listA = ctx.foundationGetPatientReports_(patientA.data.patient_id);
  record('Stage9: foundationGetPatientReports_() succeeds', listA.status === 'ok');
  record('Stage9: the list contains only patient A\'s two reports, never patient B\'s',
    listA.data.length === 2 && listA.data.every(function (r) { return r.patient_id === patientA.data.patient_id; }));
  record('Stage9: the list is sorted uploaded_at descending (newest first)',
    listA.data[0].record_id === uploadedPng.data.record_id && listA.data[1].record_id === uploaded.data.record_id);

  var listEntryResult = validate(reportSchema, listA.data[0]);
  record('Stage9: a real listed report conforms to report.schema.json',
    listEntryResult.valid === true, listEntryResult.errors.join('; '));

  // ---- Download: ownership gate before any DriveApp call, real content round-trips ----
  var ownDownload = ctx.foundationDownloadReport_(patientA.data.patient_id, uploaded.data.record_id);
  record('Stage9: foundationDownloadReport_() resolves a patient\'s own report',
    ownDownload.status === 'ok' && ownDownload.data.record_id === uploaded.data.record_id);
  record('Stage9: the downloaded file content round-trips byte-for-byte with what was uploaded',
    Buffer.from(ownDownload.data.file_base64, 'base64').equals(pdfBytes(300)));

  var crossPatientDownload = ctx.foundationDownloadReport_(patientB.data.patient_id, uploaded.data.record_id);
  record('Stage9: a different patient requesting patient A\'s record_id is rejected, never leaking file content',
    crossPatientDownload.status === 'error' && crossPatientDownload.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientDownload.data === null);

  var unknownIdDownload = ctx.foundationDownloadReport_(patientA.data.patient_id, 'this-record-id-was-never-created');
  record('Stage9: an unknown record_id fails with the exact same code/message as a cross-patient attempt (anti-enumeration)',
    unknownIdDownload.status === 'error' && unknownIdDownload.error.code === crossPatientDownload.error.code &&
    unknownIdDownload.error.message === crossPatientDownload.error.message);

  // ---- FoundationRouter.gs — the three new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var uploadHttp = ctx.handleFoundationRequest_({
    foundation_action: 'upload_report', session_token: sessionA,
    file_name: 'via-http.pdf', mime_type: 'application/pdf', file_base64: b64(pdfBytes(150))
  });
  var uploadBody = JSON.parse(uploadHttp._text);
  record('Stage9: upload_report (real HTTP dispatch) creates a report for the caller\'s own session-derived patient_id',
    uploadBody.status === 'ok' && uploadBody.data.patient_id === patientA.data.patient_id && uploadBody.data.uploaded_by === patientA.data.patient_id);

  record('Stage9: upload_report derives patient_id/uploaded_by only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'upload_report', session_token: sessionA, patient_id: 'someone-elses-id', uploaded_by: 'someone-elses-id',
        file_name: 'spoof-attempt.pdf', mime_type: 'application/pdf', file_base64: b64(pdfBytes(150))
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.patient_id === patientA.data.patient_id && spoofedBody.data.uploaded_by === patientA.data.patient_id;
    })());

  var unauthedUploadHttp = ctx.handleFoundationRequest_({ foundation_action: 'upload_report', session_token: 'not-a-real-session-token', file_name: 'x.pdf', mime_type: 'application/pdf', file_base64: b64(pdfBytes()) });
  var unauthedUploadBody = JSON.parse(unauthedUploadHttp._text);
  record('Stage9: upload_report rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never writing a row',
    unauthedUploadBody.status === 'error' && unauthedUploadBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedUploadBody.data === null);

  var getReportsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_reports', session_token: sessionA });
  var getReportsBody = JSON.parse(getReportsHttp._text);
  // 4 so far for patient A: uploaded, uploadedPng (direct calls above),
  // uploadHttp's "via-http.pdf", and the spoofed-patient_id request just
  // above (which still succeeds, against the session-derived patient_id).
  record('Stage9: get_reports (real HTTP dispatch) resolves the caller\'s own reports from a valid session',
    getReportsBody.status === 'ok' && getReportsBody.data.length === 4 && getReportsBody.data.every(function (r) { return r.patient_id === patientA.data.patient_id; }));

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var getReportsHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_reports', session_token: sessionB });
  var getReportsBodyB = JSON.parse(getReportsHttpB._text);
  record('Stage9: get_reports over real HTTP dispatch returns only patient B\'s own report, never patient A\'s',
    getReportsBodyB.status === 'ok' && getReportsBodyB.data.length === 1 && getReportsBodyB.data[0].patient_id === patientB.data.patient_id);

  var downloadHttp = ctx.handleFoundationRequest_({ foundation_action: 'download_report', session_token: sessionA, record_id: uploaded.data.record_id });
  var downloadBody = JSON.parse(downloadHttp._text);
  record('Stage9: download_report (real HTTP dispatch) resolves the caller\'s own report content',
    downloadBody.status === 'ok' && downloadBody.data.record_id === uploaded.data.record_id &&
    Buffer.from(downloadBody.data.file_base64, 'base64').equals(pdfBytes(300)));

  var crossPatientDownloadHttp = ctx.handleFoundationRequest_({ foundation_action: 'download_report', session_token: sessionB, record_id: uploaded.data.record_id });
  var crossPatientDownloadHttpBody = JSON.parse(crossPatientDownloadHttp._text);
  record('Stage9: download_report over real HTTP dispatch still rejects a cross-patient record_id request, never leaking file content',
    crossPatientDownloadHttpBody.status === 'error' && crossPatientDownloadHttpBody.error.code === 'FOUNDATION_NOT_FOUND' && crossPatientDownloadHttpBody.data === null);

  var unauthedDownloadHttp = ctx.handleFoundationRequest_({ foundation_action: 'download_report', session_token: 'not-a-real-session-token', record_id: uploaded.data.record_id });
  var unauthedDownloadHttpBody = JSON.parse(unauthedDownloadHttp._text);
  record('Stage9: download_report rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedDownloadHttpBody.status === 'error' && unauthedDownloadHttpBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedDownloadHttpBody.data === null);

  // ---- No update, no delete — the approved architecture decision, verified as an absence ----
  record('Stage9: no update/delete function exists for Reports (metadata is immutable after upload, per the approved architecture decision)',
    typeof ctx.foundationUpdateReport_ === 'undefined' && typeof ctx.foundationDeleteReport_ === 'undefined');

  // ---- The manually-run staff wrapper — the only staff-attributed path, no Web App route involved ----
  var preExistingFileId = h.seedDriveFile(pngBytes(), null, 'staff-uploaded-scan.png');
  var staffAttached = ctx.foundationCreateReportForExistingDriveFile_({
    patient_id: patientA.data.patient_id, drive_file_id: preExistingFileId,
    file_name: 'Staff-attached scan.png', uploaded_by: 'staff:dr-sharma'
  });
  record('Stage9: foundationCreateReportForExistingDriveFile_() succeeds against a real pre-existing Drive file, without re-uploading it',
    staffAttached.status === 'ok' && staffAttached.data.drive_file_id === preExistingFileId && staffAttached.data.uploaded_by === 'staff:dr-sharma');

  var staffAttachedResult = validate(reportSchema, staffAttached.data || {});
  record('Stage9: the staff-wrapper\'s output also conforms to report.schema.json',
    staffAttachedResult.valid === true, staffAttachedResult.errors.join('; '));

  var staffMissingFields = ctx.foundationCreateReportForExistingDriveFile_({ patient_id: patientA.data.patient_id });
  record('Stage9: foundationCreateReportForExistingDriveFile_() rejects missing required fields with FOUNDATION_INVALID_INPUT',
    staffMissingFields.status === 'error' && staffMissingFields.error.code === 'FOUNDATION_INVALID_INPUT');

  var staffBadType = ctx.foundationCreateReportForExistingDriveFile_({
    patient_id: patientA.data.patient_id, drive_file_id: h.seedDriveFile(plainTextBytes(), null, 'not-really-a-pdf.pdf'),
    file_name: 'Fake.pdf', uploaded_by: 'staff:dr-sharma'
  });
  record('Stage9: the staff wrapper runs the same content-based type check — a non-PDF/JPG/PNG Drive file is rejected',
    staffBadType.status === 'error' && staffBadType.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- docs/42 §1/§15's named partial-write failure mode: Drive succeeds, Sheets fails ----
  // Deliberately corrupt the live 'Reports' sheet's header (the same
  // "mock the platform, run the real logic" technique used throughout
  // this harness) so foundationDsInsert_()'s header-drift check throws —
  // this simulates a Sheets-write failure occurring strictly after the
  // Drive write inside foundationCreateReport_() has already succeeded.
  // Run last in this stage: it deliberately leaves 'Reports' unusable for
  // any further real inserts in this run.
  var driveFileIdsBeforePartialFailure = Object.keys(h.driveFilesById);
  h.spreadsheet.insertSheet(ctx.FOUNDATION_REPORTS_SHEET_).appendRow(['deliberately', 'wrong', 'header']);
  var partialFailureResult = ctx.foundationCreateReport_({
    patient_id: patientA.data.patient_id, file_name: 'partial-failure.pdf', mime_type: 'application/pdf',
    file_base64: b64(pdfBytes(150)), uploaded_by: patientA.data.patient_id
  });
  record('Stage9: a Sheets-write failure after a successful Drive write is caught and returns the standard generic error envelope, never a raw exception',
    partialFailureResult.status === 'error' && partialFailureResult.error.code === 'FOUNDATION_UNEXPECTED_ERROR');

  var driveFileIdsAfterPartialFailure = Object.keys(h.driveFilesById);
  var orphanCandidateId = driveFileIdsAfterPartialFailure.filter(function (id) { return driveFileIdsBeforePartialFailure.indexOf(id) === -1; })[0];
  record('Stage9: setup — exactly one new Drive file was created by the failed upload attempt (the rollback candidate)',
    driveFileIdsAfterPartialFailure.length === driveFileIdsBeforePartialFailure.length + 1 && !!orphanCandidateId);
  record('Stage9: the Drive file created during the failed upload was rolled back (trashed) rather than left as a silent orphan — rollback is preferred, per the approved decision',
    !!orphanCandidateId && h.driveFilesById[orphanCandidateId].isTrashed() === true);

  var rollbackAuditRows = auditRowsOf(h, 'report_upload_rolled_back');
  record('Stage9: the rollback was audit-logged (report_upload_rolled_back) with the specific record/drive file ids, distinguishable from a normal successful upload',
    !!orphanCandidateId && rollbackAuditRows.some(function (row) { return row[4].indexOf(orphanCandidateId) !== -1; }));
  record('Stage9: no report_upload_orphaned_file event was logged for this run — rollback succeeded, so the "rollback impossible" fallback path was never taken',
    auditRowsOf(h, 'report_upload_orphaned_file').length === 0);

  var createdAuditRows = auditRowsOf(h, 'report_uploaded');
  record('Stage9: every successful upload (direct, via HTTP dispatch, and via the staff wrapper) wrote its own report_uploaded AuditLog row',
    createdAuditRows.length === 6);
})();

// ============================================================
// Stage 10 (PXP-1) — FoundationPatientProfile.gs -> patient-profile.schema.json,
// plus FoundationRouter.gs's two new dispatch cases end to end. The
// platform's first patient-mutable, upsert-style entity (docs/44 §17/§22;
// docs/47-PHASE-2B-IMPLEMENTATION-RULES.md).
// ============================================================
(function stage10_patientProfile() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage10 Patient A', email: 'stage10-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage10 Patient B', email: 'stage10-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage10: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  // ---- Lazy creation: a patient with no saved row yet gets a real, default-shaped record ----
  var freshProfile = ctx.foundationGetPatientProfile_(patientA.data.patient_id);
  record('Stage10: foundationGetPatientProfile_() never returns FOUNDATION_NOT_FOUND for a patient who has not saved a profile yet',
    freshProfile.status === 'ok');
  record('Stage10: a never-saved profile is a real, default-shaped record — every optional field empty, patient_id populated',
    freshProfile.data.patient_id === patientA.data.patient_id &&
    freshProfile.data.phone === '' && freshProfile.data.date_of_birth === '' &&
    freshProfile.data.preferred_contact_method === '' && freshProfile.data.emergency_contact === '' &&
    freshProfile.data.updated_at === '' && freshProfile.data.updated_by === '');
  var freshProfileResult = validate(patientProfileSchema, freshProfile.data);
  record('Stage10: the default-shaped record conforms to patient-profile.schema.json',
    freshProfileResult.valid === true, freshProfileResult.errors.join('; '));

  // ---- Validation rejections ----
  var badPhone = ctx.foundationSavePatientProfile_({ patient_id: patientA.data.patient_id, phone: 'abc' });
  record('Stage10: foundationSavePatientProfile_() rejects a non-numeric phone with FOUNDATION_INVALID_INPUT',
    badPhone.status === 'error' && badPhone.error.code === 'FOUNDATION_INVALID_INPUT');

  var futureDob = ctx.foundationSavePatientProfile_({ patient_id: patientA.data.patient_id, date_of_birth: '2099-01-01' });
  record('Stage10: foundationSavePatientProfile_() rejects a date_of_birth in the future',
    futureDob.status === 'error' && futureDob.error.code === 'FOUNDATION_INVALID_INPUT');

  var badCalendarDate = ctx.foundationSavePatientProfile_({ patient_id: patientA.data.patient_id, date_of_birth: '1990-02-30' });
  record('Stage10: foundationSavePatientProfile_() rejects a non-existent calendar date (Feb 30)',
    badCalendarDate.status === 'error' && badCalendarDate.error.code === 'FOUNDATION_INVALID_INPUT');

  var badContactMethod = ctx.foundationSavePatientProfile_({ patient_id: patientA.data.patient_id, preferred_contact_method: 'carrier-pigeon' });
  record('Stage10: foundationSavePatientProfile_() rejects a preferred_contact_method outside email/phone/sms',
    badContactMethod.status === 'error' && badContactMethod.error.code === 'FOUNDATION_INVALID_INPUT');

  var tooLongEmergencyContact = ctx.foundationSavePatientProfile_({ patient_id: patientA.data.patient_id, emergency_contact: new Array(202).join('x') });
  record('Stage10: foundationSavePatientProfile_() rejects an emergency_contact longer than 200 characters',
    tooLongEmergencyContact.status === 'error' && tooLongEmergencyContact.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- First save: proves the insert branch of the upsert ----
  var firstSave = ctx.foundationSavePatientProfile_({
    patient_id: patientA.data.patient_id, phone: '+1 555-123-4567', date_of_birth: '1990-05-15',
    preferred_contact_method: 'email', emergency_contact: '<script>alert(1)</script>'
  });
  record('Stage10: foundationSavePatientProfile_() succeeds on a first, valid save', firstSave.status === 'ok');
  var firstSaveResult = validate(patientProfileSchema, firstSave.data || {});
  record('Stage10: a real foundationSavePatientProfile_() result conforms to patient-profile.schema.json',
    firstSaveResult.valid === true, firstSaveResult.errors.join('; '));
  record('Stage10: updated_at/updated_by are server-set, never accepted from a client-supplied field',
    typeof firstSave.data.updated_at === 'string' && firstSave.data.updated_at.length > 0 &&
    firstSave.data.updated_by === patientA.data.patient_id);
  record('Stage10: emergency_contact is stored raw (unescaped) — escaping happens at display time, the same convention every other free-text field already uses',
    firstSave.data.emergency_contact === '<script>alert(1)</script>');

  var afterFirstSave = ctx.foundationGetPatientProfile_(patientA.data.patient_id);
  record('Stage10: a re-fetch after the first save returns the just-saved values, not the lazy-created default',
    afterFirstSave.data.phone === '+1 555-123-4567' && afterFirstSave.data.date_of_birth === '1990-05-15');

  // ---- Second save: proves the update branch of the upsert (patches the same row, no duplicate) ----
  var secondSave = ctx.foundationSavePatientProfile_({
    patient_id: patientA.data.patient_id, phone: '+1 555-987-6543', date_of_birth: '1990-05-15',
    preferred_contact_method: 'sms', emergency_contact: 'Jane Doe, +1 555-000-1111'
  });
  record('Stage10: foundationSavePatientProfile_() succeeds on a second save (the update branch)', secondSave.status === 'ok');

  var afterSecondSave = ctx.foundationGetPatientProfile_(patientA.data.patient_id);
  record('Stage10: the second save patched the existing row in place — the phone/contact-method reflect the newest save',
    afterSecondSave.data.phone === '+1 555-987-6543' && afterSecondSave.data.preferred_contact_method === 'sms');

  var patientProfileSheetRows = h.spreadsheet.getSheetByName(ctx.FOUNDATION_PATIENT_PROFILE_SHEET_)._debug().rows;
  record('Stage10: exactly one PatientProfile row exists for patient A after two saves — the update branch patched in place, never inserted a duplicate',
    patientProfileSheetRows.filter(function (row) { return row[0] === patientA.data.patient_id; }).length === 1);

  // ---- FoundationRouter.gs — the two new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var getProfileHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_patient_profile', session_token: sessionA });
  var getProfileBody = JSON.parse(getProfileHttp._text);
  record('Stage10: get_patient_profile (real HTTP dispatch) resolves the caller\'s own profile from a valid session',
    getProfileBody.status === 'ok' && getProfileBody.data.patient_id === patientA.data.patient_id);

  var saveProfileHttp = ctx.handleFoundationRequest_({
    foundation_action: 'save_patient_profile', session_token: sessionA, phone: '+1 555-222-3333'
  });
  var saveProfileBody = JSON.parse(saveProfileHttp._text);
  record('Stage10: save_patient_profile (real HTTP dispatch) updates the caller\'s own session-derived patient_id',
    saveProfileBody.status === 'ok' && saveProfileBody.data.patient_id === patientA.data.patient_id && saveProfileBody.data.phone === '+1 555-222-3333');

  record('Stage10: save_patient_profile derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'save_patient_profile', session_token: sessionA, patient_id: 'someone-elses-id', phone: '+1 555-444-5555'
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.patient_id === patientA.data.patient_id;
    })());

  var unauthedGetProfileHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_patient_profile', session_token: 'not-a-real-session-token' });
  var unauthedGetProfileBody = JSON.parse(unauthedGetProfileHttp._text);
  record('Stage10: get_patient_profile rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedGetProfileBody.status === 'error' && unauthedGetProfileBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedGetProfileBody.data === null);

  var unauthedSaveProfileHttp = ctx.handleFoundationRequest_({ foundation_action: 'save_patient_profile', session_token: 'not-a-real-session-token', phone: '+1 555-000-0000' });
  var unauthedSaveProfileBody = JSON.parse(unauthedSaveProfileHttp._text);
  record('Stage10: save_patient_profile rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never writing a row',
    unauthedSaveProfileBody.status === 'error' && unauthedSaveProfileBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedSaveProfileBody.data === null);

  var invalidInputHttp = ctx.handleFoundationRequest_({ foundation_action: 'save_patient_profile', session_token: sessionA, phone: 'not-a-real-phone!!' });
  var invalidInputBody = JSON.parse(invalidInputHttp._text);
  record('Stage10: save_patient_profile over real HTTP dispatch still rejects an invalid phone with FOUNDATION_INVALID_INPUT',
    invalidInputBody.status === 'error' && invalidInputBody.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- Cross-patient isolation ----
  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var getProfileHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_patient_profile', session_token: sessionB });
  var getProfileBodyB = JSON.parse(getProfileHttpB._text);
  record('Stage10: get_patient_profile over real HTTP dispatch returns patient B\'s own (still-default) profile, never patient A\'s saved values',
    getProfileBodyB.status === 'ok' && getProfileBodyB.data.patient_id === patientB.data.patient_id && getProfileBodyB.data.phone === '');

  var createdAuditRows = auditRowsOf(h, 'patient_profile_created');
  record('Stage10: the first save (direct call) wrote its own patient_profile_created AuditLog row, distinguishable from a later update',
    createdAuditRows.length === 1);
  var updatedAuditRows = auditRowsOf(h, 'patient_profile_updated');
  record('Stage10: every subsequent save (direct and via HTTP dispatch) wrote its own patient_profile_updated AuditLog row',
    updatedAuditRows.length === 3);
})();

// ============================================================
// Stage 11 (PXP-2) — DoctorAssignedCondition.gs -> doctor-assigned-condition.schema.json,
// plus FoundationRouter.gs's one new read-only dispatch case end to end.
// Phase 2B's Pillar 1 — doctor/staff-owned, patient never writes (docs/44
// §6/§22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md).
// ============================================================
(function stage11_doctorAssignedCondition() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage11 Patient A', email: 'stage11-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage11 Patient B', email: 'stage11-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage11: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  // ---- Validation rejections ----
  var missingPatientId = ctx.foundationAssignCondition_({ condition_slug: 'mcas', assigned_by: 'dr-rao' });
  record('Stage11: foundationAssignCondition_() rejects a missing patient_id with FOUNDATION_INVALID_INPUT',
    missingPatientId.status === 'error' && missingPatientId.error.code === 'FOUNDATION_INVALID_INPUT');

  var badConditionSlug = ctx.foundationAssignCondition_({ patient_id: patientA.data.patient_id, condition_slug: 'not-a-real-condition', assigned_by: 'dr-rao' });
  record('Stage11: foundationAssignCondition_() rejects a condition_slug outside the canonical list',
    badConditionSlug.status === 'error' && badConditionSlug.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingAssignedBy = ctx.foundationAssignCondition_({ patient_id: patientA.data.patient_id, condition_slug: 'mcas' });
  record('Stage11: foundationAssignCondition_() rejects a missing assigned_by (doctor/staff identifier) with FOUNDATION_INVALID_INPUT',
    missingAssignedBy.status === 'error' && missingAssignedBy.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- First assignment: proves the create path ----
  var assignmentA1 = ctx.foundationAssignCondition_({ patient_id: patientA.data.patient_id, condition_slug: 'mcas', assigned_by: 'dr-rao' });
  record('Stage11: foundationAssignCondition_() succeeds on valid input', assignmentA1.status === 'ok');
  var assignmentA1Result = validate(doctorAssignedConditionSchema, assignmentA1.data || {});
  record('Stage11: a real foundationAssignCondition_() result conforms to doctor-assigned-condition.schema.json',
    assignmentA1Result.valid === true, assignmentA1Result.errors.join('; '));
  record('Stage11: a new assignment starts active, with empty-string resolved_at/resolved_by sentinels',
    assignmentA1.data.status === 'active' && assignmentA1.data.resolved_at === '' && assignmentA1.data.resolved_by === '');
  record('Stage11: assigned_at is server-set, never accepted from a client-supplied field',
    typeof assignmentA1.data.assigned_at === 'string' && assignmentA1.data.assigned_at.length > 0);

  // ---- Many-per-patient: a second, independent active assignment for the same patient ----
  var assignmentA2 = ctx.foundationAssignCondition_({ patient_id: patientA.data.patient_id, condition_slug: 'chronic-urticaria', assigned_by: 'dr-rao' });
  record('Stage11: a second, independent assignment for the same patient succeeds — many-per-patient, not 1:1',
    assignmentA2.status === 'ok' && assignmentA2.data.assignment_id !== assignmentA1.data.assignment_id);

  // ---- A different patient's own assignment ----
  var assignmentB1 = ctx.foundationAssignCondition_({ patient_id: patientB.data.patient_id, condition_slug: 'eczema', assigned_by: 'dr-shah' });
  record('Stage11: setup — patient B has one independent assignment', assignmentB1.status === 'ok');

  // ---- Resolve: the one-way, exactly-once transition ----
  var unknownResolve = ctx.foundationResolveCondition_({ assignment_id: 'not-a-real-assignment-id', resolved_by: 'dr-rao' });
  record('Stage11: foundationResolveCondition_() rejects an unknown assignment_id with FOUNDATION_INVALID_INPUT',
    unknownResolve.status === 'error' && unknownResolve.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingResolvedBy = ctx.foundationResolveCondition_({ assignment_id: assignmentA1.data.assignment_id });
  record('Stage11: foundationResolveCondition_() rejects a missing resolved_by with FOUNDATION_INVALID_INPUT',
    missingResolvedBy.status === 'error' && missingResolvedBy.error.code === 'FOUNDATION_INVALID_INPUT');

  var resolveA1 = ctx.foundationResolveCondition_({ assignment_id: assignmentA1.data.assignment_id, resolved_by: 'dr-rao' });
  record('Stage11: foundationResolveCondition_() succeeds on a real, active assignment_id', resolveA1.status === 'ok');
  var resolveA1Result = validate(doctorAssignedConditionSchema, resolveA1.data || {});
  record('Stage11: a real foundationResolveCondition_() result conforms to doctor-assigned-condition.schema.json',
    resolveA1Result.valid === true, resolveA1Result.errors.join('; '));
  record('Stage11: a resolved assignment has status=resolved and real, server-set resolved_at/resolved_by',
    resolveA1.data.status === 'resolved' && resolveA1.data.resolved_at.length > 0 && resolveA1.data.resolved_by === 'dr-rao');

  var doubleResolve = ctx.foundationResolveCondition_({ assignment_id: assignmentA1.data.assignment_id, resolved_by: 'dr-rao' });
  record('Stage11: resolving an already-resolved assignment_id is rejected — a one-way, exactly-once transition',
    doubleResolve.status === 'error' && doubleResolve.error.code === 'FOUNDATION_INVALID_INPUT');

  var doctorAssignedConditionSheetRows = h.spreadsheet.getSheetByName(ctx.FOUNDATION_CONDITION_ASSIGNMENTS_SHEET_)._debug().rows;
  record('Stage11: the resolve operation patched the existing row in place — no duplicate row was inserted',
    doctorAssignedConditionSheetRows.filter(function (row) { return row[0] === assignmentA1.data.assignment_id; }).length === 1);

  // ---- foundationGetPatientConditionAssignments_() — many-per-patient, sorted newest first ----
  var patientAAssignments = ctx.foundationGetPatientConditionAssignments_(patientA.data.patient_id);
  record('Stage11: foundationGetPatientConditionAssignments_() succeeds', patientAAssignments.status === 'ok');
  record('Stage11: patient A\'s list contains both of their own assignments (one resolved, one still active), never patient B\'s',
    patientAAssignments.data.length === 2 &&
    patientAAssignments.data.every(function (row) { return row.patient_id === patientA.data.patient_id; }));
  record('Stage11: the list is sorted assigned_at descending (newest first)',
    patientAAssignments.data[0].assignment_id === assignmentA2.data.assignment_id);
  var listedRowResult = validate(doctorAssignedConditionSchema, patientAAssignments.data[0]);
  record('Stage11: a real listed assignment conforms to doctor-assigned-condition.schema.json',
    listedRowResult.valid === true, listedRowResult.errors.join('; '));

  // ---- FoundationRouter.gs — the one new, read-only dispatch case, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var getAssignmentsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_assigned_conditions', session_token: sessionA });
  var getAssignmentsBody = JSON.parse(getAssignmentsHttp._text);
  record('Stage11: get_doctor_assigned_conditions (real HTTP dispatch) resolves the caller\'s own assignments from a valid session',
    getAssignmentsBody.status === 'ok' && getAssignmentsBody.data.length === 2);
  record('Stage11: get_doctor_assigned_conditions derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'get_doctor_assigned_conditions', session_token: sessionA, patient_id: patientB.data.patient_id
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.every(function (row) { return row.patient_id === patientA.data.patient_id; });
    })());

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var getAssignmentsHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_assigned_conditions', session_token: sessionB });
  var getAssignmentsBodyB = JSON.parse(getAssignmentsHttpB._text);
  record('Stage11: get_doctor_assigned_conditions over real HTTP dispatch returns only patient B\'s own assignment, never patient A\'s — cross-patient isolation',
    getAssignmentsBodyB.status === 'ok' && getAssignmentsBodyB.data.length === 1 && getAssignmentsBodyB.data[0].patient_id === patientB.data.patient_id);

  var unauthedGetAssignmentsHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_assigned_conditions', session_token: 'not-a-real-session-token' });
  var unauthedGetAssignmentsBody = JSON.parse(unauthedGetAssignmentsHttp._text);
  record('Stage11: get_doctor_assigned_conditions rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedGetAssignmentsBody.status === 'error' && unauthedGetAssignmentsBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedGetAssignmentsBody.data === null);

  record('Stage11: there is no assign/resolve action reachable over HTTP dispatch — doctor/staff writes stay editor-only',
    (function () {
      var attemptedAssignHttp = ctx.handleFoundationRequest_({
        foundation_action: 'assign_doctor_condition', session_token: sessionA, patient_id: patientA.data.patient_id, condition_slug: 'mcas', assigned_by: 'dr-rao'
      });
      var attemptedAssignBody = JSON.parse(attemptedAssignHttp._text);
      return attemptedAssignBody.status === 'error' && attemptedAssignBody.error.code === 'FOUNDATION_UNKNOWN_ACTION';
    })());

  var assignedAuditRows = auditRowsOf(h, 'condition_assigned');
  record('Stage11: every successful assignment wrote its own condition_assigned AuditLog row',
    assignedAuditRows.length === 3);
  var resolvedAuditRows = auditRowsOf(h, 'condition_resolved');
  record('Stage11: the successful resolution wrote its own condition_resolved AuditLog row',
    resolvedAuditRows.length === 1);
})();

// ============================================================
// Stage 12 (PXP-3) — ModuleRegistry.gs + PatientModuleState.gs ->
// patient-module-state.schema.json, plus FoundationRouter.gs's one new
// read-only dispatch case end to end. Phase 2B's Pillar 2 — doctor/staff-
// owned, patient never writes, fail-closed absence-of-row default (docs/44
// §7/§14/§22, ADR-012 (amended), docs/47-PHASE-2B-IMPLEMENTATION-RULES.md).
// ============================================================
(function stage12_patientModuleState() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage12 Patient A', email: 'stage12-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage12 Patient B', email: 'stage12-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage12: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  // ---- Module Registry — a static, pure config list ----
  // Count/membership updated in Batch PXP-5 (4, was 3), Batch PXP-7 (5, was
  // 4), and Batch PXP-10 (4, was 5 — the registry's first removal,
  // 'symptom_tracker' retired per docs/44 §10.1/§22) — ModuleRegistry.gs's
  // own designed, additive/subtractive growth (docs/47 §4) now that this
  // batch retires a module; this is the one, disclosed update to a
  // PXP-3-authored assertion this stage still makes (see this file's own
  // header comment).
  var registry = ctx.foundationGetModuleRegistry_();
  record('Stage12: foundationGetModuleRegistry_() returns the four seeded modules (timeline, daily_checkin, reports, care_plan) — symptom_tracker retired by Batch PXP-10',
    registry.length === 4 && registry.map(function (m) { return m.module_id; }).sort().join(',') === 'care_plan,daily_checkin,reports,timeline');

  // ---- Fail-closed default: no PatientModuleState row exists yet for either patient ----
  var defaultStatesA = ctx.foundationGetPatientModuleStates_(patientA.data.patient_id);
  record('Stage12: foundationGetPatientModuleStates_() succeeds even with zero persisted rows', defaultStatesA.status === 'ok');
  record('Stage12: every module defaults to enabled=false when no row has ever been written — fail-closed (ADR-010)',
    defaultStatesA.data.length === 4 && defaultStatesA.data.every(function (row) { return row.enabled === false && row.enabled_by === '' && row.enabled_at === ''; }));

  // ---- Validation rejections ----
  var missingPatientId = ctx.foundationSetModuleState_({ module_id: 'timeline', enabled: true, enabled_by: 'dr-rao' });
  record('Stage12: foundationSetModuleState_() rejects a missing patient_id with FOUNDATION_INVALID_INPUT',
    missingPatientId.status === 'error' && missingPatientId.error.code === 'FOUNDATION_INVALID_INPUT');

  var badModuleId = ctx.foundationSetModuleState_({ patient_id: patientA.data.patient_id, module_id: 'not-a-real-module', enabled: true, enabled_by: 'dr-rao' });
  record('Stage12: foundationSetModuleState_() rejects a module_id outside the registered Module Registry',
    badModuleId.status === 'error' && badModuleId.error.code === 'FOUNDATION_INVALID_INPUT');

  var nonBooleanEnabled = ctx.foundationSetModuleState_({ patient_id: patientA.data.patient_id, module_id: 'timeline', enabled: 'yes', enabled_by: 'dr-rao' });
  record('Stage12: foundationSetModuleState_() rejects a non-boolean enabled value',
    nonBooleanEnabled.status === 'error' && nonBooleanEnabled.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingEnabledBy = ctx.foundationSetModuleState_({ patient_id: patientA.data.patient_id, module_id: 'timeline', enabled: true });
  record('Stage12: foundationSetModuleState_() rejects a missing enabled_by (doctor/staff identifier) with FOUNDATION_INVALID_INPUT',
    missingEnabledBy.status === 'error' && missingEnabledBy.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- First enable: proves the create path ----
  var enableA1 = ctx.foundationSetModuleState_({ patient_id: patientA.data.patient_id, module_id: 'timeline', enabled: true, enabled_by: 'dr-rao' });
  record('Stage12: foundationSetModuleState_() succeeds on valid input', enableA1.status === 'ok');
  var enableA1Result = validate(patientModuleStateSchema, enableA1.data || {});
  record('Stage12: a real foundationSetModuleState_() result conforms to patient-module-state.schema.json',
    enableA1Result.valid === true, enableA1Result.errors.join('; '));
  record('Stage12: enabled_at is server-set, never accepted from a client-supplied field',
    typeof enableA1.data.enabled_at === 'string' && enableA1.data.enabled_at.length > 0);
  record('Stage12: state_key is server-derived as patient_id + \'::\' + module_id, never accepted from a client-supplied field',
    enableA1.data.state_key === patientA.data.patient_id + '::timeline');

  // ---- Second write to the same (patient, module) pair: proves the update-in-place path ----
  var disableA1 = ctx.foundationSetModuleState_({ patient_id: patientA.data.patient_id, module_id: 'timeline', enabled: false, enabled_by: 'dr-shah' });
  record('Stage12: a second write to the same patient/module pair succeeds — the update branch', disableA1.status === 'ok');
  record('Stage12: the update patched enabled/enabled_by/enabled_at in place — reflects the newest write',
    disableA1.data.enabled === false && disableA1.data.enabled_by === 'dr-shah');

  var moduleStateSheetRows = h.spreadsheet.getSheetByName(ctx.FOUNDATION_PATIENT_MODULE_STATE_SHEET_)._debug().rows;
  record('Stage12: exactly one PatientModuleState row exists for (patient A, timeline) after two writes — patched in place, never a duplicate',
    moduleStateSheetRows.filter(function (row) { return row[0] === patientA.data.patient_id + '::timeline'; }).length === 1);

  // ---- A second module for the same patient — proves distinct rows per module_id, not a 1:1 collision ----
  var enableA2 = ctx.foundationSetModuleState_({ patient_id: patientA.data.patient_id, module_id: 'reports', enabled: true, enabled_by: 'dr-rao' });
  record('Stage12: enabling a second, different module for the same patient succeeds — one row per (patient_id, module_id), not 1:1 per patient',
    enableA2.status === 'ok' && enableA2.data.state_key !== disableA1.data.state_key);

  // ---- foundationGetPatientModuleStates_() — merges real rows with fail-closed synthesized defaults ----
  var statesA = ctx.foundationGetPatientModuleStates_(patientA.data.patient_id);
  record('Stage12: foundationGetPatientModuleStates_() returns exactly one entry per registered module, real rows merged with synthesized defaults',
    statesA.data.length === 4);
  var timelineStateA = statesA.data.filter(function (row) { return row.module_id === 'timeline'; })[0];
  var reportsStateA = statesA.data.filter(function (row) { return row.module_id === 'reports'; })[0];
  // Batch PXP-10 retired 'symptom_tracker' from the registry — this
  // "never written" fail-closed-default example now uses 'daily_checkin',
  // still registered and still untouched by either write above.
  var dailyCheckinStateA = statesA.data.filter(function (row) { return row.module_id === 'daily_checkin'; })[0];
  record('Stage12: patient A\'s timeline module reflects the real, persisted disabled state (not a synthesized default)',
    timelineStateA.enabled === false && timelineStateA.enabled_by === 'dr-shah');
  record('Stage12: patient A\'s reports module reflects the real, persisted enabled state',
    reportsStateA.enabled === true && reportsStateA.enabled_by === 'dr-rao');
  record('Stage12: patient A\'s daily_checkin module — never written — is still a synthesized, fail-closed default',
    dailyCheckinStateA.enabled === false && dailyCheckinStateA.enabled_by === '' && dailyCheckinStateA.enabled_at === '');
  var listedRowResult = validate(patientModuleStateSchema, timelineStateA);
  record('Stage12: a real, persisted listed row conforms to patient-module-state.schema.json',
    listedRowResult.valid === true, listedRowResult.errors.join('; '));
  var syntheticRowResult = validate(patientModuleStateSchema, dailyCheckinStateA);
  record('Stage12: a synthesized, fail-closed-default row also conforms to patient-module-state.schema.json',
    syntheticRowResult.valid === true, syntheticRowResult.errors.join('; '));

  // ---- Cross-patient isolation: patient B's own states are untouched by patient A's writes ----
  var statesB = ctx.foundationGetPatientModuleStates_(patientB.data.patient_id);
  record('Stage12: patient B\'s module states are all still fail-closed defaults, unaffected by patient A\'s writes',
    statesB.data.length === 4 && statesB.data.every(function (row) { return row.enabled === false && row.enabled_by === ''; }));

  // ---- FoundationRouter.gs — the one new, read-only dispatch case, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var getStatesHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_patient_module_states', session_token: sessionA });
  var getStatesBody = JSON.parse(getStatesHttp._text);
  record('Stage12: get_patient_module_states (real HTTP dispatch) resolves the caller\'s own module states from a valid session',
    getStatesBody.status === 'ok' && getStatesBody.data.length === 4);
  record('Stage12: get_patient_module_states derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'get_patient_module_states', session_token: sessionA, patient_id: patientB.data.patient_id
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.every(function (row) { return row.patient_id === patientA.data.patient_id; });
    })());

  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);
  var getStatesHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_patient_module_states', session_token: sessionB });
  var getStatesBodyB = JSON.parse(getStatesHttpB._text);
  record('Stage12: get_patient_module_states over real HTTP dispatch returns only patient B\'s own (still-default) states, never patient A\'s — cross-patient isolation',
    getStatesBodyB.status === 'ok' && getStatesBodyB.data.every(function (row) { return row.patient_id === patientB.data.patient_id && row.enabled === false; }));

  var unauthedGetStatesHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_patient_module_states', session_token: 'not-a-real-session-token' });
  var unauthedGetStatesBody = JSON.parse(unauthedGetStatesHttp._text);
  record('Stage12: get_patient_module_states rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedGetStatesBody.status === 'error' && unauthedGetStatesBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedGetStatesBody.data === null);

  record('Stage12: there is no enable/disable action reachable over HTTP dispatch — doctor/staff writes stay editor-only',
    (function () {
      var attemptedSetHttp = ctx.handleFoundationRequest_({
        foundation_action: 'set_patient_module_state', session_token: sessionA, patient_id: patientA.data.patient_id, module_id: 'timeline', enabled: true, enabled_by: 'dr-rao'
      });
      var attemptedSetBody = JSON.parse(attemptedSetHttp._text);
      return attemptedSetBody.status === 'error' && attemptedSetBody.error.code === 'FOUNDATION_UNKNOWN_ACTION';
    })());

  var enabledAuditRows = auditRowsOf(h, 'module_state_enabled');
  record('Stage12: every write that resulted in enabled=true wrote its own module_state_enabled AuditLog row',
    enabledAuditRows.length === 2);
  var disabledAuditRows = auditRowsOf(h, 'module_state_disabled');
  record('Stage12: every write that resulted in enabled=false wrote its own module_state_disabled AuditLog row',
    disabledAuditRows.length === 1);
})();

// ============================================================
// Stage 13 (PXP-5) — TemplateRegistry.gs + CheckInTemplateAssignment.gs
// (a disclosed, additive gap-fill entity — see that file's own header
// comment) + CheckInResponse.gs -> check-in-template-assignment.schema.json
// and check-in-response.schema.json, plus FoundationRouter.gs's three new
// dispatch cases end to end. The Daily Check-in Engine — a consumer of
// Pillars 1 and 2, shipped alongside (never replacing) Symptom Tracker
// (docs/44 §10.1, §22).
// ============================================================
(function stage13_checkInEngine() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage13 Patient A', email: 'stage13-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage13 Patient B', email: 'stage13-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage13: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  // ---- Template Registry — a static, pure config list ----
  record('Stage13: foundationGetRegisteredTemplateIds_() returns the allowlist CheckInTemplateAssignment.gs validates against',
    ctx.foundationGetRegisteredTemplateIds_().join(',') === 'daily_wellness_checkin');
  var seededTemplate = ctx.foundationGetTemplateByIdAndVersion_('daily_wellness_checkin', 1);
  record('Stage13: foundationGetTemplateByIdAndVersion_() finds the one seeded template (daily_wellness_checkin v1)',
    seededTemplate !== null && seededTemplate.template_id === 'daily_wellness_checkin' && seededTemplate.version === 1);
  record('Stage13: foundationGetTemplateByIdAndVersion_() returns null for an unknown pair',
    ctx.foundationGetTemplateByIdAndVersion_('not-a-real-template', 1) === null &&
    ctx.foundationGetTemplateByIdAndVersion_('daily_wellness_checkin', 99) === null);
  record('Stage13: foundationGetLatestActiveTemplateVersion_() resolves to the only active version',
    ctx.foundationGetLatestActiveTemplateVersion_('daily_wellness_checkin').version === 1);

  // ---- CheckInTemplateAssignment — validation rejections ----
  var missingPatientId = ctx.foundationAssignCheckInTemplate_({ template_id: 'daily_wellness_checkin', assigned_by: 'dr-rao' });
  record('Stage13: foundationAssignCheckInTemplate_() rejects a missing patient_id with FOUNDATION_INVALID_INPUT',
    missingPatientId.status === 'error' && missingPatientId.error.code === 'FOUNDATION_INVALID_INPUT');

  var badTemplateId = ctx.foundationAssignCheckInTemplate_({ patient_id: patientA.data.patient_id, template_id: 'not-a-real-template', assigned_by: 'dr-rao' });
  record('Stage13: foundationAssignCheckInTemplate_() rejects a template_id outside the Template Registry',
    badTemplateId.status === 'error' && badTemplateId.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingAssignedBy = ctx.foundationAssignCheckInTemplate_({ patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin' });
  record('Stage13: foundationAssignCheckInTemplate_() rejects a missing assigned_by (doctor/staff identifier) with FOUNDATION_INVALID_INPUT',
    missingAssignedBy.status === 'error' && missingAssignedBy.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- CheckInTemplateAssignment — before any assignment exists ----
  var unassignedLookup = ctx.foundationGetActiveTemplateAssignmentForPatient_(patientA.data.patient_id);
  record('Stage13: foundationGetActiveTemplateAssignmentForPatient_() returns null before any assignment exists',
    unassignedLookup.status === 'ok' && unassignedLookup.data === null);
  var unassignedTemplate = ctx.foundationGetCurrentCheckInTemplateForPatient_(patientA.data.patient_id);
  record('Stage13: foundationGetCurrentCheckInTemplateForPatient_() returns data:null (not an error) for an unassigned patient',
    unassignedTemplate.status === 'ok' && unassignedTemplate.data === null);

  // ---- CheckInTemplateAssignment — first assignment: proves the create path ----
  var assignmentA1 = ctx.foundationAssignCheckInTemplate_({ patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', assigned_by: 'dr-rao' });
  record('Stage13: foundationAssignCheckInTemplate_() succeeds on valid input', assignmentA1.status === 'ok');
  var assignmentA1Result = validate(checkInTemplateAssignmentSchema, assignmentA1.data || {});
  record('Stage13: a real foundationAssignCheckInTemplate_() result conforms to check-in-template-assignment.schema.json',
    assignmentA1Result.valid === true, assignmentA1Result.errors.join('; '));
  record('Stage13: a new assignment starts active, with empty-string resolved_at/resolved_by sentinels',
    assignmentA1.data.status === 'active' && assignmentA1.data.resolved_at === '' && assignmentA1.data.resolved_by === '');

  var assignmentB1 = ctx.foundationAssignCheckInTemplate_({ patient_id: patientB.data.patient_id, template_id: 'daily_wellness_checkin', assigned_by: 'dr-shah' });
  record('Stage13: setup — patient B has their own independent assignment', assignmentB1.status === 'ok');

  var currentTemplateA = ctx.foundationGetCurrentCheckInTemplateForPatient_(patientA.data.patient_id);
  record('Stage13: foundationGetCurrentCheckInTemplateForPatient_() resolves an active assignment to its latest active Template Registry version',
    currentTemplateA.status === 'ok' && currentTemplateA.data.template_id === 'daily_wellness_checkin' && currentTemplateA.data.version === 1 &&
    Array.isArray(currentTemplateA.data.questions) && currentTemplateA.data.questions.length === 4);

  // ---- CheckInTemplateAssignment — resolve: the one-way, exactly-once transition ----
  var unknownResolve = ctx.foundationResolveCheckInTemplateAssignment_({ assignment_id: 'not-a-real-assignment-id', resolved_by: 'dr-rao' });
  record('Stage13: foundationResolveCheckInTemplateAssignment_() rejects an unknown assignment_id with FOUNDATION_INVALID_INPUT',
    unknownResolve.status === 'error' && unknownResolve.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingResolvedBy = ctx.foundationResolveCheckInTemplateAssignment_({ assignment_id: assignmentA1.data.assignment_id });
  record('Stage13: foundationResolveCheckInTemplateAssignment_() rejects a missing resolved_by with FOUNDATION_INVALID_INPUT',
    missingResolvedBy.status === 'error' && missingResolvedBy.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- CheckInResponse — write path enforcement, before any submission ----
  var missingRespPatientId = ctx.foundationCreateCheckInResponse_({ template_id: 'daily_wellness_checkin', template_version: 1, answers: {} });
  record('Stage13: foundationCreateCheckInResponse_() rejects a missing patient_id with FOUNDATION_INVALID_INPUT',
    missingRespPatientId.status === 'error' && missingRespPatientId.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingAnswers = ctx.foundationCreateCheckInResponse_({ patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1 });
  record('Stage13: foundationCreateCheckInResponse_() rejects missing answers with FOUNDATION_INVALID_INPUT',
    missingAnswers.status === 'error' && missingAnswers.error.code === 'FOUNDATION_INVALID_INPUT');

  var badVersionType = ctx.foundationCreateCheckInResponse_({ patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 'one', answers: {} });
  record('Stage13: foundationCreateCheckInResponse_() rejects a non-integer template_version with FOUNDATION_INVALID_INPUT',
    badVersionType.status === 'error' && badVersionType.error.code === 'FOUNDATION_INVALID_INPUT');

  var unknownTemplateVersion = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 99,
    answers: { overall_feeling: 5, symptom_severity: 5, took_medication: true }
  });
  record('Stage13: foundationCreateCheckInResponse_() rejects a template_version that does not exist in the registry',
    unknownTemplateVersion.status === 'error' && unknownTemplateVersion.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The core docs/44 §10.2 enforcement: assignment, not mere registry existence ----
  // patientB already holds a real, active assignment (assignmentB1 above) — resolve it first so the next check exercises a genuinely unassigned patient without disturbing patientB's own later checks.
  var resolveB1ForThisCheck = ctx.foundationResolveCheckInTemplateAssignment_({ assignment_id: assignmentB1.data.assignment_id, resolved_by: 'dr-shah' });
  record('Stage13: setup — patient B\'s assignment is resolved so the next check exercises a genuinely unassigned patient', resolveB1ForThisCheck.status === 'ok');
  var notAssignedRejected = ctx.foundationCreateCheckInResponse_({
    patient_id: patientB.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 5, symptom_severity: 5, took_medication: true }
  });
  record('Stage13: foundationCreateCheckInResponse_() rejects a submission when the caller has no active assignment for that template_id — docs/44 §10.2\'s enforcement boundary, not merely "does the template exist"',
    notAssignedRejected.status === 'error' && notAssignedRejected.error.code === 'FOUNDATION_INVALID_INPUT');
  var reassignB1 = ctx.foundationAssignCheckInTemplate_({ patient_id: patientB.data.patient_id, template_id: 'daily_wellness_checkin', assigned_by: 'dr-shah' });
  record('Stage13: setup — patient B is re-assigned for their own later checks', reassignB1.status === 'ok');

  // ---- CheckInResponse — answers validation against the template's own question list ----
  var unrecognizedField = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 5, symptom_severity: 5, took_medication: true, not_a_real_field: 'x' }
  });
  record('Stage13: foundationCreateCheckInResponse_() rejects an answers field_key not in the template\'s own question list',
    unrecognizedField.status === 'error' && unrecognizedField.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingRequiredField = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 5 } // symptom_severity and took_medication are also required
  });
  record('Stage13: foundationCreateCheckInResponse_() rejects answers missing a required field',
    missingRequiredField.status === 'error' && missingRequiredField.error.code === 'FOUNDATION_INVALID_INPUT');

  var wrongType = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 5, symptom_severity: 5, took_medication: 'yes' } // took_medication must be boolean
  });
  record('Stage13: foundationCreateCheckInResponse_() rejects a value of the wrong declared type',
    wrongType.status === 'error' && wrongType.error.code === 'FOUNDATION_INVALID_INPUT');

  var outOfRange = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 55, symptom_severity: 5, took_medication: true } // overall_feeling max is 10
  });
  record('Stage13: foundationCreateCheckInResponse_() rejects a number value above the question\'s declared max',
    outOfRange.status === 'error' && outOfRange.error.code === 'FOUNDATION_INVALID_INPUT');

  var nestedValue = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 5, symptom_severity: 5, took_medication: true, notes: { nope: 'not flat' } }
  });
  record('Stage13: foundationCreateCheckInResponse_() rejects a nested-object answer value — docs/44 §11.4\'s flat-object-only rule',
    nestedValue.status === 'error' && nestedValue.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- CheckInResponse — the real, valid create path ----
  var responseA1 = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { notes: '  feeling okay  ', overall_feeling: 7, took_medication: true, symptom_severity: 2 } // deliberately out of question-list order
  });
  record('Stage13: foundationCreateCheckInResponse_() succeeds on valid input', responseA1.status === 'ok');
  var responseA1Result = validate(checkInResponseSchema, responseA1.data || {});
  record('Stage13: a real foundationCreateCheckInResponse_() result conforms to check-in-response.schema.json',
    responseA1Result.valid === true, responseA1Result.errors.join('; '));
  record('Stage13: logged_at is server-set, never accepted from a client-supplied field',
    typeof responseA1.data.logged_at === 'string' && responseA1.data.logged_at.length > 0);
  record('Stage13: answers is returned as a real, parsed object (never the raw stored JSON string) — the contract boundary',
    typeof responseA1.data.answers === 'object' && responseA1.data.answers.overall_feeling === 7 && responseA1.data.answers.took_medication === true);
  record('Stage13: a string answer value is trimmed',
    responseA1.data.answers.notes === 'feeling okay');
  record('Stage13: answers keys are serialized in the template\'s own question-list order, not input order — deterministic serialization (docs/44 §11.4)',
    Object.keys(JSON.parse(h.spreadsheet.getSheetByName(ctx.FOUNDATION_CHECKIN_RESPONSES_SHEET_)._debug().rows[0][5])).join(',') === 'overall_feeling,symptom_severity,took_medication,notes');

  var responseA2 = ctx.foundationCreateCheckInResponse_({
    patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 6, symptom_severity: 4, took_medication: false } // notes omitted — optional field
  });
  record('Stage13: an optional field (notes) may be omitted entirely', responseA2.status === 'ok' && responseA2.data.answers.notes === undefined);

  var responseB1 = ctx.foundationCreateCheckInResponse_({
    patient_id: patientB.data.patient_id, template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 3, symptom_severity: 8, took_medication: true }
  });
  record('Stage13: setup — patient B has their own independent response', responseB1.status === 'ok');

  // ---- foundationGetPatientCheckInResponses_() — sorted newest-first, cross-patient isolated ----
  var listA = ctx.foundationGetPatientCheckInResponses_(patientA.data.patient_id);
  record('Stage13: foundationGetPatientCheckInResponses_() succeeds', listA.status === 'ok');
  record('Stage13: patient A\'s list contains both of their own responses, never patient B\'s',
    listA.data.length === 2 && listA.data.every(function (row) { return row.patient_id === patientA.data.patient_id; }));
  record('Stage13: the list is sorted logged_at descending (newest-or-tied first) — responseA1/responseA2 were created back to back and may share a millisecond, an acceptable, undefined-tiebreak-order edge case FoundationSymptomLog.gs\'s own header comment already discloses for the identical single-timestamp-sort-key scheme',
    listA.data[0].logged_at >= listA.data[1].logged_at);
  var listedResult = validate(checkInResponseSchema, listA.data[0]);
  record('Stage13: a real listed response conforms to check-in-response.schema.json',
    listedResult.valid === true, listedResult.errors.join('; '));

  var listB = ctx.foundationGetPatientCheckInResponses_(patientB.data.patient_id);
  record('Stage13: patient B\'s list contains only their own response, never patient A\'s',
    listB.data.length === 1 && listB.data[0].patient_id === patientB.data.patient_id);

  // ---- FoundationRouter.gs — the three new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);

  var getTemplateHttp = ctx.handleFoundationRequest_({ foundation_action: 'get_checkin_template', session_token: sessionA });
  var getTemplateBody = JSON.parse(getTemplateHttp._text);
  record('Stage13: get_checkin_template (real HTTP dispatch) resolves the caller\'s own current template from a valid session',
    getTemplateBody.status === 'ok' && getTemplateBody.data.template_id === 'daily_wellness_checkin');
  record('Stage13: get_checkin_template derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({ foundation_action: 'get_checkin_template', session_token: sessionA, patient_id: 'not-my-own-id' });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.template_id === 'daily_wellness_checkin';
    })());

  var submitHttp = ctx.handleFoundationRequest_({
    foundation_action: 'submit_checkin_response', session_token: sessionA,
    template_id: 'daily_wellness_checkin', template_version: 1,
    answers: { overall_feeling: 8, symptom_severity: 1, took_medication: true }
  });
  var submitBody = JSON.parse(submitHttp._text);
  record('Stage13: submit_checkin_response (real HTTP dispatch) creates a response for the session-derived patient',
    submitBody.status === 'ok' && submitBody.data.patient_id === patientA.data.patient_id);
  record('Stage13: submit_checkin_response derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'submit_checkin_response', session_token: sessionA, patient_id: patientB.data.patient_id,
        template_id: 'daily_wellness_checkin', template_version: 1,
        answers: { overall_feeling: 5, symptom_severity: 5, took_medication: true }
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.patient_id === patientA.data.patient_id;
    })());

  var getResponsesHttpA = ctx.handleFoundationRequest_({ foundation_action: 'get_checkin_responses', session_token: sessionA });
  var getResponsesBodyA = JSON.parse(getResponsesHttpA._text);
  record('Stage13: get_checkin_responses over real HTTP dispatch returns only patient A\'s own responses',
    getResponsesBodyA.status === 'ok' && getResponsesBodyA.data.length === 4 && getResponsesBodyA.data.every(function (row) { return row.patient_id === patientA.data.patient_id; }));

  var getResponsesHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_checkin_responses', session_token: sessionB });
  var getResponsesBodyB = JSON.parse(getResponsesHttpB._text);
  record('Stage13: get_checkin_responses over real HTTP dispatch returns only patient B\'s own responses, never patient A\'s — cross-patient isolation',
    getResponsesBodyB.status === 'ok' && getResponsesBodyB.data.length === 1 && getResponsesBodyB.data[0].patient_id === patientB.data.patient_id);

  ['get_checkin_template', 'submit_checkin_response', 'get_checkin_responses'].forEach(function (action) {
    var unauthedHttp = ctx.handleFoundationRequest_({ foundation_action: action, session_token: 'not-a-real-session-token' });
    var unauthedBody = JSON.parse(unauthedHttp._text);
    record('Stage13: ' + action + ' rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
      unauthedBody.status === 'error' && unauthedBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedBody.data === null);
  });

  record('Stage13: there is no assign/resolve-template-assignment action reachable over HTTP dispatch — doctor/staff writes stay editor-only',
    (function () {
      var attempted = ctx.handleFoundationRequest_({
        foundation_action: 'assign_checkin_template', session_token: sessionA, patient_id: patientA.data.patient_id, template_id: 'daily_wellness_checkin', assigned_by: 'dr-rao'
      });
      var attemptedBody = JSON.parse(attempted._text);
      return attemptedBody.status === 'error' && attemptedBody.error.code === 'FOUNDATION_UNKNOWN_ACTION';
    })());

  var assignedAuditRows = auditRowsOf(h, 'checkin_template_assigned');
  record('Stage13: every successful template assignment wrote its own checkin_template_assigned AuditLog row',
    assignedAuditRows.length === 3);
  var resolvedAuditRows = auditRowsOf(h, 'checkin_template_assignment_resolved');
  record('Stage13: every successful resolution wrote its own checkin_template_assignment_resolved AuditLog row',
    resolvedAuditRows.length === 1);
  var createdResponseAuditRows = auditRowsOf(h, 'checkin_response_created');
  record('Stage13: every successful response creation wrote its own checkin_response_created AuditLog row',
    createdResponseAuditRows.length === 5);
})();

// ============================================================
// Stage 14 (PXP-6) — CalculatorRegistry.gs + CalculatorResult.gs ->
// calculator-result.schema.json, plus FoundationRouter.gs's two new
// dispatch cases end to end. Phase 2B's Pillar 3, mirroring the
// deterministic-JSON-storage discipline Stage 13 already proved for
// CheckInResponse.gs.
// ============================================================
(function stage14_calculatorRegistry() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage14 Patient A', email: 'stage14-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage14 Patient B', email: 'stage14-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage14: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  // ---- Calculator Registry — ships empty in production (disclosed scope decision) ----
  record('Stage14: shared/constants/calculator-registry.json ships with zero registered calculators — a deliberate, disclosed scope decision (calculator-registry.md)',
    ctx.FOUNDATION_CALCULATOR_REGISTRY_.length === 0);
  record('Stage14: foundationGetCalculatorBySlugAndVersion_() returns null for any slug/version — nothing is registered yet',
    ctx.foundationGetCalculatorBySlugAndVersion_('anything', 1) === null);

  // ---- foundationCreateCalculatorResult_() — request-shape rejections ----
  var missingPatientId = ctx.foundationCreateCalculatorResult_({ calculator_slug: 'x', definition_version: 1, input_snapshot: {}, result_value: 1 });
  record('Stage14: foundationCreateCalculatorResult_() rejects a missing patient_id with FOUNDATION_INVALID_INPUT',
    missingPatientId.status === 'error' && missingPatientId.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingSlug = ctx.foundationCreateCalculatorResult_({ patient_id: patientA.data.patient_id, definition_version: 1, input_snapshot: {}, result_value: 1 });
  record('Stage14: foundationCreateCalculatorResult_() rejects a missing calculator_slug with FOUNDATION_INVALID_INPUT',
    missingSlug.status === 'error' && missingSlug.error.code === 'FOUNDATION_INVALID_INPUT');

  var badVersionType = ctx.foundationCreateCalculatorResult_({ patient_id: patientA.data.patient_id, calculator_slug: 'x', definition_version: 'one', input_snapshot: {}, result_value: 1 });
  record('Stage14: foundationCreateCalculatorResult_() rejects a non-integer definition_version with FOUNDATION_INVALID_INPUT',
    badVersionType.status === 'error' && badVersionType.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingInputSnapshot = ctx.foundationCreateCalculatorResult_({ patient_id: patientA.data.patient_id, calculator_slug: 'x', definition_version: 1, result_value: 1 });
  record('Stage14: foundationCreateCalculatorResult_() rejects a missing input_snapshot with FOUNDATION_INVALID_INPUT',
    missingInputSnapshot.status === 'error' && missingInputSnapshot.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingResultValue = ctx.foundationCreateCalculatorResult_({ patient_id: patientA.data.patient_id, calculator_slug: 'x', definition_version: 1, input_snapshot: {} });
  record('Stage14: foundationCreateCalculatorResult_() rejects a missing result_value with FOUNDATION_INVALID_INPUT',
    missingResultValue.status === 'error' && missingResultValue.error.code === 'FOUNDATION_INVALID_INPUT');

  var objectResultValue = ctx.foundationCreateCalculatorResult_({ patient_id: patientA.data.patient_id, calculator_slug: 'x', definition_version: 1, input_snapshot: {}, result_value: { nope: true } });
  record('Stage14: foundationCreateCalculatorResult_() rejects a non-scalar result_value with FOUNDATION_INVALID_INPUT',
    objectResultValue.status === 'error' && objectResultValue.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The real, empty-registry fail-closed outcome ----
  var noRegistryEntry = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: 'not_a_real_calculator', definition_version: 1, input_snapshot: {}, result_value: 5
  });
  record('Stage14: foundationCreateCalculatorResult_() rejects any submission today — the registry ships empty, docs/44 §11.4\'s fail-closed-by-absence discipline',
    noRegistryEntry.status === 'error' && noRegistryEntry.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- Prove the generic mechanism end to end via a synthetic, test-only
  // fixture entry, pushed directly into the loaded sandbox's own registry
  // array — never committed to shared/constants/calculator-registry.json
  // (see this file's own Stage 14 header note). Removed again at the end
  // of this stage. ----
  var TEST_ONLY_FIXTURE_SLUG = 'stage14_test_only_fixture_calculator';
  ctx.FOUNDATION_CALCULATOR_REGISTRY_.push({
    calculator_slug: TEST_ONLY_FIXTURE_SLUG,
    version: 1,
    title: 'Stage14 Test-Only Fixture Calculator (never shipped)',
    description: 'A synthetic, conformance-test-only fixture proving the generic registry/result mechanism — not a real, product-registered calculator.',
    input_fields: [
      { field_key: 'value_a', label: 'Value A', type: 'number', min: 0, max: 100, required: true },
      { field_key: 'value_b', label: 'Value B', type: 'number', min: 0, max: 100, required: true },
      { field_key: 'note', label: 'Note (optional)', type: 'string', required: false }
    ],
    formula_reference: 'stage14-test-fixture-v1',
    relevant_condition_slugs: [],
    status: 'active',
    future_ai_capable: false,
    created_by: 'conformance-harness',
    created_at: '2026-07-13T00:00:00.000Z'
  });

  record('Stage14: foundationGetCalculatorBySlugAndVersion_() finds the test-only fixture once pushed',
    ctx.foundationGetCalculatorBySlugAndVersion_(TEST_ONLY_FIXTURE_SLUG, 1) !== null);

  // ---- input_snapshot validation against the fixture's own input_fields ----
  var unrecognizedField = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 1, value_b: 2, not_a_real_field: 'x' }, result_value: 3
  });
  record('Stage14: foundationCreateCalculatorResult_() rejects an input_snapshot field_key not in the calculator\'s own input_fields list',
    unrecognizedField.status === 'error' && unrecognizedField.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingRequiredField = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 1 }, result_value: 3 // value_b is also required
  });
  record('Stage14: foundationCreateCalculatorResult_() rejects input_snapshot missing a required field',
    missingRequiredField.status === 'error' && missingRequiredField.error.code === 'FOUNDATION_INVALID_INPUT');

  var wrongType = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 'not-a-number', value_b: 2 }, result_value: 3
  });
  record('Stage14: foundationCreateCalculatorResult_() rejects a value of the wrong declared type',
    wrongType.status === 'error' && wrongType.error.code === 'FOUNDATION_INVALID_INPUT');

  var outOfRange = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 999, value_b: 2 }, result_value: 3 // value_a max is 100
  });
  record('Stage14: foundationCreateCalculatorResult_() rejects a number value above the field\'s declared max',
    outOfRange.status === 'error' && outOfRange.error.code === 'FOUNDATION_INVALID_INPUT');

  var nestedValue = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 1, value_b: 2, note: { nope: 'not flat' } }, result_value: 3
  });
  record('Stage14: foundationCreateCalculatorResult_() rejects a nested-object input value — docs/44 §11.4\'s flat-object-only rule',
    nestedValue.status === 'error' && nestedValue.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The real, valid create path ----
  var resultA1 = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { note: '  looks fine  ', value_b: 7, value_a: 3 }, // deliberately out of input_fields order
    result_value: 10
  });
  record('Stage14: foundationCreateCalculatorResult_() succeeds on valid input', resultA1.status === 'ok');
  var resultA1Validation = validate(calculatorResultSchema, resultA1.data || {});
  record('Stage14: a real foundationCreateCalculatorResult_() result conforms to calculator-result.schema.json',
    resultA1Validation.valid === true, resultA1Validation.errors.join('; '));
  record('Stage14: computed_at is server-set, never accepted from a client-supplied field',
    typeof resultA1.data.computed_at === 'string' && resultA1.data.computed_at.length > 0);
  record('Stage14: input_snapshot is returned as a real, parsed object (never the raw stored JSON string) — the contract boundary',
    typeof resultA1.data.input_snapshot === 'object' && resultA1.data.input_snapshot.value_a === 3 && resultA1.data.input_snapshot.value_b === 7);
  record('Stage14: a string input value is trimmed',
    resultA1.data.input_snapshot.note === 'looks fine');
  record('Stage14: result_value round-trips exactly as supplied (never computed by this generic layer, ADR-013)',
    resultA1.data.result_value === 10);
  record('Stage14: input_snapshot keys are serialized in the calculator\'s own input_fields-list order, not input order — deterministic serialization (docs/44 §11.4)',
    Object.keys(JSON.parse(h.spreadsheet.getSheetByName(ctx.FOUNDATION_CALCULATOR_RESULTS_SHEET_)._debug().rows[0][4])).join(',') === 'value_a,value_b,note');

  var resultA2 = ctx.foundationCreateCalculatorResult_({
    patient_id: patientA.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 5, value_b: 6 }, result_value: 'moderate' // note omitted (optional); a categorical, non-numeric result_value
  });
  record('Stage14: an optional field (note) may be omitted entirely', resultA2.status === 'ok' && resultA2.data.input_snapshot.note === undefined);
  record('Stage14: result_value may be a non-numeric string (a categorical result), not narrowed to number alone',
    resultA2.status === 'ok' && resultA2.data.result_value === 'moderate');

  var resultB1 = ctx.foundationCreateCalculatorResult_({
    patient_id: patientB.data.patient_id, calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 1, value_b: 1 }, result_value: 2
  });
  record('Stage14: setup — patient B has their own independent result', resultB1.status === 'ok');

  // ---- foundationGetPatientCalculatorResults_() — sorted newest-first, cross-patient isolated ----
  var listA = ctx.foundationGetPatientCalculatorResults_(patientA.data.patient_id);
  record('Stage14: foundationGetPatientCalculatorResults_() succeeds', listA.status === 'ok');
  record('Stage14: patient A\'s list contains both of their own results, never patient B\'s',
    listA.data.length === 2 && listA.data.every(function (row) { return row.patient_id === patientA.data.patient_id; }));
  var listedResult = validate(calculatorResultSchema, listA.data[0]);
  record('Stage14: a real listed result conforms to calculator-result.schema.json',
    listedResult.valid === true, listedResult.errors.join('; '));

  var listB = ctx.foundationGetPatientCalculatorResults_(patientB.data.patient_id);
  record('Stage14: patient B\'s list contains only their own result, never patient A\'s',
    listB.data.length === 1 && listB.data[0].patient_id === patientB.data.patient_id);

  // ---- FoundationRouter.gs — the two new dispatch cases, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);

  var submitHttp = ctx.handleFoundationRequest_({
    foundation_action: 'submit_calculator_result', session_token: sessionA,
    calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
    input_snapshot: { value_a: 8, value_b: 9 }, result_value: 17
  });
  var submitBody = JSON.parse(submitHttp._text);
  record('Stage14: submit_calculator_result (real HTTP dispatch) creates a result for the session-derived patient',
    submitBody.status === 'ok' && submitBody.data.patient_id === patientA.data.patient_id);
  record('Stage14: submit_calculator_result derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({
        foundation_action: 'submit_calculator_result', session_token: sessionA, patient_id: patientB.data.patient_id,
        calculator_slug: TEST_ONLY_FIXTURE_SLUG, definition_version: 1,
        input_snapshot: { value_a: 4, value_b: 4 }, result_value: 8
      });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.patient_id === patientA.data.patient_id;
    })());

  var getResultsHttpA = ctx.handleFoundationRequest_({ foundation_action: 'get_calculator_results', session_token: sessionA });
  var getResultsBodyA = JSON.parse(getResultsHttpA._text);
  record('Stage14: get_calculator_results over real HTTP dispatch returns only patient A\'s own results',
    getResultsBodyA.status === 'ok' && getResultsBodyA.data.length === 4 && getResultsBodyA.data.every(function (row) { return row.patient_id === patientA.data.patient_id; }));

  var getResultsHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_calculator_results', session_token: sessionB });
  var getResultsBodyB = JSON.parse(getResultsHttpB._text);
  record('Stage14: get_calculator_results over real HTTP dispatch returns only patient B\'s own results, never patient A\'s — cross-patient isolation',
    getResultsBodyB.status === 'ok' && getResultsBodyB.data.length === 1 && getResultsBodyB.data[0].patient_id === patientB.data.patient_id);

  ['submit_calculator_result', 'get_calculator_results'].forEach(function (action) {
    var unauthedHttp = ctx.handleFoundationRequest_({ foundation_action: action, session_token: 'not-a-real-session-token' });
    var unauthedBody = JSON.parse(unauthedHttp._text);
    record('Stage14: ' + action + ' rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
      unauthedBody.status === 'error' && unauthedBody.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedBody.data === null);
  });

  var createdResultAuditRows = auditRowsOf(h, 'calculator_result_created');
  record('Stage14: every successful result creation wrote its own calculator_result_created AuditLog row',
    createdResultAuditRows.length === 5);

  // ---- Remove the synthetic, test-only fixture again — never left behind
  // as if it were a shipped registry entry. ----
  var fixtureIndex = ctx.FOUNDATION_CALCULATOR_REGISTRY_.indexOf(ctx.foundationGetCalculatorBySlugAndVersion_(TEST_ONLY_FIXTURE_SLUG, 1));
  if (fixtureIndex !== -1) {
    ctx.FOUNDATION_CALCULATOR_REGISTRY_.splice(fixtureIndex, 1);
  }
  record('Stage14: the synthetic test-only fixture is removed again — the registry ends this stage exactly as empty as it started',
    ctx.FOUNDATION_CALCULATOR_REGISTRY_.length === 0);
})();

// ============================================================
// Stage 15 (PXP-7) — CarePlan.gs + DoctorInstruction.gs ->
// care-plan.schema.json / doctor-instruction.schema.json, plus
// FoundationRouter.gs's two new dispatch cases end to end. Personal Care
// Plan — a consumer of Pillars 1 and 2.
// ============================================================
(function stage15_carePlan() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage15 Patient A', email: 'stage15-a@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage15 Patient B', email: 'stage15-b@example.com',
    condition_slug: 'mcas', created_by: 'conformance-harness'
  });
  record('Stage15: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');

  // ---- No Care Plan authored yet — a real, expected outcome, not an error ----
  var noPlanA = ctx.foundationGetCurrentCarePlanForPatient_(patientA.data.patient_id);
  record('Stage15: foundationGetCurrentCarePlanForPatient_() succeeds with no plan authored yet',
    noPlanA.status === 'ok' && noPlanA.data === null);

  // ---- foundationSaveCarePlan_() — request-shape rejections ----
  var missingPatientId = ctx.foundationSaveCarePlan_({ goals: 'Reduce flare frequency.', created_by: 'dr-rao' });
  record('Stage15: foundationSaveCarePlan_() rejects a missing patient_id with FOUNDATION_INVALID_INPUT',
    missingPatientId.status === 'error' && missingPatientId.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingGoals = ctx.foundationSaveCarePlan_({ patient_id: patientA.data.patient_id, created_by: 'dr-rao' });
  record('Stage15: foundationSaveCarePlan_() rejects a missing goals with FOUNDATION_INVALID_INPUT',
    missingGoals.status === 'error' && missingGoals.error.code === 'FOUNDATION_INVALID_INPUT');

  var missingCreatedBy = ctx.foundationSaveCarePlan_({ patient_id: patientA.data.patient_id, goals: 'Reduce flare frequency.' });
  record('Stage15: foundationSaveCarePlan_() rejects a missing created_by with FOUNDATION_INVALID_INPUT',
    missingCreatedBy.status === 'error' && missingCreatedBy.error.code === 'FOUNDATION_INVALID_INPUT');

  var badReviewDate = ctx.foundationSaveCarePlan_({
    patient_id: patientA.data.patient_id, goals: 'Reduce flare frequency.', next_review_date: 'not-a-date', created_by: 'dr-rao'
  });
  record('Stage15: foundationSaveCarePlan_() rejects a next_review_date that is not a real calendar date',
    badReviewDate.status === 'error' && badReviewDate.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The real, valid first-version create path ----
  var plan1 = ctx.foundationSaveCarePlan_({
    patient_id: patientA.data.patient_id, goals: 'Reduce flare frequency. Follow elimination diet.',
    next_review_date: '2026-09-01', created_by: 'dr-rao'
  });
  record('Stage15: foundationSaveCarePlan_() succeeds on a first, valid save', plan1.status === 'ok');
  record('Stage15: a real foundationSaveCarePlan_() result conforms to care-plan.schema.json',
    (function () { var r = validate(carePlanSchema, plan1.data); return r.valid; })(),
    (function () { var r = validate(carePlanSchema, plan1.data); return r.errors.join('; '); })());
  record('Stage15: the first version starts at version=1, status=active',
    plan1.data.version === 1 && plan1.data.status === 'active');
  record('Stage15: created_at is server-set, never accepted from a client-supplied field',
    typeof plan1.data.created_at === 'string' && plan1.data.created_at !== '');
  record('Stage15: version_key is server-derived from care_plan_id + version, never patient/doctor-supplied',
    plan1.data.version_key === plan1.data.care_plan_id + '::1');

  var currentAfterFirstSave = ctx.foundationGetCurrentCarePlanForPatient_(patientA.data.patient_id);
  record('Stage15: foundationGetCurrentCarePlanForPatient_() now returns the just-saved version 1',
    currentAfterFirstSave.status === 'ok' && currentAfterFirstSave.data.care_plan_id === plan1.data.care_plan_id && currentAfterFirstSave.data.version === 1);

  // ---- A second version — same care_plan_id, version incremented, prior row superseded ----
  var plan2 = ctx.foundationSaveCarePlan_({
    patient_id: patientA.data.patient_id, goals: 'Diet stabilized. Begin taper of antihistamines.',
    next_review_date: '2026-11-01', created_by: 'dr-shah'
  });
  record('Stage15: foundationSaveCarePlan_() succeeds on a second save (the versioning branch)', plan2.status === 'ok');
  record('Stage15: the second version reuses the same care_plan_id, with version incremented by 1',
    plan2.data.care_plan_id === plan1.data.care_plan_id && plan2.data.version === 2 && plan2.data.status === 'active');

  var carePlanSheetRows = h.spreadsheet.getSheetByName(ctx.FOUNDATION_CARE_PLANS_SHEET_)._debug().rows;
  var patientAPlanRows = carePlanSheetRows.filter(function (row) { return row[2] === patientA.data.patient_id; });
  record('Stage15: exactly two CarePlan rows exist for patient A after two saves — an append, never an in-place content edit',
    patientAPlanRows.length === 2);
  // Row layout: [version_key, care_plan_id, patient_id, version, status, ...]
  var priorVersionRow = patientAPlanRows.filter(function (row) { return row[0] === plan1.data.version_key; })[0];
  record('Stage15: creating a new version flipped the prior version\'s own row to status=superseded, and only that row',
    priorVersionRow && priorVersionRow[4] === 'superseded');

  var currentAfterSecondSave = ctx.foundationGetCurrentCarePlanForPatient_(patientA.data.patient_id);
  record('Stage15: foundationGetCurrentCarePlanForPatient_() now returns version 2, never the superseded version 1',
    currentAfterSecondSave.status === 'ok' && currentAfterSecondSave.data.version === 2);

  // ---- Cross-patient isolation: patient B has no plan yet, unaffected by patient A's saves ----
  var noPlanB = ctx.foundationGetCurrentCarePlanForPatient_(patientB.data.patient_id);
  record('Stage15: patient B still has no Care Plan — completely unaffected by patient A\'s saves',
    noPlanB.status === 'ok' && noPlanB.data === null);

  // ---- FoundationRouter.gs — get_care_plan, end to end ----
  var sessionA = ctx.foundationIssueSessionToken_(patientA.data.patient_id);
  var sessionB = ctx.foundationIssueSessionToken_(patientB.data.patient_id);

  var getCarePlanHttpA = ctx.handleFoundationRequest_({ foundation_action: 'get_care_plan', session_token: sessionA });
  var getCarePlanBodyA = JSON.parse(getCarePlanHttpA._text);
  record('Stage15: get_care_plan (real HTTP dispatch) resolves the caller\'s own current plan from a valid session',
    getCarePlanBodyA.status === 'ok' && getCarePlanBodyA.data.version === 2);
  record('Stage15: get_care_plan derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({ foundation_action: 'get_care_plan', session_token: sessionA, patient_id: patientB.data.patient_id });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.care_plan_id === plan1.data.care_plan_id;
    })());

  var getCarePlanHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_care_plan', session_token: sessionB });
  var getCarePlanBodyB = JSON.parse(getCarePlanHttpB._text);
  record('Stage15: get_care_plan over real HTTP dispatch returns data:null for a patient with no plan yet — not an error',
    getCarePlanBodyB.status === 'ok' && getCarePlanBodyB.data === null);

  var unauthedCarePlan = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_care_plan', session_token: 'not-a-real-session-token' })._text);
  record('Stage15: get_care_plan rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedCarePlan.status === 'error' && unauthedCarePlan.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedCarePlan.data === null);

  record('Stage15: there is no author/version action reachable over HTTP dispatch — doctor/staff writes stay editor-only',
    JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'save_care_plan', session_token: sessionA })._text).error.code === 'FOUNDATION_UNKNOWN_ACTION');

  record('Stage15: the first save wrote its own care_plan_created AuditLog row',
    auditRowsOf(h, 'care_plan_created').length === 1);
  record('Stage15: the second save wrote its own care_plan_versioned AuditLog row',
    auditRowsOf(h, 'care_plan_versioned').length === 1);

  // ============================================================
  // Doctor Instruction — a consumer of this stage's own CarePlan rows.
  // ============================================================

  // ---- foundationCreateDoctorInstruction_() — request-shape rejections ----
  var instrMissingPatientId = ctx.foundationCreateDoctorInstruction_({
    care_plan_id: plan1.data.care_plan_id, instruction_type: 'medicine', content: 'Arsenicum album 30C, twice daily.', prescribed_by: 'dr-rao', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects a missing patient_id with FOUNDATION_INVALID_INPUT',
    instrMissingPatientId.status === 'error' && instrMissingPatientId.error.code === 'FOUNDATION_INVALID_INPUT');

  var instrMissingCarePlanId = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, instruction_type: 'medicine', content: 'Arsenicum album 30C, twice daily.', prescribed_by: 'dr-rao', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects a missing care_plan_id with FOUNDATION_INVALID_INPUT',
    instrMissingCarePlanId.status === 'error' && instrMissingCarePlanId.error.code === 'FOUNDATION_INVALID_INPUT');

  var instrBadType = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, care_plan_id: plan1.data.care_plan_id, instruction_type: 'not-a-real-type', content: 'x', prescribed_by: 'dr-rao', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects an instruction_type outside the canonical list',
    instrBadType.status === 'error' && instrBadType.error.code === 'FOUNDATION_INVALID_INPUT');

  var instrMissingContent = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, care_plan_id: plan1.data.care_plan_id, instruction_type: 'medicine', prescribed_by: 'dr-rao', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects a missing content with FOUNDATION_INVALID_INPUT',
    instrMissingContent.status === 'error' && instrMissingContent.error.code === 'FOUNDATION_INVALID_INPUT');

  var instrMissingPrescribedBy = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, care_plan_id: plan1.data.care_plan_id, instruction_type: 'medicine', content: 'x', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects a missing prescribed_by with FOUNDATION_INVALID_INPUT',
    instrMissingPrescribedBy.status === 'error' && instrMissingPrescribedBy.error.code === 'FOUNDATION_INVALID_INPUT');

  var instrMissingEffectiveDate = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, care_plan_id: plan1.data.care_plan_id, instruction_type: 'medicine', content: 'x', prescribed_by: 'dr-rao'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects a missing effective_date with FOUNDATION_INVALID_INPUT',
    instrMissingEffectiveDate.status === 'error' && instrMissingEffectiveDate.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- care_plan_id existence/ownership check ----
  var instrUnknownCarePlan = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, care_plan_id: 'not-a-real-care-plan-id', instruction_type: 'medicine', content: 'x', prescribed_by: 'dr-rao', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects a care_plan_id that does not exist',
    instrUnknownCarePlan.status === 'error' && instrUnknownCarePlan.error.code === 'FOUNDATION_INVALID_INPUT');

  // patientB has no Care Plan of their own, but attempting to attach an
  // instruction to patient A's real care_plan_id under patient B's
  // patient_id must still be rejected — cross-patient ownership, not mere
  // existence.
  var instrCrossPatientCarePlan = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientB.data.patient_id, care_plan_id: plan1.data.care_plan_id, instruction_type: 'medicine', content: 'x', prescribed_by: 'dr-rao', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() rejects a care_plan_id that belongs to a different patient',
    instrCrossPatientCarePlan.status === 'error' && instrCrossPatientCarePlan.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The real, valid create path — care_plan_id is stable across versions ----
  var instr1 = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, care_plan_id: plan1.data.care_plan_id, instruction_type: 'medicine',
    content: 'Arsenicum album 30C, twice daily.', prescribed_by: 'dr-rao', effective_date: '2026-07-07'
  });
  record('Stage15: foundationCreateDoctorInstruction_() succeeds on valid input, referencing the plan\'s stable care_plan_id even after it was later versioned',
    instr1.status === 'ok');
  record('Stage15: a real foundationCreateDoctorInstruction_() result conforms to doctor-instruction.schema.json',
    (function () { var r = validate(doctorInstructionSchema, instr1.data); return r.valid; })(),
    (function () { var r = validate(doctorInstructionSchema, instr1.data); return r.errors.join('; '); })());
  record('Stage15: a new instruction starts active, with an empty-string consultation_id sentinel (no Consultation entity exists yet)',
    instr1.data.status === 'active' && instr1.data.consultation_id === '');

  var instr2 = ctx.foundationCreateDoctorInstruction_({
    patient_id: patientA.data.patient_id, care_plan_id: plan1.data.care_plan_id, instruction_type: 'lifestyle',
    content: 'Avoid known trigger foods for 8 weeks.', prescribed_by: 'dr-rao', effective_date: '2026-07-10'
  });
  record('Stage15: a second, independent instruction for the same care plan succeeds — many-per-plan, not 1:1',
    instr2.status === 'ok');

  // ---- foundationUpdateDoctorInstructionStatus_() — request-shape rejections ----
  var statusMissingId = ctx.foundationUpdateDoctorInstructionStatus_({ status: 'completed' });
  record('Stage15: foundationUpdateDoctorInstructionStatus_() rejects a missing instruction_id with FOUNDATION_INVALID_INPUT',
    statusMissingId.status === 'error' && statusMissingId.error.code === 'FOUNDATION_INVALID_INPUT');

  var statusBadValue = ctx.foundationUpdateDoctorInstructionStatus_({ instruction_id: instr1.data.instruction_id, status: 'active' });
  record('Stage15: foundationUpdateDoctorInstructionStatus_() rejects a status outside discontinued/completed (e.g. reverting to active)',
    statusBadValue.status === 'error' && statusBadValue.error.code === 'FOUNDATION_INVALID_INPUT');

  var statusUnknownId = ctx.foundationUpdateDoctorInstructionStatus_({ instruction_id: 'not-a-real-instruction-id', status: 'completed' });
  record('Stage15: foundationUpdateDoctorInstructionStatus_() rejects an unknown instruction_id with FOUNDATION_INVALID_INPUT',
    statusUnknownId.status === 'error' && statusUnknownId.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- The real, valid status-transition path ----
  var completeInstr1 = ctx.foundationUpdateDoctorInstructionStatus_({ instruction_id: instr1.data.instruction_id, status: 'completed' });
  record('Stage15: foundationUpdateDoctorInstructionStatus_() succeeds on a real, active instruction_id', completeInstr1.status === 'ok');
  record('Stage15: the completed instruction has status=completed', completeInstr1.data.status === 'completed');

  var reCloseInstr1 = ctx.foundationUpdateDoctorInstructionStatus_({ instruction_id: instr1.data.instruction_id, status: 'discontinued' });
  record('Stage15: closing an already-closed instruction_id is rejected — a one-way, exactly-once transition',
    reCloseInstr1.status === 'error' && reCloseInstr1.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- foundationGetPatientDoctorInstructions_() — full history, both statuses ----
  var instructionsA = ctx.foundationGetPatientDoctorInstructions_(patientA.data.patient_id);
  record('Stage15: foundationGetPatientDoctorInstructions_() succeeds', instructionsA.status === 'ok');
  record('Stage15: patient A\'s list contains both of their own instructions (one completed, one still active), never patient B\'s',
    instructionsA.data.length === 2 && instructionsA.data.every(function (row) { return row.patient_id === patientA.data.patient_id; }));
  record('Stage15: the list is sorted effective_date descending (newest first)',
    instructionsA.data[0].effective_date >= instructionsA.data[1].effective_date);

  var instructionsB = ctx.foundationGetPatientDoctorInstructions_(patientB.data.patient_id);
  record('Stage15: patient B\'s instruction list is empty — cross-patient isolation',
    instructionsB.status === 'ok' && instructionsB.data.length === 0);

  // ---- FoundationRouter.gs — get_doctor_instructions, end to end ----
  var getInstrHttpA = ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_instructions', session_token: sessionA });
  var getInstrBodyA = JSON.parse(getInstrHttpA._text);
  record('Stage15: get_doctor_instructions (real HTTP dispatch) resolves the caller\'s own instructions from a valid session',
    getInstrBodyA.status === 'ok' && getInstrBodyA.data.length === 2);
  record('Stage15: get_doctor_instructions derives patient_id only from the verified session, never from a client-supplied field',
    (function () {
      var spoofed = ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_instructions', session_token: sessionA, patient_id: patientB.data.patient_id });
      var spoofedBody = JSON.parse(spoofed._text);
      return spoofedBody.status === 'ok' && spoofedBody.data.length === 2;
    })());

  var getInstrHttpB = ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_instructions', session_token: sessionB });
  var getInstrBodyB = JSON.parse(getInstrHttpB._text);
  record('Stage15: get_doctor_instructions over real HTTP dispatch returns an empty list for patient B, never patient A\'s — cross-patient isolation',
    getInstrBodyB.status === 'ok' && getInstrBodyB.data.length === 0);

  var unauthedInstr = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_instructions', session_token: 'not-a-real-session-token' })._text);
  record('Stage15: get_doctor_instructions rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedInstr.status === 'error' && unauthedInstr.error.code === 'FOUNDATION_UNAUTHORIZED' && unauthedInstr.data === null);

  record('Stage15: every successful instruction creation wrote its own doctor_instruction_created AuditLog row',
    auditRowsOf(h, 'doctor_instruction_created').length === 2);
  record('Stage15: the successful status transition wrote its own doctor_instruction_completed AuditLog row',
    auditRowsOf(h, 'doctor_instruction_completed').length === 1);
})();

// ============================================================
// Stage 16 (PXP-8) — TrustedDevice.gs (Trusted Device + Long-Lived
// Session) -> shared/schemas/trusted-device.schema.json
// ============================================================
(function stage16_trustedDeviceAndLongLivedSession() {
  var patientA = ctx.foundationCreatePatient_({
    full_name: 'Stage16 Patient A', email: 'stage16-a@example.com',
    condition_slug: 'mcas', created_by: 'staff-1'
  });
  var patientB = ctx.foundationCreatePatient_({
    full_name: 'Stage16 Patient B', email: 'stage16-b@example.com',
    condition_slug: 'eczema', created_by: 'staff-1'
  });
  record('Stage16: setup — two independent patients exist', patientA.status === 'ok' && patientB.status === 'ok');
  var patientIdA = patientA.data.patient_id;
  var patientIdB = patientB.data.patient_id;

  // ---- Baseline: a magic-link-issued session's own TTL is unchanged ----
  var baselineSession = ctx.foundationIssueSessionToken_(patientIdA);
  var baselineVerified = ctx.foundationVerifySessionToken_(baselineSession);
  record('Stage16: a magic-link-issued session still verifies with the real, unmodified foundationVerifySessionToken_()',
    baselineVerified.valid === true);
  var baselineTtlSeconds = (Date.parse(baselineVerified.payload.expires_at) - Date.parse(baselineVerified.payload.issued_at)) / 1000;
  record('Stage16: a magic-link-issued session\'s own TTL is exactly the unchanged 3600-second default — FoundationSession.gs was not touched',
    baselineTtlSeconds === 3600);

  // ---- foundationCreateTrustedDevice_() ----
  var device1 = ctx.foundationCreateTrustedDevice_(patientIdA, 'My iPhone');
  record('Stage16: foundationCreateTrustedDevice_() succeeds on valid input', device1.status === 'ok');
  record('Stage16: the created device returns a raw device_token, a device_id, and an expires_at',
    typeof device1.data.device_token === 'string' && device1.data.device_token.length > 0
    && typeof device1.data.device_id === 'string' && device1.data.device_id.length > 0
    && typeof device1.data.expires_at === 'string');
  record('Stage16: the response never includes a device_token_hash field', !('device_token_hash' in device1.data));

  var badLabel = ctx.foundationCreateTrustedDevice_(patientIdA, 'x'.repeat(61));
  record('Stage16: foundationCreateTrustedDevice_() rejects a device_label over 60 characters with FOUNDATION_INVALID_INPUT',
    badLabel.status === 'error' && badLabel.error.code === 'FOUNDATION_INVALID_INPUT');

  var storedDevices = ctx.foundationGetPatientTrustedDevices_(patientIdA);
  record('Stage16: a real stored TrustedDevice row (redacted view) conforms to trusted-device.schema.json',
    (function () {
      var raw = h.spreadsheet.getSheetByName('TrustedDevices')._debug();
      var cols = raw.header;
      var row0 = raw.rows[0];
      var obj = {};
      cols.forEach(function (c, i) { obj[c] = row0[i]; });
      return validate(trustedDeviceSchema, obj).valid === true;
    })());
  record('Stage16: get_trusted_devices\' redacted view never includes device_token_hash',
    storedDevices.status === 'ok' && !('device_token_hash' in storedDevices.data[0]));

  // ---- foundationConsumeTrustedDevice_() — the happy path ----
  var consumed1 = ctx.foundationConsumeTrustedDevice_(device1.data.device_token);
  record('Stage16: foundationConsumeTrustedDevice_() succeeds against a real, unrevoked, unexpired device token', consumed1.status === 'ok');
  record('Stage16: a successful consume resolves the correct patient_id', consumed1.data.patient_id === patientIdA);
  record('Stage16: a successful consume returns a rotated (different) raw device_token',
    consumed1.data.device_token !== device1.data.device_token);

  var longLivedVerified = ctx.foundationVerifySessionToken_(consumed1.data.session_token);
  record('Stage16: the issued Long-Lived Session token verifies successfully through the real, unmodified foundationVerifySessionToken_()',
    longLivedVerified.valid === true && longLivedVerified.patientId === patientIdA);
  var longLivedTtlSeconds = (Date.parse(longLivedVerified.payload.expires_at) - Date.parse(longLivedVerified.payload.issued_at)) / 1000;
  record('Stage16: the Long-Lived Session\'s own TTL (14 days) is materially longer than a magic-link session\'s 3600-second default',
    longLivedTtlSeconds === 60 * 60 * 24 * 14 && longLivedTtlSeconds > baselineTtlSeconds);

  // ---- Rotation: the pre-rotation raw token is rejected on a second attempt ----
  var reuseOldToken = ctx.foundationConsumeTrustedDevice_(device1.data.device_token);
  record('Stage16: presenting the same (now-rotated-away) raw device token a second time is rejected — rotation is real, not cosmetic',
    reuseOldToken.status === 'error' && reuseOldToken.error.code === 'FOUNDATION_TRUSTED_DEVICE_INVALID');

  // ---- The rotated token itself still works ----
  var consumeRotated = ctx.foundationConsumeTrustedDevice_(consumed1.data.device_token);
  record('Stage16: the newly-rotated raw device token successfully consumes on its own next use', consumeRotated.status === 'ok');

  // ---- Unknown / malformed tokens ----
  var unknownToken = ctx.foundationConsumeTrustedDevice_('not-a-real-device-token');
  record('Stage16: an unknown device token is rejected with the generic FOUNDATION_TRUSTED_DEVICE_INVALID code',
    unknownToken.status === 'error' && unknownToken.error.code === 'FOUNDATION_TRUSTED_DEVICE_INVALID');
  var missingToken = ctx.foundationConsumeTrustedDevice_('');
  record('Stage16: a missing device token is rejected with the same generic code, never a distinguishable one',
    missingToken.status === 'error' && missingToken.error.code === 'FOUNDATION_TRUSTED_DEVICE_INVALID');

  // ---- foundationRevokeTrustedDevice_() ----
  var device2 = ctx.foundationCreateTrustedDevice_(patientIdA, 'Work laptop');
  var revokeResult = ctx.foundationRevokeTrustedDevice_(patientIdA, device2.data.device_id);
  record('Stage16: foundationRevokeTrustedDevice_() succeeds on the caller\'s own, unrevoked device', revokeResult.status === 'ok');

  var reuseRevokedToken = ctx.foundationConsumeTrustedDevice_(device2.data.device_token);
  record('Stage16: a revoked device\'s token is rejected with the same generic FOUNDATION_TRUSTED_DEVICE_INVALID code, never distinguishing "revoked" from "expired" or "unknown"',
    reuseRevokedToken.status === 'error' && reuseRevokedToken.error.code === 'FOUNDATION_TRUSTED_DEVICE_INVALID');

  var revokeAgain = ctx.foundationRevokeTrustedDevice_(patientIdA, device2.data.device_id);
  record('Stage16: revoking an already-revoked device is rejected — a one-way, exactly-once transition',
    revokeAgain.status === 'error' && revokeAgain.error.code === 'FOUNDATION_NOT_FOUND');

  var device3 = ctx.foundationCreateTrustedDevice_(patientIdA, '');
  var crossPatientRevoke = ctx.foundationRevokeTrustedDevice_(patientIdB, device3.data.device_id);
  record('Stage16: patient B cannot revoke patient A\'s device — rejected with the same generic FOUNDATION_NOT_FOUND, never leaking that the device exists',
    crossPatientRevoke.status === 'error' && crossPatientRevoke.error.code === 'FOUNDATION_NOT_FOUND');

  var unknownRevoke = ctx.foundationRevokeTrustedDevice_(patientIdA, 'not-a-real-device-id');
  record('Stage16: revoking an unknown device_id is rejected with the same generic FOUNDATION_NOT_FOUND',
    unknownRevoke.status === 'error' && unknownRevoke.error.code === 'FOUNDATION_NOT_FOUND');

  // ---- Cross-patient isolation on the list route ----
  var devicesA = ctx.foundationGetPatientTrustedDevices_(patientIdA);
  var devicesB = ctx.foundationGetPatientTrustedDevices_(patientIdB);
  record('Stage16: patient A\'s device list contains only patient A\'s own devices, never patient B\'s',
    devicesA.status === 'ok' && devicesA.data.every(function (d) { return d.patient_id === patientIdA; }));
  record('Stage16: patient B\'s device list is empty — cross-patient isolation', devicesB.status === 'ok' && devicesB.data.length === 0);

  // ---- HTTP dispatch (FoundationRouter.gs) ----
  var device4 = ctx.foundationCreateTrustedDevice_(patientIdA, 'HTTP test device');
  var sessionForA = ctx.foundationIssueSessionToken_(patientIdA);

  var markTrustedHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'mark_device_trusted', session_token: sessionForA, device_label: 'HTTP-dispatch device' })._text);
  record('Stage16: mark_device_trusted (real HTTP dispatch) succeeds and derives patient_id only from the verified session',
    markTrustedHttp.status === 'ok' && typeof markTrustedHttp.data.device_token === 'string');

  var unauthedMarkTrustedHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'mark_device_trusted', session_token: 'not-a-real-session-token' })._text);
  record('Stage16: mark_device_trusted rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedMarkTrustedHttp.status === 'error' && unauthedMarkTrustedHttp.error.code === 'FOUNDATION_UNAUTHORIZED');

  var consumeHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'consume_trusted_device', device_token: device4.data.device_token })._text);
  record('Stage16: consume_trusted_device (real HTTP dispatch) succeeds with no session_token at all — the device token is itself the credential',
    consumeHttp.status === 'ok' && typeof consumeHttp.data.session_token === 'string');

  var getDevicesHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_trusted_devices', session_token: sessionForA })._text);
  record('Stage16: get_trusted_devices (real HTTP dispatch) resolves the caller\'s own devices from a valid session', getDevicesHttp.status === 'ok');
  var getDevicesHttpB = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_trusted_devices', session_token: ctx.foundationIssueSessionToken_(patientIdB) })._text);
  record('Stage16: get_trusted_devices over real HTTP dispatch returns only patient B\'s own devices, never patient A\'s — cross-patient isolation',
    getDevicesHttpB.status === 'ok' && getDevicesHttpB.data.every(function (d) { return d.patient_id === patientIdB; }));
  var unauthedGetDevicesHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_trusted_devices', session_token: 'not-a-real-session-token' })._text);
  record('Stage16: get_trusted_devices rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedGetDevicesHttp.status === 'error' && unauthedGetDevicesHttp.error.code === 'FOUNDATION_UNAUTHORIZED');

  var device5 = ctx.foundationCreateTrustedDevice_(patientIdA, 'To be revoked over HTTP');
  var revokeHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'revoke_trusted_device', session_token: sessionForA, device_id: device5.data.device_id })._text);
  record('Stage16: revoke_trusted_device (real HTTP dispatch) succeeds and derives patient_id only from the verified session', revokeHttp.status === 'ok');
  var unauthedRevokeHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'revoke_trusted_device', session_token: 'not-a-real-session-token', device_id: device5.data.device_id })._text);
  record('Stage16: revoke_trusted_device rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    unauthedRevokeHttp.status === 'error' && unauthedRevokeHttp.error.code === 'FOUNDATION_UNAUTHORIZED');

  // ---- Audit log ----
  record('Stage16: every successful device creation wrote its own trusted_device_created AuditLog row',
    auditRowsOf(h, 'trusted_device_created').length >= 1);
  record('Stage16: every successful consume wrote its own trusted_device_consumed AND long_lived_session_issued AuditLog row',
    auditRowsOf(h, 'trusted_device_consumed').length >= 1 && auditRowsOf(h, 'long_lived_session_issued').length >= 1);
  record('Stage16: every rejected consume wrote its own trusted_device_rejected AuditLog row',
    auditRowsOf(h, 'trusted_device_rejected').length >= 1);
  record('Stage16: every successful revoke wrote its own trusted_device_revoked AuditLog row',
    auditRowsOf(h, 'trusted_device_revoked').length >= 1);
})();

// ============================================================
// Stage 17 (WPI-1) — DoctorIdentity.gs, DoctorSession.gs,
// DoctorLoginTokens.gs, DoctorEmail.gs, DoctorLoginFlow.gs,
// DoctorRouteGuard.gs -> shared/schemas/doctor-identity.schema.json,
// doctor-session.schema.json, doctor-login-token.schema.json
// ============================================================
(function stage17_doctorIdentityAndSession() {
  // ---- foundationCreateDoctor_() / foundationValidateDoctorInput_() ----
  var doctorA = ctx.foundationCreateDoctor_({
    full_name: 'Stage17 Doctor A', role: 'physician', email: 'stage17-doctor-a@example.com',
    specialty_slug: 'homeopathy', created_by: 'admin-1'
  });
  var doctorB = ctx.foundationCreateDoctor_({
    full_name: 'Stage17 Doctor B', role: 'staff', email: 'stage17-doctor-b@example.com',
    created_by: 'admin-1'
  });
  record('Stage17: setup — two independent doctors exist', doctorA.status === 'ok' && doctorB.status === 'ok');
  var doctorIdA = doctorA.data.doctor_id;
  var doctorIdB = doctorB.data.doctor_id;

  record('Stage17: a real stored Doctor row conforms to doctor-identity.schema.json',
    validate(doctorIdentitySchema, doctorA.data).valid === true);
  record('Stage17: specialty_slug is optional — doctor B (no specialty_slug given) still conforms',
    validate(doctorIdentitySchema, doctorB.data).valid === true && doctorB.data.specialty_slug === '');

  var badRole = ctx.foundationCreateDoctor_({ full_name: 'X', role: 'admin', email: 'x@example.com', created_by: 'admin-1' });
  record('Stage17: foundationCreateDoctor_() rejects a role outside physician/staff with FOUNDATION_INVALID_INPUT',
    badRole.status === 'error' && badRole.error.code === 'FOUNDATION_INVALID_INPUT');
  var badEmail = ctx.foundationCreateDoctor_({ full_name: 'X', role: 'staff', email: 'not-an-email', created_by: 'admin-1' });
  record('Stage17: foundationCreateDoctor_() rejects a malformed email', badEmail.status === 'error' && badEmail.error.code === 'FOUNDATION_INVALID_INPUT');
  var missingCreatedBy = ctx.foundationCreateDoctor_({ full_name: 'X', role: 'staff', email: 'x2@example.com' });
  record('Stage17: foundationCreateDoctor_() rejects a missing created_by (no public self-registration)',
    missingCreatedBy.status === 'error' && missingCreatedBy.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- foundationGetDoctorById_() ----
  var lookupA = ctx.foundationGetDoctorById_(doctorIdA);
  record('Stage17: foundationGetDoctorById_() resolves a real doctor_id', lookupA.status === 'ok' && lookupA.data.doctor_id === doctorIdA);
  var lookupUnknown = ctx.foundationGetDoctorById_('not-a-real-doctor-id');
  record('Stage17: foundationGetDoctorById_() returns FOUNDATION_NOT_FOUND for an unknown doctor_id',
    lookupUnknown.status === 'error' && lookupUnknown.error.code === 'FOUNDATION_NOT_FOUND');

  // ---- DoctorSession: issuance, verification, TTL ----
  var doctorSessionA = ctx.foundationIssueDoctorSessionToken_(doctorIdA);
  var doctorSessionVerified = ctx.foundationVerifyDoctorSessionToken_(doctorSessionA);
  record('Stage17: a real DoctorSession token verifies successfully and resolves the correct doctor_id',
    doctorSessionVerified.valid === true && doctorSessionVerified.doctorId === doctorIdA);
  var doctorTtlSeconds = (Date.parse(doctorSessionVerified.payload.expires_at) - Date.parse(doctorSessionVerified.payload.issued_at)) / 1000;
  record('Stage17: DoctorSession\'s own TTL mirrors Patient Session\'s exact 3600-second default (docs/50 §14)',
    doctorTtlSeconds === 3600);
  record('Stage17: a real stored/issued DoctorSession payload conforms to doctor-session.schema.json',
    validate(doctorSessionSchema, doctorSessionVerified.payload).valid === true);

  // ---- Security review §1: the signing secret is the identical, shared FOUNDATION_SESSION_SIGNING_SECRET ----
  var sharedSecret = h.scriptProperties['FOUNDATION_SESSION_SIGNING_SECRET'];
  var manualPayload = ctx.foundationBuildDoctorSessionPayload_(doctorIdA, Date.now(), 3600);
  var manualPayloadSegment = ctx.foundationBase64UrlEncodeString_(JSON.stringify(manualPayload));
  var manualSignature = ctx.foundationSignSessionPayloadSegment_(manualPayloadSegment, sharedSecret);
  var manualToken = manualPayloadSegment + '.' + manualSignature;
  var manualVerified = ctx.foundationVerifyDoctorSessionToken_(manualToken);
  record('Stage17: a token hand-signed with the exact shared FOUNDATION_SESSION_SIGNING_SECRET verifies successfully — proving the same secret Patient Session uses is the one DoctorSession actually reads',
    manualVerified.valid === true && manualVerified.doctorId === doctorIdA);

  // ---- Security review §2: no cross-identity-type authorization confusion ----
  var patientForCrossCheck = ctx.foundationCreatePatient_({
    full_name: 'Stage17 Patient', email: 'stage17-patient@example.com', condition_slug: 'mcas', created_by: 'staff-1'
  });
  var patientIdForCrossCheck = patientForCrossCheck.data.patient_id;
  var patientSessionForCrossCheck = ctx.foundationIssueSessionToken_(patientIdForCrossCheck);

  var doctorTokenAsPatient = ctx.foundationVerifySessionToken_(doctorSessionA);
  record('Stage17: a real DoctorSession token is REJECTED by the patient-side foundationVerifySessionToken_() — invalid_payload_shape, never a false-positive patient_id',
    doctorTokenAsPatient.valid === false && doctorTokenAsPatient.reason === 'invalid_payload_shape');

  var patientTokenAsDoctor = ctx.foundationVerifyDoctorSessionToken_(patientSessionForCrossCheck);
  record('Stage17: a real Patient Session token is REJECTED by foundationVerifyDoctorSessionToken_() — invalid_payload_shape, never a false-positive doctor_id',
    patientTokenAsDoctor.valid === false && patientTokenAsDoctor.reason === 'invalid_payload_shape');

  var doctorTokenAtPatientGuard = ctx.withFoundationAuth_(doctorSessionA, function (patientId) { return { data: patientId }; });
  record('Stage17: withFoundationAuth_() (patient guard) rejects a real DoctorSession token with FOUNDATION_UNAUTHORIZED, never calling the protected handler',
    doctorTokenAtPatientGuard.status === 'error' && doctorTokenAtPatientGuard.error.code === 'FOUNDATION_UNAUTHORIZED');

  var patientTokenAtDoctorGuard = ctx.withFoundationDoctorAuth_(patientSessionForCrossCheck, function (doctorId) { return { data: doctorId }; });
  record('Stage17: withFoundationDoctorAuth_() (doctor guard) rejects a real Patient Session token with FOUNDATION_UNAUTHORIZED, never calling the protected handler',
    patientTokenAtDoctorGuard.status === 'error' && patientTokenAtDoctorGuard.error.code === 'FOUNDATION_UNAUTHORIZED');

  // ---- DoctorLoginTokens: issuance, consumption, single-use, expiry ----
  var doctorLoginToken1 = ctx.foundationCreateDoctorLoginToken_(doctorIdA);
  record('Stage17: foundationCreateDoctorLoginToken_() succeeds and returns a raw token', doctorLoginToken1.status === 'ok' && typeof doctorLoginToken1.data.token === 'string');
  record('Stage17: a real stored DoctorLoginTokens row conforms to doctor-login-token.schema.json',
    (function () {
      var raw = h.spreadsheet.getSheetByName('DoctorLoginTokens')._debug();
      var cols = raw.header;
      var row0 = raw.rows[0];
      var obj = {};
      cols.forEach(function (c, i) { obj[c] = row0[i]; });
      return validate(doctorLoginTokenSchema, obj).valid === true;
    })());
  record('Stage17: DoctorLoginTokens is a sheet distinct from LoginTokens — no cross-lookup possible',
    h.spreadsheet.getSheetByName('DoctorLoginTokens') !== h.spreadsheet.getSheetByName('LoginTokens'));

  var consumeDoctor1 = ctx.foundationConsumeDoctorLoginToken_(doctorLoginToken1.data.token);
  record('Stage17: foundationConsumeDoctorLoginToken_() succeeds against a real, unused, unexpired token and resolves the correct doctor_id',
    consumeDoctor1.status === 'ok' && consumeDoctor1.data.doctor_id === doctorIdA);
  var reuseDoctorToken = ctx.foundationConsumeDoctorLoginToken_(doctorLoginToken1.data.token);
  record('Stage17: reusing an already-consumed doctor login token is rejected — single-use enforced',
    reuseDoctorToken.status === 'error' && reuseDoctorToken.error.code === 'FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID');
  var unknownDoctorToken = ctx.foundationConsumeDoctorLoginToken_('not-a-real-doctor-login-token');
  record('Stage17: an unknown doctor login token is rejected with the same generic FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID code',
    unknownDoctorToken.status === 'error' && unknownDoctorToken.error.code === 'FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID');
  var missingDoctorToken = ctx.foundationConsumeDoctorLoginToken_('');
  record('Stage17: a missing doctor login token is rejected with the same generic code', missingDoctorToken.status === 'error' && missingDoctorToken.error.code === 'FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID');

  // A patient login token (a different sheet) must never be consumable as a doctor login token.
  var patientLoginToken = ctx.foundationCreateLoginToken_(patientIdForCrossCheck);
  var patientTokenAsDoctorLoginToken = ctx.foundationConsumeDoctorLoginToken_(patientLoginToken.data.token);
  record('Stage17: a real, valid PATIENT login token is rejected when presented as a doctor login token — sheet isolation, not just naming convention',
    patientTokenAsDoctorLoginToken.status === 'error' && patientTokenAsDoctorLoginToken.error.code === 'FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID');

  // ---- DoctorLoginFlow: request-link anti-enumeration + rate limiting ----
  var requestMatched = ctx.foundationHandleRequestDoctorLoginLink_({ email: 'stage17-doctor-a@example.com' });
  var requestUnmatched = ctx.foundationHandleRequestDoctorLoginLink_({ email: 'stage17-nobody@example.com' });
  record('Stage17: request_doctor_login_link returns the identical generic response for a matched vs. unmatched email — anti-enumeration',
    requestMatched.status === 'ok' && requestUnmatched.status === 'ok'
    && JSON.stringify(requestMatched.data) === JSON.stringify(requestUnmatched.data));
  record('Stage17: a matched request-link actually sent an email via the mocked MailApp',
    h.mailLog.some(function (m) { return m.to === 'stage17-doctor-a@example.com' && /doctor login link/.test(m.subject); }));

  var invalidEmailRequest = ctx.foundationHandleRequestDoctorLoginLink_({ email: 'not-an-email' });
  record('Stage17: request_doctor_login_link rejects a syntactically invalid email with FOUNDATION_INVALID_INPUT',
    invalidEmailRequest.status === 'error' && invalidEmailRequest.error.code === 'FOUNDATION_INVALID_INPUT');

  // ---- DoctorLoginFlow: consume-link issues a real DoctorSession ----
  var freshDoctorToken = ctx.foundationCreateDoctorLoginToken_(doctorIdB);
  var consumeLinkResult = ctx.foundationHandleConsumeDoctorLoginLink_({ token: freshDoctorToken.data.token });
  record('Stage17: consume_doctor_login_link succeeds and issues a real, verifiable DoctorSession token',
    consumeLinkResult.status === 'ok' && consumeLinkResult.data.doctor_id === doctorIdB
    && ctx.foundationVerifyDoctorSessionToken_(consumeLinkResult.data.session_token).valid === true);
  var consumeLinkBad = ctx.foundationHandleConsumeDoctorLoginLink_({ token: 'not-a-real-token' });
  record('Stage17: consume_doctor_login_link rejects an invalid token with the generic FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID code',
    consumeLinkBad.status === 'error' && consumeLinkBad.error.code === 'FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID');

  // ---- HTTP dispatch (FoundationRouter.gs) ----
  var requestHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'request_doctor_login_link', email: 'stage17-doctor-a@example.com' })._text);
  record('Stage17: request_doctor_login_link (real HTTP dispatch) succeeds with the generic response', requestHttp.status === 'ok');

  var freshDoctorTokenHttp = ctx.foundationCreateDoctorLoginToken_(doctorIdA);
  var consumeHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'consume_doctor_login_link', token: freshDoctorTokenHttp.data.token })._text);
  record('Stage17: consume_doctor_login_link (real HTTP dispatch) succeeds and returns a real session_token', consumeHttp.status === 'ok' && typeof consumeHttp.data.session_token === 'string');

  var getDoctorProfileHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_profile', session_token: consumeHttp.data.session_token })._text);
  record('Stage17: get_doctor_profile (real HTTP dispatch) resolves the caller\'s own Doctor record from a valid DoctorSession',
    getDoctorProfileHttp.status === 'ok' && getDoctorProfileHttp.data.doctor_id === doctorIdA);

  var getDoctorProfileUnauthed = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_profile', session_token: 'not-a-real-session-token' })._text);
  record('Stage17: get_doctor_profile rejects an invalid session_token with FOUNDATION_UNAUTHORIZED, never leaking any data',
    getDoctorProfileUnauthed.status === 'error' && getDoctorProfileUnauthed.error.code === 'FOUNDATION_UNAUTHORIZED' && getDoctorProfileUnauthed.data === null);

  var getDoctorProfileWithPatientSessionHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_profile', session_token: patientSessionForCrossCheck })._text);
  record('Stage17: get_doctor_profile over real HTTP dispatch rejects a real Patient Session token with FOUNDATION_UNAUTHORIZED — cross-identity-type confusion prevented end to end',
    getDoctorProfileWithPatientSessionHttp.status === 'error' && getDoctorProfileWithPatientSessionHttp.error.code === 'FOUNDATION_UNAUTHORIZED');

  var getProfileWithDoctorSessionHttp = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_profile', session_token: doctorSessionA })._text);
  record('Stage17: get_profile (patient route) over real HTTP dispatch rejects a real DoctorSession token with FOUNDATION_UNAUTHORIZED — cross-identity-type confusion prevented end to end, symmetrically',
    getProfileWithDoctorSessionHttp.status === 'error' && getProfileWithDoctorSessionHttp.error.code === 'FOUNDATION_UNAUTHORIZED');

  // ---- Cross-doctor isolation ----
  var doctorSessionB = ctx.foundationIssueDoctorSessionToken_(doctorIdB);
  var profileA = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_profile', session_token: doctorSessionA })._text);
  var profileB = JSON.parse(ctx.handleFoundationRequest_({ foundation_action: 'get_doctor_profile', session_token: doctorSessionB })._text);
  record('Stage17: doctor A\'s session resolves doctor A\'s own record, never doctor B\'s', profileA.data.doctor_id === doctorIdA);
  record('Stage17: doctor B\'s session resolves doctor B\'s own record, never doctor A\'s — cross-doctor isolation', profileB.data.doctor_id === doctorIdB);

  // ---- Audit log — every doctor-scoped event keeps AuditLog's patient_id column empty ----
  record('Stage17: every doctor_created AuditLog row has an empty patient_id column (no natural patient — doctor-session.md security review §8)',
    auditRowsOf(h, 'doctor_created').length >= 1 && auditRowsOf(h, 'doctor_created').every(function (row) { return row[2] === ''; }));
  record('Stage17: every successful doctor login token issuance wrote its own doctor_login_token_issued AuditLog row',
    auditRowsOf(h, 'doctor_login_token_issued').length >= 1);
  record('Stage17: every successful doctor login token consumption wrote its own doctor_login_token_consumed AuditLog row',
    auditRowsOf(h, 'doctor_login_token_consumed').length >= 1);
  record('Stage17: every rejected doctor login token wrote its own doctor_login_token_rejected AuditLog row',
    auditRowsOf(h, 'doctor_login_token_rejected').length >= 1);
  record('Stage17: every rejected DoctorSession verification wrote its own doctor_session_rejected AuditLog row',
    auditRowsOf(h, 'doctor_session_rejected').length >= 1);
})();

function auditRowsOf(h, eventType) {
  var auditSheet = h.spreadsheet.getSheetByName('AuditLog');
  var rows = auditSheet ? auditSheet._debug().rows : [];
  return rows.filter(function (row) { return row[1] === eventType; });
}

var failed = results.filter(function (r) { return !r.pass; });
console.log('\n' + results.length + ' conformance checks run, ' + failed.length + ' failed.');
console.log(failed.length === 0 ? 'PASS' : 'FAIL');
process.exit(failed.length === 0 ? 0 : 1);
