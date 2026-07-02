# Phase 1.5 Apps Script — Consultation Summary Pipeline

Backend for docs/25-PHASE-1.5-TECHNICAL-PLAN.md. This directory is the
**canonical source** for the pipeline's Google Apps Script project. The
Apps Script editor is a deployment target only — never edit code there
and leave the repo out of sync; changes flow from here outward via
`clasp push` (or manual copy-paste as a fallback, see below).

## Status

**Batch 4A** — schema, validation, and Sheet-write layer. Complete.
**Batch 4B** — staff entry form (`/internal/consultation-summary.html`). Complete.
No AI summarization, no email sending, no patient login yet.
See docs/25 §9 for the batch sequence this project is built in.

## Module layout

Each file has one job. Nothing outside its own module should reach past
it — e.g. only `Sheets.gs` calls `SpreadsheetApp`.

| File | Responsibility |
|---|---|
| `appsscript.json` | Web App manifest: timezone, execution/access mode. |
| `Code.gs` | `doPost`/`doGet` entry points. Wires the other modules together (parse → sanitize → validate → persist → log); holds no business logic itself. |
| `Config.gs` | All environment-specific values: Sheet name, allowed condition slugs, field length limits. The only file that should change between test and production. |
| `Schema.gs` | The Sheet's column list (`SCHEMA_COLUMNS`), enum values (`REVIEW_STATUS`, `EMAIL_STATUS`), and `buildRow_()` to construct a full row from a validated submission. |
| `Validation.gs` | `validateSubmission_()` and `sanitizeText_()` — all input validation/sanitization happens here, before anything touches a module further down the chain. |
| `Sheets.gs` | The only module that calls `SpreadsheetApp`. Creates the sheet/header if missing, refuses to write if the live header has drifted from `Schema.gs`. |
| `Logger.gs` | `logEvent_()` — thin wrapper around the Apps Script execution log for pipeline-stage audit events. |
| `Utils.gs` | Small stateless helpers (currently: `jsonResponse_()`). No dependency on any other module. |
| `Tests.gs` | Manual unit tests for pure logic (`Validation.gs`). Run `runAllTests_()` from the Apps Script editor; no live Sheet or network calls. |
| `sample-payloads/` | Example `doPost` bodies for manual/curl testing — one valid, and a few that should each fail validation for a specific reason. |

## Request flow (Batch 4A)

```
doPost(e)
  │
  ├─ JSON.parse(e.postData.contents)          [Code.gs]
  ├─ sanitizeText_(staff_submitted_note)       [Validation.gs]
  ├─ validateSubmission_(input)                [Validation.gs]
  │     └─ fails closed: any error → 400, nothing written, logged
  ├─ buildRow_(input)                          [Schema.gs]
  ├─ appendRow_(row)                           [Sheets.gs]
  │     └─ getSheet_() / ensureHeader_()       [Sheets.gs]
  └─ logEvent_('submitted', ...)               [Logger.gs]
```

Every request either returns `{ status: 200, record_id }` with a new row
written, or a `4xx`/`5xx` JSON error with **nothing** written to the
Sheet. There is no partial-write state.

## Sheet schema

Matches docs/25 §5.1 exactly. Batch 4A populates:

`record_id`, `created_at`, `condition_slug`, `staff_submitted_note`,
`patient_consent_confirmed`, `consent_confirmed_by`, `recipient_email`

and defaults the remaining columns (`ai_summary_draft`, `ai_model_used`,
`review_status = pending_review`, `reviewed_by`, `reviewed_at`,
`email_status = not_sent`, `email_sent_at`, `error_log`, `purged_at`) to
empty/default values, so the full schema exists from row one even though
later batches are what actually populate those columns.

## How later batches plug in

Nothing in Batch 4A needs to change shape for later batches — they
extend the same row and reuse the same modules:

- **4B (staff entry form)** — `/internal/consultation-summary.html`, a
  standalone static page (not part of the public site's nav/sitemap,
  `noindex`) that POSTs the shape in
  `sample-payloads/valid-submission.json` to this Web App's URL via
  `fetch` with `Content-Type: text/plain` (avoids a CORS preflight;
  `Code.gs` parses the body as JSON regardless of the declared
  content type). Client-side disables Submit until the consent
  checkbox is ticked, but that is a UX convenience only — the real,
  enforced gate is `Validation.gs`'s server-side check. Real access
  control is the Web App's Workspace-domain deployment restriction,
  not the page being unlisted.
- **4C (AI summarization)** — adds a call to OpenRouter inside
  `doPost`, after `appendRow_()` succeeds, writing `ai_summary_draft`
  and `ai_model_used` into the same row (likely a new `Ai.gs` module,
  called from `Code.gs`, reusing `logEvent_()` for the `summarized`
  stage).
- **4D (doctor review + gated send)** — a new `Review.gs`/`Send.gs`
  module reading `review_status` and `patient_consent_confirmed` off
  existing rows; both are already captured by 4A, so the gate has real
  data to check from day one.
- **4E (email template + delivery)** — a new `Email.gs` module called
  only after 4D's gates pass; writes `email_status`/`email_sent_at`
  onto the same row.
- **4F (retention purge)** — a new time-driven trigger function
  (likely `Retention.gs`) that reads `email_sent_at` off existing rows
  and clears `recipient_email`, stamping `purged_at`.

`Sheets.gs`'s header-drift check means every later batch's writes are
validated against the same `SCHEMA_COLUMNS` list — if a later batch
tries to write a column that doesn't exist in `Schema.gs`, it fails
loudly instead of silently misaligning columns.

## Deployment

This project has no npm dependencies and is not built/bundled — the
`.gs` files here are pushed to Apps Script as-is.

### Option A — clasp (recommended)

1. `npm install -g @google/clasp` (one-time, local machine).
2. `clasp login` (authenticates with a clinic Google Workspace account).
3. Create the Apps Script project once: `clasp create --type webapp --title "Phase 1.5 Consultation Summaries" --rootDir ./apps-script`, or `clasp clone <scriptId>` if the project already exists.
4. Copy `.clasp.json.example` to `.clasp.json` and fill in the real `scriptId` (`.clasp.json` is intentionally not committed — it's environment-specific).
5. `clasp push` from this directory to sync all files to the Apps Script project.
6. In the Apps Script editor, bind the project to the target Google Sheet (`Phase1.5_ConsultationSummaries` per `Config.gs`) via **Resources → Cloud Platform project** or by creating the script from within the Sheet's Extensions menu.
7. Deploy as a Web App: **Deploy → New deployment → Web app**. Set:
   - Execute as: **Me** (the deploying account) — matches `appsscript.json`'s `executeAs: USER_DEPLOYING`.
   - Who has access: **Anyone within [clinic Workspace domain]** — matches `appsscript.json`'s `access: DOMAIN`. This is the actual access control (docs/25 §9.1) — do not change to "Anyone."
8. Copy the deployed Web App URL (ends in `/exec`) into
   `/internal/consultation-summary.html`'s `WEB_APP_URL` constant,
   replacing the `REPLACE_WITH_DEPLOYED_WEB_APP_URL` placeholder. The
   form refuses to submit and shows an explicit message until this is
   set, so a not-yet-connected form fails loudly instead of silently.

### Option B — manual (no clasp)

Copy each `.gs` file's contents into a matching file in the Apps Script
editor (**File → New → Script file**, matching filenames), and paste
`appsscript.json`'s contents into the manifest via
**Project Settings → Show "appsscript.json"**. Slower and more
error-prone than clasp — use only if clasp isn't available.

### Testing before real use

1. Bind against a **test** Sheet/Apps Script project first (docs/25 §7:
   "Environment separation") — never point Batch 4A at a production
   Sheet before it's validated.
2. Run `runAllTests_()` from the Apps Script editor to check pure
   validation logic.
3. Use **Run → Test deployment** (or `curl` against the deployed test
   Web App URL) with each file in `sample-payloads/` and confirm the
   **JSON body's `status` field** (not the transport-level HTTP status,
   which Apps Script Web Apps always report as 200 — see `Utils.gs`):
   - `valid-submission.json` → body `status: 200`, one new row.
   - `missing-consent.json` → body `status: 400`, no row written.
   - `invalid-condition-slug.json` → body `status: 400`, no row written.
   - `malformed-json.txt` → body `status: 400`, no row written.
4. With the Web App URL filled into `/internal/consultation-summary.html`
   (step 8 above), load that page while signed in to a clinic Workspace
   account and submit the form once with synthetic data — confirm a row
   appears in the test Sheet and the page shows the returned `record_id`.
   Then sign out (or use a private/incognito window with a non-Workspace
   account) and confirm the request fails instead of writing a row —
   this is the actual verification that domain-restricted access works,
   not just that the form renders.
5. Only after all of the above pass should this be pointed at a real
   Sheet — and even then, no email or AI step exists yet, so there is
   no patient-facing risk regardless.

## Explicitly out of scope so far

No AI summarization, no email sending, no doctor review/approve UI, no
retention purge, no patient login. See docs/25-PHASE-1.5-TECHNICAL-PLAN.md
§9 for the full batch sequence.
