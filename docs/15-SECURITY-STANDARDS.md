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

Concrete Phase 2A implementation of the three requirements above (not yet built,
architecture approved): docs/29-PHASE-2A-TECHNICAL-PLAN.md §10.

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
