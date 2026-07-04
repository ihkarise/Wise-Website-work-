# Phase 1.5 Apps Script — Consultation Summary Pipeline

Backend for docs/25-PHASE-1.5-TECHNICAL-PLAN.md. This directory is the
**canonical source** for the pipeline's Google Apps Script project. The
Apps Script editor is a deployment target only — never edit code there
and leave the repo out of sync; changes flow from here outward via
`clasp push` (or manual copy-paste as a fallback, see below).

## Status

**Batches 4A–4G are all complete.** Software is done; this project has
not yet been deployed to a live Google Workspace. See:

- **docs/26-PHASE-1.5-VALIDATION-REPORT.md** — what was validated, how,
  and the results (37/37 checks passed against the real committed
  source, via `validation/phase-1-5/`).
- **docs/27-PHASE-1.5-CLOSEOUT.md** — the official Phase 1.5 closeout:
  objectives, deliverables, architecture, lessons learned.
- **docs/28-DEPLOYMENT-READINESS.md** — the operational checklist for
  whoever deploys this project for real (Workspace setup, clasp push,
  API keys, live trigger install, real-patient pilot approval).

No patient login exists anywhere in this project, by design. See
docs/25 §9 for the batch sequence this project was built in, and docs/25
§10 for the full Definition of Done (software items are checked; live
deployment items are not — that distinction matters and is preserved
throughout these docs).

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
| `Auth.gs` | `verifyAccessCode_()` — the application-level access gate for the Web App endpoint. Replaces Google Workspace's domain-restricted deployment access (not available on a personal Google account) with a shared secret checked on every request, before anything else runs. See "Access control" below. |
| `Sheets.gs` | The only module that calls `SpreadsheetApp`. Creates the sheet/header if missing, refuses to write if the live header has drifted from `Schema.gs`. `updateRowByRecordId_()` patches specific columns on an already-written row; `getRowObjectByRowIndex_()` reads one row's live values back as an object; `getAllRowObjects_()` batch-reads every data row, used only by `Retention.gs`. |
| `Ai.gs` | The AI summarization step. A **normalization layer, not a content-generation layer** — see "AI boundaries" below. Calls OpenRouter, then runs a code-level drift check (`flagDrift_()`) independent of the prompt. Its prompt text implements `PROMPTS.md`, the canonical prompt specification — see below. |
| `PROMPTS.md` | Version-controlled specification for `Ai.gs`'s prompt: purpose, inputs/outputs, safety rules, forbidden behaviours, traceability principles, future evolution notes. Not loaded at runtime — this is documentation the prompt must match, not a template Apps Script reads. |
| `Review.gs` | The doctor review checkpoint. A Sheet-bound custom menu (`onOpen()` — must keep that exact name, it's an Apps Script simple trigger), not a Web App page. Approve/reject writes `review_status`/`reviewed_by`/`reviewed_at`, then calls `Send.gs`'s `attemptSend_()` on freshly re-read row data. Never calls `Email.gs` or a mail provider directly. |
| `Send.gs` | `evaluateSendGate_(row)` — the single choke point every send path must pass through. Hard-checks `patient_consent_confirmed === true` and `review_status` is an approved state, reading live Sheet values, not assumptions carried over from submission time. `attemptSend_(row)` orchestrates: gate → `Email.gs` → log the outcome back to the Sheet. **Never calls MailApp/GmailApp itself** — see "Email delivery layering" below. |
| `Email.gs` | The only module that calls a mail provider. `sendVisitSummaryEmail_(row)` builds the HTML template (`buildVisitSummaryEmail_()`) and calls `MailApp.sendEmail()`. Phase 1.5 uses MailApp only. |
| `Retention.gs` | Automated 14-day retention purge (docs/25 §9.3). Deliberately independent of `Review.gs`/`Send.gs`/`Email.gs` — never calls them, never called by them. Only ever writes `recipient_email`/`purged_at`. See "Retention purge" below. |
| `Logger.gs` | `logEvent_()` — thin wrapper around the Apps Script execution log for pipeline-stage audit events. |
| `Utils.gs` | Small stateless helpers: `jsonResponse_()`, `escapeHtml_()` (used by `Email.gs` to neutralize the AI draft before embedding it in HTML). No dependency on any other module. |
| `Tests.gs` | Manual unit tests for pure logic (`Validation.gs`, `Ai.gs`'s `flagDrift_()`, `Send.gs`'s `evaluateSendGate_()`, `Email.gs`'s `buildVisitSummaryEmail_()`, `Utils.gs`'s `escapeHtml_()`, `Retention.gs`'s `isEligibleForPurge_()`, `Auth.gs`'s `verifyAccessCode_()`). Run `runAllTests()` (the public wrapper — `runAllTests_()` itself is hidden from the editor's Run dropdown because of its trailing underscore, see "A note on trailing underscores" below) from the Apps Script editor; no live Sheet or network calls. `attemptSend_()`, `sendVisitSummaryEmail_()`, and `purgeExpiredRecipientEmails_()` are deliberately NOT covered here — they touch a real Sheet (and, for the first two, a mail provider); see the manual test steps below. |
| `sample-payloads/` | Example `doPost` bodies for manual/curl testing — one valid, and a few that should each fail validation for a specific reason. |

## A note on trailing underscores

Every internal function in this project ends in `_` (e.g. `validateSubmission_`,
`purgeExpiredRecipientEmails_`) — Apps Script's naming convention for
"private, not meant to be called directly by a person." One consequence:
**the Apps Script editor's Run/function-picker dropdown hides any function
whose name ends in `_`** — it will never appear there, no matter how
correctly it's defined. This is a UI-only restriction (it doesn't affect
custom-menu items or time-driven triggers, which can call underscored
functions just fine); it only blocks manually selecting one from the
dropdown and clicking Run.

Three functions in this project are meant to be run manually from that
dropdown during setup/testing, so each has a public, no-underscore wrapper
that simply calls the real one:

| Use this from the dropdown | Calls |
|---|---|
| `runAllTests()` | `runAllTests_()` (`Tests.gs`) |
| `installRetentionTrigger()` | `installRetentionTrigger_()` (`Retention.gs`) |
| `purgeExpiredRecipientEmails()` | `purgeExpiredRecipientEmails_()` (`Retention.gs`) |

The rest of this README refers to the underscored names when describing
what the code actually does internally, and the wrapper names when
describing what to click in the editor's dropdown.

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

## Access control (free personal Google account)

This project is deployed from a personal Google account
(`wisehomeopathicmc@gmail.com`), not Google Workspace. That changes exactly
one thing about the design: **how the staff entry point is locked down**.
Everything else — Google Sheets, Apps Script, Gmail delivery via `MailApp`,
Google Drive — is already free and unaffected by not having Workspace.

**Why this needed a real change, not just a wording change.** Apps Script
Web Apps have a deployment-time "who has access" setting. "Anyone within
[domain]" (`appsscript.json`'s old `access: DOMAIN`) is a Google Workspace
feature — it doesn't exist as an option for a Web App deployed from a
`@gmail.com` account, because a personal account isn't part of a Workspace
domain for Google to restrict access to. Deploying from a personal account
only offers "Anyone" (with or without requiring a Google sign-in).

**The free-tier replacement: an application-level shared access code.**
`appsscript.json`'s `access` is now `ANYONE_ANONYMOUS` (the Web App URL is
publicly reachable), and `Auth.gs`'s `verifyAccessCode_()` is checked as the
very first thing `doPost` does (`Code.gs`) — before parsing, sanitizing, or
writing anything. Every submission must include an `access_code` field
matching a `STAFF_ACCESS_CODE` value stored in Script Properties (never
committed to this repo, same treatment as `OPENROUTER_API_KEY`). A missing
or wrong code is rejected with `401` and logged via `logEvent_('unauthorized', ...)`
before any other code runs — no row is ever written, no Sheet is ever
touched, on an unauthorized request.

**Tradeoffs vs. the Workspace domain restriction:**
- *Identity vs. secret.* Workspace's domain restriction ties access to
  "signed in with a real clinic Google identity" — every request is
  attributable to a specific person by Google itself. A shared access code
  only proves "knows the code," not "is a specific staff member." This
  project already compensates for that at the one place identity actually
  matters: `consent_confirmed_by` (typed by the submitting staff member) and
  `reviewed_by` (`Review.gs`, captured automatically from
  `Session.getActiveUser().getEmail()` of whoever has edit access to the
  Sheet — Google Sheet sharing is per-account and works identically on a
  free account, so this identity capture is unaffected).
- *Revocation granularity.* Revoking one Workspace user's access doesn't
  affect others; rotating a shared code affects everyone who has it (an
  intentional, simple tradeoff for a small team — rotate the Script
  Property and redistribute the new code out-of-band, e.g. verbally or a
  private message, never by email in plain text).
- *Brute-force exposure.* A public URL means the access code could in
  principle be guessed by automated requests. Mitigate by using a long,
  random code (20+ characters, e.g. generated by a password manager) rather
  than a memorable phrase — treat it exactly like an API key, not a PIN.
  This is intentionally not paired with in-app rate-limiting/lockout logic:
  for this pilot's request volume, a long random code is sufficient, and
  building a lockout mechanism risks a self-inflicted denial-of-service
  (an attacker triggering enough failures to lock out real staff). Revisit
  if usage patterns ever suggest otherwise.

**Migrating to Google Workspace later requires no redesign.** If the clinic
adopts Google Workspace in the future:
1. Change `appsscript.json`'s `webapp.access` from `ANYONE_ANONYMOUS` to
   `DOMAIN` (or set it via the Deploy dialog's "Anyone within [domain]").
2. Optionally remove the `access_code` field from
   `/internal/consultation-summary.html` and the `verifyAccessCode_()` check
   in `Code.gs` — or simply leave both in place as a second layer of
   defense on top of the domain restriction (defense in depth costs
   nothing here).
3. Nothing else changes: `Schema.gs`, `Validation.gs`, `Send.gs`,
   `Email.gs`, `Review.gs`, and `Retention.gs` have no dependency on which
   access-control mode is active.

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
(the signed-in Google account with edit access to the Sheet — a personal
account works identically to a Workspace one here), not a
free-text field — the same identity space as `consent_confirmed_by`.
`reviewed_at` is stamped by Apps Script, not client-supplied.

After approval, `reviewSelectedRow_()` re-reads the row (not the values
it started with) and calls `Send.gs`'s `attemptSend_()` — so a manual
edit to `patient_consent_confirmed` made directly in the Sheet between
submission and review is still caught, not just the value that was true
at submission time (docs/25 §6, §9.2). `Review.gs` never calls `Email.gs`
or a mail provider directly — see "Email delivery layering" below.

## Email delivery layering (Batch 4E)

```
Review.gs  →  Send.gs (evaluateSendGate_ / attemptSend_)  →  Email.gs (sendVisitSummaryEmail_)  →  MailApp
```

Each arrow is a hard rule, not a convention: `Send.gs` never calls
`MailApp`/`GmailApp` directly, and `Review.gs` never calls `Email.gs` or
a mail provider directly. `attemptSend_()` is the only function allowed
to call `Email.gs`, and it always re-checks `evaluateSendGate_()` first
— so a future caller that adds a new entry point into this flow cannot
accidentally bypass the gate by calling `Email.gs` on its own.

This keeps the send *gate* (who is allowed to be emailed, and when)
independent of the delivery *mechanism* (how the email actually leaves
the building). Phase 1.5 uses `MailApp` only, per docs/25 §3's diagram —
no other provider is introduced. If a future phase needs to swap
providers (a different Google service, or a non-Google one), only
`Email.gs` changes; `Send.gs`'s gate logic and `Review.gs`'s review
workflow are untouched.

`buildVisitSummaryEmail_()` (`Email.gs`) builds a simple, brand-consistent
HTML email (docs/25 §9.6, HTML-first, locked) using the site's existing
color tokens. `ai_summary_draft` is passed through `Utils.gs`'s
`escapeHtml_()` before being embedded — this is defense in depth:
`staff_submitted_note` is sanitized at submission (`Validation.gs`), but
the AI's own output has never passed through that filter, so anything
reaching the HTML template is escaped here regardless of what produced
it (docs/15: "no raw HTML injected into email templates").

`attemptSend_()` always writes `email_status`/`email_sent_at` (on
success) or `email_status = failed` plus `error_log` (on any failure —
gate blocked or provider error) back to the row, and logs every outcome
via `Logger.gs` — no failure is ever silently dropped (docs/25 §8.3).

**Scoped to Phase 1.5.** `Email.gs` is the only module permitted to call a mail
provider *for Phase 1.5's own domain*. `FoundationEmail.gs` (IA-2, below) is Foundation's
independent equivalent for its own, structurally separate domain — see the "Phase 2A
Identity & Access modules" table for why a second, equally-scoped mail sender is the
correct read of ADR-009 here, not a violation of this section's rule.

## Retention purge (Batch 4F)

`Retention.gs` is deliberately independent of `Review.gs`, `Send.gs`,
and `Email.gs` — it never calls them, and they never call it. Its only
job, per docs/25 §9.3:

> locate eligible rows → clear `recipient_email` → stamp `purged_at` → log

It must never modify `staff_submitted_note`, `ai_summary_draft`,
`review_status`, `reviewed_by`, `reviewed_at`, `email_status`,
`email_sent_at`, or `error_log` — only `recipient_email` and
`purged_at`, and only on rows that are actually eligible. This is
structurally enforced, not just documented: `purgeExpiredRecipientEmails_()`
has exactly one call to `Sheets.gs`'s `updateRowByRecordId_()`, with a
hardcoded two-field object — there is no code path in this file that can
touch any other column.

**Eligibility** (`isEligibleForPurge_(row, nowMs)`, pure and unit-tested):
a row is eligible only if `recipient_email` is non-empty, `purged_at` is
not already set, `email_sent_at` is a valid date, and at least
`CONFIG.RETENTION.EMAIL_RETENTION_DAYS` (14, locked per docs/25 §9.3)
have elapsed since then. Every one of those conditions is also what
makes the function **idempotent**: once a row is purged, `purged_at`
being set permanently disqualifies it from being purged again, so
running the trigger twice — or twice on the same row, by accident or
overlap — is always safe.

**Partial-failure handling**: `purgeExpiredRecipientEmails_()` wraps
each row's write in its own `try`/`catch`. One row's Sheets-write
failure is logged (`logEvent_('failed', ...)`) and the loop continues to
the next row — a single bad row can never stop the rest of the batch
from being purged. If the initial bulk read itself fails, the whole run
is logged and aborted (nothing to iterate over), also without throwing.
Every purge, skip-reason, and failure is logged via `Logger.gs`; a
summary line (`purged=N skipped=N failed=N`) closes out each run.

**Setup**: the trigger is not automatic on deployment. Run
`installRetentionTrigger_()` once from the Apps Script editor (**Select
function → installRetentionTrigger → Run** — the dropdown-visible
wrapper, see "A note on trailing underscores" above) after deploying.
It's idempotent too — running it again when the trigger already exists
is a no-op, so it won't ever install duplicate triggers that would
double-purge.

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
  control is `Auth.gs`'s shared staff access code (see "Access control"
  above), not the page being unlisted.
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
- **4E (email template + delivery)** — complete. `Email.gs`, called only
  by `Send.gs`'s `attemptSend_()` when the gate passes, builds the
  patient-facing HTML template (docs/25 §9.6) and calls `MailApp`.
  Writes `email_status`/`email_sent_at` onto the same row via
  `Sheets.gs`. See "Email delivery layering" above.
- **4F (retention purge)** — complete. `Retention.gs`'s time-driven
  trigger (`purgeExpiredRecipientEmails_()`, installed once via
  `installRetentionTrigger_()`) reads `email_sent_at` off existing rows
  and clears `recipient_email`, stamping `purged_at`. Deliberately
  independent of `Review.gs`/`Send.gs`/`Email.gs`. See "Retention purge"
  above.

`Sheets.gs`'s header-drift check means every later batch's writes are
validated against the same `SCHEMA_COLUMNS` list — if a later batch
tries to write a column that doesn't exist in `Schema.gs`, it fails
loudly instead of silently misaligning columns.

## Deployment

This project has no npm dependencies and is not built/bundled — the
`.gs` files here are pushed to Apps Script as-is.

### Option A — clasp (recommended)

This project is deployed from a **personal Google account**
(`wisehomeopathicmc@gmail.com`), not Google Workspace — see "Access control"
above for what that changes (one setting) and what it doesn't (everything
else).

1. `npm install -g @google/clasp` (one-time, local machine).
2. `clasp login` (authenticates with `wisehomeopathicmc@gmail.com` — any
   free Google account works the same way as a Workspace one for `clasp`).
3. Create the Apps Script project once: `clasp create --type webapp --title "Phase 1.5 Consultation Summaries" --rootDir ./apps-script`, or `clasp clone <scriptId>` if the project already exists.
4. Copy `.clasp.json.example` to `.clasp.json` and fill in the real `scriptId` (`.clasp.json` is intentionally not committed — it's environment-specific).
5. `clasp push` from this directory to sync all files to the Apps Script project.
6. In the Apps Script editor, bind the project to the target Google Sheet (`Phase1.5_ConsultationSummaries` per `Config.gs`) — easiest path on a free account: create the Sheet first in Google Sheets (free, no Workspace needed), then **Extensions → Apps Script** from inside that Sheet to open a bound script project, and push into that one instead of a standalone script.
7. Deploy as a Web App: **Deploy → New deployment → Web app**. Set:
   - Execute as: **Me** (the deploying account) — matches `appsscript.json`'s `executeAs: USER_DEPLOYING`. This means all patient emails send from `wisehomeopathicmc@gmail.com` regardless of which staff member submitted the note — no per-staff Gmail authorization needed.
   - Who has access: **Anyone** — matches `appsscript.json`'s `access: ANYONE_ANONYMOUS`. A personal account cannot offer "Anyone within [domain]"; the shared `STAFF_ACCESS_CODE` (step 9 below) is the real access control here, not this setting — see "Access control" above.
8. Copy the deployed Web App URL (ends in `/exec`) into
   `/internal/consultation-summary.html`'s `WEB_APP_URL` constant,
   replacing the `REPLACE_WITH_DEPLOYED_WEB_APP_URL` placeholder. The
   form refuses to submit and shows an explicit message until this is
   set, so a not-yet-connected form fails loudly instead of silently.
   This static page is part of the site's existing Netlify deployment
   (`netlify.toml` in the repo root) — no separate hosting needed; it
   goes live at `/internal/consultation-summary.html` on the same domain
   as the rest of the site the next time this branch/repo is deployed.
9. Set the staff access code: Apps Script editor → **Project Settings →
   Script Properties → Add script property**, key `STAFF_ACCESS_CODE`,
   value a long random string (20+ characters — treat it like an API key,
   generate it with a password manager, don't reuse a real password).
   Share this value with staff out-of-band (verbally, or a private
   message — never by plain email). Without this property set, **every**
   submission is rejected with `401` — `Auth.gs`'s `verifyAccessCode_()`
   fails closed on an unset code (see "Access control" above).
10. Set the OpenRouter API key: Apps Script editor → **Project Settings →
    Script Properties → Add script property**, key `OPENROUTER_API_KEY`,
    value your OpenRouter key. `Ai.gs` reads it from
    `PropertiesService` at call time — it is never written to any file in
    this repo. Without it, submissions still succeed and write a row;
    `ai_summary_draft` is just left empty with the failure logged to
    `error_log` (see "AI boundaries" above).
11. Install the retention trigger: Apps Script editor → select
    `installRetentionTrigger` (the dropdown-visible wrapper — see "A note
    on trailing underscores" above) from the function dropdown →
    **Run** (once). Confirm it under **Triggers** (clock icon) in the
    editor — should show `purgeExpiredRecipientEmails_`, time-driven,
    daily. Not
    part of `clasp push` or the Web App deployment; this step is easy to
    forget and the pipeline works fine without it right up until the
    first row is old enough to need purging.

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
2. Run `runAllTests()` (dropdown-visible wrapper for `runAllTests_()`)
   from the Apps Script editor to check pure validation logic.
3. Use **Run → Test deployment** (or `curl` against the deployed test
   Web App URL) with each file in `sample-payloads/` — each JSON sample
   has an `access_code` field set to the placeholder
   `REPLACE_WITH_YOUR_STAFF_ACCESS_CODE`; replace it with your test
   `STAFF_ACCESS_CODE` value before sending, or you'll correctly get a
   `401` first. Confirm the **JSON body's `status` field**
   (not the transport-level HTTP status, which Apps Script Web Apps always
   report as 200 — see `Utils.gs`):
   - `valid-submission.json` (+ correct `access_code`) → body `status: 200`, one new row.
   - `missing-consent.json` (+ correct `access_code`) → body `status: 400`, no row written.
   - `invalid-condition-slug.json` (+ correct `access_code`) → body `status: 400`, no row written.
   - `malformed-json.txt` → body `status: 400`, no row written.
   - any payload with a missing or wrong `access_code` → body `status: 401`, no row written — this is the free-tier equivalent of the domain-restriction check (see "Access control" above).
4. With the Web App URL filled into `/internal/consultation-summary.html`
   (step 8 above), load that page and submit the form once with the
   correct staff access code and synthetic data — confirm a row appears
   in the test Sheet and the page shows the returned `record_id`. Then
   submit again with a wrong or blank access code and confirm the request
   is rejected (`401`, page shows the "Access code is missing or
   incorrect" message) and no row is written — this is the actual
   verification that the access-code gate works, not just that the form
   renders.
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
8. Select a row with a populated `ai_summary_draft`, a **test inbox you
   control** as `recipient_email`, and `patient_consent_confirmed =
   TRUE`. Click **Approve selected row (as generated)** and confirm:
   `review_status` becomes `approved`, `reviewed_by` is your own
   Workspace email, the alert reports the email was sent, and
   `email_status`/`email_sent_at` populate on the row. Check the test
   inbox — confirm the HTML email actually arrived and renders the
   summary correctly.
9. On a *different* row, manually edit the `patient_consent_confirmed`
   cell to `FALSE` before approving — confirm the alert reports the gate
   blocked with `patient_consent_confirmed is not true`, `email_status`
   stays `not_sent`, and no email is sent, proving the gate reads live
   values rather than trusting the row's state at submission time
   (docs/25 §6, §9.2).
10. Click **Reject selected row** on a row and confirm `review_status`
    becomes `rejected`, no send is attempted, and no gate-check alert
    appears.
11. Force a delivery failure (e.g. temporarily set `recipient_email` to
    something malformed directly in the Sheet, bypassing form
    validation) and approve — confirm `email_status` becomes `failed`,
    `error_log` shows `EMAIL_SEND_FAILED: ...`, and the doctor-facing
    alert reports the failure instead of claiming success (docs/25 §8.3).
12. **Never use a real patient's address for steps 8-11** — every
    delivery test in this batch must use a synthetic/test inbox you
    control (docs/25 §8.1). Only after all of the above pass, and only
    with a real, consenting patient reviewed manually at every stage
    (docs/25 §8.5, Batch 4G), should a real address ever be used.
13. Run `runAllTests()` and confirm the seven `isEligibleForPurge_()`
    tests pass (offline, no Sheet needed).
14. With at least one `sent` row from step 8, run
    `purgeExpiredRecipientEmails_()` manually from the Apps Script editor
    (**Select function → purgeExpiredRecipientEmails → Run** — the
    dropdown-visible wrapper) — since that row is only minutes old,
    confirm it is correctly *skipped* (check the execution log for
    `retention window has not elapsed yet`) and `recipient_email` is
    untouched.
15. Temporarily lower `CONFIG.RETENTION.EMAIL_RETENTION_DAYS` to `0` (or
    manually backdate a test row's `email_sent_at` cell to 20+ days ago)
    and run `purgeExpiredRecipientEmails` again — confirm
    `recipient_email` is cleared, `purged_at` is stamped, and every
    *other* column on that row (`staff_submitted_note`, `ai_summary_draft`,
    `review_status`, `reviewed_by`, `email_status`, `email_sent_at`,
    `error_log`) is byte-for-byte unchanged. Restore
    `EMAIL_RETENTION_DAYS` to `14` afterward.
16. Run `purgeExpiredRecipientEmails` a second time immediately —
    confirm the already-purged row is now skipped (not re-processed) and
    no duplicate log entry appears — this is the idempotency proof.
17. Confirm `installRetentionTrigger_()` is idempotent: run `installRetentionTrigger` twice from
    the editor and confirm **Triggers** still shows exactly one
    `purgeExpiredRecipientEmails_` trigger, not two.

## Explicitly out of scope so far

No patient login. Backend testing checklist and a real pilot are
Batch 4G — the final item before Phase 1.5 is done. See
docs/25-PHASE-1.5-TECHNICAL-PLAN.md §9 for the full batch sequence.

## Phase 2A Foundation modules

Per the approved Foundation plan (docs/29-PHASE-2A-TECHNICAL-PLAN.md §14 has the
implementation notes), Phase 2A's backend lives in **this same project**, not a
separate one — a deliberate decision made before implementation began, not a shortcut
discovered mid-build. New files are prefixed `Foundation` (infrastructure shared by any
future domain entity) or named for the specific domain entity they implement (e.g. a
future `PatientIdentity.gs`) to stay visually and functionally distinct from the Phase
1.5 modules documented above. No `Foundation`-family file calls into any Phase 1.5
module, and no Phase 1.5 file has been, or should be, modified to accommodate them.

Canonical contracts, schemas, and reference utilities these modules implement live in
`/shared/` at the repository root — `shared/README.md` states the rule: `shared/` is
authoritative, and Apps Script implementations conform to it and never extend or modify
a contract independently.

| File | Responsibility | Status |
|---|---|---|
| `FoundationConfig.gs` | Environment-specific values for the Foundation layer: the Patients spreadsheet ID, and the Script Property key names Foundation will read (never the secret values themselves). The Foundation-layer equivalent of `Config.gs` above. | Added (F1) |
| `FoundationUtils.gs` | Small stateless helpers adapted from `shared/utils/core.reference.js`: `generateFoundationId_()` (Apps Script's native `Utilities.getUuid()`), `foundationNowIso_()`, `escapeFoundationHtml_()`. Distinctly named from Phase 1.5's own `Utils.gs` helpers to avoid a global-scope collision now that both files share this project. No dependency on any other module. | Added (F2) |
| `FoundationContracts.gs` | `buildFoundationOkEnvelope_(data)` / `buildFoundationErrorEnvelope_(code, message)` — builders for the response envelope defined in `shared/contracts/response-envelope.schema.json`. Every Foundation function reachable from outside this project's internal call graph should return this shape. No dependency on any other module. | Added (F2) |
| `FoundationErrorHandling.gs` | `withFoundationErrorHandling_(fn)` — wraps a function call and guarantees a response-envelope return, even on a thrown exception. Logs the real error to Apps Script's built-in execution log (`Logger`, distinct from this project's own `Logger.gs`/`logEvent_()`) but never leaks it to the caller. Depends only on `FoundationContracts.gs`. | Added (F2) |
| `FoundationDataStore.gs` | The only Foundation file calling `SpreadsheetApp` for Patient-domain data. Four operations — `foundationDsInsert_()`, `foundationDsGetById_()`, `foundationDsUpdateById_()`, `foundationDsQuery_()` — plus pure row/object conversion helpers, all operating against the separate Patients spreadsheet (`FoundationConfig.gs`'s `PATIENT_SPREADSHEET_ID`), never `Phase1.5_ConsultationSummaries`. Same header-drift-refuses-to-write discipline as Phase 1.5's `Sheets.gs`. | Added (F3) |
| `FoundationAudit.gs` | `foundationLogAuditEvent_()` — append-only cross-cutting event log (`AuditLog` sheet), distinct from any entity's own status columns. Depends on `FoundationDataStore.gs`, `FoundationUtils.gs`. | Added (F3) |
| `PatientIdentity.gs` | The first concrete entity built on `Foundation*`, not infrastructure itself — deliberately not `Foundation`-prefixed (docs/29 §2). `foundationCreatePatient_()` / `foundationGetPatientById_()`, implementing `shared/schemas/patient-identity.schema.json`. No Web App route yet — `createFoundationPatient()` is a manually-run editor wrapper (see below). | Added (F3) |
| `FoundationSession.gs` | Session token issuance/verification, implementing `shared/schemas/session.schema.json`. `foundationIssueSessionToken_()` / `foundationVerifySessionToken_()` read the real signing secret from Script Properties; their `WithSecret_`-suffixed cores take the secret and clock as explicit parameters so the full HMAC round trip is testable offline, without touching `PropertiesService`. HMAC-SHA256 itself is never reimplemented in portable JS — it calls Apps Script's native `Utilities.computeHmacSha256Signature` (see `shared/schemas/session.md`, "conform to the contract, not the algorithm," same principle F2 established for UUID generation). No dependency on any other Foundation module. | Added (F4) |
| `FoundationRouteGuard.gs` | Route protection. `withFoundationAuth_(sessionToken, handlerFn)` verifies the session before calling `handlerFn(patientId)` — `patientId` is always server-derived from the verified token, never client-supplied (ADR-002, docs/29 §3/§10). Logs a `session_rejected` `FoundationAudit.gs` event on every rejection. Depends on `FoundationSession.gs`, `FoundationContracts.gs`, `FoundationAudit.gs`. No Web App route calls it yet — this batch delivers the gate, ready for whichever future batch wires an endpoint through it. | Added (F4) |
| `FoundationTests.gs` | Apps Script-native unit tests for Foundation's pure-logic functions, mirroring Phase 1.5's `Tests.gs` discipline — no live Sheet or network calls. Run `runFoundationTests()` from the editor dropdown. Covers `FoundationContracts.gs`, `FoundationDataStore.gs`'s pure helpers, `PatientIdentity.gs`'s input validation, and `FoundationSession.gs`'s pure payload/expiry/signature-comparison helpers plus a full issue-then-verify round trip against an explicit test secret. `FoundationRouteGuard.gs`'s functions are intentionally excluded (their rejection path writes to a live Sheet via `FoundationAudit.gs` — verified instead by an ad hoc functional pass, same as `PatientIdentity.gs`'s Sheet-touching functions). | Added (F3), extended (F4) |

This table covers every `apps-script/*.gs` file Foundation has added through batch F5 —
F5 itself added no new `.gs` file (Node-only conformance tooling, see "Conformance
testing" below). See docs/29 §13/§14 for the batch sequence and what each one delivers.

**Foundation's own trailing-underscore wrappers**, same convention as the table above
("A note on trailing underscores"):

| Use this from the dropdown | Calls |
|---|---|
| `runFoundationTests()` | `runFoundationTests_()` (`FoundationTests.gs`) |
| `createFoundationPatient()` | `foundationCreatePatient_()` (`PatientIdentity.gs`) — edit the placeholder values inside the function body before running; this is intentionally not a form or a Sheet menu, per F3's minimal scope |

## Phase 2A Identity & Access modules

Foundation (F1–F5, above) is complete and frozen except for bug fixes
(docs/35-FOUNDATION-CLOSEOUT.md §9). Identity & Access is the milestone that turns
Foundation's primitives into a working login, split into two independent batches
(docs/29 §15): **IA-1 (infrastructure only) and IA-2 (consumes IA-1's infrastructure —
the magic-link request/consume flow, rate limiting, and the first real Web App route),
both shipped.** New files follow the same non-`Foundation`-prefixed,
named-for-the-entity convention `PatientIdentity.gs` established (except
`FoundationRateLimit.gs`/`FoundationEmail.gs`/`FoundationRouter.gs`, which are
cross-cutting infrastructure new to IA-2, not entities — hence the `Foundation` prefix,
same reasoning as `FoundationSession.gs`/`FoundationRouteGuard.gs`), and — per the
Foundation freeze — never modify any of the ten files in the table above.

| File | Responsibility | Status |
|---|---|---|
| `FoundationLoginTokens.gs` | `foundationCreateLoginToken_()` / `foundationConsumeLoginToken_()`, implementing `shared/schemas/login-token.schema.json`. Generation, SHA-256 hashing, expiration, and single-use enforcement only — no route, no UI, no session issuance (IA-1's explicit scope boundary). Reuses `FoundationDataStore.gs`/`FoundationAudit.gs` unmodified. `createFoundationLoginToken()` is a manually-run editor wrapper, mirroring `createFoundationPatient()`. | Added (IA-1) |
| `FoundationRateLimit.gs` | `foundationCheckAndIncrementRateLimit_(email)` — basic per-email rate limiting (3 requests / 15 minutes) for the public request-link endpoint, `CacheService`-backed (no Sheet — a counter is inherently ephemeral). Fails open on a `CacheService` error, a deliberate, documented ADR-010 exception (this is a supplementary mitigation; `FoundationLoginTokens.gs`'s single-use hashed tokens remain the real security boundary regardless). Per-IP limiting is not implemented — Apps Script's `doPost(e)` never exposes a caller's IP address, a real platform constraint, stated here rather than silently dropped. No dependency on any other module. | Added (IA-2) |
| `FoundationEmail.gs` | `foundationSendLoginLinkEmail_(recipientEmail, rawToken)` — Foundation's own `MailApp` sender for the login-link email, deliberately independent of Phase 1.5's `Email.gs` (see "Email delivery layering" above for why one mail-provider-caller-per-domain, not one for the whole project, is the correct read of ADR-009 once two structurally separate domains share a project). `FOUNDATION_VERIFY_URL_BASE_` is a stated placeholder — the frontend page it points to (`verify.html`) is Batch 5B/5C, out of IA-2's backend-only scope. Depends on `FoundationUtils.gs`. | Added (IA-2) |
| `FoundationLoginFlow.gs` | `foundationHandleRequestLoginLink_()` / `foundationHandleConsumeLoginLink_()` — the real magic-link orchestration IA-1 deliberately left undone. Request: looks up a patient by email (`foundationFindPatientByEmail_()`, a new consumer of `FoundationDataStore.gs`'s existing `foundationDsQuery_()`), rate-limits, issues a token, emails it — returning docs/29 §3's identical generic response regardless of match (anti-enumeration). Consume: calls `foundationConsumeLoginToken_()` then `foundationIssueSessionToken_()` on success. Depends on `FoundationDataStore.gs`, `FoundationContracts.gs`, `FoundationErrorHandling.gs`, `FoundationAudit.gs`, `FoundationLoginTokens.gs`, `FoundationSession.gs`, `FoundationRateLimit.gs`, `FoundationEmail.gs`, and `PatientIdentity.gs`'s sheet/column constants. | Added (IA-2) |
| `FoundationRouter.gs` | `handleFoundationRequest_(input)` — the HTTP-level dispatcher `Code.gs`'s `doPost()` delegates to (see "Foundation/Phase 1.5 dispatch boundary" below). Routes `request_login_link`/`consume_login_link` to `FoundationLoginFlow.gs`, and `get_profile` (Foundation's **first authenticated Web App route** — IA-2's explicit deliverable) through `withFoundationAuth_()` to `foundationGetPatientById_()`, giving both functions their first real consumer (previously Deferred, docs/35 §6). Builds its own `ContentService` response directly rather than reusing `Code.gs`'s `jsonResponse_()`, to avoid a `status`-field shape collision between Phase 1.5's numeric convention and Foundation's `ok`/`error` envelope convention. Depends on `FoundationContracts.gs`, `FoundationLoginFlow.gs`, `FoundationRouteGuard.gs`, `PatientIdentity.gs`. | Added (IA-2) |

This table grows as later Identity & Access work (login.html/verify.html, the dashboard
shell, and beyond) lands.

## Phase 2A Patient Access modules — Batch PA-3 (Consultation History)

Identity & Access (above) and the PA-1/PA-2 dashboard shell are frozen except for bug
fixes (docs/36, docs/38). Batch PA-3 (docs/29 §13 Batch 5D) adds the first
patient-writable-by-staff, patient-readable data entity: Consultation History, backing
the Timeline and Consultation History detail view. New file, non-`Foundation`-prefixed
(same reasoning as `PatientIdentity.gs`/`FoundationLoginTokens.gs`, docs/29 §2):

| File | Responsibility | Status |
|---|---|---|
| `FoundationConsultationHistory.gs` | `foundationCreateConsultationEntry_()` (staff-facing create), `foundationGetPatientTimeline_()` (patient-facing, session-scoped, sorted newest-first, capped at 50 — docs/29 §6), `foundationGetConsultationEntryById_()` (patient-facing, session-scoped, verifies the requested `record_id`'s own `patient_id` before returning it — docs/40's identity-strategy review, the first Foundation read to take a client-supplied identifier). Implements `shared/schemas/consultation-history.schema.json`. No staff-facing Web App tool — `createFoundationConsultationEntry()` is a manually-run editor wrapper, same pattern as `createFoundationPatient()`/`createFoundationLoginToken()` (see this file's own header comment for why a real staff tool is out of this batch's scope). | Added (PA-3) |

**`FoundationRouter.gs` gained two new dispatch cases, `get_timeline` and
`get_timeline_entry`** — a disclosed, additive exception to "never modifying" the six
Identity & Access files (docs/36 §12), the same category as `Code.gs`'s own one-line
dispatch shim in IA-2: a new `case` in an already-designed extension point, touching
zero existing lines and changing zero existing behavior. See `FoundationRouter.gs`'s own
header comment for the full reasoning. `harness.js`'s `FILES` list and `conformance.js`
(Stage 7) were extended accordingly — test tooling, expected to evolve, per the same
precedent IA-1 already established.

**`assets/site.css`, `my-health-journey/dashboard.js`** (frontend) — see
`docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16's Batch PA-3 notes for the frontend half of
this batch (Timeline list page, Consultation History detail page, the shared
`my-health-journey/session-guard.js`, and the dashboard's Timeline card now wired to
real data).

## Phase 2A Patient Access modules — Batch PA-4 (Symptom Log)

PA-3 (above) is now frozen except for bug fixes. Batch PA-4 (docs/29 §13 Batch 5E,
preceded by docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md) adds the platform's first
patient-*writable* data entity: Symptom Log, backing the Symptom Tracker dashboard
card's quick-log form and full history page. New file, non-`Foundation`-prefixed (same
reasoning as `FoundationConsultationHistory.gs`, docs/29 §2):

| File | Responsibility | Status |
|---|---|---|
| `FoundationSymptomLog.gs` | `foundationCreateSymptomLog_()` (patient-facing, session-scoped create — all four scale fields mandatory, docs/41 §10 Q1) and `foundationGetPatientSymptomLogs_()` (patient-facing, session-scoped, sorted newest-first by `logged_at`, capped at 50). Implements `shared/schemas/symptom-log.schema.json`. No `get_by_id` — docs/41 §12 found no product requirement for a per-entry detail fetch, so this entity needs no equivalent to `foundationGetConsultationEntryById_()`'s record-ownership check. Validates an optional `condition_slug` against `FOUNDATION_ALLOWED_CONDITION_SLUGS_`, manually adapted from `shared/constants/condition-slugs.json` — the first real second consumer of that canonical list, closing the deferral `shared/README.md` and `shared/schemas/patient-identity.md` both named. | Added (PA-4) |

**`FoundationRouter.gs` gained two new dispatch cases, `log_symptom` and
`get_symptom_logs`** — the same disclosed, additive-extension-point pattern PA-3's own
`get_timeline`/`get_timeline_entry` cases already established, applied here to the
platform's first patient-writable route. `harness.js`'s `FILES` list and
`conformance.js` (Stage 8) were extended accordingly.

**`validation/phase-2a-foundation/schema-validator.js` gained `integer` type support
and `minimum`/`maximum` numeric bounds** — `symptom-log.schema.json`'s four 1-10 scale
fields are the first real `shared/` schema to need either construct, per this tool's
own stated extension policy (`validation/phase-2a-foundation/README.md`).

**`assets/site.css`, `my-health-journey/dashboard.js`, `my-health-journey/symptoms/`**
(frontend) — see `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16's Batch PA-4 notes for the
frontend half of this batch (the dashboard's Symptom Tracker card now carrying a real
quick-log form and most-recent-value summary, and the new Symptom History full-list
page).

## Foundation/Phase 1.5 dispatch boundary (IA-2)

Google Apps Script permits exactly one global `doPost()` per project, and docs/29 §14
Decision 1 locked one shared project for all Phase 2A backend work — so IA-2's new,
patient-facing Web App route cannot exist as a second, independent HTTP entry point.
Two options were considered: reverting to §3's original separate-Apps-Script-project
design (undoing Decision 1), or a minimal, additive dispatch line inside `Code.gs`'s
existing `doPost()`. The second was chosen, as the narrowest possible exception to
"never modifying Phase 1.5's existing files": `Code.gs` now checks for a
`foundation_action` field — present on every Foundation request, absent from Phase
1.5's own payload shape (`Validation.gs`'s complete field list has no collision) —
before any Phase 1.5-specific parsing, sanitizing, or `STAFF_ACCESS_CODE` check runs.
Present: the entire request is handed to `FoundationRouter.gs`'s
`handleFoundationRequest_()`, whose response is returned unchanged. Absent: execution
falls through to every line below, byte-for-byte unchanged from before IA-2 — proven,
not just asserted, by `validation/phase-1-5/validate.js`'s Stage 9, which drives both
paths through the real `doPost()` and confirms the fall-through case never touches the
Sheet, the access-code gate, or the execution log, and that a normal Phase 1.5
submission still writes exactly one row. `validation/phase-1-5/validate.js` remains
42/42 clean after this change.

## Static analysis

`validation/static-analysis/analyze.js` scans every file in this directory for
duplicate global names, duplicate constants, duplicate function names, unused exported
helpers, circular dependencies, and Apps Script namespace collisions — see its own
header comment and `validation/static-analysis/README.md` for full detail. Introduced
in Foundation batch F3; runs before validation on every Foundation batch from F3
onward, per docs/29 §14.

## Conformance testing

`validation/phase-2a-foundation/conformance.js` loads the real, unmodified
Foundation-family `.gs` files (via a mocked Apps Script runtime,
`validation/phase-2a-foundation/harness.js`) and checks their actual output against the
real `shared/*.schema.json` contracts using a generic, dependency-free JSON Schema
validator (`schema-validator.js`) — not per-field hand-coded assertions. Introduced in
Foundation batch F5, the deliverable F2's own implementation notes named ahead of time.
See `validation/phase-2a-foundation/README.md` for full detail.
