# Patient Access Batch PA-3 Browser Testing

Browser-driven verification for the Timeline list page
(`my-health-journey/timeline/index.html`), the Consultation History detail page
(`my-health-journey/timeline/entry.html`), the shared
`my-health-journey/session-guard.js` module, and the dashboard's own Timeline card now
that it is wired to real data. Mirrors `validation/pa-2-dashboard/`'s discipline exactly
— a local static server + headless Chromium (Playwright), the backend mocked at the
network layer, external font requests blocked for speed/determinism, keyboard-driven
focus checks.

## What this proves, and how

`browser-test.js` starts a plain Node `http` static file server over this repository's
real, unmodified files, launches headless Chromium via Playwright, and intercepts the
Apps Script Web App URL at the network layer — but unlike PA-2's original mock, this
one **routes by the parsed request's `foundation_action`** (`get_profile`,
`get_timeline`, `get_timeline_entry`), so each call gets a realistic, semantically
correct response rather than one blanket envelope for every request.

Covers: the Timeline list rendering real entries in the backend-provided (already
sorted) order with correct per-entry links keyed by `record_id`; the "No data yet"
Empty State for a zero-entry patient; a network-failure fallback that preserves the
session; the detail page's full-vs-truncated summary-text distinction from the list
view; a missing `?id=` never issuing a request at all; a rejected `record_id` (whether
unknown or belonging to a different patient — indistinguishable by design, per
docs/40-CONSULTATION-IDENTITY-STRATEGY.md Q3) showing the backend's own message
verbatim; the dashboard's Timeline card showing real entries and the correct "View full
timeline" link; sign-out from a Timeline page; 375px responsive layout on both new
pages; and real keyboard-driven focus-visibility and heading-hierarchy checks
(including confirming the entry list is a genuine `<ol>`, not decorative `<div>`s).

## Running it

Requires Playwright (see `validation/pa-2-dashboard/README.md`'s note on `NODE_PATH` if
it's only installed globally in this environment):

```
NODE_PATH=$(npm root -g) node validation/pa-3-timeline/browser-test.js
```

No `apps-script/*.gs` file is exercised by this suite — backend conformance coverage is
`validation/phase-2a-foundation/conformance.js`'s Stage 7.

## What this does not prove

Same category of limitation `validation/pa-2-dashboard/README.md` already states: this
runs against the real static files but a mocked backend response — it cannot catch a
live Apps Script deployment behaving differently from the scripted mock, nor anything
that only manifests against the real, deployed Web App URL.

## Result (last run)

29/29 checks passed. See `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16's Batch PA-3 notes for
the full breakdown.
