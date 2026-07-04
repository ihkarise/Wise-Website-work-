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
Analytics territory (Phase 2D, ADR-001/004/005) and must not creep in here. (Corrected
from a stale "Phase 2C" reference — docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md §9/
Repository Consistency Review Finding 1 — every other mention of this boundary,
including this plan's own Roadmap section, docs/24, and docs/33 §3.5, already agreed on
2D; Phase 2C is Health Milestones, deliberately separated from this AI-supervised work.)

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
| **5B** | `LoginTokens` sheet + passwordless magic-link login (`login.html`/`verify.html`) + session token issuance/verification + rate limiting — **fully delivered**, split across Identity & Access (backend: IA-1, IA-2, §15) and Patient Access (frontend: PA-1, §16) | Deployed unlisted/noindexed, not linked from nav yet. Reversible — remove the pages/endpoint. |
| **5C** | `assets/site.css` token extraction + `/my-health-journey/index.html` dashboard shell with empty states, wired to 5B's session | Still unlisted. Additive plus one low-risk refactor. |
| **5D** | `ConsultationHistory` sheet + staff entry tool + patient-facing Timeline/Consultation History (read-only) — **complete** (Batch PA-3, §16) | Low risk — read-only, easily hidden if needed. |
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

---

# 14. Implementation Notes (to be filled in during/after build)

## Foundation planning — two decisions made before implementation began

Before any Foundation code was written, a dedicated planning pass produced a
**Foundation Implementation Plan** (batches F1–F5, distinct from and superseding this
document's §13 batch table for the scope it covers) and locked two decisions that
revise this document's §3 and §4 framing:

- **Single Apps Script project, not a separate one.** §3's "Separate Apps Script
  project from Phase 1.5's (ADR-009)" is superseded. Foundation, and all subsequent
  Phase 2A backend work, lives inside the existing `apps-script/` project as new,
  `Foundation`-prefixed files (or files named for the specific domain entity they
  implement), never modifying Phase 1.5's existing files. Least-privilege separation
  (ADR-009, docs/15) is preserved at the **data** layer — a separate Patients
  spreadsheet, distinctly-named Script Properties keys — rather than at the deployment
  layer. This is a deliberate, reversible decision, not a permanent foreclosure:
  revisit if a technical limitation or security requirement later makes
  deployment-level separation necessary.
- **A repository-level `shared/` directory** (see `shared/README.md`) now holds
  canonical, machine-readable contracts and schemas (JSON, versioned) and reference
  utility implementations, which Apps Script code conforms to and never extends or
  modifies independently — shared-first, implementation-second, never reversed, with
  one named exception for a contract's first creation. This formalizes and strengthens
  what §4 already implied (docs/33 is canonical for entity meaning) into an
  enforceable, versioned mechanism spanning more than just entity schemas.

Neither decision touches any ADR, Architecture Principle, or Domain Model entry —
docs/31's ADR set is unchanged; both decisions were reviewed against it explicitly
before being accepted.

## Batch F1 (complete)

Delivered: `apps-script/FoundationConfig.gs` (placeholders and Script Property *names*
only — no secrets, no logic beyond a configuration object); the `shared/` directory
skeleton (`contracts/`, `schemas/`, `constants/`, `utils/`) and `shared/README.md`
(the canonical-source rule, its format rules, and its one named bootstrap exception);
and an append-only module-table entry in `apps-script/README.md` introducing the
"Phase 2A Foundation modules" section.

No patient-facing surface, no Sheet created yet, zero modification to any pre-existing
`apps-script/*.gs` file — verified via `git diff` before commit, per this plan's own
Definition of Done. `validation/phase-1-5/`'s existing suite re-run and confirmed
unchanged (39/39 checks passed, re-run 2026-07-02 against this batch's commit),
directly verifying Phase 1.5's behavior was not affected by this batch.

Deferred to later batches: `shared/contracts/`, `shared/schemas/`, and `shared/utils/`
remain empty until F2/F3 populate them; no `Foundation*` logic beyond the config
placeholder exists yet.

## Batch F2 (complete)

Delivered, per this plan's own bootstrap exception (§6/`shared/README.md`) — a
`shared/` contract and its first Apps Script adaptation, created together:

- `shared/contracts/response-envelope.schema.json` (version `1.0.0`) + `.md` — the
  `{status, data, error}` shape every Foundation function returns, adapted as
  `apps-script/FoundationContracts.gs`'s `buildFoundationOkEnvelope_()`/
  `buildFoundationErrorEnvelope_()`.
- `shared/utils/core.reference.js` (version `1.0.0`) + `.md` — `generateId()`,
  `nowIso()`, `escapeHtml()`, adapted as `apps-script/FoundationUtils.gs`'s
  `generateFoundationId_()`, `foundationNowIso_()`, `escapeFoundationHtml_()`.
- `apps-script/FoundationErrorHandling.gs`'s `withFoundationErrorHandling_()` —
  guarantees every wrapped call returns the envelope shape, logging the real error to
  Apps Script's execution log (not yet persisted to a Sheet — `FoundationAudit.gs`,
  batch F3, adds that layer) but never leaking it to the caller.

**A real collision was caught and avoided, not just theoretically possible.**
Reviewing Phase 1.5's existing global function names before writing any F2 code found
that a literal port of the reference `escapeHtml()` would have collided with Phase
1.5's own `Utils.gs` `escapeHtml_()` — both now live in the same Apps Script project's
flat function namespace (docs/29 §14's Decision 1), so a same-named second definition
would have silently overwritten the first. `escapeFoundationHtml_()`'s distinct name
avoids this; documented in `shared/utils/core.md` as the reference case for why every
Foundation function is distinctly named, not just as a style preference.

**`generateFoundationId_()` uses `Utilities.getUuid()`, not the reference algorithm** —
the first concrete example of `shared/README.md`'s "conform to the contract, not
necessarily the algorithm" rule: the reference `.js` demonstrates the required output
shape in portable JS; Apps Script's native primitive already satisfies that shape and
is what the adaptation actually calls.

**Verification performed** (all real, not assumed): `node --check` on every new
`.gs` file; the reference utilities executed directly in Node with assertions on
their output (UUID shape, ISO 8601 format, HTML-escaping correctness); a
collision scan across every existing Apps Script global function name (none found
after fixing one case-sensitivity bug in the scan itself); `FoundationContracts.gs`'s
two builders executed directly in Node (they have no Apps Script dependency) with
their output checked against `response-envelope.schema.json`'s required keys, status
enum, and `oneOf` success/error shape; `withFoundationErrorHandling_()` executed with
a minimal `Logger` stub, confirming a thrown exception's raw message never reaches the
caller; `validation/phase-1-5/validate.js` re-run clean (39/39) confirming zero
regression to Phase 1.5. Automated, schema-validator-based conformance testing
(`validation/phase-2a-foundation/conformance.js`) remains an F5 deliverable, not
built early — this batch's checks were real but ad hoc, run directly against the
committed source rather than through a committed harness.

## Static analysis — a new standing step, introduced at F3

By explicit requirement, every Foundation batch from F3 onward runs
`validation/static-analysis/analyze.js` (checking duplicate global names, duplicate
constants, duplicate function names, unused exported helpers, circular dependencies,
and Apps Script namespace collisions) **before** validation, not just at the end. Full
detail: `validation/static-analysis/README.md`.

Built and run against the real F1+F2 baseline before writing any F3 code, this tool
immediately proved its worth by finding two real issues in the *existing* codebase that
manual review had missed:
- A false circular dependency (`Email.gs -> Send.gs -> Email.gs`) traced to a comment
  in `Email.gs` that happens to contain the literal text `attemptSend_(` — fixed in the
  tool itself (comment/string-aware scanning), not in `Email.gs`, which was correct as
  written.
- Three false "unused" reports for `Review.gs`'s menu-bound functions
  (`approveSelectedRowAsGenerated_`, `approveSelectedRowEdited_`, `rejectSelectedRow_`)
  — Apps Script's `menu.addItem('label', 'fnName')` references a function by quoted
  string, not a call, which the tool didn't originally recognize as usage. Fixed in the
  tool; `Review.gs` was correct as written here too.

Both fixes are documented in `analyze.js`'s own header comment, on the record rather
than silently patched.

## Batch F3 (complete)

Delivered: `shared/schemas/patient-identity.schema.json` (v1.0.0) + `.md`;
`apps-script/FoundationDataStore.gs` (the data-access abstraction, ADR-006/ADR-009 —
the only Foundation file calling `SpreadsheetApp` for Patient-domain data);
`apps-script/FoundationAudit.gs` (append-only event log); `apps-script/PatientIdentity.gs`
(`foundationCreatePatient_()`/`foundationGetPatientById_()`, plus
`createFoundationPatient()`, the manually-run editor wrapper this batch's scope calls
for — no Web App route, no Sheet menu); `apps-script/FoundationTests.gs` (partial —
Apps Script-native unit tests for every pure function introduced in F2 and F3, 14
tests, formalizing what F2 validated ad hoc into a real, committed, repeatable suite).

**Reconciling docs/33's Patient/Patient Identity split with docs/29 §4's already-locked
single-sheet schema.** docs/33-DOMAIN-MODEL.md §1.1/§1.2 models Patient (profile) and
Patient Identity (permanent core) as two distinct entities specifically so identity
never depends on mutable profile data (ADR-002). docs/29 §4 had already locked one
`Patients` sheet holding both. These were never in true conflict: ADR-002 requires
`patient_id` to be permanent and universally referenced, not that storage be physically
split. `shared/schemas/patient-identity.schema.json` documents this explicitly — every
field is labeled as belonging to the identity core or the profile half, and
`shared/schemas/patient-identity.md` records the reasoning — so the conceptual
distinction stays visible even though implementation keeps it in one row, avoiding
unneeded complexity at pilot scale (ADR-006).

**A deliberate simplification, stated openly, not discovered later:**
`foundationValidatePatientInput_()` does not validate `condition_slug` against Phase
1.5's canonical `ALLOWED_CONDITION_SLUGS` list — duplicating that list now, with no
second real consumer beyond a copy-paste, was already flagged as premature by Phase
1.5's own Batch 4A review. `shared/constants/` (empty, reserved) is exactly where this
belongs once it's needed for real — noted in `shared/schemas/patient-identity.md`, not
silently skipped.

**The correct error-handling split, put into real use for the first time.**
`FoundationContracts.gs`'s own header comment (batch F2) already distinguished
*expected* error cases (return `buildFoundationErrorEnvelope_()` directly, with a
specific code) from *unexpected* failures (only `withFoundationErrorHandling_()`'s
generic catch-all should produce those). `foundationCreatePatient_()`'s validation
failures and `foundationGetPatientById_()`'s not-found case are both expected outcomes,
correctly returning `FOUNDATION_INVALID_INPUT`/`FOUNDATION_NOT_FOUND` directly rather
than the generic `FOUNDATION_UNEXPECTED_ERROR` — verified by execution (below), not
just written to match the intent.

**Verification performed** (all real, not assumed): the static-analysis pass (above);
`node --check` on every new `.gs` file; `runFoundationTests_()` — all 14 tests —
executed directly in Node (every tested function is pure, no Apps Script dependency);
a full functional pass against a minimal in-memory `SpreadsheetApp` mock covering
create → read-back round-trip (output checked against the JSON Schema's required
fields), not-found returning the specific code, invalid input returning the specific
code, the audit log gaining exactly one correctly-shaped row per patient created,
cross-patient isolation (creating a second patient leaves the first untouched — the
single highest-risk property for any multi-tenant data layer), and the header-drift
safety check correctly throwing when a sheet's live header is tampered; a full
collision pre-check of every planned F3 name against the existing codebase before
writing any code (zero collisions); `validation/phase-1-5/validate.js` re-run clean
(39/39).

**Known, expected gap — not a shortcoming.** `FoundationConfig.gs`'s
`PATIENT_SPREADSHEET_ID` remains a placeholder. Provisioning a real Google Spreadsheet
and setting a real ID is an operational step outside this repository, exactly as
docs/28 treated Phase 1.5's live deployment as separate from "software complete" —
`FoundationDataStore.gs`'s `foundationDsGetOrCreateSheet_()` creates the `Patients` and
`AuditLog` tabs (with the correct header) automatically on first real use once a real
ID is set; nothing about that step is simulated or assumed complete here.

## Batch F4 (complete)

Delivered exactly the scope named by two forward references already merged in F3:
`apps-script/README.md`'s Foundation module table ("`FoundationSession.gs`/
`FoundationRouteGuard.gs` coverage lands in F4") and `FoundationConfig.gs`'s comment
("Script Properties key names Foundation modules will read via PropertiesService, from
F4 onward"). Concretely: `shared/schemas/session.schema.json` (v1.0.0) + `.md`;
`apps-script/FoundationSession.gs` (session token issuance/verification, ADR-002/
ADR-003/ADR-010); `apps-script/FoundationRouteGuard.gs` (`withFoundationAuth_()`, route
protection deriving `patient_id` only from a verified token, never client input);
`apps-script/FoundationTests.gs` extended with pure-logic and full-round-trip coverage
for both new files; `FoundationConfig.gs` extended with `SESSION_TTL_SECONDS` (3600 —
60 minutes, the low end of §3's 60–90 minute range, per ADR-010).

**Not in scope, and not silently expanded into:** `LoginTokens` (the sheet and the
magic-link request/consume flow that actually produces a `patient_id` to issue a
session for), and any Web App route (`doPost`) wiring `withFoundationAuth_()` to a real
endpoint. Neither was named in F3's forward references, and building either here would
have been exactly the kind of undirected scope growth this plan's batch sequencing
exists to prevent. `foundationIssueSessionToken_()` takes an already-resolved
`patient_id` as its input specifically so it doesn't need to assume a particular
upstream login mechanism — see `shared/schemas/session.md`'s "Relationship to
LoginTokens." Both remain open, tracked under §13's Batch 5B and this section's own
F5+ continuation.

**A cryptographic primitive is never hand-rolled for "portability."** `shared/utils/
core.reference.js` (F2) ports small algorithmic helpers as plain, portable JS because
their contract *is* the algorithm. HMAC-SHA256 is different — every real runtime
already provides it natively, and re-implementing a cryptographic primitive in portable
JS "for portability" is a known anti-pattern, not a style choice.
`shared/schemas/session.md` states this explicitly: the schema defines the payload
shape and the wire format; the actual signature computation is Apps Script's own
`Utilities.computeHmacSha256Signature`, mirrored only by Node's standard `crypto`
module in this batch's ad hoc verification pass (a faithful mock of a standard
algorithm, not a guess) — the same "mock the platform API, run the real logic"
discipline `validation/phase-1-5/` and F3 already established for `SpreadsheetApp`.

**Signature comparison is constant-time, deliberately.** `foundationConstantTimeEquals_()`
avoids a naive `===`, which short-circuits on the first differing character and can
leak timing information about a forged signature (ADR-010: the more secure default).

**Test design keeps `FoundationTests.gs` genuinely offline.** Every new function that
needs the real signing secret or Apps Script's HMAC primitive is split into a
`WithSecret_`-suffixed core (secret and clock passed explicitly) and a real entry point
that reads `PropertiesService`. `FoundationTests.gs` exercises the full issue-then-
verify round trip, tampering rejection, wrong-secret rejection, and expiry entirely
through the `WithSecret_` cores with an explicit test secret — never touching
`PropertiesService`, so the suite has zero risk of reading or clobbering a real
`FOUNDATION_SESSION_SIGNING_SECRET`. `FoundationRouteGuard.gs`'s functions are
excluded from this suite for the same reason `PatientIdentity.gs`'s Sheet-touching
functions were in F3: `withFoundationAuth_()`'s rejection path calls
`foundationLogAuditEvent_()`, a live-Sheet write — verified instead by the ad hoc
functional pass below.

**Verification performed** (all real, not assumed): the static-analysis pass (below);
`node --check` on every new `.gs` file; every pure function in `FoundationTests.gs`
(payload construction, expiry boundary — before/at/after `expires_at` — payload-shape
validation, constant-time comparison, and the full `WithSecret_` round trip) executed
directly in Node via `vm`, no Apps Script dependency; a separate ad hoc functional pass
mocking `Utilities` (HMAC via Node's `crypto`, faithfully), `PropertiesService`, and a
minimal in-memory `SpreadsheetApp` (same shape F3's mock used) exercising the *real*
entry points — `foundationIssueSessionToken_()` → `foundationVerifySessionToken_()`
round trip, tampered-token rejection, fail-closed behavior (not a thrown exception)
when the signing secret is unset, `withFoundationAuth_()` calling `handlerFn` with the
server-derived `patientId` on a valid token, `withFoundationAuth_()` rejecting an
invalid token without ever calling `handlerFn`, confirming exactly one
`session_rejected` `AuditLog` row is written on rejection, and cross-patient isolation
(two different patients' tokens resolve to their own, non-interchangeable
`patientId`) — 9/9 ad hoc checks passed; the issued payload's shape independently
checked against `session.schema.json`'s `required`/`properties`/`additionalProperties`
constraints — all passed; `validation/phase-1-5/validate.js` re-run clean (39/39),
confirming zero regression to Phase 1.5.

**Static analysis: 2 new findings, both expected, same pattern as F3.**
`foundationIssueSessionToken_` and `withFoundationAuth_` report zero call-sites —
both are real entry points with no consumer yet, because their consumer (a `LoginTokens`
magic-link flow for the former, an actual protected Web App route for the latter) is
explicitly out of this batch's scope (above). Not fixed by inventing a call-site.
Combined with F2/F3's 4 already-accepted findings (unchanged), this batch's full run
reports 6 total findings, all Deferred, zero Error/Warning/Intentional.

## Batch F5 (complete)

Delivered exactly the one deliverable F2's own implementation notes (above) already
named: "Automated, schema-validator-based conformance testing
(`validation/phase-2a-foundation/conformance.js`) remains an F5 deliverable, not built
early." Concretely: `validation/phase-2a-foundation/schema-validator.js` (a generic,
dependency-free JSON Schema Draft 2020-12 subset validator — `type`, `required`,
`properties`, `additionalProperties`, `enum`, `const`, `format`, `minLength`, `oneOf`
— covering exactly what this repo's `shared/*.schema.json` files actually use, no
more); `validation/phase-2a-foundation/harness.js` (a mocked Apps Script runtime —
`SpreadsheetApp`, `PropertiesService`, `Utilities`, `Logger` — loading the real,
unmodified Foundation-family `.gs` source, mirroring `validation/phase-1-5/harness.js`'s
structure exactly); `validation/phase-2a-foundation/conformance.js` (the test runner —
Stage 0 proves the validator itself against deliberately-broken fixtures before
trusting it, Stages 1–4 exercise the real `FoundationContracts.gs`,
`PatientIdentity.gs`, `FoundationSession.gs`, and `FoundationRouteGuard.gs` functions
and check their actual output against the real, committed `shared/*.schema.json`
files); `validation/phase-2a-foundation/README.md`.

**Zero `apps-script/*.gs` files were touched.** This batch is Node-only tooling — no
new Apps Script logic, no new shared/ contract, no architecture change. `git diff`
against F4's merged state confirms this.

**Formalizes, rather than repeats, F2/F3/F4's ad hoc verification.** Each prior batch
wrote fresh, uncommitted Node checks against that batch's own output shape — real, but
not reusable. `schema-validator.js` is generic (reads a schema, checks any instance
against it) specifically so a future batch's new `shared/` schema plugs into the same
tool with a new conformance stage, not a new bespoke validator.

**Verification performed** (all real, not assumed): `node --check` on every new
`.js` file; `node conformance.js` — 23/23 checks passed, covering the validator's own
correctness (Stage 0, 7 checks against deliberately-broken fixtures) and real,
schema-checked output from `buildFoundationOkEnvelope_()`/`buildFoundationErrorEnvelope_()`,
`foundationCreatePatient_()`/`foundationGetPatientById_()` (including the
`FOUNDATION_NOT_FOUND` path), `foundationBuildSessionPayload_()` and a full real
`foundationIssueSessionToken_()` → `foundationVerifySessionToken_()` round trip, and
`withFoundationAuth_()`'s both success and rejection paths (including confirming the
rejection's `session_rejected` `AuditLog` row — correctly scoped to that specific event,
not a raw row count, since `AuditLog` is shared, cumulative state across the whole
conformance run and Stage 2 already wrote a `patient_created` row before Stage 4 runs);
the static-analysis pass re-run clean against F4's unchanged 6 findings (below);
`validation/phase-1-5/validate.js` re-run clean (39/39), confirming zero regression to
Phase 1.5.

**A test-assertion bug was caught and fixed during this batch's own development, not
shipped.** `conformance.js`'s Stage 4 originally asserted `AuditLog` had exactly one
row after the rejection call — true in isolation, false in the real run, because
Stage 2's `foundationCreatePatient_()` had already written a `patient_created` row
earlier in the same shared in-memory spreadsheet. Fixed by filtering for the specific
`session_rejected` event rather than asserting total row count — a bug in this batch's
own test code, not in any Foundation module, caught by actually running the harness
before treating it as done.

**Static analysis: unchanged from F4.** 6 total findings, all previously triaged as
Deferred (`escapeFoundationHtml_`, `foundationDsQuery_`, `foundationDsUpdateById_`,
`foundationGetPatientById_`, `foundationIssueSessionToken_`, `withFoundationAuth_`) —
expected, since this batch adds no new `apps-script/*.gs` code for the tool to scan.

### Foundation Dependency Map (architectural review artifact — F5)

Derived from the real call graph (not transcribed from header comments, which are
cross-checked against this, not trusted blindly) — the same declaration-extraction and
comment/string-aware call-site scan `validation/static-analysis/analyze.js` already
uses for its own circular-dependency check, restricted to the ten Foundation-family
files and re-run standalone for this map. One real gap in the automated scan is called
out explicitly below rather than silently omitted.

**Module dependencies (verified real call-sites):**

| File | Depends on (calls into) |
|---|---|
| `FoundationConfig.gs` | *(none — leaf)* |
| `FoundationUtils.gs` | *(none — leaf)* |
| `FoundationContracts.gs` | *(none — leaf)* |
| `FoundationDataStore.gs` | *(none — leaf; see config-variable note below)* |
| `FoundationSession.gs` | *(none — leaf; see config-variable note below)* |
| `FoundationErrorHandling.gs` | `FoundationContracts.gs` |
| `FoundationAudit.gs` | `FoundationDataStore.gs`, `FoundationUtils.gs` |
| `PatientIdentity.gs` | `FoundationAudit.gs`, `FoundationContracts.gs`, `FoundationDataStore.gs`, `FoundationErrorHandling.gs`, `FoundationUtils.gs` |
| `FoundationRouteGuard.gs` | `FoundationAudit.gs`, `FoundationContracts.gs`, `FoundationSession.gs` |
| `FoundationTests.gs` | `FoundationContracts.gs`, `FoundationDataStore.gs`, `FoundationSession.gs`, `PatientIdentity.gs` |

**A real limitation in the automated scan, checked by hand:** the call-graph scan only
detects function-call sites (`name(`), so it misses `FOUNDATION_CONFIG` — a `var`, read
as `FOUNDATION_CONFIG.SOME_KEY`, never called as a function. Grepping for
`FOUNDATION_CONFIG\.` confirms two real, additional configuration-read dependencies not
captured above: `FoundationSession.gs` → `FoundationConfig.gs` (`SESSION_TTL_SECONDS`,
`SCRIPT_PROPERTY_KEYS.SESSION_SIGNING_SECRET`) and `FoundationDataStore.gs` →
`FoundationConfig.gs` (`PATIENT_SPREADSHEET_ID`). Included here so the map is accurate,
not just what the tool happened to catch.

**Newly introduced dependencies (this batch):** none within `apps-script/`'s namespace
— F5 adds no `.gs` files and modifies no existing one. The only new dependency edges
this batch introduces are external, Node-only, and one-directional *into* Foundation
from outside the Apps Script project: `validation/phase-2a-foundation/harness.js` reads
(via `vm`, unmodified) all ten Foundation-family `.gs` files; `conformance.js` reads
the three `shared/*.schema.json` files. Neither is a runtime dependency of anything
under `apps-script/` — the relationship is strictly test tooling consuming production
source, never the reverse (same "validation never modifies or is loaded by
`apps-script/`" rule `validation/phase-1-5/README.md` and
`validation/static-analysis/README.md` already state).

**Circular dependencies: zero**, verified two ways — (1) `validation/static-analysis/analyze.js`'s
own project-wide cycle detector, re-run clean; (2) a second cycle check restricted to
just the ten-file Foundation family (including the two hand-verified `FOUNDATION_CONFIG`
edges above), independently confirming none. Also confirmed: zero edges in either
direction between the Foundation family and any Phase 1.5 file — Foundation never calls
into Phase 1.5 (by design, docs/29 §14 Decision 1), and no Phase 1.5 file has ever been
modified to reference anything Foundation-prefixed.

**Dependency direction:** strictly layered, one-way, no back-references —

```
Layer 0 (infra, leaf)     FoundationConfig.gs  FoundationUtils.gs  FoundationContracts.gs  FoundationDataStore.gs
                                 ^                    ^                     ^                       ^
Layer 1 (cross-cutting)   FoundationErrorHandling.gs ------------------------+                       |
                                 ^                                                                    |
                           FoundationAudit.gs ------------------------------------------------------- +
                                 ^
Layer 2 (entities)        PatientIdentity.gs   FoundationSession.gs (leaf; config-read only)
                                 ^                    ^
Layer 3 (route protection)                     FoundationRouteGuard.gs
                                 ^                    ^
Layer 4 (tests, top)       FoundationTests.gs (depends on Layer 2/1/0, calls nothing calls it)
```

Every arrow points from a higher layer down to a lower one; nothing in Layer 0 or 1 has
ever called back up into Layer 2+ — the same one-way, narrow-interface discipline
ADR-009 requires, holding in practice, not just by convention. This is an architectural
review artifact only, produced by observing the existing, already-shipped module
boundaries — no module was restructured to make this diagram cleaner.

---

# 15. Identity & Access Implementation

Foundation (F1–F5) is complete and frozen except for bug fixes (docs/35-FOUNDATION-CLOSEOUT.md
§9). Identity & Access is the milestone that turns Foundation's session/route-protection
primitives into an actual, working login — the remaining, not-yet-built half of this
document's original §13 Batch 5B. By explicit instruction, this milestone is split into
two independent batches: **IA-1** (infrastructure only — token generation, hashing,
expiration, single-use enforcement; no route, no UI, no session issuance) and **IA-2**
(consumes IA-1's completed infrastructure — expected to add the magic-link request/consume
flow, the first real Web App route, and rate limiting). Both batches are now complete.

## Batch IA-1 (complete)

Delivered exactly its stated scope: `shared/schemas/login-token.schema.json` (v1.0.0) +
`.md` — committed in its own commit, ahead of the implementation, per `shared/README.md`'s
standard rule (no bootstrap exception available post-F3); `apps-script/FoundationLoginTokens.gs`
— `foundationCreateLoginToken_()` (generation + SHA-256 hashing + storage),
`foundationConsumeLoginToken_()` (lookup + expiration check + single-use enforcement +
mark-used), plus pure helpers (`foundationBuildLoginTokenRecord_()`,
`foundationIsLoginTokenExpired_()`, `foundationIsLoginTokenUsed_()`,
`foundationEvaluateLoginTokenRecord_()`) and a manually-run editor wrapper
(`createFoundationLoginToken()`, mirroring `PatientIdentity.gs`'s F3 precedent).

**Zero modification to any of the ten frozen Foundation-family files.** `FoundationLoginTokens.gs`
is a new, eleventh entity file, reusing `FoundationDataStore.gs`'s existing generic
insert/getById/updateById operations and `FoundationAudit.gs`'s existing
`foundationLogAuditEvent_()` exactly as both were already designed to be reused (ADR-009)
— neither needed a single line changed. The token TTL (900 seconds / 15 minutes, per §3's
"≈15 minutes") is declared as a local constant inside the new file rather than added to
`FoundationConfig.gs`, specifically to avoid reopening a frozen file for one new value —
consistent with every other entity file's existing convention of declaring its own
sheet/column/TTL constants locally. Verified via `git diff --name-only`: only
`apps-script/FoundationLoginTokens.gs` (new) appears under `apps-script/`.

**Deliberately does not issue a session.** `foundationConsumeLoginToken_()` returns
`{patient_id}` and nothing else — confirmed both by design review and by the Dependency
Map below, which shows zero call-graph edge from `FoundationLoginTokens.gs` to
`FoundationSession.gs`. IA-2 is responsible for calling `foundationIssueSessionToken_()`
with the resolved `patient_id`.

**A plain SHA-256 hash, not HMAC — a deliberate choice, not an inconsistency with
`FoundationSession.gs`.** `shared/schemas/login-token.md` states the reasoning: HMAC
authenticates a message using a shared secret (needed for `FoundationSession.gs`'s
attacker-supplied session payload); a login token is server-generated, high-entropy,
and random, so hashing it is only ever "fingerprint a secret we already control" — a
plain digest already does that correctly, without adding a second Script-Property secret
for no real security benefit (ADR-006's "avoid over-abstraction" reasoning, applied here).

**A new pattern for this repository: a legitimately-empty-until-set field.** Every prior
Foundation schema has exclusively always-set fields. `used_at` is the first exception —
empty string means "not yet used," reusing `FoundationDataStore.gs`'s existing
empty-cell convention rather than inventing a new null-handling rule. `login-token.schema.json`
deliberately does not apply `format: "date-time"` to `used_at` for exactly this reason —
verified by `conformance.js`'s Stage 0 (accepts the empty-string sentinel, rejects `null`).

**Rejection is deliberately generic.** Every failure mode — unknown token, expired,
already used, malformed input — returns the same `FOUNDATION_LOGIN_TOKEN_INVALID` code
and message. The specific reason is still recorded, but only in a `FoundationAudit.gs`
`login_token_rejected` event's `detail` field, never in the outward envelope — the same
anti-enumeration reasoning (ADR-010) §3 already applies to the request-link step, extended
here to the consume step. Verified: `conformance.js`'s Stage 5 confirms all three specific
reasons (`expired`, `already_used`, `not_found`) are present in the audit log while the
outward envelope stays identical across all of them.

**Test tooling extended, no Foundation file touched to do it.** `validation/phase-2a-foundation/harness.js`'s
`FILES` list gained `FoundationLoginTokens.gs`, and its `Utilities` mock gained
`computeDigest`/`DigestAlgorithm` (backed by Node's real `crypto`, mirroring the same
faithful-mock discipline already applied to `computeHmacSha256Signature`).
`validation/static-analysis/analyze.js`'s `MANUAL_DROPDOWN_WRAPPERS` list gained
`createFoundationLoginToken` (a real omission caught by the tool itself immediately
flagging it as unused on the first run — fixed before this batch shipped, not after).
None of these three files is part of the ten-file frozen set (docs/35 §2) — they are test
tooling, expected to evolve as new modules are added, exactly as `validation/phase-2a-foundation/`
was designed to (its own README: "a future batch's new `shared/` schema needs its own new
conformance stage added here").

**Verification performed** (all real, not assumed): `node --check` on the new `.gs` file;
the static-analysis pass (below); `node conformance.js` — Stage 5, **12 new checks**,
covering pure payload construction against the schema, a real
`foundationCreateLoginToken_()` call, reading back the *actual persisted row* (not the
function's return value) and validating it against `login-token.schema.json`, confirming
the persisted row's `token_hash` differs from the raw token ever handed to a caller, a
real `foundationConsumeLoginToken_()` success resolving the correct `patient_id`,
single-use enforcement (a second consume attempt on the same token fails), an
unknown-token rejection, a malformed-input rejection, and an expired-token rejection
(the stored row backdated directly, the same time-manipulation technique this repo's
other harnesses already use rather than a real 15-minute wait) — plus 2 new Stage 0
checks proving the validator handles the `used_at` sentinel correctly. **38/38 total
conformance checks passed**, first run, no fixes needed; `validation/phase-1-5/validate.js`
re-run clean (39/39), confirming zero regression to Phase 1.5.

**Static analysis: one finding resolved, one new, net unchanged at 6.**
`foundationDsUpdateById_` — Deferred since F3 for having "no consumer yet" — now has a
real one (`foundationConsumeLoginToken_()`'s mark-used step) and drops off the list.
`foundationConsumeLoginToken_` itself is new: a real entry point with no consumer yet
(IA-2 supplies one). `createFoundationLoginToken` was caught as a false "unused" finding
by the tool on the first run — not a real problem, a missing tooling-list entry, fixed
immediately (see above). Final count: 6 total findings (`escapeFoundationHtml_`,
`foundationDsQuery_`, `foundationGetPatientById_`, `foundationIssueSessionToken_`,
`withFoundationAuth_`, `foundationConsumeLoginToken_`), all Deferred, zero Error/Warning/Intentional.

### IA-1 Dependency Map (architectural review artifact)

Derived the same way as F5's Foundation Dependency Map — from the real call graph, not
transcribed from comments.

**New file's dependencies (verified real call-sites):**

`FoundationLoginTokens.gs` → `FoundationAudit.gs`, `FoundationContracts.gs`,
`FoundationDataStore.gs`, `FoundationErrorHandling.gs`, `FoundationUtils.gs` — structurally
identical to `PatientIdentity.gs`'s dependency set (both are Layer 2 entities built on the
same Layer 0/1 infrastructure).

**Newly introduced dependencies:** exactly the five edges above — all *from* the one new
file *into* already-frozen, already-verified infrastructure. **Zero new edges into any of
the ten frozen files** — confirmed by `git diff`, none of the ten was modified.

**Confirmed absent, deliberately:** `FoundationLoginTokens.gs` → `FoundationSession.gs`.
Grepping the new file for `foundationIssueSessionToken_`/`withFoundationAuth_` finds only
comment references explaining the boundary, never a real call — direct, automated
confirmation that IA-1 does not issue sessions.

**Inbound edges into `FoundationLoginTokens.gs`:** none yet — expected; IA-2 is its first
consumer.

**Circular dependencies: zero**, verified two ways (project-wide `analyze.js` scan;
an eleven-file-family-restricted scan including `FoundationLoginTokens.gs`). **Zero edges
in either direction** between the Foundation/IA-1 family and any Phase 1.5 file, confirmed
by grep across every Phase 1.5 file for any reference to the four new
`FoundationLoginTokens.gs` functions.

**Dependency direction:** unchanged from F5's layering, with `FoundationLoginTokens.gs`
joining Layer 2 (entities) alongside `PatientIdentity.gs` — still strictly one-way, no
back-references, nothing in Layer 0/1 aware that Layer 2 grew.

## Batch IA-2 (complete)

Delivered exactly its stated scope (this session's instruction, echoing this section's
own framing above): the magic-link request-link endpoint, the consume-link endpoint,
Foundation's first authenticated Web App route, basic rate limiting, and
account-enumeration protection. Concretely: `apps-script/FoundationRateLimit.gs`
(`foundationCheckAndIncrementRateLimit_()` — per-email, `CacheService`-backed);
`apps-script/FoundationEmail.gs` (`foundationSendLoginLinkEmail_()` — Foundation's own
`MailApp` sender); `apps-script/FoundationLoginFlow.gs`
(`foundationHandleRequestLoginLink_()` / `foundationHandleConsumeLoginLink_()` — the
orchestration IA-1 deliberately left undone, per `FoundationLoginTokens.gs`'s own
header: "IA-2 is what turns that into a real login"); `apps-script/FoundationRouter.gs`
(`handleFoundationRequest_()` — the HTTP dispatcher, plus `get_profile`, the first
authenticated route); and one narrowly-scoped, explicitly-approved addition to
`apps-script/Code.gs` (below).

### A real architectural conflict, surfaced and resolved before implementation, not guessed through

IA-2's scope requires a real, callable Web App route. `apps-script/Code.gs` already
defines the project's one and only `doPost()` — Google Apps Script permits exactly one
per project, a hard platform constraint, not a style choice. §14 Decision 1 (above)
locked one shared Apps Script project for all Phase 2A backend work and states
Foundation work happens by "adding new files... never modifying Phase 1.5's existing
files." These two facts are in genuine tension: no new, independently-routable HTTP
entry point can exist without either modifying `Code.gs` or reverting Decision 1 back
to a separate Apps Script project. This was surfaced explicitly and a decision was
requested rather than guessed — the chosen resolution: the smallest possible additive
change to `Code.gs`. Immediately after its own JSON-parse, `doPost()` now checks for a
`foundation_action` field (absent from every field `Validation.gs` defines for Phase
1.5's own payload — no collision) and, if present, hands the entire request to
`FoundationRouter.gs`'s `handleFoundationRequest_()` unchanged, before any Phase
1.5-specific parsing, sanitizing, or `STAFF_ACCESS_CODE` check runs. If absent,
execution falls through to every line below it, byte-for-byte unchanged from before
this batch. Full reasoning, and the alternative considered (a second Apps Script
project) and not taken: `apps-script/README.md`'s "Foundation/Phase 1.5 dispatch
boundary" section.

This is the one exception to "never modifying Phase 1.5's existing files" this batch
takes, and it is proven safe, not just argued to be: `validation/phase-1-5/validate.js`
gained a new Stage 9 that drives the real `doPost()` through both branches — a
`foundation_action` payload reaches a stubbed router before touching the Sheet, the
access-code gate, or the execution log; a normal Phase 1.5 payload still writes exactly
one row, exactly as before. **42/42** checks pass, zero regression.

### A real, previously-undocumented platform limitation, stated openly rather than silently dropped

docs/29 §10 (above) names "basic per-email/per-IP rate limiting." Google Apps Script's
`doPost(e)` event object never exposes a caller's IP address — no field for it exists on
this platform, confirmed against Apps Script's own `doPost(e)` contract (`parameter`,
`parameters`, `postData`, `contentLength`, `queryString` only). Per-IP limiting is
therefore not implemented — a real, verified platform constraint, not an oversight.
Per-email limiting (`FoundationRateLimit.gs`, `CacheService`-backed, 3 requests / 15
minutes, fails open on a `CacheService` error per an explicitly documented ADR-010
exception) remains the real, working mitigation for both concerns §10 names — enumeration
probing and email-bombing both require repeatedly naming an email address, which this
file directly bounds regardless of network origin.

### Foundation's own, independent email sender — not a modification to `Email.gs`

`apps-script/Email.gs`'s own header states it is "the ONLY module in this project that
may call a mail provider" — true for Phase 1.5's own domain. Foundation is a
structurally separate domain sharing only the Apps Script project (§14 Decision 1), not
the data, Sheets, or Script Properties. `FoundationEmail.gs` is Foundation's own,
equally-scoped `MailApp` caller — the same precedent `FoundationDataStore.gs` already
set by being Foundation's own independent `SpreadsheetApp` caller rather than reusing
Phase 1.5's `Sheets.gs`. Zero modification to `Email.gs`.

A real clickable link target does not exist yet: `login.html`/`verify.html` (originally
§13 Batch 5B, now tracked as future Identity & Access work) are explicitly out of IA-2's
backend-only scope, per this session's instruction. `FOUNDATION_VERIFY_URL_BASE_` is a
stated placeholder pointing at a page that does not yet exist — the same
"correct shape, real value pending a later/operational step" treatment
`FoundationConfig.gs`'s `PATIENT_SPREADSHEET_ID` already gets, not a silently-assumed
frontend.

### Account-enumeration protection, extended to the request side

IA-1 already made the consume-side rejection generic (`FOUNDATION_LOGIN_TOKEN_INVALID`
for every failure mode). IA-2 extends the same discipline to the request side, per §3's
own requirement: `foundationHandleRequestLoginLink_()` returns the exact same generic
ok-envelope message whether the email is unmatched, matched, rate-limited, or matched
and successfully emailed — verified by direct equality check in conformance testing
(Stage 6c/6d), not just written to match the intent. The one distinct response is for a
syntactically invalid email — that reflects only what the requester themselves typed,
never a signal about a different person's account. The *specific* reason
(`email_not_found` / `email_sent` / rate-limited) is still recorded in
`FoundationAudit.gs`, exactly as IA-1 already did for the consume side.

### `get_profile` — Foundation's first authenticated Web App route

Deliberately minimal: derives `patient_id` only from a verified session
(`withFoundationAuth_()`, never client-supplied — ADR-002) and returns the caller's own
Patient record via `foundationGetPatientById_()`. This is a proof-of-the-primitive
route, not the "My Health Journey" dashboard (§5, §13 Batch 5C) — that remains future
work. In the process, it gives two of Foundation's six Deferred static-analysis findings
(docs/35 §6) their first real consumers: `withFoundationAuth_()` (Deferred since F4)
and `foundationGetPatientById_()` (Deferred since F3). `foundationDsQuery_()` (Deferred
since F3) also gains its first real consumer here, via
`foundationFindPatientByEmail_()`'s email lookup, and `foundationIssueSessionToken_()`
(Deferred since F4) and `foundationConsumeLoginToken_()` (Deferred since IA-1) both gain
theirs via the login flow. **All six of Foundation's previously-Deferred findings now
have real consumers — zero remain.**

### No new `shared/` schema

IA-2 introduces no new persisted entity and no new `shared/*.schema.json` contract. Its
wire shapes (`{message}` for request-link, `{session_token, patient_id}` for
consume-link) are ad hoc action responses, validated directly in conformance testing
against the already-existing `response-envelope`/`session`/`patient-identity` schemas —
not new canonical contracts of their own, per `shared/README.md`'s scope (contracts for
entities and cross-cutting shapes, not every individual action's response shape).

**Verification performed** (all real, not assumed): `node --check` on every new `.gs`
file and on the edited `Code.gs`; the static-analysis pass (below);
`node conformance.js` — a new Stage 6, **23 new checks**, covering rate-limiting budget
enforcement and independence across emails, malformed-input rejection, the byte-identical
generic response across unmatched/matched/rate-limited request-link outcomes, a real
email actually sent (checked via the mocked `MailApp` spy) with the correct recipient
and a correctly-shaped link, recovering the real raw token from that emailed link and
consuming it through the full IA-2 wrapper into a real session, single-use enforcement
surviving through that wrapper, the full HTTP-level dispatch (`handleFoundationRequest_()`)
including an unknown-action rejection and `get_profile`'s full authenticated round trip
(valid session resolves the caller's own record; invalid session is rejected without
leaking data; a client-supplied `patient_id` field is ignored in favor of the
session-derived value) — **61/61 total conformance checks passed**, first run, no fixes
needed; `validation/phase-1-5/validate.js` re-run clean (**42/42**, 3 new in this
batch's Stage 9), confirming zero regression to Phase 1.5.

**Static analysis: 0 findings — the cleanest result of any batch so far.** Every one of
Foundation's six previously-Deferred findings (`escapeFoundationHtml_`,
`foundationDsQuery_`, `foundationGetPatientById_`, `foundationIssueSessionToken_`,
`withFoundationAuth_`, `foundationConsumeLoginToken_`) now has a real call-site
introduced by this batch, and this batch introduced no new unused helper of its own.
**0 Error, 0 Warning, 0 Intentional, 0 Deferred.**

### IA-2 Dependency Map (architectural review artifact)

Derived the same way as F5's and IA-1's — from the real call graph.

**New files' dependencies (verified real call-sites):**

| File | Depends on (calls into) |
|---|---|
| `FoundationRateLimit.gs` | *(none — leaf; `CacheService`/`Utilities` are platform primitives)* |
| `FoundationEmail.gs` | `FoundationUtils.gs` |
| `FoundationLoginFlow.gs` | `FoundationDataStore.gs`, `FoundationContracts.gs`, `FoundationErrorHandling.gs`, `FoundationAudit.gs`, `FoundationLoginTokens.gs`, `FoundationSession.gs`, `FoundationRateLimit.gs`, `FoundationEmail.gs`, and `PatientIdentity.gs`'s `FOUNDATION_PATIENTS_SHEET_`/`FOUNDATION_PATIENTS_COLUMNS_` globals (a variable read, the same category of scan gap F5 already hand-verified for `FOUNDATION_CONFIG`, called out here rather than silently omitted) |
| `FoundationRouter.gs` | `FoundationContracts.gs`, `FoundationLoginFlow.gs`, `FoundationRouteGuard.gs`, `PatientIdentity.gs` |

**One new edge into a Phase 1.5 file, deliberate and singular:** `Code.gs` →
`FoundationRouter.gs` (`handleFoundationRequest_()`) — the dispatch shim above. This is
the first edge ever introduced between the Foundation/Identity-&-Access family and
Phase 1.5 in either direction; every prior batch (F1–F5, IA-1) confirmed zero. It is
one-directional (Phase 1.5 → Foundation) and does not create a cycle: no
Foundation/Identity-&-Access file calls into any Phase 1.5 file, confirmed by
`validation/static-analysis/analyze.js`'s project-wide circular-dependency check
(0 found) re-run against this batch's merged state.

**Newly introduced dependencies, in full:** the edges listed above, all *from* the four
new files *into* already-frozen Foundation infrastructure or IA-1's `FoundationLoginTokens.gs`,
plus the one `Code.gs` → `FoundationRouter.gs` edge. **Zero new edges into any of the
ten frozen Foundation-family files** (docs/35 §2) — none of the ten was modified, and
none of the ten was given a new caller it didn't already have.

**Inbound edges into IA-2's four new files:** `Code.gs` → `FoundationRouter.gs` (above)
is the only external inbound edge; the other three (`FoundationRateLimit.gs`,
`FoundationEmail.gs`, `FoundationLoginFlow.gs`) are only called by `FoundationRouter.gs`
or `FoundationLoginFlow.gs` itself, both within this batch.

**Circular dependencies: zero**, verified two ways — `validation/static-analysis/analyze.js`'s
project-wide scan (now covering all 29 `apps-script/*.gs` files, including this batch's
four new ones and the edited `Code.gs`), and a manual trace of the one cross-domain edge
(`Code.gs` → `FoundationRouter.gs`) confirming nothing on the Foundation side calls back
into `Code.gs` or any other Phase 1.5 file.

**Dependency direction:** Foundation's existing layering (F5's diagram, unchanged) plus
a new Layer 3.5 sitting between entities and the outside world —

```
Layer 2 (entities)        PatientIdentity.gs   FoundationSession.gs   FoundationLoginTokens.gs
                                 ^                    ^                       ^
Layer 3 (route/orchestration)  FoundationRouteGuard.gs   FoundationLoginFlow.gs
                                        ^                          ^
                            FoundationRateLimit.gs (leaf)   FoundationEmail.gs (leaf)
                                                   ^
Layer 4 (HTTP dispatch)                    FoundationRouter.gs
                                                   ^
Layer 5 (Phase 1.5's own entry point, one deliberate edge)   Code.gs
```

Every arrow still points from a higher layer down to a lower one; `Code.gs` is the one
file above Foundation's own layering that now reaches into it, deliberately and singly,
never the reverse.

---

# 16. Patient Access Implementation

The Identity & Access backend (F1–F5, IA-1, IA-2) is complete and frozen except for
bug fixes (docs/36-IDENTITY-AND-ACCESS-CLOSEOUT.md). Patient Access is the milestone
that builds the patient-facing surface against it, starting with the deferred frontend
half of this document's original §13 Batch 5B.

> **Update, 2026-07-03:** Batches PA-1 and PA-2 below — the dashboard shell (login,
> verify, `assets/site.css`, and `/my-health-journey/`) — are now **complete and frozen
> except for bug fixes**, per this session's explicit instruction. See
> docs/38-PATIENT-ACCESS-DASHBOARD-SHELL-CLOSEOUT.md for the closeout summary and
> Batch PA-3 entry criteria, and docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md for
> the pre-PA-3 readiness review. Neither PA-1 nor PA-2's implementation notes below were
> altered to produce either document — both are reports on already-shipped work.

## Batch PA-1 (complete)

Delivered exactly its stated scope: `login.html` (email-entry form, calls
`request_login_link`) and `verify.html` (reads `?token=`, calls `consume_login_link`,
stores the returned session). **Zero modification to any backend file** — confirmed via
`git diff --name-only`: only `login.html` and `verify.html` appear as new files;
`apps-script/`, `shared/`, and every other frozen file are untouched.

**Static HTML/CSS/vanilla JS, no framework** (docs/10, unchanged). Both pages consume
the existing `foundation_action`-routed `doPost()` endpoint exactly as IA-2 shipped it —
`request_login_link`, `consume_login_link` — using the same deployed Web App URL
`internal/consultation-summary.html` already uses (Foundation and Phase 1.5 share one
project/one `doPost()`, docs/29 §14 Decision 1).

**Reuse over duplication, verified before writing any new markup.** Every reusable
pattern in the repository was identified first: the `:root` design-token set including
the warn/err/ok status-color triad, the `.wrap`/`.card`/`.field`/`.submit`/`.status`
component set, and the `fetch()`-with-`text/plain`-no-preflight calling convention —
all taken from `internal/consultation-summary.html`, the only existing page in this
repo that already calls the Apps Script backend. The minimal "utility page" shell
(heading + card, no full header/nav) follows the precedent independently established by
`thanks.html`, `booking-received.html`, and `internal/consultation-summary.html` for
single-purpose pages not yet linked from primary nav — deliberately not duplicating the
full header/mobile-menu component, which Batch 5C's `assets/site.css` extraction will
need to touch anyway.

**A real accessibility defect was caught by testing, not assumed away.** Browser
verification (Playwright, keyboard-driven focus, not a simulated `.focus()` call) found
that `.field input:focus{outline:none;...}` — a rule copied from
`internal/consultation-summary.html` — unconditionally strips the `:focus-visible`
outline by CSS specificity, a real WCAG 2.2 AA violation (docs/14: "visible focus
states") present in the source pattern being reused. Fixed in `login.html` before
shipping: split into `.field input:focus{border-color:...}` (mouse and keyboard) plus
`.field input:focus:not(:focus-visible){outline:none}` (mouse only) — the pre-existing
`internal/consultation-summary.html` bug was not touched, as it is a Phase 1.5 file and
out of this batch's scope, but this batch does not repeat it.

**A deliberate security-motivated UX decision.** `verify.html` does not auto-submit
`consume_login_link` on page load. Email-security link-scanners are a known real-world
risk to magic-link flows — a scanner that pre-fetches the emailed link before the
patient clicks it would otherwise burn the single-use token on the scanner's behalf,
locking the real patient out. Instead, the page shows a "Continue to sign in" button;
the consume call fires only on a genuine user click. Verified directly: a Playwright
check confirms no network request fires merely from loading the page with a token
present.

**Requirements verification, all real, not assumed:**
- `session_token` stored in `sessionStorage` only, on exactly one key, only after a
  successful consume — verified directly (`Object.keys(sessionStorage).length === 1`).
- `patient_id` is never stored client-side under any key, at any point — verified
  directly (the returned `patient_id` is read from the response and never written to
  storage).
- Every response branch reads `data.status`/`data.error.code`/`data.error.message`
  from the response-envelope body; no code path reads an HTTP status code (`response.ok`
  or `response.status` off the `fetch()` `Response` is never referenced).
- Backend `error.message` values are displayed verbatim rather than re-worded — a
  single source of truth for user-facing copy, and the same anti-enumeration guarantee
  IA-2 already built (docs/29 §3) is preserved exactly, since the frontend never adds
  its own wording that could vary by outcome.
- No horizontal overflow at a 375px viewport on either page (Playwright-measured,
  `scrollWidth`–`clientWidth` = 0).
- Labels correctly associated via `for`/`id`; keyboard `Tab` navigation reaches every
  interactive control with a visible focus outline (post-fix).

**Verification performed** (all real, browser-driven, not assumed): a local static
server plus headless Chromium (Playwright) exercising both pages end to end with the
backend mocked at the network layer — 20 checks covering native validation, the success
and error paths for both endpoints (response-envelope branching, not HTTP status),
network-failure handling, the no-auto-fire security property, `sessionStorage`
contents (both what's stored and what's deliberately never stored), responsive layout,
and keyboard accessibility. **20/20 passed**, one real defect found and fixed before
shipping (above). `node validation/static-analysis/analyze.js`,
`node validation/phase-2a-foundation/conformance.js`, and
`node validation/phase-1-5/validate.js` all re-run clean and unchanged (0 findings,
61/61, 42/42) — expected and confirmed, since this batch touches no backend file.

**Deferred, not silently skipped:** `assets/site.css` extraction (still each page's own
`<style>` block, matching every existing page's current convention — formal extraction
remains Batch 5C's named first step, docs/29 §5); the "My Health Journey" dashboard
`verify.html`'s success state links toward (honestly stated as "coming soon" rather than
a broken redirect to a page that doesn't exist yet); adding "Patient Login" to primary
nav (Batch 5G, unchanged).

## Batch PA-2 (complete)

Delivered exactly its named scope (§13 Batch 5C, and this document's own PA-1 deferral
note above): the `assets/site.css` token extraction, and the `/my-health-journey/`
dashboard shell wired to PA-1's session — plus the two deferrals PA-1 named as its own
follow-on (the dashboard itself, and `verify.html`'s success-state link now pointing at
a real page instead of "coming soon"). Preceded by a dedicated pre-implementation review
(docs/37-DASHBOARD-SHELL-READINESS-REVIEW.md), approved before any code was written, per
this session's own instruction. **Zero backend modification** — confirmed via
`git diff --name-only`: no `apps-script/` or `shared/` file appears; only frontend files
(`assets/site.css`, `login.html`, `verify.html`, `my-health-journey/index.html`,
`my-health-journey/dashboard.js`) and documentation changed.

**Component Reuse Review, performed before writing any new markup.** Every shared
pattern already established by `login.html`/`verify.html` — the `:root` token set, the
`.card`/`.field`/`.submit`/`.secondary`/`.status`/`.skeleton`/`:focus-visible` component
set, and the `fetch()`-with-`text/plain`-no-preflight calling convention — was extracted
into `assets/site.css` rather than copied a third time into the new dashboard page,
directly closing docs/20 §5's and this document's own §5's long-standing "duplicated
per-page" note. `index.html`'s `.skip` skip-link component was ported into the shared
stylesheet too, since the dashboard is the first Phase 2A page complex enough (header +
nav + multiple cards) to need one. Deliberately **not** touched: `index.html` and
`internal/consultation-summary.html` — both out of scope (the former is the public
marketing site, docs/29 §0's "not a redesign"; the latter is a frozen Phase 1.5 file) —
each keeps its own independent stylesheet, per docs/37 §7's explicit recommendation.

**`assets/site.css` gains one new, small addition beyond a pure extraction:**
`.status.warn`, using the `--color-warn-*` tokens already defined in the token set but
previously only ever used inline by `internal/consultation-summary.html`'s staff banner.
Needed for the session-expiry notice below — not a redesign of the token system, just
its first patient-facing use.

**Authenticated header — exactly the four elements of the approved design decision,
no more:** Wise logo, "My Health Journey" (the page's one semantic `h1`, deliberately
placed in the header rather than duplicated again in `<main>` — docs/37 §8's heading-
hierarchy recommendation), the patient's real greeting (`full_name` from `get_profile`,
Foundation's first authenticated route — the only real data anywhere in this batch), and
a Sign out control.

**Session guard, built before any dashboard markup depended on it (docs/37 §3/§9).**
`my-health-journey/dashboard.js` reads `sessionStorage`, and — if a token is present —
calls `get_profile` to verify it server-side before rendering anything dashboard-shaped;
an absent token redirects to `/login.html` immediately, no message (never having been
logged in isn't a privacy event). A **present-but-rejected** token (expired, tampered, or
unknown — `FoundationRouteGuard.gs`'s `withFoundationAuth_()` collapses all three to the
same `FOUNDATION_UNAUTHORIZED` code, unchanged) redirects to `/login.html?reason=expired`,
clearing the stale token first. `login.html` reads that query parameter, shows the
approved copy — "For your privacy, your secure session has ended. Please sign in
again." — via the new `.status.warn` variant, and strips the parameter from the visible
URL (the same history-hygiene pattern `verify.html` already uses for its own `?token=`).
A network failure (the fetch itself failing, not a rejected session) is treated as
distinct: the token is kept, and a friendly, non-technical retry message is shown instead
of forcing a re-login on a connectivity blip (docs/04 Error State).

**Three distinct Empty State types, per the approved design decision (docs/37 §5):**
"No data yet" (a real, wired feature with zero rows — no card in this batch has a live
data source, so this variant has no page consumer yet, the same "built, verified, real
consumer arrives in a later batch" treatment already applied to several Foundation
functions in F4/F5/IA-1 above), "Coming later in Phase 2A" (Timeline, Symptom Tracker,
Reports — each already has a named, sequenced future batch, 5D/5E/5F), and "Planned for
a future version" (Care Plan, Messages, Digital Twin — no architecture exists yet for
any of the three, docs/29 §2.2, so the copy deliberately avoids implying a near-term
date). All six of PA-2's dashboard cards render one of the latter two types; the first
type is exercised directly (not reimplemented) by this batch's own test suite via a
small, explicit test-support export (`window.WiseDashboard`), the same kind of "real
function, not a re-guess of its behavior" verification discipline this document's
Foundation batches have used throughout.

**Loading state:** a full-shell skeleton (header greeting + six skeleton card frames)
renders until the session-verification round trip resolves, then is replaced wholesale —
chosen over a per-card independent skeleton because this batch has exactly one data
call (`get_profile`); per-card independent loading becomes relevant once 5D/5E/5F each
add their own real, separately-timed data call (docs/37 §4's own forward note).

**Responsive:** the dashboard is the first Phase 2A page with more than one card, so —
unlike `login.html`/`verify.html`'s single centered card — it needed an actual
grid-to-stack breakpoint (`auto-fit`/`minmax(260px,1fr)`, collapsing to one column under
640px), verified at a 375px viewport with the same zero-horizontal-overflow bar PA-1
already set for the other two pages (now re-verified for them too, since both changed).

**Verification performed** (all real, browser-driven, not assumed):
`validation/pa-2-dashboard/browser-test.js` — a new, committed Playwright harness (the
first Phase 2A frontend suite to be committed rather than run ad hoc, formalizing PA-1's
own testing discipline the same way F5 formalized Foundation's ad hoc backend checks) —
a local static server plus headless Chromium, the backend mocked at the network layer.
**26/26 checks passed**, covering: the no-token redirect; a valid session rendering the
real greeting and all six cards with the correct badge/tone split (3 "Coming later in
Phase 2A", 3 "Planned for a future version"); the "No data yet" variant's own correctness
via direct function invocation; a rejected session redirecting with the exact approved
copy and the stale token actually cleared; sign-out clearing the token and redirecting;
a network failure preserving the token and showing a friendly message instead of forcing
re-login; zero horizontal overflow at 375px on all three touched pages; and real
keyboard-driven (`page.keyboard.press('Tab')`, not a simulated `.focus()` call — the same
technique that caught PA-1's own focus-visible regression) verification that the sign-out
control is keyboard-reachable with a visible focus outline, plus a heading-hierarchy check
(exactly one `h1`, one `h2` per card).

`node validation/static-analysis/analyze.js` (0 findings), `node
validation/phase-2a-foundation/conformance.js` (61/61), and `node
validation/phase-1-5/validate.js` (42/42) all re-run clean and unchanged — expected and
confirmed, since this batch touches no `apps-script/` or `shared/` file.

**Deferred, not silently skipped:** real Timeline/Symptom Tracker/Reports data (Batches
5D/5E/5F — this batch ships their card frames as Empty States only); adding "Patient
Login" to primary nav (Batch 5G, unchanged); a shared cross-page session-guard/header
JavaScript module (`my-health-journey/dashboard.js` is self-contained, matching
`login.html`/`verify.html`'s existing per-page-script convention — worth revisiting only
once a second authenticated page actually exists to reuse it, per the "don't build for a
hypothetical second consumer" discipline this document has applied elsewhere).

## Batch PA-3 (complete)

Delivered exactly its named scope (§13 Batch 5D): the `ConsultationHistory` sheet and
data-access layer, the patient-facing read-only Timeline (list + dashboard preview) and
Consultation History detail view, and a manually-run staff entry mechanism. Preceded by
a dedicated pre-implementation review (docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md)
and an architectural clarification (docs/40-CONSULTATION-IDENTITY-STRATEGY.md), both
approved before any code was written, per this session's own instruction.

**Frozen components were not modified beyond the disclosed, additive exceptions named
below.** Per this session's explicit instruction ("do not modify frozen Foundation,
Identity & Access, or PA-2 components except for bug fixes"), every change to an
already-shipped file is named here, not silently made:

- `apps-script/FoundationRouter.gs` gained two new `switch` cases (`get_timeline`,
  `get_timeline_entry`) and their two thin wiring functions — the same category of
  disclosed, additive exception as `Code.gs`'s own one-line dispatch shim in IA-2 (see
  `FoundationRouter.gs`'s own header comment for the full reasoning: a new case in an
  already-designed extension point, zero existing lines touched, zero existing behavior
  changed).
- `my-health-journey/dashboard.js` gained the Timeline card's real-data wiring
  (`loadTimelinePreview()`, `timelinePreviewHtml()`, an `escapeHtmlForDisplay()` helper,
  and an `id` attribute on each card's body `<div>`) — the explicitly-planned evolution
  docs/38 §9 itself anticipated ("wiring real data into the dashboard's existing Empty
  State cards"), not a restructuring of the shell or its session guard.
- No other frozen file (`login.html`, `verify.html`, `assets/site.css`,
  `my-health-journey/index.html`, any of the ten Foundation files, any of the five
  Identity & Access files) was touched at all.

**Consultation identity strategy, applied (docs/40).** `record_id` is the sole key for
Timeline linking and detail-view fetches — never `entry_date`, never row/list position.
`foundationGetConsultationEntryById_()` verifies the requested record's own `patient_id`
matches the session-derived one before returning it; an unknown `record_id` and a
cross-patient `record_id` return the identical `FOUNDATION_NOT_FOUND` envelope, so a
caller can never distinguish "not yours" from "doesn't exist" (the same anti-enumeration
discipline `login-token.md` already established for login tokens).

**`entry_type` gap closed (docs/39 §2).** `ConsultationHistory`'s schema now includes
`entry_type` (fixed to `"consultation"` in this version — see
`shared/schemas/consultation-history.md` for why the enum stays deliberately narrow
rather than widened speculatively to docs/33 §3.1's full Timeline Event set), avoiding a
future migration the day a second Timeline Event source (Care Plan, Digital Twin) is
built.

**Ordering (docs/39 §3).** Timeline entries sort by `entry_date` descending, with
`created_at` descending as an explicit tiebreaker — `entry_date` (the visit date) and
`created_at` (when the row was written) can diverge, since staff may backfill an entry
after the fact.

**A deliberate simplification, stated openly: no staff-facing Web App tool.** docs/29 §7
describes an "access-code-gated internal tool," but Foundation has no staff-authorization
primitive of its own, and building one would mean either reopening `Code.gs` a second
time or inventing new Foundation staff-auth infrastructure — both bigger moves than this
batch's plan authorized. `createFoundationConsultationEntry()` is the same manually-run,
no-route, no-Sheet-menu pattern `PatientIdentity.gs`/`FoundationLoginTokens.gs` already
established for exactly this category of gap (see `FoundationConsultationHistory.gs`'s
own header comment). A real staff tool remains future work, not silently dropped.

**Component Reuse Review, performed before writing any new markup.** `assets/site.css`
tokens/`.card`/`.status`/`.skeleton` and PA-2's Empty State pattern reused unchanged;
`index.html`'s `.journey`/`.j-step` vertical-timeline visual adapted (not literally
imported) into the new Timeline list page's own `.tl-track`/`.tl-item` styles, freshly
implemented in the new pages' own `<style>` blocks specifically to avoid touching
`index.html` (frozen, out of scope) or `my-health-journey/index.html` (frozen PA-2).
docs/39 §7's "ripe for extraction" recommendation — a shared session-guard/header
module, once a second authenticated page exists — was acted on via a **new** file,
`my-health-journey/session-guard.js`, consumed only by the two new Timeline pages;
`dashboard.js` keeps its own independent, unmodified-beyond-wiring implementation, per
this session's explicit freeze instruction taking precedence over that recommendation's
more general framing.

**Verification performed** (all real, not assumed):
- `node validation/static-analysis/analyze.js` — 0 findings (the manually-run wrapper
  `createFoundationConsultationEntry` added to `MANUAL_DROPDOWN_WRAPPERS`, matching
  `createFoundationPatient`/`createFoundationLoginToken`'s precedent; one real
  false-positive on `foundationCompareConsultationEntriesDesc_` — passed to
  `Array.prototype.sort` by reference, so the scanner's `name(` call-site check missed
  it — resolved by wrapping the call in an explicit named invocation, not by changing
  the tool, since this is a one-off code-level fix, not a recurring scan gap).
- `node validation/phase-2a-foundation/conformance.js` — **81/81** (23 pre-existing +
  Stage 7's 27 new checks), covering schema conformance, cross-patient-entry isolation,
  ordering (including the same-`entry_date` tiebreaker, backdating one row's
  `created_at` directly — the same time-manipulation technique this repo's other
  harnesses already use), and the two new `FoundationRouter.gs` routes end to end,
  including the cross-patient-authorization rejection at the real HTTP-dispatch layer
  and confirming `patient_id` is never accepted from a client-supplied field.
- `node validation/phase-1-5/validate.js` — 42/42, unchanged.
- `validation/pa-2-dashboard/browser-test.js` — updated (not just re-run) to reflect the
  Timeline card's real behavior: the mock now routes by `foundation_action` instead of
  returning one blanket envelope, `phase2aCount` drops from 3 to 2 (Timeline is no
  longer a placeholder), and a new check confirms the Timeline card renders a real,
  live "No data yet" badge for a zero-entry patient — **28/28** passed.
- `validation/pa-3-timeline/browser-test.js` — new, committed, mirroring
  `pa-2-dashboard`'s discipline exactly — **29/29** passed, covering both new pages'
  session guard, populated/empty/network-failure states, the full-vs-truncated summary
  text distinction between list and detail views, the cross-patient/unknown-id rejection
  at the frontend layer, sign-out, 375px responsive layout, and keyboard-driven
  accessibility (ordered-list markup, heading hierarchy, focus visibility).

**Deferred, not silently skipped:** a real staff-facing entry tool (above); Symptom
Tracker (Batch 5E/PA-4) and Reports (Batch 5F) remain separate, independent dashboard
cards — this batch deliberately does not merge either into the Timeline feed (docs/39
§8/§9); adding "Patient Login" to primary nav (Batch 5G, unchanged).

## Batch PA-4 (complete)

Delivered exactly its named scope (§13 Batch 5E): the `SymptomLogs` sheet and
data-access layer, the platform's first patient-*writable* feature. Preceded by a
dedicated pre-implementation review (docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md),
approved before any code was written, per this session's own instruction. Three
decisions the review surfaced rather than assumed were resolved by explicit approval
before implementation began: all four scale fields are mandatory (no partial log);
`logged_at` is always server-set, never patient-editable; and no offline/PWA support
exists for the quick-log form (a live connection is required, consistent with every
other Foundation write path).

**Frozen components were not modified beyond the disclosed, additive exceptions named
below.** Per this session's explicit instruction, every change to an already-shipped
file is named here, not silently made:

- `apps-script/FoundationRouter.gs` gained two new `switch` cases (`log_symptom`,
  `get_symptom_logs`) and their two thin wiring functions — the same category of
  disclosed, additive exception PA-3's own `get_timeline`/`get_timeline_entry` cases
  already established.
- `my-health-journey/dashboard.js` gained the Symptom Tracker card's real wiring
  (`loadSymptomPreview()`, `symptomFormHtml()`, `symptomSummaryHtml()`,
  `wireSymptomForm()`, `refreshSymptomSummary()`, `conditionOptionsHtml()`) — the
  explicitly-planned evolution docs/38 §9 anticipated, not a restructuring of the
  shell or its session guard.
- `assets/site.css` gained two new, purely additive rules — `.field textarea` and
  `.field select`, styled identically to the existing `.field input` — this phase's
  first form needing either element (every prior form, `login.html`, had exactly one
  `<input>`). Zero existing rule was touched.
- `validation/pa-2-dashboard/browser-test.js` was updated (not just re-run) the same
  way PA-3 already updated it for the Timeline card: `mockGetProfile()` now also routes
  `get_symptom_logs`; `phase2aCount` drops from 2 to 1 (Reports is now the only
  remaining placeholder); `nodataCount` rises from 1 to 2 (Timeline and Symptom Tracker
  each render their own real "No data yet" badge).
- `validation/phase-2a-foundation/schema-validator.js` gained `integer` type support
  and `minimum`/`maximum` numeric bounds — a small, additive extension to this tool's
  documented subset (`validation/phase-2a-foundation/README.md`'s own stated policy:
  "Extend it only when a real `shared/` schema actually needs a construct it doesn't
  yet support"), needed for the first time by `symptom-log.schema.json`'s four 1-10
  scale fields. Zero existing check was changed; every previously-passing assertion
  still passes unchanged.
- No other frozen file (`login.html`, `verify.html`, `my-health-journey/index.html`,
  any Foundation/Identity & Access file, any PA-3 file) was touched at all.

**`shared/constants/condition-slugs.json` populated, closing Batch F3's own named
deferral.** `shared/README.md` and `shared/schemas/patient-identity.md` both named the
condition-slug list (hand-duplicated between `apps-script/Config.gs` and
`internal/consultation-summary.html`) as a candidate for `shared/constants/`, deferred
for lack of a second real consumer. `SymptomLogs.condition_slug` is that second real
consumer — `apps-script/FoundationSymptomLog.gs`'s `FOUNDATION_ALLOWED_CONDITION_SLUGS_`
is manually adapted from this new canonical file, per `shared/README.md`'s
port-into-a-Foundation-file convention. Neither `Config.gs` nor the internal tool's
`<select>` was modified — both are Phase 1.5 files, out of this batch's scope.

**No per-entry detail fetch, a deliberate simplification confirmed, not a gap.**
Unlike `FoundationConsultationHistory.gs`, `FoundationSymptomLog.gs` provides no
`get_by_id` function — docs/41 §12 found no product requirement for one, since a
Symptom Log row has no long-form text that benefits from its own page. If a future
batch adds a detail view, `record_id` is already stored on every row for exactly that
purpose, needing no migration.

**Component Reuse Review, performed before writing any new markup.** `assets/site.css`
tokens/`.card`/`.status`/`.skeleton` and PA-2's Empty State pattern reused unchanged;
the quick-log form's scale/notes/condition fields extend `login.html`'s `.field`
pattern into this phase's first genuinely multi-field form; the Symptom History list
page reuses PA-3's `.tl-track`/`.tl-item` visual (freshly implemented in its own
`<style>` block, per this repo's per-page CSS convention, not imported) and
`my-health-journey/session-guard.js` unchanged.

**Verification performed** (all real, not assumed):
- `node validation/static-analysis/analyze.js` — 0 findings (31 `apps-script/*.gs`
  files scanned).
- `node validation/phase-2a-foundation/conformance.js` — **107/107** (81 pre-existing +
  Stage0's 4 new schema-validator self-checks + Stage 8's 22 new checks), covering
  schema conformance, the all-four-mandatory validation rule, out-of-range/non-integer
  rejection, `condition_slug` taxonomy validation, cross-patient isolation on both
  create and list — the platform's first patient-writable route's highest-priority
  property — and both new `FoundationRouter.gs` routes end to end, confirming
  `patient_id` is never accepted from a client-supplied field.
- `node validation/phase-1-5/validate.js` — 42/42, unchanged.
- `validation/pa-2-dashboard/browser-test.js` — updated and re-run — **30/30** passed
  (28 pre-existing + 2 new checks for the Symptom Tracker card's own real "No data yet"
  render and its always-present quick-log form).
- `validation/pa-3-timeline/browser-test.js` — re-run unchanged — **29/29** passed,
  confirming zero regression to PA-3's own frontend.
- `validation/pa-4-symptom-tracker/browser-test.js` — new, committed, mirroring
  `pa-3-timeline`'s discipline exactly — **28/28** passed, covering the Symptom History
  page's populated/empty/network-failure states, escaped-notes rendering (a
  `<script>`-tag fixture confirms it is never live markup), the condition tag, the
  dashboard card's always-present form with every field's `<label for>`, a successful
  submission's `aria-live` confirmation and form reset, a rejected submission's
  verbatim backend message and preserved in-progress values, sign-out, 375px responsive
  layout, and keyboard-driven accessibility.

**A disclosed testing-environment note.** All three browser-test suites above
(`pa-2-dashboard`, `pa-3-timeline`, `pa-4-symptom-tracker`) were executed in this
session using a temporary, session-local Playwright install pointed at this
environment's pre-installed Chromium binary — not via the committed invocation as
literally written (`docs/41`'s Finding 5 recorded that no `package.json`/
`node_modules/playwright` exists in this repository). The committed `browser-test.js`
files themselves were not changed to depend on this session's local setup; a future
session with Playwright properly installed should be able to re-run them exactly as
documented in each suite's own README.

**Deferred, not silently skipped:** Reports (Batch 5F) remains a separate, independent
dashboard card — this batch does not touch it; adding "Patient Login" to primary nav
(Batch 5G, unchanged); a `package.json` declaring the `playwright` dev dependency so
these suites can be run without a session-local workaround (a real, disclosed gap,
carried forward from docs/41 Finding 5, still not this batch's problem to solve).

## Batch PA-5 (complete)

Delivered exactly its named scope (§13 Batch 5F): the `Reports` sheet, Drive
integration, and upload/list/download endpoints and validation — the platform's
highest-risk feature (§8, §11). Preceded by a dedicated pre-implementation review
(docs/42-REPORT-UPLOAD-READINESS-REVIEW.md), approved before any code was written.
Seven architecture decisions the review resolved by explicit approval rather than
silent default: a 5 MB size cap stored as a shared constant, never hardcoded; MIME
validation using every mechanism realistically available (extension, client-declared
type, and server-side content-based detection via `Utilities.newBlob()`), with the
content-sniffing heuristic's limitation disclosed rather than overstated; authorization
always beginning with the application, Drive permissions treated as defense-in-depth
only; metadata immutable immediately after upload (no edit); no delete operation; no
staff Web App upload route (a manually-run wrapper only); and
`FoundationConsultationHistory.gs`'s pre-existing header-comment bug left untouched, per
explicit instruction, since this batch never needed to touch that file.

**Frozen components were not modified beyond the disclosed, additive exceptions named
below.** Per this session's explicit instruction, every change to an already-shipped
file is named here, not silently made:

- `apps-script/FoundationRouter.gs` gained three new `switch` cases (`upload_report`,
  `get_reports`, `download_report`) and their three thin wiring functions — the same
  category of disclosed, additive exception PA-3's and PA-4's own new cases already
  established.
- `my-health-journey/dashboard.js` gained the Reports card's real wiring
  (`loadReportsPreview()`, `reportsFormHtml()`, `reportsListHtml()`,
  `readFileAsBase64()`, `refreshReportsList()`, `wireReportForm()`) — the
  explicitly-planned evolution docs/38 §9/docs/04's own "upload widget" line already
  anticipated, not a restructuring of the shell or its session guard. The Reports card
  is now the last dashboard card to leave the "Coming later in Phase 2A" placeholder
  behind — every card either shows real data or an honest "planned for a future
  version" state.
- `validation/pa-2-dashboard/browser-test.js` was updated (not just re-run) the same
  way PA-3/PA-4 already updated it for their own cards' wiring: `mockGetProfile()` now
  also routes `get_reports`; `phase2aCount` drops from 1 to 0 (zero "Coming later in
  Phase 2A" placeholders remain); `nodataCount` rises from 2 to 3 (Reports renders its
  own real "No data yet" badge alongside its always-present upload form).
- No other frozen file (`login.html`, `verify.html`, `my-health-journey/index.html`,
  any Foundation/Identity & Access/PA-3/PA-4 file, `assets/site.css`) was touched at
  all — the file input reuses `.field input` unchanged, and the Reports page's own two
  small additive rules (`.rp-meta`, `.rp-actions`) live in its own per-page `<style>`
  block, per this repo's existing per-page CSS convention, not folded into the shared
  stylesheet.

**`shared/constants/upload-limits.json` and `shared/schemas/report.schema.json`
created, the bootstrap exception** (`shared/README.md`) — this contract's first
definition and its first implementation (`apps-script/FoundationReports.gs`) were
necessarily created together, the same exception PA-4's `condition-slugs.json`/
`symptom-log.schema.json` pair already used.

**No update, no delete — a deliberate lifecycle, confirmed as an absence, not a gap.**
Unlike every other Foundation-family entity, `FoundationReports.gs` provides create,
list, and get-by-id/download functions only. Verified directly in
`validation/phase-2a-foundation/conformance.js` Stage 9
(`typeof ctx.foundationUpdateReport_ === 'undefined'` etc.), not merely omitted from a
feature list.

**The only staff-attributed path is a manually-run wrapper, no Web App route.**
`createFoundationReportForExistingDriveFile()` attaches an already-existing Drive file
(uploaded to Drive directly by staff, outside this application) to a patient's Reports
list, running the identical content-based type/size validation the patient upload route
uses — the same no-route, no-Sheet-menu pattern `createFoundationConsultationEntry()`/
`createFoundationPatient()` already established.

**Component Reuse Review, performed before writing any new markup.** `assets/site.css`
tokens/`.card`/`.field`/`.status`/`.submit`/`.secondary` and PA-3's Timeline visual
(`.tl-track`/`.tl-item`) all reused unchanged; the upload form's single file field
extends `login.html`'s `.field` pattern with zero new CSS (`.field input` already
covers `type="file"`); the Reports full-history page reuses PA-4's Symptom History page
structure almost exactly, needing only two small additive rules for the one piece of
per-entry markup (filename + type/size + a Download action) that doesn't fit either
prior page's shape exactly; `my-health-journey/session-guard.js` reused unchanged.

**Verification performed** (all real, not assumed):
- `node validation/static-analysis/analyze.js` — 0 findings (32 `apps-script/*.gs`
  files scanned).
- `node validation/phase-2a-foundation/conformance.js` — **143/143** (120 pre-existing +
  23 new Stage 9 checks), covering schema conformance, the size cap enforced against
  real decoded bytes, the content-based MIME detection actually rejecting a file whose
  real bytes don't match its declared extension/mime_type (the platform's key
  MIME-spoofing security proof), cross-patient isolation on list and download, the
  ownership check running before any `DriveApp` call, byte-for-byte round-trip of
  downloaded content, the manually-run staff wrapper against a real pre-existing Drive
  file, and all three new `FoundationRouter.gs` routes end to end confirming
  `patient_id`/`uploaded_by` are never accepted from a client-supplied field.
- `node validation/phase-1-5/validate.js` — 42/42, unchanged.
- `validation/pa-2-dashboard/browser-test.js` — updated and re-run — **32/32** passed
  (26 pre-existing + 6 new checks for the Reports card's own real "No data yet" render,
  its always-present upload form, and the field's `<label for>`).
- `validation/pa-3-timeline/browser-test.js` — re-run unchanged — **29/29** passed,
  confirming zero regression to PA-3's own frontend.
- `validation/pa-4-symptom-tracker/browser-test.js` — re-run unchanged — **28/28**
  passed, confirming zero regression to PA-4's own frontend.
- `validation/pa-5-reports/browser-test.js` — new, committed, and actually executed —
  **32/32** passed, covering the Reports full-history page's populated/empty/
  network-failure states, escaped filenames (a `<script>`-tag fixture confirms it is
  never rendered as a live element), a real file selected via Playwright's
  `setInputFiles()` and uploaded successfully (form reset, list refreshed), the
  client-side size pre-check rejecting an oversized file *before the network call is
  ever made* (asserted directly, not inferred), a rejected upload's verbatim backend
  message, a real triggered browser download (Playwright's `download` event, asserting
  the suggested filename), a rejected download's inline error with no navigation,
  sign-out, 375px responsive layout, and keyboard-driven accessibility.

**A note on this session's testing environment, more complete than prior batches'
disclosed gap.** Unlike PA-4 (docs/41 Finding 5: no Playwright available in that
session), this session had Playwright installed in this environment's global
`node_modules` (`NODE_PATH=$(npm root -g)`), so every browser suite above — including
PA-3's and PA-4's own, re-run for zero-regression confirmation — was actually executed,
not assumed. The underlying gap those suites' own READMEs recorded (no
`package.json`/committed Playwright dependency anywhere in this repository) is
unchanged and still real; this was a property of this particular session's environment,
not a fix to that gap.

**Deferred, not silently skipped:** adding "Patient Login" to primary nav (Batch 5G,
unchanged — Reports was the last data-feature card, so 5G is now unblocked); a
`package.json` declaring the `playwright` dev dependency (still not this batch's
problem to solve, per docs/41 Finding 5, carried forward again); `docs/12-DATA-ARCHITECTURE.md`'s
still-open §4 schema-table update (§12's Documentation Impact table already listed this
as "Open" before PA-3/PA-4 shipped their own schemas without closing it — a pre-existing
inconsistency this batch did not introduce and, per this session's scope discipline, did
not fix either).
