# ADR-014: Persistent Login Is Achieved Primarily Through Trusted Devices; Magic Link Is the Root of Trust

## Status
**Superseded by ADR-015** (2026-07-08). A further architecture review required an
explicit, named Long-Lived Session mechanism (this ADR only implied one, as an
unspecified detail of the device-token exchange) and an explicit, permanent
reaffirmation that passwords never become mandatory. ADR-015 incorporates this ADR's
Trusted Device design unchanged and adds the missing pieces. This record is kept intact
as history, per ADR-007 — its Trusted Device mechanism was, and remains, correct; it is
superseded because a real gap (no named long-lived-access mechanism) was found, not
because anything here was wrong.

Original status text, preserved below: Accepted — Supersedes ADR-011. Further amends
ADR-003 (see ADR-003's status note).

## Context
ADR-011 made a human-chosen PIN/password the platform's persistent-login mechanism,
opt-in and additive to magic link. docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md
Part 3 ranked this the single highest-risk item in the entire Phase 2B architecture
pass: Google Apps Script has no bcrypt/argon2/PBKDF2 primitive, so a low-entropy,
human-chosen secret can only be protected by a manually iterated HMAC bridge — a
disclosed workaround, not a solved problem, and one that mattered most precisely
*because* it was the primary persistent mechanism every returning patient would rely on.

A product-direction review (2026-07-06) redirected persistent login to be achieved
**primarily through trusted devices**, with PIN demoted to an **optional secondary**
factor, and Magic Link named explicitly as the **root of trust** underlying both. This
ADR records that decision and its consequence for ADR-011.

The key insight this ADR is built on: a trusted-device token, unlike a PIN, does not
need to be human-chosen. It can be a long, random, server-generated secret — the same
entropy class as `LoginToken` — which means it can safely reuse the platform's existing,
already-proven-safe hashing pattern (a plain SHA-256 fingerprint of an unguessable
secret, per `shared/schemas/login-token.md`'s own reasoning) instead of needing any new
cryptographic bridge. Moving the *primary* mechanism from a low-entropy human secret to
a high-entropy machine secret is what actually reduces risk here — not merely relocating
where the risk lives.

## Decision
1. **Trusted Device is the primary persistent-login mechanism.** After authenticating
   via magic link, a patient may mark the current device as trusted. The server issues
   a `TrustedDevice` record and a long, random, server-generated device token (same
   entropy class as `LoginToken` — not a human-chosen value) to the client.
2. **The device token is hashed the same proven way `LoginToken` already is** — a plain
   SHA-256 fingerprint, safe here precisely because the input is unguessable, matching
   `shared/schemas/login-token.md`'s existing, audited reasoning. No new hashing
   primitive or iterated-HMAC bridge is required for this mechanism.
3. **The device token is exchanged, not directly used as an API credential.** On a
   return visit, the client presents it once to receive a fresh, short-lived Session
   token (unchanged TTL/mechanics from today's Session, ADR unaffected) — the patient is
   not re-prompted for magic link on a trusted device unless trust has expired or been
   revoked.
4. **The device token rotates on every exchange**: each use invalidates the presented
   token and issues a new one, mirroring `LoginToken`'s existing single-use discipline.
   This bounds the value of a copied/exfiltrated token to a single use before rotation
   would surface a conflict.
5. **Magic link is the root of trust for both mechanisms.** Establishing a new Trusted
   Device, and re-establishing one after expiry or revocation, always requires a fresh
   magic-link authentication first. There is no device-recovery or PIN-reset path that
   bypasses email. This generalizes ADR-011's "PIN reset requires magic link" rule to
   both persistent mechanisms.
6. **Trusted Device status is revocable and time-bounded** — by the patient (a "sign out
   this device" / "sign out everywhere" action) or by staff. The exact expiry duration
   is an implementation-time parameter (ADR-010's "choose the more secure default, tune
   with real usage" posture, already applied to Session TTL), not fixed by this ADR.
7. **PIN remains available as an optional, secondary persistent factor**, retaining
   everything ADR-011 already specified for it (opt-in; magic-link-gated setup and
   reset; the disclosed iterated-HMAC hashing bridge, since a PIN is still a low-entropy
   human secret when a patient chooses to use one; rate-limited failed attempts; never
   able to block magic-link access) — demoted from *primary* to *secondary*, for a
   patient who prefers a memorized PIN over device-based trust (e.g., a shared device
   where "remember this device" is inappropriate).
8. This ADR **supersedes ADR-011** in full: ADR-011's central claim — that a
   PIN/password is *the* additive persistent mechanism — no longer holds now that
   Trusted Device is primary. ADR-011 remains on record per ADR-007, marked Superseded,
   not deleted or rewritten.

## Consequences
- The highest-risk item in the prior architecture pass (docs/45 Part 3 item 1) is
  materially reduced: the primary persistent mechanism is now a high-entropy,
  machine-generated secret reusing an already-proven hashing pattern, not a low-entropy
  human one requiring a new cryptographic bridge.
- A new `TrustedDevice` entity (device token issuance, rotation, revocation) replaces
  `PatientCredential` as the primary persistent-auth surface; `PatientCredential`
  (ADR-011's design) is retained, unchanged in mechanism, for the now-secondary PIN
  option.
- Two independent opt-in persistent paths exist instead of one — marginally more
  implementation surface, but each individually simpler and safer than a single
  PIN-primary path would have been, and both root to the same magic-link event.
- A stolen/exfiltrated device token grants a fresh session, the same exposure a stolen
  session token already carries today — bounded by rotation-on-use and revocability,
  the same mitigation shape as industry-standard refresh-token rotation.
- Per ADR-007, docs/31-ADR-INDEX.md and ADR-011 itself are updated in this same change
  to record the supersession.

## Future Considerations
If real usage reveals a need to detect device-token replay as an active theft signal
(e.g., auto-revoking a whole device when an already-rotated token is presented again),
evaluate that as an enhancement once real data exists — not speculatively now, the same
posture ADR-010's Future Considerations already took for session-lifetime tuning.
