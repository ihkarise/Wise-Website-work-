/**
 * Appointment — Batch WPI-5 (docs/50-PHASE-3-TECHNICAL-PLAN.md §8/§19;
 * docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every later WPI
 * batch). Implements shared/schemas/appointment.schema.json version 1.0.0.
 * The scheduled or requested clinical encounter that precedes, and once
 * held becomes, a Consultation (docs/33-DOMAIN-MODEL.md §2.1/§4.1) —
 * concretely closing docs/20 §3's "THE GAP" between a public booking-form
 * submission and the platform's own patient-facing history, for the first
 * time.
 *
 * Not Foundation-prefixed, for the same reason DoctorAssignedCondition.gs
 * and DoctorInstruction.gs aren't (docs/29 §2): a concrete entity built on
 * Foundation's frozen infrastructure, not infrastructure itself.
 *
 * Staff/doctor-owned, not patient-owned — a hard boundary (docs/50 §8's
 * "Staff/doctor-facing only in this plan's scope"). Every write (creation,
 * confirmation, and every later status transition) is a doctor/staff
 * action; there is no patient-facing write path for this entity in this
 * batch's scope. Every write is a manually-run Apps Script editor function,
 * mirroring DoctorAssignedCondition.gs's/DoctorInstruction.gs's precedent
 * exactly — not a new authenticated Web App route. The one doctor-facing
 * surface this batch adds is a read-only route (FoundationRouter.gs's
 * get_doctor_appointments), deriving doctor_id exclusively from the
 * verified DoctorSession, mirroring get_doctor_patient_roster exactly.
 *
 * Disclosed, implementation-time intake decision (docs/50 §8 leaves this
 * open deliberately): the mechanism by which a contact.html/Netlify Forms
 * booking submission becomes a real Appointment row is a staff-run tool
 * (createFoundationAppointment(), bottom of this file) — a manually-run
 * editor function staff use to transcribe an accepted booking request into
 * the platform's own data, not a new direct public-facing write endpoint.
 * This is the smallest, most consistent-with-precedent choice (mirroring
 * every other doctor/staff-owned entity's own intake tool) and avoids
 * introducing a new, unauthenticated public write surface in the same
 * batch that also ships this entity's core lifecycle.
 *
 * Lifecycle (docs/50 §8): a row is created 'requested' (patient_id/
 * doctor_id/scheduled_at all nullable — a first-time visitor has no
 * Patient Identity yet, and no Doctor is assigned until confirmed); the
 * confirm operation assigns a real doctor_id and a real scheduled_at,
 * transitioning to 'confirmed'; a confirmed appointment may transition to
 * 'completed'; 'requested' or 'confirmed' may transition to 'cancelled'.
 * Every transition is one-way, exactly once, never reverted — mirroring
 * DoctorInstruction.gs's own one-way status-transition discipline exactly.
 *
 * specialty_slug is derived once, at creation, from condition_slug via
 * SpecialtyRegistry.gs's foundationGetSpecialtyForCondition_() (ADR-018,
 * docs/50 §6.3) — never staff-supplied directly, never recomputed
 * afterward. The Doctor Dashboard's Appointments capability
 * (get_doctor_appointments) derives which doctors see a given appointment
 * from this same field, the same specialty-derivation discipline
 * DoctorPatientRoster.gs's patient roster already established — including
 * that mechanism's own disclosed multi-doctor-per-specialty limitation
 * (docs/50 §7.4, docs/51 Part 1.6): every doctor in a specialty sees every
 * appointment in that specialty, not a personal, per-doctor view.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..11/WPI-1..4 file — reuses FoundationDataStore.gs's
 * existing generic insert/getById/updateById/query operations and
 * FoundationAudit.gs's existing foundationLogAuditEvent_() exactly as both
 * were already designed to be reused (ADR-009).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs, DoctorIdentity.gs,
 * PatientIdentity.gs, SpecialtyRegistry.gs.
 */

var FOUNDATION_APPOINTMENTS_SHEET_ = 'Appointments';
var FOUNDATION_APPOINTMENTS_COLUMNS_ = ['appointment_id', 'patient_id', 'doctor_id', 'requested_at', 'scheduled_at', 'status', 'condition_slug', 'specialty_slug', 'created_by'];

// Manually adapted from shared/constants/condition-slugs.json version
// 1.0.0, the same duplication-by-convention DoctorAssignedCondition.gs's
// own allowlist already established (a distinctly-named copy, not a shared
// global, to avoid a cross-file static-analysis collision) — update both
// places by hand if the canonical list ever changes, per shared/README.md's
// rule.
var FOUNDATION_APPOINTMENT_ALLOWED_CONDITION_SLUGS_ = [
  'mcas',
  'hashimotos-thyroiditis',
  'chronic-urticaria',
  'eczema',
  'allergic-rhinitis',
  'eosinophilic-esophagitis',
  'pots',
  'dermographism'
];

// A row's own current status determines which target statuses are a valid,
// one-way transition — never reverted, never re-entered once terminal.
var FOUNDATION_APPOINTMENT_TRANSITIONS_ = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new appointment. `condition_slug`/`created_by` are
 * required; `patient_id`/`doctor_id` are optional (docs/50 §8's nullable
 * fields) but, when supplied, must be a non-empty string — the deeper
 * check that a supplied patient_id/doctor_id actually references a real
 * row requires a Sheets read and happens in foundationCreateAppointment_()
 * itself, mirroring foundationCreateDoctorInstruction_()'s "pure shape
 * check first, stateful check after" discipline.
 */
function foundationValidateCreateAppointmentInput_(input) {
  var errors = [];
  if (!input || typeof input.condition_slug !== 'string' || FOUNDATION_APPOINTMENT_ALLOWED_CONDITION_SLUGS_.indexOf(input.condition_slug) === -1) {
    errors.push('condition_slug must be one of the canonical condition slugs.');
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (staff/doctor identifier) is required.');
  }
  if (input && input.patient_id !== undefined && input.patient_id !== null && input.patient_id !== ''
    && (typeof input.patient_id !== 'string' || input.patient_id.trim() === '')) {
    errors.push('patient_id must be a non-empty string when provided.');
  }
  if (input && input.doctor_id !== undefined && input.doctor_id !== null && input.doctor_id !== ''
    && (typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '')) {
    errors.push('doctor_id must be a non-empty string when provided.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a confirm operation's own input shape — whether
 * `appointment_id` actually resolves to an existing, 'requested' row is
 * checked by foundationConfirmAppointment_() itself, since that check
 * requires a Sheets read.
 */
function foundationValidateConfirmAppointmentInput_(input) {
  var errors = [];
  if (!input || typeof input.appointment_id !== 'string' || input.appointment_id.trim() === '') {
    errors.push('appointment_id is required.');
  }
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required to confirm an appointment.');
  }
  if (!input || typeof input.scheduled_at !== 'string' || input.scheduled_at.trim() === '') {
    errors.push('scheduled_at is required to confirm an appointment.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a status-update operation's own input shape ('completed' or
 * 'cancelled' only — 'confirmed' has its own dedicated operation, above,
 * since it requires doctor_id/scheduled_at too). Whether `appointment_id`
 * actually resolves to an existing row in a state that allows this
 * transition is checked by foundationUpdateAppointmentStatus_() itself.
 */
function foundationValidateUpdateAppointmentStatusInput_(input) {
  var errors = [];
  if (!input || typeof input.appointment_id !== 'string' || input.appointment_id.trim() === '') {
    errors.push('appointment_id is required.');
  }
  if (!input || (input.status !== 'completed' && input.status !== 'cancelled')) {
    errors.push('status must be one of: completed, cancelled.');
  }
  return errors;
}

/**
 * Builds a new, 'requested' Appointment record (shared/schemas/
 * appointment.schema.json). doctor_id/scheduled_at always start as
 * empty-string sentinels — neither is known until the confirm operation.
 * specialty_slug is always server-derived from condition_slug
 * (SpecialtyRegistry.gs's foundationGetSpecialtyForCondition_()), never
 * accepted from `input`.
 */
function foundationBuildAppointmentRecord_(input, appointmentId, nowIso) {
  return {
    appointment_id: appointmentId,
    patient_id: input.patient_id ? input.patient_id.trim() : '',
    doctor_id: '',
    requested_at: nowIso,
    scheduled_at: '',
    status: 'requested',
    condition_slug: input.condition_slug,
    specialty_slug: foundationGetSpecialtyForCondition_(input.condition_slug),
    created_by: input.created_by.trim()
  };
}

// ---- Sheets-backed operations ----

/**
 * Creates a new, 'requested' Appointment row. Staff/doctor-only —
 * input.patient_id/input.doctor_id are caller-supplied here (there is no
 * patient session at booking-intake time, and no doctor is assigned yet;
 * see this file's own header comment), never session-derived. Validation
 * failure is an expected outcome (direct envelope, not the generic
 * wrapper), the same convention every other Foundation entity's input
 * validation already follows. Rejects a supplied patient_id/doctor_id that
 * does not reference a real Patient Identity/Doctor — the same "referenced
 * entity must be real" discipline foundationCreateDoctorInstruction_()
 * already applies to its own care_plan_id reference.
 */
function foundationCreateAppointment_(input) {
  var errors = foundationValidateCreateAppointmentInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  if (input.patient_id) {
    var patientCheck = foundationGetPatientById_(input.patient_id.trim());
    if (patientCheck.status === 'error' && patientCheck.error.code !== 'FOUNDATION_NOT_FOUND') {
      return patientCheck; // unexpected failure — already a safe, generic envelope
    }
    if (patientCheck.status === 'error') {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must reference an existing Patient Identity when provided.');
    }
  }
  return withFoundationErrorHandling_(function () {
    var appointmentId = generateFoundationId_();
    var record = foundationBuildAppointmentRecord_(input, appointmentId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_APPOINTMENTS_SHEET_, FOUNDATION_APPOINTMENTS_COLUMNS_, record);
    foundationLogAuditEvent_('appointment_requested', record.patient_id, record.created_by, 'appointment_id=' + appointmentId + ' condition_slug=' + record.condition_slug);
    return record;
  });
}

/**
 * Confirms an existing, 'requested' Appointment row — assigns doctor_id and
 * scheduled_at, transitioning status to 'confirmed'. Staff/doctor-only.
 * Rejects (FOUNDATION_INVALID_INPUT) an unknown appointment_id, one that is
 * not currently 'requested', or a doctor_id that does not reference a real
 * Doctor — a one-way, exactly-once transition, never idempotent, never
 * reversible, mirroring foundationResolveCondition_()'s own discipline
 * exactly.
 */
function foundationConfirmAppointment_(input) {
  var errors = foundationValidateConfirmAppointmentInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var appointmentId = input.appointment_id.trim();
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_APPOINTMENTS_SHEET_, FOUNDATION_APPOINTMENTS_COLUMNS_, 'appointment_id', appointmentId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (!lookup.data || lookup.data.status !== 'requested') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'appointment_id must reference an existing, requested appointment.');
  }
  var doctorId = input.doctor_id.trim();
  var doctorLookup = foundationGetDoctorById_(doctorId);
  if (doctorLookup.status === 'error' && doctorLookup.error.code !== 'FOUNDATION_NOT_FOUND') {
    return doctorLookup; // unexpected failure — already a safe, generic envelope
  }
  if (doctorLookup.status === 'error') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'doctor_id must reference an existing Doctor.');
  }
  var existing = lookup.data;
  return withFoundationErrorHandling_(function () {
    var scheduledAt = input.scheduled_at.trim();
    foundationDsUpdateById_(FOUNDATION_APPOINTMENTS_SHEET_, FOUNDATION_APPOINTMENTS_COLUMNS_, 'appointment_id', appointmentId, {
      status: 'confirmed',
      doctor_id: doctorId,
      scheduled_at: scheduledAt
    });
    foundationLogAuditEvent_('appointment_confirmed', existing.patient_id, doctorId, 'appointment_id=' + appointmentId);
    existing.status = 'confirmed';
    existing.doctor_id = doctorId;
    existing.scheduled_at = scheduledAt;
    return existing;
  });
}

/**
 * Transitions an existing Appointment row to input.status ('completed' or
 * 'cancelled'), enforcing FOUNDATION_APPOINTMENT_TRANSITIONS_'s allowed,
 * one-way transitions from the row's own current status. Staff/doctor-only.
 * Rejects (FOUNDATION_INVALID_INPUT) an unknown appointment_id or a
 * transition not permitted from the row's current status.
 */
function foundationUpdateAppointmentStatus_(input) {
  var errors = foundationValidateUpdateAppointmentStatusInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var appointmentId = input.appointment_id.trim();
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_APPOINTMENTS_SHEET_, FOUNDATION_APPOINTMENTS_COLUMNS_, 'appointment_id', appointmentId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  var existing = lookup.data;
  var allowedTargets = existing ? FOUNDATION_APPOINTMENT_TRANSITIONS_[existing.status] || [] : [];
  if (!existing || allowedTargets.indexOf(input.status) === -1) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'appointment_id must reference an existing appointment whose current status allows this transition.');
  }
  return withFoundationErrorHandling_(function () {
    foundationDsUpdateById_(FOUNDATION_APPOINTMENTS_SHEET_, FOUNDATION_APPOINTMENTS_COLUMNS_, 'appointment_id', appointmentId, { status: input.status });
    foundationLogAuditEvent_('appointment_' + input.status, existing.patient_id, existing.doctor_id, 'appointment_id=' + appointmentId);
    existing.status = input.status;
    return existing;
  });
}

/**
 * Returns `doctorId`'s derived Appointments view: every Appointment whose
 * specialty_slug matches the doctor's own specialty_slug (the implicit
 * default specialty if the doctor has none set, docs/50 §6.3) — the same
 * specialty-derivation discipline DoctorPatientRoster.gs's patient roster
 * already establishes, including its own disclosed multi-doctor-per-
 * specialty limitation (docs/50 §7.4, docs/51 Part 1.6). Each entry is
 * enriched with the linked patient's own full_name, when patient_id is
 * non-empty, for doctor-facing display — mirrors the roster's own
 * patient-name join exactly. Sorted requested_at descending (newest
 * first), mirroring get_doctor_instructions/get_care_plan's own "newest
 * first" convention. `doctorId` must already be DoctorSession-verified by
 * the caller — this function never re-derives it.
 */
function foundationGetDoctorAppointments_(doctorId) {
  var doctorLookup = foundationGetDoctorById_(doctorId);
  if (doctorLookup.status === 'error') {
    return doctorLookup; // FOUNDATION_NOT_FOUND or an unexpected failure — already a safe envelope
  }
  return withFoundationErrorHandling_(function () {
    var doctorSpecialtySlug = doctorLookup.data.specialty_slug || FOUNDATION_DEFAULT_SPECIALTY_SLUG_;

    var matching = foundationDsQuery_(FOUNDATION_APPOINTMENTS_SHEET_, FOUNDATION_APPOINTMENTS_COLUMNS_, function (row) {
      return row.specialty_slug === doctorSpecialtySlug;
    });

    var indexed = matching.map(function (row, i) { return { row: row, insertionIndex: i }; });
    indexed.sort(function (a, b) {
      if (a.row.requested_at !== b.row.requested_at) {
        return a.row.requested_at < b.row.requested_at ? 1 : -1;
      }
      return b.insertionIndex - a.insertionIndex;
    });

    return indexed.map(function (entry) {
      var row = entry.row;
      var patientLookup = row.patient_id ? foundationGetPatientById_(row.patient_id) : null;
      return {
        appointment_id: row.appointment_id,
        patient_id: row.patient_id,
        patient_full_name: (patientLookup && patientLookup.status === 'ok') ? patientLookup.data.full_name : '',
        doctor_id: row.doctor_id,
        requested_at: row.requested_at,
        scheduled_at: row.scheduled_at,
        status: row.status,
        condition_slug: row.condition_slug,
        specialty_slug: row.specialty_slug
      };
    });
  });
}

// ---- Manually-run wrappers (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after transcribing an
 * accepted contact.html/Netlify Forms booking submission's details below.
 * Not a Web App endpoint — this batch's disclosed intake-mechanism decision
 * (see this file's own header comment), mirroring
 * DoctorAssignedCondition.gs's assignFoundationCondition() precedent
 * exactly. Leave patient_id blank ('') for a first-time visitor with no
 * Patient Identity yet.
 */
function createFoundationAppointment() {
  var result = foundationCreateAppointment_({
    patient_id: '',
    condition_slug: 'EDIT ME BEFORE RUNNING',
    created_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real appointment/doctor/scheduling
 * details. Not a Web App endpoint, for the same reason
 * createFoundationAppointment() isn't.
 */
function confirmFoundationAppointment() {
  var result = foundationConfirmAppointment_({
    appointment_id: 'EDIT ME BEFORE RUNNING',
    doctor_id: 'EDIT ME BEFORE RUNNING',
    scheduled_at: 'EDIT ME BEFORE RUNNING' // e.g. '2026-07-20T10:00:00.000Z'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real appointment details. Not a Web
 * App endpoint, for the same reason createFoundationAppointment() isn't.
 */
function updateFoundationAppointmentStatus() {
  var result = foundationUpdateAppointmentStatus_({
    appointment_id: 'EDIT ME BEFORE RUNNING',
    status: 'EDIT ME BEFORE RUNNING' // completed | cancelled
  });
  Logger.log(JSON.stringify(result));
  return result;
}
