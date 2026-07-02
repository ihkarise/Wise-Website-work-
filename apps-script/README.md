# Phase 1.5 Apps Script — Consultation Summary Pipeline

Backend for docs/25-PHASE-1.5-TECHNICAL-PLAN.md. This directory is the
**canonical source** for the pipeline's Google Apps Script project. The
Apps Script editor is a deployment target only — never edit code there
and leave the repo out of sync; changes flow from here outward via
`clasp push` (or manual copy-paste as a fallback, see below).

## Status

**Batch 4A** — schema, validation, and Sheet-write layer. Complete.
**Batch 4B** — staff entry form (`/internal/consultation-summary.html`). Complete.
**Batch 4C** — AI summarization (normalization only). Complete.
**Batch 4D** — doctor review checkpoint + gated send decision. Complete.
No email delivery yet (the send gate is proven, but nothing calls
MailApp/GmailApp until Batch 4E), no patient login.
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
| `Sheets.gs` | The only module that calls `SpreadsheetApp`. Creates the sheet/header if missing, refuses to write if the live header has drifted from `Schema.gs`. `updateRowByRecordId_()` patches specific columns on an already-written row; `getRowObjectByRowIndex_()` reads one row's live values back as an object. Used by the AI step and every later batch. |
| `Ai.gs` | The AI summarization step. A **normalization layer, not a content-generation layer** — see "AI boundaries" below. Calls OpenRouter, then runs a code-level drift check (`flagDrift_()`) independent of the prompt. Its prompt text implements `PROMPTS.md`, the canonical prompt specification — see below. |
| `PROMPTS.md` | Version-controlled specification for `Ai.gs`'s prompt: purpose, inputs/outputs, safety rules, forbidden behaviours, traceability principles, future evolution notes. Not loaded at runtime — this is documentation the prompt must match, not a template Apps Script reads. |
| `Review.gs` | The doctor review checkpoint. A Sheet-bound custom menu (`onOpen()` — must keep that exact name, it's an Apps Script simple trigger), not a Web App page. Approve/reject writes `review_status`/`reviewed_by`/`reviewed_at`, then checks the send gate on freshly re-read row data. |
| `Send.gs` | `evaluateSendGate_(row)` — the single choke point every future send path must pass through. Hard-checks `patient_consent_confirmed === true` and `review_status` is an approved state, reading live Sheet values, not assumptions carried over from submission time. |
| `Logger.gs` | `logEvent_()` — thin wrapper around the Apps Script execution log for pipeline-stage audit events. |
| `Utils.gs` | Small stateless helpers (currently: `jsonResponse_()`). No dependency on any other module. |
| `Tests.gs` | Manual unit tests for pure logic (`Validation.gs`, `Ai.gs`'s `flagDrift_()`, `Send.gs`'s `evaluateSendGate_()`). Run `runAllTests_()` from the Apps Script editor; no live Sheet or network calls. |
| `sample-payloads/` | Example `doPost` bodies for manual/curl testing — one valid, and a few that should each fail validation for a specific reason. |

## Request flow

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
  ├─ logEvent_('submitted', ...)               [Logger.gs]
  ├─ summarizeNote_(note)                      [Ai.gs]
  │     ├─ callOpenRouterSummary_(note)        [Ai.gs]
  │     └─ flagDrift_(note, summary)           [Ai.gs]
  └─ updateRowByRecordId_(id, ai fields)       [Sheets.gs]
```

The submission (steps 1-6) either returns `{ status: 200, record_id }`
with a new row written, or a `4xx`/`5xx` JSON error with **nothing**
written to the Sheet — no partial-write state. The AI step (7-8) always
runs synchronously after a successful write (docs/25 §9.5) but can never
undo it: if OpenRouter fails, the row still exists with an empty
`ai_summary_draft` and the failure logged to `error_log`, and the
response still reports `{ status: 200, ai_summary_generated: false }` —
a doctor can write the summary manually rather than losing the
submission.

## AI boundaries (Batch 4C)

Full specification: **`apps-script/PROMPTS.md`** — the canonical,
version-controlled source of truth for the prompt's purpose, inputs/
outputs, safety rules, forbidden behaviours, and traceability
principles. `Ai.gs`'s `SUMMARY_SYSTEM_PROMPT_` implements that spec; if
they ever disagree, `PROMPTS.md` wins. Summary below:

`Ai.gs` is a **normalization layer, not a content-generation layer**. It
may only rephrase `staff_submitted_note` into plain language; it must
never add a diagnosis, recommendation, investigation, medicine,
reassurance, or conclusion that isn't already in the note, and every
output sentence must be traceable back to something the doctor actually
wrote (docs/25 §6). This is enforced two ways, deliberately independent
of each other:

1. **`SUMMARY_SYSTEM_PROMPT_`** — instructs the model, in explicit
   numbered rules, to normalize only: no diagnosis, no recommendation,
   no investigation, no medicine, no reassurance, no conclusion, no
   inference, omit rather than guess.
2. **`flagDrift_(note, summary)`** — a code-level check that does not
   trust the prompt was followed. It (a) scans the summary for phrases
   from a small lexicon signaling each prohibited category (e.g.
   "recommend", "diagnosed with", "prescribe") that don't also appear in
   the source note, and (b) computes a per-sentence word-overlap ratio
   against the note's vocabulary, flagging any sentence that falls below
   `CONFIG.AI.SENTENCE_TRACEABILITY_MIN_OVERLAP` (0.3) as low-traceability.

Flags never block the draft from being written or auto-reject it — there
is no send capability yet (email delivery is Batch 4E), so nothing can
reach a patient regardless. Flags are written into `error_log` prefixed
`AI_REVIEW_FLAGS:` so the doctor reviewer (Batch 4D, below) has something
concrete to check the draft against, not just a blank trust exercise.
This is a heuristic, not a proof — it catches recognizable drift patterns
and sentences with almost no vocabulary overlap with the source, not
every possible fabrication.

## Review workflow (Batch 4D)

Doctor review is **Sheet-bound**, not a Web App page — docs/25 §5.2
explicitly allows "Sheet-bound or minimal UI," and for a staff-paced,
one-row-at-a-time action, a custom menu inside the Sheet itself is
simpler and more auditable than a second HTML form. Opening the bound
Sheet adds a **Consultation Summaries** menu (`Review.gs`'s `onOpen()`)
with three actions, each operating on whichever row the doctor has
selected:

- **Approve selected row (as generated)** → `review_status = approved`
- **Approve selected row (I edited the draft)** → `review_status =
  edited_and_approved` — pick this if the doctor edited the
  `ai_summary_draft` cell directly in the Sheet before approving
- **Reject selected row** → `review_status = rejected`, no send attempt

`reviewed_by` is captured automatically from `Session.getActiveUser().getEmail()`
(the signed-in Workspace account with edit access to the Sheet), not a
free-text field — the same identity space as `consent_confirmed_by`.
`reviewed_at` is stamped by Apps Script, not client-supplied.

After approval, `reviewSelectedRow_()` re-reads the row (not the values
it started with) and runs it through `Send.gs`'s `evaluateSendGate_()` —
so a manual edit to `patient_consent_confirmed` made directly in the
Sheet between submission and review is still caught, not just the value
that was true at submission time (docs/25 §6, §9.2). **This batch proves
the gate is enforced correctly; it does not call MailApp/GmailApp.** A
passing gate currently just confirms readiness and logs it — Batch 4E is
what turns that into an actual email.

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
- **4C (AI summarization)** — complete. `Ai.gs`, called from `Code.gs`
  after `appendRow_()` succeeds, writes `ai_summary_draft`,
  `ai_model_used`, and any `flagDrift_()` findings (in `error_log`) back
  onto the same row via `Sheets.gs`'s `updateRowByRecordId_()`. Prompt
  specified in `PROMPTS.md`. See "AI boundaries" above.
- **4D (doctor review + gated send)** — complete. `Review.gs` is a
  Sheet-bound custom menu (docs/25 §5.2's "Sheet-bound or minimal UI"
  allowance) writing `review_status`/`reviewed_by`/`reviewed_at`.
  `Send.gs`'s `evaluateSendGate_()` reads live `review_status` and
  `patient_consent_confirmed` off the row — both already captured by 4A
  — so the gate has real data to check from day one. This batch proves
  the gate fails closed; it does not yet call MailApp/GmailApp.
- **4E (email template + delivery)** — a new `Email.gs` module, called
  only when `evaluateSendGate_()` returns `canSend: true`, that builds
  the patient-facing HTML template (docs/25 §9.6) and performs the
  actual send, writing `email_status`/`email_sent_at` onto the same row.
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
9. Set the OpenRouter API key: Apps Script editor → **Project Settings →
   Script Properties → Add script property**, key `OPENROUTER_API_KEY`,
   value your OpenRouter key. `Ai.gs` reads it from
   `PropertiesService` at call time — it is never written to any file in
   this repo. Without it, submissions still succeed and write a row;
   `ai_summary_draft` is just left empty with the failure logged to
   `error_log` (see "AI boundaries" above).

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
5. With `OPENROUTER_API_KEY` set (step 9 above), submit again and
   confirm `ai_summary_draft`/`ai_model_used` are populated on the row.
   Then temporarily remove or misname the property and submit once more
   — confirm the row still writes, `ai_summary_draft` stays empty, and
   `error_log` shows `AI_SUMMARY_FAILED: ...` (docs/25 §8.3's
   failure-path requirement). Restore the correct property afterward.
6. Submit a note containing an obvious drift trigger (e.g. include the
   word "recommend" in a way the model might echo back as its own
   recommendation) and confirm `error_log` shows an `AI_REVIEW_FLAGS:`
   entry — this is the one live-model check `Tests.gs`'s offline unit
   tests can't cover, since they call `flagDrift_()` directly rather
   than a real OpenRouter response.
7. Open the test Sheet directly (not the Apps Script editor) and confirm
   the **Consultation Summaries** menu appears — this only shows up if
   `Review.gs`'s `onOpen()` was deployed and the Sheet was reopened after
   deployment (simple triggers only fire on open, not retroactively).
8. Select a row with a populated `ai_summary_draft` and
   `patient_consent_confirmed = TRUE`, click **Approve selected row (as
   generated)**, and confirm: `review_status` becomes `approved`,
   `reviewed_by` is your own Workspace email (not a placeholder), and the
   alert reports the send gate passed.
9. On a *different* row, manually edit the `patient_consent_confirmed`
   cell to `FALSE` before approving — confirm the alert reports the gate
   blocked with `patient_consent_confirmed is not true`, proving the gate
   reads live values rather than trusting the row's state at submission
   time (docs/25 §6, §9.2).
10. Click **Reject selected row** on a row and confirm `review_status`
    becomes `rejected` and no gate-check alert appears.
11. Only after all of the above pass should this be pointed at a real
    Sheet — and even then, no email step exists yet (Batch 4E), so
    nothing can reach a patient regardless.

## Explicitly out of scope so far

No email sending, no retention purge, no patient login. See
docs/25-PHASE-1.5-TECHNICAL-PLAN.md §9 for the full batch sequence.
