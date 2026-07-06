# Phase 2B Batch PXP-1 Browser Testing

Browser-driven verification for the My Profile page
(`my-health-journey/profile/index.html`), its edit-in-place form
(`my-health-journey/profile/profile.js`'s `profileFormHtml()`/`wireProfileForm()`), the
one disclosed link added to the dashboard shell (`my-health-journey/index.html`'s
`#profileLink`), and reuse of the shared `my-health-journey/session-guard.js` module.
Mirrors `validation/pa-4-symptom-tracker/`'s discipline exactly — a local static server
+ headless Chromium (Playwright), the backend mocked at the network layer, external
font requests blocked for speed/determinism, keyboard-driven focus checks.

## What this proves, and how

`browser-test.js` starts a plain Node `http` static file server over this repository's
real, unmodified files, launches headless Chromium via Playwright, and intercepts the
Apps Script Web App URL at the network layer, routing by the parsed request's
`foundation_action` (`get_profile`, `get_patient_profile`, `save_patient_profile`) so
each call gets a realistic, semantically correct response.

Covers: a first-time visit (the lazy-created, all-empty default record) rendering a
real, editable form rather than an error state; an existing saved profile pre-filling
every field with its real values, including a deliberately malicious
`emergency_contact` fixture proving it renders as inert input text, never as live
markup; a successful save showing an `aria-live` confirmation **without** resetting the
form (an edit-in-place record, not an append-only log — the one behavioral difference
from every prior dashboard form); a rejected save showing the backend's own message
verbatim while preserving the patient's in-progress value; a network-failure fallback
that preserves the session; the dashboard's disclosed "My Profile" link (present,
correctly targeted, and actually navigable); sign-out from the My Profile page; 375px
responsive layout; and real keyboard-driven focus-visibility and heading-hierarchy
checks.

## Running it

Requires Playwright (see `validation/pa-2-dashboard/README.md`'s note on `NODE_PATH` if
it's only installed globally in this environment):

```
NODE_PATH=$(npm root -g) node validation/pxp-1-patient-profile/browser-test.js
```

No `apps-script/*.gs` file is exercised by this suite — backend conformance coverage,
including the platform's first upsert-style entity's lazy-creation and cross-patient-
isolation checks, is `validation/phase-2a-foundation/conformance.js`'s Stage 10.

## What this does not prove

Same category of limitation `validation/pa-2-dashboard/README.md` already states: this
runs against the real static files but a mocked backend response — it cannot catch a
live Apps Script deployment behaving differently from the scripted mock, nor anything
that only manifests against the real, deployed Web App URL.

## Result (last run)

**25/25 checks passed**, Playwright available in this environment (`npm root -g` has
`playwright` installed globally). `validation/pa-2-dashboard/browser-test.js`'s own
keyboard-focus assertion was updated in the same change (one extra `Tab` press,
since the dashboard header now has three, not two, interactive controls after the skip
link) and re-confirmed passing (32/32) after this batch's one disclosed header addition.
