# Template Registry

Explains `template-registry.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-5 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §11/§11.5/§17/§22, ADR-016)

Phase 2B's fourth registry (docs/44 §11.5) — the platform's only mechanism for
expressing *the shape* of a patient-facing form or questionnaire, complementing
(never replacing) Module Registry's own "which capability is exposed" concern
(ADR-012). This batch delivers the registry, `CheckInResponse`
(`shared/schemas/check-in-response.schema.json`), and one disclosed additive
entity that fills a gap docs/44 §10.2 settles but does not itself name a
persisted shape for — see "Doctor assignment" below.

## Template Registry vs. Module Registry — two different questions

Module Registry (`module-registry.json`) governs *which capability* a patient sees at
all. Template Registry governs *the shape of the form* a capability renders once
exposed. The Daily Check-in module (`module_id: 'daily_checkin'`, added to
`module-registry.json` by this same batch) is what makes the capability visible;
this file is what makes its form data-driven rather than hardcoded. The two registries
are used together, never merged (docs/44 §11.5's own "Relationship to ADR-012").

## `CheckInTemplate` is this registry's first concrete category, not a separate mechanism

Per docs/44 §11.1/§11.5: what earlier plan versions called the "Template Engine,"
scoped only to `CheckInTemplate`, is understood as the first concrete category of this
general registry. Every row in `templates` below is `CheckInTemplate`-shaped
(docs/44 §11.2): `template_id`, `version`, `condition_slug`, `questions`, `status`,
`created_by`, `created_at`. Six future categories (Weekly Check-in, Monthly Review,
Condition Review, Lifestyle Questionnaire, Follow-up Questionnaire, Doctor-created
Templates) are named, reserved, and unscoped by docs/44 §11.5 — none is pre-declared
here, the same "name it, do not scope it" discipline `module-registry.md` already
applied to its own future consumers.

## `template_category` — a disclosed, additive field beyond docs/44 §11.2's list

docs/44 §11.2 lists `CheckInTemplate`'s fields without a category discriminator, since
that section predates §11.5's Version 4.0 generalization into a multi-category
registry. §11.5 requires the registry to "support, for every category, without a code
change" — versioning, activation, AI compatibility, doctor assignment — but names no
concrete field for *which category* a given row belongs to. `template_category`
(fixed to `"daily_checkin"` for every row in this batch) is this batch's minimal,
disclosed mechanism for that requirement: a future category (e.g. `weekly_checkin`)
adds new rows with a different `template_category` value, never a new registry file or
a code branch keyed on it (docs/47 §3's "never hardcode" rule, applied here).

## `(template_id, version)` — immutable once created

Per docs/44 §11.2/§11.4: editing a template's `questions` means appending a new
`version` row under the same `template_id`, never mutating an existing row in place.
Old `CheckInResponse` rows remain permanently valid against the exact version they
were recorded against, forever (docs/44 §11.4's migration strategy).

## Doctor assignment — the one disclosed gap this batch fills

docs/44 §10.2 settles that "a doctor explicitly assigns which template(s) apply" to a
patient, informed by (never automatically derived from) their `DoctorAssignedCondition`
rows. Neither docs/44 §17's entity table nor docs/33 §6.5 names a persisted shape for
that assignment itself. Without one, "doctor decides" has nothing to record a decision
into. This batch adds `CheckInTemplateAssignment`
(`shared/schemas/check-in-template-assignment.schema.json`,
`apps-script/CheckInTemplateAssignment.gs`) as a minimal, disclosed, additive entity —
an exact structural mirror of the already-twice-approved `DoctorAssignedCondition`
pattern (assign/resolve, doctor/staff-only, manually-run editor functions, since no
real Doctor identity/session exists yet, docs/33 §1.4). See that schema's own `.md` for
full detail. This is a gap-fill within PXP-5's own named scope (§10.2's "settled"
requirement), not a new architectural decision, new registry, or new ADR — no existing
file's Decision text changes.

## No AI/calculator/care-plan behavior implemented

`future_ai_capable` is a reserved extension point only — consumed by zero code in this
batch, exactly like `module-registry.json`'s own `future_ai_capable` field. Adding real
behavior behind it requires its own future, separately-proposed and separately-approved
batch, gated by the full ADR-001/004/005 pattern (docs/44 §15).

## Versioning

Version `1.0.0`. Adding a new template (a new `(template_id, version)` row) or a new
category (a new `template_category` value) both require a new version here first, then
updating `apps-script/TemplateRegistry.gs`'s hand-ported copy — never the reverse, per
`shared/README.md`.
