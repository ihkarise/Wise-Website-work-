# 34 - Architecture Consistency Review
## Version 1.1 — 2026-07-02

> **Update:** the documentation-synchronization batch this review called for has been
> completed (see CHANGELOG.md's corresponding entry). Part 1's duplication clusters and
> Part 2's four carried-forward contradictions plus the two new clarifications are now
> resolved in the source documents — status columns below updated accordingly. This
> document is kept as the historical record of what was found; docs/32 remains
> untouched as the still-earlier historical record, per ADR-007's "supersede, never
> silently edit" rule applied to review documents too.

> The final architecture review before Phase 2 implementation. Reviews every existing
> architecture document — docs/00 through docs/33, plus `/adr/ADR-001`–`ADR-010` —
> together, for duplication, contradiction, and simplification opportunity. Per this
> session's explicit instruction, **no document was modified to produce this review.**
> Findings are reported here; resolving them is a separate, future, explicitly-approved
> documentation batch. This document supersedes docs/32-ARCHITECTURE-REVIEW.md's Part 1
> as the current status of documentation conflicts (docs/32 remains the historical
> record of when each was first found).

---

# Part 1 — Duplication

Content stated near-identically in two or more documents, with no cross-reference
between them — a drift risk, since editing one copy doesn't update the other.

## 1.1 Primary navigation list — stated four times

`docs/01-WEBSITE-MASTER-PLAN.md`, `docs/03-DESIGN-SYSTEM.md`, `docs/05-UX-GUIDELINES.md`,
and `docs/08-NAVIGATION-ARCHITECTURE.md` each independently list the identical primary
navigation ("Home, Conditions, Online Consultation, Doctors, Resources, Contact...
Patient Login remains separate"). None references another as the source.

**Resolution:** Applied — docs/01, docs/03, and docs/05 now each cross-reference
docs/08 instead of restating the list.

## 1.2 Page content structure — stated twice, verbatim

docs/05-UX-GUIDELINES.md's "Content Hierarchy" and docs/06-CONTENT-GUIDELINES.md's
"Page Structure" are the same five-item list (short answer → simple explanation →
detailed information → FAQ → call to action) under two different headings.

**Resolution:** Applied — docs/05 now cross-references docs/06 instead of restating
the hierarchy.

## 1.3 Floating Page Guide — stated twice, verbatim

docs/05-UX-GUIDELINES.md and docs/08-NAVIGATION-ARCHITECTURE.md both define the
identical six-item Floating Page Guide (Overview/Symptoms/Treatment/FAQ/Research/Book
Consultation) with the same desktop-sticky/mobile-expandable behavior.

**Resolution:** Applied — docs/05 now cross-references docs/08 instead of restating
the component.

## 1.4 Accessibility rules — stated twice

docs/05-UX-GUIDELINES.md's "Accessibility" section (keyboard navigation, visible focus
states, semantic HTML, alt text, WCAG AA contrast) restates docs/14-ACCESSIBILITY-STANDARDS.md's
entire content in miniature.

**Resolution:** Applied — docs/05 now cross-references docs/14 instead of restating
the requirements.

## 1.5 Performance rules — stated three times

docs/05-UX-GUIDELINES.md, docs/07-SEO-STANDARDS.md, and docs/16-PERFORMANCE-STANDARDS.md
each restate the same Lighthouse-95+/lazy-loading/minimal-JS rules independently.

**Resolution:** Applied — docs/05 now cross-references docs/16 instead of restating
targets; docs/07 keeps its SEO-specific Lighthouse category breakdown (which docs/16
doesn't cover) but now points to docs/16 for the underlying rules.

## 1.6 A forming duplication risk between docs/29 and docs/33 (new, from this session)

docs/29-PHASE-2A-TECHNICAL-PLAN.md §4 (Data Architecture) and docs/33-DOMAIN-MODEL.md
both describe the same Phase 2A Sheets (`Patients`, `LoginTokens`, `ConsultationHistory`,
`SymptomLogs`, `Reports`) with overlapping column lists. This is not yet a
contradiction (both agree today), but it is two documents maintaining the same fact.

**Resolution:** Applied — docs/29 §4 now states explicitly that docs/33 is canonical
for entity meaning and its own table describes implementation shape only.

---

# Part 2 — Contradictions

## 2.1 Carried forward from docs/32 — status check

All four contradictions reported in docs/32-ARCHITECTURE-REVIEW.md Part 1 have been
**resolved** in the documentation-synchronization batch this review called for:

| # | Contradiction | Status |
|---|---|---|
| docs/32 §1.1 | docs/09's "Password or Mobile OTP" vs. ADR-003's passwordless default | Resolved — docs/09's Entry Point section now describes the passwordless mechanism and cites ADR-002/ADR-003 |
| docs/32 §1.2 | docs/09 vs. docs/24 disagreeing on Phase 2A's scope | Resolved — both documents' Roadmap sections now state the same Phase 2A–2D split (docs/32 Part 2's recommendation) |
| docs/32 §1.3 | docs/12's "Google Sheets as primary datastore" listed as a Principle vs. ADR-006 | Resolved — docs/12's Principles section no longer lists Sheets as a principle; a "Current Implementation" section cites ADR-006 |
| docs/32 §1.4 | docs/09's Doctor Workflow diagram omits the review gate ADR-005 requires | Resolved — the diagram now shows the mandatory Doctor Review & Approval Gate |

Batch 5A was not affected by any of these being open — this sync was completed as its
own documentation-only batch before implementation begins, per docs/29 §12.

## 2.2 New — "AI Summary" naming ambiguity (resolved conceptually by docs/33, not yet reflected upstream)

**Contradiction:** docs/09-PHASE-2-ARCHITECTURE.md lists "AI Summary" as one of several
peer modules ("Converts doctor notes into patient-friendly updates") alongside
Personal Care Plan, Digital Twin, and Symptom Tracker — implying it is a feature at the
same level as the others. docs/33-DOMAIN-MODEL.md §2.4 instead models AI Summary as a
*pattern* (the ADR-005 shape: prompt constraint + code check + review gate) that
Consultation Summary already instantiates, and that a future Digital Twin narrative
would also instantiate — not a standalone feature in its own right.

**Resolution:** Applied — docs/09's "AI Summary" section now describes it as a
cross-cutting pattern, citing ADR-005 and docs/33 §2.4, rather than a fifth peer
module.

## 2.3 New — docs/23's "Prescriptions" gap, now resolved conceptually

**Not a contradiction to fix — a gap docs/32 §1.5 flagged, now given a concrete
answer.** docs/23-PATIENT-LIFECYCLE.md lists "Prescriptions" as a Patient Stage
capability with no supporting architecture anywhere. docs/33 §2.3 defines Doctor
Instruction with an `instruction_type` of `medicine` — a Prescription is simply that
instruction type, not a distinct entity.

**Resolution:** Applied — docs/23 now annotates "Prescriptions" as a `medicine`-type
Doctor Instruction (docs/33 §2.3) rather than leaving it as an unmodeled item.

## 2.4 New — docs/21's "Investigation history" mapped to Report, not a new entity

**Not a contradiction — a clarification.** docs/21's Digital Twin description lists
"Investigation history" as a component. docs/33 §3.3 notes this is satisfied by Report
(an uploaded lab/investigation document) rather than requiring a separate entity.

**Recommendation:** No action needed beyond what docs/33 already states; noted here so
a future reader doesn't wonder whether "Investigation history" was missed.

---

# Part 3 — Roadmap Gaps (entities with no owning phase)

Surfaced directly by building docs/33's Summary Table. These are omissions, not
contradictions — nothing states something false, something simply isn't claimed by any
phase yet.

| Entity | Gap |
|---|---|
| **Appointment** (docs/33 §4.1) | No phase owns turning a booking-form submission into a tracked record. Closes docs/20 §3's "THE GAP" at the data level if built. Strongest candidate for a near-term future phase — see Part 4. |
| **Doctor** (docs/33 §1.4) | No authenticated identity entity exists; "who did this" is captured two inconsistent ways today (Google account identity in Phase 1.5's Sheet-bound review; free-text staff identifier in docs/29). Not urgent for Phase 2A; becomes relevant once per-doctor audit granularity or RBAC matters (plausibly Phase 3/WiseOS). |
| **Notification** (docs/33 §4.2) | Implemented ad hoc per feature (two independent email flows once docs/29 ships) rather than as a shared entity. Not urgent yet — flagged as a "third flow" trigger point, see Part 4. |
| **Calculator** (docs/33 §5.3) | Named in docs/21's product vision, absent from docs/09's Core Modules and docs/24's roadmap entirely — the one entity in this review with no phase claiming it at all, public or patient variant. |
| **Knowledge Engine retrieval** (docs/33 §5.2) | ADR-001 requires AI grounding; today satisfied only by inline, per-request doctor text (Phase 1.5's pattern). A real retrieval implementation has no phase owner yet — needed before Phase 2D. |

---

# Part 4 — Recommended Simplifications

1. **Consolidate the five duplication clusters in Part 1** into their natural owning
   document, replacing restated content with a one-line cross-reference. Lowest-risk,
   highest-value cleanup available — no architecture changes, just removing drift risk.
2. **Adopt docs/33 as the canonical schema/entity reference** going forward (Part 1.6)
   — future technical plans should describe implementation detail and link to docs/33
   for entity meaning, rather than each phase's technical plan re-deriving entity
   shape independently.
3. **Reword docs/09's "AI Summary" section** to describe a pattern, not a peer module
   (Part 2.2) — a clarification, not a scope change.
4. **Give Appointment an explicit future phase**, since it has the clearest, most
   concrete architectural justification of any gap in Part 3 — it directly closes a
   previously-identified, named gap (docs/20 §3) and naturally follows Phase 2A's
   identity/session infrastructure (an Appointment needs a Patient Identity to resolve
   to, once one exists). Recommend it be scoped alongside or shortly after Phase 2B
   (Personal Care Plan, per docs/32 Part 2) rather than left permanently unowned.
5. **Give Calculator an explicit roadmap position** — currently the only entity named
   in product vision (docs/21) with zero phase ownership anywhere, public or patient
   variant. Does not need to be prioritized soon, but should not remain silently
   absent from docs/24's roadmap.
6. **Do not build Notification as a shared entity yet** — two independent
   implementations (Phase 1.5's `Email.gs`, docs/29's login-link email) is a reasonable
   point to stop and observe, not yet a violation. Revisit only when a third
   independent email/notification flow is proposed — treat that moment as the trigger,
   not a calendar date.

---

# Part 5 — Final Architecture Review Before Phase 2 Implementation

## Is the architecture consistent enough to begin implementation?

**Yes, for docs/29's Phase 2A scope specifically — the same conditional "yes" docs/32
already gave, now re-confirmed after the domain-model pass found no new blocking
issues.** Building the full domain model (docs/33) and cross-checking it against every
existing document (this document) surfaced real findings — five duplication clusters,
two new clarifications, five roadmap gaps — but **none of them contradict or
destabilize anything docs/29 §13's batches (5A–5H) actually depend on.** The four
contradictions carried forward from docs/32 (§2.1 above) remain the substantive open
items, and none of them block Batch 5A (`Patients` sheet + staff provisioning tool,
zero patient-facing surface) specifically.

## What should happen before Batch 5A begins

1. Close docs/28's outstanding governance sign-off — still open; a clinic decision,
   not a documentation task.
2. ~~Resolve docs/32 §1.1 and §1.3~~ — **done**, in the documentation-synchronization
   batch this review called for.
3. A dedicated security review of the magic-link/session-token mechanism before Batch
   5B specifically (Batch 5A itself has no auth logic and does not require this first)
   — still pending, scheduled for when Batch 5B is reached.

## What does not need to happen before Batch 5A

The duplication cleanup (Part 1) and the roadmap-gap assignments (Part 3, Part 4) are
real but non-blocking — they improve documentation hygiene and close honest gaps, but
nothing in docs/29's eight batches depends on any of them being resolved first. Treat
them as a follow-up documentation batch, not a precondition.

## Remaining architectural risks (unchanged from docs/32, reconfirmed)

Hand-rolled auth cryptography, Sheets-at-scale, the static-frontend complexity ceiling
under real authenticated UI, free-account storage quotas, "patient data belongs to the
patient" having no concrete mechanism yet, and the Knowledge Engine having no real
retrieval implementation — all previously identified in docs/32, none newly introduced
or newly resolved by this review.

## Statement

This document, together with docs/29 (Phase 2A Technical Plan), docs/30 (Architecture
Principles), docs/31 (ADR Index), docs/32 (prior Architecture Review), and docs/33
(Domain Model), represents the complete, cross-checked architecture for Phase 2A. No
further architecture-freeze work is identified as necessary before implementation.

**This document does not itself authorize Batch 5A to begin.** Per this session's
instruction, implementation starts only on explicit, separate approval.
