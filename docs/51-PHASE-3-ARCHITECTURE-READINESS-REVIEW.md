# 51 - Phase 3 Architecture Readiness Review
## WHIMS Patient Intelligence Platform — Version 1.0 — 2026-07-16

> An independent critique of docs/49 and docs/50, in the same spirit docs/45 applied to
> docs/44 — not a restatement, a stress test. Written before any WPI batch is proposed,
> per docs/53's Architecture Freeze gate.

---

# Part 1 — Critique of Each Proposal

## 1.1 Reordering Phase 3 ahead of Phase 2C/2D (docs/49 §1)

The dependency-table argument is sound and directly precedented (PXP-10 before PXP-9,
docs/24). One gap: the table asserts "No" for Inventory/PillFill/Analytics against
both Phase 2C and 2D without checking whether *Health Milestones* (Phase 2C) might
want to read Analytics-style aggregation once it exists. It doesn't create a hard
dependency either direction — Health Milestones (30/90-day reviews) is patient-facing
and could reuse Analytics later, or not at all — but the technical plan should say so
explicitly rather than leaving it silently unexamined. **Recommendation:** docs/50 §12
should note, as a future consideration, that Phase 2C may become a future *consumer* of
Analytics once both exist — not a dependency in either direction, just an honest
forward pointer, mirroring how docs/33 §3.1 already flags Care Plan/Digital Twin as
future Timeline Event sources.

**Verdict:** Sound, with one documentation gap (now closed by this finding).

## 1.2 The rename, "WiseOS" → "WHIMS Patient Intelligence Platform" (docs/49 §2)

Directly precedented (Phase 2B's own three renames, no scope change each time). One
risk not addressed in docs/49: unlike Phase 2B's renames, which all happened before any
implementation shipped, "WiseOS" already appears in *shipped, frozen* documentation
(docs/21, docs/29 §0, docs/33 §1.4) as a live cross-reference, not just a roadmap
label. **Recommendation:** confirm (docs/52 Part 1) that every existing "WiseOS"
reference is either historically-accurate-as-written (kept, per ADR-007's "keep
history" rule) or updated to point forward to "WHIMS" where it currently functions as a
forward-looking cross-reference rather than a historical record — these are two
different things and docs/49 §2 only handles the second correctly for docs/24; the
`docs/33` §1.4 mention needs the same check.

**Verdict:** Correct in principle; one specific cross-reference needs closing (see
docs/52 Part 1.1).

## 1.3 Doctor Identity, permanently separate from Patient Identity (ADR-017, docs/50 §5)

Well-reasoned and directly mirrors ADR-002's own logic. The `DoctorSession` reusing
`FoundationSession.gs`'s primitives without editing that file is the correct call,
precedented exactly by `TrustedDevice.gs`. One open question docs/50 §5.5 does not
fully resolve: *which* primitive, specifically, is reused — the signing key, the HMAC
function, or both? docs/50 states "signing primitives" generically. This is an
acceptable level of abstraction for an architecture document (docs/44 §5.5 left an
equivalent implementation-time question open for Long-Lived Session and it was resolved
correctly at implementation), but it should be named as an explicit open question here
rather than implied as settled.

**Verdict:** Sound. One implementation-time question flagged, not resolved (consistent
with how docs/44 §5.6 handled its own open questions).

## 1.4 Specialty-Scoped Registries (ADR-018, docs/50 §6)

The optional-field, backward-compatible design is the correct minimal approach — it
avoids the same risk Module Registry's original design avoided (ADR-012's "no card
renders unless explicitly enabled," fail-closed by absence, applied here to
fail-open-to-default-specialty by absence, which is the *correct* inverse: an unscoped
entry should stay visible, since narrowing visibility by default would break every
existing entry the day this field is introduced). One genuine gap: docs/50 §6.3's
condition-to-specialty mapping table is named but not designed — "a small, additive
lookup table this plan introduces" is asserted without specifying whether it lives in
`shared/constants/` (a registry-style file) or as a new schema. **Recommendation:**
resolve this at whichever batch (WPI-2) actually implements it — acceptable to leave as
an implementation-time decision, but flag explicitly as such rather than silently
assumed solved.

**Verdict:** Sound, one implementation-time detail correctly deferrable but should be
named (now named, here).

## 1.5 Doctor Module Registry as a separate registry, not a shared one (ADR-020, docs/50 §7)

The reasoning (two audiences, avoid an identity-type branch inside one registry) is
consistent with the platform's own established anti-hardcoding discipline (docs/47 §3).
The "small, deliberate duplication accepted" framing in ADR-020's Consequences section
is honest rather than glossing over the cost — appropriate. No issues found.

**Verdict:** Sound.

## 1.6 Patient roster derived from `DoctorAssignedCondition`, no new entity (docs/50 §7.4)

This is the plan's most debatable simplification. Deriving a roster from condition
assignment conflates "which conditions is this doctor's specialty responsible for" with
"which specific patients has this doctor personally taken on" — these are not always
the same thing in a real clinic (a specialty may have three doctors; a given patient
sees one of them specifically, not all three). docs/50 §7.4 names this as a future
consideration rather than solving it, which is the right instinct, but the risk is
understated: at real multi-doctor-per-specialty scale (which "production-scale
architecture" explicitly asks for), the derived roster likely returns *every* patient
in the specialty to *every* doctor in that specialty, not a personal roster — a
real, disclosed limitation, not a hypothetical one.

**Recommendation:** docs/50 §7.4 should state this limitation explicitly, not just
gesture at "a future consideration." Doing so now (rather than at implementation)
follows the same "disclose deliberate scope decisions in the architecture document
itself" discipline that docs/44 §12's Care Plan Timeline Event deferral and PXP-6's
"ships empty" decision both already modeled.

**Verdict:** Directionally sound (deferring a new entity is the right minimalism), but
the limitation needs explicit disclosure, not implicit gesture. Treated as this
review's #2 risk (Part 3).

## 1.7 Appointment (docs/50 §8)

Well-grounded in a genuine, long-standing, previously-named gap (docs/34 Part 4 item
4). The nullable `patient_id`/`doctor_id` fields correctly reflect the real lifecycle
(a first-time visitor has no identity yet). The intake mechanism (how a Netlify Forms
submission becomes a platform `Appointment` row) is correctly deferred as an
implementation-time decision — mirrors how docs/44 left equivalent plumbing to its own
batches.

**Verdict:** Sound.

## 1.8 Notification (docs/50 §9)

The "fourth flow" trigger-count argument is persuasive and correctly cites docs/34's
own stated trigger condition rather than inventing a new threshold. Correctly scoped
as a shared *record*, not a new delivery pipeline — avoids the risk of accidentally
redesigning `Email.gs` or the login-link mailer under cover of "unifying notifications."

**Verdict:** Sound.

## 1.9 Inventory / PillFill Integration (docs/50 §10–11)

The append-only ledger design for `InventoryTransaction` (never mutate
`quantity_on_hand` directly) is the correct choice, consistent with `CarePlan`'s own
append-only-versioning precedent. The `PillFillOrder` → `DoctorInstruction` linkage
correctly reuses the existing "Prescription is a `medicine`-type Doctor Instruction"
mapping (docs/33 §2.3) rather than inventing a parallel prescription concept. Explicitly
declining to design an external PillFill vendor API contract is the right restraint —
inventing integration details without real operational requirements would be
speculative scope, exactly what docs/00's "no half-finished implementations" and this
platform's general "don't design for hypothetical future requirements" discipline warn
against.

**Verdict:** Sound.

## 1.10 Analytics (docs/50 §12)

Correctly modeled as a computed view, never a base table, mirroring Digital Twin. The
"never AI-generated interpretation" boundary is stated clearly and gated correctly.

**Verdict:** Sound.

## 1.11 Reserved AI/Holoscan extension points (ADR-019, docs/50 §13)

The refusal to invent scope for Holoscan is the single most important discipline this
whole review demonstrates — it would have been easy to guess (imaging? diagnostics?
a scheduling system?) and every guess would be unfounded speculation dressed as
architecture. Correctly handled identically to PXP-9's own precedent.

**Verdict:** Sound, and worth calling out as the review's strongest piece of restraint.

---

# Part 2 — Conflicts With Existing Architecture

Checked against every Accepted ADR (001–016) and docs/30's principles:

- **No conflict with ADR-001/004/005/013** — no AI behavior is introduced; every
  reserved extension point is inert (§1.11).
- **No conflict with ADR-002/003** — Doctor Identity is explicitly parallel, never
  merged (§1.3); passwordless philosophy reused, not overturned.
- **No conflict with ADR-006** — Inventory and Doctor-facing entities are designed with
  the same flat-column, stable-ID discipline docs/50 §16 states; the Sheets-scale
  question is flagged, not silently assumed away (docs/49 §7).
- **No conflict with ADR-008/009** — every new mechanism is additive and independently
  deployable; no batch in docs/50 §19 requires another to ship in the same release.
- **No conflict with ADR-010** — fail-closed enablement is explicitly carried into the
  Doctor Module Registry (docs/50 §7.2).
- **No conflict with ADR-012/013/016** — extended (specialty scoping), never amended;
  ADR-018 correctly frames itself as complementary, matching ADR-016's own precedent
  for how a new registry-adjacent ADR should relate to an existing one.
- **No conflict with ADR-015** — Doctor Session is a new, parallel mechanism; nothing
  about patient persistent authentication changes.
- **No conflict found requiring any Accepted ADR to be superseded or amended.**

---

# Part 3 — Risks, Ranked

1. **Sheets at production scale (docs/49 §7, docs/50 §17.1).** Inventory's
   transactional writes and Analytics' cross-patient reads are the most plausible real
   trigger for ADR-006's anticipated migration. Not resolved by this review; requires
   its own dedicated technical/capacity review before WPI-7 or WPI-9 begins in earnest.
   **Top risk.**
2. **Patient roster derivation is coarser than "production-scale, multi-doctor"
   language implies (§1.6).** Disclosed here explicitly; docs/50 §7.4 should be updated
   to state the limitation in the same words, not just gesture at a future
   consideration. **Recommend closing this as a docs/50 amendment before WPI-4 begins**
   (a documentation-only fix, not an architecture change — the derived-roster decision
   itself is not being reversed, only its limitation made explicit).
3. **Two parallel authentication surfaces (Patient, Doctor) increase total attack
   surface,** even though both reuse the same cryptographic primitives. Mitigated, not
   eliminated, by shared primitives (docs/50 §5.5); requires the same dedicated
   security review already named as a gate in docs/50 §14 before any WPI batch ships a
   real `DoctorSession`.
4. **Holoscan's complete absence of defined scope** remains a standing gap this review
   correctly refuses to fill — low risk precisely because nothing is built against
   guessed scope; the risk is entirely in a *future* session being tempted to invent
   scope under time pressure, not in anything this review does.
5. **Notification unification (docs/50 §9) touches four sender flows.** Modest scope,
   but real — worth its own dedicated batch (WPI-6, already scoped that way in docs/50
   §19) rather than folded into Inventory or PillFill Integration.

---

# Part 4 — Roadmap / Scope Gaps

- **Public (no-login) Calculator variant** remains unclaimed (docs/46 Part 3,
  docs/48 §7) — still not addressed by this or any later document. Not this review's
  scope to claim; noted for completeness, consistent with docs/45/docs/46's own
  practice of carrying forward gaps rather than silently dropping them.
- **Optional PIN (`PatientCredential`)** remains its own open, independently-gated item
  (docs/45 Part 5) — unrelated to and unaffected by this review.
- **Phase 2C (Health Milestones) and Phase 2D (Digital Twin & AI Summaries)** remain
  fully open — this review's reordering (Part 1.1) does not resolve either; both still
  require their own future architecture-freeze pass.

---

# Part 5 — Final Verdict

## Is the architecture in docs/49/docs/50 ready for any batch to begin?

**Conditionally, pending two closures — both documentation-only, neither an
architecture change:**

1. Update docs/50 §7.4 to state the patient-roster derivation's real limitation at
   multi-doctor-per-specialty scale explicitly (Part 1.6/Part 3 item 2), rather than
   only gesturing at "a future consideration."
2. Confirm docs/33 §1.4's "WiseOS" cross-reference is handled consistently with the
   rename (Part 1.2) — done in docs/52 Part 1.1's consistency pass.

Neither blocks WPI-1 (Doctor Identity & Session) specifically, which has no dependency
on either finding — mirroring exactly how docs/45 Version 4.0 found non-blocking
documentation items that did not gate Batch PXP-1's own start.

## What should happen before any WPI batch begins

1. The two closures above.
2. A dedicated security review of the `DoctorSession` mechanism (docs/50 §14), scheduled
   for the same point in the process the Trusted Device review occupied for Patient
   Session — before WPI-1 ships, not deferred to a later closeout (avoiding the exact
   gap Phase 2A's own magic-link review fell into, caught only at PA-7 closeout,
   docs/43 §5/§6).
3. Governance sign-off that Phase 3 architecture planning is approved to proceed to
   implementation at all — this document, docs/49, and docs/50 together do not
   authorize any batch, per docs/50 §19's own closing statement.

## What does not need to happen before any WPI batch begins

The Sheets-at-scale review (Part 3 item 1) is real but not blocking for WPI-1 through
WPI-6 specifically (identity, registries, dashboard, Appointment, Notification) — none
of those introduce Inventory-scale transactional write volume. It becomes blocking
before WPI-7 (Inventory) and WPI-9 (Analytics) specifically, not before this
architecture-freeze pass concludes.

## Statement

This document, together with docs/49 (Phase 3 Architecture Review) and docs/50 (Phase 3
Technical Plan), ADR-017 through ADR-020, and docs/52 (Repository Consistency Review),
represents the complete, cross-checked architecture for Phase 3 (WHIMS Patient
Intelligence Platform). No further architecture-freeze work is identified as necessary
before implementation, once the two closures above are made.

**This document does not itself authorize any WPI batch to begin.** Per docs/53's
Architecture Freeze → Implementation → Validation → Closeout → Release discipline,
implementation starts only on a separate, explicit approval naming a specific batch.
