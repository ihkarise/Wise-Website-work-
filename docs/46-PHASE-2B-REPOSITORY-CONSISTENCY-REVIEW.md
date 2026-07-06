# 46 - Phase 2B Repository Consistency Review
## Version 2.0 — 2026-07-06

> Scoped consistency review of this architecture-freeze pass's output — now docs/44
> (Version 2.0), docs/45 (Version 2.0), ADR-012/013/014 (ADR-011 superseded), and the
> accompanying updates to docs/24, docs/31, and docs/33 — against the full existing
> documentation set. Mirrors docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md's method. **This
> document does not authorize any docs/44 §22 batch to begin.**
>
> **What changed since Version 1.0:** the authentication mechanism (ADR-011 → ADR-014),
> the pillar framing (Doctor-Assigned Conditions, Module Engine, Calculator Framework
> now explicit pillars), and the batch names/count in docs/44 §22 (PCP-1…PCP-9 →
> PCP-1…PCP-10, PIN split into its own batch). Parts 1, 3, and 4 below are substantively
> unchanged from Version 1.0 with reference updates; Part 2 and Part 5 are re-checked
> against the new authentication design specifically.

---

# Part 1 — Duplication

## 1.1 No new duplication introduced between docs/44 and docs/33
Unchanged from Version 1.0: docs/44 §17 summarizes every new/promoted entity but defers
full description to docs/33 §6.

## 1.2 No new duplication between the authentication ADRs and docs/44 §5
ADR-014 states the binding decision and its Consequences; docs/44 §5 describes the
concrete data models (`TrustedDevice`, `PatientCredential`) and the open tuning
questions ADR-014 deliberately leaves to implementation time. Same decision-vs-detail
relationship every other ADR/technical-plan-section pair in this repository already has.
ADR-011 is not duplicated by ADR-014 — ADR-014 explicitly incorporates ADR-011's
PIN-specific content by reference (§7) rather than restating it, and ADR-011 itself
remains on record, marked Superseded, per ADR-007.

## 1.3 A forming duplication risk, same shape as docs/34 §1.6, one level deeper
Unchanged from Version 1.0: docs/44 §11 (Template Engine) and §10 (Daily Check-ins) both
describe `CheckInTemplate`/`CheckInResponse`, necessarily — §10 cross-references §11
rather than restating field definitions.

---

# Part 2 — Contradictions

## 2.1 ADR-003 vs. persistent authentication — re-checked against ADR-014
Already resolved by formal amendment. ADR-003's status note (updated in this change)
now points to ADR-014 as the current governing amendment and correctly notes ADR-011's
supersession rather than leaving a stale pointer to a superseded record. Checked
directly: ADR-003's file, ADR-011's file, ADR-014's file, and docs/31-ADR-INDEX.md all
agree on the current state (ADR-014 governs; ADR-011 is historical). No stale
cross-reference found.

## 2.2 ADR-006's literal wording vs. Template Engine/Calculator's JSON-encoded columns
Unchanged from Version 1.0 — a live, unresolved open question about which of two valid
readings of ADR-006 should govern going forward, not a contradiction between documents.
The Version 1.0 recommendation (a short clarifying addition to ADR-006 itself, via the
same "note added, original text preserved" pattern used for ADR-003) remains open and
contingent on docs/44 §11.2 Option B actually being confirmed.

## 2.3 No new contradiction introduced by the pillar reframing or docs/24's update
Checked explicitly: docs/24's new Phase 2B entry ("Patient Experience Platform") does
not contradict docs/21's product vision (Personal Care Plan's original description is
preserved verbatim in intent, per docs/44 §12) or docs/32 Part 2's original
recommendation that Care Plan become its own phase — the phase is broader than
originally scoped, not different in kind, and this is stated explicitly in docs/44's
"What Changed in Version 2.0" notice and docs/24's own text rather than silently
substituted.

## 2.4 No contradiction found with docs/09, docs/20, docs/21, docs/22, docs/23, docs/32
Unchanged from Version 1.0 — re-confirmed, no new tension introduced by the Version 2.0
revisions.

---

# Part 3 — Roadmap Gaps (Unchanged from Version 1.0)

| Entity | Status |
|---|---|
| **Calculator** | Patient variant now claimed by Phase 2B (Pillar 3, docs/44 §8). Public/no-login variant remains explicitly unclaimed. |
| **Appointment** | Still unassigned. Not touched by this plan. |
| **Doctor** | Still no authenticated identity entity. Unaffected by the authentication redesign — `TrustedDevice`/`PatientCredential` are patient-side mechanisms, not staff/doctor identity. |
| **Notification** | Unaffected — no third independent notification flow introduced. |
| **Knowledge Engine retrieval** | Unaffected — this plan introduces no new AI grounding requirement. |

**No new gap surfaced by Version 2.0's changes.** The authentication redesign and
pillar elevation are internal restructurings of already-claimed Phase 2B scope, not new
roadmap territory.

---

# Part 4 — Recommended Simplifications (Unchanged from Version 1.0, Renumbered)

1. **Settle docs/44 §6.2's Option A/B before PCP-1** — unchanged, highest-value
   "decide now" item, now more consequential given Pillar 1's central role.
2. **Confirm or reconsider the Template Engine's JSON-encoded-column approach before
   PCP-7** (renumbered from PCP-5 in Version 1.0) — unchanged, now docs/45's top-ranked
   risk.
3. **Do not attempt to migrate Timeline/Symptom Tracker/Reports onto the Module
   Registry as part of this scope** — unchanged.
4. **Keep the Public Calculator variant explicitly named as unclaimed** in docs/24 —
   unchanged.
5. **New in Version 2.0: scope a minimal "manage my devices" view into PCP-4** rather
   than treating Trusted Device revocability as a backend-only capability with no
   patient-facing visibility (docs/45 Part 1.1) — a real, low-cost addition to the
   batch's own scope, not a separate future item.

---

# Part 5 — Final Architecture Review

## Is the documentation set internally consistent enough for docs/44's batches to be considered for approval?

**Yes, with the same two settlement items as Version 1.0 (Part 4 #1, #2) resolved
first, plus Version 2.0's new #5.** No contradiction was found that this revision pass
introduced and left unresolved. The authentication redesign (ADR-011 → ADR-014) is a
clean, correctly-executed supersession — checked directly against ADR-007's
requirements (new record created, old record marked and preserved, index updated in the
same change) and found compliant.

## What should happen before PCP-1 specifically
Unchanged: settle Option A/B (Part 4 #1) — PCP-1's own subject matter.

## What should happen before PCP-4 specifically (new in Version 2.0)
Scope the minimal device-management view into the batch (Part 4 #5) rather than
discovering the gap mid-implementation.

## What should happen before PCP-7 specifically
Settle the Template Engine column approach (Part 4 #2) — unchanged from Version 1.0's
PCP-5, renumbered.

## What does not need to happen before any Phase 2B batch begins
Resolving Appointment, Doctor, Notification, or Knowledge Engine retrieval. Migrating
existing Phase 2A dashboard cards onto the Module Registry. Deciding the Public
Calculator variant. All unchanged from Version 1.0.

## Remaining risks (re-ranked in docs/45 Version 2.0, not newly introduced here)
The Template Engine's column representation is now this pass's top-ranked open risk,
having moved up now that persistent-credential hashing dropped in severity following
the Trusted-Device redesign (docs/45 Part 3).

## Statement
This document (Version 2.0), together with docs/44 (Version 2.0), docs/45 (Version
2.0), ADR-012, ADR-013, ADR-014 (ADR-011 superseded), and the accompanying updates to
docs/24, docs/31, and docs/33, represents the complete, cross-checked
architecture-freeze pass reflecting the approved-in-principle direction. No further
architecture-freeze work is identified as necessary before an approving reviewer
considers docs/44 §22's batches individually.

**This document does not itself authorize PCP-1, or any other batch, to begin.** Per
this session's explicit instruction, implementation starts only on separate, explicit
approval.
