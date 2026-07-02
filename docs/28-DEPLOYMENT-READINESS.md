# 28 - Phase 1.5 Deployment Readiness Checklist
## Version 1.2 — 2026-07-02

> **All technical items below are complete** — verified against a real live
> deployment on `wisehomeopathicmc@gmail.com`, including one real-patient
> pilot. Only the final governance sign-off ("Deployment approved") remains
> open.

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
free Google service (Sheets, Apps Script, Gmail/MailApp, Drive) or the
site's existing Netlify deployment (`netlify.toml`) for the staff form's
static page. The one place Workspace would have
provided something free accounts can't (domain-restricted Web App access)
has an application-level replacement — see `apps-script/README.md`'s
"Access control" section for the full explanation, tradeoffs, and the
no-redesign migration path back to Workspace later, if the clinic ever
adopts it.

## Checklist

- [x] **Google account confirmed** — `wisehomeopathicmc@gmail.com` deployed
      the project. No Google Workspace signup was needed.
- [x] **Test Sheet created** — `Phase1.5_ConsultationSummaries_TEST`
      created separately from any future production Sheet.
- [x] **Apps Script deployed** — `apps-script/` copied into an Apps Script
      project bound to the test Sheet and deployed as a Web App
      (`.../exec` URL live).
- [x] **Staff access code configured and verified** — `STAFF_ACCESS_CODE`
      set in Script Properties; a real request with a wrong/missing code
      was sent and rejected with `401` (`reqbin.com` test), and a real
      request with the correct code succeeded with `200` and wrote a row.
- [x] **OpenRouter API configured** — a real OpenRouter key is set as
      `OPENROUTER_API_KEY` in Script Properties, confirmed not present in
      any file in this repository. Live calls succeeded (`ai_summary_draft`
      populated on real submissions) and the model correctly refused to
      fabricate content from non-clinical test notes, caught by
      `flagDrift_()`.
- [x] **Mail permissions verified** — Apps Script authorized to send mail
      as `wisehomeopathicmc@gmail.com` (OAuth consent granted), a real
      test email was sent and received.
- [x] **Retention trigger installed** — `installRetentionTrigger()` run
      from the Apps Script editor; confirmed present under **Triggers**
      (`purgeExpiredRecipientEmails_`, daily), and confirmed idempotent
      (running it again logged "already installed — nothing to do," no
      duplicate trigger).
- [x] **Staff entry form wired up** — `/internal/consultation-summary.html`'s
      `WEB_APP_URL` updated to the real deployed Web App URL and live on
      the site's Netlify deployment.
- [x] **Synthetic validation completed against the live deployment** —
      every manual test step walked through against the real deployment:
      valid/invalid submissions, wrong/missing access code (401), AI
      success and AI drift-flagging, doctor review (approve-as-generated,
      consent-gate block on a tampered row, reject, forced delivery
      failure with `EMAIL_SEND_FAILED` logged), and retention (skip-too-
      recent, purge-when-eligible with all other columns verified
      untouched, idempotent re-run, idempotent trigger re-install). A
      final clean synthetic end-to-end pass (submit → AI → approve →
      email) was also run with nothing deliberately broken.
- [x] **Real patient pilot approved** — one real, already-consenting
      patient's visit summary was submitted, the doctor personally
      reviewed the AI draft against the source note before approving, and
      the summary was sent to the patient's real email address.
- [ ] **Deployment approved** — someone with authority to approve
      clinic-facing tools (per docs/00's governance) has reviewed this
      checklist, confirmed every item above is genuinely complete (not
      just code-validated), and signs off that Phase 1.5 may be used for
      real, ongoing consultations. **Still open — this is a governance
      sign-off, not a technical step, and is deliberately left for the
      clinic's own decision-maker rather than checked off here.**

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
