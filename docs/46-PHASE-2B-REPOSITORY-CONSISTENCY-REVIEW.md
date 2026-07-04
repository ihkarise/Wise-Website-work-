# 46 - Phase 2B Repository Consistency Review
## Version 1.0 — 2026-07-04

> Scoped consistency review of this architecture-freeze pass's own output (docs/44,
> docs/45, ADR-011/012/013, and the accompanying updates to docs/24, docs/31, docs/33)
> against the full existing documentation set (docs/00 through docs/43, `/adr/ADR-001`
> through `ADR-010`). Mirrors docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md's method,
> applied to Phase 2B's scope specifically rather than re-reviewing Phase 2A. **This
> document does not authorize any docs/44 §21 batch to begin.**

---

# Part 1 — Duplication

## 1.1 No new duplication introduced between docs/44 and docs/33
docs/44 §16 summarizes every new/promoted entity in a table but explicitly defers full
entity description to docs/33 §6 (added by this same change) — following docs/34 §1.6's
already-resolved pattern of docs/29 pointing at docs/33 as canonical for entity meaning.
No entity's field list is stated fully in both places.

## 1.2 No new duplication between ADR-011 and docs/44 §4
ADR-011 states the binding decision and its Consequences; docs/44 §4 describes the
concrete data model (`PatientCredential`) and the open tuning questions the ADR
deliberately leaves to implementation time. Same relationship pattern ADR-004/ADR-013
already have with their respective technical-plan sections — decision vs. implementation
detail, not restatement.

## 1.3 A forming duplication risk, same shape as docs/34 §1.6, one level deeper
docs/44 §8 (Template Engine) and docs/44 §9 (Daily Check-ins) both describe
`CheckInTemplate`/`CheckInResponse` — necessarily, since one is the mechanism and the
other is its first real consumer. Not a duplication risk today (§9 explicitly
cross-references §8 rather than restating field definitions), but worth naming as the
same pattern to watch that docs/34 §1.6 first flagged for docs/29/docs/33 — noted here
so a future Calculator-Framework-style second consumer of Template Engine (if one is
ever proposed) is checked against this cross-reference discipline, not a fresh
restatement.

---

# Part 2 — Contradictions

## 2.1 ADR-003 vs. persistent authentication
Already resolved by formal amendment, not a live contradiction — see docs/45 Part 2.1
and ADR-011 itself. Recorded here for completeness, not as an open item.

## 2.2 ADR-006's literal wording vs. Template Engine/Calculator's JSON-encoded columns
Already addressed as a disclosed, reasoned exception rather than a silent violation —
see docs/44 §8.2 and docs/45 Part 1.5/Part 2.2. Recorded here as a **live, unresolved
open question about which of two valid readings of ADR-006 should govern going
forward** (literal column-flatness vs. migration-safety-in-spirit) — not a
contradiction between two documents, but a genuine ambiguity in how far ADR-006's
existing wording stretches. **Recommendation: if Option B (docs/44 §8.2) is confirmed,
consider a short clarifying addition to ADR-006 itself (via the standard "note added,
original text preserved" pattern ADR-003 uses in this same change) stating that a
bounded, size-checked, single JSON column is an acceptable flat-column citizen when the
alternative is a fixed superset of meaningless generic columns.** Not done in this
change — flagged as a follow-up documentation task contingent on Part 2.2's design fork
actually being settled the way docs/44 recommends.

## 2.3 No contradiction found with docs/09, docs/20, docs/21, docs/22, docs/23, docs/32
Checked explicitly: docs/09's original Personal Care Plan description ("current goals,
medicines, lifestyle guidance, doctor instructions, next review") is fully preserved by
docs/44 §11's `CarePlan`/`DoctorInstruction` model, not contradicted. docs/23's
lifecycle-stage ordering question is addressed in docs/45 Part 2.4 as a non-conflict.
docs/32 Part 2's original Care Plan recommendation is the direct ancestor of this
document set, not in tension with it.

---

# Part 3 — Roadmap Gaps

Carried forward from docs/34 Part 3, status updated where this plan touches them:

| Entity | docs/34 status | Status after this review |
|---|---|---|
| **Calculator** (docs/33 §5.3) | "No phase claims it at all" | Patient variant now claimed by Phase 2B (docs/44 §10). **Public/no-login variant remains unclaimed** — docs/24's update names this explicitly rather than letting the roadmap read as fully resolved. |
| **Appointment** (docs/33 §4.1) | Unassigned, strongest near-term candidate | Still unassigned. Not touched by this plan (docs/44 §2.2) — correctly deferred, not silently dropped a second time. |
| **Doctor** (docs/33 §1.4) | No authenticated identity entity | Still not addressed. Phase 2B introduces `prescribed_by`/`assigned_by`/`created_by` fields (docs/44 §6.1, §11.1) that continue the existing free-text-staff-identifier convention rather than resolving this gap — consistent with docs/34's own assessment that this becomes relevant "once per-doctor audit granularity or RBAC matters (plausibly Phase 3/WiseOS)," not before. |
| **Notification** (docs/33 §4.2) | Two independent ad hoc flows, not yet a shared entity | Unaffected — no third independent notification flow introduced by this plan (docs/45 Part 4 confirms). |
| **Knowledge Engine retrieval** (docs/33 §5.2) | No real implementation, needed before Phase 2D | Unaffected — this plan introduces no new AI grounding requirement (docs/44 §14 confirms zero new AI integration). |

**New gap surfaced by this pass:** none. Every new entity in docs/44 §16 has an explicit
phase owner (Phase 2B) as of this document — unlike Calculator's prior "claimed by
nobody" state.

---

# Part 4 — Recommended Simplifications

1. **Settle docs/44 §6.2's Option A/B before PCP-1**, per docs/45 Part 1.3/5 — the
   single highest-value "decide now, not later" item, since reversing it after PCP-1
   ships is materially more expensive than reversing most other open questions in this
   plan.
2. **Confirm or reconsider the Template Engine's JSON-encoded-column approach before
   PCP-5**, per docs/45 Part 1.5 and Part 2.2 above — the second highest-value
   "decide now" item, since it sets precedent for every future variable-shape entity.
3. **Do not attempt to migrate Timeline/Symptom Tracker/Reports onto the Module
   Registry as part of this scope** — ADR-012 already defers this deliberately;
   repeating it here only to confirm no reviewer should treat it as an accidental
   omission.
4. **Keep the Public Calculator variant explicitly named as unclaimed** in docs/24
   going forward, the same way Appointment and Notification are already named as
   explicit, tracked gaps rather than silent absences.

---

# Part 5 — Final Architecture Review

## Is the documentation set internally consistent enough for docs/44's batches to be considered for approval?

**Yes, with the two settlement items in Part 4 (#1, #2) resolved first — the same
conditional shape docs/34 Part 5 gave Phase 2A before Batch 5A.** No contradiction was
found that this pass introduced and left unresolved; the one genuine open ambiguity
(ADR-006's exact reach, Part 2.2) is disclosed, not hidden, and does not block PCP-1 or
PCP-2 specifically, only the batches that depend on the Template Engine design (PCP-5
onward, per docs/45 Part 5).

## What should happen before PCP-1 specifically
Nothing beyond what docs/45 Part 5 already states — Part 4 item #1 above (settle
Option A/B) is PCP-1's own subject matter, not a precondition external to it.

## What should happen before PCP-5 specifically
Part 4 item #2 above (settle the Template Engine column approach) — see docs/45 Part
1.5/5.

## What does not need to happen before any Phase 2B batch begins
Resolving Appointment, Doctor, Notification, or Knowledge Engine retrieval (Part 3) —
none are dependencies of anything in docs/44 §21. Migrating existing Phase 2A dashboard
cards onto the Module Registry — ADR-012 defers this by design.

## Remaining risks (unchanged from docs/45, not newly introduced here)
Persistent-credential hashing on Apps Script (docs/45 Part 3 item 1) remains this
pass's single most significant risk and is not resolved by documentation review alone —
it requires the dedicated security review named there, independent of this document.

## Statement
This document, together with docs/44 (Phase 2B Technical Plan), docs/45 (Phase 2B
Architecture Readiness Review), ADR-011, ADR-012, ADR-013, and the accompanying updates
to docs/24, docs/31, and docs/33, represents the complete, cross-checked
architecture-freeze pass for the Phase 2B scope requested. No further
architecture-freeze work is identified as necessary before an approving reviewer
considers docs/44 §21's batches individually.

**This document does not itself authorize PCP-1, or any other batch, to begin.** Per
this session's explicit instruction, implementation starts only on separate, explicit
approval.
