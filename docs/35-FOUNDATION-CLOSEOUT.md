# 35 - Foundation Closeout
## Phase 2A Foundation (Batches F1–F5) — Version 1.0 — 2026-07-03

> Documentation-only record. No `apps-script/*.gs` file, no `shared/` contract, and no
> architecture document was modified to produce this closeout — it is a report on the
> already-shipped, already-merged Foundation, not a change to it. Governed by
> docs/00-PROJECT-GOVERNANCE.md's Documentation-First rule and ADR-007 (documentation
> is part of the software). Mirrors the closeout discipline docs/27-PHASE-1.5-CLOSEOUT.md
> already established for Phase 1.5.

---

# 1. Foundation Scope

Foundation is the infrastructure layer Phase 2A's patient-facing features are built on
— not Phase 2A itself. Per docs/29-PHASE-2A-TECHNICAL-PLAN.md §14, a dedicated planning
pass produced a **Foundation Implementation Plan** (batches F1–F5), distinct from and
superseding §13's original batch table (5A–5H) for the scope it covers, and locked two
decisions ahead of any code: Foundation lives inside the existing `apps-script/` project
as new, `Foundation`-prefixed files rather than a separate deployment (least privilege
kept at the data layer instead — a separate Patients spreadsheet, distinct Script
Property keys); and a repository-level `shared/` directory holds canonical,
machine-readable contracts and schemas that implementations conform to, never extend
independently.

**In scope, delivered:** project scaffolding; the shared-contract mechanism itself; the
response envelope every Foundation function returns; core utility helpers (ID
generation, timestamps, HTML escaping); the Patient Identity data entity end to end
(schema, data-access layer, audit logging, create/read); session token issuance and
verification (HMAC-signed, ADR-002/ADR-003/ADR-010); route protection deriving
`patient_id` only from a verified session; and a reusable, schema-validator-based
conformance-testing harness proving all of the above against its own contracts.

**Not in scope, by design:** any patient-facing UI, any Web App HTTP route, the
magic-link login flow itself (`LoginTokens`, request/consume), and every other Phase 2A
data entity (`ConsultationHistory`, `SymptomLogs`, `Reports`) — see §7.

---

# 2. Delivered Modules

All ten Foundation-family `apps-script/*.gs` files, by batch:

| File | Delivered | Responsibility |
|---|---|---|
| `FoundationConfig.gs` | F1, extended F4 | Environment-specific values: `PATIENT_SPREADSHEET_ID`, Script Property key names, `SESSION_TTL_SECONDS`. |
| `FoundationUtils.gs` | F2 | `generateFoundationId_()`, `foundationNowIso_()`, `escapeFoundationHtml_()` — adapted from `shared/utils/core.reference.js`. |
| `FoundationContracts.gs` | F2 | `buildFoundationOkEnvelope_()` / `buildFoundationErrorEnvelope_()` — the response envelope every Foundation function returns. |
| `FoundationErrorHandling.gs` | F2 | `withFoundationErrorHandling_()` — guarantees the envelope shape even on a thrown exception. |
| `FoundationDataStore.gs` | F3 | The only Foundation file calling `SpreadsheetApp` for Patient-domain data — insert/getById/updateById/query. |
| `FoundationAudit.gs` | F3 | `foundationLogAuditEvent_()` — append-only cross-cutting event log. |
| `PatientIdentity.gs` | F3 | `foundationCreatePatient_()` / `foundationGetPatientById_()`, implementing `shared/schemas/patient-identity.schema.json`. |
| `FoundationSession.gs` | F4 | `foundationIssueSessionToken_()` / `foundationVerifySessionToken_()`, implementing `shared/schemas/session.schema.json`. |
| `FoundationRouteGuard.gs` | F4 | `withFoundationAuth_()` — gates a handler behind a verified session. |
| `FoundationTests.gs` | F3, extended F4 | Apps Script-native unit tests for every pure Foundation function. |

Plus Node-only test tooling (not part of the Apps Script project):
`validation/static-analysis/analyze.js` (F3), `validation/phase-2a-foundation/{harness.js,
schema-validator.js, conformance.js}` (F5).

---

# 3. Delivered Shared Contracts

`shared/` (docs/29 §14's second Foundation decision — the canonical, machine-readable
source every implementation conforms to, per `shared/README.md`'s rule):

| File | Version | Delivered | Defines |
|---|---|---|---|
| `shared/contracts/response-envelope.schema.json` | 1.0.0 | F2 | The `{status, data, error}` shape every Foundation function returns. |
| `shared/schemas/patient-identity.schema.json` | 1.0.0 | F3 | The Patient record — identity core + profile, docs/33 §1.1/§1.2. |
| `shared/schemas/session.schema.json` | 1.0.0 | F4 | The Session payload (`patient_id`, `issued_at`, `expires_at`) and wire format, docs/33 §1.3. |
| `shared/utils/core.reference.js` | 1.0.0 | F2 | Portable reference algorithms: `generateId()`, `nowIso()`, `escapeHtml()`. |

Every one of the three JSON schemas above has a companion `.md` explaining rationale
and usage, per `shared/README.md`'s format rule. `shared/constants/` remains empty and
reserved — no Foundation batch needed it. F3 was the last batch eligible for
`shared/README.md`'s create-together bootstrap exception (patient-identity); F4's
session contract was committed in its own commit, ahead of its implementation, under
the normal rule.

---

# 4. Validation Summary

`validation/phase-2a-foundation/conformance.js` (introduced F5) — a generic,
dependency-free JSON Schema validator checking real output from real, committed
Foundation functions against the real, committed `shared/` contracts. Re-run against
the final merged state for this closeout:

**23/23 conformance checks passed** — validator self-check (7, against
deliberately-broken fixtures), `buildFoundationOkEnvelope_()`/`buildFoundationErrorEnvelope_()`
output (3), `foundationCreatePatient_()`/`foundationGetPatientById_()` output including
the `FOUNDATION_NOT_FOUND` path (5), a real `foundationIssueSessionToken_()` →
`foundationVerifySessionToken_()` round trip (3), and `withFoundationAuth_()`'s success
and rejection paths including the audit-log side effect (5).

---

# 5. Regression Summary

`validation/phase-1-5/validate.js` — proves Phase 1.5's staff-only consultation-summary
pipeline is unaffected by anything Foundation added, re-run after every batch since F1.
Re-run against the final merged state for this closeout:

**39/39 checks passed.** Zero regression to Phase 1.5 across all five Foundation
batches — no pre-existing `apps-script/*.gs` file was ever modified, confirmed by
`git diff` at every batch and again for this closeout.

---

# 6. Static-Analysis Summary

`validation/static-analysis/analyze.js` (introduced F3, runs before validation on every
batch from F3 onward) — checks duplicate global names, duplicate constants, duplicate
function names, unused exported helpers, circular dependencies, and Apps Script
namespace collisions across all 24 `apps-script/*.gs` files (Phase 1.5's and
Foundation's, sharing one project namespace per docs/29 §14 Decision 1). Re-run against
the final merged state for this closeout:

- **0** duplicate global names / namespace collisions
- **0** circular dependencies
- **6** unused exported helpers — all classified **Deferred**, none Error, none
  Warning, none Intentional:

| Finding | File | Awaiting |
|---|---|---|
| `escapeFoundationHtml_` | `FoundationUtils.gs` | An HTML-rendering consumer (none yet) |
| `foundationDsQuery_` | `FoundationDataStore.gs` | A consumer needing the query operation |
| `foundationDsUpdateById_` | `FoundationDataStore.gs` | A consumer needing in-place updates |
| `foundationGetPatientById_` | `PatientIdentity.gs` | A real lookup consumer (e.g. a login flow) |
| `foundationIssueSessionToken_` | `FoundationSession.gs` | The `LoginTokens` magic-link consume flow |
| `withFoundationAuth_` | `FoundationRouteGuard.gs` | A real, protected Web App route |

Every finding is real infrastructure built ahead of its declared consumer, not a bug —
none was resolved by inventing an artificial call-site, per this repo's standing rule.

---

# 7. Dependency Summary

Full detail and the layered diagram: docs/29-PHASE-2A-TECHNICAL-PLAN.md §14, "Foundation
Dependency Map" (produced F5, re-verified for this closeout). Summary:

- **10** Foundation-family files, all with verified, real call-graph dependencies
  (plus one hand-checked `FOUNDATION_CONFIG` variable-read edge the automated
  function-call scanner cannot detect: `FoundationSession.gs` and
  `FoundationDataStore.gs` both read it).
- **Circular dependencies: zero**, confirmed two independent ways (project-wide scan,
  Foundation-family-restricted scan), re-confirmed again for this closeout.
- **Direction: strictly layered, one-way, no back-references** — infra
  (`FoundationConfig`/`Utils`/`Contracts`/`DataStore`) ← cross-cutting
  (`ErrorHandling`/`Audit`) ← entities (`PatientIdentity`/`Session`) ← route guard
  (`FoundationRouteGuard`) ← tests (`FoundationTests`, depends on everything below,
  nothing depends on it).
- **Zero edges in either direction** between the Foundation family and any Phase 1.5
  file — Foundation never calls into Phase 1.5, and no Phase 1.5 file has ever been
  modified to reference anything Foundation-prefixed.

---

# 8. What's Intentionally Excluded

Named explicitly, batch by batch, never silently expanded into:

- **`LoginTokens`** — the sheet and the magic-link request/consume flow that resolves
  a patient's email to a `patient_id` in the first place. `foundationIssueSessionToken_()`
  takes an already-resolved `patient_id` specifically so it doesn't assume a particular
  upstream login mechanism (`shared/schemas/session.md`).
- **Any Web App route (`doPost`)** — `foundationCreatePatient_()` and
  `withFoundationAuth_()` are both real, tested, and currently reachable only from the
  Apps Script editor or this repo's test harnesses, not a live HTTP endpoint.
- **Rate limiting** on any future public login-link-request endpoint (docs/29 §10's
  "New consideration Phase 1.5 didn't have").
- **Every other Phase 2A data entity** — `ConsultationHistory`, `SymptomLogs`,
  `Reports` — none has a `shared/` schema or an Apps Script implementation yet.
- **Any patient-facing UI** — dashboard shell, timeline, symptom log form, report
  upload widget — none exists yet.
- **Operational deployment** — `FOUNDATION_CONFIG.PATIENT_SPREADSHEET_ID` and the
  `FOUNDATION_SESSION_SIGNING_SECRET` Script Property both remain placeholders/unset.
  Provisioning them is an operational step outside this repository, the same
  distinction docs/28-DEPLOYMENT-READINESS.md drew for Phase 1.5's live deployment.
- **`shared/constants/`** — remains empty; no Foundation batch needed a shared
  constant (the condition-slug allowlist duplication flagged in
  `shared/schemas/patient-identity.md` is the leading future candidate, not acted on).

---

# 9. Foundation Freeze Statement

**Foundation (F1–F5) is complete and is now frozen, except for bug fixes.**

All ten Foundation-family `apps-script/*.gs` files, and all three `shared/` JSON
schemas they implement, are considered stable, load-bearing infrastructure. Per
ADR-009 (every module independently replaceable) and `shared/README.md`'s
"implementations conform to `shared/`, never extend or modify a contract
independently" rule:

- Future capability (the `LoginTokens` flow, a real Web App route, RBAC extensions,
  any new Phase 2A data entity) is delivered by **adding** new files and, where a
  contract genuinely needs to change, a **new schema version** — never by reopening
  or restructuring the ten files listed in §2.
- A genuine defect in a frozen file gets a narrowly-scoped bug-fix commit against that
  specific file, not a redesign, and not folded into an unrelated feature batch.
- The six Deferred static-analysis findings (§6) are not freeze violations — each is
  real infrastructure correctly awaiting a consumer that a future batch supplies by
  calling it, not by modifying it.

---

# 10. Entry Criteria for the Next Implementation Phase

Before Identity & Access implementation (or any other Phase 2A batch) begins, the
following are already satisfied by this closeout:

- [x] All F1–F5 batches merged to `main` (PRs #21–#25).
- [x] Static analysis clean of Error/Warning findings (0 of each; 6 Deferred, all
  triaged and documented).
- [x] Conformance harness passing (23/23) against real, committed `shared/` contracts.
- [x] Zero regression to Phase 1.5 (39/39).
- [x] Dependency graph acyclic, verified two independent ways.
- [x] Every Foundation module's consumer relationships documented (§2, §6, and
  docs/29 §14's Dependency Map).

Still open, and expected to be closed by the next batch(es), not by this document:

- [ ] `LoginTokens` schema + magic-link request/consume flow.
- [ ] A real Web App `doPost` route wiring `foundationIssueSessionToken_()`/
  `withFoundationAuth_()` to a live, callable endpoint.
- [ ] Rate limiting on the (future) public login-link-request endpoint.
- [ ] Real values for `PATIENT_SPREADSHEET_ID` and `FOUNDATION_SESSION_SIGNING_SECRET`
  (operational, required before any live pilot — not a code blocker).

---

# Relationship to Other Documents

- docs/29-PHASE-2A-TECHNICAL-PLAN.md §14 remains the authoritative, batch-by-batch
  implementation record — this document summarizes and closes it out; where they
  ever appear to disagree, §14's per-batch detail is authoritative.
- docs/24-ROADMAP.md tracks Foundation's F1–F5 completion at the roadmap level.
- docs/27-PHASE-1.5-CLOSEOUT.md is the precedent this document's structure follows.
