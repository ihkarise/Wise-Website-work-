/**
 * Milestone Review — Batch PXP-11 (Phase 2C — Health Milestones,
 * docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §7/§10/§11.2/§11.3/§17,
 * ADR-027). Implements shared/schemas/milestone-review.schema.json version 1.0.0 — one
 * doctor-authored progress review per (patient, milestone_type), plus this batch's
 * assembled read surface (the computed Milestone Schedule from MilestoneTrack.gs joined
 * with the patient's own reviews).
 *
 * Non-AI by construction (ADR-027, docs/58 §5/§8): every review field is doctor-typed —
 * this file makes no model call, no UrlFetchApp request, and never reads another entity's
 * data into a review field (docs/58 §5 item 2). validation/static-analysis/analyze.js's
 * Milestone static rules 1 and 2 (docs/58 §23) enforce both boundaries at the code level.
 *
 * Doctor-authored/patient-viewable, a hard boundary mirroring CarePlan.gs exactly (docs/58
 * §10): the patient never authors, edits, publishes, or deletes a review, and never sees a
 * `draft` — the one-way `draft` -> `published` transition (publish_milestone_review) is the
 * sole patient-visibility boundary, enforced server-side (foundationGetHealthMilestonesForPatient_
 * returns published rows only), not by UI hiding alone. doctor_id is always
 * DoctorSession-derived by the caller; patient_id is roster-validated (reuses
 * DoctorPatientRoster.gs unmodified, ADR-009).
 *
 * At most one review per (patient_id, milestone_type) — save_milestone_review upserts the
 * one draft for a point (rejecting any content edit once it is published), mirroring the
 * platform's own one-active-artifact-per-key discipline.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient Access/PXP-1..10/
 * WPI-1..12 file — reuses FoundationDataStore.gs's/FoundationAudit.gs's existing generic
 * operations, DoctorPatientRoster.gs's foundationGetDoctorPatientRoster_(), and
 * MilestoneTrack.gs's foundationComputeMilestoneSchedule_()/foundationGetMilestoneTrackForPatient_()
 * exactly as each was designed to be reused (ADR-009).
 *
 * Depends on MilestoneTrack.gs, DoctorPatientRoster.gs, FoundationDataStore.gs,
 * FoundationAudit.gs, FoundationUtils.gs, FoundationContracts.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_MILESTONE_REVIEWS_SHEET_ = 'MilestoneReviews';
var FOUNDATION_MILESTONE_REVIEWS_COLUMNS_ = [
  'review_id', 'patient_id', 'track_id', 'milestone_type', 'target_date',
  'progress_summary', 'improvements', 'medicines_review', 'investigations',
  'recommendations', 'next_goals', 'status', 'authored_by', 'created_at',
  'updated_at', 'published_at'
];

var FOUNDATION_MILESTONE_REVIEW_STATUSES_ = ['draft', 'published'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is valid) for a
 * save_milestone_review request's own shape. Whether the patient is on the caller's roster
 * and has a MilestoneTrack, and whether the target review is already published, are checked
 * by foundationSaveMilestoneReview_() itself (all require a Sheets read).
 */
function foundationValidateSaveMilestoneReviewInput_(input) {
  var errors = [];
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required.');
  }
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || FOUNDATION_MILESTONE_TYPES_.indexOf(input.milestone_type) === -1) {
    errors.push('milestone_type must be one of: 30_day, 90_day, 6_month, 1_year.');
  }
  if (!input || typeof input.progress_summary !== 'string' || input.progress_summary.trim() === '') {
    errors.push('progress_summary is required.');
  }
  return errors;
}

function foundationMilestoneReviewRowToApiShape_(row) {
  return {
    review_id: row.review_id,
    patient_id: row.patient_id,
    track_id: row.track_id,
    milestone_type: row.milestone_type,
    target_date: row.target_date,
    progress_summary: row.progress_summary,
    improvements: row.improvements,
    medicines_review: row.medicines_review,
    investigations: row.investigations,
    recommendations: row.recommendations,
    next_goals: row.next_goals,
    status: row.status,
    authored_by: row.authored_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at
  };
}

/**
 * Normalizes one optional, free-text review-content field to a trimmed string ('' when
 * absent) — the same empty-string-sentinel discipline every other Sheet-backed entity
 * already uses for its own optional string columns.
 */
function foundationMilestoneReviewField_(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

// ---- Sheets-backed operations ----

/**
 * Creates or updates (upsert) the single `draft` MilestoneReview for `input.patient_id` +
 * `input.milestone_type` — the doctor's own authoring action (docs/58 §10.1). Doctor-only;
 * input.doctor_id must already be DoctorSession-derived by the caller. Rejects
 * (FOUNDATION_INVALID_INPUT) a malformed request, a patient_id outside the caller's own
 * roster, a patient with no MilestoneTrack anchor set yet (docs/58 §6 item 3 — a review
 * cannot exist without a schedule), or an attempt to edit an already-`published` review's
 * content (one-way, docs/58 §10.3). target_date is server-computed from the track's own
 * care_start_date — never client-supplied.
 */
function foundationSaveMilestoneReview_(input) {
  var errors = foundationValidateSaveMilestoneReviewInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var doctorId = input.doctor_id.trim();
  var patientId = input.patient_id.trim();
  var milestoneType = input.milestone_type;

  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === patientId; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must belong to your own patient roster.');
  }

  var trackLookup = foundationGetMilestoneTrackForPatient_(patientId);
  if (trackLookup.status === 'error') {
    return trackLookup;
  }
  var track = trackLookup.data;
  if (!track) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'Set this patient\'s care-start date first — a milestone review needs a schedule to belong to.');
  }
  var targetDate = foundationMilestoneTargetDate_(track.care_start_date, milestoneType);

  var existingLookup = withFoundationErrorHandling_(function () {
    var rows = foundationDsQuery_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, function (row) {
      return row.patient_id === patientId && row.milestone_type === milestoneType;
    });
    return rows.length ? rows[0] : null;
  });
  if (existingLookup.status === 'error') {
    return existingLookup;
  }
  var existing = existingLookup.data;
  if (existing && existing.status === 'published') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'This milestone review is already published and can no longer be edited.');
  }

  return withFoundationErrorHandling_(function () {
    var nowIso = foundationNowIso_();
    var patch = {
      target_date: targetDate,
      progress_summary: input.progress_summary.trim(),
      improvements: foundationMilestoneReviewField_(input.improvements),
      medicines_review: foundationMilestoneReviewField_(input.medicines_review),
      investigations: foundationMilestoneReviewField_(input.investigations),
      recommendations: foundationMilestoneReviewField_(input.recommendations),
      next_goals: foundationMilestoneReviewField_(input.next_goals)
    };
    if (existing) {
      patch.updated_at = nowIso;
      foundationDsUpdateById_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, 'review_id', existing.review_id, patch);
      foundationLogAuditEvent_('milestone_review_saved', patientId, doctorId, 'review_id=' + existing.review_id + ';milestone_type=' + milestoneType);
      var updated = foundationDsGetById_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, 'review_id', existing.review_id);
      return foundationMilestoneReviewRowToApiShape_(updated);
    }
    var record = {
      review_id: generateFoundationId_(),
      patient_id: patientId,
      track_id: track.track_id,
      milestone_type: milestoneType,
      target_date: targetDate,
      progress_summary: patch.progress_summary,
      improvements: patch.improvements,
      medicines_review: patch.medicines_review,
      investigations: patch.investigations,
      recommendations: patch.recommendations,
      next_goals: patch.next_goals,
      status: 'draft',
      authored_by: doctorId,
      created_at: nowIso,
      updated_at: '',
      published_at: ''
    };
    foundationDsInsert_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, record);
    foundationLogAuditEvent_('milestone_review_created', patientId, doctorId, 'review_id=' + record.review_id + ';milestone_type=' + milestoneType);
    return foundationMilestoneReviewRowToApiShape_(record);
  });
}

/**
 * Publishes one MilestoneReview — the one-way `draft` -> `published` transition that makes
 * it patient-visible (docs/58 §10.2). Doctor-only; input.doctor_id must already be
 * DoctorSession-derived by the caller. Rejects (FOUNDATION_INVALID_INPUT) an unknown
 * review_id, one for a patient outside the caller's own roster, or a review already
 * published (one-way, exactly once — never reverted).
 */
function foundationPublishMilestoneReview_(input) {
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'doctor_id is required.');
  }
  if (!input || typeof input.review_id !== 'string' || input.review_id.trim() === '') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'review_id is required.');
  }
  var doctorId = input.doctor_id.trim();
  var reviewId = input.review_id.trim();

  var reviewLookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, 'review_id', reviewId);
  });
  if (reviewLookup.status === 'error') {
    return reviewLookup;
  }
  var review = reviewLookup.data;
  if (!review) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'review_id must reference an existing milestone review.');
  }
  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === review.patient_id; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'review_id must reference a patient on your own roster.');
  }
  if (review.status === 'published') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'This milestone review is already published.');
  }

  return withFoundationErrorHandling_(function () {
    var nowIso = foundationNowIso_();
    foundationDsUpdateById_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, 'review_id', reviewId, {
      status: 'published',
      published_at: nowIso
    });
    foundationLogAuditEvent_('milestone_review_published', review.patient_id, doctorId, 'review_id=' + reviewId + ';milestone_type=' + review.milestone_type);
    var published = foundationDsGetById_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, 'review_id', reviewId);
    return foundationMilestoneReviewRowToApiShape_(published);
  });
}

/**
 * Assembles one patient's Health Milestones view: the MilestoneTrack anchor (or null), the
 * deterministically-computed schedule (docs/58 §7), and the patient's MilestoneReview rows.
 * `includeDrafts` distinguishes the doctor view (true — every review, including drafts) from
 * the patient view (false — published reviews only). A milestone point reads `completed`
 * only when a *published* review exists for it, in both views (a draft never completes a
 * point, ADR-027). When no track exists, or the track is `paused`, the schedule is empty
 * (not surfaced, docs/58 §11.1) while any already-published reviews remain visible history.
 * `patientId` must already be resolved (roster-validated or session-derived) by the caller.
 */
function foundationGetMilestonesForPatient_(patientId, includeDrafts) {
  return withFoundationErrorHandling_(function () {
    var trackRows = foundationDsQuery_(FOUNDATION_MILESTONE_TRACKS_SHEET_, FOUNDATION_MILESTONE_TRACKS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    var track = trackRows.length ? foundationMilestoneTrackRowToApiShape_(trackRows[0]) : null;

    var reviewRows = foundationDsQuery_(FOUNDATION_MILESTONE_REVIEWS_SHEET_, FOUNDATION_MILESTONE_REVIEWS_COLUMNS_, function (row) {
      return row.patient_id === patientId;
    });
    var completedTypes = reviewRows
      .filter(function (row) { return row.status === 'published'; })
      .map(function (row) { return row.milestone_type; });

    var todayDate = foundationNowIso_().slice(0, 10);
    var schedule = (track && track.status === 'active')
      ? foundationComputeMilestoneSchedule_(track.care_start_date, completedTypes, todayDate)
      : [];

    var visibleReviews = reviewRows
      .filter(function (row) { return includeDrafts || row.status === 'published'; })
      .map(foundationMilestoneReviewRowToApiShape_);

    return { track: track, schedule: schedule, reviews: visibleReviews };
  });
}

/**
 * get_health_milestones (patient route, docs/58 §17) — the caller's own computed schedule
 * and published reviews only. `patientId` is always PatientSession-derived by the caller;
 * any client-supplied patient_id is ignored upstream.
 */
function foundationGetHealthMilestonesForPatient_(patientId) {
  var result = foundationGetMilestonesForPatient_(patientId, false);
  if (result.status === 'error') {
    return result;
  }
  return buildFoundationOkEnvelope_(result.data);
}

/**
 * get_patient_milestones (doctor route, docs/58 §17) — one roster patient's track, computed
 * schedule, and every review including drafts. Rejects (FOUNDATION_INVALID_INPUT) a missing
 * patient_id or one outside the caller's own derived roster. input.doctor_id must already be
 * DoctorSession-derived by the caller.
 */
function foundationGetPatientMilestonesForDoctor_(doctorId, requestedPatientId) {
  var patientId = (requestedPatientId || '').toString().trim();
  if (patientId === '') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id is required.');
  }
  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var onRoster = rosterLookup.data.some(function (entry) { return entry.patient_id === patientId; });
  if (!onRoster) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must belong to your own patient roster.');
  }
  var result = foundationGetMilestonesForPatient_(patientId, true);
  if (result.status === 'error') {
    return result;
  }
  return buildFoundationOkEnvelope_(result.data);
}
