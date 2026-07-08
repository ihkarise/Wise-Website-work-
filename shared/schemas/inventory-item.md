# InventoryItem

Explains `inventory-item.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch WPI-7 (docs/50-PHASE-3-TECHNICAL-PLAN.md §10, §19)

A stock-keeping record for the clinic's own remedy/product catalog — doctor/staff-facing
only, never patient-facing (docs/50 §10's own "Ownership: Doctor/staff-facing only").
Governed by `docs/53-PHASE-3-IMPLEMENTATION-RULES.md`, gated on the Sheets-at-scale
capacity review (`docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md`) closing before this batch
could begin.

## `quantity_on_hand` is never directly writable

docs/50 §10's own words: "`quantity_on_hand` is a derived/cached value, recomputed from
the transaction ledger, never the sole source of truth." A new item is always created
with `quantity_on_hand: 0` — the create operation never accepts a starting quantity from
its caller. To set a real starting stock count, staff record an initial `restock` (or
`adjustment`) `InventoryTransaction` (`inventory-transaction.schema.json`) against the
new item immediately after creating it. This keeps the ledger the single path by which
`quantity_on_hand` is ever computed, with no "create-time bypass" — the same discipline
`docs/54` §13's recovery strategy relies on ("a miscounted or corrupted cached
`quantity_on_hand` is always recoverable by replaying the ledger from its `change_qty`
rows").

Every write to `quantity_on_hand` happens inside `apps-script/InventoryTransaction.gs`'s
`foundationRecordInventoryTransaction_()`, wrapped in `LockService.getScriptLock()` —
docs/54 §7/§19's required mitigation, the platform's first use of this primitive. See
`inventory-transaction.md` for the full locking discipline.

## `status` — one-way transition, mirrors every other lifecycle entity

`active` at creation. `foundationRetireInventoryItem_()` (a manually-run Apps Script
editor function, see below) transitions a row to `retired`, one-way, never reverted — a
retired item no longer appears in the Doctor Dashboard's inventory view
(`foundationGetInventoryItemsForDoctor_()` filters it out) and is rejected by
`foundationRecordInventoryTransaction_()` if a caller tries to post a transaction against
it. The same threshold-update path lets staff adjust `reorder_threshold` without
retiring the item.

## No patient-facing write path — ever, in this batch

Every write (create, retire, threshold-update) is a manually-run Apps Script editor
function — `createFoundationInventoryItem()`, `retireFoundationInventoryItem()`,
`updateFoundationInventoryItemThreshold()` — mirroring `Appointment.gs`'s/
`CarePlan.gs`'s own "doctor/staff-owned, no authenticated write route" precedent exactly.
This is a deliberate, disclosed continuation of that precedent, not an assumption:
docs/50 §14's "Inventory and PillFill writes are doctor/staff-authenticated only" is
read here as "no patient can ever write this," not as "every write must be a new,
authenticated Web App route" — every WPI-1 through WPI-6 doctor-owned entity kept its
own writes as manually-run editor functions even after a real `DoctorSession` existed
(WPI-5's `Appointment.gs` is the most recent, directly on-point example), and
introducing an authenticated write route for Inventory specifically, with no
`FoundationRouter.gs` dispatch case named anywhere in docs/50 §10, would be exactly the
kind of "hidden architecture change" docs/53 §6 forbids. The one doctor-facing surface
this batch adds is a read-only route (`get_inventory_items`), deriving `doctor_id`
exclusively from the verified `DoctorSession`, mirroring `get_doctor_appointments`
exactly.

## `specialty_scope` — optional, filters the Doctor Dashboard view

Mirrors `appointment.schema.json`'s `specialty_slug`-derived visibility discipline
(docs/50 §6.2/§6.3, ADR-018), applied here to an explicitly optional field rather than a
server-derived one: an item with `specialty_scope: ''` is visible to every doctor
regardless of specialty (today's only-seeded-specialty behavior, unaffected in
practice); a non-empty `specialty_scope` restricts visibility to a doctor whose own
`specialty_slug` (or the implicit default, if unset) matches. `foundationGetInventoryItemsForDoctor_()`
applies this filter, mirroring `foundationGetDoctorAppointments_()`'s own
specialty-scoping logic. No item is created with a populated `specialty_scope` by this
batch's own manually-run tooling by default (staff supply one only if they choose to) —
docs/50 §10 names the field but does not mandate populating it.

## `created_by`/`created_at` — disclosed, additive provenance fields

docs/50 §10 does not name a provenance field in its own literal attribute list for
`InventoryItem` (unlike `InventoryTransaction`, which explicitly names `created_by
(doctor_id)`). This schema's `created_by`/`created_at` are this batch's disclosed,
additive completion of that gap — necessary audit-trail provenance, the same category
of implementation-time field-level decision `Appointment.gs`'s `created_by` and
`CarePlan.gs`'s `version_key` already made for their own schema-necessary fields docs/50
did not itself spell out.

## Validation rules

- `name`/`sku`/`unit`: required, non-empty strings.
- `reorder_threshold`: required, a non-negative integer.
- `specialty_scope`: optional; when non-empty, must reference a real Specialty Registry
  entry (`SpecialtyRegistry.gs`'s `foundationGetSpecialtyBySlug_()`).
- `created_by`: required, non-empty (the staff/doctor identifier who created the row).
- `quantity_on_hand`/`status`: never accepted from a create request — always `0`/
  `'active'` respectively.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other entity's input validation already follows.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `inventory_item_id` | Yes (server-generated UUID) | No |
| `name` | Yes (staff-supplied) | No |
| `sku` | Yes (staff-supplied) | No |
| `unit` | Yes (staff-supplied) | No |
| `quantity_on_hand` | Yes (always `0`) | Yes — only via `InventoryTransaction.gs`'s locked recompute, never directly |
| `reorder_threshold` | Yes (staff-supplied) | Yes — via `updateFoundationInventoryItemThreshold()` |
| `specialty_scope` | Yes (staff-supplied, `''` sentinel if unscoped) | No |
| `status` | Yes (`'active'`) | Yes — one-way, to `'retired'` only |
| `created_by` | Yes (staff/doctor-supplied) | No |
| `created_at` | Yes (server-set) | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/InventoryItem.gs` — never the
reverse, per `shared/README.md`.
