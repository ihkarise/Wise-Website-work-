# 49 - Phase 3 Architecture Review
## WHIMS Patient Intelligence Platform (formerly "WiseOS") — Version 1.0 — 2026-07-16

> Architecture review only. No code changes, no schema changes, no implementation of
> any kind. Written the same way docs/20, docs/32, and docs/44's original freeze pass
> were written: to give a phase that has existed only as an unarchitected roadmap
> bullet list (docs/24's "Phase 3 — WiseOS": Doctor Dashboard, Inventory, PillFill
> Integration, Holoscan, AI Assistant, Analytics) a real architecture before any batch
> is proposed against it. Phase 2B is closed and frozen except for genuine bug fixes
> (docs/48-PHASE-2B-CLOSEOUT.md, tagged `v2.1.0-phase2b`); nothing in that freeze is
> reopened, modified, or contradicted by this document.

---

# 0. Framing — where the product actually is

Phase 2B shipped ten of eleven named batches and closed cleanly (docs/48). docs/24's
own recommendation at that closeout was to take up **Phase 2C — Health Milestones** or
a real **PXP-9 — AI Integration** design next, each requiring its own separate
architecture-freeze pass. **This session's explicit instruction is to begin Phase 3
architecture planning instead, ahead of both.** That is a deliberate reordering, and
this document treats it as one — named and justified, not silently substituted — the
same discipline Batch PXP-10 already established when it shipped ahead of PXP-9 because
docs/44 §22's own dependency column named only "PXP-5 proven in production" as its
prerequisite, not numeric order (docs/24's Phase 2B entry, docs/48 §1).

**Nothing about Phase 2C (Health Milestones) or Phase 2D (Digital Twin & AI Summaries)
is decided, designed, or cancelled by this document.** Both remain exactly as docs/24
and docs/32 Part 2 left them: open, unscoped, and requiring their own separate
architecture-freeze pass whenever they are next taken up. This review is additive to
the roadmap's sequencing, not a replacement of it.

---

# 1. Scope Decision — Why Phase 3 Can Be Reordered Ahead of Phase 2C/2D

The test is the same one PXP-10 was approved against: **dependency order, not numeric
or roadmap-listed order** (docs/44 §22, docs/48 §1). Checking each named Phase 3 item
(docs/24, docs/29 §0's original non-goal list — "WiseOS, doctor dashboard, inventory,
PillFill integration") against Phase 2C/2D:

| Phase 3 item | Depends on Phase 2C (Health Milestones)? | Depends on Phase 2D (Digital Twin & AI)? |
|---|---|---|
| Doctor Dashboard / Doctor Identity | No | No |
| Inventory | No | No |
| PillFill Integration | No | No — depends on Doctor Instruction (§3.4 of docs/33, shipped in PXP-7), not on Digital Twin |
| Analytics | No — reads Phase 2A/2B entities directly | No |
| AI Assistant | No | **Yes, in spirit** — shares the same ADR-001/004/005/013 AI-supervision gate Phase 2D requires |
| Holoscan | Unknown — no existing document defines this item's scope at all (see §9) | Unknown |

Five of six items have no architectural dependency on Health Milestones or the Digital
Twin. The one item that does share a dependency — AI Assistant — is handled the same
way PXP-9 was handled: **named, not scoped, in this review** (§9, ADR-019). Nothing in
this document builds, designs, or approves an AI Assistant feature.

There is a second, stronger reason to move Doctor Identity forward now rather than
later: **it repays a debt Phase 2B has been carrying since Batch PXP-2.** Every
doctor-owned Phase 2B entity — `DoctorAssignedCondition`, `CarePlan`, `DoctorInstruction`,
`CheckInTemplateAssignment` — was built as a manually-run Apps Script editor function
specifically *because* "no real Doctor identity/authentication exists yet" (docs/33
§1.4, repeated verbatim at every one of those batches' own status updates, and named
again in docs/48 §7 as a carried-forward gap). Phase 3's Doctor Identity work is not a
new, unrelated feature competing with Phase 2C/2D for priority — it is the
infrastructure every already-shipped Phase 2B batch has been quietly waiting on.
Building it now strengthens Phase 2B's own foundation rather than deferring it further.

**Conclusion: Phase 3 architecture planning may proceed now.** Phase 2C and Phase 2D
remain open, fully valid, and untouched — this document does not foreclose either.

---

# 2. Renaming — "WiseOS" → "WHIMS Patient Intelligence Platform"

Per this session's explicit instruction, and following the exact precedent Phase 2B
already set — renamed three times (docs/24: "Personal Care Plan" →
"Personal Care Plan, Module Engine & Personalized Check-ins" → "Wise Patient Experience
Platform") with **no scope change at any rename**, per docs/44's own "What Changed"
notes — this document performs the same kind of rename for Phase 3:

> **"WiseOS" is renamed "WHIMS Patient Intelligence Platform," abbreviated "WHIMS."
> The implementation-batch prefix is `WPI-` ("WHIMS Patient Intelligence" batch),
> mirroring exactly how `PXP-` was derived from "Patient eXperience Platform."**

"WiseOS" is not deleted from the record — docs/21 §"Layer 3", docs/29 §0, docs/32 Part
2, and docs/33 §1.4 all remain historically accurate under the name they used at the
time, the same "keep history, correct the current-status framing" rule docs/48 §5
already applied to stale status tags. docs/24's Phase 3 entry is updated (§13 below,
Task 7) to carry the new name forward; every future document uses "WHIMS" going
forward.

**No scope change from the rename itself.** The six items "WiseOS" already named —
Doctor Dashboard, Inventory, PillFill Integration, Holoscan, AI Assistant, Analytics —
remain exactly what this phase covers. What this review adds is the architecture those
six bullet points never had — the same gap docs/32 Part 2 identified about "Personal
Care Plan" before Phase 2B's own freeze pass gave it one.

---

# 3. Vision — What WHIMS Actually Is

docs/21 §"Layer 3 – WiseOS" already states the intent: *"Empower doctors, reduce
administration, and enable continuous care."* Read against docs/33's Domain Model,
this is not a new mission — it is the **doctor- and operations-facing mirror** of what
Phase 2B already built for patients:

| Patient side (Phase 2B, shipped) | Doctor/operations side (Phase 3, this review) |
|---|---|
| Patient Identity + Session (ADR-002/003) | Doctor Identity + Session (ADR-017, new) |
| Module Registry + Dashboard Registry (ADR-012) | Doctor Module Registry + Doctor Dashboard (ADR-020, new) |
| Calculator Registry (ADR-013) | Analytics reads the same registries and results |
| Template Registry (ADR-016) | (reused as-is — no doctor-side fork needed) |
| Doctor-authored `CarePlan`/`DoctorInstruction`, written via manually-run editor functions | Authored via a real, authenticated Doctor Dashboard once Doctor Identity exists |
| — (no operational/fulfillment layer existed) | Inventory + PillFill Integration (new) |

Every doctor-owned entity Phase 2B already shipped stays exactly as shipped — Phase 3
gives the *doctor* a real, authenticated front door to the same data, replacing the
Apps Script editor menu, not replacing the data model underneath it.

## 3.1 Multi-specialty extensibility — named explicitly for the first time

Every registry ADR to date (ADR-012, ADR-013, ADR-016) was written generically, but
every concrete instance shipped so far — `daily_wellness_checkin`, the empty Calculator
Registry, every condition slug (`hashimotos-thyroiditis`, `mcas`, `chronic-urticaria`)
— is implicitly homeopathy-specific. Nothing forces this; it is simply the only
specialty that has ever populated a registry entry. "Production-scale architecture"
and "multi-specialty use," this session's explicit goals, require stating outright
what was previously only implicit: **a future specialty (e.g., nutrition,
physiotherapy, a second clinic vertical) must be able to populate its own module,
calculator, template, and condition-taxonomy entries without forking platform code.**
This is Pillar 3 below and ADR-018.

---

# 4. Core Architectural Pillars

Following docs/44 §4's own pattern (name a small number of pillars everything else
builds on, rather than a flat feature list), WHIMS rests on **four pillars**:

## Pillar 1 — Doctor Identity & Access (ADR-017)

A durable `doctor_id` identity, structurally parallel to Patient Identity (ADR-002) but
**never merged into it** — a Doctor is not a Patient with a flag; the two identity
spaces stay permanently separate, mirroring Consultation's own "who did this" gap
finding (docs/33 §1.4, docs/34 Part 3). Authentication reuses the platform's existing
passwordless philosophy (ADR-003) rather than inventing a second auth paradigm.

## Pillar 2 — Doctor-Facing Registry-Driven Capabilities (ADR-020)

The Doctor Dashboard is registry-driven from day one — never a hand-built page per
capability — extending ADR-012's already-proven pattern (Module Registry → Dashboard
Registry) to the doctor side instead of re-deriving a second rendering architecture.
Every doctor-facing capability (patient roster, condition assignment, care plan
authoring, inventory view, analytics view) is a Doctor Module Registry entry.

## Pillar 3 — Specialty-Scoped Extensibility (ADR-018)

Every registry-driven mechanism (Module, Calculator, Template, and the new Doctor
Module Registry) gains an optional `specialty_scope` field. A registry entry with no
`specialty_scope` behaves exactly as today (global — the current, sole, implicit
"homeopathy" specialty); a future specialty populates its own scoped entries without
forking the registry mechanism itself. This is additive to ADR-012/013/016 — it does
not amend any of them, the same "complements, does not amend" relationship ADR-016
already has with ADR-012 (docs/31).

## Pillar 4 — Reserved AI & Advanced-Capability Extension Points (ADR-019)

AI Assistant and Holoscan are **named, not scoped.** Every registry already reserves an
AI-compatibility field per docs/44 §7.1/§8.1/§11.5 and docs/47 §2's "AI extension
points only" rule — this pillar makes that rule permanent and platform-wide (not just a
Phase 2B implementation rule) and extends the same discipline to any future
advanced-capability integration, named but unscoped, exactly as PXP-9 was handled.

### 4.1 Consumer map

Inventory, PillFill Integration, and Analytics are **consumers of Pillars 1–3**, not
pillars themselves — mirroring exactly how docs/44 §4.2 treated Personal Care Plan as a
consumer of Doctor-Assigned Conditions and the Module Engine rather than a fifth
pillar:

```
Pillar 1 (Doctor Identity)  ──┬──> Pillar 2 (Doctor Dashboard, registry-driven)
                               │           │
Pillar 3 (Specialty Scope) ───┘           ├──> Inventory
                                            ├──> PillFill Integration
                                            └──> Analytics

Pillar 4 (Reserved AI/Advanced Extension Points) — named, not built, not a dependency
of anything above.
```

---

# 5. Doctor-Owned Configuration — Reaffirmed

docs/44 §4.3's principle — "Doctor configures. Patient consumes." — is unchanged and
fully reaffirmed. WHIMS is where that configuration finally happens through a real,
authenticated interface instead of a Google Sheets-bound editor menu; it does not
change *who* configures anything. Condition assignment, module/calculator/template
enablement, and care-plan authorship remain exactly as doctor/staff-owned as docs/44
§14 and every Phase 2B batch already established — this review adds a front door, not a
new authority.

---

# 6. Relationship to Existing (Frozen) Architecture

**Nothing in Foundation, Identity & Access, Patient Access, or any shipped Phase 2B
batch (PXP-1 through PXP-11) is modified, reopened, or contradicted by this review.**
Every mechanism this document proposes is additive:

- `FoundationSession.gs` remains patient-identity-scoped and frozen (docs/43 §12).
  Doctor authentication is a new, additive `DoctorSession` mechanism that reuses the
  same signing primitives without editing that file — the exact precedent
  `TrustedDevice.gs`'s `foundationIssueLongLivedSessionToken_()` already set at Batch
  PXP-8 ("zero lines changed in `FoundationSession.gs`... reuses that file's own
  unmodified signing primitives," docs/24's Phase 2B entry).
- Module Registry, Calculator Registry, and Template Registry are extended additively
  (a new optional field, `specialty_scope`) — no existing registry entry's shape
  changes, no existing reader breaks (docs/47 §6's "no breaking API changes" rule,
  applied here by analogy even though this is architecture, not yet implementation).
- Every doctor-owned Phase 2B entity (`DoctorAssignedCondition`, `CarePlan`,
  `DoctorInstruction`, `CheckInTemplateAssignment`) keeps its existing schema; only its
  *write path* gains a real authenticated route once Doctor Identity exists, alongside
  (not replacing) the existing manually-run editor functions until each is
  individually retired — mirroring exactly how Batch PXP-10 retired Symptom Tracker's
  dashboard entry without touching its frozen data layer.

---

# 7. Data & Storage at Production Scale

ADR-006 accepted Google Sheets as a deliberate, cost-effective pilot-scale choice, on
the explicit condition that "every schema is designed as if a migration to a real
database is a certainty" (docs/30 §3). WHIMS's own scope — Inventory's transactional
stock writes, a near-real-time, cross-patient Doctor Dashboard, and Analytics'
aggregate reads over every patient's history — is plausibly the trigger condition
ADR-006 always anticipated rather than a hypothetical one.

**This review does not decide to migrate off Sheets.** That is an infrastructure and
capacity decision, independent of domain architecture, and deserves its own dedicated
technical review before any Inventory or Analytics batch begins in earnest — flagged as
this review's top risk (docs/51 Part 3) and deliberately left open, the same way
docs/45 Part 5 flagged the optional-PIN security review as required-but-deferred rather
than resolving it inline.

---

# 8. Doctor-Facing Surfaces Reuse, Never Duplicate, Existing Data

A hard rule carried into docs/50: the Doctor Dashboard **reads and writes the same
entities Phase 2B already defined** (`DoctorAssignedCondition`, `CarePlan`,
`DoctorInstruction`, `PatientModuleState`, `CheckInTemplateAssignment`) — it does not
introduce a second, doctor-side copy of any of them. Where a new entity is genuinely
required (Doctor Identity itself, Inventory, PillFill orders, Notification — §33 Part 4
of docs/33 already names Notification and Appointment as open gaps), it is scoped in
docs/50, not silently assumed here.

---

# 9. What "Holoscan" and "AI Assistant" Are, and Are Not, In This Review

Neither `docs/21`, `docs/24`, `docs/29`, nor any ADR defines what "Holoscan" means for
this platform beyond its appearance as a single bullet in docs/24's Phase 3 list. This
review does not invent a scope for it. Per the same discipline PXP-9 was held to
("nothing concrete to implement... not ready for any scoping at all," docs/44 §22,
docs/45), **Holoscan is named here, and only named, as a reserved future item** —
requiring its own dedicated, separately-approved architecture-freeze pass once its
purpose is actually defined by the clinic, not before.

**AI Assistant is reserved identically**, gated permanently by ADR-001/004/005/013 and,
now, ADR-019 — no AI behavior, prompt, model call, or "AI-ready" data shape beyond a
named-but-empty extension point is introduced by this review or by docs/50.

---

# 10. What This Review Does Not Do

- Does not implement any code, schema, or Apps Script module.
- Does not authorize any WPI batch to begin (see docs/53 §9, mirroring docs/47 §15's
  Architecture Freeze → Implementation → Validation → Closeout → Release discipline).
- Does not design, scope, or begin Phase 2C (Health Milestones) or Phase 2D (Digital
  Twin & AI Summaries) — both remain open, separately approvable, unaffected.
- Does not scope AI Assistant or Holoscan beyond naming them as reserved (§9).
- Does not decide the Sheets → SQL migration question (§7).
- Does not widen, edit, or reinterpret any Accepted ADR — ADR-017 through ADR-020 are
  new, complementary records, per ADR-007's "supersede, never silently edit" rule.

---

# Summary of Decisions This Review Makes

- Reorders Phase 3 ahead of Phase 2C/2D, on dependency grounds, not roadmap position —
  the same test PXP-10 already passed (§1).
- Renames "WiseOS" to "WHIMS Patient Intelligence Platform" ("WHIMS"), batch prefix
  `WPI-`, with no scope change from the rename itself (§2).
- Establishes four pillars — Doctor Identity & Access, Doctor-Facing Registry-Driven
  Capabilities, Specialty-Scoped Extensibility, and Reserved AI/Advanced Extension
  Points — with Inventory, PillFill Integration, and Analytics as consumers, not
  pillars (§4).
- Reaffirms "Doctor configures, patient consumes" unchanged (§5).
- Commits every new mechanism to being additive to frozen Phase 2A/2B architecture,
  with a named, precedented pattern (`DoctorSession` mirroring `TrustedDevice`) for the
  one place a genuinely new authentication surface is required (§6).
- Flags, but does not resolve, the Sheets-at-production-scale question (§7) and leaves
  Holoscan and AI Assistant named-but-unscoped (§9).

See docs/50-PHASE-3-TECHNICAL-PLAN.md for the detailed design this review's pillars
require, ADR-017 through ADR-020 for the binding decisions, docs/51 for the critique of
every proposal here and in docs/50, and docs/52 for the full repository consistency
check against the entire existing document set.
