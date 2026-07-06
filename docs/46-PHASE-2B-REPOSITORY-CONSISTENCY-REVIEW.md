# 46 - Phase 2B Repository Consistency Review
## Version 4.0 — 2026-07-09

> Scoped consistency review of this architecture-freeze **finalization** pass's output
> — now docs/44 (Version 4.0), docs/45 (Version 4.0), ADR-012 (amended), ADR-013
> (confirmed), ADR-015 (supersedes ADR-014, which superseded ADR-011), the new ADR-016
> (Template Registry), and the accompanying updates to docs/24, docs/31, and docs/33 —
> against the full existing documentation set. Mirrors
> docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md's method. **This document does not
> authorize any docs/44 §22 batch to begin.**
>
> **What changed since Version 3.0:** this is a documentation-only pass — no batch's
> scope, dependency, or risk classification changed. The implementation batch sequence
> was renamed for platform-wide naming consistency (PCP-1…PCP-11 → PXP-1…PXP-11, with
> three batch labels also clarified — no scope change); a new ADR-016 (Template
> Registry) generalizes docs/44 §11's Template Engine, complementing rather than
> replacing ADR-012; the dashboard vision (docs/44 §13) was refined into a named
> "Health Journey" framing; and Doctor-Owned Configuration was consolidated into one
> explicit section (docs/44 §4.3) rather than left implicit across six others.
>
> **What changed since Version 2.0 (carried forward from Version 3.0):** the
> authentication ADR chain extended again (ADR-014 → ADR-015), ADR-012 gained an
> amendment note (full dashboard migration now committed), the Doctor-Assigned
> Conditions entity was renamed (`ConditionAssignment` → `DoctorAssignedCondition`),
> several open questions were settled into locked decisions, and the batch sequence was
> substantially reordered and expanded (PXP-1…PXP-10 → PXP-1…PXP-11, infrastructure-
> first).

---

# Part 1 — Duplication

## 1.1 No new duplication introduced between docs/44 and docs/33
Unchanged: docs/44 §17 summarizes every entity but defers full description to docs/33
§6, which is updated in this same change to use the new `DoctorAssignedCondition` name
throughout, with no stale reference to `ConditionAssignment` left behind (verified by
direct search across docs/33, docs/44, docs/45, docs/46, docs/24, docs/31 — none
found).

## 1.2 No new duplication between the authentication ADR chain and docs/44 §5
ADR-015 states the binding decision; docs/44 §5 describes the concrete data models and
open implementation-time questions. ADR-011 and ADR-014 remain on record, both marked
Superseded, neither duplicated by ADR-015 (ADR-015 incorporates their content by
reference, per its own §Decision 1, rather than restating it) — consistent with how
ADR-014 treated ADR-011 previously.

## 1.3 No new duplication introduced by ADR-012's amendment
The amendment note added to ADR-012 in this change describes what changed and why, and
points to docs/44 §7/§13 (Version 3.0) for the concrete migration batch — it does not
restate docs/44's content, avoiding the same duplication risk docs/34 §1.6 first named
for docs/29/docs/33.

## 1.4 A forming duplication risk, same shape as before, one level deeper
Unchanged: docs/44 §11 (Template Registry, generalized from Template Engine) and §10
(Daily Check-ins) both describe `CheckInTemplate`/`CheckInResponse`, necessarily — §10
cross-references §11 rather than restating field definitions, including the new
`template_version` pinning rule (§11.4), stated once in §11.4 and referenced, not
repeated, in §10.3.

## 1.5 No new duplication introduced by ADR-016 (Template Registry)
Checked directly: ADR-016 states the binding decision (a general Template Registry
pattern, `CheckInTemplate` as first category); docs/44 §11/§11.5 describes the concrete
data model, the versioning/validation policy (by reference to §11.4, not restated), and
the six named future categories. Neither document restates the other's content — the
same non-duplicating split already established between ADR-012/ADR-013 and their
respective docs/44 sections (§1.2 above, and this section's own predecessor pattern).

## 1.6 No new duplication introduced by batch renaming
Checked directly across docs/24, docs/31, docs/33, docs/44, docs/45, docs/46: every
`PCP-` reference was replaced with the corresponding `PXP-` reference and no document
retains a stale `PCP-` string (verified by direct search — none found). No document
restates another's batch-name history beyond a single "renamed from PCP-N" disclosure
per batch, in docs/44 §22 alone — docs/45/docs/46 reference the rename by pointing back
to docs/44 §22, not by re-explaining it.

---

# Part 2 — Contradictions

## 2.1 ADR-003 vs. persistent authentication — re-checked against ADR-015
Resolved by formal amendment chain (ADR-011 → ADR-014 → ADR-015). Checked directly:
ADR-003's status note, ADR-011's status note, ADR-014's status note, ADR-015 itself, and
docs/31-ADR-INDEX.md all agree on the current state (ADR-015 governs; ADR-011 and
ADR-014 are both historical, correctly marked). No stale cross-reference found.

## 2.2 ADR-006 vs. JSON-encoded columns — now a documented policy, not an open ambiguity
docs/44 §11.4's versioning/validation/migration rules resolve what was, in Version 2.0,
a live ambiguity about how far ADR-006's wording stretches. This review's Version 2.0
recommendation (a short clarifying note added to ADR-006 itself) remains open as a
low-priority follow-up — not required before any docs/44 §22 batch, since docs/44
§11.4 is now specific enough to govern implementation directly regardless of whether
ADR-006's own text is ever lightly amended to mention it.

## 2.3 ADR-012's original deferral vs. the now-committed full dashboard migration
Checked directly against ADR-007's requirements for amending an Accepted ADR without a
full supersession: an amendment note was added (not a silent rewrite), the original
Decision text is unchanged and still governs the core registry-driven/per-patient-
enablement decision, and only a previously-open "Future Considerations" item was
resolved into a committed scope — this is judged a legitimate amendment, not a decision
reversal requiring supersession, since ADR-012's binding Decision was never "existing
cards must never migrate," only that migration was "not required in the same batch."

## 2.4 No new contradiction introduced by settled decisions
Checked explicitly: the four items settled in this revision (Doctor-Assigned Conditions'
entity shape/naming, Check-in template doctor-assignment, per-patient enablement
always-explicit, JSON storage policy) each resolve a question this review's own prior
versions posed — none introduces a new contradiction with docs/09, docs/20, docs/21,
docs/22, docs/23, docs/30, or docs/32.

## 2.5 ADR-016 vs. ADR-012 — checked directly, no contradiction
ADR-012's Decision text (registry-driven modules, per-patient enablement) is untouched
by ADR-016 — ADR-016 governs a different question (template *shape*, not module
*exposure*) and its own Decision text explicitly states it complements rather than
amends or supersedes ADR-012. docs/31-ADR-INDEX.md lists both as independently Accepted,
with no supersession relationship between them, which is the correct index state for
two complementary, non-overlapping ADRs.

## 2.6 Batch renaming (PCP → PXP) vs. every existing cross-reference — checked directly
Every cross-reference to a `PCP-N` batch across docs/24, docs/33, docs/44, docs/45, and
docs/46 was updated to the corresponding `PXP-N` in the same change, and no document's
Delivers/Depends-on/Risk content changed as a side effect of the renaming (verified by
direct read of docs/44 §22's full table pre- and post-rename diff — only the bolded
label text and, for four batches, the parenthetical disclosure changed). No document
was left referencing a batch by its old name (verified by direct search — none found).

---

# Part 3 — Roadmap Gaps (Unchanged from Version 2.0)

| Entity | Status |
|---|---|
| **Calculator** | Patient variant claimed by Phase 2B (Pillar 3). Public/no-login variant remains explicitly unclaimed. |
| **Appointment** | Still unassigned. |
| **Doctor** | Still no authenticated identity entity — unaffected by any Version 3.0 change. |
| **Notification** | Unaffected. |
| **Knowledge Engine retrieval** | Unaffected. |
| **Template Registry's six named future categories (new)** | Deliberately unclaimed by design (docs/44 §11.5 is explicit these are named, not scoped) — same treatment as AI Integration below, not a gap in the oversight sense. |

**No new gap surfaced by Version 3.0's or Version 4.0's changes.** Settling
previously-open questions, reordering batches, and — in Version 4.0 — renaming
batches and generalizing the Template Engine into a Template Registry are all internal
refinements of already-claimed Phase 2B scope, not new roadmap territory. The reserved
"AI Integration" placeholder (docs/44 §22 item 9) is a deliberately unscoped batch
slot, not a roadmap gap in the sense Part 3's other rows describe (those are
capabilities named in vision/architecture docs with no phase owner; AI Integration has
a phase owner — Phase 2B — and simply has no design yet by choice).

---

# Part 4 — Recommended Simplifications

1. **Resolve `DoctorAssignedCondition` vs. `Patient.condition_slug` reader coexistence**
   before PXP-2's detailed scoping (docs/45 Part 1.2/Part 3 item 4) — new in Version
   3.0, a direct consequence of the entity being genuinely additive rather than a
   schema widening.
2. **Decide Long-Lived Session's implementation path** (frozen-file change vs. additive
   wrapper, docs/44 §5.5) before PXP-8 is scoped in detail (docs/45 Part 1.1/Part 3
   item 3).
3. **Commit PXP-4 to an explicit regression-testing plan** against the existing PA-2/
   PA-3/PA-5 browser-test suites as part of its own definition of done (docs/45 Part
   1.3/Part 3 item 1) — this plan's current highest-ranked risk.
4. **Keep the Public Calculator variant and AI Integration's scope both explicitly
   named as unclaimed/unscoped** in docs/24 going forward — the same discipline already
   applied to Appointment and Notification.
5. **A short clarifying note on ADR-006 itself** (mentioning that a bounded, versioned,
   size-checked JSON column is an acceptable flat-column citizen) remains a low-priority
   follow-up, not a blocker — carried forward from Version 2.0, still not done, still
   not required.
6. **Keep Template Registry's six named future categories explicitly unclaimed** in
   docs/24 going forward (docs/45 Part 1.11/Part 3 item 7, new in Version 4.0) — same
   discipline as item 4 above, applied to the new registry.
7. **No action required, tracked only:** the "Symptom Tracker Migration" (PXP-10) batch
   name reads adjacent to, but is distinct from, §10.1's migration language — already
   disclosed in docs/44 §22's own parenthetical (docs/45 Part 1.10/Part 3 item 8, new in
   Version 4.0); not a blocker.

---

# Part 5 — Final Architecture Review

## Is the documentation set internally consistent enough for docs/44's batches to be considered for approval?

**Yes — unchanged in substance from Version 3.0's conclusion.** This Version 4.0 pass
added a new ADR (ADR-016) and renamed the batch sequence, and found no contradiction
introduced by either (Part 2.5, 2.6). The remaining settlement items (Part 4, #1–#3,
carried from Version 3.0) are unchanged in substance and remain narrower and more
implementation-specific than any earlier version's open list. Two new low-severity
naming observations were tracked, not required to be resolved (Part 4, #6–#7). No
contradiction was found that this revision pass introduced and left unresolved. The
ADR-014 → ADR-015 supersession, the ADR-012 amendment, and the new ADR-016 were all
checked directly against ADR-007's requirements and found compliant.

## What should happen before PXP-1 specifically
The two small Patient Profile lifecycle questions (docs/45 Part 5, carried from
Version 1.0's Part 1.2) — unchanged, still open, still non-blocking.

## What should happen before PXP-2 specifically
Resolve the `DoctorAssignedCondition`/`Patient.condition_slug` coexistence question
(Part 4 #1) — new in Version 3.0.

## What should happen before PXP-4 specifically
Commit to the explicit regression-testing plan (Part 4 #3) — new in Version 3.0, this
plan's current top risk.

## What should happen before PXP-8 specifically
Decide Long-Lived Session's implementation path (Part 4 #2); complete the dedicated
PIN security review independently for its own sub-batch.

## What does not need to happen before any Phase 2B batch begins
Resolving Appointment, Doctor, Notification, or Knowledge Engine retrieval. Deciding
the Public Calculator variant. Scoping PXP-9 (AI Integration) or Digital Twin. All
unchanged from prior versions.

## Remaining risks (ranked in docs/45; top risk unchanged since Version 3.0, two new low-severity items added in Version 4.0)
Full dashboard migration surface area (PXP-4) remains this pass's top-ranked risk,
unchanged since Version 3.0's re-ranking (having moved up once JSON storage —
previously top-ranked — gained a concrete, documented policy). Two new low-severity
items were added to docs/45's ranked list in Version 4.0 (items 7–8): Template
Registry's named-but-unscoped future categories, and the "Symptom Tracker Migration"
batch name read alongside §10.1's migration language — both already disclosed in
docs/44, neither a blocker.

## Statement
This document (Version 4.0), together with docs/44 (Version 4.0), docs/45 (Version
4.0), ADR-012 (amended), ADR-013 (confirmed), ADR-015 (current governing authentication
record; ADR-011 and ADR-014 both superseded and kept on record per ADR-007), and the new
ADR-016 (Template Registry, complementing ADR-012), represents the complete,
cross-checked architecture-freeze **finalization** pass — renamed batches, a
generalized Template Registry, a refined "Health Journey" dashboard framing, and an
explicitly-named Doctor-Owned Configuration principle, with no scope, dependency, or
risk change to any batch. No further architecture-freeze work is identified as
necessary before an approving reviewer considers docs/44 §22's batches individually.

**This document does not itself authorize PXP-1, or any other batch, to begin.** Per
this session's explicit instruction, implementation starts only on separate, explicit
approval.
