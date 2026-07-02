# Wise Homeopathy Data Architecture
## Version 2.0

Purpose: Define how data flows across the website and future patient ecosystem.

## Principles
- Single source of truth
- Minimal data collection
- Patient-owned journey
- Google Sheets as primary datastore
- Google Apps Script as backend API

## Phase 1
Public website:
- Contact forms
- Consultation requests
- Newsletter
- Analytics

## Phase 2
Patient records:
- Patient ID
- Timeline
- Personal Care Plan
- Symptom Tracker
- AI Summaries

## Data Flow
Website → Apps Script → Google Sheets → AI (when needed) → Patient View

## Future
Design for migration to SQL without changing frontend APIs.

## Phase 1.5 — Implemented Schema (Batch 4A)

The first real implementation of this document's "Website → Apps Script →
Google Sheets" pattern. Full plan: docs/25-PHASE-1.5-TECHNICAL-PLAN.md.
Source of truth for the code: `apps-script/` (see `apps-script/README.md`
for module layout and deployment).

**Sheet:** `Phase1.5_ConsultationSummaries` — one row per consultation,
`record_id` (UUID) as the stable primary key, designed to survive a future
SQL migration unchanged (flat columns, typed by convention, no per-patient
tabs), per this document's "Future" rule above.

**Endpoint:** a single Apps Script Web App `doPost`, deployed with access
restricted to the clinic's Google Workspace domain (not "anyone with the
link") — the only writer to the Sheet. Batch 4A validates and persists a
submission; it does not yet call the AI summarization step, gate a doctor
review, or send email — those are docs/25's Batches 4C–4F, layered onto the
same row without changing this schema.

**Columns:** `record_id`, `created_at`, `condition_slug`,
`staff_submitted_note`, `patient_consent_confirmed`, `consent_confirmed_by`,
`recipient_email`, `ai_summary_draft`, `ai_model_used`, `review_status`,
`reviewed_by`, `reviewed_at`, `email_status`, `email_sent_at`, `error_log`,
`purged_at` — full detail and rationale per column in docs/25 §5.1.

`condition_slug` reuses the condition anchor IDs already live on
`/conditions/` (`mcas`, `hashimotos-thyroiditis`, `chronic-urticaria`,
`eczema`, `allergic-rhinitis`, `eosinophilic-esophagitis`, `pots`,
`dermographism`) — confirms docs/20 §5's "the slug is the ID" decision.
