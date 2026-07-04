# Patient Access Batch PA-5 Browser Testing

Browser-driven verification for the Reports full history page
(`my-health-journey/reports/index.html`), the dashboard's Reports card now that it
carries a real upload form and recent-uploads list (`my-health-journey/dashboard.js`'s
`loadReportsPreview()`), and reuse of the shared `my-health-journey/session-guard.js`
module. Mirrors `validation/pa-4-symptom-tracker/`'s discipline exactly — a local static
server + headless Chromium (Playwright), the backend mocked at the network layer,
external font requests blocked for speed/determinism, keyboard-driven focus checks.

## What this proves, and how

`browser-test.js` starts a plain Node `http` static file server over this repository's
real, unmodified files, launches headless Chromium via Playwright, and intercepts the
Apps Script Web App URL at the network layer, routing by the parsed request's
`foundation_action` (`get_profile`, `get_timeline`, `get_symptom_logs`, `get_reports`,
`upload_report`, `download_report`) so each call gets a realistic, semantically correct
response.

Covers: the Reports full history page rendering real entries newest-first with escaped
filenames, mime type, and size; the "No reports yet" Empty State for a zero-report
patient; a network-failure fallback that preserves the session; the dashboard's Reports
card always showing the upload form (the card's primary content, per docs/29 §5,
present regardless of whether reports exist yet) with a real `<label for>`; the recent
uploads list + "View full history" link once reports exist; a real file selected via
Playwright's `setInputFiles()` being read client-side and uploaded successfully,
resetting the form and refreshing the list; the client-side, UX-only size pre-check
rejecting an oversized file **without ever calling the network** (proving the check
actually runs before `fetch`, not just after a slow round trip); a rejected upload
showing the backend's own message verbatim; a real file download triggered from the
Reports page (Playwright's `download` event, asserting the suggested filename matches
the report's own `file_name`); a rejected download showing an inline error without
navigating away; sign-out from the Reports page; 375px responsive layout; and real
keyboard-driven focus-visibility and heading-hierarchy checks.

## Running it

Requires Playwright (see `validation/pa-2-dashboard/README.md`'s note on `NODE_PATH` if
it's only installed globally in this environment):

```
NODE_PATH=$(npm root -g) node validation/pa-5-reports/browser-test.js
```

No `apps-script/*.gs` file is exercised by this suite — backend conformance coverage,
including the content-based MIME-spoofing rejection and the cross-patient isolation
checks on list/download (the platform's highest-risk feature), is
`validation/phase-2a-foundation/conformance.js`'s Stage 9.

## What this does not prove

Same category of limitation `validation/pa-2-dashboard/README.md` already states: this
runs against the real static files but a mocked backend response — it cannot catch a
live Apps Script deployment behaving differently from the scripted mock (in particular,
this suite cannot exercise Apps Script's own real `Utilities.newBlob()` content
detection at all — that is exclusively `validation/phase-2a-foundation/`'s Node-mocked
coverage, disclosed there as an approximation of the real platform behavior), nor
anything that only manifests against the real, deployed Web App URL.

## Result (last run)

32/32 checks passed — executed in this batch's environment (Playwright available via
this environment's global `node_modules`; see `validation/pa-2-dashboard/README.md`'s
`NODE_PATH` note). The disclosed gap prior batches' READMEs recorded (no `package.json`
or committed Playwright dependency anywhere in this repository) is unchanged and still
real — only this one session happened to have Playwright installed globally; a future
session without it would need the same workaround, or a real `package.json`.
