# Check-In Response

Explains `check-in-response.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch PXP-5 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §10.3/§11.4, §22)

The designed successor to `symptom-log.schema.json` — shipped alongside it, never
replacing it in this batch (docs/44 §10.1). `SymptomLogs` rows are never deleted; they
remain permanent historical data. Symptom Tracker's own retirement is a separate,
later, explicitly-approved batch (PXP-10), out of this batch's scope entirely.

## `answers` — a JSON-encoded column, docs/44 §11.4's disclosed exception

This is the first entity in the repository to actually use docs/44 §11.4's JSON
storage policy (`CalculatorResult.input_snapshot` will be its second, in a future
batch). The underlying Sheet cell holds a JSON-encoded string — the one disclosed
exception to `ADR-006`'s flat-column convention. This schema, however, describes
`answers` as a real `object`, because it is the entity's *contract*, not its storage
detail (`shared/README.md`'s "Contract vs. implementation-only detail" section):
`apps-script/CheckInResponse.gs`'s `foundationCheckInRowToApiShape_()` always parses
the stored string back into a real object before returning any record to a caller —
no consumer of this schema ever sees the raw JSON string.

## Both `template_id` and `template_version` are stored — never one alone

Per docs/44 §11.4: pinning both is what keeps a response permanently interpretable
even after the template is later edited into a new version. A future reporting/
aggregation feature that needs to compare answers across versions must resolve each
row's own `(template_id, template_version)` independently — a consumer-side
responsibility, never something the storage layer resolves on the consumer's behalf.

## Validation rules (docs/44 §11.4, enforced by `apps-script/CheckInResponse.gs`)

- `patient_id`: required, session-derived only — never client-supplied.
- `template_id`/`template_version`: required; the pair must resolve to a real,
  existing `shared/constants/template-registry.json` entry.
- The caller must currently hold an **active** `CheckInTemplateAssignment`
  (`shared/schemas/check-in-template-assignment.schema.json`) naming that exact
  `template_id` — the enforcement boundary that makes "a doctor explicitly assigns"
  (docs/44 §10.2) a real, checked rule rather than an advisory one. A patient can
  never submit a response against a template their doctor did not assign them, even
  though the template itself is publicly resolvable in the registry.
- `answers`: required; must be a flat object (`{field_key: value}`, no nested objects
  or arrays); every present key must be a `field_key` the referenced template version
  actually declares; every `required` question must be present; every value must
  satisfy its declared `type`/`min`/`max`.
- The serialized `answers` JSON text must not exceed
  `apps-script/CheckInResponse.gs`'s `FOUNDATION_CHECKIN_ANSWERS_MAX_BYTES_` bound
  (mirroring `FoundationReports.gs`'s own upload-size check, docs/44 §11.4).
- `condition_slug`, when provided, must be one of the canonical condition slugs —
  metadata only, never an authorization mechanism.

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other Foundation entity's input validation already follows.

## Deterministic serialization

`apps-script/CheckInResponse.gs`'s `foundationBuildDeterministicCheckInAnswers_()`
writes `answers`' keys in the referenced template version's own question-list order,
omitting any question the patient left blank (optional, not-yet-answered fields) —
the concrete, checkable property docs/44 §11.4 names: re-serializing identical
answers never produces a spurious byte-level diff.

## Known limitation, disclosed (inherited from docs/44 §11.4)

A doctor/staff member opening the raw Sheet directly sees an unreadable JSON blob in
the `answers` column instead of a plain value, unlike every other existing Sheet-backed
entity. This is an accepted, disclosed cost of docs/44 §11.4's approved policy, not an
oversight.

## Lifecycle

Create and list only — no update, no delete, no per-entry get-by-id (no product
requirement for one, mirroring `symptom-log.schema.json`'s own disclosed scope
boundary).

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/CheckInResponse.gs` — never the
reverse, per `shared/README.md`.
