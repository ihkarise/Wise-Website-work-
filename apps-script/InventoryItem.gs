/**
 * Inventory Item — Batch WPI-7 (docs/50-PHASE-3-TECHNICAL-PLAN.md §10/§19;
 * docs/53-PHASE-3-IMPLEMENTATION-RULES.md governs this and every later WPI
 * batch), gated on docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md closing the
 * Sheets-at-production-scale pre-condition. Implements
 * shared/schemas/inventory-item.schema.json version 1.0.0. A consumer of
 * Pillar 2 (Doctor Dashboard), per docs/49 §4.1.
 *
 * Not Foundation-prefixed, for the same reason Appointment.gs and CarePlan.gs
 * aren't (docs/29 §2): a concrete entity built on Foundation's frozen
 * infrastructure, not infrastructure itself.
 *
 * Doctor/staff-owned, never patient-facing (docs/50 §10's own "Ownership:
 * Doctor/staff-facing only"). Every write — create, retire, threshold-update
 * — is a manually-run Apps Script editor function, mirroring
 * Appointment.gs's/CarePlan.gs's precedent exactly, not a new authenticated
 * Web App route — see shared/schemas/inventory-item.md's own disclosed
 * reasoning for why this continues, rather than departs from, every prior
 * WPI batch's "doctor/staff-owned entity writes stay manually-run" pattern.
 * The one doctor-facing surface this batch adds is a read-only route
 * (FoundationRouter.gs's get_inventory_items), deriving doctor_id exclusively
 * from the verified DoctorSession, mirroring get_doctor_appointments exactly.
 *
 * quantity_on_hand is never accepted from a create/update request — always 0
 * at creation, thereafter written only by InventoryTransaction.gs's own
 * LockService-protected recompute (docs/50 §10, docs/54 §7/§19; see
 * shared/schemas/inventory-item.md).
 *
 * Zero modification to any frozen Foundation/Identity & Access/Patient
 * Access/PXP-1..11/WPI-1..6 file — reuses FoundationDataStore.gs's existing
 * generic insert/getById/updateById/query operations and FoundationAudit.gs's
 * existing foundationLogAuditEvent_() exactly as both were already designed
 * to be reused (ADR-009).
 *
 * Depends on FoundationDataStore.gs, FoundationAudit.gs, FoundationUtils.gs,
 * FoundationContracts.gs, FoundationErrorHandling.gs, SpecialtyRegistry.gs,
 * DoctorIdentity.gs.
 */

var FOUNDATION_INVENTORY_ITEMS_SHEET_ = 'InventoryItems';
var FOUNDATION_INVENTORY_ITEMS_COLUMNS_ = ['inventory_item_id', 'name', 'sku', 'unit', 'quantity_on_hand', 'reorder_threshold', 'specialty_scope', 'status', 'created_by', 'created_at'];

// ---- Pure helpers — no Apps Script dependency, covered by Conformance Tests ----

/**
 * Returns an array of human-readable error strings (empty if `input` is
 * valid) for a new InventoryItem. `name`/`sku`/`unit`/`created_by` are
 * required, non-empty strings; `reorder_threshold` must be a non-negative
 * integer; `specialty_scope` is optional but, when supplied, must be a
 * non-empty string (whether it resolves to a real Specialty Registry entry
 * is checked by foundationCreateInventoryItem_() itself, since that check
 * requires reading SpecialtyRegistry.gs's own list — mirroring
 * foundationValidateCreateAppointmentInput_()'s own "pure shape check first,
 * stateful check after" discipline).
 */
function foundationValidateCreateInventoryItemInput_(input) {
  var errors = [];
  if (!input || typeof input.name !== 'string' || input.name.trim() === '') {
    errors.push('name is required.');
  }
  if (!input || typeof input.sku !== 'string' || input.sku.trim() === '') {
    errors.push('sku is required.');
  }
  if (!input || typeof input.unit !== 'string' || input.unit.trim() === '') {
    errors.push('unit is required.');
  }
  if (!input || typeof input.reorder_threshold !== 'number' || !isFinite(input.reorder_threshold)
    || Math.floor(input.reorder_threshold) !== input.reorder_threshold || input.reorder_threshold < 0) {
    errors.push('reorder_threshold must be a non-negative integer.');
  }
  if (input && input.specialty_scope !== undefined && input.specialty_scope !== null && input.specialty_scope !== ''
    && (typeof input.specialty_scope !== 'string' || input.specialty_scope.trim() === '')) {
    errors.push('specialty_scope must be a non-empty string when provided.');
  }
  if (!input || typeof input.created_by !== 'string' || input.created_by.trim() === '') {
    errors.push('created_by (staff/doctor identifier) is required.');
  }
  return errors;
}

/**
 * Builds a new InventoryItem record (shared/schemas/inventory-item.schema.json).
 * quantity_on_hand is always 0 and status is always 'active' — neither is
 * ever accepted from `input` (shared/schemas/inventory-item.md's own
 * disclosed discipline).
 */
function foundationBuildInventoryItemRecord_(input, inventoryItemId, nowIso) {
  return {
    inventory_item_id: inventoryItemId,
    name: input.name.trim(),
    sku: input.sku.trim(),
    unit: input.unit.trim(),
    quantity_on_hand: 0,
    reorder_threshold: input.reorder_threshold,
    specialty_scope: input.specialty_scope ? String(input.specialty_scope).trim() : '',
    status: 'active',
    created_by: input.created_by.trim(),
    created_at: nowIso
  };
}

// ---- Sheets-backed operations ----

/**
 * Creates a new InventoryItem row, always at quantity_on_hand: 0 — staff
 * record an initial InventoryTransaction (restock/adjustment) separately to
 * set a real starting stock count. Staff/doctor-only — input.created_by is
 * caller-supplied here (there is no patient session at creation time; this
 * entity is never patient-facing, docs/50 §10), never session-derived.
 * Validation failure is an expected outcome (direct envelope, not the
 * generic wrapper), the same convention every other Foundation entity's
 * input validation already follows.
 */
function foundationCreateInventoryItem_(input) {
  var errors = foundationValidateCreateInventoryItemInput_(input);
  if (errors.length > 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', errors.join(' '));
  }
  if (input.specialty_scope) {
    var specialtyCheck = foundationGetSpecialtyBySlug_(String(input.specialty_scope).trim());
    if (!specialtyCheck) {
      return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'specialty_scope must reference an existing Specialty Registry entry when provided.');
    }
  }
  return withFoundationErrorHandling_(function () {
    var inventoryItemId = generateFoundationId_();
    var record = foundationBuildInventoryItemRecord_(input, inventoryItemId, foundationNowIso_());
    foundationDsInsert_(FOUNDATION_INVENTORY_ITEMS_SHEET_, FOUNDATION_INVENTORY_ITEMS_COLUMNS_, record);
    foundationLogAuditEvent_('inventory_item_created', '', record.created_by, 'inventory_item_id=' + inventoryItemId + ' sku=' + record.sku);
    return record;
  });
}

/**
 * Looks up an InventoryItem record by inventory_item_id. A clean "not
 * found" (no exception, just no matching row) returns a specific
 * FOUNDATION_NOT_FOUND envelope, not the generic unexpected-error one —
 * mirrors foundationGetDoctorById_() exactly.
 */
function foundationGetInventoryItemById_(inventoryItemId) {
  var lookup = withFoundationErrorHandling_(function () {
    return foundationDsGetById_(FOUNDATION_INVENTORY_ITEMS_SHEET_, FOUNDATION_INVENTORY_ITEMS_COLUMNS_, 'inventory_item_id', inventoryItemId);
  });
  if (lookup.status === 'error') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (lookup.data === null) {
    return buildFoundationErrorEnvelope_('FOUNDATION_NOT_FOUND', 'We could not find that inventory item.');
  }
  return lookup;
}

/**
 * Returns doctorId's specialty-scoped, active InventoryItem list — every
 * item whose specialty_scope is empty (visible regardless of specialty,
 * ADR-018/docs/50 §6.2) or matches the doctor's own specialty_slug (or the
 * implicit default, if unset), excluding retired items. Each entry is
 * enriched with a computed low_stock boolean (quantity_on_hand <=
 * reorder_threshold), the same "compute a display-only derived field at the
 * read boundary" convention foundationGetDoctorAppointments_() already
 * establishes for patient_full_name. doctorId must already be
 * DoctorSession-verified by the caller — this function never re-derives it.
 */
function foundationGetInventoryItemsForDoctor_(doctorId) {
  var doctorLookup = foundationGetDoctorById_(doctorId);
  if (doctorLookup.status === 'error') {
    return doctorLookup; // FOUNDATION_NOT_FOUND or an unexpected failure — already a safe envelope
  }
  return withFoundationErrorHandling_(function () {
    var doctorSpecialtySlug = doctorLookup.data.specialty_slug || FOUNDATION_DEFAULT_SPECIALTY_SLUG_;

    var matching = foundationDsQuery_(FOUNDATION_INVENTORY_ITEMS_SHEET_, FOUNDATION_INVENTORY_ITEMS_COLUMNS_, function (row) {
      return row.status === 'active' && (row.specialty_scope === '' || row.specialty_scope === doctorSpecialtySlug);
    });

    return matching.map(function (row) {
      return {
        inventory_item_id: row.inventory_item_id,
        name: row.name,
        sku: row.sku,
        unit: row.unit,
        quantity_on_hand: row.quantity_on_hand,
        reorder_threshold: row.reorder_threshold,
        specialty_scope: row.specialty_scope,
        status: row.status,
        low_stock: row.quantity_on_hand <= row.reorder_threshold
      };
    });
  });
}

/**
 * Transitions an existing, 'active' InventoryItem to 'retired', one-way,
 * never reverted — a retired item stops appearing in
 * foundationGetInventoryItemsForDoctor_()'s view and is rejected by
 * foundationRecordInventoryTransaction_() if a caller tries to post a new
 * transaction against it. Rejects (FOUNDATION_INVALID_INPUT) an unknown
 * inventory_item_id or one that is not currently 'active' — mirrors
 * foundationUpdateAppointmentStatus_()'s own "unknown id or disallowed
 * transition" discipline.
 */
function foundationRetireInventoryItem_(inventoryItemId) {
  var lookup = foundationGetInventoryItemById_(inventoryItemId);
  if (lookup.status === 'error' && lookup.error.code !== 'FOUNDATION_NOT_FOUND') {
    return lookup; // unexpected failure — already a safe, generic envelope
  }
  if (lookup.status === 'error' || lookup.data.status !== 'active') {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'inventory_item_id must reference a currently-active inventory item.');
  }
  var existing = lookup.data;
  return withFoundationErrorHandling_(function () {
    foundationDsUpdateById_(FOUNDATION_INVENTORY_ITEMS_SHEET_, FOUNDATION_INVENTORY_ITEMS_COLUMNS_, 'inventory_item_id', inventoryItemId, { status: 'retired' });
    foundationLogAuditEvent_('inventory_item_retired', '', '', 'inventory_item_id=' + inventoryItemId);
    existing.status = 'retired';
    return existing;
  });
}

/**
 * Updates an existing InventoryItem's reorder_threshold only — a plain
 * field patch, not a derived-value read-modify-write, so no LockService
 * wrapping is required here (docs/54 §7's mitigation is scoped to
 * quantity_on_hand specifically). Rejects (FOUNDATION_INVALID_INPUT) an
 * unknown inventory_item_id or a non-negative-integer violation.
 */
function foundationUpdateInventoryItemThreshold_(inventoryItemId, newThreshold) {
  var lookup = foundationGetInventoryItemById_(inventoryItemId);
  if (lookup.status === 'error') {
    return lookup; // FOUNDATION_NOT_FOUND or an unexpected failure — already a safe envelope
  }
  if (typeof newThreshold !== 'number' || !isFinite(newThreshold) || Math.floor(newThreshold) !== newThreshold || newThreshold < 0) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'reorder_threshold must be a non-negative integer.');
  }
  var existing = lookup.data;
  return withFoundationErrorHandling_(function () {
    foundationDsUpdateById_(FOUNDATION_INVENTORY_ITEMS_SHEET_, FOUNDATION_INVENTORY_ITEMS_COLUMNS_, 'inventory_item_id', inventoryItemId, { reorder_threshold: newThreshold });
    foundationLogAuditEvent_('inventory_item_threshold_updated', '', '', 'inventory_item_id=' + inventoryItemId + ' reorder_threshold=' + newThreshold);
    existing.reorder_threshold = newThreshold;
    return existing;
  });
}

// ---- Manually-run wrappers (Apps Script editor dropdown) ----

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below with the real item/staff details. Not a Web App
 * endpoint — doctor/staff-owned, no patient-facing write path
 * (shared/schemas/inventory-item.md's own disclosed reasoning), mirroring
 * Appointment.gs's createFoundationAppointment() precedent exactly. Run
 * recordFoundationInventoryTransaction() (InventoryTransaction.gs)
 * immediately afterward to set this item's real starting stock count.
 */
function createFoundationInventoryItem() {
  var result = foundationCreateInventoryItem_({
    name: 'EDIT ME BEFORE RUNNING',
    sku: 'EDIT ME BEFORE RUNNING',
    unit: 'EDIT ME BEFORE RUNNING',
    reorder_threshold: 0, // EDIT ME BEFORE RUNNING
    specialty_scope: '', // optional, e.g. 'homeopathy'
    created_by: 'EDIT ME BEFORE RUNNING'
  });
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder value below.
 */
function retireFoundationInventoryItem() {
  var result = foundationRetireInventoryItem_('EDIT ME BEFORE RUNNING');
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Run from the Apps Script editor's function dropdown after editing the
 * placeholder values below.
 */
function updateFoundationInventoryItemThreshold() {
  var result = foundationUpdateInventoryItemThreshold_('EDIT ME BEFORE RUNNING', 0 /* EDIT ME BEFORE RUNNING */);
  Logger.log(JSON.stringify(result));
  return result;
}
