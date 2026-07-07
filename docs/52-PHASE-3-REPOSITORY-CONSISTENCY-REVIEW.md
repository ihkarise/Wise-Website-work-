# 52 - Phase 3 Repository Consistency Review
## WHIMS Patient Intelligence Platform — Version 1.0 — 2026-07-16

> Cross-checks docs/49, docs/50, docs/51, and ADR-017–020 against the entire existing
> document set (docs/00–48, ADR-001–016) for duplication, contradiction, and stale
> cross-reference — the same discipline docs/34 and docs/46 applied at their own
> respective architecture-freeze points. No document is modified to produce this
> review beyond the two closures docs/51 Part 5 already named as required (§2 below
> records both as resolved by this same session, per docs/44-era precedent of closing a
> readiness-review finding within the same version rather than carrying it forward
> unresolved).

---

# Part 1 — Duplication

## 1.1 "WiseOS" naming — checked directly, one forward-reference updated

docs/51 Part 1.2 flagged that "WiseOS" appears in shipped documentation in two
different roles: as a **historical record** (accurate as written at the time — docs/21
§"Layer 3", docs/29 §0's non-goal list, docs/32 Part 2's table) and as a **live,
forward-looking cross-reference** that should track the rename (docs/33 §1.4's "plausibly
Phase 3 (WiseOS) territory"). Checked every occurrence:

| Location | Role | Action |
|---|---|---|
| docs/21 §"Layer 3 – WiseOS" | Historical/foundational product-layer name | Kept as written — pre-dates this rename, accurate at the time (docs/49 §2's own "keep history" rule) |
| docs/29 §0's non-goal list | Historical (Phase 2A's own frozen non-goal statement) | Kept as written |
| docs/32 Part 2's roadmap table | Historical (a past review's own recommendation) | Kept as written |
| docs/24-ROADMAP.md's Phase 3 heading | Live, current-state | **Updated** (§7 of this review, Task 7) |
| docs/33 §1.4's "plausibly Phase 3 (WiseOS) territory" | Live, forward-looking | **Updated** to name both current and prior names, mirroring how docs/33 §3.4 already handles a superseded-in-place cross-reference for `CarePlan`/PXP-7 |

No duplication risk found beyond this — the rename touches exactly two live
cross-references, both now closed.

## 1.2 No new duplication introduced between docs/50 and docs/33

docs/50 follows docs/34 Part 1.6's already-established convention exactly: it
describes implementation shape (§5–§12), and defers entity *meaning* to docs/33 once
each entity is promoted there (§18's documentation-impact section states this
explicitly). No entity's purpose or lifecycle is independently redefined in docs/50 in
a way that could drift from docs/33's own eventual wording.

## 1.3 No new duplication between ADR-017–020 and existing ADRs

Checked each new ADR's Context/Decision text against ADR-002/003/010/012/013/016 in
full: ADR-017 restates ADR-002's *pattern* (identity independent of authentication) by
deliberate analogy, but decides a distinct question (a second, non-merged identity
space) — not a restatement of ADR-002's own Decision text. ADR-018/020 each
explicitly frame themselves as complementary to ADR-012/013/016, following ADR-016's own
precedent for how a new registry-adjacent ADR should relate to an existing one, and
each names a genuinely new decision (specialty scoping; a second, parallel registry)
rather than repeating an existing one. ADR-019 elevates docs/47 §2's Phase-2B-scoped
implementation rule to a permanent principle — a new decision (making it permanent and
platform-wide), not a duplicate of ADR-001/004/005/013 themselves, which it reaffirms by
reference rather than restates in full.

## 1.4 A forming duplication risk, one level deeper — Doctor Session vs. Patient Session

docs/50 §5.5 already names this directly: two session-issuance code paths will share
one signing primitive. This is a deliberate, disclosed, minimal duplication (mirroring
`TrustedDevice.gs`'s own Long-Lived Session precedent), not an oversight — recorded here
so a future reader doesn't wonder whether it was missed, the same practice docs/46 §1.4
already established for an analogous authentication-layer duplication risk.

---

# Part 2 — Contradictions

No contradiction was found between docs/49/docs/50/docs/51/ADR-017–020 and any existing
Accepted ADR, docs/30's principles, or docs/33's domain model. Specifically checked and
confirmed non-contradictory:

## 2.1 ADR-002/003 (Patient Identity/passwordless) vs. ADR-017 (Doctor Identity)
No contradiction — ADR-017 explicitly declines to merge or alias the two identity
spaces and reuses, rather than overturns, ADR-003's passwordless philosophy.

## 2.2 ADR-012 (Module Registry) vs. ADR-020 (Doctor Module Registry)
No contradiction — ADR-020's own Status line states it explicitly ("extends the
registry-driven principle... does not amend ADR-012 itself"), checked directly against
ADR-012's full Decision text: no clause of ADR-012 is restated, narrowed, or reversed.

## 2.3 ADR-006 (Sheets as implementation detail) vs. docs/49 §7's production-scale framing
No contradiction — docs/49 §7 explicitly does not decide a migration; it names Phase
3's scope as the plausible trigger ADR-006 already anticipated, which is consistent
with, not contrary to, ADR-006's own Decision text ("every schema is designed as if a
migration... is a certainty").

## 2.4 docs/44 §22 / docs/48 (Phase 2B closeout) vs. this session's reordering
No contradiction — docs/48 §12's own recommendation ("Phase 2C... or a future
PXP-9 design") is a recommendation, not a binding constraint on sequencing; docs/49 §1
treats it as such and justifies the deviation on the same dependency-order grounds
docs/48 §1 itself already used to justify PXP-10 shipping before PXP-9.

## 2.5 ADR-001/004/005/013 vs. ADR-019
No contradiction — ADR-019's Status line states it reaffirms and generalizes, amending
none of them; checked directly, no clause of any of the four is restated differently or
narrowed.

---

# Part 3 — Roadmap Gaps

## 3.1 Gaps this review closes
Per docs/34 Part 3/Part 4 and docs/48 §7, three previously-open roadmap gaps are given
an owning phase for the first time by docs/49/docs/50:
- **Doctor** (docs/34 Part 3) — now owned by Phase 3/WHIMS, WPI-1 (docs/50 §5).
- **Appointment** (docs/34 Part 3/Part 4 item 4) — now owned by Phase 3/WHIMS, WPI-5
  (docs/50 §8).
- **Notification** (docs/34 Part 3/Part 4 item 6) — now owned by Phase 3/WHIMS, WPI-6
  (docs/50 §9), the "third flow" trigger condition docs/34 named having since been
  passed.

## 3.2 Gaps this review does not close (carried forward, unchanged)
- **Public (no-login) Calculator variant** (docs/46 Part 3, docs/48 §7) — still
  unclaimed by any phase. Not addressed here; a genuine, disclosed omission, not an
  oversight.
- **Optional PIN (`PatientCredential`)** (docs/45 Part 5) — still requires its own
  dedicated security review before any future batch could build it; unrelated to this
  review's scope.
- **Phase 2C (Health Milestones), Phase 2D (Digital Twin & AI Summaries)** — both
  remain open, unscoped by this review (docs/49 §0, §10).
- **Doctor role-based access control** (docs/33 §1.4's own original proposed
  attribute, `role`) — named as a `Doctor.role` field (docs/50 §5.2) but no actual
  role-differentiated permission logic is designed; ADR-017's own Future
  Considerations names this as deferred, consistent with this review.

---

# Part 4 — Recommended Simplifications

1. **Adopt docs/33's future §7 (once added, per Task 7) as canonical for Phase 3 entity
   meaning**, exactly as docs/34 Part 4 item 2 already established for Phase 2A/2B —
   docs/50 should never be re-derived as the meaning source once docs/33 carries these
   entities forward.
2. **Do not build `DoctorPatientAssignment` speculatively** (docs/50 §7.4's own
   deferral, docs/51 Part 1.6) — revisit only when real multi-doctor-per-specialty
   deployment is an actual, not hypothetical, near-term plan.
3. **Do not attempt to resolve the Sheets-at-scale question inside this
   architecture-freeze pass** — it is a capacity/infrastructure decision independent of
   the domain architecture this review covers, correctly flagged rather than resolved
   (docs/49 §7, docs/51 Part 3 item 1).
4. **Track the Doctor Session security review (docs/50 §14) as a named, standing gate**
   — the same discipline that caught Phase 2A's magic-link review only at PA-7 closeout
   (docs/43 §5/§6) rather than at the point it was actually needed; docs/51 Part 5
   already names this gate explicitly so it is not rediscovered late a second time.

---

# Part 5 — Final Architecture Review

## Is the architecture consistent enough to begin implementation?

**Yes, for WPI-1 (Doctor Identity & Session) and WPI-2 (Specialty Registry)
specifically — the same conditional "yes" docs/34/docs/46 gave their own respective
phases at the equivalent point.** Every duplication risk found is disclosed and
accepted, not hidden (Part 1); no contradiction was found anywhere in the existing ADR
set or domain model (Part 2); the roadmap gaps this review closes (Part 3.1) do not
depend on any gap it leaves open (Part 3.2); and the two closures docs/51 Part 5
required (the "WiseOS" cross-reference, docs/50 §7.4's disclosed roster limitation) are
both resolved within this same version, per §1.1 and docs/50 §7.4's own updated text.

## What should happen before WPI-1 specifically

1. The dedicated `DoctorSession` security review (docs/50 §14, docs/51 Part 5) — before
   any code ships, not deferred to a future closeout.
2. Governance approval to begin implementation at all — neither this document nor
   docs/49/docs/50/docs/51 authorizes any batch (docs/50 §19's own closing statement).

## What should happen before WPI-7 (Inventory) and WPI-9 (Analytics) specifically

The Sheets-at-production-scale review (docs/49 §7, docs/51 Part 3 item 1) — named as a
gate for these two batches specifically, not for the phase's earlier, lower-write-volume
batches (WPI-1 through WPI-6).

## What does not need to happen before any WPI batch begins

Resolving the Public Calculator variant gap, the optional PIN review, or scoping Phase
2C/2D — all real, but non-blocking for Phase 3/WHIMS specifically, exactly as docs/46
Part 5 found for its own equivalent set of non-blocking, carried-forward items.

## Remaining architectural risks (unchanged from docs/51, restated for this review's own record)

Sheets-at-scale (top risk), the coarse patient-roster derivation at
multi-doctor-per-specialty scale (disclosed, accepted for now), two parallel
authentication surfaces sharing cryptographic primitives, Holoscan's undefined scope
(correctly left undefined), and Notification's four-flow unification surface — all
named in docs/51 Part 3, none newly introduced or newly resolved by this review beyond
the two closures already recorded above.

## Statement

This document, together with docs/49 (Phase 3 Architecture Review), docs/50 (Phase 3
Technical Plan), docs/51 (Phase 3 Architecture Readiness Review), ADR-017 through
ADR-020, and docs/53 (Phase 3 Implementation Rules), represents the complete,
cross-checked architecture-freeze for Phase 3 (WHIMS Patient Intelligence Platform). No
further architecture-freeze work is identified as necessary before implementation.

**This document does not itself authorize any WPI batch to begin.** Per docs/53's
per-batch gate, implementation starts only on explicit, separate approval.
