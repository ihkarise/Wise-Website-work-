# Patient Access Batch PA-4 Browser Testing

Browser-driven verification for the Symptom History page
(`my-health-journey/symptoms/index.html`) and reuse of the shared
`my-health-journey/session-guard.js` module. Mirrors `validation/pa-3-timeline/`'s
discipline exactly — a local static server + headless Chromium (Playwright), the
backend mocked at the network layer, external font requests blocked for
speed/determinism, keyboard-driven focus checks.

## Updated in Batch PXP-10 (Symptom Tracker Migration, docs/44 §10.1/§22, docs/47)

The dashboard's own Symptom Tracker card (quick-log form, most-recent-value summary)
is retired along with the `symptom_tracker` Module Registry entry
(`shared/constants/module-registry.md`'s "Batch PXP-10 removal" section) — that
rendering code no longer exists in `dashboard.js`. The five dashboard-card checks this
suite used to run (quick-log form present, summary + "View full history" link,
successful/rejected submission) are replaced by one retirement proof: the dashboard
renders with no Symptom Tracker card at all, even when the mocked backend still
returns a stale `symptom_tracker` `enabled: true` `PatientModuleState` row — proving
the card's absence is driven by the registry entry being gone, not a coincidentally
disabled state row. **The standalone Symptom History page and its own tests below are
completely unaffected** — `my-health-journey/symptoms/` and `symptoms.js` are
untouched, still reachable by direct URL, and `get_symptom_logs` (mocked below) is
still fully functional — deprecated by documentation disclosure only
(`shared/schemas/symptom-log.md`'s "Deprecated" section), never by a code change.

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
dashboard's retirement of the Symptom Tracker card (Batch PXP-10, above); sign-out
from the Symptom History page; 375px responsive layout; and real keyboard-driven
focus-visibility and heading-hierarchy checks (including confirming the entry list is
a genuine `<ol>`, not decorative `<div>`s).

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

**Not executed in this batch's environment** — same disclosed gap
`docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md` Finding 5 already recorded for
`pa-2-dashboard`/`pa-3-timeline`: no `package.json` exists anywhere in this repository
to declare the `playwright` dependency, and no `node_modules/playwright` is present in
this session. This suite is committed, written to the same discipline as
`pa-3-timeline`'s (which last ran 29/29), and should be run in an environment with
Playwright installed before this batch is considered fully closed out — stated openly
rather than silently claimed as passing.
