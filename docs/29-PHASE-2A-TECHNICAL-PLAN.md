# 29 - Phase 2A Technical Implementation Plan
## Version 1.0 — 2026-07-02

> Status: **PLANNING — NOT YET APPROVED FOR IMPLEMENTATION.** No code has been written
> against this plan. Batch 5A (§13) has not begun. This document consolidates and
> supersedes docs/09-PHASE-2-ARCHITECTURE.md's and docs/24-ROADMAP.md's Phase 2A
> sections where they conflict with the decisions below (see docs/32-ARCHITECTURE-REVIEW.md
> for the full list of what's superseded and why). It does not replace docs/09 as the
> long-term Phase 2/2B/2C vision — only its Phase 2A scope and mechanism.
> Author role: Lead Software Architect.
> Governs by: docs/30-ARCHITECTURE-PRINCIPLES.md and the ADRs indexed in
> docs/31-ADR-INDEX.md. Every architectural choice below cites the ADR that binds it.
> Authorizing input: Phase 1.5 Closeout (docs/27), accepted. Awaiting explicit approval
> to begin implementation — this document alone does not authorize Batch 5A.

---

# 0. Framing

Phase 2A is the platform's first authenticated, patient-facing surface. Everything
built in Phase 1.5 was staff-only, unauthenticated by design (docs/25 §3: "Why
staff-initiated, not patient-initiated"). Phase 2A is the deliberate, first crossing of
that line — which is exactly why this plan exists as a frozen, reviewed document before
any code is written, per this session's explicit purpose.

**What Phase 2A is:** a secure patient portal — login, a dashboard shell, a read-only
health timeline, consultation history, report upload, and a symptom logger (v1). This
consolidates what docs/09 originally split across "Phase 2A" (Login + My Health
Journey shell) and part of "Phase 2B" (Symptom Tracker, Document Vault) into one
delivery phase — a deliberate scope decision, recorded and justified in
docs/32-ARCHITECTURE-REVIEW.md, not a silent expansion.

**What Phase 2A is not:**
- Not the Digital Twin (docs/09/docs/21 — Phase 2C).
- Not WiseOS (docs/24 — Phase 3).
- Not an AI chatbot or AI assistant of any kind. **No AI is used anywhere in this
  phase.** Symptom Tracker and Reports are pure data capture and display.
- Not the Personal Care Plan — no architecture for it exists yet, and per ADR-008 a
  phase should not bundle a feature that hasn't been designed (see docs/32's roadmap
  recommendation).
- Not a redesign of the public website, its navigation (until Batch 5G specifically),
  or any existing page.

---

# 1. Objectives

1. Give existing patients a secure, authenticated place to see their own care
   history — nothing more, nothing speculative.
2. Prove that the Sheets + Apps Script backend pattern, already validated for a
   staff-only pipeline in Phase 1.5, extends safely to **authenticated, per-patient**
   data — the harder trust boundary this platform has not yet crossed.
3. Establish the identity/authentication separation (ADR-002, ADR-003) as working
   infrastructure, not just a documented principle — everything patient-facing after
   this phase depends on getting this right once, here.
4. Ship the smallest genuinely useful v1: login, dashboard, timeline, consultation
   history, symptom log, report upload. Explicit non-goals stay explicit (§0).
5. Every objective is measured against docs/21's final principle: does this help the
   patient understand their health and stay connected, without creating dependency? An
   honest "coming soon" empty state (docs/04) passes that test better than a
   half-built feature — this phase would rather ship less, correctly, than more,
   speculatively.

---

# 2. Scope

## 2.1 In Scope
- Passwordless patient login (ADR-003).
- A `Patients` identity record, independent of login credentials (ADR-002).
- A patient dashboard shell (`/my-health-journey/`) with honest empty states for
  anything not yet built.
- A read-only Timeline, merging consultation history into one chronological feed.
- Consultation History, sourced from staff-entered or Phase-1.5-linked, doctor-approved
  entries only.
- Symptom Tracker v1 — patient logs severity/sleep/energy/stress/notes; plain data
  capture and display, no analysis.
- Report upload — patients upload documents (PDF/JPG/PNG) to a private store, view
  their own uploads.
- A second, separate Apps Script project/deployment from Phase 1.5's (ADR-009, least
  privilege).
- The design-token extraction (`assets/site.css`) docs/20 §5 already flagged as a soft
  prerequisite, folded into this phase rather than deferred again.

## 2.2 Out of Scope (deferred to a later phase, per docs/32's roadmap recommendation)
- Personal Care Plan (no architecture exists yet — shown only as an empty state here).
- Digital Twin, AI Summaries, Health Milestones, Progress Analytics (Phase 2C — depends
  on ADR-001/004/005's AI-supervision pattern, not needed for anything in this phase).
- Messages / Follow-up Center (no backend or design exists yet — empty state only).
- Any SMS/Mobile OTP capability (no provider integrated; see ADR-003).
- WiseOS, doctor dashboard, inventory, PillFill integration (Phase 3).

## 2.3 Explicit Non-Goals
- Not a rewrite of Phase 1.5's staff pipeline — it continues to operate unchanged,
  on its own separate Apps Script project and secrets.
- Not a framework migration — static HTML/CSS/JS remains the frontend technology
  (docs/10: "Do not introduce React, Vue, Next.js, Tailwind... unless explicitly
  approved" — not approved here; see docs/32 for this as an open question worth a
  future explicit ADR if it ever needs revisiting).
- Not a general-purpose file-storage feature — report upload is scoped to what a
  patient's own care record needs, not a generic document manager.

---

# 3. Authentication Architecture

**Governing ADRs: ADR-002 (identity independent of auth), ADR-003 (passwordless by
default), ADR-010 (security over convenience).**

**Constraint that shapes this section:** the site is static (Netlify, no server) and
the only backend is Google Apps Script deployed from a free personal Google account —
confirmed in `apps-script/Auth.gs` and its README, not a Google Workspace domain.
Workspace's "Anyone within [domain]" access control does not exist for this account.
There is no framework session/cookie layer, and cross-origin calls (Netlify domain →
`script.google.com/.../exec`) rule out relying on cookies at all even if there were.
Authentication here is hand-built on a stateless `doPost`, the same category of problem
Phase 1.5's `STAFF_ACCESS_CODE` gate already solved once — this section solves the
harder, per-patient version of it.

**Method: passwordless, email-based magic link (ADR-003).** No password is ever
collected or stored. No SMS/Mobile OTP — no provider exists in this stack and adding
one is new vendor risk this phase deliberately avoids.

**Mechanics:**
1. Patient requests a login link with their registered email. Apps Script looks up
   `Patients` by email, generates a random 256-bit token, stores **only its hash** in
   `LoginTokens` (never the raw token), and emails the raw token as a link via
   `Email.gs`'s already-proven delivery pattern. The response is identical whether or
   not the email matched a patient — no account-enumeration signal (ADR-010).
2. Clicking the link re-hashes the presented token, checks not-expired (≈15 minutes)
   and not-already-used (single-use, enforced server-side), marks it used, and issues a
   session token: an HMAC-signed payload (`Utilities.computeHmacSha256Signature`,
   secret in Script Properties, same treatment as `OPENROUTER_API_KEY`) of
   `{patient_id, issued_at, expires_at}`. Self-verifying — no Sheet lookup needed on
   every subsequent call.
3. Session token lives in `sessionStorage` (cleared on tab close, never
   `localStorage`), sent as a field in every POST body — the same
   `Content-Type: text/plain` no-preflight pattern Phase 1.5 already uses.
4. Every data-returning/mutating endpoint re-verifies the HMAC signature and expiry and
   **derives `patient_id` from the verified token, never from client-supplied input** —
   directly mirrors `evaluateSendGate_()`'s "re-read live values, never trust
   submission-time state," applied to authorization instead of consent.
5. Session lifetime: short (60–90 minutes), no silent renewal — plainly satisfies
   docs/15's "session expiration" requirement rather than cleverly working around it.

**Identity/auth separation in practice (ADR-002):** `Patients.email` is a lookup key
for *requesting* a login link, not the patient's identity. `patient_id` (UUID,
generated once at account creation) is what every other record references. If email
changes, or a second auth method is added later, no historical record needs to move.

**No public registration (unconditional, carried from docs/09):** `Patients` is only
ever written by a staff-side provisioning tool, access-gated the same way
`internal/consultation-summary.html` is today.

**RBAC:** two roles for this phase — `patient` (read/write scoped strictly to own
`patient_id`) and `staff` (existing access-code-gated internal tools). No third role,
no admin UI — kept deliberately small per §0.

**Separate Apps Script project from Phase 1.5's (ADR-009).** Different secrets
(`SESSION_SIGNING_SECRET` vs. `STAFF_ACCESS_CODE`/`OPENROUTER_API_KEY`), different
deployment, different blast radius — a bug or leaked token on one side must not expose
the other.

---

# 4. Data Architecture

**Governing ADRs: ADR-002, ADR-006 (Sheets as implementation detail), ADR-009.**

docs/33-DOMAIN-MODEL.md is the canonical reference for what each entity below *means*
(purpose, relationships, lifecycle, ownership). The table below describes current
*implementation* shape only — which Sheet, which columns — and should be read as an
implementation detail of the entities docs/33 defines, not a second, independent
definition of them.

Extends docs/12's pattern (Website → Apps Script → Google Sheets), same schema
discipline Phase 1.5 proved: flat columns, stable UUID `record_id`, no per-patient
tabs, SQL-migration-safe by design. A new spreadsheet, separate from
`Phase1.5_ConsultationSummaries`.

| Sheet | Purpose | Key columns |
|---|---|---|
| `Patients` | One row per patient identity (ADR-002) | `patient_id` (UUID, permanent), `full_name`, `email`, `condition_slug`, `status`, `created_at`, `created_by` |
| `LoginTokens` | Single-use magic-link tokens | `token_hash` (never the raw token), `patient_id`, `issued_at`, `expires_at`, `used_at` |
| `ConsultationHistory` | Doctor-approved visit entries feeding Timeline + Consultation History | `record_id`, `patient_id`, `entry_date`, `title`, `summary_text`, `source_ref` (optional link to a Phase 1.5 `record_id`), `created_by`, `created_at` |
| `SymptomLogs` | Symptom Tracker v1 entries | `record_id`, `patient_id`, `logged_at`, `severity`, `sleep`, `energy`, `stress`, `notes`, `condition_slug` |
| `Reports` | Uploaded document metadata (binary lives in Drive) | `record_id`, `patient_id`, `uploaded_at`, `file_name`, `drive_file_id`, `mime_type`, `size_bytes`, `uploaded_by` |

`condition_slug` reuses the canonical anchor IDs already locked by docs/20 §5 and
reused in Phase 1.5 — one taxonomy across the whole platform.

**Data flow:** static patient-portal page → Apps Script Web App (new project) →
relevant Sheet(s)/Drive → response filtered strictly to the caller's verified
`patient_id`. Every mutation is audit-logged in-row, same convention as Phase 1.5.

**Patient data belongs to the patient** (docs/30 §3): no export/deletion mechanism is
built in this phase, but no schema decision here should make one harder to add later —
flat, patient_id-keyed rows already satisfy that; a concrete export/delete endpoint is
future work.

---

# 5. Dashboard Architecture

"My Health Journey" home, trimmed to what this phase actually builds (docs/09's
module list, honestly scoped down):

- **Welcome header** — patient name, last login.
- **Timeline preview** — last 3 merged entries, "View full timeline" link.
- **Symptom Tracker card** — quick-log control + link to full history.
- **Reports card** — upload control + recent uploads.
- **Explicit empty states** for Care Plan, Messages, Digital Twin — docs/04's Empty
  State pattern ("explain what's missing, offer the next action"), never hidden or
  faked. This keeps the phase honest about what exists.

Reuses existing design tokens (`--color-brand`, `--font-display`, etc., currently
duplicated per-page in `index.html`'s `:root`) — this phase is the point docs/20 §5
already flagged as the moment to finally extract them into a shared `assets/site.css`
(Batch 5C, §13) instead of duplicating a third time. Reuses the `.journey`/`.j-step`
progress-timeline visual pattern docs/20 already identified as reusable for exactly
this purpose.

---

# 6. Timeline Architecture

Timeline is the **merged, read-only, reverse-chronological feed** of a patient's
journey. For this phase it pulls from `ConsultationHistory` only (future phases add
Care Plan milestones, Digital Twin events — not built here). One endpoint
(`getPatientTimeline_`) reads and sorts by `entry_date`, capped (e.g., latest 50) for
payload size/performance (docs/16). **No AI narrative generation** — that is
explicitly Phase 2C's Digital Twin/AI Summary territory (ADR-001, ADR-004, ADR-005).
This is a plain factual log of doctor-approved data only.

---

# 7. Consultation History Architecture

The **detail view** behind Timeline entries of type "consultation." Two sourcing paths,
both landing in the same `ConsultationHistory` row shape:
1. Staff manually adds a short entry (date, title, summary) via a small internal tool —
   same access-code-gated pattern as Phase 1.5's staff form.
2. Reuse an already doctor-approved Phase 1.5 visit-summary (`review_status =
   approved`/`edited_and_approved`) by referencing its `record_id` in `source_ref`,
   avoiding re-typing content that already passed AI-normalization + doctor review once
   (ADR-005's gate, reused rather than rebuilt).

**Read-only for patients** — no patient editing of their own clinical history,
consistent with "doctors decide" (docs/30 §2).

---

# 8. Report Upload Architecture

The highest-risk new capability in this phase — arbitrary file handling plus
cross-patient data isolation.

- **Storage:** Google Drive, not Sheets (binary). Files keyed by `patient_id`/
  `record_id`; a client-supplied filename is never used as a path component. Drive
  permissions private — never "anyone with the link."
- **Upload flow:** patient selects file → browser reads as base64 → POST (with session
  token) to Apps Script → server validates MIME type against an allowlist
  (PDF/JPG/PNG only) by actual content type, not extension, and enforces a size cap
  server-side (client-side limits are UX only, never trusted) → writes to Drive →
  writes a `Reports` row.
- **Viewing/download:** every list/download call re-derives `patient_id` from the
  session token, exactly like every other endpoint — this is the single place a
  scoping bug would be most damaging, so it gets its own explicit test in Batch 5H.
- **Accepted limitation, stated openly:** no malware/virus scanning exists in this
  stack. Mitigated by type/size restriction and doctor review before any file is
  opened by staff — an accepted risk (§11), not a silently ignored one.

---

# 9. Symptom Tracker v1 Architecture

Per docs/09/docs/21: severity, sleep, energy, stress, notes — the **patient,
authenticated** variant only (the separate public/no-login/no-storage Symptom Tracker
in docs/21 is untouched by this work). Simple form (1–10 scale inputs + optional
free-text note + optional `condition_slug` tag) → POST → row in `SymptomLogs`,
`patient_id` taken from the verified session, never the request body. Display: the
patient's own chronological log, at most a bare recent-value list. **Deliberately no
trend analysis, no AI commentary, no insights** — that's Digital Twin/Progress
Analytics territory (Phase 2C, ADR-001/004/005) and must not creep in here.

---

# 10. Security Model

**Governing ADRs: every ADR in `/adr/`, especially ADR-002, ADR-003, ADR-006, ADR-009,
ADR-010.** Mapped against docs/15, extending the same table convention Phase 1.5 used:

| docs/15 requirement | Phase 2A implementation |
|---|---|
| Authenticated access only (patient portal) | Every data endpoint requires a valid, unexpired HMAC session token; `patient_id` always server-derived (ADR-002) |
| Session expiration | Short-lived (60–90 min) session tokens, no silent renewal |
| Role-based permissions | Two roles: `patient` (self-scoped only), `staff` (existing access-code-gated tools) |
| No secrets in frontend | `SESSION_SIGNING_SECRET` in Script Properties only, separate from Phase 1.5's secrets |
| Least privilege | Separate Apps Script project/deployment from Phase 1.5 (ADR-009), own Sheet, own Drive scope |
| Input validation | Every field validated/sanitized server-side; strict file-type/size allowlist for uploads |
| Audit logging | Every login attempt (success/fail), every upload, every symptom-log write appended, immutable |
| Environment separation | Separate test Spreadsheet + test Apps Script deployment + test Drive folder before real patient data, same `_TEST` convention as Phase 1.5 |
| No PHI leakage | Generic, non-technical error messages only (docs/04 Error State); no cross-patient data ever returned |

**New consideration Phase 1.5 didn't have:** the "request login link" endpoint is
public and unauthenticated by necessity. Mitigate account-enumeration and
email-bombing with an identical response regardless of match, plus basic per-email/
per-IP rate limiting on link requests (ADR-010: the more secure default, not the more
convenient one).

---

# 11. Risks

1. **Phase-boundary consolidation** — this plan merges docs/09's original 2A+2B scope.
   Recorded and justified in docs/32, not silent — but still a real deviation from a
   previously reviewed sequencing (docs/20 §2) that must be tracked, not forgotten.
2. **Auth is genuinely security-sensitive** — hand-rolled HMAC token issuance/
   verification on a stateless backend is materially harder than anything in Phase
   1.5. Requires a dedicated `/security-review` pass before this batch is considered
   done, before implementation is approved to begin.
3. **Report upload is the single highest-risk feature** — cross-patient authorization
   bugs here are the worst-case outcome of this phase. Sequenced last among
   data-features specifically so the authorization pattern is proven on lower-risk
   read-only work first (§13).
4. **No SMS OTP capability exists** in this stack — resolved by ADR-003's explicit
   choice of email-based passwordless login, not a silent deviation from docs/09.
5. **Sheets-at-scale** — same accepted, already-documented tradeoff as Phase 1.5, now
   carrying real per-patient records instead of a staff pipeline. ADR-006's migration
   discipline is the mitigation, not a fix.
6. **Free Google account storage quotas** (Drive, 15GB shared with Gmail) — low risk
   at pilot scale, worth monitoring as report uploads accumulate.
7. **Static-frontend constraint (docs/10)** — building session-aware, authenticated UI
   in plain HTML/CSS/JS without a framework is more manual work than a typical patient
   portal stack. Accepted per docs/10's existing "no frameworks without approval" rule;
   flagged in docs/32 as worth an explicit revisit if Phase 2A's frontend complexity
   turns out to strain this constraint in practice.
8. **Scope creep into Digital Twin territory** — Symptom Tracker/Timeline must stay
   plain data capture/display; any AI or trend-analysis addition here would violate
   ADR-001/004/005's phase boundary.

---

# 12. Documentation Impact

| Doc | Update needed | Status |
|---|---|---|
| docs/09-PHASE-2-ARCHITECTURE.md | Reconcile Entry Point wording (Password/Mobile OTP) with ADR-003; reconcile 2A/2B split with this plan's consolidated scope | Open — see docs/32 |
| docs/24-ROADMAP.md | Add a Phase 2A batch-tracking section once implementation begins, matching Phase 1.5's convention | Open |
| docs/12-DATA-ARCHITECTURE.md | Add the schema in §4 once built; reword "Google Sheets as primary datastore" per ADR-006 | Open — see docs/32 |
| docs/15-SECURITY-STANDARDS.md | Add a real Phase 2A section once built (first actual implementation of its "Patient portal" line) | Open |
| docs/04-COMPONENT-LIBRARY.md | Document components actually built (login form, dashboard cards, timeline entry, upload widget, symptom entry form) | Open |
| docs/08-NAVIGATION-ARCHITECTURE.md | Add the real "Patient Login" nav slot once Batch 5G ships | Open |
| CHANGELOG.md (root) | Standard per-batch entries, same convention as Phase 1.5 | Open |
| docs/30, docs/31, `/adr/` | This plan is built against them; no further change needed unless implementation surfaces a new decision | N/A |

---

# 13. Implementation Batches

Sequenced by risk: foundation → auth → shell → read-only data → patient-writable data
→ highest-risk upload feature → public visibility → validation. Each batch is
self-contained per ADR-008 — nothing later breaks if an earlier one is rolled back, and
nothing patient-facing is linked from public nav until the last batch.

| Batch | Delivers | Risk / reversibility |
|---|---|---|
| **5A** | `Patients` sheet + new, separate Apps Script project skeleton + staff "create patient account" tool | Zero patient-facing surface. Fully reversible — delete the sheet/script. |
| **5B** | `LoginTokens` sheet + passwordless magic-link login (`login.html`/`verify.html`) + session token issuance/verification + rate limiting | Deployed unlisted/noindexed, not linked from nav yet. Reversible — remove the pages/endpoint. |
| **5C** | `assets/site.css` token extraction + `/my-health-journey/index.html` dashboard shell with empty states, wired to 5B's session | Still unlisted. Additive plus one low-risk refactor. |
| **5D** | `ConsultationHistory` sheet + staff entry tool + patient-facing Timeline/Consultation History (read-only) | Low risk — read-only, easily hidden if needed. |
| **5E** | `SymptomLogs` sheet + patient-facing symptom log form + own-history view | First patient-writable feature — authorization scoping tested explicitly here. |
| **5F** | `Reports` sheet + Drive integration + upload/list/download endpoints + validation | Highest risk — ships last, after the auth/authorization pattern is proven. |
| **5G** | Add "Patient Login" to primary nav, un-noindex, sitemap entry | Only batch with real public visibility change — last, trivially reversible. |
| **5H** | Node validation harness for the new Apps Script modules (token expiry/single-use, authorization scoping, upload validation, failure paths) + docs/12, docs/15, docs/24 updates | Mirrors Phase 1.5's 4G/4H closeout discipline. |

**Recommended first batch (unchanged from the prior planning pass): 5A.** Zero
patient-facing surface, zero security exposure, and everything else in this phase
depends on `Patients` and the new Apps Script project existing first — the same
opening move Phase 1.5 made with Batch 4A.

**This plan does not authorize Batch 5A to begin.** Per this session's explicit
instruction, implementation waits for separate approval.
