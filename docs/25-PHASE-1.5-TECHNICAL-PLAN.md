# 25 - Phase 1.5 Technical Implementation Plan
## Version 1.0 — 2026-07-02

> Status: PROPOSED — awaiting approval before any implementation begins.
> Author role: Lead Software Architect.
> Authorizing input: Phase 1 Completion Review (docs/20-PRODUCT-ARCHITECTURE-REVIEW.md), accepted.
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
        │  submits a short structured note
        │  (internal, staff-only entry point — NOT public, NOT patient-facing)
        ▼
Google Apps Script Web App  (doPost endpoint, staff-only trigger)
        │
        │  1. validates + sanitizes input
        │  2. writes row to Google Sheets (audit trail starts here)
        ▼
Google Sheets  (single source of truth for this pipeline)
        │
        │  3. Apps Script reads the new row
        ▼
AI Summary Step (OpenRouter call, grounded strictly in the submitted note)
        │
        │  4. writes draft summary back to the same row
        ▼
Doctor Review Checkpoint (manual approval — required, not optional)
        │
        │  5. doctor approves in a simple review view (Sheet-bound or minimal UI)
        ▼
Apps Script sends email (MailApp) — patient-friendly visit summary, PDF or HTML
        │
        │  6. delivery status logged back to the Sheet
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

- Not an authentication system, not even a lightweight one. If staff-side access
  needs restricting, that is handled by **not publishing the internal entry point**
  (unlisted, non-indexed, shared only with clinic staff) — not by building login.
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
| `condition_slug` | string | Reuses the canonical condition IDs already in production (`mcas`, `hashimotos-thyroiditis`, `chronic-urticaria`, etc.), per docs/20 §5's "the slug is the ID" decision. |
| `staff_submitted_note` | text | Free-text doctor input. Source of truth for the AI step — nothing else feeds the AI. |
| `ai_summary_draft` | text | AI-generated patient-friendly summary. Never sent until reviewed. |
| `ai_model_used` | string | Model identifier, for audit/reproducibility. |
| `review_status` | enum | `pending_review` / `approved` / `rejected` / `edited_and_approved` |
| `reviewed_by` | string | Doctor/staff identifier (name or email — internal, not a patient identifier). |
| `reviewed_at` | ISO 8601 timestamp | Null until reviewed. |
| `email_status` | enum | `not_sent` / `sent` / `failed` |
| `email_sent_at` | ISO 8601 timestamp | Null until sent. |
| `error_log` | text | Any pipeline failure detail, per docs/15 audit logging. |

No patient name, phone number, or free-text medical history beyond the doctor's
own note is stored in a way that couples it to a public-facing identity. Recipient
email address is stored only as long as needed to send, consistent with docs/12's
"minimal data collection" principle — this is revisited explicitly in §9 (Open
Decisions) because it is the one place this plan touches PII and deserves an
explicit retention decision before build.

## 5.2 Data Flow Diagram

```
[Staff entry point] --POST--> [Apps Script doPost] --write--> [Google Sheet row]
                                                                     │
                                                        [Apps Script onEdit/
                                                         time-driven trigger]
                                                                     │
                                                          [OpenRouter API call]
                                                                     │
                                                        [write ai_summary_draft]
                                                                     │
                                                     [staff reviews + approves]
                                                                     │
                                                        [Apps Script MailApp]
                                                                     │
                                                          [email_status update]
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
  (`review_status = approved` or `edited_and_approved`). This is a hard gate in
  the Apps Script logic, not a UI suggestion — the send function must refuse to
  run if `review_status` is not an approved state.
- Prompt design constrains the model to summarization-only behavior and rejects/
  flags any output that introduces content not traceable to the source note
  (implementation detail for the build phase, specified here as a requirement).

---

# 7. Security Plan (mapped to docs/15-SECURITY-STANDARDS.md)

| docs/15 requirement | Phase 1.5 implementation |
|---|---|
| HTTPS everywhere | Apps Script Web App and all endpoints are HTTPS by default (Google-enforced). |
| Least privilege | Apps Script service account scoped only to this Sheet and Gmail send; no broader Drive/Sheets access requested. |
| Secure Apps Script endpoints | Web App deployed with execute-as-owner, access restricted to the staff entry point only; no public "anyone can POST" endpoint. |
| Input validation | All fields validated/sanitized server-side in `doPost` before writing to Sheets (length limits, type checks, no raw HTML injected into email templates). |
| No secrets in frontend | OpenRouter API key stored in Apps Script Properties Service, never in client-side code. |
| Environment separation | A separate test Sheet + test Apps Script deployment used for validation (§8) before any real-note is processed. |
| Audit logging | Every pipeline stage logged in-row (§5.1): submitted → summarized → reviewed → sent/failed. |
| Regular dependency review | N/A for Apps Script (no npm dependencies); OpenRouter API version pinned and reviewed. |
| Patient portal: authenticated access, session expiration, RBAC | Not applicable — Phase 1.5 has no patient portal by design (§3, §4). The staff entry point is the only write surface and is treated as internal tooling, not a portal. |

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

# 9. Open Decisions (require stakeholder confirmation before build starts)

These are architecturally significant enough that this plan flags them rather
than deciding unilaterally, per docs/00's escalation rule ("if implementation
conflicts with Product Vision: stop, explain, recommend"):

1. **Staff entry point mechanism** — recommend a simple unlisted HTML form
   (matches existing tech stack, no new tooling) posting to the Apps Script Web
   App, rather than a Google Form (harder to control schema/validation) or a
   direct Sheet edit (no server-side validation). Needs sign-off.
2. **Email address retention** — recommend storing the recipient email only in
   the row needed to send, with a defined manual purge cadence, until Phase 2
   defines real patient data retention policy. Needs sign-off on retention window.
3. **Who counts as "staff"** — no auth exists, so access control is entirely
   "don't share the URL." Acceptable for a pilot; needs an explicit sunset date
   or upgrade trigger (e.g., "must gain real access control before N pilots" or
   "before Phase 2A begins").
4. **PDF vs HTML email** — docs/20 §2 specifically proposes a PDF visit summary;
   this plan defaults to HTML-first (simpler, no PDF-generation dependency) with
   PDF as a fast-follow if the pilot validates the concept. Needs confirmation
   this doesn't undercut the original intent.

---

# 10. Success Criteria — Definition of Done for Phase 1.5

Phase 1.5 is complete when:

- [ ] The full pipeline (§5.2) has run successfully end-to-end with synthetic data.
- [ ] The full pipeline has run successfully with at least one real, consenting
      patient, with doctor review at the gate.
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

---

# 11. Implementation Notes (to be filled in during/after build)

_Not yet started. This section will record actual sequencing, deviations from
this plan, and validation results once implementation is authorized._

---

# 12. Documentation Impact

Per docs/00's Living Documentation Policy, completing Phase 1.5 will require
updates to:

| Doc | Update needed |
|---|---|
| docs/12-DATA-ARCHITECTURE.md | Record the actual Sheet schema and Apps Script endpoint shape once built. |
| docs/24-ROADMAP.md | Mark Phase 1.5 line items complete as they land. |
| docs/15-SECURITY-STANDARDS.md | Add any Phase-1.5-specific security notes discovered during build. |
| docs/13-AI-GUIDELINES.md | Record the summarization prompt boundaries as a concrete example, if useful for Phase 2C. |
| CHANGELOG.md | Standard entry once shipped. |

---

# 13. Guiding Check

Before building anything under this plan, re-confirm against docs/21's final
principle:

> Does this help patients recover, understand their health better, and remain
> connected to trusted care without creating unnecessary dependency?

A doctor-reviewed, plain-language visit summary emailed after a real consultation
passes this test directly — it is care continuity, not a feature for its own sake.
