/**
 * PillFill Order — Batch WPI-8 (docs/50-PHASE-3-TECHNICAL-PLAN.md §11/§19;
 * docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every later WPI
 * batch). Implements shared/schemas/pillfill-order.schema.json version 1.0.0.
 * Connects a `medicine`-type Doctor Instruction (docs/33 §2.3's own
 * "Prescription is a medicine-type Doctor Instruction" mapping) to
 * fulfillment against Inventory. A consumer of Pillars 1/2/3 (docs/49 §4),
 * not a pillar in its own right.
 *
 * Not Foundation-prefixed, for the same reason InventoryItem.gs/Appointment.gs
 * aren't (docs/29 §2).
 *
 * Doctor/staff-owned, never patient-facing (docs/50 §11's own "Ownership:
 * Doctor/staff-created and -updated"). Every write — create, the dedicated
 * fulfill operation, and every other status transition — is a manually-run
 * Apps Script editor function, mirroring Appointment.gs's/InventoryItem.gs's
 * precedent exactly, not a new authenticated Web App route (shared/schemas/
 * pillfill-order.md's own disclosed reasoning). The one doctor-facing surface
 * this batch adds is a read-only route (FoundationRouter.gs's
 * get_pillfill_orders), deriving doctor_id exclusively from the verified
 * DoctorSession, mirroring get_inventory_items exactly.
 *
 * Fulfillment (foundationFulfillPillFillOrder_()) is the one operation with
 * side effects: it reuses InventoryTransaction.gs's existing, unmodified
 * foundationRecordInventoryTransaction_() (reason 'dispense', the platform's
 * first real, non-manual trigger for its LockService critical section,
 * docs/54 §7/§17/§19) and Notification.gs's existing, unmodified
 * foundationRecordNotification_() (type 'pillfill_order_status') — reusing
 * both mechanisms rather than inventing parallel ones (docs/50 §11). If the
 * InventoryTransaction call fails for any reason (including a contended
 * lock), this order's own status is never touched — no partial fulfillment.
 * No other status transition touches Inventory or Notification. See
 * shared/schemas/pillfill-order.md for the full disclosure.
 *
 * PillFillOrder carries no specialty_slug of its own (docs/50 §11's literal
 * attribute list has none) — foundationGetPillFillOrdersForDoctor_() derives
 * visibility by joining each order to its own referenced InventoryItem and
 * reusing that item's specialty_scope, mirroring
 * foundationGetInventoryItemsForDoctor_()'s own filter exactly (a disclosed,
 * minimal implementation-time decision, shared/schemas/pillfill-order.md).
 *
 * No external PillFill vendor API, webhook, or integration contract is
 * designed or built here (docs/50 §11's own explicit restraint) — this file
 * is the platform's own internal order-and-fulfillment record only.
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..11/WPI-1..7 file — reuses FoundationDataStore.gs's existing
 * generic insert/getById/updateById/query operations, FoundationAudit.gs's
 * existing foundationLogAuditEvent_(), InventoryTransaction.gs's existing
 * foundationRecordInventoryTransaction_(), and Notification.gs's existing
 * foundationRecordNotification_() exactly as all were already designed to be
 * reused (ADR-009).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs, PatientIdentity.gs,
 * DoctorIdentity.gs, DoctorInstruction.gs, InventoryItem.gs,
 * InventoryTransaction.gs, Notification.gs.
 */

var FOUNDATION_PILLFILL_ORDERS_SHEET_ = 'PillFillOrders';
var FOUNDATION_PILLFILL_ORDERS_COLUMNS_ = ['order_id', 'patient_id', 'doctor_instruction_id', 'inventory_item_id', 'quantity', 'status', 'created_by', 'created_at', 'fulfilled_at'];

// A row's own current status determines which target statuses are a valid,
// one-way transition via the *generic* status-update operation only —
// 'fulfilled' is deliberately absent as a reachable target here, since it is
// reachable only through the dedicated foundationFulfillPillFillOrder_()
// operation (shared/schemas/pillfill-order.md's own "the one operation with
// side effects" section).
var FOUNDATION_PILLFILL_ORDER_UPDATE_TRANSITIONS_ = {
  requested: ['in_progress', 'cancelled'],
  in_progress: ['cancelled'],
  fulfilled: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new PillFillOrder. `patient_id`/`doctor_instruction_id`/
 * `inventory_item_id`/`created_by` are required, non-empty strings;
 * `quantity` must be a positive integer. Whether each reference actually
 * resolves to a real, correctly-related row requires a Sheets read and
 * happens in foundationCreatePillFillOrder_() itself, mirroring
 * foundationCreateDoctorInstruction_()'s own "pure shape check first,
 * stateful check after" discipline.
 */
function foundationValidateCreatePillFillOrderInput_(input) {
  var errors = [];
  if (!input || typeof input.patient_id !== 'string' || input.patient_id.trim() === '') {
    errors.push('patient_id is required.');
  }
  if (!input || typeof input.doctor_instruction_id !== 'string' || input.doctor_instruction_id.trim() === '') {
    errors.push('doctor_instruction_id is required.');
  }
  if (!input || typeof input.inventory_item_id !== 'string' || input.inventory_item_id.trim() === '') {
    errors.push('inventory_item_id is required.');
  }
  if (!input || typeof input.quantity !== 'number' || !isFinite(input.quantity)
    || Math.floor(input.quantity) !== input.quantity || input.quantity < 1) {
    errors.push('quantity must be a positive integer.');
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (doctor/staff identifier) is required.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for the dedicated fulfill operation's own input shape — whether
 * `order_id` resolves to an existing, 'in_progress' row and `doctor_id`
 * resolves to a real Doctor is checked by foundationFulfillPillFillOrder_()
 * itself, since both require a Sheets read.
 */
function foundationValidateFulfillPillFillOrderInput_(input) {
  var errors = [];
  if (!input || typeof input.order_id !== 'string' || input.order_id.trim() === '') {
    errors.push('order_id is required.');
  }
  if (!input || typeof input.doctor_id !== 'string' || input.doctor_id.trim() === '') {
    errors.push('doctor_id is required to fulfill an order.');
  }
  return errors;
}

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for the generic status-update operation's own input shape
 * ('in_progress'/'shipped'/'delivered'/'cancelled' only — 'fulfilled' has
 * its own dedicated operation, above). Whether `order_id` actually resolves
 * to an existing row in a state that allows this transition is checked by
 * foundationUpdatePillFillOrderStatus_() itself.
 */
function foundationValidateUpdatePillFillOrderStatusInput_(input) {
  var errors = [];
  if (!input || typeof input.order_id !== 'string' || input.order_id.trim() === '') {
    errors.push('order_id is required.');
  }
  var allowedTargets = ['in_progress', 'shipped', 'delivered', 'cancelled'];
  if (!input || allowedTargets.indexOf(input.status) === -1) {
    errors.push('status must be one of: ' + allowedTargets.join(', ') + '.');
  }
  return errors;
}

/**
 * Builds a new, 'requested' PillFillOrder record (shared/schemas/
 * pillfill-order.schema.json). fulfilled_at always starts as an
 * empty-string sentinel — never known until the fulfill operation.
 */
function foundationBuildPillFillOrderRecord_(input, orderId, nowIso) {
  return {
    order_id: orderId,
    patient_id: input.patient_id.trim(),
    doctor_instruction_id: input.doctor_instruction_id.trim(),
    inventory_item_id: input.inventory_item_id.trim(),
    quantity: input.quantity,
    status: 'requested',
    created_by: input.created_by.trim(),
    created_at: nowIso,
    fulfilled_at: ''
  };
}

// ---- Sheets-backed operations ----

/**
 * Creates a new, 'requested' PillFillOrder row. Doctor/staff-only —
 * input.patient_id/input.created_by are caller-supplied here (there is no
 * patient session for this entity; it is never patient-facing, docs/50
 * §14), never session-derived. Validation failure is an expected outcome
 * (direct envelope, not the generic wrapper), the same convention every
 * other Foundation entity's input validation already follows. Rejects a
 * doctor_instruction_id that is not a real, 'medicine'-type DoctorInstruction
 * belonging to the same patient_id, an inventory_item_id that does not
 * reference a real, currently-active InventoryItem, or a patient_id that
 * does not reference a real Patient Identity.
 */
function foundationCreatePillFillOrder_(input) {
  var errors = foundationValidateCreatePillFillOrderInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var patientId = input.patient_id.trim();
  var patientLookup = foundationGetPatientById_(patientId);
  if (patientLookup.status === 'error' && patientLookup.error.code !== 'FOUNDATION_NOT_FOUND') {
    return patientLookup; // unexpected failure — already a safe, generic envelope
  }
  if (patientLookup.status === 'error') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'patient_id must reference an existing Patient Identity.');
  }

  var instructionId = input.doctor_instruction_id.trim();
  var instructionLookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_DOCTOR_INSTRUCTIONS_SHEET_, FOUNDATION_DOCTOR_INSTRUCTIONS_COLUMNS_, 'instruction_id', instructionId);
  });
  if (instructionLookup.status === 'error') {
    return instructionLookup; // unexpected failure — already a safe, generic envelope
  }
  if (!instructionLookup.data || instructionLookup.data.instruction_type !== 'medicine' || instructionLookup.data.patient_id !== patientId) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'doctor_instruction_id must reference an existing, medicine-type Doctor Instruction belonging to the same patient_id.');
  }

  var inventoryItemId = input.inventory_item_id.trim();
  var itemLookup = foundationGetInventoryItemById_(inventoryItemId);
  if (itemLookup.status === 'error' && itemLookup.error.code !== 'FOUNDATION_NOT_FOUND') {
    return itemLookup; // unexpected failure — already a safe, generic envelope
  }
  if (itemLookup.status === 'error' || itemLookup.data.status !== 'active') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'inventory_item_id must reference an existing, currently-active inventory item.');
  }

  return withFoundationErrorHandling_(function () {
    var orderId = generateFoundationId_();
    var record = foundationBuildPillFillOrderRecord_(input, orderId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_PILLFILL_ORDERS_SHEET_, FOUNDATION_PILLFILL_ORDERS_COLUMNS_, record);
    foundationLogAuditEvent_('pillfill_order_created', patientId, record.created_by, 'order_id=' + orderId + ' doctor_instruction_id=' + instructionId + ' inventory_item_id=' + inventoryItemId + ' quantity=' + record.quantity);
    return record;
  });
}

/**
 * Fulfills an existing, 'in_progress' PillFillOrder — the one operation
 * with side effects (shared/schemas/pillfill-order.md). Calls
 * InventoryTransaction.gs's existing, unmodified
 * foundationRecordInventoryTransaction_() (reason 'dispense', change_qty
 * -quantity, reference_id this order's own order_id) first; only on that
 * call's success does this order's own row transition to 'fulfilled', then
 * Notification.gs's existing, unmodified foundationRecordNotification_()
 * (type 'pillfill_order_status') is called. If the InventoryTransaction call
 * fails for any reason — including FOUNDATION_LOCK_UNAVAILABLE — this
 * order's own status is never touched and that failure envelope is returned
 * directly. Doctor/staff-only. Rejects (FOUNDATION_INVALID_INPUT) an
 * unknown order_id, one that is not currently 'in_progress', or a doctor_id
 * that does not reference a real Doctor.
 */
function foundationFulfillPillFillOrder_(input) {
  var errors = foundationValidateFulfillPillFillOrderInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var orderId = input.order_id.trim();
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_PILLFILL_ORDERS_SHEET_, FOUNDATION_PILLFILL_ORDERS_COLUMNS_, 'order_id', orderId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (!lookup.data || lookup.data.status !== 'in_progress') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'order_id must reference an existing, in_progress order.');
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

  var dispenseResult = foundationRecordInventoryTransaction_({
    inventory_item_id: existing.inventory_item_id,
    change_qty: -existing.quantity,
    reason: 'dispense',
    reference_id: orderId,
    created_by: doctorId
  });
  if (dispenseResult.status === 'error') {
    return dispenseResult; // FOUNDATION_LOCK_UNAVAILABLE or FOUNDATION_INVALID_INPUT — order status never touched
  }

  return withFoundationErrorHandling_(function () {
    var fulfilledAt = foundationNowIso_();
    foundationDsUpdateById_(FOUNDATION_PILLFILL_ORDERS_SHEET_, FOUNDATION_PILLFILL_ORDERS_COLUMNS_, 'order_id', orderId, {
      status: 'fulfilled',
      fulfilled_at: fulfilledAt
    });
    foundationLogAuditEvent_('pillfill_order_fulfilled', existing.patient_id, doctorId, 'order_id=' + orderId);
    existing.status = 'fulfilled';
    existing.fulfilled_at = fulfilledAt;
    foundationRecordNotification_({ patient_id: existing.patient_id, channel: 'email', type: 'pillfill_order_status', status: 'sent' });
    return existing;
  });
}

/**
 * Transitions an existing PillFillOrder row to input.status ('in_progress',
 * 'shipped', 'delivered', or 'cancelled'), enforcing
 * FOUNDATION_PILLFILL_ORDER_UPDATE_TRANSITIONS_'s allowed, one-way
 * transitions from the row's own current status. 'fulfilled' is never a
 * reachable target here — see foundationFulfillPillFillOrder_(). No side
 * effect beyond the status/timestamp patch itself — Inventory and
 * Notification are touched only by the dedicated fulfill operation.
 * Doctor/staff-only. Rejects (FOUNDATION_INVALID_INPUT) an unknown order_id
 * or a transition not permitted from the row's current status.
 */
function foundationUpdatePillFillOrderStatus_(input) {
  var errors = foundationValidateUpdatePillFillOrderStatusInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var orderId = input.order_id.trim();
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_PILLFILL_ORDERS_SHEET_, FOUNDATION_PILLFILL_ORDERS_COLUMNS_, 'order_id', orderId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  var existing = lookup.data;
  var allowedTargets = existing ? FOUNDATION_PILLFILL_ORDER_UPDATE_TRANSITIONS_[existing.status] || [] : [];
  if (!existing || allowedTargets.indexOf(input.status) === -1) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'order_id must reference an existing order whose current status allows this transition.');
  }
  return withFoundationErrorHandling_(function () {
    foundationDsUpdateById_(FOUNDATION_PILLFILL_ORDERS_SHEET_, FOUNDATION_PILLFILL_ORDERS_COLUMNS_, 'order_id', orderId, { status: input.status });
    foundationLogAuditEvent_('pillfill_order_' + input.status, existing.patient_id, existing.created_by, 'order_id=' + orderId);
    existing.status = input.status;
    return existing;
  });
}

/**
 * Returns `doctorId`'s derived PillFill Orders view: every order whose
 * referenced InventoryItem's specialty_scope matches the doctor's own
 * specialty_slug (or is unscoped) — the same specialty-derivation
 * discipline foundationGetInventoryItemsForDoctor_() already establishes,
 * applied here via the joined InventoryItem rather than a field on this
 * entity itself (shared/schemas/pillfill-order.md's own disclosed
 * decision). Each entry is enriched with the linked patient's own
 * full_name and the referenced item's own name/sku, for doctor-facing
 * display, mirroring foundationGetDoctorAppointments_()'s own
 * patient-name join exactly. Sorted created_at descending (newest first).
 * `doctorId` must already be DoctorSession-verified by the caller — this
 * function never re-derives it.
 */
function foundationGetPillFillOrdersForDoctor_(doctorId) {
  var doctorLookup = foundationGetDoctorById_(doctorId);
  if (doctorLookup.status === 'error') {
    return doctorLookup; // FOUNDATION_NOT_FOUND or an unexpected failure — already a safe envelope
  }
  return withFoundationErrorHandling_(function () {
    var doctorSpecialtySlug = doctorLookup.data.specialty_slug || FOUNDATION_DEFAULT_SPECIALTY_SLUG_;

    var allOrders = foundationDsQuery_(FOUNDATION_PILLFILL_ORDERS_SHEET_, FOUNDATION_PILLFILL_ORDERS_COLUMNS_, function () { return true; });

    var matching = allOrders.filter(function (row) {
      var itemLookup = foundationGetInventoryItemById_(row.inventory_item_id);
      if (itemLookup.status !== 'ok') return false;
      var itemScope = itemLookup.data.specialty_scope;
      return itemScope === '' || itemScope === doctorSpecialtySlug;
    });

    var indexed = matching.map(function (row, i) { return { row: row, insertionIndex: i }; });
    indexed.sort(function (a, b) {
      if (a.row.created_at !== b.row.created_at) {
        return a.row.created_at < b.row.created_at ? 1 : -1;
      }
      return b.insertionIndex - a.insertionIndex;
    });

    return indexed.map(function (entry) {
      var row = entry.row;
      var patientLookup = foundationGetPatientById_(row.patient_id);
      var itemLookup = foundationGetInventoryItemById_(row.inventory_item_id);
      return {
        order_id: row.order_id,
        patient_id: row.patient_id,
        patient_full_name: (patientLookup.status === 'ok') ? patientLookup.data.full_name : '',
        doctor_instruction_id: row.doctor_instruction_id,
        inventory_item_id: row.inventory_item_id,
        inventory_item_name: (itemLookup.status === 'ok') ? itemLookup.data.name : '',
        inventory_item_sku: (itemLookup.status === 'ok') ? itemLookup.data.sku : '',
        quantity: row.quantity,
        status: row.status,
        created_at: row.created_at,
        fulfilled_at: row.fulfilled_at
      };
    });
  });
}

// ---- Manually-run wrappers (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real patient/instruction/item/staff
 * details. Not a Web App endpoint — doctor/staff-owned, no patient-facing
 * write path (shared/schemas/pillfill-order.md's own disclosed reasoning),
 * mirroring Appointment.gs's createFoundationAppointment() precedent
 * exactly.
 */
function createFoundationPillFillOrder() {
  var result = foundationCreatePillFillOrder_({
    patient_id: 'EDIT ME BEFORE RUNNING',
    doctor_instruction_id: 'EDIT ME BEFORE RUNNING',
    inventory_item_id: 'EDIT ME BEFORE RUNNING',
    quantity: 0, // EDIT ME BEFORE RUNNING — positive integer
    created_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below. Not a Web App endpoint, for the same reason
 * createFoundationPillFillOrder() isn't. Run only against an order
 * currently 'in_progress' — this draws down real Inventory and produces a
 * real Notification (see this file's own header comment).
 */
function fulfillFoundationPillFillOrder() {
  var result = foundationFulfillPillFillOrder_({
    order_id: 'EDIT ME BEFORE RUNNING',
    doctor_id: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real order details. Not a Web App
 * endpoint, for the same reason createFoundationPillFillOrder() isn't. Use
 * fulfillFoundationPillFillOrder() instead to transition to 'fulfilled' —
 * this wrapper's own status is restricted to in_progress/shipped/delivered/
 * cancelled.
 */
function updateFoundationPillFillOrderStatus() {
  var result = foundationUpdatePillFillOrderStatus_({
    order_id: 'EDIT ME BEFORE RUNNING',
    status: 'EDIT ME BEFORE RUNNING' // in_progress | shipped | delivered | cancelled
  });
  Logger.log(JSON.stringify(result));
  return result;
}
