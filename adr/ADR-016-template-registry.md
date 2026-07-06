# ADR-016: Patient-Facing Forms and Questionnaires Are Generated From a Template Registry

## Status
Accepted. Complements ADR-012 (Module Registry) and ADR-013 (Calculator Registry)
rather than amending or superseding either.

## Context
docs/44-PHASE-2B-TECHNICAL-PLAN.md §11 (the "Template Engine") already defines a
versioned, doctor/staff-authored template mechanism — but scoped, as originally
written, only to `CheckInTemplate` (Daily Check-ins). The platform's product vision
(docs/21) and its patient lifecycle (docs/23) both anticipate more than one kind of
patient-facing form or questionnaire over time — a weekly check-in, a periodic review,
a condition-specific review, a lifestyle questionnaire, a follow-up questionnaire, and
forms a doctor authors ad hoc for a specific patient's need. Building each of these as
its own bespoke mechanism would repeat, per template type, the exact versioning/
validation/JSON-storage design work docs/44 §11.4 already did once for Check-ins — the
same per-feature reinvention risk ADR-009 already warns against for backend modules,
and the same risk ADR-012 and ADR-013 already addressed for dashboard capabilities and
calculators respectively.

## Decision
Patient-facing forms and questionnaires are generated from a **Template Registry** — a
versioned list of template descriptors, generalizing docs/44 §11's existing Template
Engine — rather than hardcoded per form. `CheckInTemplate` (docs/44 §11.2) is this
registry's first concrete category, not a separate, parallel mechanism. Any future
template category (illustrative, not scoped or batched by this ADR: Weekly Check-in,
Monthly Review, Condition Review, Lifestyle Questionnaire, Follow-up Questionnaire,
Doctor-created Templates) is added as a new registry category and version, never as new
bespoke form-rendering or storage code.

The registry must support, for every category, without a code change:
- **Versioning** — the same immutable `(template_id, version)` discipline docs/44
  §11.2/§11.4 already specifies for `CheckInTemplate`, applied uniformly.
- **Activation/deactivation** — a `status` (active/retired) field per template,
  generalizing docs/44 §11.2's existing field; retiring a template never deletes or
  rewrites historical responses recorded against an earlier version.
- **Future AI compatibility (reserved, not implemented)** — every template descriptor
  reserves an extension-point field for future AI-compatibility metadata. No AI feature
  exists today; the field only avoids a future schema redesign. Any eventual use is
  independently gated by the full ADR-001/ADR-004/ADR-005 pattern — this ADR authorizes
  no AI behavior.
- **Doctor assignment** — every category follows docs/44 §10.2's already-settled rule:
  a doctor/staff member assigns which template(s) apply to a patient. **The patient
  never configures, selects, or authors a template** — including a "Doctor-created
  Template" category, which means a template *authored by* a doctor, never one
  *configured by* a patient.

This is deliberately a **generalization**, not new scope: no template category beyond
`CheckInTemplate` is designed, batched, or authorized by this ADR. Naming future
categories here exists only so that whichever is proposed next reuses this one
mechanism instead of a bespoke one.

## Consequences
- docs/44 §11's existing versioning/validation/migration policy (§11.4) becomes the
  Template Registry's general policy, not a `CheckInTemplate`-specific one — no new
  policy is invented, the existing one is applied more broadly.
- A future template category is scoped, at the time it is actually proposed, as a new
  registry entry plus its own batch approval — never as new architecture.
- Mirrors the Module Registry (ADR-012) and Calculator Registry (ADR-013) pattern
  exactly: each of the platform's three registries now governs a different question
  (module *exposure*, calculator *computation*, template *shape*) using the same
  general registry discipline, rather than three independently-invented mechanisms.
- No AI behavior is introduced by this ADR. The reserved AI-compatibility field is
  inert until a future, separately-approved feature explicitly uses it under
  ADR-001/004/005.

## Future Considerations
Which template categories beyond Daily Check-in are ever actually built, and in what
order, is not decided here — a product/roadmap question for a future phase, not an
architecture question this ADR resolves. If a genuine need for patient-side template
authoring ever emerges (a clear product-vision reversal from "doctors decide"), that
would require a new ADR that explicitly overturns this ADR's doctor-assignment clause —
never a silent extension of the "Doctor-created Templates" category to mean
patient-created.
