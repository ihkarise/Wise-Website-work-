# 25 - Phase 1.5 Technical Implementation Plan
## Version 1.2 — 2026-07-02

> Status: **SOFTWARE COMPLETE (Batches 4A–4H).** Not yet deployed —
> deployment and a real-patient pilot remain open, per §10. See
> docs/27-PHASE-1.5-CLOSEOUT.md for the official closeout and
> docs/28-DEPLOYMENT-READINESS.md for the remaining operational checklist.
> Author role: Lead Software Architect.
> Authorizing input: Phase 1 Completion Review (docs/20-PRODUCT-ARCHITECTURE-REVIEW.md), accepted.
> Authorizing input: Architecture Readiness Review (Phase 1.5), accepted — all open
> decisions in the original §9 resolved below; findings incorporated without
> redesigning the architecture.
> This document is the binding technical specification for Phase 1.5. It expands
> docs/24-ROADMAP.md's five-line Phase 1.5 summary into an implementable plan and
> supersedes it in case of conflict.

---

# 0. Framing

Phase 1.5 is **not** My Health Journey. It is **not** Phase 2. It introduces **no
authentication** and **no patient-facing login**. Nothing built in Phase 1.5 stores
or displays Protected Health Information (PHI) behind a login, because no login
exists yet.

Phase 1.5 exists to answer one question with real infrastructure instead of a
diagram:

> **Can Wise's chosen backend pattern — Website/Admin action → Google Apps Script →
> Google Sheets → AI summary → Email delivery — actually work, safely, before any
> patient data or authentication depends on it?**

This is a deliberate, low-stakes dress rehearsal for the Phase 2 data architecture
already specified in docs/12-DATA-ARCHITECTURE.md and docs/09-PHASE-2-ARCHITECTURE.md.
Every component built here is reused, not replaced, in Phase 2A.

---

# 1. Objectives

1. **Prove the data pipeline end-to-end**: a real write path from a trigger event,
   through Google Apps Script, into Google Sheets, and back out again — under
   production conditions, at low stakes.
2. **Prove the AI summary pattern is safe and grounded**, per docs/13-AI-GUIDELINES.md
   and docs/22-WISE-KNOWLEDGE-ENGINE.md, before it is ever used with real patient
   clinical data in Phase 2C.
3. **Prove email delivery** (transactional, templated, doctor-reviewable before send)
   as the first real "system reaches out to a person" capability the platform has —
   closing part of the gap identified in docs/20 §3 ("THE GAP").
4. **Establish the Sheets schema discipline** now — normalized-ish columns, stable
   IDs, no ad-hoc per-patient tabs — so Phase 2 inherits a schema that survives a
   future SQL migration (docs/12: "design for migration to SQL without changing
   frontend APIs").
5. **Keep risk near zero.** No auth, no PHI, no public write access to Sheets, no
   irreversible action without a human-reviewed step.
6. **Produce a reusable component** doctors/staff will actually use post-launch
   (a real post-consultation summary email), not a throwaway test harness — so the
   validation work is not wasted effort.

---

# 2. Scope

## 2.1 In Scope

- One new internal (staff-only, not patient-facing) trigger mechanism to capture
  a post-consultation note.
- One Google Apps Script backend deployed as a Web App, acting as the only writer
  to Google Sheets.
- One Google Sheet, schema-designed per docs/12's future-SQL-migration rule.
- One AI summarization step (OpenRouter, per docs/01/docs/09 technology choice),
  strictly grounded in the doctor's submitted note — never inventing clinical
  content, per docs/13 and docs/22.
- One doctor-review checkpoint before any email sends (AI output is never sent
  to a patient unreviewed).
- One transactional email (visit-summary) sent via Apps Script `MailApp`/`GmailApp`.
- Audit logging of every pipeline step (submitted, summarized, reviewed, sent,
  failed) back into the Sheet, per docs/15's "audit logging" requirement.
- Backend testing: unit-level Apps Script tests + manual end-to-end validation
  with synthetic (non-real-patient) data before any real use.

## 2.2 Out of Scope (explicitly deferred to Phase 2)

- Patient login, authentication, sessions, or role-based access control.
- Any patient-facing dashboard, portal, or "My Health Journey" UI.
- Symptom Tracker, Personal Care Plan, Wise Digital Twin.
- Any page requiring a patient to authenticate to view their own data.
- Storage of full clinical records — Phase 1.5 stores only what is needed to
  send one summary email per consultation, not a growing patient record.
- SQL migration itself (only the schema discipline that makes a future migration
  possible is in scope now).
- Public website navigation/IA changes (unrelated to this workstream; tracked
  separately per docs/20 §1 and §6).

## 2.3 Explicit Non-Goals

- This is not a marketing/newsletter system.
- This is not a booking system replacement (contact.html's existing Netlify Forms
  booking flow is untouched).
- This is not a chatbot or public AI assistant.

---

# 3. What Phase 1.5 Is

A **staff-initiated, single-direction data pipeline**:

```
Doctor/Staff (post-consultation)
        │
        │  confirms patient consent for the summary email (§9.2)
        │  submits a short structured note
        │  (internal, staff-only entry point — a Workspace-restricted HTML
        │   form, §9.1 — NOT public, NOT patient-facing)
        ▼
Google Apps Script Web App  (doPost endpoint, staff-only, Workspace-authenticated)
        │
        │  1. validates + sanitizes input; requires patient_consent_confirmed
        │  2. writes row to Google Sheets (audit trail starts here)
        │  3. calls OpenRouter synchronously in the same execution (§9.5)
        │  4. writes draft summary back to the same row
        ▼
Google Sheets  (single source of truth for this pipeline)
        ▼
Doctor Review Checkpoint (manual approval — required, not optional)
        │
        │  5. doctor approves in a simple review view (Sheet-bound or minimal UI)
        ▼
Apps Script sends email (MailApp) — patient-friendly visit summary, HTML (§9.6)
        │
        │  6. delivery status logged back to the Sheet
        │  7. recipient_email purged automatically after the retention window (§9.3)
        ▼
        DONE — no further storage, no login, no ongoing record beyond the audit row
```

**Why staff-initiated, not patient-initiated:** docs/15-SECURITY-STANDARDS.md
requires "authenticated access only" for the *patient portal*. Phase 1.5 has no
patient portal — so it must not create a de facto one. Keeping the trigger on the
staff side (something a doctor/admin does after a real consultation) means no
public endpoint ever accepts unauthenticated write access tied to a real patient's
identity. This is the single most important safety property of this design and
should not be relaxed without revisiting docs/15.

---

# 4. What Phase 1.5 Is Not

- Not an authentication system, not even a lightweight one. Staff-side access is
  restricted by **Workspace-domain-restricted deployment** of the entry point
  (§9.1) — not by building patient-style login.
- Not a place where patients view anything. The only patient-facing artifact is
  a one-time email they receive; there is no page for them to visit or log into.
- Not the AI Guidance / public chatbot experience described in docs/21. No public
  AI interaction is introduced here.
- Not a redesign of the booking form, navigation, or any existing public page.
- Not a performance, SEO, or accessibility initiative — those standards
  (docs/07, docs/14, docs/16) still apply to any public-facing surface touched,
  but Phase 1.5's primary surface is a backend pipeline, not new public pages.

---

# 5. Data Architecture

## 5.1 Google Sheet — `Phase1.5_ConsultationSummaries`

Designed against docs/12's standing rule: *treat a future SQL migration as a
certainty*. Columns are flat, typed by convention, and every row has a stable ID.

| Column | Type | Notes |
|---|---|---|
| `record_id` | string (UUID) | Stable primary key. Never reused. This is the row's permanent identity across any future migration. |
| `created_at` | ISO 8601 timestamp | Set by Apps Script, not client-supplied. |
| `condition_slug` | string | Reuses the canonical condition IDs already in production (`mcas`, `hashimotos-thyroiditis`, `chronic-urticaria`, etc.), per docs/20 §5's "the slug is the ID" decision — already locked by that prior review. |
| `staff_submitted_note` | text | Free-text doctor input. Source of truth for the AI step — nothing else feeds the AI. Staff guidance (§9.2) restricts this field to consultation-summary content only — no lab values, no full patient name, no history beyond what belongs in a visit summary. |
| `patient_consent_confirmed` | boolean | Set `true` only if staff confirms verbal/written consent was obtained for this specific pilot email. Hard gate — see §9.2. |
| `consent_confirmed_by` | string | Staff identifier who confirmed consent. Same identifier space as `reviewed_by`. |
| `recipient_email` | string | Patient email address. Purged per the retention rule in §9.3 — not retained indefinitely. |
| `ai_summary_draft` | text | AI-generated patient-friendly summary. Never sent until reviewed. |
| `ai_model_used` | string | Model identifier, for audit/reproducibility. Fixed for Phase 1.5 — see §9.4. |
| `review_status` | enum | `pending_review` / `approved` / `rejected` / `edited_and_approved` |
| `reviewed_by` | string | Doctor/staff identifier (name or email — internal, not a patient identifier). |
| `reviewed_at` | ISO 8601 timestamp | Null until reviewed. |
| `email_status` | enum | `not_sent` / `sent` / `failed` |
| `email_sent_at` | ISO 8601 timestamp | Null until sent. |
| `error_log` | text | Any pipeline failure detail, per docs/15 audit logging. |
| `purged_at` | ISO 8601 timestamp | Set by the automated retention job (§9.3) when `recipient_email` is cleared. Null until purge runs. |

No patient name, phone number, or free-text medical history beyond the doctor's
own note is stored in a way that couples it to a public-facing identity. Recipient
email address is stored only as long as needed to send and is purged automatically
per the retention rule locked in §9.3, consistent with docs/12's "minimal data
collection" principle.

## 5.2 Data Flow Diagram

Processing is **synchronous within a single `doPost` execution** (locked in §9.5;
see rationale there) — the diagram below reflects one Apps Script run per
submission, not a separate asynchronous trigger:

```
[Staff entry point] --POST--> [Apps Script doPost]
                                     │  1. validate + sanitize input
                                     │  2. write row (record_id, created_at,
                                     │     condition_slug, staff_submitted_note,
                                     │     patient_consent_confirmed, consent_confirmed_by)
                                     │  3. call OpenRouter (ai_model_used, §9.4)
                                     │     within the same execution
                                     │  4. write ai_summary_draft
                                     ▼
                          [Google Sheet row — pending_review]
                                     │
                          [staff reviews + approves in Sheet]
                                     │
                          [Apps Script send function — gated on
                           review_status = approved/edited_and_approved
                           AND patient_consent_confirmed = true]
                                     │
                          [Apps Script MailApp send]
                                     │
                          [email_status update; recipient_email
                           scheduled for automated purge, §9.3]
```

This mirrors docs/12's mandated flow (`Website → Apps Script → Google Sheets →
AI (when needed) → Patient View`) exactly, substituting "Patient View" with
"Patient Email" — the only patient-facing artifact Phase 1.5 produces.

---

# 6. AI Usage — Boundaries

Per docs/13-AI-GUIDELINES.md and docs/22-WISE-KNOWLEDGE-ENGINE.md:

- The AI step **only rephrases and organizes** the doctor's own submitted note
  into plain, patient-friendly language. It does not consult the Knowledge Engine,
  does not add clinical content, and does not answer questions.
- The AI **must never**: diagnose, prescribe, suggest treatment changes, or
  state anything not present in `staff_submitted_note`.
- The AI output is a **draft only**. It is never emailed without doctor approval
  (`review_status = approved` or `edited_and_approved`) **and** confirmed patient
  consent (`patient_consent_confirmed = true`). Both are hard gates in the Apps
  Script send function, not UI suggestions — the send function must refuse to run
  unless both conditions hold.
- Prompt design constrains the model to summarization-only behavior and rejects/
  flags any output that introduces content not traceable to the source note
  (implementation detail for the build phase, specified here as a requirement).
- **Model selection (locked, §9.4):** Phase 1.5 uses a single fixed OpenRouter
  model — `anthropic/claude-haiku-4.5` — for all summarization calls. Rationale:
  low per-call cost appropriate to pilot volume, strong plain-language rewriting
  quality, and a stable, pinned model identifier that keeps `ai_model_used`
  meaningful for audit/reproducibility (§5.1). The model is not swapped mid-pilot;
  changing it requires a documented decision, not a silent config change.

---

# 7. Security Plan (mapped to docs/15-SECURITY-STANDARDS.md)

| docs/15 requirement | Phase 1.5 implementation |
|---|---|
| HTTPS everywhere | Apps Script Web App and all endpoints are HTTPS by default (Google-enforced). |
| Least privilege | Apps Script service account scoped only to this Sheet and Gmail send; no broader Drive/Sheets access requested. |
| Secure Apps Script endpoints | Web App deployed with execute-as-owner. Staff entry point is a Google Workspace-restricted HTML form (§9.1) — deployment access set to "Anyone within [clinic Workspace domain]," not "Anyone with the link," so the write path requires an authenticated clinic Google account even though there is no patient-facing login. No public "anyone can POST" endpoint. |
| Input validation | All fields validated/sanitized server-side in `doPost` before writing to Sheets (length limits, type checks, no raw HTML injected into email templates). |
| No secrets in frontend | OpenRouter API key stored in Apps Script Properties Service, never in client-side code. |
| Environment separation | A separate test Sheet + test Apps Script deployment used for validation (§8) before any real-note is processed. |
| Audit logging | Every pipeline stage logged in-row (§5.1): submitted → summarized → reviewed → sent/failed, plus consent confirmation and retention purge (§9.2, §9.3). |
| Regular dependency review | N/A for Apps Script (no npm dependencies); OpenRouter API version pinned and reviewed. |
| Patient portal: authenticated access, session expiration, RBAC | Not applicable — Phase 1.5 has no patient portal by design (§3, §4). The staff entry point is the only write surface, requires an authenticated clinic Workspace account per the row above, and is treated as internal tooling, not a portal. |
| Data minimization / retention | Automated time-driven Apps Script trigger clears `recipient_email` after the retention window (§9.3) and stamps `purged_at` — not a manual step. |

---

# 8. Testing & Validation Plan

1. **Synthetic data first.** All initial pipeline runs use fabricated
   condition/notes/email addresses (test inboxes) — no real patient is emailed
   until the full pipeline has been validated end-to-end at least once.
2. **Unit-level checks** on the Apps Script functions: input validation, Sheet
   write correctness, AI-call error handling (including OpenRouter timeouts/
   failures), email template rendering.
3. **Failure-path testing**: what happens if the AI call fails, if Sheets write
   fails, if email send fails — every failure must land in `error_log` /
   `email_status = failed`, never silently drop.
4. **Manual doctor review dry run**: at least one real staff member walks through
   the review-and-approve step before it's considered validated.
5. **One real, low-stakes pilot** with an actual (consenting) recent patient,
   reviewed manually at every stage, before this is treated as "working."
6. **Backend testing checklist** (per docs/24's explicit Phase 1.5 line item):
   sign-off requires all of the above passing, not just "it ran once."

---

# 9. Locked Decisions

All items previously listed as Open Decisions have been resolved per the
Architecture Readiness Review (Phase 1.5) and are now locked. None of these
resolutions change the architecture described in §3–§6 — they close gaps in
an already-approved design, per docs/00's escalation rule ("if implementation
conflicts with Product Vision: stop, explain, recommend"). Changing any locked
item below after implementation starts requires re-running that escalation,
not a silent edit.

## 9.1 Staff entry point mechanism — LOCKED

A single unlisted HTML form (matches existing tech stack, no new tooling),
posting to the Apps Script Web App. The Web App deployment is configured with
access set to **"Anyone within [clinic Workspace domain]"** — not "Anyone with
the link" — so submission requires an authenticated clinic Google Workspace
account, not just knowledge of the URL. This closes the readiness review's
finding that "unlisted" alone is an access-control assumption, not a control.
A Google Form and direct Sheet edit remain rejected for the reasons already
stated (schema/validation control).

## 9.2 Consent capture mechanism — LOCKED

Consent is captured as a required field on the staff entry form, not assumed
verbally. The form requires the submitting staff member to check a
"Patient has consented to receive this visit summary by email" confirmation
before the form will submit. This writes `patient_consent_confirmed = true`
and `consent_confirmed_by = <staff identifier>` to the row (§5.1). The email
send function is hard-gated on `patient_consent_confirmed = true` in addition
to `review_status`, mirroring the existing review-status gate in §6 — consent
is enforced in Apps Script logic, not left as a UI-only checkbox. Staff
guidance for `staff_submitted_note` is also locked here: the field is for
visit-summary content only (what was discussed, next steps) — not lab values,
not full case history — keeping the row consistent with §2.2's "not a growing
patient record" scope.

## 9.3 Email retention policy — LOCKED

`recipient_email` is retained for **14 days** after `email_sent_at`, then
cleared automatically by a time-driven Apps Script trigger (not a manual
step), which also stamps `purged_at` (§5.1). Fourteen days covers the
realistic window for a bounced-delivery follow-up or a patient support query
about the email, without indefinite retention of PII. This is a Phase-1.5-only
policy for pilot-scale volume; Phase 2 will define real patient data retention
under its own authenticated data model and is not bound by this window.

## 9.4 AI model selection — LOCKED

`anthropic/claude-haiku-4.5` via OpenRouter, fixed for all Phase 1.5
summarization calls (rationale and guardrails in §6). Not swapped mid-pilot.

## 9.5 Synchronous vs. asynchronous processing — LOCKED

**Synchronous.** Validation, Sheet write, and the OpenRouter summarization
call all run within a single `doPost` execution (§5.2, §3), rather than a
separate `onEdit`/time-driven trigger reading the row after the fact. At
Phase 1.5's pilot volume (staff-paced, one submission at a time), synchronous
processing removes an entire class of "did the async trigger fire yet"
ambiguity from both testing (§8) and the Definition of Done (§10), and is
strictly simpler to reason about and to audit. If Phase 2 volume later
requires asynchronous processing, that is a Phase 2 decision made against
Phase 2's actual load, not inherited by default from here.

## 9.6 PDF vs. HTML email — LOCKED

HTML-first, per the plan's original default. docs/20 §2's PDF proposal is not
abandoned — it remains a valid fast-follow once the pilot validates the
underlying concept — but is explicitly out of scope for Phase 1.5 itself, so
it does not gate this plan's approval.

## 9.7 Who counts as "staff" — LOCKED (sunset condition)

Access control for the entry point is the Workspace-domain restriction in
§9.1, not "don't share the URL." That resolves the original concern that
access control was obscurity-only. The upgrade trigger already implied by
docs/20 §2's sequencing stands: real patient login/RBAC is introduced at
Phase 2A, not before — Phase 1.5's Workspace-restricted form is sufficient
for its own scope and is not extended into a general-purpose internal tool.

---

# 10. Success Criteria — Definition of Done for Phase 1.5

All items in §9 are locked as of this version — implementation may begin.
Phase 1.5 is complete when:

- [ ] The staff entry point (§9.1) is deployed with Workspace-domain-restricted
      access, confirmed not reachable by "anyone with the link."
- [ ] The consent checkbox (§9.2) is confirmed to hard-block submission when
      unchecked, and hard-blocks send when `patient_consent_confirmed` is false.
- [ ] The automated retention purge trigger (§9.3) is deployed and verified to
      clear `recipient_email` and stamp `purged_at` after 14 days.
- [ ] The full pipeline (§5.2) has run successfully end-to-end with synthetic data,
      using the locked model (§9.4) and synchronous flow (§9.5).
- [ ] The full pipeline has run successfully with at least one real, consenting
      patient, with doctor review and the consent gate both exercised.
- [ ] Every failure mode in §8.3 has been tested and correctly logged.
- [ ] The Sheet schema (§5.1) has been reviewed against docs/12's SQL-migration
      rule and confirmed migration-safe.
- [ ] Security checklist (§7) fully checked off.
- [ ] No patient-facing authentication, login, or portal has been introduced.
- [ ] docs/12-DATA-ARCHITECTURE.md, docs/24-ROADMAP.md, and CHANGELOG.md are
      updated to reflect what was actually built (not just what was planned).
- [ ] A short retrospective note is added here (§11, once implementation starts)
      documenting any deviation from this plan and why.

Only once these are met should Phase 2A (Login + My Health Journey shell) begin,
per docs/20 §2's sequencing recommendation.

**Status after Batch 4G (see §11 for full detail and `validation/phase-1-5/`
for the runnable evidence):**

- [ ] The staff entry point (§9.1) is deployed with Workspace-domain-restricted
      access, confirmed not reachable by "anyone with the link." **Not yet
      verifiable from this environment — requires a live deployment and two
      real Google accounts (one in the Workspace domain, one outside it).**
- [x] The consent checkbox (§9.2) is confirmed to hard-block submission when
      unchecked, and hard-blocks send when `patient_consent_confirmed` is false.
      **Verified two ways in Batch 4G: submission rejected (400) when unchecked,
      and — a stronger check — send blocked even when `review_status` is already
      `approved` if `patient_consent_confirmed` is separately tampered to `false`
      directly in the row.**
- [ ] The automated retention purge trigger (§9.3) is deployed and verified to
      clear `recipient_email` and stamp `purged_at` after 14 days. **Purge
      *logic* fully verified (idempotent, correct 14-day boundary math, safe
      partial failure) against the real committed code. The *live time-driven
      trigger actually firing on schedule* still requires
      `installRetentionTrigger_()` to be run in a real deployment and checked
      back on.**
- [x] The full pipeline (§5.2) has run successfully end-to-end with synthetic data,
      using the locked model (§9.4) and synchronous flow (§9.5). **Verified in
      Batch 4G — see "E2E: ..." checks in `validation/phase-1-5/validate.js`.**
- [ ] The full pipeline has run successfully with at least one real, consenting
      patient, with doctor review and the consent gate both exercised. **Cannot
      be done from this environment — requires a live deployment and a real
      patient. Remains open.**
- [x] Every failure mode in §8.3 has been tested and correctly logged. **All
      three named modes verified in Batch 4G: AI-call failure (missing key and
      provider HTTP error), Sheets-write failure (both at initial submission and
      during retention), and email-send failure — every one lands in `error_log`/
      `email_status = failed` and none silently drops.**
- [x] The Sheet schema (§5.1) has been reviewed against docs/12's SQL-migration
      rule and confirmed migration-safe. **Design review, not runtime-testable:
      flat columns, a stable UUID `record_id`, no per-patient tabs — matches
      docs/12's rule as designed since Batch 4A.**
- [ ] Security checklist (§7) fully checked off. **Code-level items confirmed
      (input validation, no secrets in frontend, audit logging). Deployment-only
      items (HTTPS by default, Workspace-domain access, environment separation)
      remain open pending live deployment.**
- [x] No patient-facing authentication, login, or portal has been introduced.
      **Confirmed by design across every batch — no such code exists anywhere
      in `apps-script/` or `internal/`.**
- [x] docs/12-DATA-ARCHITECTURE.md, docs/24-ROADMAP.md, and CHANGELOG.md are
      updated to reflect what was actually built (not just what was planned).
- [x] A short retrospective note is added here (§11) documenting any deviation
      from this plan and why.

**Phase 1.5 is not yet marked done.** Every item this environment could verify
without a live Google Workspace deployment has been verified and is checked
above. The remaining open items are all live-deployment-dependent (Workspace
access restriction, live trigger firing, real OpenRouter/MailApp calls, and
the required real-patient pilot) and must be completed by whoever deploys this
project, per the checklist above and `validation/phase-1-5/README.md`'s
"What this does NOT prove" section, before Phase 2A begins.

---

# 11. Implementation Notes (to be filled in during/after build)

## Batch 4A (complete)

Built as a modular Apps Script project under `apps-script/` (`Code.gs`,
`Config.gs`, `Schema.gs`, `Validation.gs`, `Sheets.gs`, `Logger.gs`,
`Utils.gs`, `Tests.gs`) rather than a single script file, per an
implementation-time decision to treat it as a real software project — not
a deviation from this plan's architecture, just an internal-structure
choice. Full module responsibilities in `apps-script/README.md`.

Pre-merge review caught and fixed two issues: `Config.gs`'s condition-slug
allowlist was initially missing `dermographism` (an 8th canonical slug
already live on `/conditions/`); and Apps Script Web Apps cannot return
real HTTP status codes (always transport as 200) — the README and
`Utils.gs` now document that callers must check the JSON body's `status`
field.

**Repository-structure review (pre-4B):** considered whether any Batch 4A
module (condition taxonomy, validation constants, schema, utilities)
should move to a future shared/ directory usable by both the Apps Script
project and the static site. Decision: not yet. The repo has no build
step or JS module system that would let a browser context and the Apps
Script (V8/GAS) runtime actually share a file without new tooling, and
none of the candidates has a second real consumer today — the public
site's condition references are hand-authored HTML anchors, not
data-driven. Revisit if/when frontend rendering becomes template- or
data-driven (e.g., if dedicated condition pages move off hand-authored
HTML).

## Batch 4B (complete)

Added `/internal/consultation-summary.html` — a standalone static page
(not linked from any public nav, not in `sitemap.xml`, `<meta
name="robots" content="noindex, nofollow">`) that POSTs to the Batch 4A
Web App. Submits with `Content-Type: text/plain` to avoid a CORS
preflight (Apps Script's `doPost` parses the body as JSON regardless of
declared content type). The consent checkbox disables the Submit button
client-side as a UX convenience only — the enforced gate remains
server-side in `Validation.gs`, unchanged from Batch 4A. Real access
control is still the Web App's Workspace-domain deployment restriction
(§9.1), not the page's unlisted URL.

The condition dropdown's option list is hand-duplicated from
`apps-script/Config.gs`'s `ALLOWED_CONDITION_SLUGS` (see the
repository-structure review above) — both are commented to point at each
other; there is no automated sync yet.

## Batch 4C (complete)

Added `apps-script/Ai.gs`, called synchronously from `Code.gs` after the
row write succeeds (§9.5). Per an explicit implementation-time
requirement, the AI step is treated as a **normalization layer, not a
content-generation layer**: it may only rephrase `staff_submitted_note`
into plain language, and must never add a diagnosis, recommendation,
investigation, medicine, reassurance, or conclusion absent from the
source note. Every output sentence must be traceable to the note; missing
information is omitted, never inferred.

This is enforced two independent ways (both required, neither sufficient
alone):
- **Prompt** — `SUMMARY_SYSTEM_PROMPT_`, nine explicit numbered rules
  covering each prohibited category plus "omit rather than infer."
- **Implementation** — `flagDrift_()`, a code-level check that (a) scans
  for prohibited-category lexicon matches present in the summary but
  absent from the note, and (b) flags any summary sentence whose word
  overlap with the note's vocabulary falls below 0.3. Flags are written
  to `error_log` (prefixed `AI_REVIEW_FLAGS:`) for the doctor reviewer
  built in Batch 4D — never auto-blocking, since no send capability
  exists until 4D/4E and both remain gated on human review regardless.

Model: `anthropic/claude-haiku-4.5` via OpenRouter, `temperature: 0`, per
the already-locked §9.4 decision. API key read from Script Properties
only (`OPENROUTER_API_KEY`), never committed to the repo. An AI-call
failure (missing key, OpenRouter error, timeout) never undoes the row
already written by 4A — `ai_summary_draft` is left empty, the failure is
logged to `error_log`, and the submission still returns success to
staff, consistent with §8.3's failure-path requirement.

`docs/13-AI-GUIDELINES.md` updated with this as a worked example / future
reference pattern for AI usage elsewhere in the platform.

## Small refactor after 4C (before 4D)

Extracted the prompt specification out of `Ai.gs`'s inline comments into
`apps-script/PROMPTS.md` — a standalone, version-controlled document
(Prompt Version, Purpose, Inputs, Outputs, Safety Rules, Forbidden
Behaviours, Traceability Principles, Future Evolution Notes). `Ai.gs`
now carries a `PROMPT_VERSION_` constant and a comment pointing at
`PROMPTS.md` as canonical; `SUMMARY_SYSTEM_PROMPT_`'s wording and
`flagDrift_()`'s logic are unchanged — this was a documentation move,
not a redesign. The only runtime-visible change is the prompt version
number now appearing in the `summarized` execution-log line
(`Logger.log`, not the Sheet or API response) — everything else is
functionally identical to Batch 4C.

## Batch 4D (complete)

Doctor review implemented as **Sheet-bound**, per this document's own
§5.2 allowance ("a simple review view (Sheet-bound or minimal UI)")
rather than a second HTML/Web-App form. `apps-script/Review.gs` adds a
**Consultation Summaries** custom menu (`onOpen()`, a required exact
name for Apps Script's simple-trigger mechanism) with three actions —
approve as-generated, approve as-edited, reject — each writing
`review_status`/`reviewed_by`/`reviewed_at` on the selected row.
`reviewed_by` is captured from `Session.getActiveUser().getEmail()`
(the signed-in Workspace account), not free text.

`apps-script/Send.gs`'s `evaluateSendGate_()` is the single choke point
any future send path must pass through: both `patient_consent_confirmed
=== true` and an approved `review_status` are required, checked against
values re-read from the Sheet after review (not values captured at
submission time), so a manual edit made directly in the Sheet is still
caught. This batch deliberately proves the gate fails closed — six unit
tests (`Tests.gs`) plus a manual test re-reading a tampered
`patient_consent_confirmed` cell — without yet calling
MailApp/GmailApp. The scope split from the original batch breakdown:
4D proves the gate; 4E attaches the actual email template and delivery
call to it, per that plan's explicit dependency ("4E ... Dependencies:
Batch 4D (send function must exist to attach delivery to)").

`apps-script/README.md` updated with a "Review workflow" section and
matching manual-test steps.

## Batch 4E (complete)

Adds `apps-script/Email.gs` — the only module in the project permitted
to call a mail provider. Per an explicit implementation-time requirement,
`Send.gs` never calls `MailApp`/`GmailApp` directly; it calls `Email.gs`
instead, which is the sole caller of `MailApp.sendEmail()`:

```
Review.gs → Send.gs (evaluateSendGate_ / attemptSend_) → Email.gs (sendVisitSummaryEmail_) → MailApp
```

`Send.gs` gained `attemptSend_(row)`: re-checks `evaluateSendGate_()`,
and only if it passes, calls `Email.gs`, then writes
`email_status`/`email_sent_at` (success) or `email_status = failed` +
`error_log` (any failure — gate blocked or provider error) back to the
row, logging every outcome. `Review.gs` now calls `attemptSend_()` after
approval instead of the placeholder "not yet implemented" alert from
Batch 4D — no other code path changed.

`Email.gs`'s `buildVisitSummaryEmail_()` builds the HTML template (§9.6,
locked) using the site's existing color tokens. `ai_summary_draft` is
passed through a new `escapeHtml_()` helper (`Utils.gs`) before
embedding — defense in depth, since the AI's own output was never
sanitized the way `staff_submitted_note` was at submission.

This keeps the send *gate* independent of the delivery *mechanism*: a
future provider swap only touches `Email.gs`. Phase 1.5 uses `MailApp`
only, per this document's §3 diagram — no other provider was introduced,
and no scope was added beyond the layering itself.

`apps-script/README.md` updated with an "Email delivery layering"
section and expanded manual-test steps (send to a real test inbox,
confirm a tampered-consent row still doesn't send, force and verify a
delivery failure is logged, never a real patient address until §8's
full validation pass and Batch 4G).

## Batch 4F (complete)

Adds `apps-script/Retention.gs`, implementing the §9.3-locked policy:
`recipient_email` retained 14 days after `email_sent_at`, then cleared
automatically by a time-driven trigger, which stamps `purged_at`.

Per an explicit implementation-time requirement, this module is
structurally independent of `Review.gs`, `Send.gs`, and `Email.gs` — it
neither calls them nor is called by them — and is restricted to exactly
two columns:

- `purgeExpiredRecipientEmails_()` — the trigger entry point. Scans every
  row once (`Sheets.gs`'s new `getAllRowObjects_()`), and for each
  eligible row calls `updateRowByRecordId_()` with a hardcoded
  `{ recipient_email: '', purged_at: <timestamp> }` object — there is no
  code path in this file able to touch `staff_submitted_note`,
  `ai_summary_draft`, `review_status`, `reviewed_by`, `reviewed_at`,
  `email_status`, `email_sent_at`, or `error_log`.
- `isEligibleForPurge_(row, nowMs)` — pure, unit-tested eligibility
  check. A row qualifies only if `recipient_email` is non-empty,
  `purged_at` is not already set, and at least 14 days have passed since
  a valid `email_sent_at`. The `purged_at` check is what makes the whole
  operation **idempotent**: once set, a row can never be purged again,
  so running the trigger twice (or the same run overlapping itself) is
  always safe.
- Partial-failure handling: each row's write is wrapped in its own
  `try`/`catch` inside the scan loop — one row's Sheets-write failure is
  logged and the loop continues to the next row, never stopping the
  batch. A summary line (`purged=N skipped=N failed=N`) closes every run.
- `installRetentionTrigger_()` — one-time, idempotent setup run manually
  from the Apps Script editor; checks for an existing trigger before
  creating one, so it can be safely re-run without creating duplicates.

Verified against synthetic data (not just hand-reasoned): a 4-row
dataset (one purge-eligible, one too-recent, one already-purged, one
engineered to fail the Sheets write) run through
`purgeExpiredRecipientEmails_()` twice confirmed exactly the required
behavior — one purge, two correct skips, one logged-and-continued
failure on the first run; zero re-purges and the same persistent failure
correctly retried (not silently abandoned) on the second run; all
protected columns provably untouched throughout.

`apps-script/README.md` updated with a "Retention purge" section and
manual test steps (skip-when-too-recent, purge-when-eligible with
protected-column verification, idempotency-on-rerun, and
trigger-install idempotency).

## Batch 4G (complete — validation phase)

Per this batch's explicit scope: **no new features, no architectural
refactor, no code optimization.** Zero lines in `apps-script/` changed —
confirmed by `git status` showing only new files under `validation/`.
The objective was to prove the complete pipeline (staff submission →
validation → Sheet write → AI normalization → doctor review → gate
evaluation → email delivery → retention) works exactly as designed,
stage by stage and end to end, including every required failure mode.

**Method**: rather than reasoning about the code or re-testing only the
already-existing `Tests.gs` unit suite, built a small Node-only harness
(`validation/phase-1-5/harness.js`) that loads the real, unmodified
`apps-script/*.gs` source into a mocked Apps Script runtime (in-memory
Sheet; fake `PropertiesService`/`UrlFetchApp`/`MailApp`/`ScriptApp`/
`Session`) and drives it through synthetic scenarios
(`validation/phase-1-5/validate.js`). This is the strongest verification
available without a live Google Workspace deployment: it exercises the
actual committed code, not a reimplementation of its logic.

**Result: 37/37 checks passed** (the existing 26-test `Tests.gs` suite,
re-run through the same real-source harness, plus 36 new stage-level and
end-to-end checks). Coverage included, per this batch's explicit
requirements:

- Success path, full pipeline, twice (once through to a real send +
  20-days-later retention purge; once through a doctor rejection).
- Validation failures (missing consent, unknown condition slug,
  malformed JSON).
- AI failures (missing API key, provider HTTP error) — row still
  written, draft left empty, failure logged, submission still succeeds.
- Sheets-write failures — both at initial submission (500, no crash) and
  during retention (one row's failure logged and skipped, batch
  continues, that row's data left completely unmodified).
- Provider (email) failures — `email_status = failed` + `error_log`
  populated, no exception escapes.
- Consent failures — rejected at submission time, **and** a stronger
  check: blocked at send time even when `review_status` is already
  `approved`, if `patient_consent_confirmed` is tampered directly in the
  row (proving the gate reads live values, not submission-time state).
- Review failures (rejection) — `review_status = rejected`, zero calls
  to the mail provider.
- Retention failures — one row's write failure logged and skipped
  without stopping the batch; idempotency proven by running the purge
  twice and confirming zero re-purges.
- HTML injection: a synthetic AI draft containing `<script>` tags is
  confirmed escaped in the actual email body the code would send.

**What this does not prove** (see `validation/phase-1-5/README.md` for
the full list): Workspace-domain access restriction on a real
deployment, a real OpenRouter call, a real email actually arriving, the
real time-driven trigger firing on schedule, and the required real,
consenting-patient pilot. These remain open items in §10's Definition of
Done, to be completed by whoever deploys this project — not something
this environment can verify without live credentials.

docs/25 §10's checklist updated above to reflect exactly which items
this batch closes versus which stay open pending live deployment.

## Batch 4H (complete — closeout)

Per this batch's explicit scope: **documentation, validation closeout,
and project synchronization only** — no new features, no refactor, no
optimization, no Phase 2 work. Confirmed by `git diff` against
`apps-script/`, `internal/`, and `validation/`: empty. This is the only
batch in the Phase 1.5 sequence that touches nothing but `docs/`,
`apps-script/README.md`, and `CHANGELOG.md`.

Closed the one documentation gap this plan's own §12 table had flagged
but never fulfilled: docs/15-SECURITY-STANDARDS.md never received its
"Phase-1.5-specific security notes discovered during build" note despite
being listed since the plan's original version. Added now, cross-
referencing §7's existing mapping table rather than duplicating it.

Three new documents close out Phase 1.5 formally:

- **docs/26-PHASE-1.5-VALIDATION-REPORT.md** — the validation record:
  objectives, scope, what was implemented, methodology, every test
  category executed, results, and an explicit, honest list of what
  remains open pending live deployment. Supersedes scattered validation
  notes across §10/§11 as the single canonical validation record.
- **docs/27-PHASE-1.5-CLOSEOUT.md** — the official closeout: original
  objectives against what shipped, deliverables, architecture delivered,
  lessons learned, remaining operational work, and the handoff into
  Phase 2A.
- **docs/28-DEPLOYMENT-READINESS.md** — an operational checklist (not a
  software task list) for whoever deploys this project: Workspace setup,
  `clasp push`, API keys, trigger installation, domain-restriction
  verification, and real-pilot approval.

**Distinction preserved throughout, per explicit requirement**:
*Software Complete* (true — all of Batches 4A-4G's code and validation
work is done and merged) is not the same as *Deployment Complete* or
*Operational Complete* (both false — no live Google Workspace
deployment exists yet, and no real patient has been contacted). Nothing
in this batch claims otherwise.

---

# 12. Documentation Impact

Per docs/00's Living Documentation Policy — all closed as of Batch 4H:

| Doc | Update needed | Status |
|---|---|---|
| docs/12-DATA-ARCHITECTURE.md | Record the actual Sheet schema and Apps Script endpoint shape once built. | Done — Batch 4A |
| docs/24-ROADMAP.md | Mark Phase 1.5 line items complete as they land. | Done — updated every batch |
| docs/15-SECURITY-STANDARDS.md | Add any Phase-1.5-specific security notes discovered during build. | Done — Batch 4H |
| docs/13-AI-GUIDELINES.md | Record the summarization prompt boundaries as a concrete example, if useful for Phase 2C. | Done — Batch 4C |
| CHANGELOG.md | Standard entry once shipped. | Done — every batch |
| docs/26-PHASE-1.5-VALIDATION-REPORT.md | New — the canonical validation record. | Done — Batch 4H |
| docs/27-PHASE-1.5-CLOSEOUT.md | New — the official Phase 1.5 closeout. | Done — Batch 4H |
| docs/28-DEPLOYMENT-READINESS.md | New — the operational deployment checklist. | Done — Batch 4H |

---

# 13. Guiding Check

Before building anything under this plan, re-confirm against docs/21's final
principle:

> Does this help patients recover, understand their health better, and remain
> connected to trusted care without creating unnecessary dependency?

A doctor-reviewed, plain-language visit summary emailed after a real consultation
passes this test directly — it is care continuity, not a feature for its own sake.
