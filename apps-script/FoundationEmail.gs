/**
 * Foundation's own email delivery — the magic-link email (docs/29 §3).
 *
 * A new, independent module calling MailApp directly, deliberately not
 * routed through Phase 1.5's apps-script/Email.gs. Email.gs's own header
 * states it is "the ONLY module in this project that may call a mail
 * provider" — true for Phase 1.5's own domain (its layering diagram is
 * Send.gs -> Email.gs -> MailApp). Foundation is a structurally separate
 * domain that happens to share only the Apps Script project, not the
 * data, not the Sheets, not the Script Properties (docs/29 §14 Decision
 * 1) — the same reasoning FoundationDataStore.gs already established by
 * being Foundation's own independent SpreadsheetApp caller rather than
 * reusing Phase 1.5's Sheets.gs. Giving Foundation its own equally-scoped
 * mail sender, instead of either modifying Email.gs or bending
 * sendVisitSummaryEmail_() to a row shape it was never designed for,
 * keeps both domains independently replaceable (ADR-009) and leaves
 * Phase 1.5's existing files untouched (docs/29 §14 Decision 1).
 *
 * A real clickable link target does not exist yet — Batch 5B/5C's
 * login.html/verify.html frontend pages are explicitly out of IA-2's
 * scope (backend infrastructure only, per this session's instruction).
 * FOUNDATION_VERIFY_URL_BASE_ below is therefore a placeholder, the same
 * "correct shape, real value pending an operational/later-batch step"
 * treatment FoundationConfig.gs's PATIENT_SPREADSHEET_ID already gets —
 * stated openly here rather than silently assumed complete.
 *
 * Depends on FoundationUtils.gs (escapeFoundationHtml_).
 */

var FOUNDATION_VERIFY_URL_BASE_ = 'https://www.wisehomeopathy.com/my-health-journey/verify.html';

/**
 * Builds the login-link URL for a raw token. Pure — no Apps Script
 * dependency, testable in isolation.
 */
function foundationBuildLoginLinkUrl_(rawToken) {
  return FOUNDATION_VERIFY_URL_BASE_ + '?token=' + encodeURIComponent(rawToken);
}

/**
 * Builds the login-link email's HTML body. Pure — no Apps Script
 * dependency. Mirrors apps-script/Email.gs's buildVisitSummaryEmail_()
 * visual style for brand consistency, with its own content.
 */
function foundationBuildLoginLinkEmailHtml_(link) {
  var escapedLink = escapeFoundationHtml_(link);
  return '<!doctype html><html><body style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:24px 0;"><tr><td align="center">' +
    '<table role="presentation" width="100%" style="max-width:520px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E7EBF1;">' +
    '<tr><td style="background:linear-gradient(135deg,#27498C,#13264A);padding:22px 28px;">' +
    '<span style="color:#FFFFFF;font-size:17px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">Wise Homeopathy</span>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 28px;">' +
    '<p style="margin:0 0 16px 0;color:#0B0B0B;font-size:15px;line-height:1.6;">Use the link below to sign in to your Wise Homeopathy account. This link expires in 15 minutes and can only be used once.</p>' +
    '<p style="margin:0 0 20px 0;"><a href="' + escapedLink + '" style="color:#27498C;font-size:15px;">Sign in to Wise Homeopathy</a></p>' +
    '<p style="margin:0;color:#5B6472;font-size:13px;line-height:1.6;">If you did not request this email, you can safely ignore it — no one can access your account without also having access to this link.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 28px;background:#F4F7FB;border-top:1px solid #E7EBF1;">' +
    '<p style="margin:0;color:#9AA3B2;font-size:11px;line-height:1.5;">Wise Homeopathy Multispeciality Center, Kottayam · This is an automated login email.</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

/**
 * Sends the login-link email. Never throws — a delivery failure is an
 * expected, handleable outcome (the caller still answers the requester
 * with docs/29 §3's identical generic response either way), returned as
 * `{ok: false, error}` rather than propagated as an exception.
 */
function foundationSendLoginLinkEmail_(recipientEmail, rawToken) {
  try {
    var link = foundationBuildLoginLinkUrl_(rawToken);
    MailApp.sendEmail({
      to: recipientEmail,
      subject: 'Your Wise Homeopathy login link',
      htmlBody: foundationBuildLoginLinkEmailHtml_(link)
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}
