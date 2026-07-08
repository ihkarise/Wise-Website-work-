# Condition-to-Specialty Map

Explains `condition-specialty-map.json` (version `1.0.0`, the authoritative definition
— this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch WPI-2 (docs/50-PHASE-3-TECHNICAL-PLAN.md §6.3, ADR-018)

docs/50 §6.3 names, but does not design, "a small, additive lookup table" for deriving
a patient's effective specialty from their active `DoctorAssignedCondition` entries.
docs/51-PHASE-3-ARCHITECTURE-READINESS-REVIEW.md Part 1.4 flagged this as an open
implementation-time question — "whether it lives in `shared/constants/` (a
registry-style file) or as a new schema" — and recommended resolving it "at whichever
batch (WPI-2) actually implements it." This file is that resolution: a
`shared/constants/`-style lookup file, the same category `condition-slugs.json` and
`upload-limits.json` already established for a canonical, small, cross-cutting value
list.

## Not a change to `DoctorAssignedCondition`

This file maps `condition_slug` (the same canonical values `condition-slugs.json`
already defines) to `specialty_slug` (`specialty-registry.json`). It is a wholly
separate, additive file — `shared/schemas/doctor-assigned-condition.schema.json` and
`apps-script/DoctorAssignedCondition.gs` are untouched, zero lines, per docs/50 §3's
explicit zero-lines-touched list. A `DoctorAssignedCondition` row's own
`condition_slug` field is looked up against this map by a future consumer; this map
never becomes part of that row's own stored shape.

## Every condition maps to the one seeded specialty, today

Every slug in `condition-slugs.json` version `1.0.0` (`mcas`,
`hashimotos-thyroiditis`, `chronic-urticaria`, `eczema`, `allergic-rhinitis`,
`eosinophilic-esophagitis`, `pots`, `dermographism`) maps to `homeopathy` — the only
specialty `specialty-registry.json` seeds. This is not a placeholder simplification;
it is documentation-accurate, since every condition slug in production today already
is homeopathy-specific (docs/49 §3.1).

## `default_specialty_slug` — the fail-open fallback

A condition slug with no explicit mapping (or a patient with no
specialty-mapped condition assignment at all) resolves to `default_specialty_slug`
(`homeopathy`) — "a patient with no specialty-mapped condition is treated as the
implicit default specialty, matching today's actual behavior exactly" (docs/50 §6.3).
This is the deliberate inverse of `PatientModuleState`'s own fail-*closed* discipline
(ADR-010): narrowing visibility by default here would incorrectly hide every existing
patient from every registry the day this map was introduced, so absence instead
fails *open* to the platform's one real specialty — the same reasoning docs/51 Part
1.4 already applied to `specialty_scope` itself.

## No consumer in this batch

`foundationGetSpecialtyForCondition_()` (`apps-script/SpecialtyRegistry.gs`) is the
pure lookup function this file backs. No route or dashboard reads it yet — it is
infrastructure for a future batch (Doctor Dashboard patient-roster/registry
filtering, docs/50 §7.4) to consume, mirroring Calculator Registry's (Batch PXP-6) own
"ships empty of any real consumer, proven directly by its own conformance tests
instead" precedent.

## Fields at a glance

| Field | Consumed by any code in WPI-2? | Purpose |
|---|---|---|
| `default_specialty_slug` | Yes | The fallback `foundationGetSpecialtyForCondition_()` returns for any unmapped or missing `condition_slug`. |
| `mappings[].condition_slug` | Yes | The lookup key — one row per canonical condition slug. |
| `mappings[].specialty_slug` | Yes | The `Specialty` (`specialty-registry.json`) the condition belongs to. |

## Versioning

Version `1.0.0`. Adding, removing, or re-mapping a condition slug's specialty requires
a new version here first, then updating `apps-script/SpecialtyRegistry.gs`'s
hand-ported copy — never the reverse, per `shared/README.md`. A new condition slug
added to `condition-slugs.json` in the future should be added here in the same change,
to avoid a silently-unmapped condition falling through to the default sentinel by
omission rather than by an explicit, disclosed decision.
