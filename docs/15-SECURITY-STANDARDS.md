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

## Phase 2A — Implementation Notes (Batch PA-4, Symptom Tracker)

**The platform's first patient-*writable* endpoints — the same ownership-check
discipline PA-3 established for reads, extended to write actions for the first time.**
`update_symptom_draft` and `submit_symptom_log` both accept a client-supplied
`record_id`; `patient_id` is still derived exclusively from the verified session
(ADR-002, unchanged) and `FoundationSymptomLog.gs`'s
`foundationGetOwnSymptomLogById_()` independently verifies the row's own `patient_id`
matches before any edit or submit proceeds — an unknown `record_id` and one belonging
to a different patient return the identical `FOUNDATION_NOT_FOUND` envelope, the same
anti-enumeration discipline docs/40 Q3 already established for reads, now covering a
write path.

**A second, narrower authorization check specific to a mutable record: state, not just
ownership.** Once ownership is confirmed, an edit or submit against a row that is no
longer `status: "draft"` is rejected too — but with a *specific*, patient-facing
message ("This entry has already been submitted...") rather than the generic
cross-patient one, since the confirmed owner learning their own record's state is not
an enumeration risk. This is a new category of check Foundation hasn't needed before:
every prior entity was either read-only for patients (Consultation History) or
write-once (every other entity's `created_at`-style fields) — Symptom Log is the first
with a real, patient-triggered state transition to guard.

**Submit-time validation re-reads live, stored state — never trusts the request
body.** `foundationSubmitSymptomLogDraft_()` validates the row's own currently-stored
field values before allowing the `draft` → `submitted` transition, the same "re-read
live state, never trust submission-time state" discipline Phase 1.5's
`evaluateSendGate_()` already established for consent gating, applied here to a
different kind of gate.

**Draft privacy is an application-layer guarantee, not a storage-layer one — stated
openly.** No Foundation route ever returns a `draft`-status row to anyone but its own
owning patient. This is enforced entirely in application code (every read function
filters by `status` and `patient_id`); it is **not** enforced by Google Sheets itself,
which has no row-level access control. Anyone with direct edit access to the
`SymptomLogs` spreadsheet could, in principle, view a draft row by opening the sheet
tab directly — the same pre-existing limitation every other Foundation entity's
Sheet-level access already has (docs/15's "least privilege" governs who has Sheet
access at all, not row-level ACLs within one sheet). Not a new gap introduced by this
batch.

Verified, not just designed: `validation/phase-2a-foundation/conformance.js`'s Stage 8
confirms cross-patient rejection on both edit and submit (direct function and real
HTTP dispatch), the specific already-submitted rejection, submit-time re-validation
against stored (not request-body) values, and that a spoofed `patient_id` field is
still ignored on the write path.

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
