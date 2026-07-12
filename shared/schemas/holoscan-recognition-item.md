# HoloscanRecognitionItem

Explains `holoscan-recognition-item.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §11.2, ADR-024/025/026)

One row per distinct medicine candidate a `HoloscanRecognition`'s own vision-model call
reported recognizing — the draft/audit row structurally mirroring
`AIAssistantInteraction`'s own draft-then-decision shape (docs/55), applied here to a
vision-extraction pipeline with a two-entity target (`MedicationHistory`/
`MedicationDecision`) instead of AI Assistant's single draft-and-decide entity.

## Never a write path into MedicationHistory (ADR-025)

Recording `doctor_decision` (`approved` / `corrected_and_approved` / `rejected`)
persists that decision only — `apps-script/HoloscanRecognition.gs`'s
`post_holoscan_recognition_decision` handler never itself creates a `MedicationHistory`
row. If the doctor wants an approved recognition to become a permanent record, the
doctor separately calls `create_medication_history_entry`
(`apps-script/MedicationHistory.gs`), using the approved item's fields as pre-fill only.
Enforced at the code level by `validation/static-analysis/analyze.js`'s Holoscan static
rules (docs/56 §23 item 1), mirroring the identical rule docs/55 §18 item 1 already
requires for AI Assistant.

## Immutability

Every `extracted_*`/`confidence_score`/`check_flags` field is immutable once written —
the honest record of what the pipeline actually produced, never overwritten even after a
doctor's correction (the correction lives in `corrected_fields`, alongside, not in place
of, the original extraction). Only the single `doctor_decision` transition (plus its
attendant fields — `corrected_fields`, `decision_notes`, `decided_by`, `decided_at`) is
ever written after creation, exactly once, mirroring `AIAssistantInteraction.doctor_decision`'s
identical precedent.

## The Medicine Catalog gap (ADR-024/§8)

`catalog_match_status`/`catalog_match_ref` are reserved fields — always empty-string
sentinels in this batch. No structured Medicine Catalog exists on this platform; a
future, separately-approved ADR extending ADR-024 is required before this step becomes
real.

## Security

`patient_id` is denormalized from the parent `HoloscanRecognition`, the same convention
`CarePlan`/`DoctorInstruction` already use for direct roster-scoped queries. Roster-scoped
doctor read/write only for the decision fields; session-derived patient read-only for the
rest — the patient may see what was detected and its review status but never writes
`doctor_decision` (the identical "patient never edits a doctor's decision" boundary
`DoctorInstruction`/`CarePlan` already establish).

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `recognition_item_id` | Yes (server-generated UUID) | No |
| `recognition_id` / `patient_id` | Yes | No |
| `source_image_ref` / `extracted_*` / `confidence_score` / `check_flags` | Yes | No |
| `catalog_match_status` / `catalog_match_ref` | Yes (`''` sentinel) | No (reserved) |
| `doctor_decision` | Yes (`'pending'`) | One-way transition, exactly once |
| `corrected_fields` / `decision_notes` / `decided_by` / `decided_at` | No (empty sentinels) | Set once, at decision time |
| `created_at` | Yes (server-set) | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/HoloscanRecognition.gs` — never
the reverse, per `shared/README.md`.
