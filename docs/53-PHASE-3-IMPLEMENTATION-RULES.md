# 53 - Phase 3 Implementation Rules
## WHIMS Patient Intelligence Platform — Version 1.0 — 2026-07-16

> This document is the permanent implementation standard for every Phase 3 batch
> (WPI-1 through WPI-12, docs/50 §19). It does not restate docs/50's architecture — it
> states the rules every batch's implementation must follow, mirroring exactly the
> role docs/47-PHASE-2B-IMPLEMENTATION-RULES.md played for Phase 2B. Governed by
> docs/00's Documentation-First methodology, docs/10-DEVELOPMENT-STANDARDS.md's general
> conventions, and the full ADR set (docs/31, through ADR-020).

---

# 1. Purpose

Phase 2A and Phase 2B are both **frozen except for genuine bug fixes**
(docs/43-PHASE-2A-CLOSEOUT.md, docs/48-PHASE-2B-CLOSEOUT.md). Phase 3's architecture is
**frozen** (docs/49/50/51/52, Version 1.0; ADR-017–020) — no batch is authorized to
begin implementation by any of those documents themselves; each batch requires its own
separate, explicit approval, mirroring docs/43 §12/docs/47 §1's own precedent exactly.

**Every implementation batch, from WPI-1 onward, must follow the rules in this
document** — the same discipline that let eleven independently-built Phase 2B batches
converge on one coherent platform rather than eleven independently-reasoned ones.

---

# 2. Architecture Principles

Reaffirmed, not reopened — binding per the ADRs and docs/49/50 cited; a checklist, not
a new decision:

- **Registry-driven architecture, extended to the doctor side.** Module Registry
  (ADR-012), Calculator Registry (ADR-013), Template Registry (ADR-016), and the new
  Doctor Module Registry (ADR-020) are the platform's only mechanisms for exposing a
  capability to a patient or a doctor. A new capability is a new registry entry, never
  new hardcoded rendering or dispatch logic.
- **Specialty scoping is optional and additive, never mandatory.** An unscoped registry
  entry behaves exactly as it does today (ADR-018). No batch may make
  `specialty_scope` a required field on any existing registry.
- **Doctor configures. Patient consumes.** Unchanged from docs/44 §4.3 — WHIMS gives
  doctors a real, authenticated front door to configuration that already existed
  conceptually; it does not change who is authorized to configure anything.
- **Doctor Identity is never merged with Patient Identity.** ADR-017's separation is
  permanent, not a starting draft to converge later.
- **Passwordless by default, reused for Doctor Session too.** ADR-003's philosophy,
  reaffirmed permanently by ADR-015 for patients, extends to Doctor Session without
  inventing a second authentication paradigm (docs/50 §5).
- **No frozen file is touched for new functionality.** Every WPI batch is additive to
  Phase 2A/2B's frozen files, per docs/50 §3's own explicit "zero lines touched" list —
  any genuine exception is disclosed exactly as docs/47 §6 already requires.
- **AI and advanced-capability extension points are reserved, never implemented.**
  ADR-019, platform-wide and permanent — no WPI batch implements AI Assistant, Holoscan,
  or any other AI behavior under cover of a registry or dashboard batch's own scope.

---

# 3. Implementation Rules

**Never hardcode:**
- A doctor-facing capability outside the Doctor Module Registry (docs/50 §7.1,
  mirroring docs/47 §3's existing patient-side rule exactly).
- A specialty branch anywhere in shared framework code — specialty differentiation is
  always a `specialty_scope` field value, never an `if`/`switch` on a specialty name
  (ADR-018).
- A disease, condition, or template name inside otherwise-generic framework code
  (docs/47 §3's rule, unchanged, still binding for every WPI batch that touches
  existing patient-facing mechanisms).
- Inventory drawdown logic disconnected from the `InventoryTransaction` ledger — every
  stock change is a transaction row, never a direct mutation of `quantity_on_hand`
  (docs/50 §10).

**Everything patient- or doctor-facing must come from a registry**, exactly as docs/47
§3 already establishes for the patient side, now extended uniformly to the doctor side.

---

# 4. Registry Rules

- **Doctor Module Registry** (ADR-020, docs/50 §7) — governs which doctor-facing
  *capability* is exposed, mirroring Module Registry's own governance of patient-facing
  capability exposure.
- **Specialty Registry** (ADR-018, docs/50 §6) — governs which specialty a registry
  entry, a doctor, or a derived patient-specialty mapping belongs to.
- **Existing registries** (Module, Calculator, Template — ADR-012/013/016) gain the
  optional `specialty_scope` field independently, at whichever WPI batch first needs
  it for that specific registry — never all three in one batch for convenience if only
  one is actually needed yet.
- **Future registries** — if a genuinely new *kind* of registry-worthy concern emerges
  beyond capability exposure, computation, form shape, and specialty scope, it requires
  its own ADR, following ADR-016/ADR-018/ADR-020's own precedent — never a silent
  extension of an existing registry ADR's Decision text.

---

# 5. Entity Rules

Every new entity introduced by a Phase 3/WPI batch must have, before that batch is
considered complete:
- A **schema**, following ADR-006's flat-column/UUID-`record_id` convention or docs/44
  §11.4's JSON-encoded-column exception where explicitly applicable — identical
  discipline to docs/47 §5's own rule, unchanged.
- An **Apps Script module** (or equivalent implementation unit) for its create/read
  (and, only where the architecture explicitly calls for it, update) operations.
- **Documentation** — canonical entity meaning lives in docs/33-DOMAIN-MODEL.md's new
  Phase 3/WHIMS section, promoted from docs/50 where already named there; docs/50
  remains the architecture record, not re-derived per batch.
- **Tests** covering the entity's real patient- or doctor-facing surface, mirroring the
  existing `validation/pa-*`/`validation/pxp-*` suite pattern.
- **Conformance tests** extending the existing conformance harness's pattern — real
  schema validation, real session-derived authorization checks (for both Patient
  Session and Doctor Session, whichever applies), never a mocked-away shortcut.
- **Validation** — the entity's write path exercised by the batch's own validation pass
  (§7 below) before merge, not deferred to a future closeout batch.
- A **CHANGELOG entry**.
- A **repository consistency review**, per §14 below, applied per-batch.

---

# 6. Coding Rules

- **Small batches.** One WPI batch delivers one named capability from docs/50 §19 —
  never multiple batches' worth of scope merged into one PR.
- **Additive changes.** New Sheets/tables, new modules, new dispatch cases. Existing
  frozen files (every Phase 2A `Foundation*.gs` file, every shipped Phase 2B
  `apps-script/*.gs`/`shared/*.schema.json` file) are touched only for a genuine,
  disclosed bug fix — never as a side effect of Phase 3 feature work.
- **Frozen files respected.** If a batch's design genuinely requires touching a frozen
  file, that decision is explicit, disclosed in the batch's own PR description, and
  justified against docs/43 §12/docs/48 §9's bug-fix-only freeze rules — never done
  silently. docs/50 §3 already commits every currently-planned WPI batch to zero such
  touches; any deviation discovered at implementation time is itself the kind of
  disclosed exception this rule requires, not a silent departure from docs/50.
- **No hidden architecture changes.** If implementation reveals docs/50's design does
  not work as written, the fix is a documented architecture amendment (ADR-007's
  amend-or-supersede discipline) *before* the code ships differently than documented.
- **No silent ADR changes.** ADR-017 through ADR-020, and every existing ADR, are
  immutable once Accepted (ADR-007). Amending or superseding either requires the same
  explicit, recorded transition every prior ADR change has used.
- **No breaking API changes.** New dispatch cases (whatever mechanism WPI batches use
  to expose Doctor-facing routes) are additive only — an existing action's
  request/response contract is never changed by a later batch.

---

# 7. Validation Rules

Every batch must finish with a clean run of:
- **Static Analysis** (extending the existing suite to cover any new source files).
- **Conformance** (extending the existing harness with the batch's own new checks).
- **Regression** (confirming every earlier phase's suite — Phase 1.5, Phase 2A, Phase
  2B — is still untouched and passing).
- **Tests** covering the batch's own new patient- or doctor-facing surface.
- **Repository Consistency Review** (§14 below).

**All must pass before merge.**

---

# 8. Documentation Rules

- Every completed batch updates **only** the documents genuinely affected by that
  batch's own change.
- **Never create documentation drift** — a document describing a capability is updated
  in the same change that alters it.
- **Keep ADRs synchronized** — docs/31-ADR-INDEX.md reflects every ADR's true current
  status in the same change that adds, amends, or supersedes one.
- **Keep the roadmap synchronized** — docs/24-ROADMAP.md's Phase 3/WHIMS entry
  reflects which batch has shipped, in the same change that ships it.
- **Keep the domain model synchronized** — docs/33-DOMAIN-MODEL.md's entity status
  (Conceptual → Designed → Implemented) is updated in the same change that changes it.

---

# 9. Git Rules

Every batch must end with, in order:
1. **Commit** — descriptive, scoped to the batch's own change.
2. **Push** — to the batch's designated branch.
3. **PR** — opened or updated, describing the batch's scope and test plan.
4. **Build Summary** — what changed, what was validated, what remains.
5. **Final Verification** — confirmation every §7 validation suite is clean on the
   final pushed state.
6. **STOP** — wait for explicit approval before the next batch begins.

---

# 10. Quality Gates

A batch cannot be considered complete until **all** of the following hold:
- Implementation finished, matching its docs/50 §19 scope exactly — no silent scope
  expansion or contraction.
- Self-review complete against §§3–6 of this document.
- Validation passes (§7), clean, on the final state.
- Repository consistency passes (§14).
- Documentation updated (§8) — no drift left for a future batch to discover.
- PR opened, describing scope, test plan, and any disclosed exception.
- Build Summary produced.

---

# 11. Definition of Done

A Phase 3/WPI batch is **Done** when:
1. Every entity it introduces satisfies §5 in full.
2. Every §7 validation suite passes cleanly on the batch's final, pushed commit.
3. Every §8 documentation obligation is satisfied.
4. The batch's own PR is open (or merged) and contains a Build Summary.
5. No frozen file was touched except for a disclosed, justified bug fix (§6).
6. No architecture document was silently contradicted by the shipped implementation.

A batch that satisfies 1–5 but skips 6 is not Done — the same standard docs/47 §11
already set for Phase 2B, unchanged for Phase 3.

---

# 12. Definition of Freeze

"**Frozen except for bug fixes**" means, identically to docs/47 §12:
- Shipped code and schema are not modified for new functionality, scope expansion,
  refactoring, or convenience — only for a genuine, disclosed defect fix.
- A "genuine bug fix" makes already-documented, already-approved behavior work
  correctly — never introduces new behavior, fields, or scope under cover of a fix.
- Any change to a frozen batch's file requires the same disclosure discipline as §6's
  "no hidden architecture changes" rule.
- Freezing a batch does not freeze docs/50 itself — docs/50 may still be amended per
  ADR-007's discipline if a later batch's real-world implementation surfaces a genuine
  design gap; what freezes is shipped code and schema, not the right to document
  reality accurately.

---

# 13. Future Batch Workflow

Every WPI batch follows this exact three-phase sequence, identical to docs/47 §13:

## Phase A — Implement
1. Implement exactly the batch's docs/50 §19 scope — no more, no less.
2. Self-review the diff against §§3–6 of this document.
3. Fix any issue self-review finds before proceeding to Phase B.

## Phase B — Validate
1. Run every §7 check.
2. If anything fails, fix **only** the failing issue — no unrelated cleanup bundled in.
3. Re-run validation. Repeat until every suite is clean.

## Phase C — Close
1. Update documentation (§8).
2. Run the Repository Consistency Review (§14).
3. Add a CHANGELOG entry.
4. Commit. Push. Open (or update) the PR.
5. Produce a Build Summary.
6. **STOP.** Wait for explicit approval before the next batch begins.

---

# 14. Repository Consistency Rules

Every implementation batch must verify, before its own Build Summary is produced:
- **Architecture consistency** — the shipped implementation matches docs/50's design
  for this batch; any divergence is a documented amendment, not a silent deviation.
- **Schema consistency** — every new/changed schema file matches the entity shape
  docs/33/docs/50 describe.
- **Contract consistency** — every new dispatch case or route is additive; no existing
  contract changes.
- **ADR consistency** — docs/31-ADR-INDEX.md accurately reflects every ADR touched or
  newly relevant to this batch.
- **Documentation consistency** — no stale cross-reference left anywhere in docs/24,
  docs/31, docs/33, docs/49, docs/50, docs/51, docs/52, or this document.
- **Validation consistency** — every new entity's write path is actually exercised by
  an updated or new validation suite, not merely described in prose.
- **No temporary files, no debug artifacts, no local paths, no stale references.**

---

# 15. Release Discipline

Every Phase 3 release follows, in order, without skipping a phase:

**Architecture Freeze → Implementation → Validation → Closeout → Release**

- **Architecture Freeze** — docs/49/50/51/52 (Version 1.0) plus ADR-017–020, this
  document's own governing set: no implementation until an explicit, named batch is
  approved.
- **Implementation** — one batch at a time, per §13's three-phase workflow, each gated
  by its own explicit approval.
- **Validation** — §7's checks, clean, on every batch, not deferred to a single
  end-of-phase pass.
- **Closeout** — a phase-level closeout document (mirroring docs/27/35/36/38/43/48's own
  pattern) once every batch in docs/50 §19 has shipped or been explicitly, disclosedly
  left as a reserved placeholder (WPI-10 AI Assistant, WPI-11 Holoscan, mirroring
  PXP-9's own precedent) — WPI-12 (Closeout) is this phase's own closeout batch.
- **Release** — a governance sign-off, distinct from technical completion, exactly as
  docs/28's "Deployment approved" sign-off remained a clinic decision separate from
  Phase 1.5's technical closeout.

No phase is skipped.

---

# Relationship to Other Documents

This document does not restate docs/49's vision, docs/50's architecture, docs/51's
critique, or docs/52's consistency findings — it states the *process* rules every WPI
batch's implementation must follow. Where this document and docs/50 ever appear to
conflict, docs/50 (and the ADRs it cites) remain the binding architecture; this
document governs *how* that architecture is implemented, never *what* it is.

**This document does not authorize WPI-1, or any other batch, to begin.**
Implementation starts only on a separate, explicit approval naming a specific batch.
