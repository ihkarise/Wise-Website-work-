# PillFillOrder

Explains `pillfill-order.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch WPI-8 (docs/50-PHASE-3-TECHNICAL-PLAN.md §11, §19)

Connects a `medicine`-type Doctor Instruction (`doctor-instruction.schema.json`,
docs/33 §2.3's "Prescription is a `medicine`-type Doctor Instruction" mapping) to
fulfillment against Inventory. The platform's own internal order-and-fulfillment
record only — **no external PillFill vendor API, webhook, or integration contract is
designed here** (docs/50 §11's own explicit restraint), the same "plumbing decided at
implementation time" deferral Appointment's own intake mechanism already used.

## Ownership: doctor/staff-created and -updated, never patient-facing

Mirrors `DoctorInstruction`'s own "doctor/staff-owned, patient never edits" boundary
(docs/33 §2.3). No real Doctor identity/authentication gap remains for this batch —
`DoctorSession` has existed since WPI-1 — but every write (create, the dedicated
fulfill operation, and every other status transition) is a manually-run Apps Script
editor function in this batch's scope, mirroring `Appointment.gs`'s/`InventoryItem.gs`'s
own precedent exactly: no doctor/staff-owned WPI entity has an authenticated Web App
*write* route yet, and this batch does not depart from that pattern speculatively. The
one doctor-facing surface this batch adds is a read-only route
(`FoundationRouter.gs`'s `get_pillfill_orders`), `doctor_id` derived exclusively from a
verified `DoctorSession`, mirroring `get_inventory_items` exactly. A patient-facing,
read-only order-status view remains a plausible future extension (docs/50 §11) — not
this batch's scope.

## Lifecycle

A row is created `'requested'`. From there, one-way, never reverted:

- `requested` -> `in_progress` (a plain status patch, no side effect) or `cancelled`.
- `in_progress` -> `fulfilled`, exclusively via the dedicated `foundationFulfillPillFillOrder_()`
  operation (see below) — never through the generic status-update path — or `cancelled`.
- `fulfilled` -> `shipped` (a plain status patch, no side effect).
- `shipped` -> `delivered` (a plain status patch, no side effect).
- `delivered` and `cancelled` are terminal — no further transition is accepted.

**Once fulfilled, an order can no longer be cancelled.** Stock has already been
dispensed at that point, and docs/50 §11 designs no reversal mechanism — a disclosed
boundary, not an oversight, mirroring `InventoryTransaction`'s own "append a correction,
never rewrite history" discipline (a mistaken fulfillment would be corrected by a new,
offsetting `adjustment` InventoryTransaction, recorded the same manually-run way every
other correction is, not by this entity reversing itself).

## Fulfillment: the one operation with side effects

`foundationFulfillPillFillOrder_()` is the only transition that does more than patch
`status`. Given an order currently `'in_progress'` and an acting `doctor_id`, it, in
order:

1. Calls `InventoryTransaction.gs`'s existing, unmodified
   `foundationRecordInventoryTransaction_()` — reason `'dispense'`, `change_qty` set to
   exactly `-quantity`, `reference_id` set to this order's own `order_id`, `created_by`
   set to the acting `doctor_id` — reusing that function's own `LockService` critical
   section in full (docs/54 §7/§19's required mitigation; this batch is the "concrete
   trigger" docs/54 §7/§17 named for that protection actually mattering in practice).
   **If this call fails for any reason — including a contended lock
   (`FOUNDATION_LOCK_UNAVAILABLE`) — the order's own status is never touched**: no
   partial fulfillment, no dispensed-but-not-recorded stock movement, mirroring PA-5's
   own "a Sheets-write failure after a successful Drive write is rolled back" discipline
   applied here to a would-be partial state instead.
2. Only if step 1 succeeds: patches this order's own row to `status: 'fulfilled'`,
   `fulfilled_at` set to `foundationNowIso_()`.
3. Calls `Notification.gs`'s existing, unmodified `foundationRecordNotification_()` —
   `patient_id` set to this order's own `patient_id` (the subject this update is
   actually about), `channel: 'email'`, `type: 'pillfill_order_status'`, `status: 'sent'`
   — the same "record that the deterministic signal fired, not that a real email was
   necessarily sent" disclosure `InventoryTransaction.gs`'s own low-stock Notification
   already makes; no new email transport is built in this batch.

No other status transition (`in_progress`, `shipped`, `delivered`, `cancelled`) touches
Inventory or Notification — docs/50 §11 ties both mechanisms specifically to
"fulfillment," not to every lifecycle step, and this batch does not invent a broader
trigger than the one actually documented.

## Reference-integrity checks at creation

`foundationCreatePillFillOrder_()` rejects (all `FOUNDATION_INVALID_INPUT`):
- `patient_id` that does not reference a real Patient Identity.
- `doctor_instruction_id` that does not reference a real, existing `DoctorInstruction`
  row, or one whose `instruction_type` is not `'medicine'`, or one whose own `patient_id`
  does not match this order's `patient_id` — the same "referenced entity must be real,
  and must actually belong together" discipline `DoctorInstruction.gs`'s own
  `care_plan_id`/`patient_id` consistency check already establishes for its own
  reference.
- `inventory_item_id` that does not reference a real, currently-`'active'`
  InventoryItem.
- `quantity` that is not a positive integer.

No stock-sufficiency check is performed at creation or at fulfillment — docs/50 §11
does not name one, and `InventoryTransaction.gs`'s own `change_qty` validation already
permits any non-zero signed integer regardless of the resulting `quantity_on_hand`; this
batch does not invent a new gate `InventoryTransaction.gs` itself does not enforce.

## Doctor Dashboard view — specialty scoping via the referenced InventoryItem

`PillFillOrder` carries no `specialty_slug` of its own (docs/50 §11's literal attribute
list has none) — `foundationGetPillFillOrdersForDoctor_()` derives visibility by joining
each order to its own referenced `InventoryItem` and reusing that item's
`specialty_scope` exactly as `foundationGetInventoryItemsForDoctor_()` already filters
(empty scope visible to every doctor; a non-empty scope visible only to a doctor sharing
that `specialty_slug`, or the implicit default for a doctor with none set). This is a
disclosed, minimal implementation-time decision — mirroring `Appointment`'s/`InventoryItem`'s
own specialty-derivation discipline — not a new field or a new registry mechanism. Each
returned entry is additionally enriched with the linked patient's own `full_name` and the
referenced item's own `name`/`sku`, for doctor-facing display, mirroring
`foundationGetDoctorAppointments_()`'s own patient-name join exactly. Sorted `created_at`
descending (newest first).

## Validation rules

- `patient_id`: required, must reference a real Patient Identity.
- `doctor_instruction_id`: required, must reference a real, `'medicine'`-type
  `DoctorInstruction` belonging to the same `patient_id`.
- `inventory_item_id`: required, must reference a real, currently-`'active'`
  InventoryItem.
- `quantity`: required, a positive integer.
- `created_by`: required, non-empty string (doctor/staff identifier).

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other entity's input validation already follows.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `order_id` | Yes (server-generated UUID) | No |
| `patient_id` | Yes (staff/doctor-supplied, validated) | No |
| `doctor_instruction_id` | Yes (staff/doctor-supplied, validated) | No |
| `inventory_item_id` | Yes (staff/doctor-supplied, validated) | No |
| `quantity` | Yes (staff/doctor-supplied, validated) | No |
| `status` | Yes (always `'requested'`) | Yes — one-way lifecycle transition only |
| `created_by` | Yes (staff/doctor-supplied) | No |
| `created_at` | Yes (server-set) | No |
| `fulfilled_at` | Yes (`''` sentinel) | Yes — server-set once, at fulfillment only |

## No patient write path — ever, in this batch

There is no create/fulfill/status-update Web App route in `FoundationRouter.gs` for
this entity — every write is one of three manually-run Apps Script editor functions
(`createFoundationPillFillOrder()`, `fulfillFoundationPillFillOrder()`,
`updateFoundationPillFillOrderStatus()`), mirroring every earlier doctor/staff-only
WPI entity's precedent exactly.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/PillFillOrder.gs` — never the
reverse, per `shared/README.md`.
