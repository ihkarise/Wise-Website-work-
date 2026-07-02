# 27 - Phase 1.5 Closeout
## Version 1.0 — 2026-07-02

> Official closeout document for Phase 1.5, produced in Batch 4H. Read
> alongside docs/25-PHASE-1.5-TECHNICAL-PLAN.md (the binding spec),
> docs/26-PHASE-1.5-VALIDATION-REPORT.md (what was validated and how),
> and docs/28-DEPLOYMENT-READINESS.md (what's left before real use).

---

## 1. Original Objectives

From docs/25 §1, Phase 1.5 set out to answer one question with real
infrastructure instead of a diagram:

> Can Wise's chosen backend pattern — Website/Admin action → Google Apps
> Script → Google Sheets → AI summary → Email delivery — actually work,
> safely, before any patient data or authentication depends on it?

Six specific objectives were set:

1. Prove the data pipeline end-to-end.
2. Prove the AI summary pattern is safe and grounded.
3. Prove email delivery as the platform's first "system reaches out to a
   person" capability.
4. Establish Sheets schema discipline that survives a future SQL
   migration.
5. Keep risk near zero (no auth, no PHI, no public write access, no
   irreversible action without human review).
6. Produce a reusable component, not a throwaway test harness.

---

## 2. Deliverables Completed

| Objective | Delivered as |
|---|---|
| 1. Data pipeline end-to-end | `apps-script/Code.gs` → `Sheets.gs` → `Phase1.5_ConsultationSummaries`, proven via `validation/phase-1-5/` (docs/26) |
| 2. Safe, grounded AI | `Ai.gs`, a normalization-only layer enforced by both prompt (`PROMPTS.md`) and independent code check (`flagDrift_()`) — no auto-send regardless of flag status |
| 3. Email delivery | `Email.gs`, the sole caller of `MailApp`, reachable only through `Send.gs`'s gate |
| 4. Schema discipline | `Schema.gs`'s 16 flat columns, stable UUID `record_id`, no per-patient tabs — reviewed against docs/12's SQL-migration rule and confirmed compliant by design |
| 5. Near-zero risk | No authentication anywhere in this project; Workspace-domain-restricted staff entry point only; every send hard-gated on consent + doctor approval, enforced in code not UI |
| 6. Reusable component | A real post-consultation visit-summary email tool doctors will use post-launch, not a test harness — the harness that validated it (`validation/phase-1-5/`) is explicitly separate and never deployed |

All six objectives were met **in software**. None require a design
change to be considered done — only deployment (docs/28).

---

## 3. Architecture Delivered

```
Staff (post-consultation, Workspace-authenticated)
      │  internal/consultation-summary.html
      ▼
Code.gs (doPost)
      │  Validation.gs → Schema.gs → Sheets.gs
      ▼
Phase1.5_ConsultationSummaries (Google Sheet)
      │
      ▼
Ai.gs  (OpenRouter, normalization only, flagDrift_() backstop)
      │
      ▼
Review.gs  (Sheet-bound custom menu — doctor approves/rejects)
      │
      ▼
Send.gs  (evaluateSendGate_ / attemptSend_ — the only gate)
      │
      ▼
Email.gs  (the only module allowed to call a mail provider)
      │
      ▼
MailApp  (patient receives one HTML visit-summary email)
      │
      ▼
Retention.gs  (independent — purges recipient_email after 14 days)
```

**Thirteen modules**, each with one job (`apps-script/README.md`'s
module table is the canonical reference): `Code.gs`, `Config.gs`,
`Schema.gs`, `Validation.gs`, `Sheets.gs`, `Ai.gs`, `PROMPTS.md`,
`Review.gs`, `Send.gs`, `Email.gs`, `Retention.gs`, `Logger.gs`,
`Utils.gs`, plus `Tests.gs` and the `validation/phase-1-5/` harness.

**Layering principles established and held for the entire build**:

- Send.gs never calls a mail provider directly — only `Email.gs` does.
- Retention.gs is structurally independent of Review/Send/Email — never
  calls them, never called by them.
- Sheets.gs is the only module that touches `SpreadsheetApp` anywhere in
  the project.
- Every gate (consent, review status) is checked in code against live
  Sheet values, never trusted from submission-time state or left as a
  UI-only checkbox.

---

## 4. Lessons Learned

- **A modular Apps Script project, treated as real software, paid for
  itself immediately.** Splitting responsibility across small files
  (rather than one script) made the layering requirements in Batches
  4D-4F (gate independent of provider, retention independent of
  review/send) straightforward to enforce and to verify by `grep`, not
  just by convention.
- **A code-level backstop caught what a prompt alone couldn't guarantee.**
  `flagDrift_()` (Batch 4C) was requested explicitly because prompt
  instructions are not enforcement — and the pattern (prompt constraint +
  independent code check + mandatory human review) is now documented in
  docs/13-AI-GUIDELINES.md as the reference pattern for future AI work on
  this platform, not a one-off.
- **Batch boundaries mattered more than expected.** Splitting "gate"
  (4D) from "delivery" (4E) initially looked like unnecessary
  granularity, but it meant the gate could be proven to fail closed
  *before* any code existed that could actually email a patient — a
  stronger safety property than building both together.
- **A real code harness beats reasoning about code.** Batch 4G's
  decision to load the actual `.gs` source into a mocked runtime, rather
  than writing new assertions about what the code *should* do, caught
  the difference between a plausible-sounding claim and a proven one
  (see docs/26 §8's note on rewriting a vacuous assertion before
  counting it).
- **A documentation gap survived seven batches unnoticed.** docs/25 §12
  flagged docs/15-SECURITY-STANDARDS.md for a Phase-1.5 update from the
  plan's first version, and it was not actually done until Batch 4H
  caught it during closeout review. Lesson: a "documentation impact"
  table is only useful if something checks it against reality at the
  end, not just at each batch's own review.

---

## 5. Remaining Operational Work

Everything in this section is **deployment/operations work, not
software work**. No code should be written to close these — see
docs/28-DEPLOYMENT-READINESS.md for the full checklist:

1. Provision a real Google Workspace project and a test Google Sheet.
2. `clasp push` this project to that Workspace, bind it to the Sheet.
3. Deploy as a Web App with Workspace-domain-restricted access; confirm
   with a real non-Workspace account that it's actually rejected.
4. Set `OPENROUTER_API_KEY` in Script Properties.
5. Wire `/internal/consultation-summary.html`'s `WEB_APP_URL` to the
   deployed endpoint.
6. Run `installRetentionTrigger_()` once.
7. Work through every manual test step already written into
   `apps-script/README.md` (submission, AI, review, send, retention) —
   against the live deployment this time, not the mocked harness.
8. Run the one real, consenting-patient pilot docs/25 §10 requires.
9. Only then, check off the remaining docs/25 §10 boxes for real.

---

## 6. Outstanding Deployment Tasks

Tracked as an explicit checklist in docs/28-DEPLOYMENT-READINESS.md —
not duplicated here. Summary of what's still open: Workspace
configuration, live deployment, API key configuration, mail permission
verification, retention trigger installation, test Sheet creation,
domain-restriction verification, synthetic validation against the live
deployment, real-patient pilot approval, and final deployment approval.

---

## 7. Handoff into Phase 2

Per docs/20 §2's sequencing recommendation (reaffirmed here): **Phase 2A
(Login + My Health Journey shell) should not begin until docs/25 §10's
full Definition of Done is genuinely checked** — including the live
deployment and real-patient pilot items this document and docs/26
explicitly leave open.

What Phase 2A inherits from Phase 1.5, ready to reuse rather than
rebuild:

- The Google Sheets schema discipline (`Schema.gs`'s flat-column, stable-
  ID pattern) — docs/12's "design for migration to SQL" rule, proven in
  practice, not just specified.
- The AI safety pattern (prompt constraint + independent code check +
  mandatory human review) — directly reusable for Phase 2C's AI
  Summaries, per docs/13's worked-example note.
- The "gate independent of mechanism" architectural principle (Send.gs
  vs. Email.gs) — the same shape Phase 2's authenticated actions should
  follow: a hard-checked authorization gate, structurally separate from
  whatever the gated action actually does.
- A working, validated example of Apps Script treated as a real,
  modular software project, not a script — a template for how Phase 2's
  backend work should be structured from day one.

**This document does not authorize Phase 2A to begin.** That decision
depends on docs/25 §10's checklist being fully closed by a live
deployment and real pilot — operational work, not something this
closeout can complete on its own.
