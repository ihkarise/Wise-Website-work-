/**
 * Inventory Transaction — Batch WPI-7 (docs/50-PHASE-3-TECHNICAL-PLAN.md
 * §10/§19; docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every
 * later WPI batch), gated on docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md
 * closing the Sheets-at-production-scale pre-condition. Implements
 * shared/schemas/inventory-transaction.schema.json version 1.0.0. The
 * append-only stock-movement ledger backing InventoryItem.gs's
 * quantity_on_hand cache — mirrors CarePlan.gs's own append-only-versioning
 * discipline rather than mutating a running total in place (docs/50 §10).
 *
 * Not Foundation-prefixed, for the same reason InventoryItem.gs isn't
 * (docs/29 §2).
 *
 * **The platform's first use of LockService** (docs/54 §7/§18/§19's required
 * mitigation) — additive only, zero change to FoundationDataStore.gs or any
 * other frozen file. foundationRecordInventoryTransaction_() wraps its
 * entire append-then-recompute-then-cache-write sequence in
 * LockService.getScriptLock(): quantity_on_hand is recomputed in full from
 * this ledger's own change_qty rows (never "cached value + delta") every
 * time a transaction is recorded, so the cache is always exactly
 * reconstructable from — and self-correcting against — the ledger, per
 * docs/54 §13's recovery-strategy discipline. If the lock cannot be
 * acquired (another execution currently holds it), the function performs no
 * write at all and returns a new, expected FOUNDATION_LOCK_UNAVAILABLE
 * envelope — never a silent, unsynchronized read-modify-write race, and
 * never a raw thrown exception. See shared/schemas/inventory-transaction.md
 * for the full disclosure, including why recompute-from-ledger (not a
 * delta-based update) is this batch's chosen mitigation shape.
 *
 * Strictly append-only: no foundationDsUpdateById_() call anywhere in this
 * file targets FOUNDATION_INVENTORY_TRANSACTIONS_SHEET_ itself (docs/54
 * §19's explicit requirement) — the only foundationDsUpdateById_() call
 * this file makes targets InventoryItem.gs's own sheet, patching its cached
 * quantity_on_hand field.
 *
 * Doctor/staff-owned, never patient-facing — every write is a manually-run
 * Apps Script editor function (recordFoundationInventoryTransaction_(),
 * bottom of this file), mirroring Appointment.gs's/CarePlan.gs's precedent
 * exactly, not a new authenticated Web App route (docs/50 §14, shared/
 * schemas/inventory-transaction.md's own disclosed reasoning). No
 * FoundationRouter.gs dispatch case ships for this entity's writes.
 *
 * Crossing reorder_threshold produces an inventory_low_stock Notification
 * (Notification.gs's foundationRecordNotification_(), WPI-6's existing,
 * unmodified mechanism) — a disclosed, minimal choice: doctor_id is set to
 * this transaction's own created_by, and no real email transport is built
 * for this alert in this batch (shared/schemas/inventory-transaction.md's
 * "Low-stock Notification" section has the full disclosure).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..11/WPI-1..6 file, and zero modification to Notification.gs
 * itself — this file is simply a new call site adopting Notification.gs's
 * own already-designed, already-shipped extension mechanism (docs/33 §4.2's
 * own "WPI-7/WPI-8 build them" expectation).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs, InventoryItem.gs,
 * DoctorIdentity.gs, Notification.gs.
 */

var FOUNDATION_INVENTORY_TRANSACTIONS_SHEET_ = 'InventoryTransactions';
var FOUNDATION_INVENTORY_TRANSACTIONS_COLUMNS_ = ['transaction_id', 'inventory_item_id', 'change_qty', 'reason', 'reference_id', 'created_by', 'created_at'];

var FOUNDATION_INVENTORY_TRANSACTION_REASONS_ = ['restock', 'dispense', 'adjustment'];

// How long to wait for the lock before giving up and returning
// FOUNDATION_LOCK_UNAVAILABLE — generous enough for this batch's own
// low-frequency, pilot-scale write volume (docs/54 §3/§11), never a
// production-blocking delay.
var FOUNDATION_INVENTORY_LOCK_TIMEOUT_MS_ = 5000;

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new InventoryTransaction. `inventory_item_id`/`created_by`
 * are required, non-empty strings; `change_qty` must be a non-zero integer;
 * `reason` must be one of the reserved enum values. Whether
 * `inventory_item_id` resolves to a real, active InventoryItem and whether
 * `created_by` resolves to a real Doctor are checked by
 * foundationRecordInventoryTransaction_() itself, since both require a
 * Sheets read — mirroring foundationValidateCreateAppointmentInput_()'s own
 * "pure shape check first, stateful check after" discipline.
 */
function foundationValidateInventoryTransactionInput_(input) {
  var errors = [];
  if (!input || typeof input.inventory_item_id !== 'string' || input.inventory_item_id.trim() === '') {
    errors.push('inventory_item_id is required.');
  }
  if (!input || typeof input.change_qty !== 'number' || !isFinite(input.change_qty)
    || Math.floor(input.change_qty) !== input.change_qty || input.change_qty === 0) {
    errors.push('change_qty must be a non-zero integer.');
  }
  if (!input || FOUNDATION_INVENTORY_TRANSACTION_REASONS_.indexOf(input.reason) === -1) {
    errors.push('reason must be one of: ' + FOUNDATION_INVENTORY_TRANSACTION_REASONS_.join(', ') + '.');
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (doctor_id) is required.');
  }
  return errors;
}

/**
 * Builds a new InventoryTransaction record (shared/schemas/
 * inventory-transaction.schema.json). `created_at` is always server-set;
 * `reference_id` is always an empty-string sentinel when not supplied.
 */
function foundationBuildInventoryTransactionRecord_(input, transactionId, nowIso) {
  return {
    transaction_id: transactionId,
    inventory_item_id: input.inventory_item_id.trim(),
    change_qty: input.change_qty,
    reason: input.reason,
    reference_id: input.reference_id ? String(input.reference_id).trim() : '',
    created_by: input.created_by.trim(),
    created_at: nowIso
  };
}

// ---- Sheets-backed operations ----

/**
 * Returns the full sum of every change_qty row recorded for
 * inventoryItemId — the source of truth foundationRecordInventoryTransaction_()
 * recomputes InventoryItem.quantity_on_hand from, never a cached running
 * total read back to itself (shared/schemas/inventory-transaction.md's own
 * "recompute-from-ledger, not cached-value-plus-delta" discipline).
 */
function foundationSumInventoryTransactions_(inventoryItemId) {
  var rows = foundationDsQuery_(FOUNDATION_INVENTORY_TRANSACTIONS_SHEET_, FOUNDATION_INVENTORY_TRANSACTIONS_COLUMNS_, function (row) {
    return row.inventory_item_id === inventoryItemId;
  });
  var total = 0;
  rows.forEach(function (row) { total += row.change_qty; });
  return total;
}

/**
 * Records a new InventoryTransaction row, recomputes and caches the
 * referenced InventoryItem's quantity_on_hand from the full ledger, and
 * produces an inventory_low_stock Notification if the recomputed quantity
 * is at or below the item's own reorder_threshold — all inside one
 * LockService critical section (docs/54 §7/§19's required mitigation, the
 * platform's first use of this primitive). Doctor/staff-only —
 * input.created_by is caller-supplied here (there is no patient session for
 * this entity; it is never patient-facing, docs/50 §14), never
 * session-derived. Validation failure is an expected outcome (direct
 * envelope, not the generic wrapper), the same convention every other
 * Foundation entity's input validation already follows. If the lock cannot
 * be acquired, returns FOUNDATION_LOCK_UNAVAILABLE and performs no write at
 * all.
 */
function foundationRecordInventoryTransaction_(input) {
  var errors = foundationValidateInventoryTransactionInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  var inventoryItemId = input.inventory_item_id.trim();
  var itemLookup = foundationGetInventoryItemById_(inventoryItemId);
  if (itemLookup.status === 'error' && itemLookup.error.code !== 'FOUNDATION_NOT_FOUND') {
    return itemLookup; // unexpected failure — already a safe, generic envelope
  }
  if (itemLookup.status === 'error' || itemLookup.data.status !== 'active') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'inventory_item_id must reference an existing, currently-active inventory item.');
  }
  var doctorId = input.created_by.trim();
  var doctorLookup = foundationGetDoctorById_(doctorId);
  if (doctorLookup.status === 'error' && doctorLookup.error.code !== 'FOUNDATION_NOT_FOUND') {
    return doctorLookup; // unexpected failure — already a safe, generic envelope
  }
  if (doctorLookup.status === 'error') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'created_by must reference an existing Doctor.');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(FOUNDATION_INVENTORY_LOCK_TIMEOUT_MS_)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_LOCK_UNAVAILABLE', 'Another inventory update is in progress. Please try again.');
  }
  try {
    return withFoundationErrorHandling_(function () {
      var nowIso = foundationNowIso_();
      var transactionId = generateFoundationId_();
      var record = foundationBuildInventoryTransactionRecord_(input, transactionId, nowIso);
      foundationDsInsert_(FOUNDATION_INVENTORY_TRANSACTIONS_SHEET_, FOUNDATION_INVENTORY_TRANSACTIONS_COLUMNS_, record);

      var newQuantityOnHand = foundationSumInventoryTransactions_(inventoryItemId);
      foundationDsUpdateById_(FOUNDATION_INVENTORY_ITEMS_SHEET_, FOUNDATION_INVENTORY_ITEMS_COLUMNS_, 'inventory_item_id', inventoryItemId, { quantity_on_hand: newQuantityOnHand });
      foundationLogAuditEvent_('inventory_transaction_recorded', '', doctorId, 'inventory_item_id=' + inventoryItemId + ' change_qty=' + record.change_qty + ' reason=' + record.reason + ' quantity_on_hand=' + newQuantityOnHand);

      if (newQuantityOnHand <= itemLookup.data.reorder_threshold) {
        foundationRecordNotification_({ doctor_id: doctorId, channel: 'email', type: 'inventory_low_stock', status: 'sent' });
      }

      return record;
    });
  } finally {
    lock.releaseLock();
  }
}

// ---- Manually-run wrapper (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real item/transaction/doctor details.
 * Not a Web App endpoint — doctor/staff-owned, no patient-facing write path
 * (shared/schemas/inventory-transaction.md's own disclosed reasoning),
 * mirroring Appointment.gs's createFoundationAppointment() precedent
 * exactly. Run this once with reason 'restock' or 'adjustment' immediately
 * after creating a new InventoryItem to set its real starting stock count.
 */
function recordFoundationInventoryTransaction() {
  var result = foundationRecordInventoryTransaction_({
    inventory_item_id: 'EDIT ME BEFORE RUNNING',
    change_qty: 0, // EDIT ME BEFORE RUNNING — signed, non-zero
    reason: 'EDIT ME BEFORE RUNNING', // restock | dispense | adjustment
    reference_id: '', // optional
    created_by: 'EDIT ME BEFORE RUNNING' // a real doctor_id
  });
  Logger.log(JSON.stringify(result));
  return result;
}
