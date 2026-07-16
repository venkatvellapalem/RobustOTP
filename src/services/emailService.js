const SibApiV3Sdk = require('@getbrevo/brevo');

let apiInstance = null;
let enabled = false;
let configuredSender = '';

function initEmail() {
  if (process.env.NODE_ENV === 'test') return;

  const { BREVO_API_KEY, EMAIL_FROM } = process.env;
  const missing = [];
  if (!BREVO_API_KEY) missing.push('BREVO_API_KEY');
  if (!EMAIL_FROM) missing.push('EMAIL_FROM');

  if (missing.length > 0) {
    console.error(`Missing ${missing.join(', ')}`);
    process.exit(1);
  }

  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.apiClient.authentications['api-key'].apiKey = BREVO_API_KEY;
  configuredSender = EMAIL_FROM;
  enabled = true;
}

function isEmailEnabled() { return enabled; }

function parseSender(sender) {
  const match = sender.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: 'RobustOTP', email: sender };
}

async function sendOTP(email, otp) {
  if (!apiInstance) return false;
  console.log(`[email] Sending OTP to ${email}...`);
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = 'RobustOTP Verification Code';
    sendSmtpEmail.htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
<tr><td style="padding:40px 40px 0;text-align:center;">
<div style="width:48px;height:48px;background:#4f46e5;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;"><span style="color:#fff;font-size:22px;font-weight:700;">R</span></div>
<h1 style="margin:0 0 8px;font-size:20px;color:#1a1a2e;font-weight:600;">RobustOTP</h1>
<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your verification code</p>
</td></tr>
<tr><td style="padding:0 40px;text-align:center;">
<div style="background:#f8f9fc;border-radius:12px;padding:28px 20px;margin-bottom:24px;">
<span style="font-size:42px;letter-spacing:8px;font-weight:700;color:#1a1a2e;font-family:monospace;">${otp}</span></div>
<p style="margin:0 0 8px;font-size:14px;color:#374151;">Enter this code to complete your verification.</p>
<p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">This code expires in <strong style="color:#6b7280;">5 minutes</strong>.</p>
<p style="margin:0 0 32px;font-size:12px;color:#9ca3af;">If you didn't request this, you can safely ignore this email.</p>
</td></tr>
<tr><td style="padding:0 40px 32px;">
<hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
<p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">RobustOTP &bull; Secure one-time password authentication</p>
</td></tr>
</table></td></tr></table></body></html>`;
    sendSmtpEmail.sender = parseSender(configuredSender);
    sendSmtpEmail.to = [{ email }];

    const { response, body } = await apiInstance.sendTransacEmail(sendSmtpEmail);

    if (response && response.statusCode >= 400) {
      console.error('[email] Failed: status=%s body=%j recipient=%s', response.statusCode, body, email);
      return false;
    }

    console.log('[email] Delivered successfully');
    return true;
  } catch (err) {
    const status = err.status || err.statusCode || err.code;
    const body = err.response?.body || err.body || err.message;
    const details = typeof body === 'object' ? JSON.stringify(body) : body;
    console.error('[email] Failed: status=%s body=%s provider=brevo recipient=%s', status, details, email);
    if (err.stack) console.error(err.stack);
    return false;
  }
}

module.exports = { initEmail, isEmailEnabled, sendOTP };
