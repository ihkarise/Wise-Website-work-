# 26 - Phase 1.5 Validation Report
## Version 1.0 — 2026-07-02

> Companion to docs/25-PHASE-1.5-TECHNICAL-PLAN.md §8 (Testing & Validation
> Plan) and §10 (Definition of Done). This document is the single canonical
> record of what was validated, how, and with what result — superseding the
> scattered per-batch notes in docs/25 §11 as the authoritative summary.
> Produced in Batch 4H. Every claim below is backed by a runnable artifact
> (`validation/phase-1-5/`) or an explicit statement that it is not yet
> verified.

---

## 1. Objectives

Per docs/25 §8, prove — before any real patient or authentication depends
on this pipeline — that:

1. The complete data pipeline works end to end: staff submission →
   validation → Sheet write → AI normalization → doctor review → gate
   evaluation → email delivery → retention.
2. Every stage behaves correctly independently, not just when chained
   together by coincidence.
3. Every required failure mode (validation, AI, Sheets-write, email
   provider, consent, review, retention) leaves the system in a safe
   state — no silent data loss, no unreviewed or non-consented email ever
   reaching a patient.
4. The existing unit test suite (`apps-script/Tests.gs`) still passes
   against the final, integrated codebase, not just in isolation.

---

## 2. Scope

**In scope**: the software behavior of every module in `apps-script/`
(`Code.gs`, `Config.gs`, `Schema.gs`, `Validation.gs`, `Sheets.gs`,
`Logger.gs`, `Utils.gs`, `Ai.gs`, `Send.gs`, `Email.gs`, `Review.gs`,
`Retention.gs`) and their interactions, exercised against the real,
unmodified source.

**Out of scope** (explicitly, and stated honestly in §9 below): anything
that requires a live Google Workspace deployment, a real OpenRouter API
key, a real Gmail/MailApp send, or a real patient. This report does not
claim to have verified those — see §9.

---

## 3. What Was Implemented (Batches 4A–4G)

| Batch | Delivered |
|---|---|
| 4A | Sheet schema (`Schema.gs`), input validation (`Validation.gs`), Sheet-write layer (`Sheets.gs`), Apps Script Web App skeleton (`Code.gs`, `Config.gs`, `Logger.gs`, `Utils.gs`) |
| 4B | Staff entry form (`internal/consultation-summary.html`) — Workspace-restricted, consent-gated |
| 4C | AI normalization step (`Ai.gs`) — prompt + independent code-level drift check (`flagDrift_()`) |
| 4D | Doctor review checkpoint (`Review.gs`, Sheet-bound custom menu) + gated send decision (`Send.gs`'s `evaluateSendGate_()`) |
| 4E | Email delivery (`Email.gs`), layered behind `Send.gs` so the gate is independent of the mail provider |
| 4F | Automated 14-day retention purge (`Retention.gs`), structurally independent of Review/Send/Email |
| 4G | This validation pass |

Full detail per batch: docs/25 §11. Full module responsibilities:
`apps-script/README.md`.

---

## 4. Validation Methodology

Built `validation/phase-1-5/` — a Node-only harness, not part of the
Apps Script project and never deployed:

- `harness.js` loads the **real, unmodified** `.gs` source files from
  `apps-script/` into a mocked Apps Script runtime: an in-memory fake
  Sheet, and fake `PropertiesService`, `UrlFetchApp`, `MailApp`,
  `ScriptApp`, `Session`, `Logger`, `ContentService`, `Utilities`.
- `validate.js` drives that real source through synthetic scenarios and
  asserts on the resulting Sheet state, function return values, and
  mocked mail-provider calls.

This is the strongest verification achievable without live Google
Workspace credentials: it exercises the actual committed code paths, not
a description or reimplementation of them. It is **not** a substitute
for live deployment testing — see §9.

---

## 5. Unit Tests Executed

`apps-script/Tests.gs`'s `runAllTests_()`, re-run through the real-source
harness (not just reasoned about): **26/26 passed.**

Covers: submission validation (valid payload, missing consent, unknown
condition slug, oversized note, invalid email, HTML sanitization),
`flagDrift_()` (faithful rephrasing produces no flags; injected
recommendation, diagnosis, and low-overlap fabricated sentences are each
flagged), `evaluateSendGate_()` (passes when approved+consented and for
`edited_and_approved`; blocks on missing consent, non-approved status,
empty draft, empty recipient), `escapeHtml_()`/`buildVisitSummaryEmail_()`
(tag neutralization, draft escaping, correct subject), and
`isEligibleForPurge_()` (eligible after the window and exactly at the
boundary; not eligible within the window, already purged, already empty,
never sent, or with an invalid date).

---

## 6. Integration Tests Executed

Stage-level tests, each exercising two or more real modules together
against the mocked Sheet/providers (`validation/phase-1-5/validate.js`):

- **Stage 1 — Submission → Validation → Sheet Write**: consent-unchecked
  and unknown-slug submissions rejected with zero rows written; malformed
  JSON rejected; a valid submission writes exactly one row.
- **Stage 2 — AI Normalization**: a successful call populates
  `ai_summary_draft` and reports `ai_summary_generated: true`.
- **Stage 3 — Doctor Review → Gate Evaluation**: the gate passes for
  approved+consented rows (including `edited_and_approved`), and blocks
  when consent is false or review is not yet approved.
- **Stage 4 — Email Delivery**: a passing gate results in exactly one
  call to the mocked mail provider, with `email_status`/`email_sent_at`
  written correctly.
- **Stage 5 — Retention**: eligible rows are purged, too-recent and
  already-purged rows are correctly skipped, and a second run purges
  nothing new (idempotency).

Full pass/fail detail is reproducible by anyone with the repo: `cd
validation/phase-1-5 && node validate.js` (no dependencies beyond Node's
standard library).

---

## 7. Failure-Path Tests Executed

Per docs/25 §8.3's explicit requirement ("what happens if the AI call
fails, if Sheets write fails, if email send fails — every failure must
land in `error_log`/`email_status = failed`, never silently drop") and
this batch's additional consent/review/retention requirements:

| Failure mode | Verified behavior |
|---|---|
| Validation failure (missing consent, bad slug, malformed JSON) | 400 response, zero rows written |
| AI failure — missing API key | Row written, `ai_summary_draft` stays empty, `error_log` = `AI_SUMMARY_FAILED: ...`, submission still returns 200 |
| AI failure — provider HTTP error | Same as above — draft stays empty, no exception escapes |
| Sheets-write failure at initial submission | 500 response, no crash, no row visible |
| Sheets-write failure during retention | That row's write logged and skipped; other eligible rows in the same run still purge correctly |
| Email provider failure | `email_status = failed`, `error_log` = `EMAIL_SEND_FAILED: ...`, no exception escapes, `attemptSend_()` returns cleanly |
| Consent failure — unchecked at submission | 400, no row written |
| Consent failure — tampered after approval | Row directly edited to `patient_consent_confirmed = false` after `review_status` was already `approved`; send is still blocked — proves the gate reads live values, not submission-time state |
| Review failure (rejection) | `review_status = rejected`, zero calls to the mail provider, `email_status` stays `not_sent` |
| Retention idempotency | Running the purge twice produces zero re-purges on the second run; a row's protected columns (`staff_submitted_note`, `ai_summary_draft`, `review_status`) are provably unchanged after a purge |
| HTML injection | A synthetic AI draft containing `<script>` tags is confirmed escaped (`&lt;script&gt;`) in the actual email body the code would send |

---

## 8. Results

**37/37 checks passed**: the 26-test `Tests.gs` suite (reported as one
pass/fail from `runAllTests_()`'s boolean return) plus 36 new stage-level
and end-to-end checks, executed 2026-07-02 against commit `59aef35`
(Batch 4G) unchanged through Batch 4H (no code touched since). Re-run at
any time: `cd validation/phase-1-5 && node validate.js`.

No check failed at any point during this validation pass. Where an
earlier draft of a check was found to be vacuous or too weak (e.g., an
assertion that could never fail), it was rewritten to be meaningful
before being counted — see `validation/phase-1-5/validate.js`'s history
for the injection-escaping check specifically.

---

## 9. Remaining Live Deployment Validation

**Not verified by this report, and not claimed to be.** These require a
real Google Workspace deployment and, for the last two, a real device/
inbox/patient:

1. **Workspace-domain access restriction** (docs/25 §9.1) — that the
   deployed Web App actually rejects a request from a non-Workspace
   Google account, not just that the manifest is configured correctly.
2. **A real OpenRouter call** — that `anthropic/claude-haiku-4.5`
   actually produces safe, normalization-only output for real notes, and
   that `flagDrift_()` correctly flags a real model's drift (docs/25 §8's
   drift-trigger manual test step).
3. **A real email arriving** — that `MailApp.sendEmail()` succeeds
   against Google's live infrastructure and the HTML renders correctly
   in a real inbox.
4. **The live time-driven trigger firing on schedule** —
   `installRetentionTrigger_()` must be run once in the real deployment,
   and its daily firing confirmed over time, not just its logic.
5. **The required real, consenting-patient pilot** (docs/25 §8 item 5,
   §10) — reviewed manually at every stage, before this pipeline is
   trusted with a real person's data.

These five items are docs/25 §10's remaining unchecked Definition-of-Done
boxes. Full operational steps to close them: docs/28-DEPLOYMENT-READINESS.md.

---

## 10. Known Limitations

- The mocked OpenRouter response in `harness.js` is a deterministic
  stand-in (`'Summary: ' + note.slice(0, 200)`), not a real model call —
  it proves the *code path* around the AI call (request built correctly,
  response parsed, failure handled), not that a real model's output
  passes `flagDrift_()` in practice.
- The mocked `MailApp` proves the code calls it with the right
  arguments, not that Gmail accepts, delivers, or renders the message.
- The fake Sheet is a plain in-memory array, not a real Google Sheets
  instance — quota limits, concurrent-edit behavior, and Google's actual
  `SpreadsheetApp` semantics (e.g., exact type coercion on read-back) are
  not exercised.
- `Session.getActiveUser().getEmail()` is mocked to a fixed value; real
  Workspace identity behavior (including known cases where this API
  returns an empty string under certain permission configurations) is
  not exercised.
- No load or concurrency testing was performed — appropriate for this
  pipeline's stated pilot-scale, staff-paced volume (docs/25 §9.5), not
  validated for higher throughput.

---

## 11. Risks

| Risk | Severity | Mitigation status |
|---|---|---|
| Real OpenRouter output drifts in a way the lexicon/overlap heuristic misses | Medium | Mitigated by the mandatory human review gate (§9.2) — no flagged or unflagged draft is ever auto-sent |
| Workspace-domain restriction misconfigured at deploy time | High | Not yet verified live — first item in docs/28's checklist; must be manually confirmed with a non-Workspace account before any real use |
| Retention trigger never installed after deployment | Low-Medium | `installRetentionTrigger_()` is a manual, one-time step — flagged explicitly in `apps-script/README.md`'s deployment steps and docs/28's checklist as easy to forget |
| A future maintainer edits the Apps Script editor directly instead of this repo | Medium | Documented repeatedly (`apps-script/README.md`'s "never treat the Apps Script editor as canonical" rule) but not technically enforced — process discipline, not a code control |
| Mocked-provider validation gives false confidence before live testing | Medium | This report's §9/§10 explicitly separate what is and is not proven, specifically to prevent this |

---

## 12. Go / No-Go Recommendation

**Go, for deployment to a test environment. No-Go, for real patient use,
until docs/28's checklist is fully closed.**

The software is complete and has been validated as thoroughly as
possible without live credentials — every code path, every named failure
mode, and the full success/rejection/tampered-consent workflows all
behave exactly as designed against the real committed source. There is
no known defect blocking deployment.

What is **not** yet true, and must not be treated as true: that this
works against a real Google Workspace, a real OpenRouter account, real
Gmail delivery, or a real patient. Those are the explicit, itemized
remaining steps in docs/28-DEPLOYMENT-READINESS.md, and docs/25 §10's
Definition of Done is intentionally left with those boxes unchecked
until each is genuinely completed — not assumed.

**Recommendation**: proceed to deploy against a test Google Workspace
project and test Sheet (docs/25 §7's "environment separation"
requirement), work through docs/28's checklist in order, and only then
schedule the one real-patient pilot §10 requires. Do not begin Phase 2A
until that pilot is complete and every §10 box is genuinely checked.
