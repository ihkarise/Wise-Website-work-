# DigitalTwinNarrative

Explains `digital-twin-narrative.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-12 (docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md §11.1, ADR-028/029/030)

The audit/decision/delivery record for the platform's **first patient-facing AI-generated
content**: a doctor generates one narrative (`health_story` | `ai_summary`) for one of their
own roster patients via `generate_digital_twin_narrative`
(`apps-script/DigitalTwinNarrative.gs`), reviews it via `review_digital_twin_narrative`, and
**no narrative reaches a patient until that doctor approves it** (ADR-028).

## The only stored thing in Phase 2D

The **Digital Twin view** (§6.1) and the **Progress Analytics view** (§6.3) are computed on
read, never stored (ADR-004/ADR-028), mirroring `Analytics.gs`'s own discipline. Only this
AI narrative row and its doctor-approved `published_output` are persisted.

## Doctor-generated / patient-visible-only-when-approved (ADR-028)

Created `review_status: pending` — held only in this row and the reviewing doctor's own
screen. The one-way transition to `approved` / `edited_and_approved` / `rejected`
(`review_digital_twin_narrative`) is the **sole gate to patient visibility**:

- `approved` — the model's `ai_output` becomes the `published_output` the patient sees.
- `edited_and_approved` — the doctor's own edited text becomes the `published_output`; the
  original `ai_output` is retained alongside (never overwritten) as an honest audit.
- `rejected` — nothing is ever shown; the row is retained as an audit record only.

**Only `approved`/`edited_and_approved` narratives' `published_output` is ever returned to a
patient** (`get_health_story` filters server-side, not by UI hiding) — a `pending` or
`rejected` narrative is never returned to a patient by any route. This is the direct
continuation of Phase 1.5's `evaluateSendGate_()` discipline (ADR-005), applied to an
aggregated narrative.

## Grounded in the patient's own record only (ADR-029)

`context_snapshot` is the exact, deterministic assembly of the patient's own already-stored
structured record (`DigitalTwinContextBuilder`, docs/59 §6.2) — never an unstructured
knowledge base or the model's general knowledge. Each `narrative_type` declares a fixed
`context_sources` allow-list (`shared/constants/digital-twin-narrative-registry.json`);
`requires_knowledge_engine` is `false` for every entry in this freeze's scope.
`validation/static-analysis/analyze.js`'s Digital Twin static rules enforce the grounding and
no-foreign-write boundaries at the code level.

## Lifecycle

`pending` (draft, never patient-visible) → one of `approved` / `edited_and_approved` /
`rejected`, exactly once, one-way (stamps `reviewed_at`/`reviewed_by`). `ai_output`,
`context_snapshot`, `ai_output_flags`, `created_at` are immutable once written; only the
single `review_status` transition (plus `published_output`/`reviewed_by`/`review_notes`/
`reviewed_at`) is ever written after creation.

## Security

Roster-validated at generation (reuses `DoctorPatientRoster.gs`). The doctor-facing routes are
gated by the `digital_twin_review` DoctorModuleState, **disabled by default** (ADR-030). The
patient never generates, edits, approves, or rejects a narrative, and reads only its
`published_output` for their own `approved`/`edited_and_approved` rows.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `narrative_id` / `patient_id` / `narrative_type` | Yes | No |
| `context_snapshot` / `prompt_template_version` / `model` / `ai_output` / `ai_output_flags` | Yes | No (immutable audit) |
| `review_status` | Yes (`'pending'`) | One-way → terminal, exactly once |
| `published_output` | Empty at creation | Set once, only on `approved`/`edited_and_approved` |
| `reviewed_by` / `review_notes` / `reviewed_at` | Empty at creation | Set once, at review |
| `created_at` | Yes | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version here
first, then a subsequent update to `apps-script/DigitalTwinNarrative.gs` — never the reverse,
per `shared/README.md`.
