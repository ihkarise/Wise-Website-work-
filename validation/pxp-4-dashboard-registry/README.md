# Phase 2B Batch PXP-4 Browser Testing — Dashboard Registry

Browser-driven verification for Batch PXP-4 (docs/44-PHASE-2B-TECHNICAL-PLAN.md
§7.3/§13, ADR-012 (amended), docs/47-PHASE-2B-IMPLEMENTATION-RULES.md §3) —
the batch that makes the "My Health Journey" dashboard a registry-driven
consumer of PXP-3's Module Registry plus `PatientModuleState`.

This suite is the **PXP-4-specific** coverage: the new registry-driven
surface (per-patient enablement, `display_order`, empty-dashboard state,
unregistered `data_source` fallback). The pre-existing dashboard shell,
Timeline, Symptom Tracker, and Reports behavior is still fully covered by
`validation/pa-2-dashboard/`, `validation/pa-3-timeline/`,
`validation/pa-4-symptom-tracker/`, `validation/pa-5-reports/`, all of which
this batch updated (their existing checks continue to pass, unchanged) to
seed the new `get_patient_module_states` response.

## What this proves

Every check exercises `my-health-journey/dashboard.js`'s real code end to
end with the backend mocked at the network layer (Playwright `page.route`),
the same discipline every PA-* browser test already uses:

1. **Zero enabled modules → dashboard-level empty state, no cards.** A
   patient authenticated with a valid session but with no `enabled=true`
   rows sees exactly one full-width empty-state card and zero `.dash-card
   h2` elements — the intentional, registry-driven visibility outcome per
   docs/44 §13.3.
2. **A subset of enabled modules → only those cards render, in
   `display_order`.** Enabling only `timeline` + `reports` (with
   `symptom_tracker` explicitly `enabled: false`) yields exactly two
   cards, in order, with the correct DOM ids (`card-timeline-body`,
   `card-reports-body`).
3. **Every enabled module → all three cards render, ordered by
   `display_order`.** Timeline (10) < Symptom Tracker (20) < Reports (30) —
   deliberately fed to the client shuffled to prove that ordering comes
   from the registry, not the response order.
4. **Each card's registered loader fires exactly once with the correct
   `moduleId`.** Instrumented at the mock: assert the exact
   `foundation_action` calls the dashboard issues (`get_profile`,
   `get_patient_module_states`, then the per-enabled-module `data_source`
   calls in `display_order`).
5. **An unregistered `data_source` fails soft — skeleton, `console.warn`,
   no crash, sibling cards unaffected.** A synthetic registry entry the
   test injects via `window.WiseDashboard.MODULE_REGISTRY` proves the
   loader-dispatcher's fallback behavior (docs/47 §3: a future module
   arrives when its own batch registers a loader; until then, its card
   renders as a skeleton, not a broken page).
6. **`filterEnabledModules` is a pure function.** Exposed on
   `window.WiseDashboard`, exercised directly with shuffled input to
   confirm `display_order` ordering, `enabled === false` filtering, and
   silent skipping of state rows for module_ids not in the registry.
7. **A rejected `get_patient_module_states` collapses to `/login.html?
   reason=expired`,** matching the same fail-closed treatment
   `get_profile` already gets — enablement lookups and identity share one
   session, so either rejection is a session rejection.

## Running it

Requires Playwright (`npm install playwright` in the repo root — this
environment has Chromium pre-fetched at `/opt/pw-browsers`, matching
`playwright@1.56`). If Playwright is only available globally:

```
NODE_PATH=$(npm root -g) node validation/pxp-4-dashboard-registry/browser-test.js
```

## What this does not prove

Runs against the real static files but a mocked backend response — the
same category of limitation the whole PA-*/pxp-* browser-test family
already states. The backend's own `get_patient_module_states` route (the
per-patient row merge, cross-patient isolation, and doctor/staff-only
enable/disable path) is covered by `validation/phase-2a-foundation/
conformance.js`'s Stage 12 (added in PXP-3, all 17 checks still pass), not
duplicated here.

## Result (last run)

See the batch's PR description and CHANGELOG entry for the check counts.
