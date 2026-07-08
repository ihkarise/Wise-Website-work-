# Specialty Registry

Explains `specialty-registry.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch WPI-2 (docs/50-PHASE-3-TECHNICAL-PLAN.md §6.1/§19, ADR-018)

Phase 3/WHIMS's Pillar 3 (docs/49 §4) — the platform's only mechanism for naming which
specialty exists at all. Every registry-driven mechanism on the platform (Module
Registry, Calculator Registry, Template Registry, and the still-unbuilt Doctor Module
Registry, ADR-020) is designed by ADR-018 to gain an optional `specialty_scope` field
that references a real entry here — this file is what makes that reference resolvable
for the first time. This batch delivers the registry itself and the condition-to-
specialty lookup table (`condition-specialty-map.json`, docs/50 §6.3) only.

## Why `Doctor.specialty_slug` was already shipped, unvalidated, at WPI-1

`shared/schemas/doctor-identity.schema.json`'s `specialty_slug` field shipped at Batch
WPI-1, deliberately **not** validated against a real Specialty Registry entry, since
this registry did not exist yet (see that schema's own `.md`, "A documented
simplification" section). This batch makes a real Specialty Registry entry exist for
the first time — it does **not** retroactively add that validation to
`apps-script/DoctorIdentity.gs`, which is now itself a frozen Phase 3 file (frozen
except for genuine bug fixes, per the task governing this batch). Wiring
`specialty_slug` validation against this registry is a disclosed, deliberate
deferral to a future batch, mirroring how Batch PXP-3's Module Registry shipped before
any dashboard consumer validated against it.

## Seeded specialties — only what already exists

Seeded with exactly one entry, `homeopathy` — the platform's current, implicit
specialty, named explicitly for the first time (docs/49 §3.1: every concrete registry
entry shipped so far, and every condition slug in production, is implicitly
homeopathy-specific; nothing forced this, it was simply the only specialty that ever
populated a registry entry). **No second specialty is seeded** — onboarding one is a
future, separately approved product decision this registry's existence does not assume
or imply (ADR-018's own "no product commitment" Consequence).

## Why `specialty_scope` is not added to Module/Calculator/Template Registry in this batch

ADR-018 already decided, platform-wide, that Module Registry, Calculator Registry, and
Template Registry entries *may* optionally carry a `specialty_scope` field. docs/53 §4
governs *when* each specific registry actually gains a populated entry using it:
"independently, at whichever WPI batch first needs it for that specific registry —
never all three in one batch for convenience if only one is actually needed yet." Since
no second specialty exists, no entry in any of the three registries needs
`specialty_scope` populated yet — this batch does not touch
`shared/constants/module-registry.json`, `calculator-registry.json`,
`template-registry.json`, or their Apps Script counterparts (`ModuleRegistry.gs`,
`CalculatorRegistry.gs`, `TemplateRegistry.gs`), all frozen per docs/50 §3's explicit
zero-lines-touched list. A future batch that registers the first specialty-scoped entry
in one of those three registries adds `specialty_scope` to that registry's own files at
that time, referencing a real slug from this registry.

## Fields at a glance

| Field | Consumed by any code in WPI-2? | Purpose |
|---|---|---|
| `specialty_slug` | Yes | Stable key — the same "the slug is the ID" principle docs/20 §5 already established for condition taxonomy. The only field any future `specialty_scope` reference or `Doctor.specialty_slug` would resolve against. |
| `display_name` | No (config only) | Human-readable name for a future doctor-facing UI (e.g., a Doctor Dashboard specialty filter, WPI-4). |
| `status` | No (reserved) | `"active"` (only value used today) vs. a reserved `"retired"` value for a future specialty that stops accepting new doctors/patients without deleting its historical record — mirrors `Specialty` (§6.1)'s own docs/50 field list; unconsumed by any code in this batch. |

## Versioning

Version `1.0.0`. Adding a new specialty (a future, separately approved product
decision) requires a new version here first, then updating
`apps-script/SpecialtyRegistry.gs`'s hand-ported copy — never the reverse, per
`shared/README.md`.
