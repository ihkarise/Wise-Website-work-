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
