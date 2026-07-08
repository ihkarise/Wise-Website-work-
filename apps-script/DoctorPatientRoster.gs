/**
 * Doctor Patient Roster — Batch WPI-4 (docs/50-PHASE-3-TECHNICAL-PLAN.md
 * §7.4/§19; docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every
 * later WPI batch). Implements the Doctor Dashboard's one shipped
 * capability this batch registers (shared/constants/
 * doctor-module-registry.json's `patient_roster` entry, ADR-020).
 *
 * A derived, read-only view — no new stored entity (docs/50 §7.4's own
 * "derived, not a new entity" design). A doctor's roster is every patient
 * with an active DoctorAssignedCondition (DoctorAssignedCondition.gs) whose
 * condition_slug maps (SpecialtyRegistry.gs's
 * foundationGetSpecialtyForCondition_()) to the doctor's own
 * specialty_slug (DoctorIdentity.gs). A doctor with no specialty_slug set
 * is scoped to the platform's implicit default specialty, mirroring an
 * unscoped registry entry's own "visible regardless of specialty"
 * treatment (docs/50 §6.3).
 *
 * Disclosed limitation (docs/50 §7.4, docs/51 Part 1.6): at real
 * multi-doctor-per-specialty scale, this derivation returns every patient
 * in the specialty to every doctor in that specialty, not a personal,
 * per-doctor roster — accepted as this batch's scope, unchanged from
 * docs/50/docs/52's own disclosure. A single-doctor-per-specialty
 * deployment (the platform's actual scale today) sees no practical
 * difference.
 *
 * Read-only, doctor-facing — the one new FoundationRouter.gs dispatch case
 * this batch adds (get_doctor_patient_roster) derives doctor_id
 * exclusively from a verified DoctorSession, mirroring
 * get_doctor_module_states's exact WPI-3 precedent. No write path exists
 * for this entity — it has no schema of its own to write against (docs/50
 * §7.4's "no new entity").
 *
 * Depends on DoctorIdentity.gs, DoctorAssignedCondition.gs,
 * SpecialtyRegistry.gs, PatientIdentity.gs, FoundationDataStore.gs,
 * FoundationErrorHandling.gs. Zero modification to any of those
 * frozen/already-shipped files.
 */

/**
 * Returns `doctorId`'s derived patient roster: one entry per distinct
 * patient with at least one active DoctorAssignedCondition whose
 * condition_slug maps to the doctor's own specialty_slug (the implicit
 * default specialty if the doctor has none set, docs/50 §6.3). Sorted by
 * full_name, then patient_id, for stable, deterministic output. `doctorId`
 * must already be DoctorSession-verified by the caller for the
 * doctor-facing route — this function never re-derives it.
 */
function foundationGetDoctorPatientRoster_(doctorId) {
  var doctorLookup = foundationGetDoctorById_(doctorId);
  if (doctorLookup.status === 'error') {
    return doctorLookup; // FOUNDATION_NOT_FOUND or an unexpected failure — already a safe envelope
  }
  return withFoundationErrorHandling_(function () {
    var doctorSpecialtySlug = doctorLookup.data.specialty_slug || FOUNDATION_DEFAULT_SPECIALTY_SLUG_;

    var matchingAssignments = foundationDsQuery_(FOUNDATION_CONDITION_ASSIGNMENTS_SHEET_, FOUNDATION_CONDITION_ASSIGNMENTS_COLUMNS_, function (row) {
      return row.status === 'active' && foundationGetSpecialtyForCondition_(row.condition_slug) === doctorSpecialtySlug;
    });

    var conditionSlugsByPatientId = {};
    matchingAssignments.forEach(function (row) {
      if (!conditionSlugsByPatientId[row.patient_id]) {
        conditionSlugsByPatientId[row.patient_id] = [];
      }
      if (conditionSlugsByPatientId[row.patient_id].indexOf(row.condition_slug) === -1) {
        conditionSlugsByPatientId[row.patient_id].push(row.condition_slug);
      }
    });

    var roster = Object.keys(conditionSlugsByPatientId).map(function (patientId) {
      var patientLookup = foundationGetPatientById_(patientId);
      return {
        patient_id: patientId,
        full_name: patientLookup.status === 'ok' ? patientLookup.data.full_name : '',
        condition_slugs: conditionSlugsByPatientId[patientId]
      };
    }).filter(function (entry) {
      // A DoctorAssignedCondition row referencing a patient_id with no
      // matching Patient record is a data-consistency issue outside this
      // derived view's own scope to repair — omitted rather than
      // surfaced as a roster entry with no real patient behind it.
      return entry.full_name !== '';
    });

    roster.sort(function (a, b) {
      if (a.full_name !== b.full_name) return a.full_name < b.full_name ? -1 : 1;
      return a.patient_id < b.patient_id ? -1 : (a.patient_id > b.patient_id ? 1 : 0);
    });

    return roster;
  });
}
