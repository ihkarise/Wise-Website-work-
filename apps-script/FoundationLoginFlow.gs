/**
 * Login flow orchestration — IA-2, the second of two independent
 * Identity & Access batches this milestone was split into (docs/29 §15).
 * Turns IA-1's LoginTokens infrastructure into an actual, working
 * magic-link login: resolves a requested email to a patient_id, issues a
 * login token, hands the raw token to FoundationEmail.gs for delivery
 * (request-link); and consumes a presented token into a real Session
 * (consume-link) — exactly the step FoundationLoginTokens.gs's own
 * header comment named as IA-2's job ("IA-2 is what turns that into a
 * real login").
 *
 * Deliberately a new file, not a modification to any of the ten frozen
 * Foundation-family files (docs/35 §9) — including PatientIdentity.gs,
 * which has no email-lookup function of its own.
 * foundationFindPatientByEmail_() below reuses FoundationDataStore.gs's
 * existing, already-generic foundationDsQuery_() operation exactly as it
 * was already designed to be reused (ADR-009) — the same "new entity
 * file reusing existing generic operations, zero frozen-file edits"
 * pattern FoundationLoginTokens.gs (IA-1) already established for
 * insert/getById/updateById. Reuses PatientIdentity.gs's own
 * FOUNDATION_PATIENTS_SHEET_/FOUNDATION_PATIENTS_COLUMNS_ globals
 * directly rather than redeclaring them (Apps Script's flat global
 * namespace already makes them reachable; redeclaring would itself be a
 * duplicate-global-name finding).
 *
 * Depends on FoundationDataStore.gs, FoundationContracts.gs,
 * FoundationErrorHandling.gs, FoundationAudit.gs, FoundationLoginTokens.gs,
 * FoundationSession.gs, FoundationRateLimit.gs, FoundationEmail.gs, and
 * PatientIdentity.gs's sheet/column constants.
 */

// ---- Pure-ish helper (one Apps Script dependency: foundationDsQuery_) ----

/**
 * Finds a Patient record by email. Foundation's Patients rows are
 * staff-entered (docs/30 §1 "No public registration"), not user-typed, so
 * a straight trim/lowercase compare is sufficient — no fuzzy matching.
 * Returns the record object or null, a clean "not found" outcome, never
 * an error — foundationHandleRequestLoginLink_() below treats "found" and
 * "not found" identically in its outward response either way
 * (anti-enumeration, ADR-010, docs/29 §3).
 *
 * Reuses FoundationDataStore.gs's existing foundationDsQuery_() —
 * previously a Deferred static-analysis finding (docs/35 §6: "A consumer
 * needing the query operation") — this is that real consumer.
 */
function foundationFindPatientByEmail_(email) {
  var normalized = String(email).trim().toLowerCase();
  var matches = foundationDsQuery_(FOUNDATION_PATIENTS_SHEET_, FOUNDATION_PATIENTS_COLUMNS_, function (p) {
    return typeof p.email === 'string' && p.email.trim().toLowerCase() === normalized;
  });
  return matches.length > 0 ? matches[0] : null;
}

// ---- Request-link ----

/**
 * Handles a login-link request. Returns the exact same generic success
 * envelope whether `email` is malformed-but-well-typed, unmatched, rate
 * limited, or matched and successfully emailed — docs/29 §3: "The
 * response is identical whether or not the email matched a patient." The
 * one distinct response is for input that isn't even a syntactically
 * valid email — that reflects only what the requester themselves typed,
 * never a signal about any other person's account, so it's safe to
 * report distinctly (the same "malformed input is not an enumeration
 * signal" boundary shared/schemas/login-token.md already draws for the
 * consume side).
 *
 * A genuinely unexpected failure (a Sheets error, a token-creation
 * failure) still surfaces as the generic FOUNDATION_UNEXPECTED_ERROR
 * envelope via withFoundationErrorHandling_() — a different outward shape
 * than the generic "ok" response, but not an enumeration leak, since it
 * does not correlate with whether the email matched a real account, only
 * with genuine backend health (the same distinction
 * foundationConsumeLoginToken_() already draws between its generic
 * rejection code and FOUNDATION_UNEXPECTED_ERROR).
 */
function foundationHandleRequestLoginLink_(input) {
  var email = input && input.email;
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'A valid email address is required.');
  }

  var genericMessage = { message: 'If that email is registered, a login link has been sent.' };

  if (!foundationCheckAndIncrementRateLimit_(email)) {
    foundationLogAuditEvent_('login_link_rate_limited', '', '', '');
    return buildFoundationOkEnvelope_(genericMessage);
  }

  return withFoundationErrorHandling_(function () {
    var patient = foundationFindPatientByEmail_(email);
    if (!patient) {
      foundationLogAuditEvent_('login_link_requested', '', '', 'reason=email_not_found');
      return genericMessage;
    }

    var tokenResult = foundationCreateLoginToken_(patient.patient_id);
    if (tokenResult.status === 'error') {
      throw new Error('foundationCreateLoginToken_ failed: ' + tokenResult.error.code);
    }

    var emailResult = foundationSendLoginLinkEmail_(patient.email, tokenResult.data.token);
    if (!emailResult.ok) {
      foundationLogAuditEvent_('login_link_email_failed', patient.patient_id, '', emailResult.error || '');
    } else {
      foundationLogAuditEvent_('login_link_requested', patient.patient_id, '', 'reason=email_sent');
    }
    return genericMessage;
  });
}

// ---- Consume-link ----

/**
 * Consumes a presented raw login-link token and, on success, issues a
 * real Session — the step IA-1 deliberately left undone. Rejection is
 * already generic (FOUNDATION_LOGIN_TOKEN_INVALID) via
 * foundationConsumeLoginToken_() itself; this function returns that
 * result unchanged on failure, adding nothing that could weaken it.
 * `patient_id` in the success response is server-derived (the just-
 * resolved value from a verified, single-use token), never client input
 * — no conflict with docs/29 §3's "never accept patient_id as
 * client-supplied input" rule, which governs *subsequent* authenticated
 * calls, not this one-time resolution step.
 */
function foundationHandleConsumeLoginLink_(input) {
  var rawToken = input && input.token;
  var consumeResult = foundationConsumeLoginToken_(rawToken);
  if (consumeResult.status === 'error') {
    return consumeResult;
  }
  return withFoundationErrorHandling_(function () {
    var patientId = consumeResult.data.patient_id;
    var sessionToken = foundationIssueSessionToken_(patientId);
    return { session_token: sessionToken, patient_id: patientId };
  });
}
