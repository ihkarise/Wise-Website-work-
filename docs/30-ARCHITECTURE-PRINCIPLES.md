# 30 - Architecture Principles
## Version 1.0 — 2026-07-02

> The permanent principles of the Wise Platform. Where docs/00-PROJECT-GOVERNANCE.md
> governs *process* (how documentation and code stay in sync) and docs/21-WISE-PRODUCT-VISION.md
> governs *product intent* (what Wise is trying to become), this document governs
> *architecture* — the structural rules every future phase, feature, and AI capability
> must be built against, regardless of which specific technology implements them.
>
> Each principle below is backed by one or more Architectural Decision Records in
> `/adr/` (indexed in docs/31-ADR-INDEX.md). This document explains *why* each
> principle exists and what it means in practice; the ADRs record the specific, binding
> decision and its consequences. If the two ever appear to disagree, the ADR is
> authoritative — this document should be corrected to match it, not the reverse.

---

# Why This Document Exists

Wise is transitioning from a website to a long-term digital healthcare platform.
Websites can be rebuilt. A platform holding real patient data, real clinical history,
and a real trust relationship cannot be casually rebuilt — every architectural choice
made now either compounds cleanly for years or has to be unwound later at much higher
cost than it would have taken to get right the first time.

This document exists to name the assumptions that were previously scattered,
implicit, or only demonstrated in code (Phase 1.5) rather than stated as permanent
rules — so that no future session, including a future AI session, has to rediscover
them by re-reading every implementation.

---

# 1. Identity & Access

## Patient Identity exists independently of authentication
A patient is a durable identity (`patient_id`) that outlives any specific way they
prove who they are. Records attach to identity, never to a credential.
*(ADR-002)*

## Authentication may evolve without changing identity
Today's login mechanism (email magic link) is one attachment to that identity, not the
identity itself. A future login method can be added or swapped without touching a
single historical patient record.
*(ADR-003, ADR-002)*

## No public registration
Patient accounts are created by staff, after a real consultation — never by public
self-signup. This has been true since docs/09's original design and remains
unconditional; it is repeated here because it is load-bearing for every access-control
decision in Phase 2A.
*(docs/09, carried forward unchanged)*

## Security decisions always take precedence over convenience
Where a choice trades security for ease of use, the more secure option is the default,
and any exception is a deliberate, documented, reviewed decision — never a silent one.
*(ADR-010)*

---

# 2. Clinical Authority & AI

## Doctors remain the final decision-makers
Nothing on this platform — a form, a dashboard, an AI feature — makes or implies a
clinical decision. Every clinical judgement traces back to a doctor, always.
*(docs/13, docs/21, docs/22 — reaffirmed, not newly introduced)*

## AI assists but never replaces clinical judgement
AI may explain, summarize, organize, translate, and reduce administrative work. It may
never diagnose, prescribe, or change a treatment plan.
*(docs/13, docs/22, formalized operationally by ADR-005)*

## The Knowledge Engine is the single source of medical knowledge
Every AI output that touches clinical content must be traceable to Knowledge-Engine-
approved material — clinician-approved protocols, notes, articles, FAQs, research
summaries, or calculator logic. AI retrieves and rephrases; it does not invent.
*(ADR-001)*

## The Digital Twin never prescribes treatment
The Digital Twin is a living health story, not a clinical decision engine. It
organizes and visualizes what already happened; it never tells a patient what should
happen next medically.
*(ADR-004)*

## AI always operates under doctor supervision
No AI output reaches a patient without passing a three-part gate: a constrained prompt,
an independent code-level check, and mandatory human review and approval. All three,
every time — this is not a per-feature judgement call.
*(ADR-005, proven in practice by Phase 1.5)*

---

# 3. Data & Storage

## Patient data belongs to the patient
Patient records exist to serve the patient's own understanding of their health, not to
create platform lock-in. This is a newly stated principle — no current mechanism
(export, deletion, portability) implements it yet. It is recorded now so that future
data-architecture decisions are built with it in mind from the start, rather than
retrofitted once real patient data already exists in volume. A concrete mechanism is
future work, tracked in docs/32.

## Google Sheets is an implementation detail, not a product dependency
The current datastore is a deliberate, cost-effective choice for pilot scale — not an
architectural commitment. Every schema is designed as if a migration to a real
database is a certainty: flat columns, stable UUID keys, no per-patient tabs, no
Sheets-specific behavior assumed outside the data-access layer.
*(ADR-006, docs/12's existing "design for SQL migration" rule made binding)*

## Minimal data collection
Collect only what a feature genuinely needs, retain it only as long as it's needed,
and prefer purging over indefinite retention where a feature allows it (Phase 1.5's
14-day `recipient_email` purge is the working precedent, not a universal retention
period).
*(docs/12, docs/15 — reaffirmed)*

---

# 4. Modularity & Delivery

## Every component must be independently replaceable
A module has one responsibility and is reachable only through a narrow, explicit
interface. Swapping a mail provider, an AI provider, or a datastore should touch one
module, never its callers.
*(ADR-009, proven in practice by Phase 1.5's `Send.gs` → `Email.gs` layering)*

## Every phase must remain deployable
Every phase, and every batch within it, ships on its own, is safely reversible, and
leaves the system fully working at every intermediate step. No phase is planned as a
single, atomic release.
*(ADR-008, proven in practice by Phase 1.5's Batch 4A–4H sequence)*

## Every module must remain independently testable
A module's correctness should be provable on its own, against real (not reimplemented)
source, without requiring the whole system to be live — the same discipline Phase
1.5's `validation/phase-1-5/` harness demonstrated by loading real `.gs` source into a
mocked runtime rather than reasoning about the code from the outside.
*(ADR-009, ADR-008 — the testability half of both)*

---

# 5. Documentation & Governance

## Documentation is part of the product
No implementation is complete until its documentation is updated in the same unit of
work. This has been true since docs/00; ADR-007 makes it binding specifically for
architecture-level decisions and records the one time it lapsed (docs/15's delayed
Phase 1.5 update) as the concrete failure mode being guarded against.
*(docs/00, formalized by ADR-007)*

## Architecture decisions are recorded, not just implemented
A decision that shapes more than one feature or phase gets an ADR — a short, permanent
record of the problem, the decision, and its cost — not just a comment in code or a
paragraph in a technical plan that's easy to lose track of later.
*(ADR-007, this document, docs/31)*

---

# Final Principle

Before adding anything to this document, or accepting a new ADR, ask the same question
docs/21 already asks of every product decision, applied to architecture instead of
features:

> Does this make the platform's foundation clearer, calmer, and more trustworthy to
> build on — for a developer or an AI assistant meeting this repository for the first
> time — the same way the product itself must be for a patient?

If yes, it belongs here. If it only solves today's implementation convenience, it
belongs in a technical plan (docs/29-style), not in this document.
