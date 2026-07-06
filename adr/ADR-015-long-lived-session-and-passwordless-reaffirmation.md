# ADR-015: Persistent Login Adds a Long-Lived Session Alongside Trusted Device; Passwordless-by-Default Is Reaffirmed as Non-Negotiable

## Status
Accepted — Supersedes ADR-014. ADR-011 and ADR-014 remain on record, both marked
Superseded, per ADR-007. Further amends ADR-003 (see ADR-003's status note).

## Context
ADR-014 established Trusted Device as the primary persistent-login mechanism, with an
optional secondary PIN, both rooted in magic link. A further architecture review
(2026-07-08) approved that direction but required one addition and one explicit
reaffirmation before Batch 1 could be considered:

1. ADR-014 described the device token as being "exchanged... to receive a fresh,
   short-lived Session token (unchanged TTL/mechanics from today's Session)" — implying
   a returning, trusted patient still gets only a 60-minute session, just without
   re-entering magic link to obtain it. The review requires this made explicit and
   distinct: a **Long-Lived Session** is itself a named mechanism, not merely an
   implementation detail of how Trusted Device happens to be exchanged.
2. The review explicitly restates, as a non-negotiable constraint rather than a
   description of the current design: "Do NOT introduce passwords as the primary
   authentication mechanism... ADR-003 remains fundamentally correct... Passwords should
   not become mandatory... the system should continue to operate passwordless by
   default." ADR-014 already satisfied this in substance (PIN was already optional and
   secondary); this ADR reaffirms it explicitly and permanently, so it cannot be
   loosened in a future revision without its own formal supersession.

## Decision
1. **Persistent login is achieved through four named, cooperating mechanisms — never
   through a mandatory password:**
   - **Magic Link** — the root of trust. Every patient can always authenticate this way,
     with no precondition. The sole recovery mechanism for every other mechanism below.
   - **Trusted Device** — a machine-generated, high-entropy device token (ADR-014 §2/§4,
     unchanged), rooted in a magic-link event, revocable and time-bounded.
   - **Long-Lived Session** (new, named explicitly by this ADR) — when a Trusted Device
     token is presented successfully, the Session issued is **long-lived** (a materially
     longer TTL than the default 60-minute Session, exact duration an implementation-time
     parameter per ADR-010's tune-with-real-data posture), not merely a fresh short
     session. This is what patients actually experience as "staying logged in" — Trusted
     Device is the credential; Long-Lived Session is the resulting access window.
   - **Optional PIN** — retained from ADR-011/ADR-014, explicitly reframed here as a
     **convenience** factor (e.g., a quick local re-entry after a long-lived session
     ends, or a lightweight alternative on a device the patient chooses not to mark as
     trusted), never a security-equivalent replacement for the other three. Opt-in only,
     magic-link-gated setup and reset, unchanged hashing/rate-limiting discipline.
2. **Passwords never become mandatory, in this or any future revision, without a new
   ADR that explicitly overturns this clause** — not a silent loosening. A "password" in
   the traditional sense (an unbounded-length, patient-chosen string, positioned as the
   primary credential) is not part of this platform's design; where "password" appears
   elsewhere in this document set, it refers to the same bounded, secondary, PIN-like
   credential this ADR governs, never a mandatory primary one.
3. **The platform continues to operate passwordless by default**: a patient who never
   opts into Trusted Device or PIN experiences exactly ADR-003's original design —
   magic link, every time, nothing stored. Every mechanism in this ADR is additive to
   that default, never a replacement for it.
4. **Long-Lived Session revocation is tied to its issuing Trusted Device**: revoking a
   Trusted Device invalidates the long-lived access it was granting. This does not
   retroactively kill a different device's independently-issued long-lived session
   (docs/45's multi-device semantics question is resolved this way, not left open).

## Consequences
- A returning, trusted patient experiences meaningfully persistent access (a long-lived
  session), not just a slightly-more-convenient way to obtain a short one — this is the
  concrete product outcome "persistent login" was always meant to deliver.
- `TrustedDevice` (ADR-014 §4) gains an explicit relationship to session issuance:
  implementation must parameterize the existing Session-issuance mechanism
  (`FoundationSession.gs`) by TTL depending on issuance context (magic-link-issued:
  default short TTL; trusted-device-issued: long TTL) — whether this is achieved by
  modifying the frozen `FoundationSession.gs` (requiring its own bug-fix-scope
  justification) or by an additive wrapper calling its existing signing primitive with a
  different constant is an implementation-time decision, not fixed by this ADR.
- The passwordless-by-default reaffirmation (§Decision 2/3) is now a standing
  constraint any future authentication proposal must be checked against explicitly,
  the same way ADR-004/ADR-013 froze their respective boundaries before implementation.

## Future Considerations
Exact Long-Lived Session TTL, and whether it should be a fixed duration or a sliding
window (renewed on activity), are implementation-time parameters informed by real usage
— not fixed here, per ADR-010's established posture for Session TTL tuning.
