/**
 * Doctor login-link email delivery — Batch WPI-1 (docs/50-PHASE-3-
 * TECHNICAL-PLAN.md §5.4, mirroring §5's Doctor Session/Login Token
 * design). Mirrors apps-script/FoundationEmail.gs exactly, for a second,
 * isolated login flow — a new, independent module calling MailApp
 * directly, deliberately not routed through Phase 1.5's
 * apps-script/Email.gs (that file's own header states it is "the ONLY
 * module in this project that may call a mail provider" for Phase 1.5's
 * own domain specifically; FoundationEmail.gs already established the
 * precedent that Foundation-family domains get their own equally-scoped
 * sender instead).
 *
 * A real clickable doctor-facing link target does not exist yet — the
 * Doctor Dashboard frontend is WPI-4's scope, not WPI-1's ("zero
 * patient-facing surface," docs/50 §19 item 1, does not itself promise a
 * doctor-facing frontend page either). FOUNDATION_DOCTOR_VERIFY_URL_BASE_
 * below is therefore a placeholder, the same "correct shape, real value
 * pending a later batch's frontend page" treatment
 * FOUNDATION_VERIFY_URL_BASE_ already got at Batch IA-2 before
 * login.html/verify.html existed.
 *
 * Depends on FoundationUtils.gs (escapeFoundationHtml_).
 */

var FOUNDATION_DOCTOR_VERIFY_URL_BASE_ = 'https://www.wisehomeopathy.com/doctor/verify.html';

/**
 * Builds the doctor login-link URL for a raw token. Pure — no Apps Script
 * dependency, testable in isolation.
 */
function foundationBuildDoctorLoginLinkUrl_(rawToken) {
  return FOUNDATION_DOCTOR_VERIFY_URL_BASE_ + '?token=' + encodeURIComponent(rawToken);
}

/**
 * Builds the doctor login-link email's HTML body. Pure — no Apps Script
 * dependency. Mirrors foundationBuildLoginLinkEmailHtml_()'s visual style
 * for brand consistency, with doctor-facing copy.
 */
function foundationBuildDoctorLoginLinkEmailHtml_(link) {
  var escapedLink = escapeFoundationHtml_(link);
  return '<!doctype html><html><body style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:24px 0;"><tr><td align="center">' +
    '<table role="presentation" width="100%" style="max-width:520px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E7EBF1;">' +
    '<tr><td style="background:linear-gradient(135deg,#27498C,#13264A);padding:22px 28px;">' +
    '<span style="color:#FFFFFF;font-size:17px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">Wise Homeopathy</span>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 28px;">' +
    '<p style="margin:0 0 16px 0;color:#0B0B0B;font-size:15px;line-height:1.6;">Use the link below to sign in to your Wise Homeopathy doctor account. This link expires in 15 minutes and can only be used once.</p>' +
    '<p style="margin:0 0 20px 0;"><a href="' + escapedLink + '" style="color:#27498C;font-size:15px;">Sign in to Wise Homeopathy</a></p>' +
    '<p style="margin:0;color:#5B6472;font-size:13px;line-height:1.6;">If you did not request this email, you can safely ignore it — no one can access your account without also having access to this link.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 28px;background:#F4F7FB;border-top:1px solid #E7EBF1;">' +
    '<p style="margin:0;color:#9AA3B2;font-size:11px;line-height:1.5;">Wise Homeopathy Multispeciality Center, Kottayam · This is an automated login email.</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

/**
 * Sends the doctor login-link email. Never throws — a delivery failure is
 * an expected, handleable outcome, mirroring foundationSendLoginLinkEmail_()
 * exactly.
 */
function foundationSendDoctorLoginLinkEmail_(recipientEmail, rawToken) {
  try {
    var link = foundationBuildDoctorLoginLinkUrl_(rawToken);
    MailApp.sendEmail({
      to: recipientEmail,
      subject: 'Your Wise Homeopathy doctor login link',
      htmlBody: foundationBuildDoctorLoginLinkEmailHtml_(link)
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}
