# ADR-010: Security Decisions Always Take Precedence Over Convenience

## Status
Accepted

## Context
docs/15-SECURITY-STANDARDS.md implies this through specific rules ("least privilege,"
"authenticated access only") but never states an explicit precedence rule for what wins
when security and convenience trade off against each other. A concrete precedent
already exists: Phase 1.5 deliberately rejected in-app lockout/rate-limiting for the
staff access code specifically because it would introduce a *different* risk (an
attacker deliberately triggering lockouts to deny real staff access) — choosing a long,
random secret over a short, memorable one instead of adding defensive machinery that
could itself be abused. That was security-over-convenience reasoning applied without
being named as a standing rule.

## Decision
When a design choice trades security for convenience — weaker validation for a
smoother form, a longer-lived session for fewer logins, skipping a review gate to ship
faster, a shorter or more memorable secret — the more secure option is the default.
Any exception must be an explicit, documented, reviewed decision (its own ADR or a
locked-decision entry per ADR-007) — never a silent default chosen for expedience.

## Consequences
- Some features will feel less convenient than a typical consumer product: short
  session lifetimes (docs/29 §10), mandatory human review gates before any AI output
  reaches a patient (ADR-005), no stored passwords to autofill (ADR-003).
- This is accepted as the appropriate cost for a platform handling real patient data,
  consistent with docs/21's trust-first philosophy ("Trust Before Technology").
- Any future request to relax a security control for convenience must be evaluated
  against this ADR explicitly, not approved as a routine implementation choice.

## Future Considerations
Specific tradeoffs (e.g., exact session lifetime, whether to add rate-limiting once
patient-facing endpoints exist) should be revisited using real usage data once Phase 2A
is live — but the precedence rule itself (security wins by default) does not change.
