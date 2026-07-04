# Patient Access Batch PA-4 Browser Testing

Browser-driven verification for the Symptom History page
(`my-health-journey/symptoms/index.html`), the dashboard's Symptom Tracker card now
that it carries a real quick-log form and most-recent-value summary
(`my-health-journey/dashboard.js`'s `loadSymptomPreview()`), and reuse of the shared
`my-health-journey/session-guard.js` module. Mirrors `validation/pa-3-timeline/`'s
discipline exactly — a local static server + headless Chromium (Playwright), the
backend mocked at the network layer, external font requests blocked for
speed/determinism, keyboard-driven focus checks.

## What this proves, and how

`browser-test.js` starts a plain Node `http` static file server over this repository's
real, unmodified files, launches headless Chromium via Playwright, and intercepts the
Apps Script Web App URL at the network layer, routing by the parsed request's
`foundation_action` (`get_profile`, `get_timeline`, `get_symptom_logs`, `log_symptom`)
so each call gets a realistic, semantically correct response.

Covers: the Symptom History list rendering real entries newest-first with escaped
notes (a deliberately malicious `<script>` fixture proves it is never rendered as a
live element) and the optional condition tag; the "No entries yet" Empty State for a
zero-entry patient; a network-failure fallback that preserves the session; the
dashboard's Symptom Tracker card always showing the quick-log form (the card's primary
content, per docs/41 §2, present regardless of whether entries exist yet) with every
scale field carrying a real `<label for>`; the bare most-recent-value summary + "View
full history" link once entries exist; a successful quick-log submission showing an
`aria-live` confirmation and resetting the form; a rejected submission showing the
backend's own message verbatim while preserving the patient's in-progress values
(docs/41 §11); sign-out from the Symptom History page; 375px responsive layout; and
real keyboard-driven focus-visibility and heading-hierarchy checks (including
confirming the entry list is a genuine `<ol>`, not decorative `<div>`s).

## Running it

Requires Playwright (see `validation/pa-2-dashboard/README.md`'s note on `NODE_PATH` if
it's only installed globally in this environment):

```
NODE_PATH=$(npm root -g) node validation/pa-4-symptom-tracker/browser-test.js
```

No `apps-script/*.gs` file is exercised by this suite — backend conformance coverage,
including the cross-patient isolation check on this batch's write path (the platform's
first patient-writable route), is `validation/phase-2a-foundation/conformance.js`'s
Stage 8.

## What this does not prove

Same category of limitation `validation/pa-2-dashboard/README.md` already states: this
runs against the real static files but a mocked backend response — it cannot catch a
live Apps Script deployment behaving differently from the scripted mock, nor anything
that only manifests against the real, deployed Web App URL.

## Result (last run)

28/28 checks passed — executed in Batch PA-5's environment (Playwright available via
this environment's global `node_modules`; see `validation/pa-2-dashboard/README.md`'s
`NODE_PATH` note), re-run as this batch's zero-regression check on the frontend files
PA-5 does not touch. The gap this section previously recorded (no `package.json` or
committed Playwright dependency anywhere in this repository) is unchanged and still
real — only this one session happened to have Playwright installed globally.
