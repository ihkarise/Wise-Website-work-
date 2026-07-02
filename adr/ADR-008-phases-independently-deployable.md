# ADR-008: Every Phase Must Be Independently Deployable

## Status
Accepted

## Context
Phase 1.5's batch structure (4A–4H) already proved this in practice: each batch shipped
on its own, added exactly one capability, and left the system in a safe, working state
whether or not the next batch ever landed. docs/26 §12's Go/No-Go framing and docs/27's
closeout both treat "Software Complete," "Deployment Complete," and "Operationally
Complete" as distinct, separately-verifiable states rather than one bundled release.
This ADR generalizes that proven practice into a permanent rule for every future phase
and batch, including Phase 2A's own batch sequence (docs/29 §13).

## Decision
Every phase, and every batch within a phase, must:
1. Be deployable on its own, without requiring a later phase or batch to already exist.
2. Be safely reversible — removable or disable-able without breaking anything shipped
   in an earlier batch.
3. Leave the system in a fully working state at every intermediate step, never a
   half-finished one.

A phase or feature that cannot be decomposed into independently deployable batches is
not architecturally ready to build — sequencing the batches is part of the architecture
work itself, done before implementation starts (as docs/29 does for Phase 2A), not an
implementation-time afterthought.

## Consequences
- Requires deliberate sequencing effort up front for every future phase, as demonstrated
  in docs/29's Batch 5A→5H ordering (foundation → auth → shell → read-only data →
  writable data → highest-risk feature → public visibility → validation).
- Slightly slower to reach a feature-complete phase, in exchange for every intermediate
  state being safe to pause on, demo, or roll back without emergency work.
- No future phase should be planned as a single, atomic release.

## Future Considerations
None currently identified — this is a process discipline rather than a technical
mechanism. Revisit only if a genuinely non-decomposable feature is proposed; none has
been so far, including the hardest case examined to date (Phase 2A's authentication and
report-upload work).
