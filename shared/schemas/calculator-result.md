# Calculator Result

Explains `calculator-result.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch PXP-6 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §8.2/§11.4, §22)

Phase 2B's Pillar 3 (docs/44 §4.1) — a patient's permanently-recorded computation
against one Calculator Registry entry (`shared/constants/calculator-registry.json`),
governed by ADR-013 (deterministic, never AI-computed). Structurally a close mirror of
`check-in-response.schema.json` — both are the platform's two implementations of docs/44
§11.4's JSON-storage policy, both pin a versioned registry reference two-field-wide
(`template_id`/`template_version` there, `calculator_slug`/`definition_version` here), and
both are create-and-list-only.

## `input_snapshot` — a JSON-encoded column, docs/44 §11.4's disclosed exception, second use

`check-in-response.md` already anticipated this: "`CalculatorResult.input_snapshot` will
be its second [use], in a future batch." The underlying Sheet cell holds a JSON-encoded
string — the same disclosed exception to `ADR-006`'s flat-column convention
`check-in-response.schema.json`'s `answers` already established. This schema describes
`input_snapshot` as a real `object`, because it is the entity's *contract*, not its
storage detail (`shared/README.md`'s "Contract vs. implementation-only detail"):
`apps-script/CalculatorResult.gs` always parses the stored string back into a real object
before returning any record to a caller.

## Both `calculator_slug` and `definition_version` are stored — never one alone

Per docs/44 §11.4, applied identically to its `CheckInResponse` precedent: pinning both is
what keeps a result permanently interpretable even after the calculator is later edited
into a new version. A future reporting/aggregation feature that needs to compare results
across versions must resolve each row's own `(calculator_slug, definition_version)`
independently — a consumer-side responsibility, never something the storage layer
resolves on the consumer's behalf.

## `result_value` is never computed by this schema or its backing code

ADR-013 requires a calculator's result to be the deterministic output of a doctor/staff-
authored formula. This entity's own write path (`apps-script/CalculatorResult.gs`) never
runs any formula — it validates `input_snapshot` against the referenced
`CalculatorDefinition`'s declared `input_fields` and stores whatever `result_value` the
caller supplies, exactly as untrusted-but-validated as every other field. See
`shared/constants/calculator-registry.md`'s "No formula logic in this batch" section for
why this boundary is deliberate, not an oversight.

## Validation rules (docs/44 §11.4, enforced by `apps-script/CalculatorResult.gs`)

- `patient_id`: required, session-derived only — never client-supplied.
- `calculator_slug`/`definition_version`: required; the pair must resolve to a real,
  existing `shared/constants/calculator-registry.json` entry — impossible to satisfy
  today, since that registry ships empty in this batch (see its own `.md`'s "Ships empty"
  section); every submission is rejected until a future batch registers a real
  calculator.
- `input_snapshot`: required; must be a flat object (`{field_key: value}`, no nested
  objects or arrays); every present key must be a `field_key` the referenced calculator
  version actually declares; every `required` input field must be present; every value
  must satisfy its declared `type`/`min`/`max`.
- `result_value`: required; a flat scalar (`number` or `string`, never an object/array or
  null/undefined).
- The serialized `input_snapshot` JSON text must not exceed
  `apps-script/CalculatorResult.gs`'s `FOUNDATION_CALCULATOR_INPUT_SNAPSHOT_MAX_BYTES_`
  bound (mirroring `CheckInResponse.gs`'s own upload-size-check precedent, docs/44 §11.4).

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other Foundation entity's input validation already follows.

## Deterministic serialization

`apps-script/CalculatorResult.gs`'s `foundationBuildDeterministicCalculatorInputSnapshot_()`
writes `input_snapshot`'s keys in the referenced calculator version's own
`input_fields`-list order, omitting any optional field left blank — the concrete,
checkable property docs/44 §11.4 names: re-serializing identical inputs never produces a
spurious byte-level diff.

## Known limitation, disclosed (inherited from docs/44 §11.4)

A doctor/staff member opening the raw Sheet directly sees an unreadable JSON blob in the
`input_snapshot` column instead of a plain value, unlike most other Sheet-backed entities
— the same accepted, disclosed cost `check-in-response.md` already discloses for
`answers`.

## Lifecycle

Create and list only — no update, no delete, no per-entry get-by-id, mirroring
`check-in-response.schema.json`'s own disclosed scope boundary.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version here
first, then a subsequent update to `apps-script/CalculatorResult.gs` — never the reverse,
per `shared/README.md`.
