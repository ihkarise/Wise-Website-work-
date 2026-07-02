# ADR-007: Documentation Is Part of the Software

## Status
Accepted (formalizes an existing repository-founding principle)

## Context
docs/00-PROJECT-GOVERNANCE.md already states this as the repository's core philosophy:
"Documentation is considered part of the product... No implementation is complete until
both the code and documentation are updated together." In practice this has held with
one recorded lapse: docs/27 §4 notes that docs/15-SECURITY-STANDARDS.md's promised
Phase-1.5 update was flagged from the plan's first version but not actually written
until Batch 4H caught it during closeout review — seven batches later. This ADR exists
to make the principle binding at the architecture-decision level specifically (ADRs),
not just the general documentation policy, and to record the concrete failure mode
worth guarding against.

## Decision
No feature, architecture change, or locked decision is considered complete until its
corresponding documentation is updated in the same unit of work: the relevant numbered
doc, a CHANGELOG entry, and — for architecture-level decisions specifically — an ADR.
Architecture Decision Records are treated as immutable once **Accepted**: they are never
silently edited. A decision changes only through a formal **Superseded** or
**Deprecated** transition that creates a new record and updates docs/31-ADR-INDEX.md,
mirroring the discipline docs/25 §9 already applied to its own "Locked Decisions"
("changing any locked item... requires re-running that escalation, not a silent edit").

## Consequences
- Documentation work is not deferred to "later" or treated as optional cleanup — a
  batch whose documentation isn't updated is not a finished batch.
- Slower short-term velocity in exchange for preventing the exact drift this session
  (Phase 2A architecture freeze) exists to eliminate.
- Every future architecture-freeze or audit session (like this one) has a canonical
  place — `/adr/` plus docs/31's index — to check for what's actually been decided,
  rather than reconstructing intent from scattered document prose.

## Future Considerations
Consider a lightweight recurring audit (structurally similar to this session) before
each future phase boundary, rather than only when drift is suspected — cheap insurance
against repeating Phase 1.5's docs/15 lapse at larger scale.
