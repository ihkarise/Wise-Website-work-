# 45 - Phase 2B Architecture Readiness Review
## Version 1.0 — 2026-07-04

> This review critiques docs/44-PHASE-2B-TECHNICAL-PLAN.md — it does not restate it.
> Read docs/44 first. Per this session's explicit instruction, **this document does not
> authorize any batch in docs/44 §21 to begin.** It exists to surface every assumption,
> risk, and open question before anyone approves one.

---

# Part 1 — Critique of Each Proposal

## 1.1 Persistent Authentication (docs/44 §4)
The plan correctly identifies that ADR-003's prohibition is absolute, not a "default"
that additive options can quietly route around — a genuine conflict, resolved by formal
amendment (ADR-011) rather than reinterpretation. That is the right mechanism.

**What the plan gets right:** magic link as permanent, un-disableable recovery; PIN as
strictly opt-in; explicit acknowledgment that Apps Script has no vetted password-hashing
primitive, rather than quietly reusing an existing one.

**What remains genuinely unresolved:** an iterated-HMAC construction is a workaround,
not a solution. It raises the cost of an offline brute-force attack but does not
eliminate it, and the "right" iteration count is a moving target that depends on Apps
Script's actual execution-time budget per invocation — a number this plan correctly
declines to guess. **Recommendation: treat PCP-4 (docs/44 §21) as requiring its own
pre-implementation security spike** (measuring real iteration throughput on Apps
Script) before its batch is even scoped in detail, not just before it ships.

**A question the plan does not ask:** should a PIN be shorter/more convenient (e.g., 4
digits) than a password, given both are described as "persistent authentication"
interchangeably in the request? A 4-digit PIN has only 10,000 possible values — even
with strong hashing, an *online* rate-limited attack (not offline brute force) against a
10,000-value space is a materially different risk than an 8+ character password. The
plan's rate-limiting (§4.1 point 5) addresses this but the two credential types
probably warrant different minimum-length/lockout parameters, not one shared rule. Not
decided in docs/44 — flagged here for the security review §17 already calls for.

## 1.2 Patient Profile (docs/44 §5)
The recommendation to keep `PatientProfile` separate from `Patient` (Option b) is sound
and consistent with every other recommendation in this plan. One gap: the plan does not
say what happens to `PatientProfile` fields if a patient's `Patient.status` becomes
`inactive` — does profile data persist, get restricted, or get purged? Not asked in
docs/44 §5; no answer assumed here either. Also unaddressed: is a `PatientProfile`
row created automatically at Patient creation (like `Patient` itself), or lazily on
first edit? Affects whether "no profile exists yet" is a valid state the frontend must
handle.

## 1.3 Doctor-Assigned Conditions (docs/44 §6)
The Option A/B fork is the right way to present this — a genuine trade-off, not a
disguised default. This review's own assessment: **Option B is correct**, for a reason
docs/44 doesn't fully state — Option A would require re-running or re-triaging
`shared/schemas/patient-identity.schema.json`'s conformance suite (152 checks) against
a widened field, and docs/43's freeze explicitly reserves frozen-file changes for "bug
fixes," which a plural-conditions feature request is not. Option B should be treated as
settled, not merely recommended, before PCP-1 is scoped in detail.

**Unaddressed:** what happens to a patient's Daily Check-in template selection (§9.3)
or Calculator availability (§10.2) when their *only* active condition is marked
`resolved`? Does the associated module silently disappear, or persist read-only? Not
specified.

## 1.4 Module Engine (docs/44 §7 / ADR-012)
Sound, and correctly scoped as non-disruptive to existing cards. One real gap: the
Module Registry is described as "static, staff/developer-maintained" config, but no
mechanism is proposed for who edits it or how a new module gets registered — is it a
JSON file edited via a normal code change (like `condition-slugs.json`), or does it need
its own staff-facing admin tool? For Phase 2B's scope (a handful of new modules shipped
by this same team) a config file is almost certainly sufficient — but the plan should
say so explicitly rather than leave "Module Registry" sounding more dynamic than it is.

## 1.5 Template Engine (docs/44 §8)
This is the plan's most consequential unresolved design fork. The Option A/B/C
comparison is genuinely well-reasoned, and Option B (JSON-encoded answers) is
defensible — but it is also the first time this platform would store meaningfully
opaque data in a Sheet cell, and docs/44 undersells one consequence: **a doctor or staff
member opening the raw Sheet (which docs/33/ADR-006 both assume as a legitimate,
supported operational path at this platform's current scale) would see an unreadable
JSON blob instead of a value**, unlike every existing Sheet-backed entity where every
column is human-readable in place. This is a real, disclosed cost of Option B that
should be weighed consciously, not just as a schema-purity trade-off. If staff regularly
need to eyeball raw Check-in data without going through the patient-facing UI, Option A
(fixed superset columns) may be worth its own reconsideration despite being less
"clean." **This review does not overturn docs/44's Option B recommendation, but flags it
as the item most worth a second opinion before PCP-5 is scoped.**

## 1.6 Personalized Daily Check-ins (docs/44 §9)
The coexistence-before-retirement migration posture (§9.1) is correct and directly
follows ADR-008. The open question in §9.4 (multiple active conditions → which
template) is real and should be resolved before PCP-5, not during it — it changes
`CheckInResponse`'s relationship to `CheckInTemplate` (one-to-one vs. needing a
merge/priority rule) and is schema-shaping, not a UI detail.

## 1.7 Calculator Framework (docs/44 §10)
The cleanest section in the plan — ADR-013 gives it a firm boundary, the data model
mirrors Symptom Log's already-proven shape, and no open question is left dangling
except the same JSON-encoded-column question already raised in 1.5 (applies identically
to `input_snapshot`).

## 1.8 Personal Care Plan (docs/44 §11)
Correctly promotes docs/33's two "Conceptual" entities rather than inventing new ones.
The append-only versioning model is consistent with docs/33 §3.4's own instinct. One
gap: the plan does not say whether a new `CarePlan` version requires a fresh doctor
review/approval step analogous to Consultation Summary's `Review.gs` gate, or whether
authorship alone (no separate review) is sufficient given the author is already a
doctor. Given ADR-005's pattern applies specifically to *AI-generated* content and Care
Plan content here is proposed as entirely doctor-authored (§14 confirms no AI
involvement), a separate review gate is likely unnecessary — but docs/44 should say this
explicitly rather than leave it implied by omission.

## 1.9 Patient Dashboard Evolution (docs/44 §12)
Correctly scoped as minimal/deferred. No further critique — this section inherits its
soundness entirely from ADR-012.

## 1.10 Feature Enable/Disable Per Patient (docs/44 §13)
The open question (automatic vs. always-explicit enablement) is real but low-risk either
way — recommend defaulting to "always an explicit staff action" for Phase 2B's first
batches (simpler, more auditable, reversible) and revisiting automatic rules only if
manual toggling proves to be real operational friction. This is a recommendation, not
something docs/44 or this review locks in.

## 1.11 AI Boundaries (docs/44 §14)
Thorough and correctly conservative — every surface that could touch AI is explicitly
routed back through ADR-001/004/005 rather than granted a Phase-2B-specific exception.
No gap found.

## 1.12 Digital Twin Integration Scope (docs/44 §15)
Correctly minimal. The one thing worth stating more forcefully than docs/44 does:
**Phase 2B must not build anything that could be mistaken for early Digital Twin work**
(e.g., a "summary" view aggregating Check-in trends over time) without that being called
out and run past ADR-001/004/005 explicitly first, even if framed internally as "just a
UI convenience." docs/44 §15's own wording ("data-shape compatibility only") already
says this; this review underlines it as a boundary worth active vigilance during
implementation, not just at design time.

---

# Part 2 — Conflicts With Existing Architecture

| # | Conflict | Resolution |
|---|---|---|
| 2.1 | ADR-003 ("no patient password is ever collected, stored, or reset") vs. requested persistent authentication | Resolved by formal amendment, ADR-011 (docs/44 §4.1) |
| 2.2 | ADR-006 ("flat, typed-by-convention columns") vs. Template Engine/Calculator's proposed JSON-encoded columns | Not a contradiction — a disclosed, reasoned exception (docs/44 §8.2), justified on ADR-006's actual migration-safety intent rather than literal flatness. Flagged in Part 1.5 above for a second opinion, not overturned. |
| 2.3 | docs/24-ROADMAP.md's prior one-line "Phase 2B — Personal Care Plan" vs. this plan's twelve-capability scope | Not an architectural conflict — a roadmap-scope mismatch. Resolved by updating docs/24 in this same change (docs/44 §20); see Part 4 below for the honest accounting of what changed. |
| 2.4 | docs/23-PATIENT-LIFECYCLE.md's stage ordering (Personal Care Plan precedes Symptom Tracker) vs. this plan's Daily Check-ins-alongside-Symptom-Tracker-before-Care-Plan batch order (docs/44 §21: PCP-5 before PCP-7) | Not a real conflict — docs/23 describes a patient's *conceptual* journey stages, not an implementation-sequencing requirement. Batch order is chosen by risk/dependency (ADR-008), not lifecycle-stage order. Worth a one-line clarifying note in docs/23 if it's ever revised, not a blocking issue now. |

No conflict found with ADR-001, ADR-002, ADR-004, ADR-005, ADR-007, ADR-008, ADR-009, or
ADR-010 — every new ADR (011/012/013) and every proposal in docs/44 was checked against
each explicitly in Part 1 above and docs/44 §3/§14.

---

# Part 3 — Risks, Ranked

1. **PIN/password hashing on Google Apps Script (docs/44 §4.2, ADR-011 §4).** Severity:
   high. Apps Script's only primitives are single-pass, unsalted-by-default, no-work-
   factor constructions. The proposed iterated-HMAC bridge reduces but does not
   eliminate offline brute-force risk if a `PatientCredential` row is ever exfiltrated.
   **This is the single highest-risk item in this entire architecture-freeze pass** and
   is the one place this review recommends withholding approval for its specific batch
   (PCP-4) independent of approving anything else in docs/44 §21 — it should get its own
   dedicated security review (mirroring PA-7's magic-link/session review, docs/43 §6)
   with real numbers (measured iteration throughput, chosen minimum PIN/password
   length, chosen lockout threshold) before implementation, not architecture-level
   sign-off alone.
2. **JSON-encoded columns as a new, precedent-setting pattern (docs/44 §8.2/§10.1).**
   Severity: medium. Not a security risk — an operational-transparency and
   architectural-precedent risk (Part 1.5 above). Recommend a deliberate, named decision
   before PCP-5, not silent inheritance of docs/44's recommendation.
3. **Scope size (docs/44 §19 item 4).** Severity: medium. Twelve capabilities in one
   freeze pass is real breadth. Mitigated structurally by docs/44 §21's batch
   independence (PCP-2 through PCP-7 have minimal cross-dependencies beyond PCP-1/PCP-2)
   — no single point of failure blocks the whole scope, but the approving reviewer
   should expect to approve batches individually over time, not as one bundle.
4. **Doctor-Assigned Conditions' Option A/B (docs/44 §6.2, §19 item 3).** Severity:
   medium, time-sensitive. This review recommends settling on Option B explicitly (Part
   1.3) before PCP-1 begins, since reversing the choice later is costly in a way
   reversing most other Phase 2B decisions is not.
5. **`PatientProfile` as the platform's first patient-mutable structured data (docs/44
   §5.3).** Severity: low-medium. Well-understood risk category (authorization +
   audit-logging), directly precedented by every existing write endpoint's discipline —
   flagged only because it is a first, not because the mitigation is unclear.
6. **Roadmap/scope-mismatch optics (docs/44 §19 item 5, Part 4 below).** Severity: low.
   Purely a documentation-honesty concern, already being resolved in this same change.

---

# Part 4 — Roadmap / Scope Gaps Carried Forward or Newly Surfaced

| Gap | Status |
|---|---|
| **Public (no-login) Calculator variant** (docs/33 §5.3, docs/34 Part 3) | Still unclaimed. docs/44 §10 claims only the Patient variant for Phase 2B. Recommend docs/24 note this explicitly rather than let "Calculator Framework" in the roadmap read as fully resolved — done, docs/24's update names the Patient variant specifically. |
| **Appointment** (docs/33 §4.1, docs/34 Part 4 item 4) | Still unowned by any phase. Not touched by this plan (docs/44 §2.2) — correctly out of scope, not silently dropped. |
| **Messages** (dashboard placeholder) | Still has no architecture anywhere, in this plan or any prior document. Remains a `future`-badged placeholder (docs/44 §12) — an honest gap, not a regression. |
| **docs/24's prior one-line Phase 2B scope vs. this plan's actual scope** | The roadmap previously named only "Personal Care Plan." This review confirms the expanded scope is a legitimate response to an explicit, broader instruction for this planning pass — not scope creep introduced unilaterally — and that docs/24's update (docs/44 §20) accurately reflects what was actually asked for and designed. |
| **`Notification` shared entity** (docs/34 Part 4 item 6) | Unaffected by this plan. Daily Check-in/Care Plan updates do not introduce a third independent notification flow in this design — no new trigger for revisiting this gap. |

---

# Part 5 — Final Verdict

## Is the architecture in docs/44 ready for any batch to begin?

**Conditionally — batch by batch, not as a bundle.** PCP-1 (Doctor-Assigned Conditions
foundation) and PCP-2 (Module Registry scaffold) are architecturally sound as designed,
have no open blocking questions beyond the Option A/B settlement this review already
resolves in Part 1.3/3.4, and carry no security risk beyond what every existing
Foundation batch already carries. PCP-3 (Patient Profile) is sound pending the two small
open questions in Part 1.2 being answered (not blocking, but should be answered before,
not during, implementation). **PCP-4 (persistent authentication) is not ready for
implementation approval on architecture grounds alone** — it requires the dedicated
security review named in Part 3 item 1 first, independent of whether the rest of docs/44
is approved. PCP-5 through PCP-7 depend on the Template Engine design fork (Part 1.5)
being explicitly confirmed, not just recommended, before detailed batch scoping.

## What should happen before any batch begins
1. Explicit sign-off on Doctor-Assigned Conditions Option B (docs/44 §6.2) — this review
   recommends it; it is not yet a locked decision.
2. Explicit sign-off on the Template Engine's JSON-encoded-column approach (docs/44
   §8.2 Option B) — or a deliberate choice to reconsider Option A given Part 1.5's
   operational-transparency concern.
3. A dedicated security review/spike for `PatientCredential` hashing (Part 3 item 1)
   before PCP-4 specifically is scoped in implementation detail — this can happen in
   parallel with other batches proceeding, not as a gate on the whole plan.
4. The two small Patient Profile lifecycle questions (Part 1.2) answered.
5. The multi-condition Check-in template-selection question (docs/44 §9.4) answered
   before PCP-5's schema is finalized.

## What does not need to happen before batches begin
- Resolving Messages' or Appointment's architecture (Part 4) — genuinely unrelated to
  this scope.
- Migrating any existing Phase 2A dashboard card onto the Module Registry (ADR-012's own
  Future Considerations already defers this).
- Deciding the Public Calculator variant — explicitly out of scope (docs/44 §2.2).

## Statement
docs/44, together with this review and docs/46 (Repository Consistency Review), and
ADR-011/012/013, represents a complete, internally-critiqued architecture-freeze pass
for the scope requested. It does not paper over the plan's genuine open questions or its
one real point of elevated risk (persistent-credential hashing) — those are named
explicitly above, not resolved by assumption.

**This document does not itself authorize PCP-1, or any other batch in docs/44 §21, to
begin.** Per this session's explicit instruction, implementation starts only on
separate, explicit approval.
