# ADR-011: A Persistent Credential (PIN/Password) May Be Added as an Optional Second Factor, Magic Link Remains the Mandatory Baseline

## Status
**Superseded by ADR-014** (2026-07-06). A product-direction review redirected persistent
login to be achieved *primarily* through trusted devices, with the PIN/password
mechanism this ADR defined demoted to an optional *secondary* factor — ADR-014 records
the new primary mechanism and explicitly retains this ADR's PIN-specific design
(opt-in, magic-link-gated, iterated-HMAC hashing bridge, rate-limited) for that
secondary role. This record is kept intact as history, per ADR-007 — it was, at the
time, a correct and complete answer to the conflict with ADR-003 it resolved; it is
superseded because the product direction changed, not because its reasoning was wrong.

Original status text, preserved below: Accepted — Amends ADR-003. ADR-003 remains
Accepted for its passwordless-by-default principle; this ADR supersedes only its
absolute "no patient password is ever collected, stored, or reset" clause, under the
constraints below.

## Context
Phase 2B's technical plan (docs/44) calls for "persistent authentication (password/PIN
with Magic Link recovery)" — a faster repeat-login path than requesting a new email
link every session. ADR-003 states, without qualification: "No patient password is
ever collected, stored, or reset." Introducing any stored PIN or password, even as an
option, contradicts that sentence directly — this is a real conflict, not a wording
ambiguity, and per ADR-007 it cannot be resolved by silently editing ADR-003.

ADR-003's own Future Considerations already anticipated this exact situation: "add a
second authentication factor as an *additional* option attached to the existing
`patient_id` (per ADR-002) — never a replacement that requires re-keying existing
patient data." ADR-002 independently guarantees that any new credential type resolves
to the same stable `patient_id` without touching a single historical record. Both prior
ADRs point at the same resolution.

The harder problem this ADR must confront honestly: Google Apps Script has no
bcrypt/argon2/scrypt/PBKDF2 primitive. The platform's two existing hashing mechanisms —
plain `Utilities.computeDigest` (SHA-256, used for LoginToken fingerprints) and
`Utilities.computeHmacSha256Signature` (used for session-token signatures) — are both
single-pass, unsalted-by-default, no-work-factor primitives. They are safe today only
because their inputs are high-entropy, server-generated secrets. A PIN or password is
the opposite: low-entropy and human-chosen. Hashing a 4-6 digit PIN with either existing
primitive, even salted, is brute-forceable offline in trivial time if a row is ever
exfiltrated. Reusing either mechanism unmodified for this purpose would be a genuine,
undisclosed security regression — exactly what ADR-010 forbids doing silently.

## Decision
1. **Magic-link login remains the default, mandatory, always-available mechanism.**
   Every patient can always authenticate via magic link, regardless of whether they have
   set up a persistent credential. No patient is ever locked out of their account by a
   forgotten or failed PIN/password — magic link is the permanent recovery path, not a
   fallback that can be disabled.
2. **A persistent credential (PIN or password) is opt-in**, set up by the patient only
   after they have already authenticated once via magic link — never collected at
   account creation, never a precondition for using the platform.
3. **A persistent credential is a separate `PatientCredential` record resolving to the
   existing `patient_id`** (ADR-002) — it never replaces, re-keys, or touches a single
   `Patient` or `LoginToken` row.
4. **A persistent credential must never be hashed with an unmodified single-pass
   primitive.** It must use a per-credential random salt and a deliberately slow,
   iterated construction (repeated HMAC-SHA256 keyed derivation, run enough iterations
   to impose a real work factor — the exact iteration count is an implementation-time
   decision, verified against Apps Script's execution-time limits, not specified here)
   — a documented, reviewed departure from both of the platform's existing hashing
   mechanisms, not a reuse of either.
5. **Failed PIN/password attempts are rate-limited** using the same pattern already
   proven for login-link requests (`FoundationRateLimit.gs`), but escalating lockout
   applies only to the persistent-credential path — it must never block or delay the
   magic-link path for the same patient.
6. **Resetting or changing a persistent credential requires a fresh magic-link
   authentication first.** There is no "forgot PIN" flow independent of email — magic
   link is the sole recovery mechanism, per the plan's own framing ("Magic Link
   recovery").
7. **Failed-attempt responses never reveal whether a credential exists for a given
   identifier**, consistent with the anti-enumeration discipline already established for
   login-link requests (IA-2).

## Consequences
- ADR-003's passwordless-by-default principle is preserved for every patient who never
  opts in — nothing changes for them.
- The platform now carries genuine credential-hashing risk it did not carry before,
  specifically because Apps Script has no vetted password-hashing primitive. This is an
  accepted, disclosed trade-off, not an oversight — see docs/45 (Phase 2B Architecture
  Readiness Review) for the full risk analysis and required implementation-time security
  review before this ships.
- A new `PatientCredential` entity and its own rate-limiting state are required —
  additive schema work, zero modification to `Patient`, `LoginToken`, or `Session`.
- Per ADR-007, docs/31-ADR-INDEX.md must record this ADR and note ADR-003's amendment
  in the same change (done).

## Future Considerations
If a real password-hashing primitive ever becomes available to this stack (a migration
off Apps Script, or a future library binding), migrate `PatientCredential` hashing to it
and treat the iterated-HMAC construction as a bridge, not a permanent design — revisit
as its own ADR at that time, not a silent upgrade.
