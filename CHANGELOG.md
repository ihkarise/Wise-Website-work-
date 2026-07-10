# Changelog

All notable changes to the Wise Homeopathy website are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are in `YYYY-MM-DD`.

See `WEBSITE-AUDIT.md` for the full audit this work is based on, and its Phase 4 log for roadmap-item-level tracking.

## [Unreleased]

Nothing pending.

## 2026-07-16 — Phase 3 Batch WPI-9: Analytics

Implements Batch WPI-9 (docs/50-PHASE-3-TECHNICAL-PLAN.md §12/§19), a consumer of
Doctor Dashboard (WPI-4, already shipped), benefiting from Inventory (WPI-7) and
PillFill Integration (WPI-8) without strictly requiring either, per
docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch gate. Re-confirms
docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md's own Analytics-specific gate (§18 item 4:
"scope its own reports to bounded ranges"). **Explicitly scoped to WPI-9 only — no
later batch (WPI-10 onward) is authorized by this change.**

### Added (Apps Script)
- **`apps-script/Analytics.gs`** (new) — Analytics is **not a stored entity** (docs/50
  §12, docs/33 §7.6): a computed, read-only, doctor-facing aggregate view with no
  schema of its own. `foundationGetAnalyticsForDoctor_()` returns six report sections,
  each a deterministic count/sum/rate over already-stored rows, never an AI-generated
  interpretation, prediction, or recommendation:
  - `check_in_completion` — `CheckInResponse` rows scoped directly by
    `condition_slug` → specialty (`SpecialtyRegistry.gs`, mirroring
    `DoctorPatientRoster.gs`'s own derivation).
  - `care_plan_activity` — `CarePlan` version counts, scoped to the doctor's own
    roster (`DoctorPatientRoster.gs`'s `foundationGetDoctorPatientRoster_()`, reused).
  - `calculator_engagement` — `CalculatorResult` rows, same roster scoping, grouped by
    `calculator_slug`.
  - `inventory_turnover` — `InventoryTransaction` rows, scoped to the doctor's own
    specialty-visible `InventoryItem` list (`InventoryItem.gs`'s
    `foundationGetInventoryItemsForDoctor_()`, reused).
  - `pillfill_fulfillment` — the doctor's own specialty-scoped `PillFillOrder` list
    (`PillFillOrder.gs`'s `foundationGetPillFillOrdersForDoctor_()`, reused).
  - `appointment_conversion` — `Appointment` rows scoped directly by `specialty_slug`.

  Every section is bounded to a fixed trailing **30-day window** (`from`/`to` ISO
  timestamps returned alongside the report) — never "all history", the forward
  constraint docs/54 §18 item 4 named for this batch specifically. Zero new Sheet,
  zero new schema, zero modification to any of the seven entities read.

### Added (router, registry, dashboard)
- **`apps-script/FoundationRouter.gs`** — one new, additive, read-only dispatch case,
  `get_doctor_analytics`, deriving `doctor_id` exclusively from the verified
  `DoctorSession`, mirroring `get_pillfill_orders` exactly. No write route exists —
  there is nothing for this view to write.
- **`shared/constants/doctor-module-registry.json`** (1.4.0 → 1.5.0) and
  **`apps-script/DoctorModuleRegistry.gs`** — this registry's fifth real entry,
  `analytics` (`display_order: 50`, `data_source: get_doctor_analytics`).
- **`doctor-dashboard/dashboard.js`** — one new, read-only Analytics card rendering a
  plain summary line per report section (counts/rates, no chart or graph — registry-
  driven integration only, not a dashboard redesign), structurally parallel to the
  Patient Roster/Appointments/Inventory/PillFill Orders cards (docs/50 §7.3's
  registry-driven discipline unchanged — `renderDashboard()`/`dispatchLoaders()`
  themselves gained no new logic, only a new registry entry and a new loader).

### Added (validation)
- **`validation/phase-2a-foundation/harness.js`** — `Analytics.gs` added to the loaded
  `FILES` list; no new mock needed (a computed view reusing only already-mocked
  primitives).
- **`validation/phase-2a-foundation/conformance.js`** — new Stage 25 (34 checks):
  every report section's aggregation math verified as an exact delta over a
  pre-fixture snapshot (immune to the shared, cumulative in-memory spreadsheet's own
  cross-stage fixture volume, docs/54 §2.1), the fixed 30-day window genuinely
  excluding a directly-inserted, outside-window fixture row per entity, roster-scoping
  correctly excluding an off-roster patient's own `CarePlan`/`CalculatorResult`, the
  new HTTP dispatch case end to end, and cross-identity-type rejection.
- **`validation/wpi-9-analytics/browser-test.js`** (new, 18 checks) — the Analytics
  card's own render of an all-zero report and a real, non-zero report (Analytics has
  no "empty list" state, unlike every prior WPI card), loader-dispatch participation,
  and the disabled-capability/fail-closed path, mirroring
  `validation/wpi-8-pillfill/browser-test.js`'s split-suite discipline exactly.

### Fixed (disclosed, mechanical — not a defect, a factual-count update)
- **Ten pre-existing conformance assertions** (`validation/phase-2a-foundation/
  conformance.js` Stage19/Stage20/Stage21/Stage22/Stage23/Stage24) and **four matching
  count assertions** (`validation/wpi-4-doctor-dashboard/browser-test.js`/
  `validation/wpi-5-appointment/browser-test.js`/`validation/wpi-7-inventory/
  browser-test.js`/`validation/wpi-8-pillfill/browser-test.js`) hard-coded the Doctor
  Module Registry's total entry count at four — mechanically, disclosedly updated to
  five, mirroring the exact precedent Batch WPI-8 already set for these same
  assertions.

### What this batch deliberately does not do
- **No AI, no forecasting, no ML.** Every report is a deterministic aggregation over
  already-stored rows — docs/50 §12's own hard boundary; any future AI-assisted
  analytics narrative remains independently gated by ADR-001/004/005/019.
- **No dashboard redesign.** One new registry entry and one new card, rendered with
  the same plain list markup every existing card already uses — no chart/graph
  library, no new CSS, no change to `renderDashboard()`/`dispatchLoaders()` themselves.
- **No patient-facing analytics.** Doctor/staff-facing only (docs/50 §12's own
  "Ownership" clause).
- **No configurable date range.** The window is a fixed, server-computed trailing
  30 days — not a caller-supplied parameter — the simplest way to honor docs/54 §18
  item 4's "bounded ranges" constraint without adding request-shape validation surface
  this batch's own scope does not need.
- **No caching or materialized aggregate.** Every report recomputes from scratch on
  each request, per docs/50 §12/docs/54 §4's own disclosed read-cost profile — adding
  one would be new infrastructure disguised as an Analytics feature, contrary to
  docs/53 §3/§6.
- **No modification to any frozen Foundation/Identity & Access/Patient
  Access/PXP-1..11/WPI-1..8 file.**

### Validation
- Static Analysis: 0 findings (60 `apps-script/*.gs` files scanned).
- Conformance: 689/689 checks passed (34 new in Stage 25).
- Phase 1.5 Regression: 45/45 checks passed, untouched.
- Browser suites: all 15 suites green, 328/328 checks passed (18 new in
  `validation/wpi-9-analytics/`).

## 2026-07-16 — Phase 3 Batch WPI-8: PillFill Integration

Implements Batch WPI-8 (docs/50-PHASE-3-TECHNICAL-PLAN.md §11/§19), a consumer of
Inventory (WPI-7, already shipped) and the already-shipped `DoctorInstruction` (PXP-7),
per docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch gate. **Explicitly scoped to
WPI-8 only — no later batch (WPI-9 onward) is authorized by this change.**

### Added (schema)
- **`shared/schemas/pillfill-order.schema.json`** (new, version 1.0.0, + `.md`) — the
  `PillFillOrder` record shape (docs/50 §11): connects a `medicine`-type Doctor
  Instruction to fulfillment; `status`
  (`requested`/`in_progress`/`fulfilled`/`shipped`/`delivered`/`cancelled`) one-way;
  disclosed additive `created_by` provenance field mirroring
  `appointment.schema.json`'s/`inventory-item.schema.json`'s own precedent.

### Added (Apps Script)
- **`apps-script/PillFillOrder.gs`** (new) — `foundationCreatePillFillOrder_()`
  (rejects a `doctor_instruction_id` that is not a real, `medicine`-type
  `DoctorInstruction` belonging to the same `patient_id`, or an `inventory_item_id`
  that does not reference a real, active `InventoryItem`), the dedicated
  `foundationFulfillPillFillOrder_()` (the one operation with side effects — see
  below), the generic `foundationUpdatePillFillOrderStatus_()` (`'fulfilled'` is never
  a reachable target here), and `foundationGetPillFillOrdersForDoctor_()`
  (specialty-scoped via the referenced `InventoryItem`, enriched with the linked
  patient's `full_name` and the item's own `name`/`sku`). Every write is a manually-run
  Apps Script editor function
  (`createFoundationPillFillOrder()`/`fulfillFoundationPillFillOrder()`/
  `updateFoundationPillFillOrderStatus()`), mirroring `Appointment.gs`'s/
  `InventoryItem.gs`'s precedent exactly — a deliberate continuation of every prior WPI
  batch's "doctor/staff-owned entity writes stay manually-run" discipline, not a
  departure, even though a real `DoctorSession` already exists.
- **`foundationFulfillPillFillOrder_()`** reuses `InventoryTransaction.gs`'s existing,
  unmodified `foundationRecordInventoryTransaction_()` (reason `dispense`,
  `change_qty` exactly `-quantity`, `reference_id` the order's own `order_id`) — **the
  platform's first real, non-manual trigger for that function's `LockService` critical
  section** (docs/54 §7/§17's own "the concrete trigger for this becoming real, not
  just theoretical") — and `Notification.gs`'s existing, unmodified
  `foundationRecordNotification_()` (type `pillfill_order_status`, `patient_id` set to
  the order's own `patient_id`). If the InventoryTransaction call fails for any reason,
  including a contended lock (`FOUNDATION_LOCK_UNAVAILABLE`), the order's own status is
  never touched — no partial fulfillment. Once fulfilled, an order can no longer be
  cancelled — a disclosed boundary, docs/50 §11 designs no reversal mechanism.

### Added (router, registry, dashboard)
- **`apps-script/FoundationRouter.gs`** — one new, additive, read-only dispatch case,
  `get_pillfill_orders`, deriving `doctor_id` exclusively from the verified
  `DoctorSession`, mirroring `get_inventory_items` exactly. No create/fulfill/
  status-update route exists over HTTP.
- **`shared/constants/doctor-module-registry.json`** (1.3.0 → 1.4.0) and
  **`apps-script/DoctorModuleRegistry.gs`** — this registry's fourth real entry,
  `pillfill_orders` (`display_order: 40`, `data_source: get_pillfill_orders`).
- **`doctor-dashboard/dashboard.js`** — one new, read-only PillFill Orders card,
  structurally parallel to the Patient Roster/Appointments/Inventory cards (docs/50
  §7.3's registry-driven discipline unchanged — `renderDashboard()`/`dispatchLoaders()`
  themselves gained no new logic, only a new registry entry and a new loader).

### Added (validation)
- **`validation/phase-2a-foundation/harness.js`** — `PillFillOrder.gs` added to the
  loaded `FILES` list; no new mock needed (reuses `InventoryTransaction.gs`'s own
  already-mocked `LockService` critical section and `Notification.gs`'s own
  already-mocked primitives).
- **`validation/phase-2a-foundation/conformance.js`** — new Stage 24 (43 checks):
  validation rejections (including the `medicine`-type/same-`patient_id` reference
  checks), the dedicated fulfill operation's real `InventoryTransaction` dispense and
  `pillfill_order_status` Notification, a genuine external-contention `LockService`
  test proving no partial fulfillment (mirroring Stage 23's own discipline), the
  `'fulfilled'`-is-never-a-generic-target proof, the full one-way lifecycle
  (`requested → in_progress → fulfilled → shipped → delivered`, and the
  `requested`/`in_progress → cancelled` branches), specialty-scoping via the joined
  `InventoryItem` (including a direct-insert fixture proving a non-matching
  `specialty_scope` is actually excluded), the new HTTP dispatch case end to end, and
  cross-identity-type rejection.
- **`validation/wpi-8-pillfill/browser-test.js`** (new, 14 checks) — the PillFill
  Orders card's own render/empty/status-label states and loader-dispatch
  participation, mirroring `validation/wpi-7-inventory/browser-test.js`'s split-suite
  discipline exactly.
- **`validation/static-analysis/analyze.js`** — the three new manually-run wrapper
  function names added to the existing allowlist.

### Fixed (disclosed, mechanical — not a defect, a factual-count update)
- **Four pre-existing conformance assertions** (`validation/phase-2a-foundation/
  conformance.js` Stage19/Stage20/Stage21/Stage23) and **three matching count
  assertions** (`validation/wpi-4-doctor-dashboard/browser-test.js`/
  `validation/wpi-5-appointment/browser-test.js`/`validation/wpi-7-inventory/
  browser-test.js`) hard-coded the Doctor Module Registry's total entry count at three
  — mechanically, disclosedly updated to four, mirroring the exact precedent Batch
  WPI-7 already set for these same assertions.

### What this batch deliberately does not do
- **No PillFillOrder write route.** Every write remains a manually-run Apps Script
  editor function — no authenticated Web App write path for create, fulfill, or any
  status transition, per this batch's own disclosed continuation of every prior WPI
  batch's precedent.
- **No external PillFill vendor API, webhook, or integration contract.** docs/50 §11's
  own explicit restraint — this batch is the platform's own internal
  order-and-fulfillment record only.
- **No patient-facing order-status view.** A plausible future extension (docs/50 §11),
  not this batch's scope.
- **No stock-sufficiency check.** Neither creation nor fulfillment validates `quantity`
  against current `quantity_on_hand` — `InventoryTransaction.gs`'s own `change_qty`
  validation already permits any non-zero signed integer regardless of the resulting
  balance, and this batch does not invent a gate `InventoryTransaction.gs` itself does
  not enforce.
- **No Analytics (WPI-9) or any later batch.**
- **No modification to any frozen Foundation/Identity & Access/Patient
  Access/PXP-1..11/WPI-1..7 file.**

### Validation
- Static Analysis: 0 findings.
- Conformance: 655/655 checks passed (43 new in Stage 24).
- Phase 1.5 Regression: 45/45 checks passed, untouched.
- Browser suites: all 14 suites green, 310/310 checks passed (14 new in
  `validation/wpi-8-pillfill/`).

## 2026-07-16 — Phase 3 Batch WPI-7: Inventory

Implements Batch WPI-7 (docs/50-PHASE-3-TECHNICAL-PLAN.md §10/§19), a consumer of
Pillar 2 (Doctor Dashboard) dependent on WPI-4 and WPI-6 (both already shipped), per
docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch gate. Preceded by
docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md closing the Sheets-at-production-scale gate
docs/49 §7/docs/51 Part 3 item 1/Part 5 named specifically for this batch. **Explicitly
scoped to WPI-7 only — no later batch (WPI-8 onward) is authorized by this change.**

### Added (schema)
- **`shared/schemas/inventory-item.schema.json`** (new, version 1.0.0, + `.md`) — the
  `InventoryItem` record shape (docs/50 §10): `quantity_on_hand` is never accepted from
  a create/update request (always `0` at creation, thereafter written only via the
  ledger's own recompute); `specialty_scope` optional (ADR-018); `status`
  (`active`/`retired`) one-way; disclosed additive `created_by`/`created_at` provenance
  fields.
- **`shared/schemas/inventory-transaction.schema.json`** (new, version 1.0.0, + `.md`)
  — the `InventoryTransaction` record shape (docs/50 §10): an append-only ledger row
  (`transaction_id`, `inventory_item_id`, `change_qty`, `reason`, `reference_id`,
  `created_by`, `created_at`), never updated or patched once written.

### Added (Apps Script)
- **`apps-script/InventoryItem.gs`** (new) — `foundationCreateInventoryItem_()`,
  `foundationGetInventoryItemById_()`, `foundationGetInventoryItemsForDoctor_()`
  (specialty-scoped, active-only, enriched with a computed `low_stock` boolean),
  `foundationRetireInventoryItem_()`, `foundationUpdateInventoryItemThreshold_()`.
  Every write is a manually-run Apps Script editor function
  (`createFoundationInventoryItem()`/`retireFoundationInventoryItem()`/
  `updateFoundationInventoryItemThreshold()`), mirroring `Appointment.gs`'s/
  `CarePlan.gs`'s precedent exactly — a deliberate continuation of every prior WPI
  batch's "doctor/staff-owned entity writes stay manually-run" discipline, not a
  departure, even though a real `DoctorSession` already exists.
- **`apps-script/InventoryTransaction.gs`** (new) —
  `foundationRecordInventoryTransaction_()`, **the platform's first use of
  `LockService`** (docs/54 §7/§18/§19's required mitigation). Wraps the entire
  append-then-recompute-then-cache-write sequence in one `LockService` critical
  section: `quantity_on_hand` is recomputed in full from every `change_qty` row in the
  ledger, never a cached-value-plus-delta update, so the cache is always
  reconstructable from — and self-correcting against — the ledger (docs/54 §13). A
  contended lock returns a new, expected `FOUNDATION_LOCK_UNAVAILABLE` envelope and
  performs no write at all — no ledger row, no cache update, no Notification. Strictly
  append-only: no `updateById`/patch call anywhere in this file targets its own ledger
  sheet. Crossing `reorder_threshold` records an `inventory_low_stock` Notification via
  `Notification.gs`'s own existing, unmodified mechanism (WPI-6) — `doctor_id` set to
  the transaction's own `created_by`; no real email transport is built for this alert
  in this batch, a disclosed, minimal choice (`shared/schemas/
  inventory-transaction.md`). The one manually-run wrapper,
  `recordFoundationInventoryTransaction()`, mirrors every other doctor/staff-only
  entity's precedent.

### Added (router, registry, dashboard)
- **`apps-script/FoundationRouter.gs`** — one new, additive, read-only dispatch case,
  `get_inventory_items`, deriving `doctor_id` exclusively from the verified
  `DoctorSession`, mirroring `get_doctor_appointments` exactly. No write route exists
  for either entity.
- **`shared/constants/doctor-module-registry.json`** (1.2.0 → 1.3.0) and
  **`apps-script/DoctorModuleRegistry.gs`** — this registry's third real entry,
  `inventory` (`display_order: 30`, `data_source: get_inventory_items`).
- **`doctor-dashboard/dashboard.js`** — one new, read-only Inventory card, structurally
  parallel to the Patient Roster/Appointments cards (docs/50 §7.3's registry-driven
  discipline unchanged — `renderDashboard()`/`dispatchLoaders()` themselves gained no
  new logic, only a new registry entry and a new loader).

### Added (validation)
- **`validation/phase-2a-foundation/harness.js`** — a new `LockService.getScriptLock()`
  mock (`tryLock()`/`releaseLock()`, a faithful single-process exclusive lock), plus
  `InventoryItem.gs`/`InventoryTransaction.gs` added to the loaded `FILES` list.
- **`validation/phase-2a-foundation/conformance.js`** — new Stage 23 (44 checks):
  validation rejections, `quantity_on_hand` recompute-from-ledger correctness,
  append-only-ledger proof, low-stock Notification production, a genuine
  external-contention `LockService` test (holds the lock externally, asserts
  `FOUNDATION_LOCK_UNAVAILABLE` and zero write, then releases and confirms success),
  retire/threshold-update lifecycle, specialty-scoping (including a direct-insert
  fixture proving a non-matching `specialty_scope` is actually excluded), the new HTTP
  dispatch case end to end, and cross-identity-type rejection.
- **`validation/wpi-7-inventory/browser-test.js`** (new, 13 checks) — the Inventory
  card's own render/empty/low-stock states and loader-dispatch participation, mirroring
  `validation/wpi-5-appointment/browser-test.js`'s split-suite discipline exactly.
- **`validation/static-analysis/analyze.js`** — the four new manually-run wrapper
  function names added to the existing allowlist.

### Fixed (disclosed, pre-existing documentation drift — not introduced by this batch)
- **`docs/33-DOMAIN-MODEL.md`** — three stale section headers corrected: §1.4 (Doctor)
  and §4.1 (Appointment) and §4.2 (Notification) each still read *Conceptual (gap)* in
  their own heading despite each entity's own body text already recording its later
  promotion to *Implemented* (Batches WPI-1, WPI-5, and WPI-6 respectively) — found
  during this batch's own repository consistency review (docs/53 §14), the same
  "keep history, correct the stale current-status framing" rule docs/48 §5 already
  applied once to this same document. No entity's shape, schema, or shipped behavior
  changed by any of these corrections.
- **`shared/constants/doctor-module-registry.md`** — had not been updated since Batch
  WPI-4 despite Batch WPI-5's own real `appointments` addition to the JSON/`.gs` files;
  now records both WPI-5's and this batch's own WPI-7 addition.
- **Three pre-existing conformance assertions** (`validation/phase-2a-foundation/
  conformance.js` Stage19/Stage20/Stage21/Stage22, and matching count assertions in
  `validation/wpi-4-doctor-dashboard/browser-test.js`/`validation/wpi-5-appointment/
  browser-test.js`) hard-coded the Doctor Module Registry's total entry count or used
  the literal string `'inventory'` as a "definitely unregistered" test fixture — both
  mechanically, disclosedly updated to reflect this batch's own registry growth,
  mirroring the exact precedent Batch WPI-5 already set for Stage19/Stage20's own
  count assertions.

### What this batch deliberately does not do
- **No InventoryItem/InventoryTransaction write route.** Every write remains a
  manually-run Apps Script editor function — no authenticated Web App write path for
  either entity, per this batch's own disclosed continuation of every prior WPI batch's
  precedent.
- **No real email transport for the low-stock alert.** The `inventory_low_stock`
  Notification row is produced; no `MailApp` call or recipient template is built in
  this batch.
- **No caching, indexing, or query language added to `FoundationDataStore.gs`** — docs/54
  §18's explicit recommendation against this as part of WPI-7.
- **No PillFill Integration (WPI-8), Analytics (WPI-9), or any later batch.**
- **No modification to any frozen Foundation/Identity & Access/Patient
  Access/PXP-1..11/WPI-1..6 file.**

### Validation
- Static Analysis: 0 findings.
- Conformance: 612/612 checks passed (44 new in Stage 23).
- Phase 1.5 Regression: 45/45 checks passed, untouched.
- Browser suites: all 13 suites green, 296/296 checks passed (13 new in
  `validation/wpi-7-inventory/`).

## 2026-07-08 — Phase 3: Google Sheets Production Scale / Capacity Review (WPI-7/WPI-9 gate)

Documentation-only. Produces `docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md`, the dedicated
technical/capacity review docs/49 §7, docs/51 Part 3 item 1/Part 5, and docs/52 name as
a required gate before Batch WPI-7 (Inventory) and Batch WPI-9 (Analytics) specifically
— **not** WPI-7 implementation itself, and does not authorize WPI-7 or any other batch
to begin. Fulfills ADR-006's own deferred "Future Considerations" ask for a concrete
migration trigger.

### Added (documentation)
- **`docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md`** (new) — reviews
  `FoundationDataStore.gs`'s actual current mechanics (full-table-scan
  `query`/`getById`, O(rows) `updateById`, zero `LockService` usage anywhere in the
  repo, confirmed by direct grep), estimates WPI-7/WPI-9's real Inventory-ledger and
  Analytics-aggregation workload against Google's published Sheets/Apps Script
  platform limits, and closes with numeric Green/Yellow/Red operational thresholds and
  concrete migration triggers. **Verdict:** Green zone at clinic launch and through
  Year 1; Yellow-adjacent (not Red) through Year 5 projections; conditional on WPI-7
  shipping the review's one required mitigation — wrapping every read-modify-write
  sequence on `InventoryItem.quantity_on_hand` (or any other cached/derived field) in
  `LockService`, the platform's first use of that primitive, additive only.

### Changed (documentation)
- **`docs/24-ROADMAP.md`** — Phase 3 section: the previously-open
  Sheets-at-production-scale gate is now recorded as closed by docs/54, with the
  explicit caveat that this closes only the named pre-condition, not WPI-7/WPI-9's own
  separate approval gate (docs/53 §13, unchanged). Added docs/54 to the Phase 3
  architecture document list.
- **`docs/31-ADR-INDEX.md`** — added a "Relationship to Other Documents" cross-reference
  noting docs/54 fulfills ADR-006's own deferred migration-trigger ask. ADR-006 itself
  is **not** amended or superseded — remains Accepted, unchanged.

### What this batch deliberately does not do
- **No WPI-7 (Inventory) implementation.** No new schema, Apps Script module, frontend
  change, validation suite, router dispatch case, or registry entry — this is the
  prerequisite review only, per docs/53 Phase C's "explain before writing code"
  discipline applied to an infrastructure decision.
- **No migration off Google Sheets.** docs/49 §7's own framing, restated by docs/54:
  this review decides whether WPI-7/WPI-9 may proceed on Sheets as designed, under
  what conditions — it does not decide to migrate.
- **No modification to any frozen file.** Zero `apps-script/*.gs`,
  `shared/schemas/*.schema.json`, or `shared/constants/*.json` file touched.

### Validation
- Documentation-only change; no code path exists to run Static Analysis, Conformance,
  Regression, or a browser suite against. Repository consistency verified by direct
  read of every cited source document (docs/49 §7, docs/50 §10/§17.1, docs/51 Part 3
  item 1/Part 5, docs/52, ADR-006, `FoundationDataStore.gs`, `CarePlan.gs`,
  `Notification.gs`) and a repo-wide grep confirming zero `LockService` usage exists
  today.

## 2026-07-16 — Phase 3 Batch WPI-6: Notification (unification)

Implements Batch WPI-6 (docs/50-PHASE-3-TECHNICAL-PLAN.md §9/§19), a consumer with no
structural dependency on any prior WPI batch, per
docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch gate. **Explicitly scoped to
WPI-6 only — no later batch (WPI-7 onward) is authorized by this change.**

### Added (schema)
- **`shared/schemas/notification.schema.json`** (new, version 1.0.0, + `.md`) — the
  `Notification` record shape (docs/50 §9): nullable `patient_id`/`doctor_id`
  (empty-string sentinel, never both non-empty on the same row), a disclosed, additive
  `recipient_email` fallback field for Phase 1.5's visit-summary flow (which predates
  Patient Identity entirely), a closed `channel`/`type`/`status` enum set, and a
  server-set `sent_at`.

### Added (Apps Script)
- **`apps-script/Notification.gs`** (new) — `foundationRecordNotification_()`
  (system-generated only — no manually-run editor function, mirroring `Session`'s own
  ownership model) plus two internal-only read helpers,
  `foundationGetNotificationsForPatient_()`/`foundationGetNotificationsForDoctor_()`,
  neither reachable over HTTP in this batch.

### Changed (disclosed, additive touch to three existing sender files)
- **`apps-script/FoundationLoginFlow.gs`** (`foundationHandleRequestLoginLink_`) — one
  additional statement recording the patient login-link send's real result as a
  Notification row. Gate, transport, and return value unchanged.
- **`apps-script/DoctorLoginFlow.gs`** (`foundationHandleRequestDoctorLoginLink_`) —
  mirrors the above exactly, `doctor_id` in place of `patient_id`.
- **`apps-script/Send.gs`** (`attemptSend_`) — Phase 1.5's own file, gaining its
  first-ever dependency on a Foundation-family function (reachable only because both
  domains share one Apps Script project, docs/29 §14 Decision 1). Records the
  visit-summary send's real result with `recipient_email` as the subject reference
  (no `patient_id` exists in Phase 1.5's `ConsultationSummary` row). Gate, transport,
  and return value unchanged.

### What this batch deliberately does not do
- **No `FoundationRouter.gs` dispatch case.** Zero patient- or doctor-facing route in
  this batch — mirrors `Session`'s "no get-my-session route either" precedent, a
  disclosed departure from `CalculatorResult`'s "backend only, but still routed" one.
- **No retrofit of Inventory/PillFill flows.** Neither exists yet (WPI-7/WPI-8); each
  adopts this same mechanism when its own batch builds it.
- No modification to any frozen Foundation/Identity & Access/Patient
  Access/PXP-1..11/WPI-1..5 file beyond the three disclosed sender-file exceptions
  above.

### Validation
- Static Analysis (`validation/static-analysis/analyze.js`) — PASS, 0 findings (56
  files scanned; the two new internal-only read helpers added to the
  `INFRASTRUCTURE_AHEAD_OF_CONSUMER` allowlist, disclosed as zero-route-by-design, not
  an oversight).
- Conformance (`validation/phase-2a-foundation/conformance.js`) — 568/568 passing (new
  Stage 22, 23 checks: exactly-one-subject-reference validation rejections, schema
  conformance for patient-scoped/doctor-scoped/recipient-email-only records,
  cross-patient and cross-doctor isolation on both read helpers, real end-to-end
  integration through the unmodified `FoundationLoginFlow.gs`/`DoctorLoginFlow.gs`,
  the anti-enumeration proof that an unmatched login-link request writes no row at
  all, and a zero-lines-touched proof against Appointment/Specialty Registry/Doctor
  Module Registry).
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`) — 45/45 passing (3 new
  checks: a successful visit-summary send records a matching Notification row, a
  failed send records one with `status: failed`, and a gate-blocked attempt records
  none at all). `validation/phase-1-5/harness.js` extended with the minimal
  Foundation-family file set `Send.gs`'s own new call requires at load time, plus a
  `SpreadsheetApp.openById()` mock backed by an entirely separate in-memory fake
  spreadsheet from Phase 1.5's own — the one disclosed exception to this harness's
  previously-stated "stays scoped to Phase 1.5's files" discipline, forced by this
  batch's cross-domain design, not a silent scope drift.
- All 12 existing browser-test suites — unaffected (zero UI/frontend change in this
  batch), re-verified passing (283 checks total, 0 failures).

### Documentation
- `docs/33-DOMAIN-MODEL.md` — §4.2 (Notification) status update appended, promoted to
  Implemented; version bumped 1.17 → 1.18.
- `docs/24-ROADMAP.md` — Phase 3 status updated; WPI-6 entry added; authorization gate
  advanced to WPI-7.
- `shared/README.md` — new paragraph for this batch's schema addition and the three
  disclosed sender-file touches.

## 2026-07-16 — Phase 3 Batch WPI-5: Appointment

Implements Batch WPI-5 (docs/50-PHASE-3-TECHNICAL-PLAN.md §8/§19), a consumer of
Pillars 1 and 2, per docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch gate.
**Explicitly scoped to WPI-5 only — no later batch (WPI-6 onward) is authorized by
this change.**

### Added (schema)
- **`shared/schemas/appointment.schema.json`** (new, version 1.0.0, + `.md`) — the
  `Appointment` record shape (docs/50 §8): nullable `patient_id`/`doctor_id`
  (empty-string sentinel until known), server-derived `specialty_slug`, a one-way
  `requested`/`confirmed`/`completed`/`cancelled` lifecycle, and a disclosed, additive
  `created_by` provenance field.

### Added (Apps Script)
- **`apps-script/Appointment.gs`** (new) — `foundationCreateAppointment_()`,
  `foundationConfirmAppointment_()` (assigns a real `doctor_id`/`scheduled_at`,
  `requested` → `confirmed`), `foundationUpdateAppointmentStatus_()` (`confirmed` →
  `completed`; `requested`/`confirmed` → `cancelled`), and
  `foundationGetDoctorAppointments_()` — a specialty-derived, patient-name-enriched
  read view, mirroring `DoctorPatientRoster.gs`'s own derivation discipline (and its
  disclosed multi-doctor-per-specialty limitation) exactly. Every write is a
  manually-run Apps Script editor function (`createFoundationAppointment()`/
  `confirmFoundationAppointment()`/`updateFoundationAppointmentStatus()`) — this
  batch's disclosed intake-mechanism decision: a staff-run transcription tool, not a
  new public write endpoint, mirroring `DoctorAssignedCondition.gs`'s
  `assignFoundationCondition()` precedent exactly.

### Added (constants)
- **`shared/constants/doctor-module-registry.json`** bumped 1.1.0 → 1.2.0 (+ `.md`
  updated) — this registry's second real entry, `appointments` (`display_order: 20`,
  `data_source: get_doctor_appointments`).
- **`apps-script/DoctorModuleRegistry.gs`** — same entry hand-ported.

### Changed
- **`apps-script/FoundationRouter.gs`** — one new, additive dispatch case:
  `get_doctor_appointments`. Zero existing case changed. Read-only — `doctor_id` is
  derived only from a verified `DoctorSession`, never client-supplied.
- **`doctor-dashboard/dashboard.js`** — a new `appointments` entry in the hand-ported
  `DOCTOR_MODULE_REGISTRY`, a new `appointmentsHtml()` renderer/`loadAppointmentsPreview()`
  loader registered in `CAPABILITY_LOADERS` — `renderDashboard()` itself is unchanged,
  the same "add a registry entry + a loader, nothing else changes" discipline WPI-4
  established.

### What this batch deliberately does not do
- **No patient-facing Appointment UI.** Exactly as docs/50 §8 scopes it — staff/doctor
  facing only in this batch's scope.
- **No create/confirm/status-update Web App route.** Every write remains a
  manually-run Apps Script editor function; `get_doctor_appointments` is the only route
  this batch adds, and it is read-only.
- **Does not populate `specialty_scope` on the new registry entry.** Mirrors
  `patient_roster`'s own precedent — the platform still has only one seeded specialty
  (docs/53 §4).
- No modification to any frozen Foundation/Identity & Access/Patient
  Access/PXP-1..11/WPI-1..4 file.

### Validation
- Static Analysis (`validation/static-analysis/analyze.js`) — PASS, 0 findings (55
  files scanned; 3 new manually-run wrapper functions added to the allowlist).
- Conformance (`validation/phase-2a-foundation/conformance.js`) — 545/545 passing (new
  Stage 21, 36 checks: creation/confirm/status-transition validation rejections, the
  full one-way state machine, specialty derivation, patient-name enrichment, the
  `get_doctor_appointments` HTTP dispatch round trip, a direct cross-identity-type
  rejection proof, and an unknown-`doctor_id` defensive check; Stage 19/Stage20's own
  registry-count assertions mechanically updated to reflect the registry's new
  two-entry reality).
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`) — 42/42 passing, unchanged.
- All 11 existing browser-test suites — unaffected (zero unrelated behavior change),
  re-verified passing (270 checks total, 0 failures), plus one mechanical, disclosed
  update to `wpi-4-doctor-dashboard`'s own `DOCTOR_MODULE_REGISTRY.length` assertion
  (1 → 2).
- New browser-test suite `validation/wpi-5-appointment/` — 13/13 passing: empty/
  populated Appointments card states, patient-name/fallback rendering, both capabilities'
  loaders firing independently and exactly once, fail-closed disabled-capability
  behavior, and a pure-function unit check.

### Documentation
- `docs/33-DOMAIN-MODEL.md` — §4.1 (Appointment) promoted to Implemented; Summary Table
  rows for Appointment and Doctor Module Registry/Doctor Module State updated; §7's own
  header status line corrected to include WPI-4/WPI-5.
- `docs/24-ROADMAP.md` — Phase 3 status updated; WPI-5 entry added; authorization gate
  advanced to WPI-6.
- `shared/README.md` — new paragraph for this batch's schema addition and registry
  version bump.

## 2026-07-16 — Phase 3 Batch WPI-4: Doctor Dashboard (frontend consumer)

Implements Batch WPI-4 (docs/50-PHASE-3-TECHNICAL-PLAN.md §7.3/§7.4/§19, ADR-020),
Phase 3/WHIMS's Pillar 2 frontend consumer half, dependent on WPI-3, per
docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch gate. **Explicitly scoped to
WPI-4 only — no later batch (WPI-5 onward) is authorized by this change.**

### Added (constants)
- **`shared/constants/doctor-module-registry.json`** bumped 1.0.0 → 1.1.0 (+ `.md`
  updated) — this registry's first real entry, `patient_roster` (`display_order: 10`,
  `data_source: get_doctor_patient_roster`).

### Added (Apps Script)
- **`apps-script/DoctorModuleRegistry.gs`** — same one entry hand-ported.
- **`apps-script/DoctorPatientRoster.gs`** (new) — `foundationGetDoctorPatientRoster_()`,
  a derived, read-only view (no new stored entity, docs/50 §7.4): every distinct
  patient with at least one active `DoctorAssignedCondition` whose `condition_slug`
  maps (via WPI-2's Condition-to-Specialty Map) to the calling doctor's own
  `specialty_slug` (or the implicit default specialty, if none is set).

### Changed
- **`apps-script/FoundationRouter.gs`** — one new, additive dispatch case:
  `get_doctor_patient_roster`. Zero existing case changed. Read-only — `doctor_id` is
  derived only from a verified `DoctorSession`, never client-supplied.

### Added (frontend)
- **`doctor-dashboard/index.html` + `doctor-dashboard/dashboard.js`** (new) — the
  platform's first authenticated, doctor-facing page: a registry-driven consumer of
  the Doctor Module Registry plus `DoctorModuleState`, structurally parallel to
  `my-health-journey/dashboard.js`'s own post-PXP-4 discipline. Every card corresponds
  to a registry entry the doctor is enabled for; `renderDashboard()` has no hardcoded
  knowledge of any specific `capability_key`. Ships with one card, Patient Roster.
- **`doctor-login.html` + `doctor-verify.html`** (new, root, `noindex`) — a disclosed,
  additive prerequisite beyond docs/50 §19's literal WPI-4 wording: reaching an
  authenticated Doctor Dashboard requires a doctor-facing login flow, and no earlier
  batch built one (WPI-1 shipped only the backend routes, explicitly "zero
  doctor-facing frontend page"). Mirrors `login.html`/`verify.html` exactly, minus the
  Trusted Device mechanism (no doctor-side equivalent exists). Uses a distinct
  `sessionStorage` key (`wise_doctor_session_token`) from the patient flow's
  `wise_session_token` — the two identity spaces' sessions are never interchangeable,
  including client-side (ADR-017).

### What this batch deliberately does not do
- **Does not enable `patient_roster` for any doctor.** `DoctorModuleState` enablement
  remains staff/administrative-only (WPI-3's `setFoundationDoctorModuleState()`,
  unchanged) — a doctor sees the card only once staff explicitly enables it, the same
  fail-closed-by-absence default every other enablement mechanism already uses.
- **Does not register any other doctor-facing capability.** `condition_assignment`,
  `care_plan_authoring`, `module_state_management`, `inventory`, `pillfill_orders`,
  and `analytics` remain docs/50 §7.1's own illustrative examples only.
- **Does not solve the multi-doctor-per-specialty roster limitation.** Disclosed,
  unchanged from docs/50 §7.4/docs/51 Part 1.6 — at real multi-doctor-per-specialty
  scale, every doctor in a specialty currently sees every patient in that specialty.
- No patient-facing surface. `my-health-journey/` is completely untouched. Zero
  modification to any frozen Foundation/Identity & Access/Patient
  Access/PXP-1..11/WPI-1..3 file.

### Validation
- Static Analysis (`validation/static-analysis/analyze.js`) — PASS, 0 findings (54
  files scanned).
- Conformance (`validation/phase-2a-foundation/conformance.js`) — 509/509 passing (new
  Stage 20, 14 checks: roster derivation across active/resolved/multi-condition
  fixtures, the implicit-default-specialty rule, the full `get_doctor_patient_roster`
  HTTP dispatch round trip, a direct cross-identity-type rejection proof, and an
  unknown-`doctor_id` defensive check; Stage 19's own registry-count assertions
  mechanically updated to reflect the registry's new one-entry reality).
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`) — 42/42 passing, unchanged.
- All 10 existing browser-test suites — unaffected (zero patient-facing change),
  re-verified passing (270 checks total, 0 failures).
- New browser-test suite `validation/wpi-4-doctor-dashboard/` — 21/21 passing:
  redirect-when-unauthenticated, empty-dashboard state, roster card render/empty
  states, loader-dispatch counts, fail-closed session handling, sign-out, keyboard
  focus, and pure-function unit checks.

### Documentation
- `docs/33-DOMAIN-MODEL.md` — §7.3 and the Summary Table: Doctor Module Registry and
  Doctor Module State promoted to Implemented (backend + frontend consumer).
- `docs/24-ROADMAP.md` — Phase 3 status updated; WPI-4 entry added.
- `shared/README.md` — new paragraph for this batch's registry version bump.

## 2026-07-16 — Phase 3 Batch WPI-3: Doctor Module Registry (backend)

Implements Batch WPI-3 (docs/50-PHASE-3-TECHNICAL-PLAN.md §7.1/§7.2/§19, ADR-020),
Phase 3/WHIMS's Pillar 2, dependent on WPI-1 (needs `doctor_id` to key enablement),
per docs/53-PHASE-3-IMPLEMENTATION-RULES.md's per-batch gate. **Explicitly scoped to
WPI-3 only — no later batch (WPI-4 onward) is authorized by this change.**

### Added (schemas/constants)
- **`shared/constants/doctor-module-registry.json`** (+ `.md`) — the Doctor Module
  Registry's static, versioned list of doctor-facing capability descriptors,
  structurally parallel to `module-registry.json` (ADR-012) but a separate registry,
  for a separate identity type, never merged with the patient-facing one (ADR-020).
  **Deliberately seeded empty** — no doctor-facing capability yet has a real,
  authenticated `data_source` route for the registry to point at; this batch delivers
  only the generic registry-and-state mechanism, the same disclosed "ships empty"
  precedent `calculator-registry.json` (Batch PXP-6) already established.
- **`shared/schemas/doctor-module-state.schema.json`** (+ `.md`) — the
  `DoctorModuleState` record shape, structurally parallel to
  `patient-module-state.schema.json` (ADR-012, amended) but keyed to the Doctor
  Module Registry instead, one row per `(doctor_id, capability_key)` pair, fail-closed
  by absence (ADR-010).

### Added (Apps Script)
- **`apps-script/DoctorModuleRegistry.gs`** — hand-ports the new constants file;
  `foundationGetDoctorModuleRegistry_()`, `foundationGetRegisteredDoctorCapabilityKeys_()`.
  Pure, leaf-level config with no Apps Script runtime dependency, mirroring
  `ModuleRegistry.gs`/`CalculatorRegistry.gs`/`SpecialtyRegistry.gs`.
- **`apps-script/DoctorModuleState.gs`** — `foundationSetDoctorModuleState_()`,
  `foundationGetDoctorModuleStates_()`, and the composite `state_key` helpers,
  mirroring `PatientModuleState.gs` exactly for the doctor identity space.
  `setFoundationDoctorModuleState()` is a manually-run editor function (staff/
  administrative-only, mirrors `setFoundationModuleState()`'s precedent exactly) —
  every real invocation is rejected with `FOUNDATION_INVALID_INPUT` today, since the
  registry ships empty, a disclosed consequence, not a defect.

### Changed
- **`apps-script/FoundationRouter.gs`** — one new, additive dispatch case:
  `get_doctor_module_states`. Zero existing case changed. Read-only, mirroring
  `get_patient_module_states` exactly — `doctor_id` is derived only from a verified
  `DoctorSession`, never client-supplied. Returns an empty list today (the registry
  ships empty).

### What this batch deliberately does not do
- **Does not register any concrete doctor-facing capability.** `patient_roster`,
  `condition_assignment`, `care_plan_authoring`, `module_state_management`,
  `inventory`, `pillfill_orders`, and `analytics` are docs/50 §7.1's own illustrative
  examples only, "not a batch commitment" — none is registered by this batch. A
  future capability is added as its own registry entry by whichever later,
  separately-approved WPI batch actually builds a real doctor-facing `data_source`
  route for it.
- **Does not build the Doctor Dashboard.** No doctor-facing HTML page, no frontend
  rendering — that is WPI-4's scope, not WPI-3's, mirroring the exact
  Module-Registry-backend (PXP-3) / Dashboard-Registry-frontend (PXP-4) split
  precedent already proven on the patient side.
- No patient-facing surface. Module Registry, Calculator Registry, Template
  Registry, and Specialty Registry are all untouched, zero lines. Zero modification
  to any frozen Foundation/Identity & Access/Patient Access/PXP-1..11/WPI-1/WPI-2
  file.

### Validation
- Static Analysis (`validation/static-analysis/analyze.js`) — PASS, 0 findings (53
  files scanned). `setFoundationDoctorModuleState` added to the existing
  `MANUAL_DROPDOWN_WRAPPERS` allowlist (the same convention every other manually-run
  editor function already uses).
- Conformance (`validation/phase-2a-foundation/conformance.js`) — 495/495 passing (new
  Stage 19, 18 checks), including a hand-port-vs-canonical-JSON cross-check, the
  fail-closed-by-empty-registry proof, the full `get_doctor_module_states` HTTP
  dispatch round trip, a direct cross-identity-type rejection proof (a real Patient
  Session token rejected by this doctor-scoped route), cross-doctor isolation, and a
  direct proof that Module Registry/Calculator Registry/Specialty Registry are
  unchanged by this batch.
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`) — 42/42 passing, unchanged.
- All 10 existing browser-test suites — unaffected (WPI-3 ships no frontend page),
  re-verified passing (249 checks, 0 failures).

### Documentation
- `docs/33-DOMAIN-MODEL.md` — §7.3 and the Summary Table: Doctor Module Registry and
  Doctor Module State promoted from Designed to Implemented (backend only). Every
  other Phase 3/WHIMS entity (Appointment, Notification, Inventory, PillFill Order,
  Analytics) remains exactly as Designed — untouched by this batch.
- `docs/24-ROADMAP.md` — Phase 3 status updated; WPI-3 entry added.
- `shared/README.md` — new constants/schema-catalog paragraph for this batch's two
  additions.

## 2026-07-16 — Phase 3 Batch WPI-2: Specialty Registry

Implements Batch WPI-2 (docs/50-PHASE-3-TECHNICAL-PLAN.md §6/§19, ADR-018), Phase
3/WHIMS's Pillar 3, independent of WPI-1, per docs/53-PHASE-3-IMPLEMENTATION-RULES.md's
per-batch gate. **Explicitly scoped to WPI-2 only — no later batch (WPI-3 onward) is
authorized by this change.**

### Added (constants)
- **`shared/constants/specialty-registry.json`** (+ `.md`) — the Specialty Registry's
  static, versioned list of specialty descriptors, seeded with exactly one entry
  (`homeopathy`), the platform's current, implicit specialty, named explicitly for the
  first time (ADR-018). No second specialty is populated.
- **`shared/constants/condition-specialty-map.json`** (+ `.md`) — the small, additive
  condition-to-specialty lookup table docs/50 §6.3 named but did not design, resolved
  at this batch per docs/51 Part 1.4's own recommendation. Every real condition slug
  (`shared/constants/condition-slugs.json`) maps to `homeopathy` today;
  `default_specialty_slug` fails open to the implicit default for any unmapped slug
  (the deliberate inverse of `PatientModuleState`'s fail-closed default). Not a change
  to `shared/schemas/doctor-assigned-condition.schema.json` or
  `apps-script/DoctorAssignedCondition.gs`.

### Added (Apps Script)
- **`apps-script/SpecialtyRegistry.gs`** — hand-ports both new constants files;
  `foundationGetSpecialtyRegistry_()`, `foundationGetSpecialtyBySlug_()`, and
  `foundationGetSpecialtyForCondition_()`. Pure, leaf-level config with no Apps Script
  runtime dependency, mirroring `ModuleRegistry.gs`/`CalculatorRegistry.gs`. No
  consumer exists yet in this batch — infrastructure for a future batch (Doctor
  Dashboard patient-roster/registry filtering, WPI-3/WPI-4, docs/50 §7.4) to consume,
  mirroring Calculator Registry's (Batch PXP-6) own "mechanism ships before any
  consumer" precedent.

### What this batch deliberately does not do
- **Does not add a populated `specialty_scope` entry to Module Registry, Calculator
  Registry, or Template Registry.** ADR-018 already decided, platform-wide, that all
  three *may* optionally carry the field; docs/53 §4 governs *when* each specific
  registry actually gains one — "independently, at whichever WPI batch first needs it
  for that specific registry." Since no second specialty exists, none needs it yet.
  `shared/constants/module-registry.json`, `calculator-registry.json`,
  `template-registry.json`, and their Apps Script counterparts (`ModuleRegistry.gs`,
  `CalculatorRegistry.gs`, `TemplateRegistry.gs`) are all untouched, zero lines, per
  docs/50 §3.
- **Does not wire `Doctor.specialty_slug` validation against this new registry.**
  `shared/schemas/doctor-identity.schema.json`'s `specialty_slug` field shipped at
  WPI-1, deliberately unvalidated since no real Specialty Registry existed yet.
  `apps-script/DoctorIdentity.gs` is itself now a frozen WPI-1 file (frozen except for
  genuine bug fixes) — wiring that validation is a disclosed, deferred decision for a
  future batch, not this one.
- No patient-facing surface, no doctor-facing frontend page, no new
  `FoundationRouter.gs` dispatch case (no consumer exists yet — the Doctor Dashboard is
  WPI-3/WPI-4's scope). Zero modification to any frozen Foundation/Identity &
  Access/Patient Access/PXP-1..11/WPI-1 file.

### Validation
- Static Analysis (`validation/static-analysis/analyze.js`) — PASS, 0 findings (51
  files scanned). A new, disclosed `INFRASTRUCTURE_AHEAD_OF_CONSUMER` allowlist covers
  this batch's three registry/lookup accessor functions, correctly unused within
  `apps-script/` by explicit architectural design (no same-batch consumer) — distinct
  from the existing `MANUAL_DROPDOWN_WRAPPERS` allowlist, which covers human-invoked
  editor functions, a different case.
- Conformance (`validation/phase-2a-foundation/conformance.js`) — 477/477 passing (new
  Stage 18, 16 checks), including hand-port-vs-canonical-JSON cross-checks and a direct
  proof that Module Registry/Calculator Registry are unchanged by this batch.
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`) — 42/42 passing, unchanged.
- All 10 existing browser-test suites — unaffected (WPI-2 ships no frontend page),
  re-verified passing (249 checks, 0 failures).

### Documentation
- `docs/33-DOMAIN-MODEL.md` — §7.2 and the Summary Table: Specialty promoted from
  Designed to Implemented. Every other Phase 3/WHIMS entity (Doctor Module Registry,
  Appointment, Notification, Inventory, PillFill Order, Analytics) remains exactly as
  Designed — untouched by this batch.
- `docs/24-ROADMAP.md` — Phase 3 status updated; WPI-2 entry added.
- `shared/README.md` — new constants-catalog paragraph for this batch's two additions.

## 2026-07-16 — Phase 3 Batch WPI-1: Doctor Identity & Session

Implements Batch WPI-1 (docs/50-PHASE-3-TECHNICAL-PLAN.md §5/§19, ADR-017), the
platform's first doctor-facing infrastructure batch, per docs/53-PHASE-3-
IMPLEMENTATION-RULES.md's per-batch gate. **Explicitly scoped to WPI-1 only — no later
batch (WPI-2 onward) is authorized by this change.**

Preceded by a dedicated `DoctorSession` security review
(`shared/schemas/doctor-session.md`), performed before any code was written, per
docs/50 §14/docs/51 Part 5/docs/52 Part 5's explicit, non-deferrable pre-ship gate — a
deliberate correction to Phase 2A's own equivalent magic-link/session review only
happening at PA-7 closeout, after Session had already shipped.

### Added (schemas)
- **`shared/schemas/doctor-identity.schema.json`** (+ `.md`) — the `DoctorIdentity`/
  `Doctor` record shape, structurally parallel to Patient Identity/Patient (ADR-002)
  and never merged with either (ADR-017).
- **`shared/schemas/doctor-session.schema.json`** (+ `.md`, including the dedicated
  security review) — the `DoctorSession` payload shape, reusing `session.schema.json`'s
  exact wire format.
- **`shared/schemas/doctor-login-token.schema.json`** (+ `.md`) — the `DoctorLoginToken`
  record shape, mirroring `login-token.schema.json`, stored in its own
  `DoctorLoginTokens` sheet, never `LoginTokens`.

### Added (Apps Script)
- **`apps-script/DoctorIdentity.gs`** — validate/create/get a `Doctor` record;
  `createFoundationDoctor()`, a manually-run editor function (staff/administrative
  provisioning only, no public self-registration, mirroring `createFoundationPatient()`
  exactly).
- **`apps-script/DoctorSession.gs`** — issues and verifies `DoctorSession` tokens,
  reusing `FoundationSession.gs`'s signing secret and HMAC primitive **unchanged, zero
  lines touched in that frozen file** — the same additive-wrapper pattern
  `TrustedDevice.gs`'s Long-Lived Session already proved out at Batch PXP-8.
- **`apps-script/DoctorLoginTokens.gs`** — single-use, hashed, expiring doctor login
  tokens, reusing `FoundationLoginTokens.gs`'s already-generic
  `foundationGenerateRawLoginToken_()`/`foundationHashLoginToken_()` directly, unchanged.
- **`apps-script/DoctorEmail.gs`** — doctor login-link email delivery, mirroring
  `FoundationEmail.gs`.
- **`apps-script/DoctorLoginFlow.gs`** — request/consume orchestration, reusing
  `FoundationRateLimit.gs`'s already-generic `foundationCheckAndIncrementRateLimit_()`
  directly, unchanged.
- **`apps-script/DoctorRouteGuard.gs`** — `withFoundationDoctorAuth_()`, gating a
  handler behind a verified `DoctorSession`, mirroring `FoundationRouteGuard.gs`.

### Changed
- **`apps-script/FoundationRouter.gs`** — three new, additive dispatch cases:
  `request_doctor_login_link`, `consume_doctor_login_link`, `get_doctor_profile`. Zero
  existing case changed. `get_doctor_profile` is the doctor-side proof point mirroring
  `get_profile`'s own role at Batch IA-2.

### Security
- **No cross-identity-type authorization confusion.** A Doctor Session can never
  authorize a patient-scoped route, and a Patient Session can never authorize a
  doctor-scoped route — enforced mechanically by disjoint, non-overlapping payload
  shapes (`doctor_id` vs. `patient_id`), not by convention. Proven directly, not just
  argued, by 37 new conformance checks (Stage 17), including hand-signing a token with
  the exact shared signing secret and confirming both guards independently reject the
  other identity type's real, validly-signed token.
- Patient Session and Doctor Session share one signing secret
  (`FOUNDATION_SESSION_SIGNING_SECRET`) — a disclosed, accepted blast-radius trade-off
  (avoids a second Script Property secret-management surface), not a gap in the
  authorization boundary itself, which does not depend on secret separation. Full
  analysis: `shared/schemas/doctor-session.md`.

### Validation
- Static Analysis (`validation/static-analysis/analyze.js`) — PASS, 0 findings (50
  files scanned).
- Conformance (`validation/phase-2a-foundation/conformance.js`) — 461/461 passing (new
  Stage 17, 37 checks).
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`) — 42/42 passing, unchanged.
- All 10 existing browser-test suites — unaffected (WPI-1 ships no frontend page),
  re-verified passing.

### Documentation
- `docs/33-DOMAIN-MODEL.md` — §1.4/§7.1 and the Summary Table: Doctor/DoctorIdentity/
  DoctorSession/DoctorLoginToken promoted from Designed to Implemented. Every other
  Phase 3/WHIMS entity (Specialty, Doctor Module Registry, Appointment, Notification,
  Inventory, PillFill Order, Analytics) remains exactly as Designed — untouched by this
  batch.
- `docs/24-ROADMAP.md` — Phase 3 status updated; WPI-1 entry added.
- `shared/README.md` — new schema-catalog paragraph for this batch's three additions.

### What this batch does not do
No patient-facing surface, no doctor-facing frontend page (the Doctor Dashboard is
WPI-4's scope). No existing doctor-owned Phase 2B entity's schema or write path
changes — `DoctorAssignedCondition`, `CarePlan`, `DoctorInstruction`, and
`CheckInTemplateAssignment` all keep their existing manually-run editor functions
unchanged; migrating any of them onto a real `doctor_id` is a future, separately-
approved batch's decision. No role-based permission logic — `Doctor.role` is stored and
returned only. Zero modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11 file.

## 2026-07-16 — Phase 3 Architecture Freeze: WHIMS Patient Intelligence Platform

Documentation-only architecture-freeze pass, per explicit instruction to begin Phase 3
planning ahead of Phase 2C/2D. No `apps-script/*.gs` file, no
`shared/schemas/*.schema.json` file, no `shared/constants/*.json` registry file, and no
patient-facing or doctor-facing page was touched — no implementation of any kind.
Phase 2B remains closed and frozen except for genuine bug fixes
(docs/48-PHASE-2B-CLOSEOUT.md, `v2.1.0-phase2b`); nothing in that freeze is reopened.

Renamed Phase 3 from "WiseOS" to **WHIMS Patient Intelligence Platform** (docs/49 §2)
— no scope change from the rename itself. Reordered Phase 3 ahead of Phase 2C (Health
Milestones) and Phase 2D (Digital Twin & AI Summaries) on dependency grounds, the same
test Batch PXP-10 already passed against PXP-9 — both phases remain fully open,
unscoped, and unaffected by this reordering.

### Added (documentation)
- **`docs/49-PHASE-3-ARCHITECTURE-REVIEW.md`** (new) — strategic review: scope
  decision to reorder ahead of 2C/2D, the WiseOS → WHIMS rename, the vision, and four
  core pillars (Doctor Identity & Access, Doctor-Facing Registry-Driven Capabilities,
  Specialty-Scoped Extensibility, Reserved AI/Advanced Extension Points).
- **`docs/50-PHASE-3-TECHNICAL-PLAN.md`** (new) — entity-level design for Doctor
  Identity/Session, the Specialty Registry, the Doctor Module Registry and Doctor
  Dashboard, Appointment, Notification, Inventory, PillFill Integration, and Analytics;
  a security model; and the twelve-batch (`WPI-1`–`WPI-12`) implementation sequence.
- **`docs/51-PHASE-3-ARCHITECTURE-READINESS-REVIEW.md`** (new) — critique of every
  proposal in docs/49/50, a conflicts check against every existing Accepted ADR (none
  found), five ranked risks (Sheets-at-scale named top risk), and a final verdict.
- **`docs/52-PHASE-3-REPOSITORY-CONSISTENCY-REVIEW.md`** (new) — duplication and
  contradiction check against the full existing document set; closes two
  documentation-only findings docs/51 raised (below); carries forward all other
  existing, non-blocking roadmap gaps unchanged.
- **`docs/53-PHASE-3-IMPLEMENTATION-RULES.md`** (new) — the permanent per-batch
  governance standard every future `WPI-` batch must follow, mirroring
  docs/47-PHASE-2B-IMPLEMENTATION-RULES.md's own role for Phase 2B.
- **`adr/ADR-017-doctor-identity-independent-entity.md`** (new) — Doctor Identity is a
  first-class entity, structurally parallel to Patient Identity, never merged with it.
- **`adr/ADR-018-specialty-scoped-registries.md`** (new) — every registry gains an
  optional `specialty_scope` field; complements ADR-012/013/016, amends none of them.
- **`adr/ADR-019-ai-extension-points-reserved-platform-wide.md`** (new) — elevates
  docs/47 §2's Phase-2B-scoped "AI extension points only" rule to a permanent,
  platform-wide principle; reaffirms and generalizes ADR-001/004/005/013, amends none.
- **`adr/ADR-020-doctor-dashboard-registry-driven.md`** (new) — the Doctor Dashboard is
  driven by a new, parallel Doctor Module Registry, extending ADR-012's principle
  without amending it.

### Changed (documentation)
- **`docs/31-ADR-INDEX.md`** bumped to Version 1.5 — ADR-017 through ADR-020 added to
  the index and the Grouped-by-Concern section.
- **`docs/33-DOMAIN-MODEL.md`** bumped to Version 1.13 — Doctor (§1.4), Appointment
  (§4.1), and Notification (§4.2) promoted from *Conceptual (gap)* to *Designed*; new
  §7 added for Phase 3/WHIMS entities (Doctor Identity/Session, Specialty, Doctor
  Module Registry/State, Inventory Item/Transaction, PillFill Order, Analytics); the
  Summary Table updated accordingly. No entity Phase 2A or Phase 2B already shipped had
  its schema, status, or meaning changed.
- **`docs/24-ROADMAP.md`** bumped to Version 1.13 — Phase 3 entry renamed to "WHIMS
  Patient Intelligence Platform," reordered ahead of Phase 2C/2D with the reasoning
  recorded inline, and given its full twelve-batch (`WPI-1`–`WPI-12`) sequence.

### Repository consistency review (docs/52)
Two documentation-only findings from docs/51's readiness review, both closed within
this same version: the "WiseOS" cross-reference in docs/33 §1.4 (updated to name both
the current and prior name); and docs/50 §7.4's patient-roster-derivation limitation at
multi-doctor-per-specialty scale (made explicit rather than only gestured at). No
contradiction was found against any existing Accepted ADR or docs/30 principle. Two
gates remain open, named but not resolved by this pass: a dedicated Doctor Session
security review (required before `WPI-1`), and a Sheets-at-production-scale review
(required before `WPI-7`/`WPI-9`).

### Not authorized by this pass
No `WPI-` batch is authorized to begin implementation by any document listed above.
Each requires its own separate, explicit approval, per docs/53's per-batch gate — the
same discipline every Phase 2B batch already passed through. Phase 2C and Phase 2D
remain open, separately approvable, unscoped by this pass.

## 2026-07-15 — Phase 2B Batch PXP-11: Closeout

Phase 2B's own closeout batch (docs/44 §22, docs/47 §13/§15) — the final named slot
in the eleven-batch sequence. Documentation-only: no `apps-script/*.gs` file, no
`shared/schemas/*.schema.json` file, no `shared/constants/*.json` registry file, and
no patient-facing page was touched. Full record: **docs/48-PHASE-2B-CLOSEOUT.md**
(new), mirroring docs/43-PHASE-2A-CLOSEOUT.md's own closeout discipline.

Confirmed before any work began: `main` synced, repository clean, and every batch
PXP-1 through PXP-8 plus PXP-10 frozen with zero code drift; PXP-9 (AI Integration)
remains the intentionally unbuilt, reserved placeholder docs/44 §22 and docs/45
already established — this batch does not build it, scope it, or reopen that
decision.

### Verified (fresh re-run, zero code changes)
- Static Analysis: PASS, 0 findings (44 `apps-script/*.gs` files).
- Conformance (`validation/phase-2a-foundation/conformance.js`): 419/419.
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`): 42/42.
- Browser Tests: all 10 existing suites pass — `pa-2-dashboard` (30/30),
  `pa-3-timeline` (29/29), `pa-4-symptom-tracker` (21/21), `pa-5-reports` (32/32),
  `pa-6-public-nav` (22/22), `pxp-1-patient-profile` (25/25),
  `pxp-4-dashboard-registry` (23/23), `pxp-5-checkin-engine` (25/25),
  `pxp-7-care-plan-engine` (17/17), `pxp-8-persistent-login` (25/25).
- **710 automated checks across 13 suites, 0 failures.** No suite required a fix to
  pass — every result was already true going into this batch.

### Changed (documentation)
- **`docs/48-PHASE-2B-CLOSEOUT.md`** (new) — Phase 2B's closeout record: scope
  recap, validation summary, frozen-file boundary confirmation, the three
  inconsistencies found and fixed (below), the security-review record, deferred/
  accepted items, final project statistics, and the release-readiness verdict.
- **`docs/33-DOMAIN-MODEL.md`** bumped to Version 1.12 — three genuine, disclosed,
  documentation-only inconsistencies fixed, none changing any entity's shape, schema,
  or status in substance: §5.3 (Calculator)'s header updated from "Designed, not yet
  implemented" to "Implemented — backend only" (its own body text already said this,
  since Batch PXP-6; only the header was stale); §6.4 (the pre-PXP-6 Calculator
  Registry design), left as an unmarked stale duplicate of §6.8 since PXP-6 shipped,
  now carries an explicit "Superseded by §6.8" pointer, with the historical text kept,
  not deleted; §6's own top-level header updated from "Designed, not yet implemented"
  to "Mostly Implemented," matching the fact that nine of its eleven subsections now
  are. Also closes a minor, disclosed gap in Batch PXP-10's own version-bump
  discipline (its 2026-07-15 status updates to §3.2/§6.3 were never reflected in the
  document's version line).
- **`docs/24-ROADMAP.md`** bumped to Version 1.12 — Phase 2B status updated:
  **closed and frozen except for genuine bug fixes**; Batch PXP-11 recorded as
  shipped; next roadmap milestone named as Phase 2C or a future, separately-proposed
  PXP-9 design, neither authorized to begin by this document.

### Repository consistency review (docs/47 §14)
Architecture, schema, contract, and ADR consistency all confirmed already correct —
docs/31-ADR-INDEX.md and every shipped batch's own CHANGELOG entry cross-checked
directly, no drift found. No stale cross-reference, TODO/FIXME marker, temporary
file, debug artifact, or local path found anywhere in `apps-script/`,
`my-health-journey/`, or `shared/`. Security review: Phase 2B's one genuinely new
authentication mechanism (Trusted Device + Long-Lived Session, Batch PXP-8) already
has its own dedicated review recorded in `docs/15-SECURITY-STANDARDS.md` at the time
it shipped — re-confirmed against the current source, not re-derived; nothing was
left pending to discover at closeout, unlike Phase 2A's magic-link review. Optional
PIN remains explicitly out of scope for all of Phase 2B, its dedicated security-review
gate still open by design.

### Recommendation
Tag this state `v2.1.0-phase2b`. Do not begin Phase 2C, a real PXP-9 design, or any
other phase without a separate, explicit approval, per docs/47 §9's per-batch gate.

## 2026-07-15 — Phase 2B Batch PXP-10: Symptom Tracker Migration

Symptom Tracker Migration (docs/44 §10.1/§22, docs/47) — Symptom Tracker's dashboard
entry retired now that Daily Check-in (PXP-5) is proven in production as its designed
successor. Explicitly approved out of numeric order: **PXP-9 (AI Integration) remains
an intentionally unscoped, reserved placeholder** — docs/44 §22 names it "nothing
concrete" and docs/45 independently confirms it is "not ready for any scoping at all";
building anything under that name would mean inventing an unapproved AI feature outside
the ADR-001/004/005/013 gate docs/44 §15 requires. PXP-10 carries no dependency on
PXP-9 (docs/44 §22's own dependency column names only "PXP-5 proven in production"), so
it was approved and built directly; no batch was renumbered and PXP-9's slot stays
reserved. No new ADR was needed — this batch reverses ADR-012 (amended)'s own
registry-growth pattern for the first time, rather than establishing a new one.

### Changed
- **`shared/constants/module-registry.json`** (version `1.0.0` → `1.1.0`) — the
  `symptom_tracker` descriptor (seeded in Batch PXP-3) is removed. The registry's first
  removal, rather than an addition — every other entry (`timeline`, `daily_checkin`,
  `reports`, `care_plan`) is untouched.
- **`apps-script/ModuleRegistry.gs`** — the same `symptom_tracker` entry removed from
  its hand-ported `FOUNDATION_MODULE_REGISTRY_` array, keeping all three ports
  (canonical JSON, this file, `dashboard.js`) in sync per this file's own
  "update all three ports by hand" convention.
- **`my-health-journey/dashboard.js`** — the `symptom_tracker` entry removed from its
  own hand-ported `MODULE_REGISTRY` array. Since the dashboard has been fully
  registry-driven since Batch PXP-4, this alone is sufficient to stop the card
  rendering for every patient — zero change to `renderDashboard()`/
  `filterEnabledModules()`/`dispatchLoaders()`. The card's own dead rendering code
  (`symptomFormHtml`, `symptomSummaryHtml`, `refreshSymptomSummary`,
  `wireSymptomForm`, `loadSymptomPreview`, `CONDITION_OPTIONS`,
  `conditionOptionsHtml`) and its `MODULE_LOADERS['get_symptom_logs']` registration
  are removed in the same change, along with their now-unused
  `window.WiseDashboard` exports.
- **`my-health-journey/index.html`** — the dashboard's `<meta name="description">` no
  longer mentions "symptom log," matching the cards that actually render.

### Disclosed: endpoints deprecated by documentation only, zero code changed
`log_symptom`/`get_symptom_logs` (`apps-script/FoundationSymptomLog.gs`,
`FoundationRouter.gs`'s existing dispatch cases) are **not modified** — zero lines
changed in either frozen Phase 2A file, mirroring Batch PXP-8's own "zero lines changed
in a frozen file" discipline. Both routes remain fully functional with no breaking API
contract (docs/47 §6): the standalone Symptom History page
(`my-health-journey/symptoms/`, untouched) still calls `get_symptom_logs` directly and
remains reachable by direct URL — it is simply no longer linked from the dashboard,
since its only link lived inside the now-removed card. The deprecation is recorded as a
documentation disclosure only: `shared/schemas/symptom-log.md`'s new "Deprecated
(Batch PXP-10)" section and `shared/constants/module-registry.md`'s new "Batch PXP-10
removal" section.

### Disclosed: `SymptomLogs` retained, no data touched
No `SymptomLogs` row is created, migrated, or deleted by this batch — this entity's
existing "never edited or deleted" lifecycle (`shared/schemas/symptom-log.md`) is
completely unaffected. Any already-persisted `symptom_tracker` `PatientModuleState`
row simply stops matching a registry entry and is silently dropped by
`foundationGetPatientModuleStates_()`'s existing registry-merge logic — no schema
change, no migration, verified directly in Stage 12 (below).

### Changed (documentation)
- `docs/24-ROADMAP.md` — Phase 2B status line updated: Batch PXP-10 shipped;
  **PXP-9 (AI Integration) recorded as intentionally skipped**, not built, with the
  reasoning above stated in full.
- `docs/33-DOMAIN-MODEL.md` — §3.2 (Symptom Log) status update: dashboard entry
  retired, endpoints deprecated, data retained; §6.3 (Module Registry) status update
  recording the registry's first removal; Summary Table rows for both entities
  updated.
- `shared/constants/module-registry.md` — new "Batch PXP-10 removal" section.
- `shared/schemas/symptom-log.md` — new "Deprecated (Batch PXP-10)" section.
- `apps-script/README.md` — Symptom Log's status column annotated
  "Deprecated (PXP-10)."

### Verified
- Static Analysis: PASS (0 findings).
- Conformance (`validation/phase-2a-foundation/conformance.js`): 419/419 checks pass,
  including Stage 12's updated module-count assertions (`5`→`4`, `symptom_tracker`
  retired; the "never written, fail-closed default" example switched to
  `daily_checkin`) and Stage 8 (Symptom Log's own routes), unaffected and unchanged.
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`): 42/42 checks pass,
  unchanged.
- Browser Tests: every existing `validation/pa-*`/`validation/pxp-*` suite passes
  (249 checks across 10 suites). Three disclosed, mechanical updates: `pa-2-dashboard/`
  (ALL_MODULES_ENABLED drops to two cards), `pxp-4-dashboard-registry/` (swaps its
  generic third fixture module from the now-retired `symptom_tracker` to `care_plan`,
  same test intent), and `pa-4-symptom-tracker/` (its five dashboard-card checks are
  replaced by one retirement proof — the card does not render even with a stale
  `enabled: true` `PatientModuleState` row — while its ten standalone Symptom History
  page checks are completely unchanged).

## 2026-07-14 — Phase 2B Batch PXP-8: Trusted Device + Long-Lived Session

Persistent Authentication (docs/44 §4/§5/§22, docs/47, ADR-015) — Trusted Device and
the Long-Lived Session it grants. Explicitly approved per docs/47's per-batch gate.
**PIN (`PatientCredential`) is explicitly out of scope for this batch** — docs/45
Part 5's finding that it "requires its own dedicated security review... independent of
Trusted Device/Long-Lived Session" remains an open gate; nothing in this batch
implements, schemas, or routes a PIN. No new ADR was needed — ADR-015 already fully
governs this pattern; see docs/44's new §25 for the implementation-time decisions this
batch made within it.

**docs/44 §5.5's open question, resolved: Long-Lived Session is an additive wrapper,
`FoundationSession.gs` untouched.** `apps-script/TrustedDevice.gs`'s
`foundationIssueLongLivedSessionToken_()` reuses that frozen file's own already-existing
pure helpers (payload building, base64url encoding, HMAC signing, secret retrieval)
with a different, longer, local TTL constant (14 days) in place of
`FOUNDATION_CONFIG.SESSION_TTL_SECONDS`. The token produced is byte-for-byte the same
wire format `session.schema.json` already defines, verified completely unmodified by
`foundationVerifySessionToken_()`. **Zero lines changed in `FoundationSession.gs`,
`FoundationRouteGuard.gs`, or `session.schema.json`** — proven directly in
`validation/phase-2a-foundation/conformance.js`'s new Stage 16, which checks a
magic-link-issued session's own unchanged 3600-second TTL side by side with a
Long-Lived Session's materially longer one, both verified through the identical code
path.

### Added
- **`shared/schemas/trusted-device.schema.json`** (+ `.md`) — `TrustedDevice`. Unlike
  every other Phase 2B entity shipped so far (all doctor/staff-owned, since no real
  Doctor identity/session exists yet, docs/33 §1.4), this is patient-owned — every
  write is a real, session-authenticated Web App route, with no manually-run Apps
  Script editor wrapper at all, the first Phase 2B entity for which one isn't needed.
  `device_token_hash` reuses `LoginToken`'s already-proven plain-SHA-256 hashing
  pattern (ADR-015 §Decision 1) — no new cryptographic bridge. The raw device token
  rotates on every successful presentation; `expires_at` is a deliberate,
  disclosed *sliding* window (90 days, extended on each use) — a design distinct from
  the base Session mechanism's own unchanged, non-renewing, fixed-TTL discipline
  (ADR-010).
- **`apps-script/TrustedDevice.gs`** (new) — `foundationCreateTrustedDevice_()`
  (session-authenticated device creation, returns the raw token exactly once, never
  persisted after), `foundationConsumeTrustedDevice_()` (hashes, looks up, checks
  revoked/expired, rotates the token, slides the expiry, and issues a fresh Long-Lived
  Session — this one action is also this design's "session renewal" mechanic, no
  separate renew action exists), `foundationGetPatientTrustedDevices_()` (the caller's
  own device history, `device_token_hash` deliberately redacted from every row before
  it is ever returned), and `foundationRevokeTrustedDevice_()` (self-service,
  one-way, exactly-once, rejects an unknown or another patient's `device_id` with the
  same generic `FOUNDATION_NOT_FOUND` `get_timeline_entry`'s own cross-patient check
  already uses).
- **`apps-script/FoundationRouter.gs`** — four new, additive dispatch cases:
  `mark_device_trusted`, `get_trusted_devices`, and `revoke_trusted_device`
  (authenticated, `patient_id` always session-derived), plus `consume_trusted_device`
  (this batch's one unauthenticated addition, mirroring `consume_login_link` exactly —
  the presented device token is itself the credential).
- **`login.html`** — the app's one, single silent-recovery point: before revealing the
  login form, attempts a silent sign-in via any locally-stored trusted device token.
  On success, redirects straight to the dashboard with a fresh Long-Lived Session; on
  failure (no device token, or a rejected one), reveals the login form exactly as
  before this batch, clearing any stale device token. `?reason=expired`'s existing
  generic session-expiry message now displays only once silent recovery has already
  been tried and failed — a successful recovery never shows it at all.
- **`verify.html`** — an opt-in, **unchecked-by-default** "Keep me signed in on this
  device" checkbox (docs/44 §5.2, passwordless-by-default reaffirmed). Checking it
  marks the device trusted as a separate, best-effort step *after* magic-link sign-in
  has already succeeded — its own failure never blocks or reverses the sign-in itself.
- **`my-health-journey/device-trust.js`** (new, non-frozen) — the only
  `localStorage`-writing code this batch adds (`wise_trusted_device_token`), holding
  the shared device-token logic `login.html` and `verify.html` both consume. The
  Session token itself continues to live exclusively in `sessionStorage`, cleared on
  tab close — completely unchanged from Phase 2A (docs/29 §3).
- **`my-health-journey/devices/`** (new) — the "Manage Devices" page: lists every
  trusted device (active and revoked), with a Revoke button on each active one.
- **`my-health-journey/index.html`** — one new, disclosed "Manage Devices" nav link,
  mirroring PXP-1's own "My Profile" link exception exactly. No Module Registry entry
  was added — Persistent Authentication is infrastructure available to every patient,
  not a doctor-enabled dashboard module (mirrors Patient Profile's own precedent).

### Disclosed, deliberately minimized frozen-file footprint
`login.html`, `verify.html`, and `my-health-journey/index.html` (one nav link) are the
only Phase 2A/2B-frozen files this batch touches, each justified in its own header
comment. **`my-health-journey/dashboard.js` and `my-health-journey/session-guard.js`
are both completely untouched** (`git diff --stat` empty on both) — every
session-guarded page already redirects to `login.html` on a missing/rejected session,
so routing all silent recovery through that one page, rather than the dashboard's own
front door and every `session-guard.js` consumer individually, keeps this batch's
frozen-file surface as small as possible. One mechanical, disclosed test-infrastructure
update: `validation/pa-2-dashboard/browser-test.js`'s keyboard-Tab-order assertion,
updated for the one new nav link, the same category of update PXP-5's own Stage 12
module-count fix already established.

### Disclosed, honest limitation
Since `FoundationSession.gs` stays untouched and stateless (no revocation list),
revoking a `TrustedDevice` immediately and permanently stops it from being exchanged
for a new Long-Lived Session again, but cannot retroactively kill a Long-Lived Session
token already issued and currently held client-side — it simply expires naturally
within 14 days. A real, deliberate tradeoff of honoring docs/47 §6's "do not touch a
frozen file for new functionality" rule, disclosed here rather than silently assumed
away. Full reasoning: `shared/schemas/trusted-device.md`.

### Validation
- Static Analysis: PASS (0 findings).
- Conformance (`validation/phase-2a-foundation/conformance.js`): 419/419 checks pass,
  including the new Stage 16 (device creation/consumption/rotation/revocation,
  cross-patient isolation, and the Long-Lived Session token's own longer TTL verified
  against the real, unmodified `foundationVerifySessionToken_()`).
- Phase 1.5 Regression (`validation/phase-1-5/validate.js`): 42/42 checks pass,
  unchanged.
- Browser Tests: every existing `validation/pa-*`/`validation/pxp-*` suite passes
  (one mechanical, disclosed update, above); the new
  `validation/pxp-8-persistent-login/` suite adds 25/25 passing checks covering
  `login.html`'s silent recovery, `verify.html`'s opt-in checkbox, and the new Manage
  Devices page.

## 2026-07-14 — Phase 2B Batch PXP-7: Personal Care Plan

Personal Care Plan (docs/44 §4.2/§12/§22, docs/47) — a consumer of Pillar 1
(Doctor-Assigned Conditions) and Pillar 2 (Module Engine). Explicitly approved per
docs/47's per-batch gate. Zero dependency on any other Phase 2B batch beyond
PXP-3/PXP-4's existing registry mechanism; zero modification to any frozen
Foundation/Identity & Access/Patient Access/PXP-1..6 file. No new ADR was needed —
ADR-012's registry-driven principle already fully governs this pattern.

**One disclosed, deliberate scope decision.** docs/44 §12 states a new Care Plan
version "emits a `TimelineEvent` (`entry_type: care_plan`)." Implementing this
literally would require widening the frozen, conformance-tested
`consultation-history.schema.json`'s `entry_type` enum and changing
`FoundationConsultationHistory.gs` — both Phase 2A files frozen except for a genuine
bug fix (docs/43 §12), and this is new functionality, not a bug fix. This batch makes
the disclosed choice not to touch either file, per docs/47 §6, deferring Timeline-feed
integration to a future, separately-approved change — docs/33-DOMAIN-MODEL.md §3.1
itself names widening that enum as "the concrete signal that moment has arrived, not
before," and this batch does not treat itself as that moment. A patient's Care Plan
and its full instruction history remain completely visible today via this batch's own
routes and dedicated page; only the cross-cutting Timeline feed does not yet reflect a
Care Plan update. Full reasoning: `shared/schemas/care-plan.md`, docs/44's new §24.

### Added
- **`shared/schemas/care-plan.schema.json`** (+ `.md`) — `CarePlan`, one evolving,
  append-only-versioned plan per patient. `care_plan_id` is a stable, logical identity
  reused across every version; editing a plan never mutates an existing row, it always
  appends a new version and automatically flips the prior version's own row to
  `status: superseded` — exactly one `active` row per plan at any time. One disclosed,
  additive field beyond docs/44 §12's literal list: `version_key` (server-derived,
  `care_plan_id + '::' + version`), mirroring `patient-module-state.schema.json`'s own
  `state_key` precedent for addressing one row among several sharing the same logical
  identity.
- **`apps-script/CarePlan.gs`** (new) — `foundationSaveCarePlan_()` (the
  create-or-version upsert, doctor/staff-supplied `patient_id`) and
  `foundationGetCurrentCarePlanForPatient_()` (returns the caller's current active
  plan, or `null` — a real, expected "not yet authored" outcome, not an error,
  mirroring `get_checkin_template`'s own unassigned-patient discipline).
- **`shared/schemas/doctor-instruction.schema.json`** (+ `.md`) — `DoctorInstruction`,
  the atomic unit of clinical direction (medicine/lifestyle/investigation/follow_up),
  aggregated by a Care Plan via its stable `care_plan_id`. Many-per-patient,
  many-per-plan, append-mostly: `status` transitions `active` → `discontinued`/
  `completed` exactly once, one-way, mirroring `doctor-assigned-condition.schema.json`'s
  own precedent. `consultation_id` is a disclosed, presently-empty sentinel field — no
  `Consultation` entity exists yet (docs/33 §2.1, an unrelated, pre-existing gap).
- **`apps-script/DoctorInstruction.gs`** (new) — `foundationCreateDoctorInstruction_()`
  (validates `care_plan_id` references a real plan belonging to the same patient before
  inserting), `foundationUpdateDoctorInstructionStatus_()` (the one-way status
  transition), and `foundationGetPatientDoctorInstructions_()` (full history across
  every one of the patient's plan versions, sorted `effective_date` descending).
- **`apps-script/FoundationRouter.gs`** — two new, additive, read-only dispatch cases:
  `get_care_plan` and `get_doctor_instructions`. Both derive `patient_id` exclusively
  from the verified session. There is no author/create/status-update route reachable
  over HTTP — every write remains a manually-run Apps Script editor function
  (`saveFoundationCarePlan()`, `createFoundationDoctorInstruction()`,
  `updateFoundationDoctorInstructionStatus()`), mirroring
  `DoctorAssignedCondition.gs`'s precedent exactly, since no real Doctor
  identity/session exists yet (docs/33 §1.4).
- **`shared/constants/module-registry.json`** (+ `apps-script/ModuleRegistry.gs`) — one
  new, additive registry entry (`care_plan`, `display_order: 40`), registering the
  capability through PXP-3/PXP-4's existing mechanisms. Every earlier entry is
  untouched.
- **`my-health-journey/dashboard.js`** — one new registered module + loader
  (`loadCarePlanPreview`), rendering a short, truncated goals preview plus the next
  review date (if set) and a link to the full plan — the same "bare summary, link to
  the full page" scope every other history-backed card already applies. No form, no
  write affordance — this card is entirely read-only (docs/44 §4.3).
- **`my-health-journey/care-plan/`** (new) — the full-detail page: the current plan's
  complete goals text, version, and next review date, plus every attached
  `DoctorInstruction`, newest `effective_date` first, each labeled with a humanized
  `instruction_type`/`status` badge.
- **`validation/phase-2a-foundation/`**: Stage 15 in `conformance.js` (versioning/
  supersession, `version_key` addressing, `care_plan_id` ownership validation,
  one-way instruction status transitions, cross-patient isolation, audit-log entries)
  and `CarePlan.gs`/`DoctorInstruction.gs` added to `harness.js`'s `FILES` list —
  382/382 conformance checks passing (68 new). Stage 12's Module Registry
  count/membership assertions mechanically bumped 4→5, the same disclosed consequence
  PXP-5's own Stage-12 update already established.
- **`validation/pxp-7-care-plan-engine/`** (new browser-test suite) — the
  unauthored-plan state, the dashboard card's truncated read-only preview, the
  disabled-module fail-closed check, and the full-detail page's plan summary +
  instruction history rendering. 17/17 checks passing.
- **`validation/static-analysis/analyze.js`** — three new entries in
  `MANUAL_DROPDOWN_WRAPPERS` (`saveFoundationCarePlan`,
  `createFoundationDoctorInstruction`, `updateFoundationDoctorInstructionStatus`), the
  same disclosed, designed extension point every earlier manually-run wrapper already
  used.

### Changed (documentation)
- `docs/33-DOMAIN-MODEL.md` bumped to Version 1.11 — Doctor Instruction (§2.3) and Care
  Plan (§3.4) promoted from "Designed, not yet implemented" to **Implemented**; Summary
  Table updated.
- `docs/24-ROADMAP.md` bumped to Version 1.11 — Phase 2B status updated: Batch PXP-7
  shipped, with the disclosed Timeline-emission scope decision stated explicitly.
- `docs/44-PHASE-2B-TECHNICAL-PLAN.md` — new §24, an additive implementation-time
  amendment (mirroring §23's existing PXP-5 precedent) disclosing the Timeline-emission
  scope decision, without altering a single word of the frozen Version 4.0 body text.
- `shared/README.md` — paragraph added noting the two new schema files/implementations.
- `shared/constants/module-registry.md` — new "Batch PXP-7 addition" section.

### Verified
- Static Analysis: PASS, 0 findings (43 files scanned). Conformance: 382/382. Phase
  1.5 Regression: 42/42. Browser test suites: 233/233 across nine suites
  (`pa-2-dashboard`, `pa-3-timeline`, `pa-4-symptom-tracker`, `pa-5-reports`,
  `pa-6-public-nav`, `pxp-1-patient-profile`, `pxp-4-dashboard-registry`,
  `pxp-5-checkin-engine`, `pxp-7-care-plan-engine`) — every pre-existing suite passes
  unchanged, confirming this batch's additive-only discipline.

## 2026-07-13 — Phase 2B Batch PXP-6: Calculator Registry

Phase 2B's Pillar 3 (docs/44 §4.1/§8/§22, ADR-013, docs/47) — the platform's only
mechanism for expressing which deterministic, doctor/staff-authored calculators exist
at all, mirroring the Module Registry (ADR-012) and Template Registry (ADR-016)
pattern exactly. Explicitly approved per docs/47's per-batch gate. Zero dependency on
any other Phase 2B batch beyond PXP-3/PXP-4's existing registry mechanism; zero
modification to any frozen Foundation/Identity & Access/Patient Access/PXP-1..5 file.
No new ADR was needed — ADR-013 (calculators are deterministic, never AI-computed) and
ADR-012's registry-driven principle already fully govern this pattern.

**One disclosed, explicit scope decision — this batch ships backend infrastructure
only.** docs/44 §22's own PXP-6 row names "Patient Calculator UI" alongside the
registry; this batch deliberately does not build it, per this batch's own explicit
approval scope. `shared/constants/calculator-registry.json` ships with **zero**
registered calculators — disease-specific or otherwise — the generic
registry-and-result mechanism is this batch's entire scope. No `module-registry.json`
entry, no `my-health-journey/dashboard.js` change, no new HTML page. This mirrors the
exact Module Registry (PXP-3, backend) / Dashboard Registry (PXP-4, frontend) split
precedent: the mechanism ships first, patient-facing rendering is a later, separately-
scoped batch once a real calculator exists to render.

### Added
- **`shared/constants/calculator-registry.json`** (+ `.md`) — Phase 2B's fifth
  registry, a static, versioned list of `CalculatorDefinition` descriptors
  (`calculator_slug`, `version`, `input_fields`, `formula_reference` — a descriptive
  pointer only, never executable logic, `relevant_condition_slugs` metadata,
  `status`, reserved `future_ai_capable`). Seeded **empty** — see the disclosed scope
  decision above.
- **`apps-script/CalculatorRegistry.gs`** (new) —
  `foundationGetCalculatorBySlugAndVersion_()`, a hand-ported, static copy of the
  canonical (empty) list, mirroring `TemplateRegistry.gs`'s own consumer convention.
- **`shared/schemas/calculator-result.schema.json`** (+ `.md`) — `CalculatorResult`,
  the platform's second entity implementing docs/44 §11.4's JSON-storage policy
  (`check-in-response.schema.json`'s own `.md` had already anticipated this as its
  "second use"). `input_snapshot` is a flat, JSON-encoded-at-rest object, validated
  field-by-field against the referenced `(calculator_slug, definition_version)`'s own
  `input_fields`, size-bounded, and serialized with deterministic key order.
  `result_value` is never computed by this schema or its backing code — ADR-013's
  formula logic is the responsibility of whichever future batch authors a real
  calculator; this generic layer only validates and stores.
- **`apps-script/CalculatorResult.gs`** (new) — `foundationCreateCalculatorResult_()`
  (create, cross-patient-isolated, session-derived `patient_id`) and
  `foundationGetPatientCalculatorResults_()` (sorted, capped list) — a close structural
  mirror of `CheckInResponse.gs`, minus an assignment-enforcement step (docs/44 §8.4:
  calculator visibility is governed by `PatientModuleState` alone, once a future batch
  wires a calculator into the Module Registry — no separate assignment entity exists
  for this pillar).
- **`apps-script/FoundationRouter.gs`** — two new, additive dispatch cases:
  `submit_calculator_result` (the platform's fourth patient-writable route) and
  `get_calculator_results`. Both are rejected today for any real calculator_slug, since
  the registry ships empty — the same fail-closed-by-absence outcome
  `patient-module-state.md` already documents for its own registry.
- **`validation/phase-2a-foundation/`**: Stage 14 in `conformance.js` (validation
  rejections, the empty-registry fail-closed outcome, a synthetic, clearly-labeled
  test-only fixture pushed directly into the loaded sandbox's own registry array —
  never committed to `calculator-registry.json` — to prove the generic
  input-validation/deterministic-serialization/storage mechanism end to end, cross-
  patient isolation, and audit-log entries) and `CalculatorRegistry.gs`/
  `CalculatorResult.gs` added to `harness.js`'s `FILES` list — 329/329 conformance
  checks passing. No new browser-test suite is introduced, mirroring
  `DoctorAssignedCondition.gs`'s PXP-2 and `ModuleRegistry.gs`'s PXP-3 precedent — this
  batch adds no patient-facing UI, so there is no browser-drivable surface to test.

### Changed (documentation)
- `docs/33-DOMAIN-MODEL.md` bumped to Version 1.10 — Calculator (§5.3) promoted from
  "Designed, not yet implemented" to **Implemented (backend only)**; new §6.8
  (Calculator Registry and Calculator Result).
- `docs/24-ROADMAP.md` bumped to Version 1.10 — Phase 2B status updated: Batch PXP-6
  shipped, with the disclosed backend-only scope decision stated explicitly.
- `shared/README.md` — paragraph added noting the new constants file/schema/
  implementation set.

### Verified
- Static Analysis: PASS, 0 findings (41 files scanned). Conformance: 329/329. Phase
  1.5 Regression: 42/42. Browser test suites: 216/216 across eight suites
  (`pa-2-dashboard`, `pa-3-timeline`, `pa-4-symptom-tracker`, `pa-5-reports`,
  `pa-6-public-nav`, `pxp-1-patient-profile`, `pxp-4-dashboard-registry`,
  `pxp-5-checkin-engine`) — unchanged, since this batch adds no patient-facing UI.

## 2026-07-12 — Phase 2B Batch PXP-5: Daily Check-in Engine

The Daily Check-in Engine (docs/44 §10/§11/§22, ADR-016, docs/47) — a consumer of
Pillars 1 and 2, shipped alongside (never replacing) Symptom Tracker (docs/44 §10.1).
Introduces the Template Registry's first concrete category (`CheckInTemplate`) and
`CheckInResponse`, the platform's first entity using docs/44 §11.4's JSON-storage
policy. Explicitly approved per docs/47's per-batch gate. Zero modification to any
frozen Foundation/Identity & Access/Patient Access/PXP-1..4 file. `Patient`,
`SymptomLogs`, and every existing dispatch case's request/response contract are
completely unaffected.

**One disclosed, additive gap-fill:** docs/44 §10.2 settles that "a doctor explicitly
assigns which template(s) apply" to a patient, but neither docs/44 §17 nor docs/33 §6.5
names a persisted shape for that assignment. `CheckInTemplateAssignment` — an exact
structural mirror of the already-approved `DoctorAssignedCondition` pattern — fills
this gap; see `shared/schemas/check-in-template-assignment.md` for the full disclosure.

### Added
- **`apps-script/TemplateRegistry.gs`** + **`shared/constants/template-registry.json`**
  (+ `.md`) — Phase 2B's fourth registry (ADR-016), a static, versioned list of
  `CheckInTemplate` descriptors. Seeded with one template, `daily_wellness_checkin` v1
  (four questions: overall feeling, symptom severity, medication adherence, optional
  notes). `template_category` is a disclosed, additive field beyond docs/44 §11.2's
  literal list, generalizing the registry per §11.5's own requirement.
- **`apps-script/CheckInTemplateAssignment.gs`** + **`shared/schemas/
  check-in-template-assignment.schema.json`** (+ `.md`) — the disclosed gap-fill entity
  above. Doctor/staff-only (`assignFoundationCheckInTemplate()`/
  `resolveFoundationCheckInTemplateAssignment()`, manually-run editor functions, no
  real Doctor identity/session yet, docs/33 §1.4). No Web App write route, mirroring
  every earlier doctor/staff-only entity's precedent.
- **`apps-script/CheckInResponse.gs`** + **`shared/schemas/check-in-response.schema.json`**
  (+ `.md`) — the platform's second patient-writable, create-and-list-only entity.
  Implements docs/44 §11.4's JSON storage policy in full: `answers` is a flat object,
  validated field-by-field against the referenced template version's own question list,
  size-bounded, and serialized with deterministic key order. The write path enforces
  docs/44 §10.2's boundary directly — a patient can only submit against a template_id
  they currently hold an active assignment for, never merely one that exists in the
  registry.
- **`shared/constants/module-registry.json`**/**`apps-script/ModuleRegistry.gs`** — one
  new, additive entry, `daily_checkin` (`data_source: get_checkin_responses`). The three
  PXP-3 rows are untouched.
- **`apps-script/FoundationRouter.gs`** — three new, additive dispatch cases:
  `get_checkin_template` (resolves the caller's active assignment to its latest active
  Template Registry version, `data: null`, not an error, when unassigned),
  `submit_checkin_response` (the platform's third patient-writable route), and
  `get_checkin_responses`.
- **`my-health-journey/dashboard.js`** — a new Daily Check-in card, registered the same
  way every module since PXP-4 is: one `MODULE_REGISTRY` entry, one registered loader.
  Its form is the first on this dashboard rendered dynamically from server-provided
  question metadata rather than fixed markup — a number question becomes a number
  input with the template's own `min`/`max`, a boolean question becomes a Yes/No
  select, a string question becomes a textarea.
- **`my-health-journey/checkins/`** — a new full-history page (`index.html` +
  `checkins.js`) mirroring `my-health-journey/symptoms/`'s existing pattern, rendering
  every past response's answers generically (humanized `field_key`s) rather than
  assuming a fixed field set.
- **`validation/pxp-5-checkin-engine/`** — new Playwright browser-test suite (25
  checks) covering the dynamic form, the unassigned-patient state, submission,
  the recent-response summary, and the full-history page.
- **`validation/phase-2a-foundation/conformance.js`** — Stage 13 (28 new checks, 291
  total in the suite), covering `TemplateRegistry.gs`, `CheckInTemplateAssignment.gs`,
  and `CheckInResponse.gs` against their schemas plus the three new dispatch cases end
  to end, including docs/44 §10.2's assignment-enforcement boundary and cross-patient
  isolation.

### Changed
- **`validation/phase-2a-foundation/conformance.js`** — Stage 12's own module-registry-
  derived count assertions updated from `3` to `4`, a mechanical, disclosed consequence
  of `ModuleRegistry.gs`'s own designed, additive growth now that this batch registers
  a fourth module. PXP-3's actual shipped rows/logic are untouched — only this test
  file's hardcoded expectation of how many rows exist today.

## 2026-07-11 — Phase 2B Batch PXP-4: Dashboard Registry

Phase 2B's Pillar 2 frontend consumer (docs/44 §7.3/§13, ADR-012 (amended), docs/47 §3)
— the "My Health Journey" dashboard becomes a registry-driven consumer of PXP-3's
Module Registry plus `PatientModuleState`. Every card that renders on the dashboard now
corresponds to a registry entry the patient is enabled for; there is no hardcoded
knowledge of any specific module in `dashboard.js`'s render path. Explicitly approved
per docs/47's per-batch gate. Zero backend change (no new Apps Script route, no new
schema, no `.gs` file added or edited — the batch is entirely a frontend consumer of
PXP-3's already-shipped `get_patient_module_states` route). Zero change to Phase 1.5,
Foundation, Identity & Access, or any PXP-1/PXP-2/PXP-3 file.

### Changed
- **`my-health-journey/dashboard.js`** — the batch's one explicitly disclosed
  frozen-file exception (docs/47 §6: this file is Phase 2A-frozen except for genuine
  bug fixes, and PXP-4 is not a bug fix; it is the exact "authorized migration" case
  ADR-012 (amended) commits to and docs/44 §7.3 requires). Rewrites `renderDashboard()`
  from six hardcoded `cardHtml(id, title, bodyHtml)` calls into a zero-line-per-card
  loop over the enabled entries returned by a new `filterEnabledModules()` helper. The
  main flow now issues `get_profile` and `get_patient_module_states` in parallel
  (`Promise.all`); either non-`ok` envelope collapses to `/login.html?reason=expired`,
  the same fail-closed treatment `get_profile` alone got before this batch. A new
  loader-dispatcher (`MODULE_LOADERS`) maps each registry `data_source` string to its
  registered loader function; `renderDashboard()` never learns any specific
  `module_id`. The three pre-PXP-4 hardcoded "future" cards (Care Plan, Messages,
  Digital Twin) no longer render on any patient's dashboard, since none are in the
  Module Registry — docs/44 §13.2/docs/47 §4: a not-yet-built module is not
  pre-declared by an earlier batch guessing its shape, so it does not render at all
  until its own batch adds it (at which point it will re-appear via the registry, not
  a hardcoded `emptyStateHtml('future', …)` call in `dashboard.js`). The `future`
  empty-state formatter itself is retained on `window.WiseDashboard` for a future
  consumer, the same "built, verified, awaiting a future consumer" discipline
  `phase2a` has followed since PA-5. The Symptom Tracker card's DOM id fragment
  changes from the pre-PXP-4 literal `symptoms` to its registry `module_id`
  `symptom_tracker` — the sole source of every DOM id is now the registry, not any
  hardcoded string in this file. Per-card loader signatures gain an explicit
  `moduleId` parameter for the same reason. `my-health-journey/index.html` is
  **unchanged** — the `#dashGrid` container is already generic.

### Added
- **In-file frontend Module Registry hand-port** — a five-field-per-entry subset
  (`module_id`, `title`, `display_order`, `empty_state`, `data_source`) of
  `shared/constants/module-registry.json` v1.0.0, inlined at the top of
  `dashboard.js`, following the same hand-port convention `CONDITION_OPTIONS`,
  `REPORT_MAX_UPLOAD_BYTES`, and `apps-script/ModuleRegistry.gs`'s
  `FOUNDATION_MODULE_REGISTRY_` already use for their own consumers (a browser has no
  ES-module/build-step to read the canonical JSON at runtime, so a static hand-port is
  the same discipline every other shared/ constant already follows in this file).
  Reserved/inert fields (`supports_*`, `future_ai_capable`, `icon`, `visibility`,
  `permissions`, `rendering_type`) stay in the canonical JSON only — the module-
  registry.md "Which fields does PXP-3 code actually consume?" note continues to
  hold. Update all three ports by hand if the canonical list ever changes.
- **`validation/pxp-4-dashboard-registry/`** (new suite) — 23 browser-driven checks
  covering PXP-4's new surface only: dashboard-level empty state (zero enabled
  modules), per-patient enablement filtering (subset of modules), `display_order`-
  driven card ordering regardless of response order, exact `foundation_action`-call
  budget during boot, unregistered `data_source` fail-soft (skeleton + `console.warn`,
  no crash, sibling cards unaffected), `filterEnabledModules` pure-function ordering
  and fail-closed skipping of unknown module_ids, and a rejected
  `get_patient_module_states` collapsing to `/login.html?reason=expired`. Companion
  `README.md` documents scope, running, and what the suite does not prove — the
  same discipline every PA-* /pxp-* README already follows.
- **Existing browser suites updated (behavior-preserving)** —
  `validation/pa-2-dashboard/`, `pa-3-timeline/`, `pa-4-symptom-tracker/`,
  `pa-5-reports/`, and `pxp-1-patient-profile/` each add a
  `get_patient_module_states` response to their `page.route` mock (seeded with all
  three seeded registry modules enabled, mirroring pre-PXP-4 behavior). `pa-2-
  dashboard/` also updates its "renders all six expected cards" assertion to
  "renders exactly three registry-driven cards" (Timeline / Symptom Tracker /
  Reports, in `display_order`), and its future-badge assertion from `futureCount ===
  3` to `futureCount === 0`, and its `card-symptoms-*` selectors to
  `card-symptom_tracker-*` — the docs/45 Part 1.3 / docs/46 Part 4 #3 mandatory PXP-4
  regression obligation. `pa-4-symptom-tracker/` renames its two `card-symptoms-body`
  selectors to `card-symptom_tracker-body` for the same reason. Every pre-PXP-4
  behavior check in every suite still passes unchanged.

### Changed (documentation)
- `docs/33-DOMAIN-MODEL.md` bumped to Version 1.8 — Module Registry and Patient Module
  State (§6.3) promoted from "Implemented (backend scaffold)" to **Implemented (backend
  scaffold + frontend consumer)**; disclosure that the patient dashboard is now the
  registry's first live consumer.
- `docs/24-ROADMAP.md` bumped to Version 1.9 — Phase 2B status updated: Batch PXP-4
  shipped; batch paragraph added mirroring PXP-1/PXP-2/PXP-3's structure.

### Verified
- Static Analysis: PASS, 0 findings (36 `.gs` files scanned; no `.gs` file was added
  or edited by this batch).
- Conformance: 236/236 (Stage 12 unchanged — PXP-3's backend is untouched).
- Phase 1.5 Regression: 42/42.
- Browser test suites: **191/191 across seven suites** — `pa-2-dashboard` 32/32,
  `pa-3-timeline` 29/29, `pa-4-symptom-tracker` 28/28, `pa-5-reports` 32/32,
  `pa-6-public-nav` 22/22, `pxp-1-patient-profile` 25/25, `pxp-4-dashboard-registry`
  **23/23** (new). The 168 pre-PXP-4 checks all still pass; the +23 delta is the
  dedicated PXP-4 suite.

## 2026-07-10 — Phase 2B Batch PXP-3: Module Registry

Phase 2B's Pillar 2 backend (docs/44 §4.1/§7/§22) — the platform's only mechanism for
expressing which patient-facing capabilities exist at all (availability) and whether a
given patient may see one (enablement). Explicitly approved per docs/47's per-batch
gate. Zero dependency on any other Phase 2B batch beyond the registry itself; zero
modification to any frozen Foundation/Identity & Access/Patient Access/PXP-1/PXP-2
file. **No dashboard rendering change ships in this batch** — `my-health-journey/
dashboard.js` is untouched; that migration is the still-unbuilt Dashboard Registry
batch (PXP-4).

### Changed
- **ADR-012 amended a second time** (`adr/ADR-012-dashboard-modules-are-registry-driven.md`)
  — generalizes the Module Registry's framing from dashboard-specific infrastructure to
  a platform-wide, data-driven capability-exposure mechanism. The patient dashboard
  (via the still-unbuilt PXP-4) remains this registry's first and, as of this batch,
  its only implemented consumer. Timeline, Personal Care Plan, and a future AI system
  are named, but explicitly not scoped, batched, or authorized, as potential future
  consumers of this same registry/`PatientModuleState` mechanism — the same
  "name it, don't scope it" discipline ADR-016 already established for its own six
  future template categories. No new consumer, batch, or behavior change is authorized
  by this amendment; `PatientModuleState`'s fail-closed absence-of-row default and
  docs/44 §14's "enablement is always an explicit doctor/staff action" are unchanged
  and unreopened. `docs/31-ADR-INDEX.md`'s ADR-012 status line updated to match.

### Added
- `shared/constants/module-registry.json` + companion `.md` (new) — the Module
  Registry's static, versioned list of module descriptors (availability, not
  enablement). Seeded, in this batch, with only the three already-implemented Phase 2A
  capabilities (Timeline, Symptom Tracker, Reports) — Daily Check-ins, Calculators, and
  Personal Care Plan are deliberately not pre-declared, since inventing their shape now
  would front-run their own future batches' design decisions (docs/47 §4). Each
  descriptor carries display/extensibility metadata (`title`, `description`, `icon`,
  `display_order`, `visibility`, `permissions`, `data_source`, `empty_state`,
  `rendering_type`) plus a reserved AI-compatibility field (`future_ai_capable`,
  docs/44 §7.1's own requirement) and a family of reserved, presently-inert
  `supports_*` capability flags (`notifications`/`history`/`export`/`badges`/
  `reminders`/`ai`/`doctor_notes`/`patient_input`) — every reserved field is consumed
  by zero code in this batch. One field (`enabled_by_default`) was explicitly
  considered and omitted, disclosed in `module-registry.md`, for risking contradiction
  with the fail-closed/doctor-only-enablement rule.
- `apps-script/ModuleRegistry.gs` (new) — `foundationGetModuleRegistry_()`/
  `foundationGetRegisteredModuleIds_()`, a hand-ported, static copy of the canonical
  list, mirroring `condition-slugs.json`'s own consumer convention.
- `shared/schemas/patient-module-state.schema.json` + companion `.md` (new) —
  `PatientModuleState`: one row per `(patient_id, module_id)` pair, addressed by a
  server-derived, deterministic `state_key` field (`patient_id + '::' + module_id`) so
  the frozen, single-idColumn `FoundationDataStore.gs` needed no change for this
  composite-keyed entity. `enabled`/`enabled_by`/`enabled_at` — fail-closed by absence
  of a row (ADR-010); `enabled_by`/`enabled_at` are empty-string sentinels for a
  synthesized, never-written default, the same convention
  `doctor-assigned-condition.schema.json`'s `resolved_by`/`resolved_at` already
  establishes.
- `apps-script/PatientModuleState.gs` (new) — `foundationSetModuleState_()` (doctor/
  staff-only upsert by `state_key`) and `foundationGetPatientModuleStates_()` (merges
  real rows with synthesized, fail-closed defaults for every registered module). No
  real Doctor identity/authentication exists yet (docs/33 §1.4), so enable/disable
  stays a manually-run Apps Script editor function (`setFoundationModuleState()`),
  mirroring `DoctorAssignedCondition.gs`'s own precedent exactly.
- `apps-script/FoundationRouter.gs` — one new, read-only dispatch case,
  `get_patient_module_states`, deriving `patient_id` exclusively from the verified
  session. No UI consumes it in this batch — infrastructure for the future Dashboard
  Registry batch (PXP-4).
- `validation/phase-2a-foundation/`: Stage 12 in `conformance.js` (validation
  rejections, the fail-closed default across all three seeded modules, the
  create-then-update-in-place upsert via `state_key`, distinct rows per module for the
  same patient, cross-patient isolation on the read route, proof that no
  enable/disable action is reachable over HTTP dispatch, and audit-log entries for
  both enable and disable) and `ModuleRegistry.gs`/`PatientModuleState.gs` added to
  `harness.js`'s `FILES` list — 236/236 conformance checks passing.
- `validation/static-analysis/analyze.js`'s `MANUAL_DROPDOWN_WRAPPERS` allowlist
  extended with `setFoundationModuleState`, the same documented exception every prior
  manually-run editor wrapper already uses.

### Changed (documentation)
- `docs/33-DOMAIN-MODEL.md` bumped to Version 1.7 — Module Registry and Patient Module
  State (§6.3) promoted from "Designed, not yet implemented" to **Implemented (backend
  scaffold)**.
- `docs/24-ROADMAP.md` bumped to Version 1.8 — Phase 2B status updated: Batch PXP-3
  shipped.
- `shared/README.md` — two-line addition noting the new constants file/schema/
  implementation set.

### Verified
- Static Analysis: PASS, 0 findings. Conformance: 236/236. Phase 1.5 Regression:
  42/42. Browser test suites: 168/168 across six suites (`pa-2-dashboard`,
  `pa-3-timeline`, `pa-4-symptom-tracker`, `pa-5-reports`, `pa-6-public-nav`,
  `pxp-1-patient-profile`) — unchanged, since this batch adds no patient-facing UI. No
  new browser-test suite is introduced, matching `DoctorAssignedCondition.gs`'s own
  PXP-2 precedent (a read-only, UI-less route has no browser-drivable surface to test).

## 2026-07-09 — Phase 2B Batch PXP-2: Doctor-Assigned Conditions

Phase 2B's Pillar 1 — the platform's only mechanism for expressing which patient needs
which capability (docs/44 §4.1). Explicitly approved per docs/47's per-batch gate. Zero
dependency on any other Phase 2B batch; zero modification to any frozen Foundation/
Identity & Access/Patient Access/PXP-1 file.

### Added
- `shared/schemas/doctor-assigned-condition.schema.json` + companion `.md` (new) —
  `DoctorAssignedCondition`: `assignment_id`, `patient_id`, `condition_slug`,
  `assigned_by`, `assigned_at`, `status` (active/resolved), plus `resolved_at`/
  `resolved_by` (empty-string sentinels until resolved — a disclosed, additive
  completion of docs/44 §6.2's stated "full audit history of every assignment and
  resolution"). A wholly additive entity — the frozen `Patients` sheet/
  `patient-identity.schema.json` (ADR-002) is never widened; `Patient.condition_slug`
  remains exactly where it is, untouched.
- `apps-script/DoctorAssignedCondition.gs` (new) — `foundationAssignCondition_()`/
  `foundationResolveCondition_()`/`foundationGetPatientConditionAssignments_()`.
  Doctor/staff-owned, a hard boundary: the patient never creates, edits, or resolves a
  row of this shape. No real Doctor identity/authentication exists yet (docs/33 §1.4,
  a disclosed gap), so — mirroring `PatientIdentity.gs`'s `createFoundationPatient()`
  precedent exactly — assignment and resolution are manually-run Apps Script editor
  functions (`assignFoundationCondition()`/`resolveFoundationCondition()`), not a new
  authenticated Web App route. A resolve is a one-way, exactly-once transition: an
  unknown or already-resolved `assignment_id` is rejected, never idempotent.
- `apps-script/FoundationRouter.gs` — one new, read-only dispatch case,
  `get_doctor_assigned_conditions`, deriving `patient_id` exclusively from the verified
  session, the same authorization primitive every other Foundation read route already
  uses. This is the batch's approved, minimal patient-facing surface (docs/44 §22's
  "zero patient-facing surface beyond a read-only reflection, if any") — infrastructure
  for later batches (Module Registry, Dashboard Registry, Daily Check-in Engine,
  Calculator Registry, Personal Care Plan) to eventually consume; no patient-facing UI
  is built on top of it in this batch.
- `validation/phase-2a-foundation/`: Stage 11 in `conformance.js` (validation
  rejections, many-per-patient assignment, the one-way resolve transition and its
  double-resolve rejection, cross-patient isolation on the read route, and proof that
  no assign/resolve action is reachable over HTTP dispatch) and
  `DoctorAssignedCondition.gs` added to `harness.js`'s `FILES` list — 206/206
  conformance checks passing.
- `validation/static-analysis/analyze.js`'s `MANUAL_DROPDOWN_WRAPPERS` allowlist
  extended with `assignFoundationCondition`/`resolveFoundationCondition`, the same
  documented exception every prior manually-run editor wrapper already uses.

### Changed
- `docs/33-DOMAIN-MODEL.md` bumped to Version 1.6 — Doctor Assigned Condition (§6.2)
  promoted from "Designed, not yet implemented" to **Implemented**; docs/45 Version
  3.0/4.0 Part 1.2's `DoctorAssignedCondition`/`Patient.condition_slug` coexistence
  loose end resolved (this batch is purely additive; no existing reader migrates).
- `docs/24-ROADMAP.md` bumped to Version 1.7 — Phase 2B status updated: Batch PXP-2
  shipped.
- `shared/README.md` — one-line addition noting the new schema/implementation pair.

### Verified
- Static Analysis: PASS, 0 findings. Conformance: 206/206. Phase 1.5 Regression: 42/42.
  Browser test suites: 168/168 across six suites (`pa-2-dashboard`, `pa-3-timeline`,
  `pa-4-symptom-tracker`, `pa-5-reports`, `pa-6-public-nav`, `pxp-1-patient-profile`) —
  unchanged, since this batch adds no patient-facing UI. No new browser-test suite is
  introduced, matching `PatientIdentity.gs`'s own precedent (an editor-only tool has no
  browser-drivable UI to test).

## 2026-07-09 — Phase 2B Batch PXP-1: Patient Profile

The first Phase 2B implementation batch, explicitly approved per docs/47's per-batch
gate. Zero dependency on any other Phase 2B batch; zero modification to any frozen
Foundation/Identity & Access/Patient Access file.

### Added
- `shared/schemas/patient-profile.schema.json` + companion `.md` (new) — the platform's
  first patient-mutable, upsert-style entity contract: `patient_id` (1:1), `phone`,
  `date_of_birth`, `preferred_contact_method`, `emergency_contact`, `updated_at`,
  `updated_by`. A wholly separate entity from the frozen `Patients` sheet/
  `patient-identity.schema.json` (ADR-002) — never widens it.
- `apps-script/FoundationPatientProfile.gs` (new) — `foundationGetPatientProfile_()`/
  `foundationSavePatientProfile_()`, the platform's first real production use of
  `foundationDsUpdateById_()` for a genuinely patient-driven field update (create-if-
  absent, else patch — an upsert, unlike every prior entity's create-and-list-only
  lifecycle). Resolves both lifecycle questions docs/45 Version 4.0 carried forward:
  **lazy row creation** (no row exists until the first save; a never-saved profile
  returns a real, default-shaped record, never `FOUNDATION_NOT_FOUND`) and **no
  `Patient.status`-based gating** (profile view/edit works regardless of active/
  inactive/recovered, matching every other existing patient-facing feature).
- `apps-script/FoundationRouter.gs` — two new dispatch cases, `get_patient_profile` and
  `save_patient_profile`, both deriving `patient_id` exclusively from the verified
  session, the same authorization primitive `log_symptom`/`upload_report` already use.
- `my-health-journey/profile/` (new: `index.html` + `profile.js`) — the patient-facing
  profile view/edit page, following the same `session-guard.js` pattern as
  `symptoms/`/`reports/`. Unlike those append-only forms, a successful save does **not**
  reset the form — this is an edit-in-place record, not a log entry.
- `my-health-journey/index.html` — one small, disclosed exception to this frozen
  dashboard shell: a static "My Profile" header link (`#profileLink`), no
  `dashboard.js` logic touched, no new dashboard card added in this batch (a future
  Dashboard Registry batch, PXP-3/PXP-4, is the natural place for that if ever wanted).
- `validation/phase-2a-foundation/`: Stage 10 in `conformance.js` (lazy-creation,
  upsert insert/update branches, cross-patient isolation, every field's validation
  rule, full HTTP-dispatch round trip) and `FoundationPatientProfile.gs` added to
  `harness.js`'s `FILES` list — 178/178 conformance checks passing.
- `validation/pxp-1-patient-profile/` (new browser-test suite + README) — 25/25 checks
  passing, covering the profile page's first-visit/pre-filled/save-success/save-
  rejection/network-failure/sign-out/responsive/accessibility behavior and the
  dashboard's new "My Profile" link.

### Fixed
- `validation/pa-2-dashboard/browser-test.js`'s keyboard-focus assertion updated (one
  additional `Tab` press) to account for the dashboard header's new, legitimate third
  interactive control — re-confirmed passing (32/32) after this batch's one disclosed
  header change.

### Changed
- `docs/33-DOMAIN-MODEL.md` bumped to Version 1.5 — Patient Profile (§6.1) promoted
  from "Designed, not yet implemented" to **Implemented**, both lifecycle decisions
  recorded.
- `docs/24-ROADMAP.md` bumped to Version 1.6 — Phase 2B status updated: implementation
  underway, Batch PXP-1 shipped.

### Verified
- Static Analysis: PASS, 0 findings. Conformance: 178/178. Phase 1.5 Regression: 42/42.
  Browser test suites: 168/168 across six suites (`pa-2-dashboard`, `pa-3-timeline`,
  `pa-4-symptom-tracker`, `pa-5-reports`, `pa-6-public-nav`,
  `pxp-1-patient-profile`).

## 2026-07-09 — Phase 2B Implementation Rules (documentation only, no code)

A new governance document establishes the permanent implementation standard every
remaining Phase 2B batch (PXP-1 through PXP-11) must follow, ahead of any batch
approval. **No implementation began; no production code was written or modified.**

### Added
- `docs/47-PHASE-2B-IMPLEMENTATION-RULES.md` (new) — reaffirms registry-driven
  architecture, configuration-over-hardcoding, doctor-configures/patient-consumes,
  passwordless-by-default, Magic Link as root of trust, and AI-extension-points-only as
  binding principles for every batch; states explicit "never hardcode" rules (diseases,
  dashboard cards, calculators, questionnaires, check-ins, care plans); defines
  per-entity requirements (schema, Apps Script module, documentation, browser tests,
  conformance tests, validation, CHANGELOG entry, consistency review); states coding,
  validation, documentation, and git rules; defines Definition of Done, Definition of
  Freeze, the mandatory three-phase (Implement → Validate → Close) batch workflow, and
  repository-consistency and release-discipline rules covering every future batch.

### Changed
- `docs/24-ROADMAP.md` bumped to Version 1.5 — Phase 2B entry now references
  docs/47 as the permanent per-batch implementation standard.

### Verified
- Static Analysis, Conformance (152 checks), and Phase 1.5 Regression (42/42) re-run
  clean after this documentation-only change. Browser test suites were not re-run
  (no production code changed).

## 2026-07-09 — Phase 2B Architecture Freeze Finalization (documentation only, no code)

A fourth, documentation-only pass finalizes the Phase 2B architecture freeze ahead of
any batch approval. **No batch's scope, dependency, or risk classification changed, and
no production code was written or modified.**

### Changed
- `docs/44-PHASE-2B-TECHNICAL-PLAN.md` bumped to Version 4.0: renamed the implementation
  batch sequence from **PCP-1…PCP-11** to **PXP-1…PXP-11** for platform-wide naming
  consistency (Patient Profile, Doctor Assigned Conditions, Module Registry, Dashboard
  Registry, Daily Check-in Engine, Calculator Registry, Personal Care Plan, Trusted
  Device + Long-Lived Session + Optional PIN, AI Integration, Symptom Tracker Migration,
  Closeout) — no batch's Delivers/Depends-on/Risk content changed; generalized §11's
  Template Engine into a **Template Registry** (new **ADR-016**, complementing ADR-012),
  with `CheckInTemplate` as its first concrete category and six future categories (Weekly
  Check-in, Monthly Review, Condition Review, Lifestyle Questionnaire, Follow-up
  Questionnaire, Doctor-created Templates) named as reserved, unscoped future work;
  refined the dashboard vision (§13) into a named, registry-driven **"Health Journey"**
  framing — no per-disease hardcoding, ever; added an explicit **Doctor-Owned
  Configuration** section (§4.3) consolidating the already-settled rule that patients
  never configure their own conditions, modules, calculators, check-ins, templates, or
  care plans; added a **Summary — Existing Principles Reaffirmed** section (§5.7)
  restating passwordless-by-default, Magic Link as permanent root of trust, Trusted
  Device, Long-Lived Session, and PIN-as-optional-convenience-only, all unchanged; and
  reserved (without implementing) AI-compatibility extension points across the Module
  Registry, Calculator Registry, and the new Template Registry.
- `docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md` bumped to Version 4.0: critiqued
  all four new items above (§1.10–1.13), found no new gap or contradiction, and added
  two new low-severity naming risks to the ranked risk list (Template Registry's named
  future categories; the "Symptom Tracker Migration" batch name read alongside §10.1's
  migration language) — both already disclosed in docs/44, neither a blocker.
- `docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-REVIEW.md` bumped to Version 4.0: verified
  ADR-016 against ADR-007 (correctly a new, complementary ADR, not an amendment to
  ADR-012), verified the PCP→PXP rename left no stale reference anywhere in the
  documentation set, and found no new duplication or contradiction introduced by this
  pass.
- `docs/24-ROADMAP.md` bumped to Version 1.4 — Phase 2B entry updated to reflect the
  renamed batch sequence, the new Template Registry, and the "Health Journey" framing.
- `docs/33-DOMAIN-MODEL.md` bumped to Version 1.4 — added a Template Registry entity
  (§6.7), generalizing Check-In Template into its first concrete category; updated every
  `PCP-N` cross-reference to `PXP-N`.
- `docs/31-ADR-INDEX.md` bumped to Version 1.4 — added **ADR-016** (Template Registry,
  complementing ADR-012).
- `/adr/ADR-016-template-registry.md` — new. Generalizes the Template Engine into a
  registry pattern mirroring Module Registry (ADR-012) and Calculator Registry
  (ADR-013); reserves an AI-compatibility extension point without implementing any AI
  behavior; reaffirms doctor-only template assignment for every current and future
  template category.

### Verified
- Static Analysis, Conformance (152 checks), Phase 1.5 Regression (42/42), and all five
  browser-test suites (143 checks across `pa-2-dashboard`, `pa-3-timeline`,
  `pa-4-symptom-tracker`, `pa-5-reports`, `pa-6-public-nav`) re-run clean after this
  documentation-only pass, confirming Phase 2A's frozen deployment-verification fixes
  remain intact.

## 2026-07-08 — Phase 2B Architecture Revision Pass, Round 2 (documentation only, no code)

A third review round approved the overall Phase 2B direction and settled most of the
design questions the prior two rounds had left open, ahead of approving PCP-1
implementation. **No production code was written or modified.**

### Changed
- `docs/44-PHASE-2B-TECHNICAL-PLAN.md` bumped to Version 3.0: renamed `ConditionAssignment`
  to **`DoctorAssignedCondition`** (Option B — additive, frozen `Patient` schema
  untouched — settled and approved); revised authentication once more to name a
  **Long-Lived Session** explicitly alongside Trusted Device, reframed the optional PIN
  as convenience-only, and reaffirmed passwordless-by-default as permanent and
  non-negotiable; elevated the Module Engine so the **entire** dashboard — including
  existing Timeline/Symptom Tracker/Reports cards — migrates onto the Module Registry,
  split into a "Module Registry" (backend) batch and a "Dashboard Registry" (frontend
  migration) batch; added an explicit **Calculator Registry** alongside
  `CalculatorDefinition`/`CalculatorResult`, with pluggability and no disease-specific
  hardcoding stated as explicit constraints; settled Check-in template assignment as a
  doctor action (the patient never configures a template); settled per-patient module
  enablement as always an explicit doctor/staff action, never automatic-by-condition;
  documented a concrete JSON storage policy (schema versioning via pinned
  `template_id`+`template_version`, write-time validation, and a migration strategy) in
  place of the prior open design fork; named Digital Twin's five specific future
  consumers (Timeline, Reports, Check-ins, Care Plans, Calculators); rewrote the
  implementation sequence to start with infrastructure (Patient Profile → Doctor-
  Assigned Conditions → Module Registry → Dashboard Registry → Daily Check-in Engine →
  Calculator Framework → Personal Care Plan → Persistent Login → a reserved, unscoped
  "AI Integration" placeholder), with Symptom Tracker retirement and validation/closeout
  added as their own later batches (PCP-1 through PCP-11).
- `docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md` bumped to Version 3.0: re-ranked
  risks now that JSON storage has a concrete policy (full dashboard migration surface
  area is now the top-ranked risk) and most of Version 2.0's open questions are settled
  decisions rather than recommendations.
- `docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-REVIEW.md` bumped to Version 3.0: verified the
  ADR-014→ADR-015 supersession and the ADR-012 amendment against ADR-007's requirements
  (both compliant); confirmed the `DoctorAssignedCondition` rename left no stale
  reference anywhere in the documentation set.
- `docs/24-ROADMAP.md` — Phase 2B entry updated to reflect the settled decisions and the
  new infrastructure-first implementation order.
- `docs/33-DOMAIN-MODEL.md` §6 — renamed `Condition Assignment` to `Doctor Assigned
  Condition`; added Long-Lived Session as a named (non-entity, session-parameterization)
  mechanism; added Calculator Registry; updated every docs/44 section/batch
  cross-reference to Version 3.0's numbering, including several stale references left
  over from the prior revision pass that this pass also caught and fixed.
- `/adr/ADR-012-dashboard-modules-are-registry-driven.md` — amended (not superseded):
  the original "existing cards are not required to migrate" allowance is resolved into
  a committed migration, via its own dedicated batch, per ADR-007's amend-without-
  rewriting discipline.
- `docs/31-ADR-INDEX.md` — added ADR-015; marked ADR-014 Superseded; noted ADR-012's
  amendment.
- `/adr/ADR-003-passwordless-authentication-by-default.md` — status note updated to
  point at ADR-015 as the current governing amendment.

### Added
- `/adr/ADR-015-long-lived-session-and-passwordless-reaffirmation.md` — supersedes
  ADR-014. Adds an explicit, named Long-Lived Session mechanism issued when a Trusted
  Device is presented, and permanently reaffirms that passwords never become mandatory
  and the platform continues to operate passwordless by default.

### Notes
- `/adr/ADR-014-trusted-device-persistent-login.md` is retained in full as historical
  record, per ADR-007 — marked Superseded, its Trusted Device design unchanged and
  incorporated by reference into ADR-015.
- Static Analysis, Conformance, and Phase 1.5 Regression suites were re-run after this
  batch and are unaffected, since no `apps-script/*.gs` or `shared/*` file was touched.

## 2026-07-06 — Phase 2B Architecture Revision Pass (documentation only, no code)

The architecture documents from 2026-07-04 were approved in principle, with four
required revisions before PCP-1 could be considered. **No production code was written
or modified.**

### Changed
- `docs/44-PHASE-2B-TECHNICAL-PLAN.md` bumped to Version 2.0: reframed the phase's
  vision from "Personal Care Plan" to the broader **Wise Patient Experience Platform**;
  elevated Doctor-Assigned Conditions, the Module Engine, and the Calculator Framework
  to named core architectural pillars, with every other capability (Daily Check-ins,
  Care Plan, Dashboard evolution) explicitly described as a consumer of one or more
  pillars; fully revised the persistent-authentication design from PIN-primary to
  **Trusted-Device-primary** (optional PIN retained as a secondary factor, Magic Link
  named as the root of trust for both); re-sequenced the implementation batches
  (PCP-1 through PCP-10) pillars-first.
- `docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md` bumped to Version 2.0: re-did the
  authentication critique and risk ranking from scratch (the Template Engine's
  JSON-encoded-column design is now this pass's top-ranked open risk, having moved up
  now that the persistent-credential hashing risk dropped following the Trusted-Device
  redesign).
- `docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-REVIEW.md` bumped to Version 2.0: re-checked
  the ADR-011→ADR-014 supersession for correctness against ADR-007's requirements
  (compliant); no new contradiction or roadmap gap introduced by the revision.
- `docs/24-ROADMAP.md` — Phase 2B entry reframed as "Wise Patient Experience Platform,"
  naming the three pillars and the revised authentication strategy.
- `docs/33-DOMAIN-MODEL.md` §6 — added `Trusted Device` as the primary persistent-auth
  entity; reframed `Patient Credential` as secondary; marked Condition Assignment,
  Module Registry/Patient Module State, and Calculator as Pillars 1–3; updated all
  docs/44 section/batch cross-references to Version 2.0's numbering.
- `docs/31-ADR-INDEX.md` — added ADR-014; marked ADR-011 Superseded.

### Added
- `/adr/ADR-014-trusted-device-persistent-login.md` — supersedes ADR-011. Persistent
  login is achieved primarily through a high-entropy, machine-generated Trusted Device
  token (reusing `LoginToken`'s already-proven hashing pattern, avoiding the need for
  any new cryptographic bridge), with an optional secondary PIN, both rooted in Magic
  Link.

### Notes
- `/adr/ADR-011-persistent-credential-as-additional-factor.md` is retained in full as
  historical record, per ADR-007's never-silently-edit rule — marked Superseded, its
  original decision text unchanged, its PIN-specific design retained by reference in
  ADR-014 for the now-secondary PIN mechanism.
- `/adr/ADR-003-passwordless-authentication-by-default.md`'s status note updated to
  point at ADR-014 as the current governing amendment.
- Static Analysis, Conformance, and Phase 1.5 Regression suites were re-run after this
  batch and are unaffected, since no `apps-script/*.gs` or `shared/*` file was touched.

## 2026-07-04 — Phase 2B Architecture-Freeze Pass (documentation only, no code)

Produced the architecture-freeze pass docs/24/docs/32/docs/43 all required before any
Phase 2B implementation could begin. **No production code was written or modified** —
this is a documentation-only batch, per this session's explicit instruction.

### Added
- `docs/44-PHASE-2B-TECHNICAL-PLAN.md` — full architecture for persistent authentication
  (password/PIN, additive to magic link), Patient Profile, Doctor-Assigned Conditions, a
  Module Engine, a Template Engine, Personalized Daily Check-ins (the designed successor
  to Symptom Tracker v1), a Calculator Framework (Patient variant), Personal Care Plan,
  dashboard evolution, per-patient feature enablement, AI boundaries, and Digital Twin
  integration scope. Includes a nine-batch implementation sequence (PCP-1 through
  PCP-9) — none authorized to begin by this document.
- `docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md` — critiques every proposal in
  docs/44, ranks risks (persistent-credential hashing on Google Apps Script is the
  highest), and states what must be settled before which batch.
- `docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-REVIEW.md` — duplication, contradiction, and
  roadmap-gap check of this pass's own output against the full existing documentation
  set, mirroring docs/34's method.
- `/adr/ADR-011-persistent-credential-as-additional-factor.md` — resolves the direct
  conflict between ADR-003 ("no patient password is ever collected, stored, or reset")
  and the requested persistent-authentication capability: magic link remains mandatory
  and is the sole recovery path; a PIN/password is strictly opt-in and additive.
- `/adr/ADR-012-dashboard-modules-are-registry-driven.md` — the patient dashboard moves
  to a module-registry pattern with per-patient enablement for every *new* Phase 2B
  capability; existing Phase 2A cards are not required to migrate.
- `/adr/ADR-013-calculators-are-deterministic-never-ai-generated.md` — freezes
  Calculator results as always deterministic, never AI-computed, before implementation
  begins (mirrors ADR-004's Digital-Twin boundary pattern).

### Changed
- `docs/31-ADR-INDEX.md` — added ADR-011/012/013; marked ADR-003 "amended in part by
  ADR-011."
- `/adr/ADR-003-passwordless-authentication-by-default.md` — added a forward-pointing
  status note to ADR-011 (original decision text unchanged, per ADR-007's
  never-silently-edit rule).
- `docs/33-DOMAIN-MODEL.md` — promoted Doctor Instruction, Care Plan, and Calculator
  (Patient variant) from *Conceptual* to *Designed, not yet implemented*; added a new
  §6 "Phase 2B Entities" for Patient Profile, Condition Assignment, Module Registry /
  Patient Module State, Check-In Template / Check-In Response, and Patient Credential;
  updated the Summary Table.
- `docs/24-ROADMAP.md` — expanded the previously one-line Phase 2B entry to reflect the
  actual scope of this pass and reference docs/44/45/46.

### Notes
- The GitHub release tag `v2.0.0-phase2a` was verified to already exist (both as a git
  tag and a published GitHub Release) pointing at the correct Phase 2A closeout commit —
  an earlier session report that it was missing was based on an incomplete local check
  (tags hadn't been fetched) and is corrected here, not acted on further per this
  session's explicit instruction not to create it.
- Static Analysis, Conformance, and Phase 1.5 Regression suites were re-run after this
  batch and are unaffected, since no `apps-script/*.gs` or `shared/*` file was touched.

## 2026-07-04 — Patient Access Batch PA-7 / Batch 5H (Phase 2A Closeout)

The Phase 2A closeout batch (docs/29 §13 Batch 5H) — not a feature batch. Confirmed
PA-1 through PA-6 remain frozen with zero code drift from `main`, re-ran every existing
validation suite fresh (static analysis, conformance, Phase 1.5 regression, and all
five browser-test suites — 337/337 checks passing, zero code changes required), and
performed a 16-dimension repository consistency review. Three genuine, documentation-
only inconsistencies were found and fixed; no code, schema, or contract was changed.
See `docs/43-PHASE-2A-CLOSEOUT.md` for the full closeout report.

### Fixed
- **A dedicated security review of the magic-link/session-token mechanism, required by
  docs/29 §11 item 2 / docs/32 / docs/34 before that work could be considered done, had
  been tracked as still-pending since the Identity & Access closeout and never actually
  performed.** Performed it now — manual review of `FoundationLoginTokens.gs`,
  `FoundationSession.gs`, `FoundationLoginFlow.gs`, `FoundationRateLimit.gs`,
  `FoundationRouteGuard.gs`, `login.html`, and `verify.html` — no vulnerabilities found.
  Recorded in `docs/15-SECURITY-STANDARDS.md`; docs/29/32/34 updated to mark the
  requirement done rather than silently stale.
- `docs/CHANGELOG.md` (distinct from this file) was a stale, pre-Phase-1.5 changelog
  still claiming Phase 1.5/Foundation/Identity & Access/Patient Access were
  "Unreleased"/"Planned." Marked superseded, pointing to this file as authoritative
  (which it has been all along, per docs/29 §12's documentation-impact table);
  historical entries left intact.
- `docs/24-ROADMAP.md`'s "Next: Batch 5H... not yet started" pointer was stale the
  moment this batch began. Updated to record Batch 5H / PA-7 shipped and Phase 2A
  closed.

### Added
- `docs/43-PHASE-2A-CLOSEOUT.md` — the Phase 2A closeout report: batch history,
  validation summary (337 automated checks, 0 failures), the security review record,
  final project statistics, and the release recommendation (`v2.0.0-phase2a`).

## 2026-07-04 — Patient Access Batch PA-6 (Public Visibility — nav, noindex, sitemap)

Sixth and final-named Patient Access batch (docs/29 §13 Batch 5G) — the only batch in
Phase 2A with a real public-visibility change. Preceded by re-confirming (not
re-implementing) that PA-5's deployment-verification fixes were still live on `main`
and a full clean re-run of every existing validation suite. **Zero backend change** —
no `apps-script/*.gs` or `shared/*` file is touched anywhere in this batch, verified via
`git diff --name-only`.

### Added
- A "Patient Login" link (`/login.html`) in the primary nav — both the desktop
  `.nav-links` list and the mobile menu — on all 10 public HTML pages that carry a
  primary nav: `index.html`, `blog/index.html`, `team.html`, `conditions/index.html`,
  `contact.html`, `disclaimer.html`, `gallery.html`, `online-consultation/index.html`,
  `privacy.html`, `terms.html`. Reuses the existing `.nav-links a` style unchanged — no
  new CSS — placed immediately before each page's Book Now/Book Consultation CTA,
  satisfying docs/08's/docs/20's "a separate action, distinct from Book Now"
  requirement structurally rather than with a new visual treatment.
- `<link rel="canonical">` tags on the six patient pages un-noindexed below (docs/07:
  every indexable page must carry one).
- `validation/pa-6-public-nav/browser-test.js` + `README.md` — a new, committed
  Playwright suite (22/22 passing) verifying the nav link's presence and a real
  click-through into the portal, the noindex removal against the rendered DOM on all
  six pages, the one deliberate exception below, and the sitemap's single new entry.
- `sitemap.xml` gained one new entry, `/login.html` (priority 0.5) — deliberately the
  only new entry; the authenticated pages behind it have no content an unauthenticated
  crawler could usefully index.

### Changed
- Removed the `noindex` meta tag from `login.html`, `verify.html`,
  `my-health-journey/index.html`, `my-health-journey/timeline/index.html`,
  `my-health-journey/symptoms/index.html`, and `my-health-journey/reports/index.html` —
  matching this site's existing convention that indexable pages carry no explicit
  `<meta name="robots">` tag at all, rather than rewriting it to `index, follow`.
- `docs/08-NAVIGATION-ARCHITECTURE.md` updated: "Patient Login" is now documented as
  live in primary nav, not a future placeholder.
- `docs/15-SECURITY-STANDARDS.md` gained a Batch PA-6 section clarifying that
  "unlisted and noindexed" was a staging-hygiene convention, never this platform's real
  access control (session verification, unchanged by this batch, always was) — removing
  it does not weaken anything.
- `docs/24-ROADMAP.md` and `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §12/§16 updated to
  reflect PA-6 shipped, naming every disclosed file touched.

### Notes
- **One deliberate, disclosed exception:** `my-health-journey/timeline/entry.html` (the
  per-record Consultation Detail view, keyed by a `?record_id=` query string) keeps its
  `noindex` tag — it has no stable canonical URL to index, an SEO reason, not a
  security one (its actual data is still behind the same session guard as every other
  patient page, before and after this batch).
- **`robots.txt` reviewed, not changed.** `Allow: /` already permitted crawling of every
  path on this site, including the patient pages, before this batch — there was never a
  `Disallow` rule to remove. Recorded as a genuine finding, not a silently-skipped task
  item.
- **A self-caught mistake, fixed before it shipped:** an early edit to
  `my-health-journey/timeline/entry.html` accidentally dropped its `<title>` and
  `<meta name="description">` tags. Caught by the new browser suite's own assertion
  failing, fixed immediately, and a dedicated regression check was added so the same
  mistake would be caught automatically if repeated.
- Verified: `node validation/static-analysis/analyze.js` (0 findings, unchanged);
  `node validation/phase-2a-foundation/conformance.js` (152/152, unchanged);
  `node validation/phase-1-5/validate.js` (42/42, unchanged);
  `validation/pa-2-dashboard/browser-test.js` (32/32, re-run unchanged);
  `validation/pa-3-timeline/browser-test.js` (29/29, re-run unchanged);
  `validation/pa-4-symptom-tracker/browser-test.js` (28/28, re-run unchanged);
  `validation/pa-5-reports/browser-test.js` (32/32, re-run unchanged);
  `validation/pa-6-public-nav/browser-test.js` (22/22, new).

## 2026-07-04 — Deployment Verification (Phase 2A first live deployment)

First real deployment of all Phase 2A code (Foundation through PA-5) to the live Apps
Script project — previously software-complete but never deployed. Verification found
and fixed two real, previously-unverified assumptions that only surfaced against the
real platform (both were disclosed open questions in the source docs, not silent bugs):

- **`apps-script/FoundationReports.gs`** — `foundationDetectActualMimeType_()` relied on
  `Utilities.newBlob(bytes).getContentType()` to infer a file's real MIME type from its
  bytes. On the real deployment this returned `null` for a genuinely valid PNG with no
  filename/`contentType` hint, rejecting every real upload. Replaced with a direct
  magic-number byte-signature check (PDF/JPEG/PNG). See
  `docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md` §11 and
  `shared/constants/upload-limits.md`, updated to record the resolution.
- **`apps-script/FoundationConsultationHistory.gs`** — `entry_date` (contractually a
  plain `YYYY-MM-DD` string per `shared/schemas/consultation-history.schema.json`) was
  found coming back as a full timestamp, because Google Sheets silently converts a
  plain date string written to a cell into a real date value. Added
  `foundationNormalizeEntryDate_()` to restore the plain-string contract on read.

## 2026-07-04 — Patient Access Batch PA-5 (Report Upload — Reports sheet, Drive integration)

Fifth Patient Access batch (docs/29 §13 Batch 5F), preceded by
docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md, approved before any code was written — the
platform's highest-risk feature (docs/29 §8/§11), the first arbitrary file-handling
surface. **This is PA-5's second, corrected build** — a first implementation was
merged, then reverted after a post-merge verification found five real gaps against
docs/42: a duplicate `docs/42` document (this build cites only the one, real,
authoritative review); Drive sharing was assumed private, not verified (now explicitly
enforced via `setSharing()` and directly asserted in conformance Stage 9 — docs/42 §6's
own named "single most important" test); a Drive-succeeds/Sheets-fails partial write
was unhandled (now rolled back by trashing the orphaned file, audit-logged, and
directly tested); `docs/12-DATA-ARCHITECTURE.md` was left unreconciled (now has a
Reports/Drive section); and the Drive object name embedded `patient_id` (now named
from `record_id` alone, per docs/42 §5). No unauthorized modification to any frozen
file — every touch to an already-shipped file is named below, none of them silent.

### Added
- `shared/constants/upload-limits.json` + `.md` — the canonical 5 MB size cap and
  PDF/JPG/PNG allowed-type list, the bootstrap exception (`shared/README.md`).
- `shared/schemas/report.schema.json` + `.md` — the `Reports` contract: metadata only
  (binary lives in Drive), immutable after creation, no update/delete.
- `apps-script/FoundationReports.gs` — patient-facing upload
  (`foundationCreateReport_()`, three-layer MIME validation, server-measured size
  enforcement, a Drive file named from `record_id` alone with sharing explicitly
  enforced private via `foundationEnsureReportFilePrivate_()`, and rollback-by-trashing
  if the Sheets write fails after the Drive write succeeds), patient-facing
  sorted/capped list (`foundationGetPatientReports_()`), ownership-gated
  get-by-id/download (`foundationGetReportById_()`/`foundationDownloadReport_()`), and
  a manually-run staff wrapper (`createFoundationReportForExistingDriveFile()`) for the
  one staff-attributed path, per the approved "no staff Web App route" decision.
- `my-health-journey/reports/index.html` + `reports.js` — the Reports full history
  page: a real ordered list of the patient's own uploads, escaped filenames, mime
  type/size, a "Download" action that decodes a base64 response into a real browser
  file download (never a Drive URL), the "No data yet" Empty State, a
  network-failure fallback.
- `validation/pa-5-reports/browser-test.js` + `README.md` — a new, committed
  Playwright suite (32/32 passing, including a real Playwright `setInputFiles()`
  upload and a real triggered `download` event).
- `docs/12-DATA-ARCHITECTURE.md` gained a "Phase 2A — Report Upload Schema" section,
  closing docs/29 §12's own long-open item for the Reports entity specifically, per
  docs/42 §16 step 7's explicit call to close it as part of this batch.

### Changed
- `apps-script/FoundationRouter.gs` — gained three new dispatch cases,
  `upload_report`, `get_reports`, and `download_report`, and their thin wiring
  functions — the same disclosed, additive exception PA-3's/PA-4's own new cases
  already established.
- `my-health-journey/dashboard.js` — the Reports card now shows a real,
  always-present upload form (a single file picker restricted to PDF/JPG/PNG, with a
  client-side, UX-only 5 MB/type pre-check) plus a bare recent-uploads list and "View
  full history" link once reports exist — replacing its "Coming later in Phase 2A"
  placeholder, the last dashboard card to do so. The explicitly planned evolution of
  the PA-2 shell, not a restructuring — the session-guard logic itself is untouched.
- `validation/phase-2a-foundation/harness.js` / `conformance.js` — extended with
  `FoundationReports.gs`, a new `DriveApp` mock (including `setSharing()`/
  `getSharingAccess()`/`getSharingPermission()` and `setTrashed()`/`isTrashed()`),
  `Utilities.base64Decode`/`base64Encode`, a disclosed best-effort
  `Utilities.newBlob()` content-type detection mock, and a new Stage 9 (45 new checks,
  including the content-based MIME-spoofing rejection proof, the Drive-sharing-privacy
  assertion, the partial-write rollback proof, and cross-patient isolation on
  download).
- `validation/pa-2-dashboard/browser-test.js` — updated to reflect the Reports card's
  real behavior (mock now also routes `get_reports`; `phase2aCount` drops from 1 to
  0; `nodataCount` rises from 2 to 3; net +2 checks).
- `validation/static-analysis/analyze.js` — `createFoundationReportForExistingDriveFile`
  added to the documented manually-run-wrapper allowlist, the same treatment
  `createFoundationConsultationEntry`/`createFoundationPatient` already have.

## 2026-07-03 — Patient Access Batch PA-4 (Symptom Tracker — quick-log form, history)

Fourth Patient Access batch (docs/29 §13 Batch 5E), preceded by
docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md, approved before any code was written —
the platform's first patient-*writable* feature. **No unauthorized modification to
any frozen file** — every touch to an already-shipped file is named below, none of
them silent.

### Added
- `shared/constants/condition-slugs.json` + `.md` — the canonical condition-slug list,
  closing Batch F3's own named deferral (`shared/README.md`,
  `shared/schemas/patient-identity.md`) now that `SymptomLogs.condition_slug` is a
  real second consumer.
- `shared/schemas/symptom-log.schema.json` + `.md` — the `SymptomLogs` contract: all
  four scale fields mandatory (docs/41 §10 Q1), `logged_at` always server-set, never
  patient-editable (docs/41 §10 Q2).
- `apps-script/FoundationSymptomLog.gs` — patient-facing create
  (`foundationCreateSymptomLog_()`, all-four-mandatory validation, `condition_slug`
  validated against the new canonical list) and patient-facing sorted/capped list
  (`foundationGetPatientSymptomLogs_()`). No `get_by_id` — docs/41 §12 found no
  product requirement for one.
- `my-health-journey/symptoms/index.html` + `symptoms.js` — the Symptom History page:
  a real ordered list of the patient's own entries, escaped notes, the optional
  condition tag, the "No data yet" Empty State, a network-failure fallback.
- `validation/pa-4-symptom-tracker/browser-test.js` + `README.md` — a new, committed
  Playwright suite (28/28 passing).

### Changed
- `apps-script/FoundationRouter.gs` — gained two new dispatch cases, `log_symptom`
  and `get_symptom_logs`, and their thin wiring functions — the same disclosed,
  additive exception PA-3's own two new cases already established.
- `my-health-journey/dashboard.js` — the Symptom Tracker card now shows a real,
  always-present quick-log form (four mandatory 1-10 number inputs, an optional notes
  field, an optional condition-tag select) plus a bare most-recent-value summary and
  "View full history" link once entries exist — replacing its "Coming later in Phase
  2A" placeholder. The explicitly planned evolution of the PA-2 shell, not a
  restructuring — the session-guard logic itself is untouched.
- `assets/site.css` — two new, purely additive rules, `.field textarea` and
  `.field select`, styled identically to the existing `.field input` — this phase's
  first form needing either element.
- `validation/phase-2a-foundation/harness.js` / `conformance.js` — extended with
  `FoundationSymptomLog.gs` and a new Stage 8 (22 new checks).
- `validation/phase-2a-foundation/schema-validator.js` — gained `integer` type support
  and `minimum`/`maximum` numeric bounds, a small additive extension per this tool's
  own stated policy — `symptom-log.schema.json`'s four scale fields are the first
  real schema to need either construct.
- `validation/pa-2-dashboard/browser-test.js` — updated to reflect the Symptom
  Tracker card's real behavior (mock now also routes `get_symptom_logs`;
  `phase2aCount` drops from 2 to 1; `nodataCount` rises from 1 to 2; two new checks).

### Notes
- **No new authorization shape needed, confirmed rather than assumed.** Unlike PA-3's
  `get_timeline_entry` (which needed a record-ownership check for a client-supplied
  `record_id`), `log_symptom`/`get_symptom_logs` act only on the caller's own
  session-derived `patient_id` — the same primitive `get_profile`/`get_timeline`
  already use, now proven on a write. Verified: Stage 8's cross-patient isolation
  checks on both create and list, at the real HTTP-dispatch layer.
- **A deliberate simplification, stated openly**: no per-entry detail fetch exists —
  docs/41 §12 found no product requirement for one, since a Symptom Log row has no
  long-form text that benefits from its own page.
- **A disclosed testing-environment note**: all three browser-test suites
  (`pa-2-dashboard`, `pa-3-timeline`, `pa-4-symptom-tracker`) were executed in this
  session via a temporary, session-local Playwright install pointed at this
  environment's pre-installed Chromium — not via the committed invocation as written,
  since no `package.json`/`node_modules/playwright` exists in this repository
  (docs/41 Finding 5, carried forward, not newly introduced).
- Verified: `node validation/static-analysis/analyze.js` (0 findings, 31 files
  scanned); `node validation/phase-2a-foundation/conformance.js` (**107/107**, 26 new
  — 4 in Stage 0, 22 in Stage 8); `node validation/phase-1-5/validate.js` (42/42,
  unchanged); `validation/pa-2-dashboard/browser-test.js` (**30/30**, updated);
  `validation/pa-3-timeline/browser-test.js` (**29/29**, re-run unchanged, zero
  regression); `validation/pa-4-symptom-tracker/browser-test.js` (**28/28**, new).
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16 gained a new Batch PA-4 entry (naming every
  disclosed frozen-file exception in full, including the schema-validator extension);
  `docs/04-COMPONENT-LIBRARY.md` gained concrete Symptom Quick-Log Form/Symptom
  History entries; `docs/24-ROADMAP.md` updated to reflect PA-4 shipped and name PA-5
  (Reports, Batch 5F) next; `docs/33-DOMAIN-MODEL.md`'s Symptom Log entity updated
  from *Planned* to *Implemented*, and (per docs/41's own recommendation to batch
  these) its three long-stale `Patient`/`Patient Identity`/`Session` *Planned* labels
  and the `Timeline Event` Summary Table row (already *Implemented* in its own section
  header, but not its table row) were also corrected in the same pass;
  `docs/15-SECURITY-STANDARDS.md` gained a Batch PA-4 section documenting the
  platform's first patient-writable route; `apps-script/README.md` gained a Batch PA-4
  module table entry; docs/29 §9's stale "Phase 2C" reference to Digital Twin (found
  by docs/41, every other mention agreeing on Phase 2D) was corrected to Phase 2D.

## 2026-07-03 — Patient Access Batch PA-3 (Consultation History, Timeline, Consultation History detail)

Third Patient Access batch (docs/29 §13 Batch 5D), preceded by
docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md and an architectural clarification,
docs/40-CONSULTATION-IDENTITY-STRATEGY.md, both approved before any code was written.
**No unauthorized modification to any frozen file** — every touch to an
already-shipped file is named below, none of them silent.

### Added
- `shared/schemas/consultation-history.schema.json` + `.md` — the `ConsultationHistory`
  contract, including `entry_type` (closing a real gap between docs/29 §4 and docs/33
  §3.1 found during the PA-3 readiness review) and the `record_id`-as-identity
  strategy (docs/40).
- `apps-script/FoundationConsultationHistory.gs` — staff-facing entry creation
  (`foundationCreateConsultationEntry_()`, a manually-run editor wrapper — a real
  staff Web App tool is a deliberate, stated simplification, not silently dropped),
  patient-facing sorted/capped Timeline (`foundationGetPatientTimeline_()`), and
  patient-facing single-entry lookup with a new record-ownership authorization check
  (`foundationGetConsultationEntryById_()`).
- `my-health-journey/timeline/index.html` + `timeline.js` — the Timeline list page:
  real ordered entries, the "No data yet" Empty State for a zero-entry patient, a
  network-failure fallback.
- `my-health-journey/timeline/entry.html` + `entry.js` — the read-only Consultation
  History detail view: full untruncated text, a "back to Timeline" link, the backend's
  own rejection message shown verbatim (identical whether a `record_id` is unknown or
  belongs to a different patient).
- `my-health-journey/session-guard.js` — a new shared session-guard module, consumed
  by the two new Timeline pages only (docs/39 §7's recommendation, acted on now that a
  second and third authenticated page exist).
- `validation/pa-3-timeline/browser-test.js` + `README.md` — a new, committed
  Playwright suite (29/29 passing).

### Changed
- `apps-script/FoundationRouter.gs` — gained two new dispatch cases, `get_timeline`
  and `get_timeline_entry`, and their thin wiring functions. A disclosed, additive
  exception to "frozen except bug fixes," same category as `Code.gs`'s own one-line
  dispatch shim in IA-2: a new case in an already-designed extension point, zero
  existing lines touched, zero existing behavior changed.
- `my-health-journey/dashboard.js` — the Timeline card now loads real data via its
  own, independent `get_timeline` call, replacing its "Coming later in Phase 2A"
  placeholder with real entries or the "No data yet" Empty State. The explicitly
  planned evolution of the PA-2 shell (docs/38 §9), not a restructuring — the
  session-guard logic itself is untouched.
- `validation/phase-2a-foundation/harness.js` / `conformance.js` — extended with
  `FoundationConsultationHistory.gs` and a new Stage 7 (27 new checks).
- `validation/static-analysis/analyze.js` — `createFoundationConsultationEntry` added
  to the manually-run-wrapper allowlist, matching `createFoundationPatient`/
  `createFoundationLoginToken`'s precedent.
- `validation/pa-2-dashboard/browser-test.js` — updated to reflect the Timeline card's
  real behavior (mock now routes by `foundation_action`; badge-count assertions
  updated; a new check confirms a real, live "No data yet" render).

### Notes
- **Consultation identity strategy (docs/40), applied concretely**: `record_id` is the
  sole key for Timeline linking and detail-view fetches — never `entry_date`, never
  row/list position. Timeline *display* order (`entry_date` descending, `created_at`
  as an explicit tiebreaker) is a separate concern from entry *identity*.
- **A deliberate simplification, stated openly**: no staff-facing Web App tool for
  creating Consultation History entries exists yet — Foundation has no staff-RBAC
  primitive of its own, and building one would mean a second `Code.gs` exception or
  new architecture beyond this batch's approved plan. Future work, not silently
  dropped.
- Verified: `node validation/static-analysis/analyze.js` (0 findings — one real
  false-positive on a function passed by reference to `Array.prototype.sort`,
  resolved with an explicit named call, not a tool change);
  `node validation/phase-2a-foundation/conformance.js` (**81/81**, 27 new in Stage 7,
  including the cross-patient-authorization rejection at the real HTTP-dispatch
  layer); `node validation/phase-1-5/validate.js` (42/42, unchanged);
  `validation/pa-2-dashboard/browser-test.js` (**28/28**, updated for the Timeline
  card's real behavior); `validation/pa-3-timeline/browser-test.js` (**29/29**, new).
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16 gained a new Batch PA-3 entry (naming both
  disclosed frozen-file exceptions in full); `docs/04-COMPONENT-LIBRARY.md` gained
  concrete Timeline List/Consultation History Detail/Shared Session Guard entries;
  `docs/24-ROADMAP.md` updated to reflect PA-3 shipped and name PA-4 (Symptom Tracker,
  Batch 5E) next; `docs/33-DOMAIN-MODEL.md`'s Timeline Event entity updated from
  *Planned* to *Implemented*; `docs/15-SECURITY-STANDARDS.md` gained a Batch PA-3
  section documenting the new record-ownership authorization pattern;
  `apps-script/README.md` gained a Batch PA-3 module table entry.

## 2026-07-03 — Patient Access Dashboard Shell Closeout + Consultation Timeline Readiness Review (docs only)

Documentation-only batch. No frontend page, `apps-script/*.gs` file, `shared/`
contract, or architecture document was modified — confirmed via `git diff`.

- Added `docs/38-PATIENT-ACCESS-DASHBOARD-SHELL-CLOSEOUT.md`: the official closeout of
  Patient Access Batches PA-1–PA-2 (login/verify, `assets/site.css`, the
  `/my-health-journey/` dashboard shell) — scope delivered, architecture summary, the
  session-guard and three-Empty-State model as actually built, validation/regression/
  static-analysis results re-verified fresh against the current merged state, deferred
  work, lessons learned, and Batch PA-3 entry criteria.
- **Patient Access Batches PA-1–PA-2 are now frozen except for bug fixes** — see
  docs/38 §9. `login.html`, `verify.html`, `assets/site.css`, and
  `my-health-journey/` join Identity & Access's frozen backend as stable, tested
  surface.
- Added `docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md`: the pre-implementation
  review for Batch PA-3 (docs/29 §13 Batch 5D), covering consultation information
  architecture, the Timeline entry model (including a real `entry_type` schema gap
  found between docs/29 §4 and docs/33 §3.1, and a recommendation to close it),
  ordering, empty-state behavior, card layout, detail-view requirements, component
  reuse (including a now-ripe session-guard extraction), relationship to Symptom
  Tracker/Reports, required backend contracts (named, not designed), accessibility,
  a recommended implementation sequence, and a scoped Repository Consistency Review.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16 gained a freeze notice; `docs/24-ROADMAP.md`
  updated to reflect the freeze and point at both new documents.
- Re-ran clean and unchanged: `node validation/static-analysis/analyze.js` (0
  findings), `node validation/phase-2a-foundation/conformance.js` (61/61),
  `node validation/phase-1-5/validate.js` (42/42), and
  `validation/pa-2-dashboard/browser-test.js` (26/26).

**Patient Access Batch PA-3 is the next milestone**, not yet started — approval
required before it begins (docs/39).

## 2026-07-03 — Patient Access Batch PA-2 (assets/site.css, My Health Journey dashboard shell)

Second Patient Access batch (docs/29 §13 Batch 5C), preceded by a dedicated
pre-implementation review (docs/37-DASHBOARD-SHELL-READINESS-REVIEW.md, approved before
any code was written). **Zero backend modification** — confirmed via
`git diff --name-only`: no `apps-script/` or `shared/` file changed.

### Added
- `assets/site.css` — the shared design-token and component set extracted out of
  `login.html`/`verify.html`'s identical duplicated `<style>` blocks (docs/20 §5's
  long-flagged item, finally closed). One small addition beyond a pure extraction:
  `.status.warn`, for the new session-expiry notice below.
- `my-health-journey/index.html` + `my-health-journey/dashboard.js` — the "My Health
  Journey" dashboard shell. Authenticated header (Wise logo, "My Health Journey",
  real patient greeting from `get_profile`, Sign out) plus a responsive six-card grid
  (Timeline, Symptom Tracker, Reports, Care Plan, Messages, Digital Twin), every card
  rendering one of three distinct Empty State types: **No data yet**, **Coming later
  in Phase 2A**, **Planned for a future version**.
- A session guard: verifies the stored session via `get_profile` before rendering
  anything; redirects an absent token straight to `/login.html`, and a
  present-but-rejected token to `/login.html?reason=expired` with the token cleared.

### Changed
- `login.html` — now links `assets/site.css` instead of duplicating its tokens; shows
  "For your privacy, your secure session has ended. Please sign in again." when
  redirected here with `?reason=expired`.
- `verify.html` — now links `assets/site.css`; its success state links to the now-real
  `/my-health-journey/` instead of "coming soon."

### Notes
- **Component Reuse Review performed before writing any new markup**: every shared
  pattern already established by `login.html`/`verify.html` moved into
  `assets/site.css` rather than being copied a third time. `index.html`'s `.skip`
  skip-link was ported in too — the dashboard is the first Phase 2A page complex
  enough to need one. `index.html` and `internal/consultation-summary.html`
  deliberately untouched — out of scope, each keeps its own stylesheet.
- **Three Empty State types**, not one generic message, so a patient isn't given the
  same expectation for every unfinished feature — "coming later in Phase 2A" for
  Timeline/Symptom Tracker/Reports (each has a named future batch, 5D/5E/5F) versus
  "planned for a future version" for Care Plan/Messages/Digital Twin (no architecture
  exists yet for any of them). The third type, "No data yet," has no live card
  consumer in this batch and is verified directly via a small test-support export
  rather than left unverified.
- Verified with a new, committed Playwright harness
  (`validation/pa-2-dashboard/browser-test.js` — the first Phase 2A frontend suite
  committed rather than run ad hoc): **26/26 checks passed**, covering the session
  guard's three paths (no token / valid / rejected), sign-out, a network-failure
  fallback that preserves the token, 375px responsive layout on all three touched
  pages, and real keyboard-driven focus-visibility and heading-hierarchy checks.
- `node validation/static-analysis/analyze.js`, `node validation/phase-2a-foundation/conformance.js`,
  and `node validation/phase-1-5/validate.js` all re-run clean and unchanged (0
  findings, 61/61, 42/42) — expected, since no backend file was touched.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` gained a new Batch PA-2 entry under §16;
  `docs/04-COMPONENT-LIBRARY.md` gained concrete Authenticated Header/Dashboard Card
  Grid/Empty State/Session-Expiry Notice component entries; `docs/24-ROADMAP.md`
  updated to reflect PA-2 shipped and name PA-3 (docs/29 §13 Batch 5D) as next.

## 2026-07-03 — Patient Access Batch PA-1 (login.html, verify.html)

First Patient Access batch — the deferred frontend half of docs/29 §13's original
Batch 5B, built against the now-frozen Identity & Access backend (IA-1, IA-2).
**Zero backend modification** — confirmed via `git diff --name-only` (only
`login.html`, `verify.html`, and documentation changed).

### Added
- `login.html` — email-entry form calling `request_login_link`. Single field, one
  primary CTA, friendly loading/error states, the backend's own anti-enumeration-safe
  message displayed verbatim.
- `verify.html` — reads `?token=` from the URL, requires an explicit "Continue to
  sign in" click before calling `consume_login_link` (does **not** auto-submit on
  page load — a deliberate defense against email-security link-scanners pre-fetching
  and burning the single-use token before the patient clicks it). On success, stores
  only `session_token` in `sessionStorage`; `patient_id` is never stored client-side
  under any key.

### Notes
- **Reused, not duplicated**: the `:root` design tokens, `.card`/`.field`/`.submit`/`.status`
  component set, and the `fetch()`-with-`text/plain`-no-CORS-preflight calling
  convention, all from `internal/consultation-summary.html` — the only existing page
  that already talks to the Apps Script backend. Both pages use the same minimal
  "utility page" shell (no full header/nav) that `thanks.html`/`booking-received.html`/
  `internal/consultation-summary.html` already independently established for
  single-purpose, not-yet-nav-linked pages.
- **A real accessibility defect was caught by keyboard-driven browser testing, not
  assumed away**: `.field input:focus{outline:none}`, copied from
  `internal/consultation-summary.html`, silently defeated the `:focus-visible` rule by
  CSS specificity — a WCAG 2.2 AA violation. Fixed in `login.html` before shipping
  (`internal/consultation-summary.html` itself untouched — out of this batch's scope).
- Verified with a local static server + headless Chromium (Playwright), backend mocked
  at the network layer: **20/20 checks passed** — response-envelope branching (never
  an HTTP status code), the no-auto-fire security property, `sessionStorage` contents
  (both what's stored and what's deliberately never stored), 375px responsive layout,
  and keyboard focus visibility.
- `node validation/static-analysis/analyze.js`, `node validation/phase-2a-foundation/conformance.js`,
  and `node validation/phase-1-5/validate.js` all re-run clean and unchanged (0
  findings, 61/61, 42/42) — expected, since no backend file was touched.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` gained a new §16 (Patient Access
  Implementation, Batch PA-1 notes) and a §13 table annotation marking Batch 5B fully
  delivered; `docs/04-COMPONENT-LIBRARY.md` gained concrete Login Form / Sign-In-Verify
  entries (docs/29 §12's own tracked doc-impact item); `docs/24-ROADMAP.md` updated.
- Full build summary: this batch's pull request description.

## 2026-07-03 — Identity & Access Closeout (docs only)

Documentation-only batch. Added `docs/36-IDENTITY-AND-ACCESS-CLOSEOUT.md`: the
official closeout of the Identity & Access backend (batches IA-1, IA-2) — objectives,
delivered scope, architecture and authentication-flow summary, security model, shared
contracts, validation/regression/static-analysis results (each re-verified fresh
against the final merged state, not transcribed from prior PR descriptions), deferred
work, lessons learned, and Patient Access entry criteria. No `apps-script/*.gs` file,
`shared/` contract, or architecture document was modified — confirmed via `git diff`.
`docs/24-ROADMAP.md` updated to point at it.

**Identity & Access backend is now frozen except for bug fixes** — see docs/36 §12.
The five files IA-1/IA-2 delivered (`FoundationLoginTokens.gs`,
`FoundationRateLimit.gs`, `FoundationEmail.gs`, `FoundationLoginFlow.gs`,
`FoundationRouter.gs`) plus `Code.gs`'s one-line dispatch shim join Foundation's ten
frozen files as stable, tested infrastructure. Future capability is delivered by
adding new files, never by reopening these six.

**Patient Access is the next milestone**, not yet started — recommended first batch
(docs/36 §12): `login.html`/`verify.html`, the deferred frontend half of docs/29 §13's
original Batch 5B, before Batch 5C's dashboard shell.

## 2026-07-03 — Identity & Access Batch IA-2 (login flow, rate limiting, first authenticated route)

Second of two independent Identity & Access batches this milestone was split into
(docs/29 §15) — consumes IA-1's `LoginTokens` infrastructure into an actual, working
magic-link login. Scope: the request-link endpoint, the consume-link endpoint,
Foundation's first authenticated Web App route, rate limiting, and account-enumeration
protection.

### Added
- `apps-script/FoundationRateLimit.gs` — `foundationCheckAndIncrementRateLimit_()`,
  basic per-email rate limiting (3 requests / 15 minutes), `CacheService`-backed, fails
  open on a `CacheService` error (a documented ADR-010 exception). **Per-IP limiting is
  not implemented** — Apps Script's `doPost(e)` never exposes a caller's IP address, a
  real platform constraint stated openly, not silently dropped.
- `apps-script/FoundationEmail.gs` — `foundationSendLoginLinkEmail_()`, Foundation's own
  `MailApp` sender for the login-link email, independent of Phase 1.5's `Email.gs` (same
  domain-separation precedent as `FoundationDataStore.gs` vs. `Sheets.gs`). The
  link's frontend destination (`verify.html`) does not exist yet — a stated placeholder,
  not an assumed page (`login.html`/`verify.html` remain future work, out of this
  batch's backend-only scope).
- `apps-script/FoundationLoginFlow.gs` — `foundationHandleRequestLoginLink_()` /
  `foundationHandleConsumeLoginLink_()`, the orchestration IA-1 deliberately left
  undone. Request-link: looks up a patient by email (`foundationFindPatientByEmail_()`,
  a new consumer of `FoundationDataStore.gs`'s existing `foundationDsQuery_()`),
  rate-limits, issues a token, emails it — returning the identical generic response
  regardless of match (docs/29 §3, anti-enumeration). Consume-link: consumes the token
  and issues a real session via `foundationIssueSessionToken_()`.
- `apps-script/FoundationRouter.gs` — `handleFoundationRequest_()`, the HTTP-level
  dispatcher, routing `request_login_link`/`consume_login_link`/`get_profile`.
  `get_profile` is Foundation's **first authenticated Web App route** — derives
  `patient_id` only from a verified session (`withFoundationAuth_()`, never
  client-supplied) and returns the caller's own Patient record
  (`foundationGetPatientById_()`).
- `validation/phase-2a-foundation/conformance.js` Stage 6 (23 new checks) +
  `harness.js` (four new files loaded, `CacheService`/`MailApp` mocked).
  **61/61 total conformance checks passed.**
- `validation/phase-1-5/validate.js` Stage 9 (3 new checks) + `harness.js`
  (`handleFoundationRequest_` made injectable) — proves `Code.gs`'s new dispatch shim is
  purely additive. **42/42 total Phase 1.5 checks passed, zero regression.**

### Changed
- `apps-script/Code.gs` — **the one, deliberately narrow exception to "never modifying
  Phase 1.5's existing files."** Google Apps Script permits exactly one `doPost()` per
  project; docs/29 §14 Decision 1 locked one shared project for all Phase 2A backend
  work. These two facts leave no way to add a real, callable Foundation Web App route
  without touching `Code.gs` — surfaced explicitly as a real architectural conflict
  before any code was written, and a resolution was requested rather than guessed. The
  approved fix: `doPost()` now checks for a `foundation_action` field (absent from every
  field Phase 1.5's own payload uses — no collision) immediately after its JSON parse,
  and delegates the entire request to `FoundationRouter.gs` if present; every line below
  is otherwise byte-for-byte unchanged. Full reasoning: `apps-script/README.md`'s
  "Foundation/Phase 1.5 dispatch boundary."

### Notes
- Static analysis: **0 findings** — the cleanest result of any batch so far. All six of
  Foundation's previously-Deferred findings (`escapeFoundationHtml_`,
  `foundationDsQuery_`, `foundationGetPatientById_`, `foundationIssueSessionToken_`,
  `withFoundationAuth_`, `foundationConsumeLoginToken_`) now have real consumers; this
  batch introduced no new unused helper of its own.
- No new `shared/*.schema.json` contract — IA-2's wire shapes are ad hoc action
  responses, not new persisted entities.
- **IA-2 Dependency Map** (docs/29 §15): four new files depend only on already-frozen
  Foundation infrastructure and IA-1's `FoundationLoginTokens.gs`. One new edge —
  `Code.gs` → `FoundationRouter.gs` — the first ever between Phase 1.5 and the
  Foundation/Identity-&-Access family in either direction; one-directional, non-cyclic,
  confirmed by `validation/static-analysis/analyze.js`'s project-wide scan. Zero new
  edges into any of the ten frozen Foundation-family files.
- `docs/15-SECURITY-STANDARDS.md` gained a real "Phase 2A — Implementation Notes
  (Identity & Access)" section (previously a forward-reference only);
  `docs/24-ROADMAP.md` updated. `docs/12-DATA-ARCHITECTURE.md`'s Phase 2A section
  remains a pre-existing, separately-tracked gap (docs/32) — not touched by this batch,
  stated rather than silently left inconsistent.
- Full build summary: this batch's pull request description.

## 2026-07-03 — Identity & Access Batch IA-1 (LoginToken infrastructure)

First of two independent Identity & Access batches this milestone was explicitly split
into (docs/29 §15). Infrastructure only — no route, no UI, no session issuance.
**Zero modification to any of the ten frozen Foundation-family files**; reuses
`FoundationDataStore.gs`/`FoundationAudit.gs` exactly as-is.

### Added
- `shared/schemas/login-token.schema.json` (v1.0.0) + `.md` — the `LoginTokens`
  contract (`token_hash`, `patient_id`, `issued_at`, `expires_at`, `used_at`), the
  first Foundation-family schema with a legitimately-empty-until-consumed field.
  Committed in its own commit, ahead of the implementation.
- `apps-script/FoundationLoginTokens.gs` — `foundationCreateLoginToken_()` (256-bit
  token generation via three concatenated UUIDs, SHA-256 hashing, never stores the
  raw token) / `foundationConsumeLoginToken_()` (expiration + single-use enforcement,
  resolves only a `patient_id`, deliberately never issues a session).
  `createFoundationLoginToken()` manually-run editor wrapper, mirroring
  `PatientIdentity.gs`'s F3 precedent.
- `validation/phase-2a-foundation/conformance.js` Stage 5 (12 new checks) +
  `harness.js` (`FoundationLoginTokens.gs` loaded, `Utilities.computeDigest` mocked
  via Node's real `crypto`). **38/38 total conformance checks passed.**

### Notes
- Static analysis: `foundationDsUpdateById_` (Deferred since F3) now has a real
  consumer and drops off the findings list; `foundationConsumeLoginToken_` is new
  (Deferred — IA-2 supplies its consumer). Net unchanged at 6 total findings, all
  Deferred, 0 Error/Warning. A missing `MANUAL_DROPDOWN_WRAPPERS` tooling entry for
  `createFoundationLoginToken` was caught by the tool itself and fixed immediately.
- `validation/phase-1-5/validate.js` re-run clean (39/39) — zero regression.
- **IA-1 Dependency Map** (docs/29 §15): `FoundationLoginTokens.gs` depends on five
  already-frozen infrastructure files only; zero new edges into any frozen file;
  confirmed zero dependency on `FoundationSession.gs` (no session issuance); zero
  circular dependencies; zero edges to/from Phase 1.5.
- Full build summary: this batch's pull request description.

## 2026-07-03 — Foundation Closeout (docs only)

Documentation-only batch. Added `docs/35-FOUNDATION-CLOSEOUT.md`: the official closeout
of Phase 2A's Foundation Implementation Plan (F1–F5) — scope, delivered modules,
delivered `shared/` contracts, validation/regression/static-analysis/dependency
summaries (each re-verified against the final merged state, not transcribed from prior
batches' PR descriptions), what's intentionally excluded, a Foundation freeze
statement, and entry criteria for the next implementation phase. No `apps-script/*.gs`
file, `shared/` contract, or architecture document was modified — confirmed via
`git diff`. `docs/24-ROADMAP.md` updated to point at it.

**Foundation (F1–F5) is now frozen except for bug fixes** — see docs/35 §9. Future
capability is delivered by adding new files / new schema versions, never by reopening
the ten Foundation-family files this closeout documents.

## 2026-07-03 — Phase 2A implementation: Foundation Batch F5 (conformance testing)

Fifth and final implementation batch of the approved Foundation Implementation Plan
(F1–F5, docs/29 §14). Delivers the one deliverable F2's own implementation notes named
ahead of time: "Automated, schema-validator-based conformance testing
(`validation/phase-2a-foundation/conformance.js`) remains an F5 deliverable, not built
early." Node-only test tooling — zero `apps-script/*.gs` files touched.

### Added
- `validation/phase-2a-foundation/schema-validator.js` — a generic, dependency-free
  JSON Schema (Draft 2020-12 subset) validator: `type`, `required`, `properties`,
  `additionalProperties`, `enum`, `const`, `format` (`email`, `date-time`),
  `minLength`, `oneOf`.
- `validation/phase-2a-foundation/harness.js` — mocked Apps Script runtime
  (`SpreadsheetApp`, `PropertiesService`, `Utilities`, `Logger`) loading the real
  Foundation-family `.gs` source, mirroring `validation/phase-1-5/harness.js`.
- `validation/phase-2a-foundation/conformance.js` — Stage 0 proves the validator
  itself against deliberately-broken fixtures; Stages 1–4 check real
  `FoundationContracts.gs`/`PatientIdentity.gs`/`FoundationSession.gs`/
  `FoundationRouteGuard.gs` output against the real `shared/*.schema.json` files.
  23/23 checks passed.
- `validation/phase-2a-foundation/README.md`.

### Notes
- **Foundation Dependency Map** (architectural review artifact, docs/29 §14's F5
  section has the full breakdown): module dependencies verified from the real call
  graph plus a hand-checked `FOUNDATION_CONFIG` variable-read edge the automated scan
  can't detect; zero new intra-`apps-script/` dependencies introduced (F5 adds no
  `.gs` file); **zero circular dependencies**, verified two ways; dependency direction
  strictly layered, one-way, no back-references. Review artifact only — no module was
  restructured to make the map cleaner.
- Static analysis: unchanged from F4 — 6 total findings, all previously triaged as
  Deferred, none new (this batch adds no `apps-script/*.gs` code).
- `validation/phase-1-5/validate.js` re-run clean (39/39) — zero regression.
- A test-assertion bug in this batch's own `conformance.js` (an `AuditLog` row-count
  check that didn't account for shared state across test stages) was caught and fixed
  before shipping, not after — see docs/29 §14 for detail.
- Full build summary (modules, tests, static analysis, deferred findings, validation,
  regression, documentation, CHANGELOG, dependency map): this batch's pull request
  description.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F4 (session + route protection)

Fourth implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Delivers exactly the scope two forward references already committed in F3:
`apps-script/README.md`'s module table and `FoundationConfig.gs`'s comment both named
`FoundationSession.gs`/`FoundationRouteGuard.gs` and PropertiesService consumption as
landing in F4.

### Added
- `shared/schemas/session.schema.json` (v1.0.0) + `.md` — the canonical Session
  payload (`patient_id`, `issued_at`, `expires_at`) and wire-format contract (docs/33
  §1.3). Committed ahead of its implementation, in its own commit, per
  `shared/README.md`'s rule — F3 was the last batch eligible for the create-together
  bootstrap exception.
- `apps-script/FoundationSession.gs` — `foundationIssueSessionToken_()` /
  `foundationVerifySessionToken_()`, HMAC-SHA256-signed session tokens (ADR-002,
  ADR-003, ADR-010). Pure payload/expiry/shape logic and a constant-time signature
  comparison are split from the real, `PropertiesService`-reading entry points via a
  `WithSecret_` core, so the full issue-verify round trip is testable offline.
- `apps-script/FoundationRouteGuard.gs` — `withFoundationAuth_()`, gating a handler
  behind a verified session and deriving `patient_id` only from the token, never
  client input. Logs a `session_rejected` audit event on every rejection.
- `apps-script/FoundationTests.gs` extended — pure-logic coverage for both new files
  plus a full offline issue-then-verify round trip against an explicit test secret.
- `FoundationConfig.gs`'s `SESSION_TTL_SECONDS` (3600 — 60 minutes, the low end of
  docs/29 §3's 60–90 minute range, per ADR-010's security-over-convenience default).

### Not in scope (deferred, tracked in docs/29 §13/§14)
- `LoginTokens` (the sheet, and the magic-link request/consume flow that resolves an
  email to a `patient_id` in the first place) — F3's forward references named only
  Session and route protection, not this.
- Any Web App route wiring `withFoundationAuth_()` to a real, callable endpoint.

### Notes
- Static analysis: 2 new findings (`foundationIssueSessionToken_`,
  `withFoundationAuth_` — both real entry points with no consumer yet, exactly the
  "infrastructure built ahead of its consumer" pattern F3 already established, not a
  bug). Combined with F2/F3's 4 already-accepted findings, 6 total, all Deferred.
- `validation/phase-1-5/validate.js` re-run clean (39/39) — zero regression.
- A cryptographic primitive (HMAC-SHA256) is deliberately never hand-rolled into a
  portable reference file — `shared/schemas/session.md` states why; the schema
  defines the payload/wire-format contract only, and each runtime's own native HMAC
  implementation computes the signature.
- Full build summary (modules, tests, static analysis, deferred findings, validation,
  regression, documentation, CHANGELOG): this batch's pull request description.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F3 (data layer + Patient Identity)

Third implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Per the plan's second (and final) named bootstrap exception, this batch creates
the Patient Identity schema and its first implementation together. Also introduces a
new standing step, by explicit requirement: a static-analysis pass runs before
validation on every Foundation batch from this one onward.

### Added
- `validation/static-analysis/analyze.js` + `README.md` — checks duplicate global
  names, duplicate constants, duplicate function names, unused exported helpers,
  circular dependencies, and Apps Script namespace collisions across every
  `apps-script/*.gs` file. No dependencies beyond Node's standard library.
- `shared/schemas/patient-identity.schema.json` (v1.0.0) + `.md` — the canonical
  Patient record shape, explicitly documenting which fields belong to the permanent
  identity core (docs/33 §1.2) vs. the mutable profile (docs/33 §1.1), even though
  both are stored in one row per docs/29 §4's already-locked schema.
- `apps-script/FoundationDataStore.gs` — the data-access abstraction (insert/getById/
  updateById/query + pure row/object conversion helpers), the only Foundation file
  calling `SpreadsheetApp` for Patient-domain data.
- `apps-script/FoundationAudit.gs` — `foundationLogAuditEvent_()`, an append-only
  cross-cutting event log.
- `apps-script/PatientIdentity.gs` — `foundationCreatePatient_()` /
  `foundationGetPatientById_()`, plus `createFoundationPatient()`, a manually-run
  editor wrapper (no Web App route, no Sheet menu yet — this batch's explicit,
  minimal scope).
- `apps-script/FoundationTests.gs` (partial) — 14 Apps Script-native unit tests
  covering every pure function introduced in F2 and F3.

### Changed
- `apps-script/README.md`: append-only — four new module-table rows, a new
  "Foundation's own trailing-underscore wrappers" table, and a new "Static analysis"
  section. No existing content was altered.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md`: §14 extended with the static-analysis tool's
  introduction (including two real false positives it caught in the *existing*
  codebase and fixed in the tool, not the code under test) and Batch F3's
  implementation notes, including the Patient/Patient Identity reconciliation
  reasoning and a documented, deliberate validation simplification.
- `docs/24-ROADMAP.md`: Phase 2A status line updated to include F3.

### Static analysis findings (all triaged, none silently ignored)
Run before writing any F3 code, against the real F1+F2 baseline, this tool caught two
real issues in the *existing* Phase 1.5 codebase that manual review had missed — both
were false positives from the tool's own regex-based heuristics, fixed in the tool,
not in the correct existing code:
- A false circular dependency (`Email.gs -> Send.gs -> Email.gs`), traced to a comment
  in `Email.gs` containing the literal text `attemptSend_(`.
- Three false "unused" reports for `Review.gs`'s menu-bound functions — Apps Script's
  `menu.addItem('label', 'fnName')` references a function by quoted string, which the
  tool didn't originally treat as usage.

After both fixes, the F1+F2 baseline reported 4 genuine, expected findings (Foundation
infrastructure built ahead of its first consumer). After F3, there are still 4 —
different functions, same kind of finding: `escapeFoundationHtml_` (built as one of
`core.reference.js`'s three canonical utilities; no HTML-rendering need yet),
`foundationDsQuery_` and `foundationDsUpdateById_` (two of `FoundationDataStore.gs`'s
declared four-function interface; F3's minimal create/read scope doesn't need them
yet), and `foundationGetPatientById_` (the "read" half of this batch's own
"create/read" scope, awaiting a future caller — F4's session work or a later
dashboard batch). Every one matches an interface this plan already committed to.
Reviewed and accepted, not fixed by inventing artificial call-sites.

### Verification
- Static analysis: 2 tool bugs found and fixed against the real codebase; final F3
  findings triaged as above.
- `node --check` passed on every new `.gs` file.
- `runFoundationTests_()` — all 14 tests — executed directly in Node (every tested
  function is pure); all passed.
- A full functional pass against a minimal in-memory `SpreadsheetApp` mock: create →
  read-back round-trip (output checked against the JSON Schema's required fields),
  not-found and invalid-input cases correctly returning their specific error codes
  (not the generic one), the audit log gaining exactly one correctly-shaped row per
  patient created, cross-patient isolation confirmed (creating a second patient leaves
  the first untouched), and the header-drift safety check correctly throwing on a
  tampered sheet header.
- A full collision pre-check of every planned F3 name against the existing codebase,
  before writing any code — zero collisions.
- `cd validation/phase-1-5 && node validate.js`: **39/39 checks still passing** — zero
  regression to Phase 1.5.
- `git diff` confirmed zero modifications to any pre-existing `apps-script/*.gs` file.

### Notes
- No real Google Spreadsheet is provisioned by this batch — `PATIENT_SPREADSHEET_ID`
  remains a placeholder, an operational step outside this repository, per the same
  distinction docs/28 already drew for Phase 1.5's live deployment.
- `condition_slug` is not validated against Phase 1.5's canonical allowlist yet — a
  documented, deliberate simplification (`shared/schemas/patient-identity.md`), not an
  oversight.
- Next: Foundation Batch F4 (session + route protection) — awaiting approval before
  starting, per the Foundation plan's explicit "wait for approval" requirement.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F2 (shared contracts + utilities)

Second implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Per the plan's one named bootstrap exception (`shared/README.md`), this batch
creates a `shared/` contract and its first Apps Script adaptation together, since
neither existed before this batch — every change to either after this point must
follow the shared-first, implementation-second rule with no exception available.

### Added
- `shared/contracts/response-envelope.schema.json` (version `1.0.0`) + `.md` — the
  canonical `{status, data, error}` response shape every Foundation function returns.
- `shared/utils/core.reference.js` (version `1.0.0`) + `.md` — canonical reference
  implementations of `generateId()`, `nowIso()`, `escapeHtml()`.
- `apps-script/FoundationUtils.gs` — `generateFoundationId_()` (uses Apps Script's
  native `Utilities.getUuid()`, not the reference's portable algorithm — same
  contract, better implementation, per `shared/README.md`'s "conform to the contract,
  not necessarily the algorithm" rule), `foundationNowIso_()`, `escapeFoundationHtml_()`.
- `apps-script/FoundationContracts.gs` — `buildFoundationOkEnvelope_()` /
  `buildFoundationErrorEnvelope_()`, adapting the response-envelope schema.
- `apps-script/FoundationErrorHandling.gs` — `withFoundationErrorHandling_()`, which
  guarantees every wrapped call returns the envelope shape and never leaks a raw
  exception message to the caller.

### Changed
- `apps-script/README.md`: append-only — three new rows in the "Phase 2A Foundation
  modules" table added in F1. No existing row or sentence was altered.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md`: §14 extended with Batch F2's implementation
  notes, including a real naming collision this batch's pre-write review caught and
  avoided (see Notes below).
- `docs/24-ROADMAP.md`: Phase 2A status line updated to reflect F2 shipping alongside
  F1.

### Verification
- A collision scan across every existing Apps Script global function name, run
  *before* writing any F2 code, found that a literal port of the reference
  `escapeHtml()` would have collided with Phase 1.5's own `Utils.gs` `escapeHtml_()`
  — both now share one Apps Script project's flat function namespace. Named the new
  function `escapeFoundationHtml_()` instead. (The first pass of this scan itself had
  a case-sensitivity bug that produced a false-positive collision report; caught and
  fixed before trusting the result.)
- `node --check` passed on every new `.gs` file.
- `shared/utils/core.reference.js`'s three functions executed directly in Node with
  assertions on their output: `generateId()` produces a valid RFC 4122 v4 shape,
  `nowIso()` produces a valid ISO 8601 UTC millisecond timestamp, `escapeHtml()`
  produces the exact expected escaped output and never throws on a non-string input.
- `FoundationContracts.gs`'s two builders (pure functions, no Apps Script dependency)
  executed directly in Node; output checked against `response-envelope.schema.json`'s
  required keys, `status` enum, and success/error `oneOf` shape — all passed.
- `withFoundationErrorHandling_()` executed with a minimal `Logger` stub, confirming a
  thrown exception's raw message is logged for debugging but never reaches the caller.
- `cd validation/phase-1-5 && node validate.js` re-run against this batch's final
  commit: **39/39 checks still passing** — zero regression to Phase 1.5.

### Notes
- No Google Sheet, Script Property value, or live Apps Script deployment change is
  part of this batch.
- Automated, schema-validator-based conformance testing
  (`validation/phase-2a-foundation/conformance.js`) remains an F5 deliverable — this
  batch's checks were real (executed against the actual committed source) but ad hoc,
  not yet backed by a committed, repeatable harness.
- Next: Foundation Batch F3 (data layer + Patient Identity) — awaiting approval before
  starting, per the Foundation plan's explicit "wait for approval" requirement.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F1 (scaffolding)

First implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Scaffolding only — no business logic, no Sheets created, no patient-facing
surface. Two decisions locked before this batch started (recorded in
docs/29-PHASE-2A-TECHNICAL-PLAN.md §14): Foundation lives inside the existing
`apps-script/` project rather than a separate one, and a new repository-level
`shared/` directory is now the canonical, machine-readable source for contracts and
schemas that Apps Script implementations conform to but never extend independently.

### Added
- `apps-script/FoundationConfig.gs` — placeholders and Script Property *key names*
  only (no secrets, no logic): a placeholder Patients spreadsheet ID and the
  `FOUNDATION_SESSION_SIGNING_SECRET` property name Foundation's session logic will
  read from Script Properties starting in batch F4.
- `shared/` — a new repository-level directory (`contracts/`, `schemas/`,
  `constants/`, `utils/`, each currently empty except `constants/.gitkeep`) and
  `shared/README.md`, which states the canonical-source rule (shared-first,
  implementation-second, never reversed, with one named exception for a contract's
  first creation), the machine-readable format rules (JSON/YAML define; Markdown only
  explains; small algorithmic utilities are portable reference `.js` files), and how
  Apps Script currently conforms to it (manual adaptation, no build step).

### Changed
- `apps-script/README.md`: append-only — added a "Phase 2A Foundation modules"
  section and its own module table, introducing `FoundationConfig.gs`. No existing
  row or sentence describing Phase 1.5's modules was altered.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md`: added §14 (Implementation Notes), recording
  the two decisions above as superseding §3's "separate Apps Script project" framing
  for the scope they cover, and Batch F1's completion. No ADR, Architecture
  Principle, or Domain Model entry was touched — both decisions were reviewed against
  the frozen ADR set before being accepted.
- `docs/24-ROADMAP.md`: Phase 2A status updated from "Implementation not yet started"
  to reflect F1 having shipped.

### Verification
- `git diff` confirmed zero modifications to any pre-existing `apps-script/*.gs`
  file — every change to `apps-script/` in this batch is either a new file
  (`FoundationConfig.gs`) or an append-only edit to `README.md`.
- `cd validation/phase-1-5 && node validate.js` re-run against the batch's final
  commit: **39/39 checks still passing** — confirms Phase 1.5's behavior is
  unaffected by this batch, not just assumed to be from the file list alone.
- `node --check` run against `FoundationConfig.gs` — no syntax errors.

### Notes
- No Google Sheet, no Script Property value, and no live Apps Script deployment
  change is part of this batch — `PATIENT_SPREADSHEET_ID` and
  `FOUNDATION_SESSION_SIGNING_SECRET` are named/placeholder only, consistent with
  "no logic yet" for a scaffolding batch.
- Next: Foundation Batch F2 (shared contracts + utilities) — awaiting approval before
  starting, per the Foundation plan's explicit "wait for approval" requirement.

## 2026-07-02 — Phase 2A architecture: documentation synchronization batch

Documentation-only. No application code, no Apps Script code, and no existing
architecture document (ADRs, docs/30, docs/33, docs/34's findings themselves aside)
was left unresolved — this batch closes the gaps docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md
identified before Phase 2A implementation begins.

### Changed
- `docs/09-PHASE-2-ARCHITECTURE.md` (v2.1): Entry Point now describes passwordless
  email magic-link login (ADR-003) instead of "Password or Mobile OTP"; Doctor
  Workflow diagram now shows the mandatory Doctor Review & Approval Gate (ADR-005);
  AI Summary reframed as a cross-cutting pattern (ADR-005, docs/33 §2.4) rather than a
  peer module; Roadmap section reconciled with docs/24 — Phase 2A now matches
  docs/29's actual scope, Personal Care Plan moved to its own Phase 2B, Phase 2C split
  into a non-AI Health Milestones phase and a Phase 2D carrying Digital Twin/AI
  Summaries; Security section cross-references ADR-010 and docs/29 §10.
- `docs/24-ROADMAP.md`: Phase 1.5 status corrected to match docs/25 v1.4/docs/28 (live
  deployment and real-patient pilot are done; only the governance sign-off remains
  open — previously read as if live deployment were still pending). Phase 2A/2B/2C
  restructured to match docs/09's corrected roadmap and docs/32's recommendation.
- `docs/12-DATA-ARCHITECTURE.md`: "Google Sheets as primary datastore" removed from
  the Principles list (it was never a principle, per ADR-006) and replaced with a
  "Current Implementation" section citing ADR-006.
- `docs/23-PATIENT-LIFECYCLE.md`: "Prescriptions" annotated as a `medicine`-type
  Doctor Instruction (docs/33 §2.3) instead of an unmodeled list item.
- `docs/01-WEBSITE-MASTER-PLAN.md`, `docs/03-DESIGN-SYSTEM.md`: primary navigation
  list replaced with a cross-reference to docs/08-NAVIGATION-ARCHITECTURE.md (was
  duplicated verbatim in four documents).
- `docs/05-UX-GUIDELINES.md`: navigation list, Content Hierarchy, Floating Page Guide,
  Accessibility, and Performance sections each replaced with a cross-reference to
  their dedicated source document (docs/08, docs/06, docs/08, docs/14, docs/16
  respectively) instead of restating them.
- `docs/07-SEO-STANDARDS.md`: Performance section now points to docs/16 for the
  underlying rules; keeps its own SEO-specific Lighthouse category targets, which
  docs/16 doesn't cover.
- `docs/13-AI-GUIDELINES.md`, `docs/15-SECURITY-STANDARDS.md`,
  `docs/22-WISE-KNOWLEDGE-ENGINE.md`: each now states which ADRs govern it
  (ADR-001/004/005 for AI/Knowledge Engine content, ADR-002/003/010 for security),
  making the ADRs the single source of truth for architecture-level decisions those
  documents previously stated independently.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §4: added a note that docs/33-DOMAIN-MODEL.md
  is canonical for entity meaning; its own schema table describes implementation shape
  only — closes a duplication risk between the two documents before it could drift.
- `docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md`: updated to mark every finding in this
  entry as resolved rather than open. docs/32-ARCHITECTURE-REVIEW.md is left
  unmodified as the historical record of when each item was first found, per ADR-007's
  "supersede, never silently edit" rule.
- `docs/CLAUDE.md`: added an "Architecture Freeze" section — once Phase 2A
  implementation begins, the ADRs, docs/30-ARCHITECTURE-PRINCIPLES.md, and
  docs/33-DOMAIN-MODEL.md are authoritative, and architectural changes require an
  explicit architecture review before implementation, not an inline redesign.

### Notes
- No new documentation was created in this batch (per its explicit scope) — every
  change above is an edit to an existing document.
- This closes out the architecture-freeze work that began with docs/29 through
  docs/34. Per docs/CLAUDE.md's new Architecture Freeze rule, the architecture is now
  considered frozen for Phase 2A once this batch's Pull Request merges. Implementation
  (Batch 5A) still awaits separate, explicit approval — this batch does not begin it.

## 2026-07-02 — Phase 1.5 live deployment complete: real-patient pilot run

Phase 1.5 deployed for real on a free personal Google account
(`wisehomeopathicmc@gmail.com`) and validated end to end against the live
deployment: access-code gate, OpenRouter AI calls, doctor review (approve,
approve-edited, reject), the consent gate blocking a tampered row, real
email delivery, a forced delivery failure, retention purge (skip, purge,
idempotency), and trigger installation (idempotency). One real,
already-consenting patient's visit summary was submitted, reviewed by a
doctor against the source note, approved, and sent to the patient's real
email address.

### Changed
- `docs/28-DEPLOYMENT-READINESS.md`: all technical checklist items marked
  complete with the live evidence for each. Only the governance
  "Deployment approved" sign-off remains open (deliberately left for the
  clinic's own decision-maker).
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`: status banner updated to
  **Software Complete, Deployment Complete, Operationally Complete**; §10
  ("Status after live deployment") added, closing the staff-entry-point
  access control, retention trigger, real-patient pilot, and security
  checklist Definition-of-Done items that were open pending a live
  deployment.

### Notes
- Phase 1.5 is now Deployment Complete and Operationally Complete, on top
  of the Software Complete status reached at Batch 4H. Phase 2A still
  should not begin until the one remaining governance sign-off is made.

## 2026-07-02 — Phase 1.5 deployment: free personal Google account (no Workspace)

Deployment decision: this project deploys from a free personal Google
account (`wisehomeopathicmc@gmail.com`), not Google Workspace. Google
Workspace's domain-restricted Web App access (the original
`appsscript.json` `access: DOMAIN`) is not available to a personal
account, so it is replaced with an application-level shared access code —
everything else (Sheets, Apps Script, MailApp/Gmail, Drive) was already
free and unaffected.

### Added
- `apps-script/Auth.gs` — `verifyAccessCode_()`, the new access gate:
  checks a `STAFF_ACCESS_CODE` Script Property against every request's
  `access_code` field, fails closed if the property is unset, before any
  parsing/validation/Sheet write happens.
- 4 new unit tests in `apps-script/Tests.gs` covering `verifyAccessCode_()`
  (unset property, wrong code, empty code, correct code).
- `apps-script/README.md`: new "Access control" section explaining why
  Workspace's domain restriction doesn't exist for a personal account,
  the shared-access-code replacement, its tradeoffs vs. Workspace, and
  the no-redesign migration path back to Workspace if the clinic adopts
  it later.

### Changed
- `apps-script/appsscript.json`: `webapp.access` changed from `DOMAIN` to
  `ANYONE_ANONYMOUS` (the Web App URL is public; `Auth.gs`'s shared code
  is the real access control now). `executeAs` unchanged (`USER_DEPLOYING`
  — all mail still sends from the one clinic account).
- `apps-script/Code.gs`: `doPost` now checks `verifyAccessCode_()` first,
  before sanitization/validation; rejects with `401` and logs
  `unauthorized` on failure.
- `internal/consultation-summary.html`: added a required "Staff access
  code" field, sent as `access_code`; removed Workspace-sign-in language
  from the banner and error messages; added an explicit `401` message.
- `apps-script/sample-payloads/*.json`: added an `access_code` field
  (placeholder `REPLACE_WITH_YOUR_STAFF_ACCESS_CODE`) to the JSON samples.
- `apps-script/README.md`: deployment steps rewritten for a free personal
  account (no `clasp login` to a Workspace account, no domain-restricted
  deploy option, new `STAFF_ACCESS_CODE` setup step); manual testing steps
  updated to test the access-code gate instead of a Workspace/non-Workspace
  account pair.
- `docs/28-DEPLOYMENT-READINESS.md`: rewritten for the free-account
  deployment — "Google Workspace configured" checklist item replaced with
  "Google account confirmed" and "Staff access code configured and
  verified."
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`: added a deployment-account
  amendment note (v1.3) at the top, explaining that the plan's original
  Workspace-domain-restriction language (§9.1, §9.7, §7, §10) describes
  the original design and is superseded by the access-code control
  described above; no other part of the plan changes.
- `validation/phase-1-5/harness.js` and `validate.js`: updated the mocked
  harness and test payloads to include `STAFF_ACCESS_CODE` /
  `access_code`, and added explicit checks that a missing/wrong access
  code is rejected with `401` before any row is written. 39/39 checks
  pass (was 37/37 before the 2 new access-code checks + 4 new `Tests.gs`
  cases folded into Stage 0's count).
- `validation/phase-1-5/README.md`: result summary updated to 39/39.

## 2026-07-02 — Phase 1.5, Batch 4H: documentation, validation closeout, and formal completion

Final batch of Phase 1.5, per explicit scope: documentation, validation closeout, and project synchronization only — no new features, no refactor, no optimization, no Phase 2 work. `git diff` against `apps-script/`, `internal/`, and `validation/` is empty; this batch touches only `docs/`, `apps-script/README.md`, and this file.

### Added
- `docs/26-PHASE-1.5-VALIDATION-REPORT.md` — the canonical validation record: objectives, scope, what was implemented, methodology, unit/integration/failure-path tests executed, results (37/37 checks passed), remaining live-deployment validation, known limitations, risks, and a Go/No-Go recommendation (Go for test deployment, No-Go for real patient use until deployment readiness is closed).
- `docs/27-PHASE-1.5-CLOSEOUT.md` — the official Phase 1.5 closeout: original objectives against what shipped, architecture delivered, lessons learned, remaining operational work, and the handoff into Phase 2A (which this document does not authorize).
- `docs/28-DEPLOYMENT-READINESS.md` — an operational checklist (Workspace configuration, live deployment, API keys, mail permissions, retention trigger installation, domain-restriction verification, real-patient pilot approval, deployment approval) for whoever deploys this project — explicitly not a software task list.

### Changed
- `docs/15-SECURITY-STANDARDS.md`: added the Phase-1.5-specific security notes docs/25 §12 had flagged since the plan's first version but that were never actually written — closed now, seven batches later, cross-referencing docs/25 §7's existing mapping table rather than duplicating it.
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`: status banner updated to **Software Complete (Batches 4A-4H)**, explicitly distinct from Deployment Complete and Operationally Complete (both still false); §10's Definition of Done, §11 (Batch 4H retrospective), and §12's documentation-impact table all updated to close out the plan.
- `docs/24-ROADMAP.md`: Phase 1.5 status finalized as Software Complete, pending live deployment and real-patient pilot.
- `apps-script/README.md`: Status section rewritten to point at docs/26-28 instead of listing individual batches.

### Notes
- One documentation gap found during this closeout's repository review: docs/15-SECURITY-STANDARDS.md's promised Phase 1.5 update, tracked since docs/25's first version, had never been done. Fixed in this batch.
- **Software Complete ≠ Deployment Complete ≠ Operationally Complete.** All Phase 1.5 code and validation work (Batches 4A-4G) is done and merged. No live Google Workspace deployment exists. No real patient has been contacted. Phase 1.5 is not marked fully done until docs/28's checklist and docs/25 §10 are closed by an actual deployment and pilot — not assumed.
- Phase 2 has not begun. My Health Journey has not been implemented. Do not begin either until docs/25 §10 is fully closed.

## 2026-07-02 — Phase 1.5, Batch 4G: full pipeline validation

Validation phase, per explicit scope: no new features, no architectural refactor, no code optimization. Zero lines changed in `apps-script/` — confirmed by `git status` showing only new files under `validation/`. Objective: prove the complete pipeline (staff submission → validation → Sheet write → AI normalization → doctor review → gate evaluation → email delivery → retention) works exactly as designed, stage by stage and end to end, including every required failure mode.

### Added
- `validation/phase-1-5/harness.js`: loads the real, unmodified `apps-script/*.gs` source into a mocked Apps Script runtime (in-memory Sheet; fake `PropertiesService`/`UrlFetchApp`/`MailApp`/`ScriptApp`/`Session`) — the strongest verification available without a live Google Workspace deployment, since it exercises the actual committed code rather than a reimplementation of its logic.
- `validation/phase-1-5/validate.js`: drives that real source through every pipeline stage independently and the full end-to-end workflow (success path twice — once through to a real send + 20-days-later retention purge, once through a doctor rejection — plus a tampered-consent path caught at review time). **37/37 checks passed**, including the existing 26-test `Tests.gs` suite re-run through the same real-source harness.
- `validation/phase-1-5/README.md`: what the harness proves, and — equally important — what it explicitly does not prove (Workspace-domain access restriction, a real OpenRouter call, a real email actually arriving, the live retention trigger firing on schedule, a real-patient pilot), since none of those are achievable without a live deployment this environment doesn't have.

### Coverage
Per this batch's explicit requirements, all tested and confirmed to leave the system in a safe state: success path; validation failures (missing consent, unknown condition slug, malformed JSON); AI failures (missing key, provider HTTP error); Sheets-write failures (initial submission and retention, both non-fatal to the rest of the batch); provider (email) failures; consent failures (submission-time rejection, and a stronger send-time check — tampering `patient_consent_confirmed` directly in an already-`approved` row still blocks the email); review failures (rejection sends nothing); retention failures (one row's write failure logged and skipped, batch continues, idempotency proven by running the purge twice with zero re-purges); HTML injection (a synthetic `<script>`-bearing AI draft confirmed escaped in the actual email body).

### Documentation
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §10 (Definition of Done): checklist updated to distinguish what Batch 4G verified from what remains open pending live deployment — the Workspace-domain access check, the live OpenRouter/MailApp calls, the live retention trigger, and the required real-patient pilot. §11 gained a full Batch 4G retrospective.
- `docs/24-ROADMAP.md`: Phase 1.5 status updated to "implementation and code-level validation complete; live deployment + real-patient pilot still required."

### Notes
- **Phase 1.5 is not marked done.** Every item verifiable without live Google Workspace credentials has been verified; the remaining Definition-of-Done items are deployment/operations work for whoever runs this project against a real Workspace, not further code work.
- Do not begin Phase 2A until docs/25 §10's full checklist is closed.

## 2026-07-02 — Phase 1.5, Batch 4F: automated retention purge

New: `apps-script/Retention.gs` — the 14-day retention policy from `docs/25` §9.3, implemented as a time-driven trigger fully independent of `Review.gs`/`Send.gs`/`Email.gs`. This is the last implementation batch before Phase 1.5's testing/validation pass (Batch 4G).

### Added
- `apps-script/Retention.gs`: `purgeExpiredRecipientEmails_()` (the trigger entry point), `isEligibleForPurge_(row, nowMs)` (pure eligibility check), and `installRetentionTrigger_()` (one-time, idempotent setup). Deliberately calls none of Review.gs/Send.gs/Email.gs, and is never called by them.
- `apps-script/Sheets.gs`: `getAllRowObjects_()` — batch-reads every data row in one call, used only by `Retention.gs`.
- `apps-script/Config.gs`: `CONFIG.RETENTION.EMAIL_RETENTION_DAYS` (`14`, locked per docs/25 §9.3).
- `apps-script/Tests.gs`: seven new unit tests for `isEligibleForPurge_()` — eligible after the window, not eligible within it, eligible exactly at the boundary, and not-eligible for each idempotency/data-integrity condition (already purged, already-empty email, never sent, invalid date). All verified against real execution.

### Guarantees (verified against synthetic data, not just reasoned about)
- **Scope-restricted by construction**: the only `updateRowByRecordId_()` call in this module passes a hardcoded `{ recipient_email, purged_at }` object — there is no code path able to touch doctor notes, AI summaries, review status, or any other audit column.
- **Idempotent**: once `purged_at` is set, a row is permanently ineligible for purge again — confirmed by running the purge twice against the same synthetic dataset and observing zero re-purges on the second run.
- **Safe against partial failures**: each row's write is wrapped in its own try/catch; a synthetic write failure on one row was confirmed to be logged and skipped without stopping the batch — the other eligible rows in the same run still purged correctly.
- **Every action audited**: every purge, skip, and failure is logged via `Logger.gs`, with a `purged=N skipped=N failed=N` summary closing each run.

### Notes
- Self-review: `grep` confirms `Retention.gs` contains no calls into `Review.gs`/`Send.gs`/`Email.gs`, and those three files contain no references back into `Retention.gs`.
- `apps-script/README.md` gained a "Retention purge" section, a deployment step for `installRetentionTrigger_()`, and manual test steps (skip-too-recent, purge-with-protected-column verification, idempotency-on-rerun, trigger-install idempotency).
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Remaining: Batch 4G — the full backend testing checklist and a real, consenting-patient pilot, the last item before Phase 1.5 is marked done.

## 2026-07-02 — Phase 1.5, Batch 4E: email delivery, layered behind a dedicated Email.gs

New: `apps-script/Email.gs` — the visit-summary email template and the only module permitted to call a mail provider. Requested layering: `Send.gs` never calls `MailApp`/`GmailApp` directly.

### Added
- `apps-script/Email.gs`: `sendVisitSummaryEmail_(row)` builds the HTML template (`buildVisitSummaryEmail_()`, docs/25 §9.6, HTML-first, locked) and is the sole caller of `MailApp.sendEmail()` anywhere in the project.
- `apps-script/Send.gs`: `attemptSend_(row)` — re-checks `evaluateSendGate_()` and, only if it passes, calls `Email.gs`; writes `email_status`/`email_sent_at` (success) or `email_status = failed` + `error_log` (any failure) back to the row regardless of outcome, per docs/25 §8.3's never-silently-drop requirement.
- `apps-script/Utils.gs`: `escapeHtml_()` — the AI's draft output is escaped before being embedded in the HTML email, since (unlike `staff_submitted_note`) it was never sanitized at submission time.
- `apps-script/Config.gs`: `CONFIG.EMAIL` (subject, sender name) — read only by `Email.gs`.
- `apps-script/Tests.gs`: three new unit tests for `escapeHtml_()`/`buildVisitSummaryEmail_()`, verified against actual execution. `attemptSend_()`/`sendVisitSummaryEmail_()` are intentionally not unit-tested (they touch a real Sheet and mail provider) — covered by expanded manual test steps instead.

### Changed
- `apps-script/Review.gs`: after approval, now calls `Send.gs`'s `attemptSend_()` (which sends the email if the gate passes) instead of Batch 4D's placeholder "not yet implemented" alert. `Review.gs` still never calls `Email.gs` or a mail provider directly.

### Architecture
- Layering: `Review.gs → Send.gs → Email.gs → MailApp`. `Send.gs` never touches a mail provider; `Review.gs` never touches `Email.gs`. This keeps the send gate independent of the delivery mechanism — a future provider swap only touches `Email.gs`. Phase 1.5 uses MailApp only, per docs/25 §3's diagram; no other provider was introduced.

### Notes
- Self-review verified the layering holds (`grep` for `MailApp`/`GmailApp` across all modules shows exactly one call site, in `Email.gs`) and exercised the gate-pass, gate-blocked, and provider-failure paths against mocked dependencies before committing.
- `apps-script/README.md` gained an "Email delivery layering" section and expanded manual-test steps: send to a real test inbox, confirm a tampered-consent row still doesn't send, force and verify a delivery failure is logged — never a real patient address until docs/25 §8's full validation pass (Batch 4G).
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred: retention purge (4F).

## 2026-07-02 — Phase 1.5, Batch 4D: doctor review checkpoint + gated send

New: `apps-script/Review.gs` and `apps-script/Send.gs` — the doctor review step from `docs/25` §5.2 and the hard-gated send decision from §6/§9.2. No email is sent yet — this batch proves the gate is enforced correctly; Batch 4E attaches the actual delivery.

### Added
- `apps-script/Review.gs`: a Sheet-bound custom menu (**Consultation Summaries**, via `onOpen()`) with three actions — approve as-generated, approve as-edited, reject — writing `review_status`/`reviewed_by`/`reviewed_at` on the selected row. `reviewed_by` is captured from the signed-in Workspace account (`Session.getActiveUser().getEmail()`), not free text. Built Sheet-bound rather than as a second HTML form, per docs/25 §5.2's explicit "Sheet-bound or minimal UI" allowance.
- `apps-script/Send.gs`: `evaluateSendGate_(row)` — the single choke point any future send path must pass through. Hard-checks `patient_consent_confirmed === true` and an approved `review_status`, reading values freshly re-read from the Sheet after review so a manual edit made directly in a cell is still caught, not just the value that was true at submission time.
- `apps-script/Sheets.gs`: `getRowObjectByRowIndex_()` — reads one row's live values back as an object, used by the review workflow.
- `apps-script/Tests.gs`: six new unit tests for `evaluateSendGate_()`, verified against actual execution (approved+consented passes; edited_and_approved passes; missing consent, non-approved status, empty draft, and empty recipient email each independently block).

### Notes
- No MailApp/GmailApp call exists yet anywhere in this project — a passing gate currently just confirms readiness and logs it.
- `apps-script/README.md` gained a "Review workflow" section and matching manual-test steps (open the Sheet, confirm the menu appears, approve/reject, and specifically confirm a manually-tampered consent cell blocks the gate).
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred: email template + delivery (4E), retention purge (4F).

## 2026-07-02 — Phase 1.5: prompt specification extracted to PROMPTS.md

Small refactor, no behavior change, requested before starting Batch 4D. Moves the AI prompt out of `apps-script/Ai.gs`'s inline comments into a standalone, version-controlled specification.

### Added
- `apps-script/PROMPTS.md`: canonical prompt specification with Prompt Version, Purpose, Inputs, Outputs, Safety Rules, Forbidden Behaviours, Traceability Principles, and Future Evolution Notes. Apps Script does not read this file at runtime — it's documentation the implementation must match, not a loaded template.

### Changed
- `apps-script/Ai.gs`: added a `PROMPT_VERSION_` constant (`'1.0'`) and a comment pointing at `PROMPTS.md` as the canonical source. `SUMMARY_SYSTEM_PROMPT_`'s wording and `flagDrift_()`'s logic are byte-for-byte unchanged.
- `apps-script/Code.gs`: the `summarized` execution-log line now includes the prompt version — the only runtime-visible difference from Batch 4C, and it's execution-log-only (not the Sheet, not the API response).
- `apps-script/README.md`, `docs/13-AI-GUIDELINES.md`, `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated to reference `PROMPTS.md` as canonical.

## 2026-07-02 — Phase 1.5, Batch 4C: AI summarization (normalization only)

New: `apps-script/Ai.gs` — the OpenRouter summarization step from `docs/25` §6, wired synchronously into `Code.gs`'s `doPost` after the row write. No email sending, no doctor review/approve UI yet — the draft this batch writes cannot reach a patient regardless.

### Added
- `apps-script/Ai.gs`: `summarizeNote_()` orchestrates the AI call (`anthropic/claude-haiku-4.5` via OpenRouter, `temperature: 0`, per the already-locked §9.4 decision) and a code-level drift check (`flagDrift_()`), independent of the prompt.
- The AI step is implemented and documented as a **normalization layer, not a content-generation layer**, per an explicit requirement: it may only rephrase the doctor's note, never add a diagnosis, recommendation, investigation, medicine, reassurance, or conclusion not already present in the source note, and every output sentence must be traceable back to the note. Enforced two independent ways: (1) a nine-rule system prompt, (2) `flagDrift_()`, which flags prohibited-category lexicon matches and low-word-overlap sentences into `error_log` for the doctor reviewer (Batch 4D) to check — flags are advisory, never auto-blocking, since nothing can be sent without human review regardless.
- `apps-script/Sheets.gs`: `updateRowByRecordId_()` — patches specific columns on an already-written row; used by the AI step and reusable by every later batch (review, send, purge).
- `apps-script/Tests.gs`: four new unit tests for `flagDrift_()` (faithful rephrasing produces no flags; added recommendation/diagnosis are flagged; a fabricated, unrelated sentence is flagged for low traceability).
- `internal/consultation-summary.html`'s confirmation message now reflects whether an AI draft was actually generated.

### Notes
- An AI-call failure (missing API key, OpenRouter error) never undoes the row already written — `ai_summary_draft` is left empty, the failure is logged to `error_log`, and the submission still reports success to staff, per docs/25 §8.3's failure-path requirement.
- `docs/13-AI-GUIDELINES.md` updated with this as a worked example: prompt-level constraint + independent code-level check + mandatory human review, intended as the reference pattern for future AI usage on the platform, not a one-off.
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred to later batches: doctor review + gated send (4D), email delivery (4E), retention purge (4F).

## 2026-07-02 — Phase 1.5, Batch 4B: staff entry form

New: `internal/consultation-summary.html` — the staff-only, Workspace-restricted entry point specified in `docs/25` §9.1, wired to the Batch 4A Apps Script Web App. Not linked from any public nav, not in `sitemap.xml`, `noindex`. No patient-facing change.

### Added
- `internal/consultation-summary.html`: condition dropdown, visit-summary note (2000-char limit matching `apps-script/Config.gs`), patient email, staff identifier, and a hard-required consent checkbox ("Patient has consented to receive this visit summary by email") that disables Submit until checked — a UX convenience layered on top of the actual server-side enforcement already built in Batch 4A's `Validation.gs`. Submits via `fetch` with `Content-Type: text/plain` to avoid a CORS preflight against the Apps Script Web App.

### Notes
- A repository-wide review (requested before starting this batch) checked whether any Batch 4A module — condition taxonomy, validation constants, schema, utilities — should move to a shared location usable by both Apps Script and the static site. Conclusion: not yet — the repo has no build step or module system that would let those two runtimes actually share a file, and nothing has a second consumer today. Recorded in `docs/25` §11 for revisiting later.
- The condition dropdown's options are hand-duplicated from `apps-script/Config.gs`; both files carry a comment pointing at the other. No automated sync exists.
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred to later batches: AI summarization (4C), doctor review + gated send (4D), email delivery (4E), retention purge (4F).

## 2026-07-02 — Phase 1.5, Batch 4A: Apps Script pipeline skeleton (schema, validation, Sheet-write layer)

New backend-only work — no public pages, no navigation, no visual changes. Full plan: `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`. First implementation of the "Website → Apps Script → Google Sheets" pattern specified in `docs/12-DATA-ARCHITECTURE.md`, and the first of eight sequenced batches (4A–4H) that make up Phase 1.5.

### Added
- `apps-script/` — a modular Google Apps Script project (`Code.gs`, `Config.gs`, `Schema.gs`, `Validation.gs`, `Sheets.gs`, `Logger.gs`, `Utils.gs`, `Tests.gs`), each with a single responsibility, per `apps-script/README.md`'s module table. This repository is the canonical source for the project; the Apps Script editor is a deployment target only.
- `Phase1.5_ConsultationSummaries` Sheet schema (16 columns, full detail in `docs/12-DATA-ARCHITECTURE.md` and `docs/25` §5.1) — designed to survive a future SQL migration unchanged, per `docs/12`'s standing rule.
- A `doPost` Web App endpoint that validates a staff-submitted consultation note (condition slug, note text, consent confirmation, staff identifier, recipient email) and writes one audited row per submission. Every request either writes a complete row or writes nothing — no partial-write state.
- `apps-script/sample-payloads/` — example request bodies (one valid, three that each fail validation for a distinct reason) for manual/curl testing.
- `apps-script/README.md` — module responsibilities, request-flow diagram, how each of docs/25's later batches (4B–4F) plugs into this schema without changing it, and clasp-based deployment steps.
- `apps-script/Tests.gs` — manual unit tests for the validation layer (`runAllTests_()`), runnable from the Apps Script editor with no live Sheet or network calls.
- `.gitignore` — excludes `apps-script/.clasp.json` (environment-specific, contains a real Apps Script project ID); `apps-script/.clasp.json.example` documents its shape.

### Not included in this batch (by design — see docs/25 §9 for sequencing)
- No AI summarization call (Batch 4C).
- No doctor review checkpoint or email-send gating (Batch 4D).
- No email template or delivery (Batch 4E).
- No retention purge trigger (Batch 4F).
- No staff-facing HTML entry form yet (Batch 4B) — the endpoint exists and is tested via `sample-payloads/`, but nothing on the public site links to it.
- No patient login, authentication, or portal — none is introduced anywhere in Phase 1.5.

### Notes
- Code review caught and fixed two issues before merge: `Config.gs`'s canonical condition-slug allowlist was missing `dermographism` (an 8th slug already live on `/conditions/`, which would have caused valid submissions for that condition to be rejected); and `apps-script/README.md`'s testing instructions initially implied checking real HTTP status codes, which Apps Script Web Apps cannot set (every response transports as HTTP 200) — both `Utils.gs` and the README now document that callers must branch on the JSON body's `status` field instead.
- `docs/24-ROADMAP.md` updated to track the Batch 4A–4H sequence under Phase 1.5.
- Deferred to later batches: staff entry form, AI summarization, doctor review UI, email delivery, retention automation, and the full end-to-end/real-pilot validation pass (docs/25 §8, §10).

## 2026-07-02 — Batch 3: Legal & Compliance pages

New: `privacy.html`, `terms.html`, `disclaimer.html` — Privacy Policy, Terms of Use, and Medical Disclaimer, written specifically for Wise Homeopathy from verified facts already in this repository (no generic templates, no invented certifications, retention periods, or grievance officers). Each covers what's collected, why, how it's used, and clearly marks not-yet-built functionality (Patient Login, My Health Journey, WiseOS) as "Future Update Required" instead of describing it as live.

### Added
- A "Legal" footer section (Privacy Policy · Terms of Use · Medical Disclaimer) on all 7 pages that carry the full footer nav: `index.html`, `team.html`, `contact.html`, `conditions/index.html`, `online-consultation/index.html`, `blog/index.html`. `gallery.html`'s lighter single-line footer got a matching small link row instead of the full grid, consistent with its existing minimal style. `thanks.html`/`booking-received.html` intentionally left unchanged (transient, `noindex` confirmation cards with no footer nav).

### Fixed
- `online-consultation/index.html` had a pre-existing invalid-markup bug — a stray `</body></html>` before its mobile-menu `<script>` block. Browsers silently recovered from it, but it was invalid HTML sitting next to a line this batch was already editing; removed.
- `online-consultation/index.html`'s footer "Book Consultation" link pointed to WhatsApp instead of `/contact.html` — Batch 1's changelog claimed this was already unified sitewide but missed this one footer instance. Corrected.

### Notes
- No separate Cookie Policy page — the site has no tracking/analytics cookies and only two third-party embeds (Google Fonts, Google Maps), fully covered by a short section inside the Privacy Policy. See `WEBSITE-AUDIT.md` Batch 3 entry for the full rationale.
- Legal pages are intentionally not added to `sitemap.xml` (standard practice for this content type); `robots.txt`'s existing `Allow: /` already permits indexing if search engines discover them via the new footer links.

## 2026-07-02 — Product Architecture Review (docs only)

Added `docs/20-PRODUCT-ARCHITECTURE-REVIEW.md`: a strategic review of the long-term
product architecture (Visitor → Trust → Consultation → Patient → My Health Journey →
WiseOS), covering information architecture, product roadmap, patient journey mapping,
content strategy, WiseOS integration readiness, navigation strategy, and a 12-month
growth plan. No site files, pages, or code changed. Reaffirms Batch B (dedicated
condition pages) as the correct next implementation step and identifies the absence of
Privacy/Terms/Disclaimer pages as a newly-documented gap.

## 2026-07-02 — Batch 2: conversion routing, social previews, testimonial claims

Copy/link/meta-tag fixes only — no layout, design, or new assets. Full rationale in `WEBSITE-AUDIT.md` → Phase 4 → Batch 2.

### Fixed
- **Homepage condition cards no longer skip straight to booking.** All 10 cards on `index.html` previously linked to `#book`, pushing an undecided visitor to commit before being educated. The 7 cards with a matching section on `/conditions/` (MCAS, Hashimoto's, Chronic Urticaria, Eczema, Allergic Rhinitis, Eosinophilic Esophagitis, POTS) now link to that anchor. The 3 without a matching section (Food Allergies, Lupus/RA, Allergic Asthma) link to `/conditions/` instead — no new clinical write-ups were invented to fill those gaps; adding them (or removing the cards) is a content decision for the clinic.
- **Missing/broken social preview images on Home and Team.** Added `og:image` tags to `index.html` (`assets/images/home-og.jpg`) and `team.html` (`assets/images/team-og.jpg`). Both files are added to the asset checklists in `README.md` and `PUBLISHING-GUIDE.md`; they don't exist yet, same status as every other missing image (logo, doctor/gallery photos) — tracked as one item under the outstanding "asset drop" roadmap entry.
- **Testimonial clinical claims softened.** Homepage testimonials previously cited exact, unverifiable lab values ("anti-TPO 890 → 210") and absolute outcome language ("off antihistamines completely," "the urticaria is gone") — a credibility/compliance risk for a medical site. Reworded to experience-focused language without altering the underlying patient stories.

### Added
- A visible "Individual results vary — always continue working with your treating physician" note directly under the homepage testimonials grid, reinforcing the existing footer disclaimer at the point where the claims are actually read.

### Notes
- Deferred to later batches (see `WEBSITE-AUDIT.md` roadmap): full condition-list alignment (adding the 3 missing condition sections or removing their homepage cards), the actual `*-og.jpg` image files, blog hub's og:image/retitle.

## 2026-07-02 — Batch 1: critical fixes (canonical domain, mobile nav, booking form)

Functional and SEO fixes only — no visual or design changes. Full rationale in `WEBSITE-AUDIT.md` → Phase 4 → Batch 1.

### Fixed
- **Canonical domain split resolved.** Home, Team, and Blog previously declared `wisehomeopathy.in` as canonical while the rest of the site (and `_redirects`, `robots.txt`, `sitemap.xml`) used `www.wisehomeopathy.com`, splitting SEO ranking signals across two domains. All three pages now use `www.wisehomeopathy.com` — updated in `<link rel="canonical">`, `og:url`, and JSON-LD `url`. Blog's canonical path bug (pointed at nonexistent `/blog.html`) fixed to `/blog/`. Home canonical fixed to `/` to match the sitemap.
- **Blog "Request a consultation" form now submits.** `blog/index.html`'s booking form previously called `preventDefault()` and displayed a fake "your request has been noted" message while sending the data nowhere. It's now a real Netlify Forms submission (`name="blog-consultation"`, honeypot spam field, `action="/booking-received.html"`), matching the pattern already working on `contact.html`.
- **Mobile navigation added to 4 pages that had none.** `online-consultation/`, `conditions/`, `contact.html`, and `gallery.html` hid their nav links below 820px with no replacement, leaving phone visitors unable to navigate. All four now have the same hamburger + slide-down mobile menu already used on Home/Team/Blog.
- **Homepage and Team header nav fixed.** Removed a duplicated "Conditions" link on both pages; both had no way to reach Home, Team, or Contact from their mobile menu. Desktop and mobile nav on both pages now read: Home · Online Consultation · Conditions · Team · Blog · Gallery.
- **Booking-confirmation page split from newsletter confirmation.** `thanks.html`'s "You're subscribed ✓" copy was shown to patients after submitting a *consultation* request, not just newsletter signups. New `booking-received.html` (noindex, same visual style) now handles both consultation forms (`contact.html` and `blog/index.html`); `thanks.html` is unchanged and serves only the newsletter form.

### Changed
- Standardized every page's "Book Now" / "Book Consultation" CTA to point to `/contact.html` (Online Consultation's previously went straight to WhatsApp, inconsistent with the rest of the site).
- Footer "Conditions" links on Home and Team previously pointed at homepage anchors (`#conditions`); now link to the actual per-condition anchors on `/conditions/`.
- Root-relative internal links standardized where pages previously used page-relative paths (e.g., `team.html`'s JS-generated profile-modal "Book a consultation" link, several `index.html`/`team.html` internal hrefs).

### Added
- `booking-received.html` — confirmation page for consultation-request form submissions.
- `<link rel="icon">` favicon tag to Home, Team, and Blog (previously present on the other 5 pages only).

### Verification
- Local static server + Playwright (390px mobile viewport) driving the hamburger menu on all 7 pages: menu opens, exposes all 7 nav links, closes correctly, zero new JS errors introduced.
- Repo-wide grep confirmed zero remaining `wisehomeopathy.in` references, correct form `action` targets on all three Netlify forms, and exactly one `menuBtn`/`mmenu` id pair per page.

### Notes
- Corrected an inaccurate finding in the original audit: `sitemap.xml` already included `team.html`; no sitemap change was needed.
- Deferred to later batches (see `WEBSITE-AUDIT.md` roadmap): homepage condition-card routing, og:image tags, blog article publishing, testimonial claim softening, the Gallery-in-nav decision, and the blog hub retitle.

## 2026-07-02 — Full website audit and master improvement plan

- Added `WEBSITE-AUDIT.md`: Phase 1 (project understanding), Phase 2 (page-by-page audit with KEEP/IMPROVE/REMOVE/ADD verdicts and cross-site critical findings), and Phase 3 (prioritized Critical/High/Medium/Low improvement roadmap). No site files modified in this entry.
