# Patient Identity

Explains `patient-identity.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Why one schema covers two conceptually distinct entities

`docs/33-DOMAIN-MODEL.md` deliberately models **Patient** (§1.1, the fuller profile —
name, email, condition, status) and **Patient Identity** (§1.2, the minimal, permanent
core — just `patient_id` and `created_at`) as two distinct entities, specifically so
that authentication method, contact details, and profile data can all change without
ever touching the permanent identity (ADR-002).

`docs/29-PHASE-2A-TECHNICAL-PLAN.md` §4 had already locked a single `Patients` sheet
with both the identity core and the profile fields in one row, before this schema was
written. This is not a contradiction: ADR-002's actual requirement is that `patient_id`
never changes and every other record references it — not that identity and profile
must be physically stored apart. A single row satisfies ADR-002 exactly as well as two
separate ones would, with materially less implementation complexity (one write, one
lookup, no join), which matters at Foundation's pilot scale (ADR-006, avoid
over-abstraction). This schema therefore covers the full row, with each field's
description stating explicitly which conceptual half (docs/33 §1.1 or §1.2) it
belongs to — so the distinction stays visible in the contract even though storage is
unified.

**The one rule that must never be violated regardless of storage layout:** every other
Phase 2A entity (Session, Timeline Event, Symptom Log, Report, future Care Plan)
references `patient_id`, never `email` or `full_name`. If a patient's email changes, no
other record needs to change. That property is what this schema — and
`apps-script/PatientIdentity.gs`'s implementation — actually protects.

## Fields at a glance

| Field | Half | Mutable? |
|---|---|---|
| `patient_id` | Identity (§1.2) | No — set once, never reused |
| `created_at` | Identity (§1.2) | No — set once |
| `created_by` | Identity (§1.2) | No — set once, audit provenance |
| `full_name` | Profile (§1.1) | Yes |
| `email` | Profile (§1.1) | Yes |
| `condition_slug` | Profile (§1.1) | Yes |
| `status` | Profile (§1.1) | Yes — `active` → `inactive`/`recovered` per docs/23's lifecycle |

## A documented simplification: `condition_slug` is not validated against the canonical list

Phase 1.5's `apps-script/Config.gs` maintains `ALLOWED_CONDITION_SLUGS`, the canonical
list reused platform-wide (docs/20 §5). Foundation batch F3 does **not** duplicate that
list into a Foundation-side validator — `foundationValidatePatientInput_()` only checks
`condition_slug` is a non-empty string. This was a deliberate, minimal choice at the
time: hand-duplicating an 8-item list without a real second consumer was already
flagged as premature by Phase 1.5's own Batch 4A review. `shared/constants/` has since
been populated in Patient Access Batch PA-4
(`condition-slugs.json`, once `SymptomLogs.condition_slug` became that second real
consumer) — but `PatientIdentity.gs` itself remains frozen (docs/35 §9) and was **not**
updated to validate against it, so this field's own gap is unchanged and still open,
not retroactively closed by PA-4's unrelated work. Closing it would mean reopening a
frozen Foundation file for a validation-only change — a future batch's decision, not
this note's to make.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/PatientIdentity.gs` and
`apps-script/FoundationDataStore.gs`'s `FOUNDATION_PATIENTS_COLUMNS_` — never the
reverse, per `shared/README.md`.
