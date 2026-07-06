# 31 - Architectural Decision Record Index
## Version 1.2 — 2026-07-06

> This is the canonical index of every Architectural Decision Record (ADR) for the
> Wise Platform. Full records live in `/adr/`. This index is the entry point — check
> here first before assuming an architectural question is undecided.

---

# What an ADR Is Here

A short, permanent record of one binding architectural decision: the problem it
resolves, what was decided, what it costs, and what's deliberately left open. Per
ADR-007, an ADR is immutable once **Accepted** — it changes only through a formal
**Superseded** or **Deprecated** transition that creates a new record, never a silent
edit. This index must be updated in the same change that adds, supersedes, or
deprecates any ADR.

---

# Status Definitions

| Status | Meaning |
|---|---|
| Proposed | Drafted, not yet binding. |
| Accepted | Binding. Governs all current and future work until superseded. |
| Superseded | No longer binding; replaced by a newer ADR (linked). Record kept for history. |
| Deprecated | No longer binding; not replaced by anything (the concern no longer applies). |

---

# Index

| ID | Title | Status | File |
|---|---|---|---|
| ADR-001 | Knowledge Engine Is the Primary Knowledge Source | Accepted | `/adr/ADR-001-knowledge-engine-primary-source.md` |
| ADR-002 | Patient Identity Is Independent of Authentication | Accepted | `/adr/ADR-002-patient-identity-independent-of-authentication.md` |
| ADR-003 | Authentication Is Passwordless by Default | Accepted — amended in part, currently by ADR-014 (ADR-011's earlier amendment is superseded) | `/adr/ADR-003-passwordless-authentication-by-default.md` |
| ADR-004 | Digital Twin Never Generates Diagnosis or Treatment | Accepted | `/adr/ADR-004-digital-twin-no-diagnosis-or-treatment.md` |
| ADR-005 | AI Always Operates Under Doctor Supervision | Accepted | `/adr/ADR-005-ai-under-doctor-supervision.md` |
| ADR-006 | Google Sheets Is an Implementation Detail, Not a Product Dependency | Accepted | `/adr/ADR-006-sheets-as-implementation-detail.md` |
| ADR-007 | Documentation Is Part of the Software | Accepted | `/adr/ADR-007-documentation-is-part-of-software.md` |
| ADR-008 | Every Phase Must Be Independently Deployable | Accepted | `/adr/ADR-008-phases-independently-deployable.md` |
| ADR-009 | Every Module Must Be Independently Replaceable | Accepted | `/adr/ADR-009-modules-independently-replaceable.md` |
| ADR-010 | Security Decisions Always Take Precedence Over Convenience | Accepted | `/adr/ADR-010-security-before-convenience.md` |
| ADR-011 | A Persistent Credential (PIN/Password) May Be Added as an Optional Second Factor, Magic Link Remains the Mandatory Baseline | Superseded by ADR-014 | `/adr/ADR-011-persistent-credential-as-additional-factor.md` |
| ADR-012 | Patient Dashboard Capabilities Are Registry-Driven, With Per-Patient Enablement | Accepted | `/adr/ADR-012-dashboard-modules-are-registry-driven.md` |
| ADR-013 | Calculators Are Deterministic and Never AI-Generated | Accepted | `/adr/ADR-013-calculators-are-deterministic-never-ai-generated.md` |
| ADR-014 | Persistent Login Is Achieved Primarily Through Trusted Devices; Magic Link Is the Root of Trust | Accepted — supersedes ADR-011, amends ADR-003 | `/adr/ADR-014-trusted-device-persistent-login.md` |

---

# Grouped by Concern

**Identity & Access** — ADR-002, ADR-003, ADR-010, ADR-014 (ADR-011 superseded)
**AI & Clinical Authority** — ADR-001, ADR-004, ADR-005, ADR-013
**Data & Storage** — ADR-002, ADR-006
**Modularity & Delivery** — ADR-008, ADR-009, ADR-012
**Governance & Documentation** — ADR-007

---

# Relationship to Other Documents

- `docs/30-ARCHITECTURE-PRINCIPLES.md` states the permanent principles these ADRs
  formalize — read that first for the "why," this index for the specific "what was
  decided and when."
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` is the first implementation plan built against
  this ADR set — every architecture choice in it cites the ADR that governs it.
- `docs/32-ARCHITECTURE-REVIEW.md` records where existing pre-ADR documentation
  conflicts with these decisions, and what should change to resolve each conflict.
- `docs/44-PHASE-2B-TECHNICAL-PLAN.md` (Version 2.0) is the first implementation plan
  built against ADR-012/013/014 — see it for how each is applied. It was originally
  built against ADR-011, now superseded by ADR-014.

---

# Adding a New ADR

1. Confirm the decision doesn't already exist here under a different name.
2. Write it in `/adr/ADR-0NN-short-slug.md` using the same five-section format
   (Status, Context, Decision, Consequences, Future Considerations).
3. Add it to the Index table and the Grouped-by-Concern section above, in the same
   change.
4. If it supersedes an existing ADR, mark the old one **Superseded** with a link
   forward — never delete or silently rewrite it.
