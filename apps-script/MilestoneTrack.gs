/**
 * Milestone Track — Batch PXP-11 (Phase 2C — Health Milestones,
 * docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §6/§7/§11.1/§11.3/§17,
 * ADR-027; docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch process is reused as
 * this batch's own standard, the identical role docs/47 played for Phase 2B).
 * Implements shared/schemas/milestone-track.schema.json version 1.0.0 — the per-patient,
 * doctor-set care-start anchor the 30/90/180/365-day Health Milestone schedule counts
 * from.
 *
 * Non-AI by construction (ADR-027, docs/58 §5/§8): this file makes no model call, no
 * UrlFetchApp request, and computes nothing with AI — the schedule is a pure,
 * deterministic function of the doctor-set care_start_date, mirroring Analytics.gs's/
 * Digital Twin's own "computed view, never a stored table" discipline exactly (docs/33
 * §7.6/§3.5). validation/static-analysis/analyze.js's Milestone static rule 1 (docs/58
 * §23 item 1) enforces the no-AI boundary at the code level.
 *
 * Not Foundation-prefixed, for the same reason CarePlan.gs/DoctorInstruction.gs/
 * MedicationHistory.gs aren't (docs/29 §2): a concrete entity built on Foundation's
 * frozen infrastructure, not infrastructure itself.
 *
 * Doctor/staff-owned, a hard boundary (docs/58 §10/§11.1): the patient never sets,
 * edits, or pauses a track. Real Doctor identity/session exists (Batch WPI-1), so — unlike
 * CarePlan.gs's own pre-WPI-1 manually-run editor precedent — set_milestone_track is a
 * real, DoctorSession-guarded route (FoundationRouter.gs), input.doctor_id always
 * DoctorSession-derived by the caller, patient_id roster-validated (reuses
 * DoctorPatientRoster.gs unmodified, ADR-009). One active track row per patient —
 * upsert-style, mirroring FoundationPatientProfile.gs's own one-per-patient upsert
 * discipline (PXP-1).
 *
 * The care-start anchor is introduced explicitly rather than silently overloading a
 * frozen Foundation field (Patient.created_at is onboarding, not clinical care-start;
 * Consultation is Conceptual) — docs/58 §0.3's disclosed honest-gap discipline.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/PXP-1..10/
 * WPI-1..12 file — reuses FoundationDataStore.gs's/FoundationAudit.gs's existing generic
 * operations, DoctorPatientRoster.gs's existing foundationGetDoctorPatientRoster_(), and
 * CarePlan.gs's existing foundationIsValidCalendarDate_() exactly as each was already
 * designed to be reused (ADR-009).
 *
 * Depends on DoctorPatientRoster.gs, FoundationDataStore.gs, FoundationAudit.gs,
 * FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs, and
 * CarePlan.gs (foundationIsValidCalendarDate_, reused not re-declared).
 */

var FOUNDATION_MILESTONE_TRACKS_SHEET_ = 'MilestoneTracks';
var FOUNDATION_MILESTONE_TRACKS_COLUMNS_ = ['track_id', 'patient_id', 'care_start_date', 'status', 'created_by', 'created_at', 'updated_at'];

// The four fixed milestone points (docs/21, docs/58 §7). Deliberately a closed set —
// any future additional point is a separate, disclosed decision, never a silent widening.
var FOUNDATION_MILESTONE_TYPES_ = ['30_day', '90_day', '6_month', '1_year'];

var FOUNDATION_MILESTONE_TRACK_STATUSES_ = ['active', 'paused'];

// A milestone point stays "due" for this many days after its target date before it
// reads "overdue" — the grace window docs/58 §7/§22 deliberately left as an
// implementation-time decision, fixed here and disclosed in this batch's own roadmap entry.
var FOUNDATION_MILESTONE_DUE_GRACE_DAYS_ = 14;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Formats a Date object as a UTC YYYY-MM-DD calendar-date string. Named uniquely (never a
 * second global colliding with any existing date helper) per the platform's own
 * duplicate-global static rule.
 */
function foundationFormatMilestoneDate_(dateObj) {
  var y = dateObj.getUTCFullYear();
  var m = dateObj.getUTCMonth() + 1;
  var d = dateObj.getUTCDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
}

/**
 * Returns the target calendar date (YYYY-MM-DD) for one milestone point, counting from
 * `careStartDate`. 30_day/90_day add exact days; 6_month/1_year add calendar months/years
 * (Date.UTC normalizes month/day overflow deterministically). Returns null for an
 * unrecognized milestoneType (never guessed).
 */
function foundationMilestoneTargetDate_(careStartDate, milestoneType) {
  var parts = careStartDate.split('-');
  var y = Number(parts[0]);
  var mo = Number(parts[1]) - 1;
  var d = Number(parts[2]);
  var date;
  if (milestoneType === '30_day') { date = new Date(Date.UTC(y, mo, d + 30)); }
  else if (milestoneType === '90_day') { date = new Date(Date.UTC(y, mo, d + 90)); }
  else if (milestoneType === '6_month') { date = new Date(Date.UTC(y, mo + 6, d)); }
  else if (milestoneType === '1_year') { date = new Date(Date.UTC(y, mo + 12, d)); }
  else { return null; }
  return foundationFormatMilestoneDate_(date);
}

/**
 * Derives one milestone point's presentational state (docs/58 §7) — deterministic, never
 * stored, never itself a write. `isCompleted` is true only when a *published*
 * MilestoneReview exists for this point (a draft never completes a milestone, docs/58 §5
 * item 3/ADR-027). YYYY-MM-DD strings compare lexicographically in true date order.
 */
function foundationMilestonePointState_(targetDate, todayDate, isCompleted) {
  if (isCompleted) return 'completed';
  if (todayDate < targetDate) return 'upcoming';
  var tp = targetDate.split('-');
  var graceEnd = foundationFormatMilestoneDate_(new Date(Date.UTC(Number(tp[0]), Number(tp[1]) - 1, Number(tp[2]) + FOUNDATION_MILESTONE_DUE_GRACE_DAYS_)));
  if (todayDate <= graceEnd) return 'due';
  return 'overdue';
}

/**
 * Computes the full milestone schedule (the four points, each with its target_date and
 * derived state) as a pure function of the anchor `careStartDate`, the set of milestone
 * types with a published review (`completedTypes`), and `todayDate` (YYYY-MM-DD). A
 * computed view — never a stored entity (docs/58 §7/§11.3, ADR-027). Recomputed on every
 * read, so a corrected anchor transparently re-dates every not-yet-completed point with
 * zero stored-state migration.
 */
function foundationComputeMilestoneSchedule_(careStartDate, completedTypes, todayDate) {
  return FOUNDATION_MILESTONE_TYPES_.map(function (milestoneType) {
    var target = foundationMilestoneTargetDate_(careStartDate, milestoneType);
    var isCompleted = completedTypes.indexOf(milestoneType) !== -1;
    return {
      milestone_type: milestoneType,
      target_date: target,
      state: foundationMilestonePointState_(target, todayDate, isCompleted)
    };
  });
}

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * set_milestone_track request's own shape. Whether patient_id is on the caller's roster is
 * checked by foundationSetMilestoneTrack_() itself, since that requires a Sheets read.
 */
function foundationValidateMilestoneTrackInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.care_start_date !== 'string' || !foundationIsValidCalendarDate_(input.care_start_date)) {
    errors.push('care_start_date must be a real calendar date (YYYY-MM-DD).');
  }
  if (input && input.status !== undefined && input.status !== null && input.status !== ''
    && FOUNDATION_MILESTONE_TRACK_STATUSES_.indexOf(input.status) === -1) {
    errors.push('status, when provided, must be one of: active, paused.');
  }
  return errors;
}

function foundationMilestoneTrackRowToApiShape_(row) {
  return {
    track_id: row.track_id,
    patient_id: row.patient_id,
    care_start_date: row.care_start_date,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// ---- Sheets-backed operations ----

/**
 * Returns `patientId`'s single MilestoneTrack row, or null if a doctor has not yet set a
 * care-start anchor for this patient (not an error — the same "not yet configured is not
 * an error" discipline CarePlan.gs's own unassigned-patient outcome already established).
 * `patientId` must already be resolved (roster-validated or session-derived) by the caller.
 */
function foundationGetMilestoneTrackForPatient_(patientId) {
  return withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_MILESTONE_TRACKS_SHEET_, FOUNDATION_MILESTONE_TRACKS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    return rows.length ? rows[0] : null;
  });
}

/**
 * Creates or updates (upsert) `input.patient_id`'s single MilestoneTrack — the doctor's
 * own deliberate care-start-anchor action (docs/58 §6). Doctor-only; input.doctor_id must
 * already be DoctorSession-derived by the caller. Rejects (FOUNDATION_INVALID_INPUT) a
 * malformed request or a patient_id outside the caller's own derived roster. One active row
 * per patient — a second call for the same patient updates that one row's
 * care_start_date/status (stamping updated_at), never inserting a second, mirroring
 * FoundationPatientProfile.gs's own upsert discipline (PXP-1).
 */
function foundationSetMilestoneTrack_(input) {
  var errors = foundationValidateMilestoneTrackInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var patientId = input.patient_id.trim();
  var careStartDate = input.care_start_date.trim();
  var status = (input.status && String(input.status).trim()) || 'active';

  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === patientId; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must belong to your own patient roster.');
  }

  var existingLookup = foundationGetMilestoneTrackForPatient_(patientId);
  if (existingLookup.status === 'error') {
    return existingLookup;
  }
  var existing = existingLookup.data;

  return withFoundationErrorHandling_(function () {
    var nowIso = foundationNowIso_();
    if (existing) {
      foundationDsUpdateById_(FOUNDATION_MILESTONE_TRACKS_SHEET_, FOUNDATION_MILESTONE_TRACKS_COLUMNS_, 'track_id', existing.track_id, {
        care_start_date: careStartDate,
        status: status,
        updated_at: nowIso
      });
      foundationLogAuditEvent_('milestone_track_updated', patientId, doctorId, 'track_id=' + existing.track_id + ';care_start_date=' + careStartDate + ';status=' + status);
      var updated = foundationDsGetById_(FOUNDATION_MILESTONE_TRACKS_SHEET_, FOUNDATION_MILESTONE_TRACKS_COLUMNS_, 'track_id', existing.track_id);
      return foundationMilestoneTrackRowToApiShape_(updated);
    }
    var record = {
      track_id: generateFoundationId_(),
      patient_id: patientId,
      care_start_date: careStartDate,
      status: status,
      created_by: doctorId,
      created_at: nowIso,
      updated_at: ''
    };
    foundationDsInsert_(FOUNDATION_MILESTONE_TRACKS_SHEET_, FOUNDATION_MILESTONE_TRACKS_COLUMNS_, record);
    foundationLogAuditEvent_('milestone_track_created', patientId, doctorId, 'track_id=' + record.track_id + ';care_start_date=' + careStartDate);
    return foundationMilestoneTrackRowToApiShape_(record);
  });
}
