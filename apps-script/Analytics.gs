/**
 * Analytics — Batch WPI-9 (docs/50-PHASE-3-TECHNICAL-PLAN.md §12/§19;
 * docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every later WPI
 * batch), benefiting from WPI-4 (patient roster derivation), WPI-7
 * (Inventory), and WPI-8 (PillFill Integration), per docs/50 §19's own
 * stated dependency. Implements docs/50 §12 / docs/33 §7.6's Analytics view.
 *
 * Not a stored entity — a computed, read-only, doctor-facing aggregate
 * view, mirroring Digital Twin's (docs/33 §3.5) and
 * DoctorPatientRoster.gs's own "derived, no new entity" discipline exactly.
 * No schema file exists for this view (docs/53 §5's schema requirement
 * applies only to stored entities) and no new Sheet is ever created.
 *
 * Every report below is a deterministic count/sum/rate over already-stored
 * rows, bounded to a fixed trailing FOUNDATION_ANALYTICS_WINDOW_DAYS_-day
 * window — never "all history" (docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md
 * §18 item 4's own forward constraint on this batch specifically, and
 * §12's own "Analytics' risk is aggregate read cost... every view
 * recomputes from scratch" finding). Never an AI-generated interpretation,
 * prediction, forecast, or recommendation (docs/50 §12's own hard
 * boundary; ADR-001/004/005/019 continue to gate any future AI narrative
 * layered on top of this data — not built here).
 *
 * Doctor/staff-facing only, never patient-facing (docs/50 §12's own
 * "Ownership" clause) — the one route this batch adds
 * (FoundationRouter.gs's get_doctor_analytics) derives doctor_id
 * exclusively from a verified DoctorSession, mirroring get_pillfill_orders
 * exactly. Read-only — there is nothing for this view to write.
 *
 * Reads across CheckInResponse.gs, CalculatorResult.gs, CarePlan.gs,
 * DoctorAssignedCondition.gs (via DoctorPatientRoster.gs's own derivation,
 * reused rather than re-implemented), InventoryItem.gs/
 * InventoryTransaction.gs, PillFillOrder.gs, and Appointment.gs — every
 * entity docs/50 §12 names, and no other. Specialty-scoped exactly as
 * every other doctor-facing view already scopes itself: the doctor's own
 * specialty_slug (or the implicit default, docs/50 §6.3) via
 * SpecialtyRegistry.gs for condition_slug-bearing rows (CheckInResponse),
 * via the doctor's own patient roster (DoctorPatientRoster.gs, reused) for
 * rows with no condition/specialty field of their own (CalculatorResult,
 * CarePlan), via InventoryItem.gs's existing specialty scoping
 * (foundationGetInventoryItemsForDoctor_(), reused, for
 * InventoryTransaction) and PillFillOrder.gs's existing specialty scoping
 * (foundationGetPillFillOrdersForDoctor_(), reused), and via Appointment.gs's
 * own specialty_slug field directly.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..11/WPI-1..8 file — reuses
 * foundationGetDoctorPatientRoster_(), foundationGetInventoryItemsForDoctor_(),
 * foundationGetPillFillOrdersForDoctor_(), FoundationDataStore.gs's existing
 * foundationDsQuery_(), and SpecialtyRegistry.gs's existing
 * foundationGetSpecialtyForCondition_(), exactly as each was already
 * designed to be reused (ADR-009).
 *
 * Depends on DoctorIdentity.gs, DoctorPatientRoster.gs, InventoryItem.gs,
 * PillFillOrder.gs, SpecialtyRegistry.gs, FoundationDataStore.gs,
 * FoundationUtils.gs, FoundationErrorHandling.gs.
 */

var FOUNDATION_ANALYTICS_WINDOW_DAYS_ = 30;

/**
 * Returns the fixed trailing window (ISO 8601 `from`/`to` strings) every
 * report in this file is bounded to — a rolling
 * FOUNDATION_ANALYTICS_WINDOW_DAYS_-day window ending "now", never "all
 * history" (docs/54 §18 item 4). `nowIso` is injectable for deterministic
 * testing; production callers always pass foundationNowIso_().
 */
function foundationGetAnalyticsWindow_(nowIso) {
  var to = new Date(nowIso);
  var from = new Date(to.getTime() - FOUNDATION_ANALYTICS_WINDOW_DAYS_ * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * True if `isoString` falls within `window` (inclusive), comparing ISO
 * 8601 strings lexically — safe because every timestamp this file compares
 * is always written by foundationNowIso_() (same fixed format, same UTC
 * offset), the same convention every other Foundation-family chronological
 * comparison in this codebase already relies on.
 */
function foundationIsWithinAnalyticsWindow_(isoString, window) {
  return typeof isoString === 'string' && isoString !== '' && isoString >= window.from && isoString <= window.to;
}

/**
 * Check-in completion within the window, scoped directly by
 * condition_slug -> specialty (SpecialtyRegistry.gs's own
 * foundationGetSpecialtyForCondition_()) — mirrors
 * DoctorPatientRoster.gs's own condition_slug-based specialty derivation
 * exactly; no roster join needed since CheckInResponse rows already carry
 * condition_slug. `completion_rate` is distinct_patients_checked_in /
 * rosterSize (0, never a division by zero, when rosterSize is 0).
 */
function foundationComputeCheckInCompletion_(doctorSpecialtySlug, window, rosterSize) {
  var matching = foundationDsQuery_(FOUNDATION_CHECKIN_RESPONSES_SHEET_, FOUNDATION_CHECKIN_RESPONSES_COLUMNS_, function (row) {
    return foundationIsWithinAnalyticsWindow_(row.logged_at, window) && foundationGetSpecialtyForCondition_(row.condition_slug) === doctorSpecialtySlug;
  });
  var distinctPatientIds = {};
  matching.forEach(function (row) { distinctPatientIds[row.patient_id] = true; });
  var distinctCount = Object.keys(distinctPatientIds).length;
  return {
    total_check_ins: matching.length,
    distinct_patients_checked_in: distinctCount,
    completion_rate: rosterSize > 0 ? distinctCount / rosterSize : 0
  };
}

/**
 * Care Plan version activity within the window, scoped to
 * `rosterPatientIds` (the doctor's own derived roster,
 * DoctorPatientRoster.gs, reused) — CarePlan rows carry no
 * condition_slug/specialty field of their own to scope by directly.
 */
function foundationComputeCarePlanActivity_(rosterPatientIds, window) {
  var matching = foundationDsQuery_(FOUNDATION_CARE_PLANS_SHEET_, FOUNDATION_CARE_PLANS_COLUMNS_, function (row) {
    return foundationIsWithinAnalyticsWindow_(row.created_at, window) && rosterPatientIds.indexOf(row.patient_id) !== -1;
  });
  var activeCount = 0;
  var supersededCount = 0;
  matching.forEach(function (row) {
    if (row.status === 'active') activeCount++;
    else if (row.status === 'superseded') supersededCount++;
  });
  return {
    total_plan_versions: matching.length,
    active_plan_versions: activeCount,
    superseded_plan_versions: supersededCount
  };
}

/**
 * Calculator/module engagement within the window, scoped to
 * `rosterPatientIds` — grouped by calculator_slug, deterministic counts
 * only (never a predicted or recommended calculator).
 */
function foundationComputeCalculatorEngagement_(rosterPatientIds, window) {
  var matching = foundationDsQuery_(FOUNDATION_CALCULATOR_RESULTS_SHEET_, FOUNDATION_CALCULATOR_RESULTS_COLUMNS_, function (row) {
    return foundationIsWithinAnalyticsWindow_(row.computed_at, window) && rosterPatientIds.indexOf(row.patient_id) !== -1;
  });
  var distinctPatientIds = {};
  var resultsByCalculatorSlug = {};
  matching.forEach(function (row) {
    distinctPatientIds[row.patient_id] = true;
    resultsByCalculatorSlug[row.calculator_slug] = (resultsByCalculatorSlug[row.calculator_slug] || 0) + 1;
  });
  return {
    total_results: matching.length,
    distinct_patients_engaged: Object.keys(distinctPatientIds).length,
    results_by_calculator_slug: resultsByCalculatorSlug
  };
}

/**
 * Inventory turnover within the window, scoped to `doctorInventoryItems`
 * (InventoryItem.gs's own specialty-scoped list,
 * foundationGetInventoryItemsForDoctor_() — reused, not re-derived).
 * `dispensed_quantity`/`restocked_quantity` are always non-negative
 * magnitudes (InventoryTransaction.gs stores change_qty signed; dispense
 * rows are negative, restock rows positive, per shared/schemas/
 * inventory-transaction.md).
 */
function foundationComputeInventoryTurnover_(doctorInventoryItems, window) {
  var doctorInventoryItemIds = doctorInventoryItems.map(function (item) { return item.inventory_item_id; });
  var matching = foundationDsQuery_(FOUNDATION_INVENTORY_TRANSACTIONS_SHEET_, FOUNDATION_INVENTORY_TRANSACTIONS_COLUMNS_, function (row) {
    return foundationIsWithinAnalyticsWindow_(row.created_at, window) && doctorInventoryItemIds.indexOf(row.inventory_item_id) !== -1;
  });
  var dispensedQuantity = 0;
  var restockedQuantity = 0;
  matching.forEach(function (row) {
    if (row.reason === 'dispense') dispensedQuantity += Math.abs(row.change_qty);
    else if (row.reason === 'restock') restockedQuantity += Math.abs(row.change_qty);
  });
  return {
    total_transactions: matching.length,
    dispensed_quantity: dispensedQuantity,
    restocked_quantity: restockedQuantity
  };
}

/**
 * PillFill fulfillment within the window, scoped to
 * `doctorPillFillOrders` (PillFillOrder.gs's own specialty-scoped list,
 * foundationGetPillFillOrdersForDoctor_() — reused, not re-derived, via
 * that function's own join to each order's referenced InventoryItem).
 * `fulfillment_rate` is fulfilled_or_later / total_orders (0 when
 * total_orders is 0).
 */
function foundationComputePillFillFulfillment_(doctorPillFillOrders, window) {
  var matching = doctorPillFillOrders.filter(function (row) {
    return foundationIsWithinAnalyticsWindow_(row.created_at, window);
  });
  var fulfilledOrLater = 0;
  matching.forEach(function (row) {
    if (row.status === 'fulfilled' || row.status === 'shipped' || row.status === 'delivered') fulfilledOrLater++;
  });
  return {
    total_orders: matching.length,
    fulfilled_or_later: fulfilledOrLater,
    fulfillment_rate: matching.length > 0 ? fulfilledOrLater / matching.length : 0
  };
}

/**
 * Appointment-to-completion conversion within the window, scoped directly
 * by Appointment.gs's own specialty_slug field (no roster join needed).
 * `completion_rate` is completed / total (0 when total is 0).
 */
function foundationComputeAppointmentConversion_(doctorSpecialtySlug, window) {
  var matching = foundationDsQuery_(FOUNDATION_APPOINTMENTS_SHEET_, FOUNDATION_APPOINTMENTS_COLUMNS_, function (row) {
    return foundationIsWithinAnalyticsWindow_(row.requested_at, window) && row.specialty_slug === doctorSpecialtySlug;
  });
  var byStatus = { requested: 0, confirmed: 0, completed: 0, cancelled: 0 };
  matching.forEach(function (row) {
    if (byStatus.hasOwnProperty(row.status)) byStatus[row.status]++;
  });
  return {
    total_appointments: matching.length,
    by_status: byStatus,
    completion_rate: matching.length > 0 ? byStatus.completed / matching.length : 0
  };
}

/**
 * Returns doctorId's bounded, specialty-scoped Analytics report — the
 * Doctor Dashboard's fifth capability (`analytics`, doctor-module-
 * registry.json). doctorId must already be DoctorSession-verified by the
 * caller — this function never re-derives it, mirroring every other
 * get_doctor_* view's own precedent exactly.
 */
function foundationGetAnalyticsForDoctor_(doctorId) {
  var doctorLookup = foundationGetDoctorById_(doctorId);
  if (doctorLookup.status === 'error') {
    return doctorLookup; // FOUNDATION_NOT_FOUND or an unexpected failure — already a safe envelope
  }
  var rosterLookup = foundationGetDoctorPatientRoster_(doctorId);
  if (rosterLookup.status === 'error') {
    return rosterLookup;
  }
  var inventoryLookup = foundationGetInventoryItemsForDoctor_(doctorId);
  if (inventoryLookup.status === 'error') {
    return inventoryLookup;
  }
  var pillFillLookup = foundationGetPillFillOrdersForDoctor_(doctorId);
  if (pillFillLookup.status === 'error') {
    return pillFillLookup;
  }
  return withFoundationErrorHandling_(function () {
    var doctorSpecialtySlug = doctorLookup.data.specialty_slug || FOUNDATION_DEFAULT_SPECIALTY_SLUG_;
    var window = foundationGetAnalyticsWindow_(foundationNowIso_());
    var rosterPatientIds = rosterLookup.data.map(function (entry) { return entry.patient_id; });

    return {
      window: window,
      specialty_slug: doctorSpecialtySlug,
      check_in_completion: foundationComputeCheckInCompletion_(doctorSpecialtySlug, window, rosterPatientIds.length),
      care_plan_activity: foundationComputeCarePlanActivity_(rosterPatientIds, window),
      calculator_engagement: foundationComputeCalculatorEngagement_(rosterPatientIds, window),
      inventory_turnover: foundationComputeInventoryTurnover_(inventoryLookup.data, window),
      pillfill_fulfillment: foundationComputePillFillFulfillment_(pillFillLookup.data, window),
      appointment_conversion: foundationComputeAppointmentConversion_(doctorSpecialtySlug, window)
    };
  });
}
