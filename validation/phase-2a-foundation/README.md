# Phase 2A Foundation Conformance Testing (Batch F5)

A local, Node-only test tool proving that the real, committed
Foundation-family `apps-script/*.gs` source produces output that
actually conforms to its own `shared/` contracts — not just that the
code runs, but that what it returns matches the schema it claims to
implement. This is **not** part of the Apps Script project — nothing
under `apps-script/` loads or depends on anything here, and this
directory is never pushed via `clasp`.

Named as Foundation batch F5's explicit deliverable back in batch F2's
own implementation notes (docs/29-PHASE-2A-TECHNICAL-PLAN.md §14):
"Automated, schema-validator-based conformance testing
(`validation/phase-2a-foundation/conformance.js`) remains an F5
deliverable, not built early." F2, F3, and F4 all used real but *ad
hoc* verification (checks written fresh each batch, run once, not
committed as a reusable tool) — this batch formalizes that into a
generic, reusable harness any future Foundation batch's new schema can
plug into.

## What this proves, and how

`conformance.js` (via `harness.js`) loads the real, unmodified
`apps-script/Foundation*.gs` + `PatientIdentity.gs` source into a mocked
Apps Script runtime — an in-memory `SpreadsheetApp`, a `PropertiesService`
backed by a plain object, and `Utilities` (`computeHmacSha256Signature`,
`base64EncodeWebSafe`/`base64DecodeWebSafe`, `newBlob`) backed by Node's
real `crypto` module and `Buffer` — a faithful mock of standard,
well-specified operations, not a guess. It then calls the real,
committed functions (`buildFoundationOkEnvelope_()`,
`foundationCreatePatient_()`, `foundationIssueSessionToken_()`,
`withFoundationAuth_()`, etc.) and checks their actual return values
against the real, committed `shared/*.schema.json` files using
`schema-validator.js` — a generic validator, not per-field hand-coded
assertions (that was F2/F3/F4's approach; see those batches' own
verification notes in `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §14).

Run it: `node conformance.js` (no dependencies beyond Node's standard
library — no `npm install` needed, matching every other validation tool
in this repo).

## `schema-validator.js`

A minimal, dependency-free JSON Schema validator supporting exactly the
subset of Draft 2020-12 this repository's `shared/*.schema.json` files
actually use: `type`, `required`, `properties`,
`additionalProperties` (boolean form only), `enum`, `const`, `format`
(`email`, `date-time`), `minLength`, and a top-level `oneOf`. It is
**not** a general-purpose validator — no `$ref`, no `patternProperties`,
no numeric bounds, no `if`/`then`/`else`, no array-item schemas beyond
what a future batch might add if a schema needs them. Extend it only
when a real `shared/` schema actually needs a construct it doesn't yet
support; it exists to check contracts this repo actually wrote, not to
anticipate every JSON Schema feature.

`conformance.js`'s own Stage 0 proves the validator itself against
deliberately-broken fixtures (a `oneOf` violation, a missing required
field, an `additionalProperties:false` violation, a wrong type, an
invalid `email` format, a value outside an `enum`) before trusting it to
grade anything else — the same "prove the tool before using it"
discipline `validation/phase-1-5/validate.js`'s own Stage 0 already
established for `apps-script/Tests.gs`.

## What this does not prove

Same category of limitation `validation/phase-1-5/README.md` already
states for its own harness: this runs against a mocked Apps Script
runtime, not a live deployment — it cannot catch a live Google API
behavior difference from the mock (e.g., some undocumented edge case in
real `Utilities.base64EncodeWebSafe`), a real `SESSION_SIGNING_SECRET`
provisioning problem, or anything that only manifests once
`FOUNDATION_CONFIG.PATIENT_SPREADSHEET_ID` points at a real, live
spreadsheet. It also only validates schemas that actually exist as
`shared/*.schema.json` contracts (`response-envelope`, `patient-identity`,
`session`, `login-token`) — a future batch's new `shared/` schema needs
its own new conformance stage added here, the same way this file's Stage
2/3/4/5 were each added for the schema the batch that introduced them
shipped. IA-2 (Stage 6) introduced no new `shared/` schema — its wire
shapes are ad hoc action responses, not new persisted entities (see this
file's own header comment).

## Result (last run)

61/61 conformance checks passed (23 from F1–F5, 15 added in IA-1 — 13 in
Stage 5 plus 2 in Stage 0 for the `used_at` sentinel — and 23 added in
IA-2's Stage 6) — see `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §14/§15 for
the full, batch-by-batch breakdown.
