# Patient Access Batch PA-4 Browser Testing

Browser-driven verification for the Symptom Tracker page
(`my-health-journey/symptom-tracker/index.html`) and the dashboard's own Symptom
Tracker card now that it is wired to real data. Mirrors
`validation/pa-3-timeline/`'s discipline exactly — a local static server + headless
Chromium (Playwright), the backend mocked at the network layer, external font
requests blocked for speed/determinism, keyboard-driven focus checks.

## What this proves, and how

`browser-test.js` starts a plain Node `http` static file server over this repository's
real, unmodified files, launches headless Chromium via Playwright, and intercepts the
Apps Script Web App URL at the network layer — routing by the parsed request's
`foundation_action` (`get_profile`, `get_symptom_logs`, `create_symptom_draft`,
`update_symptom_draft`, `submit_symptom_log`), with a small in-memory `state` object so
a save/submit round trip genuinely reflects back into the next call, the same
"realistic per-action mock" discipline `validation/pa-3-timeline/`'s own mock
established.

Covers: no draft showing the "Log a new entry" affordance; starting a new entry
creating a draft and revealing the form; an existing draft pre-filling the form
(including that an unset scale field pre-fills blank, never `"0"` or `"null"`); saving
a draft (confirmation status, values retained); a backend validation error shown
verbatim; **the approved offline behavior** — a network failure on save shows the
friendly, specific "You appear to be offline" message, leaves the typed value exactly
as it was (no data loss), and confirms `localStorage` stays empty (no local
persistence, per the approved PA-4 decision); submitting an empty draft rejected with
the backend's own message, the form not silently cleared; a successful submit showing
a confirmation, replacing the form with "Log a new entry," and the newly submitted
entry appearing in the history list; the submitted-history list rendering as a real
`<ol>`, newest first, with a synthesized summary including notes when present; the
zero-entries "No entries yet" badge; an initial-load network failure on both sections;
the dashboard's Symptom Tracker card reflecting a draft-in-progress vs. a most-recent
submitted entry; sign-out; 375px responsive layout; and real keyboard-driven
focus-visibility, label-association, and live-region (`role="status"
aria-live="polite"`) checks.

## Running it

This repository's root `package.json` (added this batch — closing a real gap the
PA-4 readiness review found: `validation/pa-2-dashboard/` and `validation/pa-3-timeline/`
were already committed but had no way to install the `playwright` they require)
pins `playwright` to the exact version whose bundled Chromium revision matches what
this environment pre-provisions, so a plain local install is enough:

```
npm install
node validation/pa-4-symptom-tracker/browser-test.js
```

No `apps-script/*.gs` file is exercised by this suite — backend conformance coverage is
`validation/phase-2a-foundation/conformance.js`'s Stage 8.

## What this does not prove

Same category of limitation every other `validation/pa-*` suite already states: this
runs against the real static files but a mocked backend response — it cannot catch a
live Apps Script deployment behaving differently from the scripted mock, nor anything
that only manifests against the real, deployed Web App URL. In particular, "no local
persistence" here is verified as "this suite's own code never writes to
`localStorage`" — it does not (and cannot) prove the absence of a *future* regression
that might introduce one.

## Result (last run)

38/38 checks passed. See `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16's Batch PA-4 notes
for the full breakdown.
