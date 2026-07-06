# 45 - Phase 2B Architecture Readiness Review
## Version 2.0 — 2026-07-06

> This review critiques docs/44-PHASE-2B-TECHNICAL-PLAN.md (now Version 2.0) — it does
> not restate it. Read docs/44 first. Per this session's explicit instruction, **this
> document does not authorize any batch in docs/44 §22 to begin.**
>
> **What changed since Version 1.0 of this review:** docs/44's authentication design
> changed from PIN-primary (ADR-011) to Trusted-Device-primary (ADR-014); Doctor-Assigned
> Conditions, Module Engine, and Calculator Framework were elevated to named
> architectural pillars; the batch sequence was re-ordered accordingly. This version
> re-does Part 1's authentication critique and Part 3's risk ranking from scratch rather
> than patching them, since the underlying mechanism changed, not just its description.
> Parts 1.2–1.12 (excluding authentication), Part 2.1's resolution mechanism, and Part 4
> are substantively unchanged from Version 1.0 and are carried forward with only
> section-number and batch-name updates.

---

# Part 1 — Critique of Each Proposal

## 1.1 Persistent Authentication — Trusted Device Primary, PIN Secondary (docs/44 §5)

**This is a materially stronger design than Version 1.0's.** Moving the primary
mechanism from a human-chosen PIN to a machine-generated device token doesn't just
relocate risk — it removes the specific problem (no bcrypt-equivalent on Apps Script for
a low-entropy secret) for the mechanism most patients will actually use, by making the
primary secret high-entropy instead. Reusing `LoginToken`'s already-proven hashing
pattern for the device token, rather than inventing a new primitive, is the right call
and is fully justified by §5.2's reasoning.

**What remains genuinely unresolved, carried from Version 1.0's PIN critique, now
narrower in scope:** the PIN path (§5.3, §5.5) still needs the iterated-HMAC bridge and
still needs its own security review with real numbers (iteration count, minimum length,
lockout threshold) — unchanged from before, just no longer gating the platform's
primary access path. **Recommendation: PCP-5 (the PIN batch) should not be blocked
waiting on PCP-4 (Trusted Device) to prove itself in production** — they are
independent enough to review and potentially approve separately, provided PCP-5's own
security review happens regardless of PCP-4's status.

**New questions this version raises that Version 1.0 didn't have:** 
- Trusted Device introduces a **"manage my devices" surface** (§5.4's `device_label`
  implies a patient-facing list of trusted devices) that docs/44 doesn't fully specify —
  is this a Phase 2B UI requirement, or deferred? Not answered in docs/44 §5;
  recommend treating it as in-scope for PCP-4 at least in a minimal form (a device list
  + individual revoke + "sign out everywhere"), since revocability without visibility
  is not meaningfully usable by a patient.
- **Token-rotation failure handling** (docs/44 §5.6) is correctly flagged as open, but
  this review notes it is not purely a "tune later" parameter the way PIN length is —
  a rotated-token-reuse event is a *security signal* (possible theft or a
  race-condition bug), not just a UX tuning knob, and deserves at least a logged
  `AuditLog` event even if no automated response (e.g., auto-revocation) is built in
  PCP-4's first version. Recommend docs/44 §5.6 be read as "defer the *response*, not
  the *detection*."
- **Multi-device session semantics**: if a patient has two trusted devices and revokes
  one, does the other's active Session remain valid until its own TTL expires, or is
  revocation phone-wide? docs/44 doesn't say. Reasonable default: revoking a
  `TrustedDevice` prevents *future* token exchanges from that device but does not
  retroactively kill an already-issued Session on another device — consistent with how
  Session and LoginToken are already independent layers (ADR-002). Not locked in here;
  flagged for the approving reviewer.

## 1.2–1.12 — Carried forward from Version 1.0, batch names updated

The critiques below are substantively unchanged from this review's Version 1.0; only
docs/44 section numbers and docs/44 §22 batch names are updated to match Version 2.0.

**1.2 Patient Profile (docs/44 §17 note, formerly §5).** Same two open questions as
before: what happens to `PatientProfile` on `Patient.status = inactive`, and whether a
row is created eagerly or lazily. Still unanswered; still non-blocking. Batch: PCP-6
(was a distinct batch in v1.0; renumbered).

**1.3 Doctor-Assigned Conditions (docs/44 §6).** The Option A/B fork is unchanged and
still correctly resolved toward Option B for the same reason as before (avoiding
re-triaging `patient-identity.schema.json`'s 152 conformance checks). Now explicitly
Pillar 1 rather than a standalone item — this review's original recommendation to treat
Option B as settled before batch 1 (now PCP-1) still stands, and matters more now that
two other pillars and every consumer capability reference it.

**1.4 Module Engine (docs/44 §7).** Unchanged critique: the Module Registry's own
maintenance mechanism (config file vs. staff tool) should be stated explicitly as "a
config file, not a dynamic admin system, for this plan's scope" — docs/44 §7.1 Version
2.0 now says this explicitly, closing this review's Version 1.0 gap.

**1.5 Template Engine (docs/44 §11).** Still this plan's most consequential unresolved
design fork — the JSON-encoded-answers Option B recommendation, and its real cost (a
doctor/staff member opening the raw Sheet sees an unreadable blob). Unchanged from
Version 1.0; still flagged as worth a second opinion before PCP-7 (was PCP-5) is scoped
in detail.

**1.6 Personalized Daily Check-ins (docs/44 §10).** Coexistence-before-retirement
posture unchanged and correct. The multi-condition template-selection question
(docs/44 §10.4) is unchanged and still needs resolving before PCP-7's schema is
finalized.

**1.7 Calculator Framework (docs/44 §8).** Unchanged: the cleanest section in the
plan, now explicitly framed as Pillar 3 — general-purpose, not single-use, which this
review agrees is an accurate and useful framing given docs/44 §8.2's explicit statement
that any future deterministic scoring need can reuse it without new architecture.

**1.8 Personal Care Plan (docs/44 §12).** Unchanged: whether a new `CarePlan` version
needs its own doctor-review/approval step (ADR-005-style) beyond authorship is still
implied-but-not-stated. This review's Version 1.0 assessment stands: likely unnecessary
given content is entirely doctor-authored with no AI involvement (docs/44 §15), but
docs/44 should say so explicitly.

**1.9 Patient Dashboard Evolution (docs/44 §13).** Unchanged, sound — now explicitly
described as the Module Engine pillar's patient-facing surface rather than a separate
concern, which this review agrees removes a redundant framing Version 1.0 had.

**1.10 Feature Enable/Disable Per Patient (docs/44 §14).** Unchanged recommendation:
default to "always an explicit staff action" for first batches.

**1.11 AI Boundaries (docs/44 §15).** Unchanged: thorough, no gap found.

**1.12 Digital Twin Integration Scope (docs/44 §16).** Unchanged: correctly minimal,
same vigilance note as Version 1.0 about not building anything Digital-Twin-shaped
under a "just a UI convenience" framing.

---

# Part 2 — Conflicts With Existing Architecture

| # | Conflict | Resolution |
|---|---|---|
| 2.1 | ADR-003 ("no patient password is ever collected, stored, or reset") vs. persistent authentication | Resolved by formal amendment — first ADR-011, now ADR-014 (which supersedes ADR-011 and further amends ADR-003). The resolution mechanism is unchanged from Version 1.0; only the specific ADR governing it changed. |
| 2.2 | ADR-006 ("flat, typed-by-convention columns") vs. Template Engine/Calculator's JSON-encoded columns | Unchanged from Version 1.0 — a disclosed, reasoned exception, still flagged in Part 1.5 for a second opinion, not overturned. |
| 2.3 | docs/24's prior scope vs. this plan's scope | Unchanged mechanism (docs/24 updated in the same change), now describing an even more consolidated framing (Patient Experience Platform, three named pillars) than Version 1.0's expanded-but-still-flat list. See Part 4. |
| 2.4 | docs/23's lifecycle stage ordering vs. batch sequencing | Unchanged from Version 1.0 — not a real conflict, lifecycle stages are conceptual, not a sequencing requirement. |

No new conflict introduced by Version 2.0's authentication redesign or pillar
elevation — checked explicitly against ADR-001, ADR-002, ADR-004, ADR-005, ADR-007,
ADR-008, ADR-009, ADR-010, and the now-superseded ADR-011 (properly marked, not
silently removed, per ADR-007).

---

# Part 3 — Risks, Ranked (Re-done for Version 2.0)

The risk ranking below is **not** a patch of Version 1.0's — the authentication redesign
changes the platform's risk profile enough to warrant re-ranking from scratch.

1. **Template Engine's JSON-encoded columns as a new, precedent-setting pattern
   (docs/44 §11.2/§8.1).** Severity: **now this plan's highest-ranked risk**, having
   moved up from #2 in Version 1.0 now that authentication's risk has dropped. Not a
   security risk — an operational-transparency and architectural-precedent risk (Part
   1.5). Recommend a deliberate, named decision before PCP-7, not silent inheritance of
   docs/44's Option B recommendation.
2. **PIN hashing on Apps Script, now scoped to the secondary path only (docs/44 §5.3,
   §5.5, ADR-014 §7).** Severity: medium-high, down from Version 1.0's #1 ranking. The
   underlying cryptographic limitation is unchanged and still real, but it no longer
   gates the platform's primary access mechanism — a patient who never opts into a PIN
   never encounters this risk at all, unlike Version 1.0 where PIN was the only
   persistent option. Still requires its own dedicated security review before PCP-5.
3. **Trusted Device token rotation/replay handling (docs/44 §5.2, §5.6, new in Version
   2.0).** Severity: medium. Bounded by rotation-on-use and revocability by design, but
   the exact detection/response behavior on a replayed rotated token is unspecified —
   see Part 1.1's recommendation to at least audit-log the event even if no automated
   response ships in PCP-4's first version.
4. **Doctor-Assigned Conditions' Option A vs. B (docs/44 §6.2).** Severity: medium,
   time-sensitive — unchanged from Version 1.0, now more consequential given Pillar 1's
   central role feeding Pillars 2/3 and every consumer.
5. **Scope size (docs/44 §20 item 5).** Severity: medium, slightly reduced from Version
   1.0 — the pillar framing gives reviewers a clearer mental model (three foundations,
   then consumers) even though the batch count (ten, docs/44 §22) is unchanged from
   Version 1.0's nine plus the new PCP-5 split.
6. **`PatientProfile` as the platform's first patient-mutable structured data (docs/44
   §17 note).** Severity: low-medium, unchanged from Version 1.0.
7. **Vision/roadmap reframing optics (docs/44 §20 item 6).** Severity: low — a
   documentation-continuity concern, resolved in this same change by explicitly
   recording what changed and why (docs/44's "What Changed in Version 2.0" notice).

---

# Part 4 — Roadmap / Scope Gaps (Unchanged from Version 1.0)

| Gap | Status |
|---|---|
| **Public (no-login) Calculator variant** | Still unclaimed. docs/44 §8 claims only the Patient variant. |
| **Appointment** | Still unowned by any phase. Not touched by this plan. |
| **Messages** | Still has no architecture anywhere. Remains a `future`-badged placeholder. |
| **docs/24's reframing** | This review confirms the Patient Experience Platform reframing and pillar elevation are a legitimate response to explicit review feedback, not unilateral scope drift — docs/44's own "What Changed in Version 2.0" notice and docs/24's update make the change traceable. |
| **`Notification` shared entity** | Unaffected. |

---

# Part 5 — Final Verdict

## Is the architecture in docs/44 (Version 2.0) ready for any batch to begin?

**Conditionally — batch by batch, more favorably than Version 1.0's verdict, since the
authentication redesign removes what was previously the single blocking-grade risk from
the critical path.** PCP-1 (Doctor-Assigned Conditions, Pillar 1) and PCP-2 (Module
Engine scaffold, Pillar 2) remain architecturally sound with no new blocking questions.
**PCP-3 (Calculator Framework, Pillar 3) is now assessed as ready pending only PCP-2**,
unchanged from Version 1.0. **PCP-4 (Trusted Device) is materially more ready than
Version 1.0's equivalent batch was** — it reuses a proven hashing pattern and carries no
new cryptographic risk, though the "manage my devices" surface (Part 1.1) should be
scoped into it explicitly, not discovered mid-implementation. **PCP-5 (PIN, secondary)
still requires the dedicated security review** before its own approval, independent of
PCP-4. PCP-6 (Patient Profile) is sound pending its two small open questions (Part 1.2).
PCP-7/PCP-8 (Daily Check-ins/Care Plan) depend on the Template Engine design fork (Part
1.5, now this plan's top-ranked risk) being explicitly confirmed before detailed
scoping.

## What should happen before any batch begins
1. Explicit sign-off on Doctor-Assigned Conditions Option B (docs/44 §6.2).
2. Explicit sign-off on the Template Engine's JSON-encoded-column approach (docs/44
   §11.2 Option B) — this review's now-highest-ranked open item.
3. Scope a minimal "manage my devices" surface into PCP-4 rather than deferring it
   entirely (Part 1.1).
4. A dedicated security review for `PatientCredential` (PIN) hashing before PCP-5
   specifically — can proceed in parallel with other batches, not a gate on the whole
   plan.
5. The two small Patient Profile lifecycle questions (Part 1.2) answered.
6. The multi-condition Check-in template-selection question (docs/44 §10.4) answered
   before PCP-7's schema is finalized.

## What does not need to happen before batches begin
Resolving Messages' or Appointment's architecture, migrating any existing Phase 2A
dashboard card onto the Module Registry, or deciding the Public Calculator variant —
unchanged from Version 1.0.

## Statement
docs/44 (Version 2.0), together with this review and docs/46 (Version 2.0), and
ADR-012/013/014 (ADR-011 superseded), represents a complete, internally-critiqued
architecture-freeze pass reflecting the approved-in-principle direction: a broader
Patient Experience Platform vision, a lower-risk trusted-device-primary authentication
strategy, and three named architectural pillars. The plan's genuine open questions and
its current highest-ranked risk (the Template Engine's column representation) are named
explicitly above, not resolved by assumption.

**This document does not itself authorize PCP-1, or any other batch in docs/44 §22, to
begin.** Per this session's explicit instruction, implementation starts only on
separate, explicit approval.
