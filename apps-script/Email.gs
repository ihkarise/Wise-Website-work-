/**
 * Email delivery layer (docs/25 §9.6, §3). This is the ONLY module in
 * this project that may call a mail provider.
 *
 * Layering (never skip a layer, never call a provider from elsewhere):
 *
 *   Send.gs  →  Email.gs  →  Mail Provider (MailApp)
 *
 * Send.gs's evaluateSendGate_()/attemptSend_() never call MailApp or
 * GmailApp directly — they call sendVisitSummaryEmail_() here. This
 * keeps the send *gate* (who is allowed to be emailed, and when)
 * independent of the delivery *mechanism* (how the email actually
 * leaves the building): swapping the provider later — a different
 * Google service, or eventually a non-Google one — only ever touches
 * this file, never Send.gs or Review.gs.
 *
 * Phase 1.5 uses MailApp only, per docs/25 §3's diagram ("Apps Script
 * sends email (MailApp)"). No other provider is introduced here.
 */

function sendVisitSummaryEmail_(row) {
  try {
    var content = buildVisitSummaryEmail_(row);
    MailApp.sendEmail({
      to: row.recipient_email,
      subject: content.subject,
      htmlBody: content.htmlBody,
      name: CONFIG.EMAIL.SENDER_NAME
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Builds the patient-facing HTML visit-summary email (docs/25 §9.6,
 * HTML-first, locked). Simple, brand-consistent, and honest about what
 * this pilot is — not a marketing email. ai_summary_draft is escaped
 * before embedding; see escapeHtml_() in Utils.gs for why.
 */
function buildVisitSummaryEmail_(row) {
  var summaryHtml = escapeHtml_(row.ai_summary_draft).replace(/\n+/g, '<br>');

  var htmlBody =
    '<!doctype html><html><body style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:24px 0;"><tr><td align="center">' +
    '<table role="presentation" width="100%" style="max-width:520px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E7EBF1;">' +
    '<tr><td style="background:linear-gradient(135deg,#27498C,#13264A);padding:22px 28px;">' +
    '<span style="color:#FFFFFF;font-size:17px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">Wise Homeopathy</span>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 28px;">' +
    '<p style="margin:0 0 16px 0;color:#0B0B0B;font-size:15px;line-height:1.6;">Following your recent consultation, here is a short summary from your doctor’s visit note:</p>' +
    '<p style="margin:0 0 20px 0;color:#0B0B0B;font-size:15px;line-height:1.7;">' + summaryHtml + '</p>' +
    '<p style="margin:0;color:#5B6472;font-size:13px;line-height:1.6;">If you have questions about this summary, please reply to this email or contact the clinic directly. This message does not replace ongoing communication with your treating physician.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 28px;background:#F4F7FB;border-top:1px solid #E7EBF1;">' +
    '<p style="margin:0;color:#9AA3B2;font-size:11px;line-height:1.5;">Wise Homeopathy Multispeciality Center, Kottayam · This is an automated visit-summary email reviewed and approved by your doctor before sending.</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';

  return {
    subject: CONFIG.EMAIL.SUBJECT,
    htmlBody: htmlBody
  };
}
