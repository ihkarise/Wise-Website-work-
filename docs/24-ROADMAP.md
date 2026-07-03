# 24 - Wise Product Roadmap
## Version 1.0

# Phase 1 — Public Website
Status: In Progress

Completed
- Documentation Framework
- Product Vision
- Website Audit
- Governance
- Batch 1
- Batch 2
- Batch 3 — Legal Pages

Remaining
- Dedicated Condition Pages
- Resources Hub
- Photography & Branding Assets

# Phase 1.5 — Platform Validation
Status: **Software Complete, Deployment Complete, Operationally Complete**
(Batches 4A-4H, plus live deployment on a free personal Google account —
`wisehomeopathicmc@gmail.com`, not Google Workspace; see docs/25's v1.3
deployment-account amendment). A real-patient pilot has been run and
reviewed by a doctor. Only docs/28's final governance sign-off
("Deployment approved") remains open — a clinic decision, not a technical
one. See docs/25 §10 (Definition of Done), docs/26 (validation report),
docs/27 (closeout), docs/28 (deployment checklist).

Completed
- Batch 4A — Sheet schema, Apps Script project skeleton, validation layer,
  audit logging, Sheet-write layer (no AI, no email, no public UI)
- Batch 4B — Staff entry form (`/internal/consultation-summary.html`),
  Workspace-domain-restricted, hard-gated consent checkbox
- Batch 4C — OpenRouter AI summarization step (normalization only,
  code-level drift flagging independent of the prompt)
- Batch 4D — Doctor review checkpoint (Sheet-bound custom menu) + gated
  send decision (`evaluateSendGate_`)
- Batch 4E — HTML email template + delivery (`Email.gs`, MailApp only),
  layered behind `Send.gs` so the gate stays independent of the provider
- Batch 4F — Automated 14-day retention purge (`Retention.gs`), fully
  independent of Review.gs/Send.gs/Email.gs, clears only
  `recipient_email` + stamps `purged_at`
- Batch 4G — Validation phase. No code changes to `apps-script/`. Built
  `validation/phase-1-5/` — a Node harness that runs the real committed
  source through every pipeline stage and the full end-to-end workflow,
  including every required failure mode. 37/37 checks passed. See
  docs/25 §10/§11 for exactly which Definition-of-Done items this closes
  versus which remain open pending a live Google Workspace deployment
  (Workspace-domain access, a real OpenRouter/MailApp call, the live
  retention trigger firing on schedule, and the required real-patient
  pilot).
- Batch 4H — Documentation, validation closeout, and project
  synchronization only. No code changes anywhere. Closed a documentation
  gap (docs/15 never got its promised Phase-1.5 security notes), and
  added docs/26 (validation report), docs/27 (official closeout), and
  docs/28 (deployment readiness checklist) — the formal end of the
  Phase 1.5 implementation sequence.

Remaining
- docs/28's final governance sign-off ("Deployment approved") — a clinic
  decision, not further code or deployment work.

# Phase 2A — My Health Journey v1
Status: Architecture approved (docs/29-PHASE-2A-TECHNICAL-PLAN.md,
docs/30-ARCHITECTURE-PRINCIPLES.md, docs/31-ADR-INDEX.md,
docs/33-DOMAIN-MODEL.md, docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md).
Implementation in progress — Foundation batches F1 (scaffolding), F2
(shared contracts + utilities), F3 (data layer + Patient Identity), F4
(session issuance/verification + route protection), and F5 (schema-
validator-based conformance testing) shipped — the full F1–F5 Foundation
Implementation Plan is now complete and frozen except for bug fixes.
See docs/29 §14 for batch-by-batch implementation notes and
docs/35-FOUNDATION-CLOSEOUT.md for the closeout summary and next-phase
entry criteria.

Identity & Access backend, split into two independent batches (docs/29
§15), is now complete and **frozen except for bug fixes**: IA-1
(infrastructure only — LoginToken generation, hashing, expiration,
single-use enforcement) and IA-2 (the magic-link request/consume flow,
rate limiting, account-enumeration protection, and Foundation's first
authenticated Web App route, `get_profile`) both shipped. See docs/29
§14/§15 for full batch-by-batch detail and
docs/36-IDENTITY-AND-ACCESS-CLOSEOUT.md for the closeout summary and
Patient Access entry criteria.

**Patient Access is the active milestone.** Batch PA-1 — `login.html` +
`verify.html`, the frontend half of docs/29 §13's original Batch 5B —
shipped. Batch PA-2 — the `assets/site.css` token extraction and the
`/my-health-journey/` dashboard shell (docs/29 §13 Batch 5C), wired to
PA-1's session — has also now shipped. Zero backend modification across
either batch; Identity & Access remains frozen except for bug fixes. See
docs/29 §16 for full implementation notes and docs/37 for the pre-PA-2
readiness review. Next: Batch PA-3 (docs/29 §13 Batch 5D) — the
`ConsultationHistory` sheet, a staff entry tool, and the patient-facing
read-only Timeline/Consultation History, which turns the dashboard's
Timeline card from an empty state into real data. Not yet started;
approval required before it begins.

- Patient Login (passwordless, ADR-003)
- Dashboard shell
- Health Timeline (read-only)
- Consultation History
- Symptom Tracker v1
- Report Upload

Reconciled with docs/09-PHASE-2-ARCHITECTURE.md's roadmap per
docs/32-ARCHITECTURE-REVIEW.md Part 2 — Personal Care Plan is no longer
grouped into Phase 2A; it did not have a designed architecture and is
moved to its own phase below. Batch-level sequencing (5A–5H): docs/29 §13.

# Phase 2B — Personal Care Plan
Requires its own architecture-freeze pass (a technical plan and any new
ADRs it needs) before implementation begins — no technical plan exists
yet, per docs/32's recommendation.

# Phase 2C — Health Milestones
- Scheduled progress reviews (30/90 days, 6 months, 1 year, per docs/21)
- No AI required — deliberately separated from Phase 2D, which carries the
  platform's AI-supervised work

# Phase 2D — Wise Digital Twin & AI Summaries
- Health Story
- AI Summaries
- Progress Analytics

Requires the full ADR-001/ADR-004/ADR-005 AI-supervision pattern before
any implementation begins.

# Phase 3 — WiseOS
- Doctor Dashboard
- Inventory
- PillFill Integration
- Holoscan
- AI Assistant
- Analytics

# Guiding Principle
Every roadmap item should support the North Star:

'Build the world's most trusted continuous digital homeopathy care platform.'
