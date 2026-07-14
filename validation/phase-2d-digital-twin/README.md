# Phase 2D — Wise Digital Twin & AI Summaries (Batch PXP-12) browser tests

Browser-driven verification for the patient-facing Health Story card + page and the doctor-facing
Digital Twin Review card (docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md §16). Mirrors
`validation/phase-2c-milestones/`'s discipline exactly: a local static server + headless Chromium
(Playwright), the backend mocked at the network layer, external fonts blocked for determinism.

## What it covers (docs/59 §16)

- The Health Story (patient) card and Digital Twin Review (doctor) card each **do not render at
  all** when their registry entry or module state is disabled — fail-closed (ADR-030 for the
  doctor half).
- The patient page shows only approved `published_output` and the honest empty state; **no
  pending/rejected narrative and no raw `ai_output` ever appears in the patient view** (ADR-028).
- The patient card/page expose no generate/approve/edit control (read-only).
- The doctor card's draft banner ("AI-generated draft — not yet visible to the patient") precedes
  any Approve/Edit/Reject control, and the Approve control's copy names patient visibility as what
  approval unlocks.
- Generate calls `generate_digital_twin_narrative` with the chosen `narrative_type`; Approve calls
  `review_digital_twin_narrative` with `review_status: approved`.

The backend pipeline (roster-scoping, the doctor-approval gate, approved-only patient visibility,
the drift check, the rate limit) is `validation/phase-2a-foundation/conformance.js`'s Stage 29,
added in this same batch — not duplicated here.

## Run it

```
NODE_PATH=$(npm root -g) node validation/phase-2d-digital-twin/browser-test.js
```

(see `validation/pa-2-dashboard/README.md` for why `NODE_PATH` may be needed)
