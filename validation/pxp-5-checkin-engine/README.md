# Phase 2B Batch PXP-5 Browser Testing — Daily Check-in Engine

Browser-driven verification for Batch PXP-5 (docs/44-PHASE-2B-TECHNICAL-PLAN.md
§10/§11, ADR-016, docs/47-PHASE-2B-IMPLEMENTATION-RULES.md §3) — the batch that adds
the Daily Check-in Engine: a dynamic, template-driven dashboard card
(`my-health-journey/dashboard.js`) and a full-history page
(`my-health-journey/checkins/`).

This suite is the **PXP-5-specific** coverage: dynamic form rendering from a
template's own question list, the "not yet assigned" state, submission, the
recent-response summary, and the full-history page. The pre-existing Dashboard
Registry mechanism (per-patient enablement, `display_order`, empty dashboard,
unregistered `data_source` fallback) is unchanged by this batch and remains fully
covered by `validation/pxp-4-dashboard-registry/`.

## What this proves

Every check exercises the real code end to end with the backend mocked at the
network layer (Playwright `page.route`), the same discipline every earlier
PA-*/pxp-* browser test already uses:

1. **No active template assignment → a friendly "not assigned yet" message, no
   form.** A real, expected outcome (docs/44 §10.2), never rendered as an error.
2. **An assigned template → a dynamic form generated from its own question list.**
   Number questions render as number inputs with the template's own `min`/`max`;
   boolean questions render as a Yes/No select; string questions render as a
   textarea; only `required` questions carry the `required` attribute — none of
   this is hardcoded per field name anywhere in `dashboard.js`.
3. **Submission posts the exact `template_id`/`template_version` the form was
   rendered from**, with each answer coerced to its own declared type (a real
   JS number, a real boolean, a trimmed string) before being sent.
4. **A rejected submission surfaces the server's own friendly error message and
   keeps the patient's in-progress answers** (no silent `form.reset()`), the
   same discipline every earlier write-form (`log_symptom`, `upload_report`)
   already establishes.
5. **The recent-response summary renders the template's own question labels**,
   not raw `field_key`s, and displays a boolean answer as "Yes"/"No".
6. **A disabled `daily_checkin` module renders no card at all** — proving
   PXP-4's fail-closed, registry-driven discipline applies unchanged to this
   new module, without re-testing PXP-4's own mechanism.
7. **The full-history page (`/my-health-journey/checkins/`) renders every
   response**, newest first, humanizing each `field_key` generically (e.g.
   `overall_feeling` → "Overall Feeling") rather than assuming a fixed field
   set — and shows the shared "No entries yet" empty state when there are none.

## Running it

Requires Playwright (`npm install playwright` in the repo root — this
environment has Chromium pre-fetched at `/opt/pw-browsers`, matching
`playwright@1.56`). If Playwright is only available globally:

```
NODE_PATH=$(npm root -g) node validation/pxp-5-checkin-engine/browser-test.js
```

## What this does not prove

Runs against the real static files but a mocked backend response — the same
category of limitation the whole PA-*/pxp-* browser-test family already states.
The backend's own `get_checkin_template`/`submit_checkin_response`/
`get_checkin_responses` routes (JSON-answers validation per docs/44 §11.4,
docs/44 §10.2's doctor-assignment enforcement boundary, cross-patient isolation,
`CheckInTemplateAssignment`'s doctor/staff-only write path) are covered by
`validation/phase-2a-foundation/conformance.js`'s Stage 13, added in this same
batch, not duplicated here.

## Result (last run)

See the batch's PR description and CHANGELOG entry for the check counts.
