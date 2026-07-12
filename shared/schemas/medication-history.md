# MedicationHistory

Explains `medication-history.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §11.3, ADR-024/025/026)

The permanent, doctor-authored medication record. Created only by a doctor's own
deliberate `create_medication_history_entry` action (`apps-script/MedicationHistory.gs`)
— never automatically by Holoscan's recognition pipeline (ADR-025's central guarantee).
An approved `HoloscanRecognitionItem` (`holoscan-recognition-item.schema.json`) supplies
pre-fill only, never a direct write.

## `current_status` is derived, never client-supplied

Recomputed from the latest `MedicationDecision` row (`medication-decision.schema.json`)
every time one is recorded, defaulting to `active` at creation with no `MedicationDecision`
row required to establish that initial state — mirroring `InventoryItem.quantity_on_hand`'s
own recompute-from-ledger discipline exactly (WPI-7, docs/54 §7/§13/§19), including that
precedent's `LockService`-protected append-then-recompute-then-cache-write discipline.

## Deliberately distinct from DoctorInstruction (type: `medicine`)

docs/33 §2.3 already established "Prescription is a `medicine`-type Doctor Instruction" —
that entity records what a doctor at this clinic told a patient to take, as part of a
Care Plan. `MedicationHistory` records what a patient is verified, by photographic
evidence and doctor review, to actually be taking — which may include medicines this
clinic never prescribed at all. The two entities carry no structural reference to one
another; a doctor comparing the two is a manual, judgment-based act (docs/56 §0.2). The
two entities may diverge — an accepted, honest reflection of reality, not a defect to
reconcile automatically.

## Lifecycle

Created once, by a doctor's own deliberate write action; `current_status` is the only
field ever recomputed after creation, and only as a pure function of `MedicationDecision`.
Every other field is immutable once written — an honest record of what was confirmed at
approval time. A genuine correction to `medicine_name` itself (as opposed to a status
change) is out of this batch's scope, a disclosed gap rather than a silently-assumed
possibility.

## Security

Roster-validated at creation (reuses `DoctorPatientRoster.gs`, never a new derivation).
Doctor/staff-authored only — the patient never creates, edits, or resolves a
`MedicationHistory` row directly (the identical "doctors decide" boundary
`CarePlan`/`DoctorInstruction` already establish). Patient-viewable, read-only.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `medication_history_id` | Yes (server-generated UUID) | No |
| `patient_id` | Yes (roster-validated) | No |
| `medicine_name` / `strength` / `dosage_form` / `manufacturer` | Yes (doctor-confirmed) | No |
| `source_type` / `source_recognition_item_id` | Yes | No |
| `current_status` | Yes (`'active'`) | Recomputed from `MedicationDecision`'s ledger only |
| `created_at` / `created_by` | Yes (server-set / doctor-supplied) | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/MedicationHistory.gs` — never
the reverse, per `shared/README.md`.
