# 38 - Patient Access Dashboard Shell Closeout
## Patient Access Batches PA-1–PA-2 — Version 1.0 — 2026-07-03

> Documentation-only record. No frontend page, no `apps-script/*.gs` file, no `shared/`
> contract, and no architecture document was modified to produce this closeout — it is
> a report on already-shipped, already-approved work, not a change to it. Mirrors the
> closeout discipline docs/27-PHASE-1.5-CLOSEOUT.md, docs/35-FOUNDATION-CLOSEOUT.md, and
> docs/36-IDENTITY-AND-ACCESS-CLOSEOUT.md already established. Per this session's
> explicit instruction: **Batches PA-1 and PA-2 are now frozen except for bug fixes.**

---

# 1. Scope Closed

Patient Access's first two batches (docs/29 §13's original Batch 5B frontend half, and
Batch 5C): the passwordless login/verify pages, and the "My Health Journey" dashboard
shell they lead into. Together these are the first patient-visible surface of Phase 2A
— everything before this point (Foundation, Identity & Access) was backend
infrastructure with no page a patient could actually open.

**In scope, delivered:**
- Passwordless magic-link Login Form and Sign-In/Verify pages (`login.html`,
  `verify.html`), consuming Identity & Access's `request_login_link`/
  `consume_login_link` endpoints exactly as frozen.
- Shared frontend design tokens and components (`assets/site.css`), extracted out of
  the two pages' original duplicated `<style>` blocks — docs/20 §5's long-flagged item,
  finally closed.
- The dashboard shell itself (`/my-health-journey/`): an authenticated header, a
  session guard consuming Foundation's `get_profile` route, and a six-card grid
  covering every module docs/29 §5 named for this phase, each rendering one of three
  distinct Empty State types.
- A committed Playwright browser-test harness (`validation/pa-2-dashboard/`) — the
  first Phase 2A frontend suite to be committed rather than run ad hoc.

**Not in scope, by design — the next thing Patient Access work builds, not this
closeout:** any real Timeline/Symptom Tracker/Reports data (Batches 5D/5E/5F — every
corresponding dashboard card is an Empty State today, correctly, per docs/29 §0's "an
honest empty state passes the test better than a half-built feature"); "Patient Login"
in primary nav (Batch 5G); any backend change of any kind (both batches shipped with
zero `apps-script/`/`shared/` modification, verified via `git diff --name-only` at each
batch).

---

# 2. Delivered Files

| File | Batch | Responsibility |
|---|---|---|
| `login.html` | PA-1, revised PA-2 | Email-entry Login Form; now also renders the session-expiry notice (PA-2). |
| `verify.html` | PA-1, revised PA-2 | Token-consume Sign-In/Verify page; success state now links to the real dashboard (PA-2). |
| `assets/site.css` | PA-2 | Shared `:root` tokens, `.card`/`.field`/`.submit`/`.secondary`/`.status`/`.skeleton`/focus-visible/skip-link components. |
| `my-health-journey/index.html` | PA-2 | Dashboard shell markup — authenticated header, six-card grid. |
| `my-health-journey/dashboard.js` | PA-2 | Session guard, `get_profile` call, Empty State rendering, sign-out. |
| `validation/pa-2-dashboard/browser-test.js` + `README.md` | PA-2 | Committed Playwright suite (26/26 passing). |

Plus the pre-implementation review that preceded PA-2:
`docs/37-DASHBOARD-SHELL-READINESS-REVIEW.md`.

---

# 3. Architecture Summary

No architecture change of any kind — both batches implement docs/29 §5's
already-approved Dashboard Architecture and §13's Batch 5B/5C scope, unmodified.
Two small, explicitly-scoped additions surfaced during implementation, both frontend-
only and both recorded at the time:

- `.status.warn` — a new CSS variant in `assets/site.css`, using the `--color-warn-*`
  tokens already defined but previously only used by `internal/consultation-summary.html`'s
  staff banner. Needed for the session-expiry notice; not a token-system redesign.
- The `/login.html?reason=expired` redirect contract between the dashboard's session
  guard and the Login Form — an frontend-only convention (not a backend contract; the
  backend's `FOUNDATION_UNAUTHORIZED` code was already generic and required no change).

---

# 4. Session & Empty-State Model, as Actually Built

**Session guard:** the dashboard reads `sessionStorage`, and if a token is present,
verifies it server-side via `get_profile` before rendering anything dashboard-shaped.
An absent token redirects to `/login.html` silently (never having logged in isn't a
privacy event); a present-but-rejected token redirects to `/login.html?reason=expired`,
clears the stale token, and shows: "For your privacy, your secure session has ended.
Please sign in again." — one message regardless of the specific rejection reason,
mirroring `FOUNDATION_UNAUTHORIZED`'s own single generic code. A network failure (the
call itself failing, not a rejected session) is treated as distinct — the token is kept
and a friendly retry message is shown instead.

**Three Empty State types**, applied across the six dashboard cards:

| Type | Cards | Why |
|---|---|---|
| Coming later in Phase 2A | Timeline, Symptom Tracker, Reports | Each has a named, already-sequenced future batch (5D/5E/5F). |
| Planned for a future version | Care Plan, Messages, Digital Twin | No architecture exists yet for any of the three (docs/29 §2.2). |
| No data yet | *(no live card consumer yet)* | Reserved for a real, wired feature with zero rows for a specific patient — arrives once 5D/5E/5F ship. Built and directly verified now rather than left unverified. |

---

# 5. Validation Summary

`validation/pa-2-dashboard/browser-test.js` — 26/26 checks passed at closeout, covering
the session guard's three paths (no token / valid / rejected), sign-out, a
network-failure fallback that preserves the token, the exact approved session-expiry
copy, 375px responsive layout on all three touched pages, and real keyboard-driven
focus-visibility and heading-hierarchy checks.

---

# 6. Regression & Static Analysis Summary

Re-run clean and unchanged after both PA-1 and PA-2, since neither touched a backend
file:
- `node validation/static-analysis/analyze.js` — 0 findings.
- `node validation/phase-2a-foundation/conformance.js` — 61/61.
- `node validation/phase-1-5/validate.js` — 42/42.

---

# 7. Deferred Work

Named and tracked, not silently dropped:
- Real Timeline/Symptom Tracker/Reports data (Batches 5D/5E/5F) — the subject of
  docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md for 5D specifically.
- "Patient Login" in primary nav (Batch 5G).
- A shared cross-page session-guard/header JavaScript module — `dashboard.js` is
  self-contained today, matching `login.html`/`verify.html`'s existing per-page-script
  convention; worth revisiting only once a second authenticated page actually exists
  to reuse it.

---

# 8. Lessons Learned

**A committed browser-test harness is worth building the first time it's needed, not
deferred again.** PA-1's own Playwright testing was real but ad hoc (docs/29 §16);
PA-2 formalized it into `validation/pa-2-dashboard/` — the same "ad hoc, then
formalized" arc Foundation's backend went through before F5. Doing this now, while the
suite is still small, is cheaper than doing it once three more pages exist to test.

**Blocking third-party network calls at the test layer, not the product layer, keeps a
suite fast without touching real markup.** Every Phase 2A page preconnects to Google
Fonts; in a network-restricted test environment this stalled every page load until a
navigation timeout. Aborting those specific requests at the Playwright route layer cut
the suite's runtime from minutes to under two seconds with no change to any shipped
page.

**A three-tone Empty State system is more honest than a single generic one** once a
dashboard has both "not built yet, but scheduled" and "not designed yet, no date"
features side by side — the distinction this session's design decision made explicit
avoids quietly implying the same near-term timeline for both.

---

# 9. Readiness for Batch PA-3

**The dashboard shell is frozen except for bug fixes**, effective with this closeout —
`login.html`, `verify.html`, `assets/site.css`, and `my-health-journey/` join Identity &
Access's frozen backend as stable, tested surface. Future Patient Access capability is
delivered by wiring real data into the dashboard's existing Empty State cards and
adding new pages behind them — not by restructuring the shell itself.

**Freezing the shell is not the same as closing Patient Access.** Patient Access as a
product capability is not done — a patient can log in and see an honest, empty
dashboard, but no card shows real data yet. That is expected: Batches 5D/5E/5F are
exactly the work that changes that, one card at a time, lowest-risk (read-only
Timeline) first, per docs/29 §13's own risk-ordered sequencing.

### Entry Criteria for Batch PA-3 — already satisfied by this closeout

- [x] PA-1 and PA-2 merged/delivered (PR #30 merged; PR #31 delivered on this branch).
- [x] `assets/site.css` extraction complete — a Timeline card has a shared stylesheet
      to build against rather than a fourth page-local duplicate.
- [x] Dashboard shell renders a "Timeline" card today as an Empty State, ready to
      become real once 5D ships — no shell restructuring anticipated.
- [x] Static analysis clean (0 findings); conformance passing (61/61); zero regression
      to Phase 1.5 (42/42).
- [x] A committed, reusable frontend test harness exists as a pattern for 5D's own
      browser tests to follow.

### Still open, expected to be closed by Batch PA-3 work, not by this document

- [ ] `ConsultationHistory` sheet and its data-access layer (backend — out of scope for
      a frontend-shell closeout, and out of scope for the readiness review that follows
      this document, per this session's "do not write code" instruction).
- [ ] A staff entry tool for `ConsultationHistory` rows.
- [ ] The patient-facing read-only Timeline/Consultation History views themselves.
- [ ] Real values for `PATIENT_SPREADSHEET_ID` and `FOUNDATION_SESSION_SIGNING_SECRET`
      (operational, unchanged from docs/36's own still-open item).

---

# Relationship to Other Documents

- **docs/29 §13/§16** — the approved plan and batch-by-batch implementation notes this
  closeout summarizes; unmodified by this document beyond the one-paragraph freeze
  notice added at the top of §16.
- **docs/37-DASHBOARD-SHELL-READINESS-REVIEW.md** — the pre-PA-2 review this closeout
  confirms was acted on.
- **docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md** — the pre-PA-3 review this
  closeout's §9 entry criteria feed into.
- **docs/04-COMPONENT-LIBRARY.md** — updated in place, during PA-2, with the concrete
  component entries this closeout references; not restated here.
- **docs/24-ROADMAP.md** — the single source of truth for overall phase status; updated
  alongside this closeout to reflect the freeze.
