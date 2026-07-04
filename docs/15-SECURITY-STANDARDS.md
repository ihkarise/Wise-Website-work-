# Security Standards
## Version 2.1

Governed by ADR-002 (identity independent of authentication), ADR-003 (passwordless
by default), and ADR-010 (security decisions take precedence over convenience) —
docs/31-ADR-INDEX.md. Where this document and those ADRs disagree, the ADR is
authoritative.

## Goals
Protect patient trust and data.

## Standards
- HTTPS everywhere
- Least privilege
- Secure Apps Script endpoints
- Input validation
- No secrets in frontend
- Environment separation
- Audit logging
- Regular dependency review

Patient portal:
- Authenticated access only
- Session expiration
- Role-based permissions

Concrete Phase 2A implementation of the three requirements above: docs/29 §10 (design)
and §14/§15 (batch-by-batch implementation notes). Identity & Access (IA-1, IA-2) is the
first real implementation — summary below.

## Phase 2A — Implementation Notes (Identity & Access)

Full batch-by-batch detail is docs/29 §14 (Foundation, F1–F5) and §15 (Identity &
Access, IA-1/IA-2) — not duplicated here. Summary against the three "Patient portal"
requirements above, now real for the first time:

- **Authenticated access only.** Every authenticated route (so far: `get_profile`,
  IA-2) derives `patient_id` exclusively from a verified, HMAC-signed session token
  (`FoundationSession.gs`, F4) — never from client-supplied input (ADR-002). Verified,
  not just designed: `validation/phase-2a-foundation/conformance.js`'s Stage 6f confirms
  a client-supplied `patient_id` field is silently ignored in favor of the
  session-derived value.
- **Session expiration.** 60 minutes (`FOUNDATION_CONFIG.SESSION_TTL_SECONDS`), no
  silent renewal — the low end of §3's 60–90 minute range, per ADR-010.
- **Role-based permissions.** One role exists so far: `patient`, self-scoped only. No
  `staff` route has been built on this same session mechanism yet — Phase 1.5's
  existing `STAFF_ACCESS_CODE` gate (below) remains entirely separate infrastructure.
- **Account-enumeration protection (docs/29 §3/§10, ADR-010).** Both halves of the
  login flow now return a generic response regardless of whether an account exists:
  the consume-link step collapses every rejection reason (unknown token, expired,
  already used) into one `FOUNDATION_LOGIN_TOKEN_INVALID` code (IA-1); the request-link
  step returns the exact same ok-envelope message whether the requested email is
  unmatched, matched, or rate-limited (IA-2). The specific reason is still recorded in
  `FoundationAudit.gs` either way — an internal, staff-visible signal only, never
  returned to the caller.
- **Rate limiting (docs/29 §10's "New consideration Phase 1.5 didn't have").**
  Per-email, `CacheService`-backed, 3 requests / 15 minutes (`FoundationRateLimit.gs`,
  IA-2). **Per-IP limiting is not implemented** — a real Apps Script platform
  constraint: `doPost(e)` never exposes a caller's IP address to this runtime, stated
  openly rather than silently dropped (`apps-script/README.md`'s `FoundationRateLimit.gs`
  entry has the full reasoning).
- **Secrets separation (least privilege, ADR-009).** `FOUNDATION_SESSION_SIGNING_SECRET`
  is a distinct Script Property from Phase 1.5's `STAFF_ACCESS_CODE`/`OPENROUTER_API_KEY`
  — a leaked or rotated Foundation secret never touches Phase 1.5's, and vice versa.
- **Audit logging.** Every login-flow outcome is logged to `FoundationAudit.gs`'s
  append-only `AuditLog` sheet: token issuance/consumption/rejection (IA-1),
  link-requested/rate-limited/email-failed (IA-2), session rejection (F4) — the same
  "every pipeline stage logged" discipline docs/25 §5.1 already established for Phase
  1.5, applied to the patient-authentication domain for the first time.
- **Least privilege at the deployment boundary (docs/29 §14 Decision 1).** Foundation's
  Web App route shares Phase 1.5's single Apps Script project and its one `doPost()` —
  a real, hard platform constraint (Apps Script permits exactly one `doPost` per
  project), not a design preference. IA-2 resolved this with the smallest possible,
  explicitly-approved exception: a one-field dispatch check at the very top of
  `Code.gs`'s `doPost()`, proven additive-only by `validation/phase-1-5/validate.js`'s
  Stage 9. Full reasoning: `apps-script/README.md`'s "Foundation/Phase 1.5 dispatch
  boundary."
- **No secrets in frontend / input validation** — unchanged from the general standards
  above; every Foundation-layer request field (`email`, `token`, `session_token`) is
  validated server-side before use, and no signing secret or API key is ever returned
  in a response.

### Security review of the magic-link/session-token mechanism (PA-7 closeout, 2026-07-04)

Closes the dedicated review docs/29 §11 item 2, docs/32 Part 3, and docs/34 both
required before this mechanism could be considered done, tracked as still-pending
through the Identity & Access closeout (docs/36) and never actually performed until
now. Manual code review of `FoundationLoginTokens.gs`, `FoundationSession.gs`,
`FoundationLoginFlow.gs`, `FoundationRateLimit.gs`, `FoundationRouteGuard.gs`, and the
`login.html`/`verify.html` frontend, cross-checked against `validation/phase-1-5/`'s
and `validation/phase-2a-foundation/`'s existing auth-specific conformance checks.

**No vulnerabilities found.** Specifically verified: login tokens are ~384-bit entropy
(three concatenated UUIDv4s), only their SHA-256 hash is ever persisted, single-use is
enforced via a checked `used_at` sentinel before any read of the record succeeds,
expiry fails closed on an unparsable date; session tokens are HMAC-SHA256 signed with
a signature comparison done in constant time (`foundationConstantTimeEquals_()`), fail
closed if the signing secret is unprovisioned, and never silently renew; both the
login-link-request and login-link-consume responses are generic/anti-enumerating
independent of whether an account exists (only the audit log, staff-visible only,
records the real reason); `verify.html` strips the token from the visible
URL/browser history via `history.replaceState()` immediately on read and requires an
explicit user click before spending it — mitigating email-scanner link-prefetch
consuming a single-use token before the real recipient does (the risk docs/29 line
~1175 names); the resulting session token is stored only in `sessionStorage`, never
`localStorage`. This matches, rather than merely restates, the extensive
auth-specific coverage already in `validation/phase-1-5/validate.js` and
`validation/phase-2a-foundation/conformance.js` (session rejection, cross-patient
isolation, anti-enumeration, audit logging).

## Phase 2A — Implementation Notes (Batch PA-3, Consultation History)

A new authorization shape, beyond what IA-2's `get_profile` needed: **record-ownership
verification for a client-supplied identifier.** Every route through Batch PA-3
(`get_timeline`, `get_timeline_entry`) still derives `patient_id` exclusively from the
verified session (ADR-002, unchanged) — but `get_timeline_entry` additionally accepts a
client-supplied `record_id`, the first time any Foundation route has taken one. Session
verification alone is necessary but not sufficient here:
`foundationGetConsultationEntryById_()` (`FoundationConsultationHistory.gs`)
independently checks that the fetched row's own `patient_id` equals the session-derived
`patient_id` before returning it — "unguessable" (the `record_id` is a random UUID) and
"authorized" are two separate properties, and only the session-derived ownership check
is the real boundary (see docs/40-CONSULTATION-IDENTITY-STRATEGY.md Q3 for the full
reasoning). An unknown `record_id` and a `record_id` belonging to a different patient
return the identical `FOUNDATION_NOT_FOUND` envelope — the same anti-enumeration
discipline already applied to login tokens and session rejection, extended to this new
case: a caller can never distinguish "not yours" from "doesn't exist." Verified, not
just designed: `validation/phase-2a-foundation/conformance.js`'s Stage 7 confirms both
the direct-function check and the same rejection through the real HTTP dispatch layer,
including that a spoofed `patient_id` field in the request body is still ignored.

## Phase 2A — Implementation Notes (Batch PA-4, Symptom Log)

The platform's first patient-*writable* route — every prior Foundation-family write
(Patient, LoginToken, ConsultationHistory) was staff- or system-authored, not
patient-authored. `log_symptom` still derives `patient_id` exclusively from the
verified session (ADR-002, unchanged) — the same authorization primitive `get_profile`
and `get_timeline` already use, applied here to a write instead of a read for the first
time. No new authorization *shape* was needed (unlike PA-3's record-ownership check
above) — `log_symptom` and `get_symptom_logs` both act only on the caller's own
session-derived `patient_id`, never a client-supplied identifier, so there is no
second patient's record a request could even name. Verified, not just designed:
`validation/phase-2a-foundation/conformance.js`'s Stage 8 confirms cross-patient
isolation on both the create and list paths at the real HTTP-dispatch layer, and that
a spoofed `patient_id` field in the request body is silently ignored in favor of the
session-derived value.

**Input validation, applied to this batch's four new writable fields.** `severity`,
`sleep`, `energy`, and `stress` are validated server-side as in-range (1-10) integers
regardless of client-side `<input type="number">` constraints — a non-integer,
out-of-range, or missing value is rejected with `FOUNDATION_INVALID_INPUT` before any
row is written. `notes` is escaped at display time (never trusted as markup); a
`<script>`-tag fixture in `validation/pa-4-symptom-tracker/browser-test.js` confirms it
is stored raw and only ever rendered as escaped text. `condition_slug`, when provided,
is validated against `shared/constants/condition-slugs.json`'s canonical list — the
first `SymptomLogs` field validated this way, closing a documented gap
(`shared/schemas/patient-identity.md`) `Patients.condition_slug` still has (out of this
batch's scope to fix, since Foundation's ten files remain frozen).

**Audit logging.** Every `foundationCreateSymptomLog_()` call — direct and via the
real HTTP dispatch — writes its own `symptom_log_created` `AuditLog` row, the same
"every write logged" discipline every other Foundation entity already follows.

## Phase 2A — Implementation Notes (Batch PA-5, Report Upload)

The platform's highest-risk feature (docs/29 §8/§11) — the first arbitrary
file-handling surface. Preceded by a dedicated pre-implementation review
(docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md) that resolved several open architecture
questions by explicit approval before any code was written.

**Authorization always begins with the application; Drive permissions are
defense-in-depth only, never the boundary.** `upload_report` derives `patient_id` (and
`uploaded_by`) exclusively from the verified session (ADR-002, unchanged) — the same
primitive `log_symptom` already established for a write. `download_report` is this
batch's own new authorization shape, beyond what PA-3's `get_timeline_entry` needed:
`foundationGetReportById_()` verifies the requested `record_id`'s own `patient_id`
matches the session-derived one *before* `foundationDownloadReport_()` ever calls
`DriveApp` — the ownership check happens first. `download_report` never hands the
browser a Drive URL; the server fetches bytes inside its own already-authorized
execution and returns them base64-encoded.

**Drive sharing is explicitly enforced, not assumed (docs/42 §6: "the single most
important property to design for and test explicitly in this batch").** Every file the
patient-upload path creates has `foundationEnsureReportFilePrivate_()` called
immediately after `DriveApp.createFile()`, explicitly setting
`DriveApp.Access.PRIVATE`/`DriveApp.Permission.NONE` — never left at an unverified
default. Verified, not just designed: `validation/phase-2a-foundation/conformance.js`'s
Stage 9 directly asserts the created file's sharing access and permission, distinct
from merely asserting the file exists.

**A partial-write failure (Drive succeeds, Sheets fails) is handled, not silently
possible.** The platform's first entity whose lifecycle spans two independent storage
systems (docs/42 §1). `foundationCreateReport_()` writes Drive first, then Sheets; if
the Sheets write then fails, it rolls back by trashing the just-created Drive file
(`setTrashed(true)`) and audit-logs the rollback (`report_upload_rolled_back`) before
returning the standard generic error envelope. If the rollback attempt itself fails,
the file is left as an accepted, explicitly audit-logged orphan
(`report_upload_orphaned_file`) rather than silently disappearing from any record.
Stage 9 forces this failure (a deliberately corrupted Sheets header, the same
"mock the platform, run the real logic" technique this harness already uses) and
asserts both the rollback and its audit trail.

**MIME validation — three layers, one disclosed limitation, per the approved
architecture decision to use every mechanism realistically available and never imply
stronger validation than actually exists.** The filename extension and the
client-declared `mime_type` are both checked (`foundationValidateReportUploadInput_()`)
but neither is trusted alone — both are spoofable, and are checked only to fail fast
before any bytes are decoded. The authoritative check is server-side and content-based:
`Utilities.newBlob(bytes).getContentType()`, whose documented behavior sniffs the actual
byte structure. Stage 9 proves this is a *real, independent* check, not just named in a
comment — a fixture whose real bytes are plain text is rejected even though its filename
extension and declared `mime_type` both claim `application/pdf`. **A genuinely open
item, disclosed rather than silently resolved:** docs/42 §11 names the exact behavior of
`Utilities.newBlob()`'s detection for PDF/JPG/PNG as unverified against a live Apps
Script deployment; that live verification has not been performed in this environment
(`shared/constants/upload-limits.md` records this explicitly). Separately, this remains
a byte-signature heuristic, not a parser or a malware/virus scanner — no scanning
capability exists anywhere in this stack, the same accepted risk docs/29 §8 already
names.

**Size validation, enforced against real decoded bytes.** `FOUNDATION_REPORT_MAX_UPLOAD_BYTES_`
(5 MB, ported from the canonical `shared/constants/upload-limits.json`, never hardcoded
independently) is checked against `Utilities.base64Decode()`'s actual output length —
never a client-reported file size. Stage 9 proves a file exceeding this cap is rejected
regardless of what the request otherwise claims.

**Drive object naming excludes both the client-supplied filename and `patient_id`
(docs/42 §5).** The Drive object is named from the generated `record_id` alone — never
the patient-supplied filename (a path/naming-collision risk), and never `patient_id`
either, closing the same "avoid another place patient_id could leak into a name"
concern docs/42 §5 raised about folder structure, applied here to file naming too.

**Metadata is immutable after upload; no delete exists.** No update or delete function
exists in `FoundationReports.gs` — verified as an absence in Stage 9, not merely omitted
from a feature list, per the approved architecture decision.

**No staff Web App route.** `FoundationRouter.gs` gained no staff-facing case for this
batch. The one staff-attributed path,
`createFoundationReportForExistingDriveFile()`, is a manually-run Apps Script editor
wrapper — never reachable over the network — that runs the identical content-based
validation before writing any metadata, the same no-route pattern
`createFoundationConsultationEntry()` already established. Unlike the patient-upload
path, this wrapper does not alter the referenced file's Drive sharing — that file's
placement/permissions remain staff's own responsibility, since it was never created by
this application.

**Audit logging.** Every successful upload — via the patient route, the real HTTP
dispatch, or the staff wrapper — writes its own `report_uploaded` `AuditLog` row, the
same "every write logged" discipline every other Foundation entity already follows.

## Phase 2A — Implementation Notes (Batch PA-6, Public Visibility)

The only Phase 2A batch that is a security-*posture* change rather than a
security-*mechanism* change: no `apps-script/*.gs` or `shared/*` file is touched (§4
above, verified via `git diff --name-only`).

**"Unlisted and noindexed" was never the platform's real access control, and removing
it does not weaken one.** Every data-returning/mutating endpoint has always required a
valid, unexpired, server-verified HMAC session token, with `patient_id` derived only
from that token (ADR-002, §3 above) — true before this batch and unchanged by it. The
noindex tag and the absence of a nav link were a staging-hygiene convention (keeping an
in-progress feature out of search results and off the visible site while incomplete),
not a defense layer this platform ever relied on for authorization. Batch PA-6 removes
that convention now that the feature is complete; the actual security boundary —
session verification — is exactly as strong the day before this batch as the day after.

**One page deliberately keeps its noindex tag, on SEO grounds, not security grounds.**
`my-health-journey/timeline/entry.html` (the per-record Consultation Detail view) has no
stable canonical URL — it renders whichever record a `?record_id=` query string names.
Indexing it would mean indexing a URL shape with no fixed content, not a data-exposure
risk (an unauthenticated crawler hitting it sees the same session-guard redirect any
unauthenticated visitor sees). See docs/29 §16's Batch PA-6 notes for the full
reasoning.

**No new attack surface.** The batch's entire diff is: ten public pages gaining one nav
link each, six patient pages losing a noindex tag and gaining a canonical tag, one page
keeping its noindex tag, and one new sitemap entry (`/login.html` only — the
authenticated pages behind it are deliberately not listed, since an unauthenticated
crawler could not usefully index them regardless). Verified end-to-end by
`validation/pa-6-public-nav/browser-test.js` (22/22) and a full, unchanged re-run of
every backend and browser validation suite from every prior Patient Access batch.

## Phase 1.5 — Implementation Notes (Consultation Summary Pipeline)

Full mapping of every standard above to its Phase 1.5 implementation is
in docs/25-PHASE-1.5-TECHNICAL-PLAN.md §7 — not duplicated here to avoid
drift between two copies of the same table. Summary, since Phase 1.5 is
this platform's first real backend pipeline:

- **No patient portal was created.** Phase 1.5 has no patient login by
  design (docs/25 §3, §4) — the "Patient portal" requirements above do
  not apply to it. The only write surface is a staff-only entry point,
  access-restricted to the clinic's Google Workspace domain (docs/25
  §9.1), not a public or patient-facing endpoint.
- **Audit logging** is implemented as an append-only trail on every row
  (`Phase1.5_ConsultationSummaries`): submitted → summarized → reviewed
  → sent/failed → purged, per docs/25 §5.1. Retention (`Retention.gs`)
  never modifies this trail — see docs/25 §9.3 and §11 (Batch 4F).
- **Least privilege** extends to the AI and email layers introduced
  here: the OpenRouter API key lives only in Apps Script's
  `PropertiesService`, never in any committed file, and only one module
  (`Email.gs`) is permitted to call a mail provider — see
  `apps-script/README.md`'s "Email delivery layering."
- **Data minimization / retention** has one concrete Phase-1.5-only
  policy: `recipient_email` is cleared automatically 14 days after send
  (docs/25 §9.3, locked). This is a pilot-scale policy, not a general
  retention rule for future patient data — Phase 2 will define its own
  under an authenticated data model.
- Full validation methodology and results: docs/26-PHASE-1.5-VALIDATION-REPORT.md.
  Deployment-only security items (live Workspace-domain restriction,
  HTTPS confirmation, environment separation) remain open until a live
  deployment exists — tracked in docs/28-DEPLOYMENT-READINESS.md.
