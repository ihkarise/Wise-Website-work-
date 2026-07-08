/**
 * Doctor login flow orchestration — Batch WPI-1 (docs/50-PHASE-3-
 * TECHNICAL-PLAN.md §5). Mirrors apps-script/FoundationLoginFlow.gs
 * (IA-2) exactly, for a second, permanently distinct identity space
 * (ADR-017): resolves a requested email to a doctor_id, issues a login
 * token, hands the raw token to DoctorEmail.gs for delivery
 * (request-link); and consumes a presented token into a real Doctor
 * Session (consume-link).
 *
 * Deliberately a new file, not a modification to any frozen Foundation/
 * Identity & Access/Patient Access/PXP-1..11 file. Reuses
 * FoundationRateLimit.gs's existing foundationCheckAndIncrementRateLimit_()
 * unchanged — already fully generic, keyed only by a hash of the
 * normalized email, with no patient_id/doctor_id concept baked in (see
 * shared/schemas/doctor-session.md's security review §6 for the disclosed,
 * accepted overlap this implies if a doctor and patient ever shared one
 * email address). foundationFindDoctorByEmail_() (DoctorIdentity.gs)
 * reuses FoundationDataStore.gs's existing foundationDsQuery_() exactly as
 * FoundationLoginFlow.gs's own foundationFindPatientByEmail_() does.
 *
 * Depends on FoundationContracts.gs, FoundationErrorHandling.gs,
 * FoundationAudit.gs, FoundationRateLimit.gs, DoctorIdentity.gs,
 * DoctorLoginTokens.gs, DoctorSession.gs, DoctorEmail.gs.
 */

// ---- Request-link ----

/**
 * Handles a doctor login-link request. Returns the exact same generic
 * success envelope whether `email` is unmatched, rate limited, or matched
 * and successfully emailed — mirrors foundationHandleRequestLoginLink_()'s
 * docs/29 §3 anti-enumeration discipline exactly, applied to the Doctor
 * identity space.
 */
function foundationHandleRequestDoctorLoginLink_(input) {
  var email = input && input.email;
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return buildFoundationErrorEnvelope_('FOUNDATION_INVALID_INPUT', 'A valid email address is required.');
  }

  var genericMessage = { message: 'If that email is registered, a login link has been sent.' };

  if (!foundationCheckAndIncrementRateLimit_(email)) {
    foundationLogAuditEvent_('doctor_login_link_rate_limited', '', '', '');
    return buildFoundationOkEnvelope_(genericMessage);
  }

  return withFoundationErrorHandling_(function () {
    var doctor = foundationFindDoctorByEmail_(email);
    if (!doctor) {
      foundationLogAuditEvent_('doctor_login_link_requested', '', '', 'reason=email_not_found');
      return genericMessage;
    }

    var tokenResult = foundationCreateDoctorLoginToken_(doctor.doctor_id);
    if (tokenResult.status === 'error') {
      throw new Error('foundationCreateDoctorLoginToken_ failed: ' + tokenResult.error.code);
    }

    var emailResult = foundationSendDoctorLoginLinkEmail_(doctor.email, tokenResult.data.token);
    if (!emailResult.ok) {
      foundationLogAuditEvent_('doctor_login_link_email_failed', '', '', 'doctor_id=' + doctor.doctor_id + ' ' + (emailResult.error || ''));
    } else {
      foundationLogAuditEvent_('doctor_login_link_requested', '', '', 'doctor_id=' + doctor.doctor_id + ' reason=email_sent');
    }
    // Disclosed, additive touch — Batch WPI-6 (docs/50 §9, shared/schemas/
    // notification.md): mirrors FoundationLoginFlow.gs's own new call
    // exactly, doctor_id in place of patient_id. Never changes this
    // function's own gate, transport, or return value.
    foundationRecordNotification_({
      doctor_id: doctor.doctor_id,
      channel: 'email',
      type: 'login_link',
      status: emailResult.ok ? 'sent' : 'failed'
    });
    return genericMessage;
  });
}

// ---- Consume-link ----

/**
 * Consumes a presented raw doctor login-link token and, on success,
 * issues a real Doctor Session. Mirrors
 * foundationHandleConsumeLoginLink_() exactly. `doctor_id` in the success
 * response is server-derived (the just-resolved value from a verified,
 * single-use token), never client input.
 */
function foundationHandleConsumeDoctorLoginLink_(input) {
  var rawToken = input && input.token;
  var consumeResult = foundationConsumeDoctorLoginToken_(rawToken);
  if (consumeResult.status === 'error') {
    return consumeResult;
  }
  return withFoundationErrorHandling_(function () {
    var doctorId = consumeResult.data.doctor_id;
    var sessionToken = foundationIssueDoctorSessionToken_(doctorId);
    return { session_token: sessionToken, doctor_id: doctorId };
  });
}
