# AI Assistant Interaction

Explains `ai-assistant-interaction.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-10 (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md §11.1, ADR-021/022/023)

The platform's first AI feature aimed at a doctor rather than a patient. Every
`post_ai_assistant_query` invocation writes exactly one `AIAssistantInteraction` row —
the audit trail of what was asked, what context was assembled, what the model returned,
what the code-level drift check flagged, and what the doctor ultimately decided. This is
also the *only* place AI Assistant ever writes anything (ADR-022) — it never gains a
write path into `CarePlan`, `DoctorInstruction`, `Notification`, `Appointment`,
`InventoryItem`, `InventoryTransaction`, `PillFillOrder`, or any other clinical entity.

## Non-persisting draft, doctor approval (ADR-022) — this schema's central discipline

Every row is created with `doctor_decision: 'pending'`. The doctor's own screen shows the
`ai_output` and `ai_output_flags` alongside an un-dismissable "AI-generated draft — not
saved" banner. Calling `post_ai_assistant_decision` records the caller's one-way decision
transition (`accepted` / `edited_and_accepted` / `rejected` / `ignored`) on this row
**only** — it never itself persists anything into a target entity. If the doctor wants an
accepted draft to become real, they separately use that target entity's own existing,
already-authenticated write path (e.g. `CarePlan.gs`'s own authoring function) — AI
Assistant only prefilled what the doctor would otherwise have typed by hand.
`target_entity_type`/`target_entity_id` are purely observational fields the doctor may
optionally supply, after the fact, at decision time — never a live foreign key AI
Assistant enforces or resolves itself.

## Retrieval boundary (ADR-021)

`context_snapshot` is assembled exclusively from the calling doctor's own roster- and
specialty-scoped slice of already-stored, structured platform data (Care Plans, Doctor
Instructions, Check-In Responses, Calculator Results, Inventory, PillFill Orders,
Appointments, Analytics' own computed sections) — never an unstructured knowledge base.
Every field is a literal value copied from an existing entity; nothing is paraphrased or
interpreted before it reaches the prompt step (`apps-script/AIAssistantContext.gs`).

## JSON storage policy (docs/44 §11.4, this schema's third use)

`context_snapshot` (object) and `ai_output_flags` (array) are both stored as JSON-encoded
strings in the underlying Sheet cell, exactly the same disclosed exception to ADR-006's
flat-column convention `CheckInResponse.answers` and `CalculatorResult.input_snapshot`
already established. `apps-script/AIAssistantInteraction.gs`'s own row-to-API-shape
conversion always parses both back into their real object/array shape before returning a
record to any caller — this schema is the entity's real, contractual shape
(`shared/README.md`'s "Contract vs. implementation-only detail"), not the Sheet's own
storage encoding.

## Append-only except one transition

Every row is inserted once, with `doctor_decision: 'pending'`, `decision_notes`/
`target_entity_type`/`target_entity_id`/`decided_at` all empty-string sentinels. Exactly
one later `foundationDsUpdateById_()` call may ever patch a row — the single
`doctor_decision`/`decision_notes`/`target_entity_type`/`target_entity_id`/`decided_at`
transition away from `pending` — mirroring `Appointment`'s and `DoctorInstruction`'s own
one-way lifecycle discipline exactly, applied here to a decision instead of a status.
`context_snapshot`, `ai_output`, `ai_output_flags`, `prompt_template_version`, and `model`
are never patched after creation — the row's own record of what was actually asked and
returned stays permanent.

## Rate limiting

Every `post_ai_assistant_query` call is bounded by a per-doctor, per-UTC-day invocation
ceiling (docs/55 §10 names this as a required, implementation-time-decided mechanism).
This batch implements it via `CacheService`, mirroring `FoundationRateLimit.gs`'s own
"an ephemeral counter, not a Sheet-backed row, is the correct pilot-scale choice" pattern
exactly, rather than docs/55 §10's own alternative suggestion of a Sheet-backed daily
counter row — a disclosed, implementation-time decision docs/55 §10/§17 explicitly leaves
open. See `apps-script/AIAssistantInteraction.gs`'s own header comment for the exact
budget and the deliberate fail-open-on-CacheService-error behavior (a supplementary
cost-control mechanic, not this feature's actual security boundary — fail-closed
enablement, roster scoping, and DoctorSession authentication remain the real boundaries).

## Validation rules (enforced by `apps-script/AIAssistantInteraction.gs`)

- `doctor_id`: always DoctorSession-derived — never client-supplied.
- `patient_id`: when supplied by the caller, must belong to the calling doctor's own
  derived roster (`DoctorPatientRoster.gs`, reused) — rejected before any context is
  assembled, never silently filtered after the fact (docs/55 §6).
- `capability_key`: required; must resolve to a real, registered
  `ai-assistant-capability-registry.json` entry.
- The `ai_assistant` Doctor Module Registry entry and the calling doctor's own
  `DoctorModuleState` row for it must both exist and be enabled — fail-closed by absence
  (ADR-010), and disabled by default even once registered (ADR-023) — no bulk-enablement
  path exists anywhere in this batch.
- The per-doctor, per-UTC-day rate limit must not already be exhausted.
- `doctor_decision` transitions exactly once, away from `pending` only, via
  `post_ai_assistant_decision` — an unknown `interaction_id`, one not owned by the calling
  doctor, or one already decided is rejected with `FOUNDATION_INVALID_INPUT`.

All rejections are `FOUNDATION_INVALID_INPUT` or `FOUNDATION_UNAUTHORIZED` as appropriate,
returned directly, the same convention every other Foundation entity's input validation
already follows.

## Versioning

Version `1.0.0`.
