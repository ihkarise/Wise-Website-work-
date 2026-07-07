# Calculator Registry

Explains `calculator-registry.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-6 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §8/§17/§22, ADR-013)

Phase 2B's Pillar 3 (docs/44 §4.1) — a registry of available, deterministic,
doctor/staff-authored calculators, mirroring the Module Registry (`module-registry.json`,
ADR-012, "which capability is exposed") and Template Registry (`template-registry.json`,
ADR-016, "the shape of a form") pattern exactly, applied here to "which computation
exists." This batch delivers the registry mechanism and `CalculatorResult`
(`shared/schemas/calculator-result.schema.json`) — a generic, pluggable
write/read path any future calculator can use without a code change, per docs/44 §8.3's
explicit pluggability constraint.

## Ships empty — a deliberate, disclosed scope decision

Unlike Module Registry (seeded with three already-implemented capabilities) and Template
Registry (seeded with one concrete `daily_wellness_checkin` example), this batch
registers **zero** calculators — disease-specific or otherwise. This batch's own scope is
the generic registry-and-result mechanism only; no concrete `CalculatorDefinition` is
authored, reviewed, or shipped by it. A future calculator becomes real by a later,
separately-approved batch adding its own registry entry here (docs/47 §4's "a new
calculator is a new registry entry, never new architecture") — this file's own shape is
already complete and ready for that entry to slot into, exactly the same "prove the
mechanism, let a later batch supply the first real instance" posture
`module-registry.json`'s own header comment already used for its own not-yet-built
capabilities (Calculators, Personal Care Plan), applied here one level further within
Calculator Registry's own batch.

## Calculator Registry vs. Module Registry vs. Template Registry — three different questions

Module Registry governs *which capability* a patient sees at all. Template Registry
governs *the shape of a form or questionnaire* a capability renders once exposed.
Calculator Registry governs *which deterministic computation* exists and *what inputs it
declares* — a distinct third question, per docs/44 §8's Pillar 3 framing. A patient
Calculator UI (docs/44 §22's own PXP-6 row names one) would be a Module Registry entry
plus a Calculator Registry lookup, exactly the same "two registries used together, never
merged" discipline `template-registry.md` already states for its own relationship to
Module Registry — not built in this batch (see "No Module Registry entry, no dashboard
UI in this batch" below).

## Entry shape — a versioned `CalculatorDefinition` (docs/44 §8.2)

Each row in `calculators` (once a future batch adds one) is shaped:
`calculator_slug` (stable identifier), `version` (integer, immutable once created —
editing a calculator's inputs means appending a new version, never mutating one in
place, the same discipline `template-registry.json`'s `(template_id, version)` pair
already established), `title`, `description`, `input_fields` (an ordered list of
`{field_key, label, type, min, max, required}` — the exact shape
`template-registry.json`'s own `questions` array already uses, reused here rather than
inventing a second field-declaration shape), `formula_reference` (a descriptive pointer
only, e.g. a doc/version identifier for wherever the actual formula logic is authored —
**never executable code stored or run here**; see "No formula logic in this batch"
below), `relevant_condition_slugs` (metadata only — informs, never restricts or
auto-enables, the same "condition informs, doctor decides" discipline docs/44 §6.3/§8.3
already establishes), `status` (`active`/`retired`), `future_ai_capable` (reserved,
presently inert — mirrors `module-registry.json`'s and `template-registry.json`'s own
AI-readiness reservation), `created_by`, `created_at`.

## No formula logic in this batch — docs/44 §8.3/ADR-013's constraint, applied literally

Neither this file nor `apps-script/CalculatorRegistry.gs`/`apps-script/CalculatorResult.gs`
ever computes a calculator's `result_value`. `CalculatorResult.gs`'s write path validates
a submitted `input_snapshot` against the referenced entry's own `input_fields` (exactly
`CheckInResponse.gs`'s existing `answers`-against-`questions` validation, generalized) and
stores whatever `result_value` the caller supplies — the actual formula computation is
the responsibility of whichever future batch authors a real `CalculatorDefinition`'s
logic (client-side, or a later definition-execution mechanism), never this generic
registry-and-storage layer. This is what keeps this batch's own code entirely free of any
disease-specific or calculator-specific branch, per docs/47 §3's "never hardcode" rule.

## No Module Registry entry, no dashboard UI in this batch

Deliberately deferred: this batch does not add a `calculator` entry to
`module-registry.json`, does not touch `my-health-journey/dashboard.js`, and ships no new
HTML page — a disclosed, explicit scope narrowing from docs/44 §22's PXP-6 row (which
names "Patient Calculator UI" as part of this batch), mirroring the exact
Module-Registry-backend (PXP-3) / Dashboard-Registry-frontend (PXP-4) split precedent:
the registry-and-storage mechanism ships first, patient-facing rendering is a later,
separately-scoped batch once a real calculator exists to render. See docs/24-ROADMAP.md's
PXP-6 entry for the full disclosure.

## Validation rules (enforced by `apps-script/CalculatorResult.gs`)

- `calculator_slug`/`definition_version`: required; the pair must resolve to a real
  `calculator-registry.json` entry (impossible to satisfy today, since the registry ships
  empty — every submission is rejected until a future batch adds a real entry, the same
  fail-closed-by-absence discipline `patient-module-state.md` already establishes for its
  own registry).
- `input_snapshot`: required; must be a flat object (no nested objects/arrays, docs/44
  §11.4); every present key must be a `field_key` the referenced version actually
  declares; every `required` field must be present; every value must satisfy its declared
  `type`/`min`/`max`.
- `result_value`: required; a flat scalar (`number` or `string`, never an object/array) —
  deliberately not narrowed to `number` alone, since a future calculator's result might be
  categorical (e.g. a risk band) rather than numeric; this schema does not itself compute
  or judge whether a given `result_value` is the "correct" one for its `input_snapshot`
  (ADR-013: that correctness is the authored `CalculatorDefinition`'s own responsibility,
  never this generic layer's).
- The serialized `input_snapshot` JSON text must not exceed
  `apps-script/CalculatorResult.gs`'s own size bound, mirroring
  `CheckInResponse.gs`'s `FOUNDATION_CHECKIN_ANSWERS_MAX_BYTES_` precedent.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other Foundation entity's input validation already follows.

## Versioning

Version `1.0.0`. Adding a new calculator (a new `(calculator_slug, version)` row) requires
a new version here first, then a subsequent update to
`apps-script/CalculatorRegistry.gs`'s hand-ported copy — never the reverse, per
`shared/README.md`.
