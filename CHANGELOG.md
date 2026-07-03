# Changelog

All notable changes to the Wise Homeopathy website are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are in `YYYY-MM-DD`.

See `WEBSITE-AUDIT.md` for the full audit this work is based on, and its Phase 4 log for roadmap-item-level tracking.

## [Unreleased]

Nothing pending.

## 2026-07-03 — Patient Access Dashboard Shell Closeout + Consultation Timeline Readiness Review (docs only)

Documentation-only batch. No frontend page, `apps-script/*.gs` file, `shared/`
contract, or architecture document was modified — confirmed via `git diff`.

- Added `docs/38-PATIENT-ACCESS-DASHBOARD-SHELL-CLOSEOUT.md`: the official closeout of
  Patient Access Batches PA-1–PA-2 (login/verify, `assets/site.css`, the
  `/my-health-journey/` dashboard shell) — scope delivered, architecture summary, the
  session-guard and three-Empty-State model as actually built, validation/regression/
  static-analysis results re-verified fresh against the current merged state, deferred
  work, lessons learned, and Batch PA-3 entry criteria.
- **Patient Access Batches PA-1–PA-2 are now frozen except for bug fixes** — see
  docs/38 §9. `login.html`, `verify.html`, `assets/site.css`, and
  `my-health-journey/` join Identity & Access's frozen backend as stable, tested
  surface.
- Added `docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md`: the pre-implementation
  review for Batch PA-3 (docs/29 §13 Batch 5D), covering consultation information
  architecture, the Timeline entry model (including a real `entry_type` schema gap
  found between docs/29 §4 and docs/33 §3.1, and a recommendation to close it),
  ordering, empty-state behavior, card layout, detail-view requirements, component
  reuse (including a now-ripe session-guard extraction), relationship to Symptom
  Tracker/Reports, required backend contracts (named, not designed), accessibility,
  a recommended implementation sequence, and a scoped Repository Consistency Review.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16 gained a freeze notice; `docs/24-ROADMAP.md`
  updated to reflect the freeze and point at both new documents.
- Re-ran clean and unchanged: `node validation/static-analysis/analyze.js` (0
  findings), `node validation/phase-2a-foundation/conformance.js` (61/61),
  `node validation/phase-1-5/validate.js` (42/42), and
  `validation/pa-2-dashboard/browser-test.js` (26/26).

**Patient Access Batch PA-3 is the next milestone**, not yet started — approval
required before it begins (docs/39).

## 2026-07-03 — Patient Access Batch PA-2 (assets/site.css, My Health Journey dashboard shell)

Second Patient Access batch (docs/29 §13 Batch 5C), preceded by a dedicated
pre-implementation review (docs/37-DASHBOARD-SHELL-READINESS-REVIEW.md, approved before
any code was written). **Zero backend modification** — confirmed via
`git diff --name-only`: no `apps-script/` or `shared/` file changed.

### Added
- `assets/site.css` — the shared design-token and component set extracted out of
  `login.html`/`verify.html`'s identical duplicated `<style>` blocks (docs/20 §5's
  long-flagged item, finally closed). One small addition beyond a pure extraction:
  `.status.warn`, for the new session-expiry notice below.
- `my-health-journey/index.html` + `my-health-journey/dashboard.js` — the "My Health
  Journey" dashboard shell. Authenticated header (Wise logo, "My Health Journey",
  real patient greeting from `get_profile`, Sign out) plus a responsive six-card grid
  (Timeline, Symptom Tracker, Reports, Care Plan, Messages, Digital Twin), every card
  rendering one of three distinct Empty State types: **No data yet**, **Coming later
  in Phase 2A**, **Planned for a future version**.
- A session guard: verifies the stored session via `get_profile` before rendering
  anything; redirects an absent token straight to `/login.html`, and a
  present-but-rejected token to `/login.html?reason=expired` with the token cleared.

### Changed
- `login.html` — now links `assets/site.css` instead of duplicating its tokens; shows
  "For your privacy, your secure session has ended. Please sign in again." when
  redirected here with `?reason=expired`.
- `verify.html` — now links `assets/site.css`; its success state links to the now-real
  `/my-health-journey/` instead of "coming soon."

### Notes
- **Component Reuse Review performed before writing any new markup**: every shared
  pattern already established by `login.html`/`verify.html` moved into
  `assets/site.css` rather than being copied a third time. `index.html`'s `.skip`
  skip-link was ported in too — the dashboard is the first Phase 2A page complex
  enough to need one. `index.html` and `internal/consultation-summary.html`
  deliberately untouched — out of scope, each keeps its own stylesheet.
- **Three Empty State types**, not one generic message, so a patient isn't given the
  same expectation for every unfinished feature — "coming later in Phase 2A" for
  Timeline/Symptom Tracker/Reports (each has a named future batch, 5D/5E/5F) versus
  "planned for a future version" for Care Plan/Messages/Digital Twin (no architecture
  exists yet for any of them). The third type, "No data yet," has no live card
  consumer in this batch and is verified directly via a small test-support export
  rather than left unverified.
- Verified with a new, committed Playwright harness
  (`validation/pa-2-dashboard/browser-test.js` — the first Phase 2A frontend suite
  committed rather than run ad hoc): **26/26 checks passed**, covering the session
  guard's three paths (no token / valid / rejected), sign-out, a network-failure
  fallback that preserves the token, 375px responsive layout on all three touched
  pages, and real keyboard-driven focus-visibility and heading-hierarchy checks.
- `node validation/static-analysis/analyze.js`, `node validation/phase-2a-foundation/conformance.js`,
  and `node validation/phase-1-5/validate.js` all re-run clean and unchanged (0
  findings, 61/61, 42/42) — expected, since no backend file was touched.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` gained a new Batch PA-2 entry under §16;
  `docs/04-COMPONENT-LIBRARY.md` gained concrete Authenticated Header/Dashboard Card
  Grid/Empty State/Session-Expiry Notice component entries; `docs/24-ROADMAP.md`
  updated to reflect PA-2 shipped and name PA-3 (docs/29 §13 Batch 5D) as next.

## 2026-07-03 — Patient Access Batch PA-1 (login.html, verify.html)

First Patient Access batch — the deferred frontend half of docs/29 §13's original
Batch 5B, built against the now-frozen Identity & Access backend (IA-1, IA-2).
**Zero backend modification** — confirmed via `git diff --name-only` (only
`login.html`, `verify.html`, and documentation changed).

### Added
- `login.html` — email-entry form calling `request_login_link`. Single field, one
  primary CTA, friendly loading/error states, the backend's own anti-enumeration-safe
  message displayed verbatim.
- `verify.html` — reads `?token=` from the URL, requires an explicit "Continue to
  sign in" click before calling `consume_login_link` (does **not** auto-submit on
  page load — a deliberate defense against email-security link-scanners pre-fetching
  and burning the single-use token before the patient clicks it). On success, stores
  only `session_token` in `sessionStorage`; `patient_id` is never stored client-side
  under any key.

### Notes
- **Reused, not duplicated**: the `:root` design tokens, `.card`/`.field`/`.submit`/`.status`
  component set, and the `fetch()`-with-`text/plain`-no-CORS-preflight calling
  convention, all from `internal/consultation-summary.html` — the only existing page
  that already talks to the Apps Script backend. Both pages use the same minimal
  "utility page" shell (no full header/nav) that `thanks.html`/`booking-received.html`/
  `internal/consultation-summary.html` already independently established for
  single-purpose, not-yet-nav-linked pages.
- **A real accessibility defect was caught by keyboard-driven browser testing, not
  assumed away**: `.field input:focus{outline:none}`, copied from
  `internal/consultation-summary.html`, silently defeated the `:focus-visible` rule by
  CSS specificity — a WCAG 2.2 AA violation. Fixed in `login.html` before shipping
  (`internal/consultation-summary.html` itself untouched — out of this batch's scope).
- Verified with a local static server + headless Chromium (Playwright), backend mocked
  at the network layer: **20/20 checks passed** — response-envelope branching (never
  an HTTP status code), the no-auto-fire security property, `sessionStorage` contents
  (both what's stored and what's deliberately never stored), 375px responsive layout,
  and keyboard focus visibility.
- `node validation/static-analysis/analyze.js`, `node validation/phase-2a-foundation/conformance.js`,
  and `node validation/phase-1-5/validate.js` all re-run clean and unchanged (0
  findings, 61/61, 42/42) — expected, since no backend file was touched.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` gained a new §16 (Patient Access
  Implementation, Batch PA-1 notes) and a §13 table annotation marking Batch 5B fully
  delivered; `docs/04-COMPONENT-LIBRARY.md` gained concrete Login Form / Sign-In-Verify
  entries (docs/29 §12's own tracked doc-impact item); `docs/24-ROADMAP.md` updated.
- Full build summary: this batch's pull request description.

## 2026-07-03 — Identity & Access Closeout (docs only)

Documentation-only batch. Added `docs/36-IDENTITY-AND-ACCESS-CLOSEOUT.md`: the
official closeout of the Identity & Access backend (batches IA-1, IA-2) — objectives,
delivered scope, architecture and authentication-flow summary, security model, shared
contracts, validation/regression/static-analysis results (each re-verified fresh
against the final merged state, not transcribed from prior PR descriptions), deferred
work, lessons learned, and Patient Access entry criteria. No `apps-script/*.gs` file,
`shared/` contract, or architecture document was modified — confirmed via `git diff`.
`docs/24-ROADMAP.md` updated to point at it.

**Identity & Access backend is now frozen except for bug fixes** — see docs/36 §12.
The five files IA-1/IA-2 delivered (`FoundationLoginTokens.gs`,
`FoundationRateLimit.gs`, `FoundationEmail.gs`, `FoundationLoginFlow.gs`,
`FoundationRouter.gs`) plus `Code.gs`'s one-line dispatch shim join Foundation's ten
frozen files as stable, tested infrastructure. Future capability is delivered by
adding new files, never by reopening these six.

**Patient Access is the next milestone**, not yet started — recommended first batch
(docs/36 §12): `login.html`/`verify.html`, the deferred frontend half of docs/29 §13's
original Batch 5B, before Batch 5C's dashboard shell.

## 2026-07-03 — Identity & Access Batch IA-2 (login flow, rate limiting, first authenticated route)

Second of two independent Identity & Access batches this milestone was split into
(docs/29 §15) — consumes IA-1's `LoginTokens` infrastructure into an actual, working
magic-link login. Scope: the request-link endpoint, the consume-link endpoint,
Foundation's first authenticated Web App route, rate limiting, and account-enumeration
protection.

### Added
- `apps-script/FoundationRateLimit.gs` — `foundationCheckAndIncrementRateLimit_()`,
  basic per-email rate limiting (3 requests / 15 minutes), `CacheService`-backed, fails
  open on a `CacheService` error (a documented ADR-010 exception). **Per-IP limiting is
  not implemented** — Apps Script's `doPost(e)` never exposes a caller's IP address, a
  real platform constraint stated openly, not silently dropped.
- `apps-script/FoundationEmail.gs` — `foundationSendLoginLinkEmail_()`, Foundation's own
  `MailApp` sender for the login-link email, independent of Phase 1.5's `Email.gs` (same
  domain-separation precedent as `FoundationDataStore.gs` vs. `Sheets.gs`). The
  link's frontend destination (`verify.html`) does not exist yet — a stated placeholder,
  not an assumed page (`login.html`/`verify.html` remain future work, out of this
  batch's backend-only scope).
- `apps-script/FoundationLoginFlow.gs` — `foundationHandleRequestLoginLink_()` /
  `foundationHandleConsumeLoginLink_()`, the orchestration IA-1 deliberately left
  undone. Request-link: looks up a patient by email (`foundationFindPatientByEmail_()`,
  a new consumer of `FoundationDataStore.gs`'s existing `foundationDsQuery_()`),
  rate-limits, issues a token, emails it — returning the identical generic response
  regardless of match (docs/29 §3, anti-enumeration). Consume-link: consumes the token
  and issues a real session via `foundationIssueSessionToken_()`.
- `apps-script/FoundationRouter.gs` — `handleFoundationRequest_()`, the HTTP-level
  dispatcher, routing `request_login_link`/`consume_login_link`/`get_profile`.
  `get_profile` is Foundation's **first authenticated Web App route** — derives
  `patient_id` only from a verified session (`withFoundationAuth_()`, never
  client-supplied) and returns the caller's own Patient record
  (`foundationGetPatientById_()`).
- `validation/phase-2a-foundation/conformance.js` Stage 6 (23 new checks) +
  `harness.js` (four new files loaded, `CacheService`/`MailApp` mocked).
  **61/61 total conformance checks passed.**
- `validation/phase-1-5/validate.js` Stage 9 (3 new checks) + `harness.js`
  (`handleFoundationRequest_` made injectable) — proves `Code.gs`'s new dispatch shim is
  purely additive. **42/42 total Phase 1.5 checks passed, zero regression.**

### Changed
- `apps-script/Code.gs` — **the one, deliberately narrow exception to "never modifying
  Phase 1.5's existing files."** Google Apps Script permits exactly one `doPost()` per
  project; docs/29 §14 Decision 1 locked one shared project for all Phase 2A backend
  work. These two facts leave no way to add a real, callable Foundation Web App route
  without touching `Code.gs` — surfaced explicitly as a real architectural conflict
  before any code was written, and a resolution was requested rather than guessed. The
  approved fix: `doPost()` now checks for a `foundation_action` field (absent from every
  field Phase 1.5's own payload uses — no collision) immediately after its JSON parse,
  and delegates the entire request to `FoundationRouter.gs` if present; every line below
  is otherwise byte-for-byte unchanged. Full reasoning: `apps-script/README.md`'s
  "Foundation/Phase 1.5 dispatch boundary."

### Notes
- Static analysis: **0 findings** — the cleanest result of any batch so far. All six of
  Foundation's previously-Deferred findings (`escapeFoundationHtml_`,
  `foundationDsQuery_`, `foundationGetPatientById_`, `foundationIssueSessionToken_`,
  `withFoundationAuth_`, `foundationConsumeLoginToken_`) now have real consumers; this
  batch introduced no new unused helper of its own.
- No new `shared/*.schema.json` contract — IA-2's wire shapes are ad hoc action
  responses, not new persisted entities.
- **IA-2 Dependency Map** (docs/29 §15): four new files depend only on already-frozen
  Foundation infrastructure and IA-1's `FoundationLoginTokens.gs`. One new edge —
  `Code.gs` → `FoundationRouter.gs` — the first ever between Phase 1.5 and the
  Foundation/Identity-&-Access family in either direction; one-directional, non-cyclic,
  confirmed by `validation/static-analysis/analyze.js`'s project-wide scan. Zero new
  edges into any of the ten frozen Foundation-family files.
- `docs/15-SECURITY-STANDARDS.md` gained a real "Phase 2A — Implementation Notes
  (Identity & Access)" section (previously a forward-reference only);
  `docs/24-ROADMAP.md` updated. `docs/12-DATA-ARCHITECTURE.md`'s Phase 2A section
  remains a pre-existing, separately-tracked gap (docs/32) — not touched by this batch,
  stated rather than silently left inconsistent.
- Full build summary: this batch's pull request description.

## 2026-07-03 — Identity & Access Batch IA-1 (LoginToken infrastructure)

First of two independent Identity & Access batches this milestone was explicitly split
into (docs/29 §15). Infrastructure only — no route, no UI, no session issuance.
**Zero modification to any of the ten frozen Foundation-family files**; reuses
`FoundationDataStore.gs`/`FoundationAudit.gs` exactly as-is.

### Added
- `shared/schemas/login-token.schema.json` (v1.0.0) + `.md` — the `LoginTokens`
  contract (`token_hash`, `patient_id`, `issued_at`, `expires_at`, `used_at`), the
  first Foundation-family schema with a legitimately-empty-until-consumed field.
  Committed in its own commit, ahead of the implementation.
- `apps-script/FoundationLoginTokens.gs` — `foundationCreateLoginToken_()` (256-bit
  token generation via three concatenated UUIDs, SHA-256 hashing, never stores the
  raw token) / `foundationConsumeLoginToken_()` (expiration + single-use enforcement,
  resolves only a `patient_id`, deliberately never issues a session).
  `createFoundationLoginToken()` manually-run editor wrapper, mirroring
  `PatientIdentity.gs`'s F3 precedent.
- `validation/phase-2a-foundation/conformance.js` Stage 5 (12 new checks) +
  `harness.js` (`FoundationLoginTokens.gs` loaded, `Utilities.computeDigest` mocked
  via Node's real `crypto`). **38/38 total conformance checks passed.**

### Notes
- Static analysis: `foundationDsUpdateById_` (Deferred since F3) now has a real
  consumer and drops off the findings list; `foundationConsumeLoginToken_` is new
  (Deferred — IA-2 supplies its consumer). Net unchanged at 6 total findings, all
  Deferred, 0 Error/Warning. A missing `MANUAL_DROPDOWN_WRAPPERS` tooling entry for
  `createFoundationLoginToken` was caught by the tool itself and fixed immediately.
- `validation/phase-1-5/validate.js` re-run clean (39/39) — zero regression.
- **IA-1 Dependency Map** (docs/29 §15): `FoundationLoginTokens.gs` depends on five
  already-frozen infrastructure files only; zero new edges into any frozen file;
  confirmed zero dependency on `FoundationSession.gs` (no session issuance); zero
  circular dependencies; zero edges to/from Phase 1.5.
- Full build summary: this batch's pull request description.

## 2026-07-03 — Foundation Closeout (docs only)

Documentation-only batch. Added `docs/35-FOUNDATION-CLOSEOUT.md`: the official closeout
of Phase 2A's Foundation Implementation Plan (F1–F5) — scope, delivered modules,
delivered `shared/` contracts, validation/regression/static-analysis/dependency
summaries (each re-verified against the final merged state, not transcribed from prior
batches' PR descriptions), what's intentionally excluded, a Foundation freeze
statement, and entry criteria for the next implementation phase. No `apps-script/*.gs`
file, `shared/` contract, or architecture document was modified — confirmed via
`git diff`. `docs/24-ROADMAP.md` updated to point at it.

**Foundation (F1–F5) is now frozen except for bug fixes** — see docs/35 §9. Future
capability is delivered by adding new files / new schema versions, never by reopening
the ten Foundation-family files this closeout documents.

## 2026-07-03 — Phase 2A implementation: Foundation Batch F5 (conformance testing)

Fifth and final implementation batch of the approved Foundation Implementation Plan
(F1–F5, docs/29 §14). Delivers the one deliverable F2's own implementation notes named
ahead of time: "Automated, schema-validator-based conformance testing
(`validation/phase-2a-foundation/conformance.js`) remains an F5 deliverable, not built
early." Node-only test tooling — zero `apps-script/*.gs` files touched.

### Added
- `validation/phase-2a-foundation/schema-validator.js` — a generic, dependency-free
  JSON Schema (Draft 2020-12 subset) validator: `type`, `required`, `properties`,
  `additionalProperties`, `enum`, `const`, `format` (`email`, `date-time`),
  `minLength`, `oneOf`.
- `validation/phase-2a-foundation/harness.js` — mocked Apps Script runtime
  (`SpreadsheetApp`, `PropertiesService`, `Utilities`, `Logger`) loading the real
  Foundation-family `.gs` source, mirroring `validation/phase-1-5/harness.js`.
- `validation/phase-2a-foundation/conformance.js` — Stage 0 proves the validator
  itself against deliberately-broken fixtures; Stages 1–4 check real
  `FoundationContracts.gs`/`PatientIdentity.gs`/`FoundationSession.gs`/
  `FoundationRouteGuard.gs` output against the real `shared/*.schema.json` files.
  23/23 checks passed.
- `validation/phase-2a-foundation/README.md`.

### Notes
- **Foundation Dependency Map** (architectural review artifact, docs/29 §14's F5
  section has the full breakdown): module dependencies verified from the real call
  graph plus a hand-checked `FOUNDATION_CONFIG` variable-read edge the automated scan
  can't detect; zero new intra-`apps-script/` dependencies introduced (F5 adds no
  `.gs` file); **zero circular dependencies**, verified two ways; dependency direction
  strictly layered, one-way, no back-references. Review artifact only — no module was
  restructured to make the map cleaner.
- Static analysis: unchanged from F4 — 6 total findings, all previously triaged as
  Deferred, none new (this batch adds no `apps-script/*.gs` code).
- `validation/phase-1-5/validate.js` re-run clean (39/39) — zero regression.
- A test-assertion bug in this batch's own `conformance.js` (an `AuditLog` row-count
  check that didn't account for shared state across test stages) was caught and fixed
  before shipping, not after — see docs/29 §14 for detail.
- Full build summary (modules, tests, static analysis, deferred findings, validation,
  regression, documentation, CHANGELOG, dependency map): this batch's pull request
  description.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F4 (session + route protection)

Fourth implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Delivers exactly the scope two forward references already committed in F3:
`apps-script/README.md`'s module table and `FoundationConfig.gs`'s comment both named
`FoundationSession.gs`/`FoundationRouteGuard.gs` and PropertiesService consumption as
landing in F4.

### Added
- `shared/schemas/session.schema.json` (v1.0.0) + `.md` — the canonical Session
  payload (`patient_id`, `issued_at`, `expires_at`) and wire-format contract (docs/33
  §1.3). Committed ahead of its implementation, in its own commit, per
  `shared/README.md`'s rule — F3 was the last batch eligible for the create-together
  bootstrap exception.
- `apps-script/FoundationSession.gs` — `foundationIssueSessionToken_()` /
  `foundationVerifySessionToken_()`, HMAC-SHA256-signed session tokens (ADR-002,
  ADR-003, ADR-010). Pure payload/expiry/shape logic and a constant-time signature
  comparison are split from the real, `PropertiesService`-reading entry points via a
  `WithSecret_` core, so the full issue-verify round trip is testable offline.
- `apps-script/FoundationRouteGuard.gs` — `withFoundationAuth_()`, gating a handler
  behind a verified session and deriving `patient_id` only from the token, never
  client input. Logs a `session_rejected` audit event on every rejection.
- `apps-script/FoundationTests.gs` extended — pure-logic coverage for both new files
  plus a full offline issue-then-verify round trip against an explicit test secret.
- `FoundationConfig.gs`'s `SESSION_TTL_SECONDS` (3600 — 60 minutes, the low end of
  docs/29 §3's 60–90 minute range, per ADR-010's security-over-convenience default).

### Not in scope (deferred, tracked in docs/29 §13/§14)
- `LoginTokens` (the sheet, and the magic-link request/consume flow that resolves an
  email to a `patient_id` in the first place) — F3's forward references named only
  Session and route protection, not this.
- Any Web App route wiring `withFoundationAuth_()` to a real, callable endpoint.

### Notes
- Static analysis: 2 new findings (`foundationIssueSessionToken_`,
  `withFoundationAuth_` — both real entry points with no consumer yet, exactly the
  "infrastructure built ahead of its consumer" pattern F3 already established, not a
  bug). Combined with F2/F3's 4 already-accepted findings, 6 total, all Deferred.
- `validation/phase-1-5/validate.js` re-run clean (39/39) — zero regression.
- A cryptographic primitive (HMAC-SHA256) is deliberately never hand-rolled into a
  portable reference file — `shared/schemas/session.md` states why; the schema
  defines the payload/wire-format contract only, and each runtime's own native HMAC
  implementation computes the signature.
- Full build summary (modules, tests, static analysis, deferred findings, validation,
  regression, documentation, CHANGELOG): this batch's pull request description.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F3 (data layer + Patient Identity)

Third implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Per the plan's second (and final) named bootstrap exception, this batch creates
the Patient Identity schema and its first implementation together. Also introduces a
new standing step, by explicit requirement: a static-analysis pass runs before
validation on every Foundation batch from this one onward.

### Added
- `validation/static-analysis/analyze.js` + `README.md` — checks duplicate global
  names, duplicate constants, duplicate function names, unused exported helpers,
  circular dependencies, and Apps Script namespace collisions across every
  `apps-script/*.gs` file. No dependencies beyond Node's standard library.
- `shared/schemas/patient-identity.schema.json` (v1.0.0) + `.md` — the canonical
  Patient record shape, explicitly documenting which fields belong to the permanent
  identity core (docs/33 §1.2) vs. the mutable profile (docs/33 §1.1), even though
  both are stored in one row per docs/29 §4's already-locked schema.
- `apps-script/FoundationDataStore.gs` — the data-access abstraction (insert/getById/
  updateById/query + pure row/object conversion helpers), the only Foundation file
  calling `SpreadsheetApp` for Patient-domain data.
- `apps-script/FoundationAudit.gs` — `foundationLogAuditEvent_()`, an append-only
  cross-cutting event log.
- `apps-script/PatientIdentity.gs` — `foundationCreatePatient_()` /
  `foundationGetPatientById_()`, plus `createFoundationPatient()`, a manually-run
  editor wrapper (no Web App route, no Sheet menu yet — this batch's explicit,
  minimal scope).
- `apps-script/FoundationTests.gs` (partial) — 14 Apps Script-native unit tests
  covering every pure function introduced in F2 and F3.

### Changed
- `apps-script/README.md`: append-only — four new module-table rows, a new
  "Foundation's own trailing-underscore wrappers" table, and a new "Static analysis"
  section. No existing content was altered.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md`: §14 extended with the static-analysis tool's
  introduction (including two real false positives it caught in the *existing*
  codebase and fixed in the tool, not the code under test) and Batch F3's
  implementation notes, including the Patient/Patient Identity reconciliation
  reasoning and a documented, deliberate validation simplification.
- `docs/24-ROADMAP.md`: Phase 2A status line updated to include F3.

### Static analysis findings (all triaged, none silently ignored)
Run before writing any F3 code, against the real F1+F2 baseline, this tool caught two
real issues in the *existing* Phase 1.5 codebase that manual review had missed — both
were false positives from the tool's own regex-based heuristics, fixed in the tool,
not in the correct existing code:
- A false circular dependency (`Email.gs -> Send.gs -> Email.gs`), traced to a comment
  in `Email.gs` containing the literal text `attemptSend_(`.
- Three false "unused" reports for `Review.gs`'s menu-bound functions — Apps Script's
  `menu.addItem('label', 'fnName')` references a function by quoted string, which the
  tool didn't originally treat as usage.

After both fixes, the F1+F2 baseline reported 4 genuine, expected findings (Foundation
infrastructure built ahead of its first consumer). After F3, there are still 4 —
different functions, same kind of finding: `escapeFoundationHtml_` (built as one of
`core.reference.js`'s three canonical utilities; no HTML-rendering need yet),
`foundationDsQuery_` and `foundationDsUpdateById_` (two of `FoundationDataStore.gs`'s
declared four-function interface; F3's minimal create/read scope doesn't need them
yet), and `foundationGetPatientById_` (the "read" half of this batch's own
"create/read" scope, awaiting a future caller — F4's session work or a later
dashboard batch). Every one matches an interface this plan already committed to.
Reviewed and accepted, not fixed by inventing artificial call-sites.

### Verification
- Static analysis: 2 tool bugs found and fixed against the real codebase; final F3
  findings triaged as above.
- `node --check` passed on every new `.gs` file.
- `runFoundationTests_()` — all 14 tests — executed directly in Node (every tested
  function is pure); all passed.
- A full functional pass against a minimal in-memory `SpreadsheetApp` mock: create →
  read-back round-trip (output checked against the JSON Schema's required fields),
  not-found and invalid-input cases correctly returning their specific error codes
  (not the generic one), the audit log gaining exactly one correctly-shaped row per
  patient created, cross-patient isolation confirmed (creating a second patient leaves
  the first untouched), and the header-drift safety check correctly throwing on a
  tampered sheet header.
- A full collision pre-check of every planned F3 name against the existing codebase,
  before writing any code — zero collisions.
- `cd validation/phase-1-5 && node validate.js`: **39/39 checks still passing** — zero
  regression to Phase 1.5.
- `git diff` confirmed zero modifications to any pre-existing `apps-script/*.gs` file.

### Notes
- No real Google Spreadsheet is provisioned by this batch — `PATIENT_SPREADSHEET_ID`
  remains a placeholder, an operational step outside this repository, per the same
  distinction docs/28 already drew for Phase 1.5's live deployment.
- `condition_slug` is not validated against Phase 1.5's canonical allowlist yet — a
  documented, deliberate simplification (`shared/schemas/patient-identity.md`), not an
  oversight.
- Next: Foundation Batch F4 (session + route protection) — awaiting approval before
  starting, per the Foundation plan's explicit "wait for approval" requirement.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F2 (shared contracts + utilities)

Second implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Per the plan's one named bootstrap exception (`shared/README.md`), this batch
creates a `shared/` contract and its first Apps Script adaptation together, since
neither existed before this batch — every change to either after this point must
follow the shared-first, implementation-second rule with no exception available.

### Added
- `shared/contracts/response-envelope.schema.json` (version `1.0.0`) + `.md` — the
  canonical `{status, data, error}` response shape every Foundation function returns.
- `shared/utils/core.reference.js` (version `1.0.0`) + `.md` — canonical reference
  implementations of `generateId()`, `nowIso()`, `escapeHtml()`.
- `apps-script/FoundationUtils.gs` — `generateFoundationId_()` (uses Apps Script's
  native `Utilities.getUuid()`, not the reference's portable algorithm — same
  contract, better implementation, per `shared/README.md`'s "conform to the contract,
  not necessarily the algorithm" rule), `foundationNowIso_()`, `escapeFoundationHtml_()`.
- `apps-script/FoundationContracts.gs` — `buildFoundationOkEnvelope_()` /
  `buildFoundationErrorEnvelope_()`, adapting the response-envelope schema.
- `apps-script/FoundationErrorHandling.gs` — `withFoundationErrorHandling_()`, which
  guarantees every wrapped call returns the envelope shape and never leaks a raw
  exception message to the caller.

### Changed
- `apps-script/README.md`: append-only — three new rows in the "Phase 2A Foundation
  modules" table added in F1. No existing row or sentence was altered.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md`: §14 extended with Batch F2's implementation
  notes, including a real naming collision this batch's pre-write review caught and
  avoided (see Notes below).
- `docs/24-ROADMAP.md`: Phase 2A status line updated to reflect F2 shipping alongside
  F1.

### Verification
- A collision scan across every existing Apps Script global function name, run
  *before* writing any F2 code, found that a literal port of the reference
  `escapeHtml()` would have collided with Phase 1.5's own `Utils.gs` `escapeHtml_()`
  — both now share one Apps Script project's flat function namespace. Named the new
  function `escapeFoundationHtml_()` instead. (The first pass of this scan itself had
  a case-sensitivity bug that produced a false-positive collision report; caught and
  fixed before trusting the result.)
- `node --check` passed on every new `.gs` file.
- `shared/utils/core.reference.js`'s three functions executed directly in Node with
  assertions on their output: `generateId()` produces a valid RFC 4122 v4 shape,
  `nowIso()` produces a valid ISO 8601 UTC millisecond timestamp, `escapeHtml()`
  produces the exact expected escaped output and never throws on a non-string input.
- `FoundationContracts.gs`'s two builders (pure functions, no Apps Script dependency)
  executed directly in Node; output checked against `response-envelope.schema.json`'s
  required keys, `status` enum, and success/error `oneOf` shape — all passed.
- `withFoundationErrorHandling_()` executed with a minimal `Logger` stub, confirming a
  thrown exception's raw message is logged for debugging but never reaches the caller.
- `cd validation/phase-1-5 && node validate.js` re-run against this batch's final
  commit: **39/39 checks still passing** — zero regression to Phase 1.5.

### Notes
- No Google Sheet, Script Property value, or live Apps Script deployment change is
  part of this batch.
- Automated, schema-validator-based conformance testing
  (`validation/phase-2a-foundation/conformance.js`) remains an F5 deliverable — this
  batch's checks were real (executed against the actual committed source) but ad hoc,
  not yet backed by a committed, repeatable harness.
- Next: Foundation Batch F3 (data layer + Patient Identity) — awaiting approval before
  starting, per the Foundation plan's explicit "wait for approval" requirement.

## 2026-07-02 — Phase 2A implementation: Foundation Batch F1 (scaffolding)

First implementation batch of Phase 2A, per the approved Foundation Implementation
Plan. Scaffolding only — no business logic, no Sheets created, no patient-facing
surface. Two decisions locked before this batch started (recorded in
docs/29-PHASE-2A-TECHNICAL-PLAN.md §14): Foundation lives inside the existing
`apps-script/` project rather than a separate one, and a new repository-level
`shared/` directory is now the canonical, machine-readable source for contracts and
schemas that Apps Script implementations conform to but never extend independently.

### Added
- `apps-script/FoundationConfig.gs` — placeholders and Script Property *key names*
  only (no secrets, no logic): a placeholder Patients spreadsheet ID and the
  `FOUNDATION_SESSION_SIGNING_SECRET` property name Foundation's session logic will
  read from Script Properties starting in batch F4.
- `shared/` — a new repository-level directory (`contracts/`, `schemas/`,
  `constants/`, `utils/`, each currently empty except `constants/.gitkeep`) and
  `shared/README.md`, which states the canonical-source rule (shared-first,
  implementation-second, never reversed, with one named exception for a contract's
  first creation), the machine-readable format rules (JSON/YAML define; Markdown only
  explains; small algorithmic utilities are portable reference `.js` files), and how
  Apps Script currently conforms to it (manual adaptation, no build step).

### Changed
- `apps-script/README.md`: append-only — added a "Phase 2A Foundation modules"
  section and its own module table, introducing `FoundationConfig.gs`. No existing
  row or sentence describing Phase 1.5's modules was altered.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md`: added §14 (Implementation Notes), recording
  the two decisions above as superseding §3's "separate Apps Script project" framing
  for the scope they cover, and Batch F1's completion. No ADR, Architecture
  Principle, or Domain Model entry was touched — both decisions were reviewed against
  the frozen ADR set before being accepted.
- `docs/24-ROADMAP.md`: Phase 2A status updated from "Implementation not yet started"
  to reflect F1 having shipped.

### Verification
- `git diff` confirmed zero modifications to any pre-existing `apps-script/*.gs`
  file — every change to `apps-script/` in this batch is either a new file
  (`FoundationConfig.gs`) or an append-only edit to `README.md`.
- `cd validation/phase-1-5 && node validate.js` re-run against the batch's final
  commit: **39/39 checks still passing** — confirms Phase 1.5's behavior is
  unaffected by this batch, not just assumed to be from the file list alone.
- `node --check` run against `FoundationConfig.gs` — no syntax errors.

### Notes
- No Google Sheet, no Script Property value, and no live Apps Script deployment
  change is part of this batch — `PATIENT_SPREADSHEET_ID` and
  `FOUNDATION_SESSION_SIGNING_SECRET` are named/placeholder only, consistent with
  "no logic yet" for a scaffolding batch.
- Next: Foundation Batch F2 (shared contracts + utilities) — awaiting approval before
  starting, per the Foundation plan's explicit "wait for approval" requirement.

## 2026-07-02 — Phase 2A architecture: documentation synchronization batch

Documentation-only. No application code, no Apps Script code, and no existing
architecture document (ADRs, docs/30, docs/33, docs/34's findings themselves aside)
was left unresolved — this batch closes the gaps docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md
identified before Phase 2A implementation begins.

### Changed
- `docs/09-PHASE-2-ARCHITECTURE.md` (v2.1): Entry Point now describes passwordless
  email magic-link login (ADR-003) instead of "Password or Mobile OTP"; Doctor
  Workflow diagram now shows the mandatory Doctor Review & Approval Gate (ADR-005);
  AI Summary reframed as a cross-cutting pattern (ADR-005, docs/33 §2.4) rather than a
  peer module; Roadmap section reconciled with docs/24 — Phase 2A now matches
  docs/29's actual scope, Personal Care Plan moved to its own Phase 2B, Phase 2C split
  into a non-AI Health Milestones phase and a Phase 2D carrying Digital Twin/AI
  Summaries; Security section cross-references ADR-010 and docs/29 §10.
- `docs/24-ROADMAP.md`: Phase 1.5 status corrected to match docs/25 v1.4/docs/28 (live
  deployment and real-patient pilot are done; only the governance sign-off remains
  open — previously read as if live deployment were still pending). Phase 2A/2B/2C
  restructured to match docs/09's corrected roadmap and docs/32's recommendation.
- `docs/12-DATA-ARCHITECTURE.md`: "Google Sheets as primary datastore" removed from
  the Principles list (it was never a principle, per ADR-006) and replaced with a
  "Current Implementation" section citing ADR-006.
- `docs/23-PATIENT-LIFECYCLE.md`: "Prescriptions" annotated as a `medicine`-type
  Doctor Instruction (docs/33 §2.3) instead of an unmodeled list item.
- `docs/01-WEBSITE-MASTER-PLAN.md`, `docs/03-DESIGN-SYSTEM.md`: primary navigation
  list replaced with a cross-reference to docs/08-NAVIGATION-ARCHITECTURE.md (was
  duplicated verbatim in four documents).
- `docs/05-UX-GUIDELINES.md`: navigation list, Content Hierarchy, Floating Page Guide,
  Accessibility, and Performance sections each replaced with a cross-reference to
  their dedicated source document (docs/08, docs/06, docs/08, docs/14, docs/16
  respectively) instead of restating them.
- `docs/07-SEO-STANDARDS.md`: Performance section now points to docs/16 for the
  underlying rules; keeps its own SEO-specific Lighthouse category targets, which
  docs/16 doesn't cover.
- `docs/13-AI-GUIDELINES.md`, `docs/15-SECURITY-STANDARDS.md`,
  `docs/22-WISE-KNOWLEDGE-ENGINE.md`: each now states which ADRs govern it
  (ADR-001/004/005 for AI/Knowledge Engine content, ADR-002/003/010 for security),
  making the ADRs the single source of truth for architecture-level decisions those
  documents previously stated independently.
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §4: added a note that docs/33-DOMAIN-MODEL.md
  is canonical for entity meaning; its own schema table describes implementation shape
  only — closes a duplication risk between the two documents before it could drift.
- `docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md`: updated to mark every finding in this
  entry as resolved rather than open. docs/32-ARCHITECTURE-REVIEW.md is left
  unmodified as the historical record of when each item was first found, per ADR-007's
  "supersede, never silently edit" rule.
- `docs/CLAUDE.md`: added an "Architecture Freeze" section — once Phase 2A
  implementation begins, the ADRs, docs/30-ARCHITECTURE-PRINCIPLES.md, and
  docs/33-DOMAIN-MODEL.md are authoritative, and architectural changes require an
  explicit architecture review before implementation, not an inline redesign.

### Notes
- No new documentation was created in this batch (per its explicit scope) — every
  change above is an edit to an existing document.
- This closes out the architecture-freeze work that began with docs/29 through
  docs/34. Per docs/CLAUDE.md's new Architecture Freeze rule, the architecture is now
  considered frozen for Phase 2A once this batch's Pull Request merges. Implementation
  (Batch 5A) still awaits separate, explicit approval — this batch does not begin it.

## 2026-07-02 — Phase 1.5 live deployment complete: real-patient pilot run

Phase 1.5 deployed for real on a free personal Google account
(`wisehomeopathicmc@gmail.com`) and validated end to end against the live
deployment: access-code gate, OpenRouter AI calls, doctor review (approve,
approve-edited, reject), the consent gate blocking a tampered row, real
email delivery, a forced delivery failure, retention purge (skip, purge,
idempotency), and trigger installation (idempotency). One real,
already-consenting patient's visit summary was submitted, reviewed by a
doctor against the source note, approved, and sent to the patient's real
email address.

### Changed
- `docs/28-DEPLOYMENT-READINESS.md`: all technical checklist items marked
  complete with the live evidence for each. Only the governance
  "Deployment approved" sign-off remains open (deliberately left for the
  clinic's own decision-maker).
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`: status banner updated to
  **Software Complete, Deployment Complete, Operationally Complete**; §10
  ("Status after live deployment") added, closing the staff-entry-point
  access control, retention trigger, real-patient pilot, and security
  checklist Definition-of-Done items that were open pending a live
  deployment.

### Notes
- Phase 1.5 is now Deployment Complete and Operationally Complete, on top
  of the Software Complete status reached at Batch 4H. Phase 2A still
  should not begin until the one remaining governance sign-off is made.

## 2026-07-02 — Phase 1.5 deployment: free personal Google account (no Workspace)

Deployment decision: this project deploys from a free personal Google
account (`wisehomeopathicmc@gmail.com`), not Google Workspace. Google
Workspace's domain-restricted Web App access (the original
`appsscript.json` `access: DOMAIN`) is not available to a personal
account, so it is replaced with an application-level shared access code —
everything else (Sheets, Apps Script, MailApp/Gmail, Drive) was already
free and unaffected.

### Added
- `apps-script/Auth.gs` — `verifyAccessCode_()`, the new access gate:
  checks a `STAFF_ACCESS_CODE` Script Property against every request's
  `access_code` field, fails closed if the property is unset, before any
  parsing/validation/Sheet write happens.
- 4 new unit tests in `apps-script/Tests.gs` covering `verifyAccessCode_()`
  (unset property, wrong code, empty code, correct code).
- `apps-script/README.md`: new "Access control" section explaining why
  Workspace's domain restriction doesn't exist for a personal account,
  the shared-access-code replacement, its tradeoffs vs. Workspace, and
  the no-redesign migration path back to Workspace if the clinic adopts
  it later.

### Changed
- `apps-script/appsscript.json`: `webapp.access` changed from `DOMAIN` to
  `ANYONE_ANONYMOUS` (the Web App URL is public; `Auth.gs`'s shared code
  is the real access control now). `executeAs` unchanged (`USER_DEPLOYING`
  — all mail still sends from the one clinic account).
- `apps-script/Code.gs`: `doPost` now checks `verifyAccessCode_()` first,
  before sanitization/validation; rejects with `401` and logs
  `unauthorized` on failure.
- `internal/consultation-summary.html`: added a required "Staff access
  code" field, sent as `access_code`; removed Workspace-sign-in language
  from the banner and error messages; added an explicit `401` message.
- `apps-script/sample-payloads/*.json`: added an `access_code` field
  (placeholder `REPLACE_WITH_YOUR_STAFF_ACCESS_CODE`) to the JSON samples.
- `apps-script/README.md`: deployment steps rewritten for a free personal
  account (no `clasp login` to a Workspace account, no domain-restricted
  deploy option, new `STAFF_ACCESS_CODE` setup step); manual testing steps
  updated to test the access-code gate instead of a Workspace/non-Workspace
  account pair.
- `docs/28-DEPLOYMENT-READINESS.md`: rewritten for the free-account
  deployment — "Google Workspace configured" checklist item replaced with
  "Google account confirmed" and "Staff access code configured and
  verified."
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`: added a deployment-account
  amendment note (v1.3) at the top, explaining that the plan's original
  Workspace-domain-restriction language (§9.1, §9.7, §7, §10) describes
  the original design and is superseded by the access-code control
  described above; no other part of the plan changes.
- `validation/phase-1-5/harness.js` and `validate.js`: updated the mocked
  harness and test payloads to include `STAFF_ACCESS_CODE` /
  `access_code`, and added explicit checks that a missing/wrong access
  code is rejected with `401` before any row is written. 39/39 checks
  pass (was 37/37 before the 2 new access-code checks + 4 new `Tests.gs`
  cases folded into Stage 0's count).
- `validation/phase-1-5/README.md`: result summary updated to 39/39.

## 2026-07-02 — Phase 1.5, Batch 4H: documentation, validation closeout, and formal completion

Final batch of Phase 1.5, per explicit scope: documentation, validation closeout, and project synchronization only — no new features, no refactor, no optimization, no Phase 2 work. `git diff` against `apps-script/`, `internal/`, and `validation/` is empty; this batch touches only `docs/`, `apps-script/README.md`, and this file.

### Added
- `docs/26-PHASE-1.5-VALIDATION-REPORT.md` — the canonical validation record: objectives, scope, what was implemented, methodology, unit/integration/failure-path tests executed, results (37/37 checks passed), remaining live-deployment validation, known limitations, risks, and a Go/No-Go recommendation (Go for test deployment, No-Go for real patient use until deployment readiness is closed).
- `docs/27-PHASE-1.5-CLOSEOUT.md` — the official Phase 1.5 closeout: original objectives against what shipped, architecture delivered, lessons learned, remaining operational work, and the handoff into Phase 2A (which this document does not authorize).
- `docs/28-DEPLOYMENT-READINESS.md` — an operational checklist (Workspace configuration, live deployment, API keys, mail permissions, retention trigger installation, domain-restriction verification, real-patient pilot approval, deployment approval) for whoever deploys this project — explicitly not a software task list.

### Changed
- `docs/15-SECURITY-STANDARDS.md`: added the Phase-1.5-specific security notes docs/25 §12 had flagged since the plan's first version but that were never actually written — closed now, seven batches later, cross-referencing docs/25 §7's existing mapping table rather than duplicating it.
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`: status banner updated to **Software Complete (Batches 4A-4H)**, explicitly distinct from Deployment Complete and Operationally Complete (both still false); §10's Definition of Done, §11 (Batch 4H retrospective), and §12's documentation-impact table all updated to close out the plan.
- `docs/24-ROADMAP.md`: Phase 1.5 status finalized as Software Complete, pending live deployment and real-patient pilot.
- `apps-script/README.md`: Status section rewritten to point at docs/26-28 instead of listing individual batches.

### Notes
- One documentation gap found during this closeout's repository review: docs/15-SECURITY-STANDARDS.md's promised Phase 1.5 update, tracked since docs/25's first version, had never been done. Fixed in this batch.
- **Software Complete ≠ Deployment Complete ≠ Operationally Complete.** All Phase 1.5 code and validation work (Batches 4A-4G) is done and merged. No live Google Workspace deployment exists. No real patient has been contacted. Phase 1.5 is not marked fully done until docs/28's checklist and docs/25 §10 are closed by an actual deployment and pilot — not assumed.
- Phase 2 has not begun. My Health Journey has not been implemented. Do not begin either until docs/25 §10 is fully closed.

## 2026-07-02 — Phase 1.5, Batch 4G: full pipeline validation

Validation phase, per explicit scope: no new features, no architectural refactor, no code optimization. Zero lines changed in `apps-script/` — confirmed by `git status` showing only new files under `validation/`. Objective: prove the complete pipeline (staff submission → validation → Sheet write → AI normalization → doctor review → gate evaluation → email delivery → retention) works exactly as designed, stage by stage and end to end, including every required failure mode.

### Added
- `validation/phase-1-5/harness.js`: loads the real, unmodified `apps-script/*.gs` source into a mocked Apps Script runtime (in-memory Sheet; fake `PropertiesService`/`UrlFetchApp`/`MailApp`/`ScriptApp`/`Session`) — the strongest verification available without a live Google Workspace deployment, since it exercises the actual committed code rather than a reimplementation of its logic.
- `validation/phase-1-5/validate.js`: drives that real source through every pipeline stage independently and the full end-to-end workflow (success path twice — once through to a real send + 20-days-later retention purge, once through a doctor rejection — plus a tampered-consent path caught at review time). **37/37 checks passed**, including the existing 26-test `Tests.gs` suite re-run through the same real-source harness.
- `validation/phase-1-5/README.md`: what the harness proves, and — equally important — what it explicitly does not prove (Workspace-domain access restriction, a real OpenRouter call, a real email actually arriving, the live retention trigger firing on schedule, a real-patient pilot), since none of those are achievable without a live deployment this environment doesn't have.

### Coverage
Per this batch's explicit requirements, all tested and confirmed to leave the system in a safe state: success path; validation failures (missing consent, unknown condition slug, malformed JSON); AI failures (missing key, provider HTTP error); Sheets-write failures (initial submission and retention, both non-fatal to the rest of the batch); provider (email) failures; consent failures (submission-time rejection, and a stronger send-time check — tampering `patient_consent_confirmed` directly in an already-`approved` row still blocks the email); review failures (rejection sends nothing); retention failures (one row's write failure logged and skipped, batch continues, idempotency proven by running the purge twice with zero re-purges); HTML injection (a synthetic `<script>`-bearing AI draft confirmed escaped in the actual email body).

### Documentation
- `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §10 (Definition of Done): checklist updated to distinguish what Batch 4G verified from what remains open pending live deployment — the Workspace-domain access check, the live OpenRouter/MailApp calls, the live retention trigger, and the required real-patient pilot. §11 gained a full Batch 4G retrospective.
- `docs/24-ROADMAP.md`: Phase 1.5 status updated to "implementation and code-level validation complete; live deployment + real-patient pilot still required."

### Notes
- **Phase 1.5 is not marked done.** Every item verifiable without live Google Workspace credentials has been verified; the remaining Definition-of-Done items are deployment/operations work for whoever runs this project against a real Workspace, not further code work.
- Do not begin Phase 2A until docs/25 §10's full checklist is closed.

## 2026-07-02 — Phase 1.5, Batch 4F: automated retention purge

New: `apps-script/Retention.gs` — the 14-day retention policy from `docs/25` §9.3, implemented as a time-driven trigger fully independent of `Review.gs`/`Send.gs`/`Email.gs`. This is the last implementation batch before Phase 1.5's testing/validation pass (Batch 4G).

### Added
- `apps-script/Retention.gs`: `purgeExpiredRecipientEmails_()` (the trigger entry point), `isEligibleForPurge_(row, nowMs)` (pure eligibility check), and `installRetentionTrigger_()` (one-time, idempotent setup). Deliberately calls none of Review.gs/Send.gs/Email.gs, and is never called by them.
- `apps-script/Sheets.gs`: `getAllRowObjects_()` — batch-reads every data row in one call, used only by `Retention.gs`.
- `apps-script/Config.gs`: `CONFIG.RETENTION.EMAIL_RETENTION_DAYS` (`14`, locked per docs/25 §9.3).
- `apps-script/Tests.gs`: seven new unit tests for `isEligibleForPurge_()` — eligible after the window, not eligible within it, eligible exactly at the boundary, and not-eligible for each idempotency/data-integrity condition (already purged, already-empty email, never sent, invalid date). All verified against real execution.

### Guarantees (verified against synthetic data, not just reasoned about)
- **Scope-restricted by construction**: the only `updateRowByRecordId_()` call in this module passes a hardcoded `{ recipient_email, purged_at }` object — there is no code path able to touch doctor notes, AI summaries, review status, or any other audit column.
- **Idempotent**: once `purged_at` is set, a row is permanently ineligible for purge again — confirmed by running the purge twice against the same synthetic dataset and observing zero re-purges on the second run.
- **Safe against partial failures**: each row's write is wrapped in its own try/catch; a synthetic write failure on one row was confirmed to be logged and skipped without stopping the batch — the other eligible rows in the same run still purged correctly.
- **Every action audited**: every purge, skip, and failure is logged via `Logger.gs`, with a `purged=N skipped=N failed=N` summary closing each run.

### Notes
- Self-review: `grep` confirms `Retention.gs` contains no calls into `Review.gs`/`Send.gs`/`Email.gs`, and those three files contain no references back into `Retention.gs`.
- `apps-script/README.md` gained a "Retention purge" section, a deployment step for `installRetentionTrigger_()`, and manual test steps (skip-too-recent, purge-with-protected-column verification, idempotency-on-rerun, trigger-install idempotency).
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Remaining: Batch 4G — the full backend testing checklist and a real, consenting-patient pilot, the last item before Phase 1.5 is marked done.

## 2026-07-02 — Phase 1.5, Batch 4E: email delivery, layered behind a dedicated Email.gs

New: `apps-script/Email.gs` — the visit-summary email template and the only module permitted to call a mail provider. Requested layering: `Send.gs` never calls `MailApp`/`GmailApp` directly.

### Added
- `apps-script/Email.gs`: `sendVisitSummaryEmail_(row)` builds the HTML template (`buildVisitSummaryEmail_()`, docs/25 §9.6, HTML-first, locked) and is the sole caller of `MailApp.sendEmail()` anywhere in the project.
- `apps-script/Send.gs`: `attemptSend_(row)` — re-checks `evaluateSendGate_()` and, only if it passes, calls `Email.gs`; writes `email_status`/`email_sent_at` (success) or `email_status = failed` + `error_log` (any failure) back to the row regardless of outcome, per docs/25 §8.3's never-silently-drop requirement.
- `apps-script/Utils.gs`: `escapeHtml_()` — the AI's draft output is escaped before being embedded in the HTML email, since (unlike `staff_submitted_note`) it was never sanitized at submission time.
- `apps-script/Config.gs`: `CONFIG.EMAIL` (subject, sender name) — read only by `Email.gs`.
- `apps-script/Tests.gs`: three new unit tests for `escapeHtml_()`/`buildVisitSummaryEmail_()`, verified against actual execution. `attemptSend_()`/`sendVisitSummaryEmail_()` are intentionally not unit-tested (they touch a real Sheet and mail provider) — covered by expanded manual test steps instead.

### Changed
- `apps-script/Review.gs`: after approval, now calls `Send.gs`'s `attemptSend_()` (which sends the email if the gate passes) instead of Batch 4D's placeholder "not yet implemented" alert. `Review.gs` still never calls `Email.gs` or a mail provider directly.

### Architecture
- Layering: `Review.gs → Send.gs → Email.gs → MailApp`. `Send.gs` never touches a mail provider; `Review.gs` never touches `Email.gs`. This keeps the send gate independent of the delivery mechanism — a future provider swap only touches `Email.gs`. Phase 1.5 uses MailApp only, per docs/25 §3's diagram; no other provider was introduced.

### Notes
- Self-review verified the layering holds (`grep` for `MailApp`/`GmailApp` across all modules shows exactly one call site, in `Email.gs`) and exercised the gate-pass, gate-blocked, and provider-failure paths against mocked dependencies before committing.
- `apps-script/README.md` gained an "Email delivery layering" section and expanded manual-test steps: send to a real test inbox, confirm a tampered-consent row still doesn't send, force and verify a delivery failure is logged — never a real patient address until docs/25 §8's full validation pass (Batch 4G).
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred: retention purge (4F).

## 2026-07-02 — Phase 1.5, Batch 4D: doctor review checkpoint + gated send

New: `apps-script/Review.gs` and `apps-script/Send.gs` — the doctor review step from `docs/25` §5.2 and the hard-gated send decision from §6/§9.2. No email is sent yet — this batch proves the gate is enforced correctly; Batch 4E attaches the actual delivery.

### Added
- `apps-script/Review.gs`: a Sheet-bound custom menu (**Consultation Summaries**, via `onOpen()`) with three actions — approve as-generated, approve as-edited, reject — writing `review_status`/`reviewed_by`/`reviewed_at` on the selected row. `reviewed_by` is captured from the signed-in Workspace account (`Session.getActiveUser().getEmail()`), not free text. Built Sheet-bound rather than as a second HTML form, per docs/25 §5.2's explicit "Sheet-bound or minimal UI" allowance.
- `apps-script/Send.gs`: `evaluateSendGate_(row)` — the single choke point any future send path must pass through. Hard-checks `patient_consent_confirmed === true` and an approved `review_status`, reading values freshly re-read from the Sheet after review so a manual edit made directly in a cell is still caught, not just the value that was true at submission time.
- `apps-script/Sheets.gs`: `getRowObjectByRowIndex_()` — reads one row's live values back as an object, used by the review workflow.
- `apps-script/Tests.gs`: six new unit tests for `evaluateSendGate_()`, verified against actual execution (approved+consented passes; edited_and_approved passes; missing consent, non-approved status, empty draft, and empty recipient email each independently block).

### Notes
- No MailApp/GmailApp call exists yet anywhere in this project — a passing gate currently just confirms readiness and logs it.
- `apps-script/README.md` gained a "Review workflow" section and matching manual-test steps (open the Sheet, confirm the menu appears, approve/reject, and specifically confirm a manually-tampered consent cell blocks the gate).
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred: email template + delivery (4E), retention purge (4F).

## 2026-07-02 — Phase 1.5: prompt specification extracted to PROMPTS.md

Small refactor, no behavior change, requested before starting Batch 4D. Moves the AI prompt out of `apps-script/Ai.gs`'s inline comments into a standalone, version-controlled specification.

### Added
- `apps-script/PROMPTS.md`: canonical prompt specification with Prompt Version, Purpose, Inputs, Outputs, Safety Rules, Forbidden Behaviours, Traceability Principles, and Future Evolution Notes. Apps Script does not read this file at runtime — it's documentation the implementation must match, not a loaded template.

### Changed
- `apps-script/Ai.gs`: added a `PROMPT_VERSION_` constant (`'1.0'`) and a comment pointing at `PROMPTS.md` as the canonical source. `SUMMARY_SYSTEM_PROMPT_`'s wording and `flagDrift_()`'s logic are byte-for-byte unchanged.
- `apps-script/Code.gs`: the `summarized` execution-log line now includes the prompt version — the only runtime-visible difference from Batch 4C, and it's execution-log-only (not the Sheet, not the API response).
- `apps-script/README.md`, `docs/13-AI-GUIDELINES.md`, `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated to reference `PROMPTS.md` as canonical.

## 2026-07-02 — Phase 1.5, Batch 4C: AI summarization (normalization only)

New: `apps-script/Ai.gs` — the OpenRouter summarization step from `docs/25` §6, wired synchronously into `Code.gs`'s `doPost` after the row write. No email sending, no doctor review/approve UI yet — the draft this batch writes cannot reach a patient regardless.

### Added
- `apps-script/Ai.gs`: `summarizeNote_()` orchestrates the AI call (`anthropic/claude-haiku-4.5` via OpenRouter, `temperature: 0`, per the already-locked §9.4 decision) and a code-level drift check (`flagDrift_()`), independent of the prompt.
- The AI step is implemented and documented as a **normalization layer, not a content-generation layer**, per an explicit requirement: it may only rephrase the doctor's note, never add a diagnosis, recommendation, investigation, medicine, reassurance, or conclusion not already present in the source note, and every output sentence must be traceable back to the note. Enforced two independent ways: (1) a nine-rule system prompt, (2) `flagDrift_()`, which flags prohibited-category lexicon matches and low-word-overlap sentences into `error_log` for the doctor reviewer (Batch 4D) to check — flags are advisory, never auto-blocking, since nothing can be sent without human review regardless.
- `apps-script/Sheets.gs`: `updateRowByRecordId_()` — patches specific columns on an already-written row; used by the AI step and reusable by every later batch (review, send, purge).
- `apps-script/Tests.gs`: four new unit tests for `flagDrift_()` (faithful rephrasing produces no flags; added recommendation/diagnosis are flagged; a fabricated, unrelated sentence is flagged for low traceability).
- `internal/consultation-summary.html`'s confirmation message now reflects whether an AI draft was actually generated.

### Notes
- An AI-call failure (missing API key, OpenRouter error) never undoes the row already written — `ai_summary_draft` is left empty, the failure is logged to `error_log`, and the submission still reports success to staff, per docs/25 §8.3's failure-path requirement.
- `docs/13-AI-GUIDELINES.md` updated with this as a worked example: prompt-level constraint + independent code-level check + mandatory human review, intended as the reference pattern for future AI usage on the platform, not a one-off.
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred to later batches: doctor review + gated send (4D), email delivery (4E), retention purge (4F).

## 2026-07-02 — Phase 1.5, Batch 4B: staff entry form

New: `internal/consultation-summary.html` — the staff-only, Workspace-restricted entry point specified in `docs/25` §9.1, wired to the Batch 4A Apps Script Web App. Not linked from any public nav, not in `sitemap.xml`, `noindex`. No patient-facing change.

### Added
- `internal/consultation-summary.html`: condition dropdown, visit-summary note (2000-char limit matching `apps-script/Config.gs`), patient email, staff identifier, and a hard-required consent checkbox ("Patient has consented to receive this visit summary by email") that disables Submit until checked — a UX convenience layered on top of the actual server-side enforcement already built in Batch 4A's `Validation.gs`. Submits via `fetch` with `Content-Type: text/plain` to avoid a CORS preflight against the Apps Script Web App.

### Notes
- A repository-wide review (requested before starting this batch) checked whether any Batch 4A module — condition taxonomy, validation constants, schema, utilities — should move to a shared location usable by both Apps Script and the static site. Conclusion: not yet — the repo has no build step or module system that would let those two runtimes actually share a file, and nothing has a second consumer today. Recorded in `docs/25` §11 for revisiting later.
- The condition dropdown's options are hand-duplicated from `apps-script/Config.gs`; both files carry a comment pointing at the other. No automated sync exists.
- `docs/24-ROADMAP.md` and `docs/25-PHASE-1.5-TECHNICAL-PLAN.md` §11 updated.
- Deferred to later batches: AI summarization (4C), doctor review + gated send (4D), email delivery (4E), retention purge (4F).

## 2026-07-02 — Phase 1.5, Batch 4A: Apps Script pipeline skeleton (schema, validation, Sheet-write layer)

New backend-only work — no public pages, no navigation, no visual changes. Full plan: `docs/25-PHASE-1.5-TECHNICAL-PLAN.md`. First implementation of the "Website → Apps Script → Google Sheets" pattern specified in `docs/12-DATA-ARCHITECTURE.md`, and the first of eight sequenced batches (4A–4H) that make up Phase 1.5.

### Added
- `apps-script/` — a modular Google Apps Script project (`Code.gs`, `Config.gs`, `Schema.gs`, `Validation.gs`, `Sheets.gs`, `Logger.gs`, `Utils.gs`, `Tests.gs`), each with a single responsibility, per `apps-script/README.md`'s module table. This repository is the canonical source for the project; the Apps Script editor is a deployment target only.
- `Phase1.5_ConsultationSummaries` Sheet schema (16 columns, full detail in `docs/12-DATA-ARCHITECTURE.md` and `docs/25` §5.1) — designed to survive a future SQL migration unchanged, per `docs/12`'s standing rule.
- A `doPost` Web App endpoint that validates a staff-submitted consultation note (condition slug, note text, consent confirmation, staff identifier, recipient email) and writes one audited row per submission. Every request either writes a complete row or writes nothing — no partial-write state.
- `apps-script/sample-payloads/` — example request bodies (one valid, three that each fail validation for a distinct reason) for manual/curl testing.
- `apps-script/README.md` — module responsibilities, request-flow diagram, how each of docs/25's later batches (4B–4F) plugs into this schema without changing it, and clasp-based deployment steps.
- `apps-script/Tests.gs` — manual unit tests for the validation layer (`runAllTests_()`), runnable from the Apps Script editor with no live Sheet or network calls.
- `.gitignore` — excludes `apps-script/.clasp.json` (environment-specific, contains a real Apps Script project ID); `apps-script/.clasp.json.example` documents its shape.

### Not included in this batch (by design — see docs/25 §9 for sequencing)
- No AI summarization call (Batch 4C).
- No doctor review checkpoint or email-send gating (Batch 4D).
- No email template or delivery (Batch 4E).
- No retention purge trigger (Batch 4F).
- No staff-facing HTML entry form yet (Batch 4B) — the endpoint exists and is tested via `sample-payloads/`, but nothing on the public site links to it.
- No patient login, authentication, or portal — none is introduced anywhere in Phase 1.5.

### Notes
- Code review caught and fixed two issues before merge: `Config.gs`'s canonical condition-slug allowlist was missing `dermographism` (an 8th slug already live on `/conditions/`, which would have caused valid submissions for that condition to be rejected); and `apps-script/README.md`'s testing instructions initially implied checking real HTTP status codes, which Apps Script Web Apps cannot set (every response transports as HTTP 200) — both `Utils.gs` and the README now document that callers must branch on the JSON body's `status` field instead.
- `docs/24-ROADMAP.md` updated to track the Batch 4A–4H sequence under Phase 1.5.
- Deferred to later batches: staff entry form, AI summarization, doctor review UI, email delivery, retention automation, and the full end-to-end/real-pilot validation pass (docs/25 §8, §10).

## 2026-07-02 — Batch 3: Legal & Compliance pages

New: `privacy.html`, `terms.html`, `disclaimer.html` — Privacy Policy, Terms of Use, and Medical Disclaimer, written specifically for Wise Homeopathy from verified facts already in this repository (no generic templates, no invented certifications, retention periods, or grievance officers). Each covers what's collected, why, how it's used, and clearly marks not-yet-built functionality (Patient Login, My Health Journey, WiseOS) as "Future Update Required" instead of describing it as live.

### Added
- A "Legal" footer section (Privacy Policy · Terms of Use · Medical Disclaimer) on all 7 pages that carry the full footer nav: `index.html`, `team.html`, `contact.html`, `conditions/index.html`, `online-consultation/index.html`, `blog/index.html`. `gallery.html`'s lighter single-line footer got a matching small link row instead of the full grid, consistent with its existing minimal style. `thanks.html`/`booking-received.html` intentionally left unchanged (transient, `noindex` confirmation cards with no footer nav).

### Fixed
- `online-consultation/index.html` had a pre-existing invalid-markup bug — a stray `</body></html>` before its mobile-menu `<script>` block. Browsers silently recovered from it, but it was invalid HTML sitting next to a line this batch was already editing; removed.
- `online-consultation/index.html`'s footer "Book Consultation" link pointed to WhatsApp instead of `/contact.html` — Batch 1's changelog claimed this was already unified sitewide but missed this one footer instance. Corrected.

### Notes
- No separate Cookie Policy page — the site has no tracking/analytics cookies and only two third-party embeds (Google Fonts, Google Maps), fully covered by a short section inside the Privacy Policy. See `WEBSITE-AUDIT.md` Batch 3 entry for the full rationale.
- Legal pages are intentionally not added to `sitemap.xml` (standard practice for this content type); `robots.txt`'s existing `Allow: /` already permits indexing if search engines discover them via the new footer links.

## 2026-07-02 — Product Architecture Review (docs only)

Added `docs/20-PRODUCT-ARCHITECTURE-REVIEW.md`: a strategic review of the long-term
product architecture (Visitor → Trust → Consultation → Patient → My Health Journey →
WiseOS), covering information architecture, product roadmap, patient journey mapping,
content strategy, WiseOS integration readiness, navigation strategy, and a 12-month
growth plan. No site files, pages, or code changed. Reaffirms Batch B (dedicated
condition pages) as the correct next implementation step and identifies the absence of
Privacy/Terms/Disclaimer pages as a newly-documented gap.

## 2026-07-02 — Batch 2: conversion routing, social previews, testimonial claims

Copy/link/meta-tag fixes only — no layout, design, or new assets. Full rationale in `WEBSITE-AUDIT.md` → Phase 4 → Batch 2.

### Fixed
- **Homepage condition cards no longer skip straight to booking.** All 10 cards on `index.html` previously linked to `#book`, pushing an undecided visitor to commit before being educated. The 7 cards with a matching section on `/conditions/` (MCAS, Hashimoto's, Chronic Urticaria, Eczema, Allergic Rhinitis, Eosinophilic Esophagitis, POTS) now link to that anchor. The 3 without a matching section (Food Allergies, Lupus/RA, Allergic Asthma) link to `/conditions/` instead — no new clinical write-ups were invented to fill those gaps; adding them (or removing the cards) is a content decision for the clinic.
- **Missing/broken social preview images on Home and Team.** Added `og:image` tags to `index.html` (`assets/images/home-og.jpg`) and `team.html` (`assets/images/team-og.jpg`). Both files are added to the asset checklists in `README.md` and `PUBLISHING-GUIDE.md`; they don't exist yet, same status as every other missing image (logo, doctor/gallery photos) — tracked as one item under the outstanding "asset drop" roadmap entry.
- **Testimonial clinical claims softened.** Homepage testimonials previously cited exact, unverifiable lab values ("anti-TPO 890 → 210") and absolute outcome language ("off antihistamines completely," "the urticaria is gone") — a credibility/compliance risk for a medical site. Reworded to experience-focused language without altering the underlying patient stories.

### Added
- A visible "Individual results vary — always continue working with your treating physician" note directly under the homepage testimonials grid, reinforcing the existing footer disclaimer at the point where the claims are actually read.

### Notes
- Deferred to later batches (see `WEBSITE-AUDIT.md` roadmap): full condition-list alignment (adding the 3 missing condition sections or removing their homepage cards), the actual `*-og.jpg` image files, blog hub's og:image/retitle.

## 2026-07-02 — Batch 1: critical fixes (canonical domain, mobile nav, booking form)

Functional and SEO fixes only — no visual or design changes. Full rationale in `WEBSITE-AUDIT.md` → Phase 4 → Batch 1.

### Fixed
- **Canonical domain split resolved.** Home, Team, and Blog previously declared `wisehomeopathy.in` as canonical while the rest of the site (and `_redirects`, `robots.txt`, `sitemap.xml`) used `www.wisehomeopathy.com`, splitting SEO ranking signals across two domains. All three pages now use `www.wisehomeopathy.com` — updated in `<link rel="canonical">`, `og:url`, and JSON-LD `url`. Blog's canonical path bug (pointed at nonexistent `/blog.html`) fixed to `/blog/`. Home canonical fixed to `/` to match the sitemap.
- **Blog "Request a consultation" form now submits.** `blog/index.html`'s booking form previously called `preventDefault()` and displayed a fake "your request has been noted" message while sending the data nowhere. It's now a real Netlify Forms submission (`name="blog-consultation"`, honeypot spam field, `action="/booking-received.html"`), matching the pattern already working on `contact.html`.
- **Mobile navigation added to 4 pages that had none.** `online-consultation/`, `conditions/`, `contact.html`, and `gallery.html` hid their nav links below 820px with no replacement, leaving phone visitors unable to navigate. All four now have the same hamburger + slide-down mobile menu already used on Home/Team/Blog.
- **Homepage and Team header nav fixed.** Removed a duplicated "Conditions" link on both pages; both had no way to reach Home, Team, or Contact from their mobile menu. Desktop and mobile nav on both pages now read: Home · Online Consultation · Conditions · Team · Blog · Gallery.
- **Booking-confirmation page split from newsletter confirmation.** `thanks.html`'s "You're subscribed ✓" copy was shown to patients after submitting a *consultation* request, not just newsletter signups. New `booking-received.html` (noindex, same visual style) now handles both consultation forms (`contact.html` and `blog/index.html`); `thanks.html` is unchanged and serves only the newsletter form.

### Changed
- Standardized every page's "Book Now" / "Book Consultation" CTA to point to `/contact.html` (Online Consultation's previously went straight to WhatsApp, inconsistent with the rest of the site).
- Footer "Conditions" links on Home and Team previously pointed at homepage anchors (`#conditions`); now link to the actual per-condition anchors on `/conditions/`.
- Root-relative internal links standardized where pages previously used page-relative paths (e.g., `team.html`'s JS-generated profile-modal "Book a consultation" link, several `index.html`/`team.html` internal hrefs).

### Added
- `booking-received.html` — confirmation page for consultation-request form submissions.
- `<link rel="icon">` favicon tag to Home, Team, and Blog (previously present on the other 5 pages only).

### Verification
- Local static server + Playwright (390px mobile viewport) driving the hamburger menu on all 7 pages: menu opens, exposes all 7 nav links, closes correctly, zero new JS errors introduced.
- Repo-wide grep confirmed zero remaining `wisehomeopathy.in` references, correct form `action` targets on all three Netlify forms, and exactly one `menuBtn`/`mmenu` id pair per page.

### Notes
- Corrected an inaccurate finding in the original audit: `sitemap.xml` already included `team.html`; no sitemap change was needed.
- Deferred to later batches (see `WEBSITE-AUDIT.md` roadmap): homepage condition-card routing, og:image tags, blog article publishing, testimonial claim softening, the Gallery-in-nav decision, and the blog hub retitle.

## 2026-07-02 — Full website audit and master improvement plan

- Added `WEBSITE-AUDIT.md`: Phase 1 (project understanding), Phase 2 (page-by-page audit with KEEP/IMPROVE/REMOVE/ADD verdicts and cross-site critical findings), and Phase 3 (prioritized Critical/High/Medium/Low improvement roadmap). No site files modified in this entry.
