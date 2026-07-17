'use strict';

const nodemailer = require('nodemailer');

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

function parseSender(raw) {
  const m = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: 'RobustOTP', email: raw };
}

async function sendOTPEmail(email, otp) {
  const smtpHost = process.env.SMTP_HOST;
  const emailFrom = process.env.EMAIL_FROM;

  const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="padding:40px 40px 0;text-align:center;">
<div style="width:48px;height:48px;background:linear-gradient(135deg, #4f46e5, #7c3aed);border-radius:12px;text-align:center;line-height:48px;display:inline-block;margin-bottom:16px;">
  <span style="color:#fbbf24;font-size:24px;font-weight:bold;">&#10004;</span>
</div>
<h1 style="margin:0 0 8px;font-size:20px;color:#111111;font-weight:600;">RobustOTP</h1>
<p style="margin:0 0 24px;font-size:14px;color:#666666;">Your verification code</p>
</td></tr>
<tr><td style="padding:0 40px;text-align:center;">
<div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:28px 20px;margin-bottom:24px;">
<span style="font-size:42px;letter-spacing:8px;font-weight:700;color:#111111;font-family:monospace;">${otp}</span></div>
<p style="margin:0 0 8px;font-size:14px;color:#111111;">Enter this code to complete your verification.</p>
<p style="margin:0 0 4px;font-size:13px;color:#666666;">This code expires in <strong style="color:#111111;">5 minutes</strong>.</p>
<p style="margin:0 0 32px;font-size:12px;color:#666666;">If you didn't request this, you can safely ignore this email.</p>
</td></tr>
<tr><td style="padding:0 40px 32px;">
<hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
<p style="margin:0;font-size:11px;color:#666666;text-align:center;">RobustOTP &bull; Secure one-time password authentication</p>
</td></tr>
</table></td></tr></table></body></html>`;

  if (smtpHost) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: emailFrom || `"RobustOTP" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'RobustOTP Verification Code',
        html: htmlContent,
      });

      console.log('[email] Delivered via SMTP messageId=%s recipient=%s', info.messageId, email);
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error('[email] SMTP delivery failed: recipient=%s error=%s', email, err.message);
      return { success: false, provider: 'smtp', message: err.message };
    }
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`\n--------------------------------------------------\n[DEMO MODE] No email provider configured.\nOTP code for ${email} is: ${otp}\n--------------------------------------------------\n`);
    return { success: true, provider: 'console', messageId: 'demo-console' };
  }
  if (!emailFrom) {
    return { success: false, provider: 'brevo', status: 0, message: 'EMAIL_FROM not set', details: '' };
  }

  const sender = parseSender(emailFrom);

  try {
    const res = await fetch(BREVO_API, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email }],
        subject: 'RobustOTP Verification Code',
        htmlContent,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      const brevoMsg = body.message || body.code || 'Unknown Brevo error';
      console.error('[email] Failed: status=%s body=%j recipient=%s', res.status, body, email);
      return {
        success: false,
        provider: 'brevo',
        status: res.status,
        message: brevoMsg,
        details: JSON.stringify(body),
      };
    }

    console.log('[email] Delivered successfully messageId=%s recipient=%s', body.messageId, email);
    return { success: true, provider: 'brevo', messageId: body.messageId };
  } catch (err) {
    console.error('[email] Failed: network error recipient=%s error=%s', email, err.message);
    return {
      success: false,
      provider: 'brevo',
      status: 0,
      message: err.message,
      details: '',
    };
  }
}

module.exports = { sendOTPEmail };
