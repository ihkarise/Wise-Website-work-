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
Batch PA-5 added `constants/upload-limits.json` (the Report Upload size cap and
allowed-file-type list — the bootstrap exception, created alongside its first
implementation, `apps-script/FoundationReports.gs`) and
`schemas/report.schema.json` (the `Reports` record shape). Phase 2B Batch PXP-1 added
`schemas/patient-profile.schema.json` (the `PatientProfile` record shape — the
platform's first patient-mutable, upsert-style entity contract, alongside its first
implementation, `apps-script/FoundationPatientProfile.gs`). Phase 2B Batch PXP-2 added
`schemas/doctor-assigned-condition.schema.json` (the `DoctorAssignedCondition` record
shape — Phase 2B's Pillar 1, doctor/staff-owned, alongside its first implementation,
`apps-script/DoctorAssignedCondition.gs`; its condition_slug field manually re-adapts
the same canonical list, per this file's own duplication-by-convention rule above).
Phase 2B Batch PXP-3 added `constants/module-registry.json` (the Module Registry's
static, versioned list of module descriptors — Phase 2B's Pillar 2 *availability*
concern, alongside its first implementation, `apps-script/ModuleRegistry.gs`) and
`schemas/patient-module-state.schema.json` (the `PatientModuleState` record shape —
Pillar 2's per-patient *enablement* concern, doctor/staff-owned, fail-closed by
absence, alongside its first implementation, `apps-script/PatientModuleState.gs`).
Phase 2B Batch PXP-5 added `constants/template-registry.json` (the Template
Registry's static, versioned list of `CheckInTemplate` descriptors — the fourth
registry, ADR-016, alongside its first implementation,
`apps-script/TemplateRegistry.gs`), `schemas/check-in-response.schema.json` (the
`CheckInResponse` record shape — the platform's first entity implementing docs/44
§11.4's JSON-storage policy, alongside its first implementation,
`apps-script/CheckInResponse.gs`), and `schemas/
check-in-template-assignment.schema.json` (`CheckInTemplateAssignment` — a disclosed,
additive entity filling a gap docs/44 §10.2 settles but names no persisted shape for;
see that schema's own `.md` for the full disclosure). Phase 2B Batch PXP-6 added
`constants/calculator-registry.json` (the Calculator Registry's static, versioned list
of `CalculatorDefinition` descriptors — Phase 2B's Pillar 3, ADR-013, alongside its
first implementation, `apps-script/CalculatorRegistry.gs` — seeded empty, a deliberate,
disclosed scope decision explained in that file's own `.md`) and
`schemas/calculator-result.schema.json` (the `CalculatorResult` record shape — this
platform's second entity implementing docs/44 §11.4's JSON-storage policy, alongside
its first implementation, `apps-script/CalculatorResult.gs`). Phase 2B Batch PXP-7
added `schemas/care-plan.schema.json` (the `CarePlan` record shape — one evolving,
versioned plan per patient, alongside its first implementation,
`apps-script/CarePlan.gs`; its disclosed `version_key` field mirrors
`patient-module-state.schema.json`'s own `state_key` precedent for addressing one row
among many sharing the same logical identity) and `schemas/doctor-instruction.schema.json`
(the `DoctorInstruction` record shape — the atomic unit of clinical direction aggregated
by a Care Plan, alongside its first implementation,
`apps-script/DoctorInstruction.gs`). Phase 2B Batch PXP-8 added
`schemas/trusted-device.schema.json` (the `TrustedDevice` record shape — Persistent
Authentication, ADR-015, alongside its first implementation,
`apps-script/TrustedDevice.gs`; the first Phase 2B entity that is patient-owned rather
than doctor/staff-owned, and the first whose patient-facing read route deliberately
redacts one of its own schema's required fields, `device_token_hash`, before ever
returning a row — see that schema's own `.md` for the full disclosure). Long-Lived
Session, the other named mechanism this batch ships, has no schema of its own — per
docs/33-DOMAIN-MODEL.md §6.6, it is "not a stored entity of its own, a parameterization
of the existing Session mechanism" (`schemas/session.schema.json`, unchanged).
Phase 3/WHIMS Batch WPI-1 added `schemas/doctor-identity.schema.json` (the
`DoctorIdentity`/`Doctor` record shape — Pillar 1, ADR-017, ADR-002's own pattern
applied to a second, permanently distinct identity space, alongside its first
implementation, `apps-script/DoctorIdentity.gs`), `schemas/doctor-session.schema.json`
(the `DoctorSession` payload shape — reuses `session.schema.json`'s exact wire format
and `apps-script/FoundationSession.gs`'s unmodified signing primitives; see its own
`.md` for the dedicated pre-ship security review docs/50 §14 required), and
`schemas/doctor-login-token.schema.json` (the `DoctorLoginToken` record shape — mirrors
`login-token.schema.json` exactly, stored in its own `DoctorLoginTokens` sheet, never
`LoginTokens`).

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
