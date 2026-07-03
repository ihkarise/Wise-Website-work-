# 36 - Identity & Access Closeout
## Identity & Access Backend (Batches IA-1–IA-2) — Version 1.0 — 2026-07-03

> Documentation-only record. No `apps-script/*.gs` file, no `shared/` contract, and no
> architecture document was modified to produce this closeout — it is a report on the
> already-shipped, already-merged Identity & Access backend, not a change to it.
> Governed by docs/00-PROJECT-GOVERNANCE.md's Documentation-First rule and ADR-007
> (documentation is part of the software). Mirrors the closeout discipline
> docs/35-FOUNDATION-CLOSEOUT.md already established for Foundation, and
> docs/27-PHASE-1.5-CLOSEOUT.md before that.

---

# 1. Objectives

Identity & Access is the milestone that turns Foundation's session/route-protection
primitives (docs/35) into an actual, working, patient-usable login mechanism — the
remaining, not-yet-built half of docs/29-PHASE-2A-TECHNICAL-PLAN.md's original §13
Batch 5B. Per explicit instruction, this milestone was split into two independent
batches:

1. **IA-1** — infrastructure only: token generation, hashing, expiration, single-use
   enforcement. No route, no UI, no session issuance.
2. **IA-2** — consumes IA-1's infrastructure: the magic-link request/consume flow,
   rate limiting, account-enumeration protection, and Foundation's first authenticated
   Web App route.

The objective of *this document* is narrower than either: close out the backend work
both batches delivered — record what exists, what was verified, what remains open —
before any patient-facing page is built against it (docs/29 §13 Batch 5B's frontend
half, §13 Batch 5C's dashboard shell, and beyond).

---

# 2. Scope Delivered

**In scope, delivered (IA-1 + IA-2):**
- `shared/schemas/login-token.schema.json` (v1.0.0) + `.md` — the `LoginTokens`
  contract.
- `apps-script/FoundationLoginTokens.gs` — token generation (three concatenated UUIDs,
  256+ bits of entropy), SHA-256 hashing (never the raw token stored), expiration and
  single-use enforcement, generic rejection (`FOUNDATION_LOGIN_TOKEN_INVALID`) for
  every failure mode.
- `apps-script/FoundationRateLimit.gs` — basic per-email rate limiting (3 requests /
  15 minutes), `CacheService`-backed.
- `apps-script/FoundationEmail.gs` — Foundation's own, independent `MailApp` sender
  for the login-link email.
- `apps-script/FoundationLoginFlow.gs` — the request-link and consume-link
  orchestration: email → patient lookup → rate limit → token issuance → email
  delivery (request); token consumption → session issuance (consume).
- `apps-script/FoundationRouter.gs` — the HTTP-level dispatcher and Foundation's first
  authenticated Web App route, `get_profile`.
- One narrowly-scoped, explicitly-approved addition to `apps-script/Code.gs` — a
  one-field dispatch check in `doPost()`, required because Google Apps Script permits
  exactly one `doPost()` per project (see §3 below for the full reasoning).
- Conformance and regression test coverage for all of the above (§7, §8).

**Not in scope, by design — still open, tracked for a future batch:**
- `login.html` / `verify.html` — the frontend pages a patient actually uses. These
  were part of docs/29 §13's original Batch 5B description but were deliberately
  deferred; IA-1 and IA-2 are backend-only (§12 addresses this directly).
- The "My Health Journey" dashboard shell (§13 Batch 5C) and every later Phase 2A data
  feature (`ConsultationHistory`, `SymptomLogs`, `Reports` — §13 Batches 5D–5F).
- `assets/site.css` design-token extraction, named in docs/29 §5 as folded into Batch
  5C, not this milestone.
- Operational provisioning: `FOUNDATION_CONFIG.PATIENT_SPREADSHEET_ID` and the
  `FOUNDATION_SESSION_SIGNING_SECRET` Script Property both remain unset placeholders —
  the same deferred-to-deployment treatment docs/28 already gave Phase 1.5's live
  values.
- A staff-facing patient-provisioning UI — `createFoundationPatient()` remains a
  manually-run editor wrapper (F3), not a form.

---

# 3. Architecture Summary

Identity & Access lives inside the same Apps Script project as Phase 1.5 and
Foundation, per docs/29 §14 Decision 1 — new, distinctly-named files, never modifying
any of the ten frozen Foundation-family files (docs/35 §2).

**A real architectural conflict was surfaced and resolved during IA-2, not designed
around in advance.** Google Apps Script permits exactly one global `doPost()` per
project — a hard platform constraint. Decision 1 also states Foundation work happens
by "adding new files... never modifying Phase 1.5's existing files." IA-2's
requirement for a real, callable Web App route put these two facts in direct tension:
no new, independently-routable HTTP entry point can exist without either touching
`Code.gs` or reverting Decision 1 to a separate Apps Script project. This was raised
explicitly rather than guessed through, and the narrowest resolution was chosen and
approved: `Code.gs`'s `doPost()` now checks for a `foundation_action` field
(present on every Foundation request, absent from every field Phase 1.5's own payload
defines — no collision) immediately after its JSON parse, before any Phase
1.5-specific parsing, sanitizing, or `STAFF_ACCESS_CODE` check runs. Present: the
entire request is handed to `FoundationRouter.gs`'s `handleFoundationRequest_()`,
whose response is returned unchanged. Absent: execution falls through to every line
below it, byte-for-byte unchanged from before IA-2 — proven, not just argued, by
`validation/phase-1-5/validate.js`'s Stage 9. Full reasoning:
`apps-script/README.md`'s "Foundation/Phase 1.5 dispatch boundary" section.

**Foundation's own, independent email sender.** `apps-script/Email.gs`'s header states
it is "the ONLY module in this project that may call a mail provider" — true for
Phase 1.5's own domain. `FoundationEmail.gs` is Foundation's equally-scoped
equivalent, the same domain-separation precedent `FoundationDataStore.gs` already set
against Phase 1.5's `Sheets.gs`. Zero modification to `Email.gs`.

**Layering, extending F5's diagram (docs/29 §14):**

```
Layer 2 (entities)        PatientIdentity.gs   FoundationSession.gs   FoundationLoginTokens.gs
                                 ^                    ^                       ^
Layer 3 (route/orchestration)  FoundationRouteGuard.gs   FoundationLoginFlow.gs
                                        ^                          ^
                            FoundationRateLimit.gs (leaf)   FoundationEmail.gs (leaf)
                                                   ^
Layer 4 (HTTP dispatch)                    FoundationRouter.gs
                                                   ^
Layer 5 (Phase 1.5's own entry point, one deliberate edge)   Code.gs
```

Full detail and the complete IA-1/IA-2 dependency maps: docs/29 §14/§15.

---

# 4. Authentication Flow

Backend-complete, end-to-end, against docs/29 §3's mechanics:

1. **Request** — patient submits an email; Apps Script looks up `Patients` by email
   (`foundationFindPatientByEmail_()`, reusing `FoundationDataStore.gs`'s existing
   `foundationDsQuery_()`), rate-limits, generates a 256+-bit token, stores only its
   SHA-256 hash, and emails the raw token as a link (`FoundationEmail.gs`). **The
   response is byte-identical whether or not the email matched a patient** —
   verified by direct equality assertion in conformance testing, not just written to
   match the intent.
2. **Consume** — the presented token is re-hashed, checked not-expired (~15 minutes)
   and not-already-used, marked used, and a session token is issued: an HMAC-signed
   `{patient_id, issued_at, expires_at}` payload (`FoundationSession.gs`, from
   Foundation/F4), self-verifying, no Sheet lookup needed on subsequent calls.
3. **Session use** — every authenticated route (so far: `get_profile`) re-verifies the
   HMAC signature and expiry and derives `patient_id` exclusively from the verified
   token, never from client-supplied input — confirmed by a conformance check that a
   spoofed `patient_id` field in the request body is silently ignored.
4. **Session lifetime** — 60 minutes (`FOUNDATION_CONFIG.SESSION_TTL_SECONDS`), no
   silent renewal.

**What is not complete:** the patient-facing half of this flow. `sessionStorage`
handling, the request-link form, and the page that receives `?token=` from the
emailed link and calls consume — `login.html`/`verify.html` — do not exist yet (§2,
§12). The backend contract is proven; the flow as a patient would actually experience
it is not yet buildable end-to-end because no page exists to drive it.

---

# 5. Security Model

Extending docs/15 §"Patient portal" and docs/29 §10's mapping, now real for the first
time:

| Requirement | Implementation |
|---|---|
| Authenticated access only | Every authenticated route derives `patient_id` solely from a verified HMAC session token (ADR-002) |
| Session expiration | 60 minutes, no silent renewal (ADR-010: the low end of docs/29 §3's 60–90 minute range) |
| Account-enumeration protection | Consume-side: every rejection reason collapses to one generic `FOUNDATION_LOGIN_TOKEN_INVALID` code (IA-1). Request-side: one identical generic response regardless of match (IA-2). The specific reason is recorded internally (`FoundationAudit.gs`) either way, never returned to the caller. |
| Rate limiting | Per-email, `CacheService`-backed, 3 requests / 15 minutes. Fails open on a `CacheService` error — a deliberate, documented ADR-010 exception: this is a supplementary mitigation, not the actual security boundary (single-use hashed tokens remain that, and do not depend on this layer). **Per-IP limiting is not implemented** — a real, verified Apps Script platform constraint: `doPost(e)` never exposes a caller's IP address on this runtime. Stated openly, not silently dropped. |
| Least privilege / secrets separation | `FOUNDATION_SESSION_SIGNING_SECRET` is a distinct Script Property from Phase 1.5's `STAFF_ACCESS_CODE`/`OPENROUTER_API_KEY` (ADR-009) |
| Audit logging | Every login-flow outcome logged to `FoundationAudit.gs`'s append-only `AuditLog`: token issuance/consumption/rejection (IA-1), link-requested/rate-limited/email-failed (IA-2), session rejection (F4) |
| No secrets in frontend | No signing secret or API key is ever returned in any response |
| Input validation | Every Foundation-layer request field (`email`, `token`, `session_token`) validated server-side before use |

**Risk not yet addressed by this milestone:** RBAC remains two entirely separate
mechanisms — the new session-based `patient` role and Phase 1.5's pre-existing,
unrelated `STAFF_ACCESS_CODE` gate. No unified authorization layer exists across both;
none was in scope for IA-1/IA-2 and docs/29 §3 does not call for one at this phase.

---

# 6. Shared Contracts

| File | Version | Delivered | Defines |
|---|---|---|---|
| `shared/contracts/response-envelope.schema.json` | 1.0.0 | Foundation F2 | The `{status, data, error}` shape every Foundation function returns |
| `shared/schemas/patient-identity.schema.json` | 1.0.0 | Foundation F3 | The Patient record |
| `shared/schemas/session.schema.json` | 1.0.0 | Foundation F4 | The Session payload and wire format |
| `shared/schemas/login-token.schema.json` | 1.0.0 | IA-1 | The `LoginTokens` record, including the first legitimately-empty-until-set field (`used_at`) |

**No new `shared/` contract was introduced in IA-2.** Its wire shapes (`{message}` for
request-link, `{session_token, patient_id}` for consume-link) are ad hoc action
responses, not new persisted entities — validated directly in conformance testing
against the schemas above rather than given schemas of their own, per
`shared/README.md`'s scope (contracts for entities and cross-cutting shapes, not every
individual action's response body).

**No shared contract is missing within Identity & Access's own scope.** Three
contracts remain missing for *later* Phase 2A entities — `ConsultationHistory`,
`SymptomLogs`, `Reports` (unchanged from docs/35 §8) — but those belong to future
batches (§13 5D–5F), not this milestone.

**One documentation-drift finding, not a contract gap:** docs/33-DOMAIN-MODEL.md still
marks Patient, Patient Identity, and Session as `*Planned*` under its own
maturity-status legend ("Planned = not yet built"). All three are now built, tested,
and conformance-verified — the labels are stale. Flagged here for a future
documentation pass; does not block anything (§10).

---

# 7. Validation Summary

`validation/phase-2a-foundation/conformance.js` — real output from real, committed
Identity & Access functions, checked against real, committed `shared/` contracts.
Re-run against the final merged state for this closeout:

**61/61 conformance checks passed** — 23 from Foundation F1–F5, 15 added in IA-1 (13
in Stage 5, 2 in Stage 0 for the `used_at` sentinel), and 23 added in IA-2's Stage 6:
rate-limit budget enforcement and per-email independence; malformed-input rejection;
byte-identical generic response across unmatched/matched/rate-limited request-link
outcomes; a real email actually sent (mocked `MailApp` spy) with the correct
recipient and a correctly-shaped link; the real raw token recovered from that emailed
link and consumed into a real session; single-use enforcement surviving through the
IA-2 wrapper; the full HTTP-level dispatch including an unknown-action rejection and
`get_profile`'s complete authenticated round trip (valid session resolves the
caller's own record; invalid session rejected without leaking data; a
client-supplied `patient_id` field is ignored in favor of the session-derived value).

---

# 8. Regression Summary

`validation/phase-1-5/validate.js` — proves Phase 1.5's staff-only consultation-summary
pipeline is unaffected by anything Identity & Access added. Re-run against the final
merged state for this closeout:

**42/42 checks passed** — 39 carried from Phase 1.5/Foundation, plus 3 added in IA-2's
Stage 9, which drives the real `doPost()` through both branches of the new dispatch
shim: a `foundation_action` payload reaches a stubbed router before touching the
Sheet, the access-code gate, or the execution log; a normal Phase 1.5 payload still
writes exactly one row, exactly as before this milestone. **Zero regression to Phase
1.5 across both IA batches.**

---

# 9. Static Analysis Summary

`validation/static-analysis/analyze.js` — duplicate global names, duplicate
constants, duplicate function names, unused exported helpers, circular dependencies,
Apps Script namespace collisions, across all 29 `apps-script/*.gs` files. Re-run
against the final merged state for this closeout:

- **0** duplicate global names / namespace collisions
- **0** circular dependencies
- **0** unused exported helpers — the cleanest result of any batch to date.

**All six of Foundation's previously-Deferred findings (docs/35 §6) now have real
consumers, introduced across IA-1/IA-2:**

| Finding | Resolved by |
|---|---|
| `escapeFoundationHtml_` | `FoundationEmail.gs`'s login-link HTML template |
| `foundationDsQuery_` | `FoundationLoginFlow.gs`'s email lookup |
| `foundationGetPatientById_` | `get_profile` (`FoundationRouter.gs`) |
| `foundationIssueSessionToken_` | Consume-link (`FoundationLoginFlow.gs`) |
| `withFoundationAuth_` | `get_profile` (`FoundationRouter.gs`) |
| `foundationConsumeLoginToken_` | Consume-link (`FoundationLoginFlow.gs`) |

**Zero findings remain — Error, Warning, Intentional, or Deferred.**

---

# 10. Deferred Work

Named explicitly, never silently expanded into:

- **`login.html` / `verify.html`** — the patient-facing pages that actually drive the
  request/consume flow. Recommended as the first Patient Access batch (§12).
- **The "My Health Journey" dashboard shell** and `assets/site.css` token extraction
  (docs/29 §13 Batch 5C) — depends on the above existing first.
- **Every later Phase 2A data entity** — `ConsultationHistory`, `SymptomLogs`,
  `Reports` (§13 Batches 5D–5F) — none has a `shared/` schema or Apps Script
  implementation yet.
- **Per-IP rate limiting** — not implementable on this platform (§5); per-email
  limiting is the accepted, working mitigation.
- **Operational provisioning** — `PATIENT_SPREADSHEET_ID` and
  `FOUNDATION_SESSION_SIGNING_SECRET` remain unset placeholders, an operational step
  outside this repository (same treatment docs/28 gave Phase 1.5).
- **A staff-facing patient-provisioning UI** — `createFoundationPatient()` remains a
  manually-run editor wrapper.
- **docs/33's stale maturity-status labels** (§6) — a documentation-only fix, not
  code, not urgent.
- **docs/12-DATA-ARCHITECTURE.md's stale Phase 2A section** — a pre-existing gap
  tracked separately under docs/32-ARCHITECTURE-REVIEW.md, not introduced or
  worsened by Identity & Access. Still open.
- **Unified RBAC** across the new patient-session mechanism and Phase 1.5's
  pre-existing `STAFF_ACCESS_CODE` gate — not called for at this phase (§5).

---

# 11. Lessons Learned

- **A real platform constraint (Apps Script's single `doPost()` per project) was
  discovered mid-implementation, not anticipated in the original technical plan.**
  Surfacing it explicitly and getting an approved resolution — rather than silently
  picking one of the two paths, or forcing the plan's original "separate Apps Script
  project" language back into effect — kept the decision auditable and reversible.
  This is the same discipline this repository's engineering workflow already expects
  (docs/00: "stop and explain a conflict instead of guessing"), now proven at the
  level of a genuine, previously-unforeseen architectural collision, not just a
  documentation disagreement.
- **A second real platform constraint (no caller IP in `doPost(e)`) was found the same
  way** — verified against the platform's actual contract rather than assumed, and
  the plan's "per-email/per-IP" requirement was scoped down to what's actually
  achievable, stated openly in the same commit rather than discovered later by
  someone trying to implement the missing half.
- **Reusing Foundation's already-generic operations paid off exactly as designed.**
  `foundationDsQuery_()` and `foundationGetPatientById_()` — both built in F3 with no
  consumer yet — needed zero modification to become IA-2's email-lookup and
  profile-lookup mechanisms. This is ADR-009's "every component independently
  replaceable, built ahead of its consumer" principle working as intended, not
  theoretically.
- **The domain-separation precedent (`FoundationDataStore.gs` vs. `Sheets.gs`)
  generalized cleanly to a second cross-cutting concern (email).** Once one
  Foundation-owned parallel to a Phase-1.5-owned infrastructure module existed, the
  same reasoning applied directly to `FoundationEmail.gs` vs. `Email.gs` without
  needing a new architectural decision — a sign the original precedent was framed at
  the right level of generality.
- **Static analysis's "Deferred, not a problem" convention (docs/35 §9) proved its
  value at closeout.** All six findings carried since F3/F4/IA-1 resolved themselves
  naturally as real consumers arrived in the batches that were always going to supply
  them — none needed an artificial call-site invented to satisfy the tool.

---

# 12. Readiness for Patient Access

**Identity & Access backend infrastructure is frozen except for bug fixes**, effective
with this closeout — the five files IA-1/IA-2 delivered
(`FoundationLoginTokens.gs`, `FoundationRateLimit.gs`, `FoundationEmail.gs`,
`FoundationLoginFlow.gs`, `FoundationRouter.gs`) plus the one-line `Code.gs` dispatch
shim join the ten Foundation-family files (docs/35 §9) as stable, tested
infrastructure. Future capability is delivered by **adding** new files — never by
reopening or restructuring these six — with one plausible, narrowly-scoped exception
named in advance: `FoundationEmail.gs`'s `FOUNDATION_VERIFY_URL_BASE_` placeholder may
need updating to a real path once `verify.html` actually exists, if that path differs
from `/my-health-journey/verify.html`.

**Freezing the backend is not the same as closing the milestone.** Identity & Access
as a product capability — a patient actually receiving and using a login link — is not
done, because no page exists yet to drive the backend that was just frozen. That is
expected, not a gap: `login.html`/`verify.html` were always the deferred frontend half
of docs/29 §13's original Batch 5B.

**Recommended first Patient Access implementation batch: complete Batch 5B's frontend
half — `login.html` + `verify.html` — before Batch 5C's dashboard shell.** Directly
from the approved plan's own sequencing logic (docs/29 §13: "foundation → auth →
shell → ..."): 5C's dashboard is explicitly described as "wired to 5B's session,"
which cannot happen until a patient can obtain one. Both pages are static
HTML/CSS/JS (docs/10, unchanged), deployed unlisted/noindexed, not linked from nav yet
— the same low-risk, reversible framing §13 already gives this batch. No backend
change should be required; `login.html` submits `{foundation_action:
'request_login_link', email}`, and `verify.html` reads `?token=` from the URL,
submits `{foundation_action: 'consume_login_link', token}`, and stores the returned
`session_token` in `sessionStorage` — every field name already matches what
`FoundationRouter.gs` accepts today.

### Entry Criteria for Patient Access — already satisfied by this closeout

- [x] IA-1 and IA-2 merged to `main` (PRs #27, #28).
- [x] Static analysis clean of every finding — 0 Error/Warning/Intentional/Deferred.
- [x] Conformance harness passing (61/61) against real, committed `shared/` contracts.
- [x] Zero regression to Phase 1.5 (42/42).
- [x] Dependency graph acyclic, re-verified fresh against the merged state.
- [x] Every Identity & Access module's consumer relationships documented (docs/29
      §14/§15's dependency maps, §3 above).

### Still open, expected to be closed by Patient Access work, not by this document

- [ ] `login.html` / `verify.html`.
- [ ] `assets/site.css` token extraction and the dashboard shell (Batch 5C).
- [ ] Real values for `PATIENT_SPREADSHEET_ID` and `FOUNDATION_SESSION_SIGNING_SECRET`
      (operational, required before any live pilot — not a code blocker).
- [ ] docs/33's stale `*Planned*` labels for Patient/Patient Identity/Session
      (documentation-only).

---

# Relationship to Other Documents

- docs/29-PHASE-2A-TECHNICAL-PLAN.md §14/§15 remains the authoritative, batch-by-batch
  implementation record — this document summarizes and closes it out; where they ever
  appear to disagree, §14/§15's per-batch detail is authoritative.
- docs/35-FOUNDATION-CLOSEOUT.md is the precedent this document's structure follows,
  and remains the closeout of record for Foundation (F1–F5) specifically.
- docs/24-ROADMAP.md tracks Identity & Access's completion at the roadmap level.
