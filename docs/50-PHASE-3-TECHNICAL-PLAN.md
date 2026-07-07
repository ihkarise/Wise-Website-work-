# 50 - Phase 3 Technical Plan
## WHIMS Patient Intelligence Platform — Version 1.0 — 2026-07-16

> Detailed architecture for every pillar and consumer docs/49 names. Governed by
> docs/30-ARCHITECTURE-PRINCIPLES.md, the full ADR set (docs/31, now through ADR-020),
> and docs/33-DOMAIN-MODEL.md as the canonical entity reference (this document
> describes *how* each entity would be implemented; docs/33 remains canonical for
> *what it means*, per docs/34 Part 1.6's already-established convention). No code,
> schema, or Apps Script module is created by this document. Mirrors docs/44's own
> structure so a future implementer reads one familiar shape regardless of which
> phase's technical plan they are in.

---

# 0. Framing

docs/49 established four pillars (Doctor Identity & Access, Doctor-Facing
Registry-Driven Capabilities, Specialty-Scoped Extensibility, Reserved AI/Advanced
Extension Points) and three consumers (Inventory, PillFill Integration, Analytics),
plus two named-but-unscoped future items (AI Assistant, Holoscan). This document gives
each a concrete, field-level design, in the same "infrastructure before features"
sequencing docs/44 §22 already proved out for Phase 2B.

---

# 1. Objectives

1. Give doctors a real, authenticated identity and session — closing the gap named at
   every Phase 2B doctor-owned entity's own status update (docs/33 §1.4).
2. Give doctors a real, registry-driven dashboard — replacing manually-run Apps Script
   editor functions with an authenticated Web App surface, without changing any
   existing entity's schema.
3. Make specialty-scoping a first-class, optional dimension of every registry, so a
   future specialty can be onboarded through configuration alone.
4. Close two long-carried domain-model gaps (Appointment, Notification, docs/34 Part 3)
   now that Doctor Identity and a Doctor Dashboard make both genuinely useful rather
   than speculative.
5. Design Inventory and PillFill Integration as consumers of Doctor Instruction
   (docs/33 §2.3), never as a parallel, disconnected system.
6. Design Analytics as a computed, read-only, non-AI aggregate view — the same
   "never a base table" discipline ADR-004 already established for the Digital Twin.
7. Reserve, name, and explicitly not scope AI Assistant and Holoscan, per ADR-019.

---

# 2. Scope

## 2.1 In Scope
- Doctor Identity, Doctor Session, Doctor Login Tokens (§5).
- Specialty Registry (§6).
- Doctor Module Registry and Doctor Dashboard (§7).
- Appointment (§8).
- Notification (§9).
- Inventory: `InventoryItem`, `InventoryTransaction` (§10).
- PillFill Integration: `PillFillOrder` (§11).
- Analytics (computed view, §12).
- Reserved extension points for AI Assistant and Holoscan — named, not designed (§13).

## 2.2 Out of Scope
- Any AI behavior, prompt, model integration, or inference path (ADR-001/004/005/013/019).
- Holoscan's actual feature scope — undefined by any existing document (docs/49 §9).
- Phase 2C (Health Milestones) and Phase 2D (Digital Twin & AI Summaries) — both remain
  separately approvable, untouched by this plan.
- Any change to a frozen Phase 2A or Phase 2B file, schema, or dispatch contract beyond
  the additive, disclosed exceptions named in §4.
- The Sheets → SQL migration decision (docs/49 §7) — flagged, not decided, here.
- Optional PIN (`PatientCredential`) — remains its own, independently-gated, still-open
  item (docs/45 Part 5, docs/48 §7), unrelated to and unresolved by this plan.

## 2.3 Explicit Non-Goals
- Doctor Identity is never merged with Patient Identity (ADR-017).
- The Doctor Module Registry never merges with, or replaces, the existing patient-facing
  Module Registry (ADR-020).
- No doctor-facing or patient-facing capability is ever exposed by a hardcoded branch
  keyed on specialty, condition, or disease — only by a registry entry (docs/47 §3,
  extended by ADR-018).

---

# 3. Relationship to Existing (Frozen) Architecture

Every mechanism below is additive. Concretely, this plan touches **zero** lines in:
`apps-script/Foundation*.gs`, `apps-script/PatientIdentity.gs`,
`apps-script/DoctorAssignedCondition.gs`, `apps-script/ModuleRegistry.gs`,
`apps-script/PatientModuleState.gs`, `apps-script/TemplateRegistry.gs`,
`apps-script/CalculatorRegistry.gs`, `apps-script/CarePlan.gs`,
`apps-script/DoctorInstruction.gs`, `apps-script/TrustedDevice.gs`, or any
`shared/schemas/*.schema.json`/`shared/constants/*.json` file Phase 2A or Phase 2B
shipped. Every new entity is a new file; every registry extension (`specialty_scope`,
ADR-018) is a new, optional field, never a change to an existing field's meaning.

---

# 4. Core Architectural Pillars — Field-Level Detail

## 4.1 Doctor-Owned Configuration, Reaffirmed (docs/49 §5)
Unchanged. This plan only adds the authenticated surface; it never changes who is
authorized to configure a condition assignment, a module/calculator/template
enablement, or a care plan.

## 4.2 Consumer Map, Restated With Entities
```
Doctor Identity (§5) ──┬──> Doctor Session (§5)
                        └──> Doctor Module Registry + Doctor Dashboard (§7)
                                   │
Specialty Registry (§6) ──────────┤ (scopes registry entries, ADR-018)
                                   │
                                   ├──> Appointment (§8)
                                   ├──> Notification (§9)
                                   ├──> Inventory (§10)
                                   ├──> PillFill Integration (§11) ──(reads)──> Doctor Instruction (existing)
                                   └──> Analytics (§12) ──(reads)──> every existing patient/doctor entity
```

---

# 5. Doctor Identity & Session Architecture (Pillar 1, ADR-017)

## 5.1 `DoctorIdentity`
Minimal, permanent, technical identity — mirrors `PatientIdentity` (docs/33 §1.2)
exactly in spirit.

**Attributes:** `doctor_id` (UUID, generated once, never reused), `created_at`.

**Lifecycle:** Created once, by staff/administrative provisioning — never public
self-registration, the same unconditional rule ADR-002/docs/09 already established for
patients (§0.1 of docs/33). Immutable for the life of the platform relationship.

## 5.2 `Doctor` (profile)
Mirrors `Patient` (docs/33 §1.1) — the durable identity's attached profile data.

**Attributes:** `full_name`, `role` (`physician`/`staff`), `email`, `specialty_slug`
(references Specialty Registry, §6; optional — a doctor with no specialty set is
scoped to the implicit default, same as an unscoped registry entry), `status`
(`active`/`inactive`), `created_by`, `created_at`.

**Relationships:** Wraps exactly one `DoctorIdentity` (1:1). Referenced by
`doctor_id` from every doctor-owned Phase 2B entity's write path, once each is
individually migrated to it (§16).

**Ownership:** Staff/administrative provisioning only — mirrors `Patient`'s own
ownership model exactly.

## 5.3 `DoctorSession`
Mirrors `Session` (docs/33 §1.3) — a self-verifying, HMAC-signed payload of
`{doctor_id, issued_at, expires_at}`. **Reuses `FoundationSession.gs`'s existing
signing primitives without modifying that file** — the same "zero lines changed in a
frozen file" pattern `TrustedDevice.gs`'s Long-Lived Session already proved out at
Batch PXP-8. A new, additive `DoctorSession.gs`-equivalent module wraps the same
primitives with a `doctor_id` subject instead of `patient_id`.

## 5.4 `DoctorLoginToken`
Mirrors `LoginTokens` (docs/33 §1.3) — single-use, hashed, expiring — issued via
email magic link exactly as ADR-003 already establishes for patients. No new
authentication paradigm; the same passwordless mechanism, a second, independent
identity space consuming it.

## 5.5 Why not extend `Session`/`LoginTokens` in place
Widening the frozen `session.schema.json`/`FoundationSession.gs` to carry a
polymorphic `subject_type` would touch a frozen Phase 2A file for new functionality,
not a bug fix — exactly the kind of change docs/43 §12 and docs/47 §6 require to be a
disclosed, justified exception rather than a silent one. A new, parallel,
additive module costs one small duplication (two session-issuance code paths sharing
one signing primitive) in exchange for zero risk to Phase 2A's frozen, conformance-
tested session contract — the same trade-off `TrustedDevice.gs` already made
deliberately at PXP-8 rather than touching `FoundationSession.gs`.

---

# 6. Specialty Registry Architecture (Pillar 3, ADR-018)

## 6.1 `Specialty` (config-level list, mirrors Module Registry's own config shape)
`shared/constants/specialty-registry.json`-equivalent: a versioned list of specialty
descriptors.

**Attributes:** `specialty_slug` (stable identifier — "the slug is the ID," the same
principle docs/20 §5 already established for condition taxonomy), `display_name`,
`status` (`active`/`retired`).

**Seeding:** Ships with exactly one entry — the platform's current, implicit
specialty (homeopathy) — named explicitly for the first time rather than left
implicit. No second specialty is seeded; onboarding one is a future, separately
approved product decision, never assumed by this plan.

## 6.2 `specialty_scope` field (added to existing registries)
An optional field added to Module Registry entries, Calculator Registry entries,
Template Registry entries, and Doctor Module Registry entries (§7). Absent
`specialty_scope` — every existing entry, unchanged — means "visible regardless of
specialty" (today's actual, if previously unstated, behavior). Present, it means
"visible only to a doctor/patient associated with this specialty."

## 6.3 Where a patient's or doctor's specialty is derived
- A **Doctor**'s specialty is `Doctor.specialty_slug` (§5.2) directly.
- A **Patient**'s effective specialty, for the purpose of registry filtering, is
  derived from their active `DoctorAssignedCondition` entries' condition-to-specialty
  mapping (a small, additive lookup table this plan introduces alongside the Specialty
  Registry — not a change to `DoctorAssignedCondition`'s own schema). A patient with no
  specialty-mapped condition is treated as the implicit default specialty, matching
  today's actual behavior exactly.

---

# 7. Doctor Module Registry and Doctor Dashboard (Pillar 2, ADR-020)

## 7.1 Doctor Module Registry (backend, config)
Structurally parallel to Module Registry (docs/33 §6.3) — a config-level list of
available doctor-facing capabilities.

**Attributes:** `capability_key` (e.g. `patient_roster`, `condition_assignment`,
`care_plan_authoring`, `module_state_management`, `inventory`, `pillfill_orders`,
`analytics`), `display_name`, `display_order`, `data_source` (loader key, mirroring
Module Registry's own field), `specialty_scope` (optional, §6.2), an inert
AI-compatibility field (ADR-019).

**Seeding:** Illustrative categories only, not a batch commitment — mirrors exactly how
Module Registry originally seeded only the three already-implemented Phase 2A
capabilities and let later batches add their own entries (docs/33 §6.3). This plan
does not decide which capability ships in which WPI batch beyond the sequencing in
§19; it only reserves the mechanism.

## 7.2 `DoctorModuleState` (per-doctor enablement)
Structurally parallel to `PatientModuleState` (docs/33 §6.3) — fail-closed by absence
of a row (ADR-010), enabled/disabled per doctor, never automatic from `Doctor.role` or
`Doctor.specialty_slug` alone (mirroring docs/44 §14's "never automatic from a
condition assignment" rule, applied here to role/specialty instead of condition).

## 7.3 Doctor Dashboard (frontend consumer)
A new, authenticated, doctor-facing page — structurally parallel to
`my-health-journey/dashboard.js`'s post-PXP-4 registry-driven rendering. Every card
corresponds to a Doctor Module Registry entry the doctor is enabled for; no
hardcoded per-capability rendering logic, mirroring `renderDashboard()`'s existing
discipline exactly (docs/47 §3).

## 7.4 Patient roster — derived, not a new entity

The doctor's patient roster is **derived**, not a new stored entity: patients with an
active `DoctorAssignedCondition` whose condition maps to the doctor's
`specialty_slug` (§6.3), read-only. No new "assignment" entity is introduced for
roster purposes — this keeps the roster mechanism as simple as the data already
supports.

**Disclosed limitation (docs/51 Part 1.6):** at real multi-doctor-per-specialty scale —
more than one doctor sharing a single specialty, which "production-scale architecture"
explicitly anticipates — this derivation returns *every* patient in the specialty to
*every* doctor in that specialty, not a personal, per-doctor roster. It cannot
distinguish "this specialty treats this patient" from "this specific doctor personally
treats this patient." This is accepted as this plan's scope, not silently assumed
away: a single-doctor-per-specialty deployment (the platform's actual scale today) sees
no practical difference; a multi-doctor-per-specialty deployment would see every peer
doctor's patients too, until a future batch closes this gap.

**Future consideration, not decided here:** if a real need for direct,
condition-independent, per-doctor patient assignment emerges (e.g., two doctors sharing
one specialty who each need their own roster, or a front-desk staff role that needs a
roster unrelated to any condition), that would be a small, additive
`DoctorPatientAssignment`-shaped entity for a future batch to scope — not invented
speculatively now, and not required for WPI-4 to ship a correct, if coarse, roster at
today's actual single-doctor scale.

---

# 8. Appointment Architecture

Promotes docs/33 §4.1 from *Conceptual (gap)* to *Designed*, per docs/34 Part 4's own
recommendation ("scoped alongside or shortly after Phase 2B... the strongest candidate
for a near-term future phase").

**Attributes:** `appointment_id` (UUID), `patient_id` (nullable — a first-time visitor
booking has no Patient Identity yet, per docs/33 §4.1's own note), `doctor_id`
(nullable until assigned), `requested_at`, `scheduled_at`, `status`
(`requested`/`confirmed`/`completed`/`cancelled`), `condition_slug`, `specialty_slug`.

**Relationships:** Precedes and, once held, becomes the missing link to a
Consultation (docs/33 §2.1) — concretely closing docs/20 §3's "THE GAP" at the data
level for the first time. Visible on the Doctor Dashboard (§7) as a scheduling-adjacent
roster view, not a replacement for it.

**Lifecycle:** Created when a booking-form submission (today: Netlify Forms,
`contact.html`) is accepted into the platform's own data — the exact mechanism for
that intake (a new staff-run tool vs. a direct public-facing write) is an
implementation-time decision for the batch that builds this, not decided here, mirroring
how docs/44 §22 left analogous plumbing decisions to implementation.

**Ownership:** Staff/doctor-facing only in this plan's scope — no patient-facing
Appointment UI is designed here; that remains a future, separately-scoped extension
once Appointment itself exists and is proven.

---

# 9. Notification Architecture

Promotes docs/33 §4.2 from *Conceptual (gap)* to *Designed*. docs/34 Part 4's own
"revisit only when a third independent flow is proposed" trigger has now been passed:
Phase 1.5's visit-summary email, docs/29's login-link email, and this plan's own
Inventory low-stock alert (§10) and PillFill order-status update (§11) bring the count
to four independent, ad hoc flows if none is unified.

**Attributes:** `notification_id`, subject reference (`patient_id` or `doctor_id`),
`channel` (`email` today; extensible), `type`
(`login_link`/`visit_summary`/`appointment_reminder`/`inventory_low_stock`/
`pillfill_order_status`), `status` (`sent`/`failed`/`read`), `sent_at`.

**Relationships:** Produced by any of the flows named above. Does not replace any
existing send mechanism's own transport code (`Email.gs`, the login-link mailer) — it
is a shared *record* of what was sent, not a new delivery pipeline; each existing
sender writes a Notification row in addition to its own existing behavior, mirroring
`ADR-009`'s "swap one module without touching its callers" principle applied to
logging rather than transport.

**Ownership:** System-generated only, mirroring Session's own ownership model.

---

# 10. Inventory Architecture

**`InventoryItem`** — `inventory_item_id` (UUID), `name`, `sku`, `unit`,
`quantity_on_hand`, `reorder_threshold`, `specialty_scope` (optional, §6.2), `status`
(`active`/`retired`).

**`InventoryTransaction`** — an append-only ledger, mirroring `CarePlan`'s own
append-only-versioning discipline rather than in-place mutation of
`quantity_on_hand`: `transaction_id`, `inventory_item_id`, `change_qty` (signed),
`reason` (`restock`/`dispense`/`adjustment`), `reference_id` (optional — e.g. a
`PillFillOrder.order_id`, §11), `created_by` (`doctor_id`), `created_at`.
`quantity_on_hand` is a derived/cached value, recomputed from the transaction ledger,
never the sole source of truth — the same "never trust a mutable running total alone"
discipline an auditable stock system requires.

**Relationships:** An `InventoryTransaction` of reason `dispense` is created when a
`PillFillOrder` (§11) is fulfilled, drawing down the referenced `InventoryItem`.

**Ownership:** Doctor/staff-facing only, exposed through the Doctor Dashboard's
`inventory` capability (§7.1) — never patient-facing.

**Trigger for low-stock Notification (§9):** When a transaction leaves
`quantity_on_hand` at or below `reorder_threshold`, an `inventory_low_stock`
Notification is produced — a deterministic, non-AI rule, not a predictive or
AI-generated reorder suggestion (which would require the ADR-001/004/005/013 gate this
plan explicitly does not cross).

---

# 11. PillFill Integration Architecture

**`PillFillOrder`** — `order_id` (UUID), `patient_id`, `doctor_instruction_id`
(references the specific `medicine`-type `DoctorInstruction` this order fulfills, per
docs/33 §2.3's own "Prescription is a `medicine`-type Doctor Instruction" mapping),
`inventory_item_id`, `quantity`, `status`
(`requested`/`in_progress`/`fulfilled`/`shipped`/`delivered`/`cancelled`),
`created_at`, `fulfilled_at`.

**Relationships:** Belongs to one `DoctorInstruction` and one `Patient Identity`.
Fulfillment creates an `InventoryTransaction` (reason `dispense`, §10) and a
`pillfill_order_status` Notification (§9) — reusing both mechanisms rather than
inventing parallel ones.

**Ownership:** Doctor/staff-created and -updated (mirrors `DoctorInstruction`'s own
"doctor/staff-owned, patient never edits" boundary, docs/33 §2.3). A patient-facing,
read-only order-status view is a plausible future extension of the existing patient
dashboard (a new Module Registry entry, ADR-012 — not this plan's scope) once
PillFill Integration itself has shipped and proven stable.

**What "PillFill Integration" does not mean in this plan:** No external PillFill
system API, webhook, or vendor integration contract is designed here — this plan
scopes the platform's own internal order-and-fulfillment record only. Any actual
external system integration is an implementation-time detail for whichever future
batch builds this, informed by real operational requirements not yet gathered, the
same "plumbing decided at implementation time" deferral already used for Appointment's
intake mechanism (§8).

---

# 12. Analytics Architecture

Not a stored entity — a **computed, read-only aggregate view**, mirroring Digital
Twin's own "never a base table" discipline (docs/33 §3.5, ADR-004's spirit extended by
analogy to a non-clinical, non-patient-narrative context). Reads across every existing
patient- and doctor-facing entity: `CheckInResponse`, `CalculatorResult`, `CarePlan`,
`DoctorAssignedCondition`, `InventoryTransaction`, `PillFillOrder`, `Appointment`.

**Illustrative report categories (not a batch commitment — mirrors docs/44 §13.2's own
"illustrative module categories, not a fixed or final list" framing):** check-in
completion rates, care-plan adherence trends, module/calculator engagement,
inventory turnover, appointment-to-consultation conversion.

**Hard boundary:** Every report is a deterministic aggregation (counts, sums,
rates, trends over existing stored values) — **never** an AI-generated interpretation,
prediction, or recommendation. Any future AI-assisted analytics narrative is
independently gated by ADR-001/004/005/019, exactly like every other AI extension
point this plan reserves but does not build.

**Ownership:** Doctor/staff-facing only, exposed through the Doctor Dashboard's
`analytics` capability (§7.1) — never patient-facing in this plan's scope.

---

# 13. Reserved AI & Advanced-Capability Extension Points

Per ADR-019 and docs/49 §9: **AI Assistant and Holoscan are named, not designed, by
this document.** Every registry this plan introduces (Doctor Module Registry, §7.1;
Specialty Registry entries where applicable) carries the same inert
AI-compatibility field docs/44 §7.1/§8.1/§11.5 already established — reserved, never
populated, never read by any code this plan describes. No technical design for either
item exists anywhere in this document; each requires its own future, separately
approved architecture-freeze pass once its actual scope is defined.

---

# 14. Security Model

- **Doctor Session mirrors Patient Session's security posture exactly:** bounded
  lifetime, HMAC-signed, never trusted from client-supplied input, session expiration
  enforced plainly (ADR-010, docs/15).
- **Fail-closed enablement** governs the Doctor Module Registry exactly as it governs
  the patient-facing one (ADR-010, §7.2).
- **No cross-identity-type authorization confusion:** a Doctor Session can never
  authorize a Patient-scoped route, and vice versa — enforced by the two sessions
  carrying structurally distinct, non-overlapping subject fields (`doctor_id` vs.
  `patient_id`), never a shared, ambiguous "user id."
- **Inventory and PillFill writes are doctor/staff-authenticated only** — no
  patient-facing write path exists anywhere in this plan's scope for either.
- A dedicated security review of the Doctor Session mechanism, mirroring the review
  already performed for Trusted Device + Long-Lived Session (docs/15, Batch PXP-8), is
  required before any WPI batch implementing it ships — named here as a gate, not
  performed by this document (mirrors docs/34 Part 5's own "before Batch 5B
  specifically" gate pattern).

---

# 15. Data Architecture — New Entities Summary

| Entity | Status (this plan) | Pillar/Consumer | Full detail |
|---|---|---|---|
| `DoctorIdentity` | Designed | Pillar 1 | §5.1 |
| `Doctor` | Designed | Pillar 1 | §5.2 |
| `DoctorSession` | Designed | Pillar 1 | §5.3 |
| `DoctorLoginToken` | Designed | Pillar 1 | §5.4 |
| `Specialty` | Designed | Pillar 3 | §6.1 |
| Doctor Module Registry | Designed | Pillar 2 | §7.1 |
| `DoctorModuleState` | Designed | Pillar 2 | §7.2 |
| `Appointment` | Designed (promoted from Conceptual) | Consumer | §8 |
| `Notification` | Designed (promoted from Conceptual) | Consumer | §9 |
| `InventoryItem` | Designed | Consumer | §10 |
| `InventoryTransaction` | Designed | Consumer | §10 |
| `PillFillOrder` | Designed | Consumer | §11 |
| Analytics | Conceptual (computed view, never a base table) | Consumer | §12 |

None of these is *Implemented* by this plan — "Designed" here means the same thing it
means in docs/33: schema-level shape agreed, awaiting its own approved batch, per
docs/53's per-batch gate.

---

# 16. Migration From Existing (Frozen) Architecture

No migration of existing data is required by this plan. Every doctor-owned Phase 2B
entity's existing `created_by`/`prescribed_by`/`resolved_by` free-text fields are left
exactly as they are — a future batch may *begin* populating a real `doctor_id`
alongside the existing free-text field for new writes (an additive column, never a
backfill of historical free-text values into a fabricated identity), but no existing
row is rewritten, mirroring `PatientProfile`'s own "no widening of a frozen schema"
discipline (docs/33 §6.1) applied here to doctor-owned entities instead.

---

# 17. Risks

1. **Sheets at production scale** (docs/49 §7) — Inventory's transactional writes and
   Analytics' cross-patient aggregation are the most plausible trigger for ADR-006's
   anticipated SQL migration. Ranked top risk in docs/51.
2. **Two parallel identity/session mechanisms** (Patient, Doctor) increase the
   platform's total authentication surface area — mitigated by both reusing the same
   underlying cryptographic primitives (§5.5) rather than inventing a second paradigm.
3. **Doctor roster derivation (§7.4) may prove too coarse** once real multi-doctor,
   multi-specialty usage exists — deliberately deferred as a future consideration
   rather than solved speculatively.
4. **Holoscan's total absence of defined scope** (docs/49 §9) risks being
   under-examined simply because it is a single bullet point — mitigated by this plan
   explicitly refusing to invent scope for it rather than guessing.
5. **Notification unification (§9) touches four existing/new send flows** — a genuine,
   if modest, cross-cutting change; scoped as its own batch (§19) rather than bundled
   into Inventory or PillFill Integration's own batch.

---

# 18. Documentation Impact

- docs/33-DOMAIN-MODEL.md — Doctor (§1.4), Appointment (§4.1), Notification (§4.2)
  promoted from *Conceptual* to *Designed*; new §7 for Phase 3/WHIMS entities, mirroring
  §6's existing Phase 2B section shape.
- docs/31-ADR-INDEX.md — ADR-017 through ADR-020 added.
- docs/24-ROADMAP.md — Phase 3 entry renamed and reconciled (docs/49 §2, §13 below).
- docs/30-ARCHITECTURE-PRINCIPLES.md — no change required; every principle already
  stated there governs this plan without amendment.
- Root `CHANGELOG.md` — one documentation-only entry for this architecture-freeze pass.

---

# 19. Implementation Batches — Infrastructure First

Following docs/47/docs/44 §22's own "infrastructure before features" sequencing,
batch-named `WPI-` ("WHIMS Patient Intelligence" batch, docs/49 §2):

1. **WPI-1 — Doctor Identity & Session.** `DoctorIdentity`, `Doctor`, `DoctorSession`,
   `DoctorLoginToken` (§5). Zero patient-facing surface. Dependency: none — the
   platform's first doctor-facing infrastructure batch.
2. **WPI-2 — Specialty Registry.** `Specialty` config list, `specialty_scope` field
   added to existing registries (§6). Dependency: none (independent of WPI-1).
3. **WPI-3 — Doctor Module Registry (backend).** Config list + `DoctorModuleState`
   (§7.1–7.2). Dependency: WPI-1 (needs `doctor_id` to key enablement).
4. **WPI-4 — Doctor Dashboard (frontend consumer).** Registry-driven rendering (§7.3),
   patient roster (§7.4). Dependency: WPI-3.
5. **WPI-5 — Appointment.** (§8). Dependency: WPI-1/WPI-4 for doctor-facing visibility,
   though the entity itself could be built patient-identity-only if resequenced later.
6. **WPI-6 — Notification (unification).** (§9). Dependency: none structurally, but
   sequenced after WPI-5 so Appointment's own reminder flow can adopt it from day one
   rather than needing a follow-up migration.
7. **WPI-7 — Inventory.** `InventoryItem`, `InventoryTransaction` (§10). Dependency:
   WPI-4 (Doctor Dashboard capability), WPI-6 (low-stock Notification).
8. **WPI-8 — PillFill Integration.** `PillFillOrder` (§11). Dependency: WPI-7
   (draws down Inventory), the already-shipped `DoctorInstruction` (PXP-7).
9. **WPI-9 — Analytics.** (§12). Dependency: WPI-4, and benefits from WPI-7/WPI-8
   existing (richer reports) but does not strictly require either.
10. **WPI-10 — AI Assistant.** **Reserved, unscoped placeholder** — mirrors PXP-9
    exactly. Not ready for any scoping, per ADR-019.
11. **WPI-11 — Holoscan.** **Reserved, unscoped placeholder.** No existing document
    defines this item's purpose (docs/49 §9); not ready for any scoping at all.
12. **WPI-12 — Closeout.** Validation-suite build-out, documentation closeout,
    repository consistency re-review — mirrors PXP-11's own charter exactly.

**No batch above is authorized to begin by this document.** Per docs/53 §9
(mirroring docs/47 §15's Architecture Freeze → Implementation → Validation → Closeout →
Release discipline), each batch requires its own separate, explicit approval.
