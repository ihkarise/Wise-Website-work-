# InventoryTransaction

Explains `inventory-transaction.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-7 (docs/50-PHASE-3-TECHNICAL-PLAN.md §10, §19)

The append-only stock-movement ledger backing `InventoryItem.quantity_on_hand`
(`inventory-item.schema.json`) — mirroring `CarePlan`'s own append-only-versioning
discipline rather than mutating a running total in place. Governed by
`docs/53-PHASE-3-IMPLEMENTATION-RULES.md` and `docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md`
§7/§19's required `LockService` mitigation.

## Strictly append-only — no update, ever

There is no `foundationDsUpdateById_()` call anywhere in `apps-script/
InventoryTransaction.gs`'s own implementation — every row, once written, is permanent
and unmodified, satisfying docs/54 §19's explicit requirement ("`InventoryTransaction`
remains append-only with no `updateById`/patch call anywhere in its own
implementation"). A mistaken transaction is corrected by recording a new, offsetting
`adjustment` row — never by editing or deleting the original, the same "append a
correction, never rewrite history" discipline every other Foundation-family ledger-
shaped entity already follows.

## Recording a transaction: the platform's first `LockService` use

`foundationRecordInventoryTransaction_()` is the platform's first call site for
`LockService.getScriptLock()` (docs/54 §7/§18/§19) — additive only, zero change to
`FoundationDataStore.gs` or any other frozen file. The full sequence, inside one
`tryLock()`/`releaseLock()` critical section:

1. Validate `inventory_item_id` references a real, currently-`'active'` InventoryItem,
   and `created_by` references a real Doctor.
2. Append the new `InventoryTransaction` row (`foundationDsInsert_`) — safe under
   concurrency even without a lock, since `appendRow()` is serialized at the Sheets API
   level (docs/54 §7's own finding), but performed inside the lock anyway so the
   recompute in step 3 always sees this row and no concurrent writer's write is lost.
2. Recompute `quantity_on_hand` from scratch — the full sum of every `change_qty` row
   for this `inventory_item_id`, including the row just appended (never "previous cached
   value + this delta," which would not be recoverable if the cache ever drifted) — and
   write it back to the `InventoryItem` row via `foundationDsUpdateById_()`.
3. If the recomputed `quantity_on_hand` is at or below the item's own
   `reorder_threshold`, record an `inventory_low_stock` Notification
   (`apps-script/Notification.gs`'s `foundationRecordNotification_()`), `doctor_id` set
   to the transaction's own `created_by` — the only real actor identity available in
   this batch's scope, a disclosed, minimal choice (see "Low-stock Notification" below).

If `tryLock()` fails (another execution currently holds the lock), the function returns
immediately with a new, expected error code — `FOUNDATION_LOCK_UNAVAILABLE` — and
performs **no** write at all (no ledger row, no cache update, no Notification): a caller
sees "please try again," never a corrupted or partial write. `docs/54 §19`'s own
required concurrent-write test is `validation/phase-2a-foundation/conformance.js`'s
Stage 23, which holds the lock externally (mocked `LockService`) before invoking this
function and asserts exactly this fail-safe behavior.

## Why recompute-from-ledger, not "cached value + delta"

A naive "read the current cached value, add `change_qty`, write it back" sequence is
exactly the lost-update race docs/54 §7 names as this review's most serious failure
mode: if the cache were ever wrong for any reason, every subsequent delta-based write
would silently compound the error forever. Recomputing the full sum from the ledger on
every write means the cache is always exactly reconstructable from — and self-correcting
against — the ledger's own rows, matching docs/54 §13's recovery-strategy discipline
exactly ("a miscounted or corrupted cached `quantity_on_hand` is always recoverable by
replaying the ledger"). At this batch's actual projected scale (docs/54 §11: low
hundreds of transactions per item at the Year-5 high end) a full per-item scan costs
nothing measurable — the same "not a concern today" finding docs/54 §9 already makes for
`foundationDsQuery_`'s own O(rows) cost at current row counts.

## Low-stock Notification — a disclosed, minimal choice

docs/50 §10 states the trigger ("crossing `reorder_threshold` produces an
`inventory_low_stock` Notification") but does not name who receives it. This batch's
disclosed choice: `doctor_id` is set to the transaction's own `created_by` (the doctor
who performed the stock movement that crossed the threshold) — the only real,
identifiable actor available in this batch's scope, with no broadcast-to-all-staff
mechanism designed or invented here. **No real email transport is built for this alert
in this batch** — `foundationRecordNotification_()` is called with `channel: 'email'`,
`status: 'sent'` representing that the deterministic low-stock signal was successfully
recorded, not that an email was actually sent; the row is internal-only in this batch
(no `FoundationRouter.gs` route reads a doctor's own Notifications yet — mirroring
`Notification.gs`'s own WPI-6 disclosure that `foundationGetNotificationsForDoctor_()` is
"internal-only in this batch"), ready for a future batch (a doctor-facing alerts view,
or a real email sender) to adopt. This is the same "mechanism ships, a future batch
wires the rest" precedent `CalculatorRegistry.gs`'s "ships empty" and `Appointment.gs`'s
"no patient UI" disclosures already established — not a gap silently assumed away.

## Validation rules

- `inventory_item_id`: required, must reference an existing, currently-`'active'`
  InventoryItem.
- `change_qty`: required, a non-zero integer.
- `reason`: required, one of `restock`/`dispense`/`adjustment`.
- `reference_id`: optional; no reference-integrity check is performed (it may point at
  a future `PillFillOrder`, WPI-8, not yet built).
- `created_by`: required, must reference an existing Doctor.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other entity's input validation already follows. A held lock returns
`FOUNDATION_LOCK_UNAVAILABLE`, a distinct, expected outcome, never conflated with an
input-validation failure.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `transaction_id` | Yes (server-generated UUID) | No |
| `inventory_item_id` | Yes (staff/doctor-supplied, validated) | No |
| `change_qty` | Yes (staff/doctor-supplied, validated) | No |
| `reason` | Yes (staff/doctor-supplied, validated) | No |
| `reference_id` | Yes (`''` sentinel if none) | No |
| `created_by` | Yes (staff/doctor-supplied, validated) | No |
| `created_at` | Yes (server-set) | No |

## No patient write path — ever, in this batch

There is no create/update Web App route in `FoundationRouter.gs` for this entity at
all — every write is the one manually-run Apps Script editor function,
`recordFoundationInventoryTransaction()`, mirroring every earlier doctor/staff-only
entity's precedent exactly.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/InventoryTransaction.gs` — never
the reverse, per `shared/README.md`.
