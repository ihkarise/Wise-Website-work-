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
Status: Implementation and code-level validation complete (Batches 4A-4G).
Live deployment + real-patient pilot still required before Phase 1.5 is
marked done and Phase 2A begins — see docs/25 §10.

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

Remaining
- Live deployment + the real-patient pilot required by docs/25 §10
  (not a numbered batch — a deployment/operations step for whoever runs
  this project against a real Google Workspace, tracked in docs/25 §10's
  checklist, not further code work)

# Phase 2A — My Health Journey
- Patient Login
- Dashboard
- Personal Care Plan
- Secure Data Storage

# Phase 2B — Patient Experience
- Symptom Tracker
- Progress Dashboard
- Timeline
- Document Vault
- Follow-up Center

# Phase 2C — Digital Twin
- Health Story
- AI Summaries
- Health Milestones
- Progress Analytics

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
