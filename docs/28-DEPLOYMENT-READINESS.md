# 28 - Phase 1.5 Deployment Readiness Checklist
## Version 1.1 — 2026-07-02

> An operational checklist, not a software task list. Every item here is
> something a person does against a real Google account, Google Sheet, or
> Apps Script deployment — none of it is code work, and none of it can be
> completed from within this repository alone. Deploys on a free personal
> Google account, not Google Workspace — see "Deployment account" below.
> Companion to
> docs/26-PHASE-1.5-VALIDATION-REPORT.md (what's already proven in
> software) and docs/27-PHASE-1.5-CLOSEOUT.md (the official closeout).
> Full step-by-step mechanics for each item: `apps-script/README.md`'s
> "Deployment" and "Testing before real use" sections.

---

## How to use this checklist

Work top to bottom — later items depend on earlier ones. Nothing here
should be checked off until it has actually been done against a real
deployment, not assumed. Do not check an item because the *code*
supporting it has been validated (docs/26 already lists exactly what
code-level validation covers) — check it only when the *live* step has
been performed.

---

## Deployment account: free personal Google account

This deployment uses a **free personal Google account**
(`wisehomeopathicmc@gmail.com`), not Google Workspace. Google Workspace is
**not required** for anything in this checklist — every item below uses a
free Google service (Sheets, Apps Script, Gmail/MailApp, Drive) or a
GitHub Pages-hosted static page. The one place Workspace would have
provided something free accounts can't (domain-restricted Web App access)
has an application-level replacement — see `apps-script/README.md`'s
"Access control" section for the full explanation, tradeoffs, and the
no-redesign migration path back to Workspace later, if the clinic ever
adopts it.

## Checklist

- [ ] **Google account confirmed** — `wisehomeopathicmc@gmail.com` (or
      whichever free Google account is deploying) is accessible and its
      password is stored securely (a password manager, not a shared doc).
      No Google Workspace signup is required.
- [ ] **Test Sheet created** — a Google Sheet exists for testing,
      separate from any future production Sheet (docs/25 §7:
      "Environment separation"). Do not reuse a production Sheet for
      testing, ever. Free Google Sheets has no feature gap here — this
      step is identical with or without Workspace.
- [ ] **Apps Script deployed** — this project (`apps-script/`) pushed via
      `clasp push` (or manually) to an Apps Script project bound to the
      test Sheet, and deployed as a Web App per
      `apps-script/README.md`'s deployment steps.
- [ ] **Staff access code configured and verified** — a long, random
      `STAFF_ACCESS_CODE` (20+ characters) is set in Script Properties
      (this is the free-account replacement for Workspace's domain
      restriction — see `apps-script/README.md`'s "Access control"
      section), **and** a real request with a missing/wrong access code
      has actually been sent and rejected with `401`. Confirming the
      property is set is not sufficient — this must be tested with a real
      request, the same rigor previously required for the Workspace
      domain check.
- [ ] **OpenRouter API configured** — an OpenRouter account exists, an API
      key has been generated, and that key is set in the Apps Script
      project's Script Properties as `OPENROUTER_API_KEY`. Confirmed
      **not** present in any file in this repository.
- [ ] **Mail permissions verified** — the Apps Script project has been
      authorized (via the standard Google OAuth consent screen on first
      run) to send mail as the deploying account, and a real test email
      has been sent and received in a test inbox.
- [ ] **Retention trigger installed** — `installRetentionTrigger_()` has
      been run once from the Apps Script editor against the live
      deployment, and confirmed present under **Triggers** (not just
      assumed from the code being correct).
- [ ] **Staff entry form wired up** — `/internal/consultation-summary.html`'s
      `WEB_APP_URL` constant updated to the real deployed Web App URL
      (replacing the `REPLACE_WITH_DEPLOYED_WEB_APP_URL` placeholder) and
      deployed to the live site.
- [ ] **Synthetic validation completed against the live deployment** —
      every manual test step in `apps-script/README.md`'s "Testing before
      real use" sections has been walked through against the *real*
      deployment (not `validation/phase-1-5/`'s mocked harness, which
      only proves the code): submission, validation failures, AI success
      and failure, doctor review (approve as-generated, approve as-edited,
      reject), gate enforcement against a tampered consent cell, real
      email delivery to a test inbox, forced delivery failure, and
      retention purge (skip-too-recent, purge-when-eligible with
      protected-column verification, idempotency-on-rerun).
- [ ] **Real patient pilot approved** — the clinic has identified one
      real, already-consenting recent patient for the required pilot
      (docs/25 §8 item 5, §10), and a doctor has agreed to manually
      review every stage of that one run before treating the pipeline as
      "working" for real use.
- [ ] **Deployment approved** — someone with authority to approve
      clinic-facing tools (per docs/00's governance) has reviewed this
      checklist, confirmed every item above is genuinely complete (not
      just code-validated), and signs off that Phase 1.5 may be used for
      real, ongoing consultations.

---

## What checking every box means

Once every box above is genuinely checked, return to docs/25 §10 and
close its remaining Definition-of-Done items — they map directly to this
checklist. Only then is Phase 1.5 **Deployment Complete** and
**Operationally Complete**, on top of the **Software Complete** status
already reached at the end of Batch 4G. All three are distinct states;
reaching one does not imply the others.

Phase 2A should not begin until this checklist, and docs/25 §10 in full,
are closed.
