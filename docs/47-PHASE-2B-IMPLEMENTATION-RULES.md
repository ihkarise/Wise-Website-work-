# 47 - Phase 2B Implementation Rules
## Version 1.0 — 2026-07-09

> This document is the permanent implementation standard for every remaining Phase 2B
> batch (PXP-1 through PXP-11, docs/44 §22). It does not restate docs/44's architecture
> — it states the rules every batch's implementation must follow so that architecture
> drift never happens quietly, one batch at a time. Governed by docs/00's
> Documentation-First methodology, docs/10-DEVELOPMENT-STANDARDS.md's general
> conventions, and the ADR set (docs/31).

---

# 1. Purpose

Phase 2A (Foundation, Identity & Access, Patient Access) is **frozen except for genuine
bug fixes** (docs/43-PHASE-2A-CLOSEOUT.md). Phase 2B's architecture is **frozen**
(docs/44 Version 4.0, docs/45 Version 4.0, docs/46 Version 4.0, ADR-012/013/015/016) —
no batch has been authorized to begin implementation by any architecture document
itself; each batch requires its own separate, explicit approval (docs/43 §12).

**Every implementation batch, from PXP-1 onward, must follow the rules in this
document.** This document exists so that eleven separate batches, built over time,
produce one coherent platform rather than eleven independently-reasoned ones — the same
discipline docs/29 already proved out for Phase 2A's own batch sequence (F1–F5, IA-1–2,
PA-1–7), now made explicit before Phase 2B's first batch begins.

---

# 2. Architecture Principles

Reaffirmed, not reopened — every principle below is already binding per the ADRs and
docs/44 Version 4.0 cited; this section is a checklist, not a new decision:

- **Registry-driven architecture.** Module Registry (ADR-012), Calculator Registry
  (ADR-013), and Template Registry (ADR-016) are the platform's only mechanisms for
  exposing a capability, a computation, or a form to a patient. A new capability is a
  new registry entry, never new hardcoded rendering or dispatch logic.
- **Configuration over hardcoding.** Whether a patient sees a module, a calculator, or
  a template is always a data change (`PatientModuleState`, registry entries), never a
  code change.
- **Doctor configures. Patient consumes.** Conditions, modules, calculators, check-ins,
  templates, and care plans are doctor/staff-configured (docs/44 §4.3). The patient
  receives the configured experience — never configures their own dashboard.
- **Passwordless by default.** ADR-003, reaffirmed permanently by ADR-015 (docs/44
  §5.2/§5.7). Passwords never become mandatory without a new ADR that explicitly
  overturns this clause.
- **Magic Link remains root of trust.** Every additive authentication mechanism
  (Trusted Device, Long-Lived Session, optional PIN) exists alongside Magic Link, never
  instead of it (docs/44 §5.7).
- **AI extension points only.** Every registry reserves an AI-compatibility field
  (docs/44 §7.1/§8.1/§11.5); no batch in this sequence implements AI behavior. Any
  future AI feature is independently gated by ADR-001/004/005/013 when it is actually
  proposed — never smuggled in under a registry batch's own scope.

---

# 3. Implementation Rules

**Never hardcode:**
- Diseases or condition-specific branches in shared framework code (docs/44 §8.3,
  §11.5's "doctors decide" pattern applied uniformly).
- Dashboard cards — every card, existing or new, renders from the Module Registry
  (docs/44 §7.3, §13).
- Calculators — every calculator is a `CalculatorDefinition` + Calculator Registry
  entry (docs/44 §8).
- Questionnaires or check-ins — every form is a Template Registry entry (docs/44 §11,
  ADR-016), never a bespoke, one-off form.
- Care plans — `DoctorInstruction`/`CarePlan` content is doctor-authored data, never a
  hardcoded template baked into application code.

**Everything patient-facing must come from a registry.** If a batch's implementation
requires an `if`/`switch` branch keyed on a disease, condition, or template name inside
otherwise-generic framework code, that is a violation of this rule, not an acceptable
shortcut — the fix is a new registry entry, not a code branch.

---

# 4. Registry Rules

- **Module Registry** (ADR-012, docs/44 §7) — governs which *capability* is exposed to
  a patient.
- **Calculator Registry** (ADR-013, docs/44 §8) — governs deterministic, doctor-
  authored computation.
- **Template Registry** (ADR-016, docs/44 §11) — governs the *shape* of a patient-
  facing form or questionnaire; `CheckInTemplate` is its first category.
- **Future registries** — if a genuinely new *kind* of registry-worthy concern emerges
  (not just a new entry in an existing registry), it requires its own ADR, following
  ADR-016's own pattern: a new, complementary ADR, not a silent extension of an
  existing registry's Decision text into unrelated territory.

**New functionality should be added by extending a registry whenever possible** — a new
module, calculator, or template category is a new registry entry plus (where needed) a
new version, not new architecture. Only genuinely new *kinds* of concern justify a new
registry or a new ADR; a repeated pattern (a fourth template category, a second
calculator) never does.

---

# 5. Entity Rules

Every new entity introduced by a Phase 2B batch must have, before that batch is
considered complete:
- A **schema** (`shared/*.schema.json`, following ADR-006's flat-column/UUID-`record_id`
  convention, or docs/44 §11.4's JSON-encoded-column exception where explicitly
  applicable).
- An **Apps Script module** implementing its create/read (and, only where the
  architecture explicitly calls for it, update) operations.
- **Documentation** — the entity's canonical description lives in docs/33-DOMAIN-MODEL.md
  (promoted from its existing Phase 2B Entities section, §6, if already named there);
  docs/44 remains the architecture record, not re-derived per batch.
- **Browser tests** covering the entity's real, patient-facing (or doctor-facing)
  surface, mirroring the existing `validation/pa-*` suite pattern.
- **Conformance tests** extending `validation/phase-2a-foundation/conformance.js`'s
  existing pattern — real schema validation, real session-derived authorization checks,
  never a mocked-away shortcut.
- **Validation** — the entity's write path must be exercised by the batch's own
  validation pass (§7 below) before merge, not deferred to a future closeout batch.
- A **CHANGELOG entry** — every batch's user-visible or architecture-visible change is
  recorded, per docs/00's "Documentation First" rule.
- A **repository consistency review** — the same scoped review pattern docs/34 and
  docs/46 already established, applied per-batch rather than only at phase boundaries.

---

# 6. Coding Rules

- **Small batches.** One batch delivers one named capability from docs/44 §22 — never
  multiple batches' worth of scope merged into one PR for convenience.
- **Additive changes.** New Sheets, new Apps Script files, new dispatch cases. Existing
  frozen files (`apps-script/Foundation*.gs` from Phase 2A, `shared/*.schema.json`
  already shipped) are touched only for a genuine, disclosed bug fix — never as a side
  effect of new-feature work (docs/43's freeze rule, unchanged).
- **Frozen files respected.** If a batch's design genuinely requires touching a frozen
  file (e.g., docs/44 §5.5's still-open Long-Lived Session question), that decision is
  made explicitly, disclosed in the batch's own PR description, and justified against
  docs/43 §12's bug-fix-only freeze rule — never done silently.
- **No hidden architecture changes.** If implementation reveals that docs/44's design
  does not work as written, the fix is a documented architecture amendment (following
  ADR-007's amend-or-supersede discipline) *before* the code ships differently than
  documented — never code that silently diverges from its own architecture record.
- **No silent ADR changes.** An ADR is immutable once Accepted (ADR-007). Amending one
  requires an explicit amendment note (as ADR-012's was); superseding one requires a new
  ADR (as ADR-011→ADR-014→ADR-015 was). Never edit an Accepted ADR's Decision text in
  place.
- **No breaking API changes.** New `foundation_action` dispatch cases are additive
  only, mirroring every Phase 2A batch's own discipline (docs/29 §16's batch notes) —
  an existing action's request/response contract is never changed by a later batch.

---

# 7. Validation Rules

Every batch must finish with a clean run of:
- **Static Analysis** (`validation/static-analysis/analyze.js`)
- **Conformance** (`validation/phase-2a-foundation/conformance.js`, extended with the
  batch's own new checks per §5 above)
- **Regression** (`validation/phase-1-5/validate.js`, confirming Phase 1.5's pipeline is
  still untouched)
- **Browser Tests** (every existing `validation/pa-*` suite, plus any new suite the
  batch introduces for its own patient-facing surface)
- **Repository Consistency Review** (§14 below)

**All must pass before merge.** If anything fails, fix only the failing issue, re-run
validation, and repeat until every suite is clean — the same discipline this
architecture-freeze pass itself followed.

---

# 8. Documentation Rules

- Every completed batch updates **only** the documents genuinely affected by that
  batch's own change — never a speculative or unrelated documentation pass.
- **Never create documentation drift.** A document that describes a capability must be
  updated in the same change that alters the capability — not left to catch up later
  (docs/00's Documentation First rule, restated here as a per-batch obligation).
- **Keep ADRs synchronized** — docs/31-ADR-INDEX.md reflects every ADR's true current
  status in the same change that adds, amends, or supersedes one.
- **Keep the roadmap synchronized** — docs/24-ROADMAP.md's Phase 2B entry reflects
  which batch has shipped, in the same change that ships it.
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
   final pushed state, not an earlier intermediate commit.
6. **STOP** — wait for explicit approval before the next batch begins, per docs/43 §12's
   per-batch gate.

---

# 10. Quality Gates

A batch cannot be considered complete until **all** of the following hold:
- Implementation finished, matching its docs/44 §22 scope exactly — no silent scope
  expansion or contraction.
- Self-review complete (the implementer has re-read their own diff against §§3–6 of
  this document before requesting validation).
- Validation passes (§7) — all five checks, clean, on the final state.
- Repository consistency passes (§14).
- Documentation updated (§8) — no drift left for a future batch to discover.
- PR opened, describing scope, test plan, and any disclosed exception (e.g., a
  frozen-file touch, per §6).
- Build Summary produced, in the same format this architecture-freeze pass used.

---

# 11. Definition of Done

A Phase 2B batch is **Done** when:
1. Every entity it introduces satisfies §5 in full (schema, Apps Script module,
   documentation, browser tests, conformance tests, validation, CHANGELOG entry,
   consistency review).
2. Every §7 validation suite passes cleanly on the batch's final, pushed commit.
3. Every §8 documentation obligation is satisfied — no cross-reference left stale.
4. The batch's own PR is open (or merged, if the approving reviewer has merged it) and
   contains a Build Summary per §9.
5. No frozen file was touched except for a disclosed, justified bug fix (§6).
6. No architecture document was silently contradicted by the shipped implementation —
   any genuine divergence is itself a documented amendment, not a quiet deviation.

A batch that satisfies 1–5 but skips 6 is not Done — it is a hidden architecture
change wearing a "Done" label, exactly what this document exists to prevent.

---

# 12. Definition of Freeze

"**Frozen except for bug fixes**" (the status docs/43 already established for Phase 2A,
applied identically to every batch once it ships) means:
- The batch's shipped code and schema are not modified for new functionality, scope
  expansion, refactoring, or convenience — only for a genuine, disclosed defect fix.
- A "genuine bug fix" is a change that makes already-documented, already-approved
  behavior work correctly — never a change that introduces new behavior, new fields, or
  new scope under cover of a fix.
- Any change to a frozen batch's file requires the same disclosure discipline as §6's
  "no hidden architecture changes" rule — named explicitly in the fixing batch's own PR,
  never bundled silently into an unrelated later batch.
- Freezing a batch does not freeze the *architecture document* that describes it —
  docs/44 itself may still be amended (per ADR-007's discipline) if a later batch's
  real-world implementation surfaces a genuine design gap; what freezes is the shipped
  code and schema, not the right to document reality accurately.

---

# 13. Future Batch Workflow

Every remaining Phase 2B batch (PXP-1 onward) follows this exact three-phase sequence.
No phase is skipped, reordered, or merged into another for convenience.

## Phase A — Implement
1. Implement exactly the batch's docs/44 §22 scope — no more, no less.
2. Self-review the diff against §§3–6 of this document.
3. Fix any issue self-review finds before proceeding to Phase B.

## Phase B — Validate
1. Run: Static Analysis, Conformance, Regression, Browser Tests.
2. If anything fails, fix **only** the failing issue — no unrelated cleanup bundled in.
3. Re-run validation. Repeat until every suite is clean.

## Phase C — Close
1. Update documentation (§8) — only what the batch genuinely affects.
2. Run the Repository Consistency Review (§14).
3. Add a CHANGELOG entry.
4. Commit.
5. Push.
6. Open (or update) the PR.
7. Produce a Build Summary.
8. **STOP.** Wait for explicit approval before the next batch begins.

---

# 14. Repository Consistency Rules

Every implementation batch must verify, before its own Build Summary is produced:
- **Architecture consistency** — the shipped implementation matches docs/44's design
  for this batch; any divergence is a documented amendment, not a silent deviation.
- **Schema consistency** — every new/changed `shared/*.schema.json` file matches the
  entity shape docs/33/docs/44 describe.
- **Contract consistency** — every new `foundation_action` dispatch case is additive;
  no existing action's request/response shape changed.
- **ADR consistency** — docs/31-ADR-INDEX.md accurately reflects every ADR touched or
  newly relevant to this batch.
- **Documentation consistency** — no stale cross-reference (a batch name, a section
  number, an entity name) left anywhere in docs/24, docs/31, docs/33, docs/44, docs/45,
  docs/46, or this document.
- **Validation consistency** — every new entity's write path is actually exercised by
  an updated or new validation suite, not merely described in prose.
- **No temporary files, no debug artifacts, no local paths, no stale references** —
  the same hygiene bar every prior phase's closeout batch already enforced (docs/27,
  docs/35, docs/36, docs/38, docs/43), applied per-batch rather than only at phase
  boundaries.

---

# 15. Release Discipline

Every future release follows, in order, without skipping a phase:

**Architecture Freeze → Implementation → Validation → Closeout → Release**

- **Architecture Freeze** — the phase this document and docs/44/45/46 (Version 4.0)
  represent for Phase 2B: no implementation until an explicit, named batch is approved.
- **Implementation** — one batch at a time, per §13's three-phase workflow, each
  gated by its own explicit approval (docs/43 §12).
- **Validation** — §7's five checks, clean, on every batch, not deferred to a single
  end-of-phase pass.
- **Closeout** — a phase-level closeout document (mirroring docs/27, docs/35, docs/36,
  docs/38, docs/43's own pattern) once every batch in docs/44 §22 has shipped —
  PXP-11 (Closeout) is this phase's own closeout batch, not a formality.
- **Release** — a governance sign-off, distinct from technical completion, exactly as
  docs/28's "Deployment approved" sign-off remained a clinic decision separate from
  Phase 1.5's technical closeout.

No phase is skipped. A batch that reaches Implementation without a prior Architecture
Freeze, or a phase that reaches Release without a Closeout, is out of process — this
document exists so that never happens by accident.

---

# Relationship to Other Documents

This document does not restate docs/44's architecture, docs/45's critique, or docs/46's
consistency findings — it states the *process* rules every batch's implementation must
follow, regardless of which specific batch is being built. Where this document and
docs/44 ever appear to conflict, docs/44 (and the ADRs it cites) remain the binding
architecture; this document governs *how* that architecture is implemented, never *what*
it is.

**This document does not authorize PXP-1, or any other batch, to begin.** Per docs/43
§12's per-batch gate, implementation starts only on a separate, explicit approval naming
a specific batch.
