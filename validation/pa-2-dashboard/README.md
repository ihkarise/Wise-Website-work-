# Patient Access Batch PA-2 Browser Testing

Browser-driven verification for the "My Health Journey" dashboard shell and
the small `login.html`/`verify.html`/`assets/site.css` changes Batch PA-2
also makes. The first Phase 2A **frontend** test suite to be committed as a
reusable tool rather than run ad hoc — PA-1's own testing (docs/29 §16) was
real (a local static server + headless Chromium, backend mocked at the
network layer) but not committed, the same "ad hoc but real, formalized
later" pattern the Foundation backend batches went through before F5
committed `validation/phase-2a-foundation/`.

## What this proves, and how

`browser-test.js` starts a plain Node `http` static file server over this
repository's real, unmodified files, launches headless Chromium via
Playwright, and intercepts the Apps Script Web App URL at the network layer
(`page.route()`) to return a scripted response — the same "mock the
boundary, run the real code" discipline `validation/phase-1-5/` and
`validation/phase-2a-foundation/` already use for the backend, applied here
to the frontend's one network dependency instead of `SpreadsheetApp`.

Covers: the session guard's three paths (no token present, a valid session,
a rejected/expired session), sign-out, a network-failure fallback that
preserves the token, the exact approved session-expiry copy, 375px
responsive layout on all three pages this batch touches, and real
keyboard-driven (`page.keyboard.press('Tab')`, not a simulated `.focus()`
call) focus-visibility and heading-hierarchy checks — the same technique
PA-1 used to catch its own `:focus-visible` regression.

**The "No data yet" empty-state type has no live card consumer in this
batch** (no feature has a real, wired, zero-row data source yet — see
docs/29 §16's Batch PA-2 notes). Rather than leave it unverified, the test
calls the real function directly via `my-health-journey/dashboard.js`'s
small, explicit test-support export, `window.WiseDashboard`, instead of
re-implementing the logic in the test.

## Running it

Requires Playwright (this environment has it installed globally with
Chromium pre-fetched; a project-local `npm install playwright` also works).
If Playwright is only available globally:

```
NODE_PATH=$(npm root -g) node validation/pa-2-dashboard/browser-test.js
```

No `apps-script/*.gs` file is touched by this batch or exercised by this
suite — backend regression coverage remains
`validation/phase-1-5/validate.js` and
`validation/phase-2a-foundation/conformance.js`, both re-run unchanged for
this batch.

## What this does not prove

Runs against the real static files but a mocked backend response — it
cannot catch a live Apps Script deployment behaving differently from the
scripted mock (the same category of limitation
`validation/phase-2a-foundation/README.md` already states for its own
mocked-runtime approach), nor anything that only manifests against the
real, deployed Web App URL.

## Result (last run)

32/32 checks passed — re-run in Batch PA-5 after updating this suite for the
Reports card's own real data wiring (6 new checks; see this file's own header
comment and `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16's Batch PA-5 notes for
the full breakdown).
