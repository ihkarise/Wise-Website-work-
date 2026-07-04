# Canonical Condition Slugs

Explains `condition-slugs.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## Why this file exists now

`shared/README.md` named this list — already hand-duplicated between
`apps-script/Config.gs`'s `ALLOWED_CONDITION_SLUGS` and
`internal/consultation-summary.html`'s `<select>` — as "a good future candidate" for
`shared/constants/`, not yet acted on. `shared/schemas/patient-identity.md` recorded the
same gap again for `Patients.condition_slug`: "duplicating that list now, with no second
real consumer beyond a copy-paste, was already flagged as premature."

Batch PA-4 (`shared/schemas/symptom-log.schema.json`'s optional `condition_slug` field)
is that second real consumer, per docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md §10 — so
this file is populated now rather than deferred a third time.

## What this closes, and what it does not

This file is the canonical **definition**. It does not, by itself, replace either
existing hand-duplicated copy — `apps-script/Config.gs` and
`internal/consultation-summary.html` are Phase 1.5 files, frozen, and out of scope for a
Phase 2A batch to silently modify. `apps-script/FoundationSymptomLog.gs` is the first
implementation to read from this canonical list (via its own
`FOUNDATION_ALLOWED_CONDITION_SLUGS_` array, manually adapted from this file, the same
"port a `shared/` definition into a `Foundation`-prefixed file" convention every other
Foundation entity already uses — no build-time enforcement exists, per `shared/README.md`).
A future cleanup batch could point `Config.gs` and the internal tool's `<select>` at this
same file; not done here, since neither is part of this batch's approved scope.

## Fields at a glance

- `slug` — the canonical anchor ID, matching `/conditions/`'s URL slugs (docs/20 §5).
- `label` — the human-readable condition name, for any `<select>` a consumer builds.

## Versioning

Version `1.0.0`. Adding, removing, or renaming a slug requires a new version here first,
then updating every conforming implementation afterward — never the reverse, per
`shared/README.md`.
