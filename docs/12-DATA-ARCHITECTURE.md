# Wise Homeopathy Data Architecture
## Version 2.0

Purpose: Define how data flows across the website and future patient ecosystem.

## Principles
- Single source of truth
- Minimal data collection
- Patient-owned journey

## Current Implementation
Google Sheets (via Google Apps Script as the backend API) is the platform's current
storage mechanism — a deliberate, cost-effective choice at pilot scale, **not a
product-level principle**. Per ADR-006 (docs/31-ADR-INDEX.md), every schema is
designed as if a migration to a real database is a certainty: flat, typed-by-
convention columns; a stable, permanent UUID primary key per record; no per-patient
tabs. This section states the current implementation; the "Future" section below
states the binding rule it must satisfy.

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

## Phase 2A — Report Upload Schema (Batch PA-5)

Closes this document's own long-open item (docs/29 §12's Documentation Impact table:
"Add the schema in §4 once built; reword 'Google Sheets as primary datastore' per
ADR-006"), for the Reports entity specifically — per
docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md §16 step 7's explicit call to close it as
part of this batch. Full plan: docs/29-PHASE-2A-TECHNICAL-PLAN.md §8. Source of truth
for the code: `apps-script/FoundationReports.gs` (see `apps-script/README.md`'s
"Phase 2A Patient Access modules — Batch PA-5" section for module detail).

**The first schema in this document whose data spans two independent storage
systems**, not one — a deliberate departure from every other row-in-one-Sheet schema
above, per this document's own "Future" rule ("design for migration... without changing
frontend APIs") still being honored: the metadata row is what would migrate to SQL; the
binary content's storage backend (Drive today) is already treated as swappable
(ADR-006), exactly like Sheets itself.

**Sheet:** `Reports` — one row per uploaded document, `record_id` (UUID) as the stable
primary key, metadata only. **Binary storage:** Google Drive, one fixed private folder
(never patient-partitioned by subfolder — access control is enforced at the application
layer, not by Drive folder boundaries, docs/42 §5), the Drive object named from
`record_id` alone, never the patient-supplied filename and never `patient_id`.

**Columns:** `record_id`, `patient_id`, `uploaded_at`, `file_name`, `drive_file_id`,
`mime_type`, `size_bytes`, `uploaded_by` — full detail and rationale per column in
`shared/schemas/report.schema.json`/`.md`.

**Endpoint:** the same shared Apps Script Web App `doPost` every Phase 2A route uses
(docs/29 §14 Decision 1), three new `foundation_action` values (`upload_report`,
`get_reports`, `download_report`) dispatched through `FoundationRouter.gs`. Every list/
download call re-derives `patient_id` from the session; `download_report` additionally
verifies the requested `record_id`'s own `patient_id` before ever touching Drive
(docs/40 Q3's pattern, extended to Drive content).

**Not yet documented here — a real, pre-existing gap this batch does not backfill.**
`Patients`, `ConsultationHistory`, and `SymptomLogs` (Foundation/PA-3/PA-4's own
schemas) remain undocumented in this file, a gap spanning the whole Phase 2A milestone
predating this batch — named here rather than silently left inconsistent, not fixed by
this batch (out of PA-5's own approved scope).
