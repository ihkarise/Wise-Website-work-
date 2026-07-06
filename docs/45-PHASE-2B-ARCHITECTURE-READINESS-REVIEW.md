# 45 - Phase 2B Architecture Readiness Review
## Version 3.0 — 2026-07-08

> This review critiques docs/44-PHASE-2B-TECHNICAL-PLAN.md (now Version 3.0) — it does
> not restate it. Read docs/44 first. Per this session's explicit instruction, **this
> document does not authorize any batch in docs/44 §22 to begin.**
>
> **What changed since Version 2.0 of this review:** several of Version 2.0's "open
> questions requiring sign-off" are now settled decisions (Doctor-Assigned Conditions'
> entity shape and naming, Check-in template ownership, per-patient enablement rules,
> JSON storage policy); authentication gained an explicit Long-Lived Session mechanism
> (ADR-015); Module Engine's dashboard migration is now committed rather than deferred;
> and the implementation order changed substantially (infrastructure-first, PCP-1 is now
> Patient Profile rather than Doctor-Assigned Conditions). This version re-does Part 1's
> critique for every item that changed and carries forward, with light updates, every
> item that didn't.

---

# Part 1 — Critique of Each Proposal

## 1.1 Persistent Authentication — Four Named Mechanisms (docs/44 §5, ADR-015)

**This is a genuine improvement in clarity over Version 2.0, not just a relabeling.**
Naming Long-Lived Session explicitly, rather than leaving it implicit in "the device
token gets exchanged for a session," closes a real gap this review flagged in Version
2.0 (Part 1.1's "manage my devices" and multi-device semantics questions) — ADR-015 §4
now explicitly resolves the multi-device revocation question (revoking one device
doesn't kill another device's independently-issued long-lived session), which Version
2.0 had left open.

**What remains genuinely unresolved:** §5.5's implementation note is honest that
whether Long-Lived Session requires touching the frozen `FoundationSession.gs` is
undecided. This review agrees this shouldn't be decided at the architecture level —
but flags that **the answer materially affects PCP-8's risk classification** (a change
to a frozen file needs its own bug-fix-scope justification per docs/43's freeze rules,
whereas an additive wrapper does not). Recommend the batch that scopes PCP-8 in detail
resolve this *before* implementation starts, not discover it mid-batch.

**PIN's reframing as "convenience only"** is a narrative improvement this review
endorses — it more accurately reflects the mechanism's actual role now that Trusted
Device/Long-Lived Session are primary. The underlying technical risk (§5.4's hashing
bridge) is unchanged and still requires its own security review before PCP-8's PIN
sub-batch specifically.

## 1.2 Doctor-Assigned Conditions — Now Settled (docs/44 §6)

**Version 2.0's Part 1.3 recommendation is now a locked decision, correctly so.** The
rename to `DoctorAssignedCondition` matches approved terminology exactly. One
observation, not a blocker: docs/44 §6.2 notes this entity "supersedes" `Patient.
condition_slug` "as the forward-going source of truth" without fully specifying what
reads `Patient.condition_slug` today and whether those readers need to be updated to
read `DoctorAssignedCondition` instead, or whether the two fields are allowed to
silently diverge. Recommend this be resolved explicitly when PCP-2 is scoped in detail
— not a design flaw, just an implementation-time loose end worth naming now.

## 1.3 Module Engine — Elevated to Full Dashboard Migration (docs/44 §7)

**A materially larger commitment than Version 2.0's deliberately deferred approach**,
and this review's assessment is that the trade-off is sound: maintaining two
permanently-coexisting rendering paths (registry-driven for new modules, hardcoded for
old ones) indefinitely was always going to be a form of the exact duplication/drift
risk ADR-009 exists to prevent — resolving it now, as its own dedicated batch (PCP-4),
is more honest than leaving ADR-012's "Future Considerations" open forever. **The one
real risk this introduces**: PCP-4 touches the rendering path of three already-shipped,
working, frozen-adjacent features (Timeline, Symptom Tracker, Reports) in a single
batch. docs/44 §7.3 correctly notes the underlying feature/data is unaffected — only
*how a card is decided to appear* changes — but this review recommends PCP-4 include
its own explicit regression pass against all three existing browser-test suites
(`pa-2-dashboard`, `pa-3-timeline`, `pa-4-symptom-tracker`... — actually Timeline is
PA-3, Reports is PA-5) before being considered complete, precisely because it is a
rendering-mechanism change to already-verified, working surfaces — not a new risk
category, but a concrete verification obligation worth stating now rather than
assuming.

## 1.4 Calculator Registry (docs/44 §8)

Sound, and a natural extension of the Module Registry pattern. No gap found — §8.3's
"no hardcoding" constraint is stated clearly enough to be checkable at review time
(a future PR adding a disease-specific `if` branch inside Calculator Framework's shared
code, rather than a new registry entry, would be a clear, nameable violation).

## 1.5 Template Engine / JSON Storage — Now a Concrete Policy (docs/44 §11.4)

**This was Version 2.0's top-ranked risk; it is now substantially de-risked by having
an actual, specific policy rather than an open fork.** The versioning rule (pin both
`template_id` and `template_version` on every response, never just the former) is the
right fix for the exact ambiguity this review would otherwise have flagged. The
validation rule (write-time schema check against the referenced version, size-bounded,
flat-shape-only) is concrete enough to be implemented and tested directly — this review
has no further open question on the *policy* itself.

**What remains, correctly disclosed rather than resolved:** the raw-Sheet-readability
cost (a doctor/staff member sees a JSON blob, not a plain value) is named as an
accepted cost, not solved. This review agrees this is the right way to close this
question — some real costs are worth disclosing and accepting rather than engineering
away, and re-opening it would only reintroduce Version 2.0's unresolved fork.

## 1.6 Personalized Daily Check-ins — Template Assignment Settled (docs/44 §10.2)

**Version 2.0's open multi-condition question is now resolved cleanly**: a doctor
explicitly assigns templates, rather than the system auto-resolving ambiguity when a
patient has multiple active conditions. This is consistent with §6.3's "doctor decides,
condition informs" pattern applied everywhere else in this plan, and removes what would
otherwise have been the plan's least-elegant edge case.

## 1.7 Personal Care Plan (docs/44 §12)

Unchanged from Version 2.0 — sound. The still-unstated question (does a new `CarePlan`
version need its own review/approval gate beyond authorship) remains open and
low-priority; this review's Version 2.0 assessment stands (likely unnecessary, given
no AI involvement, but docs/44 should eventually say so explicitly rather than by
omission).

## 1.8 Patient Dashboard Evolution / Feature Enablement — Both Settled (docs/44 §13/§14)

Version 2.0's open question (automatic vs. always-explicit enablement) is now a locked
decision: always explicit, doctor/staff-only, never automatic-by-condition, never
patient-controlled. This review agrees this is the right default and specifically
endorses that it closes the one place in Version 2.0 where "the doctor decides" could
have quietly eroded into "the system decides based on a condition flag."

## 1.9 AI Boundaries / Digital Twin Scope (docs/44 §15/§16)

Unchanged in substance, strengthened in presentation — naming the five specific future
Digital Twin consumers (Timeline, Reports, Check-ins, Care Plans, Calculators)
explicitly, rather than a generic "every entity," makes this section easier to check
against in a future Phase 2D design pass. No gap found. The "AI Integration" reserved
placeholder (§22 item 9) is correctly unscoped — this review has nothing to critique
about a feature that has deliberately not been designed yet, beyond confirming §15's
gating language is strict enough to prevent it from being scoped loosely later.

---

# Part 2 — Conflicts With Existing Architecture

| # | Conflict | Resolution |
|---|---|---|
| 2.1 | ADR-003 vs. persistent authentication | Resolved by formal amendment, now ADR-015 (supersedes ADR-014, which superseded ADR-011). Checked directly: ADR-003, ADR-011, ADR-014, ADR-015, and docs/31 all agree on current state. No stale pointer found. |
| 2.2 | ADR-006 vs. JSON-encoded columns | Resolved — no longer an open ambiguity, now a documented, versioned, validated policy (docs/44 §11.4). This review's Version 2.0 recommendation (a short clarifying note on ADR-006 itself) remains a low-priority follow-up, not a blocker — docs/44 §11.4's specificity substantially reduces the need for it. |
| 2.3 | ADR-012's original card-migration deferral vs. the now-committed full migration | Resolved by amendment (added to ADR-012 in this change, not a full supersession — the core registry-driven decision is unchanged, only the scope/timing of migration is resolved). Checked directly against ADR-007: an amendment note was added, not a silent rewrite of the original Decision text — compliant. |
| 2.4 | docs/24's scope vs. this plan's scope | Unchanged mechanism — docs/24 updated in the same change. |

No new conflict found with ADR-001, ADR-002, ADR-004, ADR-005, ADR-007, ADR-008,
ADR-009, ADR-010, or ADR-013.

---

# Part 3 — Risks, Ranked (Re-done for Version 3.0)

1. **Full dashboard migration surface area (docs/44 §7.3, PCP-4).** Severity: **now
   this plan's highest-ranked risk**, having moved up now that JSON storage (previously
   #1) has a concrete, de-risking policy. Not a design-soundness risk — an
   implementation/regression risk, since one batch touches the rendering path of three
   already-shipped, verified features at once. Mitigated by this review's Part 1.3
   recommendation (explicit regression pass against all three existing browser-test
   suites as part of PCP-4's own completion criteria).
2. **Optional PIN hashing (docs/44 §5.4, §18).** Severity: medium-high, unchanged in
   substance from Version 2.0 — still requires a dedicated security review before
   PCP-8's PIN sub-batch, independent of Trusted Device/Long-Lived Session.
3. **Long-Lived Session's implementation path — frozen-file question (docs/44 §5.5).**
   Severity: medium. Whether this requires modifying `FoundationSession.gs` is
   undecided; this review recommends resolving it before PCP-8 is scoped in detail
   (Part 1.1).
4. **`DoctorAssignedCondition` vs. `Patient.condition_slug` coexistence (docs/44 §6.2).**
   Severity: low-medium, new in Version 3.0 (Part 1.2) — a loose end about which field
   readers should consult going forward, not a design flaw.
5. **Scope size.** Severity: medium, essentially unchanged from Version 2.0 — eleven
   batches now (PCP-1 through PCP-11) rather than ten, offset by clearer
   infrastructure-first sequencing.
6. **JSON storage's disclosed raw-Sheet-readability cost.** Severity: low — accepted,
   not solved, per Part 1.5; not re-litigated here.

---

# Part 4 — Roadmap / Scope Gaps (Unchanged from Version 2.0)

| Gap | Status |
|---|---|
| **Public (no-login) Calculator variant** | Still unclaimed. |
| **Appointment** | Still unowned by any phase. |
| **Messages** | Still has no architecture anywhere. |
| **`Notification` shared entity** | Unaffected. |
| **AI Integration's concrete scope (new)** | Deliberately unclaimed by design (docs/44 §22 item 9 is a placeholder) — not a gap in the sense of an oversight, a reserved slot. |

---

# Part 5 — Final Verdict

## Is the architecture in docs/44 (Version 3.0) ready for any batch to begin?

**More favorably than Version 2.0's verdict.** Several previously-open questions are
now settled decisions rather than recommendations awaiting sign-off, which removes
entire categories of pre-batch settlement work Version 2.0's verdict required. **PCP-1
(Patient Profile) is ready** — it has no dependency on anything else in this plan and
its two Version 1.0-era open questions (Part 1.2 of Version 1.0's review: `Patient.
status = inactive` handling, eager-vs-lazy row creation) remain the only thing worth
resolving before, not during, implementation. **PCP-2 (Doctor-Assigned Conditions) is
ready**, with Part 1.2's coexistence loose end worth a quick resolution first. **PCP-3
(Module Registry) is ready** as a pure scaffold. **PCP-4 (Dashboard Registry) is ready
architecturally but should carry its own explicit regression-testing commitment**
(Part 1.3/Part 3 item 1) given it is now this plan's highest-ranked risk. **PCP-5
through PCP-7 are ready**, their prior open questions (template assignment, JSON
policy) now resolved. **PCP-8 (Persistent Login) is ready for its Trusted
Device/Long-Lived Session portion**, pending §5.5's frozen-file question being answered
before detailed scoping; **its PIN portion still requires the dedicated security
review**, independent of the rest. **PCP-9 (AI Integration) is correctly not ready for
any scoping at all** — it is a placeholder, not a designed batch.

## What should happen before any batch begins
1. Resolve `DoctorAssignedCondition` vs. `Patient.condition_slug` reader coexistence
   (Part 1.2) before PCP-2's detailed scoping.
2. Decide whether Long-Lived Session touches `FoundationSession.gs` or is additive
   (Part 1.1) before PCP-8's detailed scoping.
3. Commit to an explicit regression-testing plan for PCP-4 (Part 1.3) as part of that
   batch's own definition of done, not an afterthought.
4. A dedicated security review for `PatientCredential` (PIN) hashing before PCP-8's PIN
   sub-batch specifically.
5. The two small Patient Profile lifecycle questions (inactive-status handling,
   eager-vs-lazy creation) answered before PCP-1's detailed scoping.

## What does not need to happen before batches begin
Resolving Messages, Appointment, Notification, or the Public Calculator variant.
Designing anything for PCP-9 (AI Integration) or Digital Twin.

## Statement
docs/44 (Version 3.0), together with this review and docs/46 (Version 3.0), and
ADR-012 (amended), ADR-013 (confirmed), ADR-015 (current governing authentication ADR;
ADR-011 and ADR-014 both superseded and kept on record), represents a materially more
settled architecture-freeze pass than Version 2.0 — most of the open design forks
Version 2.0 carried have been resolved into locked decisions by this round of review,
and the remaining open items (above) are narrower and more implementation-specific than
before.

**This document does not itself authorize PCP-1, or any other batch in docs/44 §22, to
begin.** Per this session's explicit instruction, implementation starts only on
separate, explicit approval.
