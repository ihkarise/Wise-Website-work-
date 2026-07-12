# MedicationDecision

Explains `medication-decision.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §11.4, ADR-024/025/026)

The append-only clinical-status ledger backing `MedicationHistory.current_status`
(`medication-history.schema.json`) — mirroring `InventoryTransaction`'s own
append-only-ledger discipline rather than mutating a running status in place (WPI-7,
docs/54 §19).

## Strictly append-only — no update, ever

There is no `foundationDsUpdateById_()` call anywhere in `apps-script/
MedicationHistory.gs`'s own implementation targeting this entity's own Sheet — every row,
once written, is permanent and unmodified, satisfying docs/56 §20's explicit requirement
("no update/patch call anywhere in a future implementation's own code targeting that
entity's Sheet").

## Recording a decision — the platform's second `LockService` use for a recompute-from-ledger cache

`record_medication_decision` wraps its append-then-recompute-then-cache-write sequence in
`LockService.getScriptLock()`, mirroring `InventoryTransaction.gs`'s own precedent exactly
(docs/54 §7/§19, first used at WPI-7): append the new `MedicationDecision` row, then
recompute `MedicationHistory.current_status` from scratch (the latest row by `decided_at`,
never "previous cached value + this delta"), then write it back. If `tryLock()` fails, the
function performs no write at all and returns `FOUNDATION_LOCK_UNAVAILABLE` — never a
silent, unsynchronized read-modify-write race.

## The `replace` boundary

`replacement_medication_history_id` (populated only when `decision_type: 'replace'`) must
reference a **different**, already-existing `MedicationHistory` row — this entity names no
mechanism for recording a replacement medication that was never itself photographed and
recognized (docs/56 §11.4's disclosed boundary).

## Security

Doctor/staff-owned only, roster-scoped, `DoctorSession`-derived — never patient-writable.
Session-derived patient read-only of their own rows.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `decision_id` | Yes (server-generated UUID) | No |
| `medication_history_id` / `patient_id` | Yes | No |
| `decision_type` | Yes | No |
| `replacement_medication_history_id` | Yes (`''` sentinel unless `decision_type: 'replace'`) | No |
| `notes` | Yes (`''` sentinel if none) | No |
| `decided_by` / `decided_at` | Yes (server-set / doctor-supplied) | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/MedicationHistory.gs` — never
the reverse, per `shared/README.md`.
