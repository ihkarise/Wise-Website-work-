# AI Assistant Capability Registry

Explains `ai-assistant-capability-registry.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-10 (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md §11.2, ADR-021/022/023)

A fourth kind of registry, distinct from Module Registry (which *capability* a patient
sees), Doctor Module Registry (which *capability* a doctor sees), Calculator Registry
(which *computation* exists), and Template Registry (the *shape* of a form) — this one
governs which bounded AI Assistant action exists and, critically, what each one is
allowed to read (`context_sources`) and produce (`output_shape`). It is not itself a
Doctor Module Registry entry — `shared/constants/doctor-module-registry.json`'s own
`ai_assistant` entry (Batch WPI-10) is the doctor-facing on/off switch for the whole AI
Assistant card; this file is what that card, once enabled, offers as its fixed menu of
actions.

## Why a fourth registry, not a new field on an existing one

docs/53 §4 requires a genuinely new *kind* of registry-worthy concern to get its own ADR
rather than silently stretching an existing one — ADR-021/022/023 together already govern
this shape (`context_sources` enforces ADR-021's retrieval boundary; `target_entity_type`
is purely observational per ADR-022; the registry's own existence is reused, not
re-invented, from the same "availability, not enablement" pattern ADR-012/013/016/020
already established). No new ADR was required for the registry mechanism itself —
docs/55 §11.2 already specified this exact shape.

## Fixed menu, never a free-form prompt (docs/55 §7.1)

The doctor selects one `capability_key` from this list per invocation. There is no open
text box that becomes the entire prompt anywhere in this batch's scope — a deliberate,
disclosed restraint distinguishing a governed, auditable menu of bounded actions from a
materially harder-to-govern open chat surface. A future, separately-approved,
separately-ADR'd expansion toward free-form doctor questions is not precluded, but is not
what this registry or this batch builds.

## Seeded with one entry — a disclosed, implementation-time decision

docs/55 §11.2 names three illustrative capabilities and explicitly leaves "whether a
future WPI-10 batch ships zero or one seeded entry" as an implementation-time decision,
mirroring the exact "mechanism before any concrete instance" precedent
`calculator-registry.json` (ships empty) and `doctor-module-registry.json` (WPI-3 ships
empty, WPI-4 adds the first entry) already established. This batch registers exactly one:

- **`summarize_patient_status`** — reads `care_plan`, `check_in_response`,
  `calculator_result`, and `appointment` for one roster patient; produces `draft_text`;
  `target_entity_type: null` (a pure read/display capability — there is nothing for an
  accepted draft to be saved into, which makes it this registry's lowest-risk possible
  first entry: even the "one extra click to save" friction ADR-022 names doesn't apply,
  since there is no target entity for the doctor to navigate to).

**`draft_care_plan_note`** and **`flag_checkin_anomalies`** — the other two capabilities
docs/55 §11.2 names — remain unregistered. Each becomes real by a later, separately-
approved batch adding its own entry here, never a silent addition bundled into an
unrelated change (docs/53 §4).

## Entry shape (docs/55 §11.2)

Each row in `capabilities` is shaped: `capability_key` (stable slug), `display_name`
(doctor-facing label), `description` (doctor-facing explanation of what the capability
does and does not do), `context_sources` (explicit allow-list of entity types this
capability's Context Builder call may read — never "all"; `AssistantContextBuilder`
(`apps-script/AIAssistantContext.gs`) reads only what the invoked capability's own list
declares), `output_shape` (`draft_text` | `structured_flags` — constrains what
`AssistantDriftCheck_()` expects to parse), `target_entity_type` (nullable — which
existing entity's own write path an accepted draft would feed into, if any; purely
descriptive, enforces nothing by itself, ADR-022 is the actual enforcement),
`requires_knowledge_engine` (boolean, must be `false` for every entry in this freeze's
scope per ADR-021 — reserved for a future entry once a real Knowledge Engine exists),
`future_ai_capable` (boolean, always `false` here — this registry does not reserve
capability *for itself* to become more AI-capable than designed; it reserves the *other*
registries' own fields, unchanged, mirroring docs/55 §11.2's own explanation exactly).

## Validation rules (enforced by `apps-script/AIAssistantInteraction.gs`)

- `capability_key` submitted to `post_ai_assistant_query` must resolve to a real entry
  here — an unregistered or unknown key is rejected with `FOUNDATION_INVALID_INPUT`,
  the same fail-closed-by-absence discipline `calculator-registry.json`'s own empty
  seeding already established for its own consumer.
- `AssistantContextBuilder` reads only the entities the invoked capability's own
  `context_sources` names — a capability-bounded allow-list enforced in code
  (docs/55 §6, statically verified per docs/55 §18 item 4).

## Versioning

Version `1.0.0`. Adding a new capability (a new `capability_key` row) requires a new
version here first, then a subsequent update to `apps-script/AIAssistantContext.gs`'s
hand-ported copy — never the reverse, per `shared/README.md`.
