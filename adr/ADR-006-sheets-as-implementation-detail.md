# ADR-006: Google Sheets Is an Implementation Detail, Not a Product Dependency

## Status
Accepted

## Context
docs/12-DATA-ARCHITECTURE.md currently lists "Google Sheets as primary datastore" under
its **Principles** section — phrasing that reads as a product-level commitment to
Sheets itself, in tension with the same document's own "Future" rule: "design for
migration to SQL without changing frontend APIs." Phase 1.5 already followed that
migration-safe discipline in practice (`Schema.gs`'s flat columns, a stable UUID
`record_id`, no per-patient tabs) without it being stated as a binding architectural
rule. This ADR resolves the tension explicitly rather than leaving two documents
disagreeing about whether Sheets is a principle or a swappable choice.

## Decision
Google Sheets, accessed through Google Apps Script, is the platform's **current**
storage mechanism because it is free, fast to build against, and sufficient at pilot
scale — not because the product is architecturally committed to it. Every Sheet-backed
schema, present and future, must be designed as if a migration to a real database is a
certainty:
- Flat, typed-by-convention columns.
- A stable, permanent primary key (`record_id`, UUID) per record, generated server-side.
- No per-patient tabs, no ad-hoc per-record sheet structures.
- No frontend or business-logic module outside the data-access layer may assume
  Sheets-specific behavior (formulas, cell formatting, sheet-name conventions) as part
  of its contract.

## Consequences
- Marginal extra schema discipline per Sheet — already demonstrated at zero real extra
  cost in Phase 1.5.
- The platform can migrate to a real database whenever patient volume, query
  complexity, or concurrent-write behavior requires it, without a frontend rewrite —
  the promise docs/12 already made, now made binding rather than aspirational.
- docs/12's "Principles" section should be reworded to stop listing Sheets itself as a
  principle (tracked in docs/32's conflicts report) — this ADR is the corrected
  statement of that intent; the underlying architecture does not change.

## Future Considerations
Define a concrete migration trigger (a specific patient-count, latency, or
concurrent-write threshold) as its own future ADR once it becomes a near-term planning
concern. Not needed at Phase 2A's pilot scale.
