# Phase 1.5 Validation (Batch 4G)

A local, Node-only test tool proving the committed `apps-script/*.gs`
source behaves as designed, end to end, without a live Google Workspace
deployment. This is **not** part of the Apps Script project — nothing
under `apps-script/` loads or depends on anything here, and this
directory is never pushed via `clasp`.

## What this proves

`validate.js` loads the real, unmodified `.gs` files from `apps-script/`
into a mocked Apps Script runtime (in-memory Sheet, fake
`PropertiesService`/`UrlFetchApp`/`MailApp`/`ScriptApp`/`Session`) and
drives them through:

1. **Every pipeline stage independently**: staff submission → validation,
   AI normalization (success + failure), doctor review → gate
   evaluation, email delivery (success + provider failure + tampered
   consent), retention (purge + skip + partial failure + idempotency).
2. **The full end-to-end workflow**, twice: once through to a real send
   and a 20-days-later retention purge (success path), once through a
   doctor rejection (no send), and once through a manually tampered
   consent flag caught at review time (no send).
3. The existing `apps-script/Tests.gs` unit suite (`runAllTests_()`),
   run through the same real-source harness rather than reasoned about.

Run it: `node validate.js` (no dependencies beyond Node's standard
library — no `npm install` needed).

## Result (last run)

**39/39 checks passed** — 1 for the existing 30-test `Tests.gs` suite
(reported as a single pass/fail from `runAllTests_()`'s return value,
includes the 4 `Auth.gs` access-code tests added for the free-account
deployment) plus 38 new stage-level and end-to-end checks, including all
three failure modes docs/25 §8.3 names explicitly (AI-call failure,
Sheets-write failure, email-send failure) and the `Auth.gs` access-code
gate (missing/wrong `access_code` rejected with 401, before any Sheet
write). Re-run `node validate.js` at any time; it prints a `PASS`/`FAIL`
line per check plus a final tally.

## What this does NOT prove

This harness mocks every external dependency — it cannot and does not
verify:

- **Workspace-domain access restriction** (docs/25 §9.1) — whether the
  real deployed Web App actually rejects a non-Workspace account. That
  requires the real deployment and two real Google accounts.
- **A real OpenRouter call** — `harness.js`'s `defaultOpenRouterMock`
  stands in for the API; it proves the *code path* (request built,
  response parsed, failure handled) but not that a real
  `anthropic/claude-haiku-4.5` call behaves as expected, or that
  `flagDrift_()` correctly flags a real model's output. Batch 4C's
  manual test step (submit a note likely to trigger drift, check for a
  real `AI_REVIEW_FLAGS:` entry) is still required against a live
  deployment.
- **A real email actually arriving** — `MailApp.sendEmail` is mocked;
  this proves the code calls it correctly with the right recipient,
  subject, and HTML body, not that Gmail delivers it or that it renders
  correctly in a real inbox.
- **The real time-driven trigger firing on schedule** — `Retention.gs`'s
  logic is proven; `installRetentionTrigger_()`'s actual daily firing
  can only be confirmed by installing it in a live project and checking
  back.
- **A real, consenting patient** — docs/25 §10 explicitly requires one
  real pilot run, reviewed manually at every stage, before Phase 1.5 is
  considered done. Nothing here substitutes for that.

These remain live-deployment-dependent items for whoever deploys this
project — see `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §10 for the full
Definition of Done checklist and which items this validation run closes
versus which stay open pending a real deployment.
