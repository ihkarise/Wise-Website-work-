# ADR-017: Doctor Identity Is a First-Class Entity, Structurally Parallel to Patient Identity

## Status
Accepted

## Context
docs/33-DOMAIN-MODEL.md §1.4 has named Doctor a "Conceptual (gap)" entity since its
first version: "who did this" is currently captured two inconsistent ways — a Google
Workspace account identity (Phase 1.5's Sheet-bound `Session.getActiveUser().getEmail()`
review pattern) and a free-text staff-typed string (docs/29's `consent_confirmed_by`,
`reviewed_by`, and every Phase 2B doctor-owned entity's `created_by`/`prescribed_by`
field). Neither is a real, queryable identity. Every doctor-owned Phase 2B entity
(`DoctorAssignedCondition`, `CarePlan`, `DoctorInstruction`,
`CheckInTemplateAssignment`) was deliberately built as a manually-run Apps Script
editor function specifically *because* no real Doctor identity or authentication
existed yet — named as a disclosed, intentional simplification at every one of those
batches (docs/33 §6.2/§6.5, docs/44 §22). docs/34 Part 3 and docs/48 §7 both carry this
forward as an open, unresolved gap. docs/49 §1 identifies closing it as the strongest
architectural justification for taking up Phase 3 (WHIMS) now rather than later:
resolving it strengthens Phase 2B's own already-shipped foundation, not just Phase 3's
new scope.

## Decision
A Doctor is a durable, platform-generated `doctor_id` identity — structurally parallel
to Patient Identity (ADR-002), authenticated independently (ADR-003's passwordless
philosophy reused, not a second auth paradigm invented from scratch), and **never
merged into, aliased with, or derived from Patient Identity.** The two identity spaces
remain permanently distinct records, even though the platform reuses the same
cryptographic session-issuance pattern for both (a new, additive `DoctorSession`
mechanism, docs/50 §3, reusing `FoundationSession.gs`'s existing signing primitives
without modifying that frozen file — the exact precedent `TrustedDevice.gs`'s Long-Lived
Session already set at Batch PXP-8).

Every existing doctor-owned Phase 2B entity's *schema* is unchanged by this ADR. What
changes is that `created_by`/`prescribed_by`/`resolved_by` and similar fields gain a
real `doctor_id` to reference, once Doctor Identity exists, in place of (not silently
replacing — see docs/50 §4's migration note) today's free-text staff-typed string. No
existing manually-run editor function is deleted by this ADR; each is retired
individually, by its own future batch, mirroring exactly how Batch PXP-10 retired
Symptom Tracker's dashboard entry without touching its frozen data layer.

Like Patient Identity, no public self-registration exists for Doctor Identity —
provisioning is a staff/administrative action, never public self-signup, the same
unconditional rule ADR-002/docs/09 already established for patients.

## Consequences
- A real, per-doctor audit trail becomes possible for the first time — "who assigned
  this condition," "who authored this care plan" become queryable facts, not free text.
- Role distinction (physician vs. front-desk staff, docs/33 §1.4's own proposed
  attribute) becomes representable, enabling future role-scoped permissions without a
  redesign — not built by this ADR, but no longer architecturally blocked.
- Every doctor-owned Phase 2B entity gains a real, authenticated write path as a
  *consumer* of this ADR, in a future WHIMS batch — this ADR does not itself change any
  entity's schema or retire any existing editor function.
- A second, parallel authentication surface exists in the platform going forward
  (Patient Session and Doctor Session) — mirroring, not duplicating, the existing
  pattern; both share the same underlying cryptographic primitives per docs/50 §3.

## Future Considerations
Role-based access control within the Doctor identity space (physician vs. staff vs.
front-desk, differing permissions) is named as plausible future work by docs/33 §1.4 but
is not designed by this ADR — a future, separately-scoped decision once real
multi-role need exists, not a speculative permission system built ahead of demand.
Identity merging (docs/33 §1.2's own deferred concern for Patient Identity) applies
identically here and is deferred for the same reason: address it if and when it becomes
a real operational problem.
