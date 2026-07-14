# ADR-028: The Digital Twin / AI Summary Is a Patient-Facing AI Narrative That Requires Doctor Approval Before the Patient Ever Sees It, and the Digital Twin View Itself Is Never a Stored Base Table

## Status
Accepted. Governs Phase 2D (Wise Digital Twin & AI Summaries,
docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md). Extends ADR-004 (Digital Twin never
diagnoses/treats), ADR-005 (AI always under doctor supervision), and ADR-022 (AI Assistant's
non-persisting-draft boundary) for the Digital Twin specifically; amends none of them.

## Context
Every prior AI feature on the platform is either doctor-facing (WPI-10 AI Assistant, WPI-11
Holoscan review — the doctor is both reviewer and recipient) or, where its output ultimately
reaches a patient, already gated by a mandatory doctor review before delivery (Phase 1.5's
Consultation Summary email: staff note → AI draft → `flagDrift_()` → doctor review
(`Review.gs`) → send only if `evaluateSendGate_()`'s live-re-checked approval passes).

Phase 2D's Digital Twin / AI Summary raises the stakes: it is the platform's **first
AI-generated content whose intended recipient is a patient, viewed directly in "My Health
Journey"** rather than emailed after a one-time review. Two questions must be settled before
any implementation, or the boundary will erode feature-by-feature (exactly the failure mode
ADR-004's own Context names — "a well-meaning 'insights' widget that starts suggesting next
steps"):

1. **Does a generated narrative ever reach a patient without a doctor approving it?** Left
   undecided, a future implementation could render a freshly-generated narrative straight into
   the patient's dashboard as a convenience — importing exactly the un-reviewed-AI-to-patient
   risk ADR-005 exists to prevent, and which Phase 1.5 deliberately engineered against.
2. **Is the Digital Twin a stored entity or a computed view?** docs/33 §3.5 and ADR-004
   already describe it as "a living health story… never a stored entity of its own, always a
   computed, read-only view." Storing a narrated aggregate as its own base table would create
   a drift surface and blur the line between the AI *artifact* (which must be reviewed) and the
   *view* (which is just recomputed data).

ADR-022 settled the analogous questions for AI Assistant, but its gate is *persistence through
a target entity's own write path* — appropriate for a doctor-facing tool where the doctor is
the recipient. The Digital Twin needs a gate on *patient visibility itself*, which ADR-022 does
not provide.

## Decision

1. **No Digital Twin narrative (`health_story` or `ai_summary`) is ever shown to a patient
   until a doctor approves it.** A generated narrative is held only in its own
   `DigitalTwinNarrative` row (`review_status: pending`, docs/59 §11.1) and the reviewing
   doctor's screen. The patient read route (`get_health_story`) returns **only**
   `approved`/`edited_and_approved` narratives' `published_output`, enforced server-side — a
   `pending` or `rejected` narrative is never returned to a patient by any route.

2. **The doctor's review decision is the sole gate to patient visibility.** Via
   `review_digital_twin_narrative` the doctor records:
   - `approved` — the model's `ai_output` becomes the `published_output` the patient sees.
   - `edited_and_approved` — the doctor's own edited text becomes the `published_output`; the
     original `ai_output` is retained alongside (never overwritten) as an honest audit of what
     the model produced.
   - `rejected` — nothing is ever shown to the patient; the row is retained as an audit record.

   This is the direct continuation of Phase 1.5's `evaluateSendGate_()` discipline (ADR-005),
   applied to an aggregated narrative instead of a single consultation summary.

3. **The Digital Twin view and the Progress Analytics view are computed on read, never stored
   base tables** (ADR-004, docs/59 §6.1/§6.3), mirroring `Analytics.gs`'s own discipline. Only
   the AI narrative audit/decision/delivery record (`DigitalTwinNarrative`) and its
   doctor-approved `published_output` are persisted. The deterministic, non-AI Progress
   Analytics view carries no model output and therefore needs no review gate — it is served
   directly to the patient.

This ADR does not:
- Prohibit a future, separately-approved UX refinement (e.g., a doctor "approve all pending for
  this patient" batch action) provided each narrative still receives an explicit doctor
  approval before the patient sees it — the same carve-out ADR-022 grants AI Assistant.
- Change what ADR-004/ADR-005/ADR-022 require of any other feature.

## Consequences
- The patient never receives un-reviewed model output — the platform's core trust guarantee
  (docs/21's "AI assists, doctors decide"), preserved for its first patient-facing AI feature.
- Every generated narrative costs the doctor one explicit review action before it becomes
  visible — accepted friction, the identical cost Phase 1.5's Consultation Summary already
  carries and ADR-005 already accepts.
- The static-analysis rule docs/55 §18 item 1 / docs/56 §23 item 1 required for the prior AI
  features is required again here (docs/59 §18 item 1): no `DigitalTwin*.gs` file may write any
  entity's Sheet beyond `DigitalTwinNarrative` — this ADR's guarantee must be a code-level fact,
  not merely a documented intention.
- Keeping the Digital Twin a computed view means a corrected upstream record (e.g., a
  superseded Care Plan version) is reflected on the next recompute with no stored-narrative
  migration — though an already-*approved* narrative remains as authored (an honest record of
  what was reviewed and shown at that time).

## Future Considerations
If, in real use, per-narrative review proves too costly, a future separately-approved ADR may
consider a tighter batch-review UX — but never an auto-approval that removes the doctor's
explicit gate, which is the one thing this ADR exists to protect. A future real Knowledge
Engine (ADR-029's own Future Considerations) would broaden what a narrative may draw on, but
not weaken this review gate.
