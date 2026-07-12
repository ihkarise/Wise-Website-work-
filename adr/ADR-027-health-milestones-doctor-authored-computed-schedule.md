# ADR-027: Health Milestones Are Doctor-Authored Reviews on a Deterministically-Computed Schedule, Never AI-Generated or Auto-Inferred

## Status
Accepted. Governs Phase 2C (Health Milestones,
docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md). Extends ADR-004 (Digital Twin
never generates diagnosis or treatment) and ADR-005 (AI always under doctor supervision) by
keeping Phase 2C entirely outside AI, and follows Analytics' (WPI-9) and the Digital Twin's
(docs/33 §3.5) established "computed view, never a stored base table" precedent; amends none of
them.

## Context
docs/24-ROADMAP.md deliberately split the patient-progress work into two phases: **Phase 2C —
Health Milestones** ("Scheduled progress reviews… No AI required — deliberately separated from
Phase 2D, which carries the platform's AI-supervised work") and **Phase 2D — Wise Digital Twin
& AI Summaries** ("Requires the full ADR-001/ADR-004/ADR-005 AI-supervision pattern before any
implementation begins"). docs/33 §3.5 records the same separation from the Digital Twin's side:
Phase 2D is "deliberately separated from the non-AI Health Milestones work (Phase 2C) because
of its materially higher AI-safety requirements."

Two design questions in the Phase 2C freeze (docs/58) could, left unrecorded, quietly erode
that separation and the platform's computed-view discipline:

1. **Could a milestone review be auto-generated?** docs/21 lists the six review dimensions
   (progress, improvements, medicines, investigations, recommendations, next goals). A future
   implementer could reasonably think it "helpful" to auto-draft a review from the patient's
   Symptom Log / Check-In / Calculator history, or to narrate progress with a model. Doing so
   would import the exact AI-safety surface (ADR-001/004/005's three-part gate) that Phase 2C
   was created to avoid, collapsing the 2C/2D boundary and shipping AI-generated clinical-adjacent
   text under a phase that never provisioned for reviewing it.

2. **Should the milestone schedule be stored or computed?** The 30/90/180/365-day points are a
   pure function of a single care-start anchor date. Storing them as rows would create a drift
   surface (a corrected anchor would strand stale stored dates) for no benefit — while the
   platform already has two precedents, Analytics and the Digital Twin, for deriving such views
   on read rather than storing them.

The care-start anchor itself is a related, smaller decision (docs/58 §0.3/§6): no authoritative
"treatment start" date exists on the platform (Consultation is Conceptual; `Patient.created_at`
is onboarding, not clinical start), so the freeze introduces one small, doctor-set anchor
entity rather than overloading a frozen Foundation field. That is recorded in docs/58; this ADR
records the two boundary decisions above, which shape more than one feature or phase and so
warrant a permanent ADR per docs/30's "a decision that shapes more than one feature or phase
gets an ADR" test.

## Decision
Health Milestones (Phase 2C) is a **non-AI, doctor-authored** feature:

1. **No AI, ever.** Health Milestones generates no AI content, makes no model or outbound API
   call, and produces no auto-written narrative of any kind. Every field of a milestone review
   is typed by a roster-scoped doctor. There is no prompt, no model draft, no drift check, and
   no lexicon check, because there is no AI output to constrain, check, or review. This boundary
   is enforced not only as documentation but as a code-level static-analysis rule (docs/58 §23
   item 1): no `Milestone*.gs` file may call `UrlFetchApp`, a model helper, or any AI-Assistant/
   Holoscan function.

2. **No auto-inference of review content.** A review is never auto-populated or inferred from
   Symptom Log, Check-In Response, Calculator Result, Care Plan, or any other data. A future,
   separately-approved batch may *display* such data beside the authoring form as read-only
   reference to reduce the doctor's lookup effort, but the review text remains the doctor's own
   authored words (docs/58 §5 item 2, §12.5).

3. **The schedule is a computed view, never a stored entity.** The four milestone points and
   their target dates are a pure, deterministic function of a single doctor-set
   `MilestoneTrack.care_start_date`, recomputed on every read — never stored as rows, never
   allowed to drift — mirroring Analytics' and the Digital Twin's own computed-view discipline
   exactly (docs/58 §7).

4. **No status is inferred from time alone.** A milestone point's `upcoming`/`due`/`overdue`
   state is a presentational computation only; a point is `completed` **only** when a doctor has
   published a review for it, never merely because its date has passed (docs/58 §5 item 3, §7).

This ADR does not:
- Change what ADR-001/ADR-004/ADR-005 require of any AI feature (WPI-10 AI Assistant, WPI-11
  Holoscan, the future Phase 2D Digital Twin) — those remain fully bound by the three-part gate;
  Phase 2C simply never enters it.
- Prohibit Phase 2D, or any other separately-approved future work, from later *reading* a
  published milestone review as one input to its own AI-narrated, fully-gated output (docs/58
  §12.4) — a published review is exactly the kind of clean, doctor-owned input Phase 2D can
  narrate under its own gate.
- Fix the care-start anchor's own detailed shape, the schedule's grace window, or the
  post-publish correction discipline — those are docs/58's and the implementation batch's
  concern, disclosed there (docs/58 §22).

## Consequences
- Phase 2C ships with a strictly smaller attack and safety surface than any AI feature on the
  platform: no model call, no API key, no outbound request, no AI-output review gate.
- The Phase 2C / Phase 2D boundary is now a permanent, named, statically-enforced fact — a
  future "auto-drafted milestone narrative" is not an incremental convenience but a deliberate
  ADR-superseding decision requiring the full AI gate, which is precisely the friction this ADR
  exists to create.
- The milestone schedule cannot drift, because it stores nothing — every read is a faithful
  recomputation from the anchor and the existing published reviews, the same guarantee
  Analytics' recompute-on-read model already provides.
- The Doctor Module Registry's `milestone_review` entry follows the platform's **normal**
  fail-closed-by-absence rollout (ADR-010/020), **not** the disabled-by-default posture of
  `ai_assistant` (ADR-023) or `holoscan_review` (ADR-026) — because it reviews doctor-authored
  content, never model output, there is no model-output-review risk to gate more tightly
  (docs/58 §18.2). This ADR records why that lighter posture is correct here, so the contrast
  is deliberate rather than an inconsistency.

## Future Considerations
If, in real use, doctors want authoring assistance, a future separately-approved ADR may
consider a data-assisted authoring aid (read-only reference data beside the form) or, as a
distinct and heavier step, an AI-drafted review — but the latter would move that capability out
of Phase 2C's non-AI boundary and into the full ADR-001/004/005 gate (effectively Phase 2D
territory), and this ADR pre-approves neither. Phase 2D's Digital Twin remains the designated
home for any AI-narrated health story, unaffected by this decision.
