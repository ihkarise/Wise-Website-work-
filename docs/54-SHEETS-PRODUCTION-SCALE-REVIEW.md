# 54 - Google Sheets Production Scale / Capacity Review
## WHIMS Patient Intelligence Platform — Version 1.0 — 2026-07-08

> Dedicated technical/capacity review, named as a required gate before Batch WPI-7
> (Inventory) and Batch WPI-9 (Analytics) specifically by docs/49 §7, docs/50 §10/§17.1,
> docs/51 Part 3 item 1/Part 5, and docs/52 ("What should happen before WPI-7 and WPI-9
> specifically"). Fulfills ADR-006's own "Future Considerations" ask — "define a
> concrete migration trigger... once it becomes a near-term planning concern" — now that
> concern has arrived. Documentation only: no schema, Apps Script, frontend, validation,
> router, or registry file is touched to produce this review, per docs/53 Phase C's own
> "explain before writing code" discipline applied here to an infrastructure decision
> rather than a domain one. Mirrors the structure of docs/45/docs/46/docs/48/docs/51/
> docs/52. **Does not itself authorize WPI-7 or any other batch to begin** — it clears
> one named pre-condition; docs/53 §13's own per-batch approval gate still applies.

---

# 1. Purpose

docs/49 §7 flagged, but deliberately did not resolve, whether Google Sheets (ADR-006's
current, non-permanent storage choice) remains sufficient once WHIMS adds Inventory's
transactional stock ledger and Analytics' cross-patient aggregate reads — "the most
plausible real trigger for ADR-006's anticipated migration," per docs/51's own ranking
as Phase 3's top risk. This document is that dedicated review: it inventories the
platform's actual current storage mechanics (Part 2), estimates WPI-7/WPI-9's real
workload against them (Parts 3–4), checks that workload against Google's published
platform limits (Parts 5–6), analyzes the specific failure modes Sheets-as-a-datastore
exposes (Parts 7–13), and closes with concrete, numeric operational thresholds and
migration triggers (Parts 14–20) — the same "design as if migration is a certainty"
discipline ADR-006 already commits every schema to, made concrete here instead of
aspirational.

**This document does not decide to migrate off Sheets** (docs/49 §7's own explicit
framing, unchanged) — it decides whether WPI-7/WPI-9 may proceed on Sheets as designed,
under what conditions, and names the numeric point at which that decision must be
revisited.

---

# 2. Current Architecture

## 2.1 Storage topology
Two separate spreadsheets, unchanged since docs/29 §14 Decision 1:
- **Phase 1.5's spreadsheet** (`Sheets.gs`, `ConsultationSummaries` — pre-dates
  Foundation, untouched by any WPI batch).
- **The Patient-domain spreadsheet** (`FOUNDATION_CONFIG.PATIENT_SPREADSHEET_ID`) —
  every Foundation/Phase 2A/Phase 2B/Phase 3 entity lives here as its own named sheet
  (tab) within this one spreadsheet. Confirmed by repository grep, the current tab set
  is: `Patients`, `Doctors`, `LoginTokens`, `DoctorLoginTokens`, `TrustedDevices`,
  `PatientProfile`, `DoctorAssignedConditions`, `DoctorInstructions`, `CarePlans`,
  `CalculatorResults`, `CheckInResponses`, `CheckInTemplateAssignments`,
  `PatientModuleState`, `DoctorModuleState`, `Appointments`, `Notifications`,
  `SymptomLogs`, `Reports`, `ConsultationHistory`, `AuditLog`. `Session`/`DoctorSession`
  are **not** sheets at all — both are stateless, self-verifying HMAC-signed payloads
  (docs/33 §1.3, docs/50 §5.3), never persisted rows, so they contribute zero storage
  growth regardless of login volume.
- **Registries are not Sheets-backed.** Module Registry, Calculator Registry, Template
  Registry, Doctor Module Registry, and Specialty Registry are static
  `shared/constants/*.json` config files read at request time, never spreadsheet rows —
  registry growth is a deploy-time file-size concern, not a runtime capacity one, and is
  out of this review's scope.

## 2.2 The one data-access layer
Every Sheets-backed entity (Phase 1.5's excepted) goes through
`apps-script/FoundationDataStore.gs`'s four operations — confirmed by reading the file
in full:
- `foundationDsInsert_` — `sheet.appendRow(...)`. One Sheets API call, one new row.
- `foundationDsGetById_` — reads the **entire** data range
  (`getRange(2, 1, lastRow-1, columns.length).getValues()`) into Apps Script memory,
  then does a **linear scan** for the first row matching one ID column. No index of any
  kind exists anywhere in this codebase.
- `foundationDsUpdateById_` — reads every ID in the sheet's first data column (a second
  full-column read), linear-scans for the target row, then issues one `setValue()` call
  per changed field.
- `foundationDsQuery_` — reads the **entire** data range, then filters in Apps Script's
  own JS runtime via a caller-supplied predicate. Every "find rows matching X" call in
  the entire codebase (e.g. `foundationGetCurrentCarePlanForPatient_`,
  `foundationGetNotificationsForPatient_`, every Registry-state lookup) is a full-table
  scan, bounded only by `sheet.getLastRow()`.

This is a deliberate, disclosed design choice ("kept to four operations deliberately...
no query language... avoiding over-abstraction at pilot scale," `FoundationDataStore.gs`
header) — correct for Phase 1.5/2A/2B's actual row counts, but the mechanism this review
must evaluate against WPI-7/WPI-9's own, larger, higher-frequency workload.

## 2.3 Locking
**Zero uses of `LockService` exist anywhere in this repository** (verified: `grep -rn
"LockService" apps-script/` returns no matches). Every read-modify-write sequence —
`CarePlan.gs`'s "find current active row, patch it to superseded, then insert the new
version" (three unsynchronized Sheets API calls), and every other entity's analogous
supersede/patch pattern — is unsynchronized against a second, concurrent execution
performing the same sequence. This has not caused an observed incident to date because
Phase 1.5/2A/2B/WPI-1–6's write paths are low-frequency and effectively single-writer at
pilot scale (docs/50 §7.4's own "single-doctor-per-specialty deployment... today's
actual scale" finding applies equally here). It is a real, latent gap, not a
theoretical one — see Part 7.

## 2.4 Append-only precedent
`CarePlan.gs` already establishes the "append a new row, never mutate history in place"
discipline docs/50 §10 asks `InventoryTransaction` to mirror exactly. `Notification.gs`
(WPI-6, the most recently shipped entity) is a pure-append, no-update sheet — structurally
the closest existing analog to `InventoryTransaction`'s own append-only ledger shape.

---

# 3. Expected Inventory Workload (WPI-7)

Per docs/50 §10: `InventoryItem` (one row per stock-keeping unit, doctor/staff-facing,
low write frequency — created/retired rarely, `quantity_on_hand` itself never written
directly) plus `InventoryTransaction` (one **append-only** row per stock movement:
`restock`/`dispense`/`adjustment`).

At the platform's actual current scale (one clinic, one seeded specialty, docs/50 §6.1) —
**assumptions stated explicitly, not silently assumed:**
- `InventoryItem`: tens to low hundreds of distinct SKUs (a homeopathy clinic's typical
  remedy/product catalog) — negligible row count, static reads dominate.
- `InventoryTransaction`: the platform's **first genuinely transactional, potentially
  high-frequency append path.** Every restock, every dispense (manual today; automatic
  once WPI-8/PillFill Integration fulfills an order, docs/50 §11), and every manual
  adjustment is one row. A single-clinic pilot plausibly sees on the order of 10–50
  transactions/day once PillFill fulfillment is live (WPI-8) — well within Sheets'
  comfortable range (Part 9) — but this is the sheet whose row count is dictated by
  *event frequency over time*, not patient count, and therefore the one most likely to
  cross an operational threshold first (Part 14).

# 4. Expected Analytics Workload (WPI-9)

Per docs/50 §12: Analytics is explicitly **not a stored entity** — "a computed,
read-only aggregate view," never a base table. Its workload is therefore entirely
**read** load: on each dashboard analytics-capability view, a full-table scan (via
`foundationDsQuery_`, Part 2.2) across `CheckInResponse`, `CalculatorResult`, `CarePlan`,
`DoctorAssignedCondition`, `InventoryTransaction`, `PillFillOrder`, and `Appointment` —
seven sheets, potentially all seven scanned on one page load if a report spans all of
them. Unlike Inventory, Analytics' risk is not row-count growth of its own but
**aggregate read cost against every other sheet's growth combined**, and the total
absence of caching (no computed/materialized aggregate is proposed anywhere in docs/50
§12) means every view recomputes from scratch.

---

# 5. Google Sheets Limits

Per Google's published Sheets platform limits (subject to change by Google; reconfirm
against the current published limits before any decision that depends on the exact
figure rather than the order of magnitude):
- **10,000,000 cells per spreadsheet**, spread across all sheets/tabs in that
  spreadsheet — a shared ceiling across every entity's tab, not per-tab.
- **Up to 18,278 columns** per sheet — irrelevant here; every entity here is
  single-digit to low-double-digit columns wide (flat-column discipline, ADR-006).
- No published hard row limit independent of the cell ceiling — effectively
  `10,000,000 / (columns in that sheet)` rows before the *spreadsheet-wide* ceiling is
  reached, shared across all ~20 existing tabs plus Inventory's two new ones.
- **Practical performance degrades well before the cell ceiling.** Full-range reads
  (Part 2.2's dominant access pattern) get measurably slower as a sheet's row count
  grows into the tens of thousands, independent of whether the 10M-cell ceiling itself
  is anywhere close.

# 6. Apps Script Limits

Per Google's published Apps Script quotas (consumer Google accounts; Google Workspace
accounts get higher ceilings on several of these — reconfirm the exact figures for
whichever account tier this project's Apps Script project actually runs under before
relying on the precise numbers):
- **6 minutes maximum execution time** per script execution (script/Web App/trigger) —
  the binding ceiling on any single `foundationDsQuery_`/analytics-aggregation call that
  scans a large sheet.
- **~30 simultaneous executions** per user — bounds concurrent Web App requests
  (doPost/doGet) hitting the same Apps Script project at once.
- **90 minutes/day total trigger runtime** (consumer) — relevant only if a future batch
  adds a time-driven aggregation/rollup trigger for Analytics; no such trigger exists
  today (`Retention.gs`'s daily purge is the only existing time-driven trigger in the
  repo, confirmed by grep).
- **URL Fetch calls/day** — irrelevant to Inventory/Analytics; neither makes outbound
  HTTP calls.

None of these ceilings is close to being approached by WPI-7's own transactional volume
(Part 3) at current single-clinic scale. The binding constraint at this scale is the
**6-minute execution ceiling interacting with `foundationDsQuery_`'s full-scan pattern**
once any one sheet's row count grows large (Part 9), not any daily quota.

---

# 7. Locking Strategy

**Current state: none, platform-wide (Part 2.3).** This review's single required
finding: `InventoryTransaction`'s own design — "`quantity_on_hand` is a derived/cached
value, recomputed from the transaction ledger, never the sole source of truth" (docs/50
§10) — is exactly the kind of read-then-derive-then-write sequence that is unsafe
without synchronization once two doctors/staff can plausibly dispense or restock the
same `InventoryItem` at overlapping moments (WPI-8's PillFill fulfillment is the
concrete trigger for this becoming real, not just theoretical).

**What Sheets already guarantees for free:** `appendRow()` calls are serialized at the
Sheets API level — two concurrent `appendRow()` calls against the same sheet do not
corrupt each other or silently drop a row; each gets its own row. The append-only
ledger itself is therefore safe under concurrency **without any application-level
locking** — this is precisely why docs/50 §10 designed it as an append-only ledger
rather than an in-place counter in the first place.

**What Sheets does not guarantee:** any *cached/derived* value written back to
`InventoryItem.quantity_on_hand` (or any other read-modify-write sequence, e.g.
`CarePlan.gs`'s existing supersede pattern) is exposed to a lost-update race: two
concurrent executions can each read the same stale cached value, each independently
derive a "new" value, and the second `setValue()` silently overwrites the first,
losing that update — a real correctness bug for a stock quantity, not a cosmetic one.

**Required mitigation (Part 19):** any code path in WPI-7 that reads-then-writes a
cached/derived field (as opposed to a pure `appendRow()`) must wrap that sequence in
`LockService.getScriptLock()` (`tryLock`/`releaseLock`), the same primitive Apps Script
already provides and this codebase has simply never yet needed. This is additive —
introducing the platform's first use of `LockService` inside a new WPI-7 file, never a
change to `FoundationDataStore.gs` itself (docs/53 §6's frozen-file discipline is
unaffected; `LockService` is a new call site, not a modification to shared
infrastructure).

# 8. Concurrent Access Analysis

At today's actual deployment scale — one clinic, a handful of doctors/staff (docs/50
§7.4's own "single-doctor-per-specialty... today's actual scale" finding) — true
simultaneous writes to the *same* `InventoryItem` row are low-probability but not
negligible: two staff members restocking or dispensing the same SKU within the same
few-hundred-millisecond window is a realistic pilot-scale event, not an edge case
reserved for "production scale." No load-testing or concurrency-testing harness exists
in `validation/` today (confirmed: the existing suites are conformance and regression
checks against sequential, single-actor scenarios, not concurrent-writer simulations) —
disclosed as a genuine gap, not silently assumed away. **This gap does not block WPI-7**
(Part 20) provided the locking mitigation (Part 7) ships with it; it does mean WPI-7's
own validation pass (docs/53 §7) should include at least one explicit concurrent-write
test exercising the lock, not just sequential-path coverage.

# 9. Read Performance

`foundationDsQuery_`/`foundationDsGetById_` cost is O(rows) Sheets-API cell reads plus
O(rows) in-memory JS filtering per call, with **no caching between calls** — each
request re-reads the full range from Sheets. At current entity row counts across the
whole platform (dozens to low hundreds of rows per sheet, per Part 2.1's tab list),
this executes in well under a second — not a concern today. It degrades **linearly**
with row count; the two sheets whose row count grows with *event volume rather than
patient/doctor count* — `InventoryTransaction` (this batch) and `Notification`
(WPI-6, already shipped) — are the platform's fastest-growing tabs and the ones whose
read cost will be felt first (Part 14's thresholds target these two specifically).

# 10. Write Performance

`appendRow()` is O(1) amortized per call — the dominant write shape for every
append-only entity (`InventoryTransaction`, `Notification`, and every first-version
row of `CarePlan`). `foundationDsUpdateById_` is O(rows) (a full ID-column scan to
locate the target row) plus one `setValue()` per changed field — `CarePlan.gs`'s
supersede-then-append pattern pays this cost once per new version; `InventoryItem`
would pay it once per `status`/`reorder_threshold` edit (rare) but, per docs/50 §10's
own design, **never** for `quantity_on_hand` itself, which is derived, not written
directly — this is a deliberate performance property of the design, not incidental.

---

# 11. Growth Projection

**Assumptions, stated explicitly (single-clinic pilot, per docs/50 §6.1's one-specialty
seeding and docs/50 §7.4's single-doctor-per-specialty actual scale) — not a product
commitment, a capacity-planning input:**

| Sheet | Driver | Year 1 estimate | Year 5 estimate (5x patient growth, same clinic) |
|---|---|---|---|
| `Patients` | New patient signups | ~500 rows | ~2,500 rows |
| `Appointments` | Bookings | ~1,500–3,000 rows | ~7,500–15,000 rows |
| `Notifications` | Every send (login, visit-summary, appointment, inventory, pillfill) | ~5,000–10,000 rows | ~25,000–50,000 rows |
| `InventoryItem` | SKU catalog | ~100–300 rows (near-static) | ~150–400 rows |
| `InventoryTransaction` | Every restock/dispense/adjustment | ~3,500–18,000 rows (10–50/day) | ~18,000–90,000 rows |
| `CheckInResponses`/`CalculatorResults` | Existing PXP-5/PXP-6 usage, unaffected by WPI-7 | Existing trend, unchanged by this batch | Existing trend, unchanged by this batch |

**Reading this table:** even at the Year 5 high end, every sheet remains one to two
orders of magnitude below Part 5's 10M-cell spreadsheet-wide ceiling. The binding
concern is not the cell ceiling — it is **read-latency degradation** (Part 9) on
`InventoryTransaction`/`Notification` specifically as they cross the tens-of-thousands-
of-rows range, which Year 5's high end approaches but Year 1 does not.

# 12. Failure Modes

1. **Lost-update race** on `InventoryItem.quantity_on_hand` (or any other cached/derived
   field) absent locking (Part 7) — silent, incorrect stock counts; the most serious
   failure mode this review identifies, and the one WPI-7 must mitigate before shipping.
2. **Header drift.** Already guarded today: `foundationDsGetOrCreateSheet_` throws
   loudly if a sheet's live header no longer matches the expected column list — this
   protection is inherited by `InventoryItem`/`InventoryTransaction` automatically, no
   new work required.
3. **Execution timeout (6 min, Part 6)** on a full-table scan — not reachable at Year 1
   or Year 5 projected row counts (Part 11) for any single sheet at current per-row
   read speeds, but becomes reachable if a future Analytics report (WPI-9) joins
   several already-large sheets in one execution without pagination.
4. **Append contention under bursty concurrent writes** — mitigated for free by Sheets'
   own `appendRow()` serialization (Part 7); not a real failure mode for the ledger
   itself.
5. **Cell-limit exhaustion** — the two unbounded, event-driven ledgers
   (`InventoryTransaction`, `Notification`) are structurally the first sheets that
   could ever approach this, and only at a multi-decade time horizon under Part 11's
   assumptions — named for completeness, not a near-term concern.

# 13. Recovery Strategy

`InventoryTransaction`'s append-only, `quantity_on_hand`-is-derived design (docs/50
§10) is itself a recovery mechanism, not just a write-safety one: **a miscounted or
corrupted cached `quantity_on_hand` is always recoverable by replaying the ledger from
its `change_qty` rows** — the same reason an accounting ledger is preferred over a
single running-total field. Beyond that:
- **Google Sheets' native version history** (Google Workspace revision history) already
  covers accidental bulk edits/deletions — no additional recovery infrastructure is
  proposed or required by this review.
- **No new backup mechanism is recommended.** Introducing one would itself be new
  infrastructure beyond this review's documentation-only scope (Phase D) and beyond
  WPI-7's own docs/50 §10 scope — named as a future consideration if real operational
  need emerges, not built speculatively here.

---

# 14. Operational Thresholds

Concrete row-count zones, per sheet, for the two fastest-growing tabs this batch and
WPI-9 introduce load against (every other existing sheet remains at Part 2.1's stable,
low-growth pace and is not separately zoned here):

| Sheet | Green (no action) | Yellow (monitor, consider read optimization) | Red (migration planning required) |
|---|---|---|---|
| `InventoryTransaction` | < 25,000 rows | 25,000–100,000 rows | > 100,000 rows |
| `Notification` | < 25,000 rows | 25,000–100,000 rows | > 100,000 rows |
| Any other single sheet | < 50,000 rows | 50,000–150,000 rows | > 150,000 rows |

These thresholds are set well below Part 5's 10M-cell spreadsheet-wide ceiling
deliberately — they target the point where `foundationDsQuery_`'s full-scan read cost
(Part 9) becomes noticeable to a doctor/staff user, a much tighter constraint in
practice than the platform's absolute storage ceiling.

# 15. Monitoring Strategy

No row-count or performance monitoring exists today (confirmed: no dashboard, counter,
or logging of Sheets read/write latency anywhere in the repo). **Recommended, not
implemented by this documentation-only review:** a lightweight, manually-run or
quarterly-scheduled Apps Script check reading `sheet.getLastRow()` for
`InventoryTransaction` and `Notification` specifically, logged for trend tracking —
the same low-cost, additive spirit as `Retention.gs`'s existing time-driven trigger
pattern, were it to be built. Building this is explicitly **out of scope for this
review** (Phase D: documentation only) and is not required before WPI-7 begins; it is
named here as a future-batch candidate, not a blocking requirement.

# 16. Migration Triggers

Directly answers ADR-006's own deferred "Future Considerations" ask — a concrete,
numeric migration trigger, not a vague "someday":

**Migrate `InventoryTransaction`, `Notification`, or any individual sheet off Google
Sheets (per ADR-006's "design for migration to SQL without changing frontend APIs")
when any one of the following is first true:**
1. Any single sheet crosses **100,000 rows** (Part 14's Red zone).
2. A production execution genuinely times out (Part 6's 6-minute ceiling) on a
   read path that is not itself a bug (i.e., not fixable by narrowing the query/
   predicate).
3. A real, observed lost-update collision occurs on a cached/derived field in
   production despite Part 7's locking mitigation being in place — a signal that
   write concurrency itself, not just a missing lock, has outgrown Sheets.
4. Doctor/staff-reported dashboard latency (any analytics or inventory view) regularly
   exceeds ~5 seconds under normal single-clinic load.

None of these is close to being met at Part 11's Year 1 or Year 5 projections — this
is a **forward-looking trigger set**, not a statement that migration is imminent.

# 17. Risk Matrix

| Risk | Likelihood (pilot scale) | Impact | Mitigation |
|---|---|---|---|
| Lost-update race on cached `quantity_on_hand` | Medium (real once WPI-8 lands) | High (incorrect stock) | `LockService` around every read-modify-write sequence (Part 7, Part 19) |
| Read-latency growth on `InventoryTransaction`/`Notification` | Low at Year 1, Medium by Year 5 | Medium (slower dashboard, not incorrect data) | Part 14 thresholds; revisit indexing/pagination at Yellow zone |
| Execution timeout on a large aggregate scan (WPI-9) | Low at current row counts | Medium (failed report load) | Scope Analytics reports to bounded date ranges/pagination when WPI-9 is scoped |
| Cell-ceiling exhaustion | Very low (decades out at current growth) | High if ever reached | Part 16's numeric migration triggers |
| Unmonitored growth (no current visibility) | Certain (true today) | Low today, compounds silently | Part 15's recommended (not required) monitoring |

# 18. Recommendations

1. **Adopt `LockService` in WPI-7's own new Apps Script file(s)** for every
   read-modify-write sequence touching `InventoryItem.quantity_on_hand` or any other
   cached/derived field — the platform's first use of this primitive, additive only,
   zero change to `FoundationDataStore.gs` or any other frozen file.
2. **Keep `InventoryTransaction` strictly append-only**, exactly as docs/50 §10 already
   designs it — the append-only shape is what makes Part 7's locking concern narrow
   (only the derived-cache write, never the ledger itself) rather than platform-wide.
3. **Do not add caching, indexing, or a query language to `FoundationDataStore.gs`**
   as part of WPI-7 — that would be new infrastructure disguised as an Inventory
   feature, contrary to docs/53 §3/§6's "never hardcode... no hidden architecture
   changes" discipline; Part 14's thresholds are not yet crossed, so this optimization
   is not yet earned.
4. **WPI-9 (Analytics) should scope its own reports to bounded ranges** (e.g. a rolling
   window, not "all history") when it is separately approved — named here as a
   forward constraint on that future batch, not decided or designed by this review.

# 19. Required Mitigations

For WPI-7 (Inventory) to be considered Done under docs/53 §11, in addition to every
other §5–§7 requirement, the following — surfaced by this review — must also hold:
- Every write path that reads and then writes a cached/derived value (at minimum,
  wherever `quantity_on_hand` is recomputed) is wrapped in `LockService`.
- `InventoryTransaction` remains append-only with no `updateById`/patch call anywhere
  in its own implementation.
- At least one concurrent-write scenario is exercised by WPI-7's own validation pass
  (docs/53 §7), closing Part 8's disclosed testing gap for this entity specifically.

These are process constraints on WPI-7's own future implementation, not implemented by
this documentation-only batch.

# 20. Final Verdict

**Is Google Sheets sufficient for WPI-7 (Inventory) and WPI-9 (Analytics) at clinic
launch and through Year 1?** Yes — every projected row count (Part 11) sits far below
both the spreadsheet-wide cell ceiling (Part 5) and Part 14's Yellow-zone thresholds;
Apps Script's execution/quota ceilings (Part 6) are not approached by this workload.
**Green zone.**

**Through Year 5, at the stated growth assumptions?** Conditionally yes —
`InventoryTransaction`/`Notification` approach, but do not cross, Part 14's Yellow zone
at the high end of Part 11's projection; still well short of Red. **Yellow-adjacent,
not Red** — worth re-running this review's Part 11 projection against real observed
growth once a year or two of real data exists, rather than assuming the Year 5 estimate
holds unchanged.

**Is Sheets architecturally sufficient forever?** No, and this review does not claim
otherwise — ADR-006 never committed to that, and Part 16 names the concrete numeric
triggers at which migration planning becomes required, satisfying ADR-006's own
deferred ask.

**Conditional on Part 19's Required Mitigations shipping as part of WPI-7 itself**
(not deferred to a later batch), this review's verdict is:

**The mandatory Sheets-at-production-scale gate for WPI-7 and WPI-9, named by docs/49
§7, docs/51 Part 3 item 1/Part 5, and docs/52, is satisfied by this document.** WPI-7
may proceed to its own separate, explicit approval per docs/53 §13 — this review clears
the named pre-condition; it does not itself authorize WPI-7 to begin, and WPI-9 still
requires its own re-check of this review's Part 4/Part 11 projections once WPI-7's real
`InventoryTransaction` write volume is observed, not assumed, at that later point.

---

# Relationship to Other Documents

This document does not restate docs/49's architecture, docs/50's entity design, or
docs/53's process rules — it is the dedicated capacity review each of those names as an
outstanding pre-condition for WPI-7/WPI-9 specifically, and closes it. Where this
document's projections (Part 11) turn out to be wrong once real data exists, the
correction is an update to this document's own numbers, not a reopening of docs/49/50's
domain architecture, which this review does not touch.

**This document does not authorize WPI-7, WPI-9, or any other batch to begin.**
Implementation still starts only on its own separate, explicit approval, per docs/53
§13.
