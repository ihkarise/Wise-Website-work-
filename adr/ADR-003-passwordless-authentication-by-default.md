# ADR-003: Authentication Is Passwordless by Default

## Status
Accepted. **Amended in part, in sequence by ADR-011 (2026-07-04), ADR-014 (2026-07-06),
and now ADR-015 (2026-07-08, the current governing record; ADR-011 and ADR-014 are both
superseded and kept as history per ADR-007)**: the Decision's absolute "no patient
password is ever collected, stored, or reset" clause no longer holds without
qualification. See ADR-015 for the current, exact, constrained exception — persistent
login is achieved through Magic Link (root of trust), Trusted Device (a high-entropy,
machine-generated credential, not a password), a Long-Lived Session issued to a trusted
device, and an optional, secondary, convenience-only PIN. ADR-015 explicitly reaffirms,
as a permanent constraint, that passwords never become mandatory and the platform
continues to operate passwordless by default for any patient who opts into neither
additive mechanism. The passwordless-by-default principle recorded below is otherwise
unchanged.

## Context
docs/09-PHASE-2-ARCHITECTURE.md specifies "Patient ID + Password or Mobile OTP." Neither
option fits the platform's actual technical foundation cleanly:

- **Password auth** requires storing and defending credential hashes. The platform's
  only backend (Google Apps Script, per docs/12 and proven in Phase 1.5) has no
  framework-level password-hashing primitive (no bcrypt/argon2 equivalent), making
  correct, defensible password storage a genuinely hard, avoidable problem.
- **Mobile OTP** requires a paid SMS provider. No such integration exists anywhere in
  the current stack (docs/01, docs/09, docs/10 list only HTML/CSS/JS, Apps Script,
  Sheets, Netlify, OpenRouter), and adding one is new vendor risk and cost for a
  platform whose stated approach is "refine, don't rebuild" and stay small.

Phase 1.5 already proved a working, low-risk alternative primitive: `apps-script/Auth.gs`
favors "a long, random secret over a memorable/guessable code, with no lockout logic" —
avoiding brute-force risk by making the secret infeasible to guess rather than by
building rate-limiting/lockout machinery. `Email.gs` already proves reliable transactional
email delivery via `MailApp`. Combining both gives a passwordless login mechanism that
reuses infrastructure already validated in production.

## Decision
Patient authentication defaults to **passwordless, email-based magic links**: a patient
requests a login link with their registered email; the platform emails a single-use,
short-lived, cryptographically random token as a link; clicking it authenticates the
session. No patient password is ever collected, stored, or reset.

This is Phase 2A's actual implementation of docs/09's "Entry Point" concept, and
supersedes its literal "Password or Mobile OTP" wording (see docs/32's conflicts
report). Per ADR-002, this authentication method resolves to a `patient_id` and is not
itself the patient's identity — a different or additional method (SMS OTP once a
provider exists, Workspace SSO if the clinic adopts Google Workspace) can be added
later without redesigning the identity model.

## Consequences
- No password-reset UX, no password-strength requirements, no credential-stuffing
  attack surface against this platform specifically.
- Login requires working access to the patient's registered email — an accessibility/
  dependency tradeoff for patients with unreliable email access, noted and deferred
  rather than solved now.
- docs/09 needs a documentation update to stop stating password/Mobile-OTP as the
  design (tracked in docs/32).

## Future Considerations
If email deliverability proves unreliable for a meaningful share of patients, or the
clinic adopts Google Workspace, add a second authentication factor as an *additional*
option attached to the existing `patient_id` (per ADR-002) — never a replacement that
requires re-keying existing patient data.
