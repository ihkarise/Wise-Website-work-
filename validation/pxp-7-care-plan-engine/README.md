# Phase 2B Batch PXP-7 Browser Testing — Personal Care Plan

Browser-driven verification for Batch PXP-7 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §12,
docs/47-PHASE-2B-IMPLEMENTATION-RULES.md §3) — the batch that adds the Personal Care
Plan capability: a read-only dashboard card (`my-health-journey/dashboard.js`) and a
full-detail page (`my-health-journey/care-plan/`).

This suite is the **PXP-7-specific** coverage: the "no plan authored yet" state, the
dashboard card's read-only preview, the full-detail page's plan summary + instruction
history, and the disabled-module fail-closed check. The pre-existing Dashboard
Registry mechanism (per-patient enablement, `display_order`, empty dashboard,
unregistered `data_source` fallback) is unchanged by this batch and remains fully
covered by `validation/pxp-4-dashboard-registry/`.

## What this proves

Every check exercises the real code end to end with the backend mocked at the
network layer (Playwright `page.route`), the same discipline every earlier
PA-*/pxp-* browser test already uses:

1. **No Care Plan authored yet → a friendly "hasn't created a care plan" message,
   no read affordance rendered as an error.** A real, expected outcome (mirrors
   `daily_checkin`'s own "not assigned yet" state).
2. **An authored plan → the dashboard card renders a short, truncated preview**
   (goals, next review date if set) with a link to the full plan page — never the
   full goals text or the instruction list, the same "bare summary, link to the
   full page" scope every other history-backed card already applies.
3. **A disabled `care_plan` module renders no card at all** — proving PXP-4's
   fail-closed, registry-driven discipline applies unchanged to this new module,
   without re-testing PXP-4's own mechanism.
4. **The full-detail page (`/my-health-journey/care-plan/`) renders the current
   plan's full goals text, version, and next review date**, plus every attached
   `DoctorInstruction`, newest `effective_date` first, each labeled with a
   humanized `instruction_type`/`status` badge (e.g. `follow_up` → "Follow Up").
5. **The full-detail page shows the shared "No entries yet" empty state** when
   the caller has no Care Plan at all.

## Running it

Requires Playwright (`npm install playwright` in the repo root — this
environment has Chromium pre-fetched at `/opt/pw-browsers`, matching
`playwright@1.56`). If Playwright is only available globally:

```
NODE_PATH=$(npm root -g) node validation/pxp-7-care-plan-engine/browser-test.js
```

## What this does not prove

Runs against the real static files but a mocked backend response — the same
category of limitation the whole PA-*/pxp-* browser-test family already states.
The backend's own `get_care_plan`/`get_doctor_instructions` routes (versioning/
supersession, `care_plan_id` ownership validation, one-way instruction status
transitions, cross-patient isolation) are covered by
`validation/phase-2a-foundation/conformance.js`'s Stage 15, added in this same
batch, not duplicated here.

## Result (last run)

See the batch's PR description and CHANGELOG entry for the check counts.
