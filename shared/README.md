# shared/ — Canonical Contracts, Schemas, and Utilities

`shared/` is the repository-level, canonical source for reusable contracts, schemas,
constants, and utility definitions used across the Wise Platform's backend
implementations. It is **not a build system** — nothing here is loaded at runtime by
Apps Script or any other runtime. It exists so that the *definition* of a data shape or
a piece of shared logic lives in exactly one place, independent of which runtime
implements it today (Apps Script) or in the future (a real backend/database, per
ADR-006).

This directory and its rule were established in Phase 2A's Foundation milestone
(docs/29-PHASE-2A-TECHNICAL-PLAN.md §14), governed by ADR-006 (Sheets is an
implementation detail, not a product dependency), ADR-007 (documentation is part of the
software), and ADR-009 (every module must be independently replaceable).

---

## The Rule

**`shared/` is the canonical source. Implementations conform to it. They never extend
or modify a contract independently.**

If a contract changes:

1. `shared/` is updated first, in its own commit/PR.
2. Every conforming implementation is updated afterward, in a separate, subsequent
   change.
3. Never the reverse. An implementation detail is never allowed to silently drift ahead
   of, or diverge from, its `shared/` definition.

### One named exception — the bootstrap case

When a contract does not yet exist anywhere, its first `shared/` definition and its
first implementation are necessarily created together, in the same batch — there is no
prior version of either to sequence against. This applies **only** to a contract's
first creation. Every change after that initial creation is bound by the full rule
above, with no exception available. Foundation's own F2 and F3 batches are the only
places this exception applies in this milestone (see docs/29 §14).

### Contract vs. implementation-only detail

A `shared/` schema defines the fields that are *contractual* — every implementation
must have exactly these, correctly typed. An implementation may carry additional
implementation-only detail (e.g. a Sheets row index, an internal cache key) that is not
part of the contract, provided it never omits, renames, or redefines a field the
`shared/` schema actually defines. Each schema's companion `.md` file states which
fields are contractual.

---

## Format Rules

- **Contracts, schemas, and constants are machine-readable** — JSON (or YAML, where a
  more human-authored, config-like format is genuinely a better fit; none of
  Foundation's content needs YAML yet, so everything here starts as JSON). Every JSON
  file carries a top-level `"version"` field — implementations reference which version
  they conform to.
- **Markdown explains. It never defines.** Every machine-readable file has a companion
  `.md` of the same base name, covering rationale, usage, and examples. If a `.md` file
  and its JSON/YAML sibling ever appear to disagree on what a shape *is*, the
  JSON/YAML file is authoritative — the Markdown is wrong and should be fixed to match.
- **Utilities are algorithmic, not data-shaped**, so they don't fit a schema format
  cleanly. These are defined as portable **reference `.js` files** — plain functions,
  no `import`/`export`, no framework — precise and machine-readable (runnable directly
  in Node for testing) without being runtime-loaded by anything. This mirrors the
  precedent `apps-script/PROMPTS.md` already set for `Ai.gs`'s prompt: a
  version-controlled specification code must match, never a template loaded at
  execution time.

---

## Directory Structure

```
shared/
  README.md          this file
  contracts/          machine-readable API/response shapes (e.g. the response envelope)
  schemas/             machine-readable domain-entity field definitions (e.g. Patient Identity, docs/33 §1.2)
  constants/           cross-cutting constant values shared by more than one implementation
  utils/                portable reference implementations of small, algorithmic helpers
```

`contracts/`, `schemas/`, and `utils/` are populated by Foundation's F2, F3, and F4
batches (docs/29 §13/§14) — empty as of F1. `constants/` was populated in Patient
Access Batch PA-4 (`condition-slugs.json` — the canonical condition-slug list, its
first real second consumer being `shared/schemas/symptom-log.schema.json`'s
`condition_slug` field, alongside `patient-identity.schema.json`'s own field of the
same name). `apps-script/Config.gs` and `internal/consultation-summary.html` (both
Phase 1.5 files) still hand-duplicate their own copies of this same list, per docs/25
§11 — neither was updated to read from this file, since both are out of Phase 2A's
scope; a future cleanup batch could point them at this canonical definition instead.

---

## Who Implements What Against `shared/`

Today, `apps-script/` (a single Google Apps Script project, hosting both Phase 1.5's
consultation-summary pipeline and Phase 2A's Foundation modules, per docs/29 §14's
Decision 1) is the only runtime consuming `shared/`'s definitions. It does so by manual
adaptation — copying and porting a `shared/` definition into a `Foundation`-prefixed
`.gs` file, with a comment noting which `shared/` file and version it implements. There
is no tooling that enforces this automatically at build time; correctness is checked by
the conformance tests in `validation/phase-2a-foundation/` (added from F5 onward) and by
the discipline this README describes.

A future real backend/database (ADR-006) would implement the same `shared/` contracts
directly — the point of keeping the definition here, independent of Apps Script, is
that migration doesn't require re-deriving what a Patient record or a response envelope
*means*, only re-implementing how it's stored.
